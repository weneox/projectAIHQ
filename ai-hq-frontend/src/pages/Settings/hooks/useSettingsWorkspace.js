import { useCallback, useMemo, useState } from "react";

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
import { useSettingsSurfaceState } from "./useSettingsSurfaceState.js";

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

export function useSettingsWorkspace() {
  const {
    data: workspace,
    setData: setWorkspace,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
    beginSave,
    succeedSave,
    failSave,
    clearSaveState,
  } = useSettingsSurfaceState({
    initialData: emptyWorkspace,
    initialLoading: true,
  });
  const [initialWorkspace, setInitialWorkspace] = useState(emptyWorkspace);
  const [agents, setAgents] = useState([]);

  const dirty = useMemo(() => isSettingsDirty(workspace, initialWorkspace), [workspace, initialWorkspace]);
  const dirtyMap = useMemo(
    () => buildSettingsDirtyMap(workspace, initialWorkspace),
    [workspace, initialWorkspace]
  );

  const viewerRole = String(workspace?.viewerRole || "owner").toLowerCase();
  const canManageSettings = viewerRole === "owner" || viewerRole === "admin";
  const governedWorkspace = useMemo(
    () =>
      workspace?.governance && typeof workspace.governance === "object"
        ? workspace.governance
        : {},
    [workspace]
  );
  const canDirectEditGovernedWorkspace =
    !governedWorkspace?.directWorkspaceWritesBlocked;
  const tenantKey = String(workspace?.tenantKey || initialWorkspace?.tenantKey || "neox").trim() || "neox";

  const patchTenant = useCallback(
    (key, value) => {
      if (!canManageSettings || !canDirectEditGovernedWorkspace) return;
      setWorkspace((prev) => ({ ...prev, tenant: { ...prev.tenant, [key]: value } }));
    },
    [canDirectEditGovernedWorkspace, canManageSettings, setWorkspace]
  );

  const patchProfile = useCallback(
    (key, value) => {
      if (!canManageSettings || !canDirectEditGovernedWorkspace) return;
      setWorkspace((prev) => ({ ...prev, profile: { ...prev.profile, [key]: value } }));
    },
    [canDirectEditGovernedWorkspace, canManageSettings, setWorkspace]
  );

  const patchAi = useCallback(
    (key, value) => {
      if (!canManageSettings) return;
      setWorkspace((prev) => ({ ...prev, aiPolicy: { ...prev.aiPolicy, [key]: value } }));
    },
    [canManageSettings, setWorkspace]
  );

  const refreshWorkspace = useCallback(async () => {
    beginRefresh();

    try {
      const settings = await getWorkspaceSettings();
      const detectedTenantKey =
        String(settings?.tenant?.tenant_key || settings?.tenantKey || "neox").trim() || "neox";
      const ag = await getWorkspaceAgents().catch(() => []);
      const normalized = normalizeWorkspace({
        ...settings,
        tenantKey: detectedTenantKey,
        agents: Array.isArray(ag) ? ag : [],
      });

      setInitialWorkspace(normalized);
      setAgents(normalized.agents);
      succeedRefresh(normalized);
      return { normalized, tenantKey: detectedTenantKey };
    } catch (error) {
      failRefresh(error, {
        fallbackData: emptyWorkspace(),
      });
      return { normalized: emptyWorkspace(), tenantKey: "neox" };
    }
  }, [beginRefresh, failRefresh, setInitialWorkspace, succeedRefresh]);

  const applyDomainSlices = useCallback(
    (patch) => {
      syncWorkspaceAndInitial({
        setWorkspace,
        setInitialWorkspace,
        patch,
      });
    },
    [setWorkspace]
  );

  const onSaveWorkspace = useCallback(
    async (extraSlices = {}) => {
      if (!canManageSettings) {
        failSave("This workspace is read-only for the current operator.");
        return null;
      }

      beginSave();

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
        succeedSave({
          nextData: normalized,
          message: "Operational settings saved.",
        });
        return normalized;
      } catch (error) {
        failSave(error);
        throw error;
      }
    },
    [
      agents,
      beginSave,
      canManageSettings,
      failSave,
      succeedSave,
      tenantKey,
      workspace,
      setWorkspace,
    ]
  );

  const onResetWorkspace = useCallback(() => {
    const reset = initialWorkspace;
    setWorkspace(reset);
    setAgents(Array.isArray(reset?.agents) ? reset.agents : []);
    clearSaveState();
    return reset;
  }, [clearSaveState, initialWorkspace, setWorkspace]);

  const saveAgent = useCallback(
    async (agentKey, payload) => {
      if (!canManageSettings) {
        failSave("Agent changes are limited to owner/admin access.");
        return null;
      }

      beginSave();

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
        succeedSave({
          message: `${agentKey} agent updated.`,
        });
        return nextAgents;
      } catch (error) {
        failSave(error);
        throw error;
      }
    },
    [beginSave, canManageSettings, failSave, setWorkspace, succeedSave]
  );

  return {
    surface: {
      ...surface,
      refresh: refreshWorkspace,
      clearSaveState,
    },
    workspace,
    setWorkspace,
    initialWorkspace,
    setInitialWorkspace,
    agents,
    setAgents,
    dirty,
    dirtyMap,
    canManageSettings,
    canDirectEditGovernedWorkspace,
    governedWorkspace,
    tenantKey,
    patchTenant,
    patchProfile,
    patchAi,
    refreshWorkspace,
    applyDomainSlices,
    onSaveWorkspace,
    onResetWorkspace,
    saveAgent,
  };
}
