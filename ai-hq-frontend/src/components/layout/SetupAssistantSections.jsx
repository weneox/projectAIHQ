import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Circle,
  LoaderCircle,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const DEFAULT_COMPOSER_PLACEHOLDER = "Write a message";
const TYPING_BUBBLE_DELAY_MS = 320;

const LOCALIZED_QUESTION_COPY = {
  company: {
    body: "Start with the business name. Add the website if there is one.",
    placeholder: "Business name",
  },
  description: {
    body: "What does this business do? Keep it short and specific.",
    placeholder: "Short business description",
  },
  services: {
    body: "List the main services. Commas or one per line both work.",
    placeholder: "Main services",
  },
  contacts: {
    body: "How should customers contact you? Add phone, WhatsApp, email, or links.",
    placeholder: "Customer contact details",
  },
  hours: {
    body: "Add operating hours. Example: weekdays 09:00-18:00, Saturday 10:00-15:00.",
    placeholder: "Operating hours",
  },
  pricing: {
    body: "Add the key pricing truth: exact price, starting price, consultation, or quote first.",
    placeholder: "Pricing guidance",
  },
  handoff: {
    body: "When must AI hand off to a person?",
    placeholder: "Handoff rules",
  },
  greeting_behavior: {
    body: "How should AI greet customers? You can include a sample line.",
    placeholder: "Example: brief professional greeting",
  },
  closing_behavior: {
    body: "How should it close a conversation? Offer a next step or keep it brief?",
    placeholder: "Example: warm close with next step",
  },
  tone_behavior: {
    body: "Overall tone: professional, warm, premium, direct, or brief?",
    placeholder: "Example: professional and calm, short answers",
  },
  pricing_behavior: {
    body: "How should AI answer pricing questions?",
    placeholder: "Example: answer plus pricing page",
  },
  location_behavior: {
    body: "How should AI answer location questions?",
    placeholder: "Example: address plus map link",
  },
  booking_behavior: {
    body: "Where should AI send customers for booking?",
    placeholder: "Example: WhatsApp or booking page",
  },
  contact_behavior: {
    body: "Which contact channel should AI prioritize?",
    placeholder: "Example: WhatsApp first",
  },
  handoff_behavior: {
    body: "How should AI behave when a human handoff is needed?",
    placeholder: "Example: ask one short reason first",
  },
};

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

function uniqueStrings(items = [], max = 24) {
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

const POLICY_VALUE_COPY = {
  answer_first: "Qiymət faktı varsa qısa cavab verir.",
  answer_then_link: "Əvvəl qısa izah edir, sonra uyğun link və ya yönləndirmə verir.",
  link_first: "Qiymət üçün əvvəlcə uyğun linkə yönləndirir.",
  ask_service_first: "Qiymət demədən əvvəl xidmət növünü dəqiqləşdirir.",
  quote_first: "Dəqiq qiyməti uydurmur, əvvəlcə sorğu və ya konsultasiyaya yönləndirir.",

  text_only: "Ünvanı qısa mətn kimi verir.",
  text_then_map: "Ünvanı yazır, lazım olsa xəritə linki də verir.",
  map_first: "Ünvan üçün xəritə linkini önə çıxarır.",

  best_available: "Ən uyğun mövcud əlaqə yolunu seçir.",
  route_whatsapp: "Booking üçün WhatsApp-a yönləndirir.",
  route_instagram: "Booking üçün Instagram DM-ə yönləndirir.",
  route_website: "Booking üçün website linkinə yönləndirir.",
  collect_then_route: "Əvvəl qısa məlumat toplayır, sonra uyğun yerə yönləndirir.",

  whatsapp_first: "Əlaqə üçün WhatsApp-ı önə çıxarır.",
  call_first: "Əlaqə üçün zəngi önə çıxarır.",
  email_first: "Əlaqə üçün email-i önə çıxarır.",

  contextual_handoff: "Lazım olanda kontekstə görə insana ötürür.",
  ask_then_handoff: "İnsana ötürməzdən əvvəl qısa səbəb soruşur.",
  direct_handoff: "İnsan istənəndə birbaşa operatora yönləndirir.",

  warm_professional: "İsti və professional salamlayır.",
  brief_professional: "Qısa və professional salamlayır.",
  premium_concierge: "Premium concierge üslubunda salamlayır.",
  friendly_local: "Səmimi və yerli üslubda salamlayır.",

  warm_invite: "Sonda isti növbəti addım təklifi verir.",
  brief_invite: "Söhbəti qısa və səliqəli bağlayır.",
  premium_invite: "Söhbəti premium və nəzakətli bağlayır.",
  soft_close: "Söhbəti yumşaq şəkildə bağlayır.",

  professional_reassuring: "Professional və arxayın tonda danışır.",
  warm_human: "İsti və insani tonda danışır.",
  premium_polished: "Premium və səliqəli tonda danışır.",
  direct_clear: "Düz, qısa və aydın danışır.",

  concise: "Qısa cavablar verir.",
  balanced: "Balanslı uzunluqda cavab verir.",
  detailed: "Lazım olanda daha detallı cavab verir.",
};

function humanizeDraftValue(value = "") {
  const text = s(value);
  if (!text) return "";

  const direct = POLICY_VALUE_COPY[lower(text)];
  if (direct) return direct;

  if (/^[a-z]+(?:_[a-z]+)+$/.test(text)) {
    return text.replace(/_/g, " ");
  }

  return text;
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

function bubbleMotion() {
  return {
    hidden: { opacity: 0, y: 10, scale: 0.992 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
    },
  };
}

function normalizeQuestion(value = {}) {
  const source = obj(value);
  const key = lower(source.key || source.step);

  return {
    key,
    step: lower(source.step || source.key),
    title: s(source.title),
    prompt: s(source.prompt),
    placeholder: s(source.placeholder),
    phase: lower(source.phase),
    phaseLabel: s(source.phaseLabel),
    group: lower(source.group),
    groupLabel: s(source.groupLabel),
  };
}

function normalizeTimelineEntry(value = {}) {
  const source = obj(value);

  return {
    id: s(source.id) || `timeline-${Math.random().toString(36).slice(2, 10)}`,
    role: lower(source.role) === "user" ? "user" : "assistant",
    body: s(source.text || source.body || source.message),
    meta: s(source.meta),
    questionKey: lower(source.questionKey || source.question_key),
    phase: lower(source.phase),
    provider: s(source.provider),
    model: s(source.model),
    usedFallback: source.usedFallback === true,
    error: s(source.error),
    createdAt: source.createdAt || source.created_at || null,
  };
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

  if (row.appointmentOnly === true) {
    return [day, "appointment only"].filter(Boolean).join(" ");
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

function mapHoursItems(items = []) {
  return uniqueStrings(arr(items).map((item) => formatHoursItem(item)), 24);
}

function normalizeQuestionCopy(question = null) {
  const safeQuestion = obj(question);
  const key = lower(safeQuestion.key || safeQuestion.step);
  const local = obj(LOCALIZED_QUESTION_COPY[key]);

  return {
    body: s(safeQuestion.prompt || local.body),
    placeholder: s(safeQuestion.placeholder || local.placeholder),
  };
}

function normalizeComparableMessage(value = "") {
  return s(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function mergeTimelineEntries(...segments) {
  const out = [];
  const seen = new Set();

  for (const item of segments.flatMap((segment) => arr(segment))) {
    const key =
      s(item?.id) ||
      `${lower(item?.role)}|${normalizeComparableMessage(item?.body)}|${lower(
        item?.questionKey
      )}`;
    if (!item?.body || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function phaseLabelFromKey(value = "") {
  const key = lower(value);
  if (key === "business_truth") return "Biznes faktları";
  if (key === "conversation_policy") return "AI danışıq qaydası";
  if (key === "review_and_launch") return "Yoxlama";
  return "Setup";
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
    sections: arr(source.sections),
    draftPreviewHidden: source.draftPreviewHidden === true,
    draftVisibilityMode: s(source.draftVisibilityMode),
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
  const assistantBehaviorDraft = obj(setupDraft.assistantBehaviorDraft);
  const previewDraft = obj(canonicalAssistant.draft);
  const reviewSetup = obj(obj(reviewPayload).setup);
  const aiProfilePreview = obj(
    reviewSetup.aiProfilePreview || obj(assistantState).aiProfilePreview
  );
  const sourceStrategy = obj(
    reviewSetup.sourceStrategy ||
      aiProfilePreview.sourceStrategy ||
      obj(assistantState).sourceStrategy
  );

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
    sourceStrategy,
    aiProfilePreview,
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
      greetingBehaviorSummary: s(
        previewDraft.greetingBehaviorSummary ||
          obj(assistantBehaviorDraft.greetingPolicy).openingLine
      ),
      closingBehaviorSummary: s(
        previewDraft.closingBehaviorSummary ||
          obj(assistantBehaviorDraft.closingPolicy).closingLine
      ),
      toneBehaviorSummary: s(
        previewDraft.toneBehaviorSummary ||
          obj(assistantBehaviorDraft.tonePolicy).mode
      ),
      pricingBehaviorSummary: s(
        previewDraft.pricingBehaviorSummary ||
          obj(assistantBehaviorDraft.pricingPolicy).mode
      ),
      locationBehaviorSummary: s(
        previewDraft.locationBehaviorSummary ||
          obj(assistantBehaviorDraft.locationPolicy).mode
      ),
      bookingBehaviorSummary: s(
        previewDraft.bookingBehaviorSummary ||
          obj(assistantBehaviorDraft.bookingPolicy).mode
      ),
      contactBehaviorSummary: s(
        previewDraft.contactBehaviorSummary ||
          obj(assistantBehaviorDraft.contactPolicy).mode
      ),
      handoffBehaviorSummary: s(
        previewDraft.handoffBehaviorSummary ||
          obj(assistantBehaviorDraft.handoffPolicy).mode
      ),
    },
  };
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
      s(safeDraft.humanHandoff) ||
      s(safeDraft.greetingBehaviorSummary) ||
      s(safeDraft.closingBehaviorSummary) ||
      s(safeDraft.toneBehaviorSummary) ||
      s(safeDraft.pricingBehaviorSummary) ||
      s(safeDraft.locationBehaviorSummary) ||
      s(safeDraft.bookingBehaviorSummary) ||
      s(safeDraft.contactBehaviorSummary) ||
      s(safeDraft.handoffBehaviorSummary)
  );
}

function shouldShowDraft(model = {}) {
  const hasDraft = hasAnyDraftContent(obj(model.draft));
  if (!hasDraft) return false;

  if (model.readyForApproval === true) return true;
  if (model.draftPreviewHidden === true) return false;

  return lower(model.draftVisibilityMode) !== "hidden_until_review";
}

function toneForSectionStatus(status = "") {
  const safe = lower(status);
  if (safe === "ready") return "success";
  if (safe === "needs_review") return "warning";
  if (safe === "missing") return "danger";
  if (safe === "not_applicable") return "neutral";
  return "neutral";
}

function toneClass(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "info") return "text-brand";
  return "text-text-subtle";
}

function sectionGroups(sections = []) {
  const groups = {
    business_truth: [],
    conversation_policy: [],
    review_and_launch: [],
  };

  for (const rawSection of arr(sections)) {
    const section = obj(rawSection);
    const key = lower(section.phase || "business_truth");
    if (!groups[key]) groups[key] = [];
    groups[key].push(section);
  }

  return groups;
}

function phaseProgress(sections = []) {
  const safe = arr(sections).filter(
    (item) => lower(item.status) !== "not_applicable"
  );

  return {
    total: safe.length,
    ready: safe.filter((item) => lower(item.status) === "ready").length,
    missing: safe.filter((item) => lower(item.status) === "missing").length,
    needsReview: safe.filter((item) => lower(item.status) === "needs_review")
      .length,
  };
}

function reviewFlagsFromModel(model = {}) {
  const out = [];

  for (const item of arr(model.rejectedInputs)) {
    const reason = compactText(s(item?.reason || item?.input), 180);
    if (!reason) continue;
    out.push({
      level: "high",
      title: "High risk",
      body: reason,
    });
  }

  for (const item of arr(obj(model.confidence).unclear)) {
    const text = compactText(s(item).replace(/_/g, " "), 180);
    if (!text) continue;
    out.push({
      level: "medium",
      title: "Needs review",
      body: `${text} is still unclear.`,
    });
  }

  for (const item of arr(obj(model.recommendation).notes)) {
    const note = compactText(s(item), 180);
    if (!note) continue;

    out.push({
      level: /high risk|should be corrected|did not clearly answer/i.test(note)
        ? "high"
        : "medium",
      title: /high risk|should be corrected/i.test(note)
        ? "High risk"
        : "Review note",
      body: note,
    });
  }

  const seen = new Set();
  const deduped = [];

  for (const item of out) {
    const key = `${item.level}|${item.title}|${item.body}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped.slice(0, 6);
}

function bubbleShell(role = "assistant") {
  if (role === "user") {
    return "rounded-[20px] rounded-br-[10px] border border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,#0f172a,#111827)] text-white shadow-[0_16px_34px_rgba(2,6,23,0.16)]";
  }

  return "rounded-[20px] rounded-bl-[10px] border border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,250,251,0.98))] text-text shadow-[0_10px_28px_rgba(15,23,42,0.05)]";
}

function ChatBubble({ role = "assistant", body = "", meta = "" }) {
  const isUser = role === "user";

  return (
    <motion.div variants={bubbleMotion()} initial="hidden" animate="visible">
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[78%] px-4 py-3 ${bubbleShell(role)}`}>
          <div
            className={`whitespace-pre-wrap text-[14px] leading-[1.68] tracking-[-0.01em] ${
              isUser ? "text-white/96" : "text-[rgba(15,23,42,0.92)]"
            }`}
          >
            {body}
          </div>
          {meta ? (
            <div
              className={`mt-2 text-[11px] ${
                isUser ? "text-white/64" : "text-text-subtle"
              }`}
            >
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
      variants={bubbleMotion()}
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
    <motion.div variants={bubbleMotion()} initial="hidden" animate="visible">
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
          Smart setup
        </div>

        <div className="mt-4 text-[21px] font-semibold tracking-[-0.045em] text-text">
          Biznes beynini sehrli şəkildə quraq.
        </div>

        <div className="mt-2 max-w-[560px] text-[14px] leading-7 text-text-subtle">
          Website varsa link verin. Website yoxdursa, biznesinizi 2-3 cümlə ilə yazın. Sistem AI resepsionist üçün qısa profile preview hazırlayacaq.
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

function PhaseCard({ title, tone, status, summary, progressText }) {
  return (
    <div className="rounded-[20px] border border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(249,250,251,0.98))] px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[14px] font-semibold tracking-[-0.02em] text-text">
          {title}
        </div>
        <div className={`text-[12px] font-medium ${toneClass(tone)}`}>{status}</div>
      </div>
      <div className="mt-2 text-[13px] leading-6 text-text-muted">{summary}</div>
      {progressText ? (
        <div className="mt-2 text-[12px] font-medium text-text-subtle">
          {progressText}
        </div>
      ) : null}
    </div>
  );
}

function SectionRow({ section = {}, last = false }) {
  const status = lower(section.status);
  const tone = toneForSectionStatus(status);

  const leading =
    tone === "success" ? (
      <CheckCircle2 className="h-4 w-4 text-success" />
    ) : tone === "warning" ? (
      <Circle className="h-4 w-4 text-warning" />
    ) : tone === "danger" ? (
      <LockKeyhole className="h-4 w-4 text-danger" />
    ) : (
      <Circle className="h-4 w-4 text-text-subtle" />
    );

  return (
    <div
      className={`grid grid-cols-[24px_minmax(0,1fr)] gap-3 px-4 py-3 ${
        last ? "" : "border-b border-[rgba(15,23,42,0.06)]"
      }`}
    >
      <div className="pt-0.5">{leading}</div>
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="text-[13px] font-medium tracking-[-0.01em] text-text">
            {s(section.title || section.label || section.key)}
          </div>
          <div className={`text-[12px] ${toneClass(tone)}`}>
            {status === "ready"
              ? "Ready"
              : status === "needs_review"
                ? "Needs review"
                : status === "missing"
                  ? "Missing"
                  : "Not applicable"}
          </div>
        </div>

        {arr(section.missingFields).length > 0 ? (
          <div className="mt-1 text-[12px] leading-6 text-text-subtle">
            Missing: {arr(section.missingFields).join(", ")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EditorialRow({ label, value, noBorder = false }) {
  const displayValue = humanizeDraftValue(value);
  if (!displayValue) return null;

  return (
    <div
      className={`grid gap-2 py-3.5 sm:grid-cols-[170px_minmax(0,1fr)] ${
        noBorder ? "" : "border-b border-[rgba(15,23,42,0.06)]"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </div>
      <div className="text-[14px] leading-7 tracking-[-0.01em] text-text">
        {displayValue}
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
  const reviewFlags = reviewFlagsFromModel(model);

  const rows = [
    ["Biznes adı", draft.businessName],
    ["Biznes nə edir", draft.whatThisBusinessIs],
    ["Website", draft.websiteUrl],
    ["Əsas xidmətlər", listPreview(draft.coreServices, 6)],
    ["Qiymət məntiqi", draft.pricingPosture],
    ["Əlaqə yolları", listPreview(draft.contactRoutes, 6)],
    ["İş saatları", listPreview(draft.hours, 4)],
    ["İnsana ötürmə halları", draft.humanHandoff],
    ["Salamlama", draft.greetingBehaviorSummary],
    ["Söhbəti bağlama", draft.closingBehaviorSummary],
    ["Ümumi ton", draft.toneBehaviorSummary],
    ["Qiymət soruşulanda", draft.pricingBehaviorSummary],
    ["Ünvan soruşulanda", draft.locationBehaviorSummary],
    ["Rezervasiya istənəndə", draft.bookingBehaviorSummary],
    ["Əlaqə istənəndə", draft.contactBehaviorSummary],
    ["Operator lazım olanda", draft.handoffBehaviorSummary],
  ].filter(([, value]) => s(value));

  const hasHighRisk = reviewFlags.some((item) => item.level === "high");
  const statusLabel =
    model.readyForApproval === true
      ? hasHighRisk
        ? "Yoxlama lazımdır"
        : reviewFlags.length > 0
          ? "Qeydlərlə hazır"
          : "Təsdiqə hazır"
      : "Hazırlanır";

  const statusTone = hasHighRisk
    ? "text-[#991b1b]"
    : reviewFlags.length > 0
      ? "text-[#92400e]"
      : "text-[#0f172a]";

  return (
    <motion.div variants={bubbleMotion()} initial="hidden" animate="visible">
      <div className="flex justify-start">
        <div className="max-w-[90%] min-w-0">
          <div className="relative overflow-hidden rounded-[26px] rounded-bl-[12px] rounded-tr-[18px] border border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.985),rgba(248,250,252,0.98))] shadow-[0_26px_80px_rgba(15,23,42,0.09)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-[linear-gradient(90deg,rgba(15,23,42,0),rgba(15,23,42,0.2),rgba(15,23,42,0))]" />
            <div className="relative px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Yoxlama
                  </div>
                  <div className="mt-2 text-[20px] font-semibold tracking-[-0.04em] text-text">
                    AI resepsionist draftı
                  </div>
                  <div className={`mt-1 text-[12px] font-medium ${statusTone}`}>
                    {statusLabel}
                  </div>
                </div>

                {model.readyForApproval === true ? (
                  <ActionButton
                    tone="primary"
                    onClick={onFinalize}
                    disabled={finalizing}
                  >
                    {finalizing ? "Təsdiqlənir..." : "Təsdiqlə"}
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </ActionButton>
                ) : null}
              </div>

              <div className="mt-4 rounded-[18px] border border-[rgba(15,23,42,0.06)] bg-white/80 px-4 py-2.5">
                {rows.map(([label, value], index) => (
                  <EditorialRow
                    key={`${label}-${index}`}
                    label={label}
                    value={value}
                    noBorder={index === rows.length - 1}
                  />
                ))}
              </div>

              {reviewFlags.length > 0 ? (
                <div className="mt-4 rounded-[18px] border border-[rgba(15,23,42,0.06)] bg-white/80 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                    Yoxlama qeydləri
                  </div>
                  <div className="mt-3">
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
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}


function previewItems(items = []) {
  return arr(items)
    .map((item) => {
      if (typeof item === "string") {
        return { key: item, label: "", summary: item };
      }

      const safe = obj(item);
      const label = s(safe.label || safe.title || safe.key);
      const summary = s(safe.summary || safe.reason || safe.body || safe.text);

      if (!label && !summary) return null;

      return {
        key: s(safe.key || label || summary),
        label,
        summary,
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

function hasAiProfilePreview(model = {}) {
  const preview = obj(model.aiProfilePreview);
  const source = obj(model.sourceStrategy || preview.sourceStrategy);

  return Boolean(
    s(preview.title) ||
      s(preview.summary) ||
      arr(preview.knows).length ||
      arr(preview.behavior).length ||
      arr(preview.willNotInvent).length ||
      arr(preview.missingQuestions).length ||
      s(source.productMode)
  );
}

function StatusPill({ children, tone = "neutral" }) {
  const toneClassName =
    tone === "success"
      ? "border-[rgba(22,163,74,0.16)] bg-[rgba(240,253,244,0.9)] text-[#166534]"
      : tone === "warning"
        ? "border-[rgba(217,119,6,0.18)] bg-[rgba(255,251,235,0.95)] text-[#92400e]"
        : "border-[rgba(15,23,42,0.08)] bg-white/80 text-text-subtle";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClassName}`}
    >
      {children}
    </span>
  );
}

function SourceStep({ index, title, body, status, active = false }) {
  return (
    <div
      className={`rounded-[18px] border px-4 py-4 ${
        active
          ? "border-[rgba(37,99,235,0.18)] bg-[rgba(239,246,255,0.75)]"
          : "border-[rgba(15,23,42,0.07)] bg-white/80"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
            active ? "bg-[#0f172a] text-white" : "bg-[rgba(15,23,42,0.06)] text-text"
          }`}
        >
          {index}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold tracking-[-0.01em] text-text">
            {title}
          </div>
          <div className="mt-1 text-[12px] leading-5 text-text-subtle">
            {body}
          </div>
          {status ? (
            <div className="mt-2">
              <StatusPill tone={active ? "success" : "neutral"}>{status}</StatusPill>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProfileList({ title, items = [], empty = "Hələ məlumat yoxdur." }) {
  const safeItems = previewItems(items);

  return (
    <div className="rounded-[20px] border border-[rgba(15,23,42,0.07)] bg-white/82 px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
        {title}
      </div>

      {safeItems.length ? (
        <div className="mt-3 grid gap-3">
          {safeItems.map((item, index) => (
            <div key={`${item.key || item.label || item.summary}-${index}`} className="grid grid-cols-[18px_minmax(0,1fr)] gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
              <div>
                {item.label ? (
                  <div className="text-[13px] font-semibold tracking-[-0.01em] text-text">
                    {item.label}
                  </div>
                ) : null}
                {item.summary ? (
                  <div className="mt-0.5 text-[13px] leading-6 text-text-subtle">
                    {humanizeDraftValue(item.summary)}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-[13px] leading-6 text-text-subtle">{empty}</div>
      )}
    </div>
  );
}

function SetupIntelligenceCard({ model = {}, finalizing = false, onFinalize }) {
  const preview = obj(model.aiProfilePreview);
  const source = obj(preview.sourceStrategy || model.sourceStrategy);
  const website = obj(source.website);
  const manualBrief = obj(source.manualBrief);
  const googleMaps = obj(source.googleMaps);
  const primaryMode = lower(source.primaryMode);
  const ready = model.readyForApproval === true || preview.readyForReview === true;

  const sourceStatus =
    primaryMode === "website"
      ? "Website-dən başla"
      : "Manual qısa izah";

  return (
    <motion.div
      variants={bubbleMotion()}
      initial="hidden"
      animate="visible"
      className="grid gap-4"
    >
      <div className="relative overflow-hidden rounded-[26px] border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.98))] px-5 py-5 shadow-[0_24px_70px_rgba(15,23,42,0.07)]">
        <div className="pointer-events-none absolute right-0 top-0 h-[240px] w-[240px] bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.08),transparent_68%)]" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              <Sparkles className="h-4 w-4 text-brand" />
              Smart setup
            </div>
            <div className="mt-3 text-[22px] font-semibold tracking-[-0.045em] text-text">
              {s(preview.title, "AI resepsionist profili")}
            </div>
            <div className="mt-2 max-w-[620px] text-[14px] leading-7 text-text-subtle">
              {s(
                preview.summary,
                "Website və ya qısa biznes izahından AI resepsionist üçün ilkin beyin hazırlanır."
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusPill tone={ready ? "success" : "warning"}>
              {ready ? "Təsdiqə hazır" : "Tamamlanır"}
            </StatusPill>
            <StatusPill>{sourceStatus}</StatusPill>
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 md:grid-cols-3">
          <SourceStep
            index="1"
            title="Website"
            body={s(
              website.helperText,
              "Website varsa link verin, sistem məlumatları avtomatik çıxarsın."
            )}
            status={s(website.status || "optional")}
            active={primaryMode === "website"}
          />
          <SourceStep
            index="2"
            title="Manual brief"
            body={s(
              manualBrief.prompt,
              "Website yoxdursa, biznesinizi 2-3 cümlə ilə yazın."
            )}
            status={s(manualBrief.status || "fallback")}
            active={primaryMode === "manual_brief"}
          />
          <SourceStep
            index="3"
            title="Google Maps"
            body={s(
              googleMaps.helperText,
              "V1-də əsas mənbə deyil; sonra fallback kimi əlavə olunacaq."
            )}
            status={googleMaps.enabled === false ? "V1-də bağlıdır" : "optional"}
          />
        </div>

        <div className="relative mt-4 grid gap-4 xl:grid-cols-2">
          <ProfileList
            title="AI nələri bilir"
            items={preview.knows}
            empty="Biznes faktları hələ toplanmayıb."
          />
          <ProfileList
            title="AI nəyi uydurmayacaq"
            items={preview.willNotInvent}
            empty="Təhlükəsizlik qaydası hələ hazırlanmayıb."
          />
          <ProfileList
            title="AI necə davranacaq"
            items={preview.behavior}
            empty="Danışıq davranışı hələ hazırlanmayıb."
          />
          <ProfileList
            title="Çatışmayan kritik suallar"
            items={preview.missingQuestions}
            empty="Hazırda kritik boşluq görünmür."
          />
        </div>

        {ready ? (
          <div className="relative mt-5 flex justify-end">
            <ActionButton tone="primary" onClick={onFinalize} disabled={finalizing}>
              {finalizing ? "Təsdiqlənir..." : "Təsdiqlə"}
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </ActionButton>
          </div>
        ) : null}
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

function useTypingState(active = false) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        setVisible(active);
      },
      active ? TYPING_BUBBLE_DELAY_MS : 0
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [active]);

  return visible;
}

function buildPhaseCardsFromSections(sections = []) {
  const groups = sectionGroups(sections);

  const business = phaseProgress(groups.business_truth);
  const conversation = phaseProgress(groups.conversation_policy);
  const review = phaseProgress(groups.review_and_launch);

  return [
    {
      key: "business_truth",
      title: "Biznes faktları",
      tone:
        business.total > 0 && business.ready === business.total
          ? "success"
          : business.ready > 0 || business.needsReview > 0
            ? "warning"
            : "neutral",
      status:
        business.total > 0 && business.ready === business.total
          ? "Ready"
          : business.ready > 0 || business.needsReview > 0
            ? "Hazırlanır"
            : "Not started",
      summary:
        "AI-nin təhlükəsiz cavab verəcəyi əsas faktlar: kimlik, xidmətlər, əlaqə, iş saatı, qiymət və insana ötürmə qaydaları.",
      progressText:
        business.total > 0 ? `${business.ready}/${business.total} ready` : "",
    },
    {
      key: "conversation_policy",
      title: "AI danışıq qaydası",
      tone:
        conversation.total > 0 && conversation.ready === conversation.total
          ? "success"
          : conversation.ready > 0 || conversation.needsReview > 0
            ? "warning"
            : "neutral",
      status:
        conversation.total > 0 && conversation.ready === conversation.total
          ? "Ready"
          : conversation.ready > 0 || conversation.needsReview > 0
            ? "Hazırlanır"
            : "Waiting",
      summary:
        "AI-nin salamı, tonu, cavab uzunluğu və müştərini hara yönləndirəcəyi.",
      progressText:
        conversation.total > 0
          ? `${conversation.ready}/${conversation.total} ready`
          : "",
    },
    {
      key: "review_and_launch",
      title: "Yoxlama",
      tone:
        review.total > 0 && review.ready === review.total
          ? "success"
          : "neutral",
      status:
        review.total > 0 && review.ready === review.total
          ? "Ready"
          : "Locked",
      summary:
        "Biznes faktları və danışıq qaydası hazır olanda son yoxlama burada açılır.",
      progressText: review.total > 0 ? `${review.ready}/${review.total} ready` : "",
    },
  ];
}

export default function SetupAssistantSections({
  storageKey: _storageKey,
  sessionHydrated = false,
  assistant = {},
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
  const [composerValue, setComposerValue] = useState("");
  const [localTimeline, setLocalTimeline] = useState([]);

  const textareaRef = useRef(null);
  const scrollerRef = useRef(null);

  const model = useMemo(
    () => buildFinalViewModel(reviewPayload, assistant),
    [reviewPayload, assistant]
  );

  const canonicalTimeline = useMemo(() => {
    const timeline = arr(model.timeline);
    const nextQuestion = obj(model.nextQuestion);

    if (timeline.length > 0) return timeline;

    if (s(model.message)) {
      return [
        {
          id: "assistant-initial-message",
          role: "assistant",
          body: s(model.message),
          meta: nextQuestion?.phaseLabel || phaseLabelFromKey(model.phase),
          questionKey: lower(nextQuestion.key),
          phase: lower(nextQuestion.phase || model.phase),
        },
      ];
    }

    return [];
  }, [model]);

  const displayTimeline = useMemo(
    () => mergeTimelineEntries(canonicalTimeline, localTimeline),
    [canonicalTimeline, localTimeline]
  );

  const activeQuestion = normalizeQuestion(model.nextQuestion);
  const questionCopy = normalizeQuestionCopy(activeQuestion);
  const busy = saving || capturingSource || finalizing;
  const showTyping = useTypingState(sessionHydrated && busy);
  const showDraft = shouldShowDraft(model);
  const reviewFlags = reviewFlagsFromModel(model);
  const phaseCards = buildPhaseCardsFromSections(arr(model.sections));
  const groupedSections = sectionGroups(arr(model.sections));
  const hasSession =
    Boolean(s(obj(assistant).session?.id)) || displayTimeline.length > 0 || showDraft;
  const profilePreviewReady = hasAiProfilePreview(model);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTo({
      top: node.scrollHeight,
      behavior: "smooth",
    });
  }, [displayTimeline, showTyping, busy]);

  async function handleSubmit() {
    const text = s(composerValue);
    if (!text || busy || !activeQuestion?.step) return;

    const userEntry = {
      id: `local-user-${Date.now()}`,
      role: "user",
      body: text,
      meta: activeQuestion.phaseLabel || phaseLabelFromKey(activeQuestion.phase),
      questionKey: lower(activeQuestion.key),
      phase: lower(activeQuestion.phase),
    };

    setLocalTimeline((prev) => [...prev, userEntry]);
    setComposerValue("");

    try {
      await onParseMessage?.({
        text,
        step: s(activeQuestion.step || activeQuestion.key),
      });
    } catch {
      return;
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-[rgba(15,23,42,0.06)] px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
          Assistant setup
        </div>
        <div className="mt-2 text-[19px] font-semibold tracking-[-0.04em] text-text">
          AI receptionist setup
        </div>
        <div className="mt-1 text-[13px] leading-6 text-text-subtle">
          Biznes faktlarını ver, AI-nin necə cavab verməli olduğunu təhlükəsiz şəkildə quraq.
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
      >
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
          {!hasSession ? (
            <WelcomeCard
              busy={busy}
              onStartSetup={onStartSetup}
              onGoToChannels={onGoToChannels}
            />
          ) : null}

          {hasSession && profilePreviewReady ? (
            <SetupIntelligenceCard
              model={model}
              finalizing={finalizing}
              onFinalize={onFinalize}
            />
          ) : null}

          {hasSession && !profilePreviewReady ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="grid gap-3 md:grid-cols-3"
            >
              {phaseCards.map((item) => (
                <PhaseCard key={item.key} {...item} />
              ))}
            </motion.div>
          ) : null}

          {!profilePreviewReady && arr(groupedSections.business_truth).length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden rounded-[22px] border border-[rgba(15,23,42,0.06)] bg-white/90 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
            >
              <div className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                Biznes faktları
              </div>
              {arr(groupedSections.business_truth).map((section, index, all) => (
                <SectionRow
                  key={s(section.key || index)}
                  section={section}
                  last={index === all.length - 1}
                />
              ))}
            </motion.div>
          ) : null}

          {!profilePreviewReady && arr(groupedSections.conversation_policy).length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden rounded-[22px] border border-[rgba(15,23,42,0.06)] bg-white/90 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
            >
              <div className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                AI danışıq qaydası
              </div>
              {arr(groupedSections.conversation_policy).map((section, index, all) => (
                <SectionRow
                  key={s(section.key || index)}
                  section={section}
                  last={index === all.length - 1}
                />
              ))}
            </motion.div>
          ) : null}

          <AnimatePresence initial={false}>
            {displayTimeline.map((item) => (
              <ChatBubble
                key={item.id}
                role={item.role}
                body={item.body}
                meta={item.meta}
              />
            ))}
          </AnimatePresence>

          {showTyping ? <TypingBubble /> : null}

          {showDraft && !profilePreviewReady ? (
            <SmartDraftCard
              model={model}
              finalizing={finalizing}
              onFinalize={onFinalize}
            />
          ) : !profilePreviewReady && model.draftPreviewHidden === true && hasAnyDraftContent(model.draft) ? (
            <motion.div variants={bubbleMotion()} initial="hidden" animate="visible">
              <div className="flex justify-start">
                <div className="max-w-[82%] rounded-[20px] rounded-bl-[10px] border border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,250,251,0.98))] px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                  <div className="text-[13px] leading-6 text-text-muted">
                    Draft preview is hidden for now. Complete business truth and
                    conversation policy, then review the full draft before launch.
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}

          {reviewFlags.length > 0 && !showDraft && !profilePreviewReady ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-[20px] border border-[rgba(15,23,42,0.06)] bg-white/90 px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                Yoxlama qeydləri
              </div>
              <div className="mt-3">
                {reviewFlags.map((item, index) => (
                  <ReviewSignal
                    key={`${item.level}-${item.title}-${index}`}
                    level={item.level}
                    title={item.title}
                    body={item.body}
                  />
                ))}
              </div>
            </motion.div>
          ) : null}

          <StatusNotice message={errorMessage || model.error} />
        </div>
      </div>

      {hasSession ? (
        <Composer
          value={composerValue}
          busy={busy}
          placeholder={
            questionCopy.placeholder || DEFAULT_COMPOSER_PLACEHOLDER
          }
          textareaRef={textareaRef}
          onChange={setComposerValue}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
