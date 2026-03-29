function normalize(value = "") {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]+/g, " ")
    .replace(/\s+/g, " ");
}

const INTENT_DEFINITIONS = [
  {
    id: "continue-setup",
    label: "Continue setup",
    phrases: ["continue setup", "finish setup", "open setup", "setup intake"],
    route: "/setup/studio",
    destinationSurface: "workspace",
  },
  {
    id: "review-business-changes",
    label: "Review business changes",
    phrases: [
      "review business changes",
      "review business memory",
      "review truth",
      "open truth",
      "business changes",
    ],
    route: "/truth",
    destinationSurface: "workspace",
  },
  {
    id: "open-inbox",
    label: "Open inbox",
    phrases: ["open inbox", "inbox", "check inbox", "review conversations"],
    route: "/inbox",
    destinationSurface: "inbox",
  },
  {
    id: "open-moderation-queue",
    label: "Open moderation queue",
    phrases: [
      "open moderation queue",
      "moderation queue",
      "open comments",
      "review comments",
    ],
    route: "/publish?focus=moderation",
    destinationSurface: "publish",
  },
  {
    id: "open-publishing-work",
    label: "Open publishing work",
    phrases: ["open publishing work", "open publishing", "publishing", "publish work"],
    route: "/publish",
    destinationSurface: "publish",
  },
  {
    id: "inspect-capability-issues",
    label: "Inspect capability issues",
    phrases: [
      "inspect capability issues",
      "capability issues",
      "show capabilities",
      "capability summary",
    ],
    route: "/workspace?focus=capabilities",
    destinationSurface: "workspace",
    focusSection: "capabilities",
  },
  {
    id: "inspect-blocked-items",
    label: "Inspect blocked items",
    phrases: ["inspect blocked items", "blocked items", "show blockers", "show decisions"],
    route: "/workspace?focus=decisions",
    destinationSurface: "workspace",
    focusSection: "decisions",
  },
  {
    id: "inspect-recent-outcomes",
    label: "Inspect recent outcomes",
    phrases: ["inspect recent outcomes", "recent outcomes", "show outcomes", "recent activity"],
    route: "/workspace?focus=outcomes",
    destinationSurface: "workspace",
    focusSection: "outcomes",
  },
];

function scoreIntent(input = "", intent = {}) {
  const query = normalize(input);
  if (!query) return 0;

  let score = 0;
  for (const phrase of intent.phrases || []) {
    const normalizedPhrase = normalize(phrase);
    if (!normalizedPhrase) continue;
    if (query === normalizedPhrase) score = Math.max(score, 100);
    else if (query.includes(normalizedPhrase)) {
      score = Math.max(score, normalizedPhrase.split(" ").length * 20);
    }
  }

  return score;
}

export function parseWorkspaceIntent(input = "") {
  const query = normalize(input);
  if (!query) return null;

  let best = null;
  let bestScore = 0;

  for (const intent of INTENT_DEFINITIONS) {
    const score = scoreIntent(query, intent);
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }

  return bestScore >= 20
    ? {
        ...best,
        query,
      }
    : null;
}

export function buildWorkspaceSuggestedActions(workspace = {}) {
  const actions = [];

  if (
    workspace.capabilities?.some(
      (item) => item.capability === "setup_intake" && item.requiresHuman
    )
  ) {
    actions.push(INTENT_DEFINITIONS[0]);
  }

  if (
    workspace.decisions?.some(
      (item) => item.relatedCapability === "business_memory"
    )
  ) {
    actions.push(INTENT_DEFINITIONS[1]);
  }

  if (
    workspace.capabilities?.some(
      (item) => item.capability === "inbox" && (item.requiresHuman || item.status === "limited")
    )
  ) {
    actions.push(INTENT_DEFINITIONS[2]);
  }

  if (
    workspace.capabilities?.some(
      (item) => item.capability === "comments" && item.requiresHuman
    )
  ) {
    actions.push(INTENT_DEFINITIONS[3]);
  }

  if (workspace.recentOutcomes?.length) {
    actions.push(INTENT_DEFINITIONS[7]);
  }

  if (
    workspace.capabilities?.some((item) =>
      ["blocked", "limited", "review_only"].includes(item.status)
    )
  ) {
    actions.push(INTENT_DEFINITIONS[5]);
  }

  const unique = new Map();
  for (const action of actions) {
    if (!unique.has(action.id)) unique.set(action.id, action);
  }

  return Array.from(unique.values()).slice(0, 5);
}

export function getWorkspaceIntentExamples() {
  return [
    "continue setup",
    "review business changes",
    "open inbox",
    "open moderation queue",
    "inspect capability issues",
  ];
}
