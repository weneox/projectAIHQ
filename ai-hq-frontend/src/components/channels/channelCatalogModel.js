import { PhoneCall } from "lucide-react";
import webIcon from "../../assets/channels/web.svg";
import gmailIcon from "../../assets/channels/gmail.svg";
import googleDriveIcon from "../../assets/channels/google-drive.svg";
import instagramIcon from "../../assets/channels/instagram.svg";
import messengerIcon from "../../assets/channels/messenger.svg";
import telegramIcon from "../../assets/channels/telegram.svg";
import tiktokIcon from "../../assets/channels/tiktok.svg";
import whatsappIcon from "../../assets/channels/whatsapp.svg";
import youtubeIcon from "../../assets/channels/youtube.svg";

export const CHANNEL_STATUS_META = {
  connected: {
    label: "Connected",
    tone: "success",
  },
  limited: {
    label: "Limited",
    tone: "info",
  },
  "needs-attention": {
    label: "Needs attention",
    tone: "warning",
  },
  "not-connected": {
    label: "Not connected",
    tone: "neutral",
  },
  context: {
    label: "Context only",
    tone: "neutral",
  },
};

export const CHANNEL_FILTERS = [
  { id: "all", label: "All lanes" },
  { id: "connected", label: "Live now" },
  { id: "limited", label: "Limited" },
  { id: "attention", label: "Needs setup" },
  { id: "context", label: "Context" },
];

export const CHANNELS = [
  {
    id: "instagram",
    name: "Instagram",
    status: "connected",
    icon: instagramIcon,
    iconAlt: "Instagram",
    aliases: [
      "instagram inbox",
      "instagram comments",
      "moderation",
      "dm",
    ],
    summary: "Messages and comments run in one live lane.",
    capabilities: ["Inbox", "Comments", "Moderation"],
    primaryAction: {
      label: "Open",
      path: "/inbox",
    },
    quickActions: [
      {
        label: "Open inbox",
        hint: "Live DM queue and handoff.",
        path: "/inbox",
      },
      {
        label: "Open comments",
        hint: "Moderation and reply review.",
        path: "/comments",
      },
      {
        label: "Open truth",
        hint: "Approved memory behind the lane.",
        path: "/truth",
      },
    ],
    detailSummary: "Instagram is the clearest live social lane in the product.",
    detailNote: "Use Inbox for conversations and Comments for moderation.",
    advanced: {
      note:
        "Inbound messages, AI-assisted replies, comment moderation, and retry visibility are part of the current launch slice.",
      items: [
        { label: "Coverage", value: "Messages + comments" },
        { label: "Position", value: "Live now" },
      ],
    },
  },
  {
    id: "voice",
    name: "Voice",
    status: "connected",
    iconComponent: PhoneCall,
    iconAlt: "Voice",
    aliases: ["twilio", "voice receptionist", "calls", "handoff", "transcripts"],
    summary: "Receptionist, handoff, and transcripts are live.",
    capabilities: ["Receptionist", "Handoff", "Transcripts"],
    primaryAction: {
      label: "Open",
      path: "/voice",
    },
    quickActions: [
      {
        label: "Open voice",
        hint: "Live receptionist desk.",
        path: "/voice",
      },
      {
        label: "Open workspace",
        hint: "Capabilities and operator context.",
        path: "/workspace?focus=capabilities",
      },
      {
        label: "Open truth",
        hint: "Approved memory behind calls.",
        path: "/truth",
      },
    ],
    detailSummary: "Voice stays inside the live operating product.",
    detailNote: "Receptionist sessions, call control, and handoff all stay here.",
    advanced: {
      note:
        "Inbound calls, runtime resolution, transcripts, and operator handoff remain part of the current launch slice.",
      items: [
        { label: "Coverage", value: "Twilio receptionist" },
        { label: "Position", value: "Live now" },
      ],
    },
  },
  {
    id: "messenger",
    name: "Messenger",
    status: "limited",
    icon: messengerIcon,
    iconAlt: "Messenger",
    aliases: ["facebook messenger", "meta inbox"],
    summary: "Meta messaging support exists, but stays secondary.",
    capabilities: ["Shared inbox path"],
    primaryAction: {
      label: "Manage",
      path: "/inbox",
    },
    quickActions: [
      {
        label: "Open inbox",
        hint: "Shared Meta messaging lane.",
        path: "/inbox",
      },
      {
        label: "Open workspace",
        hint: "Cross-surface operator view.",
        path: "/workspace",
      },
      {
        label: "Open setup",
        hint: "Tighten supporting setup.",
        path: "/home?assistant=setup",
      },
    ],
    detailSummary: "Messenger uses the live Meta lane without becoming the headline.",
    detailNote: "Keep the promise narrow and routed through the shared inbox path.",
    advanced: {
      note:
        "Messenger support exists through the same Meta inbox path, but it should not read as broad omnichannel coverage.",
      items: [
        { label: "Coverage", value: "Shared Meta inbox" },
        { label: "Position", value: "Limited support" },
      ],
    },
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    status: "limited",
    icon: whatsappIcon,
    iconAlt: "WhatsApp",
    aliases: ["meta adjacent", "whatsapp support"],
    summary: "Partial support exists, not a full live lane.",
    capabilities: ["Partial Meta support"],
    primaryAction: {
      label: "Manage",
      path: "/workspace",
    },
    quickActions: [
      {
        label: "Open workspace",
        hint: "Check the wider operator surface.",
        path: "/workspace",
      },
      {
        label: "Open inbox",
        hint: "Use the live Meta queue.",
        path: "/inbox",
      },
      {
        label: "Open setup",
        hint: "Prepare the supporting path.",
        path: "/home?assistant=setup",
      },
    ],
    detailSummary: "WhatsApp remains visible, but not as a complete launch promise.",
    detailNote: "Keep it secondary until the lane is truly complete.",
    advanced: {
      note:
        "Some Meta-adjacent support exists, but this is not framed as a complete or customer-ready live loop.",
      items: [
        { label: "Coverage", value: "Partial Meta support" },
        { label: "Position", value: "Limited support" },
      ],
    },
  },
  {
    id: "web-chat",
    name: "Web Chat",
    status: "needs-attention",
    icon: webIcon,
    iconAlt: "Web Chat",
    aliases: ["website chatbot", "site chat", "web chat"],
    summary: "The installable site loop still needs product work.",
    capabilities: ["Website install", "Setup path"],
    primaryAction: {
      label: "Fix",
      path: "/home?assistant=setup",
    },
    quickActions: [
      {
        label: "Open setup",
        hint: "Work through the remaining setup path.",
        path: "/home?assistant=setup",
      },
      {
        label: "Open workspace",
        hint: "Check supporting operator context.",
        path: "/workspace",
      },
      {
        label: "Open truth",
        hint: "Review approved business context.",
        path: "/truth",
      },
    ],
    detailSummary: "Web Chat needs more product work before it reads as live.",
    detailNote: "Keep it in setup, not inside the first-layer promise.",
    advanced: {
      note:
        "Website chat infrastructure exists in parts, but the full installable website loop is not honestly built yet.",
      items: [
        { label: "Coverage", value: "Website chat" },
        { label: "Position", value: "Needs product work" },
      ],
    },
  },
  {
    id: "business-context",
    name: "Business Context",
    status: "context",
    iconStack: [
      { icon: gmailIcon, iconAlt: "Gmail" },
      { icon: googleDriveIcon, iconAlt: "Google Drive" },
    ],
    aliases: ["gmail", "google drive", "drive", "email", "documents", "memory"],
    summary: "Approved context feeds the live lanes behind the scenes.",
    capabilities: ["Gmail", "Drive"],
    primaryAction: {
      label: "Open",
      path: "/home?assistant=setup",
    },
    quickActions: [
      {
        label: "Open setup",
        hint: "Bring in source context.",
        path: "/home?assistant=setup",
      },
      {
        label: "Open truth",
        hint: "Review approved memory.",
        path: "/truth",
      },
      {
        label: "Open workspace",
        hint: "Return to the operator overview.",
        path: "/workspace",
      },
    ],
    detailSummary: "Context tools stay behind the live lanes, not in front of them.",
    detailNote: "Use them to strengthen setup and approved memory.",
    advanced: {
      note:
        "Email and documents act as approved source material and business context rather than as customer-facing channels.",
      items: [
        { label: "Coverage", value: "Gmail + Drive" },
        { label: "Position", value: "Context only" },
      ],
    },
  },
  {
    id: "future-channels",
    name: "Future Channels",
    status: "not-connected",
    iconStack: [
      { icon: telegramIcon, iconAlt: "Telegram" },
      { icon: tiktokIcon, iconAlt: "TikTok" },
      { icon: youtubeIcon, iconAlt: "YouTube" },
    ],
    aliases: ["telegram", "tiktok", "youtube", "planned", "future"],
    summary: "Planned lanes stay visible without reading as live.",
    capabilities: ["Telegram", "TikTok", "YouTube"],
    primaryAction: {
      label: "Connect",
      path: "/home?assistant=setup",
    },
    quickActions: [
      {
        label: "Open setup",
        hint: "Prepare future rollout work.",
        path: "/home?assistant=setup",
      },
      {
        label: "Open truth",
        hint: "Check approved rollout context.",
        path: "/truth",
      },
    ],
    detailSummary: "Future channels stay grouped and clearly secondary.",
    detailNote: "Keep them visible as plan, not promise.",
    advanced: {
      note:
        "Telegram, TikTok, and YouTube remain future-facing surfaces rather than current product lanes the app can honestly claim.",
      items: [
        { label: "Coverage", value: "Telegram, TikTok, YouTube" },
        { label: "Position", value: "Planning only" },
      ],
    },
  },
];

function normalizeQuery(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function getChannelStatusMeta(status) {
  return CHANNEL_STATUS_META[status] || CHANNEL_STATUS_META.context;
}

export function matchesChannelFilter(channel, filterId) {
  if (filterId === "all") return true;
  if (filterId === "connected") return channel.status === "connected";
  if (filterId === "limited") return channel.status === "limited";
  if (filterId === "attention") {
    return ["needs-attention", "not-connected"].includes(channel.status);
  }
  if (filterId === "context") return channel.status === "context";
  return true;
}

export function matchesChannelSearch(channel, query) {
  const normalized = normalizeQuery(query);
  if (!normalized) return true;

  const haystack = [
    channel.name,
    channel.summary,
    channel.detailSummary,
    channel.detailNote,
    ...(channel.capabilities || []),
    ...(channel.aliases || []),
    getChannelStatusMeta(channel.status).label,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

export function countChannels(filterId) {
  return CHANNELS.filter((channel) => matchesChannelFilter(channel, filterId))
    .length;
}

export function findChannelById(channelId) {
  return CHANNELS.find((channel) => channel.id === channelId) || null;
}

export function pickHeroChannel() {
  return CHANNELS.find((channel) => channel.id === "instagram") || CHANNELS[0];
}
