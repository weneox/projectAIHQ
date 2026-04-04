import gmailIcon from "../../assets/channels/gmail.svg";
import instagramIcon from "../../assets/channels/instagram.svg";
import telegramIcon from "../../assets/channels/telegram.svg";
import whatsappIcon from "../../assets/channels/whatsapp.svg";

export const CHANNEL_STATUS_META = {
  available: {
    label: "Ready",
    tone: "info",
  },
  connected: {
    label: "Connected",
    tone: "success",
  },
};

export const CHANNEL_FILTERS = [
  { id: "all", label: "All" },
  { id: "social", label: "Social" },
  { id: "business", label: "Business" },
];

function connector({
  id,
  name,
  group,
  icon,
  iconAlt,
  eyebrow,
  summary,
  capabilities,
  aliases,
  detailSummary,
  detailNote,
  highlights,
  path,
  status = "available",
}) {
  return {
    id,
    name,
    group,
    status,
    icon,
    iconAlt,
    eyebrow,
    summary,
    capabilities,
    aliases,
    detailSummary,
    detailNote,
    highlights,
    primaryAction: {
      label: "Connect",
      path,
    },
  };
}

export const CHANNELS = [
  connector({
    id: "instagram",
    name: "Instagram",
    group: "social",
    status: "available",
    icon: instagramIcon,
    iconAlt: "Instagram",
    eyebrow: "DMs · Comments · Moderation",
    summary:
      "Bring Instagram conversations and public interactions into one refined operating surface.",
    capabilities: ["Direct messages", "Comments", "Moderation"],
    aliases: [
      "instagram",
      "dm",
      "comments",
      "meta",
      "social",
      "inbox",
      "moderation",
    ],
    detailSummary:
      "Instagram is the strongest connector for brands that handle both private conversation flow and public comment activity every day.",
    detailNote:
      "Connect it when your team wants faster response handling without splitting inbox work and moderation across separate tools.",
    highlights: [
      "Unify DMs and comment activity in one workspace.",
      "Move faster on moderation without losing conversation context.",
      "Keep operator review, handoff, and response flow cleaner from day one.",
    ],
    path: "/home?assistant=setup&channel=instagram",
  }),

  connector({
    id: "whatsapp",
    name: "WhatsApp",
    group: "social",
    status: "available",
    icon: whatsappIcon,
    iconAlt: "WhatsApp",
    eyebrow: "Support chat · Direct customer flow",
    summary:
      "Add WhatsApp as a direct customer line for support, follow-up, and everyday messaging.",
    capabilities: ["Customer chat", "Support replies", "Follow-up flow"],
    aliases: [
      "whatsapp",
      "wa",
      "chat",
      "support",
      "messages",
      "customer service",
    ],
    detailSummary:
      "WhatsApp works best when customers expect quick, direct replies and your business depends on ongoing message-based support.",
    detailNote:
      "It is the right connector for teams that want a more reliable customer chat flow than scattered phone-based handling.",
    highlights: [
      "Bring direct customer conversations into the main operating workspace.",
      "Reduce reply chaos across personal devices and separate accounts.",
      "Create a cleaner support handoff path as message volume grows.",
    ],
    path: "/home?assistant=setup&channel=whatsapp",
  }),

  connector({
    id: "telegram",
    name: "Telegram",
    group: "social",
    status: "available",
    icon: telegramIcon,
    iconAlt: "Telegram",
    eyebrow: "Community touchpoint · Fast messaging",
    summary:
      "Use Telegram for lightweight conversation flow, updates, and community-facing messaging.",
    capabilities: ["Direct chat", "Community touchpoint", "Fast updates"],
    aliases: [
      "telegram",
      "community",
      "channel",
      "support",
      "chat",
      "messages",
    ],
    detailSummary:
      "Telegram is a strong fit when your audience already lives in fast, community-style messaging rather than slower traditional support channels.",
    detailNote:
      "Connect it when your brand runs on speed, repeat interaction, or audience groups that expect a more informal message rhythm.",
    highlights: [
      "Open a cleaner Telegram path directly from the connector catalog.",
      "Support audience messaging without turning it into tool sprawl.",
      "Keep Telegram inside the same operational layer as your other channels.",
    ],
    path: "/home?assistant=setup&channel=telegram",
  }),

  connector({
    id: "gmail",
    name: "Gmail",
    group: "business",
    status: "available",
    icon: gmailIcon,
    iconAlt: "Gmail",
    eyebrow: "Email intake · Follow-up · Business requests",
    summary:
      "Connect Gmail to pull email-based customer work into the same system as your live channels.",
    capabilities: ["Business email", "Customer requests", "Email context"],
    aliases: [
      "gmail",
      "email",
      "mail",
      "google mail",
      "business inbox",
      "support email",
    ],
    detailSummary:
      "Gmail is the right connector when customer communication, approvals, requests, or follow-ups still arrive through email.",
    detailNote:
      "Use it to stop treating email like a disconnected world and bring more of your business flow into one place.",
    highlights: [
      "Bring business email into the same operating surface as chat.",
      "Reduce context switching between inbox tools and internal follow-up.",
      "Keep more history, responsibility, and customer continuity in one system.",
    ],
    path: "/home?assistant=setup&channel=gmail",
  }),
];

function normalizeQuery(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function getChannelStatusMeta(status) {
  return CHANNEL_STATUS_META[status] || CHANNEL_STATUS_META.available;
}

export function matchesChannelFilter(channel, filterId) {
  if (filterId === "all") return true;
  return channel.group === filterId;
}

export function matchesChannelSearch(channel, query) {
  const normalized = normalizeQuery(query);
  if (!normalized) return true;

  const haystack = [
    channel.name,
    channel.group,
    channel.eyebrow,
    channel.summary,
    channel.detailSummary,
    channel.detailNote,
    ...(channel.capabilities || []),
    ...(channel.aliases || []),
    ...(channel.highlights || []),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

export function findChannelById(channelId) {
  return CHANNELS.find((channel) => channel.id === channelId) || null;
}