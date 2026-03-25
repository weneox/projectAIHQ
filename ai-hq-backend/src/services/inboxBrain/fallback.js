import { arr, sanitizeReplyText } from "./shared.js";
import {
  buildServiceLine,
  getIndustryHints,
  pickLeadPrompt,
} from "./runtime.js";

export function buildUnsupportedServiceReply(profile) {
  const catalog = arr(profile?.serviceCatalog);
  const disabledSpecific = catalog.find((x) => !x.active && x.visibleInAi && x.disabledReplyText);
  if (disabledSpecific?.disabledReplyText) {
    return sanitizeReplyText(disabledSpecific.disabledReplyText);
  }

  const active = buildServiceLine(profile);
  if (active) {
    return `Hazırda əsasən ${active} üzrə kömək edə bilirik. İstəyinizə uyğun hissəni qısa yazın.`;
  }

  return "Hazırda bu mövzu üzrə dəqiq xidmət təqdim etmirik. Mövcud ehtiyacınızı qısa yazın, uyğun olub-olmadığını dəqiqləşdirək.";
}

export function buildKnowledgeReply(matches = [], profile) {
  const first = matches[0];
  if (!first?.answer) return "";

  const answer = sanitizeReplyText(first.answer);
  if (!answer) return "";

  const maxSentences = Math.max(1, Math.min(4, Number(profile?.maxSentences || 2)));
  const parts = answer
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, maxSentences);

  return sanitizeReplyText(parts.join(" "));
}

export function buildPlaybookReply(playbook, fallbackProfile) {
  const reply = sanitizeReplyText(playbook?.replyTemplate || "");
  if (reply) return reply;
  return sanitizeReplyText(buildFallbackReply({ intent: "general", profile: fallbackProfile }));
}

export function buildFallbackReply({ intent, profile, knowledgeEntries = [], playbook = null }) {
  const leadPrompt = pickLeadPrompt(profile);
  const serviceLine = buildServiceLine(profile);
  const industryHints = getIndustryHints(profile?.industry);

  if (playbook) {
    return buildPlaybookReply(playbook, profile);
  }

  if (intent === "knowledge_answer") {
    const answer = buildKnowledgeReply(knowledgeEntries, profile);
    if (answer) return answer;
  }

  if (intent === "unsupported_service") {
    return buildUnsupportedServiceReply(profile);
  }

  if (intent === "greeting") {
    if (serviceLine) {
      return `Salam. ${serviceLine} üzrə kömək edə bilərik. ${leadPrompt}`;
    }
    return `Salam. Sizə məmnuniyyətlə kömək edə bilərik. ${leadPrompt}`;
  }

  if (intent === "pricing") {
    return `${industryHints.pricingHint} ${leadPrompt}`;
  }

  if (intent === "service_interest") {
    return `Bəli, məlumat verə bilərik. ${leadPrompt}`;
  }

  if (intent === "support") {
    return "Məmnuniyyətlə kömək edək. Problemi və ya ehtiyacınızı qısa şəkildə yazın.";
  }

  if (intent === "handoff_request") {
    return "Əlbəttə. İstəsəniz sizi komanda üzvünə yönləndirə bilərik. Qısa olaraq ehtiyacınızı yazın.";
  }

  if (intent === "urgent_interest") {
    return "Qeyd etdik. Müraciətinizi düzgün yönləndirmək üçün ehtiyacınızı qısa şəkildə yazın.";
  }

  return `Sizə kömək etməyə hazırıq. ${leadPrompt}`;
}