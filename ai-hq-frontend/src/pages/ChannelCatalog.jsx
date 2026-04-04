import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CircleDot,
  Database,
  Filter,
  Globe,
  MessageCircleMore,
  MessageSquareText,
  PhoneCall,
  Search,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";
import webIcon from "../assets/channels/web.svg";
import gmailIcon from "../assets/channels/gmail.svg";
import googleDriveIcon from "../assets/channels/google-drive.svg";
import instagramIcon from "../assets/channels/instagram.svg";
import messengerIcon from "../assets/channels/messenger.svg";
import telegramIcon from "../assets/channels/telegram.svg";
import tiktokIcon from "../assets/channels/tiktok.svg";
import whatsappIcon from "../assets/channels/whatsapp.svg";
import youtubeIcon from "../assets/channels/youtube.svg";
import {
  PageCanvas,
  PageHeader,
  Section,
  Surface,
} from "../components/ui/AppShellPrimitives.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import { InputGroup } from "../components/ui/Input.jsx";
import { cx } from "../lib/cx.js";

const FILTERS = [
  { id: "all", label: "All surfaces" },
  { id: "active", label: "Launch now" },
  { id: "ready", label: "Planned / limited" },
  { id: "context", label: "Context and setup" },
];

const STATUS_META = {
  live: {
    label: "Launch now",
    tone: "success",
    summary: "This loop is real in the current launch slice.",
  },
  connected: {
    label: "Limited",
    tone: "info",
    summary: "Some real support exists, but this is not a primary launch promise.",
  },
  ready: {
    label: "Planned",
    tone: "neutral",
    summary: "Visible future scope, not a current product loop.",
  },
  setup: {
    label: "Planned",
    tone: "warn",
    summary: "Future-facing surface that should not read as launch-ready.",
  },
  source: {
    label: "Setup input",
    tone: "neutral",
    summary: "Supports approved business context instead of acting as a live customer loop.",
  },
};

const SURFACES = [
  {
    id: "instagram-inbox",
    name: "Instagram Inbox",
    category: "active",
    status: "live",
    icon: instagramIcon,
    iconAlt: "Instagram Inbox",
    headline: "Meta social inbox is part of the real launch slice.",
    description:
      "Inbound Instagram messages, AI-assisted reply flow, and operator queue handling are real product work today.",
    actionLabel: "Open Inbox",
    actionTo: "/inbox",
    secondaryLabel: "Open workspace",
    secondaryTo: "/workspace",
  },
  {
    id: "messenger-inbox",
    name: "Messenger Inbox",
    category: "active",
    status: "connected",
    icon: messengerIcon,
    iconAlt: "Messenger Inbox",
    headline: "Facebook messaging is supported, but not the center of the launch story.",
    description:
      "Messenger uses the same Meta inbox path, but the product is not presented as broad omnichannel coverage.",
    actionLabel: "Open Inbox",
    actionTo: "/inbox",
    secondaryLabel: "Open workspace",
    secondaryTo: "/workspace",
  },
  {
    id: "instagram-comments",
    name: "Instagram Comments",
    category: "active",
    status: "live",
    iconComponent: MessageCircleMore,
    iconAlt: "Instagram Comments",
    headline: "AI-assisted comment moderation and reply handling are real product work.",
    description:
      "Comment ingest, review, reply actions, retry visibility, and operator moderation are part of the current launch slice.",
    actionLabel: "Open Comments",
    actionTo: "/comments",
    secondaryLabel: "Open truth",
    secondaryTo: "/truth",
  },
  {
    id: "voice-receptionist",
    name: "Twilio Voice Receptionist",
    category: "active",
    status: "live",
    iconComponent: PhoneCall,
    iconAlt: "Twilio Voice Receptionist",
    headline: "Inbound AI receptionist and live call control are real product work.",
    description:
      "Inbound calls, runtime resolution, transcripts, operator handoff, and call control are part of the current launch slice.",
    actionLabel: "Open Voice",
    actionTo: "/voice",
    secondaryLabel: "Open workspace",
    secondaryTo: "/workspace?focus=capabilities",
  },
  {
    id: "website-chatbot",
    name: "Website Chatbot",
    category: "ready",
    status: "ready",
    icon: webIcon,
    iconAlt: "Website Chatbot",
    headline: "Planned scope, not a real launch loop.",
    description:
      "Website chat infrastructure exists in parts, but the installable website chatbot product loop is not honestly built yet.",
    actionLabel: "Open setup assistant",
    actionTo: "/home?assistant=setup",
    secondaryLabel: "Review launch scope",
    secondaryTo: "/channels",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    category: "ready",
    status: "connected",
    icon: whatsappIcon,
    iconAlt: "WhatsApp",
    headline: "Limited scope only.",
    description:
      "Some Meta-adjacent support exists, but this is not framed as a complete or customer-ready launch loop.",
    actionLabel: "Open workspace",
    actionTo: "/workspace",
    secondaryLabel: "Open setup assistant",
    secondaryTo: "/home?assistant=setup",
  },
  {
    id: "telegram",
    name: "Telegram",
    category: "ready",
    status: "ready",
    icon: telegramIcon,
    iconAlt: "Telegram",
    headline: "Future scope only.",
    description:
      "Visible as planned expansion, not as a current capability the product can honestly claim.",
    actionLabel: "Open setup assistant",
    actionTo: "/home?assistant=setup",
    secondaryLabel: "Review launch scope",
    secondaryTo: "/channels",
  },
  {
    id: "tiktok",
    name: "TikTok",
    category: "ready",
    status: "setup",
    icon: tiktokIcon,
    iconAlt: "TikTok",
    headline: "Planned, not live.",
    description:
      "There is no honest basis for presenting TikTok as a current product loop. Keep it clearly future-facing.",
    actionLabel: "Open setup assistant",
    actionTo: "/home?assistant=setup",
    secondaryLabel: "Review launch scope",
    secondaryTo: "/channels",
  },
  {
    id: "youtube",
    name: "YouTube",
    category: "ready",
    status: "setup",
    icon: youtubeIcon,
    iconAlt: "YouTube",
    headline: "Planned, not live.",
    description:
      "YouTube should read as future channel ambition rather than as something the current product can actually operate.",
    actionLabel: "Open setup assistant",
    actionTo: "/home?assistant=setup",
    secondaryLabel: "Review launch scope",
    secondaryTo: "/channels",
  },
  {
    id: "gmail",
    name: "Gmail",
    category: "context",
    status: "source",
    icon: gmailIcon,
    iconAlt: "Gmail",
    headline: "Setup and memory input, not a live launch channel.",
    description:
      "Use email as source material and business context that strengthens the real launch loops behind the scenes.",
    actionLabel: "Open setup assistant",
    actionTo: "/home?assistant=setup",
    secondaryLabel: "Open truth",
    secondaryTo: "/truth",
  },
  {
    id: "drive",
    name: "Google Drive",
    category: "context",
    status: "source",
    icon: googleDriveIcon,
    iconAlt: "Google Drive",
    headline: "Bring documents into setup and approved memory.",
    description:
      "Useful for business context, review, and approved memory rather than as a customer-facing channel.",
    actionLabel: "Open setup assistant",
    actionTo: "/home?assistant=setup",
    secondaryLabel: "Review memory",
    secondaryTo: "/truth",
  },
];

function matchesFilter(channel, filterId) {
  if (filterId === "all") return true;
  if (filterId === "active") return channel.category === "active";
  if (filterId === "ready") return channel.category === "ready";
  if (filterId === "context") return channel.category === "context";
  return true;
}

function matchesSearch(channel, query) {
  if (!query) return true;
  const haystack = [
    channel.name,
    channel.headline,
    channel.description,
    STATUS_META[channel.status]?.label,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function ChannelIcon({ channel, className = "h-6 w-6 object-contain" }) {
  if (channel.iconComponent) {
    const Icon = channel.iconComponent;
    return <Icon className={className.replace("object-contain", "").trim()} />;
  }

  return <img src={channel.icon} alt={channel.iconAlt} className={className} />;
}

function FeatureCard({ channel, onNavigate }) {
  const status = STATUS_META[channel.status];

  return (
    <Surface className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md border border-line-soft bg-surface-muted">
            <ChannelIcon channel={channel} />
          </div>
          <div>
            <div className="text-sm font-semibold text-text">{channel.name}</div>
            <div className="mt-1 text-sm text-text-muted">{channel.headline}</div>
          </div>
        </div>
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      </div>
      <p className="text-sm leading-6 text-text-muted">{channel.description}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button
          onClick={() => onNavigate(channel.actionTo)}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          {channel.actionLabel}
        </Button>
        <Button
          variant="ghost"
          onClick={() => onNavigate(channel.secondaryTo)}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          {channel.secondaryLabel}
        </Button>
      </div>
    </Surface>
  );
}

function CatalogRow({ channel, onNavigate }) {
  const status = STATUS_META[channel.status];

  return (
    <div className="flex flex-col gap-4 border-b border-line-soft py-4 last:border-b-0 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-muted">
          <ChannelIcon channel={channel} className="h-5 w-5 object-contain" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-text">{channel.name}</h3>
            <Badge tone={status.tone} size="sm">
              {status.label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-text">{channel.headline}</p>
          <p className="mt-1 text-sm leading-6 text-text-muted">{channel.description}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate(channel.secondaryTo)}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          {channel.secondaryLabel}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onNavigate(channel.actionTo)}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          {channel.actionLabel}
        </Button>
      </div>
    </div>
  );
}

function FilterPill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex h-9 items-center rounded-pill border px-3 text-sm font-medium transition-colors",
        active
          ? "border-brand bg-brand text-white"
          : "border-line bg-surface text-text-muted hover:border-line-strong hover:text-text"
      )}
    >
      {children}
    </button>
  );
}

export default function ChannelCatalog() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("all");
  const [query, setQuery] = useState("");

  const filteredChannels = useMemo(
    () =>
      SURFACES.filter(
        (channel) =>
          matchesFilter(channel, activeFilter) && matchesSearch(channel, query)
      ),
    [activeFilter, query]
  );

  const featuredChannels = filteredChannels.filter((channel) =>
    ["live", "connected"].includes(channel.status)
  );
  const readyChannels = filteredChannels.filter(
    (channel) => channel.category === "ready"
  );
  const contextChannels = filteredChannels.filter(
    (channel) => channel.category === "context"
  );

  const totalActive = SURFACES.filter((channel) =>
    ["live", "connected"].includes(channel.status)
  ).length;
  const totalReady = SURFACES.filter((channel) => channel.category === "ready").length;
  const totalContext = SURFACES.filter((channel) => channel.category === "context").length;

  return (
    <PageCanvas className="px-4 py-6 md:px-6 md:py-8">
      <div className="space-y-8">
        <PageHeader
          eyebrow="Launch scope"
          title="What is real in the current launch slice"
          description="This product is currently centered on Meta social inbox, Meta auto-comment, and Twilio voice receptionist. Everything else on this page should read as planned, limited, or setup-only."
          actions={
            <>
              <Button variant="secondary" onClick={() => navigate("/truth")}>
                Open truth
              </Button>
              <Button onClick={() => navigate("/workspace")}>Open workspace</Button>
            </>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
          <Surface className="space-y-5">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-text-muted">
                <Waypoints className="h-4 w-4" />
                Product surfaces
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-[2rem] font-semibold tracking-[-0.03em] text-text">
                  Lead with the loops that are actually built.
                </h2>
                <p className="max-w-[56ch] text-[15px] leading-7 text-text-muted">
                  The launch story is narrower than the infrastructure. Treat social inbox, auto-comment, and voice receptionist as the real product. Treat the rest as planned or limited scope.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-line-soft bg-surface-muted px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
                  Launch now
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-text">
                  {totalActive}
                </div>
                <div className="mt-1 text-sm text-text-muted">
                  Surfaces that belong to the current launch slice.
                </div>
              </div>
              <div className="rounded-md border border-line-soft bg-surface-muted px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
                  Planned / limited
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-text">
                  {totalReady}
                </div>
                <div className="mt-1 text-sm text-text-muted">
                  Future-facing or incomplete surfaces that should not be sold as live.
                </div>
              </div>
              <div className="rounded-md border border-line-soft bg-surface-muted px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
                  Setup inputs
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-text">
                  {totalContext}
                </div>
                <div className="mt-1 text-sm text-text-muted">
                  Source and memory inputs that support the launch loops.
                </div>
              </div>
            </div>
          </Surface>

          <Surface subdued className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
              <ShieldCheck className="h-4 w-4" />
              How to read this page
            </div>
            <div className="space-y-3 text-sm leading-6 text-text-muted">
              <p>
                Launch now means the loop is real enough to sit inside the
                current product story. Limited means some support exists, but it
                should not be framed as broad channel coverage.
              </p>
              <p>
                Planned means future scope only. Setup input means the surface
                strengthens business context instead of acting as a live
                customer-facing loop.
              </p>
            </div>
            <div className="rounded-md border border-line-soft bg-surface px-4 py-3 text-sm text-text-muted">
              This page is intentionally narrower than the repo. It exists to
              stop planned channels and partial infrastructure from reading like
              finished product coverage.
            </div>
          </Surface>
        </div>

        <Surface className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map((filter) => (
                <FilterPill
                  key={filter.id}
                  active={activeFilter === filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                >
                  {filter.label}
                </FilterPill>
              ))}
            </div>
            <div className="w-full max-w-[360px]">
              <InputGroup
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search channels"
                prefix={<Search className="h-4 w-4" />}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            <Filter className="h-4 w-4" />
            <span>
              {filteredChannels.length} surface{filteredChannels.length === 1 ? "" : "s"} shown
            </span>
          </div>
        </Surface>

        <Section
          eyebrow="Launch now"
          title="Real launch surfaces"
          description="These are the loops the product can honestly center today."
        >
          {featuredChannels.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {featuredChannels.map((channel) => (
                <FeatureCard
                  key={channel.id}
                  channel={channel}
                  onNavigate={navigate}
                />
              ))}
            </div>
          ) : (
            <Surface subdued className="text-sm text-text-muted">
              No launch surfaces match the current filter.
            </Surface>
          )}
        </Section>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section
            eyebrow="Planned / limited"
            title="Visible future scope"
            description="Keep these surfaces visible only as honest future scope, not as claims about what the launch product already does."
          >
            <Surface padded="sm">
              {readyChannels.length ? (
                readyChannels.map((channel) => (
                  <CatalogRow
                    key={channel.id}
                    channel={channel}
                    onNavigate={navigate}
                  />
                ))
              ) : (
                <div className="py-2 text-sm text-text-muted">
                  No planned or limited surfaces match this view.
                </div>
              )}
            </Surface>
          </Section>

          <Section
            eyebrow="Context and setup"
            title="Support surfaces behind the launch loops"
            description="These inputs matter because they strengthen setup and approved business context, not because they are launch channels."
          >
            <Surface padded="sm">
              {contextChannels.length ? (
                contextChannels.map((channel) => (
                  <CatalogRow
                    key={channel.id}
                    channel={channel}
                    onNavigate={navigate}
                  />
                ))
              ) : (
                <div className="py-2 text-sm text-text-muted">
                  No context surfaces match this view.
                </div>
              )}
            </Surface>
          </Section>
        </div>

        <Section
          eyebrow="Launch posture"
          title="Keep the product tighter than the infrastructure"
          description="The repo reaches further than the product should claim. Keep launch copy centered on the loops that are actually operable."
        >
          <div className="grid gap-3 lg:grid-cols-4">
            <Surface subdued className="space-y-3">
              <Globe className="h-5 w-5 text-text-muted" />
              <div>
                <div className="text-sm font-semibold text-text">Do not sell website chat yet</div>
                <p className="mt-1 text-sm leading-6 text-text-muted">
                  Website chatbot work should stay outside the launch promise until the installable loop is real.
                </p>
              </div>
            </Surface>
            <Surface subdued className="space-y-3">
              <Database className="h-5 w-5 text-text-muted" />
              <div>
                <div className="text-sm font-semibold text-text">Use setup as support, not headline</div>
                <p className="mt-1 text-sm leading-6 text-text-muted">
                  Setup, memory, and review matter because they strengthen inbox, comments, and voice behavior behind the scenes.
                </p>
              </div>
            </Surface>
            <Surface subdued className="space-y-3">
              <CircleDot className="h-5 w-5 text-text-muted" />
              <div>
                <div className="text-sm font-semibold text-text">Demote future channels visibly</div>
                <p className="mt-1 text-sm leading-6 text-text-muted">
                  Telegram, TikTok, YouTube, and similar surfaces should read as planned instead of quietly implying readiness.
                </p>
              </div>
            </Surface>
            <Surface subdued className="space-y-3">
              <MessageSquareText className="h-5 w-5 text-text-muted" />
              <div>
                <div className="text-sm font-semibold text-text">Make the real loops feel intentional</div>
                <p className="mt-1 text-sm leading-6 text-text-muted">
                  Social inbox, auto-comment, and voice receptionist should feel like one focused operator product.
                </p>
              </div>
            </Surface>
          </div>
        </Section>

        <Surface className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-[640px]">
            <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
              <Sparkles className="h-4 w-4" />
              Next path
            </div>
            <h2 className="mt-2 font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-text">
              Open the surfaces that define the launch product.
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Use Inbox for Meta messaging, Comments for auto-comment work, Voice for receptionist handling, and Setup only when the launch loops need stronger business context.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => navigate("/comments")}>
              Open Comments
            </Button>
            <Button variant="secondary" onClick={() => navigate("/voice")}>
              Open Voice
            </Button>
            <Button onClick={() => navigate("/inbox")}>Open Inbox</Button>
          </div>
        </Surface>
      </div>
    </PageCanvas>
  );
}
