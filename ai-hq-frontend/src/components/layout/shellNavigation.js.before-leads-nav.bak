import {
  BarChart3,
  BookOpenCheck,
  Building2,
  Home,
  Inbox,
  Plug,
  Rocket,
  Settings,
  UserCog,
  Users,
} from "lucide-react";

const PRIMARY_SECTIONS = [
  {
    id: "home",
    label: "Home",
    icon: Home,
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
    id: "launch",
    label: "Launch",
    icon: Rocket,
    to: "/launch",
    paths: ["/launch"],
    contextGroups: [
      {
        title: "Navigation",
        items: [{ label: "Launch", to: "/launch" }],
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
    id: "customers",
    label: "Customers",
    icon: Users,
    to: "/customers",
    paths: ["/customers"],
    contextGroups: [
      {
        title: "Navigation",
        items: [{ label: "Customers", to: "/customers" }],
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

const SECONDARY_SECTIONS = [
  {
    id: "channels",
    label: "Channels",
    icon: Plug,
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
    id: "business-info",
    label: "Business Info",
    icon: Building2,
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
];

const UTILITY_SECTIONS = [
  {
    id: "team",
    label: "Team",
    icon: UserCog,
    to: "/team",
    paths: ["/team"],
    contextGroups: [
      {
        title: "Navigation",
        items: [{ label: "Team", to: "/team" }],
      },
    ],
  },
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