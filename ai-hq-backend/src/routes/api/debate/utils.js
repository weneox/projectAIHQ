import { deepFix, fixText } from "../../../utils/textFix.js";

export function normalizeMode(mode) {
  const m = String(mode || "answer").trim().toLowerCase();
  if (m === "content.draft" || m === "content_draft") return "draft";
  if (m === "content.revise" || m === "content_revise") return "revise";
  if (m === "content.publish" || m === "content_publish") return "publish";
  if (m === "trend.research" || m === "trend_research") return "trend";
  if (m === "meta.comment_reply" || m === "meta_comment_reply") return "meta_comment";
  return m;
}

export function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

export function unwrapContentPackFromProposalPayload(p) {
  if (!p || typeof p !== "object") return null;
  if (p.payload && typeof p.payload === "object") return deepFix(p.payload);
  return deepFix(p);
}

export function statusForMode(mode) {
  const m = normalizeMode(mode);
  if (m === "draft") return "in_progress";
  if (m === "revise") return "in_progress";
  if (m === "publish") return "approved";
  if (m === "trend") return "approved";
  if (m === "proposal") return "pending";
  return "pending";
}

export function buildCronMessage({ mode, tenantId, formatHint }) {
  const today = new Date().toISOString().slice(0, 10);

  if (mode === "draft") {
    return `
AUTO_DRAFT (${today})
Tenant=${tenantId}
${formatHint ? `Preferred format: ${formatHint}` : ""}

Generate today's social content draft for this tenant.
Return STRICT JSON ONLY as usecase requires.
    `.trim();
  }

  if (mode === "trend") {
    return `
AUTO_TREND (${today})
Tenant=${tenantId}

Generate a practical trend brief for this tenant.
Return STRICT JSON ONLY as usecase requires.
    `.trim();
  }

  return "";
}

export function normalizeDebateRequestBody(body) {
  const mode = normalizeMode(body?.mode);
  const rounds = body?.rounds;
  const agents = Array.isArray(body?.agents) ? body.agents : null;

  const formatHintRaw = body?.formatHint ?? body?.FORMAT ?? body?.format ?? "";
  const formatHint = fixText(String(formatHintRaw || "").trim());

  const threadId = String(body?.threadId || "").trim();
  const message = fixText(String(body?.message || "").trim());

  return {
    message,
    mode,
    rounds,
    agents,
    formatHint,
    threadId,
  };
}
