import { Layers3, Search, ShieldAlert } from "lucide-react";

import { normalizeReplayTrace } from "../../lib/replayTrace.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function badgeTone(kind = "neutral") {
  if (kind === "runtime") return "border-[rgba(var(--color-brand),0.18)] bg-brand-soft text-brand";
  if (kind === "usecase") return "border-line bg-surface-subtle text-text-muted";
  return "border-line bg-surface text-text-muted";
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
        "rounded-panel border border-line bg-surface",
        compact ? "px-3.5 py-3" : "px-4 py-3.5",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-text-subtle">
            <Search className="h-3.5 w-3.5" />
            Inspect
          </div>
          <div className="mt-1 text-[14px] font-semibold text-text">{title}</div>
          <div className="mt-1 text-[12px] leading-5 text-text-muted">{subtitle}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {s(trace.runtimeReference) ? (
            <span
              className={`rounded-pill border px-2.5 py-1 text-[11px] ${badgeTone(
                "runtime"
              )}`}
            >
              {trace.runtimeReference}
            </span>
          ) : null}
          {s(trace.usecase) ? (
            <span
              className={`rounded-pill border px-2.5 py-1 text-[11px] ${badgeTone(
                "usecase"
              )}`}
            >
              {trace.usecase}
            </span>
          ) : null}
        </div>
      </div>

      {trace.promptLayers.length ? (
        <div className="mt-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-text-subtle">
            <Layers3 className="h-3.5 w-3.5" />
            Prompt layers used
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {trace.promptLayers.map((layer) => (
              <span
                key={layer}
                className="rounded-pill border border-line bg-surface-subtle px-2.5 py-1 text-[11px] text-text-muted"
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
              className="rounded-soft border border-line-soft bg-surface-subtle px-3 py-2.5"
            >
              <div className="text-[11px] uppercase tracking-[0.1em] text-text-subtle">
                {row.label}
              </div>
              <div className="mt-1 text-[13px] leading-5 text-text-muted">
                {row.value}
              </div>
            </div>
          ))}
      </div>

      {s(trace.disallowedClaimReason) ? (
        <div className="mt-3 flex items-start gap-2 rounded-soft border border-danger/20 bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{trace.disallowedClaimReason}</span>
        </div>
      ) : null}
    </div>
  );
}
