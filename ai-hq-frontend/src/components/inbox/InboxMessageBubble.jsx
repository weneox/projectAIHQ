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
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E8EEF7] text-[12px] font-semibold text-[#55708E] shadow-[0_10px_20px_-18px_rgba(15,23,42,0.22)]">
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
        "select-none whitespace-nowrap text-[11px] font-medium leading-none",
        incoming ? "text-[#919BAA]" : "text-white/78",
      ].join(" ")}
    >
      {value}
    </span>
  );
}

function PremiumBubble({ side = "left", text, sentAt }) {
  const incoming = side === "left";

  const bubbleClass = incoming
    ? "bg-[#FFFFFF] text-[#0F172A] rounded-[19px] rounded-bl-[7px]"
    : "bg-[#3390EC] text-white rounded-[19px] rounded-br-[7px]";

  const tailBlobClass = incoming
    ? "absolute bottom-[4px] -left-[4px] h-[14px] w-[14px] rounded-full bg-[#FFFFFF]"
    : "absolute bottom-[4px] -right-[4px] h-[14px] w-[14px] rounded-full bg-[#3390EC]";

  const tailCutClass = incoming
    ? "absolute bottom-[4px] -left-[10px] h-[15px] w-[10px] rounded-r-full bg-[var(--inbox-surface,#F8FAFC)]"
    : "absolute bottom-[4px] -right-[10px] h-[15px] w-[10px] rounded-l-full bg-[var(--inbox-surface,#F8FAFC)]";

  return (
    <div className={incoming ? "flex justify-start" : "flex justify-end"}>
      <div className="relative inline-block max-w-full overflow-visible">
        <span aria-hidden="true" className={tailBlobClass} />
        <span aria-hidden="true" className={tailCutClass} />

        <div
          className={[
            "relative z-[1] inline-block max-w-full px-[15px] pb-[8px] pt-[10px]",
            "shadow-[0_12px_28px_-22px_rgba(15,23,42,0.18)]",
            bubbleClass,
          ].join(" ")}
        >
          {text ? (
            <>
              <div className="whitespace-pre-wrap break-words text-[15px] leading-[1.45]">
                {text}
              </div>

              <div className="mt-[5px] flex justify-end pl-6">
                <BubbleTime value={sentAt} incoming={incoming} />
              </div>
            </>
          ) : (
            <>
              <div
                className={[
                  "text-[14px]",
                  incoming ? "text-[#94A3B8]" : "text-white/78",
                ].join(" ")}
              >
                (empty message)
              </div>

              <div className="mt-[5px] flex justify-end pl-6">
                <BubbleTime value={sentAt} incoming={incoming} />
              </div>
            </>
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

  const bubbleWidthClass = "max-w-[min(460px,72vw)]";

  if (inbound) {
    return (
      <div className="flex w-full justify-start px-3 py-[5px] sm:px-5">
        <div className="flex max-w-full items-end gap-2.5">
          <InboundAvatar title={displayName} avatarUrl={avatarUrl} />

          <div className={bubbleWidthClass}>
            <PremiumBubble side="left" text={text} sentAt={sentAt} />

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
        <PremiumBubble side="right" text={text} sentAt={sentAt} />

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