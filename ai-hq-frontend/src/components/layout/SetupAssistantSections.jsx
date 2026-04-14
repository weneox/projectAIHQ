import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  SETUP_INTERVIEW_QUESTIONS,
  SETUP_SOURCE_PROMPT,
} from "./setupInterviewQuestions.js";
import { resolveSetupSourceInput } from "./setupSourceIntake.js";

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

function groupLabel(group = "") {
  if (group === "operator_rules") return "Operator rules";
  return "Business truth";
}

function buildQuestionMetaMap() {
  return Object.fromEntries(
    SETUP_INTERVIEW_QUESTIONS.map((item) => [
      item.key,
      {
        step: item.step,
        placeholder: item.placeholder,
        title: item.title,
        prompt: item.prompt,
        group: item.group,
      },
    ])
  );
}

const QUESTION_META_MAP = buildQuestionMetaMap();

function uniqueStrings(items = [], max = 8) {
  return [...new Set(arr(items).map((item) => s(item)).filter(Boolean))].slice(
    0,
    max
  );
}

function buildCompactNotes(model = {}) {
  const confidence = obj(model.confidence);
  return uniqueStrings(
    [
      ...arr(confidence.unclear),
      ...arr(model.recommendationNotes),
      ...arr(confidence.contradictions),
    ],
    6
  );
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

  const hours = arr(draft.hours)
    .map((item) => {
      if (item?.allDay) return `${item.day} 24 hours`;
      if (item?.appointmentOnly) return `${item.day} appointment only`;
      if (item?.closed) return `${item.day} closed`;
      if (s(item?.notes)) return `${item.day} ${s(item.notes)}`;
      if (s(item?.openTime) || s(item?.closeTime)) {
        return `${item.day} ${s(item.openTime)}-${s(item.closeTime)}`;
      }
      return "";
    })
    .filter(Boolean);

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
    pricingPosture,
    contactRoutes: finalContacts,
    humanHandoff,
    hours: hours.length
      ? hours
      : s(localAnswers.hours)
          .split(/[,;\n]/)
          .map((item) => s(item))
          .filter(Boolean),
  };
}

function normalizeAssistantControl(reviewPayload = null, assistant = {}) {
  const primary = obj(reviewPayload?.assistant);
  const fallback = obj(assistant.assistant);
  const source = Object.keys(primary).length ? primary : fallback;

  return {
    nextQuestion: obj(source.nextQuestion),
    interviewPlan: obj(source.interviewPlan),
    aiBehavior: obj(source.aiBehavior),
    readyForApproval: source.readyForApproval === true,
  };
}

function buildFinalViewModel({ reviewPayload = null, assistant = {}, localAnswers = {} }) {
  const reviewAssistant = Object.keys(obj(reviewPayload?.assistant)).length
    ? obj(reviewPayload?.assistant)
    : obj(assistant.assistant);
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
    pricingPosture: s(draft.pricingPosture || fallback.pricingPosture),
    contactRoutes: arr(draft.contactRoutes).length
      ? arr(draft.contactRoutes)
      : arr(fallback.contactRoutes),
    humanHandoff: s(draft.humanHandoff || fallback.humanHandoff),
    hours: arr(draft.hours).length ? arr(draft.hours) : arr(fallback.hours),
  };

  const model = {
    message: s(reviewAssistant.message || reviewAssistant.assistantMessage),
    readyForApproval: reviewAssistant.readyForApproval === true,
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
      primarySourceAuthorityClass: s(sourceSignals.primarySourceAuthorityClass),
      pageCount: Number(sourceSignals.pageCount || 0) || 0,
      sourceTypes: arr(sourceSignals.sourceTypes),
      strongestEvidence: arr(sourceSignals.strongestEvidence),
      discoveredPublicClaims: arr(sourceSignals.discoveredPublicClaims),
    },
  };

  return {
    ...model,
    compactNotes: buildCompactNotes(model),
  };
}

function hasBackendSmartDraft(model = {}) {
  const sourceSignals = obj(model.sourceSignals);
  const draft = obj(model.draft);

  const hasMessage = Boolean(s(model.message));
  const hasSourceWork =
    Boolean(s(sourceSignals.primarySourceType)) ||
    Boolean(s(sourceSignals.primarySourceLabel)) ||
    Boolean(s(sourceSignals.primarySourceUrl)) ||
    Number(sourceSignals.pageCount || 0) > 0 ||
    arr(sourceSignals.sourceTypes).length > 0;

  const hasStructuredDraft =
    Boolean(s(draft.businessName)) ||
    Boolean(s(draft.whatThisBusinessIs)) ||
    arr(draft.coreServices).length > 0 ||
    Boolean(s(draft.pricingPosture)) ||
    arr(draft.contactRoutes).length > 0 ||
    Boolean(s(draft.humanHandoff));

  return hasStructuredDraft && (hasMessage || hasSourceWork || model.readyForApproval);
}

function buildProgressFromInterviewPlan(interviewPlan = {}, currentQuestion = null) {
  const activeQuestions = arr(interviewPlan.activeQuestions);
  if (!activeQuestions.length || !currentQuestion?.key) {
    return {
      label: groupLabel(currentQuestion?.group),
      position: 1,
      total: 1,
    };
  }

  const currentGroup = s(currentQuestion.group || activeQuestions[0]?.group);
  const groupQuestions = activeQuestions.filter(
    (item) => s(item.group) === currentGroup
  );
  const position =
    groupQuestions.findIndex((item) => s(item.key) === s(currentQuestion.key)) + 1;

  return {
    label: groupLabel(currentGroup),
    position: position > 0 ? position : 1,
    total: groupQuestions.length || 1,
  };
}

function bubbleClasses(role = "assistant") {
  if (role === "user") {
    return "bg-[linear-gradient(180deg,#0f172a,#020617)] text-white rounded-[26px] rounded-br-[10px] shadow-[0_18px_40px_rgba(2,6,23,0.22)]";
  }

  return "border border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.96))] text-text rounded-[26px] rounded-bl-[10px] shadow-[0_10px_30px_rgba(15,23,42,0.06)]";
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
      <div className={`max-w-[82%] px-4 py-3.5 ${bubbleClasses(role)}`}>
        {s(eyebrow) ? (
          <div
            className={`mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
              isUser ? "text-white/60" : "text-text-muted"
            }`}
          >
            {eyebrow}
          </div>
        ) : null}

        {s(title) ? (
          <div className="text-[20px] font-semibold tracking-[-0.04em]">
            {title}
          </div>
        ) : null}

        {s(body) ? (
          <div
            className={`whitespace-pre-wrap text-[15px] leading-7 ${
              title ? "mt-2" : ""
            } ${isUser ? "text-white/95" : "text-text"}`}
          >
            {body}
          </div>
        ) : null}

        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </div>
  );
}

function DraftRow({ label, value }) {
  return (
    <div className="rounded-[18px] border border-[rgba(15,23,42,0.06)] bg-[rgba(248,250,252,0.85)] px-3.5 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {label}
      </div>
      <div className="mt-1.5 text-[14px] leading-7 text-text">{value}</div>
    </div>
  );
}

function SmartDraftBubble({ model, finalizing, onFinalize }) {
  const draft = obj(model.draft);
  const sourceSignals = obj(model.sourceSignals);

  const draftRows = [
    ["Business name", draft.businessName],
    ["What the business is", draft.whatThisBusinessIs],
    ["Core services", listPreview(draft.coreServices, 6)],
    ["Pricing posture", draft.pricingPosture],
    ["Contact routes", listPreview(draft.contactRoutes, 6)],
    ["Availability", listPreview(draft.hours, 4)],
    ["Human handoff", draft.humanHandoff],
  ].filter(([, value]) => s(value));

  const sourceContextLine = [
    s(sourceSignals.primarySourceLabel),
    s(sourceSignals.primarySourceUrl),
  ]
    .filter(Boolean)
    .join(" · ");

  const sourceMetaLine = [
    Number(sourceSignals.pageCount || 0) > 0
      ? `${Number(sourceSignals.pageCount || 0)} pages`
      : "",
    arr(sourceSignals.sourceTypes).length
      ? listPreview(sourceSignals.sourceTypes, 4)
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <MessageBubble role="assistant" title="Draft">
      <div className="space-y-4">
        {s(model.message) ? (
          <div className="text-[14px] leading-7 text-text-muted whitespace-pre-wrap">
            {model.message}
          </div>
        ) : null}

        {sourceContextLine ? (
          <div className="rounded-[18px] border border-[rgba(15,23,42,0.06)] bg-[rgba(248,250,252,0.78)] px-3.5 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Source context
            </div>
            <div className="mt-1.5 text-[14px] leading-7 text-text">
              {sourceContextLine}
            </div>
            {sourceMetaLine ? (
              <div className="mt-1 text-[13px] leading-6 text-text-muted">
                {sourceMetaLine}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3">
          {draftRows.map(([label, value]) => (
            <DraftRow key={label} label={label} value={value} />
          ))}
        </div>

        {arr(model.compactNotes).length ? (
          <div className="rounded-[18px] border border-[rgba(15,23,42,0.06)] bg-[rgba(248,250,252,0.78)] px-3.5 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Follow-up notes
            </div>
            <div className="mt-2 space-y-1.5 text-[14px] leading-7 text-text">
              {arr(model.compactNotes).map((item) => (
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
            className="inline-flex h-11 items-center rounded-full bg-slate-950 px-5 text-[12px] font-semibold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
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
    <div className="border-t border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.98))] px-5 py-4">
      <div className="rounded-[28px] border border-[rgba(15,23,42,0.08)] bg-white px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="flex items-end gap-3">
          <textarea
            rows={3}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
            placeholder={placeholder}
            className="min-h-[92px] w-full resize-none bg-transparent px-0 py-1 text-[15px] leading-7 text-text outline-none placeholder:text-text-subtle"
          />

          <button
            type="button"
            onClick={onSubmit}
            disabled={!s(value) || busy}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-slate-950 px-5 text-[12px] font-semibold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            <span>{buttonLabel}</span>
          </button>
        </div>
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
  const [composerValue, setComposerValue] = useState("");
  const [localError, setLocalError] = useState("");
  const [transcript, setTranscript] = useState([]);
  const [localAnswers, setLocalAnswers] = useState({});

  const busy = saving || finalizing || capturingSource;

  const finalModel = useMemo(
    () =>
      buildFinalViewModel({
        reviewPayload,
        assistant,
        localAnswers,
      }),
    [reviewPayload, assistant, localAnswers]
  );

  const assistantControl = useMemo(
    () => normalizeAssistantControl(reviewPayload, assistant),
    [reviewPayload, assistant]
  );

  const smartDraftReady = useMemo(
    () => hasBackendSmartDraft(finalModel),
    [finalModel]
  );

  const currentQuestion = useMemo(() => {
    const nextQuestion = obj(assistantControl.nextQuestion);
    if (!sourceSubmitted) return null;
    if (!s(nextQuestion.key) || !s(nextQuestion.prompt)) return null;

    const meta = obj(QUESTION_META_MAP[nextQuestion.key]);

    return {
      key: s(nextQuestion.key),
      step: s(nextQuestion.step || meta.step || nextQuestion.key),
      title: s(nextQuestion.title || meta.title),
      prompt: s(nextQuestion.prompt || meta.prompt),
      group: s(nextQuestion.group || meta.group),
      placeholder: s(meta.placeholder),
    };
  }, [assistantControl.nextQuestion, sourceSubmitted]);

  const questionsFinished =
    sourceSubmitted &&
    !currentQuestion &&
    (assistantControl.readyForApproval === true || smartDraftReady);

  const currentGroupProgress = useMemo(
    () =>
      buildProgressFromInterviewPlan(
        assistantControl.interviewPlan,
        currentQuestion
      ),
    [assistantControl.interviewPlan, currentQuestion]
  );

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [
    transcript,
    currentQuestion,
    questionsFinished,
    busy,
    localError,
    errorMessage,
    finalModel,
    smartDraftReady,
  ]);

  async function handleInitialSourceSubmit() {
    const text = s(composerValue);
    if (!text || busy) return;

    const resolvedSource = resolveSetupSourceInput(text);

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

    try {
      await onCaptureSource?.({
        type: resolvedSource.type,
        value: resolvedSource.value,
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

  const questionPrompt = currentQuestion
    ? `${currentQuestion.title}\n${currentQuestion.prompt}`
    : "";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,#ffffff,#f8fafc)]">
      <div ref={scrollRef} className="flex-1 overflow-auto px-5 py-5">
        <div className="space-y-4">
          <MessageBubble role="assistant" body={SETUP_SOURCE_PROMPT} />

          {transcript.map((item) => (
            <MessageBubble
              key={item.id}
              role={item.role}
              eyebrow={item.eyebrow}
              body={item.text || item.body}
            />
          ))}

          {sourceSubmitted && currentQuestion ? (
            <MessageBubble
              role="assistant"
              eyebrow={`${currentGroupProgress.label} · ${currentGroupProgress.position}/${currentGroupProgress.total}`}
              body={questionPrompt}
            />
          ) : null}

          {busy ? <MessageBubble role="assistant" body="..." /> : null}

          {sourceSubmitted && !currentQuestion && !questionsFinished ? (
            <MessageBubble
              role="assistant"
              eyebrow="Thinking"
              body="Mənbələr və cavabların birlikdə analiz olunur. Növbəti sual hazırlanır..."
            />
          ) : null}

          {questionsFinished && !smartDraftReady ? (
            <MessageBubble
              role="assistant"
              eyebrow="Thinking"
              body="Mənbələr və cavabların birlikdə analiz olunur. Yekun draft hazırlanır..."
            />
          ) : null}

          {questionsFinished && smartDraftReady ? (
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
          placeholder="Website və ya source link yaz"
          buttonLabel="Continue"
          onChange={setComposerValue}
          onSubmit={handleInitialSourceSubmit}
        />
      ) : null}

      {sourceSubmitted && currentQuestion ? (
        <Composer
          value={composerValue}
          busy={busy}
          placeholder={currentQuestion.placeholder || "Cavabını yaz"}
          buttonLabel="Continue"
          onChange={setComposerValue}
          onSubmit={handleQuestionSubmit}
        />
      ) : null}

      {questionsFinished && smartDraftReady ? (
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