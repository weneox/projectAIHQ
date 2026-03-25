import { useMemo, useState } from "react";

import {
  getWorkspaceSettings,
  saveWorkspaceSettings,
  getWorkspaceAgents,
  saveWorkspaceAgent,
} from "../../../api/settings.js";
import { isSettingsDirty, buildSettingsDirtyMap } from "../../../lib/settingsState.js";
import {
  buildSafeWorkspaceSavePayload,
  normalizeWorkspace,
  syncWorkspaceAndInitial,
} from "../settingsShared.js";

function emptyWorkspace() {
  return normalizeWorkspace({
    tenant: { tenant_key: "neox" },
    profile: {},
    aiPolicy: {},
    viewerRole: "owner",
    agents: [],
    businessFacts: [],
    channelPolicies: [],
    locations: [],
    contacts: [],
    sources: [],
    knowledgeReview: [],
  });
}

export function useSettingsWorkspace({ setMessage }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workspace, setWorkspace] = useState(emptyWorkspace);
  const [initialWorkspace, setInitialWorkspace] = useState(emptyWorkspace);
  const [agents, setAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(true);

  const dirty = useMemo(() => isSettingsDirty(workspace, initialWorkspace), [workspace, initialWorkspace]);
  const dirtyMap = useMemo(
    () => buildSettingsDirtyMap(workspace, initialWorkspace),
    [workspace, initialWorkspace]
  );

  const viewerRole = String(workspace?.viewerRole || "owner").toLowerCase();
  const canManageSettings = viewerRole === "owner" || viewerRole === "admin";
  const tenantKey = String(workspace?.tenantKey || initialWorkspace?.tenantKey || "neox").trim() || "neox";

  function patchTenant(key, value) {
    if (!canManageSettings) return;
    setWorkspace((prev) => ({ ...prev, tenant: { ...prev.tenant, [key]: value } }));
  }

  function patchProfile(key, value) {
    if (!canManageSettings) return;
    setWorkspace((prev) => ({ ...prev, profile: { ...prev.profile, [key]: value } }));
  }

  function patchAi(key, value) {
    if (!canManageSettings) return;
    setWorkspace((prev) => ({ ...prev, aiPolicy: { ...prev.aiPolicy, [key]: value } }));
  }

  async function loadWorkspaceBase() {
    const settings = await getWorkspaceSettings();
    const detectedTenantKey =
      String(settings?.tenant?.tenant_key || settings?.tenantKey || "neox").trim() || "neox";
    const ag = await getWorkspaceAgents().catch(() => []);

    const normalized = normalizeWorkspace({
      ...settings,
      tenantKey: detectedTenantKey,
      agents: Array.isArray(ag) ? ag : [],
    });

    setWorkspace(normalized);
    setInitialWorkspace(normalized);
    setAgents(normalized.agents);
    return { normalized, tenantKey: detectedTenantKey };
  }

  function applyDomainSlices(patch) {
    syncWorkspaceAndInitial({
      setWorkspace,
      setInitialWorkspace,
      patch,
    });
  }

  async function onSaveWorkspace(extraSlices = {}) {
    if (!canManageSettings) {
      setMessage("Bu hissəni yalnız owner/admin dəyişə bilər.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const payload = buildSafeWorkspaceSavePayload(workspace);
      const res = await saveWorkspaceSettings(payload);

      const normalized = normalizeWorkspace({
        ...res,
        tenantKey,
        agents,
        ...extraSlices,
      });

      setWorkspace(normalized);
      setInitialWorkspace(normalized);
      setMessage("✅ Workspace settings yadda saxlanıldı.");
    } catch (e) {
      setMessage(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  function onResetWorkspace() {
    const reset = initialWorkspace;
    setWorkspace(reset);
    setAgents(Array.isArray(reset?.agents) ? reset.agents : []);
    setMessage("↩️ Dəyişikliklər geri qaytarıldı.");
    return reset;
  }

  async function saveAgent(agentKey, payload) {
    if (!canManageSettings) {
      setMessage("Agent dəyişiklikləri yalnız owner/admin üçündür.");
      return;
    }

    try {
      await saveWorkspaceAgent(agentKey, {
        display_name: payload.display_name,
        role_summary: payload.role_summary,
        enabled: payload.enabled,
        model: payload.model,
        temperature: payload.temperature,
        prompt_overrides: payload.prompt_overrides || {},
        tool_access: payload.tool_access || {},
        limits: payload.limits || {},
      });

      const ag = await getWorkspaceAgents();
      const nextAgents = Array.isArray(ag) ? ag : [];
      setAgents(nextAgents);
      syncWorkspaceAndInitial({
        setWorkspace,
        setInitialWorkspace,
        patch: { agents: nextAgents },
      });
      setMessage(`✅ ${agentKey} agent yeniləndi.`);
    } catch (e) {
      setMessage(String(e?.message || e));
    }
  }

  return {
    loading,
    setLoading,
    saving,
    workspace,
    setWorkspace,
    initialWorkspace,
    setInitialWorkspace,
    agents,
    setAgents,
    agentsLoading,
    setAgentsLoading,
    dirty,
    dirtyMap,
    canManageSettings,
    tenantKey,
    patchTenant,
    patchProfile,
    patchAi,
    loadWorkspaceBase,
    applyDomainSlices,
    onSaveWorkspace,
    onResetWorkspace,
    saveAgent,
  };
}
