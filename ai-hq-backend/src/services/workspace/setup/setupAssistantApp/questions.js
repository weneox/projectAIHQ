import { arr, compactDraftObject, obj, s } from "../draftShared.js";
import {
  buildDefaultAssistantBehaviorDraft,
  normalizeBehaviorPolicyKey,
  normalizeBookingBehaviorMode,
  normalizeClosingBehaviorMode,
  normalizeContactBehaviorMode,
  normalizeEmpathyLevelMode,
  normalizeGreetingBehaviorMode,
  normalizeHandoffBehaviorMode,
  normalizeLocationBehaviorMode,
  normalizeMessageLengthMode,
  normalizePricingBehaviorMode,
  normalizeToneBehaviorMode,
} from "./shared.js";

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
  azerbaijani: "az-AZ",
  azeri: "az-AZ",

  en: "en",
  "en-us": "en",
  "en-gb": "en",
  english: "en",

  tr: "tr",
  "tr-tr": "tr",
  turkish: "tr",

  ru: "ru",
  "ru-ru": "ru",
  russian: "ru",

  ar: "ar",
  "ar-sa": "ar",
  arabic: "ar",

  es: "es",
  "es-es": "es",
  spanish: "es",

  fr: "fr",
  "fr-fr": "fr",
  french: "fr",

  de: "de",
  "de-de": "de",
  german: "de",

  pt: "pt",
  "pt-br": "pt",
  "pt-pt": "pt",
  portuguese: "pt",

  hi: "hi",
  "hi-in": "hi",
  hindi: "hi",
};

export const SETUP_PHASES = {
  business_truth: {
    key: "business_truth",
    label: "Business truth",
  },
  conversation_policy: {
    key: "conversation_policy",
    label: "Conversation policy",
  },
  review_and_launch: {
    key: "review_and_launch",
    label: "Review and launch",
  },
};

const BUSINESS_GROUP = "business_truth";
const BUSINESS_GROUP_LABEL = "Business truth";

const BEHAVIOR_GROUP = "assistant_behavior";
const BEHAVIOR_GROUP_LABEL = "Conversation policy";

const BUSINESS_STEP_ORDER = [
  "company",
  "description",
  "services",
  "contacts",
  "hours",
  "pricing",
  "handoff",
];

const BEHAVIOR_STEP_ORDER = [];

export const SECTION_ORDER = [...BUSINESS_STEP_ORDER];

const COPY = {
  "az-AZ": {
    and: "və",
    businessGroupLabel: BUSINESS_GROUP_LABEL,
    behaviorGroupLabel: BEHAVIOR_GROUP_LABEL,
    phaseLabels: {
      business_truth: "Business truth",
      conversation_policy: "Conversation policy",
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

      greeting_behavior: {
        label: "Salamlama davranışı",
        title: "İlk salam necə olsun",
        prompt:
          "AI söhbətə necə başlasın? Daha qısa, premium, səmimi, yoxsa daha professional? İstəsən nümunə cümlə də yaza bilərsən.",
      },
      closing_behavior: {
        label: "Sağollaşma davranışı",
        title: "Söhbəti necə bağlasın",
        prompt:
          "Söhbətin sonunda necə bağlasın? Qısa dəvət, isti bağlama, növbəti addım təklifi və ya daha premium bir sonluq?",
      },
      tone_behavior: {
        label: "Ümumi rəftar",
        title: "Chatbotun rəftarı və tonu",
        prompt:
          "Ümumilikdə necə danışsın: professional və arxayın, daha isti və insani, premium və səliqəli, yoxsa düz və qısa? İstəsən uzunluq və empati səviyyəsini də yaz.",
      },
      pricing_behavior: {
        label: "Qiymət cavab davranışı",
        title: "Qiymət soruşulanda necə davransın",
        prompt:
          "Qiymət soruşulanda AI əsasən necə davransın: burada cavab versin, cavab + link versin, link-first olsun, yoxsa əvvəlcə xidmət soruşsun?",
      },
      location_behavior: {
        label: "Ünvan cavab davranışı",
        title: "Ünvan soruşulanda necə cavab versin",
        prompt:
          "Ünvan soruşulanda AI necə cavab versin: yalnız mətn, mətn + xəritə, yoxsa birbaşa xəritə?",
      },
      booking_behavior: {
        label: "Rezervasiya yönləndirməsi",
        title: "Booking üçün hara yönləndirsin",
        prompt:
          "Rezervasiya və ya booking üçün AI əsasən hara yönləndirsin: WhatsApp, Instagram, website booking page, yoxsa əvvəlcə məlumat toplasın?",
      },
      contact_behavior: {
        label: "Əlaqə üstünlüyü",
        title: "Əlaqə istəyəndə nəyi önə çıxarsın",
        prompt:
          "User əlaqə istəyəndə AI hansı kanalı daha çox önə çıxarsın: WhatsApp, zəng, email, link, yoxsa ən uyğun olanı seçsin?",
      },
      handoff_behavior: {
        label: "Handoff davranışı",
        title: "İnsana keçid necə olsun",
        prompt:
          "İnsana keçid lazım olanda AI necə davransın: kontekstə görə keçsin, əvvəlcə qısa səbəb istəsin, yoxsa dərhal keçsin?",
      },
    },
    phrases: {
      readyForApproval:
        "Əla. Business truth kifayət qədər doludur. İndi review edib launch-a hazır vəziyyətə keçirə bilərik.",
      companyCaptured: "Qeyd etdim: biznesin adı {value}.",
      descriptionCaptured: "Qeyd etdim: {value}.",
      servicesCaptured: "Qeyd etdim: əsas xidmətlərə {value} daxildir.",
      contactsCaptured: "Əsas əlaqə yollarını qeyd etdim.",
      hoursCaptured: "İş saatlarını qeyd etdim.",
      pricingCaptured: "Qiymət məntiqini qeyd etdim.",
      handoffCaptured: "İnsana yönləndirmə halları qeyd olundu.",
      greetingBehaviorCaptured: "Salamlama davranışını qeyd etdim.",
      closingBehaviorCaptured: "Sağollaşma davranışını qeyd etdim.",
      toneBehaviorCaptured: "Ümumi rəftar və ton qeyd olundu.",
      pricingBehaviorCaptured: "Qiymət cavab davranışını qeyd etdim.",
      locationBehaviorCaptured: "Ünvan cavab davranışını qeyd etdim.",
      bookingBehaviorCaptured: "Rezervasiya yönləndirməsini qeyd etdim.",
      contactBehaviorCaptured: "Əlaqə üstünlüyünü qeyd etdim.",
      handoffBehaviorCaptured: "Handoff davranışını qeyd etdim.",
      genericCaptured: "Qeyd etdim.",
      redirectPrefix: "İndi bunu bağlayaq:",
    },
    examples: {
      greeting_behavior: [
        "qısa və professional salam",
        "premium və nəzakətli açılış",
        "isti amma qısa salam",
      ],
      closing_behavior: [
        "isti bağlama + növbəti addım",
        "qısa və səliqəli sonluq",
        "premium dəvətvari bağlama",
      ],
      tone_behavior: [
        "professional və arxayın",
        "isti və insani",
        "qısa və düz",
      ],
      pricing_behavior: [
        "qısa cavab + pricing page",
        "əvvəlcə xidmət soruş",
        "birbaşa pricing page-ə yönləndir",
      ],
      location_behavior: [
        "ünvan + xəritə",
        "birbaşa xəritə",
        "yalnız qısa ünvan",
      ],
      booking_behavior: [
        "WhatsApp-a yönləndir",
        "Instagram DM-ə yönləndir",
        "əvvəlcə məlumat topla sonra yönləndir",
      ],
      contact_behavior: [
        "WhatsApp first",
        "zəng first",
        "ən uyğun kanalı seç",
      ],
      handoff_behavior: [
        "kontekstə görə keç",
        "əvvəlcə səbəb soruş",
        "birbaşa keç",
      ],
    },
  },

  en: {
    and: "and",
    businessGroupLabel: BUSINESS_GROUP_LABEL,
    behaviorGroupLabel: BEHAVIOR_GROUP_LABEL,
    phaseLabels: {
      business_truth: "Business truth",
      conversation_policy: "Conversation policy",
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

      greeting_behavior: {
        label: "Greeting behavior",
        title: "How the first message should open",
        prompt:
          "How should AI start conversations: brief, premium, friendly, or more professional? You can also write a sample opening line.",
      },
      closing_behavior: {
        label: "Closing behavior",
        title: "How the conversation should close",
        prompt:
          "How should AI close conversations: brief invite, warm close, next-step prompt, or a more premium ending?",
      },
      tone_behavior: {
        label: "Overall behavior",
        title: "Assistant tone and manner",
        prompt:
          "Overall, how should it speak: professional and reassuring, warmer and more human, premium and polished, or direct and concise? You can also mention message length and empathy level.",
      },
      pricing_behavior: {
        label: "Pricing reply behavior",
        title: "How AI should handle pricing questions",
        prompt:
          "When people ask about pricing, should AI answer here, answer + link, go link-first, or ask for the service first?",
      },
      location_behavior: {
        label: "Location reply behavior",
        title: "How AI should handle location questions",
        prompt:
          "When people ask for location, should AI send text only, text + map, or map first?",
      },
      booking_behavior: {
        label: "Booking routing",
        title: "Where booking should be routed",
        prompt:
          "For booking requests, where should AI mainly route people: WhatsApp, Instagram, website booking page, or collect details first?",
      },
      contact_behavior: {
        label: "Contact preference",
        title: "What contact route should be prioritized",
        prompt:
          "When people ask how to contact you, which channel should AI highlight first: WhatsApp, phone, email, link, or best available?",
      },
      handoff_behavior: {
        label: "Handoff behavior",
        title: "How human handoff should happen",
        prompt:
          "When handoff is needed, should AI hand off contextually, ask for a short reason first, or hand off directly?",
      },
    },
    phrases: {
      readyForApproval:
        "Great. The business truth is complete enough. We can review and prepare launch next.",
      companyCaptured: "Got it: the business name is {value}.",
      descriptionCaptured: "Got it: {value}.",
      servicesCaptured: "Got it: the core services include {value}.",
      contactsCaptured: "Got it. I noted the main contact routes.",
      hoursCaptured: "Got it. I noted the working hours.",
      pricingCaptured: "Got it. I noted the pricing logic.",
      handoffCaptured: "Got it. I noted the human handoff cases.",
      greetingBehaviorCaptured: "Got it. I noted the greeting behavior.",
      closingBehaviorCaptured: "Got it. I noted the closing behavior.",
      toneBehaviorCaptured: "Got it. I noted the overall tone and behavior.",
      pricingBehaviorCaptured: "Got it. I noted the pricing reply behavior.",
      locationBehaviorCaptured: "Got it. I noted the location reply behavior.",
      bookingBehaviorCaptured: "Got it. I noted the booking routing behavior.",
      contactBehaviorCaptured: "Got it. I noted the contact preference.",
      handoffBehaviorCaptured: "Got it. I noted the handoff behavior.",
      genericCaptured: "Got it.",
      redirectPrefix: "Let’s lock this in now:",
    },
    examples: {
      greeting_behavior: [
        "brief professional opening",
        "premium concierge-style greeting",
        "warm but short hello",
      ],
      closing_behavior: [
        "warm close + next step",
        "brief polished ending",
        "premium invitation-style close",
      ],
      tone_behavior: [
        "professional and reassuring",
        "warm and human",
        "short and direct",
      ],
      pricing_behavior: [
        "answer here + pricing page",
        "ask for the service first",
        "send the pricing page directly",
      ],
      location_behavior: [
        "short address + map",
        "map first",
        "text only",
      ],
      booking_behavior: [
        "route to WhatsApp",
        "route to Instagram",
        "collect details first",
      ],
      contact_behavior: [
        "WhatsApp first",
        "phone first",
        "best available",
      ],
      handoff_behavior: [
        "contextual handoff",
        "ask reason first",
        "direct handoff",
      ],
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

  greeting_behavior: {
    key: "greeting_behavior",
    label: "Greeting behavior",
    group: BEHAVIOR_GROUP,
    groupLabel: BEHAVIOR_GROUP_LABEL,
    phase: "conversation_policy",
  },
  closing_behavior: {
    key: "closing_behavior",
    label: "Closing behavior",
    group: BEHAVIOR_GROUP,
    groupLabel: BEHAVIOR_GROUP_LABEL,
    phase: "conversation_policy",
  },
  tone_behavior: {
    key: "tone_behavior",
    label: "Tone behavior",
    group: BEHAVIOR_GROUP,
    groupLabel: BEHAVIOR_GROUP_LABEL,
    phase: "conversation_policy",
  },
  pricing_behavior: {
    key: "pricing_behavior",
    label: "Pricing behavior",
    group: BEHAVIOR_GROUP,
    groupLabel: BEHAVIOR_GROUP_LABEL,
    phase: "conversation_policy",
  },
  location_behavior: {
    key: "location_behavior",
    label: "Location behavior",
    group: BEHAVIOR_GROUP,
    groupLabel: BEHAVIOR_GROUP_LABEL,
    phase: "conversation_policy",
  },
  booking_behavior: {
    key: "booking_behavior",
    label: "Booking behavior",
    group: BEHAVIOR_GROUP,
    groupLabel: BEHAVIOR_GROUP_LABEL,
    phase: "conversation_policy",
  },
  contact_behavior: {
    key: "contact_behavior",
    label: "Contact behavior",
    group: BEHAVIOR_GROUP,
    groupLabel: BEHAVIOR_GROUP_LABEL,
    phase: "conversation_policy",
  },
  handoff_behavior: {
    key: "handoff_behavior",
    label: "Handoff behavior",
    group: BEHAVIOR_GROUP,
    groupLabel: BEHAVIOR_GROUP_LABEL,
    phase: "conversation_policy",
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

  "24/7": "__always_open__",
  "24 7": "__always_open__",
  "always open": "__always_open__",

  "appointment only": "__appointment_only__",

  "exact pricing requires a quote": "__quote_required__",
  "quote required": "__quote_required__",
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

  if (key === "greeting_policy" || key === "greetingpolicy") {
    return "greeting_behavior";
  }
  if (key === "closing_policy" || key === "closingpolicy") {
    return "closing_behavior";
  }
  if (key === "tone_policy" || key === "tonepolicy") {
    return "tone_behavior";
  }
  if (key === "pricing_policy" || key === "pricingpolicy") {
    return "pricing_behavior";
  }
  if (key === "location_policy" || key === "locationpolicy") {
    return "location_behavior";
  }
  if (key === "booking_policy" || key === "bookingpolicy") {
    return "booking_behavior";
  }
  if (key === "contact_policy" || key === "contactpolicy") {
    return "contact_behavior";
  }
  if (key === "handoff_policy" || key === "handoffpolicy") {
    return "handoff_behavior";
  }

  return key;
}

function hasMeaningfulServices(value = []) {
  return arr(value).some((item) =>
    Boolean(s(item?.title || item?.name || item?.label))
  );
}

function hasMeaningfulContacts(value = []) {
  return arr(value).some((item) =>
    Boolean(s(item?.value || item?.label || item?.channel || item?.type))
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
        s(row.notes)
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
      Number.isFinite(Number(pricing.minPrice))
  );
}

function hasMeaningfulHandoff(value = {}) {
  const handoff = obj(value);
  return Boolean(s(handoff.summary) || arr(handoff.triggers).length > 0);
}

function hasAddressSignal(draft = {}) {
  const businessProfile = obj(draft.businessProfile);

  return Boolean(
    s(businessProfile.primaryAddress) ||
      arr(draft.contacts).some((item) =>
        /maps|map|google\.com\/maps|g\.page|maps\.app/i.test(
          s(item?.value || item?.label || "")
        )
      ) ||
      s(obj(draft.sourceMetadata).primarySourceType) === "google_maps"
  );
}

function hasBookingSignal(draft = {}) {
  const contacts = arr(draft.contacts).map((item) =>
    s(item?.value || item?.label || "")
  );

  return contacts.some((value) =>
    /wa\.me|whatsapp|instagram|book|booking|reserve|appointment/i.test(value)
  );
}

function hasGreetingBehaviorConfigured(draft = {}) {
  const behavior = obj(obj(draft).assistantBehaviorDraft);
  const policy = obj(behavior.greetingPolicy);
  const overrides = obj(behavior.tenantOverrides);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().greetingPolicy);

  return Boolean(
    s(policy.openingLine) ||
      s(policy.followupLeadIn) ||
      s(policy.note) ||
      normalizeGreetingBehaviorMode(policy.mode || defaults.mode) !==
        normalizeGreetingBehaviorMode(defaults.mode) ||
      overrides.greetingOverrideActive === true
  );
}

function hasClosingBehaviorConfigured(draft = {}) {
  const behavior = obj(obj(draft).assistantBehaviorDraft);
  const policy = obj(behavior.closingPolicy);
  const overrides = obj(behavior.tenantOverrides);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().closingPolicy);

  return Boolean(
    s(policy.closingLine) ||
      s(policy.note) ||
      normalizeClosingBehaviorMode(policy.mode || defaults.mode) !==
        normalizeClosingBehaviorMode(defaults.mode) ||
      policy.includeHumanOfferWhenRelevant === false ||
      policy.includeNextStepPrompt === false ||
      overrides.closingOverrideActive === true
  );
}

function hasToneBehaviorConfigured(draft = {}) {
  const behavior = obj(obj(draft).assistantBehaviorDraft);
  const policy = obj(behavior.tonePolicy);
  const platformDefaults = obj(behavior.platformDefaults);
  const overrides = obj(behavior.tenantOverrides);
  const defaults = buildDefaultAssistantBehaviorDraft();
  const defaultTone = obj(defaults.tonePolicy);
  const defaultPlatform = obj(defaults.platformDefaults);

  return Boolean(
    s(policy.note) ||
      normalizeToneBehaviorMode(policy.mode || defaultTone.mode) !==
        normalizeToneBehaviorMode(defaultTone.mode) ||
      normalizeMessageLengthMode(
        policy.messageLength || platformDefaults.messageLength || defaultTone.messageLength
      ) !==
        normalizeMessageLengthMode(
          defaultTone.messageLength || defaultPlatform.messageLength
        ) ||
      normalizeEmpathyLevelMode(
        policy.empathyLevel || platformDefaults.empathyLevel || defaultTone.empathyLevel
      ) !==
        normalizeEmpathyLevelMode(
          defaultTone.empathyLevel || defaultPlatform.empathyLevel
        ) ||
      policy.shouldSoundPremium === true ||
      policy.shouldSoundLocalFriendly === true ||
      policy.shouldAvoidOverexplaining === false ||
      policy.shouldStayConcise === false ||
      overrides.toneOverrideActive === true
  );
}

function hasPricingBehaviorConfigured(draft = {}) {
  const policy = obj(obj(obj(draft).assistantBehaviorDraft).pricingPolicy);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().pricingPolicy);

  return Boolean(
    s(policy.preferredTargetUrl) ||
      s(policy.fallbackTargetUrl) ||
      s(policy.note) ||
      normalizePricingBehaviorMode(policy.mode || defaults.mode) !==
        normalizePricingBehaviorMode(defaults.mode) ||
      policy.askServiceFirst === true
  );
}

function hasLocationBehaviorConfigured(draft = {}) {
  const policy = obj(obj(obj(draft).assistantBehaviorDraft).locationPolicy);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().locationPolicy);

  return Boolean(
    s(policy.preferredTargetUrl) ||
      s(policy.fallbackTargetUrl) ||
      s(policy.note) ||
      normalizeLocationBehaviorMode(policy.mode || defaults.mode) !==
        normalizeLocationBehaviorMode(defaults.mode)
  );
}

function hasBookingBehaviorConfigured(draft = {}) {
  const policy = obj(obj(obj(draft).assistantBehaviorDraft).bookingPolicy);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().bookingPolicy);

  return Boolean(
    s(policy.preferredTargetUrl) ||
      s(policy.fallbackTargetUrl) ||
      s(policy.note) ||
      normalizeBookingBehaviorMode(policy.mode || defaults.mode) !==
        normalizeBookingBehaviorMode(defaults.mode) ||
      policy.collectLeadFirst === true
  );
}

function hasContactBehaviorConfigured(draft = {}) {
  const policy = obj(obj(obj(draft).assistantBehaviorDraft).contactPolicy);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().contactPolicy);

  return Boolean(
    s(policy.preferredTargetUrl) ||
      s(policy.fallbackTargetUrl) ||
      s(policy.note) ||
      s(policy.preferredChannel) ||
      normalizeContactBehaviorMode(policy.mode || defaults.mode) !==
        normalizeContactBehaviorMode(defaults.mode)
  );
}

function hasHandoffBehaviorConfigured(draft = {}) {
  const policy = obj(obj(obj(draft).assistantBehaviorDraft).handoffPolicy);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().handoffPolicy);

  return Boolean(
    s(policy.note) ||
      normalizeHandoffBehaviorMode(policy.mode || defaults.mode) !==
        normalizeHandoffBehaviorMode(defaults.mode) ||
      policy.requiresReason === false
  );
}

export function isBehaviorStepRelevant(questionKey = "", draft = {}) {
  const key = normalizeQuestionKey(questionKey);

  if (key === "greeting_behavior") return true;
  if (key === "closing_behavior") return true;
  if (key === "tone_behavior") return true;

  if (key === "pricing_behavior") {
    return hasMeaningfulPricing(obj(draft).pricingPosture);
  }
  if (key === "location_behavior") {
    return hasAddressSignal(draft);
  }
  if (key === "booking_behavior") {
    return hasBookingSignal(draft);
  }
  if (key === "contact_behavior") {
    return hasMeaningfulContacts(obj(draft).contacts);
  }
  if (key === "handoff_behavior") {
    return hasMeaningfulHandoff(obj(draft).handoffRules);
  }

  return false;
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

  if (key === "company") {
    return Boolean(s(businessProfile.companyName));
  }

  if (key === "description") {
    return Boolean(s(businessProfile.description));
  }

  if (key === "services") {
    return hasMeaningfulServices(safeDraft.services);
  }

  if (key === "contacts") {
    return hasMeaningfulContacts(safeDraft.contacts);
  }

  if (key === "hours") {
    return hasMeaningfulHours(safeDraft.hours);
  }

  if (key === "pricing") {
    return hasMeaningfulPricing(safeDraft.pricingPosture);
  }

  if (key === "handoff") {
    return hasMeaningfulHandoff(safeDraft.handoffRules);
  }

  if (key === "greeting_behavior") {
    return hasGreetingBehaviorConfigured(draft);
  }

  if (key === "closing_behavior") {
    return hasClosingBehaviorConfigured(draft);
  }

  if (key === "tone_behavior") {
    return hasToneBehaviorConfigured(draft);
  }

  if (key === "pricing_behavior") {
    return !isBehaviorStepRelevant(key, draft) || hasPricingBehaviorConfigured(draft);
  }

  if (key === "location_behavior") {
    return !isBehaviorStepRelevant(key, draft) || hasLocationBehaviorConfigured(draft);
  }

  if (key === "booking_behavior") {
    return !isBehaviorStepRelevant(key, draft) || hasBookingBehaviorConfigured(draft);
  }

  if (key === "contact_behavior") {
    return !isBehaviorStepRelevant(key, draft) || hasContactBehaviorConfigured(draft);
  }

  if (key === "handoff_behavior") {
    return !isBehaviorStepRelevant(key, draft) || hasHandoffBehaviorConfigured(draft);
  }

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
        (meta.group === BEHAVIOR_GROUP
          ? copy.behaviorGroupLabel || BEHAVIOR_GROUP_LABEL
          : copy.businessGroupLabel || BUSINESS_GROUP_LABEL)
    ),
    phase: phaseKey,
    phaseLabel,
    priority: Number(source.priority || 1) || 1,
    examples: arr(obj(copy.examples)[questionKey]).slice(0, 3),
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

function buildRemainingQuestionOrder(draft = {}, options = {}) {
  const includeBehavior = obj(options).includeBehavior !== false;

  const order = [...BUSINESS_STEP_ORDER];
  if (includeBehavior) {
    order.push(
      ...BEHAVIOR_STEP_ORDER.filter((key) => isBehaviorStepRelevant(key, draft))
    );
  }
  return order;
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
  hasGreetingBehaviorConfigured,
  hasClosingBehaviorConfigured,
  hasToneBehaviorConfigured,
  hasPricingBehaviorConfigured,
  hasLocationBehaviorConfigured,
  hasBookingBehaviorConfigured,
  hasContactBehaviorConfigured,
  hasHandoffBehaviorConfigured,
  isBehaviorStepRelevant,
};