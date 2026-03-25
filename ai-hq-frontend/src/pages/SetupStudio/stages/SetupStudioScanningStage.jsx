import { motion } from "framer-motion";
import { FileText, Loader2, Mic } from "lucide-react";

import SetupStudioStageShell from "../components/SetupStudioStageShell.jsx";
import {
  MetricCard,
  StageSection,
  TinyChip,
  TinyLabel,
} from "../components/SetupStudioUi.jsx";
import { truncateMiddle } from "../lib/setupStudioHelpers.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function bool(v, d = false) {
  if (typeof v === "boolean") return v;
  const x = String(v ?? "").trim().toLowerCase();
  if (!x) return d;
  if (["1", "true", "yes", "y", "on"].includes(x)) return true;
  if (["0", "false", "no", "n", "off"].includes(x)) return false;
  return d;
}

function sourceLabel(sourceType = "", lastUrl = "") {
  const x = s(sourceType).toLowerCase();
  if (x === "google_maps") return "Google Maps";
  if (x === "instagram") return "Instagram";
  if (x === "linkedin") return "LinkedIn";
  if (x === "facebook") return "Facebook";
  if (x === "website") return "Website";
  if (s(lastUrl)) return "Source";
  return "Draft";
}

function buildDefaultScanLines({
  sourceType = "",
  hasSourceInput = false,
  hasManualInput = false,
  hasVoiceInput = false,
}) {
  const sourceName = sourceLabel(sourceType);
  const lines = [];

  if (hasSourceInput) {
    lines.push(sourceName ? `Reading ${sourceName}` : "Reading source");
  }
  if (hasManualInput) {
    lines.push("Merging manual notes");
  }
  if (hasVoiceInput) {
    lines.push("Transcribing voice input");
  }

  lines.push("Shaping identity");
  lines.push("Collecting useful signals");
  lines.push("Preparing review draft");

  const seen = new Set();
  return lines.filter((line) => {
    const key = s(line).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function SetupStudioScanningStage({
  lastUrl,
  sourceType = "",
  hasSourceInput,
  hasManualInput = false,
  hasVoiceInput = false,
  scanLines = [],
  scanLineIndex = 0,
}) {
  const resolvedHasSourceInput =
    typeof hasSourceInput === "boolean" ? hasSourceInput : !!s(lastUrl);
  const resolvedHasManualInput = bool(hasManualInput, false);
  const resolvedHasVoiceInput = bool(hasVoiceInput, false);

  const defaultLines = buildDefaultScanLines({
    sourceType,
    hasSourceInput: resolvedHasSourceInput,
    hasManualInput: resolvedHasManualInput,
    hasVoiceInput: resolvedHasVoiceInput,
  });

  const safeLines = arr(scanLines).length ? arr(scanLines) : defaultLines;
  const activeIndex = Math.max(
    0,
    Math.min(Number(scanLineIndex || 0), safeLines.length - 1)
  );

  const sourceName = sourceLabel(sourceType, lastUrl);
  const clippedUrl = s(lastUrl) ? truncateMiddle(lastUrl, 58, 28) : "";

  return (
    <SetupStudioStageShell
      eyebrow="scanning"
      title="Building your review draft."
      body="A temporary draft is being prepared from the current source and any notes you added."
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <TinyLabel>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              In progress
            </TinyLabel>
            {clippedUrl ? <TinyChip>{clippedUrl}</TinyChip> : <TinyChip>{sourceName}</TinyChip>}
            {resolvedHasManualInput ? (
              <TinyChip>
                <FileText className="mr-1 h-3.5 w-3.5" />
                Notes
              </TinyChip>
            ) : null}
            {resolvedHasVoiceInput ? (
              <TinyChip>
                <Mic className="mr-1 h-3.5 w-3.5" />
                Voice
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
            detail="This run stays isolated in its own review session."
          />
          <MetricCard
            label="Draft"
            value="Temporary"
            detail="Only the reviewed draft can become saved business truth."
          />
        </StageSection>
      </div>
    </SetupStudioStageShell>
  );
}
