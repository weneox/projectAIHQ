import { ArrowRight, BadgeCheck, PencilLine } from "lucide-react";
import React from "react";

import SetupStudioStageShell from "../components/SetupStudioStageShell.jsx";
import SetupStudioEvidenceNotice from "../components/SetupStudioEvidenceNotice.jsx";
import {
  GhostButton,
  MetricCard,
  StageSection,
  TinyChip,
  TinyLabel,
} from "../components/SetupStudioUi.jsx";
import { humanizeStudioIssue } from "../logic/helpers.js";

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function s(v, d = "") {
  return String(v ?? d).trim();
}

export default function SetupStudioReadyStage({
  meta,
  studioProgress,
  hasKnowledge,
  honestySummary = {},
  onToggleRefine,
  onToggleKnowledge,
  onOpenTruth,
  onOpenWorkspace,
}) {
  const readinessScore = num(meta?.readinessScore, 0);
  const approvedKnowledgeCount = num(meta?.approvedKnowledgeCount, 0);
  const serviceCount = num(meta?.serviceCount, 0);

  const missingSteps = arr(
    studioProgress?.missingSteps?.length
      ? studioProgress.missingSteps
      : meta?.missingSteps
  )
    .map((item) => humanizeStudioIssue(item))
    .filter(Boolean);

  const readinessLabel = s(
    studioProgress?.readinessLabel || meta?.readinessLabel || "Ready"
  );

  return (
    <SetupStudioStageShell
      eyebrow="ready"
      title="The draft is ready for review."
      body="It stays temporary until you confirm the reviewed truth inside the review workspace."
      align="center"
    >
      <div className="mx-auto max-w-[900px]">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <TinyLabel>{readinessLabel}</TinyLabel>
          <TinyChip tone="success">Temporary draft</TinyChip>
        </div>

        <div className="mx-auto mt-5 max-w-[620px] text-[18px] leading-8 text-slate-600">
          Review the proposed fields against visible evidence, finalize the reviewed truth, then continue into the workspace.
        </div>

        <SetupStudioEvidenceNotice
          tone={honestySummary?.tone || "default"}
          title={honestySummary?.title || "Temporary review draft"}
          body={honestySummary?.finalizeMessage || honestySummary?.message || ""}
          chips={honestySummary?.chips || []}
          className="mx-auto mt-8 max-w-[720px] text-left"
        />

        <StageSection border={false} className="mt-10 grid gap-8 sm:grid-cols-3 text-left">
          <MetricCard label="Readiness" value={`${readinessScore}%`} />
          <MetricCard label="Approved" value={approvedKnowledgeCount} />
          <MetricCard label="Services" value={serviceCount} />
        </StageSection>

        {missingSteps.length ? (
          <StageSection className="mt-8">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {missingSteps.map((item, index) => (
                <TinyChip key={`${item}-${index}`} tone="warn">
                  {item}
                </TinyChip>
              ))}
            </div>
          </StageSection>
        ) : null}

        <StageSection className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <GhostButton icon={PencilLine} onClick={onToggleRefine}>
            Open review workspace
          </GhostButton>
          {hasKnowledge ? (
            <GhostButton icon={BadgeCheck} onClick={onToggleKnowledge}>
              Review knowledge
            </GhostButton>
          ) : null}
          <GhostButton onClick={onOpenTruth}>
            View approved truth
          </GhostButton>
          <GhostButton active icon={ArrowRight} onClick={onOpenWorkspace}>
            Open workspace
          </GhostButton>
        </StageSection>
      </div>
    </SetupStudioStageShell>
  );
}
