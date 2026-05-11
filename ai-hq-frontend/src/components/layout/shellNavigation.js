import {
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  Inbox,
  LayoutDashboard,
  PlugZap,
  Settings,
  Users,
  UserRound,
  Target,
} from "lucide-react";

const PRIMARY_SECTIONS = [
  {
    id: "home",
    label: "Ana səhifə",
    icon: LayoutDashboard,
    to: "/home",
    paths: ["/home"],
    contextGroups: [
      {
        title: "Naviqasiya",
        items: [{ label: "Ana səhifə", to: "/home" }],
      },
    ],
  },
  {
    id: "inbox",
    label: "Gələnlər",
    icon: Inbox,
    to: "/inbox",
    badgeKey: "inboxUnread",
    paths: ["/inbox"],
    contextGroups: [
      {
        title: "Naviqasiya",
        items: [{ label: "Gələnlər", to: "/inbox" }],
      },
    ],
  },
  {
    id: "channels",
    label: "Kanallar",
    icon: PlugZap,
    to: "/channels",
    paths: ["/channels"],
    contextGroups: [
      {
        title: "Naviqasiya",
        items: [{ label: "Kanallar", to: "/channels" }],
      },
    ],
  },
  {
    id: "business-info",
    label: "Məlumatlar",
    icon: BriefcaseBusiness,
    to: "/truth",
    paths: ["/truth"],
    contextGroups: [
      {
        title: "Naviqasiya",
        items: [{ label: "Məlumatlar", to: "/truth" }],
      },
    ],
  },
  {
    id: "customers",
    label: "Müştərilər",
    icon: UserRound,
    to: "/customers",
    paths: ["/customers"],
    contextGroups: [
      {
        title: "Naviqasiya",
        items: [{ label: "Müştərilər", to: "/customers" }],
      },
    ],
  },
  {
    id: "leads",
    label: "Fürsətlər",
    icon: Target,
    to: "/leads",
    paths: ["/leads"],
    contextGroups: [
      {
        title: "Naviqasiya",
        items: [{ label: "Fürsətlər", to: "/leads" }],
      },
    ],
  },
];

const SECONDARY_SECTIONS = [
  {
    id: "knowledge",
    label: "Baza",
    icon: BookOpenCheck,
    to: "/knowledge",
    paths: ["/knowledge"],
    contextGroups: [
      {
        title: "Naviqasiya",
        items: [{ label: "Baza", to: "/knowledge" }],
      },
    ],
  },
  {
    id: "reports",
    label: "Hesabat",
    icon: BarChart3,
    to: "/reports",
    paths: ["/reports"],
    contextGroups: [
      {
        title: "Naviqasiya",
        items: [{ label: "Hesabat", to: "/reports" }],
      },
    ],
  },
  {
    id: "team",
    label: "Komanda",
    icon: Users,
    to: "/team",
    paths: ["/team"],
    contextGroups: [
      {
        title: "Naviqasiya",
        items: [{ label: "Komanda", to: "/team" }],
      },
    ],
  },
];

const UTILITY_SECTIONS = [
  {
    id: "settings",
    label: "Ayarlar",
    icon: Settings,
    to: "/settings",
    paths: ["/settings"],
    contextGroups: [
      {
        title: "Naviqasiya",
        items: [{ label: "Ayarlar", to: "/settings" }],
      },
    ],
  },
];

const ALL_SECTIONS = [
  ...PRIMARY_SECTIONS,
  ...SECONDARY_SECTIONS,
  ...UTILITY_SECTIONS,
];

function cleanPath(value = "") {
  return String(value || "").split("?")[0].replace(/\/+$/g, "") || "/";
}

function pathMatches(pathname = "", candidate = "") {
  const current = cleanPath(pathname);
  const target = cleanPath(candidate);

  return current === target || current.startsWith(`${target}/`);
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
