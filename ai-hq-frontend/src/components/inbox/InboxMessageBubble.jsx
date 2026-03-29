import { useState } from "react";

import { ChevronDown, ChevronUp } from "lucide-react";

import { fmtRelative } from "../../lib/inbox-ui.js";
import { normalizeReplayTrace } from "../../lib/replayTrace.js";
import InboxReplayTraceCard from "./InboxReplayTraceCard.jsx";

export default function InboxMessageBubble({ m }) {
  const [inspectOpen, setInspectOpen] = useState(false);
  const inbound = m.direction === "inbound";
  const align = inbound ? "items-start" : "items-end";
  const bubble = inbound
    ? "border-white/10 bg-white/[0.04] text-white/84"
    : m.sender_type === "agent"
      ? "border-violet-400/18 bg-violet-400/[0.08] text-violet-50"
      : "border-cyan-400/18 bg-cyan-400/[0.07] text-cyan-50";

  const who =
    m.sender_type === "agent"
      ? "operator"
      : m.sender_type === "ai"
        ? "ai"
        : m.sender_type || m.direction || "message";
  const replayTrace = normalizeReplayTrace(m);
  const canInspect =
    replayTrace.hasTrace && (m.sender_type === "ai" || m.direction === "outbound");

  return (
    <div className={`flex flex-col ${align}`}>
      <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-white/30">
        {who} | {fmtRelative(m.sent_at || m.created_at)}
      </div>
      <div
        className={`max-w-[92%] rounded-[20px] border px-4 py-3 text-sm leading-6 shadow-[0_10px_24px_rgba(0,0,0,0.15)] ${bubble}`}
      >
        {m.text || <span className="text-white/40">(empty message)</span>}
      </div>

      {canInspect ? (
        <div className="mt-2 max-w-[92%]">
          <button
            type="button"
            onClick={() => setInspectOpen((current) => !current)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white/64 transition hover:border-white/16 hover:text-white"
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
