import {
  BellDot,
  BriefcaseBusiness,
  LayoutGrid,
  MessageSquareText,
  Radar,
  Settings2,
  Sparkles,
  Waves,
  Waypoints,
} from "lucide-react";

const PRIMARY_SECTIONS = [
  {
    id: "workspace",
    label: "Workspace",
    kicker: "Control surface",
    description: "System posture, truth state, and operator oversight.",
    icon: LayoutGrid,
    to: "/workspace",
    paths: ["/workspace"],
    contextGroups: [
      {
        title: "Overview",
        items: [
          { label: "Workspace overview", to: "/workspace" },
          { label: "Truth viewer", to: "/truth" },
          { label: "Settings controller", to: "/settings" },
        ],
      },
      {
        title: "Readiness",
        items: [
          { label: "Operational posture", hint: "Shared readiness summary" },
          { label: "Escalation watch", hint: "Incidents and execution blockers" },
        ],
      },
    ],
  },
  {
    id: "inbox",
    label: "Inbox",
    kicker: "Conversation ops",
    description: "Queue handling, replies, handoffs, and live operator flow.",
    icon: MessageSquareText,
    to: "/inbox",
    badgeKey: "inboxUnread",
    paths: ["/inbox", "/comments", "/incidents"],
    contextGroups: [
      {
        title: "Queue",
        items: [
          { label: "All conversations", to: "/inbox" },
          { label: "Comments", to: "/comments" },
          { label: "Incidents", to: "/incidents" },
        ],
      },
      {
        title: "Operator views",
        items: [
          { label: "Mine", hint: "Personal assignment view" },
          { label: "Unassigned", hint: "Queue intake view" },
          { label: "Voice queue", to: "/voice" },
        ],
      },
    ],
  },
  {
    id: "channels",
    label: "Channels",
    kicker: "Catalog",
    description: "Connected channels, planned surfaces, and routing inventory.",
    icon: Waypoints,
    to: "/channels",
    paths: ["/channels"],
    contextGroups: [
      {
        title: "Catalog",
        items: [
          { label: "Channel catalog", to: "/channels" },
          { label: "Settings surface", to: "/settings" },
          { label: "Website chat", hint: "Embeddable widget path" },
        ],
      },
      {
        title: "Expansion",
        items: [
          { label: "Messaging stack", hint: "WhatsApp, Telegram, Messenger" },
          { label: "Social stack", hint: "Instagram, TikTok, Facebook" },
        ],
      },
    ],
  },
  {
    id: "contacts",
    label: "Contacts",
    kicker: "Pipeline",
    description: "Lead state, lifecycle views, and operator follow-through.",
    icon: BriefcaseBusiness,
    to: "/leads",
    badgeKey: "leadsOpen",
    paths: ["/leads", "/proposals"],
    contextGroups: [
      {
        title: "Pipeline",
        items: [
          { label: "Lead pipeline", to: "/leads" },
          { label: "Proposals", to: "/proposals" },
        ],
      },
      {
        title: "Lifecycle",
        items: [
          { label: "Segments", hint: "Audience cohorts" },
          { label: "Saved lists", hint: "Reusable operator views" },
        ],
      },
    ],
  },
  {
    id: "publish",
    label: "Publish",
    kicker: "Outbound",
    description: "Queued work, broadcast posture, and execution awareness.",
    icon: BellDot,
    to: "/publish",
    paths: ["/publish", "/executions"],
    contextGroups: [
      {
        title: "Execution",
        items: [
          { label: "Publish queue", to: "/publish" },
          { label: "Executions", to: "/executions" },
        ],
      },
      {
        title: "Planning",
        items: [
          { label: "Campaign briefs", hint: "Coming into shell next" },
          { label: "Retry lineage", hint: "Delivery and publish recovery" },
        ],
      },
    ],
  },
  {
    id: "voice",
    label: "Calls",
    kicker: "Realtime",
    description: "Voice traffic, callback handling, and live escalation flow.",
    icon: Waves,
    to: "/voice",
    paths: ["/voice"],
    contextGroups: [
      {
        title: "Calls",
        items: [
          { label: "Call workspace", to: "/voice" },
          { label: "Inbox bridge", to: "/inbox" },
          { label: "Incidents", to: "/incidents" },
        ],
      },
      {
        title: "Coverage",
        items: [
          { label: "Callback routing", hint: "Operator callback handling" },
          { label: "Handoff lanes", hint: "Voice-to-human controls" },
        ],
      },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    kicker: "Governance",
    description: "Truth, runtime confidence, and deeper AI operating controls.",
    icon: Sparkles,
    to: "/truth",
    paths: ["/truth"],
    contextGroups: [
      {
        title: "Truth",
        items: [
          { label: "Truth viewer", to: "/truth" },
          { label: "Expert control", to: "/expert" },
          { label: "Executions", to: "/executions" },
        ],
      },
      {
        title: "Signals",
        items: [
          { label: "Runtime confidence", hint: "Projection and readiness health" },
          { label: "Approval boundaries", hint: "Strict authority posture" },
        ],
      },
    ],
  },
];

const UTILITY_SECTIONS = [
  {
    id: "expert",
    label: "Expert",
    kicker: "Advanced control",
    description: "Deep runtime controls, advanced sections, and operator tooling.",
    icon: Radar,
    to: "/expert",
    paths: ["/expert"],
    contextGroups: [
      {
        title: "Control",
        items: [
          { label: "Expert surface", to: "/expert" },
          { label: "Truth viewer", to: "/truth" },
          { label: "Executions", to: "/executions" },
        ],
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    kicker: "System config",
    description: "Channels, integrations, team controls, and operational settings.",
    icon: Settings2,
    to: "/settings",
    paths: ["/settings"],
    contextGroups: [
      {
        title: "Configuration",
        items: [
          { label: "General settings", to: "/settings" },
          { label: "Channels", hint: "Legacy channel management sections" },
          { label: "Integrations", hint: "Provider and system wiring" },
        ],
      },
    ],
  },
];

const ALL_SECTIONS = [...PRIMARY_SECTIONS, ...UTILITY_SECTIONS];

function pathMatches(pathname = "", candidate = "") {
  return pathname === candidate || pathname.startsWith(`${candidate}/`);
}

function getActiveShellSection(pathname = "/") {
  return (
    ALL_SECTIONS.find((section) =>
      section.paths.some((path) => pathMatches(pathname, path))
    ) || PRIMARY_SECTIONS[0]
  );
}

function getActiveContextItem(section, pathname = "/") {
  for (const group of section?.contextGroups || []) {
    const activeItem = (group.items || []).find(
      (item) => item.to && pathMatches(pathname, item.to)
    );
    if (activeItem) return activeItem;
  }

  return null;
}

export {
  PRIMARY_SECTIONS,
  UTILITY_SECTIONS,
  getActiveContextItem,
  getActiveShellSection,
};