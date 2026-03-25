import { ArrowRight, Check, ExternalLink, X } from "lucide-react";

import SetupStudioStageShell from "../components/SetupStudioStageShell.jsx";
import {
  GhostButton,
  MetricCard,
  StageSection,
  TinyChip,
  TinyLabel,
} from "../components/SetupStudioUi.jsx";
import { humanizeStudioIssue } from "../logic/helpers.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function maybeUuid(value = "") {
  const x = s(value);
  return UUID_RE.test(x) ? x : "";
}

function maybeId(value = "") {
  const x = s(value);
  if (!x || x === "[object Object]") return "";
  return x;
}

function firstNonEmpty(values = []) {
  for (const value of values) {
    const x = maybeId(value);
    if (x) return x;
  }
  return "";
}

function pickCandidateUuid(item = {}) {
  const x = obj(item);
  const candidate = obj(x.candidate);

  return firstNonEmpty([
    maybeUuid(x.candidateId),
    maybeUuid(x.candidate_id),
    maybeUuid(x.knowledgeCandidateId),
    maybeUuid(x.knowledge_candidate_id),
    maybeUuid(x.reviewCandidateId),
    maybeUuid(x.review_candidate_id),
    maybeUuid(x.candidateUuid),
    maybeUuid(x.candidate_uuid),
    maybeUuid(x.uuid),
    maybeUuid(candidate.id),
    maybeUuid(candidate.candidateId),
    maybeUuid(candidate.candidate_id),
    maybeUuid(x.id),
  ]);
}

function pickCandidateRef(item = {}) {
  const x = obj(item);
  const candidate = obj(x.candidate);

  return firstNonEmpty([
    x.candidateId,
    x.candidate_id,
    x.knowledgeCandidateId,
    x.knowledge_candidate_id,
    x.reviewCandidateId,
    x.review_candidate_id,
    x.candidateRef,
    x.candidate_ref,
    x.candidateKey,
    x.candidate_key,
    x.candidateUuid,
    x.candidate_uuid,
    x.uuid,
    candidate.id,
    candidate.candidateId,
    candidate.candidate_id,
    x.id,
    x.itemId,
    x.item_id,
    x.key,
    x.itemKey,
    x.item_key,
  ]);
}

function pickRowId(item = {}, index = 0) {
  const x = obj(item);
  return s(
    x.rowId ||
      x.row_id ||
      x.id ||
      x.key ||
      x.itemKey ||
      x.item_key ||
      x.title ||
      x.label ||
      `knowledge-${index + 1}`
  );
}

function humanConfidence(item = {}) {
  const value =
    typeof item.confidence === "number" ? item.confidence : Number(item.confidence || 0);
  if (value >= 0.85) return "high";
  if (value >= 0.6) return "medium";
  if (value > 0) return "low";
  return "";
}

function normalizeEvidenceList(item = {}) {
  const x = obj(item);
  return arr(
    x.evidence ||
      x.sourceEvidenceJson ||
      x.source_evidence_json ||
      x.sourceEvidence ||
      x.sources
  )
    .map((entry) => obj(entry))
    .filter((entry) => Object.keys(entry).length > 0);
}

function pickEvidenceUrl(item = {}, evidence = []) {
  const x = obj(item);
  const first = obj(arr(evidence)[0]);
  return s(
    x.evidenceUrl ||
      x.evidence_url ||
      first.pageUrl ||
      first.page_url ||
      first.url ||
      first.source_url ||
      first.link
  );
}

function normalizeKnowledgeItem(item = {}, index = 0) {
  const x = obj(item);
  const evidence = normalizeEvidenceList(x);
  const rowId = pickRowId(x, index);
  const candidateUuid = pickCandidateUuid(x);
  const candidateRef = pickCandidateRef(x);
  const actionId = candidateRef || candidateUuid || rowId;

  return {
    ...x,
    id: actionId,
    actionId,
    rowId,
    candidateId: candidateRef,
    candidateUuid,
    title: s(x.title || x.label || x.key || "Untitled item"),
    value: s(
      x.value ||
        x.valueText ||
        x.value_text ||
        x.normalizedText ||
        x.normalized_text ||
        x.description
    ),
    category: s(x.category || "general"),
    source: s(
      x.source ||
        x.sourceLabel ||
        x.source_label ||
        x.source_display_name ||
        x.sourceType ||
        x.source_type
    ),
    confidence: n(x.confidence, 0),
    confidenceLabel: humanConfidence(x),
    evidence,
    evidenceUrl: pickEvidenceUrl(x, evidence),
  };
}

function groupLabel(category = "") {
  const x = s(category).toLowerCase();
  if (x === "faq" || x === "faqs") return "FAQ";
  if (x === "policy" || x === "policies") return "Policy";
  if (x === "service" || x === "services") return "Service";
  if (x === "product" || x === "products") return "Product";
  if (x === "contact" || x === "contacts") return "Contact";
  if (x === "summary") return "Summary";
  if (x === "location") return "Location";
  return "Knowledge";
}

export default function SetupStudioKnowledgeStage({
  knowledgePreview,
  knowledgeItems = [],
  actingKnowledgeId,
  sourceLabel,
  warnings,
  onApproveKnowledge,
  onRejectKnowledge,
  onNext,
  onToggleKnowledge,
}) {
  const mergedSource = arr(knowledgeItems).length
    ? arr(knowledgeItems)
    : arr(knowledgePreview);

  const items = mergedSource
    .map((item, index) => normalizeKnowledgeItem(item, index))
    .filter((item) => item.rowId || item.title || item.value)
    .slice(0, 6);

  const warningList = arr(warnings)
    .map((x) => humanizeStudioIssue(x))
    .filter(Boolean)
    .slice(0, 3);
  const actingId = s(actingKnowledgeId);
  const avgConfidence = items.length
    ? Math.round(
        (items.reduce((sum, item) => sum + n(item.confidence, 0), 0) /
          items.length) *
          100
      )
    : 0;

  return (
    <SetupStudioStageShell
      eyebrow="knowledge"
      title="Keep only the signals that should survive."
      body="Approve what feels true. Reject what is generic, noisy, or weak, then finalize from the review workspace."
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <TinyLabel>Knowledge review</TinyLabel>
            {sourceLabel ? <TinyChip>{sourceLabel}</TinyChip> : null}
            <TinyChip>{items.length} visible</TinyChip>
          </div>

          {warningList.length ? (
            <StageSection className="mt-6">
              <div className="flex flex-wrap gap-2">
                {warningList.map((warning, index) => (
                  <TinyChip key={`${warning}-${index}`} tone="warn">
                    {warning}
                  </TinyChip>
                ))}
              </div>
            </StageSection>
          ) : null}

          <StageSection className="mt-6">
            {items.length ? (
              items.map((item) => {
                const busy = !!actingId &&
                  [item.actionId, item.candidateId, item.candidateUuid, item.rowId]
                    .map((value) => s(value))
                    .filter(Boolean)
                    .includes(actingId);

                return (
                  <div
                    key={item.rowId}
                    className="border-t border-slate-200/80 py-5 first:border-t-0 first:pt-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <TinyChip>{groupLabel(item.category)}</TinyChip>
                      {item.confidenceLabel ? (
                        <TinyChip>{item.confidenceLabel}</TinyChip>
                      ) : null}
                      {item.source ? <TinyChip>{item.source}</TinyChip> : null}
                    </div>

                    <div className="mt-4 text-[22px] font-semibold tracking-[-0.04em] text-slate-950">
                      {item.title}
                    </div>
                    <div className="mt-2 max-w-[760px] text-sm leading-7 text-slate-600">
                      {item.value || "No detail was extracted for this item."}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <GhostButton
                        active
                        icon={Check}
                        disabled={busy}
                        onClick={() =>
                          onApproveKnowledge?.({
                            ...item,
                            id: item.actionId,
                            actionId: item.actionId,
                            rowId: item.rowId,
                            candidateId:
                              item.candidateUuid ||
                              item.candidateId ||
                              item.actionId,
                            candidateUuid: item.candidateUuid,
                          })
                        }
                      >
                        {busy ? "Saving..." : "Approve"}
                      </GhostButton>

                      <GhostButton
                        icon={X}
                        disabled={busy}
                        onClick={() =>
                          onRejectKnowledge?.({
                            ...item,
                            id: item.actionId,
                            actionId: item.actionId,
                            rowId: item.rowId,
                            candidateId:
                              item.candidateUuid ||
                              item.candidateId ||
                              item.actionId,
                            candidateUuid: item.candidateUuid,
                          })
                        }
                      >
                        Reject
                      </GhostButton>

                      {item.evidenceUrl ? (
                        <a
                          href={item.evidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-slate-950"
                        >
                          Evidence
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm leading-6 text-slate-500">
                No strong review items yet.
              </div>
            )}
          </StageSection>

          <StageSection className="mt-6 flex flex-wrap gap-3">
            <GhostButton active icon={ArrowRight} onClick={onNext}>
              Continue
            </GhostButton>
            <GhostButton icon={ExternalLink} onClick={onToggleKnowledge}>
              Hide review
            </GhostButton>
          </StageSection>
        </div>

        <div className="grid content-start gap-8">
          <MetricCard
            label="Average confidence"
            value={`${avgConfidence}%`}
            detail="Use confidence as a hint, not a rule."
          />
          <MetricCard
            label="Goal"
            value="Clean"
            detail="Keep only durable facts that should shape runtime."
          />
        </div>
      </div>
    </SetupStudioStageShell>
  );
}
