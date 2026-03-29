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
    <div
      className={[
        "group rounded-[26px] border p-5 transition duration-200",
        selected
          ? "border-[#d9c8ac] bg-[#faf5eb]"
          : "border-[#ece2d3] bg-[#fffdfa] hover:border-[#dfcfb2] hover:bg-white",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full border ${channelTone(
                thread.channel
              )}`}
            >
              <ChannelIcon className="h-3.5 w-3.5" />
            </div>

            <div className="truncate text-[15px] font-semibold tracking-[-0.03em] text-stone-900">
              {name}
            </div>

            <span className="rounded-full border border-[#ece2d3] bg-[#fffaf4] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-stone-500">
              {thread.channel || "other"}
            </span>

            {unread > 0 ? (
              <span className="rounded-full border border-[#dfe9ea] bg-[#f2fbfb] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-800">
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
          </div>

          <div className="mt-1 truncate text-sm text-stone-500">{handle}</div>

          {assignedTo ? (
            <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-violet-700">
              Assigned: {assignedTo}
            </div>
          ) : null}
        </div>

        <div
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${stateBadgeTone(
            state
          )}`}
        >
          {prettyState(state)}
        </div>
      </div>

      <p className="mt-4 line-clamp-2 text-sm leading-6 text-stone-600">{preview}</p>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-stone-400">
          {fmtRelative(thread.last_message_at || thread.updated_at || thread.created_at)}
        </div>

        <button
          type="button"
          onClick={() => onOpen?.(thread)}
          className="rounded-full border border-[#e8decf] bg-[#fffaf4] px-3 py-1.5 text-[11px] font-medium tracking-[0.01em] text-stone-700 transition hover:border-[#d9c8ac] hover:bg-white hover:text-stone-900"
        >
          Open
        </button>
      </div>
    </div>
  );
}
