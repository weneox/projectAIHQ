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

export async function loadSetupTruthPayload({ db, actor }, deps = {}) {
  const knowledgeHelper = deps.knowledgeHelper || createTenantKnowledgeHelpers({ db });
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
  const hasApprovedTruth =
    Object.keys(truthProfile).length > 0 ||
    !!s(profile?.approved_at) ||
    !!s(profile?.approved_by) ||
    arr(versions).length > 0;
  const nextRoute = s(
    setup?.progress?.nextRoute ||
      setup?.progress?.nextSetupRoute ||
      "/setup/studio"
  );

  const truthBlocker = buildOperationalRepairGuidance({
    reasonCode: hasApprovedTruth ? "" : "approved_truth_unavailable",
    viewerRole: s(actor?.role || "operator"),
    missingFields: hasApprovedTruth
      ? []
      : [
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
  });

  return {
    truth: {
      profile: truthProfile,
      fieldProvenance: buildCanonicalTruthFieldProvenance(profile),
      history: arr(truthVersionHelper.buildHistoryEntries(versions)).filter(
        (item) => Object.keys(item).length
      ),
      approvedAt: s(profile?.approved_at),
      approvedBy: s(profile?.approved_by),
      generatedAt: s(profile?.generated_at),
      generatedBy: s(profile?.generated_by),
      profileStatus: s(profile?.profile_status),
      sourceSummary: obj(profile?.source_summary_json),
      metadata: obj(profile?.metadata_json),
      readiness: buildReadinessSurface({
        status: truthBlocker.blocked ? "blocked" : "ready",
        message: truthBlocker.blocked
          ? "Approved truth is unavailable until the next setup/runtime step is completed."
          : "Approved truth is available.",
        blockers: truthBlocker.blocked ? [truthBlocker] : [],
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
