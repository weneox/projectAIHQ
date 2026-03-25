import { fixText } from "../../../utils/textFix.js";

export function s(v, d = "") {
  return String(v ?? d).trim();
}

export function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function normalizeChatBody(body) {
  const agentId = s(body?.agentId || "orion").toLowerCase() || "orion";
  const message = fixText(s(body?.message));
  const usecase = s(body?.usecase) || undefined;
  const tenant = isObj(body?.tenant) ? body.tenant : null;
  const today = s(body?.today);
  const format = s(body?.format);
  const extra = isObj(body?.extra) ? body.extra : {};
  const threadId = s(body?.threadId);

  return {
    agentId,
    message,
    usecase,
    tenant,
    today,
    format,
    extra,
    threadId,
  };
}