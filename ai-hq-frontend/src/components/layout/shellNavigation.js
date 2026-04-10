import {
  House,
  Inbox,
  PlugZap,
  ShieldCheck,
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
];

const SECONDARY_SECTIONS = [
  {
    id: "channels",
    label: "Channels",
    icon: PlugZap,
    to: "/channels",
    paths: ["/channels"],
    contextGroups: [{ title: "Navigation", items: [{ label: "Channels", to: "/channels" }] }],
  },
  {
    id: "truth",
    label: "Truth",
    icon: ShieldCheck,
    to: "/truth",
    paths: ["/truth"],
    contextGroups: [{ title: "Navigation", items: [{ label: "Truth", to: "/truth" }] }],
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