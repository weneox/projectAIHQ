import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const DEFAULT_COMPOSER_PLACEHOLDER = "Mesaj yazın";

const LOCALIZED_QUESTION_COPY = {
  company: {
    body: "O zaman başlayaq. Şirkətinizin adı nədir?",
    placeholder: "Şirkət adını yazın",
  },
  description: {
    body: "Qısa olaraq nə iş gördüyünüzü yazın.",
    placeholder: "Biznesinizi qısa təsvir edin",
  },
  services: {
    body: "Əsas xidmətlərinizi yazın. Vergüllə və ya sətir-sətir yaza bilərsiniz.",
    placeholder: "Əsas xidmətləri yazın",
  },
  contacts: {
    body: "Müştəri sizinlə necə əlaqə saxlamalıdır? Telefon, email, WhatsApp və ya link yazın.",
    placeholder: "Əlaqə məlumatlarını yazın",
  },
  hours: {
    body: "İş saatlarınızı yazın. Məsələn: B.e–C. 09:00–18:00 və ya 24/7.",
    placeholder: "İş saatlarını yazın",
  },
  pricing: {
    body: "AI qiymətlərlə bağlı nə deyə bilər? Dəqiq qiymət desin, başlanğıc qiymət desin, yoxsa quote tələb olunsun?",
    placeholder: "Qiymət siyasətini yazın",
  },
  handoff: {
    body: "Hansı hallarda AI mütləq operatora və ya insana yönləndirməlidir?",
    placeholder: "Handoff qaydalarını yazın",
  },
};

const SUPPRESSED_FALLBACK_ERRORS = new Set([
  "openai_setup_assistant_timeout",
  "openai_setup_assistant_empty_output",
  "openai_setup_assistant_failed",
  "openai_setup_assistant_unavailable",
  "openai_setup_assistant_forced_fallback",
]);

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
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

function normalizeQuestion(value = {}) {
  const source = obj(value);

  return {
    key: s(source.key).toLowerCase(),
    step: s(source.step || source.key).toLowerCase(),
    title: s(source.title),
    prompt: s(source.prompt),
    placeholder: s(source.placeholder) || "",
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

function getQuestionCopy(question = {}) {
  const key = lower(question?.key || question?.step || "company");
  const local = obj(LOCALIZED_QUESTION_COPY[key]);

  return {
    body: s(question?.prompt || local.body),
    placeholder: s(question?.placeholder || local.placeholder),
  };
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
  const parts = [];

  if (model.usedFallback === true) {
    parts.push("Fallback mode");
  }

  if (s(model.provider) && s(model.model)) {
    parts.push(`${s(model.provider)} · ${s(model.model)}`);
  } else if (s(model.provider)) {
    parts.push(s(model.provider));
  }

  return parts.join(" · ");
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

function StatusNotice({ error = "", usedFallback = false }) {
  const safeError = lower(error);

  if (usedFallback && SUPPRESSED_FALLBACK_ERRORS.has(safeError)) {
    return null;
  }

  if (!usedFallback && !s(error)) {
    return null;
  }

  return (
    <motion.div variants={bubbleMotion} initial="hidden" animate="visible">
      <div className="rounded-[20px] border border-[rgba(239,68,68,0.12)] bg-[rgba(255,244,244,0.9)] px-4 py-3 text-[13px] leading-6 text-[#7f1d1d]">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">
              {usedFallback === true
                ? "Fallback mode is active."
                : "The assistant reported an issue."}
            </div>
            {s(error) ? (
              <div className="mt-0.5">{compactText(error, 180)}</div>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function WelcomeCard({ busy = false, onStartSetup, onGoToChannels }) {
  return (
    <motion.div
      variants={bubbleMotion}
      initial="hidden"
      animate="visible"
      className="rounded-[28px] border border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.96))] px-5 py-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
    >
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-text-muted">
        <Sparkles className="h-4 w-4 text-brand" />
        Ask AI
      </div>

      <div className="mt-4 text-[24px] font-semibold tracking-[-0.04em] text-text">
        Salam. NEOX AI HQ-yə xoş gəlmisiniz.
      </div>

      <div className="mt-2 max-w-[560px] text-[15px] leading-7 text-text-subtle">
        İstəsəniz əvvəl kanalları qura bilərsiniz, istəsəniz də biznes
        setup-unuzu elə indi başladaq.
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onGoToChannels}
          disabled={busy}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-[rgba(15,23,42,0.08)] bg-white px-4 text-[13px] font-semibold text-text transition-colors hover:bg-[rgba(15,23,42,0.03)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Go to channels
          <ArrowRight className="h-4 w-4" strokeWidth={2.1} />
        </button>

        <button
          type="button"
          onClick={onStartSetup}
          disabled={busy}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-slate-950 px-4 text-[13px] font-semibold text-white shadow-[0_14px_30px_rgba(2,6,23,0.18)] transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? "Starting..." : "Start setup"}
          <Sparkles className="h-4 w-4" strokeWidth={2.1} />
        </button>
      </div>
    </motion.div>
  );
}

function Composer({
  value,
  busy,
  placeholder,
  textareaRef,
  onChange,
  onSubmit,
}) {
  const disabled = !s(value) || busy;

  return (
    <div className="bg-transparent px-5 pb-5 pt-3">
      <div className="rounded-[34px] border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] px-4 py-4 shadow-[0_16px_50px_rgba(15,23,42,0.07)]">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
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
  sessionHydrated = false,
  assistant,
  reviewPayload = null,
  saving = false,
  finalizing = false,
  capturingSource = false,
  errorMessage = "",
  onParseMessage,
  onFinalize,
  onStartSetup,
  onGoToChannels,
}) {
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const [composerValue, setComposerValue] = useState("");
  const [localError, setLocalError] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState("");
  const [setupPrimed, setSetupPrimed] = useState(false);

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
  const questionCopy = useMemo(
    () => getQuestionCopy(currentQuestion),
    [currentQuestion]
  );

  const serverTimeline = useMemo(
    () => arr(finalModel.timeline).map(normalizeTimelineEntry),
    [finalModel.timeline]
  );

  const hasAssistantTimelineMessage = useMemo(
    () =>
      serverTimeline.some(
        (item) => item.role === "assistant" && Boolean(s(item.body))
      ),
    [serverTimeline]
  );

  const showWelcome = !setupPrimed && serverTimeline.length === 0 && !busy;

  const composerPlaceholder = useMemo(() => {
    if (showWelcome) return DEFAULT_COMPOSER_PLACEHOLDER;
    if (s(questionCopy.placeholder)) return questionCopy.placeholder;
    return DEFAULT_COMPOSER_PLACEHOLDER;
  }, [showWelcome, questionCopy.placeholder]);

  const assistantMeta = useMemo(
    () => buildAssistantMeta(finalModel),
    [finalModel]
  );

  const visiblePendingUserMessage = busy ? pendingUserMessage : "";

  const staticAssistantMessage = useMemo(() => {
    if (showWelcome) return "";
    if (hasAssistantTimelineMessage) return "";
    if (s(finalModel.message)) return finalModel.message;
    if (s(questionCopy.body)) return questionCopy.body;
    return "";
  }, [
    showWelcome,
    hasAssistantTimelineMessage,
    finalModel.message,
    questionCopy.body,
  ]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [
    serverTimeline,
    visiblePendingUserMessage,
    busy,
    localError,
    errorMessage,
    smartDraftReady,
    staticAssistantMessage,
    showWelcome,
  ]);

  async function handleStartSetupClick() {
    if (busy) return;
    setLocalError("");
    try {
      await onStartSetup?.();
      setSetupPrimed(true);
      requestAnimationFrame(() => {
        textareaRef.current?.focus?.();
      });
    } catch (error) {
      setLocalError(s(error?.message, "Setup could not be started."));
    }
  }

  async function handleMessageSubmit() {
    const text = s(composerValue);
    if (!text || busy) return;

    setLocalError("");
    setPendingUserMessage(text);
    setComposerValue("");

    try {
      await onParseMessage?.({
        mode: "message",
        message: text,
        text,
        value: text,
        step: s(currentQuestion?.step || currentQuestion?.key || "company") || "company",
        questionKey: s(currentQuestion?.key),
      });
    } catch (error) {
      setPendingUserMessage("");
      setLocalError(s(error?.message, "Message processing failed."));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,#ffffff,#f8fafc)]">
      <div ref={scrollRef} className="flex-1 overflow-auto px-5 pt-5">
        <div className="space-y-4 pb-4">
          <StatusNotice
            error={localError || errorMessage || finalModel.error}
            usedFallback={finalModel.usedFallback === true}
          />

          {showWelcome ? (
            <WelcomeCard
              busy={busy}
              onStartSetup={handleStartSetupClick}
              onGoToChannels={onGoToChannels}
            />
          ) : null}

          <AnimatePresence initial={false}>
            {serverTimeline.map((item) => (
              <ChatBubble
                key={item.id}
                role={item.role}
                body={item.body}
                meta={item.role === "assistant" ? item.meta : ""}
              />
            ))}
          </AnimatePresence>

          {visiblePendingUserMessage ? (
            <ChatBubble role="user" body={visiblePendingUserMessage} />
          ) : null}

          {s(staticAssistantMessage) ? (
            <ChatBubble
              role="assistant"
              body={staticAssistantMessage}
              meta={assistantMeta}
            />
          ) : null}

          {busy ? <TypingBubble /> : null}

          {smartDraftReady ? (
            <SmartDraftCard
              model={finalModel}
              finalizing={finalizing}
              onFinalize={onFinalize}
            />
          ) : null}
        </div>
      </div>

      {!showWelcome && sessionHydrated ? (
        <Composer
          value={composerValue}
          busy={busy}
          placeholder={composerPlaceholder}
          textareaRef={textareaRef}
          onChange={setComposerValue}
          onSubmit={handleMessageSubmit}
        />
      ) : null}
    </div>
  );
}

export default function SetupAssistantSections(props) {
  return <SetupAssistantSectionsContent {...props} />;
}