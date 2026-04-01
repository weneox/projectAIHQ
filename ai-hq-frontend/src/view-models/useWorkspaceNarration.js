import { useEffect, useMemo, useState } from "react";
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
import { buildWorkspaceSetupGuidance } from "./workspaceSetupGuidance.js";
import { buildWorkspaceBusinessMemory } from "./workspaceBusinessMemory.js";
import { buildWorkspaceSuggestedActions } from "./workspaceIntents.js";
import { applyWorkspaceRouteMap } from "./workspaceRouteMap.js";
import { getAppSessionContext } from "../lib/appSession.js";

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
  business_memory: "Business Memory",
  setup_intake: "Setup Intake",
  inbox: "Inbox Conversations",
  comments: "Comments Moderation",
  publish: "Publishing",
  voice: "Voice",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  chatbot: "Chatbot",
};

const STATUS_LABELS = {
  approved: "stable",
  ready: "ready",
  review_only: "review-only",
  blocked: "blocked",
  limited: "limited",
  guarded: "guarded",
  active: "active",
  autonomous: "autonomous",
  idle: "quiet",
  pending: "pending",
  unknown: "unknown",
};

function titleize(value = "") {
  return String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (item) => item.toUpperCase());
}

function statusLabel(value = "") {
  const next = String(value || "").trim().toLowerCase();
  return STATUS_LABELS[next] || titleize(next || "unknown");
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
    const capability = String(item?.relatedCapability || "").trim().toLowerCase();
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
      "The workspace is collecting lightweight signals across setup, business memory, inbox, and publishing.",
    mattersMost:
      mattersMost?.whatHappened ||
      "Nothing urgent is demanding attention right now.",
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
const WORKSPACE_CACHE_TTL_MS = 15000;

let workspaceNarrationSnapshot = null;
let workspaceNarrationSnapshotAt = 0;
let workspaceNarrationInflightPromise = null;

async function loadWorkspaceNarrationPayloads() {
  const session = await getAppSessionContext().catch(() => null);
  const bootstrapPromise = session?.bootstrap
    ? Promise.resolve(session.bootstrap)
    : getAppBootstrap();

  const results = await Promise.allSettled([
    bootstrapPromise,
    getSetupOverview(),
    getSettingsTrustView({ limit: 6 }),
    getTruthReviewWorkbench({ limit: 6 }),
    listInboxThreads({ limit: WORKSPACE_SAMPLE_LIMIT }),
    getOutboundSummary(),
    listComments({ limit: WORKSPACE_SAMPLE_LIMIT }),
  ]);

  const payloads = {
    bootstrap: results[0].status === "fulfilled" ? results[0].value : null,
    overview: results[1].status === "fulfilled" ? results[1].value : null,
    trust: results[2].status === "fulfilled" ? results[2].value : null,
    workbench: results[3].status === "fulfilled" ? results[3].value : null,
    inboxThreads: results[4].status === "fulfilled" ? results[4].value : null,
    inboxOutbound: results[5].status === "fulfilled" ? results[5].value : null,
    comments: results[6].status === "fulfilled" ? results[6].value : null,
  };

  const failures = results.filter((item) => item.status === "rejected");

  return {
    loading: false,
    error:
      failures.length === results.length
        ? "Workspace narration could not be loaded."
        : "",
    payloads,
  };
}

function hasFreshWorkspaceNarrationSnapshot() {
  return (
    workspaceNarrationSnapshot &&
    Date.now() - workspaceNarrationSnapshotAt < WORKSPACE_CACHE_TTL_MS
  );
}

function getWorkspaceNarrationLoadPromise({ force = false } = {}) {
  if (hasFreshWorkspaceNarrationSnapshot() && !force) {
    return Promise.resolve(workspaceNarrationSnapshot);
  }

  if (!workspaceNarrationInflightPromise || force) {
    workspaceNarrationInflightPromise = loadWorkspaceNarrationPayloads()
      .then((snapshot) => {
        workspaceNarrationSnapshot = snapshot;
        workspaceNarrationSnapshotAt = Date.now();
        return snapshot;
      })
      .finally(() => {
        workspaceNarrationInflightPromise = null;
      });
  }

  return workspaceNarrationInflightPromise;
}

export function useWorkspaceNarration() {
  const [state, setState] = useState(
    () =>
      workspaceNarrationSnapshot || {
        loading: true,
        error: "",
        payloads: {
          bootstrap: null,
          overview: null,
          trust: null,
          workbench: null,
          inboxThreads: null,
          inboxOutbound: null,
          comments: null,
        },
      }
  );

  useEffect(() => {
    let alive = true;

    if (!hasFreshWorkspaceNarrationSnapshot()) {
      setState((prev) => ({
        ...prev,
        loading: true,
        error: "",
      }));
    }

    getWorkspaceNarrationLoadPromise()
      .then((snapshot) => {
        if (!alive) return;
        setState(snapshot);
      })
      .catch(() => {
        if (!alive) return;
        setState({
          loading: false,
          error: "Workspace narration could not be loaded.",
          payloads: {
            bootstrap: null,
            overview: null,
            trust: null,
            workbench: null,
            inboxThreads: null,
            inboxOutbound: null,
            comments: null,
          },
        });
      });

    return () => {
      alive = false;
    };
  }, []);

  const narration = useMemo(() => {
    const truthSignals = buildTruthSystemSignals({
      trust: state.payloads.trust,
      workbench: state.payloads.workbench,
    });
    const setupSignals = buildSetupSystemSignals({
      bootstrap: state.payloads.bootstrap,
      overview: state.payloads.overview,
    });
    const capabilitySignals = buildCapabilitySystemSignals({
      trust: state.payloads.trust,
    });
    const inboxSignals = buildInboxSystemSignals({
      threads: state.payloads.inboxThreads,
      outbound: state.payloads.inboxOutbound,
    });
    const publishSignals = buildPublishSystemSignals({
      comments: state.payloads.comments,
    });

    return classifyNarration(
      signalsToNarrationItems([
        ...truthSignals,
        ...setupSignals,
        ...capabilitySignals,
        ...inboxSignals,
        ...publishSignals,
      ]).map(applyWorkspaceRouteMap)
    );
  }, [state.payloads]);

  const suggestedActions = useMemo(
    () => buildWorkspaceSuggestedActions(narration),
    [narration]
  );
  const setupGuidance = useMemo(
    () =>
      buildWorkspaceSetupGuidance({
        bootstrap: state.payloads.bootstrap,
        overview: state.payloads.overview,
      }),
    [state.payloads.bootstrap, state.payloads.overview]
  );
  const businessMemory = useMemo(
    () =>
      buildWorkspaceBusinessMemory({
        trust: state.payloads.trust,
        workbench: state.payloads.workbench,
        setupGuidance,
      }),
    [state.payloads.trust, state.payloads.workbench, setupGuidance]
  );

  return {
    loading: state.loading,
    error: state.error,
    suggestedActions,
    setupGuidance,
    businessMemory,
    ...narration,
  };
}

export default useWorkspaceNarration;
