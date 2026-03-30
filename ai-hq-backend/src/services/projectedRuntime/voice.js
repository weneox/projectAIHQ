import { arr, lower, obj, s } from "./shared.js";

export function buildVoiceOperationalConfig(operationalChannels = {}) {
  const voiceOperational = obj(obj(operationalChannels).voice);
  const telephony = obj(voiceOperational.telephony);

  return {
    contact: {
      phoneLocal: "",
      phoneIntl: s(telephony.phoneNumber),
      emailLocal: "",
      emailIntl: "",
      website: "",
    },
    operator: obj(voiceOperational.operator),
    operatorRouting: obj(voiceOperational.operatorRouting),
    realtime: obj(voiceOperational.realtime),
    telephony: obj(voiceOperational.telephony),
    callback: obj(voiceOperational.callback),
    transfer: obj(voiceOperational.transfer),
    limits: obj(voiceOperational.limits),
    reasonCode: s(voiceOperational.reasonCode),
    source: s(voiceOperational.source),
    updatedAt: s(voiceOperational.updatedAt),
    contractHash: s(voiceOperational.contractHash),
    ready: voiceOperational.ready === true,
    available: voiceOperational.available === true,
  };
}

export function buildVoiceProfile({
  identity = {},
  profile = {},
  services = [],
  voice = {},
  leadCapture = {},
  handoff = {},
  behavior = {},
} = {}) {
  const companyName = s(identity.companyName || identity.displayName || "");
  const defaultLanguage = lower(identity.mainLanguage || "en");
  const businessSummary = s(
    profile.summaryShort ||
      profile.summaryLong ||
      profile.valueProposition ||
      ""
  );

  return {
    companyName,
    assistantName: s(identity.displayName || companyName || "Virtual Assistant"),
    roleLabel: "virtual assistant",
    defaultLanguage,
    purpose: s(behavior.conversionGoal || behavior.bookingFlowType || "general"),
    tone: s(behavior.toneProfile || profile.toneProfile || "professional"),
    answerStyle: "short_clear",
    askStyle: "single_question",
    businessSummary,
    allowedTopics: arr(services)
      .map((item) => s(item.title || item.name))
      .filter(Boolean),
    forbiddenTopics: [],
    leadCaptureMode: leadCapture.enabled
      ? s(
          behavior.leadQualificationMode ||
            leadCapture.contactCaptureMode ||
            "guided"
        )
      : "none",
    transferMode: handoff.enabled
      ? s(
          obj(behavior.channelBehavior).voice?.handoffBias ||
            handoff.escalationMode ||
            "manual"
        )
      : "manual",
    contactPolicy: {
      sharePhone: Boolean(s(voice.primaryPhone)),
      shareEmail: false,
      shareWebsite: Boolean(s(identity.websiteUrl || profile.websiteUrl)),
    },
    texts: {},
  };
}
