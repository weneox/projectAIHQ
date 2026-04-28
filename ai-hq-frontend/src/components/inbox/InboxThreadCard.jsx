import { useState } from "react";
import { Clock3, Globe2, MessageCircle, Send } from "lucide-react";

import instagramLogo from "../../assets/channels/instagram.svg";
import telegramLogo from "../../assets/channels/telegram.svg";

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

function isPlaceholderDisplayName(value = "") {
  const safe = lower(value);
  if (!safe) return true;

  return [
    "customer",
    "conversation",
    "instagram user",
    "telegram user",
    "facebook user",
    "whatsapp user",
    "website user",
    "web user",
    "user",
    "unknown",
  ].includes(safe);
}

function normalizeUsername(value = "") {
  const safe = s(value).replace(/^@+/, "");
  if (!safe) return "";
  if (looksLikeNumericIdentity(safe)) return "";
  return safe;
}

function resolveSafeDisplayName(thread = {}) {
  const displayName = s(thread.display_name || thread.displayName);
  const customerName = s(thread.customer_name);
  const externalUsername = normalizeUsername(thread.external_username);
  const externalUserId = s(thread.external_user_id);
  const channel = lower(
    thread.channel || thread.channel_type || thread.provider || thread.source_type
  );

  if (displayName && !isPlaceholderDisplayName(displayName)) return displayName;
  if (customerName && !looksLikeNumericIdentity(customerName)) return customerName;
  if (externalUsername) return externalUsername;

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
  if (normalized === "website") return "Website";
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
    "border-[#D7E0EA] bg-[#EEF4FA] text-[#235B98]",
    "border-[#DCE4EC] bg-[#F3F6F9] text-[#475569]",
    "border-[#D9E6DF] bg-[#EEF7F2] text-[#0F766E]",
    "border-[#E6DDD3] bg-[#F8F1EA] text-[#9A5A19]",
  ];

  const score = String(seed || "")
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  return tones[score % tones.length];
}

function resolveMeta(thread = {}) {
  if (thread?.handoff_active) {
    return {
      label: "HANDOFF",
      tone: "text-[#C46A10]",
    };
  }

  const channel = resolveChannelLabel(thread);
  if (channel) {
    return {
      label: channel.toUpperCase(),
      tone: "text-[#66788A]",
    };
  }

  return {
    label: "",
    tone: "",
  };
}

function ChannelMark({ channel }) {
  const normalized = lower(channel);

  if (normalized === "instagram") {
    return (
      <span className="absolute -bottom-1 -right-1 inline-flex h-[20px] w-[20px] items-center justify-center overflow-hidden rounded-[6px] border border-white bg-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
        <img
          src={instagramLogo}
          alt="Instagram"
          className="h-full w-full object-cover"
          draggable="false"
        />
      </span>
    );
  }

  if (normalized === "telegram") {
    return (
      <span className="absolute -bottom-1 -right-1 inline-flex h-[20px] w-[20px] items-center justify-center overflow-hidden rounded-[6px] border border-white bg-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
        <img
          src={telegramLogo}
          alt="Telegram"
          className="h-full w-full object-cover"
          draggable="false"
        />
      </span>
    );
  }

  if (normalized === "facebook" || normalized === "messenger") {
    return (
      <span className="absolute -bottom-1 -right-1 inline-flex h-[20px] w-[20px] items-center justify-center rounded-[6px] border border-white bg-[#2563EB] text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
        <Send className="h-2.5 w-2.5" strokeWidth={2.4} />
      </span>
    );
  }

  if (normalized === "web" || normalized === "website" || normalized === "webchat") {
    return (
      <span className="absolute -bottom-1 -right-1 inline-flex h-[20px] w-[20px] items-center justify-center rounded-[6px] border border-white bg-[#E9EEF5] text-[#475569] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
        <Globe2 className="h-3 w-3" strokeWidth={2.2} />
      </span>
    );
  }

  return (
    <span className="absolute -bottom-1 -right-1 inline-flex h-[20px] w-[20px] items-center justify-center rounded-[6px] border border-white bg-[#E9EEF5] text-[#64748B] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
      <MessageCircle className="h-3 w-3" strokeWidth={2.2} />
    </span>
  );
}

export default function InboxThreadCard({ thread, selected = false, onOpen }) {
  const name = resolveSafeDisplayName(thread);
  const preview = resolvePreview(thread);
  const unreadCount = Number(thread?.unread_count || 0);
  const timeLabel = formatRelativeTime(
    thread?.last_message_at || thread?.updated_at || thread?.created_at
  );
  const meta = resolveMeta(thread);
  const avatarUrl = resolveAvatarUrl(thread);
  const channelKey = resolveChannelKey(thread);

  const avatarKey = `${s(thread?.id)}:${avatarUrl}`;
  const [failedAvatarKey, setFailedAvatarKey] = useState("");
  const avatarFailed = failedAvatarKey === avatarKey;

  return (
    <button
      type="button"
      onClick={() => onOpen?.(thread)}
      className={[
        "group relative flex w-full items-start gap-3 px-5 py-4 text-left",
        "transition-[background-color,color] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#BBD3FF]",
        selected ? "bg-[#EDF3F9]" : "bg-white hover:bg-[#F7FAFC]",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "absolute bottom-0 left-0 top-0 w-[4px] origin-center bg-[#2F80ED]",
          "transition-[opacity,transform] duration-260 ease-[cubic-bezier(0.22,1,0.36,1)]",
          selected ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0",
        ].join(" ")}
      />

      <div className="relative mt-0.5 shrink-0">
        <div
          className={[
            "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border text-[12px] font-bold",
            "transition-[background-color,border-color,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            resolveAvatarTone(name),
          ].join(" ")}
        >
          {avatarUrl && !avatarFailed ? (
            <img
              key={avatarKey}
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

        <ChannelMark channel={channelKey} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-bold leading-5 tracking-[-0.015em] text-[#0F172A] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
              {name}
            </div>

            {meta.label ? (
              <div
                className={[
                  "mt-1 text-[11px] font-bold tracking-[0.16em]",
                  "transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  meta.tone,
                ].join(" ")}
              >
                {meta.label}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2 pl-2">
            {timeLabel ? (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#91A0B2] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
                <Clock3 className="h-3 w-3 shrink-0" />
                <span>{timeLabel}</span>
              </span>
            ) : null}

            {unreadCount > 0 ? (
              <span className="inline-flex min-w-[22px] items-center justify-center rounded-[8px] bg-[#2563EB] px-1.5 py-[5px] text-[10px] font-bold leading-none text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
                {unreadCount}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-2 line-clamp-2 pr-2 text-[13px] font-medium leading-5 text-[#4F6174] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
          {preview}
        </div>
      </div>
    </button>
  );
}