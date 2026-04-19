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
    az: `Salam, ${brandName}-dan yazırıq.`,
    en: `Hello, this is ${brandName}.`,
    tr: `Merhaba, ${brandName} olarak yazıyoruz.`,
    ru: `Здравствуйте, это ${brandName}.`,
  };

  const neutralMap = {
    az: "Salam.",
    en: "Hello.",
    tr: "Merhaba.",
    ru: "Здравствуйте.",
  };

  const warmMap = {
    az: "Salam, xoş gördük.",
    en: "Hello, welcome.",
    tr: "Merhaba, hoş geldiniz.",
    ru: "Здравствуйте, рады вас приветствовать.",
  };

  const formalMap = {
    az: "Salam, xoş gördük.",
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
    return brandedMap[lang] || brandedMap.az;
  }

  return neutralMap[lang] || neutralMap.az;
}