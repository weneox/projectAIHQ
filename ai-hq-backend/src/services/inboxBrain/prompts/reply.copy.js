function normalizeLanguage(value = "") {
  const x = String(value || "").trim().toLowerCase();
  if (!x) return "az";
  if (x.startsWith("az")) return "az";
  if (x.startsWith("en")) return "en";
  if (x.startsWith("tr")) return "tr";
  if (x.startsWith("ru")) return "ru";
  return "az";
}

export function interpolateBrand(template = "", brandName = "") {
  return String(template || "").replace(/\{brand\}/gi, String(brandName || "").trim());
}

export function getLocalizedGreeting({ language = "az", mode = "neutral", brandName = "" }) {
  const lang = normalizeLanguage(language);
  const safeMode = String(mode || "neutral").trim().toLowerCase();

  const brandedMap = {
    az: `Salam. ${brandName} komandası ilə əlaqədəsiniz.`,
    en: `Hello. You’re connected with the ${brandName} team.`,
    tr: `Merhaba. ${brandName} ekibiyle bağlantıdasınız.`,
    ru: `Здравствуйте. Вы на связи с командой ${brandName}.`,
  };

  const neutralMap = {
    az: "Salam.",
    en: "Hello.",
    tr: "Merhaba.",
    ru: "Здравствуйте.",
  };

  const warmMap = {
    az: "Salam, buyurun.",
    en: "Hello, welcome.",
    tr: "Merhaba, buyurun.",
    ru: "Здравствуйте, пожалуйста.",
  };

  const formalMap = {
    az: "Salam.",
    en: "Hello.",
    tr: "Merhaba.",
    ru: "Здравствуйте.",
  };

  if (safeMode === "none") return "";

  if (safeMode === "branded" && brandName) {
    return brandedMap[lang] || brandedMap.az;
  }

  if (safeMode === "warm") {
    return warmMap[lang] || warmMap.az;
  }

  if (safeMode === "formal") {
    return formalMap[lang] || formalMap.az;
  }

  if (safeMode === "neutral") {
    return neutralMap[lang] || neutralMap.az;
  }

  if (safeMode === "auto" && brandName) {
    return neutralMap[lang] || neutralMap.az;
  }

  return neutralMap[lang] || neutralMap.az;
}

export function getLocalizedGreetingFollowup(language = "az") {
  const lang = normalizeLanguage(language);

  const map = {
    az: "Buyurun.",
    en: "How can I help?",
    tr: "Buyurun.",
    ru: "Чем могу помочь?",
  };

  return map[lang] || map.az;
}