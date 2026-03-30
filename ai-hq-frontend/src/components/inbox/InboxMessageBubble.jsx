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

function getLineageActionLabel(truth) {
  switch (truth?.kind) {
    case "missing_correlation":
      return "Open lineage panel";
    case "awaiting_attempt":
      return "Inspect pending lineage";
    case "stale_attempt":
      return "Inspect stale lineage";
    default:
      return "Inspect lineage";
  }
}

function InlineOutboundTruth({ truth, onInspectLineage }) {
  const attempt = truth?.attempt || null;
  const attemptCount = Number(attempt?.attempt_count || 0);
  const maxAttempts = Number(attempt?.max_attempts || 0);
  const canInspectLineage = typeof onInspectLineage === "function";

  return (
    <div className="mt-2 max-w-[92%] rounded-[18px] border border-slate-200 bg-white px-3 py-2.5 text-xs shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
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

      {canInspectLineage ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() =>
              onInspectLineage({
                truthKind: truth?.kind || "",
                attemptId: s(attempt?.id),
              })
            }
            className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-violet-800 transition hover:border-violet-300 hover:bg-violet-100"
          >
            {getLineageActionLabel(truth)}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function InboxMessageBubble({
  m,
  attemptsByCorrelation,
  onInspectLineage,
}) {
  const [inspectOpen, setInspectOpen] = useState(false);
  const inbound = m.direction === "inbound";
  const align = inbound ? "items-start" : "items-end";
  const bubble = inbound
    ? "border-slate-200 bg-white text-slate-800"
    : m.sender_type === "agent"
      ? "border-violet-200 bg-violet-50 text-violet-900"
      : "border-cyan-200 bg-cyan-50 text-cyan-900";

  const who =
    m.sender_type === "agent"
      ? "operator"
      : m.sender_type === "ai"
        ? "ai"
        : m.sender_type || m.direction || "message";
  const replayTrace = normalizeReplayTrace(m);
  const canInspect =
    replayTrace.hasTrace && (m.sender_type === "ai" || m.direction === "outbound");
  const outboundTruth = getMessageOutboundTruth(m, attemptsByCorrelation);

  return (
    <div className={`flex flex-col ${align}`}>
      <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">
        {who} | {fmtRelative(m.sent_at || m.created_at)}
      </div>

      <div
        className={`max-w-[92%] rounded-[20px] border px-4 py-3 text-sm leading-6 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ${bubble}`}
      >
        {m.text || <span className="text-slate-400">(empty message)</span>}
      </div>

      {outboundTruth ? (
        <InlineOutboundTruth
          truth={outboundTruth}
          onInspectLineage={onInspectLineage}
        />
      ) : null}

      {canInspect ? (
        <div className="mt-2 max-w-[92%]">
          <button
            type="button"
            onClick={() => setInspectOpen((current) => !current)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
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
