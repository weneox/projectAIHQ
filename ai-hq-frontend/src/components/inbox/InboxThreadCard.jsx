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
    : thread.external_user_id || "—";

  const preview = thread.last_message_text || "No messages yet";
  const unread = Number(thread.unread_count || 0);
  const assignedTo = String(thread.assigned_to || "").trim();

  return (
    <button
      type="button"
      onClick={() => onOpen?.(thread)}
      className={[
        "group w-full rounded-[22px] border px-4 py-4 text-left transition-colors duration-200",
        selected
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full border ${channelTone(
                thread.channel
              )}`}
            >
              <ChannelIcon className="h-3.5 w-3.5" />
            </div>

            <div className="truncate text-[14px] font-semibold tracking-[-0.02em]">
              {name}
            </div>

            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
                selected
                  ? "border-white/12 bg-white/8 text-slate-200"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              {thread.channel || "other"}
            </span>
          </div>

          <div
            className={`mt-1 truncate text-[12px] ${
              selected ? "text-slate-300" : "text-slate-500"
            }`}
          >
            {handle}
          </div>
        </div>

        <div
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${
            selected
              ? "border-white/12 bg-white/8 text-slate-100"
              : stateBadgeTone(state)
          }`}
        >
          {prettyState(state)}
        </div>
      </div>

      <p
        className={`mt-4 line-clamp-2 text-[13px] leading-6 ${
          selected ? "text-slate-200" : "text-slate-600"
        }`}
      >
        {preview}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {unread > 0 ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${
              selected
                ? "border-white/12 bg-white/8 text-slate-100"
                : "border-cyan-200 bg-cyan-50 text-cyan-800"
            }`}
          >
            {unread} unread
          </span>
        ) : null}

        {thread.handoff_active ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${
              selected
                ? "border-white/12 bg-white/8 text-slate-100"
                : getPriorityTone(thread.handoff_priority)
            }`}
          >
            handoff {thread.handoff_priority || "normal"}
          </span>
        ) : null}

        {assignedTo ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${
              selected
                ? "border-white/12 bg-white/8 text-slate-100"
                : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            {assignedTo}
          </span>
        ) : null}
      </div>

      <div
        className={`mt-4 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] ${
          selected ? "text-slate-300" : "text-slate-400"
        }`}
      >
        <span>{fmtRelative(thread.last_message_at || thread.updated_at || thread.created_at)}</span>
        <span className={selected ? "text-slate-100" : "text-slate-700"}>Open</span>
      </div>
    </button>
  );
}
