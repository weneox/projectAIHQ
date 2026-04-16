import { arr, compactDraftObject, obj, s } from "../draftShared.js";
import { hasNonManualSourceIdentity } from "./shared.js";

export const SECTION_ORDER = [
  "profile",
  "services",
  "hours",
  "pricing",
  "contacts",
  "handoff",
];

export const SECTION_META = {
  profile: {
    label: "Biznes kimliyi",
    title: "Biznes kimliyini dəqiqləşdirək",
    missing:
      "Biznes kimliyi hələ zəifdir. Dəqiq public ad və biznesin nə etdiyini izah edən bir təmiz cümlə lazımdır.",
    review:
      "Biznes kimliyi ilə bağlı siqnallar var, amma hələ daha səliqəli təsdiq lazımdır.",
    ready: "Biznes kimliyi istifadə oluna biləcək səviyyədədir.",
    prompt:
      "Biznesin dəqiq public adını və nə etdiyini bir təmiz cümlə ilə yaz. Website varsa onu da əlavə et.",
    placeholder:
      "Məsələn: Neox Studio — AI avtomasiya, website və rəqəmsal təqdimat həlləri qururuq.",
  },
  company: {
    label: "Biznes adı",
    title: "Biznes adını dəqiqləşdirək",
    prompt: "Biznesin dəqiq public adını yaz.",
    placeholder: "Məsələn: Neox Studio",
  },
  description: {
    label: "Biznes təsviri",
    title: "Biznes nə edir?",
    prompt: "Biznesin nə etdiyini bir təmiz cümlə ilə yaz.",
    placeholder:
      "Məsələn: Lokal bizneslər üçün AI avtomasiya və rəqəmsal təqdimat həlləri qururuq.",
  },
  website: {
    label: "Website",
    title: "Əsas website-i əlavə et",
    prompt: "Əsas website linkini yaz, əgər varsa.",
    placeholder: "Məsələn: yourbusiness.com",
  },
  services: {
    label: "Xidmətlər",
    title: "Əsas xidmətləri dəqiqləşdirək",
    missing:
      "Əsas xidmətlər hələ çatmır. AI-in rahat danışa biləcəyi real customer-facing xidmətləri yazmaq lazımdır.",
    review:
      "Xidmət siqnalları var, amma təsdiqdən əvvəl daha səliqəli təmizləmə lazımdır.",
    ready: "Əsas xidmətlər artıq istifadə oluna biləcək formadadır.",
    prompt:
      "AI-in danışmalı olduğu real customer-facing xidmətləri yaz.",
    placeholder:
      "Məsələn: website hazırlanması, reklam idarəetməsi, branding",
  },
  hours: {
    label: "İş saatları",
    title: "Public iş saatlarını dəqiqləşdirək",
    missing:
      "Public iş saatları hələ yoxdur. AI yanlış availability vəd etməməlidir.",
    review: "Saat siqnalları var, amma hələ təsdiq lazımdır.",
    ready: "Public iş saatları artıq strukturlaşdırılıb.",
    prompt: "İş saatlarını bir sətirdə yaz.",
    placeholder:
      "Məsələn: B.e.–Cümə 10:00–19:00, Şənbə 11:00–16:00, Bazar bağlı",
  },
  pricing: {
    label: "Qiymət mövqeyi",
    title: "Qiymət mövqeyini müəyyənləşdirək",
    missing:
      "Qiymət mövqeyi hələ çatmır. AI qiymət suallarına təhlükəsiz cavab qaydasına ehtiyac duyur.",
    review:
      "Qiymətlə bağlı siqnallar var, amma public cavab qaydası hələ dəqiqləşməlidir.",
    ready: "Qiymət mövqeyi artıq müəyyənləşdirilib.",
    prompt: "AI qiymət barədə necə danışmalıdır?",
    placeholder:
      "Məsələn: starting price deyilə bilər, dəqiq quote üçün müraciət istənməlidir",
  },
  contacts: {
    label: "Əlaqə yolu",
    title: "Əsas əlaqə yolunu seçək",
    missing: "Real public əlaqə yolu hələ çatmır.",
    review:
      "Əlaqə detalları var, amma əsas yönləndirmə yolu hələ təsdiqlənməlidir.",
    ready: "Əsas əlaqə yolu artıq mövcuddur.",
    prompt:
      "Müştərini ilk olaraq hara yönləndirməli olduğumuzu yaz.",
    placeholder:
      "Məsələn: WhatsApp, telefon zəngi, form və ya email",
  },
  handoff: {
    label: "İnsana ötürmə",
    title: "İnsana ötürmə qaydasını müəyyənləşdirək",
    missing: "İnsana ötürmə qaydaları hələ yoxdur.",
    review:
      "Ötürmə məntiqi var, amma sərhədlərini daha dəqiq qurmaq lazımdır.",
    ready: "İnsana ötürmə qaydaları artıq mövcuddur.",
    prompt: "AI hansı hallarda dayanıb insana ötürməlidir?",
    placeholder:
      "Məsələn: şikayət, fərdi quote, ödəniş problemi, təcili iş, anlaşılmaz sorğu",
  },
};

export const INTENT_ONLY_RESPONSES = {
  "i'll share the business identity now.": "profile",
  "i'll share the business name now.": "profile",
  "let's start from the website.": "website",
  "let's use instagram as a source.": "profile",
  "i want to write the business details manually.": "profile",
  "i'll list the services now.": "services",
  "i want to paste a rough services note.": "services",
  "let's define pricing posture first.": "pricing",
  "let's skip services for now and continue.": "__skip__",
  "i'll share the working hours now.": "hours",
  "the business is appointment only.": "__appointment_only__",
  "the business is open 24/7.": "__always_open__",
  "pricing starts from a visible base amount.": "pricing",
  "exact pricing requires a quote.": "__quote_required__",
  "i want to define what ai can say publicly about pricing.": "pricing",
  "let's continue.": "__continue__",
  "i want to add more detail here.": "__continue__",
};

function normalizeText(value = "") {
  return s(value).replace(/\s+/g, " ").trim();
}

function buildSourceLead(draft = {}) {
  const sourceMetadata = obj(draft.sourceMetadata);
  const primarySourceUrl = s(sourceMetadata.primarySourceUrl);
  const evidenceSummary = arr(sourceMetadata.evidenceSummary)
    .map((item) => s(item))
    .filter(Boolean);

  if (primarySourceUrl) {
    return `Mənbə artıq bağlıdır (${primarySourceUrl}).`;
  }

  if (evidenceSummary.length) {
    return `Mənbədən artıq bəzi siqnallar görünür: ${evidenceSummary
      .slice(0, 2)
      .join(" · ")}.`;
  }

  return "";
}

export function buildAssistantQuestion(key = "", overrides = {}) {
  const questionKey = s(key).toLowerCase();
  const meta = obj(SECTION_META[questionKey]);

  return compactDraftObject({
    key: questionKey,
    step: s(overrides.step || questionKey).toLowerCase(),
    label: s(overrides.label || meta.label),
    title: s(overrides.title || meta.title || meta.label),
    prompt: normalizeText(s(overrides.prompt || meta.prompt)),
    placeholder: s(overrides.placeholder || meta.placeholder),
    group: s(overrides.group || "business_truth"),
    groupLabel: "Business truth",
    priority: Number(overrides.priority || 0) || undefined,
  });
}

export function hasSetupSignalForInterview(draft = {}) {
  const businessProfile = obj(draft.businessProfile);
  const sourceMetadata = obj(draft.sourceMetadata);

  return Boolean(
    s(businessProfile.companyName) ||
      s(businessProfile.description) ||
      s(businessProfile.websiteUrl) ||
      arr(draft.services).length ||
      arr(draft.contacts).length ||
      arr(draft.hours).length ||
      s(obj(draft.pricingPosture).publicSummary) ||
      s(obj(draft.handoffRules).summary) ||
      s(sourceMetadata.primarySourceType) ||
      s(sourceMetadata.primarySourceUrl) ||
      arr(sourceMetadata.sourceLabels).length ||
      arr(sourceMetadata.evidenceSummary).length
  );
}

export function buildProfileQuestionPrompt(draft = {}) {
  const safeDraft = obj(draft);
  const businessProfile = obj(safeDraft.businessProfile);
  const sourceMetadata = obj(safeDraft.sourceMetadata);
  const sourceLead = buildSourceLead(safeDraft);
  const sourceIdentityPresent = hasNonManualSourceIdentity(sourceMetadata);

  const parts = [];

  if (sourceLead) {
    parts.push(sourceLead);
  }

  if (s(businessProfile.companyName)) {
    parts.push(`Hazırda ad siqnalı var: ${s(businessProfile.companyName)}.`);
  }

  if (s(businessProfile.description)) {
    parts.push("Hazırda biznes təsviri siqnalı da var.");
  }

  parts.push(
    sourceIdentityPresent
      ? "İndi bunu səliqəli şəkildə sabitləyək: biznesin dəqiq public adını və nə etdiyini bir təmiz cümlə ilə yaz."
      : "Biznesin dəqiq public adını və nə etdiyini bir təmiz cümlə ilə yaz. Website varsa onu da əlavə et."
  );

  return normalizeText(parts.join(" "));
}

export function resolveProfileQuestion(draft = {}, progress = {}) {
  const safeDraft = obj(draft);
  const currentQuestionKey = s(progress.currentQuestionKey).toLowerCase();

  return buildAssistantQuestion("profile", {
    prompt: buildProfileQuestionPrompt(safeDraft),
    priority:
      currentQuestionKey === "profile" ||
      currentQuestionKey === "company" ||
      currentQuestionKey === "description" ||
      currentQuestionKey === "website"
        ? 100
        : 96,
  });
}

function buildServicesQuestion(blocker = {}) {
  const parts = [];
  if (s(blocker.sourceHint)) parts.push(s(blocker.sourceHint));
  if (s(blocker.metric)) parts.push(`Hazırkı siqnal: ${s(blocker.metric)}.`);
  parts.push(
    "AI-in danışmalı olduğu real customer-facing xidmətləri yaz. Kanal adlarını və ümumi sözləri yox, həqiqi xidmətləri yaz."
  );

  return buildAssistantQuestion("services", {
    prompt: normalizeText(parts.join(" ")),
    priority: 88,
  });
}

function buildContactsQuestion(blocker = {}) {
  const parts = [];
  if (s(blocker.sourceHint)) parts.push(s(blocker.sourceHint));
  if (s(blocker.metric)) parts.push(`Hazırkı siqnal: ${s(blocker.metric)}.`);
  parts.push(
    "Müştərini ilk olaraq hara yönləndirməli olduğumuzu yaz."
  );

  return buildAssistantQuestion("contacts", {
    prompt: normalizeText(parts.join(" ")),
    priority: 86,
  });
}

function buildHoursQuestion(blocker = {}) {
  const parts = [];
  if (s(blocker.sourceHint)) parts.push(s(blocker.sourceHint));
  if (s(blocker.metric)) parts.push(`Hazırkı siqnal: ${s(blocker.metric)}.`);
  parts.push("İş saatlarını bir sətirdə yaz.");

  return buildAssistantQuestion("hours", {
    prompt: normalizeText(parts.join(" ")),
    priority: 84,
  });
}

function buildPricingQuestion(blocker = {}) {
  const parts = [];
  if (s(blocker.sourceHint)) parts.push(s(blocker.sourceHint));
  if (s(blocker.metric)) parts.push(`Hazırkı siqnal: ${s(blocker.metric)}.`);
  parts.push("AI qiymət barədə necə danışmalıdır?");

  return buildAssistantQuestion("pricing", {
    prompt: normalizeText(parts.join(" ")),
    priority: 82,
  });
}

function buildHandoffQuestion(blocker = {}) {
  const parts = [];
  if (s(blocker.sourceHint)) parts.push(s(blocker.sourceHint));
  if (s(blocker.metric)) parts.push(`Hazırkı siqnal: ${s(blocker.metric)}.`);
  parts.push("AI hansı hallarda dayanıb insana ötürməlidir?");

  return buildAssistantQuestion("handoff", {
    prompt: normalizeText(parts.join(" ")),
    priority: 80,
  });
}

export function getNextQuestion(summary = {}, draft = {}, progress = {}) {
  if (summary.readyForReview === true) {
    return null;
  }

  if (!hasSetupSignalForInterview(draft)) {
    return null;
  }

  const sectionStatus = obj(summary.sectionStatus);

  if (sectionStatus.profile?.status !== "ready") {
    return resolveProfileQuestion(draft, progress);
  }

  const blocker = obj(arr(summary.confirmationBlockers)[0]);
  if (!s(blocker.key)) return null;

  if (blocker.key === "services") {
    return buildServicesQuestion(blocker);
  }

  if (blocker.key === "contacts") {
    return buildContactsQuestion(blocker);
  }

  if (blocker.key === "hours") {
    return buildHoursQuestion(blocker);
  }

  if (blocker.key === "pricing") {
    return buildPricingQuestion(blocker);
  }

  if (blocker.key === "handoff") {
    return buildHandoffQuestion(blocker);
  }

  return buildAssistantQuestion(blocker.key, {
    prompt: normalizeText(
      s(blocker.reason) || s(obj(SECTION_META[blocker.key]).prompt)
    ),
  });
}