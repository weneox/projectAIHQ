import {
  fixMojibake,
  normalizeTextForCompare,
  obj,
  pickString,
  pickStringDeep,
  s,
  toMs,
} from "./shared.js";

function safeMessageTimestamp(message = {}) {
  return toMs(message?.sent_at || message?.created_at);
}

function normalizeDirection(value = "") {
  const x = s(value).trim().toLowerCase();
  if (x === "incoming") return "inbound";
  if (x === "outgoing") return "outbound";
  return x;
}

function normalizeSenderType(value = "") {
  const x = s(value).trim().toLowerCase();
  if (x === "assistant") return "ai";
  if (x === "human") return "operator";
  return x;
}

function normalizeMessageActor(message = {}) {
  if (message.direction === "inbound") return "customer";
  if (message.sender_type === "agent" || message.sender_type === "operator") {
    return "operator";
  }
  return "ai";
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function maybeParseJsonString(value = "") {
  const raw = s(value).trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : null;
  } catch {}

  const fenced =
    raw.match(/```json\s*([\s\S]*?)```/i) ||
    raw.match(/```\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    try {
      const parsed = JSON.parse(fenced[1].trim());
      return isPlainObject(parsed) ? parsed : null;
    } catch {}
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
      return isPlainObject(parsed) ? parsed : null;
    } catch {}
  }

  return null;
}

function looksLikeStructuredDecisionObject(value = {}) {
  if (!isPlainObject(value)) return false;

  const keys = Object.keys(value);
  if (!keys.length) return false;

  return [
    "replyText",
    "answerFirst",
    "nextQuestion",
    "understoodIntent",
    "detectedService",
    "customerGoal",
    "missingInformation",
    "shouldAskQuestion",
    "shouldCreateLead",
    "shouldHandoff",
    "handoffReason",
    "confidence",
    "leadScore",
    "askCategory",
    "stage",
    "replyStyle",
    "noReply",
  ].some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function candidateToStructuredObject(candidate) {
  if (!candidate) return null;

  if (looksLikeStructuredDecisionObject(candidate)) {
    return candidate;
  }

  if (typeof candidate === "string") {
    const parsed = maybeParseJsonString(candidate);
    if (looksLikeStructuredDecisionObject(parsed)) {
      return parsed;
    }
  }

  if (isPlainObject(candidate)) {
    for (const key of ["parsed", "json", "value", "data", "output_parsed"]) {
      const nested = candidateToStructuredObject(candidate[key]);
      if (nested) return nested;
    }

    if (typeof candidate.text === "string") {
      const parsed = maybeParseJsonString(candidate.text);
      if (looksLikeStructuredDecisionObject(parsed)) {
        return parsed;
      }
    }

    if (typeof candidate.arguments === "string") {
      const parsed = maybeParseJsonString(candidate.arguments);
      if (looksLikeStructuredDecisionObject(parsed)) {
        return parsed;
      }
    }
  }

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const nested = candidateToStructuredObject(item);
      if (nested) return nested;
    }
  }

  return null;
}

export function extractStructuredPayload(resp) {
  if (!resp) return null;

  const directCandidates = [
    resp?.output_parsed,
    resp?.parsed,
    resp?.response?.output_parsed,
    resp?.response?.parsed,
    resp?.output_text,
    resp?.text,
    resp?.content,
    resp?.output,
  ];

  for (const candidate of directCandidates) {
    const found = candidateToStructuredObject(candidate);
    if (found) return found;
  }

  const output = Array.isArray(resp?.output) ? resp.output : [];
  for (const item of output) {
    const itemHit = candidateToStructuredObject(item);
    if (itemHit) return itemHit;

    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      const blockHit = candidateToStructuredObject(block);
      if (blockHit) return blockHit;
    }
  }

  return null;
}

export function stripLeadingCommand(text = "") {
  const source = s(text).trim();
  if (!source.startsWith("/")) return source;
  return source.replace(/^\/[^\s]+\s*/u, "").trim();
}

export function extractText(resp) {
  if (!resp) return "";

  const structured = extractStructuredPayload(resp);
  if (structured) {
    try {
      return fixMojibake(JSON.stringify(structured));
    } catch {}
  }

  const direct = pickString(resp.output_text).trim();
  if (direct) return fixMojibake(direct);

  const output = resp.output;
  if (Array.isArray(output)) {
    const parts = [];

    for (const item of output) {
      const content = item?.content;

      if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === "output_text") {
            const blockText = pickStringDeep(block?.text);
            if (blockText) parts.push(blockText);
            continue;
          }

          const blockText = pickStringDeep(block?.text);
          if (blockText) parts.push(blockText);

          const transcript = pickStringDeep(block?.transcript);
          if (transcript) parts.push(transcript);

          if (typeof block?.arguments === "string") {
            parts.push(block.arguments);
          }
        }
      } else if (typeof content === "string") {
        parts.push(content);
      }

      const itemText = pickStringDeep(item?.text);
      if (itemText) parts.push(itemText);

      if (typeof item?.arguments === "string") {
        parts.push(item.arguments);
      }
    }

    const joined = parts.join("\n").trim();
    if (joined) return fixMojibake(joined);
  }

  return "";
}

export function parseJsonLoose(text) {
  const raw = s(text).trim();
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

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  return null;
}

export function normalizeRecentMessages(input) {
  if (!Array.isArray(input)) return [];

  return input
    .map((message) => ({
      id: s(message?.id),
      direction: normalizeDirection(message?.direction),
      sender_type: normalizeSenderType(message?.sender_type),
      text: fixMojibake(s(message?.text)),
      sent_at: message?.sent_at || null,
      created_at: message?.created_at || null,
      meta: obj(message?.meta),
    }))
    .filter((message) => message.id || message.text)
    .sort((a, b) => safeMessageTimestamp(a) - safeMessageTimestamp(b));
}

export function getLatestOutbound(messages) {
  const list = normalizeRecentMessages(messages);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const message = list[i];
    if (message.direction === "outbound") return message;
  }
  return null;
}

export function getLatestOperatorOutbound(messages) {
  const list = normalizeRecentMessages(messages);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const message = list[i];
    if (
      message.direction === "outbound" &&
      (message.sender_type === "agent" || message.sender_type === "operator")
    ) {
      return message;
    }
  }
  return null;
}

export function getLastAiOutbound(messages) {
  const list = normalizeRecentMessages(messages);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const message = list[i];
    if (
      message.direction === "outbound" &&
      (message.sender_type === "ai" || message.sender_type === "assistant")
    ) {
      return message;
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
    "okay",
    "oks",
    "thanks",
    "thank you",
    "tesekkur",
    "təşəkkür",
    "sag ol",
    "sağ ol",
    "ela",
    "əla",
    "super",
    "got it",
    "anladim",
    "anladım",
    "oldu",
    "tamam",
  ]);

  return exactAckPhrases.has(incoming);
}

export function buildHistorySnippet(messages = [], limit = 6) {
  const list = normalizeRecentMessages(messages).slice(
    -Math.max(1, Number(limit || 6))
  );

  return list
    .map((message) => {
      const actor = normalizeMessageActor(message);
      return `${actor}: ${s(message.text).slice(0, 320)}`;
    })
    .join("\n");
}