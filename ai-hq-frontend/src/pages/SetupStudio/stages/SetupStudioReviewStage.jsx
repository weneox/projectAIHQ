import React from "react";

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

function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function ReviewSection({ title, body = "", children }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-34px_rgba(15,23,42,.22)] sm:p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
          {title}
        </h3>
        {body ? (
          <p className="mt-1 text-sm leading-6 text-slate-500">{body}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function DraftSummary({ currentTitle, currentDescription, sourceLabel }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 sm:p-6">
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
    </div>
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
    <div className="divide-y divide-slate-100 overflow-hidden rounded-[20px] border border-slate-100 bg-slate-50/70">
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
        <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-4 text-sm leading-6 text-slate-600">
          Suggested service:{" "}
          <span className="font-medium text-slate-900">{serviceSuggestionTitle}</span>
        </div>
      ) : null}

      {visibleServices.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleServices.map((title, index) => (
            <div
              key={`${title}-${index}`}
              className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
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
      <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
        <div className="text-sm leading-6 text-slate-600">
          {visibleItems.length} note{visibleItems.length === 1 ? "" : "s"} found for this draft.
        </div>
        {typeof onToggleKnowledge === "function" ? (
          <div className="mt-3">
            <SecondaryButton type="button" onClick={onToggleKnowledge} className="h-10 px-4">
              Show notes
            </SecondaryButton>
          </div>
        ) : null}
      </div>
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
          <SecondaryButton type="button" onClick={onToggleKnowledge} className="h-10 px-4">
            Hide notes
          </SecondaryButton>
        </div>
      ) : null}
    </div>
  );
}

function WarningNotice({ warnings = [] }) {
  const visibleWarnings = arr(warnings).map((item) => humanize(item)).filter(Boolean);
  if (!visibleWarnings.length) return null;

  return (
    <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
      <div className="font-semibold">Review this carefully</div>
      <div className="mt-2">
        Some parts of the draft may be incomplete. Check the details below before you continue.
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {visibleWarnings.slice(0, 4).map((warning, index) => (
          <TinyChip key={`${warning}-${index}`} tone="warn">
            {warning}
          </TinyChip>
        ))}
      </div>
    </div>
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
              <SecondaryButton type="button" onClick={onBack}>
                Back
              </SecondaryButton>
            ) : null}
            <PrimaryButton type="button" onClick={onNext}>
              Continue
            </PrimaryButton>
          </div>
        </div>
      </div>
    </SetupStudioStageShell>
  );
}
