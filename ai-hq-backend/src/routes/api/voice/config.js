import { buildExecutionPolicySurfaceSummary } from "../../../services/executionPolicy.js";
import { buildPromptBundle } from "../../../services/promptBundle.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = s(value);
    if (normalized) return normalized;
  }
  return "";
}

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((entry) => s(entry)).filter(Boolean))];
}

function appendInstructionLine(lines, value) {
  const normalized = s(value);
  if (normalized) lines.push(normalized);
}

function buildVoiceBehaviorConfig(runtime = {}) {
  const behavior = obj(runtime.behavior);
  const channelBehavior = obj(behavior.channelBehavior);
  const voiceBehavior = obj(channelBehavior.voice);

  const conversionGoal = s(behavior.conversionGoal || "answer_and_route");
  const primaryCta = s(behavior.primaryCta || "contact the team");
  const leadQualificationMode = s(
    behavior.leadQualificationMode || "guided"
  );
  const qualificationQuestions = uniqueStrings(
    behavior.qualificationQuestions
  );
  const handoffTriggers = uniqueStrings(behavior.handoffTriggers);
  const disallowedClaims = uniqueStrings(behavior.disallowedClaims);
  const toneProfile = s(behavior.toneProfile || "professional");
  const primaryAction = s(voiceBehavior.primaryAction || conversionGoal);
  const qualificationDepth = s(
    voiceBehavior.qualificationDepth || "guided"
  );
  const handoffBias = s(voiceBehavior.handoffBias || "conditional");

  return {
    conversionGoal,
    primaryCta,
    leadQualificationMode,
    qualificationQuestions,
    handoffTriggers,
    toneProfile,
    disallowedClaims,
    primaryAction,
    qualificationDepth,
    handoffBias,
    greetingStyle:
      toneProfile.includes("warm") || toneProfile.includes("reassuring")
        ? "warm_intro"
        : toneProfile.includes("premium") || toneProfile.includes("luxury")
          ? "concierge_intro"
          : "direct_intro",
    blockedClaimPolicy:
      disallowedClaims.length > 0 ? "decline_and_handoff" : "decline_and_redirect",
  };
}

function buildVoiceRealtimeInstructions({
  baseInstructions = "",
  companyName = "",
  runtime = {},
  voiceBehavior = {},
}) {
  const behavior = obj(voiceBehavior);
  const runtimeTenant = obj(runtime.tenant);
  const voiceChannel = obj(obj(runtime.channels).voice);
  const promptBundle = buildPromptBundle("voice.reply", {
    tenant: {
      tenantKey: s(runtimeTenant.tenantKey || "default"),
      tenantId: s(runtimeTenant.tenantId || runtimeTenant.tenantKey || "default"),
      companyName: s(companyName || runtimeTenant.companyName || "the business"),
      brandName: s(companyName || runtimeTenant.companyName || "the business"),
      industryKey: s(runtimeTenant.industryKey || "generic_business"),
      outputLanguage: s(runtimeTenant.mainLanguage || "en"),
      businessContext: s(voiceChannel.profile?.businessSummary || ""),
      behavior: {
        niche: s(runtimeTenant.industryKey || "generic_business"),
        conversionGoal: s(behavior.conversionGoal),
        primaryCta: s(behavior.primaryCta),
        toneProfile: s(behavior.toneProfile),
        disallowedClaims: arr(behavior.disallowedClaims),
        handoffTriggers: arr(behavior.handoffTriggers),
        channelBehavior: {
          voice: {
            primaryAction: s(behavior.primaryAction),
            qualificationDepth: s(behavior.qualificationDepth),
            handoffBias: s(behavior.handoffBias),
          },
        },
      },
    },
    extra: {
      channel: "voice",
      surface: "voice",
      policy: {
        humanReviewRequired: arr(behavior.handoffTriggers).length > 0,
      },
      outputContract: {
        mode: "text",
        hint: "Produce concise realtime spoken-instruction guidance.",
      },
    },
  });
  const lines = [];

  appendInstructionLine(lines, baseInstructions);
  appendInstructionLine(lines, promptBundle.fullPrompt);
  appendInstructionLine(
    lines,
    `Voice execution rules: represent ${s(companyName || "the business")} with short spoken responses and keep the interaction operationally useful.`
  );
  appendInstructionLine(
    lines,
    `Qualification mode: ${s(behavior.leadQualificationMode || "guided")} with ${s(behavior.qualificationDepth || "guided")} depth.`
  );
  if (arr(behavior.qualificationQuestions).length > 0) {
    appendInstructionLine(
      lines,
      `Qualification questions to prefer: ${arr(behavior.qualificationQuestions).join("; ")}.`
    );
  }
  if (arr(behavior.handoffTriggers).length > 0) {
    appendInstructionLine(
      lines,
      `Escalate to a human when these triggers appear: ${arr(behavior.handoffTriggers).join(", ")}.`
    );
  }
  appendInstructionLine(
    lines,
    `Handoff bias: ${s(behavior.handoffBias || "conditional")}.`
  );
  if (arr(behavior.disallowedClaims).length > 0) {
    appendInstructionLine(
      lines,
      `Never make these claims: ${arr(behavior.disallowedClaims).join(", ")}. If asked, avoid the claim and offer handoff or callback instead.`
    );
  }

  return lines.join("\n");
}

export function buildVoiceConfigFromProjectedRuntime(
  projectedRuntime,
  { tenantKey, toNumber } = {}
) {
  const runtime = obj(projectedRuntime);
  const authority = obj(runtime.authority);
  const tenant = obj(runtime.tenant);
  const voice = obj(obj(runtime.channels).voice);
  const operationalVoice = obj(obj(runtime.operational).voice);
  const contact = obj(voice.contact);
  const operator = obj(operationalVoice.operator);
  const operatorRouting = obj(operationalVoice.operatorRouting);
  const realtime = obj(operationalVoice.realtime);
  const voiceProfile = obj(voice.profile);
  const behaviorConfig = buildVoiceBehaviorConfig(runtime);

  const resolvedTenantKey = lower(
    tenant.tenantKey || authority.tenantKey || tenantKey || "default"
  );
  const companyName = s(tenant.companyName || tenant.displayName || resolvedTenantKey);
  const defaultLanguage = lower(
    voiceProfile.defaultLanguage || tenant.mainLanguage || "en"
  );
  const realtimeInstructions = buildVoiceRealtimeInstructions({
    baseInstructions: realtime.instructions,
    companyName,
    runtime,
    voiceBehavior: behaviorConfig,
  });
  const forbiddenTopics = uniqueStrings([
    ...arr(voiceProfile.forbiddenTopics),
    ...arr(behaviorConfig.disallowedClaims),
  ]);
  const allowedTopics = uniqueStrings([
    ...arr(voiceProfile.allowedTopics),
    ...arr(behaviorConfig.qualificationQuestions),
  ]);

  return {
    ok: true,
    tenantId: s(tenant.tenantId || authority.tenantId),
    tenantKey: resolvedTenantKey,
    companyName,
    defaultLanguage,
    authority,
    executionPolicy: {
      voice: buildExecutionPolicySurfaceSummary({
        runtime,
        surface: "voice",
        channelType: "voice",
      }),
      inbox: buildExecutionPolicySurfaceSummary({
        runtime,
        surface: "inbox",
        channelType: "inbox",
      }),
    },
    projectedRuntime: runtime,
    match: {
      tenantKey: s(tenantKey),
      toNumber: s(toNumber),
    },
    contact: {
      phoneLocal: s(obj(operationalVoice.contact).phoneLocal),
      phoneIntl: s(contact.phoneIntl || obj(operationalVoice.contact).phoneIntl),
      emailLocal: s(obj(operationalVoice.contact).emailLocal),
      emailIntl: s(contact.emailIntl || obj(operationalVoice.contact).emailIntl),
      website: s(contact.website || obj(operationalVoice.contact).website),
    },
    operator: {
      phone: s(operator.phone),
      callerId: s(operator.callerId),
      mode: lower(operator.mode || "manual"),
    },
    operatorRouting: {
      ...operatorRouting,
      escalationTriggers: behaviorConfig.handoffTriggers,
      handoffBias: behaviorConfig.handoffBias,
    },
    realtime: {
      model: s(realtime.model || "gpt-4o-realtime-preview"),
      voice: s(realtime.voice || "alloy"),
      instructions: realtimeInstructions,
    },
    voiceBehavior: behaviorConfig,
    voiceProfile: {
      companyName,
      assistantName: s(voiceProfile.assistantName || "Virtual Assistant"),
      roleLabel: s(voiceProfile.roleLabel || "virtual assistant"),
      defaultLanguage,
      purpose: firstNonEmpty(
        voiceProfile.purpose,
        behaviorConfig.conversionGoal,
        "general"
      ),
      tone: firstNonEmpty(
        voiceProfile.tone,
        behaviorConfig.toneProfile,
        "professional"
      ),
      answerStyle: s(voiceProfile.answerStyle || "short_clear"),
      askStyle:
        behaviorConfig.qualificationDepth === "concise"
          ? "single_question"
          : behaviorConfig.qualificationDepth === "extended"
            ? "guided_sequence"
            : s(voiceProfile.askStyle || "single_question"),
      businessSummary: s(voiceProfile.businessSummary),
      allowedTopics,
      forbiddenTopics,
      leadCaptureMode: firstNonEmpty(
        behaviorConfig.leadQualificationMode,
        voiceProfile.leadCaptureMode,
        "none"
      ),
      transferMode: firstNonEmpty(
        voiceProfile.transferMode,
        behaviorConfig.handoffBias,
        operatorRouting.mode,
        "manual"
      ),
      contactPolicy:
        voiceProfile.contactPolicy &&
        typeof voiceProfile.contactPolicy === "object" &&
        !Array.isArray(voiceProfile.contactPolicy)
          ? voiceProfile.contactPolicy
          : {
              sharePhone: false,
              shareEmail: false,
              shareWebsite: false,
            },
      texts:
        voiceProfile.texts &&
        typeof voiceProfile.texts === "object" &&
        !Array.isArray(voiceProfile.texts)
          ? {
              ...voiceProfile.texts,
              greetingStyle: behaviorConfig.greetingStyle,
              primaryCta: behaviorConfig.primaryCta,
              qualificationQuestions: behaviorConfig.qualificationQuestions,
              handoffTriggers: behaviorConfig.handoffTriggers,
              blockedClaimPolicy: behaviorConfig.blockedClaimPolicy,
            }
          : {
              greetingStyle: behaviorConfig.greetingStyle,
              primaryCta: behaviorConfig.primaryCta,
              qualificationQuestions: behaviorConfig.qualificationQuestions,
              handoffTriggers: behaviorConfig.handoffTriggers,
              blockedClaimPolicy: behaviorConfig.blockedClaimPolicy,
            },
    },
  };
}
