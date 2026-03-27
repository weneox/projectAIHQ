import { ArrowRight, PencilLine } from "lucide-react";
import React from "react";

import SetupStudioStageShell from "../components/SetupStudioStageShell.jsx";
import SetupStudioEvidenceNotice from "../components/SetupStudioEvidenceNotice.jsx";
import {
  GhostButton,
  StageSection,
  TinyChip,
  TinyLabel,
} from "../components/SetupStudioUi.jsx";
import { humanizeStudioIssue } from "../logic/helpers.js";

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function s(v, d = "") {
  return String(v ?? d).trim();
}

function normalizeRows(rows = []) {
  return arr(rows)
    .map((item) => {
      if (Array.isArray(item)) {
        return {
          label: s(item[0]),
          value: s(item[1]),
          provenance: "",
        };
      }

      if (item && typeof item === "object") {
        return {
          label: s(item.label || item.key || item.title),
          value: s(item.value || item.text || item.description),
          provenance: s(item.provenance),
        };
      }

      return { label: "", value: "", provenance: "" };
    })
    .filter((item) => item.label || item.value);
}

function sourceRoleLabel(source = {}) {
  const role = s(source?.role).toLowerCase();
  if (source?.isPrimary || role === "primary") return "Primary";
  if (source?.isSupporting || role === "supporting") return "Supporting";
  return "";
}

function Row({ label, value, provenance = "" }) {
  return (
    <div className="grid gap-2 border-t border-slate-200/80 py-3 first:border-t-0 first:pt-0 md:grid-cols-[180px_minmax(0,1fr)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="min-w-0">
        <div className="break-words text-sm leading-6 text-slate-700">
          {value || "Missing"}
        </div>
        {provenance ? (
          <div className="mt-1 text-[11px] text-slate-400">{provenance}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function SetupStudioIdentityStage({
  currentTitle,
  currentDescription,
  discoveryProfileRows,
  discoveryWarnings = [],
  honestySummary = {},
  sourceLabel = "",
  reviewSources = [],
  onNext,
  onToggleRefine,
}) {
  const rows = normalizeRows(discoveryProfileRows).slice(0, 8);
  const warnings = arr(discoveryWarnings)
    .map((item) => humanizeStudioIssue(item))
    .filter(Boolean)
    .slice(0, 4);
  const sources = arr(reviewSources)
    .map((item) => ({
      label: s(item?.label || item?.sourceType || item?.url),
      role: sourceRoleLabel(item),
    }))
    .filter((item) => item.label)
    .slice(0, 4);

  const identityTitle = s(currentTitle) || "Business name needs review";
  const identitySummary =
    s(currentDescription) || "Add a short business summary before finalizing.";

  return (
    <SetupStudioStageShell
      eyebrow="identity"
      title="Shape one clean business identity."
      body="Keep the draft specific. Open the review workspace to compare proposed truth against observed evidence."
    >
      <div className="max-w-[920px]">
        <div className="flex flex-wrap items-center gap-2">
          <TinyLabel>Editable draft</TinyLabel>
          {sourceLabel ? <TinyChip>{sourceLabel}</TinyChip> : null}
          {warnings.length ? (
            <TinyChip tone="warn">
              {warnings.length} review item{warnings.length === 1 ? "" : "s"}
            </TinyChip>
          ) : (
            <TinyChip tone="success">Draft visible</TinyChip>
          )}
        </div>

        <div className="mt-7 grid gap-8 md:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <div className="text-[34px] font-semibold leading-[1.04] tracking-[-0.05em] text-slate-950 sm:text-[40px]">
              {identityTitle}
            </div>
            <div className="mt-3 max-w-[720px] text-[15px] leading-7 text-slate-600">
              {identitySummary}
            </div>
          </div>

          <div className="grid content-start gap-5">
            <div>
              <div className="text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                {rows.length}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                observed fields
              </div>
            </div>
            {sources.length ? (
              <div className="flex flex-wrap gap-2">
                {sources.map((item, index) => (
                  <TinyChip key={`${item.label}-${index}`}>
                    {item.label}
                    {item.role ? ` - ${item.role}` : ""}
                  </TinyChip>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <SetupStudioEvidenceNotice
          tone={honestySummary?.tone || "default"}
          title={honestySummary?.title || "Reviewed session draft"}
          body={honestySummary?.message || ""}
          chips={honestySummary?.chips || []}
          className="mt-8"
        />

        {warnings.length ? (
          <StageSection className="mt-8">
            <div className="flex flex-wrap gap-2">
              {warnings.map((warning, index) => (
                <TinyChip key={`${warning}-${index}`} tone="warn">
                  {warning}
                </TinyChip>
              ))}
            </div>
          </StageSection>
        ) : null}

        <StageSection className="mt-8">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Observed snapshot
          </div>
          {rows.length ? (
            rows.map((item, index) => (
              <Row
                key={`${item.label}-${index}`}
                label={item.label}
                value={item.value}
                provenance={item.provenance}
              />
            ))
          ) : (
            <div className="text-sm leading-6 text-slate-500">
              No strong observed fields yet. Complete the draft manually.
            </div>
          )}
        </StageSection>

        <StageSection className="mt-8 flex flex-wrap gap-3">
          <GhostButton active icon={ArrowRight} onClick={onNext}>
            Continue
          </GhostButton>
          <GhostButton icon={PencilLine} onClick={onToggleRefine}>
            Open review workspace
          </GhostButton>
        </StageSection>
      </div>
    </SetupStudioStageShell>
  );
}
