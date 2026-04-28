import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

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
  if (Number.isNaN(date.getTime())) return "";

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return "";
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
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E8EEF7] text-[12px] font-semibold text-[#587391] shadow-[0_10px_18px_-16px_rgba(15,23,42,0.2)]">
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

function BubbleTime({ value, incoming, className = "" }) {
  if (!value) return null;

  return (
    <span
      className={[
        "select-none whitespace-nowrap text-[11px] font-medium leading-none",
        incoming ? "text-[#8D98A8]" : "text-white/82",
        className,
      ].join(" ")}
    >
      {value}
    </span>
  );
}

function MessageTextWithTime({ text, sentAt, incoming }) {
  const hasText = Boolean(text);

  return (
    <div className="relative whitespace-pre-wrap break-words text-[15px] leading-[1.45]">
      {hasText ? (
        text
      ) : (
        <span
          className={[
            "text-[14px]",
            incoming ? "text-[#94A3B8]" : "text-white/78",
          ].join(" ")}
        >
          (empty message)
        </span>
      )}

      {sentAt ? (
        <span
          aria-hidden="true"
          className="inline-block h-[1px] w-[54px]"
        />
      ) : null}

      <BubbleTime
        value={sentAt}
        incoming={incoming}
        className="absolute bottom-[3px] right-0"
      />
    </div>
  );
}

function VectorTail({ side = "left", fill = "#FFFFFF" }) {
  const mirrored = side === "right";

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 18 18"
      className={[
        "pointer-events-none absolute bottom-[2px] h-[18px] w-[18px]",
        mirrored ? "-right-[7px] scale-x-[-1]" : "-left-[7px]",
      ].join(" ")}
    >
      <path
        d="M18 0C11.8 1.8 8.4 5.4 7 9.8C6 13 3.8 15.7 0 18H18V0Z"
        fill={fill}
      />
    </svg>
  );
}

function EliteBubble({ side = "left", text, sentAt }) {
  const incoming = side === "left";
  const fill = incoming ? "#FFFFFF" : "#3797F0";

  return (
    <div className={incoming ? "flex justify-start" : "flex justify-end"}>
      <div className="relative inline-block max-w-full overflow-visible">
        <VectorTail side={side} fill={fill} />

        <div
          className={[
            "relative z-[1] inline-block max-w-full px-[15px] py-[10px]",
            "shadow-[0_10px_26px_-22px_rgba(15,23,42,0.16)]",
            incoming
              ? "rounded-[20px] rounded-bl-[8px] bg-[#FFFFFF] text-[#0F172A]"
              : "rounded-[20px] rounded-br-[8px] bg-[#3797F0] text-white",
          ].join(" ")}
        >
          <MessageTextWithTime
            text={text}
            sentAt={sentAt}
            incoming={incoming}
          />
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

  const bubbleWidthClass = "max-w-[min(430px,68vw)]";

  if (inbound) {
    return (
      <div className="flex w-full justify-start px-3 py-[5px] sm:px-5">
        <div className="flex max-w-full items-end gap-2">
          <InboundAvatar title={displayName} avatarUrl={avatarUrl} />

          <div className={bubbleWidthClass}>
            <EliteBubble side="left" text={text} sentAt={sentAt} />

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
    <div className="flex w-full justify-end px-3 py-[5px] sm:px-5">
      <div className={bubbleWidthClass}>
        <EliteBubble side="right" text={text} sentAt={sentAt} />

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