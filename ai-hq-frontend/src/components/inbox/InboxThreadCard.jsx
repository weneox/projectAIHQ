import { fmtRelative } from "../../lib/inbox-ui.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

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

function resolveAvatarUrl(thread = {}) {
  return (
    s(thread.avatar_url) ||
    s(thread.profile_image_url) ||
    s(thread.customer_avatar_url) ||
    s(thread.external_avatar_url) ||
    s(thread.photo_url)
  );
}

function isOutboundPreview(thread = {}) {
  return Boolean(
    thread?.last_message_is_outbound ||
      thread?.last_message_outbound ||
      thread?.is_outbound ||
      thread?.last_message_direction === "outbound" ||
      thread?.last_message_sender_type === "operator" ||
      thread?.last_message_sender_role === "operator" ||
      thread?.last_message_author_type === "operator"
  );
}

function buildPreview(thread = {}) {
  const raw = s(thread.last_message_text);
  if (!raw) return "No messages yet";

  if (isOutboundPreview(thread)) {
    return raw.startsWith("You:") ? raw : `You: ${raw}`;
  }

  return raw;
}

export default function InboxThreadCard({ thread, selected, onOpen }) {
  const name =
    s(thread.customer_name) ||
    s(thread.external_username) ||
    s(thread.external_user_id) ||
    "Unknown user";

  const preview = buildPreview(thread);
  const unread = Number(thread.unread_count || 0);
  const lastAt = fmtRelative(
    thread.last_message_at || thread.updated_at || thread.created_at
  );
  const avatarUrl = resolveAvatarUrl(thread);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(thread)}
      className={[
        "group w-full border-b border-slate-200/70 px-7 py-3.5 text-left transition duration-150",
        selected
          ? "bg-[#e9ecef]"
          : "bg-transparent hover:bg-white/70",
      ].join(" ")}
    >
      <div className="flex items-center gap-3.5">
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="h-14 w-14 rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className={[
                "flex h-14 w-14 items-center justify-center rounded-full text-[15px] font-semibold",
                avatarTone(name),
              ].join(" ")}
            >
              {initialsFromName(name)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div
                className={[
                  "truncate text-[15px] leading-5 tracking-[-0.02em]",
                  unread > 0 ? "font-semibold text-slate-950" : "font-medium text-slate-900",
                ].join(" ")}
              >
                {name}
              </div>

              <div className="mt-1 truncate text-[14px] leading-5 text-slate-500">
                {preview}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              <span
                className={[
                  "text-[13px] leading-5",
                  unread > 0 ? "text-slate-500" : "text-slate-400",
                ].join(" ")}
              >
                {lastAt}
              </span>

              {unread > 0 ? (
                <span className="h-2.5 w-2.5 rounded-full bg-[#4c6fff]" />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}