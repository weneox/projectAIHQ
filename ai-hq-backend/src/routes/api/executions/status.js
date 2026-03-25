import {
  jobTypeLc,
  isDraftJobType,
  isVoiceJobType,
  isSceneJobType,
  isRenderJobType,
  isQaJobType,
  isPublishJobType,
} from "./utils.js";

export function patchStatusForJobType(jt, status) {
  const completed = status === "completed";
  if (isDraftJobType(jt)) return completed ? "draft.ready" : "draft.failed";
  if (isVoiceJobType(jt)) return completed ? "voice.ready" : "voice.failed";
  if (isSceneJobType(jt)) return completed ? "scene.ready" : "scene.failed";
  if (isRenderJobType(jt)) return completed ? "render.ready" : "render.failed";
  if (isQaJobType(jt)) return completed ? "qa.ready" : "qa.failed";
  if (isPublishJobType(jt)) return completed ? "published" : "publish.failed";
  return completed ? "asset.ready" : "asset.failed";
}

export function queuedContentStatusForNextJobType(nextJobType) {
  const jt = jobTypeLc(nextJobType);

  if (jt === "voice.generate") return "voice.queued";
  if (jt === "video.generate") return "scene.queued";
  if (jt === "assembly.render") return "render.queued";
  if (jt === "qa.check") return "qa.queued";
  return "publish.requested";
}

export function buildWorkflowEventByJobType(jobType) {
  const jt = jobTypeLc(jobType);
  if (jt === "voice.generate") return "content.voice.generate";
  if (jt === "video.generate") return "content.video.generate";
  if (jt === "assembly.render") return "content.render";
  if (jt === "qa.check") return "content.qa.check";
  if (jt === "publish") return "content.publish";
  return "proposal.approved";
}