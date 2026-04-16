import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { resolveSetupSourceInput } from "./setupSourceIntake.js";

const STORAGE_PREFIX = "setup_assistant_chat_v1";

const QUESTION_FALLBACKS = {
  profile: {
    prompt: "Biznesin dəqiq public adını və nə etdiyini bir təmiz cümlə ilə yaz.",
    placeholder:
      "Məsələn: Neox Studio — AI avtomasiya, website və rəqəmsal təqdimat həlləri qururuq.",
  },
  website: {
    prompt: "Əsas website linkini yaz, əgər varsa.",
    placeholder: "Məsələn: yourbusiness.com",
  },
  services: {
    prompt:
      "AI-in danışmalı olduğu real xidmətləri yaz. Ümumi sözləri yox, həqiqi xidmətləri yaz.",
    placeholder:
      "Məsələn: website hazırlanması, reklam idarəetməsi, branding",
  },
  contacts: {
    prompt:
      "Müştərini ilk olaraq hara yönləndirməli olduğumuzu yaz.",
    placeholder:
      "Məsələn: WhatsApp, telefon zəngi, form və ya email",
  },
  hours: {
    prompt: "İş və cavab saatlarını bir sətirdə yaz.",
    placeholder:
      "Məsələn: B.e.–Cümə 10:00–19:00, Şənbə 11:00–16:00, Bazar bağlı",
  },
  pricing: {
    prompt: "AI qiymət barədə necə danışmalıdır?",
    placeholder:
      "Məsələn: xidmətə görə dəyişir, dəqiq quote üçün müraciət istənməlidir",
  },
  handoff: {
    prompt: "AI hansı hallarda dayanıb insana ötürməlidir?",
    placeholder:
      "Məsələn: şikayət, fərdi quote, ödəniş problemi, təcili iş, anlaşılmaz sorğu",
  },
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

function uniqueStrings(items = [], max = 12) {
  return [...new Set(arr(items).map((item) => s(item)).filter(Boolean))].slice(
    0,
    max
  );
}

function compactText(value, max = 260) {
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

  if (/şikayət|complaint|refund|payment|operator|manager|handoff|ötür/i.test(lowerText)) {
    return "handoff";
  }

  if (/[,\n;]/.test(text) && text.split(/[,;\n]/).filter((item) => s(item)).length >= 2) {
    return "services";
  }

  return s(fallbackStep, "profile");
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
    readyForApproval: source.readyForApproval === true,
    draftVersion: Number(source.draftVersion || 0),
    phase: s(source.phase),
    message: s(source.message || source.assistantMessage),
    provider: s(source.provider),
    model: s(source.model),
    usedFallback: source.usedFallback === true,
    error: s(source.error),
  };
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

  return {
    businessName: s(
      profile.companyName ||
        obj(setupDraft.businessProfile).companyName ||
        assistantDraft.businessName ||
        localAnswers.profile
    ),
    whatThisBusinessIs: s(
      profile.description ||
        obj(setupDraft.businessProfile).description ||
        assistantDraft.whatThisBusinessIs
    ),
    coreServices: services.length ? services : arr(assistantDraft.coreServices),
    pricingPosture: s(
      obj(setupDraft.pricingPosture).publicSummary ||
        assistantDraft.pricingPosture
    ),
    contactRoutes: uniqueStrings([
      s(profile.primaryPhone),
      s(profile.primaryEmail),
      ...contacts,
      ...arr(assistantDraft.contactRoutes),
    ]),
    humanHandoff: s(
      obj(setupDraft.handoffRules).summary || assistantDraft.humanHandoff
    ),
    hours: arr(assistantDraft.hours),
    websiteUrl: s(
      assistantDraft.websiteUrl || obj(setupDraft.businessProfile).websiteUrl
    ),
  };
}

function buildFinalViewModel({
  reviewPayload = null,
  assistant = {},
  localAnswers = {},
}) {
  const reviewAssistant = Object.keys(obj(reviewPayload?.assistant)).length
    ? obj(reviewPayload?.assistant)
    : obj(obj(assistant).assistant);

  const draft = obj(reviewAssistant.draft);
  const sourceSignals = obj(reviewAssistant.sourceSignals);
  const fallback = buildFallbackDraft(reviewPayload, assistant, localAnswers);

  return {
    message: s(reviewAssistant.message || reviewAssistant.assistantMessage),
    readyForApproval: reviewAssistant.readyForApproval === true,
    phase: s(reviewAssistant.phase),
    provider: s(reviewAssistant.provider),
    model: s(reviewAssistant.model),
    usedFallback: reviewAssistant.usedFallback === true,
    error: s(reviewAssistant.error),
    draft: {
      businessName: s(draft.businessName || fallback.businessName),
      whatThisBusinessIs: s(
        draft.whatThisBusinessIs || fallback.whatThisBusinessIs
      ),
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
    },
    sourceSignals: {
      primarySourceLabel: s(sourceSignals.primarySourceLabel),
      primarySourceUrl: s(sourceSignals.primarySourceUrl),
      coverage: obj(sourceSignals.coverage),
    },
  };
}

function hasBackendSmartDraft(model = {}) {
  const draft = obj(model.draft);

  return (
    model.readyForApproval === true &&
    Boolean(s(draft.businessName)) &&
    Boolean(s(draft.whatThisBusinessIs)) &&
    arr(draft.coreServices).length > 0 &&
    arr(draft.contactRoutes).length > 0 &&
    Boolean(s(draft.pricingPosture)) &&
    Boolean(s(draft.humanHandoff))
  );
}

function shouldOverrideQuestionPrompt(prompt = "") {
  const text = s(prompt);
  if (!text) return true;

  return (
    /^send\b/i.test(text) ||
    /^add\b/i.test(text) ||
    /^describe\b/i.test(text) ||
    /^define\b/i.test(text) ||
    /^list\b/i.test(text) ||
    /^confirm\b/i.test(text) ||
    /^lock\b/i.test(text) ||
    /^set\b/i.test(text) ||
    /^current signal:/i.test(text) ||
    /\bno routing lane\b/i.test(text) ||
    /\bnot set\b/i.test(text) ||
    /\brecommended\b/i.test(text)
  );
}

function buildQuestionPrompt(question = {}) {
  const key = s(question?.key).toLowerCase();
  const fallbackPrompt = s(obj(QUESTION_FALLBACKS[key]).prompt);
  const prompt = s(question.prompt);

  if (shouldOverrideQuestionPrompt(prompt)) {
    return fallbackPrompt || prompt;
  }

  return prompt || fallbackPrompt;
}

function buildQuestionPlaceholder(question = {}) {
  const key = s(question?.key).toLowerCase();
  const prompt = s(question.placeholder);
  const fallback = s(obj(QUESTION_FALLBACKS[key]).placeholder);

  if (prompt && !/MÉ|â€”|Ã|Å|É™|zÉ|vÉ/i.test(prompt)) {
    return prompt;
  }

  return fallback || "Cavabını yaz";
}

function buildWelcomeAssistantMessage() {
  return {
    body:
      "Salam. Mən bunu səninlə rahat şəkildə yığacağam. Məqsədim chatbot-un düzgün işləməsi üçün lazım olan biznes məlumatlarını toplamaq, çatışmayan hissələri isə səliqəli drafta çevirməkdir. Website, Google Maps, Instagram, Facebook və ya qısa biznes qeydi ilə başlaya bilərsən.",
    meta: "",
  };
}

function buildQuestionAssistantMessage({
  currentQuestion = null,
  finalModel = {},
}) {
  const prompt = buildQuestionPrompt(currentQuestion);
  const sourceLabel = s(obj(finalModel.sourceSignals).primarySourceLabel);
  const sourceUrl = s(obj(finalModel.sourceSignals).primarySourceUrl);

  const intro =
    sourceLabel || sourceUrl
      ? "Mənbədən artıq anladığım hissələri təkrar soruşmuram."
      : "Mən bunu sərbəst yazdığın formada başa düşməyə çalışacağam.";

  return {
    body: `${prompt} ${intro}`,
    meta: [sourceLabel, sourceUrl].filter(Boolean).join(" · "),
  };
}

function buildContinueAssistantMessage(finalModel = {}) {
  const sourceLabel = s(obj(finalModel.sourceSignals).primarySourceLabel);
  const sourceUrl = s(obj(finalModel.sourceSignals).primarySourceUrl);
  const draft = obj(finalModel.draft);

  const knownBits = [];
  if (s(draft.businessName)) knownBits.push(`ad: ${draft.businessName}`);
  if (s(draft.whatThisBusinessIs)) knownBits.push("təsvir var");
  if (arr(draft.coreServices).length) knownBits.push(`${arr(draft.coreServices).length} xidmət`);
  if (arr(draft.contactRoutes).length) knownBits.push("əlaqə var");
  if (arr(draft.hours).length) knownBits.push("saat var");
  if (s(draft.pricingPosture)) knownBits.push("pricing var");

  const body = knownBits.length
    ? `Hazırda yetərli siqnallar var: ${knownBits.join(", ")}. İstəsən əlavə detal və ya düzəliş yaz. Hazır hesab edirsənsə, “bitdi” də yaza bilərsən.`
    : "Davam edə bilərik. İstəsən əlavə detal və ya düzəliş yaz. Hazır hesab edirsənsə, “bitdi” də yaza bilərsən.";

  return {
    body,
    meta: [sourceLabel, sourceUrl].filter(Boolean).join(" · "),
  };
}

function buildAssistantView({
  sourceSubmitted = false,
  currentQuestion = null,
  smartDraftReady = false,
  finalModel = {},
}) {
  if (!sourceSubmitted) {
    return buildWelcomeAssistantMessage();
  }

  if (smartDraftReady) {
    return null;
  }

  if (currentQuestion) {
    return buildQuestionAssistantMessage({
      currentQuestion,
      finalModel,
    });
  }

  return buildContinueAssistantMessage(finalModel);
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
    const raw = window.sessionStorage.getItem(
      `${STORAGE_PREFIX}:${s(storageKey, "default")}`
    );
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
      `${STORAGE_PREFIX}:${s(storageKey, "default")}`,
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
    ["Biznes adı", draft.businessName],
    ["Biznes nə edir", draft.whatThisBusinessIs],
    ["Website", draft.websiteUrl],
    ["Əsas xidmətlər", listPreview(draft.coreServices, 6)],
    ["Qiymət mövqeyi", draft.pricingPosture],
    ["Əlaqə yolları", listPreview(draft.contactRoutes, 6)],
    ["İş saatları", listPreview(draft.hours, 4)],
    ["İnsana ötürmə", draft.humanHandoff],
  ].filter(([, value]) => s(value));

  return (
    <motion.div variants={bubbleMotion} initial="hidden" animate="visible">
      <div className="flex justify-start">
        <div className="max-w-[84%] rounded-[26px] rounded-bl-[10px] border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.98))] px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <div className="text-[20px] font-semibold tracking-[-0.04em] text-text">
            Draft hazırdır
          </div>
          <div className="mt-2 text-[15px] leading-7 text-text">
            Əsas draftı yığdım. Aşağıda yoxla. Dəyişmək istədiyini yaza bilərsən,
            hər şey doğrudursa təsdiqlə.
          </div>

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
            {finalizing ? "Təsdiqlənir..." : "Təsdiqlə və setup-ı bitir"}
          </button>
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
  const bootSignatureRef = useRef("");
  const responseFingerprintRef = useRef("");

  const [composerValue, setComposerValue] = useState("");
  const [localError, setLocalError] = useState("");
  const [transcript, setTranscript] = useState(() => loadStoredTranscript(storageKey));
  const [localAnswers, setLocalAnswers] = useState({});
  const [pendingTurnId, setPendingTurnId] = useState("");

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
    const raw = obj(assistantControl.nextQuestion);
    if (!s(raw.key)) return null;

    return {
      key: s(raw.key).toLowerCase(),
      step: s(raw.step || raw.key).toLowerCase(),
      prompt: buildQuestionPrompt(raw),
      placeholder: buildQuestionPlaceholder(raw),
    };
  }, [assistantControl.nextQuestion]);

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

  const sourceSubmitted = Boolean(hasExistingProgress || transcript.length > 0);

  const assistantView = useMemo(
    () =>
      buildAssistantView({
        sourceSubmitted,
        currentQuestion,
        smartDraftReady,
        finalModel,
      }),
    [sourceSubmitted, currentQuestion, smartDraftReady, finalModel]
  );

  const composerPlaceholder = useMemo(() => {
    if (!sourceSubmitted) {
      return "Website, Google Maps linki və ya qısa biznes qeydi yaz";
    }

    if (currentQuestion) {
      return currentQuestion.placeholder;
    }

    if (smartDraftReady) {
      return "Dəyişmək istədiyin detalı yaz";
    }

    return "Əlavə detal və ya düzəliş yaz";
  }, [sourceSubmitted, currentQuestion, smartDraftReady]);

  useEffect(() => {
    setTranscript(loadStoredTranscript(storageKey));
    setComposerValue("");
    setLocalError("");
    setLocalAnswers({});
    setPendingTurnId("");
    bootSignatureRef.current = "";
    responseFingerprintRef.current = "";
  }, [storageKey]);

  useEffect(() => {
    saveStoredTranscript(storageKey, transcript);
  }, [storageKey, transcript]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript, busy, localError, errorMessage, smartDraftReady]);

  useEffect(() => {
    if (!sessionHydrated) return;
    if (transcript.length > 0) return;
    if (!assistantView || smartDraftReady) return;

    const signature = JSON.stringify({
      body: s(assistantView.body),
      meta: s(assistantView.meta),
      question: s(currentQuestion?.key),
      phase: s(finalModel.phase),
    });

    if (bootSignatureRef.current === signature) return;

    bootSignatureRef.current = signature;
  }, [
    sessionHydrated,
    transcript.length,
    assistantView,
    smartDraftReady,
    currentQuestion,
    finalModel.phase,
  ]);

  useEffect(() => {
    if (!sessionHydrated) return;
    if (busy) return;
    if (!pendingTurnId) return;

    const turnId = pendingTurnId;
    setPendingTurnId("");

    if (smartDraftReady) {
      responseFingerprintRef.current = "";
      return;
    }

    if (!assistantView?.body) return;

    const fingerprint = JSON.stringify({
      turnId,
      body: s(assistantView.body),
      meta: s(assistantView.meta),
      question: s(currentQuestion?.key),
      phase: s(finalModel.phase),
      ready: finalModel.readyForApproval === true,
      error: s(finalModel.error),
    });

    responseFingerprintRef.current = fingerprint;

    setTranscript((current) => [
      ...current,
      makeTranscriptEntry({
        id: `assistant-${Date.now()}`,
        role: "assistant",
        body: assistantView.body,
        meta: assistantView.meta,
      }),
    ]);
  }, [
    sessionHydrated,
    busy,
    pendingTurnId,
    assistantView,
    smartDraftReady,
    currentQuestion,
    finalModel.phase,
    finalModel.readyForApproval,
    finalModel.error,
  ]);

  async function handleInitialSourceSubmit() {
    const text = s(composerValue);
    if (!text || busy) return;

    const resolvedSource = resolveSetupSourceInput(text);
    const turnId = `turn-${Date.now()}`;

    setLocalError("");
    setPendingTurnId(turnId);

    setTranscript((current) => [
      ...current,
      makeTranscriptEntry({
        id: `user-source-${Date.now()}`,
        role: "user",
        body: text,
      }),
    ]);

    setComposerValue("");

    try {
      await onCaptureSource?.({
        type: resolvedSource.type,
        value: resolvedSource.value,
        message: text,
      });
    } catch (error) {
      setPendingTurnId("");
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
    setPendingTurnId(turnId);

    setTranscript((current) => [
      ...current,
      makeTranscriptEntry({
        id: `user-message-${Date.now()}`,
        role: "user",
        body: text,
      }),
    ]);

    if (currentQuestion?.key) {
      setLocalAnswers((current) => ({
        ...current,
        [currentQuestion.key]: text,
      }));
    }

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
      setPendingTurnId("");
      setLocalError(s(error?.message, "Mesaj emal olunmadı."));
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
    sessionHydrated &&
    !busy &&
    !smartDraftReady &&
    assistantView?.body;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,#ffffff,#f8fafc)]">
      <div ref={scrollRef} className="flex-1 overflow-auto px-5 pt-5">
        <div className="space-y-4 pb-4">
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
              body={assistantView.body}
              meta={assistantView.meta}
            />
          ) : null}

          {busy && pendingTurnId ? <TypingBubble /> : null}

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
