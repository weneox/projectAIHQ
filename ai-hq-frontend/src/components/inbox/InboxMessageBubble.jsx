import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { fmtRelative } from "../../lib/inbox-ui.js";
import { normalizeReplayTrace } from "../../lib/replayTrace.js";
import {
  getMessageOutboundTruth,
} from "./outboundAttemptTruth.js";
import InboxReplayTraceCard from "./InboxReplayTraceCard.jsx";

function s(value) {
  return String(value ?? "").trim();
}

function isMeaningfulMessageText(value = "") {
  return s(value).length > 0;
}

function labelForMessage(message, inbound) {
  if (inbound) return "Customer";
  if (message.sender_type === "agent") return "Operator";
  if (message.sender_type === "ai") return "AI";
  if (message.sender_type === "system") return "System";
  return message.sender_type || message.direction || "Message";
}

function toneForMeta(message, inbound) {
  if (inbound) return "text-slate-500";
  if (message.sender_type === "agent") return "text-sky-700";
  if (message.sender_type === "ai") return "text-violet-700";
  if (message.sender_type === "system") return "text-slate-500";
  return "text-slate-500";
}

function OutboundEventLine({ truth, align = "right" }) {
  const attempt = truth?.attempt || null;
  const attemptCount = Number(attempt?.attempt_count || 0);
  const maxAttempts = Number(attempt?.max_attempts || 0);
  const provider = s(attempt?.provider);
  const error = s(attempt?.last_error);

  const statusText = s(truth?.label);
  const detailText = s(truth?.detail);

  return (
    <div
      className={[
        "mt-3 max-w-[88%]",
        align === "left" ? "self-start" : "self-end",
      ].join(" ")}
    >
      <div className="rounded-[20px] border border-slate-200/80 bg-white/90 px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.045)]">
        <div className="flex items-start gap-3">
          <div className="mt-[8px] h-px w-4 shrink-0 bg-slate-300" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
              <span className="font-medium text-slate-900">
                {detailText || statusText || "Delivery event"}
              </span>

              {attempt ? (
                <span className="text-slate-400">•</span>
              ) : null}

              {attempt ? (
                <span className="text-slate-500">
                  attempt {attemptCount || 0}
                  {maxAttempts > 0 ? ` of ${maxAttempts}` : ""}
                </span>
              ) : null}
            </div>

            {(provider || error || statusText) ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-500">
                {statusText && detailText !== statusText ? (
                  <span>{statusText}</span>
                ) : null}
                {provider ? <span>{provider}</span> : null}
                {error ? <span>{error}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyEventLine({ message, align = "right" }) {
  return (
    <div
      className={[
        "mt-3 max-w-[88%]",
        align === "left" ? "self-start" : "self-end",
      ].join(" ")}
    >
      <div className="rounded-[18px] border border-dashed border-slate-200 bg-white/70 px-4 py-2.5 text-[13px] text-slate-400">
        Empty message skipped
        {message?.sender_type === "system" ? " by system" : ""}
      </div>
    </div>
  );
}

export default function InboxMessageBubble({ m, attemptsByCorrelation }) {
  const [inspectOpen, setInspectOpen] = useState(false);

  const inbound = m.direction === "inbound";
  const replayTrace = normalizeReplayTrace(m);
  const canInspect =
    replayTrace.hasTrace && (m.sender_type === "ai" || m.direction === "outbound");
  const outboundTruth = getMessageOutboundTruth(m, attemptsByCorrelation);
  const who = labelForMessage(m, inbound);
  const hasText = isMeaningfulMessageText(m.text);

  const shouldRenderAsEventOnly =
    !inbound &&
    (!hasText || m.sender_type === "system" || Boolean(outboundTruth));

  return (
    <div className={`flex flex-col ${inbound ? "items-start" : "items-end"}`}>
      <div
        className={`mb-1.5 flex max-w-[88%] items-center gap-2 px-1 text-[11px] ${
          inbound ? "justify-start" : "justify-end"
        }`}
      >
        <span className={`font-medium ${toneForMeta(m, inbound)}`}>{who}</span>
        <span className="text-slate-300">•</span>
        <span className="text-slate-500">
          {fmtRelative(m.sent_at || m.created_at)}
        </span>
      </div>

      {shouldRenderAsEventOnly ? (
        <>
          {hasText ? (
            <div
              className={[
                "max-w-[88%] rounded-[20px] border px-4 py-3 text-[15px] leading-7 shadow-[0_10px_24px_rgba(15,23,42,0.04)]",
                inbound
                  ? "border-slate-200/80 bg-white text-slate-800"
                  : m.sender_type === "agent"
                    ? "border-sky-200/80 bg-sky-50/80 text-sky-950"
                    : "border-slate-200/80 bg-white text-slate-800",
              ].join(" ")}
            >
              {m.text}
            </div>
          ) : null}

          {!hasText ? <EmptyEventLine message={m} align={inbound ? "left" : "right"} /> : null}

          {outboundTruth ? (
            <OutboundEventLine
              truth={outboundTruth}
              align={inbound ? "left" : "right"}
            />
          ) : null}
        </>
      ) : (
        <>
          <div
            className={[
              "max-w-[88%] rounded-[20px] border px-4 py-3 text-[15px] leading-7 shadow-[0_10px_24px_rgba(15,23,42,0.04)]",
              inbound
                ? "border-slate-200/80 bg-white text-slate-800"
                : m.sender_type === "agent"
                  ? "border-sky-200/80 bg-sky-50/80 text-sky-950"
                  : "border-violet-200/80 bg-violet-50/80 text-violet-950",
            ].join(" ")}
          >
            {m.text}
          </div>

          {outboundTruth ? (
            <OutboundEventLine
              truth={outboundTruth}
              align={inbound ? "left" : "right"}
            />
          ) : null}
        </>
      )}

      {canInspect ? (
        <div className={`mt-2 max-w-[88%] ${inbound ? "" : "text-right"}`}>
          <button
            type="button"
            onClick={() => setInspectOpen((current) => !current)}
            className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-400 transition hover:text-slate-700"
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