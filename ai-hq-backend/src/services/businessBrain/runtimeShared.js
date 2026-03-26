function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function arr(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
}

function obj(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

function boolOrUndefined(v) {
  return typeof v === "boolean" ? v : undefined;
}

function hasDb(db) {
  return Boolean(db && typeof db.query === "function");
}

function uniqStrings(list = []) {
  const out = [];
  const seen = new Set();

  for (const item of arr(list)) {
    const x = s(item);
    if (!x) continue;
    const k = lower(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }

  return out;
}

function compactText(v = "", max = 1200) {
  const x = s(v).replace(/\s+/g, " ").trim();
  if (!x) return "";
  if (x.length <= max) return x;
  return `${x.slice(0, max - 1).trim()}...`;
}

function lowerSlug(v = "") {
  return s(v)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function splitTextList(v = "") {
  const x = s(v);
  if (!x) return [];
  return uniqStrings(
    x
      .split(/[,\n|/]+/)
      .map((item) => s(item))
      .filter(Boolean)
  );
}

function flattenStringList(...values) {
  const out = [];

  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          out.push(item);
        } else if (item && typeof item === "object") {
          out.push(
            s(
              item.title ||
                item.name ||
                item.label ||
                item.value ||
                item.valueText ||
                item.service_name ||
                item.service_key ||
                item.serviceKey ||
                item.item_key ||
                item.itemKey ||
                item.key ||
                item.language ||
                item.code
            )
          );
        }
      }
      continue;
    }

    if (typeof value === "string") {
      out.push(...splitTextList(value));
    }
  }

  return uniqStrings(out);
}

async function safeQuery(fn, fallback) {
  try {
    const result = await fn();
    return result ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeIndustry(v) {
  const x = lower(v);
  if (!x) return "generic_business";

  const aliases = {
    clinic: "clinic",
    dental: "clinic",
    dentist: "clinic",
    hospital: "clinic",
    health: "clinic",
    healthcare: "clinic",
    hotel: "hospitality",
    hospitality: "hospitality",
    travel: "hospitality",
    restaurant: "restaurant",
    cafe: "restaurant",
    coffee: "restaurant",
    food: "restaurant",
    retail: "retail",
    store: "retail",
    shop: "retail",
    ecommerce: "ecommerce",
    "e-commerce": "ecommerce",
    legal: "legal",
    law: "legal",
    finance: "finance",
    fintech: "finance",
    insurance: "finance",
    education: "education",
    school: "education",
    academy: "education",
    course: "education",
    technology: "technology",
    tech: "technology",
    saas: "technology",
    software: "technology",
    ai: "technology",
    automotive: "automotive",
    auto: "automotive",
    car: "automotive",
    logistics: "logistics",
    transport: "logistics",
    cargo: "logistics",
    real_estate: "real_estate",
    realestate: "real_estate",
    property: "real_estate",
    beauty: "beauty",
    salon: "beauty",
    spa: "beauty",
    cosmetics: "beauty",
    creative_agency: "creative_agency",
    agency: "creative_agency",
    marketing: "creative_agency",
    branding: "creative_agency",
    generic: "generic_business",
    generic_business: "generic_business",
  };

  return aliases[x] || x || "generic_business";
}

function normalizeLanguage(v, fallback = "az") {
  const x = lower(v);
  if (!x) return fallback;
  if (["az", "aze", "azerbaijani"].includes(x)) return "az";
  if (["en", "eng", "english"].includes(x)) return "en";
  if (["ru", "rus", "russian"].includes(x)) return "ru";
  if (["tr", "tur", "turkish"].includes(x)) return "tr";
  return fallback;
}

function normalizeLanguageList(...values) {
  const out = [];
  const seen = new Set();

  for (const item of flattenStringList(...values)) {
    const code = normalizeLanguage(item, "");
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }

  if (!out.length) return ["az"];
  return out;
}

function getDefaultLeadPrompt(language = "az") {
  const lang = normalizeLanguage(language, "az");

  if (lang === "en") {
    return "Briefly tell us which service or product you need.";
  }

  if (lang === "ru") {
    return "Коротко напишите, какая услуга или продукт вам нужны.";
  }

  if (lang === "tr") {
    return "Kisaca hangi hizmete veya urune ihtiyaciniz oldugunu yazin.";
  }

  return "Qisa olaraq size hansi xidmet ve ya mehsul lazim oldugunu yazin.";
}

function parseDateMs(v) {
  const ms = Date.parse(s(v));
  return Number.isFinite(ms) ? ms : 0;
}

function sortRowsByPriority(list = []) {
  return [...arr(list)].sort((a, b) => {
    const ap = Number(a?.priority ?? 100);
    const bp = Number(b?.priority ?? 100);
    if (ap !== bp) return ap - bp;

    const aso = Number(a?.sort_order ?? a?.sortOrder ?? 0);
    const bso = Number(b?.sort_order ?? b?.sortOrder ?? 0);
    if (aso !== bso) return aso - bso;

    return parseDateMs(a?.created_at) - parseDateMs(b?.created_at);
  });
}

function isHydratedTenant(input) {
  const tenant = obj(input);
  return Boolean(
    Object.keys(obj(tenant.profile)).length ||
      Object.keys(obj(tenant.brand)).length ||
      Object.keys(obj(tenant.ai_policy || tenant.aiPolicy)).length ||
      Object.keys(obj(tenant.inbox_policy || tenant.inboxPolicy)).length ||
      Object.keys(obj(tenant.comment_policy || tenant.commentPolicy)).length
  );
}

export {
  arr,
  boolOrUndefined,
  compactText,
  flattenStringList,
  getDefaultLeadPrompt,
  hasDb,
  isHydratedTenant,
  lower,
  lowerSlug,
  normalizeIndustry,
  normalizeLanguage,
  normalizeLanguageList,
  obj,
  parseDateMs,
  s,
  safeQuery,
  sortRowsByPriority,
  splitTextList,
  uniqStrings,
};
