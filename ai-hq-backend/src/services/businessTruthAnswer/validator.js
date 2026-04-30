import { s } from "./normalize.js";

export function validateApprovedTruthAnswer({ replyText = "" } = {}) {
  if (!s(replyText)) {
    return {
      ok: false,
      reason: "empty_reply",
    };
  }

  return {
    ok: true,
    reason: "",
  };
}