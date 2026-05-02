import { createLogger, emitConsoleSpyEvent } from "../utils/logger.js";

const fallbackLog = createLogger({
  service: "ai-hq-backend",
  component: "runtime-projection-observability",
});

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function uniqStrings(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function normalizeRepairActions(values = []) {
  return uniqStrings(
    arr(values).map((item) => s(item?.action || item?.id || item))
  );
}

function normalizeHealthSnapshot(health = {}) {
  const value = obj(health);
  return {
    status: s(value.status),
    primaryReasonCode: s(value.primaryReasonCode || value.reasonCode),
    reasonCodes: uniqStrings(value.reasonCodes),
    autonomousOperation: s(value.autonomousOperation),
    repairActions: normalizeRepairActions(value.repairActions),
  };
}

function arraysEqual(left = [], right = []) {
  const safeLeft = arr(left);
  const safeRight = arr(right);
  if (safeLeft.length !== safeRight.length) return false;
  return safeLeft.every((item, index) => item === safeRight[index]);
}

function hasMeaningfulHealthChange(previous = null, next = null) {
  const safePrevious = normalizeHealthSnapshot(previous);
  const safeNext = normalizeHealthSnapshot(next);
  return (
    safePrevious.status !== safeNext.status ||
    safePrevious.primaryReasonCode !== safeNext.primaryReasonCode ||
    !arraysEqual(safePrevious.reasonCodes, safeNext.reasonCodes) ||
    safePrevious.autonomousOperation !== safeNext.autonomousOperation
  );
}

function buildAdvisorySnapshot({
  health = null,
  freshness = null,
  runtimeProjection = null,
  activeReviewSessionId = "",
  activeReviewSession = null,
} = {}) {
  const safeHealth = normalizeHealthSnapshot(health);
  const cause = buildCauseFields({
    freshness,
    runtimeProjection,
    activeReviewSession,
    repairActions: safeHealth.repairActions,
  });

  return {
    repairActions: safeHealth.repairActions,
    activeReviewSessionId: s(
      activeReviewSessionId || obj(activeReviewSession).id
    ),
    reviewConflictPresent: cause.reviewConflictPresent,
  };
}

function hasAdvisoryChange(previous = null, next = null) {
  const safePrevious = obj(previous);
  const safeNext = obj(next);
  return (
    !arraysEqual(safePrevious.repairActions, safeNext.repairActions) ||
    s(safePrevious.activeReviewSessionId) !== s(safeNext.activeReviewSessionId) ||
    Boolean(safePrevious.reviewConflictPresent) !==
      Boolean(safeNext.reviewConflictPresent)
  );
}

function pickProjectionRuntimeKey({
  tenantId = "",
  tenantKey = "",
  runtimeProjectionId = "",
} = {}) {
  const parts = [
    s(tenantId) ? `tenant:${s(tenantId)}` : "",
    s(tenantKey) ? `key:${s(tenantKey)}` : "",
    s(runtimeProjectionId) ? `projection:${s(runtimeProjectionId)}` : "",
  ].filter(Boolean);

  return parts.join("|") || "runtime_projection_observability:global";
}

function buildCauseFields({
  freshness = null,
  runtimeProjection = null,
  activeReviewSession = null,
  repairActions = [],
} = {}) {
  const fresh = obj(freshness);
  const reasons = uniqStrings(fresh.reasons);
  const runtimeProjectionId = s(
    obj(runtimeProjection).id || fresh.runtimeProjectionId
  );
  const currentTruthVersionId = s(fresh.currentPublishedTruthVersionId);
  const expectedTruthVersionId = s(fresh.expectedPublishedTruthVersionId);

  return {
    freshnessReasonCodes: reasons,
    truthVersionChanged: Boolean(
      reasons.includes("published_truth_version_mismatch") ||
        (currentTruthVersionId &&
          expectedTruthVersionId &&
          currentTruthVersionId !== expectedTruthVersionId)
    ),
    projectionHashMismatch: reasons.includes("projection_hash_mismatch"),
    projectionMissing: Boolean(
      reasons.includes("missing_runtime_projection") || !runtimeProjectionId
    ),
    reviewConflictPresent: Boolean(
      s(obj(activeReviewSession).id) ||
        normalizeRepairActions(repairActions).includes("review_conflicts")
    ),
  };
}

function logEvent(logger, level = "info", event = "", payload = {}, error = null) {
  const safeEvent = s(event);
  const safePayload = obj(payload);

  if (!safeEvent) return;

  try {
    if (logger && typeof logger[level] === "function") {
      if (level === "error") {
        logger.error(safeEvent, error, safePayload);
        return;
      }

      logger[level](safeEvent, safePayload);
      return;
    }
  } catch {}

  if (level === "error" && error) {
    if (
      emitConsoleSpyEvent(level, safeEvent, {
        ...safePayload,
        errorClass: s(error?.name || error?.constructor?.name || "Error"),
        errorMessage: s(error?.message || error),
        errorCode: s(error?.code || error?.reasonCode),
      })
    ) {
      return;
    }

    fallbackLog.error(safeEvent, {
      ...safePayload,
      errorClass: s(error?.name || error?.constructor?.name || "Error"),
      errorMessage: s(error?.message || error),
      errorCode: s(error?.code || error?.reasonCode),
    });
    return;
  }

  if (emitConsoleSpyEvent(level, safeEvent, safePayload)) return;

  const fallbackMethod = typeof fallbackLog[level] === "function" ? level : "info";
  fallbackLog[fallbackMethod](safeEvent, safePayload);
}

const runtimeProjectionHealthState = new Map();

function buildHealthTransitionPayload({
  previousHealth = null,
  nextHealth = null,
  freshness = null,
  runtimeProjection = null,
  tenantId = "",
  tenantKey = "",
  latestTruthVersionId = "",
  activeReviewSessionId = "",
  activeReviewSession = null,
  triggerSource = "",
  repairTrigger = "",
  requestedBy = "",
  durationMs = null,
} = {}) {
  const previous = normalizeHealthSnapshot(previousHealth);
  const next = normalizeHealthSnapshot(nextHealth);
  const cause = buildCauseFields({
    freshness,
    runtimeProjection,
    activeReviewSession,
    repairActions: next.repairActions,
  });

  return {
    tenantKey: s(tenantKey),
    tenantId: s(tenantId),
    latestTruthVersionId: s(
      latestTruthVersionId || obj(freshness).expectedPublishedTruthVersionId
    ),
    runtimeProjectionId: s(
      obj(runtimeProjection).id || obj(freshness).runtimeProjectionId
    ),
    previousStatus: previous.status,
    nextStatus: next.status,
    previousPrimaryReasonCode: previous.primaryReasonCode,
    nextPrimaryReasonCode: next.primaryReasonCode,
    previousReasonCodes: previous.reasonCodes,
    nextReasonCodes: next.reasonCodes,
    autonomousOperation: next.autonomousOperation,
    runtimeProjectionStatus: s(
      obj(runtimeProjection).status || obj(freshness).runtimeStatus
    ),
    freshnessReasonCodes: cause.freshnessReasonCodes,
    repairActions: next.repairActions,
    activeReviewSessionId: s(
      activeReviewSessionId || obj(activeReviewSession).id
    ),
    triggerSource: s(triggerSource),
    repairTrigger: s(repairTrigger),
    requestedBy: s(requestedBy),
    durationMs: Number.isFinite(Number(durationMs)) ? Number(durationMs) : null,
    didStatusChange: previous.status !== next.status,
    didReasonChange:
      previous.primaryReasonCode !== next.primaryReasonCode ||
      !arraysEqual(previous.reasonCodes, next.reasonCodes),
    truthVersionChanged: cause.truthVersionChanged,
    projectionHashMismatch: cause.projectionHashMismatch,
    projectionMissing: cause.projectionMissing,
    reviewConflictPresent: cause.reviewConflictPresent,
  };
}

function buildAdvisoryChangedPayload({
  previousAdvisory = null,
  nextAdvisory = null,
  tenantId = "",
  tenantKey = "",
  latestTruthVersionId = "",
  runtimeProjection = null,
  freshness = null,
  triggerSource = "",
  repairTrigger = "",
  requestedBy = "",
} = {}) {
  const previous = obj(previousAdvisory);
  const next = obj(nextAdvisory);

  return {
    tenantKey: s(tenantKey),
    tenantId: s(tenantId),
    latestTruthVersionId: s(
      latestTruthVersionId || obj(freshness).expectedPublishedTruthVersionId
    ),
    runtimeProjectionId: s(
      obj(runtimeProjection).id || obj(freshness).runtimeProjectionId
    ),
    previousRepairActions: arr(previous.repairActions),
    nextRepairActions: arr(next.repairActions),
    previousActiveReviewSessionId: s(previous.activeReviewSessionId),
    nextActiveReviewSessionId: s(next.activeReviewSessionId),
    previousReviewConflictPresent: Boolean(previous.reviewConflictPresent),
    nextReviewConflictPresent: Boolean(next.reviewConflictPresent),
    triggerSource: s(triggerSource),
    repairTrigger: s(repairTrigger),
    requestedBy: s(requestedBy),
    didRepairActionsChange: !arraysEqual(
      previous.repairActions,
      next.repairActions
    ),
    didReviewSessionChange:
      s(previous.activeReviewSessionId) !== s(next.activeReviewSessionId),
    didReviewConflictChange:
      Boolean(previous.reviewConflictPresent) !==
      Boolean(next.reviewConflictPresent),
  };
}

export function emitRuntimeProjectionHealthTransition({
  logger = null,
  health = null,
  freshness = null,
  runtimeProjection = null,
  tenantId = "",
  tenantKey = "",
  latestTruthVersionId = "",
  activeReviewSessionId = "",
  activeReviewSession = null,
  triggerSource = "",
  repairTrigger = "",
  requestedBy = "",
  durationMs = null,
} = {}) {
  const next = normalizeHealthSnapshot(health);
  const nextAdvisory = buildAdvisorySnapshot({
    health,
    freshness,
    runtimeProjection,
    activeReviewSessionId,
    activeReviewSession,
  });
  const runtimeProjectionId = s(
    obj(runtimeProjection).id || obj(freshness).runtimeProjectionId
  );
  const cacheKey = pickProjectionRuntimeKey({
    tenantId,
    tenantKey,
    runtimeProjectionId,
  });
  const previousEntry = runtimeProjectionHealthState.get(cacheKey) || null;
  const previous = previousEntry?.health || null;
  const previousAdvisory = previousEntry?.advisory || null;

  if (previous && !hasMeaningfulHealthChange(previous, next)) {
    if (next.status === "healthy" && hasAdvisoryChange(previousAdvisory, nextAdvisory)) {
      const advisoryPayload = buildAdvisoryChangedPayload({
        previousAdvisory,
        nextAdvisory,
        tenantId,
        tenantKey,
        latestTruthVersionId,
        runtimeProjection,
        freshness,
        triggerSource,
        repairTrigger,
        requestedBy,
      });

      logEvent(
        logger,
        "info",
        "runtime.projection.advisory.changed",
        advisoryPayload
      );

      runtimeProjectionHealthState.set(cacheKey, {
        health: next,
        advisory: nextAdvisory,
      });

      return {
        emitted: true,
        previous,
        next,
        payload: advisoryPayload,
      };
    }

    if (
      next.status !== "healthy" &&
      !arraysEqual(previous.repairActions, next.repairActions)
    ) {
      const payload = buildHealthTransitionPayload({
        previousHealth: previous,
        nextHealth: next,
        freshness,
        runtimeProjection,
        tenantId,
        tenantKey,
        latestTruthVersionId,
        activeReviewSessionId,
        activeReviewSession,
        triggerSource,
        repairTrigger,
        requestedBy,
        durationMs,
      });

      logEvent(logger, "warn", "runtime.projection.health.transition", payload);

      runtimeProjectionHealthState.set(cacheKey, {
        health: next,
        advisory: nextAdvisory,
      });

      return {
        emitted: true,
        previous,
        next,
        payload,
      };
    }

    return {
      emitted: false,
      previous,
      next,
      payload: null,
    };
  }

  const payload = buildHealthTransitionPayload({
    previousHealth: previous,
    nextHealth: next,
    freshness,
    runtimeProjection,
    tenantId,
    tenantKey,
    latestTruthVersionId,
    activeReviewSessionId,
    activeReviewSession,
    triggerSource,
    repairTrigger,
    requestedBy,
    durationMs,
  });

  logEvent(
    logger,
    ["missing", "stale", "blocked", "invalid"].includes(next.status)
      ? "warn"
      : "info",
    "runtime.projection.health.transition",
    payload
  );

  runtimeProjectionHealthState.set(cacheKey, {
    health: next,
    advisory: nextAdvisory,
  });

  return {
    emitted: true,
    previous,
    next,
    payload,
  };
}

function buildRepairPayload({
  previousHealth = null,
  nextHealth = null,
  freshness = null,
  runtimeProjection = null,
  tenantId = "",
  tenantKey = "",
  latestTruthVersionId = "",
  activeReviewSessionId = "",
  activeReviewSession = null,
  triggerSource = "",
  repairTrigger = "",
  requestedBy = "",
  durationMs = null,
  extra = {},
} = {}) {
  const previous = normalizeHealthSnapshot(previousHealth);
  const next = normalizeHealthSnapshot(nextHealth || previous);
  const cause = buildCauseFields({
    freshness,
    runtimeProjection,
    activeReviewSession,
    repairActions: next.repairActions.length
      ? next.repairActions
      : previous.repairActions,
  });
  const safeExtra = obj(extra);

  return {
    tenantKey: s(tenantKey),
    tenantId: s(tenantId),
    latestTruthVersionId: s(
      latestTruthVersionId || obj(freshness).expectedPublishedTruthVersionId
    ),
    runtimeProjectionId: s(
      obj(runtimeProjection).id || obj(freshness).runtimeProjectionId
    ),
    previousStatus: previous.status,
    nextStatus: next.status,
    previousPrimaryReasonCode: previous.primaryReasonCode,
    nextPrimaryReasonCode: next.primaryReasonCode,
    previousReasonCodes: previous.reasonCodes,
    nextReasonCodes: next.reasonCodes,
    autonomousOperation: next.autonomousOperation || previous.autonomousOperation,
    runtimeProjectionStatus: s(
      obj(runtimeProjection).status || obj(freshness).runtimeStatus
    ),
    freshnessReasonCodes: cause.freshnessReasonCodes,
    repairActions: next.repairActions.length
      ? next.repairActions
      : previous.repairActions,
    activeReviewSessionId: s(
      activeReviewSessionId || obj(activeReviewSession).id
    ),
    triggerSource: s(triggerSource),
    repairTrigger: s(repairTrigger),
    requestedBy: s(requestedBy),
    durationMs: Number.isFinite(Number(durationMs)) ? Number(durationMs) : null,
    didStatusChange: previous.status !== next.status,
    didReasonChange:
      previous.primaryReasonCode !== next.primaryReasonCode ||
      !arraysEqual(previous.reasonCodes, next.reasonCodes),
    truthVersionChanged: cause.truthVersionChanged,
    projectionHashMismatch: cause.projectionHashMismatch,
    projectionMissing: cause.projectionMissing,
    reviewConflictPresent: cause.reviewConflictPresent,
    ...safeExtra,
  };
}

export function emitRuntimeProjectionRepairStarted(options = {}) {
  const payload = buildRepairPayload(options);
  logEvent(
    options.logger,
    "warn",
    "runtime.projection.repair.started",
    payload
  );
  return payload;
}

export function emitRuntimeProjectionRepairSucceeded(options = {}) {
  const payload = buildRepairPayload({
    ...options,
    extra: {
      restoredHealthy:
        normalizeHealthSnapshot(options.nextHealth).status === "healthy",
      didProjectionChange:
        s(options.previousRuntimeProjectionId) !==
          s(
            obj(options.runtimeProjection).id || obj(options.freshness).runtimeProjectionId
          ) ||
        s(options.previousProjectionHash) !==
          s(
            obj(options.runtimeProjection).projection_hash ||
              obj(options.freshness).currentProjectionHash
          ),
      ...obj(options.extra),
    },
  });

  logEvent(
    options.logger,
    "info",
    "runtime.projection.repair.succeeded",
    payload
  );
  return payload;
}

export function emitRuntimeProjectionRepairFailed(options = {}) {
  const safeError = options.error;
  const payload = buildRepairPayload({
    ...options,
    extra: {
      reasonCode: s(
        options.reasonCode ||
          obj(options.freshness).reasons?.[0] ||
          safeError?.reasonCode ||
          safeError?.reason ||
          safeError?.code
      ).toLowerCase(),
      errorClass: s(safeError?.name || safeError?.constructor?.name || "Error"),
      errorMessage: s(safeError?.message || safeError),
      errorCode: s(safeError?.code || safeError?.reasonCode),
      ...obj(options.extra),
    },
  });

  logEvent(
    options.logger,
    "error",
    "runtime.projection.repair.failed",
    payload,
    safeError
  );
  return payload;
}

export function emitRuntimeProjectionRepairSkipped(options = {}) {
  const payload = buildRepairPayload({
    ...options,
    extra: {
      reasonCode: s(
        options.reasonCode ||
          obj(options.freshness).reasons?.[0] ||
          "repair_skipped"
      ).toLowerCase(),
      ...obj(options.extra),
    },
  });

  logEvent(
    options.logger,
    "warn",
    "runtime.projection.repair.skipped",
    payload
  );
  return payload;
}

export function emitRuntimeProjectionBlockedConsumer({
  logger = null,
  consumer = "",
  tenantId = "",
  tenantKey = "",
  authority = null,
  latestTruthVersionId = "",
  requestId = "",
  correlationId = "",
  externalThreadId = "",
  externalMessageId = "",
  externalCommentId = "",
} = {}) {
  const runtimeAuthority = obj(authority);
  const health = obj(runtimeAuthority.health);
  const payload = {
    tenantKey: s(tenantKey || runtimeAuthority.tenantKey),
    tenantId: s(tenantId || runtimeAuthority.tenantId),
    consumer: s(consumer),
    reasonCode: s(
      runtimeAuthority.reasonCode ||
        runtimeAuthority.reason ||
        health.primaryReasonCode ||
        "runtime_authority_unavailable"
    ),
    runtimeProjectionId: s(runtimeAuthority.runtimeProjectionId),
    latestTruthVersionId: s(latestTruthVersionId),
    activeReviewSessionId: s(health.activeReviewSessionId),
    freshnessReasonCodes: uniqStrings(
      runtimeAuthority.freshnessReasons || health.freshnessReasonCodes
    ),
    repairActions: normalizeRepairActions(health.repairActions),
    requestId: s(requestId),
    correlationId: s(correlationId),
    externalThreadId: s(externalThreadId),
    externalMessageId: s(externalMessageId),
    externalCommentId: s(externalCommentId),
  };

  logEvent(
    logger,
    "warn",
    "runtime.projection.blocked.consumer",
    payload
  );

  return payload;
}

function resetRuntimeProjectionHealthState() {
  runtimeProjectionHealthState.clear();
}

export const __test__ = {
  resetRuntimeProjectionHealthState,
};
