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

export function compactText(value = "", max = 900) {
  const text = s(value).replace(/\s+/g, " ");
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

export function sentence(value = "") {
  const text = compactText(value);
  if (!text) return "";
  return /[.!?…]$/u.test(text) ? text : `${text}.`;
}

export function normalizeIsoLanguage(value = "", fallback = "az") {
  const x = lower(value).slice(0, 8);

  if (x.startsWith("az")) return "az";
  if (x.startsWith("en")) return "en";
  if (x.startsWith("es")) return "es";
  if (x.startsWith("tr")) return "tr";
  if (x.startsWith("ru")) return "ru";
  if (x.startsWith("de")) return "de";
  if (x.startsWith("fr")) return "fr";
  if (x.startsWith("it")) return "it";
  if (x.startsWith("pt")) return "pt";
  if (x.startsWith("ar")) return "ar";

  return s(fallback) || "az";
}

export function joinHumanList(items = [], language = "az") {
  const list = uniqStrings(items).filter(Boolean).slice(0, 8);
  if (!list.length) return "";
  if (list.length === 1) return list[0];

  const connector =
    language === "az" || language === "tr" ? "və" :
    language === "es" ? "y" :
    language === "ru" ? "и" :
    "and";

  return `${list.slice(0, -1).join(", ")} ${connector} ${list.at(-1)}`;
}