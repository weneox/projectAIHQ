import { Layers3, Search, ShieldAlert } from "lucide-react";

import { normalizeReplayTrace } from "../../lib/replayTrace.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function badgeTone(kind = "neutral") {
  if (kind === "runtime") return "border-[#dfe9ea] bg-[#f2fbfb] text-cyan-800";
  if (kind === "usecase") return "border-[#ece2d3] bg-[#fffaf4] text-stone-700";
  return "border-[#e6def1] bg-[#f7f3fc] text-violet-800";
}

export default function InboxReplayTraceCard({
  traceSource,
  title = "Replay trace",
  subtitle = "Why the system took this action",
  compact = false,
}) {
  const trace = normalizeReplayTrace(traceSource);

  if (!trace.hasTrace) return null;

  return (
    <div
      className={[
        "rounded-2xl border border-[#ece2d3] bg-[#fffdfa]",
        compact ? "px-3.5 py-3" : "px-4 py-3.5",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-stone-400">
            <Search className="h-3.5 w-3.5" />
            Inspect
          </div>
          <div className="mt-1 text-sm font-semibold text-stone-900">{title}</div>
          <div className="mt-1 text-xs leading-5 text-stone-500">{subtitle}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {s(trace.runtimeReference) ? (
            <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${badgeTone("runtime")}`}>
              {trace.runtimeReference}
            </span>
          ) : null}
          {s(trace.usecase) ? (
            <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${badgeTone("usecase")}`}>
              {trace.usecase}
            </span>
          ) : null}
        </div>
      </div>

      {trace.promptLayers.length ? (
        <div className="mt-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-stone-400">
            <Layers3 className="h-3.5 w-3.5" />
            Prompt layers used
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {trace.promptLayers.map((layer) => (
              <span
                key={layer}
                className="rounded-full border border-[#ece2d3] bg-[#fffaf4] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-stone-700"
              >
                {layer}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {trace.rows
          .filter((row) => row.label !== "Prompt layers" && row.label !== "Claim block")
          .map((row) => (
            <div
              key={`${title}-${row.label}`}
              className="rounded-xl border border-[#ece2d3] bg-white px-3 py-2.5"
            >
              <div className="text-[10px] uppercase tracking-[0.16em] text-stone-400">
                {row.label}
              </div>
              <div className="mt-1 text-sm leading-5 text-stone-700">{row.value}</div>
            </div>
          ))}
      </div>

      {s(trace.disallowedClaimReason) ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{trace.disallowedClaimReason}</span>
        </div>
      ) : null}
    </div>
  );
}
