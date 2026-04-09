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
        "group w-full border-b border-line-soft px-4 py-3 text-left transition-colors",
        selected
          ? "bg-surface-subtle"
          : "bg-transparent hover:bg-surface-subtle",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="h-11 w-11 rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className={[
                "flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-semibold",
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
                  "truncate text-[14px] leading-5",
                  unread > 0 ? "font-semibold text-text" : "font-medium text-text",
                ].join(" ")}
              >
                {name}
              </div>

              <div className="mt-1 truncate text-[13px] leading-5 text-text-muted">
                {preview}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              <span className="text-[12px] leading-5 text-text-subtle">
                {lastAt}
              </span>

              {unread > 0 ? (
                <span className="inline-flex min-w-[18px] items-center justify-center rounded-pill bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-brand">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
