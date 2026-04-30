import { firstText, joinHumanList, sentence, s } from "./normalize.js";

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
  },
};

function labels(language = "az") {
  return LABELS[language] || LABELS.en;
}

function pushFact({ parts, factsUsed, label, value, factKey }) {
  const safe = s(value);
  if (!safe) return;

  parts.push(`${label}: ${safe}.`);
  factsUsed.push(`${factKey}: ${safe}`);
}

export function composeApprovedTruthAnswer({
  classification = {},
  facts = {},
} = {}) {
  const language = s(classification.language || "az") || "az";
  const intent = s(classification.intent);
  const l = labels(language);
  const parts = [];
  const factsUsed = [];

  if (intent === "contact.general") {
    pushFact({ parts, factsUsed, label: l.phone, value: facts.phone, factKey: "Primary phone" });
    pushFact({ parts, factsUsed, label: l.email, value: facts.email, factKey: "Primary email" });
    pushFact({ parts, factsUsed, label: l.website, value: facts.website, factKey: "Website" });
    pushFact({ parts, factsUsed, label: l.address, value: facts.address, factKey: "Address" });
  }

  if (intent === "contact.phone") {
    pushFact({ parts, factsUsed, label: l.phone, value: facts.phone, factKey: "Primary phone" });
  }

  if (intent === "contact.email") {
    pushFact({ parts, factsUsed, label: l.email, value: facts.email, factKey: "Primary email" });
  }

  if (intent === "contact.website") {
    pushFact({ parts, factsUsed, label: l.website, value: facts.website, factKey: "Website" });
  }

  if (intent === "contact.address") {
    pushFact({ parts, factsUsed, label: l.address, value: facts.address, factKey: "Address" });
  }

  if (intent === "identity.name") {
    pushFact({ parts, factsUsed, label: l.name, value: facts.displayName, factKey: "Business name" });
  }

  if (intent === "business.summary") {
    const value = firstText(facts.summary, facts.industry, facts.displayName);
    if (value) {
      parts.push(sentence(value));
      factsUsed.push(`Business summary: ${value}`);
    }
  }

  if (intent === "business.services") {
    if (facts.summary) {
      parts.push(sentence(facts.summary));
      factsUsed.push(`Business summary: ${facts.summary}`);
    } else if (facts.services?.length) {
      const list = joinHumanList(facts.services, language);
      parts.push(`${l.services}: ${list}.`);
      factsUsed.push(`Services: ${list}`);
    }
  }

  if (intent === "business.products" && facts.products?.length) {
    const list = joinHumanList(facts.products, language);
    parts.push(`${l.products}: ${list}.`);
    factsUsed.push(`Products: ${list}`);
  }

  if (intent === "business.pricing" && facts.pricing) {
    parts.push(`${l.pricing}: ${facts.pricing}.`);
    factsUsed.push(`Pricing: ${facts.pricing}`);
  }

  if (intent === "business.booking" && facts.booking) {
    parts.push(`${l.booking}: ${facts.booking}.`);
    factsUsed.push(`Booking: ${facts.booking}`);
  }

  if (intent === "business.social" && facts.socialLinks?.length) {
    const list = joinHumanList(facts.socialLinks, language);
    parts.push(`${l.social}: ${list}.`);
    factsUsed.push(`Social links: ${list}`);
  }

  if (intent === "business.language" && facts.languages?.length) {
    const list = joinHumanList(facts.languages, language);
    parts.push(`${l.languages}: ${list}.`);
    factsUsed.push(`Languages: ${list}`);
  }

  if (intent === "behavior.policy") {
    const behaviorParts = [
      facts.behavior?.tone ? `tone: ${facts.behavior.tone}` : "",
      facts.behavior?.primaryCta ? `CTA: ${facts.behavior.primaryCta}` : "",
      facts.behavior?.handoffPolicy ? `handoff: ${facts.behavior.handoffPolicy}` : "",
    ].filter(Boolean);

    if (behaviorParts.length) {
      const text = joinHumanList(behaviorParts, language);
      parts.push(`${l.behavior}: ${text}.`);
      factsUsed.push(`Behavior: ${text}`);
    }
  }

  const replyText = parts.join(" ").replace(/\s+/g, " ").trim();

  if (!replyText && classification.shouldHandle) {
    return {
      replyText: l.unavailable,
      factsUsed: [`${intent}: not approved`],
    };
  }

  return {
    replyText,
    factsUsed,
  };
}