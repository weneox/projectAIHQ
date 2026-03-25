import { fixText, deepFix } from "../../../utils/textFix.js";

export function s(v, d = "") {
  return String(v ?? d).trim();
}

export function normalizeThreadId(v) {
  return s(v);
}

export function normalizeRole(v) {
  return s(v || "user") || "user";
}

export function normalizeAgent(v) {
  return s(v) || null;
}

export function normalizeContent(v) {
  return fixText(s(v));
}

export function normalizeMessageRow(row) {
  if (!row || typeof row !== "object") return row;
  return {
    ...row,
    content: fixText(row.content),
    meta: deepFix(row.meta),
  };
}