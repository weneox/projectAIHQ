import {
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  Inbox,
  LayoutDashboard,
  PlugZap,
  Rocket,
  Settings,
} from "lucide-react";

const PRIMARY_SECTIONS = [
  {
    id: "home",
    label: "Home",
    icon: LayoutDashboard,
    to: "/home",
    paths: ["/home"],
    contextGroups: [
      {
        title: "Navigation",
        items: [{ label: "Home", to: "/home" }],
      },
    ],
  },
  {
    id: "setup",
    label: "Setup",
    icon: Rocket,
    to: "/home?assistant=setup",
    paths: ["/setup"],
    contextGroups: [
      {
        title: "Navigation",
        items: [{ label: "Setup", to: "/home?assistant=setup" }],
      },
    ],
  },
  {
    id: "business-info",
    label: "Business Info",
    icon: BriefcaseBusiness,
    to: "/truth",
    paths: ["/truth"],
    contextGroups: [
      {
        title: "Navigation",
        items: [{ label: "Business Info", to: "/truth" }],
      },
    ],
  },
  {
    id: "channels",
    label: "Channels",
    icon: PlugZap,
    to: "/channels",
    paths: ["/channels"],
    contextGroups: [
      {
        title: "Navigation",
        items: [{ label: "Channels", to: "/channels" }],
      },
    ],
  },
  {
    id: "inbox",
    label: "Inbox",
    icon: Inbox,
    to: "/inbox",
    badgeKey: "inboxUnread",
    paths: ["/inbox"],
    contextGroups: [
      {
        title: "Navigation",
        items: [{ label: "Inbox", to: "/inbox" }],
      },
    ],
  },
  {
    id: "knowledge",
    label: "Knowledge",
    icon: BookOpenCheck,
    to: "/knowledge",
    paths: ["/knowledge"],
    contextGroups: [
      {
        title: "Navigation",
        items: [{ label: "Knowledge", to: "/knowledge" }],
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    to: "/reports",
    paths: ["/reports"],
    contextGroups: [
      {
        title: "Navigation",
        items: [{ label: "Reports", to: "/reports" }],
      },
    ],
  },
];

const SECONDARY_SECTIONS = [];

const UTILITY_SECTIONS = [
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    to: "/settings",
    paths: ["/settings"],
    contextGroups: [
      {
        title: "Navigation",
        items: [{ label: "Settings", to: "/settings" }],
      },
    ],
  },
];

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
