import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  Check,
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
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import { InlineNotice } from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

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

function getWorkspaceStatusTone(choice = {}) {
  if (choice.active) return "brand";
  if (choice.workspaceReady) return "success";
  if (choice.setupRequired) return "warning";
  return "neutral";
}

function dotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand" || tone === "info") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

function StatCard({ label, value, tone = "neutral", hint = "" }) {
  return (
    <Card padded="sm" tone={tone}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
        {label}
      </div>

      <div className="mt-2 text-[22px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
        {value}
      </div>

      {hint ? (
        <div className="mt-1 text-[13px] font-medium leading-5 text-text-muted">
          {hint}
        </div>
      ) : null}
    </Card>
  );
}

function SelectionMark({ selected = false }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[8px] border",
        "transition-[background-color,border-color,color] duration-base ease-premium",
        selected
          ? "border-brand bg-brand text-white"
          : "border-line bg-surface text-transparent"
      )}
    >
      <Check
        className={cx(
          "h-[13px] w-[13px] transition-opacity duration-base ease-premium",
          selected ? "opacity-100" : "opacity-0"
        )}
        strokeWidth={3}
      />
    </span>
  );
}

function WorkspaceCard({ choice, busy = false, onSelect }) {
  const active = Boolean(choice.active);
  const status = getWorkspaceStatusLabel(choice);
  const tone = getWorkspaceStatusTone(choice);
  const name = formatWorkspaceName(choice);
  const tenantKey = s(choice.tenantKey);
  const role = s(choice.role || "member");

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onSelect(choice)}
      className="block w-full text-left"
    >
      <Card
        padded="md"
        interactive={!busy}
        tone={tone}
        className={cx(
          "h-full",
          active && "bg-brand-soft/55",
          busy && "cursor-not-allowed opacity-70"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-line-soft bg-surface text-brand shadow-[var(--shadow-inset-top)]">
              <BriefcaseBusiness className="h-5 w-5" strokeWidth={2.05} />
            </span>

            <div className="mt-4 truncate text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
              {name}
            </div>

            <div className="mt-1 truncate text-[13px] font-medium leading-6 text-text-muted">
              {tenantKey ? `${tenantKey} · ${role}` : role}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={tone} size="sm">
              <span className={cx("h-1.5 w-1.5 rounded-full", dotClass(tone))} />
              {status}
            </Badge>

            <SelectionMark selected={active} />
          </div>
        </div>

        <div className="mt-5 rounded-[15px] border border-line-soft bg-surface-muted px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
                Destination
              </div>

              <div className="mt-1 text-[13.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
                Product home
              </div>
            </div>

            <div className="inline-flex shrink-0 items-center gap-2 text-[13px] font-semibold text-brand">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.1} />
                  <span>Opening</span>
                </>
              ) : (
                <>
                  <span>Open</span>
                  <ArrowRight className="h-4 w-4" strokeWidth={2.1} />
                </>
              )}
            </div>
          </div>
        </div>
      </Card>
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

  const readyCount = useMemo(
    () => sortedChoices.filter((item) => item.workspaceReady).length,
    [sortedChoices]
  );

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
    <div className="auth-page min-h-screen bg-white text-text">
      <main className="mx-auto flex min-h-screen w-full max-w-[980px] flex-col justify-center px-6 py-10">
        <section className="w-full">
          <div className="flex flex-col gap-5 border-b border-line-soft pb-6 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0 max-w-[680px]">
              <Badge tone="brand" size="sm">
                Business selector
              </Badge>

              <h1 className="mt-4 font-display text-[40px] font-semibold leading-[0.98] tracking-[var(--tracking-tight-xl)] text-text md:text-[52px]">
                Choose the business you want to open.
              </h1>

              <p className="mt-4 max-w-[640px] text-[15px] font-medium leading-7 text-text-muted">
                {s(viewer?.fullName || viewer?.email)
                  ? `${s(viewer?.fullName || viewer?.email)}, select the business you want to continue with.`
                  : "Select the business you want to continue with."}
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 md:w-[360px]">
              <StatCard
                label="Businesses"
                value={sortedChoices.length}
                hint="Available to this account"
              />

              <StatCard
                label="Ready now"
                value={readyCount}
                tone="brand"
                hint="Can open immediately"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-[13px] font-medium leading-6 text-text-muted">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-line-soft bg-surface text-brand shadow-[var(--shadow-inset-top)]">
                <CheckCircle2 className="h-4 w-4" strokeWidth={2.05} />
              </span>
              <span>Opening a workspace lands directly inside the product shell.</span>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              leftIcon={
                loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.1} />
                ) : (
                  <RefreshCcw className="h-4 w-4" strokeWidth={2.1} />
                )
              }
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
                compact
              />
            </div>
          ) : null}

          <div className="mt-6">
            {loading ? (
              <Card padded="lg">
                <div className="flex min-h-[260px] items-center justify-center">
                  <div className="inline-flex items-center gap-3 rounded-[14px] border border-line-soft bg-surface-muted px-4 py-3 text-[14px] font-medium text-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.1} />
                    Loading your businesses...
                  </div>
                </div>
              </Card>
            ) : sortedChoices.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {sortedChoices.map((choice) => {
                  const busy =
                    switchingMembershipId &&
                    switchingMembershipId === s(choice.membershipId);

                  return (
                    <WorkspaceCard
                      key={
                        s(choice.membershipId) ||
                        `${s(choice.tenantKey)}-${s(choice.role)}`
                      }
                      choice={choice}
                      busy={busy}
                      onSelect={handleSelect}
                    />
                  );
                })}
              </div>
            ) : (
              <Card padded="lg" tone="warning">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-[rgba(var(--color-warning),0.18)] bg-warning-soft text-warning shadow-[var(--shadow-inset-top)]">
                    <AlertCircle className="h-5 w-5" strokeWidth={2.05} />
                  </span>

                  <div>
                    <div className="text-[15px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                      No workspace choices found
                    </div>

                    <div className="mt-1 text-[13.5px] font-medium leading-6 text-text-muted">
                      Refresh your session or sign in again to continue.
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}