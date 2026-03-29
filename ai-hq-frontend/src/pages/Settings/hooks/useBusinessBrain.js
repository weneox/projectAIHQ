import { useCallback } from "react";

import {
  getTenantBusinessFacts,
  saveTenantBusinessFact,
  deleteTenantBusinessFact,
  getTenantChannelPolicies,
  saveTenantChannelPolicy,
  deleteTenantChannelPolicy,
  getTenantLocations,
  saveTenantLocation,
  deleteTenantLocation,
  getTenantContacts,
  saveTenantContact,
  deleteTenantContact,
} from "../../../api/settings.js";
import { syncWorkspaceAndInitial } from "../settingsShared.js";
import { useSettingsSurfaceState } from "./useSettingsSurfaceState.js";

function emptyBusinessBrainData() {
  return {
    businessFacts: [],
    channelPolicies: [],
    locations: [],
    contacts: [],
  };
}

function pickGovernedSaveMessage(result, fallback = "") {
  if (result?.publishStatus === "review_required" || result?.reviewRequired === true) {
    return "Staged for maintenance review.";
  }
  return fallback;
}

export function useBusinessBrain({
  canManageSettings,
  setWorkspace,
  setInitialWorkspace,
}) {
  const {
    data,
    setData,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
    beginSave,
    succeedSave,
    failSave,
    clearSaveState,
  } = useSettingsSurfaceState({
    initialData: emptyBusinessBrainData,
    initialLoading: true,
  });

  const businessFacts = data.businessFacts || [];
  const channelPolicies = data.channelPolicies || [];
  const locations = data.locations || [];
  const contacts = data.contacts || [];

  const setBusinessFacts = useCallback(
    (nextValue) => {
      setData((prev) => ({
        ...prev,
        businessFacts:
          typeof nextValue === "function" ? nextValue(prev.businessFacts || []) : nextValue,
      }));
    },
    [setData]
  );

  const setChannelPolicies = useCallback(
    (nextValue) => {
      setData((prev) => ({
        ...prev,
        channelPolicies:
          typeof nextValue === "function" ? nextValue(prev.channelPolicies || []) : nextValue,
      }));
    },
    [setData]
  );

  const setLocations = useCallback(
    (nextValue) => {
      setData((prev) => ({
        ...prev,
        locations: typeof nextValue === "function" ? nextValue(prev.locations || []) : nextValue,
      }));
    },
    [setData]
  );

  const setContacts = useCallback(
    (nextValue) => {
      setData((prev) => ({
        ...prev,
        contacts: typeof nextValue === "function" ? nextValue(prev.contacts || []) : nextValue,
      }));
    },
    [setData]
  );

  const refreshBusinessBrain = useCallback(async () => {
    beginRefresh();

    try {
      const [facts, policies, locs, conts] = await Promise.all([
        getTenantBusinessFacts(),
        getTenantChannelPolicies(),
        getTenantLocations(),
        getTenantContacts(),
      ]);

      const nextData = {
        businessFacts: Array.isArray(facts) ? facts : [],
        channelPolicies: Array.isArray(policies) ? policies : [],
        locations: Array.isArray(locs) ? locs : [],
        contacts: Array.isArray(conts) ? conts : [],
      };

      syncWorkspaceAndInitial({
        setWorkspace,
        setInitialWorkspace,
        patch: nextData,
      });

      return succeedRefresh(nextData);
    } catch (error) {
      return failRefresh(error, {
        fallbackData: emptyBusinessBrainData(),
      });
    }
  }, [beginRefresh, failRefresh, setInitialWorkspace, setWorkspace, succeedRefresh]);

  const runSaveAction = useCallback(
    async (action, successMessage) => {
      if (!canManageSettings) {
        failSave("This business brain surface is read-only for the current operator.");
        return null;
      }

      beginSave();

      try {
        const actionResult = await action();
        await refreshBusinessBrain();
        succeedSave({
          message:
            pickGovernedSaveMessage(actionResult, successMessage) || successMessage,
        });
        return true;
      } catch (error) {
        failSave(error);
        throw error;
      }
    },
    [beginSave, canManageSettings, failSave, refreshBusinessBrain, succeedSave]
  );

  const handleSaveBusinessFact = useCallback(
    async (payload) => runSaveAction(() => saveTenantBusinessFact(payload), "Business fact saved."),
    [runSaveAction]
  );

  const handleDeleteBusinessFact = useCallback(
    async (id) => {
      if (!id) return null;
      return runSaveAction(() => deleteTenantBusinessFact(id), "Business fact deleted.");
    },
    [runSaveAction]
  );

  const handleSaveChannelPolicy = useCallback(
    async (payload) =>
      runSaveAction(() => saveTenantChannelPolicy(payload), "Channel policy saved."),
    [runSaveAction]
  );

  const handleDeleteChannelPolicy = useCallback(
    async (id) => {
      if (!id) return null;
      return runSaveAction(() => deleteTenantChannelPolicy(id), "Channel policy deleted.");
    },
    [runSaveAction]
  );

  const handleSaveLocation = useCallback(
    async (payload) => runSaveAction(() => saveTenantLocation(payload), "Location saved."),
    [runSaveAction]
  );

  const handleDeleteLocation = useCallback(
    async (id) => {
      if (!id) return null;
      return runSaveAction(() => deleteTenantLocation(id), "Location deleted.");
    },
    [runSaveAction]
  );

  const handleSaveContact = useCallback(
    async (payload) => runSaveAction(() => saveTenantContact(payload), "Contact saved."),
    [runSaveAction]
  );

  const handleDeleteContact = useCallback(
    async (id) => {
      if (!id) return null;
      return runSaveAction(() => deleteTenantContact(id), "Contact deleted.");
    },
    [runSaveAction]
  );

  return {
    surface: {
      ...surface,
      refresh: refreshBusinessBrain,
      clearSaveState,
    },
    businessFacts,
    setBusinessFacts,
    channelPolicies,
    setChannelPolicies,
    locations,
    setLocations,
    contacts,
    setContacts,
    refreshBusinessBrain,
    handleSaveBusinessFact,
    handleDeleteBusinessFact,
    handleSaveChannelPolicy,
    handleDeleteChannelPolicy,
    handleSaveLocation,
    handleDeleteLocation,
    handleSaveContact,
    handleDeleteContact,
  };
}
