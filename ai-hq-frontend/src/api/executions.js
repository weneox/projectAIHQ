import { apiGet, apiPost } from "./client.js";

export async function listExecutions({ status = "", limit = 50 } = {}) {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (limit) qs.set("limit", String(limit));
  const j = await apiGet(`/api/executions?${qs.toString()}`);
  return j.executions || [];
}

export async function getExecution(id) {
  const j = await apiGet(`/api/executions/${encodeURIComponent(String(id))}`);
  return j.execution;
}

export async function listDurableExecutions({
  status = "",
  limit = 100,
} = {}) {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (limit) qs.set("limit", String(limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const j = await apiGet(`/api/executions/durable${suffix}`);
  return Array.isArray(j.executions) ? j.executions : [];
}

export async function getDurableExecutionSummary() {
  const j = await apiGet("/api/executions/durable/summary");
  return j.summary || null;
}

export async function getDurableExecution(id) {
  const j = await apiGet(`/api/executions/durable/${encodeURIComponent(String(id))}`);
  return {
    execution: j.execution || null,
    attempts: Array.isArray(j.attempts) ? j.attempts : [],
    auditTrail: Array.isArray(j.auditTrail) ? j.auditTrail : [],
  };
}

export async function retryDurableExecution(id) {
  const j = await apiPost(`/api/executions/durable/${encodeURIComponent(String(id))}/retry`, {});
  return {
    execution: j.execution || null,
    auditTrail: Array.isArray(j.auditTrail) ? j.auditTrail : [],
  };
}
