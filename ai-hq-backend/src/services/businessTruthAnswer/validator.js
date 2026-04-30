import { s } from "./normalize.js";

export function validateApprovedTruthAnswer({ replyText = "", factsUsed = [] } = {}) {
  const text = s(replyText);

  if (!text) {
    return {
      ok: false,
      reason: "empty_reply",
    };
  }

  return {
    ok: true,
    reason: "",
    factsUsed,
  };
}