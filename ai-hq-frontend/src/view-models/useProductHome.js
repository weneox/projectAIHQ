import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOutboundSummary, listInboxThreads } from "../api/inbox.js";
import { getCurrentSetupAssistantSession } from "../api/setup.js";
import {
  getMetaChannelStatus,
  getTelegramChannelStatus,
  getWebsiteWidgetStatus,
} from "../api/channelConnect.js";
import { getSettingsTrustView } from "../api/trust.js";
import {
  buildWorkspaceScopedQueryKey,
  useWorkspaceTenantKey,
} from "../hooks/useWorkspaceTenantKey.js";
import { SETUP_WIDGET_ROUTE } from "../lib/appEntry.js";
import { useLaunchSliceRefreshToken } from "../lib/launchSliceRefresh.js";

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
        provider === "meta" ? "Select Instagram account" : `Open ${labelBase}`,
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

function buildMetaLaunchChannelState({ metaPayload, sourceStatus }) {
  const available = sourceStatus.metaStatus?.available !== false;
  const fallback = buildLaunchChannelUnavailableState();

  if (!available) {
    return createCanonicalLaunchChannel({
      ...fallback,
      id: "launch-meta",
      provider: "meta",
      channelLabel: "Instagram",
      action: buildLaunchAction("meta", "open"),
    });
  }

  const state = lower(metaPayload?.state);
  const connected = metaPayload?.connected === true || state === "connected";
  const deliveryReady = metaPayload?.runtime?.deliveryReady === true;
  const selectionRequired = metaPayload?.pendingSelection?.required === true;
  const account = obj(metaPayload?.account);
  const displayName = firstText(
    account.displayName,
    account.pageName,
    account.username ? `Instagram ${formatHandle(account.username)}` : ""
  );
  const handle = formatHandle(account.username);
  const detail =
    firstText(
      metaPayload?.detail,
      metaPayload?.readiness?.message,
      metaPayload?.lastConnectFailure?.message
    ) || "Open Channels to inspect Instagram connection posture.";

  const base = {
    id: "launch-meta",
    provider: "meta",
    channelLabel: "Instagram",
    accountLabel: "Instagram account",
    accountDisplayName: displayName,
    accountHandle: handle,
    account: {
      displayName,
      handle,
      pageName: s(account.pageName),
      username: s(account.username),
      pageId: s(account.pageId),
      igUserId: s(account.igUserId),
      metaUserId: s(account.metaUserId),
      metaUserName: s(account.metaUserName),
    },
    reasonCode: lower(
      metaPayload?.reasonCode ||
        metaPayload?.runtime?.reasonCode ||
        metaPayload?.readiness?.blockers?.[0]?.reasonCode
    ),
  };

  if (selectionRequired) {
    return createCanonicalLaunchChannel({
      ...base,
      connected: false,
      available: true,
      status: "selection_required",
      statusLabel: "Selection required",
      title: "Instagram account selection is still required.",
      summary:
        "Meta returned eligible Instagram business assets, but one still needs to be selected before this tenant is bound.",
      detail,
      action: buildLaunchAction("meta", "select"),
      deliveryReady: false,
    });
  }

  if (connected) {
    return createCanonicalLaunchChannel({
      ...base,
      connected: true,
      available: true,
      status: deliveryReady ? "connected" : "connected_blocked",
      statusLabel: "Connected",
      title: deliveryReady
        ? "Instagram is connected."
        : "Instagram is connected, but delivery is still gated.",
      summary:
        s(metaPayload?.readiness?.message) ||
        (deliveryReady
          ? "Instagram can be used as the current launch channel."
          : "Instagram is attached, but launch delivery is still blocked by runtime or channel readiness."),
      detail,
      action: buildLaunchAction("meta", "open"),
      deliveryReady,
    });
  }

  if (state === "connecting") {
    return createCanonicalLaunchChannel({
      ...base,
      connected: false,
      available: true,
      status: "connecting",
      statusLabel: "Connecting",
      title: "Instagram connection is still in progress.",
      summary:
        s(metaPayload?.summary) ||
        "Meta OAuth or asset binding still needs to settle before Instagram is treated as connected.",
      detail,
      action: buildLaunchAction("meta", "open"),
      deliveryReady: false,
    });
  }

  if (
    state === "deauthorized" ||
    state === "reconnect_required" ||
    state === "disconnected" ||
    state === "error" ||
    state === "blocked"
  ) {
    return createCanonicalLaunchChannel({
      ...base,
      connected: false,
      available: true,
      status: "repair_required",
      statusLabel: "Reconnect required",
      title: "Instagram needs reconnect or repair.",
      summary:
        s(metaPayload?.readiness?.message) ||
        s(metaPayload?.summary) ||
        "Instagram exists as a launch option, but the current connection should not be trusted yet.",
      detail,
      action: buildLaunchAction("meta", "reconnect"),
      deliveryReady: false,
    });
  }

  return createCanonicalLaunchChannel({
    ...base,
    connected: false,
    available: true,
    status: "needs_connection",
    statusLabel: "Connect required",
    title: "Connect Instagram before using it as the launch channel.",
    summary:
      s(metaPayload?.readiness?.message) ||
      "Instagram is available as a launch channel, but it is not connected yet.",
    detail,
    action: buildLaunchAction("meta", "connect"),
    deliveryReady: false,
  });
}

function buildTelegramLaunchChannelState({ telegramPayload, sourceStatus }) {
  const available = sourceStatus.telegramStatus?.available !== false;
  const fallback = buildLaunchChannelUnavailableState();

  if (!available) {
    return createCanonicalLaunchChannel({
      ...fallback,
      id: "launch-telegram",
      provider: "telegram",
      channelLabel: "Telegram",
      action: buildLaunchAction("telegram", "open"),
    });
  }

  const state = lower(
    telegramPayload?.state ||
      (telegramPayload?.connected === true ? "connected" : "not_connected")
  );
  const connected =
    telegramPayload?.connected === true || state === "connected";
  const deliveryReady = telegramPayload?.runtime?.deliveryReady === true;
  const account = obj(telegramPayload?.account);
  const botHandle = formatHandle(account.botUsername);
  const displayName = firstText(
    account.displayName,
    botHandle ? `Telegram ${botHandle}` : ""
  );
  const detail =
    firstText(
      telegramPayload?.detail,
      telegramPayload?.readiness?.message
    ) || "Open Channels to inspect Telegram connection posture.";

  const base = {
    id: "launch-telegram",
    provider: "telegram",
    channelLabel: "Telegram",
    accountLabel: "Telegram bot",
    accountDisplayName: displayName,
    accountHandle: botHandle,
    account: {
      displayName,
      handle: botHandle,
      botUsername: s(account.botUsername),
      botUserId: s(account.botUserId),
      firstName: s(account.firstName),
      lastName: s(account.lastName),
    },
    reasonCode: lower(
      telegramPayload?.reasonCode ||
        telegramPayload?.runtime?.reasonCode ||
        telegramPayload?.webhook?.reasonCode
    ),
  };

  if (connected) {
    return createCanonicalLaunchChannel({
      ...base,
      connected: true,
      available: true,
      status: deliveryReady ? "connected" : "connected_blocked",
      statusLabel: "Connected",
      title: deliveryReady
        ? "Telegram is connected."
        : "Telegram is connected, but delivery is still gated.",
      summary:
        s(telegramPayload?.readiness?.message) ||
        (deliveryReady
          ? "Telegram can be used as the current launch channel."
          : "Telegram is attached, but launch delivery is still blocked by runtime or channel readiness."),
      detail,
      action: buildLaunchAction("telegram", "open"),
      deliveryReady,
    });
  }

  if (state === "connecting") {
    return createCanonicalLaunchChannel({
      ...base,
      connected: false,
      available: true,
      status: "connecting",
      statusLabel: "Connecting",
      title: "Telegram connection is still in progress.",
      summary:
        s(telegramPayload?.summary) ||
        "Webhook or runtime checks still need to settle before Telegram is treated as connected.",
      detail,
      action: buildLaunchAction("telegram", "open"),
      deliveryReady: false,
    });
  }

  if (
    state === "error" ||
    state === "blocked" ||
    state === "disconnected"
  ) {
    return createCanonicalLaunchChannel({
      ...base,
      connected: false,
      available: true,
      status: "repair_required",
      statusLabel: "Reconnect required",
      title: "Telegram needs reconnect or repair.",
      summary:
        s(telegramPayload?.readiness?.message) ||
        s(telegramPayload?.summary) ||
        "Telegram exists as a launch option, but the current connection should not be trusted yet.",
      detail,
      action: buildLaunchAction("telegram", "reconnect"),
      deliveryReady: false,
    });
  }

  return createCanonicalLaunchChannel({
    ...base,
    connected: false,
    available: true,
    status: "needs_connection",
    statusLabel: "Connect required",
    title: "Connect Telegram before using it as the launch channel.",
    summary:
      s(telegramPayload?.readiness?.message) ||
      "Telegram is available as a launch channel, but it is not connected yet.",
    detail,
    action: buildLaunchAction("telegram", "connect"),
    deliveryReady: false,
  });
}

function buildWebsiteLaunchChannelState({ websitePayload, sourceStatus }) {
  const available = sourceStatus.websiteStatus?.available !== false;
  const fallback = buildLaunchChannelUnavailableState();

  if (!available) {
    return createCanonicalLaunchChannel({
      ...fallback,
      id: "launch-website",
      provider: "website",
      channelLabel: "Website chat",
      action: buildLaunchAction("website", "open"),
    });
  }

  const state = lower(websitePayload?.state);
  const launchReadiness = obj(websitePayload?.launchReadiness);
  const readiness = obj(websitePayload?.readiness);
  const widget = obj(websitePayload?.widget);
  const blockers =
    arr(launchReadiness.blockers).length > 0
      ? arr(launchReadiness.blockers)
      : arr(readiness.blockers);
  const enabled =
    launchReadiness.widgetEnabled === true || widget.enabled === true;
  const testingOnly = launchReadiness.testingOnly === true;
  const connected =
    launchReadiness.productionLaunchAllowed === true ||
    launchReadiness.productionReady === true ||
    (state === "connected" && readiness.status === "ready");
  const deliveryReady = connected;
  const detail =
    firstText(
      launchReadiness.message,
      readiness.message,
      widget.websiteUrl ? `Reference website: ${widget.websiteUrl}` : "",
      blockers[0]?.subtitle
    ) || "Open Channels to inspect website chat posture.";

  const base = {
    id: "launch-website",
    provider: "website",
    channelLabel: "Website chat",
    accountLabel: "Reference website",
    accountDisplayName: s(widget.title || "Website chat"),
    accountHandle: s(widget.websiteUrl),
    account: {
      displayName: s(widget.title || "Website chat"),
      handle: s(widget.websiteUrl),
      websiteUrl: s(widget.websiteUrl),
      publicWidgetId: s(
        launchReadiness.publicWidgetId || widget.publicWidgetId
      ),
    },
    reasonCode: lower(launchReadiness.reasonCode || blockers[0]?.reasonCode),
  };

  if (connected) {
    return createCanonicalLaunchChannel({
      ...base,
      connected: true,
      available: true,
      status: "connected",
      statusLabel: "Connected",
      title: "Website chat is configured.",
      summary:
        launchReadiness.message ||
        readiness.message ||
        "Website chat can be used as the current launch channel.",
      detail,
      action: buildLaunchAction("website", "open"),
      deliveryReady,
    });
  }

  if (enabled || testingOnly || launchReadiness.channelConfigured === true) {
    return createCanonicalLaunchChannel({
      ...base,
      connected: false,
      available: true,
      status: "repair_required",
      statusLabel: "Configuration required",
      title: testingOnly
        ? "Website chat is limited to testing handoffs."
        : "Website chat still needs configuration.",
      summary:
        launchReadiness.message ||
        readiness.message ||
        (testingOnly
          ? "Website chat can be tested, but production launch is still blocked."
          : "Website chat is enabled, but install hardening is still incomplete."),
      detail,
      action: buildLaunchAction("website", "open"),
      deliveryReady: false,
    });
  }

  return createCanonicalLaunchChannel({
    ...base,
    connected: false,
    available: true,
    status: "needs_connection",
    statusLabel: "Enable required",
    title: "Enable website chat before using it as the launch channel.",
    summary:
      launchReadiness.message ||
      readiness.message ||
      "Website chat is supported, but it is not configured yet.",
    detail,
    action: buildLaunchAction("website", "connect"),
    deliveryReady: false,
  });
}

function buildGenericLaunchChannelsState({
  channels = [],
  title = "",
  summary = "",
  detail = "",
  status = "unavailable",
  statusLabel = "Unavailable",
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
    statusLabel,
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

function resolveCanonicalLaunchChannel({
  metaPayload,
  telegramPayload,
  websitePayload,
  sourceStatus,
}) {
  const metaChannel = buildMetaLaunchChannelState({
    metaPayload,
    sourceStatus,
  });
  const telegramChannel = buildTelegramLaunchChannelState({
    telegramPayload,
    sourceStatus,
  });
  const websiteChannel = buildWebsiteLaunchChannelState({
    websitePayload,
    sourceStatus,
  });

  const channels = [metaChannel, telegramChannel, websiteChannel];
  const availableChannels = channels.filter((channel) => channel.available);
  const readyChannels = availableChannels.filter(
    (channel) => channel.connected && channel.deliveryReady
  );
  const connectedChannels = availableChannels.filter(
    (channel) => channel.connected
  );
  const blockedConnectedChannels = connectedChannels.filter(
    (channel) => !channel.deliveryReady
  );

  if (!availableChannels.length) {
    return createCanonicalLaunchChannel(buildLaunchChannelUnavailableState());
  }

  if (readyChannels.length === 1) {
    const activeChannel = readyChannels[0];
    return createCanonicalLaunchChannel({
      ...activeChannel,
      providerStates: channels,
      readyCount: readyChannels.length,
      connectedCount: connectedChannels.length,
    });
  }

  if (readyChannels.length > 1) {
    return buildGenericLaunchChannelsState({
      channels,
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
      channels,
      title: "A connected launch channel still needs review.",
      summary:
        connectedChannels.length === 1
          ? "A launch channel is attached, but it should not be treated as live yet."
          : `${connectedChannels.length} connected channels still need review before any one of them should be trusted as live.`,
      detail:
        blockedConnectedChannels[0]?.detail ||
        "Open Channels to inspect connection posture, provider repair needs, and delivery blockers.",
      status: "connected_blocked",
      statusLabel: "Connected, blocked",
      connected: true,
      deliveryReady: false,
      reasonCode:
        blockedConnectedChannels.length === 1
          ? blockedConnectedChannels[0]?.reasonCode
          : "",
    });
  }

  return buildGenericLaunchChannelsState({
    channels,
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
    default:
      return {
        title: "Live replies are still blocked.",
        summary:
          "A required launch dependency still needs review or repair before the system should be trusted as live.",
      };
  }
}

function buildRuntimeRepairDetail({ trustPayload, launchChannel }) {
  const runtimeProjection = obj(trustPayload?.summary?.runtimeProjection);
  const health = obj(runtimeProjection.health);
  const runtimeReadiness = obj(runtimeProjection.readiness);
  const truthReadiness = obj(trustPayload?.summary?.truth?.readiness);
  const reasonCodes = normalizeReasonCodes([
    health.reasonCode,
    ...(health.reasons || []),
    truthReadiness.reasonCode,
    ...(truthReadiness.reasonCodes || []),
    runtimeReadiness.reasonCode,
    ...(runtimeReadiness.reasonCodes || []),
    launchChannel?.reasonCode,
  ]);

  const leadReason = reasonCodes[0] || "";
  const copy = buildReasonHeadline(leadReason);

  const detail = firstText(
    runtimeReadiness.message,
    truthReadiness.message,
    health.lastFailure?.errorMessage,
    health.lastFailure?.errorCode,
    launchChannel?.detail,
    launchChannel?.summary
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
  const requests = {
    trust: getSettingsTrustView({ limit: 4 }),
    inboxThreads: listInboxThreads({ limit: 10 }),
    inboxOutbound: getOutboundSummary(),
    metaStatus: getMetaChannelStatus(),
    telegramStatus: getTelegramChannelStatus(),
    websiteStatus: getWebsiteWidgetStatus(),
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
        outboundPending > 0
          ? `${pluralize(outboundPending, "outbound action")} still need delivery attention.`
          : `${pluralize(openCount, "conversation")} are currently open.`,
      detail: handoffCount
        ? `${pluralize(handoffCount, "conversation")} currently have operator ownership.`
        : "The inbox is active, but there is no unread pressure right now.",
      action: { label: "Open inbox", path: "/inbox" },
      counts: { unreadCount, openCount, handoffCount, outboundPending },
    };
  }

  return {
    status: "ready",
    statusLabel: "Ready",
    tone: "success",
    summary: "Inbox is calm right now.",
    detail: "No unread pressure or pending outbound retries are visible.",
    action: { label: "Open inbox", path: "/inbox" },
    counts: { unreadCount, openCount, handoffCount, outboundPending },
  };
}

function buildTruthRuntimeState({ trustPayload, launchChannel }) {
  const truth = obj(trustPayload?.summary?.truth);
  const runtimeProjection = obj(trustPayload?.summary?.runtimeProjection);
  const truthReadiness = obj(truth.truthReadiness || truth.readiness);
  const runtimeReadiness = obj(runtimeProjection.readiness);
  const health = obj(runtimeProjection.health);
  const truthReady =
    lower(truthReadiness.status) === "ready" ||
    lower(truthReadiness.primary) === "ready";
  const ready =
    lower(runtimeReadiness.status) === "ready" ||
    runtimeProjection.status === "ready" ||
    health.usable === true ||
    health.autonomousAllowed === true;

  const repairCopy = buildRuntimeRepairDetail({
    trustPayload,
    launchChannel,
  });

  return {
    truthReady,
    ready,
    reasonCodes: repairCopy.reasonCodes,
    leadReason: repairCopy.leadReason,
    title: ready ? "Runtime is healthy." : repairCopy.title,
    summary: ready
      ? "Approved business truth is backing the workspace runtime."
      : repairCopy.summary,
    detail: ready
      ? firstText(runtimeReadiness.message, health.status)
      : repairCopy.detail,
    health,
    truth,
    runtimeProjection,
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

function buildAvailabilityNote(sourceStatus = {}) {
  const unavailable = Object.entries(sourceStatus)
    .filter(([, state]) => state?.available === false)
    .map(([key]) => key);

  if (!unavailable.length) return null;

  return {
    title: "Some live context is limited",
    description:
      unavailable.length === 1
        ? `${unavailable[0]} could not be loaded, so Home is showing a guarded summary.`
        : `${unavailable.join(", ")} could not be loaded, so Home is showing a guarded summary.`,
  };
}

function buildPrimaryAction({ launchChannel, truthRuntime, assistant, inboxState }) {
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

function buildSecondaryAction({ launchChannel, truthRuntime }) {
  const truthReady = truthRuntime.truthReady === true;
  const runtimeReady = truthRuntime.ready === true;
  const channelReady =
    launchChannel.connected === true && launchChannel.deliveryReady === true;

  if (!truthReady) {
    return null;
  }

  if (!runtimeReady || !channelReady) {
    return { label: "Open truth", path: "/truth" };
  }

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

  if (!(launchChannel.connected === true) || !(launchChannel.deliveryReady === true)) {
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
    const sourceStatus = obj(query.data?.sourceStatus);

    const launchChannel = resolveCanonicalLaunchChannel({
      metaPayload: payloads.metaStatus,
      telegramPayload: payloads.telegramStatus,
      websitePayload: payloads.websiteStatus,
      sourceStatus,
    });

    const truthRuntime = buildTruthRuntimeState({
      trustPayload: payloads.trust,
      launchChannel,
    });

    const assistant = buildAssistantState(payloads.setupAssistantSession);
    const inboxState = buildInboxState({
      threadsPayload: payloads.inboxThreads,
      outboundPayload: payloads.inboxOutbound,
      sourceStatus,
    });

    const inboxReady = lower(inboxState.status) !== "unavailable";
    const launchReady =
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
      launchChannel,
      truthRuntime,
      assistant,
      inboxState,
    });

    const secondaryAction = buildSecondaryAction({
      launchChannel,
      truthRuntime,
    });
    const assistantLaunchState = deriveAssistantLaunchState({
      launchChannel,
      truthRuntime,
      launchReady,
    });

    return {
      loading: false,
      error: query.isError ? s(query.error?.message) : "",
      availabilityNote: buildAvailabilityNote(sourceStatus),

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
    query.isLoading,
    tenantLoading,
    tenantReady,
  ]);
}

