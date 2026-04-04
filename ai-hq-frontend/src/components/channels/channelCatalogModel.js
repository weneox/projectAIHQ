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
    label: "Live",
    tone: "success",
  },
  limited: {
    label: "Limited",
    tone: "info",
  },
  "needs-attention": {
    label: "Setup",
    tone: "warning",
  },
  "not-connected": {
    label: "Planned",
    tone: "neutral",
  },
  context: {
    label: "Context",
    tone: "neutral",
  },
};

export const CHANNEL_FILTERS = [
  { id: "all", label: "All" },
  { id: "connected", label: "Live" },
  { id: "limited", label: "Limited" },
  { id: "attention", label: "Setup" },
  { id: "context", label: "Context" },
];

export const CHANNELS = [
  {
    id: "instagram",
    name: "Instagram",
    status: "connected",
    icon: instagramIcon,
    iconAlt: "Instagram",
    aliases: ["instagram inbox", "instagram comments", "moderation", "dm"],
    summary: "Live messages and comments in one lane.",
    capabilities: ["Inbox", "Comments", "Moderation"],
    primaryAction: {
      label: "Open",
      path: "/inbox",
    },
    quickActions: [
      {
        label: "Inbox",
        hint: "Live DM queue.",
        path: "/inbox",
      },
      {
        label: "Comments",
        hint: "Moderation queue.",
        path: "/comments",
      },
      {
        label: "Truth",
        hint: "Approved memory.",
        path: "/truth",
      },
    ],
    detailSummary: "Primary live social lane with inbox and moderation.",
    detailNote: "Use Inbox for conversations and Comments for moderation.",
    advanced: {
      note: "Covers inbound messages, AI review, moderation, and retry visibility.",
      items: [
        { label: "Coverage", value: "Messages + comments" },
        { label: "State", value: "Live now" },
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
        label: "Voice",
        hint: "Live call desk.",
        path: "/voice",
      },
      {
        label: "Workspace",
        hint: "Operator posture.",
        path: "/workspace?focus=capabilities",
      },
      {
        label: "Truth",
        hint: "Approved memory.",
        path: "/truth",
      },
    ],
    detailSummary: "Live voice desk for receptionist, transfer, and transcripts.",
    detailNote: "Keep call control and handoff inside the same surface.",
    advanced: {
      note: "Covers inbound calls, runtime resolution, transcripts, and handoff.",
      items: [
        { label: "Coverage", value: "Twilio receptionist" },
        { label: "State", value: "Live now" },
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
    summary: "Meta messaging exists, but stays secondary.",
    capabilities: ["Shared inbox"],
    primaryAction: {
      label: "Review",
      path: "/inbox",
    },
    quickActions: [
      {
        label: "Inbox",
        hint: "Shared Meta queue.",
        path: "/inbox",
      },
      {
        label: "Workspace",
        hint: "Operator overview.",
        path: "/workspace",
      },
      {
        label: "Setup",
        hint: "Supporting config.",
        path: "/home?assistant=setup",
      },
    ],
    detailSummary: "Shared Meta routing without a broad omnichannel promise.",
    detailNote: "Keep Messenger routed through the core inbox lane.",
    advanced: {
      note: "Supported through the shared Meta inbox, not as a headline lane.",
      items: [
        { label: "Coverage", value: "Shared Meta inbox" },
        { label: "State", value: "Limited" },
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
    summary: "Partial support exists, not a full lane.",
    capabilities: ["Partial support"],
    primaryAction: {
      label: "Review",
      path: "/workspace",
    },
    quickActions: [
      {
        label: "Workspace",
        hint: "Operator overview.",
        path: "/workspace",
      },
      {
        label: "Inbox",
        hint: "Meta queue path.",
        path: "/inbox",
      },
      {
        label: "Setup",
        hint: "Supporting path.",
        path: "/home?assistant=setup",
      },
    ],
    detailSummary: "Visible as support coverage, not a complete launch surface.",
    detailNote: "Keep it secondary until the lane is complete.",
    advanced: {
      note: "Some support exists, but this is not a complete customer-ready loop.",
      items: [
        { label: "Coverage", value: "Partial support" },
        { label: "State", value: "Limited" },
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
    summary: "The site loop still needs product work.",
    capabilities: ["Website install", "Setup"],
    primaryAction: {
      label: "Setup",
      path: "/home?assistant=setup",
    },
    quickActions: [
      {
        label: "Setup",
        hint: "Remaining setup work.",
        path: "/home?assistant=setup",
      },
      {
        label: "Workspace",
        hint: "Operator context.",
        path: "/workspace",
      },
      {
        label: "Truth",
        hint: "Approved memory.",
        path: "/truth",
      },
    ],
    detailSummary: "Website chat remains a setup track, not a live promise.",
    detailNote: "Keep it in setup until the install loop is complete.",
    advanced: {
      note: "Infrastructure exists in parts, but the full installable loop is not ready.",
      items: [
        { label: "Coverage", value: "Website chat" },
        { label: "State", value: "Needs work" },
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
      label: "Setup",
      path: "/home?assistant=setup",
    },
    quickActions: [
      {
        label: "Setup",
        hint: "Bring in context.",
        path: "/home?assistant=setup",
      },
      {
        label: "Truth",
        hint: "Approved memory.",
        path: "/truth",
      },
      {
        label: "Workspace",
        hint: "Operator overview.",
        path: "/workspace",
      },
    ],
    detailSummary: "Context sources strengthen setup and truth, not customer routing.",
    detailNote: "Use them to improve approved memory and operator context.",
    advanced: {
      note: "Email and documents act as source material rather than live channels.",
      items: [
        { label: "Coverage", value: "Gmail + Drive" },
        { label: "State", value: "Context only" },
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
      label: "Setup",
      path: "/home?assistant=setup",
    },
    quickActions: [
      {
        label: "Setup",
        hint: "Future rollout work.",
        path: "/home?assistant=setup",
      },
      {
        label: "Truth",
        hint: "Approved rollout context.",
        path: "/truth",
      },
    ],
    detailSummary: "Future surfaces stay grouped as plan, not promise.",
    detailNote: "Keep them visible for rollout planning only.",
    advanced: {
      note: "Telegram, TikTok, and YouTube stay future-facing rather than current lanes.",
      items: [
        { label: "Coverage", value: "Telegram, TikTok, YouTube" },
        { label: "State", value: "Planned" },
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
    channel.primaryAction?.label,
    ...(channel.capabilities || []),
    ...(channel.aliases || []),
    ...((channel.quickActions || []).flatMap((action) => [action.label, action.hint])),
    channel.advanced?.note,
    ...((channel.advanced?.items || []).flatMap((item) => [item.label, item.value])),
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
