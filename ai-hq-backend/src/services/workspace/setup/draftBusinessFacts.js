import { createTenantTruthVersionHelpers } from "../../../db/helpers/tenantTruthVersions.js";
import { dbListTenantBusinessFacts } from "../../../db/helpers/tenantBusinessBrain.js";
import { arr, compactDraftObject, mergeDraftState, obj, s } from "./draftShared.js";

async function defaultGetCurrentSetupReview(tenantId) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  return reviewHelper.getCurrentSetupReview(tenantId);
}

async function defaultPatchSetupReviewDraft(input) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  return reviewHelper.patchSetupReviewDraft(input);
}

async function defaultGetOrCreateActiveSetupReviewSession(input) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  return reviewHelper.getOrCreateActiveSetupReviewSession(input);
}

async function defaultUpdateSetupReviewSession(sessionId, patch) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  return reviewHelper.updateSetupReviewSession(sessionId, patch);
}

export function normalizeBusinessTruthFactDraftInput(input = {}, fallbackId = "") {
  const body = obj(input);
  const factKey = s(body.factKey || body.fact_key || body.key);
  if (!factKey) {
    throw new Error("Business fact key is required");
  }

  return compactDraftObject({
    id: s(body.id || fallbackId || `draft_${factKey}`),
    factKey,
    factGroup: s(body.factGroup || body.fact_group || "general").toLowerCase() || "general",
    title: s(body.title),
    valueText: s(body.valueText || body.value_text),
    valueJson: obj(body.valueJson || body.value_json),
    language: s(body.language || "en").toLowerCase() || "en",
    channelScope: arr(body.channelScope || body.channel_scope),
    usecaseScope: arr(body.usecaseScope || body.usecase_scope),
    priority: Number(body.priority ?? 100) || 100,
    enabled:
      typeof body.enabled === "boolean"
        ? body.enabled
        : true,
    meta: mergeDraftState(obj(body.meta), {
      factSurface: "published_truth",
      stagedInMaintenanceReview: true,
    }),
  });
}

function normalizePublishedBusinessFactsSnapshot(version = {}) {
  return arr(
    version?.truth_facts_snapshot_json ||
      version?.businessTruthFactsSnapshot ||
      version?.metadata_json?.truthFactsSnapshot ||
      version?.metadata_json?.truth_facts_snapshot_json
  );
}

function hasPublishedBusinessFactsSnapshot(version = {}) {
  const metadata = obj(version?.metadata_json);
  return (
    Object.prototype.hasOwnProperty.call(metadata, "truthFactsSnapshot") ||
    Object.prototype.hasOwnProperty.call(metadata, "truth_facts_snapshot_json") ||
    Array.isArray(version?.truth_facts_snapshot_json) ||
    Array.isArray(version?.businessTruthFactsSnapshot)
  );
}

function buildBusinessFactSeedItem(item = {}) {
  return normalizeBusinessTruthFactDraftInput(
    {
      id: item.id || item.factId || item.fact_id,
      factKey: item.factKey || item.fact_key || item.key,
      factGroup: item.factGroup || item.fact_group,
      title: item.title,
      valueText: item.valueText || item.value_text,
      valueJson: item.valueJson || item.value_json,
      language: item.language,
      channelScope: item.channelScope || item.channel_scope,
      usecaseScope: item.usecaseScope || item.usecase_scope,
      priority: item.priority,
      enabled: item.enabled,
      meta: item.meta,
    },
    s(item.id || item.factId || item.fact_id)
  );
}

function findBusinessFactIndex(items = [], idOrKey = "") {
  const needle = s(idOrKey).toLowerCase();
  if (!needle) return -1;

  return arr(items).findIndex((item) => {
    const id = s(item?.id).toLowerCase();
    const key = s(item?.factKey || item?.fact_key).toLowerCase();
    return id === needle || key === needle;
  });
}

export async function listSetupBusinessTruthFactsFromDraftOrPublished({
  db,
  actor,
  getCurrentSetupReview = defaultGetCurrentSetupReview,
  truthVersionHelper = createTenantTruthVersionHelpers({ db }),
}) {
  const current = await getCurrentSetupReview(actor.tenantId);
  const draftFacts = arr(current?.draft?.businessFacts);

  if (current?.session?.id && Array.isArray(current?.draft?.businessFacts)) {
    return {
      facts: draftFacts,
      source: "setup_review_draft",
      staged: true,
      canonicalWriteDeferred: true,
    };
  }

  const latestTruthVersion =
    truthVersionHelper &&
    typeof truthVersionHelper.getLatestVersion === "function"
      ? await truthVersionHelper.getLatestVersion({
          tenantId: actor.tenantId,
          tenantKey: actor.tenantKey,
        })
      : null;

  if (hasPublishedBusinessFactsSnapshot(latestTruthVersion)) {
    return {
      facts: normalizePublishedBusinessFactsSnapshot(latestTruthVersion),
      source: "published_truth_version",
      staged: false,
      canonicalWriteDeferred: true,
    };
  }

  const legacyFacts = await dbListTenantBusinessFacts(db, actor.tenantId, {
    enabledOnly: false,
    factSurface: "legacy_truth",
  });

  return {
    facts: legacyFacts.map(buildBusinessFactSeedItem),
    source: "legacy_business_facts_fallback",
    staged: false,
    canonicalWriteDeferred: true,
  };
}

export async function stageBusinessTruthFactMutationInMaintenanceSession({
  db,
  actor,
  mode,
  factId = "",
  body = {},
  getCurrentSetupReview = defaultGetCurrentSetupReview,
  getOrCreateActiveSetupReviewSession = defaultGetOrCreateActiveSetupReviewSession,
  patchSetupReviewDraft = defaultPatchSetupReviewDraft,
  updateSetupReviewSession = defaultUpdateSetupReviewSession,
  truthVersionHelper = createTenantTruthVersionHelpers({ db }),
} = {}) {
  const current = await getCurrentSetupReview(actor.tenantId);
  const activeSession = current?.session || null;

  if (activeSession?.id && s(activeSession.mode) && s(activeSession.mode) !== "refresh") {
    const error = new Error(
      "An active setup review session is already in progress. Publish or discard it before staging a business fact change."
    );
    error.code = "TRUTH_MAINTENANCE_SESSION_CONFLICT";
    error.statusCode = 409;
    throw error;
  }

  const latestTruthVersion =
    truthVersionHelper &&
    typeof truthVersionHelper.getLatestVersion === "function"
      ? await truthVersionHelper.getLatestVersion({
          tenantId: actor.tenantId,
          tenantKey: actor.tenantKey,
        })
      : null;

  const publishedFacts = normalizePublishedBusinessFactsSnapshot(latestTruthVersion).map(
    buildBusinessFactSeedItem
  );
  const legacyFacts =
    hasPublishedBusinessFactsSnapshot(latestTruthVersion)
      ? []
      : arr(
          await dbListTenantBusinessFacts(db, actor.tenantId, {
            enabledOnly: false,
            factSurface: "legacy_truth",
          })
        ).map(buildBusinessFactSeedItem);

  const baseFacts = Array.isArray(current?.draft?.businessFacts)
    ? arr(current?.draft?.businessFacts)
    : publishedFacts.length || hasPublishedBusinessFactsSnapshot(latestTruthVersion)
      ? publishedFacts
      : legacyFacts;

  const nextFacts = [...baseFacts];
  let stagedItem = null;

  if (mode === "delete") {
    const index = findBusinessFactIndex(nextFacts, factId);
    if (index < 0) {
      throw new Error("business fact not found in maintenance draft");
    }
    stagedItem = nextFacts[index];
    nextFacts.splice(index, 1);
  } else {
    stagedItem = normalizeBusinessTruthFactDraftInput(
      body,
      s(body.id || factId || body.factKey || body.fact_key)
    );
    const index = findBusinessFactIndex(
      nextFacts,
      body.factKey || body.fact_key || factId
    );
    if (index >= 0) {
      nextFacts[index] = mergeDraftState(nextFacts[index], stagedItem);
    } else {
      nextFacts.push(stagedItem);
    }
  }

  const session =
    activeSession?.id && s(activeSession.mode) === "refresh"
      ? activeSession
      : await getOrCreateActiveSetupReviewSession({
          tenantId: actor.tenantId,
          mode: "refresh",
          currentStep: "maintenance_review",
          metadata: {
            sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
            stagedFrom: "settings_business_facts",
          },
          ensureDraft: true,
        });

  const sourceSummary = mergeDraftState(obj(current?.draft?.sourceSummary), {
    maintenance: {
      mode: "refresh",
      stagedFrom: "settings_business_facts",
      sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
      reviewSessionId: s(session?.id),
    },
  });

  const draft = await patchSetupReviewDraft({
    sessionId: session.id,
    tenantId: actor.tenantId,
    patch: {
      businessFacts: nextFacts,
      sourceSummary,
      draftPayload: mergeDraftState(obj(current?.draft?.draftPayload), {
        maintenanceMode: "post_publish_truth_change_set",
        stagedInputs: {
          businessFacts: {
            updatedAt: new Date().toISOString(),
            count: nextFacts.length,
          },
        },
      }),
    },
    bumpVersion: true,
  });

  const updatedSession = await updateSetupReviewSession(session.id, {
    mode: "refresh",
    status: "ready",
    currentStep: "maintenance_review",
    metadata: mergeDraftState(obj(session?.metadata), {
      sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
      stagedFrom: "settings_business_facts",
    }),
  });

  return {
    publishStatus: "review_required",
    reviewRequired: true,
    staged: true,
    liveMutationDeferred: true,
    runtimeProjectionRefreshed: false,
    truthVersionCreated: false,
    action: mode === "delete" ? "stage_truth_fact_delete_review" : "stage_truth_fact_review",
    maintenanceSession: {
      id: s(updatedSession?.id || session?.id),
      mode: s(updatedSession?.mode || session?.mode || "refresh"),
      status: s(updatedSession?.status || session?.status || "ready"),
      currentStep: s(
        updatedSession?.currentStep || session?.currentStep || "maintenance_review"
      ),
      sourceCurrentTruthVersionId: s(latestTruthVersion?.id),
    },
    maintenanceDraft: {
      version: Number(draft?.version || 0),
      businessFacts: arr(draft?.businessFacts || nextFacts),
      sourceSummary: obj(draft?.sourceSummary || sourceSummary),
    },
    stagedItem,
  };
}

export const __test__ = {
  normalizeBusinessTruthFactDraftInput,
  buildBusinessFactSeedItem,
};
