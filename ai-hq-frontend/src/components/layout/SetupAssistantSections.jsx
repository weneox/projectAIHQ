import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  SETUP_INTERVIEW_QUESTIONS,
  SETUP_SOURCE_PROMPT,
} from "./setupInterviewQuestions.js";
import { resolveSetupSourceInput } from "./setupSourceIntake.js";

const TIMELINE_STORAGE_PREFIX = "setup_assistant_timeline";

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

function uniqueStrings(items = [], max = 12) {
  return [...new Set(arr(items).map((item) => s(item)).filter(Boolean))].slice(
    0,
    max
  );
}

function listPreview(items = [], max = 6) {
  const safe = uniqueStrings(
    arr(items).map((item) =>
      typeof item === "string" ? compactText(item, 80) : compactText(String(item), 80)
    ),
    24
  );

  if (!safe.length) return "";
  if (safe.length <= max) return safe.join(", ");
  return `${safe.slice(0, max).join(", ")} +${safe.length - max}`;
}

function groupLabel(group = "") {
  if (group === "operator_rules" || group === "ai_behavior") {
    return "AI behavior";
  }
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

function buildCompactNotes(model = {}) {
  const confidence = obj(model.confidence);
  const recommendation = obj(model.recommendation);

  return uniqueStrings(
    [
      ...arr(confidence.unclear),
      ...arr(recommendation.notes),
      ...arr(confidence.contradictions),
    ],
    6
  );
}

function buildFallbackDraft(reviewPayload = null, assistant = {}, localAnswers = {}) {
  const review = obj(reviewPayload?.review || reviewPayload);
  const reviewDraft = obj(review.draft);
  const assistantRoot = obj(assistant);
  const assistantDraft = obj(obj(assistantRoot.assistant).draft);
  const setupDraft = obj(assistantRoot.draft);
  const profile = obj(reviewDraft.businessProfile);

  const services = arr(reviewDraft.services)
    .map((item) => s(item.title || item.name || item.label))
    .filter(Boolean);

  const contacts = arr(reviewDraft.contacts)
    .map((item) => s(item.label || item.channel || item.value || item.type))
    .filter(Boolean);

  const businessName = s(
    profile.companyName ||
      obj(setupDraft.businessProfile).companyName ||
      assistantDraft.businessName ||
      localAnswers.company
  );

  const description = s(
    profile.description ||
      obj(setupDraft.businessProfile).description ||
      assistantDraft.whatThisBusinessIs ||
      localAnswers.description
  );

  const pricingPosture = s(
    obj(setupDraft.pricingPosture).publicSummary ||
      assistantDraft.pricingPosture ||
      localAnswers.pricing
  );

  const humanHandoff = s(
    obj(setupDraft.handoffRules).summary ||
      assistantDraft.humanHandoff ||
      localAnswers.handoff
  );

  const hours = arr(setupDraft.hours)
    .map((item) => {
      if (item?.allDay) return `${item.day} 24/7`;
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
    : arr(assistantDraft.coreServices).length
      ? arr(assistantDraft.coreServices)
      : s(localAnswers.services)
          .split(/[,;\n]/)
          .map((item) => s(item))
          .filter(Boolean);

  const resolvedContacts = [
    s(profile.primaryPhone),
    s(profile.primaryEmail),
    ...contacts,
    ...arr(assistantDraft.contactRoutes),
  ].filter(Boolean);

  const finalContacts = resolvedContacts.length
    ? uniqueStrings(resolvedContacts, 10)
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
      : arr(assistantDraft.hours).length
        ? arr(assistantDraft.hours)
        : s(localAnswers.hours)
            .split(/[,;\n]/)
            .map((item) => s(item))
            .filter(Boolean),
    websiteUrl: s(
      assistantDraft.websiteUrl || obj(setupDraft.businessProfile).websiteUrl
    ),
    languages: arr(assistantDraft.languages),
    tone: s(assistantDraft.tone),
    greetingStyle: s(assistantDraft.greetingStyle),
    afterHoursBehavior: s(assistantDraft.afterHoursBehavior),
  };
}

function normalizeAssistantControl(reviewPayload = null, assistant = {}) {
  const primary = obj(reviewPayload?.assistant);
  const fallback = obj(obj(assistant).assistant);
  const source = Object.keys(primary).length ? primary : fallback;
  const nextQuestion = obj(source.nextQuestion);
  const activeQuestions = arr(obj(source.interviewPlan).activeQuestions);
  const fallbackQuestion =
    !s(nextQuestion.key) && activeQuestions.length ? obj(activeQuestions[0]) : {};

  return {
    nextQuestion: s(nextQuestion.key) ? nextQuestion : fallbackQuestion,
    interviewPlan: obj(source.interviewPlan),
    readyForApproval: source.readyForApproval === true,
    draftVersion: Number(source.draftVersion || 0),
    phase: s(source.phase),
    message: s(source.message || source.assistantMessage),
    provider: s(source.provider),
    model: s(source.model),
    usedFallback: source.usedFallback === true,
    error: s(source.error),
    rejectedInputs: arr(source.rejectedInputs),
  };
}

function buildFinalViewModel({ reviewPayload = null, assistant = {}, localAnswers = {} }) {
  const reviewAssistant = Object.keys(obj(reviewPayload?.assistant)).length
    ? obj(reviewPayload?.assistant)
    : obj(obj(assistant).assistant);
  const recommendation = obj(reviewAssistant.recommendation);
  const confidence = obj(reviewAssistant.confidence);
  const sourceSignals = obj(reviewAssistant.sourceSignals);
  const draft = obj(reviewAssistant.draft);
  const fallback = buildFallbackDraft(reviewPayload, assistant, localAnswers);

  const resolvedDraft = {
    businessName: s(draft.businessName || fallback.businessName),
    whatThisBusinessIs: s(draft.whatThisBusinessIs || fallback.whatThisBusinessIs),
    websiteUrl: s(draft.websiteUrl || fallback.websiteUrl),
    coreServices: arr(draft.coreServices).length
      ? arr(draft.coreServices)
      : arr(fallback.coreServices),
    pricingPosture: s(draft.pricingPosture || fallback.pricingPosture),
    contactRoutes: arr(draft.contactRoutes).length
      ? arr(draft.contactRoutes)
      : arr(fallback.contactRoutes),
    humanHandoff: s(draft.humanHandoff || fallback.humanHandoff),
    hours: arr(draft.hours).length ? arr(draft.hours) : arr(fallback.hours),
    languages: arr(draft.languages).length
      ? arr(draft.languages)
      : arr(fallback.languages),
    tone: s(draft.tone || fallback.tone),
    greetingStyle: s(draft.greetingStyle || fallback.greetingStyle),
    afterHoursBehavior: s(
      draft.afterHoursBehavior || fallback.afterHoursBehavior
    ),
  };

  const model = {
    message: s(reviewAssistant.message || reviewAssistant.assistantMessage),
    readyForApproval: reviewAssistant.readyForApproval === true,
    draftVersion: Number(reviewAssistant.draftVersion || 0),
    phase: s(reviewAssistant.phase),
    provider: s(reviewAssistant.provider),
    model: s(reviewAssistant.model),
    usedFallback: reviewAssistant.usedFallback === true,
    error: s(reviewAssistant.error),
    rejectedInputs: arr(reviewAssistant.rejectedInputs),
    draft: resolvedDraft,
    confidence: {
      strong: arr(confidence.strong),
      unclear: arr(confidence.unclear),
      contradictions: arr(confidence.contradictions),
    },
    recommendation,
    sourceSignals: {
      primarySourceType: s(sourceSignals.primarySourceType),
      primarySourceLabel: s(sourceSignals.primarySourceLabel),
      primarySourceUrl: s(sourceSignals.primarySourceUrl),
      primarySourceAuthorityClass: s(sourceSignals.primarySourceAuthorityClass),
      pageCount: Number(sourceSignals.pageCount || 0) || 0,
      sourceTypes: arr(sourceSignals.sourceTypes),
      strongestEvidence: arr(sourceSignals.strongestEvidence),
      discoveredPublicClaims: arr(sourceSignals.discoveredPublicClaims),
      companyNameCandidates: arr(sourceSignals.companyNameCandidates),
      descriptionCandidates: arr(sourceSignals.descriptionCandidates),
      serviceCandidates: arr(sourceSignals.serviceCandidates),
      contactCandidates: arr(sourceSignals.contactCandidates),
      hoursCandidates: arr(sourceSignals.hoursCandidates),
      pricingCandidates: arr(sourceSignals.pricingCandidates),
    },
  };

  return {
    ...model,
    compactNotes: buildCompactNotes(model),
  };
}

function hasBackendSmartDraft(model = {}) {
  const draft = obj(model.draft);

  const hasStructuredDraft =
    Boolean(s(draft.businessName)) &&
    Boolean(s(draft.whatThisBusinessIs)) &&
    arr(draft.coreServices).length > 0 &&
    arr(draft.contactRoutes).length > 0 &&
    Boolean(s(draft.pricingPosture)) &&
    Boolean(s(draft.humanHandoff));

  return model.readyForApproval === true && hasStructuredDraft;
}

function buildProgressLabel(currentQuestion = null) {
  const group = s(currentQuestion?.group);
  if (!group) return "";
  return groupLabel(group);
}

function getTimelineStorageKey(storageKey = "") {
  return `${TIMELINE_STORAGE_PREFIX}:${s(storageKey, "default")}`;
}

function loadStoredTimeline(storageKey = "") {
  try {
    const raw = window.sessionStorage.getItem(getTimelineStorageKey(storageKey));
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredTimeline(storageKey = "", timeline = []) {
  try {
    window.sessionStorage.setItem(
      getTimelineStorageKey(storageKey),
      JSON.stringify(timeline)
    );
  } catch {
    return;
  }
}

function bubbleClasses(role = "assistant") {
  if (role === "user") {
    return "bg-[linear-gradient(180deg,#2563eb,#1d4ed8)] text-white rounded-[26px] rounded-br-[10px] shadow-[0_18px_40px_rgba(37,99,235,0.28)]";
  }

  return "border border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.97))] text-text rounded-[26px] rounded-bl-[10px] shadow-[0_10px_30px_rgba(15,23,42,0.06)]";
}

const bubbleMotion = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.28,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

function MessageBubble({
  role = "assistant",
  eyebrow = "",
  title = "",
  body = "",
  children = null,
  animate = true,
}) {
  const isUser = role === "user";

  const content = (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[82%] px-4 py-3.5 ${bubbleClasses(role)}`}>
        {s(eyebrow) ? (
          <div
            className={`mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
              isUser ? "text-white/65" : "text-text-muted"
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

  if (!animate) return content;

  return (
    <motion.div variants={bubbleMotion} initial="hidden" animate="visible">
      {content}
    </motion.div>
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

function MetaPill({ children }) {
  return (
    <div className="inline-flex items-center rounded-full border border-[rgba(15,23,42,0.07)] bg-[rgba(248,250,252,0.9)] px-2.5 py-1 text-[11px] font-medium text-text-muted">
      {children}
    </div>
  );
}

function SmartDraftBubble({ model, finalizing, onFinalize }) {
  const draft = obj(model.draft);
  const sourceSignals = obj(model.sourceSignals);
  const recommendation = obj(model.recommendation);

  const draftRows = [
    ["Business name", draft.businessName],
    ["What the business is", draft.whatThisBusinessIs],
    ["Website", draft.websiteUrl],
    ["Core services", listPreview(draft.coreServices, 6)],
    ["Pricing posture", draft.pricingPosture],
    ["Contact routes", listPreview(draft.contactRoutes, 6)],
    ["Availability", listPreview(draft.hours, 4)],
    ["Human handoff", draft.humanHandoff],
    ["Languages", listPreview(draft.languages, 4)],
    ["Tone", draft.tone],
    ["Greeting style", draft.greetingStyle],
    ["After-hours behavior", draft.afterHoursBehavior],
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

  const rejectedInputs = arr(model.rejectedInputs)
    .map((item) => ({
      input: s(item.input),
      reason: s(item.reason),
    }))
    .filter((item) => item.input || item.reason)
    .slice(0, 3);

  return (
    <MessageBubble role="assistant" title="Draft" animate>
      <div className="space-y-4">
        {s(model.message) ? (
          <div className="text-[14px] leading-7 text-text-muted whitespace-pre-wrap">
            {model.message}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {s(model.provider) ? (
            <MetaPill>
              {model.usedFallback ? "Fallback" : "Brain"} · {model.provider}
            </MetaPill>
          ) : null}
          {s(model.model) ? <MetaPill>{model.model}</MetaPill> : null}
        </div>

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

        {rejectedInputs.length ? (
          <div className="rounded-[18px] border border-[rgba(15,23,42,0.06)] bg-[rgba(248,250,252,0.78)] px-3.5 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Not accepted
            </div>
            <div className="mt-2 space-y-2 text-[14px] leading-7 text-text">
              {rejectedInputs.map((item) => (
                <div key={`${item.input}|${item.reason}`}>
                  <div>{item.input}</div>
                  {item.reason ? (
                    <div className="text-[13px] text-text-muted">{item.reason}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {arr(recommendation.notes).length ? (
          <div className="rounded-[18px] border border-[rgba(15,23,42,0.06)] bg-[rgba(248,250,252,0.78)] px-3.5 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Recommendation
            </div>
            <div className="mt-2 space-y-1.5 text-[14px] leading-7 text-text">
              {arr(recommendation.notes).slice(0, 3).map((item) => (
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

function TypingBubble() {
  return (
    <motion.div
      variants={bubbleMotion}
      initial="hidden"
      animate="visible"
      className="flex justify-start"
    >
      <div className="rounded-[22px] rounded-bl-[10px] border border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.97))] px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse [animation-delay:120ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse [animation-delay:240ms]" />
        </div>
      </div>
    </motion.div>
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
  const disabled = !s(value) || busy;

  return (
    <div className="bg-transparent px-5 pb-5 pt-3">
      <div className="rounded-[34px] border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] px-4 py-4 shadow-[0_16px_50px_rgba(15,23,42,0.07)]">
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
            className="min-h-[92px] flex-1 resize-none appearance-none border-0 bg-transparent px-2 py-2 text-[15px] leading-7 text-text shadow-none outline-none ring-0 placeholder:text-text-subtle focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            style={{ boxShadow: "none" }}
          />

          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled}
            aria-label={buttonLabel}
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all ${
              disabled
                ? "bg-[rgba(15,23,42,0.12)] text-white/80 shadow-none"
                : "bg-[linear-gradient(180deg,#0f172a,#020617)] text-white shadow-[0_16px_34px_rgba(2,6,23,0.22)] hover:scale-[1.03]"
            }`}
          >
            {busy ? (
              <LoaderCircle className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <ArrowUp className="h-4.5 w-4.5" strokeWidth={2.4} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function hasExistingSetupProgress({ assistant, reviewPayload, finalModel }) {
  const reviewDraft = obj(reviewPayload?.review?.draft || reviewPayload?.draft);
  const reviewProfile = obj(reviewDraft.businessProfile);
  const reviewSourceMetadata = obj(reviewDraft.sourceMetadata);

  const assistantRoot = obj(assistant);
  const assistantDraft = obj(assistantRoot.draft);
  const assistantProfile = obj(assistantDraft.businessProfile);
  const assistantSourceMetadata = obj(assistantDraft.sourceMetadata);

  return Boolean(
    s(reviewProfile.websiteUrl) ||
      s(assistantProfile.websiteUrl) ||
      s(reviewSourceMetadata.primarySourceUrl) ||
      s(assistantSourceMetadata.primarySourceUrl) ||
      s(reviewSourceMetadata.primarySourceType) ||
      s(assistantSourceMetadata.primarySourceType) ||
      s(finalModel.draft.businessName) ||
      s(finalModel.draft.whatThisBusinessIs) ||
      arr(finalModel.draft.coreServices).length
  );
}

function buildQuestionSignature(question = {}, draftVersion = 0) {
  return [
    "question",
    Number(draftVersion || 0),
    s(question.key),
    s(question.prompt),
  ].join("|");
}

function buildDraftSignature(model = {}) {
  return JSON.stringify({
    type: "draft",
    draftVersion: Number(model.draftVersion || 0),
    readyForApproval: model.readyForApproval === true,
    message: s(model.message),
    draft: obj(model.draft),
    notes: arr(model.compactNotes),
    provider: s(model.provider),
    usedFallback: model.usedFallback === true,
  });
}

function buildStatusSignature(message = "", draftVersion = 0) {
  return ["status", Number(draftVersion || 0), s(message)].join("|");
}

function buildGreetingSignature(storageKey = "", mode = "fresh") {
  return `greeting|${s(storageKey, "default")}|${s(mode, "fresh")}`;
}

function buildGreetingTimelineItem({
  storageKey = "",
  continueMode = false,
}) {
  return {
    id: `assistant-greeting-${s(storageKey, "default")}`,
    type: "message",
    role: "assistant",
    signature: buildGreetingSignature(
      storageKey,
      continueMode ? "continue" : "fresh"
    ),
    eyebrow: "Setup",
    title: continueMode ? "Salam" : "Salam, başlayaq",
    body: continueMode
      ? "Mövcud setup draftına baxdım. Gəl bunu səliqəli şəkildə tamamlayıq — mən hər dəfə yalnız bir vacib şeyi soruşacağam."
      : "Sənin biznesini düzgün qurmaq üçün əvvəl əsas məlumatı yığaq. Bir source və ya qısa qeyd göndər, mən də bunu addım-addım təmiz şəkildə formalaşdırım.",
  };
}

function buildQuestionTimelineItem(question = {}, draftVersion = 0) {
  const questionKey = s(question.key).toLowerCase();
  if (!questionKey || !s(question.prompt)) return null;

  const meta = obj(QUESTION_META_MAP[questionKey]);

  return {
    id: `assistant-question-${questionKey}-${draftVersion || Date.now()}`,
    type: "message",
    role: "assistant",
    signature: buildQuestionSignature(question, draftVersion),
    eyebrow: buildProgressLabel({
      group: s(question.group || meta.group),
    }),
    title: s(question.title || meta.title),
    body: s(question.prompt || meta.prompt),
    step: s(question.step || meta.step || questionKey),
  };
}

function buildDraftTimelineItem(model = {}) {
  if (!hasBackendSmartDraft(model)) return null;

  return {
    id: `assistant-draft-${Date.now()}`,
    type: "draft",
    role: "assistant",
    signature: buildDraftSignature(model),
    model,
  };
}

function buildFallbackAssistantItem(model = {}) {
  const body = s(model.message);
  if (!body || model.readyForApproval === true) return null;

  return {
    id: `assistant-status-${Date.now()}`,
    type: "message",
    role: "assistant",
    signature: buildStatusSignature(body, model.draftVersion),
    eyebrow: "Setup",
    title: "Let’s keep going",
    body,
  };
}

function appendTimelineItem(current = [], item = null) {
  if (!item) return current;

  if (
    s(item.signature) &&
    current.some((entry) => s(entry.signature) === s(item.signature))
  ) {
    return current;
  }

  return [...current, item];
}

function hasTimelineSignature(timeline = [], signature = "") {
  const safeSignature = s(signature);
  if (!safeSignature) return false;
  return timeline.some((item) => s(item.signature) === safeSignature);
}

function isAssistantQuestionItem(item = {}) {
  return item?.role === "assistant" && Boolean(s(item?.step));
}

function pruneQuestionHistoryForDraft(timeline = []) {
  return timeline.filter((item) => !isAssistantQuestionItem(item));
}

function commitAssistantQuestion(current = [], question = null, draftVersion = 0) {
  const item = buildQuestionTimelineItem(question, draftVersion);
  if (!item) return current;
  return appendTimelineItem(current, item);
}

function isContinueStyleAnswer(value = "") {
  const text = s(value).toLowerCase();
  return [
    "ok",
    "okay",
    "ok davam",
    "davam",
    "continue",
    "next",
    "beli",
    "bəli",
    "he",
    "hə",
    "oldu",
    "tamam",
  ].includes(text);
}

function looksLikeUrlOrDomain(value = "") {
  const text = s(value);
  if (!text) return false;
  return (
    /^https?:\/\//i.test(text) ||
    /^(www\.)?[a-z0-9-]+\.[a-z]{2,}(\/.*)?$/i.test(text)
  );
}

function looksLikePhone(value = "") {
  return /(?:\+?\d[\d()\-\s]{6,}\d)/.test(s(value));
}

function looksLikeEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(s(value));
}

function looksLikeHoursText(value = "") {
  const text = s(value).toLowerCase();
  if (!text) return false;
  return (
    /(mon|tue|wed|thu|fri|sat|sun|b\.e|be|cümə|şənbə|bazar)/.test(text) ||
    /\b\d{1,2}[:.]?\d{0,2}\s*(?:-|to|dan|den|dek|qeder)\s*\d{1,2}[:.]?\d{0,2}\b/.test(
      text
    ) ||
    /\bclosed\b/.test(text) ||
    /\b24\/7\b/.test(text) ||
    /\bappointment\b/.test(text)
  );
}

function looksLikePricingText(value = "") {
  const text = s(value).toLowerCase();
  if (!text) return false;
  return (
    /(azn|usd|eur|gbp|\$|€|₼|£)/.test(text) ||
    /\bprice\b/.test(text) ||
    /\bpricing\b/.test(text) ||
    /\bquote\b/.test(text) ||
    /\bstarting\b/.test(text) ||
    /\bbaşlayır\b/.test(text) ||
    /\bqiymət\b/.test(text)
  );
}

function resolveFreeformStepFromText(value = "", fallbackStep = "profile") {
  const text = s(value);
  const lowerText = text.toLowerCase();

  if (looksLikeUrlOrDomain(text)) return "website";
  if (
    looksLikePhone(text) ||
    looksLikeEmail(text) ||
    /whatsapp|telegram|contact/i.test(lowerText)
  ) {
    return "contacts";
  }
  if (looksLikeHoursText(text)) return "hours";
  if (looksLikePricingText(text)) return "pricing";
  if (/şikayət|complaint|refund|payment|operator|handoff|escalat/i.test(lowerText)) {
    return "handoff";
  }
  if (/[,\n;]/.test(text) && text.split(/[,;\n]/).filter((item) => s(item)).length >= 2) {
    return "services";
  }
  if (text.split(/\s+/).filter(Boolean).length <= 4) {
    return "company";
  }

  return s(fallbackStep, "profile");
}

export default function SetupAssistantSections({
  storageKey = "default",
  sessionHydrated = false,
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
  const bootSequenceStartedRef = useRef(false);

  const [composerValue, setComposerValue] = useState("");
  const [localError, setLocalError] = useState("");
  const [timeline, setTimeline] = useState(() => loadStoredTimeline(storageKey));
  const [localAnswers, setLocalAnswers] = useState({});
  const [awaitingAssistant, setAwaitingAssistant] = useState(false);
  const [suppressedQuestionSignature, setSuppressedQuestionSignature] = useState("");
  const [bootTyping, setBootTyping] = useState(false);

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

  const smartDraftReady = useMemo(
    () => hasBackendSmartDraft(finalModel),
    [finalModel]
  );

  const assistantControl = useMemo(
    () => normalizeAssistantControl(reviewPayload, assistant),
    [reviewPayload, assistant]
  );

  const rawCurrentQuestion = useMemo(() => {
    const nextQuestion = obj(assistantControl.nextQuestion);
    if (!s(nextQuestion.key)) return null;

    const meta = obj(QUESTION_META_MAP[nextQuestion.key]);
    const prompt = s(nextQuestion.prompt || meta.prompt);
    if (!prompt) return null;

    return {
      key: s(nextQuestion.key),
      step: s(nextQuestion.step || meta.step || nextQuestion.key),
      title: s(nextQuestion.title || meta.title),
      prompt,
      group: s(nextQuestion.group || meta.group),
      placeholder: s(nextQuestion.placeholder || meta.placeholder),
    };
  }, [assistantControl.nextQuestion]);

  const hasExistingProgress = useMemo(
    () =>
      hasExistingSetupProgress({
        assistant,
        reviewPayload,
        finalModel,
      }),
    [assistant, reviewPayload, finalModel]
  );

  const currentQuestionSignature = useMemo(() => {
    if (!rawCurrentQuestion) return "";
    return buildQuestionSignature(rawCurrentQuestion, assistantControl.draftVersion);
  }, [rawCurrentQuestion, assistantControl.draftVersion]);

  const effectiveSuppressedQuestionSignature = useMemo(() => {
    if (!currentQuestionSignature) return "";
    return suppressedQuestionSignature === currentQuestionSignature
      ? suppressedQuestionSignature
      : "";
  }, [currentQuestionSignature, suppressedQuestionSignature]);

  const hasGreetingInTimeline = useMemo(() => {
    return timeline.some((item) => String(item?.signature || "").startsWith("greeting|"));
  }, [timeline]);

  const renderedTimeline = timeline;

  const sourceSubmitted =
    renderedTimeline.some((item) => item.role === "user") ||
    hasExistingProgress ||
    Boolean(rawCurrentQuestion) ||
    assistantControl.readyForApproval === true ||
    smartDraftReady;

  const currentQuestion =
    sourceSubmitted && assistantControl.readyForApproval !== true
      ? rawCurrentQuestion
      : null;

  const questionsFinished =
    sourceSubmitted &&
    assistantControl.readyForApproval === true &&
    smartDraftReady;

  const needsFallbackContinue =
    sourceSubmitted &&
    !currentQuestion &&
    !questionsFinished &&
    !awaitingAssistant;

  const bootSequencePending =
    sessionHydrated && renderedTimeline.length === 0 && !hasGreetingInTimeline;

  useEffect(() => {
    if (!sessionHydrated) return;
    if (renderedTimeline.length > 0) return;
    if (bootSequenceStartedRef.current) return;

    bootSequenceStartedRef.current = true;

    const continueMode =
      hasExistingProgress ||
      Boolean(rawCurrentQuestion) ||
      assistantControl.readyForApproval === true ||
      smartDraftReady;

    const greetingItem = buildGreetingTimelineItem({
      storageKey,
      continueMode,
    });

    const initialQuestionItem =
      rawCurrentQuestion && assistantControl.readyForApproval !== true
        ? buildQuestionTimelineItem(rawCurrentQuestion, assistantControl.draftVersion)
        : null;

    const typingTimer = window.setTimeout(() => {
      setBootTyping(true);
    }, 0);

    const greetingTimer = window.setTimeout(() => {
      setTimeline((current) => appendTimelineItem(current, greetingItem));
      setBootTyping(false);
    }, 420);

    const questionTimer = initialQuestionItem
      ? window.setTimeout(() => {
          setTimeline((current) => appendTimelineItem(current, initialQuestionItem));
        }, 760)
      : null;

    return () => {
      window.clearTimeout(typingTimer);
      window.clearTimeout(greetingTimer);
      if (questionTimer) window.clearTimeout(questionTimer);
    };
  }, [
    sessionHydrated,
    renderedTimeline.length,
    hasExistingProgress,
    rawCurrentQuestion,
    assistantControl.readyForApproval,
    assistantControl.draftVersion,
    smartDraftReady,
    storageKey,
  ]);

  const liveQuestionItem = useMemo(() => {
    if (!currentQuestion) return null;
    if (bootSequencePending) return null;

    const item = buildQuestionTimelineItem(
      currentQuestion,
      assistantControl.draftVersion
    );

    if (!item) return null;

    if (
      s(item.signature) &&
      s(item.signature) === s(effectiveSuppressedQuestionSignature)
    ) {
      return null;
    }

    return hasTimelineSignature(timeline, item.signature) ? null : item;
  }, [
    currentQuestion,
    assistantControl.draftVersion,
    timeline,
    effectiveSuppressedQuestionSignature,
    bootSequencePending,
  ]);

  const liveDraftItem = useMemo(() => {
    if (!questionsFinished || !smartDraftReady) return null;

    const item = buildDraftTimelineItem(finalModel);
    if (!item) return null;
    return hasTimelineSignature(timeline, item.signature) ? null : item;
  }, [questionsFinished, smartDraftReady, finalModel, timeline]);

  const liveFallbackAssistantItem = useMemo(() => {
    if (!needsFallbackContinue) return null;
    if (bootSequencePending) return null;

    const item = buildFallbackAssistantItem(finalModel);
    if (!item) return null;
    return hasTimelineSignature(timeline, item.signature) ? null : item;
  }, [needsFallbackContinue, finalModel, timeline, bootSequencePending]);

  const lastAssistantQuestionStep = useMemo(() => {
    const reversed = [...renderedTimeline].reverse();
    const questionItem = reversed.find(
      (item) => item.role === "assistant" && s(item.step)
    );
    return s(questionItem?.step, "profile");
  }, [renderedTimeline]);

  useEffect(() => {
    saveStoredTimeline(storageKey, timeline);
  }, [storageKey, timeline]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [
    renderedTimeline,
    awaitingAssistant,
    bootTyping,
    localError,
    errorMessage,
    liveQuestionItem,
    liveDraftItem,
    liveFallbackAssistantItem,
  ]);

  useEffect(() => {
    if (!liveQuestionItem) return;

    const timer = window.setTimeout(() => {
      setTimeline((current) => appendTimelineItem(current, liveQuestionItem));
      setAwaitingAssistant(false);
    }, awaitingAssistant ? 220 : 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [liveQuestionItem, awaitingAssistant]);

  useEffect(() => {
    if (!liveDraftItem) return;

    const timer = window.setTimeout(() => {
      setTimeline((current) =>
        appendTimelineItem(pruneQuestionHistoryForDraft(current), liveDraftItem)
      );
      setAwaitingAssistant(false);
    }, awaitingAssistant ? 220 : 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [liveDraftItem, awaitingAssistant]);

  useEffect(() => {
    if (!liveFallbackAssistantItem) return;

    const timer = window.setTimeout(() => {
      setTimeline((current) =>
        appendTimelineItem(current, liveFallbackAssistantItem)
      );
      setAwaitingAssistant(false);
    }, awaitingAssistant ? 220 : 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [liveFallbackAssistantItem, awaitingAssistant]);

  useEffect(() => {
    if (!s(localError || errorMessage)) return;

    const timer = window.setTimeout(() => {
      setAwaitingAssistant(false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [localError, errorMessage]);

  async function handleInitialSourceSubmit() {
    const text = s(composerValue);
    if (!text || busy) return;

    const resolvedSource = resolveSetupSourceInput(text);

    setLocalError("");
    setAwaitingAssistant(true);

    setTimeline((current) =>
      appendTimelineItem(current, {
        id: `source-${Date.now()}`,
        type: "message",
        role: "user",
        body: text,
      })
    );

    setComposerValue("");

    try {
      await onCaptureSource?.({
        type: resolvedSource.type,
        value: resolvedSource.value,
      });
    } catch (error) {
      setLocalError(s(error?.message, "Source intake failed."));
      setAwaitingAssistant(false);
    }
  }

  async function handleQuestionSubmit(textValue = composerValue) {
    const text = s(textValue);
    if (!text || busy || !currentQuestion) return;

    const requestText = isContinueStyleAnswer(text) ? "Let's continue." : text;
    const currentSignature = buildQuestionSignature(
      currentQuestion,
      assistantControl.draftVersion
    );

    setLocalError("");
    setAwaitingAssistant(true);
    setSuppressedQuestionSignature(currentSignature);

    setTimeline((current) =>
      appendTimelineItem(
        commitAssistantQuestion(
          current,
          currentQuestion,
          assistantControl.draftVersion
        ),
        {
          id: `answer-${currentQuestion.key}-${Date.now()}`,
          type: "message",
          role: "user",
          body: text,
        }
      )
    );

    setLocalAnswers((current) => ({
      ...current,
      [currentQuestion.key]: text,
    }));

    setComposerValue("");

    try {
      await onParseMessage?.({
        step: currentQuestion.step,
        text: requestText,
      });
    } catch (error) {
      setLocalError(s(error?.message, "The answer could not be processed."));
      setAwaitingAssistant(false);
      setSuppressedQuestionSignature("");
    }
  }

  async function handleFreeformContinue(textValue = composerValue) {
    const text = s(textValue);
    if (!text || busy) return;

    const requestText = isContinueStyleAnswer(text) ? "Let's continue." : text;
    const resolvedStep = resolveFreeformStepFromText(
      requestText,
      lastAssistantQuestionStep
    );

    setLocalError("");
    setAwaitingAssistant(true);

    setTimeline((current) =>
      appendTimelineItem(current, {
        id: `freeform-${Date.now()}`,
        type: "message",
        role: "user",
        body: text,
      })
    );

    setComposerValue("");

    try {
      await onParseMessage?.({
        step: resolvedStep,
        text: requestText,
      });
    } catch (error) {
      setLocalError(s(error?.message, "The update could not be processed."));
      setAwaitingAssistant(false);
    }
  }

  const composerReady = sessionHydrated && !bootSequencePending && !bootTyping;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,#ffffff,#f8fafc)]">
      <div ref={scrollRef} className="flex-1 overflow-auto px-5 pt-5">
        <div className="space-y-4 pb-4">
          <AnimatePresence initial={false}>
            {renderedTimeline.map((item) => {
              if (item.type === "draft") {
                return (
                  <SmartDraftBubble
                    key={item.id}
                    model={item.model}
                    finalizing={finalizing}
                    onFinalize={onFinalize}
                  />
                );
              }

              return (
                <MessageBubble
                  key={item.id}
                  role={item.role}
                  eyebrow={item.eyebrow}
                  title={item.title}
                  body={item.body}
                  animate
                />
              );
            })}
          </AnimatePresence>

          {bootTyping || awaitingAssistant ? <TypingBubble /> : null}

          {s(localError || errorMessage) ? (
            <MessageBubble
              role="assistant"
              eyebrow="Setup"
              title="I need one more try"
              body={localError || errorMessage}
              animate
            />
          ) : null}
        </div>
      </div>

      {!sourceSubmitted && composerReady ? (
        <Composer
          value={composerValue}
          busy={busy}
          placeholder="Website, Google Maps, Instagram, Facebook və ya qısa qeyd yaz"
          buttonLabel="Send"
          onChange={setComposerValue}
          onSubmit={handleInitialSourceSubmit}
        />
      ) : null}

      {sourceSubmitted && currentQuestion && composerReady ? (
        <Composer
          value={composerValue}
          busy={busy}
          placeholder={currentQuestion.placeholder || "Cavabını yaz"}
          buttonLabel="Send"
          onChange={setComposerValue}
          onSubmit={handleQuestionSubmit}
        />
      ) : null}

      {sourceSubmitted && !currentQuestion && !questionsFinished && composerReady ? (
        <Composer
          value={composerValue}
          busy={busy}
          placeholder="Əlavə detal və ya düzəliş yaz"
          buttonLabel="Send"
          onChange={setComposerValue}
          onSubmit={handleFreeformContinue}
        />
      ) : null}

      {questionsFinished && composerReady ? (
        <Composer
          value={composerValue}
          busy={busy}
          placeholder="Dəyişmək istədiyini yaz"
          buttonLabel="Send"
          onChange={setComposerValue}
          onSubmit={handleFreeformContinue}
        />
      ) : null}
    </div>
  );
}