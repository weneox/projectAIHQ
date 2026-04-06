// ai-hq-backend/src/services/workspace/setup/onboardingApp.js

import {
  getCurrentSetupReview,
  getOrCreateActiveSetupReviewSession,
  patchSetupReviewDraft,
  updateSetupReviewSession,
} from "../../../db/helpers/tenantSetupReview.js";
import {
  arr,
  compactDraftObject,
  mergeDraftState,
  obj,
  s,
  safeUuidOrNull,
} from "./draftShared.js";
import { auditSetupAction } from "./auditApp.js";

const REVIEW_MESSAGE =
  "Draft answers stay separate from approved truth and the strict runtime until a later approval step is completed.";

const ONBOARDING_NAMESPACE = "onboarding";
const ONBOARDING_SOURCE_TYPE = "onboarding";
const ONBOARDING_CURRENT_STEP = "onboarding";

const ONBOARDING_QUESTIONS = [
  {
    key: "website",
    label: "Website",
    prompt: "Saytın var?",
    placeholder: "https://yourbusiness.com",
  },
  {
    key: "company",
    label: "Business",
    prompt: "Biznes adı nədir?",
    placeholder: "NEOX AI",
  },
  {
    key: "description",
    label: "About",
    prompt: "Nə iş görürsən?",
    placeholder: "Bir cümlə ilə yaz",
  },
  {
    key: "services",
    label: "Services",
    prompt: "Əsas xidmətlərin hansılardır?",
    placeholder: "Məs: dizayn, quraşdırma, servis",
  },
  {
    key: "contact",
    label: "Contact",
    prompt: "Müştəri sənə necə çatsın?",
    placeholder: "Telefon, WhatsApp, email və s.",
  },
  {
    key: "hours",
    label: "Hours",
    prompt: "İş saatların necədir?",
    placeholder: "Məs: Hər gün 09:00-19:00",
  },
  {
    key: "pricing",
    label: "Pricing",
    prompt: "Qiymət barədə necə cavab verək?",
    placeholder: "Məs: qiymət üçün yazın / starting from 50 AZN",
  },
  {
    key: "handoff",
    label: "Handoff",
    prompt: "Bot səni hansı hallarda çağırsın?",
    placeholder: "Məs: şikayət, təcili sifariş, böyük qiymət sorğusu",
  },
];

function nowIso() {
  return new Date().toISOString();
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(obj(value), key);
}

function slugify(value = "") {
  return s(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeStringArray(value = [], limit = 24) {
  return arr(value)
    .map((item) => s(item))
    .filter(Boolean)
    .slice(0, limit);
}

function uniqueStrings(value = [], limit = 24) {
  return Array.from(new Set(normalizeStringArray(value, limit))).slice(0, limit);
}

function normalizeWebsiteUrl(value = "") {
  const raw = s(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.includes(".") && !raw.includes(" ")) {
    return `https://${raw}`;
  }
  return raw;
}

function splitAnswerList(value = "", limit = 24) {
  return String(value || "")
    .split(/\n|,|;|\u2022|- /g)
    .map((item) => s(item))
    .filter(Boolean)
    .slice(0, limit);
}

function inferContactType(value = "") {
  const text = s(value).toLowerCase();
  if (!text) return "";
  if (text.includes("@")) return "email";
  if (
    text.includes("http") ||
    text.includes("www.") ||
    text.includes("instagram.com")
  ) {
    return "link";
  }
  if (/[0-9+() -]{6,}/.test(text)) return "phone";
  return "primary";
}

function sanitizeBusinessProfile(value = {}) {
  const source = obj(value);
  return compactDraftObject({
    companyName: s(source.companyName || source.company_name),
    description: s(source.description || source.summary),
    websiteUrl: normalizeWebsiteUrl(
      source.websiteUrl || source.website_url || source.website
    ),
  });
}

function sanitizeServiceItem(value = {}) {
  const source = obj(value);
  const title = s(source.title || source.name || source.label);
  const summary = s(
    source.summary || source.description || source.detail || source.notes
  );
  const priceLabel = s(
    source.priceLabel ||
      source.price_label ||
      source.price ||
      source.priceRange
  );
  const category = s(source.category);

  if (!title && !summary && !priceLabel && !category) return null;

  return compactDraftObject({
    key:
      s(source.key || source.serviceKey || source.service_key) ||
      slugify(title || summary || category),
    title,
    summary,
    category,
    priceLabel,
  });
}

function sanitizeServices(value = []) {
  return arr(value)
    .map(sanitizeServiceItem)
    .filter(Boolean)
    .slice(0, 100);
}

function sanitizeContactItem(value = {}) {
  const source = obj(value);
  const type = s(source.type || source.channel).toLowerCase();
  const label = s(source.label || source.title);
  const entryValue = s(source.value || source.contact || source.address);

  if (!type && !label && !entryValue) return null;

  return compactDraftObject({
    type,
    label,
    value: entryValue,
    preferred: source.preferred === true,
    visibility: s(source.visibility || source.scope).toLowerCase(),
  });
}

function sanitizeContacts(value = []) {
  return arr(value)
    .map(sanitizeContactItem)
    .filter(Boolean)
    .slice(0, 100);
}

function sanitizeHoursItem(value = {}) {
  const source = obj(value);
  const day = s(source.day || source.label);
  const open = s(source.open || source.opensAt || source.opens_at);
  const close = s(source.close || source.closesAt || source.closes_at);
  const notes = s(source.notes || source.summary);
  const closed = source.closed === true;

  if (!day && !open && !close && !notes && !closed) return null;

  return compactDraftObject({
    day,
    open,
    close,
    closed,
    notes,
  });
}

function sanitizeHours(value = []) {
  return arr(value)
    .map(sanitizeHoursItem)
    .filter(Boolean)
    .slice(0, 32);
}

function sanitizePricingPosture(value = {}) {
  const source = obj(value);
  return compactDraftObject({
    mode: s(source.mode || source.posture || source.model).toLowerCase(),
    summary: s(source.summary || source.description || source.notes),
    startingAt: s(source.startingAt || source.starting_at || source.priceFrom),
    currency: s(source.currency).toUpperCase(),
  });
}

function sanitizeHandoffRules(value = {}) {
  const source = obj(value);
  return compactDraftObject({
    enabled:
      source.enabled === true ||
      Boolean(
        s(source.summary || source.description || source.notes) ||
          arr(source.triggers).length
      ),
    summary: s(source.summary || source.description || source.notes),
    triggers: uniqueStrings(source.triggers, 24),
    channels: uniqueStrings(source.channels, 12),
    escalationTarget: s(
      source.escalationTarget || source.escalation_target || source.target
    ),
  });
}

function sanitizeProgress(value = {}) {
  const source = obj(value);
  return compactDraftObject({
    skippedQuestions: uniqueStrings(source.skippedQuestions, 32),
    lastAnsweredStep: s(source.lastAnsweredStep).toLowerCase(),
    currentQuestionKey: s(source.currentQuestionKey).toLowerCase(),
    updatedAt: source.updatedAt || null,
  });
}

function buildServicesFromAnswer(answer = "") {
  return splitAnswerList(answer, 24).map((title) => ({
    key: slugify(title),
    title,
  }));
}

function buildContactsFromAnswer(answer = "") {
  const text = s(answer);
  if (!text) return [];
  return [
    {
      type: inferContactType(text),
      label: "Primary",
      value: text,
      preferred: true,
      visibility: "public",
    },
  ];
}

function buildHoursFromAnswer(answer = "") {
  const text = s(answer);
  if (!text) return [];
  return [
    {
      day: "general",
      notes: text,
    },
  ];
}

function patchFromAnswer(step = "", answer = "") {
  const key = s(step).toLowerCase();
  const text = s(answer);

  if (!key || !text) return {};

  switch (key) {
    case "website":
      return {
        businessProfile: {
          websiteUrl: normalizeWebsiteUrl(text),
        },
      };
    case "company":
      return {
        businessProfile: {
          companyName: text,
        },
      };
    case "description":
      return {
        businessProfile: {
          description: text,
        },
      };
    case "services":
      return {
        services: buildServicesFromAnswer(text),
      };
    case "contact":
      return {
        contacts: buildContactsFromAnswer(text),
      };
    case "hours":
      return {
        hours: buildHoursFromAnswer(text),
      };
    case "pricing":
      return {
        pricingPosture: {
          summary: text,
        },
      };
    case "handoff":
      return {
        handoffRules: {
          summary: text,
          triggers: splitAnswerList(text, 24),
        },
      };
    default:
      return {};
  }
}

function isMessageSkip(body = {}) {
  return body?.skip === true || s(body?.intent).toLowerCase() === "skip";
}

function mergePatchObjects(left = {}, right = {}) {
  const a = obj(left);
  const b = obj(right);

  return compactDraftObject({
    businessProfile:
      a.businessProfile !== undefined || b.businessProfile !== undefined
        ? {
            ...obj(a.businessProfile),
            ...obj(b.businessProfile),
          }
        : undefined,
    services: b.services !== undefined ? b.services : a.services,
    contacts: b.contacts !== undefined ? b.contacts : a.contacts,
    hours: b.hours !== undefined ? b.hours : a.hours,
    pricingPosture:
      a.pricingPosture !== undefined || b.pricingPosture !== undefined
        ? {
            ...obj(a.pricingPosture),
            ...obj(b.pricingPosture),
          }
        : undefined,
    handoffRules:
      a.handoffRules !== undefined || b.handoffRules !== undefined
        ? {
            ...obj(a.handoffRules),
            ...obj(b.handoffRules),
          }
        : undefined,
    progress:
      a.progress !== undefined || b.progress !== undefined
        ? {
            ...obj(a.progress),
            ...obj(b.progress),
          }
        : undefined,
  });
}

function deriveWebsitePrefillDraft(core = {}) {
  const businessProfile = obj(core.businessProfile);
  const websiteUrl = s(businessProfile.websiteUrl);

  return {
    supported: true,
    mode: "manual_url",
    status: websiteUrl ? "captured" : "awaiting_input",
    websiteUrl,
    scanSuggested: Boolean(websiteUrl),
  };
}

function buildSummary(draft = {}) {
  const businessProfile = obj(draft.businessProfile);
  const pricingPosture = obj(draft.pricingPosture);
  const handoffRules = obj(draft.handoffRules);

  const completed = {
    website: Boolean(s(businessProfile.websiteUrl)),
    company: Boolean(s(businessProfile.companyName)),
    description: Boolean(s(businessProfile.description)),
    services: arr(draft.services).length > 0,
    contact: arr(draft.contacts).length > 0,
    hours: arr(draft.hours).length > 0,
    pricing: Boolean(Object.keys(pricingPosture).length),
    handoff: Boolean(Object.keys(handoffRules).length),
  };

  const completedCount = Object.values(completed).filter(Boolean).length;
  const coreComplete =
    completed.company &&
    completed.description &&
    (completed.website || completed.contact);

  return {
    completed,
    completedCount,
    totalSteps: ONBOARDING_QUESTIONS.length,
    hasAnyDraft: completedCount > 0,
    coreComplete,
    hasWebsite: completed.website,
    hasServices: completed.services,
    hasContacts: completed.contact,
    hasHours: completed.hours,
  };
}

function buildReviewState(draft = {}, summary = {}) {
  return {
    status: summary.hasAnyDraft ? "draft_in_progress" : "awaiting_input",
    readyForReview: summary.coreComplete === true,
    readyForApproval: false,
    message:
      summary.coreComplete === true
        ? "Review hazırdır. Aktivləşmə sonrakı mərhələdir."
        : REVIEW_MESSAGE,
  };
}

function buildStoredOnboardingPayload(value = {}) {
  const core = {
    businessProfile: sanitizeBusinessProfile(
      obj(value.businessProfile || value.business_profile)
    ),
    services: sanitizeServices(value.services),
    contacts: sanitizeContacts(value.contacts),
    hours: sanitizeHours(value.hours),
    pricingPosture: sanitizePricingPosture(
      obj(value.pricingPosture || value.pricing_posture || value.pricing)
    ),
    handoffRules: sanitizeHandoffRules(
      obj(value.handoffRules || value.handoff_rules || value.handoff)
    ),
  };

  const summary = buildSummary(core);

  return {
    ...core,
    progress: sanitizeProgress(value.progress),
    websitePrefill: deriveWebsitePrefillDraft(core),
    review: buildReviewState(core, summary),
    namespace: ONBOARDING_NAMESPACE,
    sourceType: ONBOARDING_SOURCE_TYPE,
  };
}

function normalizeStoredOnboardingPayload(value = {}) {
  return buildStoredOnboardingPayload(obj(value));
}

function pickAliasedField(source = {}, aliases = []) {
  for (const key of aliases) {
    if (hasOwn(source, key)) {
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
    : obj(body?.onboarding)
      ? obj(body.onboarding)
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
    out.hours = sanitizeHours(hours.value);
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

  return compactDraftObject(out);
}

function normalizeAnswerPatchBody(body = {}) {
  const step = s(body.step || body.questionKey || body.field).toLowerCase();
  const answer = s(body.answer || body.message || body.text || body.value);

  if (isMessageSkip(body)) {
    if (!step) return {};
    return {
      progress: {
        skippedQuestions: [step],
        lastAnsweredStep: step,
        currentQuestionKey: step,
        updatedAt: nowIso(),
      },
    };
  }

  const answerPatch = patchFromAnswer(step, answer);
  if (!Object.keys(answerPatch).length) return {};

  return compactDraftObject({
    ...answerPatch,
    progress: {
      lastAnsweredStep: step,
      currentQuestionKey: step,
      updatedAt: nowIso(),
    },
  });
}

export function normalizeOnboardingDraftPatchBody(body = {}) {
  const directPatch = normalizeDirectPatchBody(body);
  const answerPatch = normalizeAnswerPatchBody(body);
  return mergePatchObjects(directPatch, answerPatch);
}

function removeSkippedIfAnswered(skipped = [], patch = {}) {
  const nextSkipped = new Set(arr(skipped).map((item) => s(item).toLowerCase()));

  if (patch.businessProfile?.websiteUrl) nextSkipped.delete("website");
  if (patch.businessProfile?.companyName) nextSkipped.delete("company");
  if (patch.businessProfile?.description) nextSkipped.delete("description");
  if (patch.services !== undefined && arr(patch.services).length > 0)
    nextSkipped.delete("services");
  if (patch.contacts !== undefined && arr(patch.contacts).length > 0)
    nextSkipped.delete("contact");
  if (patch.hours !== undefined && arr(patch.hours).length > 0)
    nextSkipped.delete("hours");
  if (
    patch.pricingPosture !== undefined &&
    Object.keys(obj(patch.pricingPosture)).length > 0
  ) {
    nextSkipped.delete("pricing");
  }
  if (
    patch.handoffRules !== undefined &&
    Object.keys(obj(patch.handoffRules)).length > 0
  ) {
    nextSkipped.delete("handoff");
  }

  return Array.from(nextSkipped);
}

export function mergeOnboardingDraft(current = {}, patch = {}) {
  const existing = normalizeStoredOnboardingPayload(current);
  const existingProgress = obj(existing.progress);
  const patchProgress = obj(patch.progress);

  const mergedSkipped = uniqueStrings(
    [
      ...arr(existingProgress.skippedQuestions),
      ...arr(patchProgress.skippedQuestions),
    ],
    32
  );

  const normalizedSkipped = removeSkippedIfAnswered(mergedSkipped, patch);
  const nextQuestionKey =
    s(patchProgress.currentQuestionKey) ||
    s(existingProgress.currentQuestionKey) ||
    s(patchProgress.lastAnsweredStep) ||
    s(existingProgress.lastAnsweredStep);

  const next = {
    businessProfile:
      patch.businessProfile !== undefined
        ? sanitizeBusinessProfile({
            ...obj(existing.businessProfile),
            ...obj(patch.businessProfile),
          })
        : existing.businessProfile,
    services:
      patch.services !== undefined
        ? sanitizeServices(patch.services)
        : existing.services,
    contacts:
      patch.contacts !== undefined
        ? sanitizeContacts(patch.contacts)
        : existing.contacts,
    hours:
      patch.hours !== undefined ? sanitizeHours(patch.hours) : existing.hours,
    pricingPosture:
      patch.pricingPosture !== undefined
        ? sanitizePricingPosture({
            ...obj(existing.pricingPosture),
            ...obj(patch.pricingPosture),
          })
        : existing.pricingPosture,
    handoffRules:
      patch.handoffRules !== undefined
        ? sanitizeHandoffRules({
            ...obj(existing.handoffRules),
            ...obj(patch.handoffRules),
          })
        : existing.handoffRules,
    progress: sanitizeProgress({
      ...existingProgress,
      ...patchProgress,
      skippedQuestions: normalizedSkipped,
      currentQuestionKey: nextQuestionKey,
      updatedAt: nowIso(),
    }),
  };

  return buildStoredOnboardingPayload(next);
}

function isQuestionAnswered(questionKey = "", draft = {}) {
  const businessProfile = obj(draft.businessProfile);

  switch (questionKey) {
    case "website":
      return Boolean(s(businessProfile.websiteUrl));
    case "company":
      return Boolean(s(businessProfile.companyName));
    case "description":
      return Boolean(s(businessProfile.description));
    case "services":
      return arr(draft.services).length > 0;
    case "contact":
      return arr(draft.contacts).length > 0;
    case "hours":
      return arr(draft.hours).length > 0;
    case "pricing":
      return Boolean(Object.keys(obj(draft.pricingPosture)).length);
    case "handoff":
      return Boolean(Object.keys(obj(draft.handoffRules)).length);
    default:
      return false;
  }
}

function isQuestionSkipped(questionKey = "", draft = {}) {
  return arr(obj(draft.progress).skippedQuestions)
    .map((item) => s(item).toLowerCase())
    .includes(s(questionKey).toLowerCase());
}

function summarizeAnswer(questionKey = "", draft = {}) {
  const businessProfile = obj(draft.businessProfile);

  switch (questionKey) {
    case "website":
      return s(businessProfile.websiteUrl);
    case "company":
      return s(businessProfile.companyName);
    case "description":
      return s(businessProfile.description);
    case "services":
      return arr(draft.services)
        .map((item) => s(item.title || item.name || item.label))
        .filter(Boolean)
        .slice(0, 4)
        .join(", ");
    case "contact":
      return s(arr(draft.contacts)[0]?.value);
    case "hours":
      return s(arr(draft.hours)[0]?.notes || arr(draft.hours)[0]?.day);
    case "pricing":
      return s(obj(draft.pricingPosture).summary);
    case "handoff":
      return s(obj(draft.handoffRules).summary);
    default:
      return "";
  }
}

function buildConversation(draft = {}) {
  const items = [];

  for (const question of ONBOARDING_QUESTIONS) {
    items.push({
      id: `q:${question.key}`,
      role: "assistant",
      step: question.key,
      text: question.prompt,
    });

    if (isQuestionAnswered(question.key, draft)) {
      items.push({
        id: `a:${question.key}`,
        role: "user",
        step: question.key,
        text: summarizeAnswer(question.key, draft),
      });
      continue;
    }

    if (isQuestionSkipped(question.key, draft)) {
      items.push({
        id: `a:${question.key}:skipped`,
        role: "user",
        step: question.key,
        text: "Skip",
      });
      continue;
    }

    break;
  }

  return items;
}

function getNextQuestion(draft = {}) {
  const next = ONBOARDING_QUESTIONS.find(
    (question) =>
      !isQuestionAnswered(question.key, draft) &&
      !isQuestionSkipped(question.key, draft)
  );

  if (!next) return null;

  return {
    key: next.key,
    label: next.label,
    prompt: next.prompt,
    placeholder: next.placeholder,
  };
}

function resolveSessionCurrentStep(review = {}, onboarding = {}, nextQuestion = null) {
  const storedSession = obj(review.session);

  return s(
    storedSession.currentStep ||
      obj(onboarding.progress).currentQuestionKey ||
      nextQuestion?.key ||
      ONBOARDING_CURRENT_STEP
  )
    ? ONBOARDING_CURRENT_STEP
    : ONBOARDING_CURRENT_STEP;
}

function safeDraftVersion(draftRow = {}) {
  const version = Number(draftRow.version || 1);
  return Number.isFinite(version) && version > 0 ? version : 1;
}

export function buildOnboardingSessionPayload(review = {}) {
  const session = obj(review.session);
  const draftRow = obj(review.draft);
  const draftPayload = obj(draftRow.draftPayload);
  const onboarding = normalizeStoredOnboardingPayload(draftPayload.onboarding);
  const summary = buildSummary(onboarding);
  const nextQuestion = getNextQuestion(onboarding);
  const conversation = buildConversation(onboarding);

  return {
    session: {
      id: s(session.id),
      status: s(session.status || "draft").toLowerCase(),
      mode: s(session.mode || "setup").toLowerCase(),
      currentStep: resolveSessionCurrentStep(review, onboarding, nextQuestion),
      startedAt: session.startedAt || session.started_at || null,
      updatedAt:
        session.updatedAt ||
        session.updated_at ||
        draftRow.updatedAt ||
        draftRow.updated_at ||
        null,
      draftVersion: safeDraftVersion(draftRow),
      reviewSessionId: s(session.id),
      draftOnly: true,
      storageModel: "tenant_setup_review",
      sourceType: ONBOARDING_SOURCE_TYPE,
      namespace: ONBOARDING_NAMESPACE,
    },
    onboarding: {
      status: summary.hasAnyDraft ? "draft_in_progress" : "awaiting_input",
      draftOnly: true,
      sourceType: ONBOARDING_SOURCE_TYPE,
      namespace: ONBOARDING_NAMESPACE,
      summary,
      websitePrefill: obj(onboarding.websitePrefill),
      review: obj(onboarding.review),
      assistant: {
        mode: "qna",
        nextQuestion,
        conversation,
        composer:
          nextQuestion == null
            ? null
            : {
                step: nextQuestion.key,
                placeholder: nextQuestion.placeholder,
              },
      },
      draft: {
        businessProfile: obj(onboarding.businessProfile),
        services: arr(onboarding.services),
        contacts: arr(onboarding.contacts),
        hours: arr(onboarding.hours),
        pricingPosture: obj(onboarding.pricingPosture),
        handoffRules: obj(onboarding.handoffRules),
        progress: obj(onboarding.progress),
        version: safeDraftVersion(draftRow),
        updatedAt: draftRow.updatedAt || draftRow.updated_at || null,
      },
    },
  };
}

function resolveStartedBy(actor = {}) {
  return (
    safeUuidOrNull(actor?.user?.id) ||
    safeUuidOrNull(actor?.user?.userId) ||
    safeUuidOrNull(actor?.user?.user_id) ||
    null
  );
}

function isDatabaseNotInitializedError(error) {
  const message = s(error?.message).toLowerCase();
  return message.includes("database is not initialized");
}

async function maybeUpdateReviewSessionStep({
  reviewSessionId,
  nextQuestion,
  deps = {},
}) {
  const injectedUpdateSession = deps.updateSetupReviewSession;
  const updateSession =
    typeof injectedUpdateSession === "function"
      ? injectedUpdateSession
      : updateSetupReviewSession;

  if (typeof updateSession !== "function" || !s(reviewSessionId)) return;

  try {
    await updateSession(reviewSessionId, {
      currentStep: s(nextQuestion?.key || ONBOARDING_CURRENT_STEP).toLowerCase(),
    });
  } catch (error) {
    if (
      typeof injectedUpdateSession !== "function" &&
      isDatabaseNotInitializedError(error)
    ) {
      return;
    }
    throw error;
  }
}

export async function startOnboardingSession({ db, actor }, deps = {}) {
  const getCurrentReview = deps.getCurrentSetupReview || getCurrentSetupReview;
  const getOrCreateSession =
    deps.getOrCreateActiveSetupReviewSession ||
    getOrCreateActiveSetupReviewSession;
  const audit = deps.auditSetupAction || auditSetupAction;

  let review = await getCurrentReview(actor.tenantId);
  let created = false;

  if (!review?.session?.id) {
    await getOrCreateSession({
      tenantId: actor.tenantId,
      mode: "setup",
      currentStep: ONBOARDING_CURRENT_STEP,
      startedBy: resolveStartedBy(actor),
      title: "AI onboarding",
      notes: "",
      metadata: {
        onboardingShell: true,
        onboardingNamespace: "draftPayload.onboarding",
        onboardingDraftOnly: true,
        runtimeActivationDeferred: true,
        truthApprovalDeferred: true,
        sourceType: ONBOARDING_SOURCE_TYPE,
        namespace: ONBOARDING_NAMESPACE,
      },
      ensureDraft: true,
    });
    review = await getCurrentReview(actor.tenantId);
    created = true;
  }

  const payload = buildOnboardingSessionPayload(review);

  await audit(
    db,
    actor,
    created ? "onboarding.session.started" : "onboarding.session.reused",
    "tenant_setup_review_session",
    s(review?.session?.id),
    {
      reviewSessionId: s(review?.session?.id),
      currentStep: s(payload?.session?.currentStep || ONBOARDING_CURRENT_STEP),
      source: "home_widget",
      sourceType: ONBOARDING_SOURCE_TYPE,
      namespace: ONBOARDING_NAMESPACE,
      draftOnly: true,
    }
  );

  return {
    status: 200,
    body: {
      ok: true,
      created,
      message: created
        ? "Onboarding session started"
        : "Onboarding session loaded",
      ...payload,
    },
  };
}

export async function loadCurrentOnboardingSession({ db, actor }, deps = {}) {
  const getCurrentReview = deps.getCurrentSetupReview || getCurrentSetupReview;
  const review = await getCurrentReview(actor.tenantId);

  if (!review?.session?.id) {
    return {
      status: 404,
      body: {
        ok: false,
        error: "OnboardingSessionNotFound",
        reason: "no active onboarding session was found",
        session: null,
        onboarding: null,
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      ...buildOnboardingSessionPayload(review),
    },
  };
}

export async function updateOnboardingDraft(
  { db, actor, body = {} },
  deps = {}
) {
  const getCurrentReview = deps.getCurrentSetupReview || getCurrentSetupReview;
  const patchReviewDraft =
    deps.patchSetupReviewDraft ||
    deps.patchReview ||
    patchSetupReviewDraft;
  const audit = deps.auditSetupAction || auditSetupAction;

  const review = await getCurrentReview(actor.tenantId);

  if (!review?.session?.id) {
    return {
      status: 404,
      body: {
        ok: false,
        error: "OnboardingSessionNotFound",
        reason: "start an onboarding session before updating the draft",
      },
    };
  }

  const patch = normalizeOnboardingDraftPatchBody(body);
  if (!Object.keys(patch).length) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "OnboardingDraftInvalid",
        reason: "no valid onboarding draft fields were provided",
      },
    };
  }

  const existingDraftPayload = obj(review?.draft?.draftPayload);
  const mergedOnboarding = mergeOnboardingDraft(
    obj(existingDraftPayload.onboarding),
    patch
  );

  const nextQuestion = getNextQuestion(mergedOnboarding);

  const nextDraftPayload = mergeDraftState(existingDraftPayload, {
    onboarding: {
      ...mergedOnboarding,
      updatedAt: nowIso(),
      namespace: ONBOARDING_NAMESPACE,
      sourceType: ONBOARDING_SOURCE_TYPE,
    },
  });

  await patchReviewDraft({
    sessionId: review.session.id,
    tenantId: actor.tenantId,
    patch: {
      draftPayload: nextDraftPayload,
    },
    bumpVersion: true,
  });

  await maybeUpdateReviewSessionStep({
    reviewSessionId: review.session.id,
    nextQuestion,
    deps,
  });

  const refreshed = await getCurrentReview(actor.tenantId);

  await audit(
    db,
    actor,
    "onboarding.draft.updated",
    "tenant_setup_review_session",
    s(refreshed?.session?.id || review.session.id),
    {
      reviewSessionId: s(refreshed?.session?.id || review.session.id),
      draftVersion: Number(
        refreshed?.draft?.version || review?.draft?.version || 0
      ),
      updatedFields: Object.keys(patch),
      source: "home_widget",
      sourceType: ONBOARDING_SOURCE_TYPE,
      namespace: ONBOARDING_NAMESPACE,
      draftOnly: true,
      messageMode: Boolean(
        s(body.step || body.questionKey || body.field) &&
          (s(body.answer || body.message || body.text || body.value) ||
            isMessageSkip(body))
      ),
      skipped: isMessageSkip(body),
      nextQuestion: s(nextQuestion?.key),
    }
  );

  return {
    status: 200,
    body: {
      ok: true,
      message: "Onboarding draft updated",
      ...buildOnboardingSessionPayload(refreshed),
    },
  };
}

export const __test__ = {
  buildConversation,
  buildOnboardingSessionPayload,
  buildStoredOnboardingPayload,
  getNextQuestion,
  mergeOnboardingDraft,
  normalizeOnboardingDraftPatchBody,
  patchFromAnswer,
};