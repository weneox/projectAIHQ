import { deepFix } from "../../../utils/textFix.js";
import {
  packType,
  pickAspectRatio,
  pickVisualPreset,
  pickImagePrompt,
  pickVideoPrompt,
  pickVoiceoverText,
  pickNeededAssets,
  pickReelMeta,
} from "./utils.js";
import { pickThumbnailUrl } from "./assets.js";

function s(v) {
  return String(v ?? "").trim();
}

export function buildAssetNotifyExtra({
  tenantKey,
  tenantId = "",
  proposal,
  row,
  jobId,
  contentPack,
  runtimeBehavior = null,
}) {
  return deepFix({
    tenantKey: s(tenantKey),
    tenantId: s(tenantId),
    proposalId: s(proposal?.id || row?.proposal_id || ""),
    threadId: s(proposal?.thread_id || row?.thread_id || ""),
    jobId: jobId || null,
    contentId: s(row?.id || ""),
    postType: packType(contentPack),
    format: packType(contentPack),
    aspectRatio: pickAspectRatio(contentPack),
    visualPreset: pickVisualPreset(contentPack),
    imagePrompt: pickImagePrompt(contentPack),
    videoPrompt: pickVideoPrompt(contentPack),
    voiceoverText: pickVoiceoverText(contentPack),
    neededAssets: pickNeededAssets(contentPack),
    reelMeta: pickReelMeta(contentPack),
    runtimeBehavior,
    contentPack,
    callback: { url: "/api/executions/callback", tokenHeader: "x-webhook-token" },
  });
}

export function buildPublishNotifyExtra({
  tenantKey,
  tenantId = "",
  proposal,
  row,
  jobId,
  contentPack,
  assetUrl,
  caption,
  runtimeBehavior = null,
}) {
  const thumbnailUrl = pickThumbnailUrl(contentPack, row);
  const kind = packType(contentPack);

  return deepFix({
    tenantKey: s(tenantKey),
    tenantId: s(tenantId),
    proposalId: s(proposal?.id || row?.proposal_id || ""),
    threadId: s(proposal?.thread_id || row?.thread_id || ""),
    jobId: jobId || null,
    contentId: s(row?.id || ""),
    postType: kind,
    format: kind,
    aspectRatio: pickAspectRatio(contentPack),
    visualPreset: pickVisualPreset(contentPack),
    assetUrl,
    imageUrl: kind === "reel" ? null : assetUrl,
    videoUrl: kind === "reel" ? assetUrl : null,
    thumbnailUrl,
    coverUrl: thumbnailUrl || assetUrl,
    caption,
    runtimeBehavior,
    contentPack,
    callback: { url: "/api/executions/callback", tokenHeader: "x-webhook-token" },
  });
}
