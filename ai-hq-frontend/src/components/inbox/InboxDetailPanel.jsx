import { useMemo } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCheck,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  UserCog,
  XCircle,
} from "lucide-react";

import {
  channelTone,
  deriveThreadState,
  fmtDateTime,
  fmtRelative,
  getPriorityTone,
  prettyState,
  stateBadgeTone,
} from "../../lib/inbox-ui.js";
import SettingsSurfaceBanner from "../settings/SettingsSurfaceBanner.jsx";
import InboxMessageBubble from "./InboxMessageBubble.jsx";
import InboxMiniInfo from "./InboxMiniInfo.jsx";
import InboxReplayTraceCard from "./InboxReplayTraceCard.jsx";
import { indexAttemptsByMessageCorrelation } from "./outboundAttemptTruth.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (x) => x.toUpperCase());
}

function policyTone(outcome = "") {
  switch (s(outcome).toLowerCase()) {
    case "allowed":
      return "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200";
    case "allowed_with_logging":
      return "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-200";
    case "allowed_with_human_review":
    case "handoff_required":
    case "operator_only":
      return "border-amber-400/20 bg-amber-400/[0.08] text-amber-200";
    case "blocked":
    case "blocked_until_repair":
      return "border-rose-400/20 bg-rose-400/[0.08] text-rose-200";
    default:
      return "border-white/10 bg-white/[0.04] text-slate-300";
  }
}

function Button({ children, onClick, tone = "default", disabled = false, icon: Icon }) {
  const toneMap = {
    default:
      "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.08]",
    cyan:
      "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-100 hover:border-cyan-400/30 hover:bg-cyan-400/[0.14]",
    amber:
      "border-amber-400/20 bg-amber-400/[0.08] text-amber-100 hover:border-amber-400/30 hover:bg-amber-400/[0.14]",
    emerald:
      "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-100 hover:border-emerald-400/30 hover:bg-emerald-400/[0.14]",
    rose:
      "border-rose-400/20 bg-rose-400/[0.08] text-rose-100 hover:border-rose-400/30 hover:bg-rose-400/[0.14]",
    violet:
      "border-violet-400/20 bg-violet-400/[0.08] text-violet-100 hover:border-violet-400/30 hover:bg-violet-400/[0.14]",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-medium transition",
        toneMap[tone] || toneMap.default,
        disabled ? "cursor-not-allowed opacity-45" : "",
      ].join(" ")}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

function deriveExecutionPolicy(thread = {}) {
  const safeThread = obj(thread);
  const meta = obj(safeThread.last_decision_meta || safeThread.lastDecisionMeta);
  const outcome = s(
    meta.executionPolicyOutcome || meta.execution_policy_outcome || "unknown"
  ).toLowerCase();
  const reasonCodes = arr(
    meta.executionPolicyReasonCodes || meta.execution_policy_reason_codes
  )
    .map((item) => s(item).toLowerCase())
    .filter(Boolean);

  let explanation = "No thread-level execution policy telemetry has been recorded yet.";
  if (outcome === "blocked_until_repair") {
    explanation =
      "Inbox autonomy is fail-closed for this thread until runtime repair restores valid authority.";
  } else if (outcome === "blocked") {
    explanation = "Inbox autonomy is blocked for this thread by governed policy posture.";
  } else if (outcome === "handoff_required") {
    explanation =
      "This thread requires operator handoff before the channel can continue autonomously.";
  } else if (outcome === "allowed_with_human_review") {
    explanation =
      "Autonomy is constrained here and requires human review before risky execution continues.";
  } else if (outcome === "operator_only") {
    explanation = "This thread is currently restricted to operator-controlled execution.";
  } else if (outcome === "allowed_with_logging") {
    explanation =
      "Autonomy is available here, with logging expected for the governed action path.";
  } else if (outcome === "allowed") {
    explanation =
      "Healthy low-risk autonomous execution was allowed for the last decision on this thread.";
  }

  return { outcome, reasonCodes, explanation };
}

export default function InboxDetailPanel({
  selectedThread,
  messages,
  outboundAttempts,
  onInspectLineage,
  surface,
  actionState,
  markRead,
  assignThread,
  activateHandoff,
  setThreadStatus,
  composer = null,
}) {
  const hasThread = Boolean(selectedThread?.id);
  const selectedName =
    selectedThread?.customer_name ||
    selectedThread?.external_username ||
    selectedThread?.external_user_id ||
    "Conversation workspace preview";
  const selectedHandle = selectedThread?.external_username
    ? `@${String(selectedThread.external_username).replace(/^@+/, "")}`
    : selectedThread?.external_user_id || "Awaiting thread selection";

  const selectedState = deriveThreadState(selectedThread);
  const selectedLabels = Array.isArray(selectedThread?.labels) ? selectedThread.labels : [];
  const unreadCount = Number(selectedThread?.unread_count ?? 0);
  const handoffActive = Boolean(selectedThread?.handoff_active);
  const assignedTo = selectedThread?.assigned_to || "--";

  const executionPolicy = deriveExecutionPolicy(selectedThread);
  const canAssign = hasThread && !actionState?.isActionPending?.("assign");
  const canActivateHandoff =
    hasThread && !handoffActive && !actionState?.isActionPending?.("handoff");
  const canReleaseHandoff =
    hasThread && handoffActive && !actionState?.isActionPending?.("release");
  const canResolve =
    hasThread &&
    selectedThread?.status !== "resolved" &&
    selectedThread?.status !== "closed" &&
    !actionState?.isActionPending?.("resolved");
  const canClose =
    hasThread &&
    selectedThread?.status !== "closed" &&
    !actionState?.isActionPending?.("closed");
  const canMarkRead =
    hasThread && unreadCount > 0 && !actionState?.isActionPending?.("read");
  const attemptsByCorrelation = useMemo(
    () => indexAttemptsByMessageCorrelation(outboundAttempts),
    [outboundAttempts]
  );

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0c1424]">
      <div className="border-b border-white/8 px-5 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Conversation workspace
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[24px] font-semibold tracking-[-0.04em] text-white">
                {selectedName}
              </h2>
              {selectedThread?.channel ? (
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${channelTone(
                    selectedThread.channel
                  )}`}
                >
                  {selectedThread.channel}
                </span>
              ) : null}
              {selectedThread ? (
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${stateBadgeTone(
                    selectedState
                  )}`}
                >
                  {prettyState(selectedState)}
                </span>
              ) : null}
              {handoffActive ? (
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${getPriorityTone(
                    selectedThread.handoff_priority
                  )}`}
                >
                  handoff {selectedThread.handoff_priority || "normal"}
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-sm text-slate-400">{selectedHandle}</div>
            <div className="mt-3 text-sm leading-6 text-slate-400">
              {hasThread
                ? "Full thread history, operator actions, and channel-aware reply controls for the selected conversation."
                : "Select a thread to open the conversation timeline, operator actions, and composer."}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {hasThread ? (
              <Button
                onClick={() => markRead(selectedThread.id)}
                disabled={!canMarkRead}
                icon={CheckCheck}
              >
                {actionState?.isActionPending?.("read") ? "Marking..." : "Mark as read"}
              </Button>
            ) : null}
            <Button
              tone="violet"
              icon={UserCog}
              onClick={() => assignThread(selectedThread?.id)}
              disabled={!canAssign}
            >
              {actionState?.isActionPending?.("assign") ? "Assigning..." : "Assign"}
            </Button>
            <Button
              tone="amber"
              icon={ShieldAlert}
              onClick={() => activateHandoff(selectedThread?.id)}
              disabled={!canActivateHandoff}
            >
              {actionState?.isActionPending?.("handoff")
                ? "Activating..."
                : "Activate handoff"}
            </Button>
            <Button
              tone="cyan"
              icon={Bot}
              onClick={() => releaseHandoff(selectedThread?.id)}
              disabled={!canReleaseHandoff}
            >
              {actionState?.isActionPending?.("release") ? "Releasing..." : "Release AI"}
            </Button>
            <Button
              tone="emerald"
              icon={CheckCircle2}
              onClick={() => setThreadStatus(selectedThread?.id, "resolved")}
              disabled={!canResolve}
            >
              {actionState?.isActionPending?.("resolved") ? "Resolving..." : "Resolve"}
            </Button>
            <Button
              tone="rose"
              icon={XCircle}
              onClick={() => setThreadStatus(selectedThread?.id, "closed")}
              disabled={!canClose}
            >
              {actionState?.isActionPending?.("closed") ? "Closing..." : "Close"}
            </Button>
          </div>
        </div>

        {hasThread ? (
          <div className="mt-4">
            <SettingsSurfaceBanner
              surface={surface}
              unavailableMessage="Conversation detail is temporarily unavailable."
              refreshLabel="Refresh conversation"
            />
          </div>
        ) : null}
      </div>

      <div className="border-b border-white/8 px-5 py-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(220px,300px)]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InboxMiniInfo
              label="AI state"
              value={handoffActive ? "AI paused" : "AI active"}
              icon={Bot}
            />
            <InboxMiniInfo label="Assigned" value={assignedTo} icon={UserCog} />
            <InboxMiniInfo
              label="Last activity"
              value={fmtRelative(selectedThread?.last_message_at || selectedThread?.updated_at)}
              icon={RefreshCw}
            />
            <InboxMiniInfo label="Unread" value={String(unreadCount)} icon={AlertTriangle} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Channel autonomy
              </div>
              <div
                className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${policyTone(
                  executionPolicy.outcome
                )}`}
              >
                {titleize(executionPolicy.outcome || "unknown")}
              </div>
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-300">
              {executionPolicy.explanation}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {executionPolicy.reasonCodes.length ? (
                executionPolicy.reasonCodes.map((code) => (
                  <span
                    key={code}
                    className="rounded-full border border-white/10 bg-black/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-400"
                  >
                    {titleize(code)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">Telemetry unavailable</span>
              )}
            </div>
          </div>
        </div>

        {hasThread ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {selectedLabels.length ? (
              selectedLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-400"
                >
                  {label}
                </span>
              ))
            ) : (
              <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                No labels attached
              </span>
            )}

            <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Handoff at {fmtDateTime(selectedThread?.handoff_at)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-5 py-5">
        <div className="flex h-full min-h-[420px] flex-col rounded-[28px] border border-white/10 bg-[#09111f]">
          <div className="border-b border-white/8 px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Message history
            </div>
            <div className="mt-1 text-sm text-slate-400">
              {hasThread
                ? "All messages for the selected thread appear here."
                : "Conversation empty-state visual placeholder."}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {!hasThread ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="text-[16px] font-semibold tracking-[-0.03em] text-white">
                  Conversation workspace preview
                </div>
                <div className="mt-2 max-w-[32rem] text-sm leading-7 text-slate-400">
                  Select a thread to open the message timeline. Conversation empty-state
                  visual placeholder.
                </div>
              </div>
            ) : surface?.loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="text-[16px] font-semibold tracking-[-0.03em] text-white">
                  No messages yet
                </div>
                <div className="mt-2 max-w-[32rem] text-sm leading-7 text-slate-400">
                  Conversation empty-state visual placeholder. Channel-aware reply
                  controls will live here when the thread receives activity.
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((message) => (
                  <InboxMessageBubble
                    key={message.id}
                    m={message}
                    attemptsByCorrelation={attemptsByCorrelation}
                    onInspectLineage={onInspectLineage}
                  />
                ))}
              </div>
            )}
          </div>

          {hasThread ? (
            <div className="border-t border-white/8 px-4 py-4">
              <InboxReplayTraceCard
                traceSource={selectedThread}
                compact
                title="Latest execution inspect"
                subtitle="Runtime and reasoning breadcrumbs for the latest governed action on this thread."
              />
            </div>
          ) : null}
        </div>
      </div>

      {composer}
    </section>
  );
}
