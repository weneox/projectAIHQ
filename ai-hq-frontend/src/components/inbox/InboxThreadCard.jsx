import {
  channelIcon,
  deriveThreadState,
  fmtRelative,
  prettyState,
} from "../../lib/inbox-ui.js";

function initialsFromName(value = "") {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "U";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function avatarTone(seed = "") {
  const tones = [
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-sky-100 text-sky-700",
    "bg-violet-100 text-violet-700",
    "bg-emerald-100 text-emerald-700",
  ];
  const score = String(seed || "")
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  return tones[score % tones.length];
}

function buildHeadline(thread, name, fallbackPreview) {
  const explicitTitle =
    String(thread?.subject || thread?.title || thread?.conversation_title || "").trim();

  if (explicitTitle) return explicitTitle;
  if (fallbackPreview) return fallbackPreview;
  return name;
}

export default function InboxThreadCard({ thread, selected, onOpen }) {
  const state = deriveThreadState(thread);
  const ChannelIcon = channelIcon(thread.channel);

  const name =
    thread.customer_name ||
    thread.external_username ||
    thread.external_user_id ||
    "Unknown user";

  const rawPreview = String(thread.last_message_text || "").trim();
  const preview = rawPreview || "No messages yet";
  const headline = buildHeadline(thread, name, preview);
  const unread = Number(thread.unread_count || 0);
  const assignedTo = String(thread.assigned_to || "").trim();
  const lastAt = fmtRelative(
    thread.last_message_at || thread.updated_at || thread.created_at
  );

  return (
    <button
      type="button"
      onClick={() => onOpen?.(thread)}
      className={[
        "group relative w-full border-b border-slate-200/70 px-5 py-4 text-left transition duration-200",
        selected
          ? "bg-white"
          : "bg-transparent hover:bg-white/80",
      ].join(" ")}
    >
      {selected ? (
        <span className="absolute inset-y-3 left-0 w-[2px] rounded-full bg-[#2f67ad]" />
      ) : null}

      <div className="flex items-start gap-3.5">
        <div
          className={[
            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
            avatarTone(name),
          ].join(" ")}
        >
          {initialsFromName(name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold tracking-[-0.02em] text-slate-900">
                {name}
              </div>
              <div className="mt-0.5 truncate text-[15px] font-medium leading-5 text-slate-900/95">
                {headline}
              </div>
            </div>

            <div className="shrink-0 pt-0.5 text-right">
              <div className="text-[12px] font-medium text-slate-400">{lastAt}</div>
              {unread > 0 ? (
                <div className="mt-1.5 flex justify-end">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#4d8ae6]" />
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-2 line-clamp-2 pr-6 text-[13px] leading-5 text-slate-500">
            {preview}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              <ChannelIcon className="h-3.5 w-3.5" />
              <span className="capitalize">{thread.channel || "other"}</span>
            </span>

            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {prettyState(state)}
            </span>

            {assignedTo ? (
              <span className="inline-flex rounded-full bg-[#eef4ff] px-2.5 py-1 text-[11px] font-medium text-[#3968a8]">
                {assignedTo}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}