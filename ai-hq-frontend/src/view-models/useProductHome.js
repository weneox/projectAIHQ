import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOutboundSummary, listInboxThreads } from "../api/inbox.js";
import {
  getCurrentSetupAssistantSession,
  getSetupOverview,
} from "../api/setup.js";
import { getTelegramChannelStatus } from "../api/channelConnect.js";
import { getSettingsTrustView } from "../api/trust.js";
import { getTruthReviewWorkbench } from "../api/truth.js";
import { getAppSessionContext } from "../lib/appSession.js";
import { buildWorkspaceBusinessMemory } from "./workspaceBusinessMemory.js";
import { buildWorkspaceSetupState } from "./workspaceSetupState.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function pluralize(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatWorkspaceName(session = {}) {
  return s(
    session?.bootstrap?.workspace?.companyName ||
      session?.auth?.tenant?.company_name ||
      session?.auth?.tenant?.companyName ||
      session?.tenantKey ||
      "your business"
  );
}

function actionPath(action = {}) {
  return s(action?.path || action?.target?.path);
}

function normalizeAction(action = null, fallback = null) {
  const primary = obj(action);
  const secondary = obj(fallback);
  const path = actionPath(primary) || actionPath(secondary);
  const label = s(primary.label || secondary.label);

  if (!path && !label) return null;

  return {
    label: label || "Open",
    path: path || "/home",
  };
}

function normalizeReasonCodes(items = []) {
  return arr(items).map((item) => s(item).toLowerCase()).filter(Boolean);
}

function firstReadableValue(...values) {
  for (const value of values) {
    const next = s(value);
    if (next) return next;
  }
  return "";
}

function buildReasonHeadline(reasonCode = "") {
  switch (s(reasonCode).toLowerCase()) {
    case "approved_truth_unavailable":
    case "approved_truth_empty":
    case "approval_required":
      return {
        title: "Business truth still needs approval.",
        summary:
          "The launch channel can stay connected, but live runtime stays fail-closed until business truth is approved.",
      };
    case "projection_missing":
    case "runtime_projection_missing":
      return {
        title: "Runtime has not been built yet.",
        summary:
          "Approved truth exists, but the live runtime is not available yet.",
      };
    case "projection_stale":
    case "runtime_projection_stale":
      return {
        title: "Runtime needs refresh.",
        summary:
          "Approved truth exists, but the runtime projection is stale and should be refreshed before trusting automation.",
      };
    case "truth_version_drift":
      return {
        title: "Runtime is out of sync with approved truth.",
        summary:
          "The business truth changed, and the runtime now needs refresh before it should be treated as live.",
      };
    case "authority_invalid":
    case "runtime_authority_unavailable":
      return {
        title: "Runtime repair is required.",
        summary:
          "The system cannot safely use the current runtime authority until repair finishes.",
      };
    case "repair_pending":
      return {
        title: "Runtime repair is still running.",
        summary:
          "The system already knows what to fix, but the repair is not finished yet.",
      };
    case "provider_secret_missing":
      return {
        title: "A required provider secret is missing.",
        summary:
          "The connected channel cannot be treated as live until the missing provider secret is restored.",
      };
    case "channel_identifiers_missing":
      return {
        title: "Channel identifiers still need review.",
        summary:
          "The channel is connected, but required identifiers are incomplete, so delivery should not be trusted yet.",
      };
    case "channel_not_connected":
      return {
        title: "Connect a launch channel before going live.",
        summary:
          "The setup lane is blocked until a launch channel is connected.",
      };
    default:
      return {
        title: "Live automation is still blocked.",
        summary:
          "A required launch dependency still needs review or repair before the system should be trusted as live.",
      };
  }
}

function pickReadinessAction(readiness = {}, fallbackAction = null) {
  const source = obj(readiness);

  for (const blocker of arr(source.blockedItems || source.blockers)) {
    const nextAction = normalizeAction(
      blocker?.nextAction || blocker?.action || blocker?.repairAction
    );
    if (nextAction?.path) return nextAction;
  }

  for (const action of arr(source.repairActions)) {
    const nextAction = normalizeAction(action);
    if (nextAction?.path) return nextAction;
  }

  return normalizeAction(fallbackAction);
}

function pickRuntimeRepairAction(trustPayload = {}) {
  const runtimeProjection = obj(trustPayload?.summary?.runtimeProjection);
  const health = obj(runtimeProjection.health);
  const repair = obj(runtimeProjection.repair);

  return (
    normalizeAction(health.repairAction) ||
    arr(health.repairActions).map((item) => normalizeAction(item)).find(Boolean) ||
    normalizeAction(repair.action) ||
    pickReadinessAction(runtimeProjection.readiness) ||
    normalizeAction({ label: "Open truth", path: "/truth" })
  );
}

function buildRuntimeRepairDetail({ trustPayload, telegramPayload }) {
  const runtimeProjection = obj(trustPayload?.summary?.runtimeProjection);
  const health = obj(runtimeProjection.health);
  const runtimeReadiness = obj(runtimeProjection.readiness);
  const truthReadiness = obj(trustPayload?.summary?.truth?.readiness);
  const channelReadiness = obj(telegramPayload?.readiness);
  const reasonCodes = normalizeReasonCodes([
    health.reasonCode,
    ...(health.reasons || []),
    truthReadiness.reasonCode,
    ...(truthReadiness.reasonCodes || []),
    runtimeReadiness.reasonCode,
    ...(runtimeReadiness.reasonCodes || []),
    channelReadiness.reasonCode,
  ]);

  const leadReason = reasonCodes[0] || "";
  const copy = buildReasonHeadline(leadReason);

  const detail = firstReadableValue(
    runtimeReadiness.message,
    truthReadiness.message,
    channelReadiness.message,
    health.lastFailure?.errorMessage,
    health.lastFailure?.errorCode,
    telegramPayload?.runtime?.message,
    telegramPayload?.readiness?.message
  );

  return {
    title: copy.title,
    summary: copy.summary,
    detail,
    reasonCodes,
    leadReason,
  };
}

async function loadProductHomePayloads() {
  const session = await getAppSessionContext().catch(() => null);

  const requests = {
    session: Promise.resolve(session),
    overview: getSetupOverview(),
    trust: getSettingsTrustView({ limit: 4 }),
    workbench: getTruthReviewWorkbench({ limit: 4 }),
    inboxThreads: listInboxThreads({ limit: 10 }),
    inboxOutbound: getOutboundSummary(),
    telegramStatus: getTelegramChannelStatus(),
    setupAssistantSession: getCurrentSetupAssistantSession(),
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

function buildInboxState({ threadsPayload, outboundPayload, sourceStatus }) {
  const threadsAvailable = sourceStatus.inboxThreads?.available !== false;
  const outboundAvailable = sourceStatus.inboxOutbound?.available !== false;
  const threads = arr(threadsPayload?.threads);
  const unreadCount = threads.reduce(
    (sum, thread) => sum + n(thread?.unread_count),
    0
  );
  const openCount = threads.filter((thread) => {
    const status = s(thread?.status, "open").toLowerCase();
    return status !== "resolved" && status !== "closed";
  }).length;
  const handoffCount = threads.filter(
    (thread) => thread?.handoff_active || s(thread?.assigned_to)
  ).length;
  const outboundPending = Math.max(
    n(outboundPayload?.pendingCount),
    n(outboundPayload?.pending),
    n(outboundPayload?.retryingCount),
    n(outboundPayload?.failedCount)
  );

  if (!threadsAvailable && !outboundAvailable) {
    return {
      status: "unavailable",
      statusLabel: "Unavailable",
      tone: "danger",
      summary: "Conversation activity is unavailable right now.",
      detail: "Inbox and outbound activity could not be loaded.",
      action: { label: "Open inbox", path: "/inbox" },
      counts: {
        unreadCount: 0,
        openCount: 0,
        handoffCount: 0,
        outboundPending: 0,
      },
    };
  }

  if (unreadCount > 0) {
    return {
      status: "attention",
      statusLabel: "Needs attention",
      tone: "warn",
      summary: `${pluralize(unreadCount, "unread message")} ${
        unreadCount === 1 ? "is" : "are"
      } waiting across ${pluralize(Math.max(openCount, 1), "open conversation")}.`,
      detail: handoffCount
        ? `${pluralize(handoffCount, "conversation")} already ${
            handoffCount === 1 ? "has" : "have"
          } operator ownership.`
        : "Open the queue to triage new activity.",
      action: { label: "Open inbox", path: "/inbox" },
      counts: { unreadCount, openCount, handoffCount, outboundPending },
    };
  }

  if (openCount > 0 || outboundPending > 0) {
    return {
      status: "active",
      statusLabel: "Active",
      tone: "info",
      summary:
        openCount > 0
          ? `${pluralize(openCount, "conversation")} ${
              openCount === 1 ? "is" : "are"
            } currently active.`
          : `${pluralize(outboundPending, "outbound follow-up")} ${
              outboundPending === 1 ? "is" : "are"
            } still in flight.`,
      detail:
        outboundPending > 0
          ? `${pluralize(
              outboundPending,
              "outbound follow-up"
            )} still need a delivery outcome.`
          : "Inbox activity is live, but nothing unread is waiting.",
      action: { label: "Open inbox", path: "/inbox" },
      counts: { unreadCount, openCount, handoffCount, outboundPending },
    };
  }

  return {
    status: "quiet",
    statusLabel: "Quiet",
    tone: "neutral",
    summary: "Conversation activity is quiet right now.",
    detail:
      "No open queue pressure is visible from the current inbox signal.",
    action: { label: "Open inbox", path: "/inbox" },
    counts: { unreadCount, openCount, handoffCount, outboundPending },
  };
}

function buildLaunchChannelState({ telegramPayload, sourceStatus }) {
  const available = sourceStatus.telegramStatus?.available !== false;
  const action = { label: "Open channels", path: "/channels?channel=telegram" };

  if (!available) {
    return {
      connected: false,
      available: false,
      status: "unavailable",
      statusLabel: "Unavailable",
      title: "Launch channel state is unavailable.",
      summary: "Home cannot confirm whether a launch channel is connected.",
      detail:
        "Open Channels to verify connection status before treating setup as ready.",
      action,
      deliveryReady: false,
      channelLabel: "Telegram",
      botUsername: "",
      reasonCode: "launch_channel_status_unavailable",
    };
  }

  const connected =
    telegramPayload?.connected === true ||
    s(telegramPayload?.state).toLowerCase() === "connected";
  const state = s(
    telegramPayload?.state || (connected ? "connected" : "disconnected")
  ).toLowerCase();
  const botUsername = s(telegramPayload?.account?.botUsername);
  const deliveryReady = telegramPayload?.runtime?.deliveryReady === true;
  const readinessMessage = s(telegramPayload?.readiness?.message);
  const reasonCode = s(
    telegramPayload?.reasonCode ||
      telegramPayload?.runtime?.reasonCode ||
      telegramPayload?.webhook?.reasonCode
  ).toLowerCase();

  if (connected) {
    return {
      connected: true,
      available: true,
      status: deliveryReady ? "connected" : "connected_blocked",
      statusLabel: "Connected",
      title: deliveryReady
        ? "Launch channel is connected."
        : "Launch channel is connected, but delivery is still gated.",
      summary:
        readinessMessage ||
        (deliveryReady
          ? "The connected channel can use the strict runtime when approved truth stays healthy."
          : "The channel is attached, but delivery still cannot be treated as live."),
      detail: botUsername
        ? `Bot @${botUsername} is attached to this workspace.`
        : "The launch channel identity has already been verified.",
      action,
      deliveryReady,
      channelLabel: "Telegram",
      botUsername,
      reasonCode,
    };
  }

  if (state === "connecting") {
    return {
      connected: false,
      available: true,
      status: "connecting",
      statusLabel: "Connecting",
      title: "Launch channel connection is still in progress.",
      summary:
        readinessMessage ||
        "Webhook or runtime checks still need to settle before the channel is treated as connected.",
      detail: "Use Channels to finish the connect flow.",
      action,
      deliveryReady: false,
      channelLabel: "Telegram",
      botUsername,
      reasonCode,
    };
  }

  return {
    connected: false,
    available: true,
    status: "needs_connection",
    statusLabel: "Connect required",
    title: "Connect a launch channel before setup can start.",
    summary:
      readinessMessage ||
      "The guided setup lane stays locked until a launch channel is connected.",
    detail: "Use Channels to connect Telegram for this workspace.",
    action,
    deliveryReady: false,
    channelLabel: "Telegram",
    botUsername,
    reasonCode,
  };
}

function buildTruthRuntimeState({ trustPayload, telegramPayload, sourceStatus }) {
  const available = sourceStatus.trust?.available !== false;
  const fallbackTruthAction = { label: "Continue AI setup", path: "/home?assistant=setup" };
  const fallbackRuntimeAction = { label: "Open truth", path: "/truth" };

  if (!available) {
    return {
      ready: false,
      available: false,
      status: "unavailable",
      statusLabel: "Unavailable",
      title: "Strict runtime readiness is unavailable.",
      summary:
        "Home cannot confirm approved truth or runtime projection health right now.",
      detail:
        "Do not treat the launch channel as live until approved truth and runtime readiness are visible again.",
      action: fallbackRuntimeAction,
      truthReady: false,
      runtimeReady: false,
      deliveryReady: false,
      truthVersionId: "",
      reasonCodes: ["trust_surface_unavailable"],
      leadReason: "trust_surface_unavailable",
      blockedBy: "trust_surface_unavailable",
      repairAction: fallbackRuntimeAction,
    };
  }

  const trust = obj(trustPayload?.summary);
  const truth = obj(trust.truth);
  const runtimeProjection = obj(trust.runtimeProjection);
  const runtimeHealth = obj(runtimeProjection.health);
  const runtimeAuthority = obj(runtimeProjection.authority);
  const truthReadiness = obj(truth.readiness);
  const runtimeReadiness = obj(runtimeProjection.readiness);

  const truthVersionId = s(truth.latestVersionId);
  const truthReady = truthReadiness.status === "ready" && Boolean(truthVersionId);
  const runtimeReady =
    runtimeReadiness.status === "ready" &&
    (runtimeHealth.usable === true ||
      runtimeHealth.autonomousAllowed === true ||
      runtimeAuthority.available === true);
  const deliveryReady = telegramPayload?.runtime?.deliveryReady === true;
  const truthAction = pickReadinessAction(truthReadiness, fallbackTruthAction);
  const runtimeAction = pickRuntimeRepairAction(trustPayload);
  const repairDetail = buildRuntimeRepairDetail({ trustPayload, telegramPayload });

  if (!truthReady) {
    return {
      ready: false,
      available: true,
      status: "blocked_truth",
      statusLabel: "Truth required",
      title: buildReasonHeadline(
        truthReadiness.reasonCode || "approved_truth_unavailable"
      ).title,
      summary:
        truthReadiness.message ||
        buildReasonHeadline(
          truthReadiness.reasonCode || "approved_truth_unavailable"
        ).summary,
      detail:
        firstReadableValue(
          ...arr(truthReadiness.blockedItems).map((item) => item?.subtitle || item?.title)
        ) || "No approved truth snapshot is available yet.",
      action: truthAction,
      truthReady,
      runtimeReady,
      deliveryReady,
      truthVersionId,
      reasonCodes: normalizeReasonCodes([
        truthReadiness.reasonCode,
        ...arr(truthReadiness.blockedItems).map((item) => item?.reasonCode),
      ]),
      leadReason:
        normalizeReasonCodes([
          truthReadiness.reasonCode,
          ...arr(truthReadiness.blockedItems).map((item) => item?.reasonCode),
        ])[0] || "approved_truth_unavailable",
      blockedBy: "truth",
      repairAction: truthAction,
    };
  }

  if (!runtimeReady || !deliveryReady) {
    return {
      ready: false,
      available: true,
      status: "blocked_runtime",
      statusLabel: "Repair required",
      title: repairDetail.title,
      summary:
        repairDetail.detail ||
        repairDetail.summary ||
        "Approved truth exists, but runtime or channel delivery is still blocked.",
      detail:
        !runtimeReady
          ? "Refresh or repair runtime before trusting live automation."
          : "Channel delivery is still blocked even though approved truth exists.",
      action: runtimeAction || fallbackRuntimeAction,
      truthReady,
      runtimeReady,
      deliveryReady,
      truthVersionId,
      reasonCodes: repairDetail.reasonCodes,
      leadReason: repairDetail.leadReason,
      blockedBy: !runtimeReady ? "runtime" : "delivery",
      repairAction: runtimeAction || fallbackRuntimeAction,
    };
  }

  return {
    ready: true,
    available: true,
    status: "ready",
    statusLabel: "Ready",
    title: "Approved truth and runtime are aligned.",
    summary:
      "The strict runtime projection is current, and the launch channel can use that approved state.",
    detail: truthVersionId
      ? `Approved truth version ${truthVersionId} is currently backing the live runtime.`
      : "Approved truth is active for the current runtime projection.",
    action: fallbackRuntimeAction,
    truthReady,
    runtimeReady,
    deliveryReady,
    truthVersionId,
    reasonCodes: normalizeReasonCodes(runtimeHealth.reasons),
    leadReason: "",
    blockedBy: "",
    repairAction: null,
  };
}

function buildSetupFlowState({
  launchChannel,
  truthRuntime,
  setupAssistantSession,
}) {
  const session = obj(setupAssistantSession?.session);
  const setup = obj(setupAssistantSession?.setup);
  const draft = obj(setup.draft);
  const draftBusinessProfile = obj(draft.businessProfile);
  const review = obj(setup.review);
  const websitePrefill = obj(setup.websitePrefill);
  const summaryMeta = obj(setup.summary);
  const assistantState = obj(setup.assistant);
  const sectionStatus = obj(summaryMeta.sectionStatus);
  const blockerCount = Number(summaryMeta.blockerCount || 0);
  const completionCount = Number(summaryMeta.completionCount || 0);
  const readySections = Object.values(sectionStatus).filter(
    (item) => s(item?.status) === "ready"
  ).length;
  const pricingReady = s(sectionStatus.pricing?.status) === "ready";
  const hoursReady = s(sectionStatus.hours?.status) === "ready";
  const servicesReady = s(sectionStatus.services?.status) === "ready";

  const hasDraft =
    summaryMeta.hasAnyDraft === true ||
    Boolean(
      s(draftBusinessProfile.companyName) ||
        s(draftBusinessProfile.description) ||
        s(draftBusinessProfile.websiteUrl) ||
        arr(draft.services).length ||
        arr(draft.contacts).length ||
        arr(draft.hours).length
    );

  const launchPosture = !launchChannel.connected
    ? "connect_channel"
    : !truthRuntime.truthReady
      ? "setup_needed"
      : !truthRuntime.runtimeReady || !truthRuntime.deliveryReady
        ? "runtime_repair_needed"
        : "normal_operation";

  const assistantMode =
    launchPosture === "runtime_repair_needed"
      ? "support"
      : "setup";

  return {
    needed: launchPosture === "setup_needed",
    setupNeeded: launchPosture === "setup_needed",
    autoOpen: launchPosture === "setup_needed",
    launchPosture,
    assistantMode,
    title:
      launchPosture === "connect_channel"
        ? "Connect a launch channel first."
        : launchPosture === "setup_needed"
          ? hasDraft
            ? "Channel is connected. Continue the setup draft."
            : "Channel is connected. Start the first setup draft."
          : launchPosture === "runtime_repair_needed"
            ? truthRuntime.title
            : hasDraft
              ? "Continue the setup draft."
              : "Setup is available when you need it.",
    summary:
      launchPosture === "connect_channel"
        ? launchChannel.summary
        : launchPosture === "setup_needed"
          ? truthRuntime.summary
          : launchPosture === "runtime_repair_needed"
            ? truthRuntime.summary
            : hasDraft
              ? "Draft work stays separate from approved truth and runtime activation."
              : "The assistant can stay available for future guided edits.",
    detail:
      launchPosture === "connect_channel"
        ? launchChannel.detail
        : launchPosture === "runtime_repair_needed"
          ? truthRuntime.detail
          : hasDraft
            ? s(review.message)
            : "Start from sources or a short note, then confirm only the important structured fields.",
    status:
      launchPosture === "connect_channel"
        ? "waiting_for_channel"
        : launchPosture === "setup_needed"
          ? hasDraft
            ? "draft_in_progress"
            : "ready_to_start"
          : launchPosture === "runtime_repair_needed"
            ? "repair_required"
            : hasDraft
              ? "draft_available"
              : "ready",
    statusLabel:
      launchPosture === "connect_channel"
        ? "Waiting for channel"
        : launchPosture === "setup_needed"
          ? hasDraft
            ? "Draft in progress"
            : "Start setup"
          : launchPosture === "runtime_repair_needed"
            ? "Repair required"
            : hasDraft
              ? "Draft available"
              : "Ready",
    action:
      launchPosture === "connect_channel"
        ? launchChannel.action
        : launchPosture === "setup_needed"
          ? {
              label: hasDraft ? "Continue AI setup" : "Start AI setup",
              path: "/home?assistant=setup",
            }
          : launchPosture === "runtime_repair_needed"
            ? truthRuntime.action
            : {
                label: "Open AI setup",
                path: "/home?assistant=setup",
              },
    secondaryAction:
      launchPosture === "connect_channel"
        ? { label: "Open home", path: "/home" }
        : launchPosture === "setup_needed"
          ? { label: "Open truth", path: "/truth" }
          : launchPosture === "runtime_repair_needed"
            ? { label: "Open inbox", path: "/inbox" }
            : { label: "Open home", path: "/home" },
    sessionId: s(session.id),
    draftVersion: Number(session.draftVersion || draft.version || 0),
    hasDraft,
    websiteUrl: s(draftBusinessProfile.websiteUrl || websitePrefill.websiteUrl),
    servicesCount: arr(draft.services).length,
    contactsCount: arr(draft.contacts).length,
    hoursCount: arr(draft.hours).length,
    blockerCount,
    completionCount,
    readySections,
    pricingReady,
    hoursReady,
    servicesReady,
    review,
    websitePrefill,
    session,
    assistantState,
    draft: {
      businessProfile: draftBusinessProfile,
      services: arr(draft.services),
      contacts: arr(draft.contacts),
      hours: arr(draft.hours),
      pricingPosture: obj(draft.pricingPosture),
      handoffRules: obj(draft.handoffRules),
      sourceMetadata: obj(draft.sourceMetadata),
      assistantState: obj(draft.assistantState),
      version: Number(draft.version || session.draftVersion || 0),
      updatedAt: draft.updatedAt || session.updatedAt || null,
    },
  };
}

function buildAssistantMessages({
  launchChannel,
  truthRuntime,
  setupFlow,
}) {
  if (!launchChannel.connected) {
    return [
      {
        id: "assistant-connect",
        role: "assistant",
        title: "Connect a channel first.",
        body:
          "Once a launch channel is connected, continue setup through the guided draft lane.",
      },
    ];
  }

  if (setupFlow.launchPosture === "runtime_repair_needed") {
    return [
      {
        id: "assistant-runtime-repair",
        role: "assistant",
        title: truthRuntime.title,
        body:
          truthRuntime.summary ||
          "The business truth exists, but runtime repair still needs operator attention.",
      },
      {
        id: "assistant-runtime-detail",
        role: "system",
        title: "Next best move",
        body:
          truthRuntime.action?.label
            ? `${truthRuntime.action.label} before treating automation as live.`
            : "Open Truth and review the runtime status before treating automation as live.",
      },
    ];
  }

  if (setupFlow.needed && setupFlow.hasDraft) {
    return [
      {
        id: "assistant-continue",
        role: "assistant",
        title: "Continue the setup draft.",
        body:
          "The draft is already started. Keep collecting business details, but nothing goes live until a later approval step is added.",
      },
      {
        id: "assistant-runtime-blocked",
        role: "system",
        title: "Runtime is still gated.",
        body: truthRuntime.summary,
      },
    ];
  }

  if (setupFlow.needed) {
    return [
      {
        id: "assistant-start",
        role: "assistant",
        title: "Start with the website.",
        body:
          "Capture the business website first. This batch stores it as draft-only setup context and does not publish anything to truth or runtime.",
      },
      {
        id: "assistant-gate",
        role: "system",
        title: "Strict runtime remains fail-closed.",
        body: truthRuntime.summary,
      },
    ];
  }

  return [
    {
      id: "assistant-ready",
      role: "assistant",
      title: "Runtime is ready.",
      body:
        "The assistant can still collect a future draft, but live behavior remains tied to approved truth and the current runtime projection.",
    },
  ];
}

function buildAvailabilityNote({
  sourceStatus,
  setupState,
  businessMemory,
  inboxState,
  launchChannel,
  truthRuntime,
}) {
  const details = [];

  if (setupState.isUnavailable) details.push("Setup progress is unavailable.");
  if (
    businessMemory.stats.pendingCount > 0 &&
    sourceStatus.trust?.available === false
  ) {
    details.push(
      "Approved business memory is unavailable, but review work is still visible."
    );
  } else if (
    sourceStatus.trust?.available === false &&
    sourceStatus.workbench?.available === false
  ) {
    details.push("Business memory is unavailable.");
  }

  if (!launchChannel.available) {
    details.push("Launch channel state is unavailable.");
  }

  if (!truthRuntime.available) {
    details.push("Truth and runtime readiness are unavailable.");
  }

  if (inboxState.status === "unavailable") {
    details.push("Conversation activity is unavailable.");
  }

  if (!details.length) return null;

  return {
    title: "Some live product context is limited",
    description: details.join(" "),
  };
}

function buildPrimaryAction({
  launchChannel,
  setupFlow,
  truthRuntime,
  inboxState,
}) {
  if (!launchChannel.connected) {
    return {
      title: "Connect a launch channel before launching AI conversations.",
      detail: launchChannel.summary,
      action: launchChannel.action,
    };
  }

  if (setupFlow.launchPosture === "setup_needed") {
    return {
      title: setupFlow.title,
      detail: setupFlow.summary,
      action: setupFlow.action,
    };
  }

  if (setupFlow.launchPosture === "runtime_repair_needed") {
    return {
      title: truthRuntime.title,
      detail: truthRuntime.summary,
      action: truthRuntime.action,
    };
  }

  if (inboxState.status === "attention") {
    return {
      title:
        "Launch channel, truth, and runtime are aligned. The inbox is the next place that needs an operator.",
      detail: inboxState.summary,
      action: inboxState.action,
    };
  }

  if (inboxState.status === "active") {
    return {
      title: "Start from the live inbox.",
      detail: inboxState.summary,
      action: inboxState.action,
    };
  }

  return {
    title: "Launch channel, approved truth, and runtime are aligned.",
    detail:
      truthRuntime.detail ||
      "The connected channel can now rely on the strict runtime projection.",
    action: { label: "Open inbox", path: "/inbox" },
  };
}

function dedupeActions(actions = []) {
  const seen = new Set();
  return actions.filter((item) => {
    const path = s(item?.path);
    if (!path || seen.has(path)) return false;
    seen.add(path);
    return true;
  });
}

function splitEntryPoints(items = []) {
  const priority = {
    inbox: 100,
    comments: 90,
    voice: 80,
    channels: 70,
    truth: 60,
    workspace: 40,
  };

  const ordered = [...items].sort(
    (left, right) => (priority[right.id] || 0) - (priority[left.id] || 0)
  );

  return {
    featured: ordered.slice(0, 3),
    secondary: ordered.slice(3),
  };
}

export function useProductHome(options = {}) {
  const enabled = options.enabled !== false;

  const state = useQuery({
    queryKey: ["product-home"],
    queryFn: loadProductHomePayloads,
    staleTime: 20_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });

  const payloads = state.data?.payloads || {
    session: null,
    overview: null,
    trust: null,
    workbench: null,
    inboxThreads: null,
    inboxOutbound: null,
    telegramStatus: null,
    setupAssistantSession: null,
  };

  const sourceStatus = state.data?.sourceStatus || {
    session: { available: true },
    overview: { available: true },
    trust: { available: true },
    workbench: { available: true },
    inboxThreads: { available: true },
    inboxOutbound: { available: true },
    telegramStatus: { available: true },
    setupAssistantSession: { available: true },
  };

  const derived = useMemo(() => {
    const session = payloads.session || {};
    const bootstrap = session?.bootstrap || {};

    const setupState = buildWorkspaceSetupState({
      bootstrap,
      overview: payloads.overview,
      sourceStatus: {
        bootstrap: { available: Boolean(session?.bootstrap) },
        overview: sourceStatus.overview,
      },
    });

    const businessMemory = buildWorkspaceBusinessMemory({
      trust: payloads.trust,
      workbench: payloads.workbench,
      setupState,
    });

    const inboxState = buildInboxState({
      threadsPayload: payloads.inboxThreads,
      outboundPayload: payloads.inboxOutbound,
      sourceStatus,
    });

    const launchChannel = buildLaunchChannelState({
      telegramPayload: payloads.telegramStatus,
      sourceStatus,
    });

    const truthRuntime = buildTruthRuntimeState({
      trustPayload: payloads.trust,
      telegramPayload: payloads.telegramStatus,
      sourceStatus,
    });

    const setupFlow = buildSetupFlowState({
      launchChannel,
      truthRuntime,
      setupAssistantSession: payloads.setupAssistantSession,
    });

    const assistantMessages = buildAssistantMessages({
      launchChannel,
      truthRuntime,
      setupFlow,
    });

    const availabilityNote = buildAvailabilityNote({
      sourceStatus,
      setupState,
      businessMemory,
      inboxState,
      launchChannel,
      truthRuntime,
    });

    const companyName = formatWorkspaceName(session);
    const actorName = s(session?.actorName, "operator");

    const primaryAction = buildPrimaryAction({
      launchChannel,
      setupFlow,
      truthRuntime,
      inboxState,
    });

    const secondaryAction =
      !launchChannel.connected
        ? { label: "Open AI setup", path: "/home?assistant=setup" }
        : setupFlow.launchPosture === "setup_needed"
          ? { label: "Open truth", path: "/truth" }
          : setupFlow.launchPosture === "runtime_repair_needed"
            ? { label: "Open channels", path: "/channels?channel=telegram" }
            : inboxState.action?.path === "/inbox"
              ? { label: "Open channels", path: "/channels?channel=telegram" }
              : { label: "Open inbox", path: "/inbox" };

    const heroStats = [
      {
        id: "channel",
        label: "Launch channel",
        status: launchChannel.statusLabel,
        summary: launchChannel.summary,
        action: launchChannel.action,
      },
      {
        id: "setup",
        label: "AI setup",
        status: setupFlow.statusLabel,
        summary: setupFlow.summary,
        action: setupFlow.action,
      },
      {
        id: "runtime",
        label: "Truth and runtime",
        status: truthRuntime.statusLabel,
        summary: truthRuntime.summary,
        action: truthRuntime.action,
      },
    ];

    const entryPoints = [
      {
        id: "inbox",
        title: "Inbox",
        status:
          setupFlow.launchPosture === "normal_operation"
            ? primaryAction.action?.path === "/inbox"
              ? "Start here"
              : inboxState.statusLabel
            : setupFlow.launchPosture === "runtime_repair_needed"
              ? "Blocked by runtime"
              : "Waiting on launch readiness",
        summary:
          setupFlow.launchPosture === "normal_operation"
            ? "Handle live conversations and operator follow-up in one queue."
            : setupFlow.launchPosture === "runtime_repair_needed"
              ? "Inbox exists, but live automation should wait until runtime repair finishes."
              : "The inbox becomes the main operating surface after channel, approved truth, and runtime are aligned.",
        detail:
          setupFlow.launchPosture === "normal_operation"
            ? inboxState.detail
            : truthRuntime.summary,
        action: { label: "Open inbox", path: "/inbox" },
      },
      {
        id: "comments",
        title: "Comments",
        status: "Separate surface",
        summary:
          "Comments remain available, but they are not the launch surface for this setup flow.",
        detail:
          "Keep the setup story narrow: connect a channel, complete the setup draft, approve truth, then go live.",
        action: { label: "Open comments", path: "/comments" },
      },
      {
        id: "voice",
        title: "Voice Receptionist",
        status: "Separate surface",
        summary:
          "Voice stays available as its own surface and does not drive this connect-first setup path.",
        detail:
          "Do not mix voice readiness into the current launch promise.",
        action: { label: "Open voice", path: "/voice" },
      },
      {
        id: "channels",
        title: "Channels",
        status: launchChannel.statusLabel,
        summary:
          "Connect and inspect the launch channel without weakening the strict runtime contract.",
        detail: launchChannel.detail,
        action: launchChannel.action,
      },
      {
        id: "truth",
        title: "Truth",
        status: truthRuntime.statusLabel,
        summary:
          truthRuntime.status === "ready"
            ? "Approved truth and runtime stay protected. Draft setup does not publish automatically."
            : truthRuntime.summary,
        detail: truthRuntime.detail,
        action: truthRuntime.action,
      },
      {
        id: "workspace",
        title: "Workspace",
        status: "Support",
        summary:
          "Use the workspace for broader operator posture once the setup lane is already clear.",
        detail:
          "Home leads channel connect, setup, and runtime posture for this flow.",
        action: { label: "Open workspace", path: "/workspace" },
      },
    ];

    const entryPointGroups = splitEntryPoints(entryPoints);

    const currentStatus = {
      title: primaryAction.title,
      summary: primaryAction.detail,
      action: primaryAction.action,
      secondaryAction,
    };

    const supportingStatus = [
      {
        id: "channel-support",
        label: "Launch channel",
        status: launchChannel.statusLabel,
        summary: launchChannel.summary,
        action: launchChannel.action,
      },
      {
        id: "setup-support",
        label: "AI setup",
        status: setupFlow.statusLabel,
        summary: setupFlow.summary,
        action: setupFlow.action,
      },
      {
        id: "runtime-support",
        label: "Truth + runtime",
        status: truthRuntime.statusLabel,
        summary: truthRuntime.summary,
        action: truthRuntime.action,
      },
    ];

    const finalActions = dedupeActions([
      primaryAction.action,
      secondaryAction,
      launchChannel.action,
      setupFlow.action,
      truthRuntime.action,
      { label: "Open workspace", path: "/workspace" },
    ]).slice(0, 4);

    const assistant = {
      mode: setupFlow.assistantMode,
      title:
        setupFlow.launchPosture === "connect_channel"
          ? "Connect channel"
          : setupFlow.launchPosture === "runtime_repair_needed"
            ? "Runtime repair"
            : setupFlow.needed
              ? "Structured setup"
              : setupFlow.hasDraft
                ? "Continue setup"
                : "Setup",
      statusLabel: setupFlow.statusLabel,
      summary:
        setupFlow.launchPosture === "connect_channel"
          ? "Connect the launch channel first."
          : setupFlow.launchPosture === "runtime_repair_needed"
            ? "Repair runtime before trusting live automation."
            : setupFlow.needed
              ? setupFlow.blockerCount > 0
                ? `${setupFlow.blockerCount} structured blockers still need confirmation.`
                : "The draft is structurally complete for later review."
              : setupFlow.hasDraft
                ? `${setupFlow.readySections} setup sections already have draft coverage.`
                : "Structured setup is available when needed.",
      primaryAction:
        setupFlow.launchPosture === "connect_channel"
          ? launchChannel.action
          : setupFlow.launchPosture === "runtime_repair_needed"
            ? truthRuntime.action
            : setupFlow.action,
      secondaryAction: setupFlow.secondaryAction,
      launchPosture: setupFlow.launchPosture,
      setupNeeded: setupFlow.needed,
      autoOpen: setupFlow.autoOpen,
      session: setupFlow.session,
      draft: setupFlow.draft,
      review: setupFlow.review,
      websitePrefill: setupFlow.websitePrefill,
      messages: assistantMessages,
      assistant: setupFlow.assistantState,
      launchChannel,
      truthRuntime,
    };

    return {
      companyName,
      actorName,
      setupState,
      businessMemory,
      inboxState,
      launchChannel,
      truthRuntime,
      setupFlow,
      setupNeeded: setupFlow.needed,
      assistant,
      availabilityNote,
      heroStats,
      primaryAction,
      secondaryAction,
      entryPoints,
      entryPointGroups,
      currentStatus,
      supportingStatus,
      finalActions,
    };
  }, [payloads, sourceStatus]);

  return {
    loading: enabled ? state.isLoading : false,
    isFetching: enabled ? state.isFetching : false,
    refetch: state.refetch,
    sourceStatus,
    ...derived,
  };
}

export default useProductHome;