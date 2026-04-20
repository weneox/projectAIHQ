import { Clock3 } from "lucide-react";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function initialsFromName(value = "") {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "C";

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
    s(thread.title) ||
    "No message preview yet"
  );
}

function resolveChannelLabel(thread = {}) {
  const raw =
    s(thread.channel_label) ||
    s(thread.channel_type) ||
    s(thread.provider) ||
    s(thread.source_type);

  if (!raw) return "Conversation";

  const normalized = raw.toLowerCase();

  if (normalized === "webchat") return "Web Chat";
  if (normalized === "web") return "Website";
  if (normalized === "whatsapp") return "WhatsApp";
  if (normalized === "telegram") return "Telegram";
  if (normalized === "instagram") return "Instagram";
  if (normalized === "facebook") return "Facebook";
  if (normalized === "email") return "Email";
  if (normalized === "sms") return "SMS";
  if (normalized === "voice") return "Voice";

  return raw
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatRelativeTime(value = "") {
  const next = s(value);
  if (!next) return "";

  const date = new Date(next);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(1, Math.round(diffMs / 60000));

  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function resolveAvatarTone(seed = "") {
  const tones = [
    "bg-[linear-gradient(180deg,rgba(239,246,255,0.96),rgba(219,234,254,0.96))] text-[rgba(37,99,235,0.96)] ring-[rgba(37,99,235,0.10)]",
    "bg-[linear-gradient(180deg,rgba(245,243,255,0.96),rgba(237,233,254,0.96))] text-[rgba(109,40,217,0.96)] ring-[rgba(109,40,217,0.10)]",
    "bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(209,250,229,0.96))] text-[rgba(5,150,105,0.96)] ring-[rgba(5,150,105,0.10)]",
    "bg-[linear-gradient(180deg,rgba(255,247,237,0.96),rgba(254,215,170,0.96))] text-[rgba(194,65,12,0.96)] ring-[rgba(194,65,12,0.10)]",
    "bg-[linear-gradient(180deg,rgba(254,242,242,0.96),rgba(254,226,226,0.96))] text-[rgba(220,38,38,0.96)] ring-[rgba(220,38,38,0.10)]",
  ];

  const score = String(seed || "")
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  return tones[score % tones.length];
}

function resolveAttentionState(thread = {}) {
  const unreadCount = Number(thread?.unread_count || 0);
  const handoffActive = Boolean(thread?.handoff_active);
  const status = s(thread?.status).toLowerCase();

  if (handoffActive) {
    return {
      label: "Handoff",
      dot: "bg-[rgba(245,158,11,0.96)]",
      text: "text-[rgba(180,83,9,0.96)]",
      bg: "bg-[rgba(255,247,237,0.94)]",
    };
  }

  if (unreadCount > 0) {
    return {
      label: "New",
      dot: "bg-[rgba(37,99,235,0.96)]",
      text: "text-[rgba(37,99,235,0.96)]",
      bg: "bg-[rgba(239,246,255,0.94)]",
    };
  }

  if (status === "resolved") {
    return {
      label: "Resolved",
      dot: "bg-[rgba(16,185,129,0.96)]",
      text: "text-[rgba(5,150,105,0.96)]",
      bg: "bg-[rgba(236,253,245,0.94)]",
    };
  }

  return {
    label: resolveChannelLabel(thread),
    dot: "bg-[rgba(148,163,184,0.96)]",
    text: "text-[rgba(71,85,105,0.96)]",
    bg: "bg-[rgba(248,250,252,0.96)]",
  };
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
  const channelLabel = resolveChannelLabel(thread);
  const attention = resolveAttentionState(thread);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(thread)}
      className={[
        "group relative flex w-full items-start gap-3 rounded-[18px] px-3.5 py-3.5 text-left transition-all duration-200",
        selected
          ? "bg-[linear-gradient(180deg,rgba(239,246,255,0.95),rgba(234,242,255,0.92))] shadow-[0_22px_48px_-38px_rgba(37,99,235,0.32)] ring-1 ring-[rgba(37,99,235,0.12)]"
          : "bg-transparent hover:bg-[rgba(248,250,252,0.92)]",
      ].join(" ")}
    >
      <div
        className={[
          "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ring-1",
          resolveAvatarTone(name),
        ].join(" ")}
      >
        {initialsFromName(name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold leading-5 text-[rgba(15,23,42,0.96)]">
              {name}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={[
                  "inline-flex items-center gap-1.5 rounded-[10px] px-2 py-1 text-[10.5px] font-semibold",
                  attention.bg,
                  attention.text,
                ].join(" ")}
              >
                <span className={["h-1.5 w-1.5 rounded-full", attention.dot].join(" ")} />
                <span>{attention.label}</span>
              </span>

              {attention.label !== channelLabel ? (
                <span className="text-[11px] text-[rgba(100,116,139,0.96)]">
                  {channelLabel}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 pl-2">
            {timeLabel ? (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[rgba(148,163,184,0.96)]">
                <Clock3 className="h-3 w-3 shrink-0" />
                <span>{timeLabel}</span>
              </span>
            ) : null}

            {unreadCount > 0 ? (
              <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-[rgba(37,99,235,0.98)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-[0_12px_24px_-16px_rgba(37,99,235,0.72)]">
                {unreadCount}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-2 line-clamp-2 text-[12.5px] leading-5 text-[rgba(71,85,105,0.96)]">
          {preview}
        </div>
      </div>
    </button>
  );
}