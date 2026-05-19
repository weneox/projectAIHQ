import {
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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

function compactText(value = "", max = 220) {
  const text = s(value).replace(/\s+/g, " ");
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}...`;
}

function labelize(value = "") {
  return s(value, "pending").replace(/_/g, " ");
}

function hostLabel(value = "") {
  const text = s(value);
  if (!text) return "";
  try {
    return new URL(text).hostname.replace(/^www\./, "");
  } catch {
    return text.replace(/^https?:\/\//i, "").split("/")[0];
  }
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

  const combined = lower(`${item.title || item.label || ""} ${body}`);
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
  const draftMissing = arr(obj(room.polishedTruthDraft).missingQuestions)
    .map((question) => ({
      key: s(question.key || question.label || question.prompt),
      title: s(question.label || question.key || "Sual"),
      body: s(question.prompt),
    }))
    .filter(isUsefulMissingQuestion);

  if (draftMissing.length) return draftMissing.slice(0, 4);

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

function draftFromRoom(room = {}) {
  const polished = obj(room.polishedTruthDraft);
  const identity = obj(polished.businessIdentity);
  const facts = collectFacts(room);
  const evidence = obj(room.evidence);
  const evidenceSource = obj(evidence.primarySource);
  const hasFallbackInput =
    facts.length > 0 ||
    arr(evidence.evidenceCards).length > 0 ||
    s(evidenceSource.url || evidenceSource.label) ||
    collectMissing(room).length > 0;

  if (
    s(polished.title) ||
    s(identity.name) ||
    s(polished.whatThisBusinessDoes) ||
    arr(polished.services).length ||
    arr(polished.contacts).length ||
    arr(polished.missingQuestions).length
  ) {
    return polished;
  }

  if (!hasFallbackInput) return {};

  const nameFact = facts.find((fact) =>
    /name|ad|company|biznes/i.test(fact.label)
  );
  const descriptionFact = facts.find((fact) =>
    /description|təsvir|summary|kateqoriya|category/i.test(fact.label)
  );
  const serviceFacts = facts
    .filter((fact) => /service|xidm/i.test(fact.label))
    .slice(0, 6);
  const contactFacts = facts
    .filter((fact) => /contact|əlaq|phone|email|ünvan|address/i.test(fact.label))
    .slice(0, 6);

  return {
    title: s(nameFact?.value || "AI biznes truth draftı"),
    subtitle: facts.length
      ? "Tapılan məlumatlar təsdiq üçün təmiz drafta çevrildi."
      : "Mən bunu anladım və çatışmayanları soruşmağa hazıram.",
    source: {
      type: s(evidenceSource.type || obj(room.brain?.sourceIntelligence).primarySourceType),
      url: s(evidenceSource.url || obj(room.brain?.sourceIntelligence).primarySourceUrl),
      label: s(evidenceSource.label || "Business input"),
    },
    businessIdentity: {
      name: s(nameFact?.value),
      description: s(descriptionFact?.value),
      website: "",
      publicSummary: s(descriptionFact?.value),
    },
    whatThisBusinessDoes: s(descriptionFact?.value),
    services: serviceFacts.map((fact) => ({
      title: fact.value,
      sourceBacked: fact.sourceBacked,
    })),
    contacts: contactFacts.map((fact) => ({
      type: "contact",
      label: fact.label,
      value: fact.value,
    })),
    hours: [],
    pricingPosture: "",
    safeAiBehavior: {
      canSay: facts.slice(0, 6).map((fact) => `${fact.label}: ${fact.value}`),
      shouldNotSay: [
        "Təsdiqlənməmiş qiymət, nəticə və ya availability uydurmayacaq.",
        "Mənbədə olmayan xidməti varmış kimi deməyəcək.",
      ],
      handoffRules: ["Əmin olmadığı və ya həssas suallarda insana yönləndirəcək."],
    },
    missingQuestions: collectMissing(room).map((item) => ({
      key: item.key,
      label: item.title,
      prompt: item.body,
    })),
    approval: obj(room.approvalPreview),
    evidence: arr(evidence.evidenceCards),
  };
}


const SETUP_OPERATIONAL_TEXT_RE =
  /(ağıllı setup beyni aktiv deyil|agilli setup beyni aktiv deyil|openai setup brain|keyword fallback|setup_brain_unavailable|openai_setup_brain_required|openai_setup_brain_forced_off|OPENAI_SETUP_BRAIN_DISABLED)/i;

function isOperationalSetupText(value = "") {
  return SETUP_OPERATIONAL_TEXT_RE.test(s(value));
}

function roomHasBrainUnavailableState({ room = {}, draft = {}, assistant = {} } = {}) {
  const haystack = [
    obj(assistant).provider,
    obj(assistant).error,
    obj(assistant).message,
    obj(assistant).assistantMessage,
    obj(room.brain).provider,
    obj(room.brain).error,
    obj(room.header).primaryMessage,
    obj(room.header).subtitle,
    draft.title,
    draft.subtitle,
    obj(draft.businessIdentity).name,
    obj(draft.businessIdentity).description,
    draft.whatThisBusinessDoes,
  ]
    .map((item) => s(item))
    .filter(Boolean)
    .join(" ");

  return isOperationalSetupText(haystack);
}

function hasUsefulDraftText(value = "") {
  const text = s(value);
  return Boolean(text) && !isOperationalSetupText(text);
}

function hasUsefulEvidence(room = {}, draft = {}) {
  const evidence = [
    ...arr(obj(room.evidence).evidenceCards),
    ...arr(draft.evidence),
  ];

  return evidence.some((item) => hasUsefulDraftText(item?.text));
}

function hasRealBusinessDraft({ room = {}, draft = {}, approvalPreview = {} } = {}) {
  const identity = obj(draft.businessIdentity);

  return Boolean(
    hasUsefulDraftText(draft.title) ||
      hasUsefulDraftText(identity.name) ||
      hasUsefulDraftText(identity.description) ||
      hasUsefulDraftText(identity.publicSummary) ||
      hasUsefulDraftText(draft.whatThisBusinessDoes) ||
      arr(draft.services).some((item) => hasUsefulDraftText(item?.title)) ||
      arr(draft.contacts).some((item) => hasUsefulDraftText(item?.value)) ||
      arr(draft.hours).some(hasUsefulDraftText) ||
      hasUsefulDraftText(draft.pricingPosture) ||
      Number(approvalPreview.publishCount || 0) > 0 ||
      hasUsefulEvidence(room, draft)
  );
}

function resolveSetupSurfaceState({
  room = {},
  draft = {},
  assistant = {},
  sourceBusy = false,
  canApprove = false,
  finalized = false,
  approvalPreview = {},
  missing = [],
} = {}) {
  if (finalized) return "approved_live";

  if (roomHasBrainUnavailableState({ room, draft, assistant })) {
    return "brain_unavailable";
  }

  const hasRealDraft = hasRealBusinessDraft({ room, draft, approvalPreview });

  if (sourceBusy && !hasRealDraft) return "loading";
  if (hasRealDraft && canApprove) return "ready_for_approval";
  if (hasRealDraft) return "draft_ready";
  if (arr(missing).length > 0) return "needs_input";

  return "empty";
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

function InfoCard({ title, children }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-line-soft))] bg-[rgb(var(--color-surface))] p-5 shadow-[var(--shadow-sm)]">
      <h2 className="text-[15px] font-semibold text-text">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BulletList({ items = [], empty = "" }) {
  const safeItems = arr(items).map((item) => s(item)).filter(Boolean);

  if (!safeItems.length) {
    return empty ? (
      <p className="text-[13px] leading-6 text-text-subtle">{empty}</p>
    ) : null;
  }

  return (
    <ul className="space-y-2">
      {safeItems.map((item) => (
        <li key={item} className="flex gap-2 text-[13px] leading-6 text-text-subtle">
          <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-[rgb(var(--color-success-strong))]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function SetupReviewRoomSurface({
  reviewRoom = {},
  assistant = {},
  sourceValue = "",
  sourceBusy = false,
  sourceStatus = "",
  onSourceValueChange = () => {},
  onSubmitSource = () => {},
  onAction = () => {},
}) {
  const room = normalizeSetupReviewRoom(reviewRoom);
  const draft = draftFromRoom(room);
  const primaryAction = obj(room.actions.primary);
  const approvalPreview = obj(room.approvalPreview);
  const draftApproval = obj(draft.approval);
  const missing = collectMissing(room);
  const evidence = arr(draft.evidence).length
    ? arr(draft.evidence)
    : arr(obj(room.evidence).evidenceCards);
  const source = obj(draft.source);
  const identity = obj(draft.businessIdentity);
  const behavior = obj(draft.safeAiBehavior);
  const assistantReview = obj(assistant.review);
  const finalized =
    assistantReview.finalized === true ||
    obj(room.header).status === "approved_live";
  const canApprove =
    approvalPreview.canApprove === true ||
    draftApproval.canApprove === true ||
    room.readyForApproval === true ||
    s(primaryAction.intent).includes("finalize");
  const hasDraft =
    s(draft.title) ||
    s(identity.name) ||
    s(draft.whatThisBusinessDoes) ||
    arr(draft.services).length ||
    arr(draft.contacts).length ||
    arr(draft.missingQuestions).length ||
    missing.length > 0;
  const hasMeaningfulProgress = hasDraft || canApprove || finalized;
  const isInitialLoading = sourceBusy && !hasMeaningfulProgress;
  const sourceLabel =
    hostLabel(source.url) || s(source.label || source.type || "Business input");

  if (surfaceState === "brain_unavailable") {
    return (
      <section
        aria-label="Setup workspace"
        className="flex min-h-[calc(100vh-150px)] items-center bg-[rgb(var(--color-canvas))]"
      >
        <div className="mx-auto w-full max-w-[860px] px-6 py-16">
          <SourceInput
            value={sourceValue}
            busy={sourceBusy}
            status={sourceStatus}
            onValueChange={onSourceValueChange}
            onSubmit={onSubmitSource}
          />

          <div className="mt-6 rounded-[var(--radius-lg)] border border-[rgb(var(--color-warning-strong))] bg-[rgb(var(--color-surface))] p-6 shadow-[var(--shadow-sm)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--color-warning-strong))]">
              Setup config
            </div>
            <h1 className="mt-3 text-[26px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
              Setup AI brain aktiv deyil
            </h1>
            <p className="mt-3 text-[14px] leading-7 text-text-subtle">
              Backend-də OPENAI_API_KEY və OPENAI_SETUP_ASSISTANT_ENABLED=true aktiv edilmədən setup real biznes faktı çıxarmayacaq.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (surfaceState === "needs_input") {
    return (
      <section
        aria-label="Setup workspace"
        className="flex min-h-[calc(100vh-150px)] items-center bg-[rgb(var(--color-canvas))]"
      >
        <div className="mx-auto w-full max-w-[900px] px-6 py-16">
          <SourceInput
            value={sourceValue}
            busy={sourceBusy}
            status={sourceStatus}
            onValueChange={onSourceValueChange}
            onSubmit={onSubmitSource}
          />

          <div className="mt-6 rounded-[var(--radius-lg)] border border-[rgb(var(--color-line-soft))] bg-[rgb(var(--color-surface))] p-6 shadow-[var(--shadow-sm)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-text-soft">
              Business input
            </div>
            <h1 className="mt-3 text-[26px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
              Məlumat kifayət deyil
            </h1>
            <p className="mt-3 text-[14px] leading-7 text-text-subtle">
              Hələ review room açmaq üçün real biznes faktı tapılmayıb. Sayt linki və ya biznesi 2-3 cümlə ilə daha konkret yaz.
            </p>

            {missing.length ? (
              <div className="mt-5 space-y-3">
                {missing.map((item) => (
                  <div
                    key={item.key || item.body}
                    className="rounded-[var(--radius-md)] bg-[rgb(var(--color-surface-muted))] px-4 py-3 text-[13px] leading-6 text-text-subtle"
                  >
                    <span className="font-semibold text-text">{item.title}: </span>
                    {item.body}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

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
      <div className="mx-auto w-full max-w-[1080px] px-6 py-8">
        <header className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--color-line-soft))] bg-[rgb(var(--color-surface))] px-3 py-1 text-[12px] font-semibold text-text-subtle">
                <Sparkles className="h-3.5 w-3.5" />
                {sourceLabel}
              </div>
              <h1 className="mt-4 text-[30px] font-semibold leading-[1.1] tracking-[var(--tracking-tight-xl)] text-text">
                {finalized
                  ? "Approved Business Truth live"
                  : "AI biznes truth draftı hazırlandı"}
              </h1>
              <p className="mt-3 max-w-[680px] text-[14px] leading-7 text-text-subtle">
                {finalized
                  ? "Təsdiqlənmiş Business Truth artıq runtime və voice üçün əsas mənbədir."
                  : s(draft.subtitle) ||
                    "Məlumatları yoxla, çatışmayanları tamamla və sonra Business Truth kimi təsdiqlə."}
              </p>
            </div>

            {finalized ? (
              <a
                href="/truth"
                className="ui-button ui-button--secondary ui-button--md"
              >
                <span className="ui-button__inner">
                  <ExternalLink className="h-4 w-4" />
                  Truth-a bax
                </span>
              </a>
            ) : null}
          </div>

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

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="space-y-5">
            <section className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-line-soft))] bg-[rgb(var(--color-surface))] p-6 shadow-[var(--shadow-sm)]">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-text-soft">
                Business identity
              </div>
              <h2 className="mt-3 text-[24px] font-semibold leading-tight text-text">
                {s(identity.name || draft.title || "Mən bunu anladım")}
              </h2>
              {s(identity.description || identity.publicSummary) ? (
                <p className="mt-3 text-[14px] leading-7 text-text-subtle">
                  {identity.description || identity.publicSummary}
                </p>
              ) : null}
              {s(identity.website) ? (
                <a
                  href={identity.website}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-[rgb(var(--color-brand))]"
                >
                  {hostLabel(identity.website)}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </section>

            <InfoCard title="Bu biznes nə edir">
              <p className="text-[14px] leading-7 text-text-subtle">
                {s(draft.whatThisBusinessDoes || identity.description) ||
                  "Biznes təsviri hələ tam deyil. Aşağıdakı suallara cavab verəndə AI bunu təsdiq draftına çevirəcək."}
              </p>
            </InfoCard>

            <InfoCard title="Xidmətlər">
              {arr(draft.services).length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {arr(draft.services).map((service) => (
                    <div
                      key={s(service.title)}
                      className="rounded-[var(--radius-md)] border border-[rgb(var(--color-line-faint))] bg-[rgb(var(--color-surface-muted))] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-[14px] font-semibold text-text">
                          {service.title}
                        </h3>
                        {service.sourceBacked ? (
                          <span className="rounded-full bg-[rgb(var(--color-success-soft))] px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--color-success-strong))]">
                            source
                          </span>
                        ) : null}
                      </div>
                      {s(service.summary) ? (
                        <p className="mt-2 text-[12px] leading-5 text-text-subtle">
                          {service.summary}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] leading-6 text-text-subtle">
                  Xidmətlər hələ təsdiqlənməyib.
                </p>
              )}
            </InfoCard>
          </div>

          <aside className="space-y-5">
            <InfoCard title="Əlaqə və availability">
              <div className="space-y-4">
                {arr(draft.contacts).length ? (
                  <div className="space-y-2">
                    {arr(draft.contacts).map((contact) => (
                      <div
                        key={`${contact.label}-${contact.value}`}
                        className="text-[13px] leading-6"
                      >
                        <span className="font-semibold text-text">
                          {contact.label}:
                        </span>{" "}
                        <span className="text-text-subtle">{contact.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] leading-6 text-text-subtle">
                    Əlaqə məlumatı hələ yoxdur.
                  </p>
                )}

                <BulletList
                  items={draft.hours}
                  empty="İş saatları hələ təsdiqlənməyib."
                />
                {s(draft.pricingPosture) ? (
                  <p className="border-t border-[rgb(var(--color-line-faint))] pt-3 text-[13px] leading-6 text-text-subtle">
                    {draft.pricingPosture}
                  </p>
                ) : null}
              </div>
            </InfoCard>

            <InfoCard title="AI safety">
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-text">
                    <ShieldCheck className="h-4 w-4 text-[rgb(var(--color-success-strong))]" />
                    AI nə deyə bilər
                  </div>
                  <BulletList
                    items={behavior.canSay}
                    empty="Təsdiqlənmiş cavab materialı hələ formalaşmayıb."
                  />
                </div>

                <div className="border-t border-[rgb(var(--color-line-faint))] pt-4">
                  <div className="mb-2 text-[13px] font-semibold text-text">
                    Nəyi uydurmayacaq
                  </div>
                  <BulletList items={behavior.shouldNotSay} />
                </div>

                <div className="border-t border-[rgb(var(--color-line-faint))] pt-4">
                  <div className="mb-2 text-[13px] font-semibold text-text">
                    Handoff qaydaları
                  </div>
                  <BulletList items={behavior.handoffRules} />
                </div>
              </div>
            </InfoCard>

            {missing.length ? (
              <InfoCard title="Çatışmayan suallar">
                <div className="space-y-3">
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
              </InfoCard>
            ) : null}

            {canApprove && !finalized ? (
              <section className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-success-soft))] bg-[rgb(var(--color-surface))] p-5 shadow-[var(--shadow-sm)]">
                <h2 className="text-[18px] font-semibold text-text">
                  Təsdiqləməyə hazırdır
                </h2>
                <p className="mt-2 text-[13px] leading-6 text-text-subtle">
                  Təsdiqdən sonra widget, inbox və voice yalnız approved truth-dan istifadə edəcək.
                </p>
                <button
                  type="button"
                  disabled={primaryAction.enabled === false}
                  onClick={() => onAction(primaryAction)}
                  className="ui-button ui-button--primary ui-button--md mt-4 w-full"
                >
                  <span className="ui-button__inner">
                    <CheckCircle2 className="h-4 w-4" />
                    Təsdiqlə
                  </span>
                </button>
              </section>
            ) : null}
          </aside>
        </div>

        {evidence.length ? (
          <details className="mt-5 rounded-[var(--radius-lg)] border border-[rgb(var(--color-line-soft))] bg-[rgb(var(--color-surface))] p-5 text-[13px] text-text-subtle">
            <summary className="cursor-pointer text-[14px] font-semibold text-text">
              Evidence və mənbə xülasəsi
            </summary>
            <div className="mt-4 divide-y divide-[rgb(var(--color-line-faint))]">
              {evidence.slice(0, 8).map((item, index) => (
                <div key={`${s(item.text)}-${index}`} className="py-3">
                  <div className="font-semibold text-text">
                    {s(item.label || sourceLabel)}
                  </div>
                  <p className="mt-1 leading-6">{s(item.text)}</p>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
