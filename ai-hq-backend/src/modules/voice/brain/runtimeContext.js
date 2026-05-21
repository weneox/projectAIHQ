export function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

export function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function arr(value) {
  return Array.isArray(value) ? value : [];
}

function compactLabel(value) {
  const item = obj(value);

  if (Object.keys(item).length) {
    return s(
      item.name ||
        item.title ||
        item.label ||
        item.serviceName ||
        item.intent ||
        item.key ||
        item.id
    );
  }

  return s(value);
}

export function compact(values = []) {
  return arr(values).map((value) => compactLabel(value)).filter(Boolean);
}

export function joinVoiceBrainList(values = []) {
  return compact(values).join("; ");
}

export function truncateVoiceBrainText(value = "", max = 1600) {
  return s(value).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max);
}

export function normalizeVoiceBrainLanguage(value = "") {
  const raw = s(value).toLowerCase().replace("_", "-");
  if (raw.startsWith("az")) return "az";
  if (raw.startsWith("tr")) return "tr";
  if (raw.startsWith("ru")) return "ru";
  if (raw.startsWith("en")) return "en";
  return raw || "az";
}

export function extractVoiceRuntimeContext(runtimeConfig = {}) {
  const config = obj(runtimeConfig);
  const voiceProfile = obj(config.voiceProfile);
  const voiceBehavior = obj(config.voiceBehavior);
  const contact = obj(config.contact);
  const business = obj(config.business || config.businessProfile || config.company);
  const operator = obj(config.operator);
  const operatorRouting = obj(config.operatorRouting);
  const activeVoiceChannel = obj(config.activeVoiceChannel);
  const realtime = obj(config.realtime);

  const language = normalizeVoiceBrainLanguage(
    config.defaultLanguage || voiceProfile.defaultLanguage || "az"
  );

  return {
    companyName: s(
      config.companyName ||
        voiceProfile.companyName ||
        business.name ||
        "the business"
    ),
    businessType: s(
      config.businessType ||
        config.business_type ||
        business.type ||
        business.category ||
        voiceProfile.businessType ||
        voiceProfile.business_type ||
        voiceProfile.industry ||
        config.industry
    ),
    language,
    supportedLanguages: compact([
      language,
      ...arr(config.supportedLanguages),
      ...arr(config.supported_languages),
      ...arr(voiceProfile.supportedLanguages),
      ...arr(voiceProfile.supported_languages),
    ]),
    assistantName: s(voiceProfile.assistantName || "AI receptionist"),
    roleLabel: s(voiceProfile.roleLabel || "voice receptionist"),
    businessSummary: s(voiceProfile.businessSummary || config.businessSummary),
    purpose: s(voiceProfile.purpose || voiceBehavior.primaryAction || "answer_and_route"),
    tone: s(voiceProfile.tone || voiceBehavior.toneProfile || "professional"),
    answerStyle: s(voiceProfile.answerStyle || "short_clear"),
    askStyle: s(voiceProfile.askStyle || "single_question"),
    allowedTopics: compact(voiceProfile.allowedTopics),
    supportedIntents: compact([
      ...arr(config.supportedIntents),
      ...arr(config.supported_intents),
      ...arr(voiceProfile.supportedIntents),
      ...arr(voiceBehavior.supportedIntents),
      ...arr(operatorRouting.supportedIntents),
    ]),
    unsupportedIntents: compact([
      ...arr(config.unsupportedIntents),
      ...arr(config.unsupported_intents),
      ...arr(voiceProfile.unsupportedIntents),
      ...arr(voiceBehavior.unsupportedIntents),
      ...arr(operatorRouting.unsupportedIntents),
    ]),
    services: compact([
      ...arr(config.services),
      ...arr(config.serviceCatalog),
      ...arr(config.businessServices),
      ...arr(config.approvedServices),
      ...arr(voiceProfile.services),
      ...arr(voiceProfile.serviceCatalog),
    ]),
    forbiddenTopics: compact([
      ...arr(voiceProfile.forbiddenTopics),
      ...arr(voiceBehavior.disallowedClaims),
    ]),
    qualificationQuestions: compact(voiceBehavior.qualificationQuestions),
    handoffTriggers: compact([
      ...arr(voiceBehavior.handoffTriggers),
      ...arr(operatorRouting.escalationTriggers),
    ]),
    contact,
    operator,
    operatorRouting,
    activeVoiceChannel,
    runtimeInstructions: s(realtime.instructions),
  };
}

export function buildVoiceRuntimeContextLines(context = {}) {
  const supportedLanguages = joinVoiceBrainList(context.supportedLanguages);

  return [
    "Runtime context:",
    `- Business: ${s(context.companyName, "the business")}.`,
    context.businessType ? `- Approved business type: ${context.businessType}.` : "",
    `- Assistant identity: ${s(context.assistantName, "AI receptionist")} / ${s(context.roleLabel, "voice receptionist")}.`,
    `- Tenant default language: ${s(context.language, "az")}.`,
    supportedLanguages ? `- Supported spoken languages: ${supportedLanguages}.` : "",
    `- Tone: ${s(context.tone, "professional")}. Answer style: ${s(context.answerStyle, "short_clear")}. Ask style: ${s(context.askStyle, "single_question")}.`,
    `- Primary purpose: ${s(context.purpose, "answer_and_route")}.`,
    context.supportedIntents.length
      ? `- Supported caller intents: ${joinVoiceBrainList(context.supportedIntents)}.`
      : "",
    context.unsupportedIntents.length
      ? `- Unsupported caller intents: ${joinVoiceBrainList(context.unsupportedIntents)}.`
      : "",
    context.services.length
      ? `- Approved services/products: ${joinVoiceBrainList(context.services)}.`
      : "",
  ].filter(Boolean);
}
