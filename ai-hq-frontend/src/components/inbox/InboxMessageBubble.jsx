import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { fmtRelative } from "../../lib/inbox-ui.js";
import { normalizeReplayTrace } from "../../lib/replayTrace.js";
import InboxReplayTraceCard from "./InboxReplayTraceCard.jsx";

function s(value) {
  return String(value ?? "").trim();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
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

function resolveDisplayName(message, inbound, thread) {
  const meta = obj(message?.meta);

  if (inbound) {
    return (
      s(
        message?.sender_name ||
          meta?.senderName ||
          meta?.sender_name ||
          thread?.display_name ||
          thread?.displayName ||
          thread?.customer_name
      ) || "Customer"
    );
  }

  if (message?.sender_type === "agent") return "You";
  if (message?.sender_type === "ai") return "AI HQ";
  return "Reply";
}

function resolveAvatarUrl(message, thread) {
  const meta = obj(message?.meta);

  return s(
    message?.avatar_url ||
      message?.sender_avatar_url ||
      meta?.avatarUrl ||
      meta?.avatar_url ||
      meta?.profilePicture ||
      meta?.profile_picture ||
      thread?.avatar_url ||
      thread?.avatarUrl
  );
}

function formatBubbleTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return s(fmtRelative(value));
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return s(fmtRelative(value));
  }
}

function shouldAllowInspect(message, enableInspect) {
  if (!enableInspect) return false;

  const replayTrace = normalizeReplayTrace(message);

  return Boolean(
    replayTrace?.hasTrace &&
      (message?.sender_type === "ai" || message?.direction === "outbound")
  );
}

function InboundAvatar({ title, avatarUrl }) {
  const initials = initialsFromName(title);

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/90 bg-[#DCE7F6] text-[12px] font-semibold text-[#37506B] shadow-[0_10px_22px_-16px_rgba(15,23,42,0.28)]">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        initials
      )}
    </div>
  );
}

function BubbleTime({ value, incoming }) {
  if (!value) return null;

  return (
    <span
      className={[
        "select-none whitespace-nowrap text-[11px] font-medium tracking-[0.01em]",
        incoming ? "text-[#8A94A6]" : "text-white/72",
      ].join(" ")}
    >
      {value}
    </span>
  );
}

function BubbleTail({ side = "left", fill = "#FFFFFF", stroke = "#E5E7EB" }) {
  const isLeft = side === "left";

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 18 18"
      className={[
        "pointer-events-none absolute bottom-[2px] h-[16px] w-[16px]",
        isLeft ? "-left-[8px]" : "-right-[8px] scale-x-[-1]",
      ].join(" ")}
    >
      <path
        d="M16.5 1.5C11.2 1.9 7.4 4.4 5.1 8.1C3.4 10.9 2.7 14 1.5 16.5C5.9 15.8 8.9 14.9 11.1 13.2C14.3 10.8 15.9 7.3 16.5 1.5Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TelegramBubble({ side = "left", text, sentAt }) {
  const incoming = side === "left";

  const fill = incoming ? "#FFFFFF" : "#3390EC";
  const stroke = incoming ? "#E4E8EF" : "#2C82D8";

  return (
    <div className={incoming ? "flex justify-start" : "flex justify-end"}>
      <div className="relative inline-block max-w-full">
        <BubbleTail side={side} fill={fill} stroke={stroke} />

        <div
          className={[
            "relative inline-block max-w-full rounded-[20px] px-[14px] pb-[8px] pt-[10px]",
            "shadow-[0_12px_30px_-24px_rgba(15,23,42,0.22)]",
            incoming
              ? "rounded-bl-[8px] border border-[#E4E8EF] bg-[#FFFFFF] text-[#0F172A]"
              : "rounded-br-[8px] border border-[#2C82D8] bg-[#3390EC] text-white",
          ].join(" ")}
        >
          {text ? (
            <div className="max-w-full">
              <div className="whitespace-pre-wrap break-words text-[15px] leading-[1.45]">
                {text}
              </div>
              <div className="mt-[4px] flex justify-end pl-6">
                <BubbleTime value={sentAt} incoming={incoming} />
              </div>
            </div>
          ) : (
            <div className="max-w-full">
              <div
                className={[
                  "text-[14px]",
                  incoming ? "text-[#94A3B8]" : "text-white/72",
                ].join(" ")}
              >
                (empty message)
              </div>
              <div className="mt-[4px] flex justify-end pl-6">
                <BubbleTime value={sentAt} incoming={incoming} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InspectBlock({ open, onToggle, traceSource, align = "start" }) {
  return (
    <div
      className={[
        "mt-2 flex w-full",
        align === "end" ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <div className="max-w-[420px]">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-2 rounded-[10px] border border-[#E4E7EC] bg-white px-3 py-1.5 text-[11px] font-medium text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
        >
          {open ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          {open ? "Hide trace" : "Inspect trace"}
        </button>

        {open ? (
          <div className="mt-2">
            <InboxReplayTraceCard
              traceSource={traceSource}
              compact
              title="Message trace"
              subtitle="Replay metadata attached to this action."
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function InboxMessageBubble({
  m,
  thread = null,
  attemptsByCorrelation: _attemptsByCorrelation,
  enableInspect = false,
}) {
  const [inspectOpen, setInspectOpen] = useState(false);

  const inbound = m?.direction === "inbound";
  const text = s(m?.text);
  const sentAt = formatBubbleTime(m?.sent_at || m?.created_at);
  const showInspect = shouldAllowInspect(m, enableInspect);

  const displayName = resolveDisplayName(m, inbound, thread);
  const avatarUrl = inbound ? resolveAvatarUrl(m, thread) : "";

  const bubbleWidthClass = "max-w-[min(430px,72vw)]";

  if (inbound) {
    return (
      <div className="flex w-full justify-start px-3 py-[4px] sm:px-5">
        <div className="flex max-w-full items-end gap-2.5">
          <InboundAvatar title={displayName} avatarUrl={avatarUrl} />

          <div className={bubbleWidthClass}>
            <TelegramBubble side="left" text={text} sentAt={sentAt} />

            {showInspect ? (
              <InspectBlock
                open={inspectOpen}
                onToggle={() => setInspectOpen((current) => !current)}
                traceSource={m}
                align="start"
              />
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-end px-3 py-[4px] sm:px-5">
      <div className={bubbleWidthClass}>
        <TelegramBubble side="right" text={text} sentAt={sentAt} />

        {showInspect ? (
          <InspectBlock
            open={inspectOpen}
            onToggle={() => setInspectOpen((current) => !current)}
            traceSource={m}
            align="end"
          />
        ) : null}
      </div>
    </div>
  );
}