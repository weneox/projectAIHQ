import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { fmtRelative } from "../../lib/inbox-ui.js";
import { normalizeReplayTrace } from "../../lib/replayTrace.js";
import {
  getAttemptStatusTone,
  getMessageOutboundTruth,
} from "./outboundAttemptTruth.js";
import InboxReplayTraceCard from "./InboxReplayTraceCard.jsx";

function s(value) {
  return String(value ?? "").trim();
}

function InlineOutboundTruth({ truth }) {
  const attempt = truth?.attempt || null;
  const attemptCount = Number(attempt?.attempt_count || 0);
  const maxAttempts = Number(attempt?.max_attempts || 0);

  return (
    <div className="mt-2 max-w-[88%] rounded-[18px] border border-slate-200/80 bg-[#fafbfc] px-3 py-2.5 text-xs shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${getAttemptStatusTone(
            truth?.status
          )}`}
        >
          {truth?.label}
        </span>

        {attempt ? (
          <span className="text-slate-500">
            attempt {attemptCount || 0}
            {maxAttempts > 0 ? ` of ${maxAttempts}` : ""}
          </span>
        ) : null}
      </div>

      <div className="mt-2 leading-5 text-slate-600">{truth?.detail}</div>

      {attempt ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span>Provider: {s(attempt?.provider) || "--"}</span>
          {s(attempt?.last_error) ? <span>Error: {s(attempt?.last_error)}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function labelForMessage(message, inbound) {
  if (inbound) return "customer";
  if (message.sender_type === "agent") return "operator";
  if (message.sender_type === "ai") return "ai";
  return message.sender_type || message.direction || "message";
}

export default function InboxMessageBubble({ m, attemptsByCorrelation }) {
  const [inspectOpen, setInspectOpen] = useState(false);

  const inbound = m.direction === "inbound";
  const replayTrace = normalizeReplayTrace(m);
  const canInspect =
    replayTrace.hasTrace && (m.sender_type === "ai" || m.direction === "outbound");
  const outboundTruth = getMessageOutboundTruth(m, attemptsByCorrelation);
  const who = labelForMessage(m, inbound);

  return (
    <div className={`flex flex-col ${inbound ? "items-start" : "items-end"}`}>
      <div
        className={`mb-1.5 flex max-w-[88%] items-center gap-2 px-1 text-[11px] ${
          inbound ? "justify-start" : "justify-end"
        }`}
      >
        <span className="font-medium capitalize text-slate-700">{who}</span>
        <span className="text-slate-300">•</span>
        <span className="text-slate-500">{fmtRelative(m.sent_at || m.created_at)}</span>
      </div>

      <div
        className={[
          "max-w-[88%] rounded-[22px] border px-4 py-3 text-[15px] leading-7 shadow-[0_10px_24px_rgba(15,23,42,0.04)]",
          inbound
            ? "border-slate-200/80 bg-white text-slate-800"
            : m.sender_type === "agent"
              ? "border-sky-200/80 bg-sky-50/80 text-sky-950"
              : "border-violet-200/80 bg-violet-50/80 text-violet-950",
        ].join(" ")}
      >
        {m.text || <span className="text-slate-400">(empty message)</span>}
      </div>

      {outboundTruth ? <InlineOutboundTruth truth={outboundTruth} /> : null}

      {canInspect ? (
        <div className={`mt-2 max-w-[88%] ${inbound ? "" : "text-right"}`}>
          <button
            type="button"
            onClick={() => setInspectOpen((current) => !current)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-[#f8f9fb] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
          >
            {inspectOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {inspectOpen ? "Hide inspect" : "Inspect reasoning"}
          </button>

          {inspectOpen ? (
            <div className="mt-2">
              <InboxReplayTraceCard
                traceSource={m}
                compact
                title="Message inspect"
                subtitle="Replay metadata attached to this action."
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}