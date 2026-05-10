import { apiGet } from "./client.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

export async function getReportsOverview({ range = "7d" } = {}) {
  const search = new URLSearchParams();
  search.set("range", s(range, "7d"));

  return apiGet(`/api/reports/overview?${search.toString()}`);
}
