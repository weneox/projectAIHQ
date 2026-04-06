import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOutboundSummary, listInboxThreads } from "../api/inbox.js";
import { getCurrentOnboardingSession } from "../api/onboarding.js";
import { getSetupOverview } from "../api/setup.js";
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
    onboardingSession: getCurrentOnboardingSession(),
  };

  const settledEntries = await Promise.all(
    Object.entries(requests).map(async ([key, promise]) => [key, await Promise.allSettled([promise])])
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
      counts: { unreadCount: 0, openCount: 0, handoffCount: 0, outboundPending: 0 },
    };
  }

  if (unreadCount > 0) {
    return {
      status: "attention",
      statusLabel: "Needs attention",
      tone: "warn",
      summary: `${pluralize(unreadCount, "unread message")} ${unreadCount === 1 ? "is" : "are"} waiting across ${pluralize(Math.max(openCount, 1), "open conversation")}.`,
      detail: handoffCount
        ? `${pluralize(handoffCount, "conversation")} already ${handoffCount === 1 ? "has" : "have"} operator ownership.`
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
          ? `${pluralize(openCount, "conversation")} ${openCount === 1 ? "is" : "are"} currently active.`
          : `${pluralize(outboundPending, "outbound follow-up")} ${outboundPending === 1 ? "is" : "are"} still in flight.`,
      detail:
        outboundPending > 0
          ? `${pluralize(outboundPending, "outbound follow-up")} still need a delivery outcome.`
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
    detail: "No open queue pressure is visible from the current inbox signal.",
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
      title: "Telegram channel state is unavailable.",
      summary: "Home cannot confirm whether the launch channel is connected right now.",
      detail: "Open Channels to verify Telegram connection before treating onboarding as ready.",
      action,
      deliveryReady: false,
      botUsername: "",
      reasonCode: "telegram_status_unavailable",
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
        ? "Telegram is connected."
        : "Telegram is connected, but strict delivery is still gated.",
      summary:
        readinessMessage ||
        (deliveryReady
          ? "The tenant bot is attached and can use the strict runtime when approved truth stays healthy."
          : "The bot is attached, but runtime delivery still cannot be treated as live."),
      detail: botUsername
        ? `Bot @${botUsername} is attached to this tenant.`
        : "The tenant bot identity has already been verified.",
      action,
      deliveryReady,
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
      title: "Telegram connection is still in progress.",
      summary:
        readinessMessage ||
        "Webhook or runtime checks still need to settle before the launch channel is treated as connected.",
      detail: "Use Channels to finish the Telegram connect flow.",
      action,
      deliveryReady: false,
      botUsername,
      reasonCode,
    };
  }

  return {
    connected: false,
    available: true,
    status: "needs_connection",
    statusLabel: "Connect required",
    title: "Connect Telegram before onboarding can start.",
    summary:
      readinessMessage ||
      "The guided onboarding lane stays locked until the tenant Telegram bot is connected.",
    detail: "Use Channels to connect the Telegram bot for this workspace.",
    action,
    deliveryReady: false,
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
        "Do not treat Telegram as live until approved truth and runtime readiness are visible again.",
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
    runtimeHealth.reasonCodes || runtimeHealth.reasons || truth.readiness?.reasonCodes
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
        "Telegram can stay connected, but runtime activation remains fail-closed until approved truth exists.",
      detail:
        s(truth.readiness?.message) ||
        "No approved truth snapshot is available for strict runtime use yet.",
      action,
      truthReady,
      runtimeReady,
      deliveryReady,
      truthVersionId,
      reasonCodes: [
        s(truth.readiness?.reasonCode, "approved_truth_unavailable").toLowerCase(),
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
        "Approved truth exists, but the strict runtime projection is not ready for Telegram yet.",
      detail:
        runtimeReady && !deliveryReady
          ? "Telegram delivery is still blocked for this channel even though truth is approved."
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
    ready: true,
    available: true,
    status: "ready",
    statusLabel: "Ready",
    title: "Approved truth and runtime are aligned.",
    summary:
      "The strict runtime projection is current, and Telegram delivery can use that approved state.",
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

function buildOnboardingState({
  launchChannel,
  truthRuntime,
  onboardingSession,
}) {
  const session = obj(onboardingSession?.session);
  const onboarding = obj(onboardingSession?.onboarding);
  const draft = obj(onboarding.draft);
  const draftBusinessProfile = obj(draft.businessProfile);
  const review = obj(onboarding.review);
  const websitePrefill = obj(onboarding.websitePrefill);
  const summaryMeta = obj(onboarding.summary);
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
      ? "onboarding_needed"
      : "normal_operation";

  return {
    needed,
    onboardingNeeded: needed,
    autoOpen: needed,
    launchPosture,
    title:
      launchPosture === "connect_channel"
        ? "Connect Telegram to unlock guided onboarding."
        : launchPosture === "onboarding_needed"
          ? hasDraft
            ? "Telegram is connected. Continue the structured draft before runtime goes live."
            : "Telegram is connected. Start the first structured business draft."
          : hasDraft
            ? "Live runtime is ready. Future edits can still stay draft-only."
            : "Truth and runtime are ready.",
    summary:
      launchPosture === "connect_channel"
        ? "The onboarding assistant stays in connect-CTA posture until the tenant Telegram bot is attached."
        : launchPosture === "onboarding_needed"
          ? truthRuntime.summary
          : "The assistant remains available for future draft work, but it does not write directly into approved truth.",
    detail:
      launchPosture === "connect_channel"
        ? launchChannel.detail
        : hasDraft
          ? s(review.message)
          : "Start with the website, then continue building the structured draft in the widget.",
    status:
      launchPosture === "connect_channel"
        ? "waiting_for_channel"
        : launchPosture === "onboarding_needed"
          ? hasDraft
            ? "draft_in_progress"
            : "ready_to_start"
          : hasDraft
            ? "draft_available"
            : "ready",
    statusLabel:
      launchPosture === "connect_channel"
        ? "Waiting for Telegram"
        : launchPosture === "onboarding_needed"
          ? hasDraft
            ? "Draft in progress"
            : "Start onboarding"
          : hasDraft
            ? "Draft available"
            : "Ready",
    action:
      launchPosture === "connect_channel"
        ? launchChannel.action
        : {
            label:
              launchPosture === "onboarding_needed"
                ? hasDraft
                  ? "Continue AI onboarding"
                  : "Start AI onboarding"
                : "Open AI onboarding",
            path: "/home?assistant=setup",
          },
    secondaryAction:
      launchPosture === "connect_channel"
        ? { label: "Open home", path: "/home" }
        : { label: "Open truth", path: "/truth" },
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
  onboardingState,
}) {
  if (!launchChannel.connected) {
    return [
      {
        id: "assistant-connect",
        role: "assistant",
        title: "Connect Telegram first.",
        body:
          "Once Telegram is connected, start with the website and keep everything inside a draft-only onboarding lane.",
      },
    ];
  }

  if (onboardingState.needed && onboardingState.hasDraft) {
    return [
      {
        id: "assistant-continue",
        role: "assistant",
        title: "Continue the onboarding draft.",
        body:
          "The draft is already started. Keep collecting structured business details, but nothing goes live until a later approval step is added.",
      },
      {
        id: "assistant-runtime-blocked",
        role: "system",
        title: "Runtime is still gated.",
        body: truthRuntime.summary,
      },
    ];
  }

  if (onboardingState.needed) {
    return [
      {
        id: "assistant-start",
        role: "assistant",
        title: "Start with the website.",
        body:
          "Capture the business website first. This batch stores it as draft-only onboarding context and does not publish anything to truth or runtime.",
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
        "The onboarding shell can still collect a future draft, but live Telegram behavior remains tied to approved truth and the current runtime projection.",
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
  if (businessMemory.stats.pendingCount > 0 && sourceStatus.trust?.available === false) {
    details.push("Approved business memory is unavailable, but review work is still visible.");
  } else if (
    sourceStatus.trust?.available === false &&
    sourceStatus.workbench?.available === false
  ) {
    details.push("Business memory is unavailable.");
  }

  if (!launchChannel.available) {
    details.push("Telegram channel state is unavailable.");
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
  onboardingState,
  truthRuntime,
  inboxState,
}) {
  if (!launchChannel.connected) {
    return {
      title: "Connect Telegram before launching AI conversations.",
      detail: launchChannel.summary,
      action: launchChannel.action,
    };
  }

  if (onboardingState.needed) {
    return {
      title: onboardingState.title,
      detail: onboardingState.summary,
      action: onboardingState.action,
    };
  }

  if (inboxState.status === "attention") {
    return {
      title: "Telegram, truth, and runtime are aligned. The inbox is the next place that needs an operator.",
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
    title: "Telegram, approved truth, and runtime are aligned.",
    detail:
      truthRuntime.detail ||
      "The launch channel can now rely on the strict runtime projection.",
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
    onboardingSession: null,
  };

  const sourceStatus = state.data?.sourceStatus || {
    session: { available: true },
    overview: { available: true },
    trust: { available: true },
    workbench: { available: true },
    inboxThreads: { available: true },
    inboxOutbound: { available: true },
    telegramStatus: { available: true },
    onboardingSession: { available: true },
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
    const onboardingState = buildOnboardingState({
      launchChannel,
      truthRuntime,
      onboardingSession: payloads.onboardingSession,
    });
    const assistantMessages = buildAssistantMessages({
      launchChannel,
      truthRuntime,
      onboardingState,
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
      onboardingState,
      truthRuntime,
      inboxState,
    });
    const secondaryAction =
      !launchChannel.connected
        ? { label: "Open AI onboarding", path: "/home?assistant=setup" }
        : onboardingState.needed
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
        id: "onboarding",
        label: "AI onboarding",
        status: onboardingState.statusLabel,
        summary: onboardingState.summary,
        action: onboardingState.action,
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
          onboardingState.launchPosture === "normal_operation"
            ? primaryAction.action?.path === "/inbox"
              ? "Start here"
              : inboxState.statusLabel
            : "Waiting on launch readiness",
        summary:
          onboardingState.launchPosture === "normal_operation"
            ? "Handle live Telegram conversations and operator follow-up in one queue."
            : "The inbox becomes the main operating surface after Telegram, approved truth, and runtime are aligned.",
        detail:
          onboardingState.launchPosture === "normal_operation"
            ? inboxState.detail
            : truthRuntime.summary,
        action: { label: "Open inbox", path: "/inbox" },
      },
      {
        id: "comments",
        title: "Comments",
        status: "Separate surface",
        summary:
          "Comments remain available, but they are not the launch channel for this onboarding batch.",
        detail:
          "Keep the onboarding story narrow: Telegram connect, structured draft, approved truth, then strict runtime.",
        action: { label: "Open comments", path: "/comments" },
      },
      {
        id: "voice",
        title: "Voice Receptionist",
        status: "Separate surface",
        summary:
          "Voice stays available as its own surface and does not drive the Telegram-first onboarding path.",
        detail:
          "Do not mix voice readiness into the Telegram onboarding promise for this batch.",
        action: { label: "Open voice", path: "/voice" },
      },
      {
        id: "channels",
        title: "Channels",
        status: launchChannel.statusLabel,
        summary:
          "Connect and inspect the tenant Telegram bot without weakening the strict runtime contract.",
        detail: launchChannel.detail,
        action: launchChannel.action,
      },
      {
        id: "truth",
        title: "Truth",
        status: truthRuntime.statusLabel,
        summary:
          "Approved truth and the runtime projection stay protected. Draft onboarding does not publish automatically.",
        detail: truthRuntime.detail,
        action: truthRuntime.action,
      },
      {
        id: "workspace",
        title: "Workspace",
        status: "Support",
        summary:
          "Use the workspace for broader operator posture once the onboarding lane is already clear.",
        detail:
          "Workspace remains available, but /home now leads channel connect, onboarding, and runtime activation posture.",
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
        label: "Telegram",
        status: launchChannel.statusLabel,
        summary: launchChannel.summary,
        action: launchChannel.action,
      },
      {
        id: "onboarding-support",
        label: "AI onboarding",
        status: onboardingState.statusLabel,
        summary: onboardingState.summary,
        action: onboardingState.action,
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
      onboardingState.action,
      truthRuntime.action,
      { label: "Open workspace", path: "/workspace" },
    ]).slice(0, 4);

    const assistant = {
      mode: "onboarding",
      title: onboardingState.title,
      statusLabel: onboardingState.statusLabel,
      summary: onboardingState.summary,
      primaryAction: onboardingState.action,
      secondaryAction: onboardingState.secondaryAction,
      launchPosture: onboardingState.launchPosture,
      onboardingNeeded: onboardingState.needed,
      autoOpen: onboardingState.autoOpen,
      session: onboardingState.session,
      draft: onboardingState.draft,
      review: onboardingState.review,
      websitePrefill: onboardingState.websitePrefill,
      messages: assistantMessages,
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
      onboardingState,
      onboardingNeeded: onboardingState.needed,
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
