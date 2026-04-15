import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { resolveSetupSourceInput } from "./setupSourceIntake.js";

const TIMELINE_STORAGE_PREFIX = "setup_assistant_timeline";

const QUESTION_COPY = {
  profile: {
    prompt:
      "Biznesin adını və nə iş gördüyünü birlikdə yaz. Qısa, dəqiq, public görünəcək formada olsun.",
    placeholder:
      "Məsələn: Neox Studio — AI avtomasiya, website və rəqəmsal təqdimat həlləri qururuq.",
    reason:
      "Bu hissə sabit olmadan AI biznesi hər yerdə eyni və düzgün təqdim edə bilməz.",
  },
  company: {
    prompt: "AI-in müştəriyə göstərəcəyi dəqiq biznes adını yaz.",
    placeholder: "Məsələn: Neox Studio",
    reason:
      "Rəsmi ad sabit olmadan qalan bütün təqdimat zəifləyir.",
  },
  description: {
    prompt:
      "Bu biznesi bir-iki cümlə ilə necə təqdim etməli olduğumuzu yaz.",
    placeholder:
      "Məsələn: Lokal bizneslər üçün AI avtomasiya və digital growth sistemləri qururuq.",
    reason:
      "AI-in nə etdiyinizi uydurmaması üçün bu positioning cümləsi lazımdır.",
  },
  website: {
    prompt: "Əsas website domenini və ya linkini göndər.",
    placeholder: "Məsələn: yourbusiness.com",
    reason:
      "Əsas public mənbə sabit olanda sonrakı draft daha etibarlı qurulur.",
  },
  services: {
    prompt: "Əsas xidmətləri ən vacibdən yaz.",
    placeholder:
      "Məsələn: website hazırlanması, reklam idarəetməsi, branding",
    reason:
      "AI nədən danışmalı olduğunu dəqiq bilməlidir, yoxsa generic cavab verir.",
  },
  hours: {
    prompt: "İş və cavab saatlarını yaz.",
    placeholder:
      "Məsələn: B.e.–Cümə 10:00–19:00, Şənbə 11:00–16:00, Bazar bağlı",
    reason:
      "AI saatlarla bağlı səhv promise verməməlidir.",
  },
  pricing: {
    prompt: "AI qiymət barədə nə deyə biləcəyini yaz.",
    placeholder:
      "Məsələn: starting price deyilə bilər, dəqiq quote üçün müraciət istənməlidir",
    reason:
      "Qiymət mövqeyi dəqiq olmazsa AI təhlükəli improvizasiya edə bilər.",
  },
  contacts: {
    prompt:
      "Müştərini yönləndirəcəyimiz əsas əlaqə yolunu yaz.",
    placeholder:
      "Məsələn: WhatsApp, telefon zəngi, form və ya email",
    reason:
      "Sonda müştərini hara ötürəcəyimiz aydın olmalıdır.",
  },
  handoff: {
    prompt:
      "AI-in hansı hallarda dayanmadan insana ötürməli olduğunu yaz.",
    placeholder:
      "Məsələn: şikayət, fərdi quote, ödəniş problemi, təcili iş, anlaşılmaz sorğu",
    reason:
      "Handoff qaydası olmadan AI lazım olanda geri çəkilməyə bilər.",
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

function compactText(value, max = 320) {
  const text = s(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
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
      typeof item === "string"
        ? compactText(item, 80)
        : compactText(String(item), 80)
    ),
    24
  );

  if (!safe.length) return "";
  if (safe.length <= max) return safe.join(", ");
  return `${safe.slice(0, max).join(", ")} +${safe.length - max}`;
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

function buildFinalViewModel({
  reviewPayload = null,
  assistant = {},
  localAnswers = {},
}) {
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

function bubbleClasses(role = "assistant") {
  if (role === "user") {
    return "rounded-[26px] rounded-br-[10px] bg-[linear-gradient(180deg,#2563eb,#1d4ed8)] text-white shadow-[0_18px_40px_rgba(37,99,235,0.26)]";
  }

  return "rounded-[26px] rounded-bl-[10px] border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.98))] text-text shadow-[0_12px_30px_rgba(15,23,42,0.06)]";
}

const bubbleMotion = {
  hidden: { opacity: 0, y: 14, scale: 0.988 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.24,
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
}) {
  const isUser = role === "user";

  return (
    <motion.div variants={bubbleMotion} initial="hidden" animate="visible">
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[84%] px-4 py-3.5 ${bubbleClasses(role)}`}>
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
            <div className="text-[18px] font-semibold tracking-[-0.04em]">
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

function MetaPill({ children }) {
  return (
    <div className="inline-flex items-center rounded-full border border-[rgba(15,23,42,0.07)] bg-[rgba(248,250,252,0.92)] px-2.5 py-1 text-[11px] font-medium text-text-muted">
      {children}
    </div>
  );
}

function SmartDraftBubble({ model, finalizing, onFinalize }) {
  const draft = obj(model.draft);
  const sourceSignals = obj(model.sourceSignals);
  const recommendation = obj(model.recommendation);

  const draftRows = [
    ["Biznes adı", draft.businessName],
    ["Biznes nə edir", draft.whatThisBusinessIs],
    ["Website", draft.websiteUrl],
    ["Əsas xidmətlər", listPreview(draft.coreServices, 6)],
    ["Qiymət mövqeyi", draft.pricingPosture],
    ["Əlaqə yolları", listPreview(draft.contactRoutes, 6)],
    ["İş saatları", listPreview(draft.hours, 4)],
    ["İnsana ötürmə", draft.humanHandoff],
    ["Dillər", listPreview(draft.languages, 4)],
    ["Ton", draft.tone],
    ["Salamlama üslubu", draft.greetingStyle],
    ["İş saatından sonra davranış", draft.afterHoursBehavior],
  ].filter(([, value]) => s(value));

  const sourceContextLine = [s(sourceSignals.primarySourceLabel), s(sourceSignals.primarySourceUrl)]
    .filter(Boolean)
    .join(" · ");

  const sourceMetaLine = [
    Number(sourceSignals.pageCount || 0) > 0
      ? `${Number(sourceSignals.pageCount || 0)} səhifə`
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
    <MessageBubble role="assistant" eyebrow="Draft" title="Mən bunu strukturlaşdırdım">
      <div className="space-y-4">
        <div className="text-[14px] leading-7 text-text-muted">
          Aşağıda hazırkı setup draftı var. Dəyişmək istədiyini birbaşa yaza bilərsən. Hər şey doğrudursa, təsdiqləyib davam et.
        </div>

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
              Mənbə konteksti
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
              Yoxlanmalı qeydlər
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
              Qəbul edilməyənlər
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
              Tövsiyə
            </div>
            <div className="mt-2 space-y-1.5 text-[14px] leading-7 text-text">
              {arr(recommendation.notes).slice(0, 3).map((item) => (
                <div key={item}>• {item}</div>
              ))}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onFinalize}
          disabled={finalizing}
          className="inline-flex h-11 items-center rounded-full bg-slate-950 px-5 text-[12px] font-semibold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {finalizing ? "Təsdiqlənir..." : "Təsdiqlə və setup-ı bitir"}
        </button>
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

function buildQuestionCopy(question = {}) {
  const key = s(question?.key).toLowerCase();
  return obj(QUESTION_COPY[key]);
}

function buildQuestionPrompt(question = {}) {
  const custom = s(buildQuestionCopy(question).prompt);
  return custom || s(question.prompt);
}

function buildQuestionPlaceholder(question = {}) {
  const custom = s(buildQuestionCopy(question).placeholder);
  return custom || s(question.placeholder) || "Cavabını yaz";
}

function buildQuestionReason(question = {}) {
  return s(buildQuestionCopy(question).reason);
}

function buildSourceLead(finalModel = {}, hasExistingProgress = false) {
  const sourceSignals = obj(finalModel.sourceSignals);
  const label = s(sourceSignals.primarySourceLabel);
  const url = s(sourceSignals.primarySourceUrl);

  if (label && url) return `${label} mənbəyinə baxdım`;
  if (label) return `${label} üzərindən draftı yoxladım`;
  if (url) return "Mənbəyə baxdım";
  if (hasExistingProgress) return "Mövcud draftı yoxladım";
  return "Bunu səliqəli şəkildə quraq";
}

function buildKnownStateLine(finalModel = {}) {
  const draft = obj(finalModel.draft);
  const bits = [];

  if (s(draft.businessName)) bits.push(`ad olaraq "${draft.businessName}" görünür`);
  if (s(draft.whatThisBusinessIs)) bits.push("biznes təsviri qismən oturub");
  if (arr(draft.coreServices).length) {
    bits.push(`${arr(draft.coreServices).length} xidmət siqnalı var`);
  }
  if (arr(draft.contactRoutes).length) bits.push("əlaqə yolu görünür");
  if (arr(draft.hours).length) bits.push("iş saatı siqnalı var");

  return bits.slice(0, 3).join(", ");
}

function buildAssistantTurnBody({
  sourceSubmitted = false,
  currentQuestion = null,
  finalModel = {},
  assistantControl = {},
  smartDraftReady = false,
  hasExistingProgress = false,
}) {
  if (!sourceSubmitted) {
    return "Başlamaq üçün website, Google Maps, Instagram, Facebook və ya qısa biznes qeydi göndər. Mən əvvəl nəyi dəqiq bildiyimi çıxaracağam, sonra yalnız həqiqətən lazım olan növbəti şeyi soruşacağam.";
  }

  const lead = buildSourceLead(finalModel, hasExistingProgress);
  const knownState = buildKnownStateLine(finalModel);

  if (smartDraftReady) {
    return `${lead}.${knownState ? ` Hazırda ${knownState}.` : ""} Mən bunu artıq strukturlaşdırdım və əsas draftı aşağıda topladım. Dəyişmək istədiyini yaz və ya hər şey doğrudursa təsdiqlə.`;
  }

  if (currentQuestion) {
    const prompt = buildQuestionPrompt(currentQuestion);
    const reason = buildQuestionReason(currentQuestion);

    return `${lead}.${knownState ? ` Hazırda ${knownState}.` : ""} İndi növbəti ən vacib boşluq budur: ${prompt}${reason ? ` ${reason}` : ""}`;
  }

  const assistantMessage = compactText(
    finalModel.message || assistantControl.message,
    520
  );

  if (assistantMessage) {
    return `${lead}.${knownState ? ` Hazırda ${knownState}.` : ""} ${assistantMessage}`;
  }

  return `${lead}.${knownState ? ` Hazırda ${knownState}.` : ""} Əlavə detal və ya düzəliş yaza bilərsən.`;
}

function buildAssistantSignature({
  sourceSubmitted = false,
  currentQuestion = null,
  body = "",
  smartDraftReady = false,
}) {
  return JSON.stringify({
    type: "assistant_turn",
    sourceSubmitted,
    questionKey: s(currentQuestion?.key),
    ready: smartDraftReady === true,
    body: s(body),
  });
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

function getTimelineStorageKey(storageKey = "") {
  return `${TIMELINE_STORAGE_PREFIX}:${s(storageKey, "default")}`;
}

function isLegacyTimeline(items = []) {
  return arr(items).some((item) => {
    const id = s(item?.id);
    const signature = s(item?.signature);
    return (
      signature.startsWith("greeting|") ||
      id.includes("assistant-question-") ||
      id.includes("assistant-greeting-")
    );
  });
}

function sanitizeStoredTimeline(items = []) {
  const safe = arr(items)
    .map((item) =>
      obj(item, {
        id: "",
        role: "",
        eyebrow: "",
        title: "",
        body: "",
        signature: "",
      })
    )
    .filter((item) => {
      const role = s(item.role);
      if (role !== "assistant" && role !== "user") return false;
      if (!s(item.body) && !s(item.title)) return false;
      return true;
    })
    .map((item, index) => ({
      id: s(item.id) || `stored-${index + 1}`,
      role: s(item.role),
      eyebrow: s(item.eyebrow),
      title: s(item.title),
      body: s(item.body),
      signature: s(item.signature),
    }));

  if (isLegacyTimeline(safe)) return [];
  return safe;
}

function loadStoredTimeline(storageKey = "") {
  try {
    const raw = window.sessionStorage.getItem(getTimelineStorageKey(storageKey));
    const parsed = JSON.parse(raw || "[]");
    return sanitizeStoredTimeline(parsed);
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
    /whatsapp|telegram|contact|əlaqə/i.test(lowerText)
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

  const [composerValue, setComposerValue] = useState("");
  const [localError, setLocalError] = useState("");
  const [timeline, setTimeline] = useState(() => loadStoredTimeline(storageKey));
  const [localAnswers, setLocalAnswers] = useState({});
  const [awaitingAssistant, setAwaitingAssistant] = useState(false);

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

  const rawCurrentQuestion = useMemo(() => {
    const nextQuestion = obj(assistantControl.nextQuestion);
    if (!s(nextQuestion.key)) return null;

    const key = s(nextQuestion.key).toLowerCase();
    const copy = buildQuestionCopy(nextQuestion);

    return {
      key,
      step: s(nextQuestion.step || key),
      title: s(copy.title || nextQuestion.title),
      prompt: s(copy.prompt || nextQuestion.prompt),
      placeholder: s(copy.placeholder || nextQuestion.placeholder),
      group: s(nextQuestion.group || "business_truth"),
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

  const sourceSubmitted = useMemo(() => {
    return Boolean(
      hasExistingProgress ||
        rawCurrentQuestion ||
        assistantControl.readyForApproval === true ||
        smartDraftReady ||
        timeline.some((item) => item.role === "user")
    );
  }, [
    hasExistingProgress,
    rawCurrentQuestion,
    assistantControl.readyForApproval,
    smartDraftReady,
    timeline,
  ]);

  const currentQuestion =
    sourceSubmitted && assistantControl.readyForApproval !== true
      ? rawCurrentQuestion
      : null;

  const assistantTurnBody = useMemo(
    () =>
      buildAssistantTurnBody({
        sourceSubmitted,
        currentQuestion,
        finalModel,
        assistantControl,
        smartDraftReady,
        hasExistingProgress,
      }),
    [
      sourceSubmitted,
      currentQuestion,
      finalModel,
      assistantControl,
      smartDraftReady,
      hasExistingProgress,
    ]
  );

  const assistantTurnItem = useMemo(() => {
    if (!sessionHydrated) return null;
    const body = s(assistantTurnBody);
    if (!body) return null;

    return {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      eyebrow: "Setup",
      title: "",
      body,
      signature: buildAssistantSignature({
        sourceSubmitted,
        currentQuestion,
        body,
        smartDraftReady,
      }),
    };
  }, [
    sessionHydrated,
    assistantTurnBody,
    sourceSubmitted,
    currentQuestion,
    smartDraftReady,
  ]);

  const lastAssistantQuestionStep = useMemo(() => {
    const reversed = [...timeline].reverse();
    const assistantMessage = reversed.find((item) => item.role === "assistant");
    const text = s(assistantMessage?.body).toLowerCase();

    if (text.includes("qiymət")) return "pricing";
    if (text.includes("iş və cavab saat")) return "hours";
    if (text.includes("əlaqə")) return "contacts";
    if (text.includes("insana ötür")) return "handoff";
    if (text.includes("xidmət")) return "services";
    if (text.includes("website")) return "website";
    if (text.includes("biznes ad")) return "company";
    return "profile";
  }, [timeline]);

  const composerPlaceholder = useMemo(() => {
    if (!sourceSubmitted) {
      return "Website, Google Maps, Instagram, Facebook və ya qısa biznes qeydi yaz";
    }

    if (currentQuestion) {
      return buildQuestionPlaceholder(currentQuestion);
    }

    if (smartDraftReady) {
      return "Dəyişmək istədiyin detalı yaz";
    }

    return "Əlavə detail, düzəliş və ya correction yaz";
  }, [sourceSubmitted, currentQuestion, smartDraftReady]);

  useEffect(() => {
    setTimeline(loadStoredTimeline(storageKey));
    setComposerValue("");
    setLocalError("");
    setAwaitingAssistant(false);
  }, [storageKey]);

  useEffect(() => {
    saveStoredTimeline(storageKey, timeline);
  }, [storageKey, timeline]);

  useEffect(() => {
    if (!sessionHydrated || !assistantTurnItem) return;

    setTimeline((current) => appendTimelineItem(current, assistantTurnItem));
  }, [sessionHydrated, assistantTurnItem]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.sessionStorage.getItem(getTimelineStorageKey(storageKey));
    if (
      !raw &&
      timeline.length > 0 &&
      !sourceSubmitted &&
      !smartDraftReady &&
      assistantControl.readyForApproval !== true
    ) {
      setTimeline([]);
    }
  }, [
    storageKey,
    timeline.length,
    sourceSubmitted,
    smartDraftReady,
    assistantControl.readyForApproval,
  ]);

  useEffect(() => {
    if (!scrollRef.current) return;

    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [timeline, awaitingAssistant, localError, errorMessage, smartDraftReady]);

  async function handleInitialSourceSubmit() {
    const text = s(composerValue);
    if (!text || busy) return;

    const resolvedSource = resolveSetupSourceInput(text);

    setLocalError("");
    setAwaitingAssistant(true);

    setTimeline((current) =>
      appendTimelineItem(current, {
        id: `user-source-${Date.now()}`,
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
    } finally {
      setAwaitingAssistant(false);
    }
  }

  async function handleQuestionSubmit(textValue = composerValue) {
    const text = s(textValue);
    if (!text || busy || !currentQuestion) return;

    setLocalError("");
    setAwaitingAssistant(true);

    setTimeline((current) =>
      appendTimelineItem(current, {
        id: `user-answer-${currentQuestion.key}-${Date.now()}`,
        role: "user",
        body: text,
      })
    );

    setLocalAnswers((current) => ({
      ...current,
      [currentQuestion.key]: text,
    }));

    setComposerValue("");

    try {
      await onParseMessage?.({
        step: s(currentQuestion.step, currentQuestion.key),
        text,
      });
    } catch (error) {
      setLocalError(s(error?.message, "The answer could not be processed."));
    } finally {
      setAwaitingAssistant(false);
    }
  }

  async function handleFreeformContinue(textValue = composerValue) {
    const text = s(textValue);
    if (!text || busy) return;

    const resolvedStep = resolveFreeformStepFromText(text, lastAssistantQuestionStep);

    setLocalError("");
    setAwaitingAssistant(true);

    setTimeline((current) =>
      appendTimelineItem(current, {
        id: `user-freeform-${Date.now()}`,
        role: "user",
        body: text,
      })
    );

    setComposerValue("");

    try {
      await onParseMessage?.({
        step: resolvedStep,
        text,
      });
    } catch (error) {
      setLocalError(s(error?.message, "The update could not be processed."));
    } finally {
      setAwaitingAssistant(false);
    }
  }

  function handleSubmit() {
    if (!sourceSubmitted) {
      handleInitialSourceSubmit();
      return;
    }

    if (currentQuestion) {
      handleQuestionSubmit();
      return;
    }

    handleFreeformContinue();
  }

  const composerReady = sessionHydrated;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,#ffffff,#f8fafc)]">
      <div ref={scrollRef} className="flex-1 overflow-auto px-5 pt-5">
        <div className="space-y-4 pb-4">
          <AnimatePresence initial={false}>
            {timeline.map((item) => (
              <MessageBubble
                key={item.id}
                role={item.role}
                eyebrow={item.eyebrow}
                title={item.title}
                body={item.body}
              />
            ))}
          </AnimatePresence>

          {awaitingAssistant ? <TypingBubble /> : null}

          {smartDraftReady ? (
            <SmartDraftBubble
              model={finalModel}
              finalizing={finalizing}
              onFinalize={onFinalize}
            />
          ) : null}

          {s(localError || errorMessage) ? (
            <MessageBubble
              role="assistant"
              eyebrow="Setup"
              title="Bir şey alınmadı"
              body={localError || errorMessage}
            />
          ) : null}
        </div>
      </div>

      {composerReady ? (
        <Composer
          value={composerValue}
          busy={busy}
          placeholder={composerPlaceholder}
          buttonLabel="Send"
          onChange={setComposerValue}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}