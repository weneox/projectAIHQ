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
    setupPath = "/setup",
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
    action: null,
    reasonCode: "",
    readiness: runtimeReadiness,
  };
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
