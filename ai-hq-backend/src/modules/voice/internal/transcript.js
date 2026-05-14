import { s } from "../shared.js";
import { lower } from "./primitives.js";

export function buildTranscriptFingerprint(input = {}) {
  return [s(input.ts), lower(input.role || "customer"), s(input.text)].join("|");
}

export function isDuplicateTranscriptFrame(items = [], nextItem = {}) {
  if (!Array.isArray(items) || !items.length) return false;
  const nextFingerprint = buildTranscriptFingerprint(nextItem);
  return items.some((item) => buildTranscriptFingerprint(item) === nextFingerprint);
}

export function buildTranscriptLine(role = "", text = "") {
  return `[${s(role)}] ${s(text)}`;
}
