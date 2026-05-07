import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Globe2,
  Inbox,
  MessageCircle,
  PlugZap,
  RadioTower,
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
import {
  normalizeNavigationAction,
  s,
} from "../../lib/appUi.js";
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

function pluralize(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
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

function outboundAttentionCount(home) {
  return (
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

function truthApproved(home) {
  return home?.truthRuntime?.truthReady === true;
}

function runtimeReady(home) {
  return home?.truthRuntime?.ready === true;
}

function businessReady(home) {
  return truthApproved(home) && runtimeReady(home);
}

function channelReady(home) {
  return readyChannelCount(home) > 0;
}

function inboxUnavailable(home) {
  return lower(home?.inboxState?.status) === "unavailable";
}

function inboxReadyForData(home) {
  return !inboxUnavailable(home);
}

function aiOperating(home) {
  return businessReady(home) && channelReady(home) && inboxReadyForData(home);
}

function hasLiveWork(home) {
  return (
    unreadCount(home) > 0 ||
    outboundAttentionCount(home) > 0 ||
    handoffCount(home) > 0 ||
    openConversationCount(home) > 0
  );
}

function toneTextClass(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "brand" || tone === "info") return "text-brand";

  return "text-text-muted";
}

function toneDotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand" || tone === "info") return "bg-brand";

  return "bg-[rgb(var(--color-text-soft))]";
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

function StatusText({ tone = "neutral", children }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold">
      <span className={cx("h-1.5 w-1.5 rounded-full", toneDotClass(tone))} />
      <span className={toneTextClass(tone)}>{children}</span>
    </span>
  );
}

function FreeIcon({ icon: Icon, tone = "neutral", className }) {
  return (
    <Icon
      className={cx(
        "h-[21px] w-[21px] shrink-0",
        toneTextClass(tone),
        className
      )}
      strokeWidth={2.05}
    />
  );
}

function ChannelImageIcon({ provider, className }) {
  return (
    <img
      src={providerIcon(provider)}
      alt=""
      aria-hidden="true"
      draggable="false"
      className={cx("h-[22px] w-[22px] shrink-0 object-contain", className)}
    />
  );
}

function buildHero(home) {
  const unread = unreadCount(home);
  const pending = outboundAttentionCount(home);
  const readyChannels = readyChannelCount(home);

  if (unread > 0) {
    return {
      tone: "warning",
      title: `${unread} ${unread === 1 ? "message" : "messages"} waiting`,
      summary: "Customer work is active. Open the inbox and handle the queue.",
      primary: { label: "Open inbox", path: "/inbox" },
      secondary: { label: "Channels", path: "/channels" },
    };
  }

  if (pending > 0) {
    return {
      tone: "warning",
      title: `${pending} ${pending === 1 ? "reply" : "replies"} need review`,
      summary: "Some outbound replies may need retry or delivery check.",
      primary: { label: "Review replies", path: "/inbox" },
      secondary: { label: "Channels", path: "/channels" },
    };
  }

  if (!truthApproved(home)) {
    return {
      tone: "warning",
      title: "Business info first",
      summary: "Add the facts AI can safely use with customers.",
      primary:
        normalizeNavigationAction(home?.assistant?.primaryAction) || {
          label: "Review setup",
          path: "/truth",
        },
      secondary: { label: "Channels", path: "/channels" },
    };
  }

  if (!runtimeReady(home)) {
    return {
      tone: "warning",
      title: "Runtime needs review",
      summary: "Business info exists. The live AI layer still needs attention.",
      primary: { label: "Open business info", path: "/truth" },
      secondary: { label: "Inbox", path: "/inbox" },
    };
  }

  if (!channelReady(home)) {
    return {
      tone: "warning",
      title: "Connect one channel",
      summary: "Website, Instagram, or Telegram can become the first live surface.",
      primary: { label: "Open channels", path: "/channels" },
      secondary: { label: "Business info", path: "/truth" },
    };
  }

  if (inboxUnavailable(home)) {
    return {
      tone: "danger",
      title: "Inbox status unavailable",
      summary: "Setup is ready, but customer activity could not be checked.",
      primary: { label: "Open inbox", path: "/inbox" },
      secondary: { label: "Channels", path: "/channels" },
    };
  }

  return {
    tone: "success",
    title: "Workspace is calm",
    summary: `${pluralize(readyChannels, "channel")} live. No urgent customer work.`,
    primary: { label: "Open inbox", path: "/inbox" },
    secondary: { label: "Channels", path: "/channels" },
  };
}

function buildBusinessTile(home) {
  if (businessReady(home)) {
    return {
      id: "business",
      tone: "success",
      icon: ShieldCheck,
      title: "Business info",
      value: "Ready",
      path: "/truth",
      mode: "data",
    };
  }

  if (truthApproved(home)) {
    return {
      id: "business",
      tone: "warning",
      icon: CircleAlert,
      title: "Business info",
      value: "Review",
      path: "/truth",
      mode: "guide",
    };
  }

  return {
    id: "business",
    tone: "warning",
    icon: ShieldCheck,
    title: "Business info",
    value: "Add",
    path: "/truth",
    mode: "guide",
  };
}

function buildChannelTile(home) {
  const ready = readyChannelCount(home);
  const connected = connectedChannelCount(home);
  const total = availableChannelCount(home);

  if (ready > 0) {
    return {
      id: "channels",
      tone: "success",
      icon: RadioTower,
      title: "Channels",
      value: `${ready}/${total} live`,
      path: "/channels",
      mode: "data",
    };
  }

  if (connected > 0) {
    return {
      id: "channels",
      tone: "warning",
      icon: PlugZap,
      title: "Channels",
      value: "Review",
      path: "/channels",
      mode: "guide",
    };
  }

  return {
    id: "channels",
    tone: "warning",
    icon: PlugZap,
    title: "Channels",
    value: "Connect",
    path: "/channels",
    mode: "guide",
  };
}

function buildInboxTile(home) {
  const unread = unreadCount(home);
  const pending = outboundAttentionCount(home);

  if (unread > 0) {
    return {
      id: "inbox",
      tone: "warning",
      icon: MessageCircle,
      title: "Inbox",
      value: String(unread),
      path: "/inbox",
      mode: "data",
    };
  }

  if (pending > 0) {
    return {
      id: "inbox",
      tone: "warning",
      icon: Clock3,
      title: "Inbox",
      value: String(pending),
      path: "/inbox",
      mode: "data",
    };
  }

  if (!businessReady(home) || !channelReady(home)) {
    return {
      id: "inbox",
      tone: "warning",
      icon: Inbox,
      title: "Inbox",
      value: "Next",
      path: "/inbox",
      mode: "guide",
    };
  }

  if (inboxUnavailable(home)) {
    return {
      id: "inbox",
      tone: "danger",
      icon: Inbox,
      title: "Inbox",
      value: "Check",
      path: "/inbox",
      mode: "guide",
    };
  }

  return {
    id: "inbox",
    tone: "success",
    icon: Inbox,
    title: "Inbox",
    value: "Clear",
    path: "/inbox",
    mode: "data",
  };
}

function buildAiTile(home) {
  if (aiOperating(home)) {
    return {
      id: "ai",
      tone: "success",
      icon: Bot,
      title: "AI status",
      value: "Operating",
      path: "/truth",
      mode: "data",
    };
  }

  if (businessReady(home) && !channelReady(home)) {
    return {
      id: "ai",
      tone: "warning",
      icon: Bot,
      title: "AI status",
      value: "Waiting",
      path: "/channels",
      mode: "guide",
    };
  }

  return {
    id: "ai",
    tone: "warning",
    icon: Bot,
    title: "AI status",
    value: "Guarded",
    path: "/truth",
    mode: "guide",
  };
}

function buildTiles(home) {
  return [
    buildBusinessTile(home),
    buildChannelTile(home),
    buildInboxTile(home),
    buildAiTile(home),
  ];
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
        value: ready ? "Live" : connected ? "Review" : "Off",
        tone: ready ? "success" : connected ? "warning" : "neutral",
        account:
          s(item?.accountDisplayName) ||
          s(item?.accountHandle) ||
          s(item?.account?.displayName) ||
          s(item?.account?.handle) ||
          (ready ? "Ready for delivery" : "Open to configure"),
        path: providerPath(provider),
      };
    });
  }

  return ["website", "instagram", "telegram"].map((provider) => ({
    id: provider,
    provider,
    label: providerLabel(provider),
    value: "Off",
    tone: "neutral",
    account: "Open to configure",
    path: providerPath(provider),
  }));
}

function MiniTrend({ tone = "brand" }) {
  const strokeClass =
    tone === "success"
      ? "stroke-success"
      : tone === "warning"
        ? "stroke-warning"
        : tone === "danger"
          ? "stroke-danger"
          : "stroke-brand";

  return (
    <svg viewBox="0 0 128 40" aria-hidden="true" className="h-10 w-28">
      <path
        d="M4 30 C18 24, 25 24, 36 26 C48 29, 52 17, 64 18 C77 19, 80 10, 92 12 C105 15, 108 24, 124 15"
        fill="none"
        className={strokeClass}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CommandHero({ hero, onAction }) {
  return (
    <section className="border-b border-line-soft pb-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[24px] font-semibold leading-tight tracking-[var(--tracking-tight-lg)] text-text">
              Home
            </h1>

            <span
              className={cx(
                "inline-flex h-7 items-center gap-2 rounded-full border px-3 text-[12px] font-semibold",
                hero.tone === "success"
                  ? "border-[rgba(var(--color-success),0.2)] bg-success-soft text-success"
                  : "border-[rgba(var(--color-warning),0.22)] bg-warning-soft text-warning"
              )}
            >
              <span
                className={cx(
                  "h-1.5 w-1.5 rounded-full",
                  hero.tone === "success" ? "bg-success" : "bg-warning"
                )}
              />
              {hero.title}
            </span>
          </div>

          <p className="mt-2 max-w-[640px] text-[14px] font-medium leading-6 text-text-muted">
            {hero.summary}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="min-w-[128px] justify-center"
            onClick={() => onAction(hero.primary)}
          >
            {hero.primary.label}
            <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2.1} />
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-w-[116px] justify-center"
            onClick={() => onAction({ label: "Channels", path: "/channels" })}
          >
            Channels
          </Button>
        </div>
      </div>
    </section>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  caption,
  tone = "brand",
  action,
  onNavigate,
}) {
  return (
    <Card padded="sm" className="min-h-[126px]">
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <span className={cx(
            "inline-flex h-9 w-9 items-center justify-center rounded-[14px] border",
            tone === "success"
              ? "border-[rgba(var(--color-success),0.2)] bg-success-soft text-success"
              : tone === "warning"
                ? "border-[rgba(var(--color-warning),0.22)] bg-warning-soft text-warning"
                : tone === "danger"
                  ? "border-[rgba(var(--color-danger),0.2)] bg-danger-soft text-danger"
                  : "border-[rgba(var(--color-brand),0.18)] bg-brand-soft text-brand"
          )}>
            <Icon className="h-4 w-4" strokeWidth={2.1} />
          </span>

          <MiniTrend tone={tone} />
        </div>

        <div>
          <div className="text-[13px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
            {label}
          </div>

          <div className="mt-1.5 text-[24px] font-semibold leading-none tracking-[var(--tracking-tight-xl)] text-text">
            {value}
          </div>

          <div className="mt-1 text-[12px] font-medium text-text-muted">
            {caption}
          </div>

          {action ? (
            <button
              type="button"
              onClick={() => onNavigate(action.path)}
              className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand transition-colors hover:text-brand-strong"
            >
              {action.label}
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.1} />
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function KpiGrid({ home, onNavigate }) {
  const ready = readyChannelCount(home);
  const available = availableChannelCount(home);
  const connected = connectedChannelCount(home);
  const open = openConversationCount(home);
  const unread = unreadCount(home);
  const pending = outboundAttentionCount(home);
  const handoff = handoffCount(home);
  const truthReadyFlag = truthApproved(home);
  const runtimeFlag = runtimeReady(home);
  const operating = aiOperating(home);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        icon={Globe2}
        label="Connected channels"
        value={`${ready}/${available}`}
        caption={`${connected} connected channel${connected == 1 ? "" : "s"}`}
        tone={ready > 0 ? "success" : connected > 0 ? "warning" : "brand"}
        action={{ label: "View channels", path: "/channels" }}
        onNavigate={onNavigate}
      />

      <KpiCard
        icon={MessageCircle}
        label="Open conversations"
        value={open}
        caption={`${unread} unread · ${handoff} handoff`}
        tone={unread > 0 || pending > 0 ? "warning" : "brand"}
        action={{ label: "Open inbox", path: "/inbox" }}
        onNavigate={onNavigate}
      />

      <KpiCard
        icon={ShieldCheck}
        label="AI coverage"
        value={operating ? "Live" : truthReadyFlag && runtimeFlag ? "Ready" : "Guarded"}
        caption={truthReadyFlag ? "Business Info approved" : "Business Info required"}
        tone={operating ? "success" : "warning"}
        action={{ label: "View guardrails", path: "/truth" }}
        onNavigate={onNavigate}
      />

      <KpiCard
        icon={Clock3}
        label="Response health"
        value={pending > 0 ? "Review" : unread > 0 ? "Active" : "Calm"}
        caption={`${pending} pending outbound action${pending == 1 ? "" : "s"}`}
        tone={pending > 0 || unread > 0 ? "warning" : "success"}
        action={{ label: "View reports", path: "/reports" }}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function NextBestActionsPanel({ tiles, onNavigate }) {
  const completed = tiles.filter((item) => item.mode === "data").length;

  return (
    <Card padded={false} clip>
      <div className="flex items-center justify-between gap-4 border-b border-line-soft px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            Setup
          </div>
          <div className="mt-1 text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            Launch checklist
          </div>
        </div>

        <span className="text-[12px] font-semibold text-text-muted">
          {completed}/{tiles.length}
        </span>
      </div>

      <div className="divide-y divide-line-soft">
        {tiles.map((item) => {
          const Icon = item.icon;
          const completedItem = item.mode === "data";

          return (
            <button
              type="button"
              key={item.id}
              onClick={() => onNavigate(item.path)}
              className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors duration-base ease-premium hover:bg-surface-subtle"
            >
              <span
                className={cx(
                  "inline-flex h-9 w-9 items-center justify-center rounded-[14px] border",
                  completedItem
                    ? "border-[rgba(var(--color-success),0.2)] bg-success-soft text-success"
                    : "border-line-soft bg-surface text-text-muted"
                )}
              >
                {completedItem ? (
                  <CheckCircle2 className="h-4.5 w-4.5" strokeWidth={2.1} />
                ) : (
                  <Icon className="h-4 w-4" strokeWidth={2.1} />
                )}
              </span>

              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
                  {item.title}
                </span>
                <span className={cx("mt-0.5 block truncate text-[12px] font-semibold", toneTextClass(item.tone))}>
                  {completedItem ? "Ready" : item.value}
                </span>
              </span>

              <ArrowRight
                className="h-4 w-4 text-text-subtle transition-colors group-hover:text-text"
                strokeWidth={2.1}
              />
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function ChannelPanel({ items, onNavigate }) {
  return (
    <Card padded={false} clip>
      <div className="flex items-center justify-between gap-4 border-b border-line-soft px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            Channels
          </div>
          <div className="mt-1 text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            Connected surfaces
          </div>
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
        {items.slice(0, 4).map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => onNavigate(item.path)}
            className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors duration-base ease-premium hover:bg-surface-subtle"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[14px] border border-line-soft bg-white">
              <ChannelImageIcon provider={item.provider} className="h-[20px] w-[20px]" />
            </span>

            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[13.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
                  {item.label}
                </span>
                <span className={cx("h-1.5 w-1.5 rounded-full", toneDotClass(item.tone))} />
                <span className={cx("text-[12px] font-semibold", toneTextClass(item.tone))}>
                  {item.value}
                </span>
              </span>

              {item.value === "Off" ? null : (
                <span className="mt-0.5 block truncate text-[12px] font-medium text-text-muted">
                  {item.account}
                </span>
              )}
            </span>

            <ArrowRight className="h-4 w-4 text-text-subtle transition-colors group-hover:text-text" strokeWidth={2.1} />
          </button>
        ))}
      </div>
    </Card>
  );
}

function InboxPulsePanel({ home, onNavigate }) {
  const rows = [
    {
      id: "unread",
      label: "Unread messages",
      value: unreadCount(home),
      tone: unreadCount(home) > 0 ? "warning" : "success",
      detail: "Customer messages waiting",
    },
    {
      id: "open",
      label: "Open conversations",
      value: openConversationCount(home),
      tone: openConversationCount(home) > 0 ? "brand" : "success",
      detail: "Active threads across channels",
    },
    {
      id: "handoff",
      label: "Human handoff",
      value: handoffCount(home),
      tone: handoffCount(home) > 0 ? "warning" : "success",
      detail: "Operator-owned conversations",
    },
    {
      id: "pending",
      label: "Outbound review",
      value: outboundAttentionCount(home),
      tone: outboundAttentionCount(home) > 0 ? "warning" : "success",
      detail: "Pending/retry outbound actions",
    },
  ];

  return (
    <Card padded={false} clip>
      <div className="flex items-center justify-between gap-4 border-b border-line-soft px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            Inbox pulse
          </div>
          <div className="mt-1 text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            Conversation activity
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("/inbox")}
          className="text-[12.5px] font-semibold text-brand"
        >
          Open inbox
        </button>
      </div>

      <div className="divide-y divide-line-soft">
        {rows.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5"
          >
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
                {item.label}
              </div>
              <div className="mt-0.5 truncate text-[12px] font-medium text-text-muted">
                {item.detail}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={cx("h-1.5 w-1.5 rounded-full", toneDotClass(item.tone))} />
              <span className="text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BusinessKnowledgePanel({ home, onNavigate }) {
  const truthReady = truthApproved(home);
  const runtime = runtimeReady(home);

  return (
    <Card padded="md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            Business Truth / Knowledge
          </div>
          <div className="mt-2 text-[30px] font-semibold leading-none tracking-[var(--tracking-tight-xl)] text-text">
            {truthReady ? "Approved" : "Pending"}
          </div>
          <div className="mt-2 text-[12.5px] font-medium leading-5 text-text-muted">
            {truthReady
              ? "AI can use approved business facts."
              : "Approve business facts before AI can safely answer customers."}
          </div>
        </div>

        <span className={cx(
          "inline-flex h-11 w-11 items-center justify-center rounded-[16px] border",
          truthReady
            ? "border-[rgba(var(--color-success),0.2)] bg-success-soft text-success"
            : "border-[rgba(var(--color-warning),0.22)] bg-warning-soft text-warning"
        )}>
          <ShieldCheck className="h-5 w-5" strokeWidth={2.1} />
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-[14px] border border-line-soft bg-surface px-3 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            Business Info
          </div>
          <div className="mt-1 text-[13px] font-semibold text-text">
            {truthReady ? "Ready" : "Needs approval"}
          </div>
        </div>

        <div className="rounded-[14px] border border-line-soft bg-surface px-3 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            Runtime
          </div>
          <div className="mt-1 text-[13px] font-semibold text-text">
            {runtime ? "Ready" : "Guarded"}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onNavigate("/truth")}
        className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand"
      >
        Review Business Info
        <ArrowRight className="h-4 w-4" strokeWidth={2.1} />
      </button>
    </Card>
  );
}

function AiRuntimePanel({ home, onNavigate }) {
  const operating = aiOperating(home);
  const truthReady = truthApproved(home);
  const runtime = runtimeReady(home);

  const rows = [
    ["AI guard status", operating ? "Active" : "Guarded", operating ? "success" : "warning"],
    ["Approval flow", truthReady ? "Enabled" : "Required", truthReady ? "success" : "warning"],
    ["Fallback behavior", runtime ? "Ask then handoff" : "Blocked until ready", runtime ? "brand" : "warning"],
    ["Human handoff", "Available", "success"],
  ];

  return (
    <Card padded="md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            AI runtime / Automation
          </div>
          <div className="mt-2 text-[22px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            {operating ? "Automation operating" : "Manual-first control"}
          </div>
        </div>

        <span className={cx(
          "inline-flex h-11 w-11 items-center justify-center rounded-[16px] border",
          operating
            ? "border-[rgba(var(--color-success),0.2)] bg-success-soft text-success"
            : "border-[rgba(var(--color-warning),0.22)] bg-warning-soft text-warning"
        )}>
          <Bot className="h-5 w-5" strokeWidth={2.1} />
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-text-muted">{label}</span>
            <span className={cx("text-[12.5px] font-semibold", toneTextClass(tone))}>
              {value}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onNavigate("/settings")}
        className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand"
      >
        View settings
        <ArrowRight className="h-4 w-4" strokeWidth={2.1} />
      </button>
    </Card>
  );
}

function PerformanceOverviewPanel({ home, onNavigate }) {
  const conversations = openConversationCount(home);
  const unread = unreadCount(home);
  const pending = outboundAttentionCount(home);
  const ready = readyChannelCount(home);

  return (
    <Card padded="md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            Performance overview
          </div>
          <div className="mt-2 text-[22px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            Operational pressure
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("/reports")}
          className="text-[12.5px] font-semibold text-brand"
        >
          Reports
        </button>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          ["Open", conversations],
          ["Unread", unread],
          ["Pending", pending],
          ["Live", ready],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[14px] border border-line-soft bg-surface px-3 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              {label}
            </div>
            <div className="mt-1 text-[18px] font-semibold text-text">
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[16px] border border-line-soft bg-white px-3 py-3">
        <MiniTrend tone={pending > 0 || unread > 0 ? "warning" : "brand"} />
      </div>
    </Card>
  );
}

function OmnichannelFlowPanel({ home, onNavigate }) {
  const steps = [
    {
      icon: Globe2,
      title: "Customer channels",
      detail: `${readyChannelCount(home)}/${availableChannelCount(home)} live surfaces`,
      path: "/channels",
      tone: channelReady(home) ? "success" : "warning",
    },
    {
      icon: Inbox,
      title: "Shared inbox",
      detail: `${openConversationCount(home)} open conversations`,
      path: "/inbox",
      tone: openConversationCount(home) > 0 ? "brand" : "success",
    },
    {
      icon: ShieldCheck,
      title: "Business Info guard",
      detail: truthApproved(home) ? "Approved facts available" : "Approval required",
      path: "/truth",
      tone: truthApproved(home) ? "success" : "warning",
    },
    {
      icon: Bot,
      title: "Manual-first AI",
      detail: aiOperating(home) ? "Automation operating" : "Safe replies stay guarded",
      path: "/settings",
      tone: aiOperating(home) ? "success" : "warning",
    },
  ];

  return (
    <Card padded={false} clip>
      <div className="flex items-center justify-between gap-4 border-b border-line-soft px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            Flowchart
          </div>
          <div className="mt-1 text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            Omnichannel runtime flow
          </div>
        </div>

        <span className="inline-flex h-8 items-center gap-2 rounded-full border border-line-soft bg-surface px-3 text-[12px] font-semibold text-text-muted">
          <span className={cx("h-1.5 w-1.5 rounded-full", aiOperating(home) ? "bg-success" : "bg-warning")} />
          {aiOperating(home) ? "Operating" : "Guarded mode"}
        </span>
      </div>

      <div className="grid gap-3 px-4 py-4 lg:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;

          return (
            <button
              type="button"
              key={step.title}
              onClick={() => onNavigate(step.path)}
              className="group relative rounded-[18px] border border-line-soft bg-white px-4 py-4 text-left transition-all duration-base ease-premium hover:-translate-y-0.5 hover:border-[rgba(var(--color-brand),0.28)]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[15px] border border-line-soft bg-surface">
                  <Icon className={cx("h-5 w-5", toneTextClass(step.tone))} strokeWidth={2.1} />
                </span>

                {index < steps.length - 1 ? (
                  <ArrowRight className="hidden h-5 w-5 text-text-subtle lg:block" strokeWidth={2.1} />
                ) : null}
              </div>

              <div className="mt-4 text-[14px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                {step.title}
              </div>
              <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
                {step.detail}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function SetupOverviewCard({ icon: Icon, label, value, tone = "neutral" }) {
  return (
    <Card padded="sm" className="min-h-[78px]">
      <div className="flex items-center gap-3">
        <span
          className={cx(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border",
            tone === "success"
              ? "border-[rgba(var(--color-success),0.2)] bg-success-soft text-success"
              : tone === "warning"
                ? "border-[rgba(var(--color-warning),0.22)] bg-warning-soft text-warning"
                : tone === "danger"
                  ? "border-[rgba(var(--color-danger),0.2)] bg-danger-soft text-danger"
                  : "border-line-soft bg-surface text-text-muted"
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2.1} />
        </span>

        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
            {label}
          </div>

          <div className="mt-1 truncate text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
            {value}
          </div>
        </div>
      </div>
    </Card>
  );
}

function SetupOverview({ home }) {
  const connected = connectedChannelCount(home);
  const ready = readyChannelCount(home);
  const available = availableChannelCount(home);
  const business = businessReady(home);
  const truth = truthApproved(home);
  const runtime = runtimeReady(home);
  const inboxReady = inboxReadyForData(home);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <SetupOverviewCard
        icon={ShieldCheck}
        label="Business Info"
        value={business ? "Ready" : truth ? "Review" : "Required"}
        tone={business ? "success" : "warning"}
      />

      <SetupOverviewCard
        icon={Globe2}
        label="Channels"
        value={ready > 0 ? `${ready}/${available} live` : connected > 0 ? "Review" : `0/${available}`}
        tone={ready > 0 ? "success" : "warning"}
      />

      <SetupOverviewCard
        icon={Inbox}
        label="Inbox"
        value={business && ready > 0 && inboxReady ? "Ready" : "Waiting"}
        tone={business && ready > 0 && inboxReady ? "success" : "neutral"}
      />

      <SetupOverviewCard
        icon={Bot}
        label="AI Guard"
        value={business && runtime && ready > 0 ? "Ready" : "Manual"}
        tone={business && runtime && ready > 0 ? "success" : "warning"}
      />
    </div>
  );
}

function SetupGuardPanel({ home, onNavigate }) {
  const hero = buildHero(home);

  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
          Start here
        </div>

        <div className="mt-1 text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
          {hero.primary.label}
        </div>
      </div>

      <div className="px-4 py-4">
        <p className="text-[13px] font-medium leading-6 text-text-muted">
          {hero.summary}
        </p>

        <button
          type="button"
          onClick={() => onNavigate(hero.primary.path)}
          className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-[12px] bg-brand px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          {hero.primary.label}
          <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2.1} />
        </button>
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
  const tiles = buildTiles(home);
  const channels = normalizeChannels(home);
  const setupMode = !aiOperating(home) && !hasLiveWork(home);

  if (setupMode) {
    return (
      <PageCanvas className="space-y-3 pt-2 md:space-y-3 md:pt-3">
        <CommandHero hero={hero} onAction={goFromAction} />

        <SetupOverview home={home} />

        <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <NextBestActionsPanel tiles={tiles} onNavigate={go} />
          <ChannelPanel items={channels} onNavigate={go} />
        </div>
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="space-y-3 pt-2 md:space-y-3 md:pt-3">
      <CommandHero hero={hero} onAction={goFromAction} />

      <KpiGrid home={home} onNavigate={go} />

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_350px_380px]">
        <NextBestActionsPanel tiles={tiles} onNavigate={go} />
        <ChannelPanel items={channels} onNavigate={go} />
        <InboxPulsePanel home={home} onNavigate={go} />
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_400px]">
        <BusinessKnowledgePanel home={home} onNavigate={go} />
        <AiRuntimePanel home={home} onNavigate={go} />
        <PerformanceOverviewPanel home={home} onNavigate={go} />
      </div>

      <OmnichannelFlowPanel home={home} onNavigate={go} />
    </PageCanvas>
  );
}

