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
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E7ECF3] bg-[#EAF1FB] text-[12px] font-semibold text-[#4B6784] shadow-[0_10px_24px_-18px_rgba(15,23,42,0.22)]">
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
        "whitespace-nowrap text-[11px] font-medium leading-none",
        incoming ? "text-[#8E99A8]" : "text-white/80",
      ].join(" ")}
    >
      {value}
    </span>
  );
}

function NaturalBubble({ side = "left", text, sentAt }) {
  const incoming = side === "left";

  const bubbleClass = incoming
    ? "border border-[#E6EBF2] bg-[#FFFFFF] text-[#111827]"
    : "border border-[#2F84DA] bg-[#3390EC] text-white";

  const tailBaseClass = incoming
    ? "absolute bottom-[2px] -left-[5px] h-[18px] w-[18px] rounded-full border border-[#E6EBF2] border-r-0 border-t-0 bg-[#FFFFFF]"
    : "absolute bottom-[2px] -right-[5px] h-[18px] w-[18px] rounded-full border border-[#2F84DA] border-l-0 border-t-0 bg-[#3390EC]";

  const tailCutClass = incoming
    ? "absolute bottom-[-1px] -left-[9px] h-[19px] w-[11px] rounded-br-[16px] bg-[var(--inbox-surface,#F8FAFC)]"
    : "absolute bottom-[-1px] -right-[9px] h-[19px] w-[11px] rounded-bl-[16px] bg-[var(--inbox-surface,#F8FAFC)]";

  return (
    <div className={incoming ? "flex justify-start" : "flex justify-end"}>
      <div className="relative inline-block max-w-full">
        <span aria-hidden="true" className={tailBaseClass} />
        <span aria-hidden="true" className={tailCutClass} />

        <div
          className={[
            "relative z-[1] inline-block max-w-full rounded-[21px] px-[15px] pb-[8px] pt-[10px]",
            "shadow-[0_14px_34px_-26px_rgba(15,23,42,0.18)]",
            incoming ? "rounded-bl-[8px]" : "rounded-br-[8px]",
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
  const bubbleWidthClass = "max-w-[min(440px,72vw)]";

  if (inbound) {
    return (
      <div className="flex w-full justify-start px-3 py-[5px] sm:px-5">
        <div className="flex max-w-full items-end gap-2.5">
          <InboundAvatar title={displayName} avatarUrl={avatarUrl} />

          <div className={bubbleWidthClass}>
            <NaturalBubble side="left" text={text} sentAt={sentAt} />

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
        <NaturalBubble side="right" text={text} sentAt={sentAt} />

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