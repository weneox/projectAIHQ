import { arr, compactDraftObject, obj, s } from "../draftShared.js";

export const SUPPORTED_SETUP_LOCALES = [
  "az-AZ",
  "en",
  "tr",
  "ru",
  "ar",
  "es",
  "fr",
  "de",
  "pt",
  "hi",
];

const LOCALE_ALIASES = {
  az: "az-AZ",
  "az-az": "az-AZ",

  en: "en",
  "en-us": "en",
  "en-gb": "en",

  tr: "tr",
  "tr-tr": "tr",

  ru: "ru",
  "ru-ru": "ru",

  ar: "ar",
  "ar-sa": "ar",

  es: "es",
  "es-es": "es",

  fr: "fr",
  "fr-fr": "fr",

  de: "de",
  "de-de": "de",

  pt: "pt",
  "pt-br": "pt",
  "pt-pt": "pt",

  hi: "hi",
  "hi-in": "hi",
};

export const SETUP_PHASES = {
  business_truth: {
    key: "business_truth",
    label: "Business truth",
  },
  review_and_launch: {
    key: "review_and_launch",
    label: "Review and launch",
  },
};

const BUSINESS_GROUP = "business_truth";
const BUSINESS_GROUP_LABEL = "Business truth";

const BUSINESS_STEP_ORDER = [
  "company",
  "description",
  "services",
  "contacts",
  "hours",
  "pricing",
  "handoff",
];

export const SECTION_ORDER = [...BUSINESS_STEP_ORDER];

const COPY = {
  "az-AZ": {
    and: "və",
    businessGroupLabel: BUSINESS_GROUP_LABEL,
    phaseLabels: {
      business_truth: "Business truth",
      review_and_launch: "Review and launch",
    },
    steps: {
      company: {
        label: "Biznes adı",
        title: "Biznes adı və kimliyi",
        prompt:
          "Başlayaq. Biznesin adını yazın. Saytınız və ya əsas public source varsa onu da əlavə edə bilərsiniz.",
      },
      description: {
        label: "Biznes təsviri",
        title: "Biznes nə iş görür",
        prompt:
          "Bu biznes nə edir, kimə xidmət edir və əsas nəticə nədir? Qısa, amma dəqiq yazın.",
      },
      services: {
        label: "Əsas xidmətlər",
        title: "Əsas xidmətlər",
        prompt:
          "Əsas xidmətləri və ya istiqamətləri vergüllə yazın. Məsələn: implant, estetik plomb, konsultasiya.",
      },
      contacts: {
        label: "Əlaqə yolu",
        title: "Əsas əlaqə və dönüş yolu",
        prompt:
          "Müştərini əsasən hara yönləndirmək lazımdır: telefon, WhatsApp, Instagram, email və ya link? Əsas əlaqə yollarını yazın.",
      },
      hours: {
        label: "İş saatları",
        title: "İş saatları",
        prompt:
          "İş saatlarını bir cümlə ilə yazın. Məsələn: həftə içi 09:00–18:00, şənbə 10:00–15:00.",
      },
      pricing: {
        label: "Qiymət faktları",
        title: "Qiymət məntiqi",
        prompt:
          "Qiymətlə bağlı əsas həqiqəti yazın: sabitdir, xidmətə görə dəyişir, başlanğıc qiymət var, yoxsa əvvəlcə sorğu/consultation lazımdır?",
      },
      handoff: {
        label: "İnsana yönləndirmə halları",
        title: "Hansı hallarda insana ötürsün",
        prompt:
          "Hansı hallarda AI mütləq insana yönləndirsin? Məsələn: şikayət, dəqiq qiymət, tibbi risk, xüsusi vəziyyət.",
      },
    },
    phrases: {
      readyForApproval:
        "Əla. Business truth kifayət qədər doludur. İndi review edib launch-a hazır vəziyyətə keçirə bilərik.",
      genericCaptured: "Qeyd etdim.",
    },
  },

  en: {
    and: "and",
    businessGroupLabel: BUSINESS_GROUP_LABEL,
    phaseLabels: {
      business_truth: "Business truth",
      review_and_launch: "Review and launch",
    },
    steps: {
      company: {
        label: "Business name",
        title: "Business identity",
        prompt:
          "Let’s start. Write the business name. If you already have a website or main public source, you can include that too.",
      },
      description: {
        label: "Business description",
        title: "What the business does",
        prompt:
          "What does this business do, who is it for, and what result do people come for? Keep it short but precise.",
      },
      services: {
        label: "Core services",
        title: "Core services",
        prompt:
          "Write the core services or categories, separated by commas. Example: implants, cosmetic fillings, consultation.",
      },
      contacts: {
        label: "Contact route",
        title: "Primary contact route",
        prompt:
          "Where should people mainly be directed: phone, WhatsApp, Instagram, email, or a link? Write the main contact routes.",
      },
      hours: {
        label: "Working hours",
        title: "Working hours",
        prompt:
          "Write the working hours in one sentence. Example: weekdays 09:00–18:00, Saturday 10:00–15:00.",
      },
      pricing: {
        label: "Pricing facts",
        title: "Pricing logic",
        prompt:
          "Write the core pricing truth: fixed, starts from, varies by service, or quote/consultation first?",
      },
      handoff: {
        label: "Human handoff cases",
        title: "When AI must hand off",
        prompt:
          "In which cases must AI hand the conversation to a human? Example: complaints, exact pricing, medical risk, unusual situations.",
      },
    },
    phrases: {
      readyForApproval:
        "Great. The business truth is complete enough. We can review and prepare launch next.",
      genericCaptured: "Got it.",
    },
  },
};

function normalizeText(value = "") {
  return s(value).replace(/\s+/g, " ").trim();
}

export function normalizeSetupLocale(value = "") {
  const raw = normalizeText(value).toLowerCase();
  return LOCALE_ALIASES[raw] || "az-AZ";
}

export function getSetupCopy(locale = "") {
  const normalized = normalizeSetupLocale(locale);
  return COPY[normalized] || COPY.en || COPY["az-AZ"];
}

function buildFallbackCopy(locale = "") {
  const normalized = normalizeSetupLocale(locale);
  if (COPY[normalized]) return COPY[normalized];
  return COPY.en;
}

export const SECTION_META = {
  source_capture: {
    key: "source_capture",
    label: "Public source",
    group: BUSINESS_GROUP,
    groupLabel: BUSINESS_GROUP_LABEL,
    phase: "business_truth",
  },
  profile: {
    key: "profile",
    label: "Identity",
    group: BUSINESS_GROUP,
    groupLabel: BUSINESS_GROUP_LABEL,
    phase: "business_truth",
  },
  company: {
    key: "company",
    label: "Business name",
    group: BUSINESS_GROUP,
    groupLabel: BUSINESS_GROUP_LABEL,
    phase: "business_truth",
  },
  description: {
    key: "description",
    label: "Business description",
    group: BUSINESS_GROUP,
    groupLabel: BUSINESS_GROUP_LABEL,
    phase: "business_truth",
  },
  website: {
    key: "website",
    label: "Website",
    group: BUSINESS_GROUP,
    groupLabel: BUSINESS_GROUP_LABEL,
    phase: "business_truth",
  },
  services: {
    key: "services",
    label: "Services",
    group: BUSINESS_GROUP,
    groupLabel: BUSINESS_GROUP_LABEL,
    phase: "business_truth",
  },
  contacts: {
    key: "contacts",
    label: "Contact route",
    group: BUSINESS_GROUP,
    groupLabel: BUSINESS_GROUP_LABEL,
    phase: "business_truth",
  },
  hours: {
    key: "hours",
    label: "Hours",
    group: BUSINESS_GROUP,
    groupLabel: BUSINESS_GROUP_LABEL,
    phase: "business_truth",
  },
  pricing: {
    key: "pricing",
    label: "Pricing facts",
    group: BUSINESS_GROUP,
    groupLabel: BUSINESS_GROUP_LABEL,
    phase: "business_truth",
  },
  handoff: {
    key: "handoff",
    label: "Human handoff",
    group: BUSINESS_GROUP,
    groupLabel: BUSINESS_GROUP_LABEL,
    phase: "business_truth",
  },
};

export const INTENT_ONLY_RESPONSES = {
  ok: "__continue__",
  okay: "__continue__",
  davam: "__continue__",
  continue: "__continue__",
  next: "__continue__",
  beli: "__continue__",
  bəli: "__continue__",
  hə: "__continue__",
  he: "__continue__",
  oldu: "__continue__",
  tamam: "__continue__",

  skip: "__skip__",
  keç: "__skip__",
  kec: "__skip__",
};

export function normalizeQuestionKey(value = "") {
  const key = s(value).toLowerCase();

  if (!key) return "";
  if (key === "contact") return "contacts";
  if (key === "price") return "pricing";
  if (key === "pricing_posture") return "pricing";
  if (key === "business_name") return "company";
  if (key === "business_description") return "description";
  if (key === "setup_assistant") return "";
  if (key === "source_capture") return "";
  if (key === "profile") return "";
  if (key === "website") return "company";


  return key;
}

function hasMeaningfulServices(value = []) {
  return arr(value).some((item) =>
    Boolean(s(item?.title || item?.name || item?.label || item))
  );
}

function hasMeaningfulContacts(value = []) {
  return arr(value).some((item) =>
    Boolean(s(item?.value || item?.label || item?.channel || item?.type || item))
  );
}

function hasMeaningfulHours(value = []) {
  return arr(value).some((item) => {
    const row = obj(item);
    return Boolean(
      row.allDay === true ||
        row.appointmentOnly === true ||
        row.closed === true ||
        s(row.openTime) ||
        s(row.closeTime) ||
        s(row.notes) ||
        s(item)
    );
  });
}

function hasMeaningfulPricing(value = {}) {
  const pricing = obj(value);
  return Boolean(
    s(pricing.publicSummary) ||
      s(pricing.pricingMode) ||
      s(pricing.pricingNotes) ||
      Number.isFinite(Number(pricing.startingAt)) ||
      Number.isFinite(Number(pricing.minPrice)) ||
      s(value)
  );
}

function hasMeaningfulHandoff(value = {}) {
  const handoff = obj(value);
  return Boolean(
    handoff.enabled === true ||
      s(handoff.summary) ||
      arr(handoff.triggers).length > 0 ||
      s(value)
  );
}

export function hasSetupSignalForInterview(draft = {}) {
  const safeDraft = obj(draft);
  const businessProfile = obj(safeDraft.businessProfile);
  const sourceMetadata = obj(safeDraft.sourceMetadata);

  return Boolean(
    s(businessProfile.companyName) ||
      s(businessProfile.description) ||
      s(businessProfile.websiteUrl) ||
      hasMeaningfulServices(safeDraft.services) ||
      hasMeaningfulContacts(safeDraft.contacts) ||
      hasMeaningfulHours(safeDraft.hours) ||
      hasMeaningfulPricing(safeDraft.pricingPosture) ||
      hasMeaningfulHandoff(safeDraft.handoffRules) ||
      s(sourceMetadata.primarySourceType) ||
      s(sourceMetadata.primarySourceUrl) ||
      arr(sourceMetadata.sourceLabels).length ||
      arr(sourceMetadata.evidenceSummary).length
  );
}

function isSkippedQuestion(questionKey = "", progress = {}) {
  const key = normalizeQuestionKey(questionKey);
  if (!key) return false;

  const skipped = arr(obj(progress).skippedQuestions)
    .map((item) => normalizeQuestionKey(item))
    .filter(Boolean);

  return skipped.includes(key);
}

export function isQuestionSatisfied(questionKey = "", draft = {}) {
  const key = normalizeQuestionKey(questionKey);
  const safeDraft = obj(draft);
  const businessProfile = obj(safeDraft.businessProfile);

  if (!key) return false;

  if (key === "company") return Boolean(s(businessProfile.companyName));
  if (key === "description") return Boolean(s(businessProfile.description));
  if (key === "services") return hasMeaningfulServices(safeDraft.services);
  if (key === "contacts") return hasMeaningfulContacts(safeDraft.contacts);
  if (key === "hours") return hasMeaningfulHours(safeDraft.hours);
  if (key === "pricing") return hasMeaningfulPricing(safeDraft.pricingPosture);
  if (key === "handoff") return hasMeaningfulHandoff(safeDraft.handoffRules);


  return false;
}

export function buildAssistantQuestion(key = "", overrides = {}, options = {}) {
  const questionKey = normalizeQuestionKey(key) || "company";
  const meta = obj(SECTION_META[questionKey] || SECTION_META.company);
  const source = obj(overrides);
  const locale =
    typeof options === "string"
      ? normalizeSetupLocale(options)
      : normalizeSetupLocale(options?.locale);

  const copy = buildFallbackCopy(locale);
  const localized = obj(copy.steps?.[questionKey]);
  const phaseKey = s(source.phase || meta.phase || "business_truth");
  const phaseLabel =
    s(obj(copy.phaseLabels)[phaseKey]) ||
    s(obj(SETUP_PHASES[phaseKey]).label) ||
    "Business truth";

  return compactDraftObject({
    key: questionKey,
    step: s(source.step || questionKey).toLowerCase(),
    label: s(source.label || localized.label || meta.label),
    title: s(source.title || localized.title || localized.label || meta.label),
    prompt: normalizeText(source.prompt || localized.prompt),
    placeholder: s(source.placeholder),
    group: s(source.group || meta.group || BUSINESS_GROUP),
    groupLabel: s(
      source.groupLabel ||
        localized.groupLabel ||
        copy.businessGroupLabel ||
        BUSINESS_GROUP_LABEL
    ),
    phase: phaseKey,
    phaseLabel,
    priority: Number(source.priority || 1) || 1,
    examples: [],
  });
}

function getPreferredQuestionKey(progress = {}, options = {}) {
  return normalizeQuestionKey(
    s(
      obj(options).preferQuestionKey ||
        obj(progress).currentQuestionKey ||
        obj(progress).lastAnsweredStep
    )
  );
}

function buildRemainingQuestionOrder(_draft = {}, _options = {}) {
  return [...BUSINESS_STEP_ORDER];
}

export function getNextQuestion(summary = {}, draft = {}, progress = {}, options = {}) {
  void summary;

  const locale = normalizeSetupLocale(
    typeof options === "string" ? options : options?.locale
  );
  const preferQuestionKey = getPreferredQuestionKey(progress, options);
  const order = buildRemainingQuestionOrder(draft, options);

  if (
    preferQuestionKey &&
    order.includes(preferQuestionKey) &&
    !isSkippedQuestion(preferQuestionKey, progress) &&
    !isQuestionSatisfied(preferQuestionKey, draft)
  ) {
    return buildAssistantQuestion(preferQuestionKey, {}, { locale });
  }

  for (const step of order) {
    if (isSkippedQuestion(step, progress)) continue;
    if (!isQuestionSatisfied(step, draft)) {
      return buildAssistantQuestion(step, {}, { locale });
    }
  }

  return null;
}

export const __test__ = {
  hasMeaningfulServices,
  hasMeaningfulContacts,
  hasMeaningfulHours,
  hasMeaningfulPricing,
  hasMeaningfulHandoff,
};
