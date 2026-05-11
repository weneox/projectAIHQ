import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Globe2,
  Inbox,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import telegramIcon from "../../assets/channels/telegram.svg";
import instagramIcon from "../../assets/channels/instagram.svg";
import websiteIcon from "../../assets/channels/web.svg";

import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import {
  LoadingSurface,
  PageCanvas,
} from "../../components/ui/AppShellPrimitives.jsx";
import { cx } from "../../lib/cx.js";
import { normalizeNavigationAction, s } from "../../lib/appUi.js";
import useProductHome from "../../view-models/useProductHome.js";

const CHANNEL_ICON_BY_PROVIDER = {
  website: websiteIcon,
  webchat: websiteIcon,
  instagram: instagramIcon,
  meta: instagramIcon,
  telegram: telegramIcon,
};

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function unreadCount(home) {
  return n(home?.inboxState?.counts?.unreadCount);
}

function openConversationCount(home) {
  return Math.max(0, n(home?.inboxState?.counts?.openCount));
}

function handoffCount(home) {
  return n(home?.inboxState?.counts?.handoffCount);
}

function pendingOutboundCount(home) {
  return n(
    home?.inboxState?.counts?.pendingOutboundCount ??
      home?.inboxState?.counts?.outboundPending
  );
}

function failedOutboundCount(home) {
  return n(home?.inboxState?.counts?.failedOutboundCount);
}

function retryingOutboundCount(home) {
  return n(home?.inboxState?.counts?.retryingOutboundCount);
}

function waitingCount(home) {
  return (
    unreadCount(home) +
    handoffCount(home) +
    pendingOutboundCount(home) +
    failedOutboundCount(home) +
    retryingOutboundCount(home)
  );
}

function providerStates(home) {
  return arr(home?.launchChannel?.providerStates);
}

function availableChannelCount(home) {
  const states = providerStates(home);
  if (states.length) {
    return states.filter((item) => item?.available !== false).length;
  }

  return 3;
}

function readyChannelCount(home) {
  const states = providerStates(home);

  if (states.length) {
    return states.filter(
      (item) => item?.connected === true && item?.deliveryReady === true
    ).length;
  }

  const channel = home?.launchChannel || {};
  if (n(channel.readyCount) > 0) return n(channel.readyCount);
  if (channel.connected === true && channel.deliveryReady === true) return 1;

  return 0;
}

function connectedChannelCount(home) {
  const states = providerStates(home);

  if (states.length) {
    return states.filter((item) => item?.connected === true).length;
  }

  return n(home?.launchChannel?.connectedCount);
}

function businessInfoReady(home) {
  return home?.truthRuntime?.truthReady === true;
}

function assistantReady(home) {
  return home?.truthRuntime?.ready === true;
}

function channelReady(home) {
  return readyChannelCount(home) > 0;
}

function inboxUnavailable(home) {
  return lower(home?.inboxState?.status) === "unavailable";
}

function workspaceReady(home) {
  return businessInfoReady(home) && assistantReady(home) && channelReady(home);
}

function providerLabel(provider = "") {
  switch (lower(provider)) {
    case "website":
    case "webchat":
      return "Website";
    case "instagram":
    case "meta":
      return "Instagram";
    case "telegram":
      return "Telegram";
    default:
      return "Channel";
  }
}

function providerPath(provider = "") {
  switch (lower(provider)) {
    case "website":
    case "webchat":
      return "/channels?channel=website";
    case "instagram":
    case "meta":
      return "/channels?channel=instagram";
    case "telegram":
      return "/channels?channel=telegram";
    default:
      return "/channels";
  }
}

function providerIcon(provider = "") {
  return CHANNEL_ICON_BY_PROVIDER[lower(provider)] || websiteIcon;
}

function normalizeChannels(home) {
  const states = providerStates(home);

  if (states.length) {
    return states.map((item) => {
      const provider = lower(item?.provider || item?.id);
      const ready = item?.connected === true && item?.deliveryReady === true;
      const connected = item?.connected === true;

      return {
        id: provider || item?.id || item?.channelLabel || "channel",
        provider,
        label: item?.channelLabel || providerLabel(provider),
        status: ready ? "Live" : connected ? "Review" : "Off",
        tone: ready ? "success" : connected ? "warning" : "neutral",
        path: providerPath(provider),
      };
    });
  }

  return ["website", "instagram", "telegram"].map((provider) => ({
    id: provider,
    provider,
    label: providerLabel(provider),
    status: "Off",
    tone: "neutral",
    path: providerPath(provider),
  }));
}

function toneTextClass(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "brand") return "text-brand";
  return "text-text-muted";
}

function toneDotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

function buildHero(home) {
  const waiting = waitingCount(home);

  if (waiting > 0) {
    return {
      tone: "warning",
      title: "Customer work is waiting",
      detail: "Open the inbox and clear the queue.",
      primary: { label: "Open inbox", path: "/inbox" },
      secondary: { label: "Channels", path: "/channels" },
    };
  }

  if (!businessInfoReady(home)) {
    return {
      tone: "warning",
      title: "Business Info needs attention",
      detail: "Add the facts your assistant can safely use.",
      primary:
        normalizeNavigationAction(home?.assistant?.primaryAction) || {
          label: "Open Business Info",
          path: "/truth",
        },
      secondary: { label: "Channels", path: "/channels" },
    };
  }

  if (!channelReady(home)) {
    return {
      tone: "warning",
      title: "Connect a channel",
      detail: "Bring Website, Instagram, or Telegram into the inbox.",
      primary: { label: "Open channels", path: "/channels" },
      secondary: { label: "Business Info", path: "/truth" },
    };
  }

  if (inboxUnavailable(home)) {
    return {
      tone: "danger",
      title: "Inbox needs a check",
      detail: "Your setup is ready, but inbox status could not be loaded.",
      primary: { label: "Open inbox", path: "/inbox" },
      secondary: { label: "Channels", path: "/channels" },
    };
  }

  return {
    tone: "success",
    title: "Workspace is calm",
    detail: "No urgent customer work is waiting.",
    primary: { label: "Open inbox", path: "/inbox" },
    secondary: { label: "Channels", path: "/channels" },
  };
}

function StatusText({ tone = "neutral", children }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
      <span className={cx("h-1.5 w-1.5", toneDotClass(tone))} />
      <span className={toneTextClass(tone)}>{children}</span>
    </span>
  );
}

function ChannelLogo({ provider }) {
  return (
    <img
      src={providerIcon(provider)}
      alt=""
      aria-hidden="true"
      draggable="false"
      className="h-6 w-6 shrink-0 object-contain"
    />
  );
}

function HeroSection({ hero, home, onAction }) {
  return (
    <Card padded="md" className="overflow-hidden">
      <div className="grid gap-8 px-2 py-2 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
        <div className="min-w-0">
          <StatusText tone={hero.tone}>{hero.title}</StatusText>

          <h1 className="mt-5 max-w-[760px] font-display text-[42px] font-semibold leading-[0.98] tracking-[var(--tracking-tight-xl)] text-text md:text-[58px]">
            Run the business from one place.
          </h1>

          <p className="mt-5 max-w-[680px] text-[15px] font-medium leading-7 text-text-muted">
            Messages, channels, customer work, and assistant control in one clean workspace.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              type="button"
              size="md"
              onClick={() => onAction(hero.primary)}
            >
              {hero.primary.label}
              <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2.1} />
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => onAction(hero.secondary)}
            >
              {hero.secondary.label}
            </Button>
          </div>
        </div>

        <div className="border border-line-soft bg-surface-muted px-5 py-5">
          <p className="text-[13.5px] font-medium leading-6 text-text-muted">
            {hero.detail}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <div>
              <div className="text-[28px] font-semibold leading-none tracking-[var(--tracking-tight-xl)] text-text">
                {waitingCount(home)}
              </div>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                Waiting
              </div>
            </div>

            <div>
              <div className="text-[28px] font-semibold leading-none tracking-[var(--tracking-tight-xl)] text-text">
                {readyChannelCount(home)}/{availableChannelCount(home)}
              </div>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                Channels
              </div>
            </div>

            <div>
              <div className="text-[28px] font-semibold leading-none tracking-[var(--tracking-tight-xl)] text-text">
                {workspaceReady(home) ? "On" : "Safe"}
              </div>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                Assistant
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MetricCard({ icon: Icon, label, value, note, tone = "neutral", onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group block w-full text-left"
    >
      <Card
        padded="sm"
        className="h-full transition-[transform,box-shadow] duration-base ease-premium group-hover:-translate-y-0.5"
      >
        <div className="flex min-h-[128px] flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <Icon className={cx("h-5 w-5", toneTextClass(tone))} strokeWidth={2.05} />
            <span className={cx("mt-1 h-1.5 w-1.5", toneDotClass(tone))} />
          </div>

          <div>
            <div className="text-[13px] font-semibold text-text-muted">
              {label}
            </div>

            <div className="mt-2 text-[30px] font-semibold leading-none tracking-[var(--tracking-tight-xl)] text-text">
              {value}
            </div>

            <div className="mt-2 text-[12.5px] font-medium leading-5 text-text-muted">
              {note}
            </div>
          </div>
        </div>
      </Card>
    </button>
  );
}

function MetricsRow({ home, onNavigate }) {
  const unread = unreadCount(home);
  const liveChannels = readyChannelCount(home);
  const totalChannels = availableChannelCount(home);
  const ready = workspaceReady(home);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={MessageCircle}
        label="Conversations"
        value={openConversationCount(home)}
        note={unread > 0 ? `${unread} unread` : "No unread messages"}
        tone={unread > 0 ? "warning" : "success"}
        onClick={() => onNavigate("/inbox")}
      />

      <MetricCard
        icon={Globe2}
        label="Channels"
        value={`${liveChannels}/${totalChannels}`}
        note={`${connectedChannelCount(home)} connected`}
        tone={liveChannels > 0 ? "success" : "warning"}
        onClick={() => onNavigate("/channels")}
      />

      <MetricCard
        icon={ShieldCheck}
        label="Business Info"
        value={businessInfoReady(home) ? "Ready" : "Open"}
        note={businessInfoReady(home) ? "Approved facts available" : "Review details"}
        tone={businessInfoReady(home) ? "success" : "warning"}
        onClick={() => onNavigate("/truth")}
      />

      <MetricCard
        icon={Bot}
        label="Assistant"
        value={ready ? "On" : "Safe"}
        note={ready ? "Ready to help" : "Waiting for setup"}
        tone={ready ? "success" : "warning"}
        onClick={() => onNavigate(ready ? "/inbox" : "/truth")}
      />
    </div>
  );
}

function WorkPanel({ home, onNavigate }) {
  const waiting = waitingCount(home);
  const ready = workspaceReady(home);

  return (
    <Card padded="md" className="h-full">
      <div className="flex h-full flex-col justify-between gap-8">
        <div>
          <div className="flex items-center justify-between gap-5">
            <div>
              <h2 className="text-[26px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
                {waiting > 0 ? "Handle customer work" : ready ? "All clear" : "Finish setup"}
              </h2>

              <p className="mt-3 max-w-[560px] text-[13.5px] font-medium leading-6 text-text-muted">
                {waiting > 0
                  ? "Messages or replies need attention."
                  : ready
                    ? "No urgent work is waiting."
                    : "Complete Business Info and connect one channel."}
              </p>
            </div>

            {waiting > 0 ? (
              <Inbox className="h-6 w-6 text-warning" strokeWidth={2.1} />
            ) : ready ? (
              <CheckCircle2 className="h-6 w-6 text-success" strokeWidth={2.1} />
            ) : (
              <Inbox className="h-6 w-6 text-brand" strokeWidth={2.1} />
            )}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Button type="button" fullWidth onClick={() => onNavigate("/inbox")}>
              Inbox
            </Button>

            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => onNavigate("/channels")}
            >
              Channels
            </Button>

            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => onNavigate("/truth")}
            >
              Business Info
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 border border-line-soft bg-surface-muted">
          {[
            ["Unread", unreadCount(home)],
            ["Open", openConversationCount(home)],
            ["Handoff", handoffCount(home)],
            ["Waiting", waiting],
          ].map(([label, value]) => (
            <div key={label} className="border-r border-line-soft px-4 py-4 last:border-r-0">
              <div className="text-[22px] font-semibold leading-none tracking-[var(--tracking-tight-xl)] text-text">
                {value}
              </div>
              <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function ChannelsPanel({ channels, onNavigate }) {
  return (
    <Card padded={false} clip className="h-full">
      <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
        <div>
          <h2 className="text-[19px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            Channels
          </h2>
          <p className="mt-1 text-[12.5px] font-medium text-text-muted">
            Website, Instagram, Telegram.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("/channels")}
          className="text-[12.5px] font-semibold text-brand"
        >
          Manage
        </button>
      </div>

      <div className="divide-y divide-line-soft">
        {channels.slice(0, 4).map((channel) => (
          <button
            key={channel.id}
            type="button"
            onClick={() => onNavigate(channel.path)}
            className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-subtle"
          >
            <ChannelLogo provider={channel.provider} />

            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold text-text">
                {channel.label}
              </div>

              <div className={cx("mt-1 text-[12.5px] font-semibold", toneTextClass(channel.tone))}>
                {channel.status}
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-text-subtle" strokeWidth={2.1} />
          </button>
        ))}
      </div>
    </Card>
  );
}

function BusinessPanel({ home, onNavigate }) {
  const rows = [
    {
      label: "Business Info",
      value: businessInfoReady(home) ? "Ready" : "Review",
      tone: businessInfoReady(home) ? "success" : "warning",
      path: "/truth",
    },
    {
      label: "Knowledge",
      value: "Open",
      tone: "neutral",
      path: "/knowledge",
    },
    {
      label: "Assistant",
      value: assistantReady(home) ? "Ready" : "Safe",
      tone: assistantReady(home) ? "success" : "warning",
      path: "/truth",
    },
  ];

  return (
    <Card padded={false} clip className="h-full">
      <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
        <div>
          <h2 className="text-[19px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            Business control
          </h2>
          <p className="mt-1 text-[12.5px] font-medium text-text-muted">
            What the assistant can use.
          </p>
        </div>

        <ShieldCheck className="h-5 w-5 text-text-subtle" strokeWidth={2.1} />
      </div>

      <div className="divide-y divide-line-soft">
        {rows.map((row) => (
          <button
            key={row.label}
            type="button"
            onClick={() => onNavigate(row.path)}
            className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-subtle"
          >
            <span className="truncate text-[14px] font-semibold text-text">
              {row.label}
            </span>

            <span className={cx("text-[12.5px] font-semibold", toneTextClass(row.tone))}>
              {row.value}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function ProductHomeLoadingSurface() {
  return (
    <PageCanvas>
      <LoadingSurface title="Loading home" />
    </PageCanvas>
  );
}

export default function ProductHomePage() {
  const navigate = useNavigate();
  const home = useProductHome();

  function go(path) {
    if (path) navigate(path);
  }

  function goFromAction(action = null) {
    const next = normalizeNavigationAction(action);
    if (next?.path) navigate(next.path);
  }

  if (home.loading) return <ProductHomeLoadingSurface />;

  const hero = buildHero(home);
  const channels = normalizeChannels(home);

  return (
    <PageCanvas className="space-y-4 pt-4">
      <HeroSection hero={hero} home={home} onAction={goFromAction} />

      <MetricsRow home={home} onNavigate={go} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <WorkPanel home={home} onNavigate={go} />
        <ChannelsPanel channels={channels} onNavigate={go} />
      </div>

      <BusinessPanel home={home} onNavigate={go} />
    </PageCanvas>
  );
}