import { cfg } from "../../../config.js";
import { s } from "../shared.js";

const DEFAULT_STEP_TIMEOUTS = Object.freeze({
  websiteExtractMs: 120_000,
  instagramExtractMs: 45_000,
  googleMapsResolveMs: 30_000,
  finishSyncMs: 20_000,
  markErrorMs: 20_000,
});

function safeNum(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function clampMs(v, fallback, min = 1000, max = 300000) {
  const x = safeNum(v, fallback);
  return Math.max(min, Math.min(max, x));
}

export function resolveStepTimeouts() {
  const innerWebsiteExtractMs = clampMs(
    cfg?.sourceSync?.websiteExtractTimeoutMs,
    90_000,
    10_000,
    240_000
  );

  const explicitOuterWebsiteSyncMs = safeNum(
    cfg?.sourceSync?.websiteSyncTimeoutMs,
    0
  );

  const websiteExtractMs =
    explicitOuterWebsiteSyncMs > 0
      ? clampMs(
          explicitOuterWebsiteSyncMs,
          innerWebsiteExtractMs + 20_000,
          innerWebsiteExtractMs + 5_000,
          300_000
        )
      : clampMs(
          Math.max(
            DEFAULT_STEP_TIMEOUTS.websiteExtractMs,
            innerWebsiteExtractMs + 20_000
          ),
          DEFAULT_STEP_TIMEOUTS.websiteExtractMs,
          innerWebsiteExtractMs + 5_000,
          300_000
        );

  return {
    websiteExtractMs,
    instagramExtractMs: clampMs(
      cfg?.sourceSync?.instagramExtractTimeoutMs,
      DEFAULT_STEP_TIMEOUTS.instagramExtractMs,
      5_000,
      120_000
    ),
    googleMapsResolveMs: clampMs(
      cfg?.sourceSync?.googleMapsResolveTimeoutMs,
      DEFAULT_STEP_TIMEOUTS.googleMapsResolveMs,
      5_000,
      120_000
    ),
    finishSyncMs: clampMs(
      cfg?.sourceSync?.finishSyncTimeoutMs,
      DEFAULT_STEP_TIMEOUTS.finishSyncMs,
      5_000,
      120_000
    ),
    markErrorMs: clampMs(
      cfg?.sourceSync?.markErrorTimeoutMs,
      DEFAULT_STEP_TIMEOUTS.markErrorMs,
      5_000,
      120_000
    ),
  };
}

function buildStepTimeoutError({ sourceType, stage, timeoutMs }) {
  const safeSourceType = s(sourceType || "source").toLowerCase();
  const safeStage = s(stage || "step")
    .replace(/[^a-z0-9]+/gi, "_")
    .toLowerCase();

  const err = new Error(
    `${safeSourceType} ${safeStage} timed out after ${timeoutMs}ms`
  );

  err.code = `${safeSourceType}_${safeStage}_timeout`.toUpperCase();
  err.sourceType = safeSourceType;
  err.stage = safeStage;
  err.timeoutMs = timeoutMs;
  err.isTimeout = true;

  return err;
}

export async function withTimeout(task, timeoutMs, meta = {}) {
  const run = typeof task === "function" ? task : () => task;
  const budget = clampMs(timeoutMs, 0, 1, 300000);

  let timer = null;

  try {
    return await Promise.race([
      Promise.resolve().then(run),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(buildStepTimeoutError({ ...meta, timeoutMs: budget }));
        }, budget);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function buildTimeoutWarning({ sourceType, stage, timeoutMs }) {
  const safeSourceType = s(sourceType || "source").toLowerCase();
  const safeStage = s(stage || "step")
    .replace(/[^a-z0-9]+/gi, "_")
    .toLowerCase();

  if (Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0) {
    return `${safeSourceType}_${safeStage}_timeout_${Number(timeoutMs)}ms`;
  }

  return `${safeSourceType}_${safeStage}_timeout`;
}
