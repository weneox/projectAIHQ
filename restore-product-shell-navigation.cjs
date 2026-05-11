const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "ai-hq-frontend/src/components/layout/shellNavigation.js");

const code = `import {
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
    id: "customers",
    label: "Customers",
    icon: UserRound,
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
    id: "leads",
    label: "Leads",
    icon: Target,
    to: "/leads",
    paths: ["/leads"],
    contextGroups: [
      {
        title: "Navigation",
        items: [{ label: "Leads", to: "/leads" }],
      },
    ],
  },
];

const SECONDARY_SECTIONS = [
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
  {
    id: "team",
    label: "Team",
    icon: Users,
    to: "/team",
    paths: ["/team"],
    contextGroups: [
      {
        title: "Navigation",
        items: [{ label: "Team", to: "/team" }],
      },
    ],
  },
];

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

const ALL_SECTIONS = [
  ...PRIMARY_SECTIONS,
  ...SECONDARY_SECTIONS,
  ...UTILITY_SECTIONS,
];

function cleanPath(value = "") {
  return String(value || "").split("?")[0].replace(/\\/+$/g, "") || "/";
}

function pathMatches(pathname = "", candidate = "") {
  const current = cleanPath(pathname);
  const target = cleanPath(candidate);

  return current === target || current.startsWith(\`\${target}/\`);
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
`;

fs.writeFileSync(file, code, "utf8");
console.log("restored full product shell navigation");
