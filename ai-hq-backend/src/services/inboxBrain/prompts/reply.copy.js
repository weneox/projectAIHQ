function normalizeLanguage(value = "") {
  const x = String(value || "").trim().toLowerCase();
  if (!x) return "en";

  if (x.startsWith("az")) return "az";
  if (x.startsWith("en")) return "en";
  if (x.startsWith("tr")) return "tr";
  if (x.startsWith("ru")) return "ru";
  if (x.startsWith("es")) return "es";
  if (x.startsWith("de")) return "de";
  if (x.startsWith("fr")) return "fr";
  if (x.startsWith("it")) return "it";
  if (x.startsWith("pt")) return "pt";
  if (x.startsWith("ar")) return "ar";
  if (x.startsWith("nl")) return "nl";
  if (x.startsWith("pl")) return "pl";
  if (x.startsWith("uk")) return "uk";
  if (x.startsWith("zh")) return "zh";
  if (x.startsWith("ja")) return "ja";
  if (x.startsWith("ko")) return "ko";
  if (x.startsWith("hi")) return "hi";

  return "en";
}

export function interpolateBrand(template = "", brandName = "") {
  return String(template || "").replace(/\{brand\}/gi, String(brandName || "").trim());
}

const GREETING_NEUTRAL = {
  en: "Hello.",
  az: "Salam.",
  tr: "Merhaba.",
  ru: "Здравствуйте.",
  es: "Hola.",
  de: "Hallo.",
  fr: "Bonjour.",
  it: "Ciao.",
  pt: "Olá.",
  ar: "مرحبًا.",
  nl: "Hallo.",
  pl: "Cześć.",
  uk: "Вітаю.",
  zh: "你好。",
  ja: "こんにちは。",
  ko: "안녕하세요.",
  hi: "नमस्ते.",
};

const GREETING_WARM = {
  en: "Hello, welcome.",
  az: "Salam, xoş gördük.",
  tr: "Merhaba, hoş geldiniz.",
  ru: "Здравствуйте, рады вас видеть.",
  es: "Hola, bienvenido.",
  de: "Hallo, willkommen.",
  fr: "Bonjour, bienvenue.",
  it: "Ciao, benvenuto.",
  pt: "Olá, bem-vindo.",
  ar: "مرحبًا، أهلًا بك.",
  nl: "Hallo, welkom.",
  pl: "Cześć, witamy.",
  uk: "Вітаю, ласкаво просимо.",
  zh: "你好，欢迎。",
  ja: "こんにちは。ようこそ。",
  ko: "안녕하세요. 환영합니다.",
  hi: "नमस्ते, आपका स्वागत है।",
};

const GREETING_FORMAL = {
  en: "Hello.",
  az: "Salam.",
  tr: "Merhaba.",
  ru: "Здравствуйте.",
  es: "Hola.",
  de: "Guten Tag.",
  fr: "Bonjour.",
  it: "Buongiorno.",
  pt: "Olá.",
  ar: "مرحبًا.",
  nl: "Goedendag.",
  pl: "Dzień dobry.",
  uk: "Добрий день.",
  zh: "您好。",
  ja: "こんにちは。",
  ko: "안녕하세요.",
  hi: "नमस्कार।",
};

const GREETING_BRANDED = {
  en: "Hello. You’re connected with the {brand} team.",
  az: "Salam. {brand} komandası ilə əlaqədəsiniz.",
  tr: "Merhaba. {brand} ekibiyle bağlantıdasınız.",
  ru: "Здравствуйте. Вы на связи с командой {brand}.",
  es: "Hola. Estás conectado con el equipo de {brand}.",
  de: "Hallo. Sie sind mit dem Team von {brand} verbunden.",
  fr: "Bonjour. Vous êtes en relation avec l’équipe de {brand}.",
  it: "Ciao. Sei in contatto con il team di {brand}.",
  pt: "Olá. Você está em contato com a equipe da {brand}.",
  ar: "مرحبًا. أنت الآن على تواصل مع فريق {brand}.",
  nl: "Hallo. Je bent verbonden met het team van {brand}.",
  pl: "Cześć. Jesteś połączony z zespołem {brand}.",
  uk: "Вітаю. Ви на зв’язку з командою {brand}.",
  zh: "你好。你已连接到 {brand} 团队。",
  ja: "こんにちは。{brand} チームにつながっています。",
  ko: "안녕하세요. {brand} 팀과 연결되었습니다.",
  hi: "नमस्ते। आप {brand} टीम से जुड़े हैं।",
};

const FOLLOWUP_GENERIC = {
  en: "How can I help?",
  az: "Necə kömək edə bilərəm?",
  tr: "Nasıl yardımcı olabilirim?",
  ru: "Чем могу помочь?",
  es: "¿Cómo puedo ayudar?",
  de: "Wie kann ich helfen?",
  fr: "Comment puis-je aider ?",
  it: "Come posso aiutarti?",
  pt: "Como posso ajudar?",
  ar: "كيف يمكنني المساعدة؟",
  nl: "Hoe kan ik helpen?",
  pl: "Jak mogę pomóc?",
  uk: "Чим можу допомогти?",
  zh: "我可以怎么帮助你？",
  ja: "どのようにお手伝いできますか？",
  ko: "어떻게 도와드릴까요?",
  hi: "मैं कैसे मदद कर सकता हूँ?",
};

export function getLocalizedGreeting({
  language = "en",
  mode = "neutral",
  brandName = "",
}) {
  const lang = normalizeLanguage(language);
  const safeMode = String(mode || "neutral").trim().toLowerCase();

  if (safeMode === "none") return "";

  if (safeMode === "branded" && String(brandName || "").trim()) {
    return interpolateBrand(GREETING_BRANDED[lang] || GREETING_BRANDED.en, brandName);
  }

  if (safeMode === "warm") {
    return GREETING_WARM[lang] || GREETING_WARM.en;
  }

  if (safeMode === "formal") {
    return GREETING_FORMAL[lang] || GREETING_FORMAL.en;
  }

  return GREETING_NEUTRAL[lang] || GREETING_NEUTRAL.en;
}

export function getLocalizedGreetingFollowup(language = "en") {
  const lang = normalizeLanguage(language);
  return FOLLOWUP_GENERIC[lang] || FOLLOWUP_GENERIC.en;
}