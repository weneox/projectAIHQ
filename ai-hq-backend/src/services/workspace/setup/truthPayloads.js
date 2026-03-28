// ai-hq-backend/src/services/workspace/setup/truthPayloads.js

import {
  buildCanonicalTruthFieldProvenance,
  buildCanonicalTruthProfile,
  buildTruthVersionHistoryEntry,
  createTenantTruthVersionHelpers,
} from "../../../db/helpers/tenantTruthVersions.js";
import { createTenantKnowledgeHelpers } from "../../../db/helpers/tenantKnowledge.js";
import {
  buildOperationalRepairGuidance,
  buildReadinessSurface,
} from "../../operationalReadiness.js";
import { arr, obj, s } from "./utils.js";

function pickFirstObject(...values) {
  for (const value of values) {
    const normalized = obj(value);
    if (Object.keys(normalized).length) return normalized;
  }
  return {};
}

function pickFirstArray(...values) {
  for (const value of values) {
    const normalized = arr(value);
    if (normalized.length) return normalized;
  }
  return [];
}

function normalizeHistoryDiff(version = {}, explicitDiff = null) {
  const row = obj(version);
  const diff = pickFirstObject(
    explicitDiff,
    row.diff,
    row.compare,
    row.diff_json,
    row.compare_json,
    row.diff_summary,
    row.diff_summary_json,
    row.compare_summary,
    row.compare_summary_json,
    row.metadata?.diff,
    row.metadata?.compare,
    row.metadata_json?.diff,
    row.metadata_json?.compare
  );

  const changedFields = pickFirstArray(
    diff.changedFields,
    diff.changed_fields,
    diff.summary?.changedFields,
    diff.summary?.changed_fields,
    diff.metadata?.changedFields,
    diff.metadata?.changed_fields,
    row.changedFields,
    row.changed_fields,
    row.metadata?.changedFields,
    row.metadata?.changed_fields,
    row.metadata_json?.changedFields,
    row.metadata_json?.changed_fields
  )
    .map((item) => s(item))
    .filter(Boolean);

  const previousVersionId = s(
    diff.previousVersionId ||
      diff.previous_version_id ||
      row.previousVersionId ||
      row.previous_version_id ||
      row.compareToVersionId ||
      row.compare_to_version_id ||
      row.baseVersionId ||
      row.base_version_id
  );

  const summary = pickFirstObject(
    diff.summary,
    diff.diffSummary,
    diff.diff_summary,
    row.diffSummary,
    row.diff_summary,
    row.diff_summary_json,
    row.compare_summary_json
  );

  return {
    ...diff,
    previousVersionId,
    previous_version_id: previousVersionId,
    changedFields,
    changed_fields: changedFields,
    summary: {
      ...summary,
      changedFields,
      changed_fields: changedFields,
    },
  };
}

function buildSafeHistoryEntry(version = {}, explicitDiff = null) {
  const row = obj(version);
  const normalizedDiff = normalizeHistoryDiff(row, explicitDiff);

  const built = obj(buildTruthVersionHistoryEntry(row, normalizedDiff));

  const versionId = s(
    built.versionId ||
      built.version_id ||
      row.versionId ||
      row.version_id ||
      row.id
  );

  const previousVersionId = s(
    built.previousVersionId ||
      built.previous_version_id ||
      normalizedDiff.previousVersionId ||
      normalizedDiff.previous_version_id
  );

  const changedFields = pickFirstArray(
    built.changedFields,
    built.changed_fields,
    built.compare?.changedFields,
    built.compare?.changed_fields,
    built.diff?.changedFields,
    built.diff?.changed_fields,
    normalizedDiff.changedFields,
    normalizedDiff.changed_fields
  )
    .map((item) => s(item))
    .filter(Boolean);

  const compare = {
    ...obj(built.compare),
    ...normalizedDiff,
    previousVersionId,
    previous_version_id: previousVersionId,
    changedFields,
    changed_fields: changedFields,
    summary: {
      ...obj(normalizedDiff.summary),
      ...obj(obj(built.compare).summary),
      changedFields,
      changed_fields: changedFields,
    },
  };

  return {
    ...built,
    versionId,
    version_id: versionId,
    previousVersionId,
    previous_version_id: previousVersionId,
    changedFields,
    changed_fields: changedFields,
    compare,
    diff: compare,
  };
}

function buildTruthHistoryEntries(versions = [], truthVersionHelper = null) {
  const rows = arr(versions);

  const helperEntries =
    truthVersionHelper &&
    typeof truthVersionHelper.buildHistoryEntries === "function"
      ? arr(truthVersionHelper.buildHistoryEntries(rows))
      : [];

  return rows
    .map((row, index) => {
      const helperEntry = obj(helperEntries[index]);
      const helperDiff = pickFirstObject(
        helperEntry.compare,
        helperEntry.diff,
        helperEntry
      );

      return buildSafeHistoryEntry(row, helperDiff);
    })
    .filter((item) => Object.keys(obj(item)).length > 0);
}

function hasApprovedVersionHistory(versions = []) {
  return arr(versions).some((version) => {
    const row = obj(version);
    const status = s(
      row.profileStatus || row.profile_status || row.status
    ).toLowerCase();

    return (
      !!s(row.approvedAt || row.approved_at) ||
      !!s(row.approvedBy || row.approved_by) ||
      status === "approved"
    );
  });
}

function hasUsableApprovedTruth(profile = {}, versions = []) {
  const row = obj(profile);
  const profileStatus = s(
    row.profileStatus || row.profile_status || row.status
  ).toLowerCase();

  if (s(row.approvedAt || row.approved_at)) return true;
  if (s(row.approvedBy || row.approved_by)) return true;
  if (profileStatus === "approved") return true;
  if (hasApprovedVersionHistory(versions)) return true;

  return false;
}

function buildTruthReadiness({
  approvedTruthAvailable = false,
  actor = {},
  setup = {},
}) {
  const blocked = approvedTruthAvailable !== true;
  const nextRoute = s(
    setup?.progress?.nextRoute ||
      setup?.progress?.nextSetupRoute ||
      "/setup/studio"
  );
  const primaryMissingStep = s(
    setup?.progress?.primaryMissingStep || "approved_truth"
  );
  const reasonCode = blocked ? "approved_truth_unavailable" : "";

  const blocker = blocked
    ? buildOperationalRepairGuidance({
        reasonCode,
        viewerRole: s(actor?.role || "operator"),
        missingFields: [
          primaryMissingStep,
          nextRoute ? `route:${nextRoute}` : "",
        ].filter(Boolean),
        title: "Approved truth unavailable",
        subtitle:
          "Approved truth is unavailable and non-approved fallback data is intentionally hidden.",
        action: {
          id: "open_setup_route",
          kind: "route",
          label: "Open next setup step",
          requiredRole: "operator",
        },
        target: {
          path: nextRoute,
          section: "truth",
          setupStep: primaryMissingStep,
        },
      })
    : null;

  const surface = buildReadinessSurface({
    status: blocked ? "blocked" : "ready",
    message: blocked
      ? "Approved truth is unavailable until the next setup/runtime step is completed."
      : "Approved truth is available.",
    blockers: blocker ? [blocker] : [],
  });

  return {
    ...obj(surface),
    status: blocked ? "blocked" : "ready",
    blocked,
    reasonCode: reasonCode || s(surface?.reasonCode),
    reason_code: reasonCode || s(surface?.reason_code),
    blockers: blocker ? [blocker] : arr(surface?.blockers),
  };
}

export async function loadSetupTruthPayload({ db, actor }, deps = {}) {
  const knowledgeHelper =
    deps.knowledgeHelper || createTenantKnowledgeHelpers({ db });
  const truthVersionHelper =
    deps.truthVersionHelper || createTenantTruthVersionHelpers({ db });
  const setupBuilder = deps.setupBuilder || (async () => ({}));

  const [profile, versions, setup] = await Promise.all([
    knowledgeHelper.getBusinessProfile({
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
    }),
    truthVersionHelper.listVersions({
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      limit: 20,
      offset: 0,
    }),
    setupBuilder({
      db,
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      role: actor.role,
      tenant: actor.tenant,
    }),
  ]);

  const truthProfile = buildCanonicalTruthProfile(profile);
  const approvedTruthAvailable = hasUsableApprovedTruth(profile, versions);
  const history = buildTruthHistoryEntries(versions, truthVersionHelper);
  const readiness = buildTruthReadiness({
    approvedTruthAvailable,
    actor,
    setup,
  });

  return {
    truth: {
      profile: truthProfile,
      fieldProvenance: buildCanonicalTruthFieldProvenance(profile),
      history,
      approvedAt: s(profile?.approvedAt || profile?.approved_at),
      approvedBy: s(profile?.approvedBy || profile?.approved_by),
      generatedAt: s(profile?.generatedAt || profile?.generated_at),
      generatedBy: s(profile?.generatedBy || profile?.generated_by),
      profileStatus: s(
        profile?.profileStatus || profile?.profile_status || profile?.status
      ),
      sourceSummary: pickFirstObject(
        profile?.sourceSummary,
        profile?.source_summary,
        profile?.sourceSummaryJson,
        profile?.source_summary_json
      ),
      metadata: pickFirstObject(profile?.metadata, profile?.metadata_json),
      readiness,
    },
    setup,
  };
}

export async function loadSetupTruthVersionPayload(
  { db, actor, versionId = "", compareToVersionId = "" },
  deps = {}
) {
  const truthVersionHelper =
    deps.truthVersionHelper || createTenantTruthVersionHelpers({ db });
  const setupBuilder = deps.setupBuilder || (async () => ({}));

  const [comparison, setup] = await Promise.all([
    truthVersionHelper.compareVersions({
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      versionId,
      compareToVersionId,
      viewerRole: actor.role,
    }),
    setupBuilder({
      db,
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      role: actor.role,
      tenant: actor.tenant,
    }),
  ]);

  const normalizedDiff = normalizeHistoryDiff(
    comparison?.version,
    comparison?.diff
  );

  return {
    truthVersion: comparison?.version
      ? buildSafeHistoryEntry(comparison.version, normalizedDiff)
      : null,
    previousTruthVersion: comparison?.previousVersion
      ? buildSafeHistoryEntry(comparison.previousVersion)
      : null,
    currentTruthVersion: comparison?.currentVersion
      ? buildSafeHistoryEntry(comparison.currentVersion)
      : null,
    compare: Object.keys(normalizedDiff).length ? normalizedDiff : null,
    versionDiff: obj(comparison?.versionDiff),
    rollbackPreview: obj(comparison?.rollbackPreview),
    rollbackAction: obj(comparison?.rollbackAction),
    setup,
  };
}
