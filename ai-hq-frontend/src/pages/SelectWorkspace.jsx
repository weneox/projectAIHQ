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
  getAuthWorkspaceChoices,
  getActiveAuthWorkspace,
  hasMultipleWorkspaceChoices,
  resolveWorkspaceContractRoute,
} from "../lib/appEntry.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
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

function getWorkspaceActionLabel(choice = {}) {
  return choice.workspaceReady ? "Open workspace" : "Continue setup";
}

function getWorkspaceStatusLabel(choice = {}) {
  if (choice.active) return "Current";
  if (choice.workspaceReady) return "Ready";
  if (choice.setupRequired) return "Setup required";
  return "Select";
}

function SelectWorkspaceCard({
  choice,
  busy = false,
  onSelect,
}) {
  const active = !!choice.active;
  const label = getWorkspaceActionLabel(choice);
  const status = getWorkspaceStatusLabel(choice);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onSelect(choice)}
      className={cn(
        "group w-full rounded-[22px] border p-5 text-left transition-all duration-200",
        active
          ? "border-[#0b5b60] bg-[#0b5b60] text-white shadow-[0_24px_80px_rgba(11,91,96,.22)]"
          : "border-[#d8dfde] bg-white text-slate-900 hover:-translate-y-0.5 hover:border-[#aebfbd] hover:shadow-[0_20px_60px_rgba(15,23,42,.08)]",
        busy && "cursor-not-allowed opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-2xl border",
              active
                ? "border-white/18 bg-white/10 text-white"
                : "border-[#dfe7e5] bg-[#f7f9f8] text-[#0b5b60]"
            )}
          >
            <BriefcaseBusiness className="h-4 w-4" />
          </div>

          <div className="mt-4 text-[17px] font-semibold leading-7">
            {formatWorkspaceName(choice)}
          </div>

          <div
            className={cn(
              "mt-1 text-[13px] leading-6",
              active ? "text-white/72" : "text-slate-500"
            )}
          >
            {s(choice.tenantKey)} · {s(choice.role || "member")}
          </div>
        </div>

        <div
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
            active
              ? "border-white/15 bg-white/10 text-white/84"
              : "border-[#e1e8e6] bg-[#f8faf9] text-slate-500"
          )}
        >
          {status}
        </div>
      </div>

      <div
        className={cn(
          "mt-5 flex items-center justify-between rounded-2xl border px-4 py-3",
          active
            ? "border-white/12 bg-white/8"
            : "border-[#e8efed] bg-[#fbfcfb]"
        )}
      >
        <div className="min-w-0">
          <div
            className={cn(
              "text-[12px] font-semibold uppercase tracking-[0.16em]",
              active ? "text-white/68" : "text-slate-400"
            )}
          >
            Destination
          </div>
          <div
            className={cn(
              "mt-1 text-[14px] leading-6",
              active ? "text-white" : "text-slate-700"
            )}
          >
            {choice.workspaceReady ? "Workspace" : "Setup Studio"}
          </div>
        </div>

        <div
          className={cn(
            "inline-flex items-center gap-2 text-[13px] font-medium",
            active ? "text-white" : "text-[#0b5b60]"
          )}
        >
          <span>{busy ? "Opening..." : label}</span>
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
        const activeWorkspace = getActiveAuthWorkspace(auth);
        const activeRoute = resolveWorkspaceContractRoute(
          activeWorkspace || auth?.workspace || auth
        );

        if (!hasMultipleWorkspaceChoices(auth)) {
          navigate(activeRoute, { replace: true });
          return;
        }

        setViewer(auth?.user || null);
        setChoices(nextChoices);
      } catch (loadError) {
        if (!alive) return;
        setError(
          s(
            loadError?.message ||
              "We could not load your businesses right now."
          )
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
        const activeWorkspace = getActiveAuthWorkspace(auth);
        navigate(
          resolveWorkspaceContractRoute(activeWorkspace || auth?.workspace || auth),
          { replace: true }
        );
        return;
      }

      setViewer(auth?.user || null);
      setChoices(nextChoices);
    } catch (refreshError) {
      setError(
        s(
          refreshError?.message ||
            "We could not refresh your businesses right now."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(choice) {
    if (!choice || switchingMembershipId) return;

    const membershipId = s(choice.membershipId);
    const destination = resolveWorkspaceContractRoute(choice);

    if (choice.active) {
      navigate(destination, { replace: true });
      return;
    }

    if (!s(choice.switchToken)) {
      setError("This business cannot be opened because the switch token is missing.");
      return;
    }

    try {
      setSwitchingMembershipId(membershipId);
      setError("");

      const response = await switchWorkspaceUser({
        switchToken: choice.switchToken,
      });

      clearAppSessionContext();
      navigate(resolveWorkspaceContractRoute(response?.workspace || response), {
        replace: true,
      });
    } catch (switchError) {
      setError(
        s(
          switchError?.message ||
            "We could not switch to that business right now."
        )
      );
    } finally {
      setSwitchingMembershipId("");
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f6] px-6 py-8 text-slate-950 sm:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="overflow-hidden rounded-[30px] border border-[#dde4e2] bg-white shadow-[0_30px_100px_rgba(15,23,42,.06)]">
          <div className="border-b border-[#e7eceb] px-6 py-5 sm:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#dfe6e4] bg-[#f8faf9] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0b5b60]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Business selector
                </div>

                <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-slate-950 sm:text-[32px]">
                  Choose the business you want to open
                </h1>

                <p className="mt-2 max-w-2xl text-[15px] leading-7 text-slate-600">
                  {s(viewer?.fullName || viewer?.email)
                    ? `${s(viewer?.fullName || viewer?.email)}, select the workspace you want to continue with.`
                    : "Select the workspace you want to continue with."}
                </p>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex h-[44px] items-center justify-center gap-2 rounded-[14px] border border-[#d8dfde] bg-white px-4 text-[14px] font-medium text-slate-700 transition hover:border-[#bcc9c7] hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Refresh
              </button>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8">
            {error ? (
              <div className="mb-5 flex items-start gap-3 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 text-[14px] leading-6">{error}</div>
              </div>
            ) : null}

            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <div className="inline-flex items-center gap-3 rounded-full border border-[#dde4e2] bg-[#f8faf9] px-4 py-2 text-sm text-slate-600">
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
                    <SelectWorkspaceCard
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}