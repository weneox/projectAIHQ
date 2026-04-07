import {
  buildOnboardingSessionPayload,
  loadCurrentOnboardingSession,
  startOnboardingSession,
  updateOnboardingDraft,
} from "./onboardingApp.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function compactObject(input = {}) {
  return Object.fromEntries(
    Object.entries(obj(input)).filter(([, value]) => value !== undefined)
  );
}

function normalizeSetupAssistantError(error = "") {
  const code = s(error);
  if (code === "OnboardingSessionNotFound") return "SetupAssistantSessionNotFound";
  if (code === "OnboardingDraftInvalid") return "SetupAssistantDraftInvalid";
  return code;
}

function normalizeSetupAssistantMessage(message = "") {
  const text = s(message);
  if (text === "Onboarding session started") return "Setup assistant session started";
  if (text === "Onboarding session loaded") return "Setup assistant session loaded";
  if (text === "Onboarding draft updated") return "Setup assistant draft updated";
  return text;
}

export function buildSetupAssistantSessionPayload(review = {}) {
  const payload = buildOnboardingSessionPayload(review);
  const session = obj(payload.session);
  const setup = obj(payload.onboarding);

  return compactObject({
    session: compactObject({
      ...session,
      sourceType: "setup_assistant",
      namespace: "setup_assistant",
    }),
    setup: compactObject({
      ...setup,
      sourceType: "setup_assistant",
      namespace: "setup_assistant",
    }),
  });
}

function mapLegacyResult(result = {}) {
  const body = obj(result.body);
  const setup = body.setup ? obj(body.setup) : obj(body.onboarding);
  const session = obj(body.session);

  return {
    status: Number(result.status || 200),
    body: compactObject({
      ...body,
      error: normalizeSetupAssistantError(body.error),
      message: normalizeSetupAssistantMessage(body.message),
      session: Object.keys(session).length
        ? {
            ...session,
            sourceType: "setup_assistant",
            namespace: "setup_assistant",
          }
        : body.session === null
          ? null
          : undefined,
      setup: Object.keys(setup).length
        ? {
            ...setup,
            sourceType: "setup_assistant",
            namespace: "setup_assistant",
          }
        : body.onboarding === null || body.setup === null
          ? null
          : undefined,
    }),
  };
}

export async function startSetupAssistantSession(args = {}, deps = {}) {
  const result = await startOnboardingSession(args, deps);
  return mapLegacyResult(result);
}

export async function loadCurrentSetupAssistantSession(args = {}, deps = {}) {
  const result = await loadCurrentOnboardingSession(args, deps);
  return mapLegacyResult(result);
}

export async function updateSetupAssistantDraft(args = {}, deps = {}) {
  const result = await updateOnboardingDraft(args, deps);
  return mapLegacyResult(result);
}

export const __test__ = {
  buildSetupAssistantSessionPayload,
};
