export function s(value = "", fallback = "") {
  const next = String(value ?? fallback).trim();
  return next || fallback;
}

export function lower(value = "") {
  return s(value).toLowerCase();
}

export function arr(value) {
  return Array.isArray(value) ? value : [];
}

export function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

export function uniqStrings(values = []) {
  const seen = new Set();
  const out = [];

  for (const item of arr(values)) {
    const value = s(item);
    if (!value) continue;

    const key = lower(value);
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(value);
  }

  return out;
}

export function firstText(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const nested = firstText(...value);
      if (nested) return nested;
      continue;
    }

    const text = s(value);
    if (text) return text;
  }

  return "";
}

const LANGUAGE_ALIASES = {
  azerbaijani: "az",
  azeri: "az",
  azərbaycan: "az",
  azərbaycanlı: "az",

  english: "en",
  ingilis: "en",

  turkish: "tr",
  türkçe: "tr",
  turkce: "tr",
  turkish_language: "tr",

  russian: "ru",
  русский: "ru",
  rus: "ru",

  spanish: "es",
  español: "es",
  espanol: "es",

  german: "de",
  deutsch: "de",
  alman: "de",

  french: "fr",
  français: "fr",
  francais: "fr",

  italian: "it",
  italiano: "it",

  portuguese: "pt",
  português: "pt",
  portugues: "pt",

  arabic: "ar",
  العربية: "ar",

  persian: "fa",
  farsi: "fa",
  فارسی: "fa",

  chinese: "zh",
  mandarin: "zh",
  中文: "zh",

  japanese: "ja",
  日本語: "ja",

  korean: "ko",
  한국어: "ko",

  hindi: "hi",
  हिन्दी: "hi",

  urdu: "ur",
  اردو: "ur",

  hebrew: "he",
  עברית: "he",

  polish: "pl",
  polski: "pl",

  ukrainian: "uk",
  українська: "uk",

  dutch: "nl",
  nederlands: "nl",
};

export function normalizeIsoLanguage(value = "", fallback = "az") {
  const raw = lower(value).replace(/_/g, "-").trim();
  const fb = lower(fallback) || "az";

  if (!raw) return fb;

  if (LANGUAGE_ALIASES[raw]) return LANGUAGE_ALIASES[raw];

  const collapsed = raw.replace(/\s+/g, "_");
  if (LANGUAGE_ALIASES[collapsed]) return LANGUAGE_ALIASES[collapsed];

  const codeMatch = raw.match(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?/i);
  if (codeMatch) {
    return codeMatch[0].split("-")[0].toLowerCase();
  }

  return fb;
}

export function sentence(value = "") {
  const text = s(value).replace(/\s+/g, " ");
  if (!text) return "";
  return /[.!?…؟]$/u.test(text) ? text : `${text}.`;
}

export function joinHumanList(items = [], language = "az") {
  const list = uniqStrings(items).filter(Boolean).slice(0, 8);
  if (!list.length) return "";
  if (list.length === 1) return list[0];

  const lang = normalizeIsoLanguage(language, "en");

  const connector =
    lang === "az" || lang === "tr"
      ? "və"
      : lang === "es"
        ? "y"
        : lang === "ru"
          ? "и"
          : lang === "fr"
            ? "et"
            : lang === "de"
              ? "und"
              : lang === "it"
                ? "e"
                : lang === "pt"
                  ? "e"
                  : "and";

  return `${list.slice(0, -1).join(", ")} ${connector} ${list[list.length - 1]}`;
}
