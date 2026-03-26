import { arr, lower, obj, s, uniqStrings } from "./runtimeShared.js";

function firstFact(facts = [], categories = [], itemKeys = []) {
  const cats = new Set(arr(categories).map((x) => lower(x)));
  const keys = new Set(arr(itemKeys).map((x) => lower(x)));
  for (const item of arr(facts)) {
    const cat = lower(item.category || item.entry_type || item.fact_group || item.factGroup);
    const key = lower(
      item.fact_key ||
        item.factKey ||
        item.item_key ||
        item.itemKey ||
        item.intent_key ||
        item.intentKey ||
        ""
    );
    if (cats.size && !cats.has(cat)) continue;
    if (keys.size && !keys.has(key)) continue;
    const value =
      s(item.value_text || item.valueText) ||
      s(item.answer) ||
      s(item.content) ||
      s(item.text) ||
      s(item.title);
    if (value) return value;
  }
  return "";
}

function listFactsByCategory(facts = [], categories = []) {
  const cats = new Set(arr(categories).map((x) => lower(x)));
  return uniqStrings(
    arr(facts)
      .filter(
        (item) =>
          !cats.size ||
          cats.has(lower(item.category || item.entry_type || item.fact_group || item.factGroup))
      )
      .map(
        (item) =>
          s(item.value_text || item.valueText) ||
          s(item.answer) ||
          s(item.content) ||
          s(item.text) ||
          s(item.title)
      )
      .filter(Boolean)
  );
}

function pickPrimaryContact(contacts = [], channels = []) {
  const wanted = arr(channels).map((x) => lower(x));
  const exactPrimary = arr(contacts).find(
    (x) => Boolean(x.is_primary || x.isPrimary) && wanted.includes(lower(x.channel))
  );
  if (exactPrimary?.value) return s(exactPrimary.value);
  const first = arr(contacts).find((x) => wanted.includes(lower(x.channel)));
  return s(first?.value);
}

function normalizeProjectionFacts(facts = []) {
  return arr(facts).map((item) => ({
    ...obj(item),
    category: s(item.category || item.fact_group || item.factGroup),
    entry_type: s(item.entry_type || item.fact_group || item.factGroup),
    fact_key: s(item.fact_key || item.factKey),
    value_text: s(item.value_text || item.valueText),
  }));
}

function normalizeProjectionChannelsPolicies(policies = []) {
  return arr(policies).map((item) => ({
    ...obj(item),
    channel: s(item.channel),
    subchannel: s(item.subchannel || "default"),
    ai_reply_enabled:
      typeof item.ai_reply_enabled === "boolean"
        ? item.ai_reply_enabled
        : typeof item.aiReplyEnabled === "boolean"
          ? item.aiReplyEnabled
          : undefined,
    human_handoff_enabled:
      typeof item.human_handoff_enabled === "boolean"
        ? item.human_handoff_enabled
        : typeof item.humanHandoffEnabled === "boolean"
          ? item.humanHandoffEnabled
          : undefined,
    pricing_visibility: s(item.pricing_visibility || item.pricingVisibility),
    public_reply_mode: s(item.public_reply_mode || item.publicReplyMode),
    contact_capture_mode: s(item.contact_capture_mode || item.contactCaptureMode),
    escalation_mode: s(item.escalation_mode || item.escalationMode),
    reply_style: s(item.reply_style || item.replyStyle),
    max_reply_sentences: Number(item.max_reply_sentences ?? item.maxReplySentences ?? 2),
  }));
}

export {
  firstFact,
  listFactsByCategory,
  normalizeProjectionChannelsPolicies,
  normalizeProjectionFacts,
  pickPrimaryContact,
};
