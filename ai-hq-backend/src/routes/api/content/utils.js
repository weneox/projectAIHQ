import { deepFix, fixText } from "../../../utils/textFix.js";

export function cleanLower(v) {
  return String(v ?? "").trim().toLowerCase();
}

export function clean(v) {
  return String(v ?? "").trim();
}

export function asObj(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : {};
}

export function safeLower(x) {
  return String(x ?? "").trim().toLowerCase();
}

export function normalizeContentPack(x) {
  if (!x) return null;

  if (typeof x === "string") {
    try {
      const o = JSON.parse(x);
      return typeof o === "object" && o ? deepFix(o) : null;
    } catch {
      return null;
    }
  }

  if (typeof x === "object") return deepFix(x);
  return null;
}

export function normalizeLooseObject(x) {
  if (!x) return null;

  if (typeof x === "string") {
    try {
      const o = JSON.parse(x);
      return typeof o === "object" && o ? deepFix(o) : null;
    } catch {
      return null;
    }
  }

  if (typeof x === "object" && !Array.isArray(x)) return deepFix(x);
  return null;
}

export function pickTenantId(req) {
  return getAuthTenantKey(req);
}

export function getAuthTenantKey(req) {
  return cleanLower(
    req?.auth?.tenantKey ||
      req?.auth?.tenant_key ||
      req?.user?.tenantKey ||
      req?.user?.tenant_key ||
      req?.tenant?.key ||
      ""
  );
}

export function pickRuntimeTenantId(...items) {
  for (const x of items) {
    const v = String(x?.tenant_id || x?.tenantId || "").trim();
    if (v) return v;
  }
  return "";
}

export function pickActionActor(req, fallback = "ceo") {
  return (
    clean(
      req.body?.by ||
        req.body?.actor ||
        req.headers["x-actor"] ||
        req.headers["x-user-email"] ||
        req.auth?.email ||
        fallback
    ) || fallback
  );
}

export function normalizeAutomationMode(v, fallback = "manual") {
  const x = clean(v || fallback).toLowerCase();
  if (x === "full_auto") return "full_auto";
  return "manual";
}

export function pickAutomationMeta(req) {
  const mode = normalizeAutomationMode(
    req.body?.automationMode ||
      req.body?.mode ||
      req.headers["x-automation-mode"] ||
      "manual",
    "manual"
  );

  const autoPublish =
    mode === "full_auto" ||
    req.body?.autoPublish === true ||
    String(req.headers["x-auto-publish"] || "").trim() === "1";

  return {
    mode,
    autoPublish,
  };
}

export function packType(pack) {
  if (!pack || typeof pack !== "object") return "";
  return String(
    pack.post_type || pack.postType || pack.format || pack.type || ""
  ).toLowerCase();
}

export function pickAspectRatio(pack) {
  if (!pack || typeof pack !== "object") return "";
  return String(
    pack.aspectRatio || pack.aspect_ratio || pack?.visualPlan?.aspectRatio || ""
  ).trim();
}

export function pickVisualPreset(pack) {
  if (!pack || typeof pack !== "object") return "";
  return String(pack?.visualPlan?.visualPreset || pack?.visualPreset || "").trim();
}

export function pickImagePrompt(pack) {
  if (!pack || typeof pack !== "object") return "";
  return fixText(String(pack.imagePrompt || pack?.assetBrief?.imagePrompt || "").trim());
}

export function pickVideoPrompt(pack) {
  if (!pack || typeof pack !== "object") return "";
  return fixText(String(pack.videoPrompt || pack?.assetBrief?.videoPrompt || "").trim());
}

export function pickVoiceoverText(pack) {
  if (!pack || typeof pack !== "object") return "";
  return fixText(
    String(pack.voiceoverText || pack?.assetBrief?.voiceoverText || "").trim()
  );
}

export function pickNeededAssets(pack) {
  if (!pack || typeof pack !== "object") return [];
  const a = pack.neededAssets || pack?.assetBrief?.neededAssets || [];
  return Array.isArray(a)
    ? a.map((x) => String(x).trim()).filter(Boolean).slice(0, 12)
    : [];
}

export function pickReelMeta(pack) {
  if (!pack || typeof pack !== "object") return null;
  const rm = asObj(pack.reelMeta);
  return Object.keys(rm).length ? deepFix(rm) : null;
}

export function normalizeHashtagsValue(v) {
  if (!v) return "";
  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).filter(Boolean).join(" ");
  }
  if (typeof v === "string") return fixText(v.trim());

  try {
    return fixText(JSON.stringify(v));
  } catch {
    return "";
  }
}

export function statusLc(x) {
  return String(x ?? "").trim().toLowerCase();
}

export function isDraftReadyStatus(s) {
  const v = statusLc(s);
  return (
    v === "draft.ready" ||
    v === "draft" ||
    v === "in_progress" ||
    v === "approved" ||
    v === "draft.approved" ||
    v.startsWith("draft.")
  );
}

export function isAssetReadyStatus(s) {
  const v = statusLc(s);
  return (
    v === "asset.ready" ||
    v === "assets.ready" ||
    v === "publish.ready" ||
    v === "approved" ||
    v === "draft.approved" ||
    v === "content.approved"
  );
}

export function isPublishRequestedStatus(s) {
  const v = statusLc(s);
  return (
    v === "publish.requested" ||
    v === "publish.queued" ||
    v === "publish.running"
  );
}

export function isReelPack(contentPack) {
  return packType(contentPack) === "reel";
}

export function pickAssetGenerationEvent(contentPack) {
  return isReelPack(contentPack)
    ? "content.video.generate"
    : "content.assets.generate";
}

export function pickAssetGenerationJobType(contentPack) {
  return isReelPack(contentPack) ? "video.generate" : "asset.generate";
}
