import { firstText, joinHumanList, sentence, s, uniqStrings } from "./normalize.js";

const LABELS = {
  az: {
    phone: "Əlaqə nömrəmiz",
    email: "E-poçt ünvanımız",
    website: "Vebsayt",
    address: "Ünvan",
    name: "Biznes adı",
    services: "Əsas xidmətlərimiz",
    products: "Məhsullarımız",
    pricing: "Qiymət məlumatı",
    booking: "Görüş/rezerv qaydası",
    social: "Sosial linklərimiz",
    languages: "Dəstəklənən dil",
    behavior: "Təsdiqlənmiş AI davranışı",
    unavailable: "Bu sual üçün təsdiqlənmiş məlumat hələ əlavə olunmayıb.",
    greeting: "Salam, necə kömək edə bilərəm?",
    gratitude: "Buyurun, məmnuniyyətlə.",
    clarify: "Əlbəttə, hansı məlumat lazımdır?",
  },
  en: {
    phone: "Phone",
    email: "Email",
    website: "Website",
    address: "Address",
    name: "Business name",
    services: "Approved services",
    products: "Approved products",
    pricing: "Pricing information",
    booking: "Booking information",
    social: "Social links",
    languages: "Supported language",
    behavior: "Approved AI behavior",
    unavailable: "Approved information for this question is not available yet.",
    greeting: "Hello, how can I help?",
    gratitude: "You're welcome.",
    clarify: "Sure, what information do you need?",
  },
  es: {
    phone: "Teléfono",
    email: "Correo",
    website: "Sitio web",
    address: "Dirección",
    name: "Nombre del negocio",
    services: "Servicios aprobados",
    products: "Productos aprobados",
    pricing: "Información de precios",
    booking: "Información de reserva",
    social: "Redes sociales",
    languages: "Idioma compatible",
    behavior: "Comportamiento aprobado de IA",
    unavailable: "La información aprobada para esta pregunta aún no está disponible.",
    greeting: "Hola, ¿cómo puedo ayudarte?",
    gratitude: "Con gusto.",
    clarify: "Claro, ¿qué información necesitas?",
  },
  tr: {
    phone: "Telefon",
    email: "E-posta",
    website: "Web sitesi",
    address: "Adres",
    name: "İşletme adı",
    services: "Onaylı hizmetler",
    products: "Onaylı ürünler",
    pricing: "Fiyat bilgisi",
    booking: "Randevu/rezervasyon bilgisi",
    social: "Sosyal bağlantılar",
    languages: "Desteklenen dil",
    behavior: "Onaylı AI davranışı",
    unavailable: "Bu soru için onaylı bilgi henüz eklenmemiş.",
    greeting: "Merhaba, nasıl yardımcı olabilirim?",
    gratitude: "Rica ederim.",
    clarify: "Elbette, hangi bilgiye ihtiyacınız var?",
  },
  ru: {
    phone: "Телефон",
    email: "Email",
    website: "Сайт",
    address: "Адрес",
    name: "Название бизнеса",
    services: "Подтвержденные услуги",
    products: "Подтвержденные продукты",
    pricing: "Информация о цене",
    booking: "Информация о записи",
    social: "Социальные ссылки",
    languages: "Поддерживаемый язык",
    behavior: "Подтвержденное поведение AI",
    unavailable: "Подтвержденная информация по этому вопросу пока не добавлена.",
    greeting: "Здравствуйте, чем могу помочь?",
    gratitude: "Пожалуйста.",
    clarify: "Конечно, какая информация вам нужна?",
  },
};

function labels(language = "az") {
  return LABELS[language] || LABELS.en;
}

function pushFact({ parts, factsUsed, used, label, value, factKey }) {
  const safe = s(value);
  if (!safe || used.has(factKey)) return;

  used.add(factKey);
  parts.push(`${label}: ${safe}.`);
  factsUsed.push(`${factKey}: ${safe}`);
}

export function composeApprovedTruthAnswer({
  classification = {},
  facts = {},
} = {}) {
  const language = s(classification.language || "az") || "az";
  const intents = uniqStrings(classification.intents || [classification.primaryIntent]);
  const l = labels(language);
  const parts = [];
  const factsUsed = [];
  const used = new Set();

  if (intents.includes("smalltalk.greeting")) {
    parts.push(l.greeting);
    factsUsed.push("Smalltalk: greeting");
  }

  if (intents.includes("smalltalk.gratitude")) {
    parts.push(l.gratitude);
    factsUsed.push("Smalltalk: gratitude");
  }

  if (intents.includes("clarify.unclear")) {
    parts.push(l.clarify);
    factsUsed.push("Clarification: unclear");
  }

  if (intents.includes("business.summary")) {
    const value = firstText(facts.summary, facts.industry, facts.displayName);
    if (value) {
      parts.push(sentence(value));
      factsUsed.push(`Business summary: ${value}`);
    }
  }

  if (intents.includes("business.services")) {
    if (facts.summary) {
      parts.push(sentence(facts.summary));
      factsUsed.push(`Business summary: ${facts.summary}`);
    } else if (facts.services?.length) {
      const list = joinHumanList(facts.services, language);
      parts.push(`${l.services}: ${list}.`);
      factsUsed.push(`Services: ${list}`);
    } else {
      parts.push(l.unavailable);
      factsUsed.push("Services: not approved");
    }
  }

  if (intents.includes("contact.general")) {
    pushFact({ parts, factsUsed, used, label: l.phone, value: facts.phone, factKey: "Primary phone" });
    pushFact({ parts, factsUsed, used, label: l.email, value: facts.email, factKey: "Primary email" });
    pushFact({ parts, factsUsed, used, label: l.website, value: facts.website, factKey: "Website" });
    pushFact({ parts, factsUsed, used, label: l.address, value: facts.address, factKey: "Address" });
  }

  if (intents.includes("contact.phone")) {
    pushFact({ parts, factsUsed, used, label: l.phone, value: facts.phone, factKey: "Primary phone" });
  }

  if (intents.includes("contact.email")) {
    pushFact({ parts, factsUsed, used, label: l.email, value: facts.email, factKey: "Primary email" });
  }

  if (intents.includes("contact.website")) {
    pushFact({ parts, factsUsed, used, label: l.website, value: facts.website, factKey: "Website" });
  }

  if (intents.includes("contact.address")) {
    pushFact({ parts, factsUsed, used, label: l.address, value: facts.address, factKey: "Address" });
  }

  if (intents.includes("identity.name")) {
    pushFact({ parts, factsUsed, used, label: l.name, value: facts.displayName, factKey: "Business name" });
  }

  if (intents.includes("business.products")) {
    if (facts.products?.length) {
      const list = joinHumanList(facts.products, language);
      parts.push(`${l.products}: ${list}.`);
      factsUsed.push(`Products: ${list}`);
    } else {
      parts.push(l.unavailable);
      factsUsed.push("Products: not approved");
    }
  }

  if (intents.includes("business.pricing")) {
    if (facts.pricing) {
      parts.push(`${l.pricing}: ${facts.pricing}.`);
      factsUsed.push(`Pricing: ${facts.pricing}`);
    } else {
      parts.push(l.unavailable);
      factsUsed.push("Pricing: not approved");
    }
  }

  if (intents.includes("business.booking")) {
    if (facts.booking) {
      parts.push(`${l.booking}: ${facts.booking}.`);
      factsUsed.push(`Booking: ${facts.booking}`);
    } else {
      parts.push(l.unavailable);
      factsUsed.push("Booking: not approved");
    }
  }

  if (intents.includes("business.social")) {
    if (facts.socialLinks?.length) {
      const list = joinHumanList(facts.socialLinks, language);
      parts.push(`${l.social}: ${list}.`);
      factsUsed.push(`Social links: ${list}`);
    } else {
      parts.push(l.unavailable);
      factsUsed.push("Social links: not approved");
    }
  }

  if (intents.includes("business.language")) {
    if (facts.languages?.length) {
      const list = joinHumanList(facts.languages, language);
      parts.push(`${l.languages}: ${list}.`);
      factsUsed.push(`Languages: ${list}`);
    } else {
      parts.push(l.unavailable);
      factsUsed.push("Languages: not approved");
    }
  }

  if (intents.includes("behavior.policy")) {
    const behaviorParts = [
      facts.behavior?.tone ? `tone: ${facts.behavior.tone}` : "",
      facts.behavior?.primaryCta ? `CTA: ${facts.behavior.primaryCta}` : "",
      facts.behavior?.handoffPolicy ? `handoff: ${facts.behavior.handoffPolicy}` : "",
    ].filter(Boolean);

    if (behaviorParts.length) {
      const text = joinHumanList(behaviorParts, language);
      parts.push(`${l.behavior}: ${text}.`);
      factsUsed.push(`Behavior: ${text}`);
    } else {
      parts.push(l.unavailable);
      factsUsed.push("Behavior: not approved");
    }
  }

  const replyText = uniqStrings(parts)
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\.\./g, ".")
    .trim();

  if (!replyText && classification.shouldHandle) {
    return {
      replyText: l.unavailable,
      factsUsed: ["approved_truth: unavailable"],
    };
  }

  return {
    replyText,
    factsUsed,
  };
}