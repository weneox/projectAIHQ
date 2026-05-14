import { getMetaStatus } from "../../routes/api/channelConnect/meta.js";
import { getTelegramStatus } from "../../routes/api/channelConnect/telegram.js";
import { getWebsiteWidgetStatus } from "../../routes/api/channelConnect/website.js";
import {
  getInboxPressureSummary,
} from "../../modules/inbox/repository/index.js";
import { pickWorkspaceActor } from "../../routes/api/workspace/shared.js";
import {
  getTenantBrainRuntime,
  isRuntimeAuthorityError,
} from "../businessBrain/getTenantBrainRuntime.js";
import { loadSetupTruthPayloadWithStatus } from "../workspace/setup/readApp.js";

const VERSION = "launch_posture_v1";
const SCOPE = {
  id: "aihq_launch_v1_narrow",
  surfaces: [
    "home",
    "channels",
    "truth",
    "inbox",
    "website_chat",
    "instagram_dm",
    "telegram_private_bot_chat",
  ],
};

const CHANNEL_ORDER = ["website", "instagram", "telegram"];
const ACTIONS = {
  setup: { label: "Open setup", path: "/home?assistant=setup" },
  channels: { label: "Open channels", path: "/channels" },
  inbox: { label: "Open inbox", path: "/inbox" },
};

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function n(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function lower(value) {
  return s(value).toLowerCase();
}

function cleanNullable(value) {
  const text = s(value);
  return text || null;
}

function normalizeAction(rawAction = {}, fallback = ACTIONS.channels) {
  const action = obj(rawAction);
  const target = obj(action.target || action.nextAction?.target);
  const label = s(action.label || fallback.label);
  const path = s(action.path || target.path || fallback.path);

  return {
    label,
    path,
  };
}

function blockerAction(blocker = {}, fallback = ACTIONS.channels) {
  const nextAction = obj(blocker.nextAction || blocker.next_action);
  return normalizeAction(nextAction, fallback);
}

function normalizeBlocker(surface, blocker = {}, fallback = ACTIONS.channels) {
  const row = obj(blocker);
  const reasonCode = s(row.reasonCode || row.reason_code || row.code);
  const title = s(row.title || "Launch posture blocker");
  const message = s(row.message || row.subtitle || row.description || title);
  const nextAction = blockerAction(row, fallback);

  return {
    id: `${surface}:${reasonCode || title}`,
    surface,
    reasonCode,
    title,
    message,
    nextAction,
  };
}

function normalizeBlockers(surface, blockers = [], fallback = ACTIONS.channels) {
  return arr(blockers)
    .map((blocker) => normalizeBlocker(surface, blocker, fallback))
    .filter((blocker) => blocker.title || blocker.reasonCode);
}

function syntheticBlocker({
  surface,
  reasonCode,
  title,
  message,
  action = ACTIONS.channels,
}) {
  return normalizeBlocker(
    surface,
    {
      reasonCode,
      title,
      message,
      nextAction: action,
    },
    action
  );
}

function dedupeBy(items = [], keyFn) {
  const seen = new Set();
  const output = [];

  for (const item of arr(items)) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}

function buildRepairActions(blockers = []) {
  return dedupeBy(
    arr(blockers)
      .map((blocker) => obj(blocker.nextAction))
      .filter((action) => s(action.label) && s(action.path)),
    (action) => `${action.label}:${action.path}`
  );
}

function buildUnavailableEntry(surface, reasonCode, message) {
  return {
    surface,
    reasonCode: s(reasonCode || `${surface}_unavailable`),
    message: s(message || `${surface} posture is unavailable.`),
  };
}

function buildReadiness({ status, reasonCode, message, blockers = [] }) {
  return {
    status,
    reasonCode: s(reasonCode),
    message: s(message),
    blockers,
  };
}

function latestTruthVersionId(truth = {}) {
  const history = arr(truth.history);
  const firstWithId = history.find((item) => s(item?.id));

  return s(
    truth.latestVersionId ||
      truth.latest_version_id ||
      truth.currentVersionId ||
      truth.current_version_id ||
      firstWithId?.id
  );
}

async function loadTruthPosture({ db, actor, deps }) {
  try {
    const payload = await deps.loadTruth({ db, actor });
    const truth = obj(payload?.truth);
    const readiness = obj(truth.readiness);
    const blockers = normalizeBlockers(
      "truth",
      readiness.blockers,
      ACTIONS.setup
    );
    const ready =
      lower(readiness.status) === "ready" &&
      readiness.blocked !== true &&
      blockers.length === 0;
    const reasonCode = ready
      ? ""
      : s(
          readiness.reasonCode ||
            readiness.reason_code ||
            blockers[0]?.reasonCode ||
            "approved_truth_unavailable"
        );

    return {
      payload: {
        ready,
        status: ready ? "ready" : "blocked",
        reasonCode,
        message: ready
          ? "Approved business info is available."
          : s(
              readiness.message,
              "Approved business info is unavailable."
            ),
        latestVersionId: latestTruthVersionId(truth),
      },
      blockers,
      unavailable: [],
    };
  } catch (err) {
    const blocker = syntheticBlocker({
      surface: "truth",
      reasonCode: "approved_truth_unavailable",
      title: "Approved business info unavailable",
      message: s(err?.message, "Approved business info could not be loaded."),
      action: ACTIONS.setup,
    });

    return {
      payload: {
        ready: false,
        status: "unavailable",
        reasonCode: blocker.reasonCode,
        message: blocker.message,
        latestVersionId: "",
      },
      blockers: [blocker],
      unavailable: [
        buildUnavailableEntry("truth", blocker.reasonCode, blocker.message),
      ],
    };
  }
}

async function loadRuntimePosture({ db, actor, deps }) {
  try {
    const runtime = await deps.getRuntime({
      db,
      tenantId: actor.tenantId,
      tenantKey: actor.tenantKey,
      authorityMode: "strict",
      channel: "launch_posture",
    });
    const authority = obj(runtime?.authority);
    const ready = authority.available === true;
    const reasonCode = ready
      ? ""
      : s(authority.reasonCode || "runtime_authority_unavailable");
    const blocker = ready
      ? null
      : syntheticBlocker({
          surface: "runtime",
          reasonCode,
          title: "Runtime authority unavailable",
          message: "Approved runtime authority is not ready for launch.",
          action: ACTIONS.setup,
        });

    return {
      payload: {
        ready,
        status: ready ? "ready" : "blocked",
        reasonCode,
        message: ready
          ? "Approved runtime authority is available."
          : "Approved runtime authority is not ready for launch.",
      },
      blockers: blocker ? [blocker] : [],
      unavailable: [],
    };
  } catch (err) {
    const authority = obj(err?.runtimeAuthority || err?.authority);
    const expectedAuthorityFailure = deps.isRuntimeAuthorityError(err);
    const reasonCode = s(
      authority.reasonCode ||
        err?.reasonCode ||
        (expectedAuthorityFailure
          ? "runtime_authority_unavailable"
          : "runtime_unavailable")
    );
    const message = expectedAuthorityFailure
      ? s(err?.message, "Approved runtime authority is not ready for launch.")
      : s(err?.message, "Approved runtime authority could not be loaded.");
    const blocker = syntheticBlocker({
      surface: "runtime",
      reasonCode,
      title: "Runtime authority unavailable",
      message,
      action: ACTIONS.setup,
    });

    return {
      payload: {
        ready: false,
        status: expectedAuthorityFailure ? "blocked" : "unavailable",
        reasonCode,
        message,
      },
      blockers: [blocker],
      unavailable: expectedAuthorityFailure
        ? []
        : [buildUnavailableEntry("runtime", reasonCode, message)],
    };
  }
}

function unavailableChannel(id, label, kind, err) {
  const reasonCode = s(err?.reasonCode || err?.code || `${id}_status_unavailable`);
  const message = `${label} posture could not be loaded.`;
  const blocker = syntheticBlocker({
    surface: id,
    reasonCode,
    title: `${label} unavailable`,
    message,
    action: ACTIONS.channels,
  });

  return {
    id,
    label,
    kind,
    status: "unavailable",
    connected: false,
    deliveryReady: false,
    available: false,
    reasonCode,
    account: null,
    readiness: buildReadiness({
      status: "unavailable",
      reasonCode,
      message,
      blockers: [blocker],
    }),
    blockers: [blocker],
    repairActions: buildRepairActions([blocker]),
    capabilities: [kind],
  };
}

function finalizeChannel({
  id,
  label,
  kind,
  status,
  connected,
  deliveryReady,
  available = true,
  reasonCode = "",
  account = null,
  message = "",
  blockers = [],
}) {
  const normalizedBlockers = arr(blockers);

  return {
    id,
    label,
    kind,
    status,
    connected: Boolean(connected),
    deliveryReady: Boolean(deliveryReady),
    available: Boolean(available),
    reasonCode: s(reasonCode),
    account: account || null,
    readiness: buildReadiness({
      status: deliveryReady ? "ready" : normalizedBlockers.length ? "blocked" : status,
      reasonCode,
      message,
      blockers: normalizedBlockers,
    }),
    blockers: normalizedBlockers,
    repairActions: buildRepairActions(normalizedBlockers),
    capabilities: [kind],
  };
}

function normalizeWebsiteChannel(payload = {}) {
  const launch = obj(payload.launchReadiness);
  const readiness = obj(payload.readiness);
  const deliveryReady =
    payload.state === "connected" &&
    launch.productionLaunchAllowed === true &&
    launch.testingOnly !== true;
  const connected =
    deliveryReady ||
    launch.channelConfigured === true ||
    launch.widgetEnabled === true;
  const testingOnly = launch.testingOnly === true;
  const blockers = normalizeBlockers(
    "website",
    arr(launch.blockers).length ? launch.blockers : readiness.blockers,
    ACTIONS.channels
  );
  const reasonCode = deliveryReady
    ? ""
    : s(
        launch.reasonCode ||
          readiness.reasonCode ||
          readiness.reason_code ||
          blockers[0]?.reasonCode ||
          (testingOnly ? "website_testing_only" : "website_not_ready")
      );
  const status = deliveryReady
    ? "ready"
    : testingOnly
      ? "testing_only"
      : connected
        ? "connected_blocked"
        : "needs_connection";

  return finalizeChannel({
    id: "website",
    label: "Website chat",
    kind: "website_chat",
    status,
    connected,
    deliveryReady,
    reasonCode,
    account: {
      displayName: "Website chat",
      targetDomain: cleanNullable(launch.targetDomain),
      publicWidgetId: cleanNullable(launch.publicWidgetId),
    },
    message: deliveryReady
      ? "Website chat is ready for production delivery."
      : testingOnly
        ? "Website chat is available for test handoff only and is not ready for production delivery."
        : "Website chat is not ready for production delivery.",
    blockers,
  });
}

function normalizeInstagramChannel(payload = {}) {
  const runtime = obj(payload.runtime);
  const readiness = obj(payload.readiness);
  const connected = payload.connected === true || payload.state === "connected";
  const deliveryReady = connected && runtime.deliveryReady === true;
  const blockers = normalizeBlockers(
    "instagram",
    readiness.blockers,
    ACTIONS.channels
  );
  const reasonCode = deliveryReady
    ? ""
    : s(
        payload.reasonCode ||
          runtime.reasonCode ||
          readiness.reasonCode ||
          blockers[0]?.reasonCode ||
          "instagram_dm_not_ready"
      );
  const account = obj(payload.account);

  return finalizeChannel({
    id: "instagram",
    label: "Instagram DM",
    kind: "instagram_dm",
    status: deliveryReady
      ? "ready"
      : connected
        ? "connected_blocked"
        : "needs_connection",
    connected,
    deliveryReady,
    reasonCode,
    account: {
      displayName: cleanNullable(account.displayName || account.pageName),
      pageName: cleanNullable(account.pageName),
      username: cleanNullable(account.username),
      pageId: cleanNullable(account.pageId),
      igUserId: cleanNullable(account.igUserId),
    },
    message: deliveryReady
      ? "Instagram DM is ready for live delivery."
      : "Instagram DM is not ready for live delivery.",
    blockers,
  });
}

function normalizeTelegramChannel(payload = {}) {
  const runtime = obj(payload.runtime);
  const readiness = obj(payload.readiness);
  const connected = payload.connected === true || payload.state === "connected";
  const deliveryReady = connected && runtime.deliveryReady === true;
  const blockers = normalizeBlockers(
    "telegram",
    readiness.blockers,
    ACTIONS.channels
  );
  const reasonCode = deliveryReady
    ? ""
    : s(
        payload.reasonCode ||
          runtime.reasonCode ||
          readiness.reasonCode ||
          blockers[0]?.reasonCode ||
          "telegram_private_bot_chat_not_ready"
      );
  const account = obj(payload.account);

  return finalizeChannel({
    id: "telegram",
    label: "Telegram private bot chat",
    kind: "telegram_private_bot_chat",
    status: deliveryReady
      ? "ready"
      : connected
        ? "connected_blocked"
        : "needs_connection",
    connected,
    deliveryReady,
    reasonCode,
    account: {
      displayName: cleanNullable(account.displayName),
      botUsername: cleanNullable(account.botUsername),
      botUserId: cleanNullable(account.botUserId),
    },
    message: deliveryReady
      ? "Telegram private bot chat is ready for live delivery."
      : "Telegram private bot chat is not ready for live delivery.",
    blockers,
  });
}

async function loadChannel({ id, label, kind, load, normalize }) {
  try {
    return normalize(await load());
  } catch (err) {
    return unavailableChannel(id, label, kind, err);
  }
}

async function loadChannels({ db, req, deps }) {
  const [website, instagram, telegram] = await Promise.all([
    loadChannel({
      id: "website",
      label: "Website chat",
      kind: "website_chat",
      load: () => deps.getWebsiteStatus({ db, req }),
      normalize: normalizeWebsiteChannel,
    }),
    loadChannel({
      id: "instagram",
      label: "Instagram DM",
      kind: "instagram_dm",
      load: () => deps.getInstagramStatus({ db, req }),
      normalize: normalizeInstagramChannel,
    }),
    loadChannel({
      id: "telegram",
      label: "Telegram private bot chat",
      kind: "telegram_private_bot_chat",
      load: () => deps.getTelegramStatus({ db, req }),
      normalize: normalizeTelegramChannel,
    }),
  ]);

  return { website, instagram, telegram };
}

async function loadInboxPosture({ db, actor, deps }) {
  const empty = {
    available: false,
    unreadCount: 0,
    openCount: 0,
    handoffCount: 0,
    assignedOpenCount: 0,
    pendingOutboundCount: 0,
    failedOutboundCount: 0,
    retryingOutboundCount: 0,
  };

  try {
    const summary = await deps.getInboxPressureSummary(db, actor.tenantKey);
    return {
      payload: {
        available: true,
        unreadCount: n(summary.unreadCount),
        openCount: n(summary.openCount),
        handoffCount: n(summary.handoffCount),
        assignedOpenCount: n(summary.assignedOpenCount),
        pendingOutboundCount: n(summary.pendingOutboundCount),
        failedOutboundCount: n(summary.failedOutboundCount),
        retryingOutboundCount: n(summary.retryingOutboundCount),
      },
      blockers: [],
      unavailable: [],
    };
  } catch (err) {
    const blocker = syntheticBlocker({
      surface: "inbox",
      reasonCode: "inbox_pressure_unavailable",
      title: "Inbox pressure unavailable",
      message: s(err?.message, "Inbox pressure could not be loaded."),
      action: ACTIONS.inbox,
    });

    return {
      payload: empty,
      blockers: [blocker],
      unavailable: [
        buildUnavailableEntry("inbox", blocker.reasonCode, blocker.message),
      ],
    };
  }
}

function buildChannelSummary(channels = {}) {
  const deliveryReadyChannelIds = CHANNEL_ORDER.filter(
    (id) => channels[id]?.deliveryReady === true
  );
  const connectedCount = CHANNEL_ORDER.filter(
    (id) => channels[id]?.connected === true
  ).length;

  return {
    readyCount: deliveryReadyChannelIds.length,
    connectedCount,
    deliveryReadyChannelIds,
    selectedChannelId: deliveryReadyChannelIds[0] || "",
  };
}

function inboxHasPressure(inbox = {}) {
  return (
    n(inbox.unreadCount) > 0 ||
    n(inbox.openCount) > 0 ||
    n(inbox.handoffCount) > 0 ||
    n(inbox.assignedOpenCount) > 0 ||
    n(inbox.pendingOutboundCount) > 0 ||
    n(inbox.failedOutboundCount) > 0 ||
    n(inbox.retryingOutboundCount) > 0
  );
}

function chooseOverall({
  truth,
  runtime,
  channelSummary,
  inbox,
  blockers,
  unavailable,
}) {
  const channelReady = channelSummary.readyCount > 0;
  const launchReady =
    truth.ready === true &&
    runtime.ready === true &&
    channelReady &&
    inbox.available === true;
  const firstBlocker = arr(blockers)[0] || null;

  if (!launchReady) {
    const status = arr(unavailable).length ? "unavailable" : "blocked";
    const primaryAction = firstBlocker?.nextAction || ACTIONS.setup;

    if (truth.ready !== true) {
      return {
        status,
        launchReady: false,
        title: "Business info needs approval",
        message: "Approve business info before launch posture can turn ready.",
        primaryAction,
        secondaryAction: ACTIONS.channels,
      };
    }

    if (runtime.ready !== true) {
      return {
        status,
        launchReady: false,
        title: "Runtime authority is not ready",
        message: "Approved runtime authority must be ready before launch.",
        primaryAction,
        secondaryAction: ACTIONS.channels,
      };
    }

    if (!channelReady) {
      return {
        status,
        launchReady: false,
        title: "Connect a launch channel",
        message:
          "Website chat, Instagram DM, or Telegram private bot chat must be delivery ready before launch.",
        primaryAction,
        secondaryAction: ACTIONS.setup,
      };
    }

    return {
      status,
      launchReady: false,
      title: "Inbox posture unavailable",
      message: "Inbox pressure must be available before launch.",
      primaryAction,
      secondaryAction: ACTIONS.channels,
    };
  }

  if (inboxHasPressure(inbox)) {
    return {
      status: "attention",
      launchReady: true,
      title: "Launch ready with inbox attention",
      message: "Launch prerequisites are ready and the inbox needs attention.",
      primaryAction: ACTIONS.inbox,
      secondaryAction: ACTIONS.channels,
    };
  }

  if (arr(unavailable).length) {
    return {
      status: "degraded",
      launchReady: true,
      title: "Launch ready with degraded posture",
      message: "Launch prerequisites are ready, with at least one non-selected launch channel unavailable.",
      primaryAction: ACTIONS.inbox,
      secondaryAction: ACTIONS.channels,
    };
  }

  return {
    status: "ready",
    launchReady: true,
    title: "Launch posture ready",
    message: "Approved business info, runtime, channel delivery, and inbox are ready.",
    primaryAction: ACTIONS.inbox,
    secondaryAction: ACTIONS.channels,
  };
}

function buildDeps(deps = {}) {
  return {
    loadTruth: deps.loadTruth || loadSetupTruthPayloadWithStatus,
    getRuntime: deps.getRuntime || getTenantBrainRuntime,
    isRuntimeAuthorityError: deps.isRuntimeAuthorityError || isRuntimeAuthorityError,
    getWebsiteStatus: deps.getWebsiteStatus || getWebsiteWidgetStatus,
    getInstagramStatus: deps.getInstagramStatus || getMetaStatus,
    getTelegramStatus: deps.getTelegramStatus || getTelegramStatus,
    getInboxPressureSummary:
      deps.getInboxPressureSummary || getInboxPressureSummary,
    pickActor: deps.pickActor || pickWorkspaceActor,
    now: deps.now || (() => new Date()),
  };
}

export async function buildLaunchPosture({ db, req } = {}, depsInput = {}) {
  const deps = buildDeps(depsInput);
  const actor = deps.pickActor(req || {});
  const generatedAt = deps.now().toISOString();

  const [truthResult, runtimeResult, channels, inboxResult] =
    await Promise.all([
      loadTruthPosture({ db, actor, deps }),
      loadRuntimePosture({ db, actor, deps }),
      loadChannels({ db, req, deps }),
      loadInboxPosture({ db, actor, deps }),
    ]);

  const channelSummary = buildChannelSummary(channels);
  const channelBlockers = CHANNEL_ORDER.flatMap((id) => channels[id].blockers);
  const channelUnavailable = CHANNEL_ORDER.filter(
    (id) => channels[id].available !== true
  ).map((id) =>
    buildUnavailableEntry(
      id,
      channels[id].reasonCode,
      `${channels[id].label} posture is unavailable.`
    )
  );
  const blockers = [
    ...truthResult.blockers,
    ...runtimeResult.blockers,
    ...(channelSummary.readyCount === 0
      ? [
          syntheticBlocker({
            surface: "channels",
            reasonCode: "launch_channel_delivery_unavailable",
            title: "No launch channel is delivery ready",
            message:
              "Website chat, Instagram DM, or Telegram private bot chat must be delivery ready.",
            action: ACTIONS.channels,
          }),
        ]
      : []),
    ...(channelSummary.readyCount === 0 ? channelBlockers : []),
    ...inboxResult.blockers,
  ];
  const unavailable = dedupeBy(
    [
      ...truthResult.unavailable,
      ...runtimeResult.unavailable,
      ...channelUnavailable,
      ...inboxResult.unavailable,
    ],
    (item) => `${item.surface}:${item.reasonCode}`
  );
  const dedupedBlockers = dedupeBy(
    blockers,
    (blocker) => `${blocker.surface}:${blocker.reasonCode}:${blocker.title}`
  );
  const overall = chooseOverall({
    truth: truthResult.payload,
    runtime: runtimeResult.payload,
    channelSummary,
    inbox: inboxResult.payload,
    blockers: dedupedBlockers,
    unavailable,
  });

  return {
    ok: true,
    version: VERSION,
    generatedAt,
    tenant: {
      id: s(actor?.tenantId),
      tenantKey: s(actor?.tenantKey),
    },
    scope: SCOPE,
    overall,
    truth: truthResult.payload,
    runtime: runtimeResult.payload,
    channels,
    channelSummary,
    inbox: inboxResult.payload,
    blockers: dedupedBlockers,
    repairActions: buildRepairActions(dedupedBlockers),
    unavailable,
  };
}

export const __test__ = {
  SCOPE,
  normalizeWebsiteChannel,
  normalizeInstagramChannel,
  normalizeTelegramChannel,
  buildChannelSummary,
};
