import { ALL_SECTIONS } from "./shellNavigation.js";

const ASK_AI_SUGGESTIONS = [
  { id: "inbox", label: "Open inbox", prompt: "open inbox" },
  {
    id: "workspace-status",
    label: "Workspace status",
    prompt: "summarize workspace status",
  },
  {
    id: "attention",
    label: "Needs attention",
    prompt: "what needs attention",
  },
  { id: "reply", label: "Draft reply", prompt: "draft reply" },
  {
    id: "blocked-channels",
    label: "Blocked channels",
    prompt: "show blocked channels",
  },
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

function formatCount(value, label) {
  if (typeof value !== "number" || value <= 0) return null;
  return `${value} ${label}${value === 1 ? "" : "s"}`;
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

function getFocusLabel({ shellSection, activeContextItem, pathname }) {
  const routeSection = findSectionForPath(pathname);
  return (
    activeContextItem?.label ||
    shellSection?.label ||
    routeSection?.label ||
    "Workspace"
  );
}

function getRouteAction(prompt) {
  const normalized = String(prompt || "").toLowerCase();
  const match = ROUTE_RESPONSES.find((entry) => entry.matcher.test(normalized));
  if (!match) return null;

  const section = findSectionForPath(match.to);
  const autoNavigate = /^(open|show|continue|go to|take me)/.test(
    normalized.trim()
  );

  return {
    to: match.to,
    label: section ? `Open ${section.label}` : "Open surface",
    autoNavigate,
  };
}

function buildStatusSummary(shellStats = {}) {
  const parts = [
    formatCount(shellStats.inboxUnread, "unread inbox item"),
    formatCount(shellStats.leadsOpen, "open lead"),
    formatWsState(shellStats.wsState),
  ].filter(Boolean);

  return parts.length ? parts.join(" | ") : "No urgent operator signals detected.";
}

function buildWorkspaceReply({ shellStats, focusLabel }) {
  return {
    title: "Workspace brief is ready",
    summary: buildStatusSummary(shellStats),
    bullets: [
      `${focusLabel} is the active operator surface right now.`,
      shellStats?.inboxUnread > 0
        ? "Inbox attention is the fastest path to reduce active work."
        : "Inbox load looks calm enough to shift into review or setup work.",
      shellStats?.leadsOpen > 0
        ? "Pipeline still has open follow-through waiting."
        : "Pipeline follow-through looks stable at the moment.",
    ],
    tone:
      shellStats?.inboxUnread > 0 || shellStats?.leadsOpen > 0
        ? "warning"
        : "neutral",
    action: {
      to: "/workspace",
      label: "Open Workspace",
      autoNavigate: false,
    },
  };
}

function buildAttentionReply({ shellStats }) {
  const topAction =
    shellStats?.inboxUnread > 0
      ? {
          summary: `${shellStats.inboxUnread} unread inbox items are still waiting on review.`,
          action: { to: "/inbox", label: "Open Inbox", autoNavigate: false },
        }
      : shellStats?.leadsOpen > 0
        ? {
            summary: `${shellStats.leadsOpen} pipeline items still need follow-through.`,
            action: { to: "/leads", label: "Open Pipeline", autoNavigate: false },
          }
        : {
            summary: "No obvious backlog spike is showing in shared shell signals.",
            action: {
              to: "/workspace",
              label: "Open Workspace",
              autoNavigate: false,
            },
          };

  return {
    title: "Top attention area",
    summary: topAction.summary,
    bullets: [
      formatWsState(shellStats?.wsState),
      shellStats?.dbDisabled
        ? "Some shared data surfaces are degraded, so treat counts carefully."
        : "Shared workspace data is reporting normally.",
      "If you want, ask for a deeper brief on a specific surface next.",
    ],
    tone:
      shellStats?.inboxUnread > 0 || shellStats?.dbDisabled ? "warning" : "neutral",
    action: topAction.action,
  };
}

function buildReplyDraft({ focusLabel }) {
  return {
    title: "Draft reply direction",
    summary:
      "Lead with a calm answer, confirm the next step, and keep the reply operationally clear.",
    bullets: [
      "Acknowledge the customer or teammate in one sentence.",
      "State the next action or decision without adding extra apology language.",
      `Use ${focusLabel} context before sending if the thread has recent changes.`,
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
    title: "Blocked channel review",
    summary:
      "Launch scope is the right place to verify what is live, limited, or still setup-only.",
    bullets: [
      "Check launch scope before promising channel coverage.",
      "Use setup status to separate blocked from not-yet-configured surfaces.",
      "Treat this as an operator truth source, not marketing copy.",
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
    title: "Setup path resumed",
    summary:
      "Setup Studio is the fastest route to continue source intake and review pending configuration work.",
    bullets: [
      "Pick up the current stage rather than restarting the flow.",
      "Review unresolved source or policy gaps before finalizing.",
      "Return to the operator shell after setup changes land.",
    ],
    tone: "brand",
    action: {
      to: "/setup",
      label: "Open Setup",
      autoNavigate: true,
    },
  };
}

function buildDirectRouteReply({ prompt, action, focusLabel }) {
  const section = findSectionForPath(action?.to);
  return {
    title: `${section?.label || "Surface"} ready`,
    summary: `Routing from ${focusLabel} into ${section?.label || "the requested surface"}.`,
    bullets: [
      "The command matched a direct operator navigation request.",
      "You can keep asking for a brief, draft, or next action from here.",
    ],
    tone: "brand",
    action: {
      ...action,
      label: section ? `Open ${section.label}` : action.label,
      autoNavigate: /^(open|show|continue|go to|take me)/.test(
        String(prompt || "").toLowerCase().trim()
      ),
    },
  };
}

function buildFallbackReply({ focusLabel }) {
  return {
    title: "Ask refined",
    summary: `I can help from ${focusLabel} with navigation, triage, quick summaries, and reply support.`,
    bullets: [
      "Try a direct action like open inbox or continue setup.",
      "Try a brief like summarize workspace status.",
      "Try a focused assist like draft reply.",
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
  const focusLabel = getFocusLabel({ shellSection, activeContextItem, pathname });
  const routeAction = getRouteAction(normalized);

  let baseReply;

  if (normalized.includes("summarize workspace status")) {
    baseReply = buildWorkspaceReply({ shellStats, focusLabel });
  } else if (normalized.includes("what needs attention")) {
    baseReply = buildAttentionReply({ shellStats });
  } else if (normalized.includes("draft reply")) {
    baseReply = buildReplyDraft({ focusLabel });
  } else if (normalized.includes("show blocked channels")) {
    baseReply = buildChannelsReply();
  } else if (normalized.includes("continue setup")) {
    baseReply = buildSetupReply();
  } else if (routeAction) {
    baseReply = buildDirectRouteReply({ prompt, action: routeAction, focusLabel });
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

  await wait(320);

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
