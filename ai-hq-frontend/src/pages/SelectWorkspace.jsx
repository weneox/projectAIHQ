import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Loader2,
  RefreshCcw,
} from "lucide-react";

import { switchWorkspaceUser } from "../api/auth.js";
import { clearAppSessionContext, getAppAuthContext } from "../lib/appSession.js";
import {
  PRODUCT_HOME_ROUTE,
  getAuthWorkspaceChoices,
  hasMultipleWorkspaceChoices,
} from "../lib/appEntry.js";
import Button from "../components/ui/Button.jsx";
import {
  AuthFrame,
  AuthPanel,
  InlineNotice,
  MetricCard,
  Surface,
} from "../components/ui/AppShellPrimitives.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function formatWorkspaceName(choice = {}) {
  return (
    s(choice.companyName) ||
    s(choice.tenantKey)
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") ||
    "Workspace"
  );
}

function getWorkspaceStatusLabel(choice = {}) {
  if (choice.active) return "Current";
  if (choice.workspaceReady) return "Ready";
  if (choice.setupRequired) return "Setup required";
  return "Select";
}

function WorkspaceCard({ choice, busy = false, onSelect }) {
  const active = !!choice.active;
  const status = getWorkspaceStatusLabel(choice);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onSelect(choice)}
      className={[
        "group w-full rounded-[28px] border px-5 py-5 text-left transition-all duration-200",
        active
          ? "border-brand/20 bg-brand-soft shadow-[0_18px_40px_-30px_rgba(37,99,235,0.28)]"
          : "border-line bg-surface hover:-translate-y-0.5 hover:border-line-strong hover:shadow-panel",
        busy ? "cursor-not-allowed opacity-70" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-[18px] border border-line bg-white text-brand">
            <BriefcaseBusiness className="h-4 w-4" />
          </div>

          <div className="mt-4 text-[18px] font-semibold tracking-[-0.03em] text-text">
            {formatWorkspaceName(choice)}
          </div>

          <div className="mt-1 text-[13px] leading-6 text-text-muted">
            {s(choice.tenantKey)} · {s(choice.role || "member")}
          </div>
        </div>

        <div className="shrink-0 rounded-full border border-line bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
          {status}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-[20px] border border-line-soft bg-surface-muted px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
            Destination
          </div>
          <div className="mt-1 text-sm text-text">Product home</div>
        </div>
        <div className="inline-flex items-center gap-2 text-sm font-medium text-brand">
          <span>{busy ? "Opening..." : "Open"}</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </div>
    </button>
  );
}

export default function SelectWorkspace() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState(null);
  const [choices, setChoices] = useState([]);
  const [error, setError] = useState("");
  const [switchingMembershipId, setSwitchingMembershipId] = useState("");

  const sortedChoices = useMemo(() => {
    return arr(choices)
      .slice()
      .sort((left, right) => {
        if (Number(right.active) !== Number(left.active)) {
          return Number(right.active) - Number(left.active);
        }
        if (Number(right.workspaceReady) !== Number(left.workspaceReady)) {
          return Number(right.workspaceReady) - Number(left.workspaceReady);
        }
        return formatWorkspaceName(left).localeCompare(formatWorkspaceName(right));
      });
  }, [choices]);

  useEffect(() => {
    let alive = true;

    async function load(force = true) {
      try {
        setLoading(true);
        setError("");

        const auth = await getAppAuthContext({ force });
        if (!alive) return;

        if (!auth?.authenticated) {
          navigate("/login", { replace: true });
          return;
        }

        const nextChoices = getAuthWorkspaceChoices(auth);

        if (!hasMultipleWorkspaceChoices(auth)) {
          navigate(PRODUCT_HOME_ROUTE, { replace: true });
          return;
        }

        setViewer(auth?.user || null);
        setChoices(nextChoices);
      } catch (loadError) {
        if (!alive) return;
        setError(
          s(loadError?.message || "We could not load your businesses right now.")
        );
      } finally {
        if (alive) setLoading(false);
      }
    }

    load(true);

    return () => {
      alive = false;
    };
  }, [navigate]);

  async function handleRefresh() {
    try {
      setLoading(true);
      setError("");
      clearAppSessionContext();

      const auth = await getAppAuthContext({ force: true });
      const nextChoices = getAuthWorkspaceChoices(auth);

      if (!hasMultipleWorkspaceChoices(auth)) {
        navigate(PRODUCT_HOME_ROUTE, { replace: true });
        return;
      }

      setViewer(auth?.user || null);
      setChoices(nextChoices);
    } catch (refreshError) {
      setError(
        s(refreshError?.message || "We could not refresh your businesses right now.")
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(choice) {
    if (!choice || switchingMembershipId) return;

    const membershipId = s(choice.membershipId);

    if (choice.active) {
      navigate(PRODUCT_HOME_ROUTE, { replace: true });
      return;
    }

    if (!s(choice.switchToken)) {
      setError("This business cannot be opened because the switch token is missing.");
      return;
    }

    try {
      setSwitchingMembershipId(membershipId);
      setError("");
      await switchWorkspaceUser({ switchToken: choice.switchToken });
      clearAppSessionContext();
      navigate(PRODUCT_HOME_ROUTE, { replace: true });
    } catch (switchError) {
      setError(
        s(switchError?.message || "We could not switch to that business right now.")
      );
    } finally {
      setSwitchingMembershipId("");
    }
  }

  return (
    <AuthFrame
      aside={
        <Surface className="flex w-full flex-col justify-between rounded-[32px] border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(239,244,255,0.94))] p-8">
          <div>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-[18px] border border-line bg-brand-soft text-brand">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-subtle">
              Workspace selection
            </div>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.05em] text-text">
              Step into the right business without leaving the product language.
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-text-muted">
              Use the same calm light system to choose where you want to work, then land directly inside the product shell.
            </p>
          </div>

          <div className="grid gap-3">
            <MetricCard label="Businesses" value={sortedChoices.length} />
            <MetricCard
              label="Ready now"
              value={sortedChoices.filter((item) => item.workspaceReady).length}
              tone="brand"
            />
          </div>
        </Surface>
      }
    >
      <AuthPanel className="max-w-[860px]">
        <div className="flex flex-col gap-4 border-b border-line-soft pb-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-subtle">
              Business selector
            </div>
            <h1 className="mt-4 text-[2.35rem] font-semibold tracking-[-0.05em] text-text">
              Choose the business you want to open.
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-7 text-text-muted">
              {s(viewer?.fullName || viewer?.email)
                ? `${s(viewer?.fullName || viewer?.email)}, select the business you want to continue with.`
                : "Select the business you want to continue with."}
            </p>
          </div>

          <Button
            variant="secondary"
            onClick={handleRefresh}
            disabled={loading}
            leftIcon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        </div>

        {error ? (
          <div className="mt-5">
            <InlineNotice
              tone="danger"
              title="Workspace selection failed"
              description={error}
              icon={AlertCircle}
            />
          </div>
        ) : null}

        <div className="mt-6">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="inline-flex items-center gap-3 rounded-full border border-line bg-surface px-4 py-2 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading your businesses...
              </div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {sortedChoices.map((choice) => {
                const busy =
                  switchingMembershipId &&
                  switchingMembershipId === s(choice.membershipId);

                return (
                  <WorkspaceCard
                    key={s(choice.membershipId) || `${s(choice.tenantKey)}-${s(choice.role)}`}
                    choice={choice}
                    busy={busy}
                    onSelect={handleSelect}
                  />
                );
              })}
            </div>
          )}
        </div>
      </AuthPanel>
    </AuthFrame>
  );
}
