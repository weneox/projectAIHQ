import { arr, s, sanitizeReplyText } from "./shared.js";
import {
  buildServiceLine,
  pickBehaviorLeadPrompt,
} from "./runtime.js";

function splitSentences(text = "") {
  return s(text)
    .split(/(?<=[.!?])\s+/)
    .map((part) => sanitizeReplyText(part))
    .filter(Boolean);
}

function clipSentences(text = "", maxSentences = 2) {
  const safeMax = Math.max(1, Math.min(4, Number(maxSentences || 2)));
  return sanitizeReplyText(splitSentences(text).slice(0, safeMax).join(" "));
}

function getVisibleCatalog(profile = {}) {
  return arr(profile?.serviceCatalog).filter((item) => item?.visibleInAi);
}

function getActiveVisibleCatalog(profile = {}) {
  return getVisibleCatalog(profile).filter((item) => item?.active);
}

function getDisabledVisibleCatalog(profile = {}) {
  return getVisibleCatalog(profile).filter((item) => !item?.active);
}

function buildBrandLead(profile = {}) {
  return s(profile?.displayName || "Biz");
}

function buildOfferLead(profile = {}) {
  const brand = buildBrandLead(profile);
  const serviceLine = buildServiceLine(profile);
  const summary = clipSentences(profile?.businessSummary || "", 1);

  if (serviceLine) {
    return sanitizeReplyText(`${brand} olaraq əsasən ${serviceLine} üzrə kömək edirik.`);
  }

  if (summary) {
    return sanitizeReplyText(summary);
  }

  return sanitizeReplyText(`${brand} olaraq kömək edə bilərik.`);
}

function buildSingleQuestion(profile = {}, fallback = "") {
  const configured = arr(profile?.qualificationQuestions)
    .map((item) => sanitizeReplyText(item))
    .filter(Boolean);

  if (configured.length) return configured[0];

  const prompt = sanitizeReplyText(pickBehaviorLeadPrompt(profile));
  if (prompt) return prompt;

  return sanitizeReplyText(
    fallback || "Hazırda sizə ən vacib olan nəticəni bir cümlə ilə yaza bilərsiniz?"
  );
}

function buildServiceExamples(profile = {}, limit = 3) {
  const names = getActiveVisibleCatalog(profile)
    .map((item) => s(item?.name))
    .filter(Boolean)
    .slice(0, limit);

  if (!names.length) return "";
  return sanitizeReplyText(names.join(", "));
}

function buildKnowledgeReplyCore(matches = [], profile = {}) {
  const first = arr(matches)[0];
  const answer = clipSentences(first?.answer || "", profile?.maxSentences || 2);
  return sanitizeReplyText(answer);
}

export function buildUnsupportedServiceReply(profile = {}) {
  const disabledSpecific = getDisabledVisibleCatalog(profile).find(
    (item) => s(item?.disabledReplyText)
  );

  if (disabledSpecific?.disabledReplyText) {
    return sanitizeReplyText(disabledSpecific.disabledReplyText);
  }

  const offerLead = buildOfferLead(profile);
  const examples = buildServiceExamples(profile, 4);
  const question = buildSingleQuestion(
    profile,
    "Ehtiyacınızı bir cümlə ilə yazın, uyğun olub-olmadığını dəqiqləşdirək."
  );

  if (examples) {
    return sanitizeReplyText(
      `${offerLead} Hazırda daha çox ${examples} kimi istiqamətlər üzrə işləyirik. ${question}`
    );
  }

  return sanitizeReplyText(
    `${offerLead} Bu mövzunun bizdə uyğun olub-olmadığını dəqiqləşdirmək üçün ehtiyacınızı bir cümlə ilə yazın.`
  );
}

export function buildKnowledgeReply(matches = [], profile = {}) {
  const answer = buildKnowledgeReplyCore(matches, profile);
  if (answer) return answer;

  return sanitizeReplyText(
    `${buildOfferLead(profile)} ${buildSingleQuestion(
      profile,
      "Nəyi dəqiqləşdirmək istədiyinizi bir cümlə ilə yazın."
    )}`
  );
}

export function buildPlaybookReply(playbook, fallbackProfile = {}) {
  const reply = sanitizeReplyText(playbook?.replyTemplate || "");
  if (reply) return reply;

  return sanitizeReplyText(
    `${buildOfferLead(fallbackProfile)} ${buildSingleQuestion(
      fallbackProfile,
      "Hazırda əsas ehtiyacınızı bir cümlə ilə yazın."
    )}`
  );
}

function buildGreetingReply(profile = {}) {
  const offerLead = buildOfferLead(profile);
  const question = buildSingleQuestion(
    profile,
    "Hazırda nə almaq, qurmaq və ya həll etmək istədiyinizi bir cümlə ilə yazın."
  );

  return sanitizeReplyText(`${offerLead} ${question}`);
}

function buildPricingReply(profile = {}) {
  const question = buildSingleQuestion(
    profile,
    "Təxmini yönləndirmə üçün nə istədiyinizi və əsas 1-2 tələbinizi yazın."
  );

  return sanitizeReplyText(
    `Dəqiq qiymət işin scope-u və tələblərə görə dəyişir, ona görə təsdiqlənməmiş rəqəm demirik. ${question}`
  );
}

function buildServiceInterestReply(profile = {}) {
  const offerLead = buildOfferLead(profile);
  const question = buildSingleQuestion(
    profile,
    "Sizə ən vacib olan nəticəni bir cümlə ilə yazın."
  );

  return sanitizeReplyText(`${offerLead} ${question}`);
}

function buildSupportReply(profile = {}) {
  const question = buildSingleQuestion(
    profile,
    "Problemi və harada baş verdiyini bir cümlə ilə yazın."
  );

  return sanitizeReplyText(`Kömək edək. ${question}`);
}

function buildHandoffReply(profile = {}) {
  const question = buildSingleQuestion(
    profile,
    "Komanda üzvünə düzgün yönləndirmək üçün mövzunu bir cümlə ilə yazın."
  );

  return sanitizeReplyText(`Əlbəttə, bunu komanda üzvünə yönləndirə bilərik. ${question}`);
}

function buildUrgentReply(profile = {}) {
  const question = buildSingleQuestion(
    profile,
    "Mövzunu bir cümlə ilə yazın, prioritetlə yönləndirək."
  );

  return sanitizeReplyText(`Qeyd etdik. ${question}`);
}

function buildGeneralReply(profile = {}) {
  const offerLead = buildOfferLead(profile);
  const question = buildSingleQuestion(
    profile,
    "Hazırda sizə ən vacib olan ehtiyacı bir cümlə ilə yazın."
  );

  return sanitizeReplyText(`${offerLead} ${question}`);
}

export function buildFallbackReply({
  intent,
  profile,
  knowledgeEntries = [],
  playbook = null,
}) {
  if (playbook) {
    return buildPlaybookReply(playbook, profile);
  }

  if (intent === "knowledge_answer") {
    const answer = buildKnowledgeReplyCore(knowledgeEntries, profile);
    if (answer) return answer;
  }

  switch (s(intent)) {
    case "unsupported_service":
      return buildUnsupportedServiceReply(profile);

    case "greeting":
      return buildGreetingReply(profile);

    case "pricing":
      return buildPricingReply(profile);

    case "service_interest":
      return buildServiceInterestReply(profile);

    case "support":
      return buildSupportReply(profile);

    case "handoff_request":
      return buildHandoffReply(profile);

    case "urgent_interest":
      return buildUrgentReply(profile);

    case "knowledge_answer":
      return buildKnowledgeReply(knowledgeEntries, profile);

    default:
      return buildGeneralReply(profile);
  }
}