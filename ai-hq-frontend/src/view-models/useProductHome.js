import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOutboundSummary, listInboxThreads } from "../api/inbox.js";
import {
  getCurrentSetupAssistantSession,
  getSetupState,
} from "../api/setup.js";
import {
  getMetaChannelStatus,
  getTelegramChannelStatus,
  getWebsiteWidgetStatus,
} from "../api/channelConnect.js";
import { getSettingsTrustView } from "../api/trust.js";
import { SETUP_WIDGET_ROUTE } from "../lib/appEntry.js";

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

function pluralize(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
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

function firstReadableValue(...values) {
  for (const value of values) {
    const next = s(value);
    if (next) return next;
  }
  return "";
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
      label: provider === "meta" ? "Select Instagram account" : `Open ${labelBase}`,
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
    channelLabel: "Launch channel",
    accountLabel: "",
    accountDisplayName: "",
    accountHandle: "",
    account: {},
  };
}

function createCanonicalLaunchChannel(value = {}) {
  const account = obj(value.account);
  const displayName = firstReadableValue(
    value.accountDisplayName,
    account.displayName
  );
  const handle = firstReadableValue(value.accountHandle, account.handle);

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
    channelLabel: s(value.channelLabel, "Launch channel"),
    accountLabel: s(value.accountLabel),
    accountDisplayName: displayName,
    accountHandle: handle,
    account: {
      ...account,
      displayName,
      handle,
    },
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
  const connected =
    metaPayload?.connected === true || state === "connected";
  const deliveryReady = metaPayload?.runtime?.deliveryReady === true;
  const selectionRequired = metaPayload?.pendingSelection?.required === true;
  const account = obj(metaPayload?.account);
  const displayName = firstReadableValue(
    account.displayName,
    account.pageName,
    account.username ? `Instagram ${formatHandle(account.username)}` : ""
  );
  const handle = formatHandle(account.username);
  const detail =
    firstReadableValue(
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
  const displayName = firstReadableValue(
    account.displayName,
    botHandle ? `Telegram ${botHandle}` : ""
  );
  const detail =
    firstReadableValue(
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
  const readiness = obj(websitePayload?.readiness);
  const widget = obj(websitePayload?.widget);
  const blockers = arr(readiness.blockers);
  const enabled = widget.enabled === true;
  const connected = state === "connected" && readiness.status === "ready";
  const deliveryReady = connected;
  const detail =
    firstReadableValue(
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
      publicWidgetId: s(widget.publicWidgetId),
    },
    reasonCode: lower(blockers[0]?.reasonCode),
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
        readiness.message ||
        "Website chat can be used as the current launch channel.",
      detail,
      action: buildLaunchAction("website", "open"),
      deliveryReady,
    });
  }

  if (enabled) {
    return createCanonicalLaunchChannel({
      ...base,
      connected: false,
      available: true,
      status: "repair_required",
      statusLabel: "Configuration required",
      title: "Website chat still needs configuration.",
      summary:
        readiness.message ||
        "Website chat is enabled, but install hardening is still incomplete.",
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
      readiness.message ||
      "Website chat is supported, but it is not configured yet.",
    detail,
    action: buildLaunchAction("website", "connect"),
    deliveryReady: false,
  });
}

function scoreLaunchChannel(channel = {}) {
  if (!channel?.available) return 0;

  const provider = lower(channel.provider);
  const isMeta = provider === "meta";
  const isWebsite = provider === "website";

  if (channel.connected && channel.deliveryReady) {
    return isMeta ? 500 : isWebsite ? 420 : 400;
  }

  if (channel.connected && !channel.deliveryReady) {
    return isMeta ? 320 : isWebsite ? 310 : 300;
  }

  if (channel.status === "selection_required") {
    return 250;
  }

  if (channel.status === "connecting") {
    return isMeta ? 240 : isWebsite ? 190 : 180;
  }

  if (channel.status === "repair_required") {
    return isMeta ? 230 : isWebsite ? 175 : 170;
  }

  if (channel.status === "needs_connection") {
    return isMeta ? 220 : isWebsite ? 165 : 160;
  }

  if (channel.status === "unavailable") {
    return 0;
  }

  return isMeta ? 120 : 110;
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

  const best = [metaChannel, telegramChannel, websiteChannel].sort(
    (left, right) => scoreLaunchChannel(right) - scoreLaunchChannel(left)
  )[0];

  return best?.available
    ? best
    : createCanonicalLaunchChannel(buildLaunchChannelUnavailableState());
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

  const detail = firstReadableValue(
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
    setup: getSetupState(),
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

function buildTruthRuntimeState({ trustPayload, launchChannel, sourceStatus }) {
  const available = sourceStatus.trust?.available !== false;
  const fallbackTruthAction = {
    label: "Continue AI setup",
    path: SETUP_WIDGET_ROUTE,
  };
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
  const deliveryReady = launchChannel?.deliveryReady === true;
  const truthAction = pickReadinessAction(truthReadiness, fallbackTruthAction);
  const runtimeAction = pickRuntimeRepairAction(trustPayload);
  const repairDetail = buildRuntimeRepairDetail({
    trustPayload,
    launchChannel,
  });

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
          ...arr(truthReadiness.blockedItems).map(
            (item) => item?.subtitle || item?.title
          )
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
          : "The launch channel is attached, but delivery is still blocked even though approved truth exists.",
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
  const readySections = Object.values(sectionStatus).filter(
    (item) => s(item?.status) === "ready"
  ).length;

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
    launchPosture === "runtime_repair_needed" ? "support" : "setup";

  return {
    needed: launchPosture === "setup_needed",
    launchPosture,
    assistantMode,
    title:
      launchPosture === "connect_channel"
        ? `Connect ${launchChannel.channelLabel || "a launch channel"} first.`
        : launchPosture === "setup_needed"
          ? hasDraft
            ? `${launchChannel.channelLabel || "Launch channel"} is connected. Continue the setup draft.`
            : `${launchChannel.channelLabel || "Launch channel"} is connected. Start the first setup draft.`
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
              path: SETUP_WIDGET_ROUTE,
            }
          : launchPosture === "runtime_repair_needed"
            ? truthRuntime.action
            : {
                label: "Open AI setup",
                path: SETUP_WIDGET_ROUTE,
              },
    secondaryAction:
      launchPosture === "connect_channel"
        ? { label: "Open home", path: "/home" }
        : launchPosture === "setup_needed"
          ? { label: "Open truth", path: "/truth" }
          : launchPosture === "runtime_repair_needed"
            ? { label: "Open inbox", path: "/inbox" }
            : { label: "Open home", path: "/home" },
    hasDraft,
    servicesCount: arr(draft.services).length,
    contactsCount: arr(draft.contacts).length,
    hoursCount: arr(draft.hours).length,
    blockerCount,
    readySections,
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

function buildAvailabilityNote({
  sourceStatus,
  inboxState,
  launchChannel,
  truthRuntime,
}) {
  const details = [];

  if (sourceStatus.setup?.available === false) {
    details.push("Setup progress is unavailable.");
  }

  if (sourceStatus.trust?.available === false) {
    details.push("Truth and runtime posture are unavailable.");
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

function isSetupDraftReady(setupFlow = {}, truthRuntime = {}) {
  if (truthRuntime.truthReady === true) {
    return true;
  }

  return (
    setupFlow.hasDraft &&
    setupFlow.blockerCount === 0 &&
    (setupFlow.readySections > 0 ||
      setupFlow.servicesCount > 0 ||
      setupFlow.contactsCount > 0 ||
      setupFlow.hoursCount > 0)
  );
}

function buildLaunchLaneStep({
  id,
  label,
  title = "",
  status,
  statusLabel,
  tone,
  summary,
  detail,
  action,
  complete,
}) {
  return {
    id,
    label,
    title: s(title || label),
    status,
    statusLabel,
    tone,
    summary,
    detail,
    action: normalizeAction(action),
    complete: complete === true,
  };
}

function buildLaunchLaneModel({
  launchChannel,
  truthRuntime,
  setupFlow,
  inboxState,
}) {
  const setupReady = isSetupDraftReady(setupFlow, truthRuntime);
  const approvalReady = truthRuntime.ready === true;
  const liveSignalReady = inboxState.status !== "unavailable";
  const launchReady =
    launchChannel.connected && setupReady && approvalReady && liveSignalReady;

  const channelAction = normalizeAction(launchChannel.action, {
    label: "Open channels",
    path: "/channels",
  });
  const setupAction = normalizeAction(setupFlow.action, {
    label: setupFlow.hasDraft ? "Continue setup" : "Start setup",
    path: SETUP_WIDGET_ROUTE,
  });
  const truthAction = normalizeAction(truthRuntime.action, {
    label: "Open truth",
    path: "/truth",
  });
  const inboxAction = normalizeAction(inboxState.action, {
    label: "Open inbox",
    path: "/inbox",
  });

  const channelStep = launchChannel.connected
    ? buildLaunchLaneStep({
        id: "channel",
        label: "Connect launch channel",
        status: "ready",
        statusLabel: "Connected",
        tone: "success",
        summary:
          launchChannel.summary ||
          "The launch channel is attached and available to the workspace.",
        detail: launchChannel.detail,
        action: channelAction,
        complete: true,
      })
    : buildLaunchLaneStep({
        id: "channel",
        label: "Connect launch channel",
        status: "blocked",
        statusLabel:
          launchChannel.status === "connecting"
            ? "Connecting"
            : launchChannel.status === "selection_required"
              ? "Selection required"
              : "Connect required",
        tone:
          launchChannel.status === "connecting" ||
          launchChannel.status === "selection_required"
            ? "info"
            : "danger",
        summary:
          launchChannel.summary ||
          "Connect the launch channel before the rest of the launch lane can move.",
        detail: launchChannel.detail,
        action: channelAction,
        complete: false,
      });

  const setupStep = setupReady
    ? buildLaunchLaneStep({
        id: "setup",
        label: "Create or continue setup draft",
        status: "ready",
        statusLabel: "Structured",
        tone: "success",
        summary:
          truthRuntime.truthReady === true && !setupFlow.hasDraft
            ? "A governed setup baseline already exists behind approved truth."
            : "The setup draft has enough confirmed structure to support launch review.",
        detail: setupFlow.hasDraft
          ? `${setupFlow.readySections} ready sections / ${setupFlow.servicesCount} services / ${setupFlow.contactsCount} contacts`
          : "Draft edits stay separate from approved truth until a later review.",
        action: setupAction,
        complete: true,
      })
    : buildLaunchLaneStep({
        id: "setup",
        label: "Create or continue setup draft",
        status: setupFlow.hasDraft ? "in_progress" : "pending",
        statusLabel: setupFlow.hasDraft ? "In progress" : "Start draft",
        tone: setupFlow.hasDraft ? "warn" : "info",
        summary: setupFlow.hasDraft
          ? "Continue confirming the business draft before truth approval and runtime activation."
          : "Start the first structured business draft before truth approval and runtime activation.",
        detail: setupFlow.hasDraft
          ? `${setupFlow.readySections} ready sections / ${setupFlow.blockerCount} blockers remaining`
          : "No structured setup draft is visible yet.",
        action: setupAction,
        complete: false,
      });

  const approvalStep = approvalReady
    ? buildLaunchLaneStep({
        id: "approval",
        label: "Approve truth and runtime",
        status: "ready",
        statusLabel: "Approved",
        tone: "success",
        summary: truthRuntime.truthVersionId
          ? `Approved truth version ${truthRuntime.truthVersionId} is governing a healthy runtime.`
          : "Approved truth and runtime are aligned for live operation.",
        detail:
          truthRuntime.detail ||
          "Approved truth stays governed and the runtime remains healthy.",
        action: truthAction,
        complete: true,
      })
    : buildLaunchLaneStep({
        id: "approval",
        label: "Approve truth and runtime",
        status: "blocked",
        statusLabel: setupReady
          ? truthRuntime.truthReady
            ? "Repair required"
            : "Approval required"
          : "Waiting on setup",
        tone: setupReady
          ? truthRuntime.truthReady
            ? "warn"
            : "danger"
          : "danger",
        summary: !setupReady
          ? "Truth approval only starts after the setup draft is structured enough."
          : truthRuntime.summary ||
            (truthRuntime.truthReady
              ? "Runtime still needs repair before live launch."
              : "Approved truth still needs review before live launch."),
        detail: !setupReady
          ? "Complete the structured draft first."
          : truthRuntime.detail,
        action: !setupReady ? setupAction : truthAction,
        complete: false,
      });

  const liveStep = launchReady
    ? buildLaunchLaneStep({
        id: "live",
        label: "Go live in inbox",
        status: "ready",
        statusLabel: inboxState.status === "attention" ? "Live now" : "Ready",
        tone: "success",
        summary:
          inboxState.status === "attention"
            ? inboxState.summary ||
              "The launch lane is clear and the inbox already has live work waiting."
            : inboxState.summary || "The launch lane is clear and the inbox is ready.",
        detail: inboxState.detail || "Open inbox to operate live work.",
        action: inboxAction,
        complete: true,
      })
    : buildLaunchLaneStep({
        id: "live",
        label: "Go live in inbox",
        status: "blocked",
        statusLabel:
          !launchChannel.connected
            ? "Waiting on channel"
            : !setupReady
              ? "Waiting on setup"
              : !approvalReady
                ? "Waiting on approval"
                : "Signal limited",
        tone:
          launchChannel.connected && setupReady && approvalReady
            ? "info"
            : "danger",
        summary:
          !launchChannel.connected
            ? "Inbox should wait until the launch channel is connected."
            : !setupReady
              ? "Inbox is not the next move until the setup draft is structured."
              : !approvalReady
                ? "Do not treat inbox as live until truth and runtime are aligned."
                : "Inbox telemetry is limited, so live posture should be treated cautiously.",
        detail:
          inboxState.detail ||
          truthRuntime.detail ||
          "Open inbox or truth to inspect the current launch posture.",
        action:
          !launchChannel.connected
            ? channelAction
            : !setupReady
              ? setupAction
              : !approvalReady
                ? truthAction
                : inboxAction,
        complete: false,
      });

  const launchSteps = [channelStep, setupStep, approvalStep, liveStep];

  let launchPhaseLabel = "Go live in inbox";
  let launchHeadline = "Go live in inbox.";
  let launchSummary =
    inboxState.summary || "The launch lane is clear and the inbox is ready.";
  let primaryAction = inboxAction;
  let secondaryAction = truthAction;

  if (!launchChannel.connected) {
    launchPhaseLabel = "Connect launch channel";
    launchHeadline = `Connect ${launchChannel.channelLabel || "the launch channel"}.`;
    launchSummary =
      launchChannel.summary ||
      "The launch lane stays blocked until the live channel is attached.";
    primaryAction = channelAction;
    secondaryAction = setupFlow.hasDraft ? setupAction : null;
  } else if (!setupReady) {
    launchPhaseLabel = "Create or continue setup draft";
    launchHeadline = setupFlow.hasDraft
      ? "Continue the setup draft."
      : "Create the setup draft.";
    launchSummary = setupFlow.hasDraft
      ? "The launch channel is connected. Finish the structured draft before truth approval and runtime."
      : "The launch channel is connected. Start the structured draft before truth approval and runtime.";
    primaryAction = setupAction;
    secondaryAction = channelAction;
  } else if (!approvalReady) {
    launchPhaseLabel = "Approve truth and runtime";
    launchHeadline = truthRuntime.truthReady
      ? "Repair runtime before going live."
      : "Approve truth before going live.";
    launchSummary =
      truthRuntime.summary ||
      (truthRuntime.truthReady
        ? "Approved truth exists, but runtime still needs repair before live inbox."
        : "The draft is ready, but approved truth still needs review before live inbox.");
    primaryAction = truthAction;
    secondaryAction = setupAction;
  } else if (!liveSignalReady) {
    launchPhaseLabel = "Go live in inbox";
    launchHeadline = "Check live inbox posture.";
    launchSummary =
      "Channel, setup, truth, and runtime are aligned, but live inbox signal is limited right now.";
    primaryAction = inboxAction;
    secondaryAction = truthAction;
  } else {
    launchPhaseLabel = "Go live in inbox";
    launchHeadline =
      inboxState.status === "attention"
        ? "Operate live from inbox."
        : "Go live in inbox.";
    launchSummary =
      inboxState.summary ||
      "The launch lane is clear and the inbox is ready for live operation.";
    primaryAction = inboxAction;
    secondaryAction = truthAction;
  }

  if (primaryAction?.path && secondaryAction?.path && primaryAction.path === secondaryAction.path) {
    secondaryAction = null;
  }

  return {
    launchPhaseLabel,
    launchHeadline,
    launchSummary,
    primaryAction,
    secondaryAction,
    launchSteps,
    launchReady,
  };
}

const DEFAULT_PRODUCT_HOME_PAYLOADS = {
  setup: null,
  trust: null,
  inboxThreads: null,
  inboxOutbound: null,
  metaStatus: null,
  telegramStatus: null,
  websiteStatus: null,
  setupAssistantSession: null,
};

const DEFAULT_PRODUCT_HOME_SOURCE_STATUS = {
  setup: { available: true },
  trust: { available: true },
  inboxThreads: { available: true },
  inboxOutbound: { available: true },
  metaStatus: { available: true },
  telegramStatus: { available: true },
  websiteStatus: { available: true },
  setupAssistantSession: { available: true },
};

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

  const payloads = useMemo(
    () => state.data?.payloads ?? DEFAULT_PRODUCT_HOME_PAYLOADS,
    [state.data?.payloads]
  );

  const sourceStatus = useMemo(
    () => state.data?.sourceStatus ?? DEFAULT_PRODUCT_HOME_SOURCE_STATUS,
    [state.data?.sourceStatus]
  );

  const derived = useMemo(() => {
    const inboxState = buildInboxState({
      threadsPayload: payloads.inboxThreads,
      outboundPayload: payloads.inboxOutbound,
      sourceStatus,
    });

    const launchChannel = resolveCanonicalLaunchChannel({
      metaPayload: payloads.metaStatus,
      telegramPayload: payloads.telegramStatus,
      websitePayload: payloads.websiteStatus,
      sourceStatus,
    });

    const truthRuntime = buildTruthRuntimeState({
      trustPayload: payloads.trust,
      launchChannel,
      sourceStatus,
    });

    const setupFlow = buildSetupFlowState({
      launchChannel,
      truthRuntime,
      setupAssistantSession: payloads.setupAssistantSession,
    });

    const launchLane = buildLaunchLaneModel({
      launchChannel,
      truthRuntime,
      setupFlow,
      inboxState,
    });

    const availabilityNote = buildAvailabilityNote({
      sourceStatus,
      inboxState,
      launchChannel,
      truthRuntime,
    });

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
          ? `Connect ${launchChannel.channelLabel || "the launch channel"} first.`
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
      session: setupFlow.session,
      draft: setupFlow.draft,
      review: setupFlow.review,
      websitePrefill: setupFlow.websitePrefill,
      assistant: setupFlow.assistantState,
      launchChannel,
      truthRuntime,
    };

    return {
      launchChannel,
      truthRuntime,
      assistant,
      availabilityNote,
      launchPhaseLabel: launchLane.launchPhaseLabel,
      launchHeadline: launchLane.launchHeadline,
      launchSummary: launchLane.launchSummary,
      primaryAction: launchLane.primaryAction,
      secondaryAction: launchLane.secondaryAction,
      launchSteps: launchLane.launchSteps,
      launchReady: launchLane.launchReady,
    };
  }, [payloads, sourceStatus]);

  return {
    loading: enabled ? state.isLoading : false,
    isFetching: enabled ? state.isFetching : false,
    refetch: state.refetch,
    ...derived,
  };
}

export default useProductHome;
