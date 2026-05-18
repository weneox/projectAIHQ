import { normalizeSetupReviewRoom } from "../../lib/setupReviewRoom.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function compactText(value = "", max = 170) {
  const text = s(value).replace(/\s+/g, " ");
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
}

function labelize(value = "") {
  return s(value, "pending").replace(/_/g, " ");
}

function collectFacts(room = {}) {
  const rows = [];

  for (const section of arr(room.sectionDetails)) {
    const sectionLabel = s(section.title || section.label || section.key);

    for (const fact of arr(section.facts)) {
      const value = compactText(fact.value, 180);
      if (!value) continue;

      rows.push({
        key: `${section.key || sectionLabel}-${fact.key || fact.label}`,
        label: s(fact.label || sectionLabel),
        value,
        sourceBacked: section.sourceBacked === true,
      });
    }

    const items = arr(section.items)
      .map((item) => compactText(item, 90))
      .filter(Boolean);

    if (items.length) {
      rows.push({
        key: `${section.key || sectionLabel}-items`,
        label: sectionLabel,
        value: items.slice(0, 7).join(", "),
        sourceBacked: section.sourceBacked === true,
      });
    }
  }

  if (rows.length) return rows.slice(0, 14);

  return arr(room.sections)
    .filter((section) => Number(section.itemCount || 0) > 0)
    .map((section) => ({
      key: s(section.key),
      label: s(section.label || section.key),
      value: `${Number(section.itemCount || 0)} məlumat tapıldı`,
      sourceBacked: section.sourceBacked === true,
    }))
    .slice(0, 14);
}

function isUsefulMissingQuestion(item = {}) {
  const body = s(item.body || item.message || item.prompt);
  if (!body) return false;

  const combined = lower(`${item.title || ""} ${body}`);
  if (
    /\bempty answer\b|\bmissing answer\b|\bmissing \/ empty\b|\bempty_answer\b/.test(
      combined
    )
  ) {
    return false;
  }

  if (/^missing$/.test(combined) || /^empty$/.test(combined)) return false;

  return true;
}

function collectMissing(room = {}) {
  const brain = obj(room.brain);
  const missingPlan = obj(brain.missingFactsPlan);
  const nextQuestion = obj(missingPlan.nextQuestion);

  const recommendedQuestions = arr(missingPlan.recommendedQuestions)
    .map((question) => ({
      key: s(question.key || question.label || question.prompt),
      title: s(question.label || question.key || "Sual"),
      body: s(question.prompt),
    }))
    .filter(isUsefulMissingQuestion);

  if (recommendedQuestions.length) return recommendedQuestions.slice(0, 4);

  if (s(nextQuestion.prompt)) {
    return [
      {
        key: s(nextQuestion.key || missingPlan.nextQuestionKey || nextQuestion.prompt),
        title: s(nextQuestion.label || nextQuestion.key || "Sual"),
        body: s(nextQuestion.prompt),
      },
    ].filter(isUsefulMissingQuestion);
  }

  const blockers = arr(room.issues)
    .filter((issue) => s(issue.severity) === "blocking")
    .map((issue) => ({
      key: s(issue.id || issue.section || issue.message),
      title: labelize(issue.section || issue.type),
      body: s(issue.message),
    }))
    .filter(isUsefulMissingQuestion);

  return blockers.slice(0, 4);
}

function SourceInput({
  value,
  busy,
  status,
  onValueChange,
  onSubmit,
  compact = false,
}) {
  const placeholder =
    "Sayt, Instagram, Google Maps və ya qısa biznes təsviri";
  const sourceHints = ["Website", "Instagram", "Google Maps", "Qısa təsvir"];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className={compact ? "w-full" : "mx-auto w-full max-w-[760px]"}
    >
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-line-soft))] bg-[rgb(var(--color-surface))] shadow-[var(--shadow-sm)]">
        <div className="flex items-stretch">
          <textarea
            rows={1}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
            className="min-h-[58px] flex-1 resize-none border-0 bg-transparent px-4 py-[17px] text-[15px] leading-6 text-text outline-none placeholder:text-text-soft"
          />

          <button
            type="submit"
            disabled={!s(value) || busy}
            className="min-w-[108px] border-l border-[rgb(var(--color-line-soft))] bg-[rgb(var(--color-surface))] px-5 text-[14px] font-semibold text-text transition hover:bg-[rgb(var(--color-surface-muted))] disabled:cursor-not-allowed disabled:text-text-soft"
          >
            {busy ? "Oxunur" : "Oxu"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[rgb(var(--color-line-faint))] bg-[rgb(var(--color-surface-muted))] px-4 py-2 text-[12px] font-medium text-text-soft">
          {sourceHints.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>

      {status ? (
        <div className="mt-3 text-center text-[13px] font-medium text-text-subtle">
          {status}
        </div>
      ) : null}
    </form>
  );
}

export default function SetupReviewRoomSurface({
  reviewRoom = {},
  sourceValue = "",
  sourceBusy = false,
  sourceStatus = "",
  onSourceValueChange = () => {},
  onSubmitSource = () => {},
  onAction = () => {},
}) {
  const room = normalizeSetupReviewRoom(reviewRoom);
  const brain = obj(room.brain);
  const primaryAction = obj(room.actions.primary);
  const approvalPreview = obj(room.approvalPreview);

  const facts = collectFacts(room);
  const missing = collectMissing(room);

  const hasFacts = facts.length > 0;
  const hasMissing = missing.length > 0;
  const canApprove =
    approvalPreview.canApprove === true ||
    (room.readyForApproval === true &&
      obj(brain.decisionPlan).canApprove === true &&
      s(primaryAction.intent).includes("finalize") &&
      primaryAction.enabled !== false);
  const hasMeaningfulProgress = hasFacts || hasMissing || canApprove;
  const isInitialLoading = sourceBusy && !hasMeaningfulProgress;

  if (!hasMeaningfulProgress) {
    return (
      <section
        aria-label="Setup workspace"
        className="flex min-h-[calc(100vh-150px)] items-center bg-[rgb(var(--color-canvas))]"
      >
        <div className="mx-auto w-full max-w-[900px] px-6 py-16 text-center">
          <h1 className="mx-auto max-w-[760px] text-[40px] font-semibold leading-[1.08] tracking-[var(--tracking-tight-xl)] text-text sm:text-[44px]">
            {isInitialLoading
              ? "Biznes məlumatları oxunur"
              : "Biznesini AI üçün tanıdaq"}
          </h1>

          {!isInitialLoading ? (
            <p className="mx-auto mt-4 max-w-[620px] text-[15px] leading-7 text-text-subtle">
              Sayt, sosial profil, xəritə linki və ya qısa təsvir yaz. Mən faktları çıxarıb yalnız lazım olanı soruşacağam.
            </p>
          ) : null}

          <div className="mt-8">
            <SourceInput
              value={sourceValue}
              busy={sourceBusy}
              status={isInitialLoading ? "" : sourceStatus}
              onValueChange={onSourceValueChange}
              onSubmit={onSubmitSource}
            />
          </div>

          {!isInitialLoading ? (
            <p className="mx-auto mt-5 max-w-[560px] text-[12px] leading-6 text-text-soft">
              Məsələn: website ünvanı, Instagram profili, Google Maps linki və ya “Bakıda klinikayıq”.
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Setup workspace"
      className="min-h-[calc(100vh-150px)] bg-[rgb(var(--color-canvas))]"
    >
      <div className="mx-auto w-full max-w-[980px] px-6 py-8">
        <header className="mb-7">
          <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[var(--tracking-tight-xl)] text-text">
            Bunları tapdım
          </h1>
          <p className="mt-3 max-w-[640px] text-[14px] leading-7 text-text-subtle">
            Məlumatları yoxla. Nəsə çatışmırsa, eyni inputa qısa cavab yaz.
          </p>

          <div className="mt-6">
            <SourceInput
              compact
              value={sourceValue}
              busy={sourceBusy}
              status={sourceStatus}
              onValueChange={onSourceValueChange}
              onSubmit={onSubmitSource}
            />
          </div>
        </header>

        {hasFacts ? (
          <section className="border-y border-[rgb(var(--color-line-soft))] py-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[19px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                  Faktlar
                </h2>
                <p className="mt-1 text-[13px] text-text-subtle">
                  Mənbədən və cavablarından çıxarılan məlumatlar.
                </p>
              </div>
            </div>

            <div className="divide-y divide-[rgb(var(--color-line-soft))]">
              {facts.map((fact) => (
                <div
                  key={fact.key}
                  className="grid gap-2 py-3 md:grid-cols-[190px_minmax(0,1fr)]"
                >
                  <div className="text-[13px] font-semibold text-text">
                    {fact.label}
                  </div>

                  <div className="text-[13px] leading-6 text-text-subtle">
                    {fact.value}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {hasMissing ? (
          <section className="mt-6">
            <h2 className="text-[19px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
              Aydınlaşdırmalı olduğum suallar
            </h2>

            <div className="mt-4 grid gap-3">
              {missing.map((item) => (
                <div
                  key={item.key || item.body}
                  className="border-l-2 border-[rgb(var(--color-warning-strong))] bg-[rgb(var(--color-warning-soft))] px-4 py-3"
                >
                  <div className="text-[13px] font-semibold text-text">
                    {item.title}
                  </div>
                  <div className="mt-1 text-[13px] leading-6 text-text-subtle">
                    {item.body}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {canApprove ? (
          <section className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-[rgb(var(--color-line-soft))] pt-6">
            <div>
              <h2 className="text-[21px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                Təsdiqləməyə hazırdır
              </h2>
              <p className="mt-2 max-w-[560px] text-[13px] leading-6 text-text-subtle">
                Təsdiqdən sonra AI bu məlumatlardan cavablarda istifadə edəcək.
              </p>
            </div>

            <button
              type="button"
              disabled={!primaryAction.enabled}
              onClick={() => onAction(primaryAction)}
              className="ui-button ui-button--primary ui-button--md"
            >
              <span className="ui-button__inner">
                Təsdiqlə
              </span>
            </button>
          </section>
        ) : null}
      </div>
    </section>
  );
}
