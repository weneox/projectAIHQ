import { motion } from "framer-motion";
import { FileText, Globe2, Loader2 } from "lucide-react";

import SetupStudioStageShell from "../components/SetupStudioStageShell.jsx";
import { MetricCard, StageSection, TinyChip, TinyLabel } from "../components/SetupStudioUi.jsx";
import { truncateMiddle } from "../lib/setupStudioHelpers.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function sourceLabel(sourceType = "", lastUrl = "") {
  const x = s(sourceType).toLowerCase();
  if (x === "google_maps") return "Google Maps";
  if (x === "website") return "Website";
  if (s(lastUrl)) return "Source";
  return "Business details";
}

function buildDefaultScanLines({
  sourceType = "",
  hasSourceInput = false,
  hasManualInput = false,
}) {
  const sourceName = sourceLabel(sourceType);
  const lines = [];

  if (hasSourceInput) {
    lines.push(sourceName ? `Reading ${sourceName}` : "Reading source");
  }

  if (hasManualInput) {
    lines.push("Merging your business description");
  }

  lines.push("Preparing business details");
  lines.push("Building the draft");
  lines.push("Getting review ready");

  return lines.filter(Boolean);
}

export default function SetupStudioScanningStage({
  lastUrl,
  sourceType = "",
  hasSourceInput,
  hasManualInput = false,
  scanLines = [],
  scanLineIndex = 0,
}) {
  const resolvedHasSourceInput =
    typeof hasSourceInput === "boolean" ? hasSourceInput : !!s(lastUrl);
  const safeLines = arr(scanLines).length
    ? arr(scanLines)
    : buildDefaultScanLines({
        sourceType,
        hasSourceInput: resolvedHasSourceInput,
        hasManualInput,
      });
  const activeIndex = Math.max(
    0,
    Math.min(Number(scanLineIndex || 0), safeLines.length - 1)
  );
  const sourceName = sourceLabel(sourceType, lastUrl);
  const clippedUrl = s(lastUrl) ? truncateMiddle(lastUrl, 58, 28) : "";

  return (
    <SetupStudioStageShell
      eyebrow="build draft"
      title="Building your draft"
      body="We are turning your business information into a draft you can review before continuing."
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <TinyLabel>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              In progress
            </TinyLabel>
            {clippedUrl ? <TinyChip>{clippedUrl}</TinyChip> : <TinyChip>{sourceName}</TinyChip>}
            {hasManualInput ? (
              <TinyChip>
                <FileText className="mr-1 h-3.5 w-3.5" />
                Description
              </TinyChip>
            ) : null}
          </div>

          <div className="mt-8 space-y-1">
            {safeLines.map((line, index) => {
              const active = index === activeIndex;
              const done = index < activeIndex;

              return (
                <motion.div
                  key={`${line}-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-4 border-t border-slate-200/80 py-4 first:border-t-0 first:pt-0"
                >
                  <div
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold ${
                      active
                        ? "bg-slate-950 text-white"
                        : done
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-white/78 text-slate-500"
                    }`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className={`text-sm font-medium ${active ? "text-slate-950" : done ? "text-slate-700" : "text-slate-500"}`}>
                    {line}
                  </div>

                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {active ? "live" : done ? "done" : "queued"}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <StageSection border={false} className="grid gap-8 content-start lg:pt-2">
          <MetricCard
            label="Source"
            value={sourceName}
            detail="A website, a short description, or both."
          />
          <MetricCard
            label="Next"
            value="Review"
            detail="You will check the draft before confirming anything."
          />
          {clippedUrl ? (
            <div className="rounded-[24px] border border-slate-200 bg-white/82 p-4 text-sm leading-6 text-slate-500">
              <div className="mb-2 flex items-center gap-2 font-medium text-slate-700">
                <Globe2 className="h-4 w-4 text-slate-400" />
                Website
              </div>
              <div>{clippedUrl}</div>
            </div>
          ) : null}
        </StageSection>
      </div>
    </SetupStudioStageShell>
  );
}
