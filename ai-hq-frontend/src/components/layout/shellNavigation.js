import {
  BellDot,
  BriefcaseBusiness,
  Home,
  LayoutGrid,
  MessageCircleMore,
  MessageSquareText,
  ShieldCheck,
  Waves,
  Waypoints,
} from "lucide-react";

const PRIMARY_SECTIONS = [
  {
    id: "home",
    label: "Home",
    kicker: "Launch slice",
    description: "Focused overview of the real operating product and the next operator action.",
    icon: Home,
    to: "/home",
    paths: ["/home"],
    contextGroups: [
      {
        title: "Start here",
        items: [
          { label: "Product home", to: "/home" },
          { label: "Social inbox", to: "/inbox" },
          { label: "Comment queue", to: "/comments" },
          { label: "Voice receptionist", to: "/voice" },
        ],
      },
    ],
  },
  {
    id: "inbox",
    label: "Inbox",
    kicker: "Primary",
    description: "Meta messaging, operator triage, and live conversation handling.",
    icon: MessageSquareText,
    to: "/inbox",
    badgeKey: "inboxUnread",
    paths: ["/inbox"],
    contextGroups: [
      {
        title: "Messaging",
        items: [
          { label: "Social inbox", to: "/inbox" },
          { label: "Incidents", to: "/incidents" },
        ],
      },
    ],
  },
  {
    id: "comments",
    label: "Comments",
    kicker: "Primary",
    description: "Meta comment moderation, reply review, and operator intervention.",
    icon: MessageCircleMore,
    to: "/comments",
    paths: ["/comments"],
    contextGroups: [
      {
        title: "Moderation",
        items: [
          { label: "Comment queue", to: "/comments" },
          { label: "Social inbox", to: "/inbox" },
        ],
      },
    ],
  },
  {
    id: "voice",
    label: "Voice",
    kicker: "Primary",
    description: "Twilio voice operations, handoffs, transcripts, and live call controls.",
    icon: Waves,
    to: "/voice",
    paths: ["/voice"],
    contextGroups: [
      {
        title: "Calls",
        items: [
          { label: "Voice receptionist", to: "/voice" },
          { label: "Social inbox", to: "/inbox" },
        ],
      },
    ],
  },
];

const SECONDARY_SECTIONS = [
  {
    id: "workspace",
    label: "Workspace",
    kicker: "Support",
    description: "Cross-surface operator brief, posture, and internal control views.",
    icon: LayoutGrid,
    to: "/workspace",
    paths: ["/workspace"],
    contextGroups: [
      {
        title: "Support",
        items: [
          { label: "Workspace overview", to: "/workspace" },
          { label: "Launch scope", to: "/channels" },
        ],
      },
    ],
  },
  {
    id: "channels",
    label: "Launch Scope",
    kicker: "Reference",
    description: "Honest map of what is live now versus planned, limited, or setup-only.",
    icon: Waypoints,
    to: "/channels",
    paths: ["/channels"],
    contextGroups: [
      {
        title: "Scope",
        items: [
          { label: "Launch scope", to: "/channels" },
          { label: "Workspace overview", to: "/workspace" },
        ],
      },
    ],
  },
  {
    id: "contacts",
    label: "Pipeline",
    kicker: "Backoffice",
    description: "Lead follow-through and proposal work that supports the business but is not part of the launch product.",
    icon: BriefcaseBusiness,
    to: "/leads",
    badgeKey: "leadsOpen",
    paths: ["/leads", "/proposals"],
    contextGroups: [
      {
        title: "Backoffice",
        items: [
          { label: "Lead pipeline", to: "/leads" },
          { label: "Proposals", to: "/proposals" },
        ],
      },
    ],
  },
  {
    id: "publish",
    label: "Content",
    kicker: "Backoffice",
    description: "Internal content and publishing workflow, kept available without reading like a launch promise.",
    icon: BellDot,
    to: "/publish",
    paths: ["/publish", "/executions"],
    contextGroups: [
      {
        title: "Backoffice",
        items: [
          { label: "Publish queue", to: "/publish" },
          { label: "Executions", to: "/executions" },
        ],
      },
    ],
  },
  {
    id: "intelligence",
    label: "Truth",
    kicker: "Internal",
    description: "Approved business memory, review history, and control-plane visibility behind the launch loops.",
    icon: ShieldCheck,
    to: "/truth",
    paths: ["/truth"],
    contextGroups: [
      {
        title: "Internal",
        items: [
          { label: "Truth viewer", to: "/truth" },
          { label: "Workspace overview", to: "/workspace" },
        ],
      },
    ],
  },
];
const UTILITY_SECTIONS = [];

const ALL_SECTIONS = [
  ...PRIMARY_SECTIONS,
  ...SECONDARY_SECTIONS,
  ...UTILITY_SECTIONS,
];

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
  SECONDARY_SECTIONS,
  UTILITY_SECTIONS,
  getActiveContextItem,
  getActiveShellSection,
};
