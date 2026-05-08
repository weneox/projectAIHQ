import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Globe2,
  Mail,
  MessageCircle,
  Plug,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
} from "lucide-react";

import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import AppIcon from "../components/ui/AppIcon.jsx";
import AppStatusText from "../components/ui/AppStatusText.jsx";
import { PageCanvas, PageHeader } from "../components/ui/AppShellPrimitives.jsx";

const CHANNELS = [
  {
    id: "website-chat",
    name: "Website Chat",
    type: "Website",
    status: "connected",
    health: "ready",
    description: "Capture website visitors and route conversations into Inbox.",
  },
  {
    id: "instagram",
    name: "Instagram",
    type: "Social",
    status: "connected",
    health: "ready",
    description: "Connect Instagram DMs and qualify social conversations.",
  },
  {
    id: "facebook",
    name: "Facebook",
    type: "Social",
    status: "pending",
    health: "action required",
    description: "Receive Facebook page messages after permission review.",
  },
  {
    id: "telegram",
    name: "Telegram",
    type: "Messaging",
    status: "connected",
    health: "ready",
    description: "Route Telegram conversations into your workspace inbox.",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    type: "Messaging",
    status: "not connected",
    health: "disabled",
    description: "Connect WhatsApp Business for customer messaging.",
  },
  {
    id: "email",
    name: "Email",
    type: "Email",
    status: "pending",
    health: "paused",
    description: "Send follow-up emails and operational handoff messages.",
  },
];

const CATEGORIES = ["All", "Website", "Social", "Messaging", "Email"];

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function titleize(value = "") {
  return s(value || "unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function channelIcon(type = "") {
  const safe = lower(type);

  if (safe === "website") return Globe2;
  if (safe === "social") return MessageCircle;
  if (safe === "messaging") return Smartphone;
  if (safe === "email") return Mail;

  return Plug;
}

function statusTone(status = "") {
  const safe = lower(status);

  if (safe === "connected") return "success";
  if (safe === "pending") return "warning";
  return "neutral";
}

function healthSignal(channel = {}) {
  const status = lower(channel.status);
  const health = lower(channel.health);

  if (status === "connected" && health === "ready") {
    return {
      icon: CheckCircle2,
      text: "Ready",
      className: "text-success",
    };
  }

  if (health === "action required") {
    return {
      icon: ShieldAlert,
      text: "Needs setup",
      className: "text-warning",
    };
  }

  if (status === "pending") {
    return {
      icon: ShieldAlert,
      text: "Setup paused",
      className: "text-brand",
    };
  }

  return {
    icon: Plug,
    text: "Not connected",
    className: "text-text-muted",
  };
}

function actionLabel(channel = {}) {
  const status = lower(channel.status);

  if (status === "connected") return "Manage";
  if (status === "pending") return "Continue";

  return "Connect";
}

function actionVariant(channel = {}) {
  return lower(channel.status) === "connected" ? "secondary" : "primary";
}

function matchesChannel(channel = {}, query = "") {
  const q = lower(query);
  if (!q) return true;

  return lower(
    [
      channel.name,
      channel.type,
      channel.status,
      channel.health,
      channel.description,
      actionLabel(channel),
    ].join(" ")
  ).includes(q);
}

function ChannelRow({ channel }) {
  const Icon = channelIcon(channel.type);
  const signal = healthSignal(channel);
  const SignalIcon = signal.icon;

  return (
    <div className="grid min-h-[76px] grid-cols-[minmax(240px,0.9fr)_minmax(280px,1fr)_160px_132px] items-center gap-4 border-b border-line-soft px-5 py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-4">
        <AppIcon
          icon={Icon}
          size="lg"
          tone="text"
          strokeWidth={2.05}
          className="shrink-0"
        />

        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
            {channel.name}
          </div>
          <div className="mt-0.5 truncate text-[12.5px] font-medium text-text-muted">
            {channel.type}
          </div>
        </div>
      </div>

      <div className="min-w-0 truncate text-[13px] font-medium text-text-muted">
        {channel.description}
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <SignalIcon className={`h-4 w-4 shrink-0 ${signal.className}`} strokeWidth={2.1} />
        <span className={`truncate text-[12.5px] font-semibold ${signal.className}`}>
          {signal.text}
        </span>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          variant={actionVariant(channel)}
          rightIcon={<ArrowRight className="h-3.5 w-3.5" strokeWidth={2.15} />}
        >
          {actionLabel(channel)}
        </Button>
      </div>
    </div>
  );
}

export default function ChannelCatalog() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const filteredChannels = useMemo(() => {
    return CHANNELS.filter((channel) =>
      category === "All" ? true : channel.type === category
    ).filter((channel) => matchesChannel(channel, query));
  }, [category, query]);

  return (
    <PageCanvas>
      <PageHeader
        title="Channel catalog"
        description="Connect messaging, social, website, and email channels to your workspace."
        actions={
          <Button
            type="button"
            variant="secondary"
            size="md"
            leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
          >
            Refresh
          </Button>
        }
      />

      <div className="flex flex-col gap-4 border-b border-line-soft pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={category === item ? "primary" : "ghost"}
              onClick={() => setCategory(item)}
            >
              {item}
            </Button>
          ))}
        </div>

        <div className="w-full xl:w-[380px]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search channels..."
            appearance="quiet"
            leftIcon={<Search className="h-4 w-4" strokeWidth={2.1} />}
          />
        </div>
      </div>

      <Card padded={false} clip>
        <div className="grid h-11 grid-cols-[minmax(240px,0.9fr)_minmax(280px,1fr)_160px_132px] items-center gap-4 border-b border-line-soft px-5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
          <div>Channel</div>
          <div>Purpose</div>
          <div>Health</div>
          <div className="text-right">Action</div>
        </div>

        {filteredChannels.length ? (
          filteredChannels.map((channel) => (
            <ChannelRow key={channel.id} channel={channel} />
          ))
        ) : (
          <div className="flex min-h-[260px] items-center justify-center px-6 py-12 text-center">
            <div className="max-w-[420px]">
              <Plug className="mx-auto h-8 w-8 text-text-muted" strokeWidth={2.05} />

              <div className="mt-5 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                No channels found
              </div>

              <div className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
                Clear the search or choose another category to see available providers.
              </div>

              <div className="mt-5">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setQuery("");
                    setCategory("All");
                  }}
                >
                  Clear search
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </PageCanvas>
  );
}