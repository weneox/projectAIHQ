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
      bubble:
        "border-[rgba(15,23,42,0.08)] bg-white text-[rgba(15,23,42,0.94)] shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)]",
      footerAlign: "justify-start text-left",
    };
  }

  if (message?.sender_type === "agent") {
    return {
      wrapAlign: "items-end",
      metaAlign: "justify-end text-right",
      bubble:
        "border-[rgba(37,99,235,0.12)] bg-[linear-gradient(180deg,rgba(239,246,255,0.98),rgba(232,240,255,0.96))] text-[rgba(15,23,42,0.96)] shadow-[0_22px_48px_-34px_rgba(37,99,235,0.28)]",
      footerAlign: "justify-end text-right",
    };
  }

  return {
    wrapAlign: "items-end",
    metaAlign: "justify-end text-right",
    bubble:
      "border-[rgba(37,99,235,0.12)] bg-[linear-gradient(180deg,rgba(243,247,255,0.98),rgba(235,242,255,0.96))] text-[rgba(15,23,42,0.96)] shadow-[0_22px_48px_-34px_rgba(37,99,235,0.24)]",
    footerAlign: "justify-end text-right",
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

function InspectBlock({ open, onToggle, traceSource }) {
  return (
    <div className="mt-2 w-full max-w-[76%]">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-2 rounded-[12px] border border-[rgba(15,23,42,0.08)] bg-white px-3 py-1.5 text-[11px] font-medium text-[rgba(71,85,105,0.92)] transition-colors hover:bg-[rgba(248,250,252,0.96)] hover:text-[rgba(15,23,42,0.88)]"
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
    <div className={`flex flex-col ${tone.wrapAlign}`}>
      <div
        className={`mb-2 flex w-full max-w-[76%] items-center gap-2 px-1 text-[11px] ${tone.metaAlign}`}
      >
        <span className="font-medium text-[rgba(51,65,85,0.92)]">{who}</span>
        {sentAt ? (
          <>
            <span className="text-[rgba(148,163,184,0.92)]">|</span>
            <span className="text-[rgba(148,163,184,0.96)]">{sentAt}</span>
          </>
        ) : null}
      </div>

      <div
        className={[
          "w-full max-w-[76%] rounded-[22px] border px-5 py-4 text-[15px] leading-8",
          tone.bubble,
        ].join(" ")}
      >
        {text ? (
          <div className="whitespace-pre-wrap break-words">{text}</div>
        ) : (
          <span className="text-[rgba(148,163,184,0.96)]">(empty message)</span>
        )}
      </div>

      {!inbound && sentAt ? (
        <div
          className={`mt-2 flex w-full max-w-[76%] items-center gap-2 px-1 text-[11px] text-[rgba(148,163,184,0.96)] ${tone.footerAlign}`}
        >
          <span>{sentAt}</span>
        </div>
      ) : null}

      {showInspect ? (
        <InspectBlock
          open={inspectOpen}
          onToggle={() => setInspectOpen((current) => !current)}
          traceSource={m}
        />
      ) : null}
    </div>
  );
}