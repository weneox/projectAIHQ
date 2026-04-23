import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { fmtRelative } from "../../lib/inbox-ui.js";
import { normalizeReplayTrace } from "../../lib/replayTrace.js";
import InboxReplayTraceCard from "./InboxReplayTraceCard.jsx";

function s(value) {
  return String(value ?? "").trim();
}

function resolveSenderLabel(message, inbound) {
  if (inbound) return "Customer";
  if (message?.sender_type === "agent") return "Operator";
  if (message?.sender_type === "ai") return "AI";
  return "Message";
}

function resolveBubbleTone(message, inbound) {
  if (inbound) {
    return {
      wrapAlign: "items-start",
      metaAlign: "justify-start text-left",
      bubbleAlign: "self-start",
      bubble:
        "border-[rgba(15,23,42,0.07)] bg-white text-[rgba(15,23,42,0.94)] shadow-[0_18px_36px_-30px_rgba(15,23,42,0.14)]",
    };
  }

  if (message?.sender_type === "agent") {
    return {
      wrapAlign: "items-end",
      metaAlign: "justify-end text-right",
      bubbleAlign: "self-end",
      bubble:
        "border-[rgba(37,99,235,0.10)] bg-[rgba(239,246,255,0.92)] text-[rgba(15,23,42,0.96)] shadow-[0_18px_36px_-30px_rgba(37,99,235,0.18)]",
    };
  }

  return {
    wrapAlign: "items-end",
    metaAlign: "justify-end text-right",
    bubbleAlign: "self-end",
    bubble:
      "border-[rgba(59,130,246,0.09)] bg-[rgba(244,247,255,0.94)] text-[rgba(15,23,42,0.96)] shadow-[0_18px_36px_-30px_rgba(59,130,246,0.14)]",
  };
}

function shouldAllowInspect(message, enableInspect) {
  if (!enableInspect) return false;
  const replayTrace = normalizeReplayTrace(message);
  return Boolean(
    replayTrace?.hasTrace &&
      (message?.sender_type === "ai" || message?.direction === "outbound")
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
      <div className="w-fit max-w-[84%] sm:max-w-[78%] xl:max-w-[70%]">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-2 rounded-[11px] border border-[rgba(15,23,42,0.08)] bg-white px-3 py-1.5 text-[11px] font-medium text-[rgba(71,85,105,0.92)] transition-colors hover:bg-[rgba(248,250,252,0.96)] hover:text-[rgba(15,23,42,0.88)]"
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
  attemptsByCorrelation: _attemptsByCorrelation,
  enableInspect = false,
}) {
  const [inspectOpen, setInspectOpen] = useState(false);

  const inbound = m?.direction === "inbound";
  const who = resolveSenderLabel(m, inbound);
  const tone = resolveBubbleTone(m, inbound);
  const showInspect = shouldAllowInspect(m, enableInspect);
  const sentAt = fmtRelative(m?.sent_at || m?.created_at);
  const text = s(m?.text);

  return (
    <div className={["flex flex-col gap-1.5", tone.wrapAlign].join(" ")}>
      <div
        className={[
          "flex w-fit max-w-[84%] sm:max-w-[78%] xl:max-w-[70%] items-center gap-2 px-1 text-[11px]",
          tone.metaAlign,
        ].join(" ")}
      >
        <span className="font-medium text-[rgba(51,65,85,0.9)]">{who}</span>
        {sentAt ? (
          <>
            <span className="text-[rgba(203,213,225,0.96)]">•</span>
            <span className="text-[rgba(148,163,184,0.96)]">{sentAt}</span>
          </>
        ) : null}
      </div>

      <div
        className={[
          "w-fit max-w-[84%] sm:max-w-[78%] xl:max-w-[70%] rounded-[18px] border px-4 py-3 text-[14.5px] leading-7",
          tone.bubble,
          tone.bubbleAlign,
        ].join(" ")}
      >
        {text ? (
          <div className="whitespace-pre-wrap break-words">{text}</div>
        ) : (
          <span className="text-[rgba(148,163,184,0.96)]">
            (empty message)
          </span>
        )}
      </div>

      {showInspect ? (
        <InspectBlock
          open={inspectOpen}
          onToggle={() => setInspectOpen((current) => !current)}
          traceSource={m}
          align={inbound ? "start" : "end"}
        />
      ) : null}
    </div>
  );
}