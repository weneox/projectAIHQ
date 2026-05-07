import { apiGet } from "./client.js";

const ALLOWED_RANGES = new Set(["24h", "7d", "30d", "90d"]);

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeRange(range = "7d") {
  const value = s(range, "7d").toLowerCase();
  return ALLOWED_RANGES.has(value) ? value : "7d";
}

export async function getReportsOverview({ range = "7d" } = {}) {
  const search = new URLSearchParams();
  search.set("range", normalizeRange(range));

  return apiGet(`/api/reports/overview?${search.toString()}`);
}