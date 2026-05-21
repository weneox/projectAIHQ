import {
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  Inbox,
  LayoutDashboard,
  PlugZap,
  Rocket,
  Radio,
  Settings,
  Users,
  UserRound,
  Target,
} from "lucide-react";
import { isFeatureEnabled } from "../../lib/featureFlags.js";

const PRIMARY_SECTIONS = [
  {
    id: "home",
    label: "Müştəri mərkəzi",
    icon: LayoutDashboard,
    to: "/home",
    paths: ["/home"],
    contextGroups: [
      {
        title: "Naviqasiya",
        items: [{ label: "Müştəri mərkəzi", to: "/home" }],
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
    label: "Biznes profili",
    icon: BriefcaseBusiness,
    to: "/truth",
    paths: ["/truth"],
    contextGroups: [
      {
        title: "Naviqasiya",
        items: [{ label: "Biznes profili", to: "/truth" }],
      },
    ],
  },
];

const CRM_SECTIONS = [
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
    badgeKey: "leadsOpen",
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
    id: "voice-channels",
    feature: "channels.voice",
    label: "Səs kanalları",
    icon: Radio,
    to: "/voice-channels",
    paths: ["/voice-channels"],
    contextGroups: [
      {
        title: "Naviqasiya",
        items: [
          { label: "Səs kanalları", to: "/voice-channels" },
          { label: "Browser Call", to: "/voice-lab" },
        ],
      },
    ],
  },
  {
    id: "voice-lab",
    label: "Browser Call",
    icon: Radio,
    to: "/voice-lab",
    paths: ["/voice-lab"],
    contextGroups: [
      {
        title: "Naviqasiya",
        items: [
          { label: "Browser Call", to: "/voice-lab" },
          { label: "Səs kanalları", to: "/voice-channels" },
        ],
      },
    ],
  },
  {
    id: "reports",
    label: "Hesabatlar",
    icon: BarChart3,
    to: "/reports",
    paths: ["/reports"],
    contextGroups: [
      {
        title: "Naviqasiya",
        items: [{ label: "Hesabatlar", to: "/reports" }],
      },
    ],
  },
  {
    id: "knowledge",
    label: "Bilik bazası",
    icon: BookOpenCheck,
    to: "/knowledge",
    paths: ["/knowledge"],
    contextGroups: [
      {
        title: "Naviqasiya",
        items: [{ label: "Bilik bazası", to: "/knowledge" }],
      },
    ],
  },
  {
    id: "launch",
    label: "Canlı yoxlama",
    icon: Rocket,
    to: "/launch",
    paths: ["/launch"],
    contextGroups: [
      {
        title: "Naviqasiya",
        items: [{ label: "Canlı yoxlama", to: "/launch" }],
      },
    ],
  },
];

const UTILITY_SECTIONS = [
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
  ...CRM_SECTIONS,
  ...SECONDARY_SECTIONS,
  ...UTILITY_SECTIONS,
];

const NAVIGATION_GROUPS = [
  {
    id: "operations",
    label: "Əməliyyat",
    items: PRIMARY_SECTIONS,
  },
  {
    id: "crm",
    label: "CRM",
    items: CRM_SECTIONS,
  },
  {
    id: "intelligence",
    label: "Analitika",
    items: SECONDARY_SECTIONS,
  },
  {
    id: "admin",
    label: "Admin",
    items: UTILITY_SECTIONS,
  },
];

function cleanPath(value = "") {
  return String(value || "").split("?")[0].replace(/\/+$/g, "") || "/";
}

function pathMatches(pathname = "", candidate = "") {
  const current = cleanPath(pathname);
  const target = cleanPath(candidate);

  return current === target || current.startsWith(`${target}/`);
}

function isSectionEnabled(section = {}, features = {}, fallback = false) {
  return (
    !section.feature ||
    isFeatureEnabled(features, section.feature, { fallback })
  );
}

function filterSectionsForFeatures(sections = [], features = {}, fallback = false) {
  return sections.filter((section) =>
    isSectionEnabled(section, features, fallback)
  );
}

function getAllSectionsForFeatures(features = {}, { fallback = false } = {}) {
  return filterSectionsForFeatures(ALL_SECTIONS, features, fallback);
}

function getNavigationGroupsForFeatures(
  features = {},
  { fallback = false } = {}
) {
  return NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: filterSectionsForFeatures(group.items, features, fallback),
  })).filter((group) => group.items.length > 0);
}

function getActiveShellSection(pathname = "/", options = {}) {
  const sections = getAllSectionsForFeatures(options.features, {
    fallback: options.fallback === true,
  });

  return (
    sections.find((section) =>
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
  CRM_SECTIONS,
  NAVIGATION_GROUPS,
  PRIMARY_SECTIONS,
  SECONDARY_SECTIONS,
  UTILITY_SECTIONS,
  getAllSectionsForFeatures,
  getActiveContextItem,
  getActiveShellSection,
  getNavigationGroupsForFeatures,
};
