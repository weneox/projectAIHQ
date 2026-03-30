import { obj, lower, s } from "./shared.js";

export function buildProjectedBehavior({
  identity = {},
  profile = {},
  voice = {},
  leadCapture = {},
  handoff = {},
  behavior = {},
} = {}) {
  const provided = obj(behavior);
  if (Object.keys(provided).length > 0) {
    return provided;
  }

  const niche = lower(identity.industryKey || "general_business");
  const conversionGoal =
    voice.supportsCalls === true
      ? "capture_qualified_lead"
      : "answer_and_route";

  return {
    businessType: niche,
    niche,
    subNiche: "",
    conversionGoal,
    primaryCta: conversionGoal === "capture_qualified_lead" ? "contact_us" : "",
    leadQualificationMode: leadCapture.enabled
      ? "guided_contact_capture"
      : "basic_contact_capture",
    qualificationQuestions: [],
    bookingFlowType: "manual",
    handoffTriggers: handoff.enabled ? ["human_request", "low_confidence"] : [],
    disallowedClaims: [],
    toneProfile: s(profile.toneProfile || "professional"),
    channelBehavior: {
      inbox: {
        primaryAction: conversionGoal,
        qualificationDepth: "guided",
        handoffBias: handoff.enabled ? "conditional" : "minimal",
      },
      comments: {
        primaryAction: "qualify_then_move_to_dm",
        qualificationDepth: "light",
        handoffBias: "minimal",
      },
      voice: {
        primaryAction: "route_or_capture_callback",
        qualificationDepth: "guided",
        handoffBias: handoff.enabled ? "conditional" : "manual",
      },
    },
  };
}
