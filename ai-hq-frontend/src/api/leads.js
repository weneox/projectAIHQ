import { apiGet } from "./client.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

export async function listLeads({
  q = "",
  stage = "",
  status = "",
  owner = "",
  priority = "",
  limit = 100,
} = {}) {
  const search = new URLSearchParams();

  if (s(q)) search.set("q", s(q));
  if (s(stage)) search.set("stage", s(stage));
  if (s(status)) search.set("status", s(status));
  if (s(owner)) search.set("owner", s(owner));
  if (s(priority)) search.set("priority", s(priority));
  search.set("limit", String(Math.max(1, Math.min(200, Number(limit || 100)))));

  return apiGet(`/api/leads?${search.toString()}`);
}
