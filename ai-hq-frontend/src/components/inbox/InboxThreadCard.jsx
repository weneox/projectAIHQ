import { useState } from "react";
import { Clock3, MessageCircle, Send, UserCheck } from "lucide-react";

import globeLogo from "../../assets/channels/globe.png";
import instagramLogo from "../../assets/channels/instagram.svg";
import telegramLogo from "../../assets/channels/telegram.svg";
import { cx } from "../../lib/cx.js";

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
    "border-[rgba(var(--color-line),0.92)] bg-[linear-gradient(180deg,#F8FBFF_0%,#E8F1FA_100%)] text-[#235B98]",
    "border-[rgba(var(--color-line),0.92)] bg-[linear-gradient(180deg,#FFFFFF_0%,#EEF3F8_100%)] text-[#43566E]",
    "border-[rgba(var(--color-success),0.16)] bg-[linear-gradient(180deg,#F8FFFB_0%,#E8F6EF_100%)] text-[#0F766E]",
    "border-[rgba(var(--color-warning),0.16)] bg-[linear-gradient(180deg,#FFFDF9_0%,#F5EBDD_100%)] text-[#9A5A19]",
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

function isSetupTestThread(thread = {}) {
  const meta = thread?.meta && typeof thread.meta === "object" ? thread.meta : {};
  const channel = resolveChannelKey(thread);
  const externalThreadId = lower(thread?.external_thread_id || thread?.externalThreadId);
  const customerName = lower(thread?.customer_name || thread?.display_name || thread?.displayName);
  const source = lower(meta.source || meta.testSource || meta.origin);

  return (
    isWebsiteChannel(channel) &&
    (
      externalThreadId.startsWith("website-test:") ||
      customerName.includes("website chat test visitor") ||
      source === "website_chat_setup_test" ||
      source === "website_chat_test"
    )
  );
}

function ChannelMark({ channel }) {
  const normalized = normalizeChannelKey(channel);

  const imgClassName =
    "absolute -bottom-[5px] -right-[5px] h-[20px] w-[20px] object-contain transition-[opacity,transform] duration-base ease-premium";

  if (normalized === "instagram") {
    return (
      <img
        src={instagramLogo}
        alt="Instagram"
        className={imgClassName}
        draggable="false"
      />
    );
  }

  if (normalized === "telegram") {
    return (
      <img
        src={telegramLogo}
        alt="Telegram"
        className={imgClassName}
        draggable="false"
      />
    );
  }

  if (isWebsiteChannel(normalized)) {
    return (
      <img
        src={globeLogo}
        alt="Website"
        className="absolute -bottom-[5px] -right-[5px] h-[18px] w-[18px] object-contain transition-[opacity,transform] duration-base ease-premium"
        draggable="false"
      />
    );
  }

  if (normalized === "facebook" || normalized === "messenger") {
    return (
      <Send
        aria-label="Messenger"
        className="absolute -bottom-[3px] -right-[3px] h-[15px] w-[15px] text-brand transition-[opacity,transform] duration-base ease-premium"
        strokeWidth={2.4}
      />
    );
  }

  return (
    <MessageCircle
      aria-label="Channel"
      className="absolute -bottom-[3px] -right-[3px] h-[15px] w-[15px] text-text-subtle transition-[opacity,transform] duration-base ease-premium"
      strokeWidth={2.2}
    />
  );
}

function HandoffMark() {
  return (
    <span
      title="Handoff"
      aria-label="Handoff"
      className="ml-2 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border border-[rgba(var(--color-warning),0.18)] bg-warning-soft text-warning shadow-[var(--shadow-inset-top)]"
    >
      <UserCheck className="h-[11px] w-[11px]" strokeWidth={2.45} />
    </span>
  );
}

export default function InboxThreadCard({ thread, selected = false, onOpen }) {
  const name = resolveSafeDisplayName(thread);
  const preview = resolvePreview(thread);
  const setupTest = isSetupTestThread(thread);
  const visiblePreview = setupTest
    ? "Private setup test Â· no real visitor"
    : preview;
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
      className={cx(
        "group relative flex w-full items-start gap-3 px-5 py-4 text-left",
        "transition-[background-color,color] duration-base ease-premium",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(var(--color-brand),0.28)]",
        selected ? "bg-[#EDF3F9]" : "bg-white hover:bg-[#F7FAFC]"
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "absolute bottom-0 left-0 top-0 w-[4px] origin-center bg-brand",
          "transition-[opacity,transform] duration-base ease-premium",
          selected ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0"
        )}
      />

      <div className="relative mt-0.5 shrink-0">
        <div
          className={cx(
            "relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[15px] border text-[12px] font-bold",
            "shadow-[0_18px_34px_-28px_rgba(15,23,42,0.30),inset_0_1px_0_rgba(255,255,255,0.95)]",
            "ring-1 ring-white/70",
            "transition-[background-color,border-color,color,box-shadow] duration-base ease-premium",
            resolveAvatarTone(name)
          )}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.18)_48%,rgba(255,255,255,0)_100%)]"
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
            <span className="relative z-[1] tracking-[var(--tracking-tight-sm)]">
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
              <span className="truncate text-[14px] font-semibold leading-5 tracking-[var(--tracking-tight-md)] text-text transition-colors duration-base ease-premium">
                {name}
              </span>

              {handoffActive ? <HandoffMark /> : null}

              {setupTest ? (
                <span className="ml-2 inline-flex shrink-0 items-center rounded-[7px] border border-[rgba(var(--color-brand),0.16)] bg-brand-soft px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.12em] text-brand">
                  Setup test
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 pl-2">
            {timeLabel ? (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-text-subtle transition-colors duration-base ease-premium">
                <Clock3 className="h-3 w-3 shrink-0" strokeWidth={2.1} />
                <span>{timeLabel}</span>
              </span>
            ) : null}

            {unreadCount > 0 ? (
              <span className="inline-flex min-w-[22px] items-center justify-center rounded-[8px] bg-brand px-1.5 py-[5px] text-[10px] font-bold leading-none text-white shadow-[0_10px_22px_-15px_rgba(46,96,255,0.72)] transition-[opacity,background-color] duration-base ease-premium">
                {unreadCount}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-1 line-clamp-2 pr-2 text-[13px] font-medium leading-5 text-text-muted transition-colors duration-base ease-premium">
          {visiblePreview}
        </div>
      </div>
    </button>
  );
}
