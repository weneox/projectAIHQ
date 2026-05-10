import { apiGet, apiPost } from "./client.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

export async function listKnowledgeSources({ limit = 100, status = "", sourceType = "" } = {}) {
  const search = new URLSearchParams();
  search.set("limit", String(limit));

  if (s(status)) search.set("status", s(status));
  if (s(sourceType)) search.set("sourceType", s(sourceType));

  return apiGet(`/api/settings/sources?${search.toString()}`);
}

export async function syncKnowledgeSource(sourceId) {
  return apiPost(`/api/settings/sources/${encodeURIComponent(s(sourceId))}/sync`, {
    runnerKey: "settings.manual",
    runType: "sync",
    triggerType: "manual",
  });
}
