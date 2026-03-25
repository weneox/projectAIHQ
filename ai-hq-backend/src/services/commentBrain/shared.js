export function s(v) {
  return String(v ?? "").trim();
}

export function lower(v) {
  return s(v).toLowerCase();
}

export function arr(v) {
  return Array.isArray(v) ? v : [];
}

export function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

export function uniqStrings(list = []) {
  const out = [];
  const seen = new Set();

  for (const item of arr(list)) {
    const x = s(item);
    if (!x) continue;
    const key = lower(x);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(x);
  }

  return out;
}

export function pickString(x) {
  return typeof x === "string" ? x : "";
}

export function pickStringDeep(x) {
  if (typeof x === "string") return x;
  if (x && typeof x === "object") {
    if (typeof x.value === "string") return x.value;
    if (typeof x.text === "string") return x.text;
  }
  return "";
}

export function pickFirstString(...values) {
  for (const value of values) {
    const x = s(value);
    if (x) return x;
  }
  return "";
}

export function pickFirstBoolean(...values) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

export function fixMojibake(input) {
  const t = String(input || "");
  if (!t) return t;

  if (!/[ÃÂ]|â€™|â€œ|â€�|â€“|â€”|â€¦/.test(t)) return t;

  try {
    const fixed = Buffer.from(t, "latin1").toString("utf8");
    if (/[�]/.test(fixed) && !/[�]/.test(t)) return t;
    return fixed;
  } catch {
    return t;
  }
}

export function extractText(resp) {
  if (!resp) return "";

  const direct = pickString(resp.output_text).trim();
  if (direct) return fixMojibake(direct);

  const out = resp.output;
  if (Array.isArray(out)) {
    const parts = [];

    for (const item of out) {
      const content = item?.content;

      if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === "output_text") {
            const t = pickStringDeep(block?.text);
            if (t) parts.push(t);
            continue;
          }

          const t1 = pickStringDeep(block?.text);
          if (t1) parts.push(t1);

          const t2 = pickStringDeep(block?.transcript);
          if (t2) parts.push(t2);
        }
      } else if (typeof content === "string") {
        parts.push(content);
      }

      const tItem = pickStringDeep(item?.text);
      if (tItem) parts.push(tItem);
    }

    const joined = parts.join("\n").trim();
    if (joined) return fixMojibake(joined);
  }

  return "";
}

export function parseJsonLoose(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {}

  const fenced =
    raw.match(/```json\s*([\s\S]*?)```/i) ||
    raw.match(/```\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {}
  }

  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(raw.slice(first, last + 1));
    } catch {}
  }

  return null;
}

export function cleanReason(v) {
  const raw = lower(v || "ai_classified")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return raw || "ai_classified";
}

export function cleanText(v, max = 500) {
  return fixMojibake(s(v || "")).slice(0, max);
}

export function normalizeCategory(v) {
  const x = lower(v);
  return ["sales", "support", "spam", "toxic", "normal", "unknown"].includes(x)
    ? x
    : "unknown";
}

export function normalizePriority(v) {
  const x = lower(v);
  return ["low", "medium", "high", "urgent"].includes(x) ? x : "low";
}

export function normalizeSentiment(v) {
  const x = lower(v);
  return ["positive", "neutral", "negative", "mixed"].includes(x)
    ? x
    : "neutral";
}

export function normalizeLang(v, fallback = "az") {
  const x = lower(v);
  if (!x) return fallback;
  if (["az", "aze", "azerbaijani"].includes(x)) return "az";
  if (["en", "eng", "english"].includes(x)) return "en";
  if (["ru", "rus", "russian"].includes(x)) return "ru";
  if (["tr", "tur", "turkish"].includes(x)) return "tr";
  return fallback;
}

export function splitCommaText(v) {
  const x = s(v);
  if (!x) return [];
  return uniqStrings(
    x
      .split(/[,\n|/]+/)
      .map((item) => s(item))
      .filter(Boolean)
  );
}

export function flattenStringList(...values) {
  const out = [];

  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") out.push(item);
        else if (item && typeof item === "object") {
          out.push(
            s(
              item.title ||
                item.name ||
                item.label ||
                item.value ||
                item.service ||
                item.key
            )
          );
        }
      }
      continue;
    }

    if (typeof value === "string") {
      out.push(...splitCommaText(value));
    }
  }

  return uniqStrings(out);
}