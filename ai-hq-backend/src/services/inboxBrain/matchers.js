import { arr, includesAny, lower, s, uniqStrings } from "./shared.js";
import {
  buildServiceLine,
  getIndustryHints,
  normalizeKnowledgeEntry,
  normalizePlaybook,
} from "./runtime.js";

export function buildServiceMatchKeywords(profile) {
  const out = [];
  const catalog = arr(profile?.serviceCatalog);

  for (const service of catalog) {
    if (!service?.active || !service?.visibleInAi) continue;
    if (service.name) out.push(service.name);
    for (const alias of arr(service.aliases)) out.push(alias);
  }

  return uniqStrings(out);
}

export function buildDisabledServiceMatchKeywords(profile) {
  const out = [];
  const catalog = arr(profile?.serviceCatalog);

  for (const service of catalog) {
    if (service?.active || !service?.visibleInAi) continue;
    if (service.name) out.push(service.name);
    for (const alias of arr(service.aliases)) out.push(alias);
  }

  return uniqStrings(out);
}

export function matchKnowledgeEntries(text, knowledgeEntries = [], limit = 5) {
  const incoming = lower(text);
  if (!incoming) return [];

  const normalized = arr(knowledgeEntries)
    .map(normalizeKnowledgeEntry)
    .filter((x) => x.active && (x.title || x.answer));

  const scored = [];

  for (const item of normalized) {
    let score = 0;

    if (item.title && incoming.includes(lower(item.title))) score += 3;
    if (item.question && incoming.includes(lower(item.question))) score += 3;

    for (const keyword of item.keywords) {
      if (incoming.includes(lower(keyword))) score += 2;
    }

    if (score > 0) {
      scored.push({ ...item, _score: score });
    }
  }

  return scored
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return Number(a.priority || 100) - Number(b.priority || 100);
    })
    .slice(0, limit);
}

export function matchPlaybook(text, responsePlaybooks = []) {
  const incoming = lower(text);
  if (!incoming) return null;

  const list = arr(responsePlaybooks)
    .map(normalizePlaybook)
    .filter((x) => x.active && x.triggerKeywords.length);

  let best = null;

  for (const item of list) {
    let score = 0;
    for (const kw of item.triggerKeywords) {
      if (incoming.includes(lower(kw))) score += 1;
    }
    if (!score) continue;

    if (
      !best ||
      score > best.score ||
      (score === best.score && Number(item.priority || 100) < Number(best.item.priority || 100))
    ) {
      best = { item, score };
    }
  }

  return best?.item || null;
}

export function classifyTenantAwareIntent(text, profile, policy) {
  const incoming = lower(text);
  const servicesLine = lower(buildServiceLine(profile));
  const serviceKeywords = buildServiceMatchKeywords(profile);
  const disabledServiceKeywords = buildDisabledServiceMatchKeywords(profile);
  const industryHints = getIndustryHints(profile?.industry);

  if (includesAny(incoming, policy?.humanKeywords || [])) {
    return { intent: "handoff_request", score: 92 };
  }

  if (includesAny(incoming, profile?.humanKeywords || [])) {
    return { intent: "handoff_request", score: 92 };
  }

  if (includesAny(incoming, profile?.urgentKeywords || [])) {
    return { intent: "urgent_interest", score: 94 };
  }

  if (includesAny(incoming, profile?.pricingKeywords || [])) {
    return { intent: "pricing", score: 84 };
  }

  if (includesAny(incoming, disabledServiceKeywords)) {
    return { intent: "unsupported_service", score: 52 };
  }

  if (
    includesAny(incoming, [
      "salam",
      "sabahınız",
      "sabahiniz",
      "hello",
      "hi",
      "good morning",
      "good evening",
      "selam",
      "salamlar",
    ])
  ) {
    return { intent: "greeting", score: 18 };
  }

  if (includesAny(incoming, profile?.supportKeywords || [])) {
    return { intent: "support", score: 58 };
  }

  if (servicesLine && includesAny(incoming, serviceKeywords)) {
    return { intent: "service_interest", score: 76 };
  }

  if (
    servicesLine &&
    includesAny(
      incoming,
      servicesLine
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    )
  ) {
    return { intent: "service_interest", score: 74 };
  }

  if (includesAny(incoming, industryHints.keywords || [])) {
    return { intent: "service_interest", score: 70 };
  }

  if (
    includesAny(incoming, [
      "istəyirəm",
      "isteyirem",
      "lazımdır",
      "lazimdir",
      "lazımdı",
      "proposal",
      "brief",
      "təklif",
      "teklif",
      "maraqlanıram",
      "maraqlaniram",
      "need",
      "want",
      "interested",
      "məlumat",
      "melumat",
      "əlaqə",
      "elaqe",
      "nömrə",
      "nomre",
      "xidmət",
      "xidmet",
      "məhsul",
      "mehsul",
    ])
  ) {
    return { intent: "service_interest", score: 66 };
  }

  return { intent: "general", score: 28 };
}

export function forceSafeIntent(intent, profile, text) {
  const incoming = lower(text);
  const safeIntent = s(intent || "general") || "general";

  if (
    [
      "greeting",
      "pricing",
      "service_interest",
      "support",
      "general",
      "unsupported_service",
      "handoff_request",
      "urgent_interest",
      "knowledge_answer",
      "playbook",
    ].includes(safeIntent)
  ) {
    return safeIntent;
  }

  if (includesAny(incoming, profile?.pricingKeywords || [])) return "pricing";
  if (includesAny(incoming, profile?.supportKeywords || [])) return "support";
  if (includesAny(incoming, profile?.humanKeywords || [])) return "handoff_request";

  return "general";
}

export function shouldAllowHandoffByText(text, profile) {
  const incoming = lower(text);

  if (includesAny(incoming, profile?.humanKeywords || [])) return true;
  if (includesAny(incoming, profile?.urgentKeywords || [])) return true;

  return false;
}