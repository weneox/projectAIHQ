import {
  buildSavedBusinessPayload,
  buildSavedRuntimePayload,
  normalizeBusinessProfileInput,
  normalizeRuntimePreferencesInput,
} from "../mutations/normalize.js";
import {
  arr,
  compactDraftObject,
  getOrCreateSetupDraftSession,
  mergeDraftState,
  obj,
  s,
} from "./draftShared.js";

export function buildBusinessProfileDraftPatch(body = {}, currentDraft = {}) {
  const { normalized, provided, providedKeys } = normalizeBusinessProfileInput(body);
  if (!providedKeys.length) {
    throw new Error("No business profile fields were provided");
  }

  const existingProfile = obj(currentDraft.businessProfile);
  const existingCapabilities = obj(currentDraft.capabilities);

  const nextBusinessProfile = { ...existingProfile };
  const nextCapabilities = { ...existingCapabilities };

  if (provided.companyName) nextBusinessProfile.companyName = normalized.companyName;
  if (provided.description) nextBusinessProfile.description = normalized.description;
  if (provided.timezone) nextBusinessProfile.timezone = normalized.timezone;
  if (provided.languages) {
    nextBusinessProfile.languages = arr(normalized.languages);
    nextCapabilities.supportedLanguages = arr(normalized.languages);
    nextCapabilities.primaryLanguage = s(normalized.languages?.[0]);
    nextCapabilities.supportsMultilanguage = arr(normalized.languages).length > 1;
  }
  if (provided.tone) {
    nextBusinessProfile.tone = normalized.tone;
    nextCapabilities.toneProfile = normalized.tone;
  }

  return {
    saved: buildSavedBusinessPayload(normalized, {
      companyName: s(nextBusinessProfile.companyName),
      timezone: s(nextBusinessProfile.timezone),
      enabledLanguages: arr(nextBusinessProfile.languages),
    }),
    patch: {
      businessProfile: compactDraftObject(nextBusinessProfile),
      capabilities: compactDraftObject(nextCapabilities),
      draftPayload: mergeDraftState(obj(currentDraft.draftPayload), {
        stagedInputs: {
          businessProfile: compactDraftObject({
            companyName: provided.companyName ? normalized.companyName : undefined,
            description: provided.description ? normalized.description : undefined,
            timezone: provided.timezone ? normalized.timezone : undefined,
            languages: provided.languages ? arr(normalized.languages) : undefined,
            tone: provided.tone ? normalized.tone : undefined,
          }),
        },
      }),
    },
  };
}

export function buildRuntimePreferencesDraftPatch(body = {}, currentDraft = {}) {
  const { normalized, provided, providedKeys } = normalizeRuntimePreferencesInput(body);
  if (!providedKeys.length) {
    throw new Error("No runtime preference fields were provided");
  }

  const existingProfile = obj(currentDraft.businessProfile);
  const existingCapabilities = obj(currentDraft.capabilities);
  const existingPayload = obj(currentDraft.draftPayload);

  const nextBusinessProfile = { ...existingProfile };
  const nextCapabilities = { ...existingCapabilities };

  if (provided.defaultLanguage) {
    nextCapabilities.primaryLanguage = normalized.defaultLanguage;
    nextBusinessProfile.defaultLanguage = normalized.defaultLanguage;
  }
  if (provided.languages) {
    nextCapabilities.supportedLanguages = arr(normalized.languages);
    nextCapabilities.supportsMultilanguage = arr(normalized.languages).length > 1;
    nextBusinessProfile.languages = arr(normalized.languages);
  }
  if (provided.tone) {
    nextBusinessProfile.tone = normalized.tone;
    nextCapabilities.toneProfile = normalized.tone;
  }
  if (provided.replyStyle) nextCapabilities.replyStyle = normalized.replyStyle;
  if (provided.replyLength) nextCapabilities.replyLength = normalized.replyLength;
  if (provided.emojiLevel) nextCapabilities.emojiLevel = normalized.emojiLevel;
  if (provided.ctaStyle) nextCapabilities.ctaStyle = normalized.ctaStyle;

  return {
    saved: buildSavedRuntimePayload(normalized, {
      defaultLanguage: s(nextCapabilities.primaryLanguage),
      enabledLanguages: arr(nextCapabilities.supportedLanguages),
    }),
    patch: {
      businessProfile: compactDraftObject(nextBusinessProfile),
      capabilities: compactDraftObject(nextCapabilities),
      draftPayload: mergeDraftState(existingPayload, {
        stagedInputs: {
          runtimePreferences: compactDraftObject({
            defaultLanguage:
              provided.defaultLanguage ? normalized.defaultLanguage : undefined,
            languages: provided.languages ? arr(normalized.languages) : undefined,
            tone: provided.tone ? normalized.tone : undefined,
            autoReplyEnabled:
              provided.autoReplyEnabled ? normalized.autoReplyEnabled : undefined,
            humanApprovalRequired:
              provided.humanApprovalRequired
                ? normalized.humanApprovalRequired
                : undefined,
            inboxApprovalMode:
              provided.inboxApprovalMode ? normalized.inboxApprovalMode : undefined,
            commentApprovalMode:
              provided.commentApprovalMode ? normalized.commentApprovalMode : undefined,
            replyStyle: provided.replyStyle ? normalized.replyStyle : undefined,
            replyLength: provided.replyLength ? normalized.replyLength : undefined,
            emojiLevel: provided.emojiLevel ? normalized.emojiLevel : undefined,
            ctaStyle: provided.ctaStyle ? normalized.ctaStyle : undefined,
            policies: provided.policies ? obj(normalized.policies) : undefined,
          }),
        },
      }),
    },
  };
}

async function stageSetupDraftMutation({
  db,
  actor,
  body = {},
  buildPatch,
  patchSetupReviewDraft,
  loadCurrentReviewPayload,
  getOrCreateSetupDraftSession: loadOrCreateSession = getOrCreateSetupDraftSession,
}) {
  const current = await loadOrCreateSession(actor);
  const staged = buildPatch(body, current?.draft || {});

  const draft = await patchSetupReviewDraft({
    sessionId: current.session.id,
    tenantId: actor.tenantId,
    patch: staged.patch,
    bumpVersion: true,
  });

  const data = await loadCurrentReviewPayload({
    db,
    actor,
    eventLimit: 30,
  });

  return {
    current,
    staged,
    draft,
    data,
  };
}

export async function stageSetupBusinessProfileMutation(args = {}) {
  return stageSetupDraftMutation({
    ...args,
    buildPatch: buildBusinessProfileDraftPatch,
  });
}

export async function stageSetupRuntimePreferencesMutation(args = {}) {
  return stageSetupDraftMutation({
    ...args,
    buildPatch: buildRuntimePreferencesDraftPatch,
  });
}
