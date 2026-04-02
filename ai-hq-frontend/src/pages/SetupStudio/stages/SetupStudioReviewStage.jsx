import React from "react";

import Button from "../../../components/ui/Button.jsx";
import { InlineCallout, PageSection, SurfaceBlock } from "../../../components/ui/PageSection.jsx";
import SetupStudioStageShell from "../components/SetupStudioStageShell.jsx";
import { TinyChip, TinyLabel } from "../components/SetupStudioUi.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function pickRowLabel(row = {}, index = 0) {
  return (
    s(row.label) ||
    s(row.title) ||
    s(row.key) ||
    s(row.fieldKey) ||
    `Field ${index + 1}`
  );
}

function pickRowValue(row = {}) {
  return s(row.value) || s(row.displayValue) || s(row.description);
}

function pickKnowledgeTitle(item = {}) {
  return (
    s(item.title) ||
    s(item.name) ||
    s(item.label) ||
    s(item.question) ||
    "Business note"
  );
}

function pickKnowledgeBody(item = {}) {
  return (
    s(item.description) ||
    s(item.answer) ||
    s(item.summary) ||
    s(item.content) ||
    s(item.text) ||
    s(item.value)
  );
}

function humanize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ReviewSection({ title, body = "", children }) {
  return (
    <PageSection>
      <div className="mb-4">
        <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
          {title}
        </h3>
        {body ? (
          <p className="mt-1 text-sm leading-6 text-slate-500">{body}</p>
        ) : null}
      </div>
      {children}
    </PageSection>
  );
}

function DraftSummary({ currentTitle, currentDescription, sourceLabel }) {
  return (
    <SurfaceBlock className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <TinyLabel>Step 3 of 4</TinyLabel>
        {s(sourceLabel) ? <TinyChip>{sourceLabel}</TinyChip> : null}
      </div>

      <div className="mt-4 text-[26px] font-semibold tracking-[-0.045em] text-slate-950 sm:text-[32px]">
        {s(currentTitle) || "Your business draft is ready"}
      </div>

      <p className="mt-2 max-w-[760px] text-sm leading-7 text-slate-600">
        {s(currentDescription) ||
          "This is the first draft based on the information you provided. Review it once, then continue to the final confirmation step."}
      </p>
    </SurfaceBlock>
  );
}

function BusinessDetails({ rows = [] }) {
  const visibleRows = arr(rows)
    .map((row, index) => {
      const item = obj(row);
      const label = pickRowLabel(item, index);
      const value = pickRowValue(item);
      if (!value) return null;
      return { label, value };
    })
    .filter(Boolean);

  if (!visibleRows.length) {
    return (
      <div className="rounded-[20px] border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
        The draft is still sparse. Continue anyway and fill in the missing details on the next step.
      </div>
    );
  }

  return (
      <div className="divide-y divide-slate-200/70 overflow-hidden">
      {visibleRows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className="grid gap-1 px-4 py-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {row.label}
          </div>
          <div className="min-w-0 break-words text-sm leading-6 text-slate-700">
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function ServicesList({ services = [], serviceSuggestionTitle = "" }) {
  const visibleServices = arr(services)
    .map((item) => s(item?.title || item?.name || item?.label))
    .filter(Boolean);

  if (!visibleServices.length && !s(serviceSuggestionTitle)) {
    return (
        <div className="rounded-[20px] border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
          No services were added to the draft yet.
        </div>
    );
  }

  return (
    <div className="space-y-3">
      {s(serviceSuggestionTitle) ? (
        <InlineCallout
          title="Suggested service"
          body={serviceSuggestionTitle}
          className="py-2"
        />
      ) : null}

      {visibleServices.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleServices.map((title, index) => (
            <div
              key={`${title}-${index}`}
              className="border-t border-slate-200/80 px-1 py-3 text-sm text-slate-700 first:border-t-0 first:pt-0"
            >
              {title}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NotesList({ knowledgeItems = [], showKnowledge, onToggleKnowledge }) {
  const visibleItems = arr(knowledgeItems)
    .map((item) => ({
      title: pickKnowledgeTitle(obj(item)),
      body: pickKnowledgeBody(obj(item)),
    }))
    .filter((item) => item.title || item.body);

  if (!visibleItems.length) {
    return (
      <div className="rounded-[20px] border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
        No extra notes were added to this draft.
      </div>
    );
  }

  if (!showKnowledge) {
    return (
      <InlineCallout
        title={`${visibleItems.length} note${visibleItems.length === 1 ? "" : "s"} found for this draft`}
        body="Open these only if you want more detail before continuing."
        action={
          typeof onToggleKnowledge === "function" ? (
            <Button type="button" variant="surface" size="pill" onClick={onToggleKnowledge}>
              Show notes
            </Button>
          ) : null
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {visibleItems.map((item, index) => (
        <div
          key={`${item.title}-${index}`}
          className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4"
        >
          <div className="text-sm font-semibold text-slate-900">{item.title}</div>
          {item.body ? (
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
          ) : null}
        </div>
      ))}
      {typeof onToggleKnowledge === "function" ? (
        <div>
          <Button type="button" variant="surface" size="pill" onClick={onToggleKnowledge}>
            Hide notes
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function WarningNotice({ warnings = [] }) {
  const visibleWarnings = arr(warnings).map((item) => humanize(item)).filter(Boolean);
  if (!visibleWarnings.length) return null;

  return (
    <InlineCallout
      title="Review this carefully"
      body="Some parts of the draft may be incomplete. Check the details below before you continue."
      tone="warn"
      action={
        <div className="flex flex-wrap gap-2">
          {visibleWarnings.slice(0, 4).map((warning, index) => (
            <TinyChip key={`${warning}-${index}`} tone="warn">
              {warning}
            </TinyChip>
          ))}
        </div>
      }
    />
  );
}

export default function SetupStudioReviewStage({
  currentTitle,
  currentDescription,
  discoveryProfileRows,
  discoveryWarnings,
  sourceLabel,
  knowledgeItems,
  showKnowledge,
  serviceSuggestionTitle,
  services,
  onToggleKnowledge,
  onNext,
  onBack,
}) {
  return (
    <SetupStudioStageShell
      eyebrow="review"
      title="Review your draft"
      body="Check the draft once before you confirm it. You can make final edits on the next step."
    >
      <div className="mx-auto max-w-[1040px] space-y-6">
        <DraftSummary
          currentTitle={currentTitle}
          currentDescription={currentDescription}
          sourceLabel={sourceLabel}
        />

        <WarningNotice warnings={discoveryWarnings} />

        <ReviewSection title="Business details" body="This is the information we could prepare from your website or description.">
          <BusinessDetails rows={discoveryProfileRows} />
        </ReviewSection>

        <ReviewSection title="Services" body="Services can stay simple here. You can edit them later if needed.">
          <ServicesList
            services={services}
            serviceSuggestionTitle={serviceSuggestionTitle}
          />
        </ReviewSection>

        <ReviewSection title="Extra notes" body="Only open these if you want to inspect more detail before continuing.">
          <NotesList
            knowledgeItems={knowledgeItems}
            showKnowledge={showKnowledge}
            onToggleKnowledge={onToggleKnowledge}
          />
        </ReviewSection>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm leading-6 text-slate-500">
            You can still edit the final details before anything is confirmed.
          </div>

          <div className="flex flex-wrap gap-3">
            {typeof onBack === "function" ? (
              <Button type="button" variant="surface" size="hero" onClick={onBack}>
                Back
              </Button>
            ) : null}
            <Button type="button" variant="brand" size="hero" onClick={onNext}>
              Continue
            </Button>
          </div>
        </div>
      </div>
    </SetupStudioStageShell>
  );
}
