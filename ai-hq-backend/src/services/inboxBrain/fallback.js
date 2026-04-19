import { arr, lower, s, sanitizeReplyText } from "./shared.js";

function resolveLanguage(profile = {}, playbook = null, matches = []) {
  const candidates = [
    s(playbook?.language),
    s(arr(matches)[0]?.language),
    s(arr(profile?.languages)[0]),
    "en",
  ];

  for (const candidate of candidates) {
    const x = lower(candidate);
    if (!x) continue;
    if (x.startsWith("az")) return "az";
    if (x.startsWith("en")) return "en";
    if (x.startsWith("tr")) return "tr";
    if (x.startsWith("ru")) return "ru";
    if (x.startsWith("es")) return "es";
    if (x.startsWith("de")) return "de";
    if (x.startsWith("fr")) return "fr";
    if (x.startsWith("it")) return "it";
    if (x.startsWith("pt")) return "pt";
    if (x.startsWith("ar")) return "ar";
    if (x.startsWith("nl")) return "nl";
    if (x.startsWith("pl")) return "pl";
    if (x.startsWith("uk")) return "uk";
    if (x.startsWith("zh")) return "zh";
    if (x.startsWith("ja")) return "ja";
    if (x.startsWith("ko")) return "ko";
    if (x.startsWith("hi")) return "hi";
  }

  return "en";
}

function splitSentences(text = "") {
  return s(text)
    .split(/(?<=[.!?؟])\s+/)
    .map((part) => sanitizeReplyText(part))
    .filter(Boolean);
}

function clipSentences(text = "", maxSentences = 2) {
  const safeMax = Math.max(1, Math.min(4, Number(maxSentences || 2)));
  return sanitizeReplyText(splitSentences(text).slice(0, safeMax).join(" "));
}

function joinParts(parts = []) {
  return sanitizeReplyText(
    arr(parts)
      .map((part) => sanitizeReplyText(part))
      .filter(Boolean)
      .join(" ")
  );
}

function getActiveVisibleCatalog(profile = {}) {
  return arr(profile?.serviceCatalog).filter((item) => item?.active && item?.visibleInAi);
}

function getDisabledVisibleCatalog(profile = {}) {
  return arr(profile?.serviceCatalog).filter((item) => !item?.active && item?.visibleInAi);
}

function buildServiceExamples(profile = {}, limit = 3) {
  const names = getActiveVisibleCatalog(profile)
    .map((item) => s(item?.name))
    .filter(Boolean)
    .slice(0, limit);

  return sanitizeReplyText(names.join(", "));
}

function getCopy(language = "en") {
  const map = {
    en: {
      hello: "Hello.",
      generalLead: "I can help with that.",
      pricingLead: "Pricing usually depends on scope, requirements, and delivery expectations.",
      timelineLead: "Timing usually depends on scope, requirements, and delivery expectations.",
      supportLead: "I can help with that.",
      handoffLead: "Sure — I can route this to a team member.",
      urgentLead: "Understood.",
      unsupportedLead: "I may not be able to confirm that request yet.",
      unsupportedExamples: (examples) => `What we currently support most clearly includes ${examples}.`,
      unsupportedQuestion: "Share the main goal and the key requirement, and I’ll guide this correctly.",
      generalQuestion: "Share the main goal and one or two important details so I can guide this correctly.",
      pricingQuestion: "Share the goal, the main requirements, and any budget or delivery expectation you already have.",
      timelineQuestion: "Share the goal, the required scope, and any target timeline you already have.",
      supportQuestion: "Share the issue and where it happens, and I’ll help narrow it down.",
      handoffQuestion: "Share the topic briefly so I can route it correctly.",
      greetingQuestion: "How can I help?",
      knowledgeFallback: "Here’s what I can confirm right now.",
    },
    az: {
      hello: "Salam.",
      generalLead: "Bununla bağlı kömək edə bilərəm.",
      pricingLead: "Qiymət adətən scope, tələblər və çatdırılma gözləntilərindən asılı olur.",
      timelineLead: "Müddət adətən scope, tələblər və çatdırılma gözləntilərindən asılı olur.",
      supportLead: "Bununla bağlı kömək edə bilərəm.",
      handoffLead: "Əlbəttə, bunu komanda üzvünə yönləndirə bilərəm.",
      urgentLead: "Qeyd etdim.",
      unsupportedLead: "Bu sorğunu hazırda dəqiq təsdiqləyə bilməyə bilərəm.",
      unsupportedExamples: (examples) => `Hazırda daha aydın dəstəklənən istiqamətlərə ${examples} daxildir.`,
      unsupportedQuestion: "Əsas məqsədi və vacib tələbi yazın, düzgün yönləndirim.",
      generalQuestion: "Əsas məqsədi və 1-2 vacib detalı yazın ki, düzgün yönləndirə bilim.",
      pricingQuestion: "Məqsədi, əsas tələbləri və varsa büdcə və ya çatdırılma gözləntisini yazın.",
      timelineQuestion: "Məqsədi, lazım olan scope-u və varsa hədəf müddəti yazın.",
      supportQuestion: "Problemi və harada baş verdiyini yazın, dəqiqləşdirim.",
      handoffQuestion: "Mövzunu qısa yazın ki, düzgün yönləndirim.",
      greetingQuestion: "Necə kömək edə bilərəm?",
      knowledgeFallback: "Hazırda təsdiqləyə bildiyim hissə budur.",
    },
    tr: {
      hello: "Merhaba.",
      generalLead: "Bununla ilgili yardımcı olabilirim.",
      pricingLead: "Fiyat genelde kapsam, gereksinimler ve teslim beklentilerine göre değişir.",
      timelineLead: "Süre genelde kapsam, gereksinimler ve teslim beklentilerine göre değişir.",
      supportLead: "Bununla ilgili yardımcı olabilirim.",
      handoffLead: "Elbette, bunu bir ekip üyesine yönlendirebilirim.",
      urgentLead: "Anladım.",
      unsupportedLead: "Bu talebi şu anda net olarak doğrulayamıyor olabilirim.",
      unsupportedExamples: (examples) => `Şu anda en net desteklediğimiz alanlara ${examples} dahildir.`,
      unsupportedQuestion: "Ana hedefi ve kritik gereksinimi yazın, doğru yönlendireyim.",
      generalQuestion: "Ana hedefi ve 1-2 önemli detayı yazın, doğru yönlendireyim.",
      pricingQuestion: "Hedefi, ana gereksinimleri ve varsa bütçe ya da teslim beklentisini yazın.",
      timelineQuestion: "Hedefi, gerekli kapsamı ve varsa hedef zamanı yazın.",
      supportQuestion: "Sorunu ve nerede olduğunu yazın, daraltayım.",
      handoffQuestion: "Konuyu kısa yazın, doğru kişiye yönlendireyim.",
      greetingQuestion: "Nasıl yardımcı olabilirim?",
      knowledgeFallback: "Şu anda doğrulayabildiğim kısım bu.",
    },
    ru: {
      hello: "Здравствуйте.",
      generalLead: "Я могу помочь с этим.",
      pricingLead: "Стоимость обычно зависит от объёма, требований и ожиданий по срокам.",
      timelineLead: "Сроки обычно зависят от объёма, требований и ожиданий по результату.",
      supportLead: "Я могу помочь с этим.",
      handoffLead: "Конечно, я могу передать это сотруднику команды.",
      urgentLead: "Понял.",
      unsupportedLead: "Сейчас я не могу точно подтвердить этот запрос.",
      unsupportedExamples: (examples) => `Сейчас наиболее понятно поддерживаются такие направления, как ${examples}.`,
      unsupportedQuestion: "Напишите основную цель и ключевое требование, и я направлю вас точнее.",
      generalQuestion: "Напишите основную цель и 1-2 важных детали, чтобы я мог точнее сориентировать.",
      pricingQuestion: "Напишите цель, основные требования и, если есть, бюджет или ожидания по срокам.",
      timelineQuestion: "Напишите цель, нужный объём и, если есть, желаемый срок.",
      supportQuestion: "Опишите проблему и где она возникает, и я помогу сузить причину.",
      handoffQuestion: "Кратко опишите тему, чтобы я направил вас правильно.",
      greetingQuestion: "Чем могу помочь?",
      knowledgeFallback: "Вот что я могу подтвердить прямо сейчас.",
    },
  };

  return map[language] || map.en;
}

function getConfiguredPrompt(profile = {}) {
  const conversationAssets = profile?.conversationAssets || {};
  return sanitizeReplyText(
    s(conversationAssets?.qualificationQuestions?.[0]) ||
      s(profile?.qualificationQuestions?.[0]) ||
      s(conversationAssets?.leadPrompts?.[0]) ||
      s(profile?.leadPrompts?.[0])
  );
}

function buildSafeQuestion(profile = {}, intent = "general", language = "en") {
  const copy = getCopy(language);
  const configured = getConfiguredPrompt(profile);
  if (configured) return configured;

  switch (s(intent)) {
    case "greeting":
      return copy.greetingQuestion;
    case "pricing":
      return copy.pricingQuestion;
    case "timeline":
      return copy.timelineQuestion;
    case "support":
      return copy.supportQuestion;
    case "handoff_request":
      return copy.handoffQuestion;
    default:
      return copy.generalQuestion;
  }
}

function buildKnowledgeReplyCore(matches = [], profile = {}) {
  const first = arr(matches)[0];
  if (!first) return "";

  const answer = clipSentences(first?.answer || "", profile?.maxSentences || 2);
  return sanitizeReplyText(answer);
}

function buildGeneralReply(profile = {}, language = "en") {
  const copy = getCopy(language);

  return joinParts([
    copy.generalLead,
    buildSafeQuestion(profile, "general", language),
  ]);
}

function buildGreetingReply(profile = {}, language = "en") {
  const copy = getCopy(language);

  return joinParts([
    copy.hello,
    buildSafeQuestion(profile, "greeting", language),
  ]);
}

function buildPricingReply(profile = {}, language = "en") {
  const copy = getCopy(language);

  return joinParts([
    copy.pricingLead,
    buildSafeQuestion(profile, "pricing", language),
  ]);
}

function buildTimelineReply(profile = {}, language = "en") {
  const copy = getCopy(language);

  return joinParts([
    copy.timelineLead,
    buildSafeQuestion(profile, "timeline", language),
  ]);
}

function buildSupportReply(profile = {}, language = "en") {
  const copy = getCopy(language);

  return joinParts([
    copy.supportLead,
    buildSafeQuestion(profile, "support", language),
  ]);
}

function buildHandoffReply(profile = {}, language = "en") {
  const copy = getCopy(language);

  return joinParts([
    copy.handoffLead,
    buildSafeQuestion(profile, "handoff_request", language),
  ]);
}

function buildUrgentReply(profile = {}, language = "en") {
  const copy = getCopy(language);

  return joinParts([
    copy.urgentLead,
    buildSafeQuestion(profile, "general", language),
  ]);
}

function buildUnsupportedServiceReply(profile = {}) {
  const language = resolveLanguage(profile);
  const copy = getCopy(language);

  const disabledSpecific = getDisabledVisibleCatalog(profile).find(
    (item) => s(item?.disabledReplyText)
  );

  if (disabledSpecific?.disabledReplyText) {
    return sanitizeReplyText(disabledSpecific.disabledReplyText);
  }

  const examples = buildServiceExamples(profile, 4);

  if (examples) {
    return joinParts([
      copy.unsupportedLead,
      copy.unsupportedExamples(examples),
      copy.unsupportedQuestion,
    ]);
  }

  return joinParts([
    copy.unsupportedLead,
    copy.unsupportedQuestion,
  ]);
}

function buildKnowledgeReply(matches = [], profile = {}) {
  const language = resolveLanguage(profile, null, matches);
  const copy = getCopy(language);
  const answer = buildKnowledgeReplyCore(matches, profile);

  if (answer) return answer;

  return joinParts([
    copy.knowledgeFallback,
    buildSafeQuestion(profile, "general", language),
  ]);
}

function buildPlaybookReply(playbook, fallbackProfile = {}) {
  const reply = sanitizeReplyText(playbook?.replyTemplate || "");
  if (reply) return reply;

  const language = resolveLanguage(fallbackProfile, playbook);
  return buildGeneralReply(fallbackProfile, language);
}

function buildFallbackReply({
  intent,
  profile,
  knowledgeEntries = [],
  playbook = null,
}) {
  const language = resolveLanguage(profile, playbook, knowledgeEntries);

  if (playbook) {
    return buildPlaybookReply(playbook, profile);
  }

  if (s(intent) === "knowledge_answer") {
    const answer = buildKnowledgeReplyCore(knowledgeEntries, profile);
    if (answer) return answer;
  }

  switch (s(intent)) {
    case "unsupported_service":
      return buildUnsupportedServiceReply(profile);

    case "greeting":
      return buildGreetingReply(profile, language);

    case "pricing":
    case "quote":
      return buildPricingReply(profile, language);

    case "timeline":
      return buildTimelineReply(profile, language);

    case "support":
      return buildSupportReply(profile, language);

    case "handoff_request":
      return buildHandoffReply(profile, language);

    case "urgent_interest":
      return buildUrgentReply(profile, language);

    case "knowledge_answer":
      return buildKnowledgeReply(knowledgeEntries, profile);

    default:
      return buildGeneralReply(profile, language);
  }
}

export {
  buildUnsupportedServiceReply,
  buildKnowledgeReply,
  buildPlaybookReply,
  buildFallbackReply,
};