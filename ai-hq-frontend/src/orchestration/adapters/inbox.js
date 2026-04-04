import { createSystemSignal, n, s } from "../contracts/index.js";

function deriveThreadState(thread = {}) {
  const status = s(thread?.status || "open").toLowerCase();
  const unread = n(thread?.unread_count, 0);
  const assigned = s(thread?.assigned_to);
  const handoff = thread?.handoff_active === true;

  if (status === "closed") return "closed";
  if (status === "resolved") return "resolved";
  if (handoff) return "handoff";
  if (assigned) return "assigned";
  if (unread > 0) return "open";
  return "ai_active";
}

function summarizeThreads(payload = {}) {
  const threads = Array.isArray(payload?.threads) ? payload.threads : [];

  let unread = 0;
  let handoff = 0;
  let open = 0;
  let aiActive = 0;
  let resolved = 0;

  for (const thread of threads) {
    unread += n(thread?.unread_count, 0);

    const state = deriveThreadState(thread);
    if (state === "handoff" || state === "assigned") handoff += 1;
    else if (state === "open") open += 1;
    else if (state === "ai_active") aiActive += 1;
    else if (state === "resolved" || state === "closed") resolved += 1;
  }

  return {
    threadCount: threads.length,
    unread,
    handoff,
    open,
    aiActive,
    resolved,
    dbDisabled: payload?.dbDisabled === true,
  };
}

function buildConversationCapabilitySignal(summary = {}, outboundSummary = {}) {
  const deliveryBlocked = n(outboundSummary?.dead, 0) > 0;
  const requiresReview = summary.handoff > 0;
  const statusCode = deliveryBlocked
    ? "limited"
    : requiresReview
      ? "review_only"
      : summary.threadCount > 0
        ? "active"
        : "idle";

  return createSystemSignal({
    id: "capability-inbox-conversations",
    kind: "capability_state",
    relatedCapability: "inbox",
    sourceSubsystem: "inbox_summary",
    statusCode,
    priority: deliveryBlocked ? "high" : requiresReview ? "medium" : "low",
    confidence: 0.83,
    requiresHuman: requiresReview,
    canAutoFix: false,
    target: {
      kind: "inbox",
      allowed: true,
    },
    context: {
      subjectName: "Inbox conversations",
      statusLabel: statusCode,
      summary: deliveryBlocked
        ? "Delivery issues are constraining conversation follow-up."
        : requiresReview
          ? `${summary.handoff} conversation${summary.handoff === 1 ? "" : "s"} currently need operator handoff.`
          : summary.unread > 0
            ? `${summary.unread} unread message${summary.unread === 1 ? "" : "s"} are waiting in the inbox.`
            : summary.threadCount > 0
              ? `Inbox conversations are active across ${summary.threadCount} recent thread${summary.threadCount === 1 ? "" : "s"}.`
              : "No recent inbox pressure is visible right now.",
      reasonSummary: requiresReview
        ? "Some conversations are paused for human review or assignment."
        : deliveryBlocked
          ? "Outbound delivery problems are affecting conversation continuity."
          : "Recent thread state was summarized from the lightweight inbox feed.",
      impactSummary: requiresReview
        ? "The assistant can draft, but operator attention is still needed before some conversations can continue."
        : deliveryBlocked
          ? "Follow-up reliability is reduced until outbound delivery stabilizes."
          : "Conversation handling can continue under the current posture.",
    },
  });
}

function buildDecisionSignals(summary = {}) {
  if (summary.handoff <= 0) return [];

  return [
    createSystemSignal({
      id: "inbox-handoff-pressure",
      kind: "decision",
      relatedCapability: "inbox",
      sourceSubsystem: "inbox_summary",
      statusCode: "handoff_required",
      priority: summary.handoff > 2 ? "high" : "medium",
      confidence: 0.88,
      requiresHuman: true,
      canAutoFix: false,
      target: {
        kind: "inbox",
        allowed: true,
      },
      context: {
        title: "Review inbox handoff pressure",
        subjectName: "Inbox handoff queue",
        statusLabel: "handoff_required",
        summary: `${summary.handoff} conversation${summary.handoff === 1 ? "" : "s"} are waiting for human attention.`,
        reasonSummary:
          "These threads are assigned or paused for operator handling instead of autonomous continuation.",
        impactSummary:
          "Customer conversations may stall until someone reviews or replies.",
      },
    }),
  ];
}

function buildPressureSignals(summary = {}) {
  if (summary.unread <= 0) return [];

  return [
    createSystemSignal({
      id: "inbox-unread-pressure",
      kind: "signal",
      relatedCapability: "inbox",
      sourceSubsystem: "inbox_summary",
      statusCode: "attention_needed",
      priority: summary.unread > 6 ? "high" : "medium",
      confidence: 0.8,
      requiresHuman: false,
      canAutoFix: false,
      target: {
        kind: "inbox",
        allowed: true,
      },
      context: {
        title: "Unread inbox pressure is building",
        subjectName: "Inbox unread pressure",
        statusLabel: "attention_needed",
        summary: `${summary.unread} unread message${summary.unread === 1 ? "" : "s"} are waiting across recent threads.`,
        reasonSummary:
          "The workspace sampled lightweight inbox activity instead of opening full thread detail.",
        impactSummary:
          "Response latency may rise if unread conversations keep accumulating.",
      },
    }),
  ];
}

function buildOutboundSignals(outboundSummary = {}) {
  const failed = n(outboundSummary?.failed, 0);
  const retrying = n(outboundSummary?.retrying, 0);
  const dead = n(outboundSummary?.dead, 0);
  const sent = n(outboundSummary?.sent, 0);
  const items = [];

  if (failed + retrying + dead > 0) {
    items.push(
      createSystemSignal({
        id: "inbox-outbound-pressure",
        kind: dead > 0 ? "blocker" : "signal",
        relatedCapability: "inbox",
        sourceSubsystem: "inbox_outbound",
        statusCode: dead > 0 ? "delivery_blocked" : "delivery_degraded",
        priority: dead > 0 ? "high" : "medium",
        confidence: 0.86,
        requiresHuman: dead > 0,
        canAutoFix: retrying > 0 || failed > 0,
        target: {
          kind: "inbox",
          allowed: true,
        },
        context: {
          title: dead > 0 ? "Outbound delivery needs review" : "Outbound delivery is retrying",
          subjectName: "Outbound delivery",
          statusLabel: dead > 0 ? "blocked" : "degraded",
          summary:
            dead > 0
              ? `${dead} outbound attempt${dead === 1 ? "" : "s"} are dead and need attention.`
              : `${failed + retrying} outbound attempt${failed + retrying === 1 ? "" : "s"} are retrying or failed recently.`,
          reasonSummary:
            "The workspace used the lightweight outbound summary instead of loading retry queue detail.",
          impactSummary:
            dead > 0
              ? "Some customers may not receive intended follow-up messages."
              : "Recent outbound delivery is degraded but still being retried.",
        },
      })
    );
  }

  if (sent > 0) {
    items.push(
      createSystemSignal({
        id: "inbox-outbound-sent",
        kind: "outcome",
        relatedCapability: "inbox",
        sourceSubsystem: "inbox_outbound",
        statusCode: "delivered",
        priority: "low",
        confidence: 0.82,
        target: {
          kind: "inbox",
          allowed: true,
        },
        context: {
          title: "Recent inbox delivery succeeded",
          subjectName: "Outbound delivery",
          statusLabel: "delivered",
          summary: `${sent} outbound message${sent === 1 ? "" : "s"} were delivered recently.`,
          reasonSummary:
            "The lightweight outbound summary reported successful recent sends.",
          impactSummary:
            "Conversation follow-up is reaching customers under the current delivery posture.",
        },
      })
    );
  }

  return items;
}

export function buildInboxSystemSignals({
  threads = null,
  outbound = null,
} = {}) {
  const threadSummary = summarizeThreads(threads || {});
  const outboundSummary = outbound?.summary || outbound || {};

  return [
    buildConversationCapabilitySignal(threadSummary, outboundSummary),
    ...buildDecisionSignals(threadSummary),
    ...buildPressureSignals(threadSummary),
    ...buildOutboundSignals(outboundSummary),
  ].filter(Boolean);
}
