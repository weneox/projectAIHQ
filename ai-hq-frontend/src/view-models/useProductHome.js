import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLaunchPosture } from "../api/launch.js";
import { getCurrentSetupAssistantSession } from "../api/setup.js";
import {
  buildWorkspaceScopedQueryKey,
  useWorkspaceTenantKey,
} from "../hooks/useWorkspaceTenantKey.js";
import { SETUP_WIDGET_ROUTE } from "../lib/appEntry.js";
import { useLaunchSliceRefreshToken } from "../lib/launchSliceRefresh.js";

const CHANNEL_IDS = ["website", "instagram", "telegram"];

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

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function firstText(...values) {
  for (const value of values) {
    const next = s(value);
    if (next) return next;
  }
  return "";
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
  return arr(items).map((item) => lower(item)).filter(Boolean);
}

function pluralize(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatHandle(value = "") {
  const text = s(value);
  if (!text) return "";
  return text.startsWith("@") ? text : `@${text}`;
}

function buildChannelPath(provider = "") {
  switch (provider) {
    case "instagram":
    case "meta":
      return "/channels?channel=instagram";
    case "telegram":
      return "/channels?channel=telegram";
    case "website":
    case "webchat":
      return "/channels?channel=website";
    default:
      return "/channels";
  }
}

function buildChannelLabel(provider = "") {
  switch (provider) {
    case "instagram":
    case "meta":
      return "Instagram";
    case "telegram":
      return "Telegram";
    case "website":
    case "webchat":
      return "Website chat";
    default:
      return "Launch channel";
  }
}

function buildLaunchAction(provider = "", mode = "open") {
  const labelBase = buildChannelLabel(provider);
  const path = buildChannelPath(provider);
  const isWebsite = provider === "website" || provider === "webchat";

  if (mode === "select") {
    return {
      label:
        provider === "instagram" || provider === "meta"
          ? "Select Instagram account"
          : `Open ${labelBase}`,
      path,
    };
  }

  if (mode === "connect") {
    return {
      label: isWebsite ? `Configure ${labelBase}` : `Connect ${labelBase}`,
      path,
    };
  }

  if (mode === "reconnect") {
    return {
      label: isWebsite ? `Review ${labelBase}` : `Reconnect ${labelBase}`,
      path,
    };
  }

  return {
    label: `Open ${labelBase}`,
    path,
  };
}

function buildLaunchChannelUnavailableState() {
  return {
    id: "launch-unavailable",
    type: "launch_channel",
    provider: "",
    connected: false,
    available: false,
    status: "unavailable",
    statusLabel: "Unavailable",
    title: "Launch channel state is unavailable.",
    summary: "Home cannot confirm which launch channel is ready right now.",
    detail:
      "Open Channels to verify Instagram, Telegram, or website chat before treating setup as launch-ready.",
    action: { label: "Open channels", path: "/channels" },
    deliveryReady: false,
    reasonCode: "launch_channel_status_unavailable",
    channelLabel: "Launch channels",
    accountLabel: "",
    accountDisplayName: "",
    accountHandle: "",
    account: {},
    providerStates: [],
    readyCount: 0,
    connectedCount: 0,
  };
}

function createCanonicalLaunchChannel(value = {}) {
  const account = obj(value.account);
  const displayName = firstText(value.accountDisplayName, account.displayName);
  const handle = firstText(value.accountHandle, account.handle);

  return {
    id: s(value.id),
    type: s(value.type, "launch_channel"),
    provider: lower(value.provider),
    connected: value.connected === true,
    available: value.available !== false,
    status: s(value.status, "unavailable"),
    statusLabel: s(value.statusLabel, "Unavailable"),
    title: s(value.title),
    summary: s(value.summary),
    detail: s(value.detail),
    action: normalizeAction(value.action, {
      label: "Open channels",
      path: "/channels",
    }),
    deliveryReady: value.deliveryReady === true,
    reasonCode: lower(value.reasonCode),
    channelLabel: s(value.channelLabel, "Launch channels"),
    accountLabel: s(value.accountLabel),
    accountDisplayName: displayName,
    accountHandle: handle,
    account: {
      ...account,
      displayName,
      handle,
    },
    providerStates: arr(value.providerStates),
    readyCount: n(value.readyCount),
    connectedCount: n(value.connectedCount),
  };
}

function statusLabel(status = "", fallback = "Needs review") {
  switch (lower(status)) {
    case "ready":
      return "Ready";
    case "connected":
      return "Connected";
    case "connected_blocked":
      return "Connected, blocked";
    case "testing_only":
      return "Testing only";
    case "needs_connection":
      return "Connect required";
    case "selection_required":
      return "Selection required";
    case "multiple_ready":
      return "Multiple connected";
    case "unavailable":
      return "Unavailable";
    default:
      return fallback;
  }
}

function accountInfoForChannel(provider = "", accountInput = {}) {
  const account = obj(accountInput);

  if (provider === "telegram") {
    const botHandle = formatHandle(account.botUsername);
    const displayName = firstText(
      account.displayName,
      botHandle ? `Telegram ${botHandle}` : ""
    );

    return {
      accountLabel: "Telegram bot",
      accountDisplayName: displayName,
      accountHandle: botHandle,
      account: {
        ...account,
        displayName,
        handle: botHandle,
      },
    };
  }

  if (provider === "instagram") {
    const handle = formatHandle(account.username);
    const displayName = firstText(
      account.displayName,
      account.pageName,
      handle ? `Instagram ${handle}` : ""
    );

    return {
      accountLabel: "Instagram account",
      accountDisplayName: displayName,
      accountHandle: handle,
      account: {
        ...account,
        displayName,
        handle,
      },
    };
  }

  if (provider === "website") {
    const handle = firstText(account.targetDomain, account.websiteUrl);
    const displayName = firstText(account.displayName, handle, "Website chat");

    return {
      accountLabel: "Reference website",
      accountDisplayName: displayName,
      accountHandle: handle,
      account: {
        ...account,
        displayName,
        handle,
      },
    };
  }

  return {
    accountLabel: "",
    accountDisplayName: "",
    accountHandle: "",
    account,
  };
}

function actionForChannel(channel = {}, provider = "") {
  const fallbackMode =
    channel.connected === true
      ? channel.deliveryReady === true
        ? "open"
        : "reconnect"
      : "connect";
  const blockerAction = obj(arr(channel.blockers)[0]?.nextAction);

  return normalizeAction(
    arr(channel.repairActions)[0] || blockerAction,
    buildLaunchAction(provider, fallbackMode)
  );
}

function buildPostureChannelState(provider, channelInput = {}) {
  const channel = obj(channelInput);
  const readiness = obj(channel.readiness);
  const blockers = arr(channel.blockers).length
    ? arr(channel.blockers)
    : arr(readiness.blockers);
  const label = s(channel.label, buildChannelLabel(provider));
  const available = channel.available === true;
  const connected = channel.connected === true;
  const deliveryReady =
    available && connected && channel.deliveryReady === true;
  const reasonCode = lower(
    channel.reasonCode || readiness.reasonCode || blockers[0]?.reasonCode
  );
  const summary =
    firstText(
      readiness.message,
      channel.message,
      blockers[0]?.message,
      blockers[0]?.subtitle
    ) ||
    (deliveryReady
      ? `${label} is ready for live delivery.`
      : `${label} is not ready for live delivery.`);
  const accountInfo = accountInfoForChannel(provider, channel.account);

  return createCanonicalLaunchChannel({
    id: `launch-${provider}`,
    provider,
    channelLabel: label,
    connected,
    available,
    status: s(
      channel.status,
      deliveryReady ? "ready" : available ? "needs_connection" : "unavailable"
    ),
    statusLabel: statusLabel(
      channel.status,
      deliveryReady ? "Ready" : available ? "Needs review" : "Unavailable"
    ),
    title: deliveryReady
      ? `${label} is ready.`
      : available
        ? `${label} still needs review.`
        : `${label} is unavailable.`,
    summary,
    detail: summary,
    action: actionForChannel(channel, provider),
    deliveryReady,
    reasonCode,
    ...accountInfo,
  });
}

function buildGenericLaunchChannelsState({
  channels = [],
  title = "",
  summary = "",
  detail = "",
  status = "unavailable",
  statusLabel: label = "Unavailable",
  connected = false,
  deliveryReady = false,
  reasonCode = "",
}) {
  const availableChannels = channels.filter((channel) => channel.available);
  const readyChannels = availableChannels.filter(
    (channel) => channel.connected && channel.deliveryReady
  );
  const connectedChannels = availableChannels.filter(
    (channel) => channel.connected
  );

  return createCanonicalLaunchChannel({
    id: "launch-generic",
    type: "launch_channel",
    provider: "",
    connected,
    available: availableChannels.length > 0,
    status,
    statusLabel: label,
    title,
    summary,
    detail,
    action: { label: "Open channels", path: "/channels" },
    deliveryReady,
    reasonCode,
    channelLabel: "Launch channels",
    accountLabel: "",
    accountDisplayName: "",
    accountHandle: "",
    account: {},
    providerStates: channels,
    readyCount: readyChannels.length,
    connectedCount: connectedChannels.length,
  });
}

function withChannelCounts(channel, providerStates = []) {
  const availableChannels = providerStates.filter((item) => item.available);
  const readyChannels = availableChannels.filter(
    (item) => item.connected && item.deliveryReady
  );
  const connectedChannels = availableChannels.filter((item) => item.connected);

  return createCanonicalLaunchChannel({
    ...channel,
    providerStates,
    readyCount: readyChannels.length,
    connectedCount: connectedChannels.length,
  });
}

function resolveCanonicalLaunchChannel(posture = {}) {
  const channels = obj(posture?.channels);
  const channelSummary = obj(posture?.channelSummary);
  const providerStates = CHANNEL_IDS.map((provider) =>
    buildPostureChannelState(provider, {
      id: provider,
      ...obj(channels[provider]),
    })
  );
  const availableChannels = providerStates.filter((channel) => channel.available);
  const readyChannels = availableChannels.filter(
    (channel) => channel.connected && channel.deliveryReady
  );
  const connectedChannels = availableChannels.filter(
    (channel) => channel.connected
  );
  const deliveryReadyIds = arr(channelSummary.deliveryReadyChannelIds)
    .map((id) => lower(id))
    .filter(Boolean);
  const selectedId = lower(channelSummary.selectedChannelId);
  const selectedChannel = providerStates.find(
    (channel) =>
      channel.provider === selectedId &&
      channel.connected === true &&
      channel.deliveryReady === true
  );

  if (!availableChannels.length) {
    return createCanonicalLaunchChannel(buildLaunchChannelUnavailableState());
  }

  if (selectedChannel) {
    return withChannelCounts(selectedChannel, providerStates);
  }

  if (deliveryReadyIds.length === 1) {
    const readyChannel = readyChannels.find(
      (channel) => channel.provider === deliveryReadyIds[0]
    );
    if (readyChannel) return withChannelCounts(readyChannel, providerStates);
  }

  if (!deliveryReadyIds.length && readyChannels.length === 1) {
    return withChannelCounts(readyChannels[0], providerStates);
  }

  if (readyChannels.length > 1) {
    return buildGenericLaunchChannelsState({
      channels: providerStates,
      title: "Multiple launch channels are connected.",
      summary:
        `${readyChannels.length} launch channels are ready. Review Channels before deciding which live surface should lead operations.`,
      detail:
        "Home stays generic when more than one channel is launch-ready so the workspace does not silently privilege a provider.",
      status: "multiple_ready",
      statusLabel: "Multiple connected",
      connected: true,
      deliveryReady: true,
      reasonCode: "",
    });
  }

  if (connectedChannels.length > 0) {
    return buildGenericLaunchChannelsState({
      channels: providerStates,
      title: "A connected launch channel still needs review.",
      summary:
        connectedChannels.length === 1
          ? "A launch channel is attached, but it should not be treated as live yet."
          : `${connectedChannels.length} connected channels still need review before any one of them should be trusted as live.`,
      detail:
        connectedChannels[0]?.detail ||
        "Open Channels to inspect connection posture, provider repair needs, and delivery blockers.",
      status: "connected_blocked",
      statusLabel: "Connected, blocked",
      connected: true,
      deliveryReady: false,
      reasonCode:
        connectedChannels.length === 1 ? connectedChannels[0]?.reasonCode : "",
    });
  }

  return buildGenericLaunchChannelsState({
    channels: providerStates,
    title: "Connect a launch channel.",
    summary:
      "No launch channel is connected yet. Open Channels to choose the provider that should enter the launch lane.",
    detail:
      "Home stays provider-agnostic until a real launch channel is explicitly connected and trusted.",
    status: "needs_connection",
    statusLabel: "Connect required",
    connected: false,
    deliveryReady: false,
    reasonCode: "channel_not_connected",
  });
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
          "Approved truth exists, but the runtime projection is stale and should be refreshed before trusting live replies.",
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
          "The launch lane is blocked until one live channel is connected.",
      };
    case "launch_posture_unavailable":
      return {
        title: "Launch posture is unavailable.",
        summary:
          "Home cannot confirm launch readiness right now, so live readiness stays guarded.",
      };
    default:
      return {
        title: "Live replies are still blocked.",
        summary:
          "A required launch dependency still needs review or repair before the system should be trusted as live.",
      };
  }
}

function buildTruthRuntimeState({ posture, launchChannel, sourceStatus }) {
  const truth = obj(posture?.truth);
  const runtime = obj(posture?.runtime);
  const postureAvailable = sourceStatus.launchPosture?.available !== false;
  const truthReady =
    postureAvailable && truth.ready === true && lower(truth.status) === "ready";
  const ready =
    postureAvailable &&
    runtime.ready === true &&
    lower(runtime.status) === "ready";
  const reasonCodes = normalizeReasonCodes([
    postureAvailable ? truth.reasonCode : "launch_posture_unavailable",
    runtime.reasonCode,
    launchChannel?.reasonCode,
  ]);
  const leadReason = reasonCodes[0] || "";
  const copy = buildReasonHeadline(leadReason);

  return {
    truthReady,
    ready,
    reasonCodes,
    leadReason,
    title: ready ? "Runtime is healthy." : copy.title,
    summary: ready
      ? "Approved business truth is backing the workspace runtime."
      : copy.summary,
    detail: ready
      ? firstText(runtime.message, truth.message)
      : firstText(truth.message, runtime.message, launchChannel?.detail),
    health: {
      usable: ready,
      autonomousAllowed: ready,
      status: s(runtime.status, ready ? "ready" : "blocked"),
      reasonCode: s(runtime.reasonCode),
    },
    truth,
    runtimeProjection: runtime,
  };
}

function buildInboxState({ posture, sourceStatus }) {
  const inbox = obj(posture?.inbox);
  const available =
    sourceStatus.launchPosture?.available !== false && inbox.available === true;
  const unreadCount = available ? n(inbox.unreadCount) : 0;
  const openCount = available ? n(inbox.openCount) : 0;
  const handoffCount = available ? n(inbox.handoffCount) : 0;
  const assignedOpenCount = available ? n(inbox.assignedOpenCount) : 0;
  const pendingOutboundCount = available ? n(inbox.pendingOutboundCount) : 0;
  const failedOutboundCount = available ? n(inbox.failedOutboundCount) : 0;
  const retryingOutboundCount = available ? n(inbox.retryingOutboundCount) : 0;
  const outboundPending =
    pendingOutboundCount + failedOutboundCount + retryingOutboundCount;

  if (!available) {
    return {
      status: "unavailable",
      statusLabel: "Unavailable",
      tone: "danger",
      summary: "Conversation activity is unavailable right now.",
      detail: "Inbox pressure could not be loaded.",
      action: { label: "Open inbox", path: "/inbox" },
      counts: {
        unreadCount: 0,
        openCount: 0,
        handoffCount: 0,
        assignedOpenCount: 0,
        outboundPending: 0,
        pendingOutboundCount: 0,
        failedOutboundCount: 0,
        retryingOutboundCount: 0,
      },
    };
  }

  const counts = {
    unreadCount,
    openCount,
    handoffCount,
    assignedOpenCount,
    outboundPending,
    pendingOutboundCount,
    failedOutboundCount,
    retryingOutboundCount,
  };

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
      counts,
    };
  }

  if (openCount > 0 || outboundPending > 0) {
    return {
      status: "active",
      statusLabel: "Active",
      tone: "info",
      summary:
        outboundPending > 0
          ? `${pluralize(outboundPending, "outbound action")} still need delivery attention.`
          : `${pluralize(openCount, "conversation")} are currently open.`,
      detail: handoffCount
        ? `${pluralize(handoffCount, "conversation")} currently have operator ownership.`
        : "The inbox is active, but there is no unread pressure right now.",
      action: { label: "Open inbox", path: "/inbox" },
      counts,
    };
  }

  return {
    status: "ready",
    statusLabel: "Ready",
    tone: "success",
    summary: "Inbox is calm right now.",
    detail: "No unread pressure or pending outbound retries are visible.",
    action: { label: "Open inbox", path: "/inbox" },
    counts,
  };
}

function normalizeAssistantSection(section = {}) {
  const source = obj(section);
  return {
    key: s(source.key),
    label: s(source.label),
    title: s(source.title),
    group: s(source.group),
    groupLabel: s(source.groupLabel),
    phase: s(source.phase),
    phaseLabel: s(source.phaseLabel),
    status: s(source.status),
    complete: lower(source.status) === "ready",
    partial: source.partial === true,
    reportReady: source.reportReady === true,
    sourceCovered: source.sourceCovered === true,
    missingFields: arr(source.missingFields),
    metric: obj(source.metric),
  };
}

function buildAssistantState(setupAssistantSession) {
  const response = obj(setupAssistantSession);
  const assistant = obj(response.assistant);
  const review = obj(response.review);
  const question = obj(assistant.nextQuestion);
  const primaryQuestion = obj(response.primaryQuestion);
  const reviewDraft = obj(assistant.reviewDraft);
  const draft = obj(assistant.draft);

  const sections = arr(assistant.sections).map(normalizeAssistantSection);

  const readyForApproval =
    assistant.readyForApproval === true || review.readyForApproval === true;

  const hasApprovedSetupBaseline = false;

  return {
    ...assistant,
    sections,
    reviewDraft,
    draft,
    question: Object.keys(question).length ? question : primaryQuestion,
    primaryAction: readyForApproval
      ? { label: "Review setup", path: SETUP_WIDGET_ROUTE }
      : { label: "Continue setup", path: SETUP_WIDGET_ROUTE },
    secondaryAction:
      lower(obj(assistant.completion).phase) === "review_and_launch"
        ? { label: "Open truth", path: "/truth" }
        : { label: "Open channels", path: "/channels" },
    hasApprovedSetupBaseline,
    draftPreviewHidden: assistant.draftPreviewHidden === true,
    draftVisibilityMode: s(assistant.draftVisibilityMode),
    readyForApproval,
  };
}

function buildLaunchSteps({ launchChannel, truthRuntime, inboxState, assistant }) {
  const channelConnected = launchChannel.connected === true;
  const channelReady = channelConnected && launchChannel.deliveryReady === true;
  const truthReady = truthRuntime.truthReady === true;
  const runtimeReady = truthRuntime.ready === true;
  const setupReadyForApproval = assistant.readyForApproval === true;
  const inboxReady = lower(inboxState.status) !== "unavailable";
  const truthComplete = truthReady && runtimeReady;
  const truthAction = truthReady
    ? {
        label: runtimeReady ? "Open truth" : "Review truth",
        path: "/truth",
      }
    : normalizeAction(assistant.primaryAction, {
        label: "Open setup",
        path: SETUP_WIDGET_ROUTE,
      });
  const channelBlocked = channelConnected && !channelReady;

  return [
    {
      id: "truth",
      label: "Business truth",
      complete: truthComplete,
      summary: truthReady
        ? truthRuntime.summary
        : setupReadyForApproval
          ? "Review and approve the setup draft before treating any channel as live."
          : "Approve the business facts the AI can safely use.",
      statusLabel: truthComplete
        ? "Ready"
        : truthReady
          ? "Runtime review"
          : setupReadyForApproval
            ? "Review"
            : "Setup required",
      tone: truthComplete ? "success" : "danger",
      action: truthAction,
    },
    {
      id: "channel",
      label: "Channel",
      complete: channelReady,
      summary: channelReady
        ? launchChannel.summary
        : channelBlocked
          ? "A channel is connected, but delivery is still blocked."
          : "Connect one live customer channel.",
      statusLabel: channelReady
        ? "Ready"
        : channelBlocked
          ? "Blocked"
          : "Not connected",
      tone: channelReady ? "success" : channelBlocked ? "danger" : "warning",
      action: launchChannel.action,
    },
    {
      id: "inbox",
      label: "Inbox",
      complete: truthComplete && channelReady && inboxReady,
      summary:
        truthComplete && channelReady
          ? inboxState.summary
          : "Operate conversations here after truth and channel are ready.",
      statusLabel:
        truthComplete && channelReady ? inboxState.statusLabel : "Waiting",
      tone: truthComplete && channelReady ? lower(inboxState.tone) : "neutral",
      action: inboxState.action,
    },
  ];
}

function surfaceLabel(surface = "") {
  switch (lower(surface)) {
    case "launchposture":
    case "launch_posture":
      return "launch posture";
    case "truth":
      return "business info";
    case "runtime":
      return "runtime authority";
    case "website":
      return "website chat";
    case "instagram":
      return "Instagram DM";
    case "telegram":
      return "Telegram";
    case "inbox":
      return "inbox";
    case "setupassistantsession":
    case "setup_assistant_session":
      return "setup assistant";
    default:
      return s(surface);
  }
}

function buildAvailabilityNote(sourceStatus = {}, posture = {}) {
  const unavailable = [];

  if (sourceStatus.launchPosture?.available === false) {
    unavailable.push("launch posture");
  }

  for (const item of arr(posture?.unavailable)) {
    const label = surfaceLabel(item?.surface);
    if (label) unavailable.push(label);
  }

  if (sourceStatus.setupAssistantSession?.available === false) {
    unavailable.push("setup assistant");
  }

  const unique = [...new Set(unavailable.filter(Boolean))];
  if (!unique.length) return null;

  return {
    title: "Some live context is limited",
    description:
      unique.length === 1
        ? `${unique[0]} could not be loaded, so Home is showing a guarded summary.`
        : `${unique.join(", ")} could not be loaded, so Home is showing a guarded summary.`,
  };
}

function buildPrimaryAction({
  posture,
  launchChannel,
  truthRuntime,
  assistant,
  inboxState,
}) {
  const postureAction = normalizeAction(posture?.overall?.primaryAction);
  if (postureAction) return postureAction;

  const truthReady = truthRuntime.truthReady === true;
  const runtimeReady = truthRuntime.ready === true;
  const channelReady =
    launchChannel.connected === true && launchChannel.deliveryReady === true;

  if (!truthReady) {
    return normalizeAction(assistant.primaryAction, {
      label: "Open setup",
      path: SETUP_WIDGET_ROUTE,
    });
  }

  if (!runtimeReady) {
    return { label: "Review truth", path: "/truth" };
  }

  if (!channelReady) {
    return launchChannel.action || { label: "Open channels", path: "/channels" };
  }

  if (lower(inboxState.status) === "unavailable") {
    return { label: "Open inbox", path: "/inbox" };
  }

  return { label: "Open inbox", path: "/inbox" };
}

function buildSecondaryAction({ posture, truthRuntime }) {
  const postureAction = normalizeAction(posture?.overall?.secondaryAction);
  if (postureAction) return postureAction;

  const truthReady = truthRuntime.truthReady === true;
  if (!truthReady) return null;

  return { label: "Open truth", path: "/truth" };
}

function deriveAssistantLaunchState({
  launchChannel,
  truthRuntime,
  launchReady,
}) {
  const truthReady = truthRuntime.truthReady === true;
  const runtimeReady = truthRuntime.ready === true;

  if (launchReady) {
    return {
      launchPosture: "normal_operation",
      setupNeeded: false,
    };
  }

  if (!truthReady) {
    return {
      launchPosture: "setup_needed",
      setupNeeded: true,
    };
  }

  if (!runtimeReady) {
    return {
      launchPosture: "runtime_repair_needed",
      setupNeeded: false,
    };
  }

  if (
    !(launchChannel.connected === true) ||
    !(launchChannel.deliveryReady === true)
  ) {
    return {
      launchPosture: "connect_channel",
      setupNeeded: false,
    };
  }

  return {
    launchPosture: "inbox_unavailable",
    setupNeeded: false,
  };
}

async function loadProductHomePayloads() {
  const [postureResult, setupAssistantResult] = await Promise.allSettled([
    getLaunchPosture(),
    getCurrentSetupAssistantSession(),
  ]);

  return {
    payloads: {
      posture:
        postureResult.status === "fulfilled" ? postureResult.value : null,
      setupAssistantSession:
        setupAssistantResult.status === "fulfilled"
          ? setupAssistantResult.value
          : null,
    },
    sourceStatus: {
      launchPosture: {
        available: postureResult.status === "fulfilled",
        error:
          postureResult.status === "rejected"
            ? s(postureResult.reason?.message)
            : "",
      },
      setupAssistantSession: {
        available: setupAssistantResult.status === "fulfilled",
        error:
          setupAssistantResult.status === "rejected"
            ? s(setupAssistantResult.reason?.message)
            : "",
      },
    },
  };
}

export default function useProductHome() {
  const queryClient = useQueryClient();
  const { tenantKey, loading: tenantLoading, ready: tenantReady } =
    useWorkspaceTenantKey();
  const refreshToken = useLaunchSliceRefreshToken(tenantKey, tenantReady);

  const queryKey = useMemo(
    () => buildWorkspaceScopedQueryKey(["product-home"], tenantKey),
    [tenantKey]
  );

  useEffect(() => {
    if (!tenantReady) return;
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey, refreshToken, tenantReady]);

  const query = useQuery({
    queryKey,
    enabled: tenantReady,
    staleTime: 15_000,
    queryFn: loadProductHomePayloads,
  });

  return useMemo(() => {
    if (!tenantReady || tenantLoading || query.isLoading) {
      return {
        loading: true,
      };
    }

    const payloads = obj(query.data?.payloads);
    const rawSourceStatus = obj(query.data?.sourceStatus);
    const queryError =
      query.isError && query.error ? s(query.error.message) : "";
    const sourceStatus = {
      launchPosture: {
        ...obj(rawSourceStatus.launchPosture),
        available: rawSourceStatus.launchPosture?.available === true,
        error: s(rawSourceStatus.launchPosture?.error || queryError),
      },
      setupAssistantSession: {
        ...obj(rawSourceStatus.setupAssistantSession),
        available: rawSourceStatus.setupAssistantSession?.available !== false,
      },
    };
    const posture =
      sourceStatus.launchPosture?.available !== false ? obj(payloads.posture) : {};

    const launchChannel = resolveCanonicalLaunchChannel(posture);
    const truthRuntime = buildTruthRuntimeState({
      posture,
      launchChannel,
      sourceStatus,
    });
    const assistant = buildAssistantState(payloads.setupAssistantSession);
    const inboxState = buildInboxState({ posture, sourceStatus });

    const inboxReady = lower(inboxState.status) !== "unavailable";
    const launchReady =
      posture?.overall?.launchReady === true &&
      launchChannel.connected === true &&
      launchChannel.deliveryReady === true &&
      truthRuntime.truthReady === true &&
      truthRuntime.ready === true &&
      inboxReady;

    const launchSteps = buildLaunchSteps({
      launchChannel,
      truthRuntime,
      inboxState,
      assistant,
    });

    const nextStep =
      launchSteps.find((item) => item.complete !== true) ||
      launchSteps[launchSteps.length - 1] ||
      null;

    const primaryAction = buildPrimaryAction({
      posture,
      launchChannel,
      truthRuntime,
      assistant,
      inboxState,
    });

    const secondaryAction = buildSecondaryAction({
      posture,
      truthRuntime,
    });
    const assistantLaunchState = deriveAssistantLaunchState({
      launchChannel,
      truthRuntime,
      launchReady,
    });
    const postureError = s(sourceStatus.launchPosture?.error);

    return {
      loading: false,
      isFetching: query.isFetching,
      refetch: query.refetch,
      error: queryError || postureError,
      availabilityNote: buildAvailabilityNote(sourceStatus, posture),

      launchReady,
      launchChannel,
      truthRuntime,
      assistant: {
        ...assistant,
        ...assistantLaunchState,
      },
      inboxState,

      primaryAction,
      secondaryAction,
      launchSteps,
      nextStep,
    };
  }, [
    query.data,
    query.error,
    query.isError,
    query.isFetching,
    query.isLoading,
    query.refetch,
    tenantLoading,
    tenantReady,
  ]);
}
