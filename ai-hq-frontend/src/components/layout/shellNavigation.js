import {
  BellDot,
  BriefcaseBusiness,
  LayoutGrid,
  MessageSquareText,
  Radar,
  Settings2,
  ShieldCheck,
  Waves,
  Waypoints,
} from "lucide-react";

const PRIMARY_SECTIONS = [
  {
    id: "workspace",
    label: "Workspace",
    kicker: "Operator console",
    description: "Business state, system brief, and the main command surface.",
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
    ],
  },
  {
    id: "inbox",
    label: "Inbox",
    kicker: "Conversation ops",
    description: "Customer conversations, queue triage, and operator handling.",
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
          { label: "Mine", hint: "Assigned queue" },
          { label: "Unassigned", hint: "Intake queue" },
          { label: "Voice queue", to: "/voice" },
        ],
      },
    ],
  },
  {
    id: "channels",
    label: "Channels",
    kicker: "Distribution",
    description: "Connected channels, catalog structure, and surface coverage.",
    icon: Waypoints,
    to: "/channels",
    paths: ["/channels"],
    contextGroups: [
      {
        title: "Catalog",
        items: [
          { label: "Channel catalog", to: "/channels" },
          { label: "Settings surface", to: "/settings" },
        ],
      },
    ],
  },
  {
    id: "contacts",
    label: "Contacts",
    kicker: "Pipeline",
    description: "Lead pipeline, proposals, and conversion follow-through.",
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
    ],
  },
  {
    id: "publish",
    label: "Publish",
    kicker: "Outbound",
    description: "Publishing queue, execution state, and delivery outcomes.",
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
    ],
  },
  {
    id: "voice",
    label: "Calls",
    kicker: "Realtime",
    description: "Voice operations, handoffs, and callback handling.",
    icon: Waves,
    to: "/voice",
    paths: ["/voice"],
    contextGroups: [
      {
        title: "Calls",
        items: [
          { label: "Call workspace", to: "/voice" },
          { label: "Inbox bridge", to: "/inbox" },
        ],
      },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    kicker: "Governance",
    description: "Truth, review history, and business intelligence controls.",
    icon: ShieldCheck,
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
    ],
  },
];

const UTILITY_SECTIONS = [
  {
    id: "expert",
    label: "Expert",
    kicker: "Advanced control",
    description: "Deep review, diagnostics, and advanced operator tooling.",
    icon: Radar,
    to: "/expert",
    paths: ["/expert"],
    contextGroups: [
      {
        title: "Control",
        items: [{ label: "Expert surface", to: "/expert" }],
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    kicker: "Configuration",
    description: "Business details, integrations, channels, and team setup.",
    icon: Settings2,
    to: "/settings",
    paths: ["/settings"],
    contextGroups: [
      {
        title: "Configuration",
        items: [{ label: "General settings", to: "/settings" }],
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
  ALL_SECTIONS,
  PRIMARY_SECTIONS,
  UTILITY_SECTIONS,
  getActiveContextItem,
  getActiveShellSection,
};
