import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import React from "react";

import { StageSection, TinyChip, TinyLabel } from "../SetupStudioUi.jsx";
import SetupStudioEvidenceNotice from "../SetupStudioEvidenceNotice.jsx";
import FieldReviewCard from "./FieldReviewCard.jsx";
import FinalizeFooter from "./FinalizeFooter.jsx";
import { humanizeStudioIssue } from "../../logic/helpers.js";
import { deriveCanonicalReviewProjection } from "../../state/reviewState.js";
import { getControlPlanePermissions } from "../../../../lib/controlPlanePermissions.js";
import {
  describeSetupStudioFieldHonesty,
  summarizeSetupStudioHonesty,
} from "../../logic/reviewHonesty.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function countLogicalLines(value = "") {
  return s(value)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function textFromValue(value) {
  if (Array.isArray(value)) return value.map((item) => s(item)).filter(Boolean).join(", ");
  if (value && typeof value === "object") return s(value.text || value.value || value.label);
  return s(value);
}

function normalizeEvidenceEntries(value, fallbackSources = []) {
  const item = obj(value);
  const authorityRank = Number(item.authorityRank || item.authority_rank);
  const sources = arr(
    item.sources ||
      item.sourceList ||
      item.contributors ||
      item.evidence ||
      item.entries
  );

  const direct = [
    {
      label: s(
        item.label ||
          item.sourceLabel ||
          item.source_label ||
          item.displayName ||
          item.title ||
          item.sourceType
      ),
      value: textFromValue(
        item.observedValue ||
          item.observed_value ||
          item.value ||
          item.summary ||
          item.display
      ),
      note: s(
        item.note ||
          item.reason ||
          item.role ||
          (Number.isFinite(authorityRank) && authorityRank > 0
            ? `Authority rank ${authorityRank}`
            : "")
      ),
      url: s(item.url || item.sourceUrl || item.source_url),
    },
  ].filter((entry) => entry.label || entry.value || entry.note || entry.url);

  const normalizedSources = sources
    .map((source) => {
      const x = obj(source);
      return {
        label: s(
          x.label ||
            x.sourceLabel ||
            x.source_label ||
            x.displayName ||
            x.title ||
            x.sourceType
        ),
        value: textFromValue(
          x.observedValue ||
            x.observed_value ||
            x.value ||
            x.summary ||
            x.display
        ),
        note: s(x.note || x.reason || x.role),
        url: s(x.url || x.sourceUrl || x.source_url),
      };
    })
    .filter((entry) => entry.label || entry.value || entry.note || entry.url);

  const fallback = arr(fallbackSources)
    .map((source) => ({
      label: s(source?.label || source?.sourceType || source?.url),
      value: "",
      note: s(source?.role),
      url: s(source?.url),
    }))
    .filter((entry) => entry.label || entry.url);

  const deduped = [];
  const seen = new Set();

  [...direct, ...normalizedSources, ...fallback].forEach((entry) => {
    const key = [entry.label, entry.value, entry.note, entry.url].join("|");
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(entry);
  });

  return deduped;
}

function buildFieldCards({
  businessForm = {},
  manualSections = {},
  discoveryProfileRows = [],
  reviewProjection = {},
  reviewSources = [],
}) {
  const form = obj(businessForm);
  const sections = obj(manualSections);
  const draft = obj(reviewProjection);
  const overview = obj(draft.overview);
  const fieldProvenance = obj(draft.fieldProvenance);
  const fieldConfidence = obj(draft.fieldConfidence);
  const rowMap = new Map(
    arr(discoveryProfileRows).map((row) => {
      const item = Array.isArray(row)
        ? { label: s(row[0]), value: s(row[1]), fieldKey: "", provenance: "" }
        : obj(row);
      return [s(item.fieldKey), item];
    })
  );

  const sectionServices = arr(draft?.sections?.services)
    .map((item) => `${s(item.title)} | ${s(item.valueText || item.description)}`.trim())
    .filter(Boolean)
    .join("\n");
  const sectionFaqs = arr(draft?.sections?.faqs)
    .map((item) => `${s(item.title)} | ${s(item.valueText)}`.trim())
    .filter(Boolean)
    .join("\n");
  const sectionPolicies = arr(draft?.sections?.policies)
    .map((item) => `${s(item.title)} | ${s(item.valueText)}`.trim())
    .filter(Boolean)
    .join("\n");

  const defs = [
    {
      key: "companyName",
      label: "Company name",
      value: form.companyName,
      observedValue: rowMap.get("companyName")?.value || overview.companyName || overview.name,
      placeholder: "Company name",
    },
    {
      key: "websiteUrl",
      label: "Website URL",
      value: form.websiteUrl,
      observedValue: rowMap.get("websiteUrl")?.value || overview.websiteUrl,
      placeholder: "Website URL",
    },
    {
      key: "primaryPhone",
      label: "Primary phone",
      value: form.primaryPhone,
      observedValue: rowMap.get("primaryPhone")?.value || overview.primaryPhone,
      placeholder: "Primary phone",
    },
    {
      key: "primaryEmail",
      label: "Primary email",
      value: form.primaryEmail,
      observedValue: rowMap.get("primaryEmail")?.value || overview.primaryEmail,
      placeholder: "Primary email",
    },
    {
      key: "primaryAddress",
      label: "Primary address",
      value: form.primaryAddress,
      observedValue: rowMap.get("primaryAddress")?.value || overview.primaryAddress,
      placeholder: "Primary address",
      multiline: true,
    },
    {
      key: "timezone",
      label: "Timezone",
      value: form.timezone,
      observedValue: rowMap.get("timezone")?.value || overview.timezone,
      placeholder: "Timezone",
    },
    {
      key: "language",
      label: "Primary language",
      value: form.language,
      observedValue: rowMap.get("language")?.value || overview.language || overview.mainLanguage,
      placeholder: "Primary language",
    },
    {
      key: "description",
      label: "Short business summary",
      value: form.description,
      observedValue:
        rowMap.get("description")?.value ||
        draft.quickSummary ||
        overview.summaryShort ||
        overview.description,
      placeholder: "Short business summary",
      multiline: true,
    },
    {
      key: "services",
      label: `Services${countLogicalLines(sections.servicesText) ? ` (${countLogicalLines(sections.servicesText)})` : ""}`,
      value: sections.servicesText,
      observedValue: rowMap.get("services")?.value || sectionServices,
      placeholder: "Services",
      multiline: true,
      sectionKey: "servicesText",
    },
    {
      key: "faqs",
      label: `Frequently asked questions${countLogicalLines(sections.faqsText) ? ` (${countLogicalLines(sections.faqsText)})` : ""}`,
      value: sections.faqsText,
      observedValue: sectionFaqs,
      placeholder: "Frequently asked questions",
      multiline: true,
      sectionKey: "faqsText",
    },
    {
      key: "policies",
      label: `Policies${countLogicalLines(sections.policiesText) ? ` (${countLogicalLines(sections.policiesText)})` : ""}`,
      value: sections.policiesText,
      observedValue: sectionPolicies,
      placeholder: "Policies",
      multiline: true,
      sectionKey: "policiesText",
    },
  ];

  return defs.map((field) => {
    const row = rowMap.get(field.key) || {};
    const provenance = fieldProvenance[field.key] || {};
    const evidence = normalizeEvidenceEntries(provenance, reviewSources);
    const honesty = describeSetupStudioFieldHonesty({
      fieldKey: field.key,
      fieldConfidence,
      observedValue: s(field.observedValue || row.value),
      evidence,
      warnings: [...arr(draft.reviewFlags), ...arr(draft.warnings)],
    });

    return {
      ...field,
      observedValue: s(field.observedValue || row.value),
      needsAttention: !s(field.value),
      honesty,
      evidence:
        evidence.length > 0
          ? evidence
          : normalizeEvidenceEntries(
              { label: s(row.label), value: s(row.value), note: s(row.provenance) },
              reviewSources
            ),
    };
  });
}

export default function ReviewWorkspace({
  savingBusiness,
  businessForm,
  discoveryProfileRows,
  manualSections,
  onSetBusinessField,
  onSetManualSection,
  onSaveBusiness,
  onClose,
  currentReview,
  reviewSources = [],
  reviewSyncState = {},
}) {
  const draft = deriveCanonicalReviewProjection(currentReview);
  const overview = obj(draft.overview);
  const quickSummary = s(
    draft.quickSummary ||
      overview.summaryShort ||
      overview.companySummaryShort ||
      overview.description
  );

  const fieldCards = buildFieldCards({
    businessForm,
    manualSections,
    discoveryProfileRows,
    reviewProjection: draft,
    reviewSources,
  });

  const issues = [
    ...arr(draft.reviewFlags).map((item) => humanizeStudioIssue(item)),
    ...arr(draft.warnings).map((item) => humanizeStudioIssue(item)),
  ]
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 8);

  const attentionCount = fieldCards.filter((field) => field.needsAttention).length;
  const honestySummary = summarizeSetupStudioHonesty({
    reviewProjection: draft,
    reviewSources,
  });
  const permissionState = getControlPlanePermissions({
    viewerRole: currentReview?.viewerRole,
    permissions: currentReview?.permissions,
  });
  const finalizePermission = permissionState.setupReviewFinalize;
  const blockingMessage = reviewSyncState?.blocksFinalize
    ? s(reviewSyncState?.message || "Reload the review draft before finalizing.")
    : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.985 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="relative my-2 flex max-h-[calc(100vh-1rem)] w-full max-w-[1180px] flex-col overflow-hidden rounded-[34px] bg-[linear-gradient(180deg,rgba(255,255,255,.95)_0%,rgba(246,247,249,.92)_100%)] shadow-[0_34px_90px_-40px_rgba(15,23,42,.42)] sm:my-4 sm:max-h-[calc(100vh-2rem)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(780px_circle_at_top_left,rgba(255,255,255,.94),transparent_42%),radial-gradient(620px_circle_at_bottom_right,rgba(226,232,240,.22),transparent_34%)]" />

      <div className="relative z-10 flex items-center justify-between gap-4 border-b border-slate-200/80 px-5 py-4 backdrop-blur-[14px] sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TinyLabel>Review workspace</TinyLabel>
            {attentionCount ? (
              <TinyChip tone="warn">
                {attentionCount} field{attentionCount === 1 ? "" : "s"} still need review
              </TinyChip>
            ) : (
              <TinyChip tone="success">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Ready to finalize
              </TinyChip>
            )}
          </div>
          <div className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-slate-950">
            Confirm the proposed truth field by field
          </div>
          {quickSummary ? (
            <div className="mt-1 max-w-[820px] text-sm leading-6 text-slate-500">
              {quickSummary}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={savingBusiness}
          aria-label="Close"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/86 text-slate-600 transition hover:bg-white hover:text-slate-900 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1040px] min-w-0 flex-col px-5 py-5 sm:px-6">
          {issues.length ? (
            <StageSection border={false}>
              <div className="flex flex-wrap gap-2">
                {issues.map((item, index) => (
                  <TinyChip key={`${item}-${index}`} tone="warn">
                    <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                    {item}
                  </TinyChip>
                ))}
              </div>
            </StageSection>
          ) : null}

          <StageSection className={issues.length ? "mt-6" : ""} border={!issues.length}>
            <SetupStudioEvidenceNotice
              tone={honestySummary.tone}
              title={honestySummary.title}
              body={honestySummary.message}
              chips={honestySummary.chips}
            />
          </StageSection>

          <StageSection className="mt-6">
            <div className="grid gap-4">
              {fieldCards.map((field) => (
                <FieldReviewCard
                  key={field.key}
                  label={field.label}
                  value={field.value}
                  observedValue={field.observedValue}
                  placeholder={field.placeholder}
                  multiline={field.multiline}
                  needsAttention={field.needsAttention}
                  evidence={field.evidence}
                  honesty={field.honesty}
                  onChange={(nextValue) => {
                    if (field.sectionKey) {
                      onSetManualSection?.(field.sectionKey, nextValue);
                      return;
                    }

                    onSetBusinessField?.(field.key, nextValue);
                  }}
                />
              ))}
            </div>
          </StageSection>
        </div>
      </div>

      <FinalizeFooter
        savingBusiness={savingBusiness}
        blockingMessage={blockingMessage}
        permissionMessage={finalizePermission.allowed ? "" : finalizePermission.message}
        honestyMessage={honestySummary.finalizeMessage}
        onClose={onClose}
        onSubmit={onSaveBusiness}
      />
    </motion.div>
  );
}
