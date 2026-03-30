import {
  channelIcon,
  channelTone,
  deriveThreadState,
  fmtRelative,
  getPriorityTone,
  prettyState,
  stateBadgeTone,
} from "../../lib/inbox-ui.js";

export default function InboxThreadCard({ thread, selected, onOpen }) {
  const state = deriveThreadState(thread);
  const ChannelIcon = channelIcon(thread.channel);

  const name =
    thread.customer_name ||
    thread.external_username ||
    thread.external_user_id ||
    "Unknown user";

  const handle = thread.external_username
    ? `@${String(thread.external_username).replace(/^@+/, "")}`
    : thread.external_user_id || "--";

  const preview = thread.last_message_text || "No messages yet";
  const unread = Number(thread.unread_count || 0);
  const assignedTo = String(thread.assigned_to || "").trim();

  return (
    <button
      type="button"
      onClick={() => onOpen?.(thread)}
      className={[
        "group w-full rounded-[22px] border px-3.5 py-3.5 text-left transition",
        selected
          ? "border-cyan-400/30 bg-[#151f33] text-white shadow-[0_12px_30px_rgba(8,15,28,0.34)]"
          : "border-transparent bg-transparent text-slate-100 hover:border-white/8 hover:bg-white/[0.03]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full border ${channelTone(
                thread.channel
              )}`}
            >
              <ChannelIcon className="h-3.5 w-3.5" />
            </div>

            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold tracking-[-0.02em]">
                {name}
              </div>
              <div className={`truncate text-[12px] ${selected ? "text-slate-300" : "text-slate-500"}`}>
                {handle}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
              selected ? "border-cyan-400/20 bg-cyan-400/[0.12] text-cyan-100" : stateBadgeTone(state)
            }`}
          >
            {prettyState(state)}
          </div>
          <div className={`mt-2 text-[11px] uppercase tracking-[0.14em] ${selected ? "text-slate-300" : "text-slate-500"}`}>
            {fmtRelative(thread.last_message_at || thread.updated_at || thread.created_at)}
          </div>
        </div>
      </div>

      <p className={`mt-3 line-clamp-2 text-[13px] leading-6 ${selected ? "text-slate-200" : "text-slate-400"}`}>
        {preview}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${
            selected
              ? "border-white/10 bg-white/[0.04] text-slate-200"
              : "border-white/10 bg-white/[0.04] text-slate-400"
          }`}
        >
          {thread.channel || "other"}
        </span>

        {unread > 0 ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${
              selected
                ? "border-cyan-400/20 bg-cyan-400/[0.12] text-cyan-100"
                : "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-200"
            }`}
          >
            {unread} unread
          </span>
        ) : null}

        {thread.handoff_active ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${getPriorityTone(
              thread.handoff_priority
            )}`}
          >
            handoff {thread.handoff_priority || "normal"}
          </span>
        ) : null}

        {assignedTo ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${
              selected
                ? "border-white/10 bg-white/[0.04] text-slate-200"
                : "border-white/10 bg-white/[0.04] text-slate-400"
            }`}
          >
            {assignedTo}
          </span>
        ) : null}
      </div>
    </button>
  );
}
