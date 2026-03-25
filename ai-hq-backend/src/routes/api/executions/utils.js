import { deepFix, fixText } from "../../../utils/textFix.js";

export function clean(v) {
  return String(v || "").trim();
}

export function lower(v) {
  return clean(v).toLowerCase();
}

export function asObj(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : null;
}

export function safeLower(x) {
  return String(x || "").trim().toLowerCase();
}

export function firstNonEmpty(...vals) {
  for (const v of vals) {
    const s = String(v || "").trim();
    if (s) return s;
  }
  return null;
}

export function pickJobId(req) {
  return String(
    req.body?.jobId || req.body?.job_id || req.body?.id || ""
  ).trim();
}

export function normalizeStatus(x) {
  const s = String(x || "").trim().toLowerCase();
  if (!s) return "";
  if (["complete", "done", "ok", "success"].includes(s)) return "completed";
  return s;
}

export function pickTenantIdFromResult(result) {
  const v = String(result?.tenantId || result?.tenant_id || "").trim();
  return v || null;
}

export function pickThreadId(result, jobInput) {
  return (
    result?.threadId ||
    result?.thread_id ||
    jobInput?.threadId ||
    jobInput?.thread_id ||
    null
  );
}

export function pickContentId(result, jobInput) {
  const cid =
    result?.contentId ||
    result?.content_id ||
    result?.draftId ||
    result?.draft_id ||
    (jobInput && typeof jobInput === "object"
      ? jobInput.contentId ||
        jobInput.content_id ||
        jobInput.draftId ||
        jobInput.draft_id
      : null) ||
    null;

  return cid ? String(cid) : null;
}

export function jobTypeLc(x) {
  return String(x || "").trim().toLowerCase();
}

export function normalizeAutomationMode(v, fallback = "manual") {
  const x = lower(v || fallback);
  if (x === "full_auto") return "full_auto";
  return "manual";
}

export function pickAutomationMeta(result = {}, jobInput = {}, contentRow = null) {
  const mode = normalizeAutomationMode(
    result?.automationMode ||
      result?.automation_mode ||
      jobInput?.automationMode ||
      jobInput?.automation_mode ||
      contentRow?.automationMode ||
      contentRow?.content_pack?.automationMode ||
      "manual",
    "manual"
  );

  const autoPublish =
    result?.autoPublish === true ||
    result?.auto_publish === true ||
    jobInput?.autoPublish === true ||
    jobInput?.auto_publish === true ||
    contentRow?.content_pack?.autoPublish === true ||
    mode === "full_auto";

  return {
    mode,
    autoPublish,
  };
}

export function pickAssetUrl(result = {}, contentPack = {}) {
  return (
    clean(
      result?.assetUrl ||
        result?.imageUrl ||
        result?.videoUrl ||
        result?.url ||
        contentPack?.imageUrl ||
        contentPack?.videoUrl ||
        contentPack?.coverUrl
    ) || null
  );
}

export function pickCaption(contentPack = {}, result = {}) {
  return (
    clean(
      result?.caption ||
        contentPack?.caption ||
        contentPack?.copy?.caption ||
        contentPack?.post?.caption
    ) || ""
  );
}

export function isCompleted(status) {
  return lower(status) === "completed";
}

export function isDraftJobType(jt) {
  return (
    jt.startsWith("draft") ||
    jt === "content.draft" ||
    jt === "draft.generate" ||
    jt === "draft.regen" ||
    jt === "content.revise"
  );
}

export function isVoiceJobType(jt) {
  return (
    jt === "voice.generate" ||
    jt === "content.voice.generate" ||
    jt === "voiceover.generate" ||
    jt === "tts.generate"
  );
}

export function isSceneJobType(jt) {
  return (
    jt === "video.generate" ||
    jt === "content.video.generate" ||
    jt === "scene.generate" ||
    jt === "scene.video.generate" ||
    jt === "scene.image.generate" ||
    jt === "content.scene.generate" ||
    jt === "runway.generate" ||
    jt === "reel.generate" ||
    jt === "video.render" ||
    jt === "reel.render"
  );
}

export function isRenderJobType(jt) {
  return (
    jt === "assembly.render" ||
    jt === "content.render" ||
    jt === "render.generate" ||
    jt === "creatomate.render"
  );
}

export function isQaJobType(jt) {
  return jt === "qa.check" || jt === "content.qa.check";
}

export function isAssetJobType(jt) {
  return (
    jt === "asset.generate" ||
    jt === "content.assets.generate" ||
    jt === "content.asset.generate" ||
    isVoiceJobType(jt) ||
    isSceneJobType(jt) ||
    isRenderJobType(jt) ||
    isQaJobType(jt)
  );
}

export function isPublishJobType(jt) {
  return jt === "publish" || jt === "content.publish";
}

export function normalizeAssetItem(a) {
  if (!a || typeof a !== "object") return null;

  const url = firstNonEmpty(a.url, a.secure_url, a.publicUrl, a.public_url);
  if (!url) return null;

  return deepFix({
    kind: a.kind || a.type || "image",
    type: a.type || a.kind || "image",
    role: a.role || "primary",
    provider: a.provider || null,
    url,
    secure_url: a.secure_url || null,
    publicUrl: a.publicUrl || null,
    public_url: a.public_url || null,
    thumbnailUrl: a.thumbnailUrl || a.thumbnail_url || null,
    durationSec: a.durationSec ?? a.duration_sec ?? null,
    aspectRatio: a.aspectRatio || a.aspect_ratio || null,
    taskId: a.taskId || a.task_id || null,
  });
}

export function pickImageInfo(result) {
  const image =
    (result?.image && typeof result.image === "object" ? result.image : null) ||
    (result?.asset && typeof result.asset === "object" ? result.asset : null) ||
    null;

  const imageUrl = firstNonEmpty(
    result?.imageUrl,
    result?.image_url,
    result?.assetUrl,
    result?.asset_url,
    result?.url,
    image?.imageUrl,
    image?.image_url,
    image?.assetUrl,
    image?.asset_url,
    image?.url
  );

  const coverUrl = firstNonEmpty(
    result?.coverUrl,
    result?.cover_url,
    result?.thumbnailUrl,
    result?.thumbnail_url,
    image?.coverUrl,
    image?.cover_url,
    image?.thumbnailUrl,
    image?.thumbnail_url
  );

  const provider = firstNonEmpty(
    result?.provider,
    result?.engine,
    image?.provider
  );

  const aspectRatio = firstNonEmpty(
    result?.aspectRatio,
    result?.aspect_ratio,
    image?.aspectRatio,
    image?.aspect_ratio
  );

  if (!imageUrl && !coverUrl && !image) return null;

  return deepFix({
    provider: provider ? String(provider) : null,
    imageUrl: imageUrl ? String(imageUrl) : null,
    coverUrl: coverUrl ? String(coverUrl) : null,
    aspectRatio: aspectRatio ? String(aspectRatio) : null,
    raw: image ? deepFix(image) : null,
  });
}

export function pickVideoInfo(result) {
  const video =
    (result?.video && typeof result.video === "object" ? result.video : null) ||
    (result?.render && typeof result.render === "object" ? result.render : null) ||
    (result?.runway && typeof result.runway === "object" ? result.runway : null) ||
    null;

  const videoUrl =
    result?.videoUrl ||
    result?.video_url ||
    video?.videoUrl ||
    video?.video_url ||
    video?.url ||
    null;

  const thumbnailUrl =
    result?.thumbnailUrl ||
    result?.thumbnail_url ||
    result?.posterUrl ||
    result?.poster_url ||
    video?.thumbnailUrl ||
    video?.thumbnail_url ||
    video?.posterUrl ||
    video?.poster_url ||
    null;

  const provider =
    result?.provider ||
    result?.engine ||
    video?.provider ||
    (video?.taskId || video?.task_id ? "runway" : null) ||
    null;

  const taskId =
    result?.taskId ||
    result?.task_id ||
    result?.runwayTaskId ||
    result?.runway_task_id ||
    video?.taskId ||
    video?.task_id ||
    null;

  const durationSec =
    result?.durationSec ||
    result?.duration_sec ||
    result?.duration ||
    video?.durationSec ||
    video?.duration_sec ||
    video?.duration ||
    null;

  const aspectRatio =
    result?.aspectRatio ||
    result?.aspect_ratio ||
    video?.aspectRatio ||
    video?.aspect_ratio ||
    null;

  if (!videoUrl && !thumbnailUrl && !taskId && !video) return null;

  return deepFix({
    provider: provider ? String(provider) : null,
    taskId: taskId ? String(taskId) : null,
    videoUrl: videoUrl ? String(videoUrl) : null,
    thumbnailUrl: thumbnailUrl ? String(thumbnailUrl) : null,
    durationSec: durationSec == null ? null : Number(durationSec),
    aspectRatio: aspectRatio ? String(aspectRatio) : null,
    raw: video ? deepFix(video) : null,
  });
}

export function mergePackAssets(result) {
  const rawPack =
    result?.contentPack ||
    result?.content_pack ||
    result?.draft ||
    result?.pack ||
    result?.content ||
    null;

  const assets = Array.isArray(result?.assets)
    ? result.assets.map(normalizeAssetItem).filter(Boolean)
    : [];

  const image = pickImageInfo(result);
  const video = pickVideoInfo(result);

  const topLevelPatch = deepFix({
    ...(image?.imageUrl ? { imageUrl: image.imageUrl } : {}),
    ...(image?.coverUrl
      ? { coverUrl: image.coverUrl, thumbnailUrl: image.coverUrl }
      : {}),
    ...(video?.videoUrl ? { videoUrl: video.videoUrl } : {}),
    ...(video?.thumbnailUrl ? { thumbnailUrl: video.thumbnailUrl } : {}),
    ...(image?.aspectRatio || video?.aspectRatio
      ? { aspectRatio: image?.aspectRatio || video?.aspectRatio }
      : {}),
  });

  if (rawPack && typeof rawPack === "object") {
    const rpAssets = Array.isArray(rawPack.assets)
      ? rawPack.assets.map(normalizeAssetItem).filter(Boolean)
      : [];

    return deepFix({
      ...rawPack,
      ...topLevelPatch,
      assets: [...rpAssets, ...assets],
    });
  }

  if (assets.length || Object.keys(topLevelPatch).length) {
    return deepFix({
      ...topLevelPatch,
      ...(assets.length ? { assets } : {}),
    });
  }

  return null;
}

export function pickPublishInfo(result) {
  const pub =
    (result?.publish && typeof result.publish === "object" ? result.publish : null) ||
    (result?.published && typeof result.published === "object" ? result.published : null) ||
    null;

  const publishedMediaId =
    result?.publishedMediaId ||
    result?.published_media_id ||
    pub?.publishedMediaId ||
    pub?.published_media_id ||
    pub?.mediaId ||
    pub?.id ||
    null;

  const permalink =
    result?.permalink ||
    result?.postUrl ||
    result?.post_url ||
    pub?.permalink ||
    pub?.url ||
    null;

  const platform = result?.platform || pub?.platform || "instagram";

  return deepFix({
    platform,
    publishedMediaId: publishedMediaId ? String(publishedMediaId) : null,
    permalink: permalink ? String(permalink) : null,
    raw: pub ? deepFix(pub) : null,
  });
}

export function buildMediaAssets(result) {
  const out = [];

  if (Array.isArray(result?.assets)) {
    for (const item of result.assets) {
      const normalized = normalizeAssetItem(item);
      if (normalized) out.push(normalized);
    }
  }

  const image = pickImageInfo(result);
  if (image?.imageUrl) {
    out.push(
      deepFix({
        kind: "image",
        type: "image",
        role: "primary",
        provider: image.provider || null,
        url: image.imageUrl,
        aspectRatio: image.aspectRatio || null,
      })
    );
  }

  if (image?.coverUrl) {
    out.push(
      deepFix({
        kind: "image",
        type: "image",
        role: "cover",
        provider: image.provider || null,
        url: image.coverUrl,
        aspectRatio: image.aspectRatio || null,
      })
    );
  }

  const video = pickVideoInfo(result);

  if (video?.videoUrl) {
    out.push(
      deepFix({
        kind: "video",
        type: "video",
        role: "primary",
        provider: video.provider || "runway",
        url: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl || null,
        durationSec: video.durationSec ?? null,
        aspectRatio: video.aspectRatio || null,
        taskId: video.taskId || null,
      })
    );
  }

  if (video?.thumbnailUrl) {
    out.push(
      deepFix({
        kind: "image",
        type: "image",
        role: "thumbnail",
        provider: video.provider || "runway",
        url: video.thumbnailUrl,
        taskId: video.taskId || null,
      })
    );
  }

  return deepFix(out);
}

export function mergeContentPack(prevPack, incomingPack, result, jt) {
  const prev = deepFix(prevPack || {});
  const next = deepFix(incomingPack || {});
  const mergedAssets = [
    ...(Array.isArray(prev.assets) ? prev.assets : []),
    ...(Array.isArray(next.assets) ? next.assets : []),
    ...buildMediaAssets(result),
  ];

  const uniqueAssets = [];
  const seen = new Set();

  for (const a of mergedAssets) {
    const key = JSON.stringify([
      a?.kind || a?.type || "",
      a?.role || "",
      a?.url || "",
      a?.taskId || "",
    ]);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueAssets.push(a);
  }

  const video = pickVideoInfo(result);
  const image = pickImageInfo(result);

  const merged = deepFix({
    ...prev,
    ...next,
    assets: uniqueAssets,
  });

  if (image?.imageUrl) merged.imageUrl = image.imageUrl;
  if (image?.coverUrl) {
    merged.coverUrl = image.coverUrl;
    if (!merged.thumbnailUrl) merged.thumbnailUrl = image.coverUrl;
  }
  if (image?.aspectRatio && !merged.aspectRatio) {
    merged.aspectRatio = image.aspectRatio;
  }

  if (video) {
    merged.video = deepFix({
      ...(prev.video && typeof prev.video === "object" ? prev.video : {}),
      ...video,
    });

    if (video.videoUrl) merged.videoUrl = video.videoUrl;
    if (video.thumbnailUrl) merged.thumbnailUrl = video.thumbnailUrl;
    if (video.aspectRatio) merged.aspectRatio = video.aspectRatio;
  }

  if (
    jt === "reel.generate" ||
    jt === "reel.render" ||
    jt === "video.generate" ||
    jt === "video.render" ||
    jt === "content.video.generate"
  ) {
    merged.format = merged.format || "reel";
    merged.mediaType = "video";
  }

  return deepFix(merged);
}

export function enrichContentPackForJobType(merged, jt, result = {}) {
  const pack = deepFix(merged || {});

  if (isVoiceJobType(jt)) {
    const voiceUrl =
      result?.voiceUrl ||
      result?.voice_url ||
      result?.audioUrl ||
      result?.audio_url ||
      result?.url ||
      result?.voiceover?.url ||
      null;

    const subtitleUrl =
      result?.subtitleUrl ||
      result?.subtitle_url ||
      result?.srtUrl ||
      result?.srt_url ||
      null;

    pack.voiceover = deepFix({
      ...(pack.voiceover && typeof pack.voiceover === "object"
        ? pack.voiceover
        : {}),
      provider:
        result?.provider || result?.voiceover?.provider || "elevenlabs",
      url: voiceUrl || pack.voiceover?.url || null,
      durationSec:
        result?.durationSec ??
        result?.duration_sec ??
        pack.voiceover?.durationSec ??
        null,
      language: result?.language || pack.voiceover?.language || null,
    });

    if (voiceUrl) pack.voiceoverUrl = voiceUrl;
    if (subtitleUrl) pack.subtitleUrl = subtitleUrl;
  }

  if (isSceneJobType(jt)) {
    pack.mediaType = pack.mediaType || "video";
    pack.format = pack.format || "reel";
  }

  if (isRenderJobType(jt)) {
    const renderUrl =
      result?.renderUrl ||
      result?.render_url ||
      result?.videoUrl ||
      result?.video_url ||
      result?.url ||
      null;

    if (renderUrl) pack.renderUrl = renderUrl;
    pack.render = deepFix({
      ...(pack.render && typeof pack.render === "object" ? pack.render : {}),
      provider: result?.provider || result?.render?.provider || "creatomate",
      url: renderUrl || pack.render?.url || null,
    });
  }

  if (isQaJobType(jt)) {
    pack.qa = deepFix({
      ...(pack.qa && typeof pack.qa === "object" ? pack.qa : {}),
      provider: result?.provider || "ai_hq",
      status: result?.qaStatus || result?.status || "completed",
      score: result?.score ?? result?.qaScore ?? pack.qa?.score ?? null,
      checks: deepFix(result?.checks || result?.qaChecks || {}),
      summary: fixText(
        result?.summary || result?.qaSummary || pack.qa?.summary || ""
      ),
    });
  }

  return deepFix(pack);
}

export function pickNextJobTypeAfter(jt, contentPack = {}, automation = {}) {
  const cp = asObj(contentPack) || {};
  const media = asObj(cp.media) || {};
  const format = safeLower(cp.format || "");
  const hasVoiceText = !!firstNonEmpty(cp.voiceoverText, cp.voiceover_text);
  const hasVoiceReady = !!firstNonEmpty(cp.voiceoverUrl, cp.voiceover?.url);
  const hasVideoPrompt = !!firstNonEmpty(cp.videoPrompt, cp.video_prompt);
  const hasVideoReady = !!firstNonEmpty(cp.videoUrl, cp.video?.videoUrl);
  const hasRenderReady = !!firstNonEmpty(cp.renderUrl, cp.render?.url);

  const wantsVoice =
    media.generateVoiceover === true ||
    cp.voiceoverEnabled === true ||
    hasVoiceText;

  const wantsScene =
    media.generateScenes === true ||
    media.generateVideo === true ||
    format === "reel" ||
    hasVideoPrompt ||
    !!cp.visualPlan ||
    !!cp.visual_plan;

  const wantsRender =
    media.renderVideo === true ||
    format === "reel" ||
    hasVideoReady ||
    hasVoiceReady;

  const wantsQa = media.runQa !== false;

  if (isDraftJobType(jt)) {
    if (wantsVoice && !hasVoiceReady) return "voice.generate";
    if (wantsScene && !hasVideoReady) return "video.generate";
    if (wantsRender && !hasRenderReady) return "assembly.render";
    if (wantsQa) return "qa.check";
    return automation?.autoPublish ? "publish" : null;
  }

  if (isVoiceJobType(jt)) {
    if (wantsScene && !hasVideoReady) return "video.generate";
    if (wantsRender && !hasRenderReady) return "assembly.render";
    if (wantsQa) return "qa.check";
    return automation?.autoPublish ? "publish" : null;
  }

  if (isSceneJobType(jt)) {
    if (wantsRender && !hasRenderReady) return "assembly.render";
    if (wantsQa) return "qa.check";
    return automation?.autoPublish ? "publish" : null;
  }

  if (isRenderJobType(jt)) {
    if (wantsQa) return "qa.check";
    return automation?.autoPublish ? "publish" : null;
  }

  if (isQaJobType(jt)) {
    return automation?.autoPublish ? "publish" : null;
  }

  return null;
}

export function buildNextJobInput({
  proposalId,
  threadId,
  tenantId,
  contentId,
  contentPack,
  currentResult,
  nextJobType,
  automation,
}) {
  const cp = deepFix(contentPack || {});
  const result = deepFix(currentResult || {});

  return deepFix({
    proposalId: proposalId || null,
    threadId: threadId || null,
    tenantId: tenantId || null,
    contentId: contentId || null,
    type: nextJobType,

    contentPack: cp,

    format: cp.format || result.format || null,
    aspectRatio:
      cp.aspectRatio || result.aspectRatio || result.aspect_ratio || null,

    visualPlan: cp.visualPlan || cp.visual_plan || null,

    videoPrompt:
      cp.videoPrompt ||
      cp.video_prompt ||
      result.videoPrompt ||
      result.video_prompt ||
      null,

    voiceoverText:
      cp.voiceoverText ||
      cp.voiceover_text ||
      result.voiceoverText ||
      result.voiceover_text ||
      null,

    voiceoverUrl:
      cp.voiceoverUrl ||
      cp.voiceover?.url ||
      result.voiceoverUrl ||
      result.voiceover?.url ||
      null,

    renderUrl:
      cp.renderUrl ||
      cp.render?.url ||
      result.renderUrl ||
      result.render?.url ||
      null,

    voiceover: cp.voiceover || result.voiceover || null,
    video: cp.video || result.video || null,

    imageUrl: cp.imageUrl || result.imageUrl || null,
    videoUrl: cp.videoUrl || result.videoUrl || null,
    thumbnailUrl: cp.thumbnailUrl || result.thumbnailUrl || null,

    automationMode: automation?.mode || "manual",
    autoPublish: automation?.autoPublish === true,
  });
}