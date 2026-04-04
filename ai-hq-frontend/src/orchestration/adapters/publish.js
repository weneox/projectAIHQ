import { createSystemSignal, s } from "../contracts/index.js";

function summarizeComments(payload = {}) {
  const comments = Array.isArray(payload?.comments)
    ? payload.comments
    : Array.isArray(payload)
      ? payload
      : [];

  let pending = 0;
  let reviewed = 0;
  let flagged = 0;
  let replied = 0;

  for (const item of comments) {
    const status = s(item?.status).toLowerCase();
    if (status === "pending" || status === "manual_review") pending += 1;
    if (status === "reviewed" || status === "approved") reviewed += 1;
    if (status === "replied") replied += 1;
    if (status === "flagged" || status === "ignored") flagged += 1;
  }

  return {
    total: comments.length,
    pending,
    reviewed,
    replied,
    flagged,
  };
}

function buildCommentsCapabilitySignal(summary = {}) {
  const statusCode =
    summary.pending > 0
      ? "review_only"
      : summary.flagged > 0
        ? "guarded"
        : summary.total > 0
          ? "active"
          : "idle";

  return createSystemSignal({
    id: "capability-comments-moderation",
    kind: "capability_state",
    relatedCapability: "comments",
    sourceSubsystem: "publish_summary",
    statusCode,
    priority: summary.pending > 0 ? "medium" : "low",
    confidence: 0.8,
    requiresHuman: summary.pending > 0,
    canAutoFix: false,
    target: {
      kind: "comments",
      allowed: true,
    },
    context: {
      subjectName: "Comments moderation",
      statusLabel: statusCode,
      summary:
        summary.pending > 0
          ? `${summary.pending} comment${summary.pending === 1 ? "" : "s"} are waiting for moderation review.`
          : summary.flagged > 0
            ? `${summary.flagged} comment${summary.flagged === 1 ? "" : "s"} were flagged or ignored recently.`
            : summary.total > 0
              ? "Comments moderation is active without visible manual pressure."
              : "No recent moderation activity is visible right now.",
      reasonSummary:
        "The workspace used a small recent comments sample instead of the full moderation queue.",
      impactSummary:
        summary.pending > 0
          ? "Public responses may wait for operator review before they go out."
          : "Moderation can continue under the current posture.",
    },
  });
}

function buildPublishingCapabilitySignal(summary = {}) {
  const statusCode =
    summary.pending > 0 ? "review_only" : summary.replied > 0 ? "active" : "idle";

  return createSystemSignal({
    id: "capability-publishing",
    kind: "capability_state",
    relatedCapability: "publish",
    sourceSubsystem: "publish_summary",
    statusCode,
    priority: summary.pending > 0 ? "medium" : "low",
    confidence: 0.68,
    requiresHuman: summary.pending > 0,
    canAutoFix: false,
    target: {
      kind: "publish",
      allowed: true,
    },
    context: {
      subjectName: "Publishing",
      statusLabel: statusCode,
      summary:
        summary.pending > 0
          ? "Publishing-related moderation still needs human review."
          : summary.replied > 0
            ? "Recent public response activity completed successfully."
            : "No recent publishing pressure is visible in the lightweight summary.",
      reasonSummary:
        "Phase 2 keeps publishing posture lightweight and derives it from recent moderation activity only.",
      impactSummary:
        summary.pending > 0
          ? "Some publish-adjacent work remains review-backed instead of fully autonomous."
          : "Publishing posture can stay calm until a deeper surface is needed.",
    },
  });
}

function buildDecisionSignals(summary = {}) {
  if (summary.pending <= 0) return [];

  return [
    createSystemSignal({
      id: "comments-review-pressure",
      kind: "decision",
      relatedCapability: "comments",
      sourceSubsystem: "publish_summary",
      statusCode: "review_required",
      priority: summary.pending > 4 ? "high" : "medium",
      confidence: 0.84,
      requiresHuman: true,
      canAutoFix: false,
      target: {
        kind: "comments",
        allowed: true,
      },
      context: {
        title: "Review comment moderation pressure",
        subjectName: "Comment moderation queue",
        statusLabel: "review_required",
        summary: `${summary.pending} comment${summary.pending === 1 ? "" : "s"} need human moderation review.`,
        reasonSummary:
          "These items are still pending or manually escalated in the recent moderation sample.",
        impactSummary:
          "Customer-facing replies may wait until someone reviews them.",
      },
    }),
  ];
}

function buildOutcomeSignals(summary = {}) {
  const items = [];
  const completed = summary.replied + summary.reviewed;

  if (completed > 0) {
    items.push(
      createSystemSignal({
        id: "comments-reviewed-outcome",
        kind: "outcome",
        relatedCapability: "comments",
        sourceSubsystem: "publish_summary",
        statusCode: "completed",
        priority: "low",
        confidence: 0.8,
        target: {
          kind: "comments",
          allowed: true,
        },
        context: {
          title: "Recent moderation work completed",
          subjectName: "Comments moderation",
          statusLabel: "completed",
          summary: `${completed} recent comment${completed === 1 ? "" : "s"} were reviewed, approved, or replied to.`,
          reasonSummary:
            "Recent moderation items show completed review or reply work.",
          impactSummary:
            "The moderation queue is moving without opening the full comments surface.",
        },
      })
    );
  }

  if (summary.flagged > 0) {
    items.push(
      createSystemSignal({
        id: "comments-guardrails-outcome",
        kind: "auto_action_taken",
        relatedCapability: "comments",
        sourceSubsystem: "publish_summary",
        statusCode: "guarded",
        priority: "low",
        confidence: 0.76,
        target: {
          kind: "comments",
          allowed: true,
        },
        context: {
          title: "Moderation guardrails caught risky comments",
          subjectName: "Comments moderation",
          statusLabel: "guarded",
          summary: `${summary.flagged} recent comment${summary.flagged === 1 ? "" : "s"} were flagged or ignored.`,
          reasonSummary:
            "The moderation feed shows recent defensive actions on public comments.",
          impactSummary:
            "Lower-risk items can usually wait while review stays focused on pending work.",
        },
      })
    );
  }

  return items;
}

export function buildPublishSystemSignals({
  comments = null,
} = {}) {
  const summary = summarizeComments(comments || {});

  return [
    buildCommentsCapabilitySignal(summary),
    buildPublishingCapabilitySignal(summary),
    ...buildDecisionSignals(summary),
    ...buildOutcomeSignals(summary),
  ].filter(Boolean);
}
