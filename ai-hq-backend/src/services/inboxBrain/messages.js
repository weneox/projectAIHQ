import {
  fixMojibake,
  normalizeTextForCompare,
  obj,
  pickString,
  pickStringDeep,
  s,
  toMs,
} from "./shared.js";

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

export function normalizeRecentMessages(input) {
  if (!Array.isArray(input)) return [];

  return input
    .map((m) => ({
      id: s(m?.id),
      direction: String(m?.direction || "").trim().toLowerCase(),
      sender_type: String(m?.sender_type || "").trim().toLowerCase(),
      text: fixMojibake(s(m?.text)),
      sent_at: m?.sent_at || null,
      created_at: m?.created_at || null,
      meta: obj(m?.meta),
    }))
    .filter((m) => m.id || m.text)
    .sort((a, b) => toMs(a.sent_at || a.created_at) - toMs(b.sent_at || b.created_at));
}

export function getLatestOutbound(messages) {
  const list = normalizeRecentMessages(messages);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const m = list[i];
    if (m.direction === "outbound") return m;
  }
  return null;
}

export function getLatestOperatorOutbound(messages) {
  const list = normalizeRecentMessages(messages);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const m = list[i];
    if (m.direction === "outbound" && (m.sender_type === "agent" || m.sender_type === "operator")) {
      return m;
    }
  }
  return null;
}

export function getLastAiOutbound(messages) {
  const list = normalizeRecentMessages(messages);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const m = list[i];
    if (m.direction === "outbound" && (m.sender_type === "ai" || m.sender_type === "assistant")) {
      return m;
    }
  }
  return null;
}

export function isAckOnlyText(text) {
  const incoming = normalizeTextForCompare(text);
  if (!incoming) return false;

  const exactAckPhrases = new Set([
    "👍",
    "👌",
    "ok",
    "oks",
    "okay",
    "thanks",
    "thank you",
    "tesekkur",
    "təşəkkür",
    "sag ol",
    "sağ ol",
    "super",
    "ela",
    "əla",
    "got it",
    "anladim",
    "anladım",
    "oldu",
    "tamam",
  ]);

  return exactAckPhrases.has(incoming);
}

export function buildHistorySnippet(messages = [], limit = 6) {
  const list = normalizeRecentMessages(messages).slice(-limit);

  return list
    .map((m) => {
      const who =
        m.direction === "inbound"
          ? "customer"
          : m.sender_type === "agent" || m.sender_type === "operator"
            ? "operator"
            : "ai";
      return `${who}: ${s(m.text).slice(0, 320)}`;
    })
    .join("\n");
}