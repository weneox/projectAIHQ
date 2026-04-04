import { createSystemSignal } from "../contracts/index.js";

function titleize(value = "") {
  return String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (item) => item.toUpperCase());
}

function buildReadinessSignals(trust = {}) {
  const items = [];
  const truthReadiness = trust?.summary?.truth?.readiness || {};
  const blockedItems = Array.isArray(truthReadiness?.blockedItems)
    ? truthReadiness.blockedItems
    : [];

  blockedItems.slice(0, 3).forEach((blocker, index) => {
    items.push(
      createSystemSignal({
        id: `truth-blocker-${blocker?.reasonCode || blocker?.title || index}`,
        kind: "blocker",
        relatedCapability: "business_memory",
        sourceSubsystem: "truth_readiness",
        statusCode: "blocked",
        reasonCode: blocker?.reasonCode,
        priority: "high",
        confidence: 0.9,
        requiresHuman: blocker?.action?.allowed !== false,
        canAutoFix: false,
        target: {
          kind: "truth",
          allowed: blocker?.action?.allowed !== false,
        },
        context: {
          title: blocker?.title || "Business memory needs attention",
          subjectName: "Business memory",
          statusLabel: "blocked",
          summary:
            blocker?.subtitle ||
            "Approved business memory is currently blocked.",
          reasonSummary: blocker?.reasonCode
            ? `Current status is ${titleize(blocker.reasonCode)}.`
            : "A required dependency for approved business memory is missing or degraded.",
          impactSummary:
            "Workspace guidance and downstream automations stay conservative until this is resolved.",
        },
      })
    );
  });

  return items;
}

function buildReviewSignals(workbench = {}) {
  const items = Array.isArray(workbench?.items) ? workbench.items : [];
  return items.slice(0, 4).map((item, index) =>
    createSystemSignal({
      id: `truth-review-${item?.id || index}`,
      kind: "decision",
      relatedCapability: "business_memory",
      sourceSubsystem: "truth_review",
      statusCode: item?.queueBucket || "pending",
      reasonCode: item?.approvalPolicy?.outcome,
      priority:
        item?.approvalPolicy?.riskLevel === "high" ||
        item?.queueBucket === "blocked_high_risk"
          ? "high"
          : "medium",
      confidence:
        typeof item?.confidence?.score === "number" ? item.confidence.score : 0.78,
      requiresHuman: true,
      canAutoFix: false,
      target: {
        kind: "truth",
        allowed: true,
      },
      evidenceSummary: [
        item?.source?.displayName,
        item?.approvalPolicy?.requiredRole,
        item?.queueBucket,
      ].filter(Boolean),
      detailRef: {
        type: "truth_review_candidate",
        id: String(item?.id || ""),
      },
      context: {
        title: item?.title || "Review proposed business memory change",
        subjectName: item?.title || "Business memory change",
        statusLabel: item?.queueBucket || "pending",
        summary:
          item?.valueText ||
          "New evidence proposes a change to approved business memory.",
        reasonSummary:
          item?.approvalPolicy?.outcome
            ? `Policy posture is ${titleize(item.approvalPolicy.outcome)}.`
            : item?.source?.displayName
              ? `${item.source.displayName} introduced a change that needs review.`
              : "The system could not safely auto-apply this change.",
        impactSummary:
          "Approved answers stay unchanged until someone reviews this candidate.",
      },
    })
  );
}

function buildRecentOutcomeSignals(trust = {}) {
  const items = [];
  const truthSummary = trust?.summary?.truth || {};
  const recentRun = Array.isArray(trust?.recentRuns) ? trust.recentRuns[0] : null;

  if (truthSummary?.latestVersionId) {
    items.push(
      createSystemSignal({
        id: `truth-approved-${truthSummary.latestVersionId}`,
        kind: "outcome",
        relatedCapability: "business_memory",
        sourceSubsystem: "truth_snapshot",
        statusCode: "approved",
        priority: "low",
        confidence: 0.94,
        target: {
          kind: "truth",
          allowed: true,
        },
        timestamp: truthSummary?.approvedAt,
        context: {
          title: "Approved business memory is available",
          subjectName: `Version ${truthSummary.latestVersionId}`,
          statusLabel: "approved",
          summary: `Version ${truthSummary.latestVersionId} is the current approved business memory.`,
          reasonSummary: truthSummary?.approvedAt
            ? `It was last approved at ${truthSummary.approvedAt}.`
            : "An approved business memory snapshot is present.",
          impactSummary:
            "Customer-facing systems can anchor responses to approved business memory.",
        },
      })
    );
  }

  if (recentRun?.sourceDisplayName) {
    items.push(
      createSystemSignal({
        id: `truth-run-${recentRun.id || recentRun.sourceDisplayName}`,
        kind: recentRun?.reviewRequired ? "signal" : "outcome",
        relatedCapability: "business_memory",
        sourceSubsystem: "truth_sources",
        statusCode: recentRun?.status,
        priority: recentRun?.reviewRequired ? "medium" : "low",
        confidence: 0.83,
        requiresHuman: recentRun?.reviewRequired === true,
        target: {
          kind: "source_governance",
          allowed: true,
        },
        timestamp: recentRun?.finishedAt || recentRun?.startedAt,
        context: {
          title: `${recentRun.sourceDisplayName} sync ${recentRun.status || "updated"}`,
          subjectName: recentRun.sourceDisplayName,
          statusLabel: recentRun.status || "updated",
          summary: recentRun?.reviewRequired
            ? "A source refresh completed and opened review-backed follow-up work."
            : "A recent source refresh completed.",
          reasonSummary:
            recentRun?.errorMessage ||
            "Source evidence refresh updates what the system can review next.",
          impactSummary: recentRun?.reviewRequired
            ? "Approved business memory remains protected until review is completed."
            : "Fresh evidence is available for future reviews.",
        },
      })
    );
  }

  return items;
}

export function buildTruthSystemSignals({
  trust = null,
  workbench = null,
} = {}) {
  return [
    ...buildReadinessSignals(trust || {}),
    ...buildReviewSignals(workbench || {}),
    ...buildRecentOutcomeSignals(trust || {}),
  ];
}
