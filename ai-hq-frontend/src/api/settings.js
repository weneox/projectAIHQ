// src/api/settings.js
// FINAL v2.1
// ============================================================
// Settings API
// ============================================================

import { apiGet, apiPost, apiPatch, apiDelete } from "./client.js";

function qsFrom(params = {}) {
  const qs = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value == null) return;
    if (typeof value === "string" && !value.trim()) return;
    qs.set(key, String(value));
  });

  const s = qs.toString();
  return s ? `?${s}` : "";
}

function ensureOk(j, fallback) {
  if (!j?.ok) throw new Error(j?.error || fallback);
  return j;
}

// ---------------------------------------------------------
// workspace
// ---------------------------------------------------------

export async function getWorkspaceSettings() {
  const j = await apiGet(`/api/settings/workspace`);
  ensureOk(j, "Failed to load workspace settings");
  return j;
}

export async function saveWorkspaceSettings(payload) {
  const j = await apiPost(`/api/settings/workspace`, payload);
  ensureOk(j, "Failed to save workspace settings");
  return j;
}

// ---------------------------------------------------------
// channels
// ---------------------------------------------------------

export async function getWorkspaceChannels() {
  const j = await apiGet(`/api/settings/channels`);
  ensureOk(j, "Failed to load channels");
  return Array.isArray(j?.channels) ? j.channels : [];
}

export async function saveWorkspaceChannel(channelType, payload) {
  const t = encodeURIComponent(String(channelType || "").trim().toLowerCase());
  const j = await apiPost(`/api/settings/channels/${t}`, payload);
  ensureOk(j, "Failed to save channel");
  return j?.channel || j;
}

// ---------------------------------------------------------
// operational control plane
// ---------------------------------------------------------

export async function getOperationalSettings() {
  const j = await apiGet(`/api/settings/operational`);
  ensureOk(j, "Failed to load operational settings");
  return j;
}

export async function saveOperationalVoiceSettings(payload) {
  const j = await apiPost(`/api/settings/operational/voice`, payload);
  ensureOk(j, "Failed to save voice operational settings");
  return j;
}

export async function saveOperationalChannelSettings(channelType, payload) {
  const t = encodeURIComponent(String(channelType || "").trim().toLowerCase());
  const j = await apiPost(`/api/settings/operational/channels/${t}`, payload);
  ensureOk(j, "Failed to save operational channel");
  return j;
}

// ---------------------------------------------------------
// agents
// ---------------------------------------------------------

export async function getWorkspaceAgents() {
  const j = await apiGet(`/api/settings/agents`);
  ensureOk(j, "Failed to load agents");
  return Array.isArray(j?.agents) ? j.agents : [];
}

export async function saveWorkspaceAgent(agentKey, payload) {
  const k = encodeURIComponent(String(agentKey || "").trim().toLowerCase());
  const j = await apiPost(`/api/settings/agents/${k}`, payload);
  ensureOk(j, "Failed to save agent");
  return j?.agent || j;
}

// ---------------------------------------------------------
// Meta channel
// ---------------------------------------------------------

export async function getMetaChannelStatus() {
  const j = await apiGet(`/api/channels/meta/status`);
  ensureOk(j, "Failed to load Meta channel status");
  return j;
}

export async function getMetaConnectUrl() {
  const j = await apiGet(`/api/channels/meta/connect-url`);
  if (!j?.ok || !j?.url) {
    throw new Error(j?.error || "Failed to build Meta connect URL");
  }
  return j.url;
}

export async function disconnectMetaChannel() {
  const j = await apiPost(`/api/channels/meta/disconnect`, {});
  ensureOk(j, "Failed to disconnect Meta");
  return j;
}

// ---------------------------------------------------------
// tenant business facts
// ---------------------------------------------------------

export async function getTenantBusinessFacts(params = {}) {
  const suffix = qsFrom({
    language: params.language ? String(params.language).trim().toLowerCase() : "",
    factGroup: params.factGroup ? String(params.factGroup).trim().toLowerCase() : "",
  });

  const j = await apiGet(`/api/settings/business-facts${suffix}`);
  ensureOk(j, "Failed to load business facts");
  return Array.isArray(j?.facts) ? j.facts : [];
}

export async function saveTenantBusinessFact(payload) {
  const j = await apiPost(`/api/settings/business-facts`, payload);
  ensureOk(j, "Failed to save business fact");
  return j?.fact || j;
}

export async function deleteTenantBusinessFact(id) {
  const x = encodeURIComponent(String(id || "").trim());
  const j = await apiDelete(`/api/settings/business-facts/${x}`);
  ensureOk(j, "Failed to delete business fact");
  return j;
}

// ---------------------------------------------------------
// tenant channel policies
// ---------------------------------------------------------

export async function getTenantChannelPolicies() {
  const j = await apiGet(`/api/settings/channel-policies`);
  ensureOk(j, "Failed to load channel policies");
  return Array.isArray(j?.policies) ? j.policies : [];
}

export async function saveTenantChannelPolicy(payload) {
  const j = await apiPost(`/api/settings/channel-policies`, payload);
  ensureOk(j, "Failed to save channel policy");
  return j?.policy || j;
}

export async function deleteTenantChannelPolicy(id) {
  const x = encodeURIComponent(String(id || "").trim());
  const j = await apiDelete(`/api/settings/channel-policies/${x}`);
  ensureOk(j, "Failed to delete channel policy");
  return j;
}

// ---------------------------------------------------------
// tenant locations
// ---------------------------------------------------------

export async function getTenantLocations() {
  const j = await apiGet(`/api/settings/locations`);
  ensureOk(j, "Failed to load locations");
  return Array.isArray(j?.locations) ? j.locations : [];
}

export async function saveTenantLocation(payload) {
  const j = await apiPost(`/api/settings/locations`, payload);
  ensureOk(j, "Failed to save location");
  return j?.location || j;
}

export async function deleteTenantLocation(id) {
  const x = encodeURIComponent(String(id || "").trim());
  const j = await apiDelete(`/api/settings/locations/${x}`);
  ensureOk(j, "Failed to delete location");
  return j;
}

// ---------------------------------------------------------
// tenant contacts
// ---------------------------------------------------------

export async function getTenantContacts() {
  const j = await apiGet(`/api/settings/contacts`);
  ensureOk(j, "Failed to load contacts");
  return Array.isArray(j?.contacts) ? j.contacts : [];
}

export async function saveTenantContact(payload) {
  const j = await apiPost(`/api/settings/contacts`, payload);
  ensureOk(j, "Failed to save contact");
  return j?.contact || j;
}

export async function deleteTenantContact(id) {
  const x = encodeURIComponent(String(id || "").trim());
  const j = await apiDelete(`/api/settings/contacts/${x}`);
  ensureOk(j, "Failed to delete contact");
  return j;
}

// ---------------------------------------------------------
// sources
// ---------------------------------------------------------

export async function listSettingsSources(params = {}) {
  const suffix = qsFrom({
    tenantId: params.tenantId,
    tenantKey: params.tenantKey,
    sourceType: params.sourceType,
    status: params.status,
    isEnabled:
      typeof params.isEnabled === "boolean" ? String(params.isEnabled) : undefined,
    limit: params.limit,
    offset: params.offset,
  });

  const j = await apiGet(`/api/settings/sources${suffix}`);
  ensureOk(j, "Failed to load sources");
  return {
    tenantId: j?.tenantId || "",
    tenantKey: j?.tenantKey || "",
    items: Array.isArray(j?.items) ? j.items : [],
    count: Number(j?.count || 0),
  };
}

export async function createSettingsSource(payload) {
  const j = await apiPost(`/api/settings/sources`, payload);
  ensureOk(j, "Failed to create source");
  return j?.item || j;
}

export async function updateSettingsSource(id, payload) {
  const x = encodeURIComponent(String(id || "").trim());
  const j = await apiPatch(`/api/settings/sources/${x}`, payload);
  ensureOk(j, "Failed to update source");
  return j?.item || j;
}

export async function getSettingsSourceSyncRuns(id, params = {}) {
  const x = encodeURIComponent(String(id || "").trim());
  const suffix = qsFrom({
    tenantId: params.tenantId,
    tenantKey: params.tenantKey,
    status: params.status,
    limit: params.limit,
    offset: params.offset,
  });

  const j = await apiGet(`/api/settings/sources/${x}/sync-runs${suffix}`);
  ensureOk(j, "Failed to load source sync runs");
  return {
    source: j?.source || null,
    items: Array.isArray(j?.items) ? j.items : [],
    count: Number(j?.count || 0),
  };
}

export async function startSettingsSourceSync(id, payload = {}) {
  const x = encodeURIComponent(String(id || "").trim());
  const j = await apiPost(`/api/settings/sources/${x}/sync`, payload);
  ensureOk(j, "Failed to start source sync");
  return {
    accepted: !!j?.accepted,
    message: j?.message || "",
    status: j?.status || "",
    poll: j?.poll || null,
    review: j?.review || null,
    source: j?.source || null,
    run: j?.run || null,
  };
}

export async function getSettingsTrustSummary(params = {}) {
  const suffix = qsFrom({
    tenantId: params.tenantId,
    tenantKey: params.tenantKey,
    limit: params.limit,
  });

  const j = await apiGet(`/api/settings/trust${suffix}`);
  ensureOk(j, "Failed to load settings trust summary");
  return {
    tenantId: j?.tenantId || "",
    tenantKey: j?.tenantKey || "",
    summary:
      j?.summary && typeof j.summary === "object" && !Array.isArray(j.summary)
        ? j.summary
        : {},
    recentRuns: Array.isArray(j?.recentRuns) ? j.recentRuns : [],
    audit: Array.isArray(j?.audit) ? j.audit : [],
  };
}

// ---------------------------------------------------------
// knowledge review
// ---------------------------------------------------------

export async function listKnowledgeReviewQueue(params = {}) {
  const suffix = qsFrom({
    tenantId: params.tenantId,
    tenantKey: params.tenantKey,
    category: params.category,
    limit: params.limit,
    offset: params.offset,
  });

  const j = await apiGet(`/api/settings/knowledge/review-queue${suffix}`);
  ensureOk(j, "Failed to load knowledge review queue");
  return {
    tenantId: j?.tenantId || "",
    tenantKey: j?.tenantKey || "",
    items: Array.isArray(j?.items) ? j.items : [],
    count: Number(j?.count || 0),
  };
}

export async function approveKnowledgeCandidate(candidateId, payload = {}) {
  const x = encodeURIComponent(String(candidateId || "").trim());
  const j = await apiPost(`/api/settings/knowledge/${x}/approve`, payload);
  ensureOk(j, "Failed to approve knowledge candidate");
  return {
    candidate: j?.candidate || null,
    knowledge: j?.knowledge || null,
    approval: j?.approval || null,
  };
}

export async function rejectKnowledgeCandidate(candidateId, payload = {}) {
  const x = encodeURIComponent(String(candidateId || "").trim());
  const j = await apiPost(`/api/settings/knowledge/${x}/reject`, payload);
  ensureOk(j, "Failed to reject knowledge candidate");
  return {
    candidate: j?.candidate || null,
    approval: j?.approval || null,
  };
}
