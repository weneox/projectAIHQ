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

function Button({ children, onClick, tone = "default", disabled = false, icon: Icon }) {
  const toneMap = {
    default:
      "border-white/10 bg-white/[0.04] text-white/76 hover:border-white/16 hover:bg-white/[0.06] hover:text-white",
    cyan:
      "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-100 hover:border-cyan-400/30 hover:bg-cyan-400/[0.12]",
    amber:
      "border-amber-300/20 bg-amber-300/[0.08] text-amber-100 hover:border-amber-300/30 hover:bg-amber-300/[0.12]",
    emerald:
      "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-100 hover:border-emerald-400/30 hover:bg-emerald-400/[0.12]",
    rose:
      "border-rose-400/20 bg-rose-400/[0.08] text-rose-100 hover:border-rose-400/30 hover:bg-rose-400/[0.12]",
    violet:
      "border-violet-400/20 bg-violet-400/[0.08] text-violet-100 hover:border-violet-400/30 hover:bg-violet-400/[0.12]",
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
    "No thread selected";

  const selectedState = deriveThreadState(selectedThread);
  const selectedLabels = Array.isArray(selectedThread?.labels) ? selectedThread.labels : [];
  const unreadCount = Number(selectedThread?.unread_count ?? 0);
  const handoffActive = Boolean(selectedThread?.handoff_active);
  const assignedTo = selectedThread?.assigned_to || "—";

  const canAssign = hasThread && !actionState?.isActionPending?.("assign");
  const canActivateHandoff = hasThread && !handoffActive && !actionState?.isActionPending?.("handoff");
  const canReleaseHandoff = hasThread && handoffActive && !actionState?.isActionPending?.("release");
  const canResolve =
    hasThread &&
    selectedThread?.status !== "resolved" &&
    selectedThread?.status !== "closed" &&
    !actionState?.isActionPending?.("resolved");
  const canClose = hasThread && selectedThread?.status !== "closed" && !actionState?.isActionPending?.("closed");
  const canMarkRead = hasThread && unreadCount > 0 && !actionState?.isActionPending?.("read");

  return (
    <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[17px] font-semibold tracking-[-0.03em] text-white">Conversation Detail</div>
          <div className="mt-1 text-sm text-white/46">Selected thread status, timeline, and control panel.</div>
        </div>

        {hasThread ? (
          <Button onClick={() => markRead(selectedThread.id)} disabled={!canMarkRead} icon={CheckCheck}>
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

      <div className="mt-5 rounded-[24px] border border-white/8 bg-black/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="truncate text-[16px] font-semibold tracking-[-0.03em] text-white">{selectedName}</div>
            <div className="mt-1 truncate text-sm text-white/42">
              {selectedThread?.external_username
                ? `@${String(selectedThread.external_username).replace(/^@+/, "")}`
                : selectedThread?.external_user_id || "—"}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedThread?.channel ? (
              <div className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${channelTone(selectedThread.channel)}`}>
                {selectedThread.channel}
              </div>
            ) : null}

            {selectedThread ? (
              <div className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${stateBadgeTone(selectedState)}`}>
                {prettyState(selectedState)}
              </div>
            ) : null}

            {handoffActive ? (
              <div className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${getPriorityTone(selectedThread.handoff_priority)}`}>
                {selectedThread.handoff_priority || "normal"}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <InboxMiniInfo label="AI state" value={handoffActive ? "AI paused" : "AI active"} icon={Bot} />
          <InboxMiniInfo label="Assigned" value={assignedTo} icon={UserCog} />
          <InboxMiniInfo label="Last activity" value={fmtRelative(selectedThread?.last_message_at || selectedThread?.updated_at)} icon={RefreshCw} />
          <InboxMiniInfo label="Unread" value={String(unreadCount)} icon={AlertTriangle} />
          <InboxMiniInfo label="Handoff at" value={fmtDateTime(selectedThread?.handoff_at)} icon={ShieldAlert} />
          <InboxMiniInfo label="Thread status" value={prettyState(selectedState)} icon={CheckCircle2} />
        </div>

        <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/32">Labels</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedLabels.length ? (
              selectedLabels.map((label) => (
                <span key={label} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/70">
                  {label}
                </span>
              ))
            ) : (
              <span className="text-sm text-white/50">—</span>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button tone="violet" icon={UserCog} onClick={() => assignThread(selectedThread?.id)} disabled={!canAssign}>
            {actionState?.isActionPending?.("assign") ? "Assigning..." : "Assign"}
          </Button>

          <Button tone="amber" icon={ShieldAlert} onClick={() => activateHandoff(selectedThread?.id)} disabled={!canActivateHandoff}>
            {actionState?.isActionPending?.("handoff") ? "Activating..." : "Activate handoff"}
          </Button>

          <Button tone="cyan" icon={Bot} onClick={() => releaseHandoff(selectedThread?.id)} disabled={!canReleaseHandoff}>
            {actionState?.isActionPending?.("release") ? "Releasing..." : "Release AI"}
          </Button>

          <Button tone="emerald" icon={CheckCircle2} onClick={() => setThreadStatus(selectedThread?.id, "resolved")} disabled={!canResolve}>
            {actionState?.isActionPending?.("resolved") ? "Resolving..." : "Resolve"}
          </Button>

          <Button tone="rose" icon={XCircle} onClick={() => setThreadStatus(selectedThread?.id, "closed")} disabled={!canClose}>
            {actionState?.isActionPending?.("closed") ? "Closing..." : "Close"}
          </Button>
        </div>

        <div className="mt-5 max-h-[360px] space-y-4 overflow-y-auto pr-1">
          {!hasThread ? (
            <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-10 text-center">
              <div className="text-sm font-medium text-white/66">Select a thread</div>
              <div className="mt-2 text-sm leading-6 text-white/40">Select a thread to view messages here.</div>
            </div>
          ) : surface?.loading ? (
            <div className="rounded-[22px] border border-white/10 px-4 py-10 text-center text-sm text-white/52">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-10 text-center">
              <div className="text-sm font-medium text-white/66">No messages yet</div>
              <div className="mt-2 text-sm leading-6 text-white/40">No messages are available for this thread yet.</div>
            </div>
          ) : (
            messages.map((message) => <InboxMessageBubble key={message.id} m={message} />)
          )}
        </div>
      </div>
    </div>
  );
}
