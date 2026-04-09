import {
  validateOperationalRepairAction,
  validateReadinessSurface,
} from "@aihq/shared-contracts/operations";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function firstText(...values) {
  for (const value of values) {
    const next = s(value);
    if (next) return next;
  }
  return "";
}

function hasKeys(value) {
  return Object.keys(obj(value)).length > 0;
}

function isConnectedChannel(value = null) {
  return obj(value).connected === true;
}

function isDeliveryReadyChannel(value = null) {
  const channel = obj(value);
  return channel.connected === true && channel.deliveryReady === true;
}

function normalizeLaunchChannels(values = []) {
  return arr(values)
    .map((item) => obj(item))
    .filter((item) => hasKeys(item));
}

export function normalizeOperationalAction(value = {}, fallback = null) {
  const action = {
    ...obj(fallback),
    ...obj(value),
  };

  if (!Object.keys(action).length) {
    return {
      id: "",
      kind: "focus",
      label: "Review blocker",
      requiredRole: "operator",
      allowed: false,
      path: "",
      target: {},
    };
  }

  const checked = validateOperationalRepairAction(action);
  const safeValue = checked.ok ? checked.value : action;
  const target = obj(safeValue.target);

  return {
    id: s(safeValue.id),
    kind: lower(safeValue.kind || "focus"),
    label: s(safeValue.label || "Review blocker"),
    requiredRole: lower(
      safeValue.requiredRole || safeValue.required_role || "operator"
    ),
    allowed:
      typeof safeValue.allowed === "boolean" ? safeValue.allowed : true,
    path: s(safeValue.path || target.path),
    target,
  };
}

function normalizeBlocker(value = {}) {
  const item = obj(value);
  const action = normalizeOperationalAction(
    item.nextAction || item.action || item.repairAction
  );

  return {
    blocked:
      typeof item.blocked === "boolean"
        ? item.blocked
        : s(item.reasonCode || item.reason_code) !== "",
    category: lower(item.category),
    dependencyType: lower(item.dependencyType || item.dependency_type),
    title: s(item.title || item.label || "Operational blocker"),
    subtitle: s(item.subtitle || item.message || item.explanation),
    reasonCode: lower(item.reasonCode || item.reason_code),
    missing: arr(item.missing || item.missingDependencies || item.dependencies)
      .map((entry) => s(entry))
      .filter(Boolean),
    suggestedRepairActionId: s(
      item.suggestedRepairActionId ||
        item.suggested_repair_action_id ||
        action.id
    ),
    nextAction: action,
    action,
    repairAction: action,
  };
}

export function createReadinessViewModel(readiness = {}, blockersOverride) {
  const source = obj(readiness);
  const contractInput =
    blockersOverride === undefined
      ? source
      : {
          ...source,
          blockers: arr(blockersOverride),
        };

  const checked = validateReadinessSurface(contractInput);
  const safeValue = checked.ok
    ? checked.value
    : {
        status: lower(source.status || "ready"),
        intentionallyUnavailable: source.intentionallyUnavailable === true,
        reasonCode: lower(source.reasonCode || source.reason_code),
        message: s(source.message),
        blockers: [],
      };

  const blockers = arr(safeValue.blockers).map((item) => normalizeBlocker(item));
  const blockedItems = blockers.filter((item) => item.blocked);
  const status = lower(
    safeValue.status || (blockedItems.length ? "blocked" : "ready")
  );

  return {
    status,
    blocked:
      source.blocked === true || status === "blocked" || blockedItems.length > 0,
    intentionallyUnavailable: safeValue.intentionallyUnavailable === true,
    reasonCode: lower(safeValue.reasonCode),
    message: s(safeValue.message),
    blockers,
    blockedItems,
    repairActions: arr(source.repairActions)
      .map((item) => normalizeOperationalAction(item))
      .filter((item) => item.id || item.label || item.path),
  };
}

export function pickReadinessAction(readiness = {}, fallbackAction = null) {
  const source = createReadinessViewModel(readiness);

  for (const blocker of source.blockedItems) {
    const nextAction = normalizeOperationalAction(
      blocker.nextAction || blocker.action || blocker.repairAction
    );
    if (nextAction.path) return nextAction;
  }

  for (const action of source.repairActions) {
    const nextAction = normalizeOperationalAction(action);
    if (nextAction.path) return nextAction;
  }

  return normalizeOperationalAction(fallbackAction);
}

export function buildTruthOperationalState(
  trust = null,
  {
    setupPath = "/home?assistant=setup",
    truthPath = "/truth",
  } = {}
) {
  const summary = obj(trust?.summary);
  const truth = obj(summary.truth);
  const runtimeProjection = obj(summary.runtimeProjection);
  const runtimeHealth = obj(runtimeProjection.health);
  const runtimeAuthority = obj(runtimeProjection.authority);

  const truthReadiness = createReadinessViewModel(truth.readiness);
  const runtimeReadiness = createReadinessViewModel(runtimeProjection.readiness);

  const truthVersionId = s(truth.latestVersionId);
  const truthReady = truthReadiness.status === "ready" && Boolean(truthVersionId);
  const runtimeReady =
    runtimeReadiness.status === "ready" &&
    (runtimeHealth.usable === true ||
      runtimeHealth.autonomousAllowed === true ||
      runtimeAuthority.available === true);

  if (!truthReady) {
    return {
      truthReady: false,
      runtimeReady: false,
      truthVersionId,
      status: "blocked",
      statusLabel: "Approval required",
      title: "Business truth still needs approval.",
      summary:
        truthReadiness.message ||
        "Approved business truth is not ready yet.",
      detail:
        truthReadiness.blockedItems
          .map((item) => firstText(item.subtitle, item.title))
          .filter(Boolean)[0] || "No approved truth snapshot is visible yet.",
      action: pickReadinessAction(truth.readiness, {
        label: "Continue AI setup",
        path: setupPath,
      }),
      reasonCode: truthReadiness.reasonCode || "approved_truth_unavailable",
      readiness: truthReadiness,
    };
  }

  if (!runtimeReady) {
    const healthRepairAction = obj(runtimeHealth.repairAction);
    const repairAction =
      (Object.keys(healthRepairAction).length
        ? normalizeOperationalAction(healthRepairAction)
        : null) ||
      arr(runtimeHealth.repairActions)
        .map((item) => normalizeOperationalAction(item))
        .find((item) => item.path) ||
      pickReadinessAction(runtimeProjection.readiness, {
        label: "Open truth",
        path: truthPath,
      });

    return {
      truthReady: true,
      runtimeReady: false,
      truthVersionId,
      status: "attention",
      statusLabel: "Repair required",
      title: "Runtime still needs repair.",
      summary:
        runtimeReadiness.message ||
        s(runtimeHealth.lastFailure?.errorMessage) ||
        "Approved truth exists, but runtime still needs repair.",
      detail:
        firstText(
          runtimeHealth.lastFailure?.errorCode,
          runtimeHealth.reasonCode
        ) ||
        "Review the runtime state and repair path before trusting automation as live.",
      action: repairAction,
      reasonCode:
        runtimeReadiness.reasonCode ||
        lower(runtimeHealth.reasonCode) ||
        "runtime_repair_required",
      readiness: runtimeReadiness,
    };
  }

  return {
    truthReady: true,
    runtimeReady: true,
    truthVersionId,
    status: "ready",
    statusLabel: "Healthy",
    title: "Approved truth and runtime are aligned.",
    summary: "Approved truth and runtime are aligned.",
    detail: truthVersionId
      ? `Truth version ${truthVersionId} is the current approved source of runtime authority.`
      : "Approved truth is available.",
    action: normalizeOperationalAction({
      label: "Open truth",
      path: truthPath,
    }),
    reasonCode: "",
    readiness: runtimeReadiness,
  };
}

export function buildLaunchChannelState(
  payload = {},
  {
    id = "",
    label = "",
    connectPath = "/channels",
    openPath = "/channels",
  } = {}
) {
  const source = obj(payload);
  const connected =
    source.connected === true ||
    ["connected", "active", "ready"].includes(
      lower(source.state || source.status)
    );
  const deliveryReady =
    source.runtime?.deliveryReady === true ||
    lower(source.readiness?.status) === "ready";

  if (!connected) {
    return {
      id: lower(id || label),
      label: s(label),
      connected: false,
      deliveryReady: false,
      status: "blocked",
      statusLabel: "Connect required",
      summary:
        s(source.readiness?.message) ||
        `${s(label || "Channel")} is not connected yet.`,
      action: normalizeOperationalAction({
        label: `Connect ${s(label || "channel")}`,
        path: connectPath,
      }),
    };
  }

  if (!deliveryReady) {
    return {
      id: lower(id || label),
      label: s(label),
      connected: true,
      deliveryReady: false,
      status: "attention",
      statusLabel: "Delivery blocked",
      summary:
        s(source.readiness?.message) ||
        `${s(label || "Channel")} is connected, but delivery is still blocked.`,
      action: normalizeOperationalAction({
        label: `Open ${s(label || "channel")}`,
        path: openPath,
      }),
    };
  }

  return {
    id: lower(id || label),
    label: s(label),
    connected: true,
    deliveryReady: true,
    status: "ready",
    statusLabel: "Connected",
    summary:
      s(source.readiness?.message) ||
      `${s(label || "Channel")} is connected and usable for the launch path.`,
    action: normalizeOperationalAction({
      label: `Open ${s(label || "channel")}`,
      path: openPath,
    }),
  };
}

export function buildMetaLaunchChannelState(payload = {}) {
  return buildLaunchChannelState(payload, {
    id: "meta",
    label: "Meta",
    connectPath: "/channels?channel=instagram",
    openPath: "/channels?channel=instagram",
  });
}

export function buildTelegramLaunchChannelState(payload = {}) {
  return buildLaunchChannelState(payload, {
    id: "telegram",
    label: "Telegram",
    connectPath: "/channels?channel=telegram",
    openPath: "/channels?channel=telegram",
  });
}

export function buildWebsiteLaunchChannelState(payload = {}) {
  const source = obj(payload);
  const widget = obj(source.widget);

  return buildLaunchChannelState(
    {
      ...source,
      connected:
        source.connected === true ||
        widget.enabled === true ||
        lower(source.state) === "connected",
    },
    {
      id: "website",
      label: "Website chat",
      connectPath: "/channels?channel=website",
      openPath: "/channels?channel=website",
    }
  );
}

export function buildVoiceSettingsOperationalState(settings = null, surface = {}) {
  const value = obj(settings);
  const enabled = value.enabled === true;
  const phoneNumber = firstText(
    value.twilioPhoneNumber,
    value.phoneNumber,
    value.callerId,
    value.twilioCallerId
  );
  const provider = lower(value.provider || "twilio");

  if (surface?.unavailable) {
    return {
      ready: false,
      status: "unavailable",
      statusLabel: "Unavailable",
      summary:
        "Voice operations are temporarily unavailable, so launch posture cannot be confirmed here.",
      action: normalizeOperationalAction({
        label: "Refresh voice",
        path: "/voice",
      }),
    };
  }

  if (!Object.keys(value).length) {
    return {
      ready: false,
      status: "attention",
      statusLabel: "Settings unavailable",
      summary:
        "Voice settings could not be loaded, so this page cannot confirm whether the receptionist is launch-ready.",
      action: normalizeOperationalAction({
        label: "Refresh voice",
        path: "/voice",
      }),
    };
  }

  if (!enabled) {
    return {
      ready: false,
      status: "blocked",
      statusLabel: "Voice disabled",
      summary:
        "Voice settings exist, but the receptionist is currently turned off.",
      action: normalizeOperationalAction({
        label: "Review voice settings",
        path: "/voice",
      }),
    };
  }

  if (!phoneNumber) {
    return {
      ready: false,
      status: "blocked",
      statusLabel: "Number required",
      summary:
        "Voice is enabled, but the phone number or caller identity is still missing.",
      action: normalizeOperationalAction({
        label: "Review voice settings",
        path: "/voice",
      }),
    };
  }

  if (provider && provider !== "twilio") {
    return {
      ready: false,
      status: "attention",
      statusLabel: "Provider review",
      summary:
        "Voice settings exist, but the provider posture still needs review before launch.",
      action: normalizeOperationalAction({
        label: "Review voice settings",
        path: "/voice",
      }),
    };
  }

  return {
    ready: true,
    status: "ready",
    statusLabel: "Configured",
    summary: "Voice settings are enabled and a phone identity is present.",
    action: normalizeOperationalAction({
      label: "Review voice settings",
      path: "/voice",
    }),
  };
}

function resolveCopy(copy = {}, key = "", fallback = "", context = {}) {
  const value = copy?.[key];
  if (typeof value === "function") return s(value(context), fallback);
  return s(value, fallback);
}

export function buildChannelTruthLaunchReadiness({
  channels = [],
  truthState = {},
  surface = {},
  copy = {},
} = {}) {
  const safeChannels = normalizeLaunchChannels(channels);
  const truth = obj(truthState);
  const surfaceUnavailable = surface?.unavailable === true;

  if (surfaceUnavailable) {
    return {
      status: "unavailable",
      statusLabel: resolveCopy(copy, "unavailableStatusLabel", "Unavailable"),
      title: resolveCopy(
        copy,
        "unavailableTitle",
        "Surface operations are temporarily unavailable."
      ),
      summary:
        s(surface.error) ||
        resolveCopy(
          copy,
          "unavailableSummary",
          "The current surface cannot confirm launch posture right now."
        ),
      action: normalizeOperationalAction(
        copy.unavailableAction || {
          label: "Refresh",
          path: copy.defaultPath || "/home",
        }
      ),
      detail: resolveCopy(
        copy,
        "unavailableDetail",
        "This surface stays intentionally cautious when live operational data is unavailable."
      ),
    };
  }

  const deliveryReadyChannel =
    safeChannels.find((item) => isDeliveryReadyChannel(item)) || null;
  const connectedChannel =
    safeChannels.find((item) => isConnectedChannel(item)) || null;
  const fallbackChannel =
    safeChannels.find((item) => s(item?.action?.path)) || safeChannels[0] || null;

  const launchChannel =
    deliveryReadyChannel || connectedChannel || fallbackChannel || null;

  if (!connectedChannel) {
    return {
      status: "blocked",
      statusLabel: resolveCopy(copy, "noChannelStatusLabel", "Connect required"),
      title: resolveCopy(
        copy,
        "noChannelTitle",
        "Connect a launch channel first."
      ),
      summary: resolveCopy(
        copy,
        "noChannelSummary",
        "No launch channel is currently connected."
      ),
      action:
        normalizeOperationalAction(launchChannel?.action).path
          ? normalizeOperationalAction(launchChannel?.action)
          : normalizeOperationalAction(copy.noChannelAction, {
              label: "Open channels",
              path: copy.channelsPath || "/channels",
            }),
      detail: resolveCopy(
        copy,
        "noChannelDetail",
        "The launch path expects at least one connected and delivery-ready channel."
      ),
    };
  }

  if (!deliveryReadyChannel) {
    return {
      status: "attention",
      statusLabel: resolveCopy(
        copy,
        "deliveryBlockedStatusLabel",
        "Delivery blocked"
      ),
      title: resolveCopy(
        copy,
        "deliveryBlockedTitle",
        "A channel is connected, but delivery is still blocked."
      ),
      summary:
        s(connectedChannel?.summary) ||
        resolveCopy(
          copy,
          "deliveryBlockedSummary",
          "Inspect the connected channel and fix delivery blockers before trusting live automation."
        ),
      action:
        normalizeOperationalAction(connectedChannel?.action).path
          ? normalizeOperationalAction(connectedChannel?.action)
          : normalizeOperationalAction({
              label: "Open channels",
              path: copy.channelsPath || "/channels",
            }),
      detail: resolveCopy(
        copy,
        "deliveryBlockedDetail",
        "The launch path expects at least one connected and delivery-ready channel."
      ),
    };
  }

  if (!truth.truthReady || !truth.runtimeReady) {
    return {
      status: s(truth.status || (!truth.truthReady ? "blocked" : "attention")),
      statusLabel: s(
        truth.statusLabel ||
          (!truth.truthReady ? "Approval required" : "Repair required")
      ),
      title: !truth.truthReady
        ? resolveCopy(
            copy,
            "truthBlockedApprovalTitle",
            "Business truth still needs approval."
          )
        : resolveCopy(
            copy,
            "truthBlockedRuntimeTitle",
            "Runtime still needs repair."
          ),
      summary: s(truth.summary),
      action: normalizeOperationalAction(truth.action, {
        label: "Open truth",
        path: copy.truthPath || "/truth",
      }),
      detail: resolveCopy(
        copy,
        "truthBlockedDetail",
        "Connected channels alone are not enough. Approved truth and healthy runtime must also be aligned."
      ),
    };
  }

  return {
    status: "ready",
    statusLabel: resolveCopy(copy, "readyStatusLabel", "Launch ready"),
    title: resolveCopy(
      copy,
      "readyTitle",
      "Launch posture is healthy."
    ),
    summary: resolveCopy(
      copy,
      "readySummary",
      "Channels, approved truth, and runtime are aligned."
    ),
    action:
      normalizeOperationalAction(deliveryReadyChannel?.action).path
        ? normalizeOperationalAction(deliveryReadyChannel?.action)
        : normalizeOperationalAction(copy.readyAction, {
            label: "Open truth",
            path: copy.truthPath || "/truth",
          }),
    detail: resolveCopy(
      copy,
      "readyDetail",
      "The current launch spine is not blocked by channel, truth, or runtime posture."
    ),
  };
}
