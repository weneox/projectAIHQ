import { deepFix, fixText } from "../../../utils/textFix.js";
import { resolveTenantKey, getDefaultTenantKey } from "../../../tenancy/index.js";

export function s(v) {
  return String(v ?? "").trim();
}

export function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function getResolvedTenantKey(tenantKey) {
  return resolveTenantKey(tenantKey, getDefaultTenantKey());
}

export function normalizePriority(v) {
  const x = fixText(s(v || "normal")).toLowerCase() || "normal";
  return ["low", "normal", "high", "urgent"].includes(x) ? x : "normal";
}

export function normalizeStage(v) {
  const x = fixText(s(v || "new")).toLowerCase() || "new";
  return ["new", "contacted", "qualified", "proposal", "won", "lost"].includes(x)
    ? x
    : "new";
}

export function normalizeStatus(v) {
  const x = fixText(s(v || "open")).toLowerCase() || "open";
  return ["open", "archived", "spam", "closed"].includes(x) ? x : "open";
}

export function normalizeLead(row) {
  if (!row) return row;
  return {
    ...row,
    tenant_key: getResolvedTenantKey(row.tenant_key),
    full_name: fixText(row.full_name || ""),
    username: fixText(row.username || ""),
    company: fixText(row.company || ""),
    phone: fixText(row.phone || ""),
    email: fixText(row.email || ""),
    interest: fixText(row.interest || ""),
    notes: fixText(row.notes || ""),
    owner: fixText(row.owner || ""),
    priority: normalizePriority(row.priority || "normal"),
    next_action: fixText(row.next_action || ""),
    won_reason: fixText(row.won_reason || ""),
    lost_reason: fixText(row.lost_reason || ""),
    value_azn: Number(row.value_azn || 0),
    extra: deepFix(row.extra || {}),
  };
}

export function normalizeLeadEvent(row) {
  if (!row) return row;
  return {
    ...row,
    tenant_key: getResolvedTenantKey(row.tenant_key),
    actor: fixText(row.actor || ""),
    type: fixText(row.type || ""),
    payload: deepFix(row.payload || {}),
  };
}

export function cleanLeadPayload(body = {}) {
  return {
    tenantKey: getResolvedTenantKey(body?.tenantKey),
    source: fixText(s(body?.source || "manual")) || "manual",
    sourceRef: fixText(s(body?.sourceRef || "")) || null,
    inboxThreadId: s(body?.inboxThreadId || "") || null,
    proposalId: s(body?.proposalId || "") || null,
    fullName: fixText(s(body?.fullName || "")) || null,
    username: fixText(s(body?.username || "")) || null,
    company: fixText(s(body?.company || "")) || null,
    phone: fixText(s(body?.phone || "")) || null,
    email: fixText(s(body?.email || "")) || null,
    interest: fixText(s(body?.interest || "")) || null,
    notes: fixText(s(body?.notes || "")) || "",
    stage: normalizeStage(body?.stage || "new"),
    score: num(body?.score, 0),
    status: normalizeStatus(body?.status || "open"),
    owner: fixText(s(body?.owner || "")) || null,
    priority: normalizePriority(body?.priority || "normal"),
    valueAzn: num(body?.valueAzn ?? body?.value_azn, 0),
    followUpAt: s(body?.followUpAt || body?.follow_up_at || "") || null,
    nextAction: fixText(s(body?.nextAction || body?.next_action || "")) || null,
    wonReason: fixText(s(body?.wonReason || body?.won_reason || "")) || null,
    lostReason: fixText(s(body?.lostReason || body?.lost_reason || "")) || null,
    extra: body?.extra && typeof body.extra === "object" ? body.extra : {},
  };
}