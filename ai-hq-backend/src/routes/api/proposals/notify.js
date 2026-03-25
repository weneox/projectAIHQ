import { deepFix } from "../../../utils/textFix.js";
import {
  safeTitle,
  safeTopic,
  safeFormat,
  safeAspectRatio,
  safeVisualPreset,
  safeImagePrompt,
  safeVideoPrompt,
  safeVoiceoverText,
  safeNeededAssets,
  safeReelMeta,
} from "./utils.js";

export function buildN8nExtra({
  tenantId = null,
  tenantKey = null,
  proposal,
  jobId = null,
  reason = "",
  automationMode = "manual",
  autoPublish = false,
}) {
  return deepFix({
    tenantId,
    tenantKey,
    proposalId: String(proposal?.id || ""),
    threadId: String(proposal?.thread_id || ""),
    jobId: jobId || null,
    reason: reason || "",
    title: safeTitle(proposal),
    topic: safeTopic(proposal),
    format: safeFormat(proposal),
    aspectRatio: safeAspectRatio(proposal),
    visualPreset: safeVisualPreset(proposal),
    imagePrompt: safeImagePrompt(proposal),
    videoPrompt: safeVideoPrompt(proposal),
    voiceoverText: safeVoiceoverText(proposal),
    neededAssets: safeNeededAssets(proposal),
    reelMeta: safeReelMeta(proposal),
    payload: deepFix(proposal?.payload || {}),
    automationMode,
    autoPublish,
    callback: {
      url: "/api/executions/callback",
      tokenHeader: "x-webhook-token",
    },
  });
}