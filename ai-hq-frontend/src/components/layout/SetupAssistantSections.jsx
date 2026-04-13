import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

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

function compactText(value, max = 220) {
  const text = s(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}...`;
}

function listPreview(items = [], max = 6) {
  const safe = arr(items).map((item) => compactText(item, 80)).filter(Boolean);
  if (!safe.length) return "";
  if (safe.length <= max) return safe.join(", ");
  return `${safe.slice(0, max).join(", ")} +${safe.length - max}`;
}

const QUESTIONS = [
  {
    key: "company",
    step: "company",
    title: "Business name",
    prompt: "Biznesin adı necə görünməlidir?",
    placeholder: "Məsələn: Saytpro",
  },
  {
    key: "description",
    step: "description",
    title: "What the business is",
    prompt: "Bu biznesi qısa necə təqdim etməliyəm?",
    placeholder: "Bir-iki cümlə ilə yaz",
  },
  {
    key: "services",
    step: "services",
    title: "Core services",
    prompt: "Əsas xidmətləri yaz.",
    placeholder: "Məsələn: website hazırlanması, reklam, branding",
  },
  {
    key: "audience",
    step: "profile",
    title: "Audience",
    prompt: "Əsasən kimlərə xidmət göstərirsiniz?",
    placeholder: "Məsələn: kiçik bizneslər, şirkətlər, fərdi brendlər",
  },
  {
    key: "pricing",
    step: "pricing",
    title: "Pricing posture",
    prompt: "Qiymət necə təqdim olunmalıdır?",
    placeholder:
      "Məsələn: qiymətlər xidmətə görə dəyişir, dəqiq qiymət üçün müraciət edilməlidir",
  },
  {
    key: "contacts",
    step: "contacts",
    title: "Contact routes",
    prompt: "Müştəri hara yönləndirilməlidir?",
    placeholder: "Məsələn: WhatsApp, telefon, email, Instagram DM",
  },
  {
    key: "handoff",
    step: "handoff",
    title: "Human handoff",
    prompt: "AI hansı hallarda insana ötürməlidir?",
    placeholder:
      "Məsələn: şikayət, fərdi qiymət sorğusu, təcili müraciət, ödəniş problemi",
  },
];

function classifySourceInput(value = "") {
  const text = s(value).toLowerCase();

  if (!text) return "manual";
  if (text.includes("instagram.com") || text.startsWith("@")) return "instagram";
  if (text.includes("facebook.com")) return "facebook";
  if (
    text.includes("http://") ||
    text.includes("https://") ||
    /^[a-z0-9-]+\.[a-z]{2,}/i.test(text)
  ) {
    return "website";
  }
  return "manual";
}

function buildFallbackDraft(reviewPayload = null, assistant = {}, localAnswers = {}) {
  const review = obj(reviewPayload?.review || reviewPayload);
  const draft = Object.keys(obj(review.draft)).length
    ? obj(review.draft)
    : obj(assistant.draft);
  const profile = obj(draft.businessProfile);

  const services = arr(draft.services)
    .map((item) => s(item.title || item.name || item.label))
    .filter(Boolean);

  const contacts = arr(draft.contacts)
    .map((item) => s(item.label || item.channel || item.value || item.type))
    .filter(Boolean);

  const businessName = s(
    profile.companyName || profile.displayName || localAnswers.company
  );

  const description = s(
    profile.description ||
      profile.companySummaryShort ||
      profile.companySummary ||
      localAnswers.description
  );

  const audience = s(
    profile.targetAudience ||
      profile.audience ||
      profile.customerType ||
      profile.customerTypes ||
      localAnswers.audience
  );

  const pricingPosture = s(
    profile.pricingPolicy ||
      draft.pricingPosture?.publicSummary ||
      draft.pricingPosture?.note ||
      draft.pricingPosture?.summary ||
      localAnswers.pricing
  );

  const humanHandoff = s(
    draft.handoffRules?.summary ||
      arr(draft.handoffRules?.triggers).join(", ") ||
      localAnswers.handoff
  );

  const resolvedServices = services.length
    ? services
    : s(localAnswers.services)
        .split(/[,;\n]/)
        .map((item) => s(item))
        .filter(Boolean);

  const resolvedContacts = [
    s(profile.primaryPhone),
    s(profile.primaryEmail),
    s(profile.primaryAddress),
    ...contacts,
  ].filter(Boolean);

  const finalContacts = resolvedContacts.length
    ? resolvedContacts
    : s(localAnswers.contacts)
        .split(/[,;\n]/)
        .map((item) => s(item))
        .filter(Boolean);

  return {
    businessName,
    whatThisBusinessIs: description,
    coreServices: resolvedServices,
    audience,
    pricingPosture,
    contactRoutes: finalContacts,
    humanHandoff,
  };
}

function buildFinalViewModel({ reviewPayload = null, assistant = {}, localAnswers = {} }) {
  const reviewAssistant = obj(reviewPayload?.assistant || reviewPayload?.assistantBrain);
  const recommendation = obj(reviewAssistant.recommendation);
  const confidence = obj(reviewAssistant.confidence);
  const sourceSignals = obj(reviewAssistant.sourceSignals);
  const draft = obj(reviewAssistant.draft);

  const fallback = buildFallbackDraft(reviewPayload, assistant, localAnswers);

  const resolvedDraft = {
    businessName: s(draft.businessName || fallback.businessName),
    whatThisBusinessIs: s(draft.whatThisBusinessIs || fallback.whatThisBusinessIs),
    coreServices: arr(draft.coreServices).length
      ? arr(draft.coreServices)
      : arr(fallback.coreServices),
    audience: s(draft.audience || fallback.audience),
    pricingPosture: s(draft.pricingPosture || fallback.pricingPosture),
    contactRoutes: arr(draft.contactRoutes).length
      ? arr(draft.contactRoutes)
      : arr(fallback.contactRoutes),
    humanHandoff: s(draft.humanHandoff || fallback.humanHandoff),
    languages: arr(draft.languages),
    tone: s(draft.tone),
    hours: arr(draft.hours),
  };

  return {
    message: s(reviewAssistant.message || reviewAssistant.assistantMessage),
    readyForApproval:
      reviewAssistant.readyForApproval === true ||
      assistant.review?.finalizeAvailable === true ||
      assistant.review?.readyForReview === true ||
      assistant.assistant?.completion?.ready === true,
    draft: resolvedDraft,
    confidence: {
      strong: arr(confidence.strong),
      unclear: arr(confidence.unclear),
      contradictions: arr(confidence.contradictions),
    },
    recommendationNotes: arr(recommendation.notes),
    sourceSignals: {
      primarySourceType: s(sourceSignals.primarySourceType),
      primarySourceLabel: s(sourceSignals.primarySourceLabel),
      primarySourceUrl: s(sourceSignals.primarySourceUrl),
      pageCount: Number(sourceSignals.pageCount || 0) || 0,
      sourceTypes: arr(sourceSignals.sourceTypes),
    },
  };
}

function MessageBubble({
  role = "assistant",
  eyebrow = "",
  title = "",
  body = "",
  children = null,
}) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[86%] px-4 py-3.5 text-[15px] leading-8 ${
          isUser
            ? "bg-slate-950 text-white"
            : "border border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(248,250,252,0.82),rgba(255,255,255,0.98))] text-text"
        }`}
      >
        {s(eyebrow) ? (
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] opacity-60">
            {eyebrow}
          </div>
        ) : null}

        {s(title) ? (
          <div className="text-[22px] font-semibold tracking-[-0.04em]">
            {title}
          </div>
        ) : null}

        {s(body) ? (
          <div className={title ? "mt-2 whitespace-pre-wrap" : "whitespace-pre-wrap"}>
            {body}
          </div>
        ) : null}

        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </div>
  );
}

function SmartDraftBubble({
  model,
  finalizing,
  onFinalize,
}) {
  const draft = obj(model.draft);
  const confidence = obj(model.confidence);

  const draftRows = [
    ["Business name", draft.businessName],
    ["What this business is", draft.whatThisBusinessIs],
    ["Core services", listPreview(draft.coreServices, 6)],
    ["Audience", draft.audience],
    ["Pricing posture", draft.pricingPosture],
    ["Contact routes", listPreview(draft.contactRoutes, 6)],
    ["Human handoff", draft.humanHandoff],
    ["Languages", listPreview(draft.languages, 4)],
    ["Tone", draft.tone],
    ["Hours", listPreview(draft.hours, 4)],
  ].filter(([, value]) => s(value));

  const hasSignals =
    s(model.sourceSignals.primarySourceLabel) || s(model.sourceSignals.primarySourceUrl);

  return (
    <MessageBubble role="assistant" title="Draft">
      <div className="space-y-5">
        {s(model.message) ? (
          <div className="text-[14px] leading-7 text-text-muted whitespace-pre-wrap">
            {model.message}
          </div>
        ) : null}

        {hasSignals ? (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              Source context
            </div>
            <div className="mt-1 text-[15px] leading-8 text-text">
              {[model.sourceSignals.primarySourceLabel, model.sourceSignals.primarySourceUrl]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {draftRows.map(([label, value]) => (
            <div key={label}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                {label}
              </div>
              <div className="mt-1 text-[15px] leading-8 text-text">{value}</div>
            </div>
          ))}
        </div>

        {arr(confidence.strong).length ? (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              What looks strong
            </div>
            <div className="mt-2 space-y-1.5 text-[14px] leading-7 text-text">
              {arr(confidence.strong).map((item) => (
                <div key={item}>• {item}</div>
              ))}
            </div>
          </div>
        ) : null}

        {arr(confidence.unclear).length ? (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              What still looks unclear
            </div>
            <div className="mt-2 space-y-1.5 text-[14px] leading-7 text-text">
              {arr(confidence.unclear).map((item) => (
                <div key={item}>• {item}</div>
              ))}
            </div>
          </div>
        ) : null}

        {arr(confidence.contradictions).length ? (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              What may be inconsistent
            </div>
            <div className="mt-2 space-y-1.5 text-[14px] leading-7 text-text">
              {arr(confidence.contradictions).map((item) => (
                <div key={item}>• {item}</div>
              ))}
            </div>
          </div>
        ) : null}

        {arr(model.recommendationNotes).length ? (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              Recommendation
            </div>
            <div className="mt-2 space-y-1.5 text-[14px] leading-7 text-text">
              {arr(model.recommendationNotes).map((item) => (
                <div key={item}>• {item}</div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="pt-1 text-[13px] leading-6 text-text-muted">
          Dəyişmək istədiyini yaz və ya təsdiqlə.
        </div>

        {model.readyForApproval ? (
          <button
            type="button"
            onClick={onFinalize}
            disabled={finalizing}
            className="inline-flex h-10 items-center bg-slate-950 px-4 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {finalizing ? "Approving..." : "Approve truth"}
          </button>
        ) : null}
      </div>
    </MessageBubble>
  );
}

function Composer({
  value,
  busy,
  placeholder,
  buttonLabel,
  onChange,
  onSubmit,
}) {
  return (
    <div className="border-t border-[rgba(15,23,42,0.08)] bg-white px-6 py-4">
      <div className="flex items-end gap-3 border-b border-[rgba(15,23,42,0.12)] py-2">
        <textarea
          rows={4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder={placeholder}
          className="min-h-[98px] w-full resize-none bg-transparent px-0 py-1 text-[15px] leading-7 text-text outline-none placeholder:text-text-subtle"
        />

        <button
          type="button"
          onClick={onSubmit}
          disabled={!s(value) || busy}
          className="inline-flex h-10 shrink-0 items-center gap-2 bg-slate-950 px-4 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          <span>{buttonLabel}</span>
        </button>
      </div>
    </div>
  );
}

export default function SetupAssistantSections({
  assistant,
  reviewPayload = null,
  saving = false,
  finalizing = false,
  capturingSource = false,
  errorMessage = "",
  onCaptureSource,
  onParseMessage,
  onFinalize,
}) {
  const scrollRef = useRef(null);

  const [sourceSubmitted, setSourceSubmitted] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [composerValue, setComposerValue] = useState("");
  const [localError, setLocalError] = useState("");
  const [transcript, setTranscript] = useState([]);
  const [localAnswers, setLocalAnswers] = useState({});

  const busy = saving || finalizing || capturingSource;
  const currentQuestion = QUESTIONS[questionIndex] || null;
  const draftReady = sourceSubmitted && !currentQuestion;

  const finalModel = useMemo(
    () =>
      buildFinalViewModel({
        reviewPayload,
        assistant,
        localAnswers,
      }),
    [reviewPayload, assistant, localAnswers]
  );

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript, currentQuestion, draftReady, busy, localError, errorMessage, finalModel]);

  async function handleInitialSourceSubmit() {
    const text = s(composerValue);
    if (!text || busy) return;

    const sourceType = classifySourceInput(text);

    setLocalError("");
    setSourceSubmitted(true);
    setTranscript((current) => [
      ...current,
      {
        id: `source-${Date.now()}`,
        role: "user",
        text,
      },
    ]);
    setComposerValue("");
    setQuestionIndex(0);

    try {
      await onCaptureSource?.({
        type: sourceType,
        value: text,
      });
    } catch (error) {
      setLocalError(s(error?.message, "Source intake failed."));
    }
  }

  async function handleQuestionSubmit(textValue = composerValue) {
    const text = s(textValue);
    if (!text || busy || !currentQuestion) return;

    setLocalError("");
    setTranscript((current) => [
      ...current,
      {
        id: `answer-${currentQuestion.key}-${Date.now()}`,
        role: "user",
        text,
      },
    ]);
    setLocalAnswers((current) => ({
      ...current,
      [currentQuestion.key]: text,
    }));
    setComposerValue("");

    try {
      await onParseMessage?.({
        step: currentQuestion.step,
        text,
      });
    } catch (error) {
      setLocalError(s(error?.message, "The answer could not be processed."));
    }

    setQuestionIndex((index) => index + 1);
  }

  async function handleDraftUpdate() {
    const text = s(composerValue);
    if (!text || busy) return;

    setLocalError("");
    setTranscript((current) => [
      ...current,
      {
        id: `edit-${Date.now()}`,
        role: "user",
        text,
      },
    ]);
    setComposerValue("");

    try {
      await onParseMessage?.({
        step: "profile",
        text,
      });
    } catch (error) {
      setLocalError(s(error?.message, "The draft could not be updated."));
    }
  }

  const initialPrompt =
    "Biznesin linkini və ya qısa izahını göndər. (website, instagram, facebook, qısa qeyd)";

  const questionPrompt = currentQuestion
    ? `${currentQuestion.title}\n${currentQuestion.prompt}`
    : "";

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div ref={scrollRef} className="flex-1 overflow-auto px-6 py-6">
        <div className="space-y-4">
          <MessageBubble role="assistant" body={initialPrompt} />

          {transcript.map((item) => (
            <MessageBubble key={item.id} role={item.role} body={item.text} />
          ))}

          {sourceSubmitted && currentQuestion ? (
            <MessageBubble
              role="assistant"
              eyebrow={`Setup · ${questionIndex + 1}/${QUESTIONS.length}`}
              body={questionPrompt}
            />
          ) : null}

          {busy ? <MessageBubble role="assistant" body="..." /> : null}

          {draftReady ? (
            <SmartDraftBubble
              model={finalModel}
              finalizing={finalizing}
              onFinalize={onFinalize}
            />
          ) : null}

          {s(localError || errorMessage) ? (
            <MessageBubble role="assistant" body={localError || errorMessage} />
          ) : null}
        </div>
      </div>

      {!sourceSubmitted ? (
        <Composer
          value={composerValue}
          busy={busy}
          placeholder="Link və ya qısa izah yaz"
          buttonLabel="Continue"
          onChange={setComposerValue}
          onSubmit={handleInitialSourceSubmit}
        />
      ) : null}

      {sourceSubmitted && currentQuestion ? (
        <Composer
          value={composerValue}
          busy={busy}
          placeholder={currentQuestion.placeholder}
          buttonLabel="Continue"
          onChange={setComposerValue}
          onSubmit={handleQuestionSubmit}
        />
      ) : null}

      {draftReady ? (
        <Composer
          value={composerValue}
          busy={busy}
          placeholder="Dəyişmək istədiyini yaz"
          buttonLabel="Update"
          onChange={setComposerValue}
          onSubmit={handleDraftUpdate}
        />
      ) : null}
    </div>
  );
}