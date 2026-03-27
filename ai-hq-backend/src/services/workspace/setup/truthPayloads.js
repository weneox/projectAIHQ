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

function normalizeTruthHistoryEntries(versions = []) {
  return arr(versions)
    .map((version) => buildTruthVersionHistoryEntry(version))
    .filter((item) => item && Object.keys(item).length);
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

  const truthBlocker = buildOperationalRepairGuidance({
    reasonCode: truthBlocked ? "approved_truth_unavailable" : "",
    viewerRole: s(actor?.role || "operator"),
    missingFields: truthBlocked
      ? [
          s(setup?.progress?.primaryMissingStep || "approved_truth"),
          nextRoute ? `route:${nextRoute}` : "",
        ].filter(Boolean)
      : [],
    title: "Approved truth unavailable",
    subtitle:
      "Approved truth is unavailable and non-approved fallback data is intentionally hidden.",
    action: truthBlocked
      ? {
          id: "open_setup_route",
          kind: "route",
          label: "Open next setup step",
          requiredRole: "operator",
        }
      : null,
    target: truthBlocked
      ? {
          path: nextRoute,
          section: "truth",
          setupStep: s(setup?.progress?.primaryMissingStep),
        }
      : null,
  });

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
      readiness: buildReadinessSurface({
        status: truthBlocked ? "blocked" : "ready",
        message: truthBlocked
          ? "Approved truth is unavailable until the next setup/runtime step is completed."
          : "Approved truth is available.",
        blockers: truthBlocked ? [truthBlocker] : [],
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