import { Clock3, CornerDownLeft, Sparkles } from "lucide-react";

function s(v, d = "") {
  return String(v ?? d).trim();
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

function resolveDisplayName(thread = {}) {
  return (
    s(thread.customer_name) ||
    s(thread.external_username) ||
    s(thread.external_user_id) ||
    "Conversation"
  );
}

function resolvePreview(thread = {}) {
  return (
    s(thread.last_message_text) ||
    s(thread.last_message_preview) ||
    s(thread.subject) ||
    "No message preview yet"
  );
}

function formatRelativeTime(value = "") {
  const next = s(value);
  if (!next) return "";

  const date = new Date(next);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(1, Math.round(diffMs / 60000));

  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString();
}

function resolveAvatarTone(seed = "") {
  const tones = [
    "bg-sky-50 text-sky-700",
    "bg-violet-50 text-violet-700",
    "bg-amber-50 text-amber-700",
    "bg-emerald-50 text-emerald-700",
    "bg-rose-50 text-rose-700",
  ];

  const score = String(seed || "")
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  return tones[score % tones.length];
}

export default function InboxThreadCard({
  thread,
  selected = false,
  onOpen,
}) {
  const name = resolveDisplayName(thread);
  const preview = resolvePreview(thread);
  const unreadCount = Number(thread?.unread_count || 0);
  const timeLabel = formatRelativeTime(
    thread?.last_message_at || thread?.updated_at || thread?.created_at
  );
  const needsAttention =
    Boolean(thread?.handoff_active) ||
    s(thread?.status).toLowerCase() === "open";

  return (
    <button
      type="button"
      onClick={() => onOpen?.(thread)}
      className={[
        "group flex w-full items-start gap-3 rounded-[14px] px-3 py-2.5 text-left outline-none ring-0 transition-all duration-200",
        selected
          ? "bg-[rgba(37,99,235,0.06)] shadow-[0_10px_30px_-26px_rgba(37,99,235,0.22)] ring-1 ring-[rgba(37,99,235,0.10)]"
          : "bg-white hover:bg-[rgba(15,23,42,0.025)]",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
          resolveAvatarTone(name),
        ].join(" ")}
      >
        {initialsFromName(name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold leading-5 text-text">
              {name}
            </div>

            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-4 text-text-subtle">
              {needsAttention ? (
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <CornerDownLeft className="h-3.5 w-3.5 shrink-0" />
              )}

              <span className="truncate">
                {s(thread.channel_label) ||
                  s(thread.channel_type) ||
                  s(thread.provider) ||
                  "Conversation"}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 pl-2">
            {timeLabel ? (
              <span className="inline-flex items-center gap-1 text-[10.5px] text-text-subtle">
                <Clock3 className="h-3 w-3 shrink-0" />
                <span>{timeLabel}</span>
              </span>
            ) : null}

            {unreadCount > 0 ? (
              <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                {unreadCount}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-text-muted">
          {preview}
        </div>
      </div>
    </button>
  );
}