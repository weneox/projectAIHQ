import { deepFix, fixText } from "../../../utils/textFix.js";

export function clean(v) {
  return String(v || "").trim();
}

export function lower(v) {
  return clean(v).toLowerCase();
}

export function asObj(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : {};
}

export function safePayload(p) {
  return asObj(p?.payload);
}

export function safeTitle(p) {
  const payload = safePayload(p);
  const t =
    payload?.topic ||
    payload?.title ||
    payload?.name ||
    payload?.summary ||
    payload?.goal ||
    p?.title ||
    "";
  return fixText(String(t || "").trim());
}

export function safeTopic(p) {
  const payload = safePayload(p);
  return fixText(
    String(payload?.topic || payload?.title || p?.title || "").trim()
  );
}

export function safeFormat(p) {
  const payload = safePayload(p);
  return fixText(
    String(payload?.format || payload?.postType || payload?.post_type || "")
      .trim()
      .toLowerCase()
  );
}

export function safeAspectRatio(p) {
  const payload = safePayload(p);
  return fixText(
    String(
      payload?.aspectRatio ||
        payload?.aspect_ratio ||
        payload?.visualPlan?.aspectRatio ||
        ""
    ).trim()
  );
}

export function safeVisualPreset(p) {
  const payload = safePayload(p);
  return fixText(
    String(
      payload?.visualPlan?.visualPreset || payload?.visualPreset || ""
    ).trim()
  );
}

export function safeImagePrompt(p) {
  const payload = safePayload(p);
  return fixText(
    String(payload?.imagePrompt || payload?.assetBrief?.imagePrompt || "").trim()
  );
}

export function safeVideoPrompt(p) {
  const payload = safePayload(p);
  return fixText(
    String(payload?.videoPrompt || payload?.assetBrief?.videoPrompt || "").trim()
  );
}

export function safeVoiceoverText(p) {
  const payload = safePayload(p);
  return fixText(
    String(
      payload?.voiceoverText || payload?.assetBrief?.voiceoverText || ""
    ).trim()
  );
}

export function safeNeededAssets(p) {
  const payload = safePayload(p);
  const arr = payload?.neededAssets || payload?.assetBrief?.neededAssets || [];
  return Array.isArray(arr)
    ? arr.map((x) => String(x).trim()).filter(Boolean).slice(0, 12)
    : [];
}

export function safeReelMeta(p) {
  const payload = safePayload(p);
  const rm = asObj(payload?.reelMeta);
  return Object.keys(rm).length ? deepFix(rm) : null;
}

export function normalizeRequestedStatus(x) {
  const s = fixText(String(x || "").trim()).toLowerCase() || "draft";
  const allowed = new Set([
    "draft",
    "pending",
    "in_progress",
    "approved",
    "published",
    "rejected",
  ]);
  return allowed.has(s) ? s : "draft";
}

export function lc(x) {
  return String(x || "").trim().toLowerCase();
}

export function parseMaybeJson(x) {
  if (!x) return null;
  if (typeof x === "object") return x;
  if (typeof x === "string") {
    try {
      const o = JSON.parse(x);
      return o && typeof o === "object" ? o : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function normalizeAutomationMode(v, fallback = "manual") {
  const x = clean(v || fallback).toLowerCase();
  if (x === "full_auto") return "full_auto";
  return "manual";
}

export function pickDecisionActor(req, fallback = "ceo") {
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

export function buildDraftJobInput(
  proposal,
  automation,
  tenantKey = "",
  tenantId = null
) {
  const format = safeFormat(proposal);
  const voiceoverText = safeVoiceoverText(proposal);
  const videoPrompt = safeVideoPrompt(proposal);
  const imagePrompt = safeImagePrompt(proposal);

  const wantsReel = lower(format) === "reel";
  const wantsVoice = !!clean(voiceoverText);
  const wantsScene = wantsReel || !!clean(videoPrompt);

  return deepFix({
    proposalId: proposal.id,
    threadId: proposal.thread_id || null,
    tenantId: tenantId || null,
    tenantKey: tenantKey || null,

    title: safeTitle(proposal),
    topic: safeTopic(proposal),

    format,
    aspectRatio: safeAspectRatio(proposal),
    visualPreset: safeVisualPreset(proposal),

    imagePrompt,
    videoPrompt,
    voiceoverText,

    neededAssets: safeNeededAssets(proposal),
    reelMeta: safeReelMeta(proposal),

    payload: deepFix(proposal.payload),

    automationMode: automation.mode,
    autoPublish: automation.autoPublish,

    contentPack: {
      title: safeTitle(proposal),
      topic: safeTopic(proposal),
      format,
      aspectRatio: safeAspectRatio(proposal),
      visualPreset: safeVisualPreset(proposal),
      imagePrompt,
      videoPrompt,
      voiceoverText,
      reelMeta: safeReelMeta(proposal),

      media: {
        generateVoiceover: wantsVoice,
        generateScenes: wantsScene,
        generateVideo: wantsReel,
        renderVideo: wantsReel,
        runQa: true,
      },
    },
  });
}