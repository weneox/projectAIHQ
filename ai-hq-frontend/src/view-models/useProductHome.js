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
  const action = { label: "Open truth", path: "/truth" };

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
      action,
      truthReady: false,
      runtimeReady: false,
      deliveryReady: false,
      truthVersionId: "",
      reasonCodes: ["trust_surface_unavailable"],
    };
  }

  const truth = obj(trustPayload?.summary?.truth);
  const runtimeProjection = obj(trustPayload?.summary?.runtimeProjection);
  const runtimeHealth = obj(runtimeProjection.health);
  const runtimeAuthority = obj(runtimeProjection.authority);
  const truthVersionId = s(truth.latestVersionId);
  const truthReadiness = s(truth.readiness?.status).toLowerCase();
  const runtimeReadiness = s(runtimeProjection.readiness?.status).toLowerCase();
  const truthReady = truthReadiness === "ready" && Boolean(truthVersionId);
  const runtimeReady =
    runtimeReadiness === "ready" &&
    (runtimeHealth.usable === true ||
      runtimeHealth.autonomousAllowed === true ||
      runtimeAuthority.available === true);
  const deliveryReady = telegramPayload?.runtime?.deliveryReady === true;
  const ready = truthReady && runtimeReady && deliveryReady;
  const reasonCodes = arr(
    runtimeHealth.reasonCodes ||
      runtimeHealth.reasons ||
      truth.readiness?.reasonCodes
  )
    .map((item) => s(item).toLowerCase())
    .filter(Boolean);

  if (!truthReady) {
    return {
      ready: false,
      available: true,
      status: "blocked",
      statusLabel: "Blocked",
      title: "Approved truth is still missing.",
      summary:
        "The launch channel can stay connected, but runtime activation remains fail-closed until approved truth exists.",
      detail:
        s(truth.readiness?.message) ||
        "No approved truth snapshot is available for strict runtime use yet.",
      action,
      truthReady,
      runtimeReady,
      deliveryReady,
      truthVersionId,
      reasonCodes: [
        s(
          truth.readiness?.reasonCode,
          "approved_truth_unavailable"
        ).toLowerCase(),
      ],
    };
  }

  if (!runtimeReady || !deliveryReady) {
    return {
      ready: false,
      available: true,
      status: "blocked",
      statusLabel: "Blocked",
      title: "Runtime activation is still blocked.",
      summary:
        s(runtimeProjection.readiness?.message) ||
        s(telegramPayload?.readiness?.message) ||
        "Approved truth exists, but the runtime projection is not ready for live delivery yet.",
      detail:
        runtimeReady && !deliveryReady
          ? "Channel delivery is still blocked even though truth is approved."
          : "Repair or refresh the runtime projection before treating the launch channel as live.",
      action,
      truthReady,
      runtimeReady,
      deliveryReady,
      truthVersionId,
      reasonCodes:
        reasonCodes.length > 0
          ? reasonCodes
          : [
              s(
                runtimeHealth.reasonCode ||
                  runtimeProjection.readiness?.reasonCode ||
                  telegramPayload?.runtime?.reasonCode ||
                  "runtime_projection_unavailable"
              ).toLowerCase(),
            ],
    };
  }

  return {
    ready,
    available: true,
    status: "ready",
    statusLabel: "Ready",
    title: "Approved truth and runtime are aligned.",
    summary:
      "The strict runtime projection is current, and the launch channel can use that approved state.",
    detail: truthVersionId
      ? `Approved truth version ${truthVersionId} is currently backing the live runtime.`
      : "Approved truth is active for the current runtime projection.",
    action,
    truthReady,
    runtimeReady,
    deliveryReady,
    truthVersionId,
    reasonCodes,
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

  const needed = launchChannel.connected && !truthRuntime.ready;

  const launchPosture = !launchChannel.connected
    ? "connect_channel"
    : needed
      ? "setup_needed"
      : "normal_operation";

  const assistantMode =
    launchPosture === "setup_needed"
      ? "setup"
      : hasDraft && launchChannel.connected
        ? "setup"
        : "shortcut";

  return {
    needed,
    setupNeeded: needed,
    autoOpen: needed,
    launchPosture,
    assistantMode,
    title:
      launchPosture === "connect_channel"
        ? "Connect a launch channel first."
        : launchPosture === "setup_needed"
          ? hasDraft
            ? "Channel is connected. Continue the setup draft."
            : "Channel is connected. Start the first setup draft."
          : hasDraft
            ? "Continue the setup draft."
            : "Setup is available when you need it.",
    summary:
      launchPosture === "connect_channel"
        ? launchChannel.summary
        : launchPosture === "setup_needed"
          ? truthRuntime.summary
          : hasDraft
            ? "Draft work stays separate from approved truth and runtime activation."
            : "The assistant can stay available for future guided edits.",
    detail:
      launchPosture === "connect_channel"
        ? launchChannel.detail
        : hasDraft
          ? s(review.message)
          : "Start with the website, then continue through short guided questions.",
    status:
      launchPosture === "connect_channel"
        ? "waiting_for_channel"
        : launchPosture === "setup_needed"
          ? hasDraft
            ? "draft_in_progress"
            : "ready_to_start"
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
          : hasDraft
            ? "Draft available"
            : "Ready",
    action:
      launchPosture === "connect_channel"
        ? launchChannel.action
        : {
            label:
              launchPosture === "setup_needed"
                ? hasDraft
                  ? "Continue AI setup"
                  : "Start AI setup"
                : "Open AI setup",
            path: "/home?assistant=setup",
          },
    secondaryAction:
      launchPosture === "connect_channel"
        ? { label: "Open home", path: "/home" }
        : launchPosture === "setup_needed"
          ? { label: "Open truth", path: "/truth" }
          : { label: "Open home", path: "/home" },
    sessionId: s(session.id),
    draftVersion: Number(session.draftVersion || draft.version || 0),
    hasDraft,
    websiteUrl: s(draftBusinessProfile.websiteUrl || websitePrefill.websiteUrl),
    servicesCount: arr(draft.services).length,
    contactsCount: arr(draft.contacts).length,
    hoursCount: arr(draft.hours).length,
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

  if (setupFlow.needed) {
    return {
      title: setupFlow.title,
      detail: setupFlow.summary,
      action: setupFlow.action,
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
        : setupFlow.needed
          ? { label: "Open truth", path: "/truth" }
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
            : "Waiting on launch readiness",
        summary:
          setupFlow.launchPosture === "normal_operation"
            ? "Handle live conversations and operator follow-up in one queue."
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
          "Approved truth and runtime stay protected. Draft setup does not publish automatically.",
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
          : setupFlow.needed
            ? "Quick setup"
            : setupFlow.hasDraft
              ? "Continue setup"
              : "Setup",
      statusLabel: setupFlow.statusLabel,
      summary:
        setupFlow.launchPosture === "connect_channel"
          ? "Əvvəl channel qoş."
          : setupFlow.needed
            ? "Qısa sual-cavab."
            : setupFlow.hasDraft
              ? "Draft qalır."
              : "Hazırdır.",
      primaryAction:
        setupFlow.launchPosture === "connect_channel"
          ? launchChannel.action
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
