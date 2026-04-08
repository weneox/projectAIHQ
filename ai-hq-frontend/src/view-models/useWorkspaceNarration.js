import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAppBootstrap } from "../api/app.js";
import { listComments } from "../api/comments.js";
import { getOutboundSummary, listInboxThreads } from "../api/inbox.js";
import { getSetupOverview } from "../api/setup.js";
import { getSettingsTrustView } from "../api/trust.js";
import { getTruthReviewWorkbench } from "../api/truth.js";
import {
  dedupeNarrationItems,
  signalsToNarrationItems,
  sortByPriorityAndTime,
} from "../orchestration/contracts/index.js";
import {
  buildCapabilitySystemSignals,
  buildInboxSystemSignals,
  buildPublishSystemSignals,
  buildSetupSystemSignals,
  buildTruthSystemSignals,
} from "../orchestration/adapters/index.js";
import { buildWorkspaceBusinessMemory } from "./workspaceBusinessMemory.js";
import { buildWorkspaceSuggestedActions } from "./workspaceIntents.js";
import { applyWorkspaceRouteMap } from "./workspaceRouteMap.js";
import { getAppSessionContext } from "../lib/appSession.js";
import { buildWorkspaceSetupState } from "./workspaceSetupState.js";

const CAPABILITY_ORDER = [
  "business_memory",
  "setup_intake",
  "inbox",
  "comments",
  "publish",
  "voice",
  "whatsapp",
  "instagram",
  "chatbot",
];

const CAPABILITY_LABELS = {
  business_memory: "Business memory",
  setup_intake: "Setup",
  inbox: "Inbox",
  comments: "Comments moderation",
  publish: "Publishing",
  voice: "Voice",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  chatbot: "Chatbot",
};

const STATUS_LABELS = {
  approved: "Stable",
  ready: "Ready",
  review_only: "Needs review",
  blocked: "Blocked",
  limited: "Limited",
  guarded: "Guarded",
  active: "Active",
  autonomous: "Autonomous",
  idle: "Quiet",
  pending: "Pending",
  unavailable: "Unavailable",
  unknown: "Unknown",
};

const SOURCE_DEFINITIONS = [
  { key: "bootstrap", label: "Workspace core" },
  { key: "overview", label: "Setup" },
  { key: "trust", label: "Business memory" },
  { key: "workbench", label: "Business changes" },
  { key: "inboxThreads", label: "Inbox" },
  { key: "inboxOutbound", label: "Outbound activity" },
  { key: "comments", label: "Comments" },
];

const POSTURE_ORDER = [
  "setup_intake",
  "business_memory",
  "inbox",
  "comments",
  "publish",
];

const SOURCE_KEYS_BY_DOMAIN = {
  setup_intake: ["bootstrap", "overview"],
  business_memory: ["trust", "workbench"],
  inbox: ["inboxThreads", "inboxOutbound"],
  comments: ["comments"],
  publish: ["comments"],
};

const DOMAIN_FALLBACK_LABELS = {
  setup_intake: "Setup",
  business_memory: "Business memory",
  inbox: "Inbox",
  comments: "Comments moderation",
  publish: "Publishing",
};

const OUTCOME_NOISE_PATTERNS = [
  /collecting lightweight operator signal/i,
  /no strong workspace signal/i,
  /could not be loaded/i,
];

const DEFAULT_WORKSPACE_NARRATION_PAYLOADS = {
  bootstrap: null,
  overview: null,
  trust: null,
  workbench: null,
  inboxThreads: null,
  inboxOutbound: null,
  comments: null,
};

const DEFAULT_WORKSPACE_NARRATION_SOURCE_STATUS = {
  bootstrap: { available: true },
  overview: { available: true },
  trust: { available: true },
  workbench: { available: true },
  inboxThreads: { available: true },
  inboxOutbound: { available: true },
  comments: { available: true },
};

function titleize(value = "") {
  return String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (item) => item.toUpperCase());
}

function sentence(value = "", fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function compactSentence(value = "", fallback = "") {
  return sentence(value, fallback).replace(/\s+/g, " ");
}

function statusLabel(value = "") {
  const next = String(value || "").trim().toLowerCase();
  return STATUS_LABELS[next] || titleize(next || "unknown");
}

function toneForPriority(priority = "") {
  switch (String(priority || "").toLowerCase()) {
    case "critical":
      return "danger";
    case "high":
      return "warn";
    case "medium":
      return "info";
    default:
      return "neutral";
  }
}

function toneForStatus(value = "") {
  switch (String(value || "").toLowerCase()) {
    case "blocked":
    case "unavailable":
      return "danger";
    case "review_only":
    case "limited":
    case "pending":
      return "warn";
    case "ready":
    case "approved":
    case "active":
    case "autonomous":
      return "success";
    default:
      return "neutral";
  }
}

function capabilityWeight(item = {}) {
  if (item.kind === "capability_state") return 300;
  if (item.kind === "blocker") return 250;
  if (item.kind === "decision") return 225;
  if (item.requiresHuman) return 200;
  if (item.kind === "recommended_action") return 180;
  if (item.kind === "outcome" || item.kind === "auto_action_taken") return 120;
  return 100;
}

function pickCapabilityStatus(item = {}) {
  if (item.kind === "capability_state") return item.status || "active";
  if (item.kind === "blocker") return "blocked";
  if (item.kind === "decision" || item.requiresHuman) return "review_only";
  if (item.kind === "recommended_action") return "pending";
  if (item.kind === "outcome" || item.kind === "auto_action_taken") return "active";
  return item.status || "active";
}

function buildCapabilitySummary(items = []) {
  const buckets = new Map();

  for (const item of items) {
    const capability = String(item?.relatedCapability || "")
      .trim()
      .toLowerCase();
    if (!capability || !CAPABILITY_ORDER.includes(capability)) continue;

    const existing = buckets.get(capability);
    if (!existing || capabilityWeight(item) > capabilityWeight(existing)) {
      buckets.set(capability, item);
    }
  }

  return CAPABILITY_ORDER.map((capability) => {
    const item = buckets.get(capability);
    if (!item) return null;

    const nextStatus = pickCapabilityStatus(item);

    return {
      id: `capability-summary-${capability}`,
      capability,
      label: CAPABILITY_LABELS[capability] || titleize(capability),
      status: nextStatus,
      statusLabel: statusLabel(nextStatus),
      sentence: item.whatHappened || item.title,
      why: item.why || "",
      impact: item.impact || "",
      priority: item.priority,
      nextAction: item.nextAction || null,
      requiresHuman: item.requiresHuman === true,
      tone: toneForStatus(nextStatus),
    };
  }).filter(Boolean);
}

function buildSystemBrief(ordered = [], decisions = []) {
  const changed = ordered.find(
    (item) =>
      item.kind === "outcome" ||
      item.kind === "auto_action_taken" ||
      item.kind === "signal"
  );
  const mattersMost = decisions[0] || ordered[0] || null;
  const safeToIgnore = [...ordered]
    .reverse()
    .find((item) => item.priority === "low" && item.requiresHuman !== true);

  return {
    changed:
      changed?.whatHappened ||
      "Workspace is collecting lightweight operator signal across setup, business memory, inbox, and moderation.",
    mattersMost:
      mattersMost?.whatHappened ||
      "Nothing urgent is demanding operator attention right now.",
    safeToIgnore:
      safeToIgnore?.whatHappened ||
      "Low-priority completed work can stay in the background for now.",
  };
}

function classifyNarration(items = []) {
  const ordered = sortByPriorityAndTime(dedupeNarrationItems(items));
  const brief = [];
  const decisions = [];
  const recentOutcomes = [];

  for (const item of ordered) {
    if (item.requiresHuman && decisions.length < 6) {
      decisions.push(item);
      continue;
    }

    if (
      (item.kind === "outcome" || item.kind === "auto_action_taken") &&
      recentOutcomes.length < 6
    ) {
      recentOutcomes.push(item);
      continue;
    }

    if (brief.length < 5) {
      brief.push(item);
    }
  }

  if (!brief.length) {
    brief.push(...ordered.slice(0, 3));
  }

  return {
    ordered,
    brief,
    decisions,
    capabilities: buildCapabilitySummary(ordered),
    recentOutcomes,
    systemBrief: buildSystemBrief(ordered, decisions),
  };
}

const WORKSPACE_SAMPLE_LIMIT = 8;

async function loadWorkspaceNarrationPayloads() {
  const session = await getAppSessionContext().catch(() => null);
  const bootstrapPromise = session?.bootstrap
    ? Promise.resolve(session.bootstrap)
    : getAppBootstrap();

  const requests = {
    bootstrap: bootstrapPromise,
    overview: getSetupOverview(),
    trust: getSettingsTrustView({ limit: 6 }),
    workbench: getTruthReviewWorkbench({ limit: 6 }),
    inboxThreads: listInboxThreads({ limit: WORKSPACE_SAMPLE_LIMIT }),
    inboxOutbound: getOutboundSummary(),
    comments: listComments({ limit: WORKSPACE_SAMPLE_LIMIT }),
  };

  const settledEntries = await Promise.all(
    Object.entries(requests).map(async ([key, promise]) => [
      key,
      await Promise.allSettled([promise]),
    ])
  );

  const payloads = {};
  const sourceStatus = {};

  for (const [key, settledWrapper] of settledEntries) {
    const settled = settledWrapper[0];
    if (settled.status === "fulfilled") {
      payloads[key] = settled.value;
      sourceStatus[key] = { available: true };
    } else {
      payloads[key] = null;
      sourceStatus[key] = { available: false };
    }
  }

  return { payloads, sourceStatus };
}

function buildAvailabilityNotice(domainStates = {}) {
  const items = Object.values(domainStates).filter(
    (item) => item?.noticeLevel === "unavailable" || item?.noticeLevel === "partial"
  );

  if (!items.length) {
    return {
      tone: "neutral",
      title: "",
      description: "",
      partial: false,
      allUnavailable: false,
      details: [],
    };
  }

  const allUnavailable = items.every((item) => item.noticeLevel === "unavailable");

  if (allUnavailable) {
    return {
      tone: "danger",
      title: "Workspace unavailable",
      description:
        "Core workspace signals could not be loaded. Retry to restore setup, business memory, inbox, and moderation context.",
      partial: false,
      allUnavailable: true,
      details: items.map((item) => ({
        label: item.label,
        detail: item.noticeDetail || item.summary,
      })),
    };
  }

  return {
    tone: "warn",
    title: "Workspace is showing partial signal",
    description: items
      .map((item) => item.noticeDetail || item.summary)
      .join(" "),
    partial: true,
    allUnavailable: false,
    details: items.map((item) => ({
      label: item.label,
      detail: item.noticeDetail || item.summary,
    })),
  };
}

function withoutSetupNarration(items = []) {
  return items.filter((item) => item?.relatedCapability !== "setup_intake");
}

function buildGenericDomainState({
  domain,
  capability,
  sourceStatus,
}) {
  const label = DOMAIN_FALLBACK_LABELS[domain];
  const sourceKeys = SOURCE_KEYS_BY_DOMAIN[domain] || [];
  const availableCount = sourceKeys.filter(
    (key) => sourceStatus[key]?.available !== false
  ).length;
  const totalCount = sourceKeys.length;
  const allUnavailable = totalCount > 0 && availableCount === 0;
  const partial = totalCount > 1 && availableCount > 0 && availableCount < totalCount;

  if (allUnavailable) {
    return {
      id: domain,
      label,
      status: "unavailable",
      statusLabel: "Unavailable",
      tone: "danger",
      summary: `${label} could not be loaded.`,
      action: null,
      noticeLevel: "unavailable",
      noticeDetail: `${label} is unavailable.`,
      actionable: false,
      latestChange: "",
    };
  }

  if (capability) {
    return {
      id: domain,
      label: capability.label,
      status: partial ? "limited" : capability.status,
      statusLabel: partial ? "Signal limited" : capability.statusLabel,
      tone: partial ? "warn" : capability.tone,
      summary: sentence(
        capability.impact || capability.sentence,
        "No additional posture context yet."
      ),
      action: capability.nextAction,
      noticeLevel: partial ? "partial" : null,
      noticeDetail: partial
        ? `${label} is partially available. Some upstream signal is missing.`
        : "",
      actionable: ["blocked", "limited", "review_only"].includes(capability.status),
      latestChange: capability.sentence || "",
    };
  }

  return {
    id: domain,
    label,
    status: partial ? "limited" : "unknown",
    statusLabel: partial ? "Signal limited" : "Quiet",
    tone: partial ? "warn" : "neutral",
    summary: partial
      ? `${label} is partially available. Some upstream signal is missing.`
      : "No strong workspace signal is available for this area yet.",
    action: null,
    noticeLevel: partial ? "partial" : null,
    noticeDetail: partial ? `${label} is partially available.` : "",
    actionable: false,
    latestChange: "",
  };
}

function buildBusinessMemoryDomainState({
  businessMemory,
  capability,
  sourceStatus,
}) {
  const trustAvailable = sourceStatus.trust?.available !== false;
  const workbenchAvailable = sourceStatus.workbench?.available !== false;
  const hasApprovedSnapshot = Boolean(businessMemory?.stats?.approvedVersionId);
  const pendingCount = Number(businessMemory?.stats?.pendingCount || 0);
  const hasReviewQueue = pendingCount > 0;
  const hasBlockers = Number(businessMemory?.stats?.blockerCount || 0) > 0;
  const runtimeBlocked = businessMemory?.runtime?.blocked === true;

  if (!trustAvailable && !workbenchAvailable) {
    return {
      id: "business_memory",
      label: "Business memory",
      status: "unavailable",
      statusLabel: "Unavailable",
      tone: "danger",
      summary: "Business memory could not be loaded.",
      action: null,
      noticeLevel: "unavailable",
      noticeDetail: "Business memory is unavailable.",
      actionable: false,
      latestChange: "",
    };
  }

  if (runtimeBlocked) {
    return {
      id: "business_memory",
      label: "Business memory",
      status: "blocked",
      statusLabel: "Repair required",
      tone: "danger",
      summary: sentence(
        businessMemory?.runtime?.summary,
        "Approved truth exists, but runtime repair is still required."
      ),
      action: businessMemory?.runtime?.action || businessMemory?.primaryAction || null,
      noticeLevel: null,
      noticeDetail: "",
      actionable: true,
      latestChange: sentence(
        businessMemory?.runtime?.summary,
        "Runtime repair is required."
      ),
      storyline: "runtime_repair",
    };
  }

  if (hasReviewQueue && workbenchAvailable && !trustAvailable) {
    return {
      id: "business_memory",
      label: "Business memory",
      status: "limited",
      statusLabel: "Review available",
      tone: "warn",
      summary:
        "Review queue is available, but the approved business memory snapshot is unavailable.",
      action: businessMemory?.primaryAction || null,
      noticeLevel: "partial",
      noticeDetail:
        "Business memory is partially available. Review work is visible, but the approved snapshot is unavailable.",
      actionable: true,
      latestChange: sentence(
        businessMemory?.mayHaveChanged,
        "Business changes are waiting for review."
      ),
      storyline: "review",
    };
  }

  if (!workbenchAvailable && trustAvailable && hasApprovedSnapshot) {
    return {
      id: "business_memory",
      label: "Business memory",
      status: "limited",
      statusLabel: "Snapshot available",
      tone: "warn",
      summary:
        "Approved business memory is available, but the change review queue is unavailable.",
      action: businessMemory?.primaryAction || null,
      noticeLevel: "partial",
      noticeDetail:
        "Business memory is partially available. The approved snapshot is visible, but review telemetry is incomplete.",
      actionable: false,
      latestChange: sentence(
        businessMemory?.recentlyReliable,
        businessMemory?.currentKnown
      ),
      storyline: "snapshot",
    };
  }

  if (hasReviewQueue) {
    return {
      id: "business_memory",
      label: "Business memory",
      status: "review_only",
      statusLabel: "Needs review",
      tone: "warn",
      summary: sentence(
        businessMemory?.needsConfirmation,
        "Business changes are waiting for review."
      ),
      action: businessMemory?.primaryAction || null,
      noticeLevel: null,
      noticeDetail: "",
      actionable: true,
      latestChange: sentence(
        businessMemory?.mayHaveChanged,
        "Business changes are waiting for review."
      ),
      storyline: "review",
    };
  }

  if (hasBlockers) {
    return {
      id: "business_memory",
      label: "Business memory",
      status: "blocked",
      statusLabel: "Blocked",
      tone: "danger",
      summary: sentence(businessMemory?.blocked, "Business memory has blockers."),
      action: businessMemory?.primaryAction || null,
      noticeLevel: null,
      noticeDetail: "",
      actionable: true,
      latestChange: sentence(businessMemory?.blocked),
      storyline: "blocked",
    };
  }

  if (hasApprovedSnapshot) {
    return {
      id: "business_memory",
      label: "Business memory",
      status: "approved",
      statusLabel: "Stable",
      tone: "success",
      summary: sentence(
        businessMemory?.currentKnown,
        "Approved business memory is available."
      ),
      action: businessMemory?.primaryAction || null,
      noticeLevel: null,
      noticeDetail: "",
      actionable: false,
      latestChange: sentence(
        businessMemory?.recentlyReliable,
        businessMemory?.currentKnown
      ),
      storyline: "snapshot",
    };
  }

  if (capability) {
    return {
      id: "business_memory",
      label: capability.label,
      status: capability.status,
      statusLabel: capability.statusLabel,
      tone: capability.tone,
      summary: sentence(capability.impact || capability.sentence),
      action: capability.nextAction,
      noticeLevel: null,
      noticeDetail: "",
      actionable: ["blocked", "limited", "review_only"].includes(capability.status),
      latestChange: sentence(capability.sentence),
    };
  }

  return {
    id: "business_memory",
    label: "Business memory",
    status: "unknown",
    statusLabel: "Quiet",
    tone: "neutral",
    summary: "No strong business-memory signal is available yet.",
    action: null,
    noticeLevel: null,
    noticeDetail: "",
    actionable: false,
    latestChange: "",
  };
}

function buildDomainStates({ setupState, businessMemory, capabilities, sourceStatus }) {
  const capabilityMap = new Map(
    withoutSetupNarration(capabilities).map((item) => [item.capability, item])
  );

  return {
    setup_intake: {
      id: "setup_intake",
      label: "Setup",
      status: setupState?.status || "unknown",
      statusLabel: statusLabel(setupState?.status || "unknown"),
      tone: setupState?.tone || "neutral",
      summary: sentence(setupState?.summary, "No strong setup signal is available yet."),
      action: setupState?.action || null,
      noticeLevel: setupState?.status === "unavailable" ? "unavailable" : null,
      noticeDetail:
        setupState?.status === "unavailable" ? "Setup is unavailable." : "",
      actionable: Boolean(setupState?.isActionable),
      latestChange: compactSentence(setupState?.summary || ""),
    },
    business_memory: buildBusinessMemoryDomainState({
      businessMemory,
      capability: capabilityMap.get("business_memory"),
      sourceStatus,
    }),
    inbox: buildGenericDomainState({
      domain: "inbox",
      capability: capabilityMap.get("inbox"),
      sourceStatus,
    }),
    comments: buildGenericDomainState({
      domain: "comments",
      capability: capabilityMap.get("comments"),
      sourceStatus,
    }),
    publish: buildGenericDomainState({
      domain: "publish",
      capability: capabilityMap.get("publish"),
      sourceStatus,
    }),
  };
}

function buildActionItems({
  setupState,
  domainStates,
  decisions,
  capabilities,
}) {
  const items = [];

  if (setupState?.isActionable) {
    items.push({
      id: "setup-state",
      status: setupState.badge,
      tone: setupState.tone,
      title: setupState.title,
      impact: compactSentence(setupState.summary),
      action: setupState.action,
    });
  }

  if (domainStates.business_memory?.actionable) {
    items.push({
      id: "business-memory-review",
      status: domainStates.business_memory.statusLabel,
      tone: domainStates.business_memory.tone,
      title:
        domainStates.business_memory.storyline === "runtime_repair"
          ? "Repair truth/runtime before trusting automation."
          : domainStates.business_memory.storyline === "blocked"
            ? "Business memory is blocked."
            : "Review business changes.",
      impact: compactSentence(
        domainStates.business_memory.summary,
        "Business memory needs operator review."
      ),
      action: domainStates.business_memory.action,
    });
  }

  const unresolvedDecision = withoutSetupNarration(decisions).find(
    (item) => item.relatedCapability !== "business_memory"
  );
  if (unresolvedDecision) {
    items.push({
      id: `decision-${unresolvedDecision.id}`,
      status: titleize(unresolvedDecision.priority || "Review"),
      tone: toneForPriority(unresolvedDecision.priority),
      title: sentence(unresolvedDecision.title, "Operator review needed."),
      impact: sentence(
        unresolvedDecision.whatHappened || unresolvedDecision.impact,
        "This item is waiting for operator judgment."
      ),
      action: unresolvedDecision.nextAction || null,
    });
  }

  const blockedCapability = withoutSetupNarration(capabilities).find((item) =>
    ["blocked", "limited", "review_only"].includes(item.status)
  );
  if (
    blockedCapability &&
    blockedCapability.capability !== "business_memory" &&
    !items.some((item) => item.id.includes(blockedCapability.capability))
  ) {
    items.push({
      id: `capability-${blockedCapability.capability}`,
      status: blockedCapability.statusLabel,
      tone: blockedCapability.tone,
      title: `${blockedCapability.label} needs attention.`,
      impact: compactSentence(
        blockedCapability.impact || blockedCapability.sentence,
        "This capability is not fully healthy right now."
      ),
      action: blockedCapability.nextAction,
    });
  }

  const unique = new Map();
  for (const item of items) {
    if (!unique.has(item.id)) unique.set(item.id, item);
  }

  return Array.from(unique.values()).slice(0, 4);
}

function buildPostureItems({ domainStates }) {
  return POSTURE_ORDER.map((domain) => {
    const state = domainStates[domain];
    return {
      id: domain === "setup_intake" ? "posture-setup" : `posture-${domain}`,
      label: state?.label || DOMAIN_FALLBACK_LABELS[domain],
      status: state?.status || "unknown",
      statusLabel: state?.statusLabel || "Quiet",
      tone: state?.tone || "neutral",
      summary:
        state?.summary || "No strong workspace signal is available for this area yet.",
      action: state?.action || null,
    };
  });
}

function buildFallbackOutcomeItems(payloads = {}, domainStates = {}) {
  if (domainStates.business_memory?.storyline === "runtime_repair") {
    return [
      {
        id: "runtime-repair-fallback",
        title: "Runtime still needs repair.",
        summary: compactSentence(
          domainStates.business_memory.summary,
          "Truth or runtime still needs repair before live automation should be trusted."
        ),
        tone: "danger",
        label: "Repair required",
        nextAction: domainStates.business_memory.action || {
          label: "Open truth",
          path: "/truth",
        },
      },
    ];
  }

  const workbenchItems = Array.isArray(payloads.workbench?.items)
    ? payloads.workbench.items
    : [];
  if (workbenchItems.length) {
    const lead = workbenchItems[0];
    return [
      {
        id: `workbench-${lead?.id || "review"}`,
        title: "Business review queue changed.",
        summary:
          workbenchItems.length === 1
            ? `${sentence(lead?.title || lead?.valueText, "One business change")} is waiting for review.`
            : `${workbenchItems.length} business changes are waiting for review.`,
        tone: "warn",
        label: "Pending review",
        nextAction: {
          label: "Review business changes",
          path: "/truth",
        },
      },
    ];
  }

  const pendingSetupItems = Number(
    payloads.overview?.setup?.knowledge?.pendingCandidateCount ||
      payloads.overview?.knowledge?.pendingCandidateCount ||
      0
  );
  if (pendingSetupItems > 0) {
    return [
      {
        id: "setup-review-fallback",
        title: "Setup review queue changed.",
        summary: `${pendingSetupItems} imported setup ${
          pendingSetupItems === 1 ? "item needs" : "items need"
        } review.`,
        tone: "warn",
        label: "Pending review",
        nextAction: {
          label: "Open setup assistant",
          path: "/home?assistant=setup",
        },
      },
    ];
  }

  const trustRun = Array.isArray(payloads.trust?.recentRuns)
    ? payloads.trust.recentRuns[0]
    : null;
  if (trustRun?.sourceDisplayName) {
    return [
      {
        id: `trust-run-${trustRun.id || trustRun.sourceDisplayName}`,
        title: trustRun.reviewRequired
          ? "Business evidence changed."
          : "Business evidence refreshed.",
        summary: trustRun.reviewRequired
          ? `${trustRun.sourceDisplayName} refreshed and opened follow-up review work.`
          : `${trustRun.sourceDisplayName} refreshed successfully.`,
        tone: trustRun.reviewRequired ? "warn" : "neutral",
        label: trustRun.reviewRequired ? "Needs review" : "Update",
        nextAction: trustRun.reviewRequired
          ? {
              label: "Review business changes",
              path: "/truth",
            }
          : null,
      },
    ];
  }

  return [];
}

function buildOutcomeItems(items = [], notice = {}, payloads = {}, domainStates = {}) {
  const meaningfulItems = items.filter((item) => {
    const text = `${item?.title || ""} ${item?.whatHappened || ""}`.trim();
    return text && !OUTCOME_NOISE_PATTERNS.some((pattern) => pattern.test(text));
  });

  if (meaningfulItems.length) {
    return meaningfulItems.slice(0, 3).map((item) => ({
      id: item.id,
      title: compactSentence(item.title, "System outcome"),
      summary: compactSentence(
        item.whatHappened,
        "A recent system outcome is available."
      ),
      tone: toneForPriority(item.priority),
      label:
        item.requiresHuman === true
          ? "Needs review"
          : titleize(item.priority || "Update"),
      nextAction: item.nextAction || null,
    }));
  }

  const fallbackItems = buildFallbackOutcomeItems(payloads, domainStates);
  if (fallbackItems.length) {
    return fallbackItems;
  }

  if (notice.allUnavailable) {
    return [];
  }

  const concreteDomainSignal =
    domainStates.business_memory?.latestChange ||
    domainStates.setup_intake?.latestChange;

  return concreteDomainSignal
    ? [
        {
          id: "workspace-latest-change",
          title: "No recent completed outcome yet.",
          summary: compactSentence(concreteDomainSignal),
          tone: "neutral",
          label: "Current state",
          nextAction: null,
        },
      ]
    : [];
}

function buildSystemBriefFromTruth({
  baseBrief,
  domainStates,
  actionItems,
  outcomeItems,
}) {
  const changed =
    outcomeItems[0]?.summary ||
    domainStates.business_memory?.latestChange ||
    domainStates.setup_intake?.latestChange ||
    baseBrief.changed;

  const mattersMost = actionItems[0]?.title || baseBrief.mattersMost;

  const safeToIgnore =
    baseBrief.safeToIgnore ===
    "Low-priority completed work can stay in the background for now."
      ? "Nothing low-risk is demanding operator attention right now."
      : baseBrief.safeToIgnore;

  return {
    changed,
    mattersMost,
    safeToIgnore,
  };
}

export function useWorkspaceNarration() {
  const state = useQuery({
    queryKey: ["workspace-narration"],
    queryFn: loadWorkspaceNarrationPayloads,
    staleTime: 15_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const payloads = useMemo(
    () => state.data?.payloads ?? DEFAULT_WORKSPACE_NARRATION_PAYLOADS,
    [state.data?.payloads]
  );

  const sourceStatus = useMemo(
    () => state.data?.sourceStatus ?? DEFAULT_WORKSPACE_NARRATION_SOURCE_STATUS,
    [state.data?.sourceStatus]
  );

  const narration = useMemo(() => {
    const truthSignals = buildTruthSystemSignals({
      trust: payloads.trust,
      workbench: payloads.workbench,
    });
    const setupSignals = buildSetupSystemSignals({
      bootstrap: payloads.bootstrap,
      overview: payloads.overview,
    });
    const capabilitySignals = buildCapabilitySystemSignals({
      trust: payloads.trust,
    });
    const inboxSignals = buildInboxSystemSignals({
      threads: payloads.inboxThreads,
      outbound: payloads.inboxOutbound,
    });
    const publishSignals = buildPublishSystemSignals({
      comments: payloads.comments,
    });

    return classifyNarration(
      signalsToNarrationItems([
        ...truthSignals,
        ...setupSignals,
        ...capabilitySignals,
        ...inboxSignals,
        ...publishSignals,
      ])
        .map(applyWorkspaceRouteMap)
        .filter((item) => item?.relatedCapability !== "setup_intake")
    );
  }, [payloads]);

  const setupState = useMemo(
    () =>
      buildWorkspaceSetupState({
        bootstrap: payloads.bootstrap,
        overview: payloads.overview,
        sourceStatus,
      }),
    [payloads.bootstrap, payloads.overview, sourceStatus]
  );

  const businessMemory = useMemo(
    () =>
      buildWorkspaceBusinessMemory({
        trust: payloads.trust,
        workbench: payloads.workbench,
        setupState,
      }),
    [payloads.trust, payloads.workbench, setupState]
  );

  const domainStates = useMemo(
    () =>
      buildDomainStates({
        setupState,
        businessMemory,
        capabilities: narration.capabilities,
        sourceStatus,
      }),
    [businessMemory, narration.capabilities, setupState, sourceStatus]
  );

  const availabilityNotice = useMemo(
    () => buildAvailabilityNotice(domainStates),
    [domainStates]
  );

  const actionItems = useMemo(
    () =>
      buildActionItems({
        setupState,
        domainStates,
        decisions: withoutSetupNarration(narration.decisions),
        capabilities: withoutSetupNarration(narration.capabilities),
      }),
    [domainStates, narration.capabilities, narration.decisions, setupState]
  );

  const postureItems = useMemo(
    () => buildPostureItems({ domainStates }),
    [domainStates]
  );

  const outcomeItems = useMemo(
    () =>
      buildOutcomeItems(
        narration.recentOutcomes,
        availabilityNotice,
        payloads,
        domainStates
      ),
    [availabilityNotice, domainStates, narration.recentOutcomes, payloads]
  );

  const systemBrief = useMemo(
    () =>
      buildSystemBriefFromTruth({
        baseBrief: narration.systemBrief,
        domainStates,
        actionItems,
        outcomeItems,
      }),
    [actionItems, domainStates, narration.systemBrief, outcomeItems]
  );

  const suggestedActions = useMemo(() => {
    const actions = buildWorkspaceSuggestedActions({
      ...narration,
      capabilities: withoutSetupNarration(narration.capabilities),
      decisions: withoutSetupNarration(narration.decisions),
    }).filter((item) => item.id !== "continue-setup");

    if (domainStates.business_memory?.storyline === "runtime_repair") {
      return [
        {
          id: "repair-runtime",
          label:
            domainStates.business_memory.action?.label || "Open truth and repair runtime",
          route: domainStates.business_memory.action?.path || "/truth",
          destinationSurface: "workspace",
        },
        ...actions,
      ].slice(0, 5);
    }

    if (setupState?.isActionable && setupState.action?.path) {
      return [
        {
          id: "continue-setup",
          label: setupState.action.label,
          route: setupState.action.path,
          destinationSurface: "workspace",
        },
        ...actions,
      ].slice(0, 5);
    }

    return actions;
  }, [domainStates.business_memory, narration, setupState]);

  const nextBestAction = actionItems[0]
    ? {
        id: actionItems[0].id,
        title: actionItems[0].title,
        impact: actionItems[0].impact,
        action: actionItems[0].action,
      }
    : suggestedActions[0]
      ? {
          id: suggestedActions[0].id,
          title: suggestedActions[0].label,
          impact:
            "This is the clearest next operator move available from the current workspace signal.",
          action: {
            label: suggestedActions[0].label,
            path: suggestedActions[0].route,
          },
        }
      : null;

  return {
    loading: state.isLoading,
    isFetching: state.isFetching,
    refetch: state.refetch,
    error: availabilityNotice.allUnavailable
      ? "Workspace unavailable"
      : "",
    availabilityNotice,
    sourceStatus,
    actionItems,
    postureItems,
    outcomeItems,
    domainStates,
    suggestedActions,
    nextBestAction,
    setupState,
    businessMemory,
    ...narration,
    systemBrief,
  };
}

export default useWorkspaceNarration;