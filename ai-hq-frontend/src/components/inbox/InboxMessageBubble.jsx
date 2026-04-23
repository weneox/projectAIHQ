import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { fmtRelative } from "../../lib/inbox-ui.js";
import { normalizeReplayTrace } from "../../lib/replayTrace.js";
import InboxReplayTraceCard from "./InboxReplayTraceCard.jsx";

function s(value) {
  return String(value ?? "").trim();
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

function BubbleTime({ value }) {
  if (!value) return null;

  return (
    <span className="select-none whitespace-nowrap text-[12px] font-medium tracking-[0.01em] text-[rgba(15,23,42,0.46)]">
      {value}
    </span>
  );
}

function TelegramBubble({
  side = "left",
  text,
  sentAt,
  tone = "default",
}) {
  const incoming = side === "left";
  const outgoing = !incoming;

  const bubbleClass = incoming
    ? [
        "rounded-[18px] rounded-bl-[7px]",
        "border border-[rgba(15,23,42,0.06)]",
        "bg-[rgba(255,255,255,0.96)]",
        "text-[#111827]",
      ].join(" ")
    : [
        "rounded-[18px] rounded-br-[7px]",
        "border border-[rgba(110,168,86,0.18)]",
        "bg-[rgba(234,255,221,0.98)]",
        tone === "ai" ? "text-[#0F172A]" : "text-[#111827]",
      ].join(" ");

  const outerTailClass = incoming
    ? [
        "pointer-events-none absolute -left-[6px] bottom-0 h-[14px] w-[14px]",
        "rounded-bl-[12px] border-b border-l border-[rgba(15,23,42,0.06)]",
        "bg-[rgba(255,255,255,0.96)]",
      ].join(" ")
    : [
        "pointer-events-none absolute -right-[6px] bottom-0 h-[14px] w-[14px]",
        "rounded-br-[12px] border-b border-r border-[rgba(110,168,86,0.18)]",
        "bg-[rgba(234,255,221,0.98)]",
      ].join(" ");

  const cutTailClass = incoming
    ? [
        "pointer-events-none absolute -left-[10px] bottom-0 h-[16px] w-[10px]",
        "rounded-br-[12px] bg-[var(--inbox-surface,#F1F5F9)]",
      ].join(" ")
    : [
        "pointer-events-none absolute -right-[10px] bottom-0 h-[16px] w-[10px]",
        "rounded-bl-[12px] bg-[var(--inbox-surface,#F1F5F9)]",
      ].join(" ");

  return (
    <div className={incoming ? "flex justify-start" : "flex justify-end"}>
      <div className="relative inline-flex max-w-full">
        <span aria-hidden="true" className={outerTailClass} />
        <span aria-hidden="true" className={cutTailClass} />

        <div
          className={[
            "relative z-[1] inline-flex max-w-full min-w-[64px] flex-col",
            "px-[14px] pb-[7px] pt-[9px]",
            "shadow-[0_1px_0_rgba(0,0,0,0.05),0_10px_24px_-18px_rgba(15,23,42,0.28)]",
            bubbleClass,
          ].join(" ")}
        >
          {text ? (
            <>
              <div className="whitespace-pre-wrap break-words text-[15px] leading-[1.42] text-inherit">
                {text}
              </div>

              <div className="mt-[3px] flex justify-end pl-5">
                <BubbleTime value={sentAt} />
              </div>
            </>
          ) : (
            <div className="flex min-h-[34px] flex-col justify-end">
              <span className="text-[14px] text-[rgba(15,23,42,0.42)]">
                (empty message)
              </span>
              <div className="mt-[3px] flex justify-end pl-5">
                <BubbleTime value={sentAt} />
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
      <div className="max-w-[82%]">
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

  const tone =
    m?.sender_type === "ai" ? "ai" : m?.sender_type === "agent" ? "agent" : "default";

  if (inbound) {
    return (
      <div className="flex w-full justify-start px-2 py-[2px] sm:px-3">
        <div className="max-w-[min(760px,82%)]">
          <TelegramBubble side="left" text={text} sentAt={sentAt} tone={tone} />

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
    );
  }

  return (
    <div className="flex w-full justify-end px-2 py-[2px] sm:px-3">
      <div className="max-w-[min(760px,82%)]">
        <TelegramBubble side="right" text={text} sentAt={sentAt} tone={tone} />

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