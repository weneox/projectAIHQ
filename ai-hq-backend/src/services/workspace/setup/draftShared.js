export function s(v, d = "") {
  return String(v ?? d).trim();
}

export function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

export function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s(value)
  );
}

export function safeUuidOrNull(value = "") {
  const x = s(value);
  return isUuid(x) ? x : null;
}

export function compactDraftObject(input = {}) {
  const out = {};

  for (const [key, raw] of Object.entries(obj(input))) {
    if (raw == null) continue;

    if (Array.isArray(raw)) {
      if (raw.length) out[key] = raw;
      continue;
    }

    if (raw && typeof raw === "object") {
      const nested = compactDraftObject(raw);
      if (Object.keys(nested).length) out[key] = nested;
      continue;
    }

    if (typeof raw === "string") {
      const text = s(raw);
      if (text) out[key] = text;
      continue;
    }

    out[key] = raw;
  }

  return out;
}

export function mergeDraftState(...items) {
  const out = {};

  for (const item of items) {
    const source = obj(item);

    for (const [key, raw] of Object.entries(source)) {
      if (raw === undefined || raw === null) continue;

      if (Array.isArray(raw)) {
        out[key] = JSON.parse(JSON.stringify(raw));
        continue;
      }

      if (
        raw &&
        typeof raw === "object" &&
        !Array.isArray(raw) &&
        out[key] &&
        typeof out[key] === "object" &&
        !Array.isArray(out[key])
      ) {
        out[key] = mergeDraftState(out[key], raw);
        continue;
      }

      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        out[key] = mergeDraftState(raw);
        continue;
      }

      if (typeof raw === "string") {
        const text = s(raw);
        if (!text) continue;
        out[key] = text;
        continue;
      }

      out[key] = raw;
    }
  }

  return out;
}

export async function getOrCreateSetupDraftSession(actor = {}) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  const current = await reviewHelper.getCurrentSetupReview(actor.tenantId);
  if (current?.session?.id) {
    return current;
  }

  const startedBy =
    safeUuidOrNull(actor?.user?.id) ||
    safeUuidOrNull(actor?.user?.userId) ||
    safeUuidOrNull(actor?.user?.user_id) ||
    null;

  await reviewHelper.getOrCreateActiveSetupReviewSession({
    tenantId: actor.tenantId,
    mode: "setup",
    currentStep: "review",
    startedBy,
    title: "Setup review",
    notes: "",
    metadata: {
      setupDraftOnly: true,
      setupCanonicalWriteWall: true,
    },
    ensureDraft: true,
  });

  return reviewHelper.getCurrentSetupReview(actor.tenantId);
}

export const __test__ = {
  compactDraftObject,
  mergeDraftState,
  safeUuidOrNull,
  s,
  obj,
  arr,
};
