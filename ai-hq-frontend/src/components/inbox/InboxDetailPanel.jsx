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
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "allowed_with_logging":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    case "allowed_with_human_review":
    case "handoff_required":
    case "operator_only":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "blocked":
    case "blocked_until_repair":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
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

function Button({ children, onClick, tone = "default", disabled = false, icon: Icon }) {
  const toneMap = {
    default:
      "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900",
    cyan:
      "border-cyan-200 bg-cyan-50 text-cyan-900 hover:border-cyan-300 hover:bg-cyan-100",
    amber:
      "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300 hover:bg-amber-100",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100",
    rose:
      "border-rose-200 bg-rose-50 text-rose-900 hover:border-rose-300 hover:bg-rose-100",
    violet:
      "border-violet-200 bg-violet-50 text-violet-900 hover:border-violet-300 hover:bg-violet-100",
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
  releaseHandoff,
  setThreadStatus,
}) {
  const hasThread = Boolean(selectedThread?.id);
  const selectedName =
    selectedThread?.customer_name ||
    selectedThread?.external_username ||
    selectedThread?.external_user_id ||
    "Conversation workspace preview";

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
    <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/88 shadow-[0_18px_40px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-200/80 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Conversation workspace
            </div>
            <div className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-slate-950">
              {selectedName}
            </div>
            <div className="mt-2 text-[13px] leading-6 text-slate-500">
              {hasThread
                ? "Conversation detail, message state, action controls, and runtime breadcrumbs for the selected thread."
                : "Conversation workspace preview. Message state illustration goes here until a thread is selected."}
            </div>
          </div>

          {hasThread ? (
            <Button
              onClick={() => markRead(selectedThread.id)}
              disabled={!canMarkRead}
              icon={CheckCheck}
            >
              {actionState?.isActionPending?.("read") ? "Marking..." : "Mark as read"}
            </Button>
          ) : null}
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

      <div className="border-b border-slate-200/80 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              {selectedThread?.channel ? (
                <div
                  className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${channelTone(selectedThread.channel)}`}
                >
                  {selectedThread.channel}
                </div>
              ) : null}

              {selectedThread ? (
                <div
                  className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${stateBadgeTone(selectedState)}`}
                >
                  {prettyState(selectedState)}
                </div>
              ) : null}

              {handoffActive ? (
                <div
                  className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${getPriorityTone(selectedThread.handoff_priority)}`}
                >
                  {selectedThread.handoff_priority || "normal"}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
          <InboxMiniInfo
            label="Handoff at"
            value={fmtDateTime(selectedThread?.handoff_at)}
            icon={ShieldAlert}
          />
          <InboxMiniInfo
            label="Thread status"
            value={prettyState(selectedState)}
            icon={CheckCircle2}
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Labels
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedLabels.length ? (
                selectedLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-600"
                  >
                    {label}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">No labels attached.</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                Channel autonomy
              </div>
              <div
                className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${policyTone(executionPolicy.outcome)}`}
              >
                {titleize(executionPolicy.outcome || "unknown")}
              </div>
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              {executionPolicy.explanation}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {executionPolicy.reasonCodes.length ? (
                executionPolicy.reasonCodes.map((code) => (
                  <span
                    key={code}
                    className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-600"
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
      </div>

      <div className="grid gap-4 border-b border-slate-200/80 px-5 py-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-[420px] rounded-2xl border border-slate-200 bg-[#fbfcfd] px-4 py-4">
          {!hasThread ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="text-[16px] font-semibold tracking-[-0.03em] text-slate-900">
                Conversation workspace preview
              </div>
              <div className="mt-2 max-w-[32rem] text-sm leading-7 text-slate-500">
                Select a thread to open the message timeline. Message state illustration goes
                here until a conversation is selected.
              </div>
            </div>
          ) : surface?.loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="text-[16px] font-semibold tracking-[-0.03em] text-slate-900">
                No messages yet
              </div>
              <div className="mt-2 max-w-[32rem] text-sm leading-7 text-slate-500">
                Conversation empty-state visual placeholder. Message timeline and operator
                guidance will appear here when the thread receives activity.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
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

        <InboxReplayTraceCard
          traceSource={selectedThread}
          title="Latest execution inspect"
          subtitle="Runtime and reasoning breadcrumbs for the latest governed action on this thread."
        />
      </div>
    </section>
  );
}
