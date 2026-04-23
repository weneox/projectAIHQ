import { useMemo, useState } from "react";
import { Clock3, Instagram, Send } from "lucide-react";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
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

function looksLikeNumericIdentity(value = "") {
  const safe = s(value);
  if (!safe) return false;
  return /^\d{5,}$/.test(safe);
}

function resolveSafeDisplayName(thread = {}) {
  const customerName = s(thread.customer_name);
  const externalUsername = s(thread.external_username);
  const externalUserId = s(thread.external_user_id);
  const channel = lower(
    thread.channel || thread.channel_type || thread.provider || thread.source_type
  );

  if (customerName && !looksLikeNumericIdentity(customerName)) {
    return customerName;
  }

  if (externalUsername) {
    return externalUsername.startsWith("@")
      ? externalUsername
      : `@${externalUsername}`;
  }

  if (customerName) {
    if (channel === "instagram") return "Instagram User";
    if (channel === "telegram") return "Telegram User";
    return "Customer";
  }

  if (externalUserId) {
    if (channel === "instagram") return "Instagram User";
    if (channel === "telegram") return "Telegram User";
    return "Customer";
  }

  return "Conversation";
}

function resolvePreview(thread = {}) {
  const preview =
    s(thread.last_message_text) ||
    s(thread.last_message_preview) ||
    s(thread.subject) ||
    s(thread.title);

  if (!preview) return "No message preview yet";
  return preview;
}

function resolveChannelKey(thread = {}) {
  return lower(
    thread.channel ||
      thread.channel_label ||
      thread.channel_type ||
      thread.provider ||
      thread.source_type
  );
}

function resolveChannelLabel(thread = {}) {
  const raw =
    s(thread.channel_label) ||
    s(thread.channel_type) ||
    s(thread.provider) ||
    s(thread.source_type) ||
    s(thread.channel);

  if (!raw) return "";

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

function resolveAvatarUrl(thread = {}) {
  return s(thread?.avatar_url || thread?.avatarUrl || "");
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

function resolveMeta(thread = {}) {
  if (thread?.handoff_active) {
    return {
      label: "Handoff",
      tone:
        "bg-[rgba(255,247,237,0.96)] text-[rgba(180,83,9,0.96)]",
    };
  }

  const channel = resolveChannelLabel(thread);
  if (channel) {
    return {
      label: channel,
      tone:
        "bg-[rgba(248,250,252,0.96)] text-[rgba(71,85,105,0.96)]",
    };
  }

  return {
    label: "",
    tone: "",
  };
}

function ChannelBadge({ channel }) {
  const normalized = lower(channel);

  if (normalized === "instagram") {
    return (
      <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white bg-[linear-gradient(135deg,#f58529_0%,#dd2a7b_52%,#8134af_78%,#515bd4_100%)] text-white shadow-[0_8px_18px_-12px_rgba(0,0,0,0.45)]">
        <Instagram className="h-2.5 w-2.5" strokeWidth={2.2} />
      </span>
    );
  }

  if (normalized === "telegram") {
    return (
      <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white bg-[rgba(34,158,217,1)] text-white shadow-[0_8px_18px_-12px_rgba(0,0,0,0.45)]">
        <Send className="h-2.5 w-2.5" strokeWidth={2.4} />
      </span>
    );
  }

  return null;
}

export default function InboxThreadCard({
  thread,
  selected = false,
  onOpen,
}) {
  const name = resolveSafeDisplayName(thread);
  const preview = resolvePreview(thread);
  const unreadCount = Number(thread?.unread_count || 0);
  const timeLabel = formatRelativeTime(
    thread?.last_message_at || thread?.updated_at || thread?.created_at
  );
  const meta = resolveMeta(thread);
  const avatarUrl = resolveAvatarUrl(thread);
  const avatarKey = `${s(thread?.id)}:${avatarUrl}`;
  const channelKey = useMemo(() => resolveChannelKey(thread), [thread]);
  const [failedAvatarKey, setFailedAvatarKey] = useState("");
  const avatarFailed = failedAvatarKey === avatarKey;

  return (
    <button
      type="button"
      onClick={() => onOpen?.(thread)}
      className={[
        "group flex w-full items-start gap-3 rounded-[16px] px-3.5 py-3 text-left transition-all duration-200",
        selected
          ? "bg-[rgba(239,246,255,0.90)] ring-1 ring-[rgba(37,99,235,0.10)]"
          : "bg-transparent hover:bg-[rgba(248,250,252,0.82)]",
      ].join(" ")}
    >
      <div className="relative">
        <div
          className={[
            "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-[12px] font-semibold ring-1",
            resolveAvatarTone(name),
          ].join(" ")}
        >
          {avatarUrl && !avatarFailed ? (
            <img
              src={avatarUrl}
              alt={name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
              onError={() => setFailedAvatarKey(avatarKey)}
            />
          ) : (
            initialsFromName(name)
          )}
        </div>

        <ChannelBadge channel={channelKey} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold leading-5 text-[rgba(15,23,42,0.96)]">
              {name}
            </div>

            {meta.label ? (
              <div className="mt-1">
                <span
                  className={[
                    "inline-flex rounded-[10px] px-2 py-1 text-[10.5px] font-semibold",
                    meta.tone,
                  ].join(" ")}
                >
                  {meta.label}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2 pl-2">
            {timeLabel ? (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[rgba(148,163,184,0.96)]">
                <Clock3 className="h-3 w-3 shrink-0" />
                <span>{timeLabel}</span>
              </span>
            ) : null}

            {unreadCount > 0 ? (
              <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-[rgba(37,99,235,0.98)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
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
