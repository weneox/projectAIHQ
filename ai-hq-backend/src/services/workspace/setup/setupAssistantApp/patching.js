import { arr, compactDraftObject, mergeDraftState, obj, s } from "../draftShared.js";
import {
  parseHoursNote,
  parsePricingNote,
  sanitizeStructuredHours,
} from "../setupAssistantParser.js";
import { normalizeStoredSetupAssistantPayload } from "./sessionPayload.js";
import { normalizeQuestionKey } from "./questions.js";
import {
  buildRecognizedSourceCandidate,
  inferContactType,
  normalizeWebsiteUrl,
  nowIso,
  splitAnswerList,
  uniqueStrings,
} from "./shared.js";
import {
  buildAssistantSourceMetadataPatch,
  mergeSetupAssistantCore,
  mergeSourceMetadata,
  sanitizeAssistantState,
  sanitizeBusinessProfile,
  sanitizeContacts,
  sanitizeHandoffRules,
  sanitizePricingPosture,
  sanitizeProgress,
  sanitizeServices,
  sanitizeSourceMetadata,
} from "./sanitize.js";

function normalizeStep(value = "") {
  const raw = s(value).toLowerCase();
  const normalized = normalizeQuestionKey(raw);

  if (normalized) return normalized;
  if (raw === "profile") return "profile";
  if (raw === "website") return "company";
  return "";
}

function pickAliasedField(source = {}, aliases = []) {
  for (const key of aliases) {
    if (Object.prototype.hasOwnProperty.call(obj(source), key)) {
      return {
        provided: true,
        value: source[key],
      };
    }
  }

  return {
    provided: false,
    value: undefined,
  };
}

function resolvePatchRoot(body = {}) {
  const draft = obj(body.draft);
  if (Object.keys(draft).length) return draft;

  const setup = obj(body.setup);
  if (Object.keys(setup).length) return setup;

  return obj(body);
}

function extractWebsiteCandidate(text = "") {
  const candidate = buildRecognizedSourceCandidate(text);
  if (!candidate || candidate.type !== "website") return "";
  return candidate.value;
}

function stripRecognizedSourceFromText(text = "") {
  const value = s(text);
  const candidate = buildRecognizedSourceCandidate(value);
  if (!candidate?.raw) return value;

  return s(value.replace(candidate.raw, " ").replace(/\s{2,}/g, " "));
}

function splitProfileLines(text = "") {
  return String(text || "")
    .split(/\n+/)
    .map((item) => s(item))
    .filter(Boolean);
}

export function parseProfileAnswer(answer = "", current = {}) {
  const text = s(answer);
  const profile = obj(current.businessProfile);

  if (!text) return {};

  const websiteUrl = extractWebsiteCandidate(text);
  const stripped = stripRecognizedSourceFromText(text);
  const lines = splitProfileLines(stripped);
  const out = {};

  if (!profile.websiteUrl && websiteUrl) {
    out.websiteUrl = websiteUrl;
  }

  if (!lines.length) {
    return compactDraftObject(out);
  }

  if (lines.length >= 2) {
    if (!profile.companyName) {
      out.companyName = lines[0];
    }
    if (!profile.description) {
      out.description = lines.slice(1).join(" ");
    }
    return compactDraftObject(out);
  }

  const single = lines[0];
  const split = single
    .split(/\s[-–—:]\s/)
    .map((item) => s(item))
    .filter(Boolean);

  if (split.length >= 2) {
    if (!profile.companyName) {
      out.companyName = split[0];
    }
    if (!profile.description) {
      out.description = split.slice(1).join(" - ");
    }
    return compactDraftObject(out);
  }

  if (!profile.companyName && !profile.description) {
    out.description = single;
    return compactDraftObject(out);
  }

  if (!profile.companyName) {
    out.companyName = single;
  } else if (!profile.description) {
    out.description = single;
  }

  return compactDraftObject(out);
}

function buildContactsFromAnswer(answer = "") {
  const items = splitAnswerList(answer, 12).map((item, index) => ({
    type: inferContactType(item),
    label: index === 0 ? "Primary" : `Contact ${index + 1}`,
    value: item,
    preferred: index === 0,
    visibility: "public",
  }));

  return sanitizeContacts(items);
}

function buildHandoffFromAnswer(answer = "") {
  const text = s(answer);
  if (!text) return {};

  return sanitizeHandoffRules({
    enabled: true,
    summary: text,
    triggers: splitAnswerList(text, 24),
  });
}

function normalizeDirectPatchBody(body = {}) {
  const root = resolvePatchRoot(body);
  const out = {};

  const businessProfile = pickAliasedField(root, [
    "businessProfile",
    "business_profile",
  ]);
  if (businessProfile.provided) {
    out.businessProfile = sanitizeBusinessProfile(obj(businessProfile.value));
  }

  const services = pickAliasedField(root, ["services"]);
  if (services.provided) {
    out.services = sanitizeServices(services.value);
  }

  const contacts = pickAliasedField(root, ["contacts"]);
  if (contacts.provided) {
    out.contacts = sanitizeContacts(contacts.value);
  }

  const hours = pickAliasedField(root, ["hours"]);
  if (hours.provided) {
    out.hours = sanitizeStructuredHours(hours.value);
  }

  const pricingPosture = pickAliasedField(root, [
    "pricingPosture",
    "pricing_posture",
    "pricing",
  ]);
  if (pricingPosture.provided) {
    out.pricingPosture = sanitizePricingPosture(obj(pricingPosture.value));
  }

  const handoffRules = pickAliasedField(root, [
    "handoffRules",
    "handoff_rules",
    "handoff",
  ]);
  if (handoffRules.provided) {
    out.handoffRules = sanitizeHandoffRules(obj(handoffRules.value));
  }

  const sourceMetadata = pickAliasedField(root, [
    "sourceMetadata",
    "source_metadata",
  ]);
  if (sourceMetadata.provided) {
    out.sourceMetadata = sanitizeSourceMetadata(obj(sourceMetadata.value));
  }

  const assistantState = pickAliasedField(root, [
    "assistantState",
    "assistant_state",
  ]);
  if (assistantState.provided) {
    out.assistantState = sanitizeAssistantState(obj(assistantState.value));
  }

  const progress = pickAliasedField(root, ["progress"]);
  if (progress.provided) {
    out.progress = sanitizeProgress(obj(progress.value));
  }

  const languages = pickAliasedField(root, ["languages"]);
  if (languages.provided) {
    out.languages = uniqueStrings(arr(languages.value).map((item) => s(item)), 8);
  }

  const tone = pickAliasedField(root, ["tone"]);
  if (tone.provided) {
    out.tone = s(tone.value);
  }

  const greetingStyle = pickAliasedField(root, ["greetingStyle", "greeting_style"]);
  if (greetingStyle.provided) {
    out.greetingStyle = s(greetingStyle.value);
  }

  const afterHoursBehavior = pickAliasedField(root, [
    "afterHoursBehavior",
    "after_hours_behavior",
  ]);
  if (afterHoursBehavior.provided) {
    out.afterHoursBehavior = s(afterHoursBehavior.value);
  }

  return compactDraftObject(out);
}

export function isMessageSkip(body = {}) {
  return body?.skip === true || s(body?.intent).toLowerCase() === "skip";
}

export function normalizeSetupAssistantDraftPatchBody(body = {}) {
  return normalizeDirectPatchBody(body);
}

function mergeSkippedQuestions(existing = [], incoming = []) {
  return uniqueStrings(
    [...arr(existing), ...arr(incoming)].map((item) => normalizeStep(item)).filter(Boolean),
    32
  );
}

function resolveProgressState(existing = {}, patch = {}) {
  const existingProgress = obj(existing.progress);
  const patchProgress = obj(patch.progress);
  const existingAssistant = obj(existing.assistantState);
  const patchAssistant = obj(patch.assistantState);

  const currentQuestionKey = normalizeStep(
    s(patchProgress.currentQuestionKey) ||
      s(patchAssistant.activeSection) ||
      s(existingProgress.currentQuestionKey) ||
      s(existingAssistant.activeSection) ||
      ""
  );

  const lastAnsweredStep = normalizeStep(
    s(patchProgress.lastAnsweredStep) || s(existingProgress.lastAnsweredStep) || ""
  );

  return sanitizeProgress({
    ...existingProgress,
    ...patchProgress,
    skippedQuestions: mergeSkippedQuestions(
      existingProgress.skippedQuestions,
      patchProgress.skippedQuestions
    ),
    currentQuestionKey,
    lastAnsweredStep,
    updatedAt: s(patchProgress.updatedAt || nowIso()),
  });
}

function resolveAssistantState(existing = {}, patch = {}) {
  const existingAssistant = obj(existing.assistantState);
  const patchAssistant = obj(patch.assistantState);
  const patchProgress = obj(patch.progress);

  const activeSection = normalizeStep(
    s(patchAssistant.activeSection) ||
      s(patchProgress.currentQuestionKey) ||
      s(existingAssistant.activeSection) ||
      ""
  );

  const lastUpdatedSection = normalizeStep(
    s(patchAssistant.lastUpdatedSection) ||
      s(patchProgress.lastAnsweredStep) ||
      s(existingAssistant.lastUpdatedSection) ||
      activeSection
  );

  const activeBehaviorPolicy = "";

  return sanitizeAssistantState({
    ...existingAssistant,
    ...patchAssistant,
    activeSection,
    lastUpdatedSection,
    activeBehaviorPolicy,
  });
}

export function mergeSetupAssistantDraft(current = {}, patch = {}, seed = {}) {
  const existing = normalizeStoredSetupAssistantPayload(current, seed);
  const mergedCore = mergeSetupAssistantCore(existing, patch);

  const next = {
    ...mergedCore,
    progress: resolveProgressState(existing, patch),
    assistantState: resolveAssistantState(existing, patch),
  };

  return normalizeStoredSetupAssistantPayload(next, seed);
}

export function extractIncomingStep(body = {}) {
  return normalizeStep(s(body.step || body.questionKey || body.field));
}

export function extractIncomingMessage(body = {}) {
  return s(body.answer || body.message || body.text || body.value);
}

export function isMessageModeBody(body = {}) {
  const step = extractIncomingStep(body);
  const answer = extractIncomingMessage(body);
  return Boolean(step && (answer || isMessageSkip(body)));
}

function mergeStringLists(primary = [], secondary = [], limit = 24) {
  return uniqueStrings(
    [...arr(primary), ...arr(secondary)].map((item) => s(item)),
    limit
  );
}

function buildServicePatchFromAcceptedValues(values = [], currentServices = []) {
  const nextValues = mergeStringLists(
    arr(currentServices).map((item) => s(item?.title || item?.name || item?.label)),
    values,
    24
  );

  return sanitizeServices(
    nextValues.map((title) => ({
      title,
    }))
  );
}

function buildContactPatchFromAcceptedValues(values = [], currentContacts = []) {
  const nextValues = mergeStringLists(
    arr(currentContacts).map((item) => s(item?.value || item?.label || item?.type)),
    values,
    24
  );

  if (!nextValues.length) return [];
  return buildContactsFromAnswer(nextValues.join("; "));
}

function buildHoursPatchFromAcceptedValues(values = [], currentHours = []) {
  const nextValues = uniqueStrings(
    arr(values).map((item) => s(item)).filter(Boolean),
    12
  );
  if (!nextValues.length) return currentHours;
  return parseHoursNote(nextValues.join("; "), currentHours);
}

function buildSourceMetadataPatchFromAcceptedIdentity(
  identity = {},
  currentSourceMetadata = {}
) {
  const websiteUrl = normalizeWebsiteUrl(s(identity.websiteUrl));
  if (!websiteUrl) return {};

  return buildAssistantSourceMetadataPatch(
    "website",
    websiteUrl,
    currentSourceMetadata
  );
}

function resolveNextStepFromTurn(turn = {}, currentDraft = {}) {
  const safeTurn = obj(turn);
  const latestUserInput = obj(safeTurn.latestUserInput);
  const nextQuestion = obj(safeTurn.nextQuestion);
  const currentProgress = obj(currentDraft.progress);

  return normalizeStep(
    s(nextQuestion.step || nextQuestion.key) ||
      s(latestUserInput.step) ||
      s(currentProgress.currentQuestionKey) ||
      ""
  );
}

export function buildSetupAssistantPatchFromAcceptedPatch(turn = {}, current = {}) {
  const safeTurn = obj(turn);
  const acceptedPatch = obj(safeTurn.acceptedPatch);
  const acceptedIdentity = obj(acceptedPatch.identity);
  const currentDraft = normalizeStoredSetupAssistantPayload(current, current);

  const nextServices = buildServicePatchFromAcceptedValues(
    arr(acceptedPatch.services),
    currentDraft.services
  );

  const nextContacts = buildContactPatchFromAcceptedValues(
    arr(acceptedPatch.contacts),
    currentDraft.contacts
  );

  const nextHours = buildHoursPatchFromAcceptedValues(
    arr(acceptedPatch.hours),
    currentDraft.hours
  );

  const pricingText = s(acceptedPatch.pricingPosture);
  const handoffText = s(acceptedPatch.humanHandoff);

  const partialPatch = compactDraftObject({
    businessProfile: sanitizeBusinessProfile({
      ...obj(currentDraft.businessProfile),
      companyName: s(
        acceptedIdentity.businessName ||
          obj(currentDraft.businessProfile).companyName
      ),
      description: s(
        acceptedIdentity.description ||
          obj(currentDraft.businessProfile).description
      ),
      websiteUrl: normalizeWebsiteUrl(
        s(
          acceptedIdentity.websiteUrl ||
            obj(currentDraft.businessProfile).websiteUrl
        )
      ),
    }),
    services: nextServices,
    contacts: nextContacts,
    hours: nextHours,
    pricingPosture: pricingText
      ? sanitizePricingPosture({
          ...obj(
            parsePricingNote(
              pricingText,
              currentDraft.pricingPosture,
              nextServices.length ? nextServices : currentDraft.services
            )
          ),
          publicSummary: pricingText,
        })
      : currentDraft.pricingPosture,
    handoffRules: handoffText
      ? buildHandoffFromAnswer(handoffText)
      : currentDraft.handoffRules,
    sourceMetadata: mergeSourceMetadata(
      currentDraft.sourceMetadata,
      buildSourceMetadataPatchFromAcceptedIdentity(
        acceptedIdentity,
        currentDraft.sourceMetadata
      )
    ),
  });

  const lastAnsweredStep = normalizeStep(
    s(obj(safeTurn.latestUserInput).step).toLowerCase()
  );
  const nextStep = resolveNextStepFromTurn(safeTurn, currentDraft);

  return compactDraftObject({
    ...partialPatch,
    assistantState: {
      activeSection: nextStep,
      activeBehaviorPolicy: "",
      lastUpdatedSection: nextStep || lastAnsweredStep,
    },
    progress: {
      lastAnsweredStep,
      currentQuestionKey: nextStep,
      updatedAt: nowIso(),
    },
  });
}

export function buildSetupAssistantPatchFromOrchestrator(turn = {}, current = {}) {
  return buildSetupAssistantPatchFromAcceptedPatch(turn, current);
}
