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
    icon: House,
    to: "/home",
    paths: ["/home"],
    contextGroups: [{ title: "Navigation", items: [{ label: "Home", to: "/home" }] }],
  },
  {
    id: "inbox",
    label: "Inbox",
    icon: Inbox,
    to: "/inbox",
    badgeKey: "inboxUnread",
    paths: ["/inbox"],
    contextGroups: [{ title: "Navigation", items: [{ label: "Inbox", to: "/inbox" }] }],
  },
  {
    id: "comments",
    label: "Comments",
    icon: MessageCircleMore,
    to: "/comments",
    paths: ["/comments"],
    contextGroups: [{ title: "Navigation", items: [{ label: "Comments", to: "/comments" }] }],
  },
  {
    id: "voice",
    label: "Voice",
    icon: PhoneCall,
    to: "/voice",
    paths: ["/voice"],
    contextGroups: [{ title: "Navigation", items: [{ label: "Voice", to: "/voice" }] }],
  },
];

const SECONDARY_SECTIONS = [
  {
    id: "workspace",
    label: "Workspace",
    icon: LayoutGrid,
    to: "/workspace",
    paths: ["/workspace"],
    contextGroups: [{ title: "Navigation", items: [{ label: "Workspace", to: "/workspace" }] }],
  },
  {
    id: "channels",
    label: "Channels",
    icon: PlugZap,
    to: "/channels",
    paths: ["/channels"],
    contextGroups: [{ title: "Navigation", items: [{ label: "Channels", to: "/channels" }] }],
  },
  {
    id: "pipeline",
    label: "Pipeline",
    icon: BriefcaseBusiness,
    to: "/leads",
    badgeKey: "leadsOpen",
    paths: ["/leads", "/proposals"],
    contextGroups: [{ title: "Navigation", items: [{ label: "Pipeline", to: "/leads" }] }],
  },
  {
    id: "content",
    label: "Content",
    icon: Sparkles,
    to: "/publish",
    paths: ["/publish", "/executions"],
    contextGroups: [{ title: "Navigation", items: [{ label: "Content", to: "/publish" }] }],
  },
  {
    id: "knowledge",
    label: "Knowledge",
    icon: ShieldCheck,
    to: "/truth",
    paths: ["/truth"],
    contextGroups: [{ title: "Navigation", items: [{ label: "Knowledge", to: "/truth" }] }],
  },
];

const UTILITY_SECTIONS = [];
const ALL_SECTIONS = [...PRIMARY_SECTIONS, ...SECONDARY_SECTIONS, ...UTILITY_SECTIONS];

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