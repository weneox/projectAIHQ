import { ALL_SECTIONS } from "./shellNavigation.js";

const ASK_AI_SUGGESTIONS = [
  { id: "inbox", label: "Open Inbox", prompt: "open inbox" },
  { id: "brief", label: "Workspace brief", prompt: "summarize workspace status" },
  { id: "attention", label: "Needs attention", prompt: "what needs attention" },
  { id: "reply", label: "Draft reply", prompt: "draft reply" },
  { id: "channels", label: "Blocked channels", prompt: "show blocked channels" },
  { id: "setup", label: "Continue setup", prompt: "continue setup" },
];

const ROUTE_RESPONSES = [
  { matcher: /inbox|reply|message|thread/, to: "/inbox" },
  { matcher: /comment|moderation/, to: "/comments" },
  { matcher: /workspace|status|attention/, to: "/workspace" },
  { matcher: /blocked channel|launch scope|channel/, to: "/channels" },
  { matcher: /setup|onboard|continue/, to: "/setup" },
  { matcher: /truth|memory/, to: "/truth" },
];

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatCount(value, singular) {
  if (typeof value !== "number" || value <= 0) return null;
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
}

function formatWsState(value) {
  switch (String(value || "").toLowerCase()) {
    case "ready":
      return "Realtime connected";
    case "connecting":
      return "Realtime reconnecting";
    case "off":
      return "Realtime unavailable";
    default:
      return "Realtime idle";
  }
}

function findSectionForPath(pathname = "/") {
  return (
    ALL_SECTIONS.find(
      (section) =>
        pathname === section.to || pathname.startsWith(`${section.to}/`)
    ) || null
  );
}

function getFocusLabel({ pathname, shellSection, activeContextItem }) {
  const routeSection = findSectionForPath(pathname);

  return (
    activeContextItem?.label ||
    shellSection?.label ||
    routeSection?.label ||
    "Workspace"
  );
}

function getRouteAction(prompt) {
  const normalized = String(prompt || "").trim().toLowerCase();
  const match = ROUTE_RESPONSES.find((entry) => entry.matcher.test(normalized));

  if (!match) return null;

  const section = findSectionForPath(match.to);
  const autoNavigate = /^(open|show|continue|go to|take me)/.test(normalized);

  return {
    to: match.to,
    label: section ? `Open ${section.label}` : "Open surface",
    autoNavigate,
  };
}

function buildStatusSummary(shellStats = {}) {
  const parts = [
    formatCount(shellStats.inboxUnread, "unread item"),
    formatCount(shellStats.leadsOpen, "open lead"),
    formatWsState(shellStats.wsState),
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "Operator context ready";
}

function buildWorkspaceReply({ shellStats, focusLabel }) {
  const hot =
    (typeof shellStats?.inboxUnread === "number" && shellStats.inboxUnread > 0) ||
    (typeof shellStats?.leadsOpen === "number" && shellStats.leadsOpen > 0);

  return {
    kicker: "Workspace brief",
    title: "Current operator snapshot",
    summary: buildStatusSummary(shellStats),
    bullets: [
      `${focusLabel} is the active surface right now.`,
      shellStats?.inboxUnread > 0
        ? "Inbox is still the fastest path to reduce active load."
        : "Inbox looks calm enough to shift into setup or review work.",
      shellStats?.leadsOpen > 0
        ? "Pipeline still has follow-through waiting."
        : "Pipeline follow-through looks stable at the moment.",
    ],
    tone: hot ? "warning" : "brand",
    action: {
      to: "/workspace",
      label: "Open Workspace",
      autoNavigate: false,
    },
  };
}

function buildAttentionReply({ shellStats }) {
  if (shellStats?.inboxUnread > 0) {
    return {
      kicker: "Attention",
      title: "Inbox should be handled first",
      summary: `${shellStats.inboxUnread} unread items are still waiting.`,
      bullets: [
        formatWsState(shellStats?.wsState),
        "Reduce active queue pressure before switching to deeper planning.",
      ],
      tone: "warning",
      action: {
        to: "/inbox",
        label: "Open Inbox",
        autoNavigate: false,
      },
    };
  }

  if (shellStats?.leadsOpen > 0) {
    return {
      kicker: "Attention",
      title: "Pipeline follow-through is pending",
      summary: `${shellStats.leadsOpen} open leads still need movement.`,
      bullets: [
        formatWsState(shellStats?.wsState),
        "Move the highest-signal lead next.",
      ],
      tone: "warning",
      action: {
        to: "/leads",
        label: "Open Pipeline",
        autoNavigate: false,
      },
    };
  }

  return {
    kicker: "Attention",
    title: "No urgent spike detected",
    summary: "Shared shell signals do not show an obvious backlog spike right now.",
    bullets: [
      formatWsState(shellStats?.wsState),
      "You can move into setup, review, or planning without clear queue pressure.",
    ],
    tone: "brand",
    action: {
      to: "/workspace",
      label: "Open Workspace",
      autoNavigate: false,
    },
  };
}

function buildReplyDraft({ focusLabel }) {
  return {
    kicker: "Reply assist",
    title: "Use a calm operational answer",
    summary:
      "Acknowledge briefly, state the next step clearly, and keep the reply lean.",
    bullets: [
      "Start with one direct acknowledgment sentence.",
      "State the next action without extra apology language.",
      `Check ${focusLabel} context before sending if the thread changed recently.`,
    ],
    tone: "brand",
    action: {
      to: "/inbox",
      label: "Open Inbox",
      autoNavigate: false,
    },
  };
}

function buildChannelsReply() {
  return {
    kicker: "Launch scope",
    title: "Verify channel availability",
    summary:
      "Use launch scope to separate what is live, limited, blocked, or still setup-only.",
    bullets: [
      "Do not promise channel coverage before checking readiness.",
      "Treat launch scope as the operator source of truth for availability.",
    ],
    tone: "neutral",
    action: {
      to: "/channels",
      label: "Open Launch Scope",
      autoNavigate: true,
    },
  };
}

function buildSetupReply() {
  return {
    kicker: "Setup",
    title: "Setup path resumed",
    summary:
      "Setup Studio is the fastest route to continue source intake and unfinished review work.",
    bullets: [
      "Continue from the current stage instead of restarting.",
      "Resolve source or policy gaps before finalizing.",
    ],
    tone: "brand",
    action: {
      to: "/setup",
      label: "Open Setup",
      autoNavigate: true,
    },
  };
}

function buildDirectRouteReply({ prompt, focusLabel, action }) {
  const section = findSectionForPath(action?.to);

  return {
    kicker: "Navigation",
    title: `${section?.label || "Surface"} ready`,
    summary: `Routing from ${focusLabel} into ${section?.label || "the requested surface"}.`,
    bullets: [
      "The command matched a direct navigation request.",
      "You can ask for a brief, next action, or draft from there too.",
    ],
    tone: "brand",
    action: {
      ...action,
      label: section ? `Open ${section.label}` : action.label,
      autoNavigate: /^(open|show|continue|go to|take me)/.test(
        String(prompt || "").trim().toLowerCase()
      ),
    },
  };
}

function buildFallbackReply({ focusLabel }) {
  return {
    kicker: "Ask AI",
    title: "Route, brief, or next action",
    summary: `I can help from ${focusLabel} with navigation, triage, short summaries, and reply support.`,
    bullets: [
      "Try open inbox.",
      "Try summarize workspace status.",
      "Try draft reply.",
    ],
    tone: "neutral",
    action: null,
  };
}

function createReply({
  prompt,
  pathname,
  shellSection,
  activeContextItem,
  shellStats,
}) {
  const normalized = String(prompt || "").trim().toLowerCase();
  const focusLabel = getFocusLabel({ pathname, shellSection, activeContextItem });
  const routeAction = getRouteAction(normalized);

  let baseReply;

  if (
    normalized.includes("summarize workspace status") ||
    /workspace brief|workspace status/.test(normalized)
  ) {
    baseReply = buildWorkspaceReply({ shellStats, focusLabel });
  } else if (
    normalized.includes("what needs attention") ||
    /needs attention|attention/.test(normalized)
  ) {
    baseReply = buildAttentionReply({ shellStats });
  } else if (normalized.includes("draft reply")) {
    baseReply = buildReplyDraft({ focusLabel });
  } else if (normalized.includes("show blocked channels")) {
    baseReply = buildChannelsReply();
  } else if (normalized.includes("continue setup")) {
    baseReply = buildSetupReply();
  } else if (routeAction) {
    baseReply = buildDirectRouteReply({
      prompt,
      focusLabel,
      action: routeAction,
    });
  } else {
    baseReply = buildFallbackReply({ focusLabel });
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    prompt: String(prompt || "").trim(),
    focusLabel,
    statusLine: buildStatusSummary(shellStats),
    createdAt: new Date().toISOString(),
    ...baseReply,
  };
}

async function runAskAiMock(context) {
  const prompt = String(context?.prompt || "").trim();

  if (!prompt) {
    throw new Error("Enter a prompt for Ask AI.");
  }

  await wait(420);

  if (/simulate error|force error|test error/.test(prompt.toLowerCase())) {
    throw new Error("Ask AI is temporarily unavailable. Try again in a moment.");
  }

  return createReply(context);
}

function getAskAiSuggestions(pathname = "/") {
  const section = findSectionForPath(pathname);

  if (section?.id === "inbox") {
    return [
      ASK_AI_SUGGESTIONS[3],
      ASK_AI_SUGGESTIONS[2],
      ASK_AI_SUGGESTIONS[1],
      ASK_AI_SUGGESTIONS[0],
    ];
  }

  if (section?.id === "setup") {
    return [
      ASK_AI_SUGGESTIONS[5],
      ASK_AI_SUGGESTIONS[1],
      ASK_AI_SUGGESTIONS[2],
      ASK_AI_SUGGESTIONS[4],
    ];
  }

  return ASK_AI_SUGGESTIONS.slice(0, 4);
}

export { ASK_AI_SUGGESTIONS, getAskAiSuggestions, runAskAiMock };