import gmailIcon from "../../assets/channels/gmail.svg";
import instagramIcon from "../../assets/channels/instagram.svg";
import telegramIcon from "../../assets/channels/telegram.svg";
import whatsappIcon from "../../assets/channels/whatsapp.svg";

export const CHANNEL_STATUS_META = {
  ready: {
    label: "Ready",
    tone: "info",
  },
  connected: {
    label: "Connected",
    tone: "success",
  },
  connecting: {
    label: "Connecting",
    tone: "warning",
  },
  reconnect_required: {
    label: "Reconnect",
    tone: "warning",
  },
  deauthorized: {
    label: "Reconnect",
    tone: "warning",
  },
  disconnected: {
    label: "Disconnected",
    tone: "neutral",
  },
  blocked: {
    label: "Blocked",
    tone: "warning",
  },
  error: {
    label: "Needs repair",
    tone: "warning",
  },
  not_connected: {
    label: "Not connected",
    tone: "neutral",
  },
  phase2: {
    label: "Phase 2",
    tone: "neutral",
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
  status = "phase2",
  primaryActionLabel = "Details",
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
      label: primaryActionLabel,
    },
  };
}

export const CHANNELS = [
  connector({
    id: "instagram",
    name: "Instagram",
    group: "social",
    status: "ready",
    icon: instagramIcon,
    iconAlt: "Instagram",
    eyebrow: "DM-first / Instagram Business",
    summary:
      "Connect one Instagram Business or Professional account per tenant and run inbound DM automation with tenant-specific runtime.",
    capabilities: ["Direct messages", "Tenant-aware routing", "Reconnect flow"],
    aliases: [
      "instagram",
      "dm",
      "meta",
      "social",
      "inbox",
      "direct messages",
      "tenant",
    ],
    detailSummary:
      "Instagram is the launch connector. It is the only self-serve path that is being hardened for a DM-first production release.",
    detailNote:
      "The launch story is inbound customer conversations only. Comments and content publish stay out of the launch promise until they have matching permissions and operational proof.",
    highlights: [
      "One tenant, one Instagram Business connection, one truthful runtime state.",
      "Inbound DM automation stays fail-closed when tokens or channel identifiers go missing.",
      "Reconnect, disconnect, and deauthorize all map to explicit tenant channel state.",
    ],
    primaryActionLabel: "Open",
  }),

  connector({
    id: "whatsapp",
    name: "WhatsApp",
    group: "social",
    status: "phase2",
    icon: whatsappIcon,
    iconAlt: "WhatsApp",
    eyebrow: "Phase 2 / Not self-serve",
    summary:
      "WhatsApp remains a future expansion surface. It is not part of the Instagram DM-first launch promise.",
    capabilities: ["Planned channel", "Future onboarding", "Not in launch scope"],
    aliases: [
      "whatsapp",
      "wa",
      "chat",
      "support",
      "messages",
      "phase 2",
    ],
    detailSummary:
      "WhatsApp should stay behind the launch line until onboarding, runtime behavior, and review story match the same standard as Instagram.",
    detailNote:
      "This connector is intentionally demoted from self-serve launch status so the product story stays honest.",
    highlights: [
      "Not available as a launch-ready self-serve connection.",
      "Do not treat this as production-ready automation yet.",
      "Keep it as a planned expansion after DM-first launch stabilizes.",
    ],
    primaryActionLabel: "Details",
  }),

  connector({
    id: "telegram",
    name: "Telegram",
    group: "social",
    status: "ready",
    icon: telegramIcon,
    iconAlt: "Telegram",
    eyebrow: "Bot-first / Private chat MVP",
    summary:
      "Connect one Telegram bot per tenant, verify the webhook, and route private text chats into the existing AI inbox runtime.",
    capabilities: ["Private text chats", "Bot token connect", "Tenant-bound webhook"],
    aliases: [
      "telegram",
      "bot",
      "private chat",
      "webhook",
      "support",
      "chat",
      "tenant",
    ],
    detailSummary:
      "Telegram is available as a real self-serve connector for tenants that want a bot-driven private chat surface inside the same inbox and runtime pipeline.",
    detailNote:
      "The current MVP supports private text messages only. Group chats, media, and unsupported control actions stay fail-closed instead of pretending they are live.",
    highlights: [
      "Connection is validated against Telegram before the tenant is marked connected.",
      "Webhook registration is tenant-bound and secret-verified before inbound delivery is trusted.",
      "Outbound replies reuse the same durable inbox execution path as the rest of AI HQ.",
    ],
    primaryActionLabel: "Open",
  }),

  connector({
    id: "gmail",
    name: "Gmail",
    group: "business",
    status: "phase2",
    icon: gmailIcon,
    iconAlt: "Gmail",
    eyebrow: "Phase 2 / Not self-serve",
    summary:
      "Gmail remains outside the current launch path while Instagram DM automation is being hardened.",
    capabilities: ["Planned intake", "Future support surface", "Not in launch scope"],
    aliases: [
      "gmail",
      "email",
      "mail",
      "google mail",
      "business inbox",
      "phase 2",
    ],
    detailSummary:
      "Email intake may become useful later, but it is not part of the launch system being prepared for Meta review.",
    detailNote:
      "Keeping this connector clearly marked as phase 2 avoids fake readiness signals in the product.",
    highlights: [
      "Not available for DM-first self-serve onboarding.",
      "Not part of the Meta review story.",
      "Treat as roadmap only until a dedicated launch pass exists.",
    ],
    primaryActionLabel: "Details",
  }),
];

function normalizeQuery(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function getChannelStatusMeta(status) {
  return CHANNEL_STATUS_META[status] || CHANNEL_STATUS_META.ready;
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
