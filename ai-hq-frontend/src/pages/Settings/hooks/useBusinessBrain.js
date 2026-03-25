import { useState } from "react";

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

export function useBusinessBrain({
  canManageSettings,
  setWorkspace,
  setInitialWorkspace,
  setMessage,
}) {
  const [businessFacts, setBusinessFacts] = useState([]);
  const [channelPolicies, setChannelPolicies] = useState([]);
  const [locations, setLocations] = useState([]);
  const [contacts, setContacts] = useState([]);

  async function refreshBusinessBrain() {
    const [facts, policies, locs, conts] = await Promise.all([
      getTenantBusinessFacts().catch(() => []),
      getTenantChannelPolicies().catch(() => []),
      getTenantLocations().catch(() => []),
      getTenantContacts().catch(() => []),
    ]);

    const nextFacts = Array.isArray(facts) ? facts : [];
    const nextPolicies = Array.isArray(policies) ? policies : [];
    const nextLocations = Array.isArray(locs) ? locs : [];
    const nextContacts = Array.isArray(conts) ? conts : [];

    setBusinessFacts(nextFacts);
    setChannelPolicies(nextPolicies);
    setLocations(nextLocations);
    setContacts(nextContacts);

    syncWorkspaceAndInitial({
      setWorkspace,
      setInitialWorkspace,
      patch: {
        businessFacts: nextFacts,
        channelPolicies: nextPolicies,
        locations: nextLocations,
        contacts: nextContacts,
      },
    });

    return {
      businessFacts: nextFacts,
      channelPolicies: nextPolicies,
      locations: nextLocations,
      contacts: nextContacts,
    };
  }

  async function handleSaveBusinessFact(payload) {
    if (!canManageSettings) return;
    await saveTenantBusinessFact(payload);
    await refreshBusinessBrain();
    setMessage("✅ Business fact yadda saxlanıldı.");
  }

  async function handleDeleteBusinessFact(id) {
    if (!canManageSettings || !id) return;
    await deleteTenantBusinessFact(id);
    await refreshBusinessBrain();
    setMessage("✅ Business fact silindi.");
  }

  async function handleSaveChannelPolicy(payload) {
    if (!canManageSettings) return;
    await saveTenantChannelPolicy(payload);
    await refreshBusinessBrain();
    setMessage("✅ Channel policy yadda saxlanıldı.");
  }

  async function handleDeleteChannelPolicy(id) {
    if (!canManageSettings || !id) return;
    await deleteTenantChannelPolicy(id);
    await refreshBusinessBrain();
    setMessage("✅ Channel policy silindi.");
  }

  async function handleSaveLocation(payload) {
    if (!canManageSettings) return;
    await saveTenantLocation(payload);
    await refreshBusinessBrain();
    setMessage("✅ Location yadda saxlanıldı.");
  }

  async function handleDeleteLocation(id) {
    if (!canManageSettings || !id) return;
    await deleteTenantLocation(id);
    await refreshBusinessBrain();
    setMessage("✅ Location silindi.");
  }

  async function handleSaveContact(payload) {
    if (!canManageSettings) return;
    await saveTenantContact(payload);
    await refreshBusinessBrain();
    setMessage("✅ Contact yadda saxlanıldı.");
  }

  async function handleDeleteContact(id) {
    if (!canManageSettings || !id) return;
    await deleteTenantContact(id);
    await refreshBusinessBrain();
    setMessage("✅ Contact silindi.");
  }

  return {
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
