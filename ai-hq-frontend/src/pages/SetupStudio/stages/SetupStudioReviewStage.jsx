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

function humanize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickKnowledgeTitle(item = {}) {
  return (
    s(item.title) ||
    s(item.name) ||
    s(item.label) ||
    s(item.question) ||
    s(item.heading) ||
    "Note"
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
  return s(item.category) || s(item.kind) || s(item.type) || "note";
}

function pickKnowledgeId(item = {}) {
  return s(item.id) || s(item.candidateId) || s(item.knowledgeId);
}

function pickServiceTitle(item = {}) {
  return s(item.title) || s(item.name) || s(item.label) || "Service";
}

function pickRowLabel(row = {}, index = 0) {
  return (
    s(row.label) ||
    s(row.title) ||
    s(row.key) ||
    s(row.name) ||
    `Field ${index + 1}`
  );
}

function pickRowValue(row = {}) {
  return s(row.value) || s(row.displayValue) || s(row.description);
}

function Section({ title, action, children }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-[14px] font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-[14px] font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
      {text}
    </div>
  );
}

function ReviewNotice({ honestySummary, warnings }) {
  const warningList = arr(warnings).map(humanize).filter(Boolean);
  const summary = s(honestySummary);

  if (!summary && !warningList.length) return null;

  return (
    <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 sm:px-5">
      <div className="text-[14px] font-semibold text-amber-900">
        Needs a quick check
      </div>

      <p className="mt-2 text-[14px] leading-6 text-amber-800">
        {summary ||
          "Some parts of this draft may be incomplete. Check the details below before you launch."}
      </p>

      {warningList.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {warningList.slice(0, 3).map((warning, index) => (
            <span
              key={`${warning}-${index}`}
              className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[12px] font-medium text-amber-700"
            >
              {warning}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProfileRows({ rows = [] }) {
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
    return <EmptyState text="No business details yet." />;
  }

  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-[22px] border border-slate-100 bg-slate-50/60">
      {visibleRows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className="grid gap-1 px-4 py-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4"
        >
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {row.label}
          </div>
          <div className="min-w-0 break-words text-[14px] leading-6 text-slate-700">
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function KnowledgeList({
  items = [],
  actingKnowledgeId = "",
  onApproveKnowledge,
  onRejectKnowledge,
}) {
  const visibleItems = arr(items);

  if (!visibleItems.length) {
    return <EmptyState text="No important notes yet." />;
  }

  return (
    <div className="space-y-3">
      {visibleItems.map((rawItem, index) => {
        const item = obj(rawItem);
        const id = pickKnowledgeId(item) || `knowledge-${index}`;
        const title = pickKnowledgeTitle(item);
        const body = pickKnowledgeBody(item);
        const category = humanize(pickKnowledgeCategory(item));
        const busy = s(actingKnowledgeId) && s(actingKnowledgeId) === s(id);

        return (
          <div
            key={id}
            className="rounded-[22px] border border-slate-100 bg-slate-50/60 p-4"
          >
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {category}
            </div>

            <div className="mt-2 text-[15px] font-semibold tracking-[-0.025em] text-slate-900">
              {title}
            </div>

            {body ? (
              <p className="mt-2 text-[14px] leading-6 text-slate-600">
                {body}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton
                type="button"
                disabled={busy}
                onClick={() => onApproveKnowledge?.(item)}
              >
                {busy ? "Saving..." : "Keep"}
              </PrimaryButton>

              <SecondaryButton
                type="button"
                disabled={busy}
                onClick={() => onRejectKnowledge?.(item)}
              >
                Remove
              </SecondaryButton>
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
  const serviceList = arr(services)
    .map((service) => pickServiceTitle(obj(service)))
    .filter(Boolean);

  return (
    <div className="space-y-4">
      {s(serviceSuggestionTitle) ? (
        <div className="rounded-[22px] border border-slate-100 bg-slate-50/60 p-4">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Suggested service
          </div>

          <div className="mt-2 text-[15px] font-semibold tracking-[-0.025em] text-slate-900">
            {serviceSuggestionTitle}
          </div>

          <div className="mt-4">
            <PrimaryButton
              type="button"
              disabled={savingServiceSuggestion}
              onClick={() => onCreateSuggestedService?.()}
            >
              {savingServiceSuggestion ? "Saving..." : "Add service"}
            </PrimaryButton>
          </div>
        </div>
      ) : null}

      {serviceList.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {serviceList.map((title, index) => (
            <div
              key={`${title}-${index}`}
              className="rounded-[20px] border border-slate-100 bg-white px-4 py-3 text-[14px] font-medium text-slate-700"
            >
              {title}
            </div>
          ))}
        </div>
      ) : !s(serviceSuggestionTitle) ? (
        <EmptyState text="No services yet." />
      ) : null}
    </div>
  );
}

function FooterMeta({ sourceLabel, reviewSources, reviewEvents }) {
  const sourceCount = arr(reviewSources).length;
  const eventCount = arr(reviewEvents).length;
  const label = s(sourceLabel);

  if (!label && !sourceCount && !eventCount) return null;

  return (
    <div className="px-1 text-[13px] text-slate-500">
      {label ? <span>{label}</span> : null}
      {label && (sourceCount || eventCount) ? <span> · </span> : null}
      {sourceCount ? <span>{sourceCount} source{sourceCount > 1 ? "s" : ""}</span> : null}
      {sourceCount && eventCount ? <span> · </span> : null}
      {eventCount ? <span>{eventCount} update{eventCount > 1 ? "s" : ""}</span> : null}
    </div>
  );
}

export default function SetupStudioReviewStage({
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
  onNext,
  onOpenTruth,
  onOpenWorkspace,
}) {
  const profileRows = arr(discoveryProfileRows);
  const knowledge = arr(knowledgeItems);

  const title = s(currentTitle) || "Your first business draft";
  const description =
    s(currentDescription) ||
    s(knowledgePreview) ||
    "Review the draft, keep what looks right, and open the workspace when you are ready.";

  const primaryAction = onOpenWorkspace || onNext;
  const canToggleKnowledge = knowledge.length > 0;

  return (
    <section className="mx-auto max-w-[980px] space-y-6">
      <header className="space-y-4 px-1 pt-2">
        <h1 className="text-[32px] font-semibold tracking-[-0.05em] text-slate-950 sm:text-[42px]">
          {title}
        </h1>

        <p className="max-w-[760px] text-[16px] leading-7 text-slate-600">
          {description}
        </p>

        <div className="flex flex-wrap gap-3 pt-1">
          {onOpenTruth ? (
            <SecondaryButton type="button" onClick={onOpenTruth}>
              Open truth view
            </SecondaryButton>
          ) : null}

          {primaryAction ? (
            <PrimaryButton type="button" onClick={primaryAction}>
              Open workspace
            </PrimaryButton>
          ) : null}
        </div>
      </header>

      <ReviewNotice
        honestySummary={honestySummary}
        warnings={discoveryWarnings}
      />

      <Section title="Business details">
        <ProfileRows rows={profileRows} />
      </Section>

      <Section title="Services">
        <ServicesBlock
          serviceSuggestionTitle={serviceSuggestionTitle}
          services={services}
          savingServiceSuggestion={savingServiceSuggestion}
          onCreateSuggestedService={onCreateSuggestedService}
        />
      </Section>

      <Section
        title="Important notes"
        action={
          canToggleKnowledge ? (
            <SecondaryButton
              type="button"
              onClick={onToggleKnowledge}
              className="h-9 px-4 text-[13px]"
            >
              {showKnowledge ? "Hide notes" : "Review notes"}
            </SecondaryButton>
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
        ) : knowledge.length ? (
          <div className="space-y-3">
            <div className="text-[14px] leading-6 text-slate-600">
              {s(knowledgePreview) ||
                `${knowledge.length} note${knowledge.length > 1 ? "s" : ""} found for review.`}
            </div>

            <div className="text-[13px] text-slate-500">
              Open the notes only if you want to keep or remove individual items.
            </div>
          </div>
        ) : (
          <EmptyState text="No important notes yet." />
        )}
      </Section>

      <FooterMeta
        sourceLabel={sourceLabel}
        reviewSources={reviewSources}
        reviewEvents={reviewEvents}
      />
    </section>
  );
}