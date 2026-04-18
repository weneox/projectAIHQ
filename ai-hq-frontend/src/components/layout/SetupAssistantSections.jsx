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
const TYPING_BUBBLE_DELAY_MS = 320;

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
  pricing_behavior: {
    body: "Qiymət soruşulanda AI necə cavab versin?",
    placeholder: "Məsələn: cavab + pricing page",
  },
  location_behavior: {
    body: "Ünvan soruşulanda AI necə cavab versin?",
    placeholder: "Məsələn: mətn + xəritə",
  },
  booking_behavior: {
    body: "Booking üçün AI əsasən hara yönləndirsin?",
    placeholder: "Məsələn: WhatsApp / website booking page",
  },
  contact_behavior: {
    body: "Əlaqə istəyəndə hansı kanal önə çıxsın?",
    placeholder: "Məsələn: WhatsApp first",
  },
  handoff_behavior: {
    body: "İnsana keçid lazım olanda AI necə davransın?",
    placeholder: "Məsələn: əvvəlcə səbəb soruş",
  },
};

const SUPPRESSED_INTERNAL_ERRORS = new Set([
  "openai_setup_assistant_timeout",
  "openai_setup_assistant_empty_output",
  "openai_setup_assistant_failed",
  "openai_setup_assistant_unavailable",
  "openai_setup_assistant_forced_fallback",
  "openai_setup_reasoner_timeout",
  "openai_setup_reasoner_empty_output",
  "openai_setup_polisher_timeout",
  "openai_setup_polisher_empty_output",
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
    arr(items).map((item) => compactText(item, 90)),
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

function normalizeQuestionCopy(question = null) {
  const safeQuestion = obj(question);
  const key = lower(safeQuestion.key || safeQuestion.step);

  if (!key) {
    return {
      body: "",
      placeholder: "",
    };
  }

  const local = obj(LOCALIZED_QUESTION_COPY[key]);

  return {
    body: s(safeQuestion.prompt || local.body),
    placeholder: s(safeQuestion.placeholder || local.placeholder),
  };
}

function normalizeComparableMessage(value = "") {
  return s(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function responseTimelineFromPayload(payload = {}) {
  return arr(
    obj(payload?.setup?.assistant).timeline ||
      payload?.setup?.timeline ||
      obj(payload?.assistant).timeline ||
      payload?.timeline
  )
    .map(normalizeTimelineEntry)
    .filter((item) => item.body);
}

function timelineHasUserMessage(timeline = [], text = "") {
  const target = normalizeComparableMessage(text);
  if (!target) return false;

  return arr(timeline).some(
    (item) =>
      item?.role === "user" &&
      normalizeComparableMessage(item?.body) === target
  );
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

function isDraftReadyMessage(text = "") {
  const value = lower(text);
  if (!value) return false;

  return (
    value.includes("draft hazırdır") ||
    value.includes("draft hazirdir") ||
    value.includes("draft ready") ||
    value.includes("ready for approval") ||
    value.includes("approval")
  );
}

function hasAnyDraftContent(draft = {}) {
  const safeDraft = obj(draft);

  return Boolean(
    s(safeDraft.businessName) ||
      s(safeDraft.whatThisBusinessIs) ||
      s(safeDraft.websiteUrl) ||
      arr(safeDraft.coreServices).length > 0 ||
      arr(safeDraft.contactRoutes).length > 0 ||
      arr(safeDraft.hours).length > 0 ||
      s(safeDraft.pricingPosture) ||
      s(safeDraft.humanHandoff)
  );
}

function shouldShowSmartDraft(model = {}) {
  const draft = obj(model.draft);
  const hasDraft = hasAnyDraftContent(draft);
  const backendReady = model.readyForApproval === true;
  const messageReady = isDraftReadyMessage(model.message);

  if (!hasDraft) return false;
  return backendReady || messageReady;
}

function shouldSuppressVisibleError(error = "") {
  const safeError = lower(error);
  if (!safeError) return false;
  return SUPPRESSED_INTERNAL_ERRORS.has(safeError);
}

function resolveVisibleErrorMessage({
  localError = "",
  externalError = "",
  assistantError = "",
} = {}) {
  const first = s(localError);
  if (first) return first;

  const second = s(externalError);
  if (second && !shouldSuppressVisibleError(second)) return second;

  const third = s(assistantError);
  if (third && !shouldSuppressVisibleError(third)) return third;

  return "";
}

function normalizeIssueText(text = "") {
  return compactText(
    s(text)
      .replace(/^high risk:\s*/i, "")
      .replace(/^needs review:\s*/i, "")
      .trim(),
    180
  );
}

function buildDraftReviewFlags(model = {}) {
  const flags = [];

  for (const item of arr(model.rejectedInputs)) {
    const reason = s(item?.reason || item?.input);
    if (!reason) continue;
    flags.push({
      level: "high",
      title: "High risk",
      body: normalizeIssueText(reason),
    });
  }

  for (const item of arr(obj(model.confidence).unclear)) {
    const text = s(item).replace(/_/g, " ").trim();
    if (!text) continue;
    flags.push({
      level: "medium",
      title: "Needs review",
      body: normalizeIssueText(`${text} is still unclear.`),
    });
  }

  for (const item of arr(obj(model.recommendation).notes)) {
    const note = s(item);
    if (!note) continue;

    const safeLevel =
      /high risk|should be corrected|did not clearly answer/i.test(note)
        ? "high"
        : "medium";

    flags.push({
      level: safeLevel,
      title: safeLevel === "high" ? "High risk" : "Review note",
      body: normalizeIssueText(note),
    });
  }

  const deduped = [];
  const seen = new Set();

  for (const item of flags) {
    const key = `${item.level}|${item.title}|${item.body}`.toLowerCase();
    if (!item.body || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped.slice(0, 6);
}

function pickSoftReviewNote(model = {}) {
  const flags = buildDraftReviewFlags(model);
  if (!flags.length) return null;
  return flags[0];
}

function bubbleShell(role = "assistant") {
  if (role === "user") {
    return "rounded-[20px] rounded-br-[10px] border border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,#0f172a,#111827)] text-white shadow-[0_16px_34px_rgba(2,6,23,0.16)]";
  }

  return "rounded-[20px] rounded-bl-[10px] border border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,250,251,0.98))] text-text shadow-[0_10px_28px_rgba(15,23,42,0.05)]";
}

const bubbleMotion = {
  hidden: { opacity: 0, y: 10, scale: 0.992 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
  },
};

function ChatBubble({ role = "assistant", body = "" }) {
  const isUser = role === "user";

  return (
    <motion.div variants={bubbleMotion} initial="hidden" animate="visible">
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[76%] px-4 py-3 ${bubbleShell(role)}`}>
          <div
            className={`whitespace-pre-wrap text-[14px] leading-[1.68] tracking-[-0.01em] ${
              isUser ? "text-white/96" : "text-[rgba(15,23,42,0.92)]"
            }`}
          >
            {body}
          </div>
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
      <div className="rounded-[20px] rounded-bl-[10px] border border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,250,251,0.98))] px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse [animation-delay:120ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse [animation-delay:240ms]" />
        </div>
      </div>
    </motion.div>
  );
}

function StatusNotice({ message = "" }) {
  if (!s(message)) return null;

  return (
    <motion.div variants={bubbleMotion} initial="hidden" animate="visible">
      <div className="rounded-[18px] border border-[rgba(239,68,68,0.12)] bg-[rgba(255,244,244,0.9)] px-4 py-3 text-[13px] leading-6 text-[#7f1d1d]">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{compactText(message, 220)}</div>
        </div>
      </div>
    </motion.div>
  );
}

function ActionButton({
  children,
  tone = "primary",
  onClick,
  disabled = false,
}) {
  const styles =
    tone === "primary"
      ? "bg-[linear-gradient(180deg,#0f172a,#020617)] text-white shadow-[0_14px_34px_rgba(2,6,23,0.18)] hover:translate-y-[-1px]"
      : "border border-[rgba(15,23,42,0.08)] bg-white text-text hover:bg-[rgba(15,23,42,0.028)]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center gap-2 rounded-[14px] px-4 text-[13px] font-medium tracking-[-0.01em] transition-all disabled:cursor-not-allowed disabled:opacity-45 ${styles}`}
    >
      {children}
    </button>
  );
}

function WelcomeCard({ busy = false, onStartSetup, onGoToChannels }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[26px] rounded-bl-[12px] rounded-tr-[18px] border border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.97))] px-5 py-5 shadow-[0_24px_70px_rgba(15,23,42,0.07)]"
    >
      <div className="pointer-events-none absolute right-0 top-0 h-[220px] w-[220px] bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.07),transparent_68%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-[linear-gradient(90deg,rgba(15,23,42,0),rgba(15,23,42,0.18),rgba(15,23,42,0))]" />

      <div className="relative">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          <Sparkles className="h-4 w-4 text-brand" />
          Setup
        </div>

        <div className="mt-4 text-[21px] font-semibold tracking-[-0.045em] text-text">
          Salam. Gəlin bunu səliqəli quraq.
        </div>

        <div className="mt-2 max-w-[560px] text-[14px] leading-7 text-text-subtle">
          Kanalları sonra da bağlaya bilərsiniz. Əvvəl biznesiniz üçün təmiz və
          professional bir setup draft yığaq.
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <ActionButton tone="secondary" onClick={onGoToChannels} disabled={busy}>
            Go to channels
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </ActionButton>

          <ActionButton tone="primary" onClick={onStartSetup} disabled={busy}>
            {busy ? "Starting..." : "Start setup"}
            <Sparkles className="h-4 w-4" strokeWidth={2} />
          </ActionButton>
        </div>
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
      <div className="relative overflow-hidden rounded-[22px] rounded-bl-[14px] rounded-tr-[18px] border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] px-4 py-4 shadow-[0_18px_54px_rgba(15,23,42,0.08)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-[linear-gradient(90deg,rgba(15,23,42,0),rgba(15,23,42,0.16),rgba(15,23,42,0))]" />

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
            className="min-h-[84px] flex-1 resize-none appearance-none border-0 bg-transparent px-1 py-1.5 text-[14px] leading-[1.68] tracking-[-0.01em] text-text shadow-none outline-none ring-0 placeholder:text-text-subtle focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            style={{ boxShadow: "none" }}
          />

          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled}
            aria-label="Send"
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] transition-all ${
              disabled
                ? "bg-[rgba(15,23,42,0.10)] text-white/80 shadow-none"
                : "bg-[linear-gradient(180deg,#0f172a,#020617)] text-white shadow-[0_16px_30px_rgba(2,6,23,0.18)] hover:translate-y-[-1px]"
            }`}
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" strokeWidth={2.4} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SoftReviewWhisper({ note = null }) {
  const item = note ? obj(note) : {};
  if (!s(item.body)) return null;

  const tone =
    item.level === "high"
      ? "text-[#991b1b]"
      : "text-[rgba(120,53,15,0.92)]";

  return (
    <motion.div variants={bubbleMotion} initial="hidden" animate="visible">
      <div className="flex justify-start">
        <div className="max-w-[76%] pl-1">
          <div className="flex items-center gap-2 text-[11px] font-medium tracking-[-0.01em] text-text-muted">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            <span>Hidden analysis</span>
          </div>
          <div className={`mt-1 text-[12px] leading-6 ${tone}`}>
            {item.title}: {item.body}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EditorialRow({ label, value, noBorder = false }) {
  return (
    <div
      className={`grid gap-2 py-3.5 sm:grid-cols-[158px_minmax(0,1fr)] ${
        noBorder ? "" : "border-b border-[rgba(15,23,42,0.06)]"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </div>
      <div className="text-[14px] leading-7 tracking-[-0.01em] text-text">
        {value}
      </div>
    </div>
  );
}

function ReviewSignal({ level = "medium", title = "", body = "" }) {
  const accent =
    level === "high"
      ? {
          dot: "bg-[#dc2626]",
          title: "text-[#991b1b]",
          body: "text-[#7f1d1d]",
          line: "bg-[rgba(220,38,38,0.18)]",
        }
      : {
          dot: "bg-[#d97706]",
          title: "text-[#92400e]",
          body: "text-[#78350f]",
          line: "bg-[rgba(217,119,6,0.16)]",
        };

  return (
    <div className="grid grid-cols-[14px_minmax(0,1fr)] gap-3">
      <div className="relative flex justify-center">
        <div className={`mt-1 h-2.5 w-2.5 rounded-full ${accent.dot}`} />
        <div className={`absolute top-5 bottom-0 w-px ${accent.line}`} />
      </div>
      <div className="pb-4">
        <div className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${accent.title}`}>
          {title}
        </div>
        <div className={`mt-1 text-[13px] leading-6 ${accent.body}`}>{body}</div>
      </div>
    </div>
  );
}

function SmartDraftCard({ model, finalizing, onFinalize }) {
  const draft = obj(model.draft);
  const reviewFlags = buildDraftReviewFlags(model);

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

  const hasHighRisk = reviewFlags.some((item) => item.level === "high");
  const statusLabel =
    model.readyForApproval === true || isDraftReadyMessage(model.message)
      ? hasHighRisk
        ? "Review required"
        : reviewFlags.length > 0
          ? "Ready with notes"
          : "Ready for approval"
      : "In progress";

  const statusTone = hasHighRisk
    ? "text-[#991b1b]"
    : reviewFlags.length > 0
      ? "text-[#92400e]"
      : "text-[#0f172a]";

  return (
    <motion.div variants={bubbleMotion} initial="hidden" animate="visible">
      <div className="flex justify-start">
        <div className="max-w-[88%] min-w-0">
          <div className="relative overflow-hidden rounded-[26px] rounded-bl-[12px] rounded-tr-[18px] border border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.985),rgba(248,250,252,0.98))] shadow-[0_26px_80px_rgba(15,23,42,0.09)]">
            <div className="pointer-events-none absolute inset-0 opacity-[0.58]">
              <div className="absolute inset-x-0 top-0 h-[1px] bg-[linear-gradient(90deg,rgba(15,23,42,0),rgba(15,23,42,0.2),rgba(15,23,42,0))]" />
              <div className="absolute right-0 top-0 h-[240px] w-[240px] bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_68%)]" />
            </div>

            <div className="relative px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    <Sparkles className="h-4 w-4 text-brand" />
                    Setup draft
                  </div>

                  <div className="mt-3 text-[23px] font-semibold tracking-[-0.05em] text-text">
                    Draft ready
                  </div>

                  {s(model.message) ? (
                    <div className="mt-2 max-w-[560px] text-[14px] leading-7 tracking-[-0.01em] text-text-subtle">
                      {model.message}
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                    Status
                  </div>
                  <div className={`mt-2 text-[13px] font-medium ${statusTone}`}>
                    {statusLabel}
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-[rgba(15,23,42,0.06)]">
                {rows.map(([label, value], index) => (
                  <EditorialRow
                    key={label}
                    label={label}
                    value={value}
                    noBorder={index === rows.length - 1 && reviewFlags.length === 0}
                  />
                ))}
              </div>

              {reviewFlags.length ? (
                <div className="mt-6 border-t border-[rgba(15,23,42,0.06)] pt-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                      Review intelligence
                    </div>
                    <div className="text-[11px] text-text-subtle">
                      surfaced from hidden analysis
                    </div>
                  </div>

                  <div className="mt-4">
                    {reviewFlags.map((item, index) => (
                      <ReviewSignal
                        key={`${item.level}-${item.title}-${index}`}
                        level={item.level}
                        title={item.title}
                        body={item.body}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-3 pt-2">
                <ActionButton tone="primary" onClick={onFinalize} disabled={finalizing}>
                  {finalizing ? "Finalizing..." : "Approve and finish setup"}
                </ActionButton>

                <div className="text-[12px] leading-6 text-text-subtle">
                  {reviewFlags.length
                    ? "Review the flagged points before approval."
                    : "This draft is structurally ready for approval."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
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
  const [showTypingBubble, setShowTypingBubble] = useState(false);

  const busy = saving || finalizing || capturingSource;

  const finalModel = useMemo(
    () => buildFinalViewModel(reviewPayload, assistant),
    [reviewPayload, assistant]
  );

  const smartDraftReady = useMemo(
    () => shouldShowSmartDraft(finalModel),
    [finalModel]
  );

  const currentQuestion = finalModel.nextQuestion;
  const questionCopy = useMemo(
    () => normalizeQuestionCopy(currentQuestion),
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

  const hasServerUserTurn = useMemo(
    () => serverTimeline.some((item) => item.role === "user" && s(item.body)),
    [serverTimeline]
  );

  const showWelcome = !setupPrimed && serverTimeline.length === 0 && !busy;

  const hideComposer =
    !showWelcome &&
    sessionHydrated &&
    smartDraftReady &&
    !s(currentQuestion?.key || currentQuestion?.step);

  const composerPlaceholder = useMemo(() => {
    if (showWelcome) return DEFAULT_COMPOSER_PLACEHOLDER;
    if (hideComposer) return "";
    if (s(questionCopy.placeholder)) return questionCopy.placeholder;
    return DEFAULT_COMPOSER_PLACEHOLDER;
  }, [showWelcome, hideComposer, questionCopy.placeholder]);

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

  const visiblePendingUserMessage = useMemo(() => {
    if (!s(pendingUserMessage)) return "";
    if (timelineHasUserMessage(serverTimeline, pendingUserMessage)) return "";
    return pendingUserMessage;
  }, [pendingUserMessage, serverTimeline]);

  const softReviewNote = useMemo(() => {
    if (showWelcome) return null;
    if (smartDraftReady) return null;
    if (busy) return null;
    if (!hasServerUserTurn) return null;
    return pickSoftReviewNote(finalModel);
  }, [showWelcome, smartDraftReady, busy, hasServerUserTurn, finalModel]);

  const visibleErrorMessage = useMemo(
    () =>
      resolveVisibleErrorMessage({
        localError,
        externalError: errorMessage,
        assistantError: finalModel.error,
      }),
    [localError, errorMessage, finalModel.error]
  );

  useEffect(() => {
    if (!busy) return undefined;

    const timer = window.setTimeout(() => {
      setShowTypingBubble(true);
    }, TYPING_BUBBLE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      setShowTypingBubble(false);
    };
  }, [busy]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [
    serverTimeline,
    visiblePendingUserMessage,
    showTypingBubble,
    visibleErrorMessage,
    smartDraftReady,
    staticAssistantMessage,
    showWelcome,
    softReviewNote,
  ]);

  useEffect(() => {
    if (!sessionHydrated || showWelcome || busy || hideComposer) return;
    textareaRef.current?.focus?.();
  }, [sessionHydrated, showWelcome, busy, hideComposer, serverTimeline.length]);

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
    if (!text || busy || hideComposer) return;

    setLocalError("");
    setPendingUserMessage(text);
    setComposerValue("");

    try {
      const response = await onParseMessage?.({
        mode: "message",
        message: text,
        text,
        value: text,
        step:
          s(currentQuestion?.step || currentQuestion?.key || "company") ||
          "company",
        questionKey: s(currentQuestion?.key),
      });

      const responseTimeline = responseTimelineFromPayload(response);
      if (timelineHasUserMessage(responseTimeline, text)) {
        setPendingUserMessage("");
      }

      requestAnimationFrame(() => {
        if (!hideComposer) {
          textareaRef.current?.focus?.();
        }
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
          <StatusNotice message={visibleErrorMessage} />

          {showWelcome ? (
            <WelcomeCard
              busy={busy}
              onStartSetup={handleStartSetupClick}
              onGoToChannels={onGoToChannels}
            />
          ) : null}

          <AnimatePresence initial={false}>
            {serverTimeline.map((item) => (
              <ChatBubble key={item.id} role={item.role} body={item.body} />
            ))}
          </AnimatePresence>

          {s(staticAssistantMessage) ? (
            <ChatBubble role="assistant" body={staticAssistantMessage} />
          ) : null}

          {s(visiblePendingUserMessage) ? (
            <ChatBubble role="user" body={visiblePendingUserMessage} />
          ) : null}

          {showTypingBubble ? <TypingBubble /> : null}

          {softReviewNote ? <SoftReviewWhisper note={softReviewNote} /> : null}

          {smartDraftReady ? (
            <SmartDraftCard
              model={finalModel}
              finalizing={finalizing}
              onFinalize={onFinalize}
            />
          ) : null}
        </div>
      </div>

      {!showWelcome && sessionHydrated && !hideComposer ? (
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