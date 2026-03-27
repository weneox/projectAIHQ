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

function pickVersionDiff(version = {}, entry = {}) {
  const value = obj(version);
  const built = obj(entry);
  const meta = obj(value.metadata_json);

  return (
    built.compare ||
    built.diff ||
    built.diffSummary ||
    built.diff_summary ||
    value.compare ||
    value.diff ||
    value.compare_json ||
    value.diff_json ||
    value.comparison ||
    value.comparison_json ||
    value.previous_diff_json ||
    value.diff_to_previous_json ||
    value.compare_to_previous_json ||
    value.change_summary_json ||
    value.diff_summary_json ||
    meta.compare ||
    meta.diff ||
    meta.compare_json ||
    meta.diff_json ||
    meta.changeSummary ||
    meta.change_summary ||
    null
  );
}

function normalizeComparePayload(compare = null, version = {}, entry = {}) {
  const raw = obj(compare);
  const value = obj(version);
  const built = obj(entry);

  const changedFields = arr(
    raw.changedFields ||
      raw.changed_fields ||
      built.changedFields ||
      built.changed_fields
  );

  const previousVersionId = s(
    raw.previousVersionId ||
      raw.previous_version_id ||
      raw.compareToVersionId ||
      raw.compare_to_version_id ||
      value.previousVersionId ||
      value.previous_version_id ||
      value.compareToVersionId ||
      value.compare_to_version_id ||
      built.previousVersionId ||
      built.previous_version_id
  );

  const currentVersionId = s(
    raw.versionId ||
      raw.version_id ||
      value.id ||
      value.versionId ||
      value.version_id ||
      built.id
  );

  const summary = s(
    raw.summary ||
      raw.message ||
      raw.label ||
      raw.description ||
      built.summary ||
      built.message
  );

  const changedFieldCount =
    Number(
      raw.changedFieldCount ||
        raw.changed_field_count ||
        built.changedFieldCount ||
        built.changed_field_count
    ) || changedFields.length;

  return {
    changedFields,
    changedFieldCount,
    previousVersionId,
    versionId: currentVersionId,
    summary,
  };
}

function normalizeTruthHistoryEntries(versions = []) {
  return arr(versions)
    .map((version) => {
      const builtEntry = obj(buildTruthVersionHistoryEntry(version));
      const compare = normalizeComparePayload(
        pickVersionDiff(version, builtEntry),
        version,
        builtEntry
      );

      return {
        ...builtEntry,
        compare,
        diff: compare,
      };
    })
    .filter((item) => Object.keys(item).length);
}

function hasApprovedTruthState(profile = {}, versions = []) {
  const profileStatus = s(profile?.profile_status).toLowerCase();
  const approvedAt = s(profile?.approved_at);
  const approvedBy = s(profile?.approved_by);

  if (profileStatus === "approved") return true;
  if (approvedAt) return true;
  if (approvedBy) return true;
  if (arr(versions).length > 0) return true;

  return false;
}

function normalizeTruthBlocker(blocker = {}, reasonCode = "") {
  const value = obj(blocker);
  const normalizedReasonCode =
    s(value.reasonCode) || s(value.reason_code) || s(reasonCode);

  return {
    ...value,
    blocked: true,
    code: normalizedReasonCode,
    reasonCode: normalizedReasonCode,
    reason_code: normalizedReasonCode,
  };
}

function buildTruthReadiness({
  blocked = false,
  blocker = null,
  reasonCode = "",
} = {}) {
  const readiness = buildReadinessSurface({
    status: blocked ? "blocked" : "ready",
    message: blocked
      ? "Approved truth is unavailable until the next setup/runtime step is completed."
      : "Approved truth is available.",
    blockers: blocked && blocker ? [blocker] : [],
  });

  return {
    ...obj(readiness),
    status: blocked ? "blocked" : s(readiness?.status || "ready"),
    message: blocked
      ? "Approved truth is unavailable until the next setup/runtime step is completed."
      : s(readiness?.message || "Approved truth is available."),
    blocked: blocked || Boolean(readiness?.blocked),
    code: blocked ? reasonCode : s(readiness?.code),
    reasonCode: blocked ? reasonCode : s(readiness?.reasonCode),
    reason_code: blocked ? reasonCode : s(readiness?.reason_code),
    primaryReasonCode: blocked
      ? reasonCode
      : s(readiness?.primaryReasonCode || readiness?.reasonCode),
    blockers: blocked && blocker ? [blocker] : arr(readiness?.blockers),
  };
}

export async function loadSetupTruthPayload({ db, actor }, deps = {}) {
  const knowledgeHelper =
    deps.knowledgeHelper || createTenantKnowledgeHelpers({ db });
  const truthVersionHelper =
    deps.truthVersionHelper || createTenantTruthVersionHelpers({ db });
  const setupBuilder = deps.setupBuilder;

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
  const history = normalizeTruthHistoryEntries(versions);
  const hasApprovedTruth = hasApprovedTruthState(profile, versions);

  const nextRoute = s(
    setup?.progress?.nextRoute ||
      setup?.progress?.nextSetupRoute ||
      "/setup/studio"
  );

  const truthBlocked = !hasApprovedTruth;
  const blockerReasonCode = truthBlocked ? "approved_truth_unavailable" : "";

  const truthBlocker = truthBlocked
    ? normalizeTruthBlocker(
        buildOperationalRepairGuidance({
          reasonCode: blockerReasonCode,
          viewerRole: s(actor?.role || "operator"),
          missingFields: [
            s(setup?.progress?.primaryMissingStep || "approved_truth"),
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
            setupStep: s(setup?.progress?.primaryMissingStep),
          },
        }),
        blockerReasonCode
      )
    : null;

  return {
    truth: {
      profile: truthProfile,
      fieldProvenance: buildCanonicalTruthFieldProvenance(profile),
      history,
      approvedAt: s(profile?.approved_at),
      approvedBy: s(profile?.approved_by),
      generatedAt: s(profile?.generated_at),
      generatedBy: s(profile?.generated_by),
      profileStatus: s(profile?.profile_status),
      sourceSummary: obj(profile?.source_summary_json),
      metadata: obj(profile?.metadata_json),
      readiness: buildTruthReadiness({
        blocked: truthBlocked,
        blocker: truthBlocker,
        reasonCode: blockerReasonCode,
      }),
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
  const setupBuilder = deps.setupBuilder;

  const [comparison, setup] = await Promise.all([
    truthVersionHelper.compareVersions({
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      versionId,
      compareToVersionId,
    }),
    setupBuilder({
      db,
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      role: actor.role,
      tenant: actor.tenant,
    }),
  ]);

  return {
    truthVersion: comparison?.version
      ? buildTruthVersionHistoryEntry(comparison.version, comparison.diff)
      : null,
    previousTruthVersion: comparison?.previousVersion
      ? buildTruthVersionHistoryEntry(comparison.previousVersion)
      : null,
    compare: comparison?.diff || null,
    setup,
  };
}