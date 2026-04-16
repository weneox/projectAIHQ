import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AlertCircle, ArrowUp, LoaderCircle, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { resolveSetupSourceInput } from "./setupSourceIntake.js";

const STORAGE_PREFIX = "setup_assistant_chat_v3";

const STEP_PLACEHOLDERS = {
  source_capture:
    "Paste a website, Google Maps link, Instagram, Facebook, or a short business note",
  profile: "Write the exact business identity in one clean message",
  services: "Write only the real customer-facing services",
  contacts: "Write the main public contact route",
  hours: "Write the public weekly hours",
  pricing: "Write how AI should speak about pricing publicly",
  handoff: "Write when AI must stop and escalate to a human",
};

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

function uniqueStrings(items = [], max = 16) {
  return [...new Set(arr(items).map((item) => s(item)).filter(Boolean))].slice(
    0,
    max
  );
}

function compactText(value, max = 220) {
  const text = s(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
}

function listPreview(items = [], max = 6) {
  const safe = uniqueStrings(
    arr(items).map((item) => compactText(item, 80)),
    24
  );
  if (!safe.length) return "";
  if (safe.length <= max) return safe.join(", ");
  return `${safe.slice(0, max).join(", ")} +${safe.length - max}`;
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
    /\b24\/7\b/.test(text) ||
    /\bappointment\b/.test(text) ||
    /\bbağlı\b/.test(text) ||
    /\bclosed\b/.test(text)
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
    /\bqiymət\b/.test(text) ||
    /\bstarting\b/.test(text) ||
    /\bxidmətə görə\b/.test(text)
  );
}

function resolveHintStepFromMessage(value = "", fallbackStep = "profile") {
  const text = s(value);
  const lowerText = text.toLowerCase();

  if (looksLikeUrlOrDomain(text)) return "website";

  if (
    looksLikePhone(text) ||
    looksLikeEmail(text) ||
    /whatsapp|telegram|əlaqə|contact|email|telefon|phone/i.test(lowerText)
  ) {
    return "contacts";
  }

  if (looksLikeHoursText(text)) return "hours";
  if (looksLikePricingText(text)) return "pricing";

  if (
    /şikayət|complaint|refund|payment|operator|manager|handoff|ötür/i.test(
      lowerText
    )
  ) {
    return "handoff";
  }

  if (
    /[,\n;]/.test(text) &&
    text.split(/[,;\n]/).filter((item) => s(item)).length >= 2
  ) {
    return "services";
  }

  return s(fallbackStep, "profile");
}

function normalizeQuestion(value = {}) {
  const source = obj(value);

  return {
    key: s(source.key).toLowerCase(),
    step: s(source.step || source.key).toLowerCase(),
    title: s(source.title),
    prompt: s(source.prompt),
    placeholder:
      s(source.placeholder) ||
      s(STEP_PLACEHOLDERS[s(source.step || source.key).toLowerCase()]) ||
      "Write your answer",
  };
}

function normalizeTimelineEntry(value = {}) {
  const source = obj(value);

  return {
    id: s(source.id) || `timeline-${Date.now()}`,
    role: s(source.role).toLowerCase() === "user" ? "user" : "assistant",
    body: s(source.text || source.body || source.message),
    meta: s(source.meta),
    questionKey: s(source.questionKey || source.question_key).toLowerCase(),
    phase: s(source.phase).toLowerCase(),
    provider: s(source.provider),
    model: s(source.model),
    usedFallback: source.usedFallback === true,
    error: s(source.error),
    createdAt: source.createdAt || source.created_at || null,
  };
}

function mapServiceItems(items = []) {
  return uniqueStrings(
    arr(items).map((item) => s(item?.title || item?.name || item?.label)),
    24
  );
}

function mapContactItems(items = []) {
  return uniqueStrings(
    arr(items).map((item) =>
      s(
        item?.label ||
          item?.value ||
          item?.channel ||
          item?.type ||
          item?.phone ||
          item?.email
      )
    ),
    24
  );
}

function formatHoursItem(item = {}) {
  const row = obj(item);
  const day = s(row.day);
  const openTime = s(row.openTime || row.open || row.from);
  const closeTime = s(row.closeTime || row.close || row.to);
  const notes = s(row.notes);

  if (row.allDay === true) {
    return [day, "24/7"].filter(Boolean).join(" ");
  }

  if (row.closed === true) {
    return [day, "closed"].filter(Boolean).join(" ");
  }

  if (openTime && closeTime) {
    return [day, `${openTime}–${closeTime}`].filter(Boolean).join(" ");
  }

  if (notes) {
    return [day, notes].filter(Boolean).join(" ");
  }

  return "";
}

function mapHoursItems(items = []) {
  return uniqueStrings(arr(items).map((item) => formatHoursItem(item)), 24);
}

function buildCanonicalAssistantState(reviewPayload = null, assistantState = {}) {
  const reviewAssistant = obj(reviewPayload?.assistant);
  const setupAssistant = obj(obj(assistantState).assistant);
  const source = Object.keys(reviewAssistant).length
    ? reviewAssistant
    : setupAssistant;

  const nextQuestion =
    Object.keys(obj(source.nextQuestion)).length > 0
      ? normalizeQuestion(source.nextQuestion)
      : arr(obj(source.interviewPlan).activeQuestions).length
        ? normalizeQuestion(arr(obj(source.interviewPlan).activeQuestions)[0])
        : null;

  const timeline = arr(
    source.timeline ||
      obj(assistantState).assistantTimeline ||
      reviewPayload?.timeline
  )
    .map(normalizeTimelineEntry)
    .filter((item) => item.body);

  return {
    message: s(source.assistantMessage || source.message),
    phase: s(source.phase),
    nextQuestion,
    readyForApproval: source.readyForApproval === true,
    provider: s(source.provider),
    model: s(source.model),
    usedFallback: source.usedFallback === true,
    error: s(source.error),
    sourceSignals: obj(source.sourceSignals),
    confidence: obj(source.confidence),
    recommendation: obj(source.recommendation),
    interviewPlan: obj(source.interviewPlan),
    draft: obj(source.draft),
    rejectedInputs: arr(source.rejectedInputs),
    timeline,
  };
}

function buildFinalViewModel(reviewPayload = null, assistantState = {}) {
  const canonicalAssistant = buildCanonicalAssistantState(
    reviewPayload,
    assistantState
  );
  const setupDraft = obj(obj(assistantState).draft);
  const businessProfile = obj(setupDraft.businessProfile);
  const pricingPosture = obj(setupDraft.pricingPosture);
  const handoffRules = obj(setupDraft.handoffRules);
  const sourceMetadata = obj(setupDraft.sourceMetadata);

  const previewDraft = obj(canonicalAssistant.draft);

  const coreServices =
    arr(previewDraft.coreServices).length > 0
      ? uniqueStrings(previewDraft.coreServices, 24)
      : mapServiceItems(setupDraft.services);

  const contactRoutes =
    arr(previewDraft.contactRoutes).length > 0
      ? uniqueStrings(previewDraft.contactRoutes, 24)
      : mapContactItems(setupDraft.contacts);

  const hours =
    arr(previewDraft.hours).length > 0
      ? uniqueStrings(previewDraft.hours, 24)
      : mapHoursItems(setupDraft.hours);

  return {
    ...canonicalAssistant,
    draft: {
      businessName: s(previewDraft.businessName || businessProfile.companyName),
      whatThisBusinessIs: s(
        previewDraft.whatThisBusinessIs || businessProfile.description
      ),
      websiteUrl: s(
        previewDraft.websiteUrl ||
          businessProfile.websiteUrl ||
          sourceMetadata.primarySourceUrl
      ),
      coreServices,
      pricingPosture: s(
        previewDraft.pricingPosture || pricingPosture.publicSummary
      ),
      contactRoutes,
      humanHandoff: s(previewDraft.humanHandoff || handoffRules.summary),
      hours,
    },
  };
}

function hasStrongDraft(model = {}) {
  const draft = obj(model.draft);

  return Boolean(
    model.readyForApproval === true &&
      s(draft.businessName) &&
      s(draft.whatThisBusinessIs) &&
      arr(draft.coreServices).length > 0 &&
      arr(draft.contactRoutes).length > 0 &&
      s(draft.pricingPosture) &&
      s(draft.humanHandoff)
  );
}

function buildAssistantMeta(model = {}) {
  const sourceSignals = obj(model.sourceSignals);
  const parts = [];

  if (s(sourceSignals.primarySourceLabel)) {
    parts.push(s(sourceSignals.primarySourceLabel));
  }

  if (s(sourceSignals.primarySourceUrl)) {
    parts.push(s(sourceSignals.primarySourceUrl));
  }

  if (model.usedFallback === true) {
    parts.push("Degraded reasoning mode");
  }

  return parts.join(" · ");
}

function getConversationStorageKey(storageKey = "") {
  return `${STORAGE_PREFIX}:${s(storageKey, "default")}`;
}

function makeTranscriptEntry(entry = {}) {
  return {
    id: s(entry.id) || `msg-${Date.now()}`,
    role: s(entry.role) || "assistant",
    body: s(entry.body),
    meta: s(entry.meta),
  };
}

function loadStoredTranscript(storageKey = "") {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(getConversationStorageKey(storageKey));
    return arr(JSON.parse(raw || "[]"))
      .map((item, index) =>
        makeTranscriptEntry({
          id: s(item.id) || `msg-${index + 1}`,
          role: s(item.role),
          body: s(item.body),
          meta: s(item.meta),
        })
      )
      .filter((item) => item.body);
  } catch {
    return [];
  }
}

function saveStoredTranscript(storageKey = "", transcript = []) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      getConversationStorageKey(storageKey),
      JSON.stringify(
        arr(transcript).map((item) => ({
          id: s(item.id),
          role: s(item.role),
          body: s(item.body),
          meta: s(item.meta),
        }))
      )
    );
  } catch {
    return;
  }
}

function transcriptReducer(state, action) {
  if (action?.type === "append") {
    return [...arr(state), makeTranscriptEntry(action.entry)];
  }

  if (action?.type === "replace") {
    return arr(action.entries).map(makeTranscriptEntry);
  }

  if (action?.type === "reset") {
    return [];
  }

  return arr(state);
}

function bubbleClasses(role = "assistant") {
  if (role === "user") {
    return "rounded-[26px] rounded-br-[10px] bg-[linear-gradient(180deg,#2563eb,#1d4ed8)] text-white shadow-[0_18px_40px_rgba(37,99,235,0.24)]";
  }

  return "rounded-[26px] rounded-bl-[10px] border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.98))] text-text shadow-[0_12px_30px_rgba(15,23,42,0.06)]";
}

const bubbleMotion = {
  hidden: { opacity: 0, y: 12, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
  },
};

function ChatBubble({ role = "assistant", body = "", meta = "" }) {
  const isUser = role === "user";

  return (
    <motion.div variants={bubbleMotion} initial="hidden" animate="visible">
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[84%] px-4 py-3.5 ${bubbleClasses(role)}`}>
          <div
            className={`whitespace-pre-wrap text-[15px] leading-7 ${
              isUser ? "text-white/95" : "text-text"
            }`}
          >
            {body}
          </div>

          {!isUser && s(meta) ? (
            <div className="mt-2 text-[12px] leading-6 text-text-subtle">
              {meta}
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
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

function DraftRow({ label, value }) {
  return (
    <div className="rounded-[18px] border border-[rgba(15,23,42,0.06)] bg-[rgba(248,250,252,0.82)] px-3.5 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {label}
      </div>
      <div className="mt-1.5 text-[14px] leading-7 text-text">{value}</div>
    </div>
  );
}

function SmartDraftCard({ model, finalizing, onFinalize }) {
  const draft = obj(model.draft);

  const rows = [
    ["Business name", draft.businessName],
    ["What the business does", draft.whatThisBusinessIs],
    ["Website", draft.websiteUrl],
    ["Core services", listPreview(draft.coreServices, 6)],
    ["Pricing posture", draft.pricingPosture],
    ["Contact routes", listPreview(draft.contactRoutes, 6)],
    ["Hours", listPreview(draft.hours, 4)],
    ["Human handoff", draft.humanHandoff],
  ].filter(([, value]) => s(value));

  return (
    <motion.div variants={bubbleMotion} initial="hidden" animate="visible">
      <div className="flex justify-start">
        <div className="max-w-[84%] rounded-[26px] rounded-bl-[10px] border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.98))] px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-2 text-[20px] font-semibold tracking-[-0.04em] text-text">
            <Sparkles className="h-5 w-5 text-brand" />
            Draft ready
          </div>

          {s(model.message) ? (
            <div className="mt-2 text-[15px] leading-7 text-text">
              {model.message}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3">
            {rows.map(([label, value]) => (
              <DraftRow key={label} label={label} value={value} />
            ))}
          </div>

          <button
            type="button"
            onClick={onFinalize}
            disabled={finalizing}
            className="mt-4 inline-flex h-11 items-center rounded-full bg-slate-950 px-5 text-[12px] font-semibold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {finalizing ? "Finalizing..." : "Approve and finish setup"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function StatusNotice({ model }) {
  const error = s(model.error);

  if (model.usedFallback !== true && !error) {
    return null;
  }

  return (
    <motion.div variants={bubbleMotion} initial="hidden" animate="visible">
      <div className="rounded-[20px] border border-[rgba(239,68,68,0.12)] bg-[rgba(255,244,244,0.9)] px-4 py-3 text-[13px] leading-6 text-[#7f1d1d]">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">
              {model.usedFallback === true
                ? "Degraded setup reasoning mode is active."
                : "Setup assistant reported an issue."}
            </div>
            {error ? <div className="mt-0.5">{compactText(error, 180)}</div> : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Composer({
  value,
  busy,
  placeholder,
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
            aria-label="Send"
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

function SetupAssistantSectionsContent({
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
  const pendingTurnRef = useRef(null);
  const responseFingerprintRef = useRef("");
  const serverTimelineFingerprintRef = useRef("");

  const [composerValue, setComposerValue] = useState("");
  const [localError, setLocalError] = useState("");
  const [transcript, dispatchTranscript] = useReducer(
    transcriptReducer,
    storageKey,
    loadStoredTranscript
  );
  const [hasPendingTurn, setHasPendingTurn] = useState(false);

  const busy = saving || finalizing || capturingSource;

  const finalModel = useMemo(
    () => buildFinalViewModel(reviewPayload, assistant),
    [reviewPayload, assistant]
  );

  const smartDraftReady = useMemo(
    () => hasStrongDraft(finalModel),
    [finalModel]
  );

  const currentQuestion = finalModel.nextQuestion;

  const canonicalAssistantMessage = s(finalModel.message);
  const canonicalAssistantMeta = buildAssistantMeta(finalModel);
  const serverTimeline = useMemo(
    () => arr(finalModel.timeline).map((item) => makeTranscriptEntry(item)),
    [finalModel.timeline]
  );

  const hasExistingProgress = useMemo(() => {
    const draft = obj(finalModel.draft);
    const sourceSignals = obj(finalModel.sourceSignals);

    return Boolean(
      s(draft.businessName) ||
        s(draft.whatThisBusinessIs) ||
        s(draft.websiteUrl) ||
        arr(draft.coreServices).length ||
        arr(draft.contactRoutes).length ||
        arr(draft.hours).length ||
        s(draft.pricingPosture) ||
        s(draft.humanHandoff) ||
        s(sourceSignals.primarySourceUrl) ||
        s(sourceSignals.primarySourceLabel)
    );
  }, [finalModel]);

  const sourceSubmitted = Boolean(
    hasExistingProgress ||
      serverTimeline.some((item) => item.role === "user") ||
      transcript.some((item) => item.role === "user")
  );

  const composerPlaceholder = useMemo(() => {
    if (currentQuestion?.placeholder) return currentQuestion.placeholder;

    if (!sourceSubmitted) {
      return STEP_PLACEHOLDERS.source_capture;
    }

    return (
      s(STEP_PLACEHOLDERS[s(currentQuestion?.step || currentQuestion?.key)]) ||
      "Write the next detail or correction"
    );
  }, [currentQuestion, sourceSubmitted]);

  useEffect(() => {
    saveStoredTranscript(storageKey, transcript);
  }, [storageKey, transcript]);

  useEffect(() => {
    if (!sessionHydrated) return;
    if (!serverTimeline.length) return;

    const fingerprint = JSON.stringify(
      serverTimeline.map((item) => ({
        role: item.role,
        body: item.body,
        meta: item.meta,
      }))
    );

    if (serverTimelineFingerprintRef.current === fingerprint) return;

    serverTimelineFingerprintRef.current = fingerprint;
    responseFingerprintRef.current = fingerprint;
    pendingTurnRef.current = null;
    setHasPendingTurn(false);
    dispatchTranscript({
      type: "replace",
      entries: serverTimeline,
    });
  }, [sessionHydrated, serverTimeline]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript, busy, localError, errorMessage, smartDraftReady, canonicalAssistantMessage]);

  useEffect(() => {
    if (!sessionHydrated) return;
    if (!pendingTurnRef.current) return;
    if (busy) return;

    const lastTranscriptItem = transcript[transcript.length - 1];
    const serverLast = serverTimeline[serverTimeline.length - 1];

    if (
      serverLast &&
      serverLast.role === "assistant" &&
      s(serverLast.body) === canonicalAssistantMessage
    ) {
      pendingTurnRef.current = null;
      setHasPendingTurn(false);
      return;
    }

    if (
      lastTranscriptItem &&
      lastTranscriptItem.role === "assistant" &&
      s(lastTranscriptItem.body) === canonicalAssistantMessage &&
      s(lastTranscriptItem.meta) === canonicalAssistantMeta
    ) {
      pendingTurnRef.current = null;
      setHasPendingTurn(false);
      return;
    }

    const fingerprint = JSON.stringify({
      body: canonicalAssistantMessage,
      meta: canonicalAssistantMeta,
      questionKey: s(currentQuestion?.key),
      phase: s(finalModel.phase),
      ready: finalModel.readyForApproval === true,
      provider: s(finalModel.provider),
      model: s(finalModel.model),
      usedFallback: finalModel.usedFallback === true,
      error: s(finalModel.error),
    });

    if (!canonicalAssistantMessage) {
      pendingTurnRef.current = null;
      setHasPendingTurn(false);
      return;
    }

    if (responseFingerprintRef.current === fingerprint) {
      pendingTurnRef.current = null;
      setHasPendingTurn(false);
      return;
    }

    responseFingerprintRef.current = fingerprint;

    dispatchTranscript({
      type: "append",
      entry: {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        body: canonicalAssistantMessage,
        meta: canonicalAssistantMeta,
      },
    });

    pendingTurnRef.current = null;
    setHasPendingTurn(false);
  }, [
    sessionHydrated,
    busy,
    canonicalAssistantMessage,
    canonicalAssistantMeta,
    currentQuestion,
    finalModel,
    transcript,
    serverTimeline,
  ]);

  async function handleInitialSourceSubmit() {
    const text = s(composerValue);
    if (!text || busy) return;

    const resolvedSource = resolveSetupSourceInput(text);
    const turnId = `turn-${Date.now()}`;

    setLocalError("");
    pendingTurnRef.current = turnId;
    setHasPendingTurn(true);

    dispatchTranscript({
      type: "append",
      entry: {
        id: `user-source-${Date.now()}`,
        role: "user",
        body: text,
      },
    });

    setComposerValue("");

    try {
      await onCaptureSource?.({
        type: resolvedSource.type,
        value: resolvedSource.value,
        message: text,
      });
    } catch (error) {
      pendingTurnRef.current = null;
      setHasPendingTurn(false);
      setLocalError(s(error?.message, "Source intake failed."));
    }
  }

  async function handleMessageSubmit() {
    const text = s(composerValue);
    if (!text || busy) return;

    const hintStep = resolveHintStepFromMessage(
      text,
      currentQuestion?.step || "profile"
    );
    const turnId = `turn-${Date.now()}`;

    setLocalError("");
    pendingTurnRef.current = turnId;
    setHasPendingTurn(true);

    dispatchTranscript({
      type: "append",
      entry: {
        id: `user-message-${Date.now()}`,
        role: "user",
        body: text,
      },
    });

    setComposerValue("");

    try {
      await onParseMessage?.({
        mode: "message",
        message: text,
        text,
        value: text,
        step: s(currentQuestion?.step || hintStep),
        hintStep,
        questionKey: s(currentQuestion?.key),
      });
    } catch (error) {
      pendingTurnRef.current = null;
      setHasPendingTurn(false);
      setLocalError(s(error?.message, "Message processing failed."));
    }
  }

  function handleSubmit() {
    if (!sourceSubmitted) {
      handleInitialSourceSubmit();
      return;
    }

    handleMessageSubmit();
  }

  const showBootBubble =
    transcript.length === 0 &&
    serverTimeline.length === 0 &&
    sessionHydrated &&
    !busy &&
    !smartDraftReady &&
    canonicalAssistantMessage;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,#ffffff,#f8fafc)]">
      <div ref={scrollRef} className="flex-1 overflow-auto px-5 pt-5">
        <div className="space-y-4 pb-4">
          <StatusNotice model={finalModel} />

          <AnimatePresence initial={false}>
            {transcript.map((item) => (
              <ChatBubble
                key={item.id}
                role={item.role}
                body={item.body}
                meta={item.meta}
              />
            ))}
          </AnimatePresence>

          {showBootBubble ? (
            <ChatBubble
              role="assistant"
              body={canonicalAssistantMessage}
              meta={canonicalAssistantMeta}
            />
          ) : null}

          {hasPendingTurn && (saving || capturingSource) ? <TypingBubble /> : null}

          {smartDraftReady ? (
            <SmartDraftCard
              model={finalModel}
              finalizing={finalizing}
              onFinalize={onFinalize}
            />
          ) : null}

          {s(localError || errorMessage) ? (
            <ChatBubble
              role="assistant"
              body={localError || errorMessage}
            />
          ) : null}
        </div>
      </div>

      {sessionHydrated ? (
        <Composer
          value={composerValue}
          busy={busy}
          placeholder={composerPlaceholder}
          onChange={setComposerValue}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}

export default function SetupAssistantSections(props) {
  const storageKey = s(props.storageKey, "default") || "default";

  return (
    <SetupAssistantSectionsContent
      key={storageKey}
      {...props}
      storageKey={storageKey}
    />
  );
}