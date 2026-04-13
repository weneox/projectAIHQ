import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value ?? fallback).toLowerCase();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function compactText(value, max = 180) {
  const text = s(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}...`;
}

function listPreview(items = [], max = 6) {
  const safe = arr(items).map((item) => compactText(item, 60)).filter(Boolean);
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
    placeholder: "Məsələn: qiymətlər xidmətə görə dəyişir",
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
    placeholder: "Məsələn: şikayət, fərdi qiymət sorğusu, təcili müraciət",
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

function buildCurrentSource(assistant = {}, reviewPayload = null) {
  const sourceMetadata = obj(assistant.draft?.sourceMetadata);
  const bundleSources = arr(reviewPayload?.bundleSources);
  const primaryBundle =
    bundleSources.find((item) => lower(item.role) === "primary") ||
    bundleSources[0];

  const sourceType =
    lower(primaryBundle?.sourceType || sourceMetadata.primarySourceType) || "";
  const sourceUrl =
    s(primaryBundle?.sourceUrl || sourceMetadata.primarySourceUrl) ||
    s(assistant.websitePrefill?.websiteUrl);

  const sourceLabel =
    s(primaryBundle?.label || arr(sourceMetadata.sourceLabels)[0]) ||
    (sourceType === "instagram"
      ? "Instagram"
      : sourceType === "facebook_page" || sourceType === "facebook"
        ? "Facebook"
        : sourceType === "manual"
          ? "Qısa qeyd"
          : sourceType === "website"
            ? "Website"
            : "");

  return {
    type: sourceType,
    label: sourceLabel,
    url: sourceUrl,
    hasSource: Boolean(sourceType || sourceUrl || sourceLabel),
  };
}

function buildDraftModel(assistant = {}, reviewPayload = null, localAnswers = {}) {
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

  const pricing =
    s(profile.pricingPolicy) ||
    s(draft.pricingPosture?.publicSummary) ||
    s(draft.pricingPosture?.note) ||
    s(draft.pricingPosture?.summary) ||
    s(localAnswers.pricing);

  const handoff =
    s(draft.handoffRules?.summary) ||
    listPreview(arr(draft.handoffRules?.triggers), 3) ||
    s(draft.handoffRules?.escalationTarget) ||
    s(localAnswers.handoff);

  const audience =
    s(profile.targetAudience) ||
    s(profile.audience) ||
    s(profile.customerType) ||
    s(profile.customerTypes) ||
    s(localAnswers.audience);

  const description =
    s(profile.description) ||
    s(profile.companySummaryShort) ||
    s(profile.companySummary) ||
    s(localAnswers.description);

  const name = s(profile.companyName || profile.displayName || localAnswers.company);

  const allServices = services.length
    ? services
    : s(localAnswers.services)
        .split(",")
        .map((item) => s(item))
        .filter(Boolean);

  const allContacts = [
    s(profile.primaryPhone),
    s(profile.primaryEmail),
    s(profile.primaryAddress),
    ...contacts,
  ].filter(Boolean);

  const resolvedContacts = allContacts.length
    ? allContacts
    : s(localAnswers.contacts)
        .split(",")
        .map((item) => s(item))
        .filter(Boolean);

  return {
    name,
    description,
    services: allServices,
    audience,
    contacts: resolvedContacts,
    pricing,
    handoff,
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

function DraftBubble({ draftModel, reviewReady, finalizing, onFinalize }) {
  const lines = [
    ["Business name", draftModel.name],
    ["What this business is", draftModel.description],
    ["Core services", listPreview(draftModel.services, 6)],
    ["Audience", draftModel.audience],
    ["Pricing posture", draftModel.pricing],
    ["Contact routes", listPreview(draftModel.contacts, 6)],
    ["Human handoff", draftModel.handoff],
  ].filter(([, value]) => s(value));

  return (
    <MessageBubble role="assistant" title="Draft">
      <div className="space-y-3">
        {lines.map(([label, value]) => (
          <div key={label}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              {label}
            </div>
            <div className="mt-1 text-[15px] leading-8 text-text">
              {value}
            </div>
          </div>
        ))}

        <div className="pt-2 text-[13px] leading-6 text-text-muted">
          Dəyişmək istədiyini yaz və ya təsdiqlə.
        </div>

        {reviewReady ? (
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
  const source = useMemo(
    () => buildCurrentSource(assistant, reviewPayload),
    [assistant, reviewPayload]
  );

  const [sourceSubmitted, setSourceSubmitted] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [composerValue, setComposerValue] = useState("");
  const [localError, setLocalError] = useState("");
  const [transcript, setTranscript] = useState([]);
  const [localAnswers, setLocalAnswers] = useState({});

  const busy = saving || finalizing || capturingSource;
  const currentQuestion = QUESTIONS[questionIndex] || null;
  const draftReady = sourceSubmitted && !currentQuestion;
  const reviewReady =
    assistant.review?.finalizeAvailable === true ||
    assistant.review?.readyForReview === true ||
    assistant.assistant?.completion?.ready === true;

  const draftModel = useMemo(
    () => buildDraftModel(assistant, reviewPayload, localAnswers),
    [assistant, reviewPayload, localAnswers]
  );

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript, currentQuestion, draftReady, busy, localError, errorMessage]);

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

  async function handleQuestionSubmit() {
    const text = s(composerValue);
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
            <MessageBubble
              key={item.id}
              role={item.role}
              body={item.text}
            />
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
            <DraftBubble
              draftModel={draftModel}
              reviewReady={reviewReady}
              finalizing={finalizing}
              onFinalize={onFinalize}
            />
          ) : null}

          {s(localError || errorMessage) ? (
            <MessageBubble
              role="assistant"
              body={localError || errorMessage}
            />
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