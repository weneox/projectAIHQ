import {
  getCurrentSetupReview,
  getOrCreateActiveSetupReviewSession,
  patchSetupReviewDraft,
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

const REVIEW_PLACEHOLDER_MESSAGE =
  "Draft answers stay separate from approved truth and the strict runtime until a later approval step is completed.";

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

function normalizeStringArray(value = [], limit = 12) {
  return arr(value)
    .map((item) => s(item))
    .filter(Boolean)
    .slice(0, limit);
}

function sanitizeBusinessProfile(value = {}) {
  const source = obj(value);
  return compactDraftObject({
    companyName: s(source.companyName || source.company_name),
    description: s(source.description || source.summary),
    websiteUrl: s(source.websiteUrl || source.website_url || source.website),
  });
}

function sanitizeServiceItem(value = {}) {
  const source = obj(value);
  const title = s(source.title || source.name || source.label);
  const summary = s(
    source.summary || source.description || source.detail || source.notes
  );
  const priceLabel = s(
    source.priceLabel || source.price_label || source.price || source.priceRange
  );
  const category = s(source.category);

  if (!title && !summary && !priceLabel && !category) return null;

  return compactDraftObject({
    key: s(source.key || source.serviceKey || source.service_key) || slugify(title),
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
    enabled: source.enabled === true,
    summary: s(source.summary || source.description || source.notes),
    triggers: normalizeStringArray(source.triggers, 24),
    channels: normalizeStringArray(source.channels, 12),
    escalationTarget: s(
      source.escalationTarget || source.escalation_target || source.target
    ),
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
  };
}

function deriveReviewPlaceholder() {
  return {
    status: "draft_only",
    readyForApproval: false,
    message: REVIEW_PLACEHOLDER_MESSAGE,
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

  return {
    ...core,
    websitePrefill: deriveWebsitePrefillDraft(core),
    review: deriveReviewPlaceholder(),
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

export function normalizeOnboardingDraftPatchBody(body = {}) {
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

  return out;
}

export function mergeOnboardingDraft(current = {}, patch = {}) {
  const existing = normalizeStoredOnboardingPayload(current);
  const next = {
    businessProfile:
      patch.businessProfile !== undefined
        ? sanitizeBusinessProfile(patch.businessProfile)
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
        ? sanitizePricingPosture(patch.pricingPosture)
        : existing.pricingPosture,
    handoffRules:
      patch.handoffRules !== undefined
        ? sanitizeHandoffRules(patch.handoffRules)
        : existing.handoffRules,
  };

  return buildStoredOnboardingPayload(next);
}

function buildSummary(draft = {}) {
  const businessProfile = obj(draft.businessProfile);
  const pricingPosture = obj(draft.pricingPosture);
  const handoffRules = obj(draft.handoffRules);

  const completedSections = [
    Boolean(
      s(businessProfile.companyName) ||
        s(businessProfile.description) ||
        s(businessProfile.websiteUrl)
    ),
    arr(draft.services).length > 0,
    arr(draft.contacts).length > 0,
    arr(draft.hours).length > 0,
    Object.keys(pricingPosture).length > 0,
    Object.keys(handoffRules).length > 0,
  ].filter(Boolean).length;

  return {
    completedSections,
    totalSections: 6,
    hasAnyDraft: completedSections > 0,
    hasWebsite: Boolean(s(businessProfile.websiteUrl)),
    hasServices: arr(draft.services).length > 0,
    hasContacts: arr(draft.contacts).length > 0,
    hasHours: arr(draft.hours).length > 0,
  };
}

export function buildOnboardingSessionPayload(review = {}) {
  const session = obj(review.session);
  const draftRow = obj(review.draft);
  const draftPayload = obj(draftRow.draftPayload);
  const onboarding = normalizeStoredOnboardingPayload(draftPayload.onboarding);
  const summary = buildSummary(onboarding);

  return {
    session: {
      id: s(session.id),
      status: s(session.status || "draft").toLowerCase(),
      mode: s(session.mode || "setup").toLowerCase(),
      currentStep: s(session.currentStep || "onboarding").toLowerCase(),
      startedAt: session.startedAt || session.started_at || null,
      updatedAt:
        session.updatedAt ||
        session.updated_at ||
        draftRow.updatedAt ||
        draftRow.updated_at ||
        null,
      draftVersion: Number(draftRow.version || 1),
      reviewSessionId: s(session.id),
      draftOnly: true,
      storageModel: "tenant_setup_review",
    },
    onboarding: {
      status: summary.hasAnyDraft ? "draft_in_progress" : "awaiting_input",
      draftOnly: true,
      summary,
      websitePrefill: obj(onboarding.websitePrefill),
      review: obj(onboarding.review),
      draft: {
        businessProfile: obj(onboarding.businessProfile),
        services: arr(onboarding.services),
        contacts: arr(onboarding.contacts),
        hours: arr(onboarding.hours),
        pricingPosture: obj(onboarding.pricingPosture),
        handoffRules: obj(onboarding.handoffRules),
        version: Number(draftRow.version || 1),
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

export async function startOnboardingSession(
  { db, actor },
  deps = {}
) {
  const getCurrentReview = deps.getCurrentSetupReview || getCurrentSetupReview;
  const getOrCreateSession =
    deps.getOrCreateActiveSetupReviewSession || getOrCreateActiveSetupReviewSession;
  const audit = deps.auditSetupAction || auditSetupAction;

  let review = await getCurrentReview(actor.tenantId);
  let created = false;

  if (!review?.session?.id) {
    await getOrCreateSession({
      tenantId: actor.tenantId,
      mode: "setup",
      currentStep: "onboarding",
      startedBy: resolveStartedBy(actor),
      title: "AI onboarding",
      notes: "",
      metadata: {
        onboardingShell: true,
        onboardingNamespace: "draftPayload.onboarding",
        onboardingDraftOnly: true,
        runtimeActivationDeferred: true,
        truthApprovalDeferred: true,
      },
      ensureDraft: true,
    });
    review = await getCurrentReview(actor.tenantId);
    created = true;
  }

  await audit(
    db,
    actor,
    created ? "onboarding.session.started" : "onboarding.session.reused",
    "tenant_setup_review_session",
    s(review?.session?.id),
    {
      reviewSessionId: s(review?.session?.id),
      currentStep: s(review?.session?.currentStep || "onboarding"),
      source: "home_widget",
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
      ...buildOnboardingSessionPayload(review),
    },
  };
}

export async function loadCurrentOnboardingSession(
  { db, actor },
  deps = {}
) {
  const getCurrentReview = deps.getCurrentSetupReview || getCurrentSetupReview;
  const review = await getCurrentReview(actor.tenantId);

  if (!review?.session?.id) {
    return {
      status: 404,
      body: {
        ok: false,
        error: "OnboardingSessionNotFound",
        reason: "no active onboarding session was found",
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
  const patchReviewDraft = deps.patchSetupReviewDraft || patchSetupReviewDraft;
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

  const nextDraftPayload = mergeDraftState(existingDraftPayload, {
    onboarding: {
      ...mergedOnboarding,
      updatedAt: nowIso(),
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

  const refreshed = await getCurrentReview(actor.tenantId);

  await audit(
    db,
    actor,
    "onboarding.draft.updated",
    "tenant_setup_review_session",
    s(refreshed?.session?.id || review.session.id),
    {
      reviewSessionId: s(refreshed?.session?.id || review.session.id),
      draftVersion: Number(refreshed?.draft?.version || review?.draft?.version || 0),
      updatedFields: Object.keys(patch),
      source: "home_widget",
      draftOnly: true,
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
  buildOnboardingSessionPayload,
  buildStoredOnboardingPayload,
  mergeOnboardingDraft,
  normalizeOnboardingDraftPatchBody,
};
