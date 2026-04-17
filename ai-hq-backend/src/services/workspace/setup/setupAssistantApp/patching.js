import { arr, compactDraftObject, mergeDraftState, obj, s } from "../draftShared.js";
import {
  parseHoursNote,
  parsePricingNote,
  parseServicesNote,
  sanitizeStructuredHours,
} from "../setupAssistantParser.js";
import {
  buildStoredSetupAssistantPayload,
  normalizeStoredSetupAssistantPayload,
} from "./sessionPayload.js";
import {
  INTENT_ONLY_RESPONSES,
  normalizeQuestionKey,
} from "./questions.js";
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

function resolveDraftLocale(current = {}, seed = {}) {
  const currentDraft = normalizeStoredSetupAssistantPayload(current, seed);
  return s(arr(currentDraft.languages)[0] || "az-AZ");
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
    const words = single.split(/\s+/).filter(Boolean);

    if (words.length <= 6 && !/[.!?]/.test(single)) {
      out.companyName = single;
    } else {
      out.description = single;
    }

    return compactDraftObject(out);
  }

  if (!profile.companyName) {
    out.companyName = single;
  } else if (!profile.description) {
    out.description = single;
  }

  return compactDraftObject(out);
}

function buildAllDayHoursPatch() {
  return sanitizeStructuredHours(
    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(
      (day) => ({
        day,
        enabled: true,
        closed: false,
        allDay: true,
        appointmentOnly: false,
        openTime: "",
        closeTime: "",
        notes: "",
      })
    )
  );
}

function buildAppointmentOnlyHoursPatch() {
  return sanitizeStructuredHours(
    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(
      (day) => ({
        day,
        enabled: false,
        closed: false,
        allDay: false,
        appointmentOnly: true,
        openTime: "",
        closeTime: "",
        notes: "Appointment only",
      })
    )
  );
}

function buildStepIntentPatch(step = "") {
  const safeStep = normalizeStep(step);
  if (!safeStep) return {};

  return compactDraftObject({
    progress: {
      currentQuestionKey: safeStep,
      updatedAt: nowIso(),
    },
    assistantState: {
      activeSection: safeStep,
    },
  });
}

export function resolveIntentOnlyPatch(step = "", answer = "", current = {}) {
  void current;

  const safeStep = normalizeStep(step);
  const normalizedAnswer = s(answer).toLowerCase();
  const intent = INTENT_ONLY_RESPONSES[normalizedAnswer];

  if (!intent) return {};

  if (intent === "__skip__") {
    return compactDraftObject({
      progress: {
        skippedQuestions: [safeStep || "services"],
        lastAnsweredStep: safeStep || "services",
        currentQuestionKey: safeStep || "services",
        updatedAt: nowIso(),
      },
      assistantState: {
        activeSection: safeStep || "services",
      },
    });
  }

  if (intent === "__continue__") {
    return buildStepIntentPatch(safeStep || "company");
  }

  if (intent === "__always_open__") {
    return compactDraftObject({
      hours: buildAllDayHoursPatch(),
      assistantState: {
        activeSection: "hours",
        lastUpdatedSection: "hours",
      },
      progress: {
        lastAnsweredStep: "hours",
        currentQuestionKey: "hours",
        updatedAt: nowIso(),
      },
    });
  }

  if (intent === "__appointment_only__") {
    return compactDraftObject({
      hours: buildAppointmentOnlyHoursPatch(),
      assistantState: {
        activeSection: "hours",
        lastUpdatedSection: "hours",
      },
      progress: {
        lastAnsweredStep: "hours",
        currentQuestionKey: "hours",
        updatedAt: nowIso(),
      },
    });
  }

  if (intent === "__quote_required__") {
    return compactDraftObject({
      pricingPosture: sanitizePricingPosture({
        pricingMode: "quote_required",
        publicSummary: "Exact pricing requires a quote.",
        requiresOperatorForExactQuote: true,
        allowPublicPriceReplies: false,
      }),
      assistantState: {
        activeSection: "pricing",
        lastUpdatedSection: "pricing",
      },
      progress: {
        lastAnsweredStep: "pricing",
        currentQuestionKey: "pricing",
        updatedAt: nowIso(),
      },
    });
  }

  return {};
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

function normalizeDirectPatchBody(body = {}) {
  const root = obj(body?.draft)
    ? obj(body.draft)
    : obj(body?.setup)
      ? obj(body.setup)
      : obj(body);

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

function buildSourceCandidateFromAnswer(answer = "") {
  const text = s(answer);
  if (!text) return null;

  if (/^@[\w.]{1,30}$/i.test(text)) {
    return {
      type: "instagram",
      value: `https://instagram.com/${text.replace(/^@/, "")}`,
      raw: text,
    };
  }

  return buildRecognizedSourceCandidate(text);
}

export function patchFromAnswer(step = "", answer = "", current = {}) {
  const key = normalizeStep(step);
  const text = s(answer);
  const currentDraft = obj(current);

  if (!key || !text) return {};

  const sourceCandidate = buildSourceCandidateFromAnswer(text);
  const sourceMetadataPatch = sourceCandidate
    ? buildAssistantSourceMetadataPatch(
        sourceCandidate.type,
        sourceCandidate.value,
        currentDraft.sourceMetadata
      )
    : {};

  switch (key) {
    case "profile":
      return compactDraftObject({
        businessProfile: parseProfileAnswer(text, currentDraft),
        sourceMetadata: sourceMetadataPatch,
        assistantState: {
          lastUpdatedSection: "company",
          activeSection: "company",
        },
      });

    case "company": {
      const parsedProfile = parseProfileAnswer(text, currentDraft);
      return compactDraftObject({
        businessProfile: {
          ...obj(parsedProfile),
          companyName: s(obj(parsedProfile).companyName || text),
        },
        sourceMetadata: sourceMetadataPatch,
        assistantState: {
          lastUpdatedSection: "company",
          activeSection: "company",
        },
      });
    }

    case "description":
      return compactDraftObject({
        businessProfile: {
          description: text,
        },
        assistantState: {
          lastUpdatedSection: "description",
          activeSection: "description",
        },
      });

    case "services":
      return compactDraftObject({
        services: parseServicesNote(text, currentDraft.services),
        assistantState: {
          lastParsedServicesNote: text,
          lastUpdatedSection: "services",
          activeSection: "services",
        },
      });

    case "contacts":
      return compactDraftObject({
        contacts: buildContactsFromAnswer(text),
        sourceMetadata:
          sourceCandidate?.type && sourceCandidate?.type !== "website"
            ? sourceMetadataPatch
            : {},
        assistantState: {
          lastUpdatedSection: "contacts",
          activeSection: "contacts",
        },
      });

    case "hours":
      return compactDraftObject({
        hours: parseHoursNote(text, currentDraft.hours),
        assistantState: {
          lastParsedHoursNote: text,
          lastUpdatedSection: "hours",
          activeSection: "hours",
        },
      });

    case "pricing":
      return compactDraftObject({
        pricingPosture: parsePricingNote(
          text,
          currentDraft.pricingPosture,
          currentDraft.services
        ),
        assistantState: {
          lastParsedPricingNote: text,
          lastUpdatedSection: "pricing",
          activeSection: "pricing",
        },
      });

    case "handoff":
      return compactDraftObject({
        handoffRules: buildHandoffFromAnswer(text),
        assistantState: {
          lastUpdatedSection: "handoff",
          activeSection: "handoff",
        },
      });

    default:
      return compactDraftObject({
        sourceMetadata: sourceMetadataPatch,
      });
  }
}

function normalizeAnswerPatchBody(body = {}, current = {}) {
  const rawStep = s(body.step || body.questionKey || body.field).toLowerCase();
  const answer = s(body.answer || body.message || body.text || body.value);
  const step = normalizeStep(rawStep);

  if (isMessageSkip(body)) {
    if (!step) return {};
    return {
      progress: {
        skippedQuestions: [step],
        lastAnsweredStep: step,
        currentQuestionKey: step,
        updatedAt: nowIso(),
      },
      assistantState: {
        activeSection: step,
      },
    };
  }

  const intentOnlyPatch = resolveIntentOnlyPatch(step, answer, current);
  if (Object.keys(intentOnlyPatch).length > 0) {
    return intentOnlyPatch;
  }

  const answerPatch = patchFromAnswer(step, answer, current);
  if (!Object.keys(answerPatch).length) return {};

  const activeSection =
    s(obj(answerPatch.assistantState).activeSection) || step || "company";

  return compactDraftObject({
    ...answerPatch,
    progress: {
      lastAnsweredStep: step,
      currentQuestionKey: activeSection,
      updatedAt: nowIso(),
    },
  });
}

export function normalizeSetupAssistantDraftPatchBody(body = {}, current = {}) {
  const directPatch = normalizeDirectPatchBody(body);
  const answerPatch = normalizeAnswerPatchBody(body, current);
  return mergeDraftState(directPatch, answerPatch);
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

  return sanitizeAssistantState({
    ...existingAssistant,
    ...patchAssistant,
    activeSection,
    lastUpdatedSection,
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

  return buildStoredSetupAssistantPayload(next, seed);
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

  if (!nextValues.length) return [];

  return parseServicesNote(nextValues.join("; "), currentServices);
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
  const acceptedAiBehavior = obj(acceptedPatch.aiBehavior);
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
    languages: mergeStringLists(
      currentDraft.languages,
      acceptedAiBehavior.languages,
      8
    ),
    tone: s(acceptedAiBehavior.tone || currentDraft.tone),
    greetingStyle: s(
      acceptedAiBehavior.greetingStyle || currentDraft.greetingStyle
    ),
    afterHoursBehavior: s(
      acceptedAiBehavior.afterHoursBehavior || currentDraft.afterHoursBehavior
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