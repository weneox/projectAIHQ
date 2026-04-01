import React from "react";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function pickKnowledgeTitle(item = {}) {
  return (
    s(item.title) ||
    s(item.name) ||
    s(item.label) ||
    s(item.question) ||
    s(item.heading) ||
    "Knowledge item"
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

function pickKnowledgeCategory(item = {}) {
  return s(item.category) || s(item.kind) || s(item.type) || "knowledge";
}

function pickKnowledgeId(item = {}) {
  return s(item.id) || s(item.candidateId) || s(item.knowledgeId);
}

function pickServiceTitle(item = {}) {
  return s(item.title) || s(item.name) || s(item.label) || "Service";
}

function pickSourceLabel(source = {}) {
  return (
    s(source.label) ||
    s(source.title) ||
    s(source.sourceLabel) ||
    s(source.sourceType) ||
    s(source.type)
  );
}

function pickEventLabel(event = {}) {
  return s(event.title) || s(event.label) || s(event.type) || s(event.status);
}

function Section({ title, right, children }) {
  return (
    <section className="rounded-[28px] border border-[rgba(15,23,42,.07)] bg-white/80 p-5 shadow-[0_16px_40px_-28px_rgba(15,23,42,.16)] backdrop-blur-[10px] sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold tracking-[-0.03em] text-slate-950">
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function CompactPill({ children, tone = "default" }) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}

function ProfileRows({ rows = [] }) {
  if (!rows.length) {
    return (
      <div className="rounded-[20px] border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
        No profile fields yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const item = obj(row);
        const label =
          s(item.label) || s(item.title) || s(item.key) || `Field ${index + 1}`;
        const value =
          s(item.value) || s(item.displayValue) || s(item.description);

        if (!value) return null;

        return (
          <div
            key={`${label}-${index}`}
            className="grid gap-1 rounded-[20px] border border-slate-100 bg-slate-50/70 px-4 py-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4"
          >
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {label}
            </div>
            <div className="min-w-0 break-words text-[14px] leading-6 text-slate-700">
              {value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KnowledgeList({
  items = [],
  actingKnowledgeId = "",
  onApproveKnowledge,
  onRejectKnowledge,
}) {
  if (!items.length) {
    return (
      <div className="rounded-[20px] border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
        No knowledge suggestions.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((rawItem, index) => {
        const item = obj(rawItem);
        const id = pickKnowledgeId(item) || `knowledge-${index}`;
        const title = pickKnowledgeTitle(item);
        const body = pickKnowledgeBody(item);
        const category = pickKnowledgeCategory(item);
        const busy = s(actingKnowledgeId) && s(actingKnowledgeId) === s(id);

        return (
          <div
            key={id}
            className="rounded-[22px] border border-slate-100 bg-slate-50/70 p-4"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <CompactPill>{category}</CompactPill>
            </div>

            <div className="text-[15px] font-semibold tracking-[-0.025em] text-slate-900">
              {title}
            </div>

            {body ? (
              <p className="mt-2 text-[14px] leading-6 text-slate-600">
                {body}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onApproveKnowledge?.(item)}
                className="inline-flex h-10 items-center justify-center rounded-full bg-slate-950 px-4 text-[13px] font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {busy ? "Working..." : "Approve"}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => onRejectKnowledge?.(item)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ServicesBlock({
  serviceSuggestionTitle,
  services,
  savingServiceSuggestion,
  onCreateSuggestedService,
}) {
  const serviceList = arr(services);

  return (
    <div className="space-y-4">
      {serviceSuggestionTitle ? (
        <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Suggested
          </div>
          <div className="mt-2 text-[15px] font-semibold tracking-[-0.025em] text-slate-900">
            {serviceSuggestionTitle}
          </div>
          <div className="mt-4">
            <button
              type="button"
              disabled={savingServiceSuggestion}
              onClick={() => onCreateSuggestedService?.()}
              className="inline-flex h-10 items-center justify-center rounded-full bg-slate-950 px-4 text-[13px] font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {savingServiceSuggestion ? "Saving..." : "Add service"}
            </button>
          </div>
        </div>
      ) : null}

      {serviceList.length ? (
        <div className="flex flex-wrap gap-2">
          {serviceList.map((rawService, index) => {
            const service = obj(rawService);
            const title = pickServiceTitle(service);
            return <CompactPill key={`${title}-${index}`}>{title}</CompactPill>;
          })}
        </div>
      ) : !serviceSuggestionTitle ? (
        <div className="rounded-[20px] border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
          No services yet.
        </div>
      ) : null}
    </div>
  );
}

export default function SetupStudioReviewStage({
  meta,
  currentTitle,
  currentDescription,
  discoveryProfileRows,
  discoveryWarnings,
  honestySummary,
  sourceLabel,
  reviewSources,
  reviewEvents,
  knowledgePreview,
  knowledgeItems,
  actingKnowledgeId,
  showKnowledge,
  serviceSuggestionTitle,
  services,
  savingServiceSuggestion,
  onApproveKnowledge,
  onRejectKnowledge,
  onCreateSuggestedService,
  onToggleKnowledge,
  onToggleRefine,
  onNext,
}) {
  const warnings = arr(discoveryWarnings);
  const profileRows = arr(discoveryProfileRows);
  const sources = arr(reviewSources);
  const events = arr(reviewEvents);
  const knowledge = arr(knowledgeItems);
  const serviceList = arr(services);

  const title = s(currentTitle) || "Business draft";
  const description =
    s(currentDescription) ||
    s(knowledgePreview) ||
    "Review the draft, keep what is useful, then continue.";

  const continueLabel = meta?.setupCompleted ? "Open ready state" : "Continue";

  return (
    <section className="space-y-6">
      <div className="rounded-[32px] border border-[rgba(15,23,42,.07)] bg-[linear-gradient(180deg,rgba(255,255,255,.94)_0%,rgba(248,250,252,.88)_100%)] p-6 shadow-[0_20px_50px_-32px_rgba(15,23,42,.18)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CompactPill>{sourceLabel ? sourceLabel : "Review"}</CompactPill>
              {warnings.length ? (
                <CompactPill tone="warning">
                  {warnings.length} warning{warnings.length > 1 ? "s" : ""}
                </CompactPill>
              ) : (
                <CompactPill tone="success">Draft ready</CompactPill>
              )}
            </div>

            <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.045em] text-slate-950 sm:text-[34px]">
              {title}
            </h1>

            <p className="mt-3 max-w-[760px] text-[15px] leading-7 text-slate-600">
              {description}
            </p>

            {s(honestySummary) ? (
              <p className="mt-3 max-w-[760px] text-[13px] leading-6 text-slate-500">
                {honestySummary}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onToggleRefine}
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-[14px] font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              Edit draft
            </button>

            <button
              type="button"
              onClick={onNext}
              className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-[14px] font-medium text-white transition hover:bg-slate-800"
            >
              {continueLabel}
            </button>
          </div>
        </div>
      </div>

      {warnings.length ? (
        <Section title="Warnings">
          <div className="flex flex-wrap gap-2">
            {warnings.map((warning, index) => (
              <CompactPill key={`${warning}-${index}`} tone="warning">
                {s(warning)}
              </CompactPill>
            ))}
          </div>
        </Section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,.92fr)]">
        <div className="space-y-6">
          <Section title="Business profile">
            <ProfileRows rows={profileRows} />
          </Section>

          <Section
            title="Knowledge"
            right={
              knowledge.length ? (
                <button
                  type="button"
                  onClick={onToggleKnowledge}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                >
                  {showKnowledge ? "Hide details" : "Show details"}
                </button>
              ) : null
            }
          >
            {showKnowledge ? (
              <KnowledgeList
                items={knowledge}
                actingKnowledgeId={actingKnowledgeId}
                onApproveKnowledge={onApproveKnowledge}
                onRejectKnowledge={onRejectKnowledge}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                <CompactPill>{knowledge.length} items</CompactPill>
                {s(knowledgePreview) ? (
                  <span className="text-sm text-slate-500">
                    {knowledgePreview}
                  </span>
                ) : null}
              </div>
            )}
          </Section>

          <Section title="Services">
            <ServicesBlock
              serviceSuggestionTitle={serviceSuggestionTitle}
              services={serviceList}
              savingServiceSuggestion={savingServiceSuggestion}
              onCreateSuggestedService={onCreateSuggestedService}
            />
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Sources">
            {sources.length ? (
              <div className="flex flex-wrap gap-2">
                {sources.map((rawSource, index) => {
                  const label = pickSourceLabel(rawSource);
                  if (!label) return null;
                  return <CompactPill key={`${label}-${index}`}>{label}</CompactPill>;
                })}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No source details yet.</div>
            )}
          </Section>

          <Section title="Activity">
            {events.length ? (
              <div className="space-y-2">
                {events.map((rawEvent, index) => {
                  const label = pickEventLabel(rawEvent);
                  if (!label) return null;

                  return (
                    <div
                      key={`${label}-${index}`}
                      className="rounded-[18px] border border-slate-100 bg-slate-50/70 px-4 py-3 text-[13px] text-slate-600"
                    >
                      {label}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No activity yet.</div>
            )}
          </Section>
        </div>
      </div>
    </section>
  );
}