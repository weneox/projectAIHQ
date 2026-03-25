import {
  isVoiceJobType,
  isSceneJobType,
  isRenderJobType,
  isQaJobType,
  isPublishJobType,
  isAssetJobType,
} from "./utils.js";

export function buildNotificationCopy(status, jt, errorText) {
  let completedTitle = "Draft ready";
  let completedBody = "Draft hazır oldu.";

  if (isVoiceJobType(jt)) {
    completedTitle = "Voice ready";
    completedBody = "Voiceover hazır oldu.";
  } else if (isSceneJobType(jt)) {
    completedTitle = "Scenes ready";
    completedBody = "Scene/video asset hazır oldu.";
  } else if (isRenderJobType(jt)) {
    completedTitle = "Render ready";
    completedBody = "Final render hazır oldu.";
  } else if (isQaJobType(jt)) {
    completedTitle = "QA checked";
    completedBody = "Media QA tamamlandı.";
  } else if (isPublishJobType(jt)) {
    completedTitle = "Published";
    completedBody = "Instagram paylaşımı edildi.";
  } else if (isAssetJobType(jt)) {
    completedTitle = "Assets ready";
    completedBody = "Assets hazır oldu.";
  }

  return {
    type:
      status === "completed"
        ? "success"
        : status === "running"
        ? "info"
        : "error",
    title:
      status === "completed"
        ? completedTitle
        : status === "running"
        ? "Execution running"
        : "Execution failed",
    body:
      status === "completed"
        ? completedBody
        : status === "running"
        ? "İcra gedir…"
        : errorText || "n8n failed",
  };
}

export function buildPushCopy(status, jt, errorText) {
  return {
    title:
      status === "completed"
        ? isPublishJobType(jt)
          ? "Published"
          : isRenderJobType(jt)
          ? "Render hazırdır"
          : isSceneJobType(jt)
          ? "Scene hazırdır"
          : isVoiceJobType(jt)
          ? "Voice hazırdır"
          : isQaJobType(jt)
          ? "QA tamamlandı"
          : isAssetJobType(jt)
          ? "Assets hazırdır"
          : "Draft hazırdır"
        : status === "running"
        ? "İcra gedir"
        : "Execution failed",
    body:
      status === "completed"
        ? isPublishJobType(jt)
          ? "Post paylaşıldı."
          : isRenderJobType(jt)
          ? "Final render hazır oldu."
          : isSceneJobType(jt)
          ? "Scene/video asset hazır oldu."
          : isVoiceJobType(jt)
          ? "Voiceover hazır oldu."
          : isQaJobType(jt)
          ? "Media QA tamamlandı."
          : isAssetJobType(jt)
          ? "Vizual/video hazır oldu."
          : "AI draft yaratdı — baxıb təsdiqlə."
        : status === "running"
        ? "n8n hazırda işləyir…"
        : errorText || "n8n error",
  };
}