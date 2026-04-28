import { useState } from "react";
import { Clock3, MessageCircle, Send, UserCheck } from "lucide-react";

import globeLogo from "../../assets/channels/globe.png";
import instagramLogo from "../../assets/channels/instagram.svg";
import telegramLogo from "../../assets/channels/telegram.svg";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function normalizeChannelKey(value = "") {
  return lower(value)
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .trim();
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
  return normalizeChannelKey(
    thread.channel ||
      thread.channel_label ||
      thread.channel_type ||
      thread.provider ||
      thread.source_type
  );
}

function resolveAvatarUrl(thread = {}) {
  return s(thread?.avatar_url || thread?.avatarUrl || "");
}

function resolveHandoffActive(thread = {}) {
  const status = normalizeChannelKey(thread?.status);
  const assignmentStatus = normalizeChannelKey(thread?.assignment_status);

  return Boolean(
    thread?.handoff_active ||
      thread?.handoffActive ||
      thread?.requires_handoff ||
      thread?.requiresHandoff ||
      status === "handoff" ||
      assignmentStatus === "handoff"
  );
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
    "border-[#C9D8E8] bg-[linear-gradient(180deg,#F8FBFF_0%,#E8F1FA_100%)] text-[#235B98]",
    "border-[#D2DCE8] bg-[linear-gradient(180deg,#FFFFFF_0%,#EEF3F8_100%)] text-[#43566E]",
    "border-[#CFE1D8] bg-[linear-gradient(180deg,#F8FFFB_0%,#E8F6EF_100%)] text-[#0F766E]",
    "border-[#E2D5C7] bg-[linear-gradient(180deg,#FFFDF9_0%,#F5EBDD_100%)] text-[#9A5A19]",
  ];

  const score = String(seed || "")
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  return tones[score % tones.length];
}

function isWebsiteChannel(channel = "") {
  const normalized = normalizeChannelKey(channel);

  return [
    "web",
    "website",
    "webchat",
    "web_chat",
    "website_chat",
    "site",
    "site_chat",
  ].includes(normalized);
}

function ChannelMark({ channel }) {
  const normalized = normalizeChannelKey(channel);

  if (normalized === "instagram") {
    return (
      <img
        src={instagramLogo}
        alt="Instagram"
        className="absolute -bottom-[5px] -right-[5px] h-[20px] w-[20px] object-contain drop-shadow-[0_7px_12px_rgba(15,23,42,0.18)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        draggable="false"
      />
    );
  }

  if (normalized === "telegram") {
    return (
      <img
        src={telegramLogo}
        alt="Telegram"
        className="absolute -bottom-[5px] -right-[5px] h-[20px] w-[20px] object-contain drop-shadow-[0_7px_12px_rgba(15,23,42,0.18)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        draggable="false"
      />
    );
  }

  if (isWebsiteChannel(normalized)) {
    return (
      <img
        src={globeLogo}
        alt="Website"
        className="absolute -bottom-[5px] -right-[5px] h-[18px] w-[18px] object-contain drop-shadow-[0_7px_12px_rgba(15,23,42,0.16)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        draggable="false"
      />
    );
  }

  if (normalized === "facebook" || normalized === "messenger") {
    return (
      <Send
        aria-label="Messenger"
        className="absolute -bottom-[3px] -right-[3px] h-[15px] w-[15px] text-[#2563EB] drop-shadow-[0_6px_10px_rgba(37,99,235,0.22)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        strokeWidth={2.4}
      />
    );
  }

  return (
    <MessageCircle
      aria-label="Channel"
      className="absolute -bottom-[3px] -right-[3px] h-[15px] w-[15px] text-[#64748B] drop-shadow-[0_6px_10px_rgba(15,23,42,0.14)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
      strokeWidth={2.2}
    />
  );
}

function HandoffMark() {
  return (
    <span
      title="Handoff"
      aria-label="Handoff"
      className="ml-2 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] bg-[linear-gradient(180deg,#FFF8EE_0%,#FBEAD2_100%)] text-[#C46A10] shadow-[0_10px_18px_-16px_rgba(196,106,16,0.6),inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-[#F0D2AA]"
    >
      <UserCheck className="h-[11px] w-[11px]" strokeWidth={2.45} />
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
  const avatarUrl = resolveAvatarUrl(thread);
  const channelKey = resolveChannelKey(thread);
  const handoffActive = resolveHandoffActive(thread);

  const avatarKey = `${s(thread?.id)}:${avatarUrl}`;
  const [failedAvatarKey, setFailedAvatarKey] = useState("");
  const avatarFailed = failedAvatarKey === avatarKey;

  return (
    <button
      type="button"
      onClick={() => onOpen?.(thread)}
      className={[
        "group relative flex w-full items-start gap-3 px-5 py-4 text-left",
        "transition-[background-color,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#BBD3FF]",
        selected ? "bg-[#EDF3F9]" : "bg-white hover:bg-[#F7FAFC]",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "absolute bottom-0 left-0 top-0 w-[4px] origin-center bg-[#2F80ED]",
          "transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          selected ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0",
        ].join(" ")}
      />

      <div className="relative mt-0.5 shrink-0">
        <div
          className={[
            "relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[15px] border text-[12px] font-bold",
            "shadow-[0_18px_34px_-28px_rgba(15,23,42,0.34),inset_0_1px_0_rgba(255,255,255,0.95)]",
            "ring-1 ring-white/70",
            "transition-[background-color,border-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            resolveAvatarTone(name),
          ].join(" ")}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0.42)_32%,rgba(255,255,255,0)_68%)]"
          />

          {avatarUrl && !avatarFailed ? (
            <img
              key={avatarKey}
              src={avatarUrl}
              alt={name}
              loading="lazy"
              decoding="async"
              className="relative z-[1] h-full w-full object-cover"
              onError={() => setFailedAvatarKey(avatarKey)}
            />
          ) : (
            <span className="relative z-[1] tracking-[-0.01em]">
              {initialsFromName(name)}
            </span>
          )}
        </div>

        <ChannelMark channel={channelKey} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center">
              <span className="truncate text-[14px] font-bold leading-5 tracking-[-0.015em] text-[#0F172A] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
                {name}
              </span>

              {handoffActive ? <HandoffMark /> : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 pl-2">
            {timeLabel ? (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#91A0B2] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
                <Clock3 className="h-3 w-3 shrink-0" />
                <span>{timeLabel}</span>
              </span>
            ) : null}

            {unreadCount > 0 ? (
              <span className="inline-flex min-w-[22px] items-center justify-center rounded-[8px] bg-[#2563EB] px-1.5 py-[5px] text-[10px] font-bold leading-none text-white shadow-[0_10px_22px_-15px_rgba(37,99,235,0.9)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
                {unreadCount}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-1 pr-2 text-[13px] font-medium leading-5 text-[#4F6174] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] line-clamp-2">
          {preview}
        </div>
      </div>
    </button>
  );
}