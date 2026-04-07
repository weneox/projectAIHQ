import {
  BriefcaseBusiness,
  House,
  Inbox,
  LayoutGrid,
  MessageCircleMore,
  PhoneCall,
  PlugZap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const PRIMARY_SECTIONS = [
  {
    id: "home",
    label: "Home",
    description: "Overview and live surfaces.",
    icon: House,
    to: "/home",
    paths: ["/home"],
    contextGroups: [
      {
        title: "Core",
        items: [
          { label: "Home", to: "/home" },
          { label: "Inbox", to: "/inbox" },
          { label: "Comments", to: "/comments" },
          { label: "Voice", to: "/voice" },
        ],
      },
    ],
  },
  {
    id: "inbox",
    label: "Inbox",
    description: "Conversations.",
    icon: Inbox,
    to: "/inbox",
    badgeKey: "inboxUnread",
    paths: ["/inbox"],
    contextGroups: [
      {
        title: "Core",
        items: [
          { label: "Inbox", to: "/inbox" },
          { label: "Incidents", to: "/incidents" },
        ],
      },
    ],
  },
  {
    id: "comments",
    label: "Comments",
    description: "Moderation.",
    icon: MessageCircleMore,
    to: "/comments",
    paths: ["/comments"],
    contextGroups: [
      {
        title: "Core",
        items: [
          { label: "Comments", to: "/comments" },
          { label: "Inbox", to: "/inbox" },
        ],
      },
    ],
  },
  {
    id: "voice",
    label: "Voice",
    description: "Calls.",
    icon: PhoneCall,
    to: "/voice",
    paths: ["/voice"],
    contextGroups: [
      {
        title: "Core",
        items: [
          { label: "Voice", to: "/voice" },
          { label: "Inbox", to: "/inbox" },
        ],
      },
    ],
  },
];

const SECONDARY_SECTIONS = [
  {
    id: "workspace",
    label: "Workspace",
    description: "Control.",
    icon: LayoutGrid,
    to: "/workspace",
    paths: ["/workspace"],
    contextGroups: [
      {
        title: "Platform",
        items: [
          { label: "Workspace", to: "/workspace" },
          { label: "Channels", to: "/channels" },
        ],
      },
    ],
  },
  {
    id: "channels",
    label: "Channels",
    description: "Connections.",
    icon: PlugZap,
    to: "/channels",
    paths: ["/channels"],
    contextGroups: [
      {
        title: "Platform",
        items: [
          { label: "Channels", to: "/channels" },
          { label: "Workspace", to: "/workspace" },
        ],
      },
    ],
  },
  {
    id: "contacts",
    label: "Pipeline",
    description: "Leads.",
    icon: BriefcaseBusiness,
    to: "/leads",
    badgeKey: "leadsOpen",
    paths: ["/leads", "/proposals"],
    contextGroups: [
      {
        title: "Platform",
        items: [
          { label: "Leads", to: "/leads" },
          { label: "Proposals", to: "/proposals" },
        ],
      },
    ],
  },
  {
    id: "publish",
    label: "Content",
    description: "Publishing.",
    icon: Sparkles,
    to: "/publish",
    paths: ["/publish", "/executions"],
    contextGroups: [
      {
        title: "Platform",
        items: [
          { label: "Publish", to: "/publish" },
          { label: "Executions", to: "/executions" },
        ],
      },
    ],
  },
  {
    id: "intelligence",
    label: "Knowledge",
    description: "Business memory.",
    icon: ShieldCheck,
    to: "/truth",
    paths: ["/truth"],
    contextGroups: [
      {
        title: "Platform",
        items: [
          { label: "Knowledge", to: "/truth" },
          { label: "Workspace", to: "/workspace" },
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