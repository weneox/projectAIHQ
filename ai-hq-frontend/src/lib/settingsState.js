// src/lib/settingsState.js
// FINAL v2.2 — settings dirty helpers aligned with tenant business brain + source intelligence

function stableSortObject(value) {
  if (Array.isArray(value)) {
    return value.map(stableSortObject);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableSortObject(value[key]);
        return acc;
      }, {});
  }

  return value;
}

export function stableStringify(value) {
  try {
    return JSON.stringify(stableSortObject(value));
  } catch {
    return "";
  }
}

export function isSettingsDirty(currentValue, initialValue) {
  return stableStringify(currentValue) !== stableStringify(initialValue);
}

export function buildSettingsDirtyMap(currentWorkspace, initialWorkspace) {
  return {
    general: isSettingsDirty(
      currentWorkspace?.tenant || {},
      initialWorkspace?.tenant || {}
    ),

    brand: isSettingsDirty(
      currentWorkspace?.profile || {},
      initialWorkspace?.profile || {}
    ),

    ai_policy: isSettingsDirty(
      currentWorkspace?.aiPolicy || {},
      initialWorkspace?.aiPolicy || {}
    ),

    business_facts: isSettingsDirty(
      currentWorkspace?.businessFacts || [],
      initialWorkspace?.businessFacts || []
    ),

    channel_policies: isSettingsDirty(
      currentWorkspace?.channelPolicies || [],
      initialWorkspace?.channelPolicies || []
    ),

    locations: isSettingsDirty(
      currentWorkspace?.locations || [],
      initialWorkspace?.locations || []
    ),

    contacts: isSettingsDirty(
      currentWorkspace?.contacts || [],
      initialWorkspace?.contacts || []
    ),

    agents: isSettingsDirty(
      currentWorkspace?.agents || [],
      initialWorkspace?.agents || []
    ),

    // new source intelligence layer
    sources: isSettingsDirty(
      currentWorkspace?.sources || [],
      initialWorkspace?.sources || []
    ),

    knowledge_review: isSettingsDirty(
      currentWorkspace?.knowledgeReview || [],
      initialWorkspace?.knowledgeReview || []
    ),

    // keep these false until full sync/save lifecycle is deliberately wired
    channels: false,
    team: false,
    notifications: false,
  };
}