function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function normalizeVoiceLanguage(value = "") {
  const raw = s(value).toLowerCase().replace("_", "-");
  if (raw.startsWith("az")) return "az";
  if (raw.startsWith("tr")) return "tr";
  if (raw.startsWith("ru")) return "ru";
  if (raw.startsWith("en")) return "en";
  return raw || "az";
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

const AZ_BASELINE_NATURALNESS_LABELS = [
  "opening_naturalness",
  "recording_like",
  "too_formal",
  "turn_taking",
  "backchannel",
  "local_phrase",
];

const NATURALNESS_REPAIR_RULES = {
  opening_naturalness:
    "- opening_naturalness: Opening must be one warm local sentence; no long welcome, no menu-like script.",
  recording_like:
    "- recording_like: Avoid a recording-like IVR feel; start and stop like a live person, not a pre-recorded announcement.",
  too_formal:
    "- too_formal: Use polite but plain Azerbaijani; avoid bureaucratic, stiff, or over-formal wording.",
  turn_taking:
    "- turn_taking: Leave space for the caller; after one useful question, stop and wait.",
  interruption:
    "- interruption: If the caller interrupts, yield immediately and follow the caller's latest turn.",
  local_phrase:
    "- local_phrase: Use short Azerbaijani acknowledgements sparingly, like 'başa düşdüm', 'aydındır', or 'qeyd etdim'.",
  prosody:
    "- prosody: Keep natural Azerbaijani sentence melody; do not over-enunciate every word.",
  backchannel:
    "- backchannel: Use brief backchannels only to show listening; never fake confirmation.",
  latency_pause:
    "- latency_pause: If there is a pause, use one short bridge phrase, then continue naturally.",
  stiff_closing:
    "- stiff_closing: Closing must sound human and brief; do not end like a recorded message.",
  other:
    "- other: Keep the voice local, live, short, and caller-led.",
};

function normalizeNaturalnessInstructionLabel(value = "") {
  const raw = s(value).toLowerCase().replace(/[\s-]+/g, "_");

  if (NATURALNESS_REPAIR_RULES[raw]) return raw;
  if (raw === "recorded" || raw === "recording") return "recording_like";
  if (raw === "formal" || raw === "over_formal") return "too_formal";
  if (raw === "turntaking") return "turn_taking";
  if (raw === "opening") return "opening_naturalness";
  if (raw === "pause" || raw === "latency") return "latency_pause";
  if (raw === "closing") return "stiff_closing";

  return raw ? "other" : "";
}

export function normalizeVoiceNaturalnessInstructionLabels(value = []) {
  return [
    ...new Set(
      arr(value)
        .map(normalizeNaturalnessInstructionLabel)
        .filter(Boolean)
    ),
  ];
}

function readNaturalnessInstructionLabels(context = {}, language = "az") {
  const naturalness = obj(context.naturalness || context.voiceNaturalness);
  const qa = obj(context.qa || context.voiceQa || context.quality);

  const explicit = normalizeVoiceNaturalnessInstructionLabels([
    ...arr(context.naturalnessLabels),
    ...arr(context.voiceNaturalnessLabels),
    ...arr(naturalness.labels),
    ...arr(qa.naturalnessLabels),
    ...arr(qa.latestNaturalnessLabels),
  ]);

  if (explicit.length) return explicit;
  return normalizeVoiceLanguage(language) === "az" ? AZ_BASELINE_NATURALNESS_LABELS : [];
}

export function buildVoiceNaturalnessEvalInstructionPolicy(context = {}) {
  const language = normalizeVoiceLanguage(context.language || context.defaultLanguage || "az");
  const labels = readNaturalnessInstructionLabels(context, language);

  if (!labels.length) return [];

  return [
    "Natural voice repair policy:",
    "- Treat these as internal voice-quality repair targets; never mention labels, scoring, internal review, or repair rules to the caller.",
    ...labels.map((label) => NATURALNESS_REPAIR_RULES[label] || NATURALNESS_REPAIR_RULES.other),
  ];
}

export function buildVoiceSpeechPolicy(context = {}) {
  const language = normalizeVoiceLanguage(context.language || context.defaultLanguage || "az");
  const naturalnessPolicy = buildVoiceNaturalnessEvalInstructionPolicy({
    ...context,
    language,
  });

  const universal = [
    "Voice speech quality policy:",
    "- Speak as a live receptionist, not as a chatbot.",
    "- Most replies must be one short sentence. Use two short sentences only when needed.",
    "- Ask one question at a time.",
    "- Do not speak in long paragraphs.",
    "- Do not list many options unless the caller asks for options.",
    "- Do not over-apologize.",
    "- Do not over-explain.",
    "- Do not repeat the same offer.",
    "- Do not mention AI, model, prompt, tool, database, runtime, policy, system, or knowledge base.",
    "- If a fact is missing, say naturally that the team must confirm it.",
    "- If follow-up is needed, collect the caller's name and phone, then create the relevant request.",
    "- If the caller asks for a human, quickly create or offer handoff instead of convincing them to continue.",
  ];

  if (language === "az") {
    return [
      "Azerbaijani natural receptionist mode:",
      "- Azərbaycan dilində canlı, yerli receptionist kimi danış.",
      "- Cümlələr qısa, sadə və danışıq dilinə yaxın olsun.",
      "- Türk dilindəki kimi süni vurğu və ifadələrdən qaç.",
      "- Rus/ingilis cümlə quruluşunu azərbaycancaya çevirmə.",
      "- 'Məlumat bazamda yoxdur' demə.",
      "- 'Bu detalı komanda dəqiqləşdirməlidir' daha təbii səslənir.",
      "- 'Zəhmət olmasa' ifadəsini həddindən artıq təkrarlama.",
      "- Ad və telefonu yalnız real follow-up, appointment, request və ya handoff üçün istə.",
      "- Müştəri qiymət və ya vaxt soruşanda dəqiq məlumat yoxdursa, uydurma.",
      "- Telefonu aldıqdan sonra qısa de: 'Qeyd etdim.'",
      "- Sonda qısa yekun ver: 'Komanda sizinlə əlaqə saxlayacaq.'",
      "- Açılış tərzi belə olmalıdır: 'Salam, [biznes adı]. Buyurun, necə kömək edə bilərəm?'",
      ...naturalnessPolicy,
      ...universal,
    ];
  }

  if (language === "ru") {
    return [
      "Russian natural receptionist mode:",
      "- Speak like a calm receptionist, not like a scripted bot.",
      "- Keep answers short and practical.",
      "- Avoid formal bureaucratic wording unless the business requires it.",
      ...naturalnessPolicy,
      ...universal,
    ];
  }

  if (language === "tr") {
    return [
      "Turkish natural receptionist mode:",
      "- Kısa, doğal ve telefona uygun konuş.",
      "- Gereksiz resmi veya robotik ifadelerden kaçın.",
      ...naturalnessPolicy,
      ...universal,
    ];
  }

  return [
    ...naturalnessPolicy,
    ...universal,
  ];
}

export function buildVoiceOpeningSpeechPolicy({ language = "az", companyName = "" } = {}) {
  const lang = normalizeVoiceLanguage(language);
  const name = s(companyName || "biznes");

  if (lang === "az") {
    return [
      "Opening speech policy:",
      `- Open naturally like: "Salam, ${name}. Buyurun, necə kömək edə bilərəm?"`,
      "- Do not ask booking-specific details in the opening.",
      "- Do not say a long welcome message.",
      "- Stop after the opening and wait for the caller.",
    ];
  }

  return [
    "Opening speech policy:",
    "- Open with one short natural receptionist greeting.",
    "- Do not ask task-specific details in the opening.",
    "- Stop after the opening and wait for the caller.",
  ];
}

export function buildVoiceLanguageProsodyGuide(language = "") {
  const lang = normalizeVoiceLanguage(language);

  if (lang === "az") {
    return [
      "Azerbaijani prosody guidance:",
      "- Use natural Azerbaijani sentence melody, not Turkish, Russian, or English stress patterns.",
      "- For Azerbaijani words, prefer natural final-syllable leaning stress where it sounds idiomatic.",
      "- Avoid incorrectly stressing the first syllable of common Azerbaijani words.",
      "- Keep function words light and keep the main semantic stress near the end of the phrase when natural.",
      "- Do not exaggerate the accent; sound like a calm local receptionist.",
    ];
  }

  return [
    "Speech prosody guidance:",
    "- Speak naturally in the caller's language or configured primary business language.",
    "- Use native-like stress and sentence melody for that language.",
    "- Do not force Azerbaijani, Turkish, Russian, or English stress patterns onto another language.",
    "- Do not over-enunciate or pause between every word.",
  ];
}
