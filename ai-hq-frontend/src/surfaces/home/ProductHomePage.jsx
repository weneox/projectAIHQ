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
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../../components/ui/AppShellPrimitives.jsx";
import { cx } from "../../lib/cx.js";
import {
  compactSentence,
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

function setupReadyCount(home) {
  return [
    businessReady(home),
    channelReady(home),
    inboxReadyForData(home) && businessReady(home) && channelReady(home),
    aiOperating(home),
  ].filter(Boolean).length;
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

function tileStatusLabel(item) {
  if (item?.mode !== "data") return "Setup";
  if (item?.tone === "warning") return "Attention";
  if (item?.tone === "danger") return "Check";
  return "Active";
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
      eyebrow: "Live work",
      title: `${unread} ${unread === 1 ? "message" : "messages"} waiting`,
      summary: "Customer work is active. Open the inbox and handle the queue.",
      primary: { label: "Open inbox", path: "/inbox" },
      secondary: { label: "Channels", path: "/channels" },
    };
  }

  if (pending > 0) {
    return {
      tone: "warning",
      eyebrow: "Delivery",
      title: `${pending} ${pending === 1 ? "reply" : "replies"} need review`,
      summary: "Some outbound replies may need retry or delivery check.",
      primary: { label: "Review replies", path: "/inbox" },
      secondary: { label: "Channels", path: "/channels" },
    };
  }

  if (!truthApproved(home)) {
    return {
      tone: "warning",
      eyebrow: "Start",
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
      eyebrow: "Review",
      title: "Runtime needs review",
      summary: "Business info exists. The live AI layer still needs attention.",
      primary: { label: "Open business info", path: "/truth" },
      secondary: { label: "Inbox", path: "/inbox" },
    };
  }

  if (!channelReady(home)) {
    return {
      tone: "warning",
      eyebrow: "Connect",
      title: "Connect one channel",
      summary: "Website, Instagram, or Telegram can become the first live surface.",
      primary: { label: "Open channels", path: "/channels" },
      secondary: { label: "Business info", path: "/truth" },
    };
  }

  if (inboxUnavailable(home)) {
    return {
      tone: "danger",
      eyebrow: "Check",
      title: "Inbox status unavailable",
      summary: "Setup is ready, but customer activity could not be checked.",
      primary: { label: "Open inbox", path: "/inbox" },
      secondary: { label: "Channels", path: "/channels" },
    };
  }

  return {
    tone: "success",
    eyebrow: "Operating",
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
      detail: "Approved facts are backing the live runtime.",
      actionLabel: "View",
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
      detail: "Facts are approved. Runtime still needs attention.",
      actionLabel: "Review",
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
    detail: "Services, tone, rules, and business basics.",
    actionLabel: "Start",
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
      detail:
        connected > ready
          ? `${connected} connected, ${ready} ready for delivery.`
          : "Customers can reach the workspace.",
      actionLabel: "View",
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
      detail: `${connected} connected, but not live yet.`,
      actionLabel: "Fix",
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
    detail: "Pick website, Instagram, or Telegram.",
    actionLabel: "Connect",
    path: "/channels",
    mode: "guide",
  };
}

function buildInboxTile(home) {
  const unread = unreadCount(home);
  const open = openConversationCount(home);
  const pending = outboundAttentionCount(home);

  if (unread > 0) {
    return {
      id: "inbox",
      tone: "warning",
      icon: MessageCircle,
      title: "Inbox",
      value: String(unread),
      detail: `${pluralize(unread, "message")} waiting.`,
      actionLabel: "Reply",
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
      detail: "Outbound replies need review.",
      actionLabel: "Review",
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
      detail: "Becomes operational after business info and a live channel.",
      actionLabel: "Open",
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
      detail: "Customer activity could not be loaded.",
      actionLabel: "Open",
      path: "/inbox",
      mode: "guide",
    };
  }

  return {
    id: "inbox",
    tone: "success",
    icon: Inbox,
    title: "Inbox",
    value: open > 0 ? String(open) : "Clear",
    detail: open > 0 ? `${pluralize(open, "conversation")} open.` : "No urgent work.",
    actionLabel: "Open",
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
      detail: "AI can support customers under approved rules.",
      actionLabel: "View",
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
      detail: "AI is ready, but no customer channel is live.",
      actionLabel: "Connect",
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
    detail: "Limited until business info and runtime are ready.",
    actionLabel: "Review",
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

function buildWorkItems(home) {
  const items = [];

  const unread = unreadCount(home);
  const pending = outboundAttentionCount(home);
  const handoff = handoffCount(home);
  const open = openConversationCount(home);

  if (unread > 0 || pending > 0) {
    items.push(buildInboxTile(home));
  }

  if (handoff > 0) {
    items.push({
      id: "handoff",
      tone: "brand",
      icon: Inbox,
      title: `${pluralize(handoff, "handoff")} active`,
      detail: "Operator-owned conversations are active.",
      actionLabel: "Open",
      path: "/inbox",
      mode: "data",
    });
  }

  if (open > 0 && !items.some((item) => item.id === "inbox")) {
    items.push({
      id: "open",
      tone: "brand",
      icon: Inbox,
      title: `${pluralize(open, "conversation")} open`,
      detail: "No urgent unread pressure, but the queue is active.",
      actionLabel: "Open",
      path: "/inbox",
      mode: "data",
    });
  }

  if (!items.length) {
    items.push({
      id: "calm",
      tone: "success",
      icon: CheckCircle2,
      title: "No urgent work",
      detail: "Everything active is calm right now.",
      actionLabel: "Open",
      path: "/inbox",
      mode: "data",
    });
  }

  return items.slice(0, 4);
}

function MetricCell({ label, value, tone = "neutral", border = "" }) {
  return (
    <div className={cx("px-4 py-3.5", border)}>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-text-subtle">
        {label}
      </div>
      <div
        className={cx(
          "mt-1.5 text-[26px] font-semibold leading-none tracking-[var(--tracking-tight-xl)]",
          toneTextClass(tone)
        )}
      >
        {value}
      </div>
    </div>
  );
}

function SetupStatePanel({ home, tone = "warning" }) {
  const readyCount = setupReadyCount(home);
  const percentage = Math.max(8, readyCount * 25);

  return (
    <div className="border-t border-line-soft px-5 py-4 xl:border-l xl:border-t-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-text-subtle">
        Setup state
      </div>

      <div className="mt-2 flex items-end gap-2">
        <div
          className={cx(
            "text-[31px] font-semibold leading-none tracking-[var(--tracking-tight-xl)]",
            toneTextClass(tone)
          )}
        >
          {readyCount}/4
        </div>
        <div className="pb-1 text-[12.5px] font-semibold text-text-muted">
          ready
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-subtle">
        <div
          className={cx(
            "h-full rounded-full transition-all duration-base ease-premium",
            readyCount === 4 ? "bg-success" : "bg-warning"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-3 text-[12.5px] font-medium leading-5 text-text-muted">
        Active parts switch to live data automatically.
      </div>
    </div>
  );
}

function HeroCard({ hero, home, operating = false, onAction }) {
  return (
    <Card padded={false} clip>
      <section
        className={cx(
          "grid",
          operating
            ? "xl:grid-cols-[minmax(0,1fr)_360px]"
            : "xl:grid-cols-[minmax(0,1fr)_300px]"
        )}
      >
        <div className="min-w-0 px-5 py-[18px] md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
              Home
            </div>

            <StatusText tone={hero.tone}>
              {hero.tone === "success" ? "Operating" : "Attention"}
            </StatusText>
          </div>

          <h1
            className={cx(
              "mt-3 max-w-[760px] font-display font-semibold leading-[1.01] tracking-[var(--tracking-tight-xl)] text-text",
              operating
                ? "text-[32px] md:text-[42px]"
                : "text-[30px] md:text-[37px]"
            )}
          >
            {hero.title}
          </h1>

          <p className="mt-2.5 max-w-[640px] text-[14.5px] font-medium leading-6 tracking-[var(--tracking-tight-sm)] text-text-muted">
            {hero.summary}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              size="md"
              className="min-w-[142px] justify-center"
              onClick={() => onAction(hero.primary)}
            >
              {hero.primary.label}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              className="min-w-[126px] justify-center"
              onClick={() => onAction(hero.secondary)}
            >
              {hero.secondary.label}
            </Button>
          </div>
        </div>

        {operating ? (
          <div className="border-t border-line-soft xl:border-l xl:border-t-0">
            <div className="grid grid-cols-2">
              <MetricCell
                label="Messages"
                value={unreadCount(home)}
                tone={unreadCount(home) > 0 ? "warning" : "success"}
                border="border-b border-r border-line-soft"
              />

              <MetricCell
                label="Open"
                value={openConversationCount(home)}
                tone={openConversationCount(home) > 0 ? "brand" : "neutral"}
                border="border-b border-line-soft"
              />

              <MetricCell
                label="Channels"
                value={`${readyChannelCount(home)}/${availableChannelCount(home)}`}
                tone={channelReady(home) ? "success" : "warning"}
                border="border-r border-line-soft"
              />

              <MetricCell
                label="Replies"
                value={outboundAttentionCount(home)}
                tone={outboundAttentionCount(home) > 0 ? "warning" : "success"}
              />
            </div>
          </div>
        ) : (
          <SetupStatePanel home={home} tone={hero.tone} />
        )}
      </section>
    </Card>
  );
}

function SignalTile({ item, index, total, onNavigate }) {
  const Icon = item.icon;
  const last = index === total - 1;

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.path)}
      className={cx(
        "group min-h-[128px] w-full px-4 py-3.5 text-left",
        !last && "border-b border-line-soft md:border-b-0 md:border-r",
        "transition-colors duration-base ease-premium hover:bg-surface-subtle"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <FreeIcon icon={Icon} tone={item.tone} className="h-[19px] w-[19px]" />

        <StatusText tone={item.tone}>{tileStatusLabel(item)}</StatusText>
      </div>

      <div className="mt-3.5">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
          {item.title}
        </div>

        <div
          className={cx(
            "mt-1.5 text-[22px] font-semibold leading-none tracking-[var(--tracking-tight-xl)]",
            toneTextClass(item.tone)
          )}
        >
          {item.value}
        </div>

        <div className="mt-2 min-h-[32px] text-[12.5px] font-medium leading-5 text-text-muted">
          {item.detail}
        </div>
      </div>

      <div className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-muted transition-colors duration-base ease-premium group-hover:text-text">
        {item.actionLabel}
        <ArrowRight className="h-4 w-4" strokeWidth={2.1} />
      </div>
    </button>
  );
}

function LaunchPathPanel({ tiles, onNavigate }) {
  return (
    <Card padded={false} clip>
      <div className="flex items-center justify-between gap-4 px-4 py-3.5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            Path
          </div>
          <div className="mt-1 text-[19px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            Launch progress
          </div>
        </div>

        <FreeIcon
          icon={
            tiles.every((item) => item.mode === "data")
              ? CheckCircle2
              : CircleAlert
          }
          tone={tiles.every((item) => item.mode === "data") ? "success" : "warning"}
        />
      </div>

      <div className="border-t border-line-soft px-4 py-4">
        <div className="grid gap-3 md:grid-cols-4">
          {tiles.map((item, index) => {
            const Icon = item.icon;

            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onNavigate(item.path)}
                className="group min-w-0 text-left transition-opacity duration-base ease-premium hover:opacity-80"
              >
                <div className="flex items-start gap-2.5">
                  <FreeIcon
                    icon={Icon}
                    tone={item.tone}
                    className="mt-0.5 h-[18px] w-[18px]"
                  />

                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                      {item.title}
                    </div>

                    <StatusText tone={item.tone}>
                      {item.mode === "data" ? "Ready" : item.value}
                    </StatusText>
                  </div>
                </div>

                {index < tiles.length - 1 ? (
                  <div className="ml-[27px] mt-3 hidden h-px bg-line-soft md:block" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function WorkPanel({ items, onNavigate }) {
  return (
    <Card padded={false} clip>
      <div className="flex items-center justify-between gap-4 px-4 py-3.5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            Now
          </div>
          <div className="mt-1 text-[19px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            Current work
          </div>
        </div>

        <FreeIcon
          icon={
            items.some((item) => item.tone === "warning")
              ? CircleAlert
              : CheckCircle2
          }
          tone={
            items.some((item) => item.tone === "warning")
              ? "warning"
              : "success"
          }
        />
      </div>

      <div className="border-t border-line-soft">
        {items.map((item, index) => (
          <button
            type="button"
            key={item.id}
            onClick={() => onNavigate(item.path)}
            className={cx(
              "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 text-left",
              index !== items.length - 1 && "border-b border-line-soft",
              "transition-colors duration-base ease-premium hover:bg-surface-subtle"
            )}
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2.5">
                <FreeIcon
                  icon={item.icon}
                  tone={item.tone}
                  className="h-[18px] w-[18px]"
                />
                <span className="truncate text-[14.5px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                  {item.title}
                </span>
              </span>

              <span className="mt-1.5 block text-[12.5px] font-medium leading-5 text-text-muted">
                {item.detail}
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-muted transition-colors duration-base ease-premium group-hover:text-text">
              {item.actionLabel}
              <ArrowRight className="h-4 w-4" strokeWidth={2.1} />
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function ChannelPanel({ items, onNavigate }) {
  return (
    <Card padded={false} clip>
      <div className="flex items-center justify-between gap-4 px-4 py-3.5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            Surfaces
          </div>
          <div className="mt-1 text-[19px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            Customer channels
          </div>
        </div>

        <FreeIcon icon={Globe2} tone="brand" />
      </div>

      <div className="border-t border-line-soft">
        {items.slice(0, 3).map((item, index) => (
          <button
            type="button"
            key={item.id}
            onClick={() => onNavigate(item.path)}
            className={cx(
              "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 text-left",
              index !== Math.min(items.length, 3) - 1 &&
                "border-b border-line-soft",
              "transition-colors duration-base ease-premium hover:bg-surface-subtle"
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              <ChannelImageIcon provider={item.provider} />

              <span className="min-w-0">
                <span className="flex items-center gap-3">
                  <span className="truncate text-[14.5px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                    {item.label}
                  </span>
                  <StatusText tone={item.tone}>{item.value}</StatusText>
                </span>

                <span className="mt-1 block truncate text-[12.5px] font-medium text-text-muted">
                  {item.account}
                </span>
              </span>
            </span>

            <ArrowRight
              className="h-4 w-4 shrink-0 text-text-subtle transition-colors duration-base ease-premium group-hover:text-text"
              strokeWidth={2.1}
            />
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
  const tiles = buildTiles(home);
  const workItems = buildWorkItems(home);
  const channels = normalizeChannels(home);
  const operatingMode = aiOperating(home) || hasLiveWork(home);

  return (
    <PageCanvas className="space-y-4 pt-3 md:pt-4">
      {home.availabilityNote ? (
        <InlineNotice
          tone="warning"
          title={s(home.availabilityNote.title, "Some live context is limited")}
          description={compactSentence(home.availabilityNote.description)}
          compact
        />
      ) : null}

      <HeroCard
        hero={hero}
        home={home}
        operating={operatingMode}
        onAction={goFromAction}
      />

      {operatingMode ? (
        <Card padded={false} clip>
          <div className="grid md:grid-cols-4">
            {tiles.map((item, index) => (
              <SignalTile
                key={item.id}
                item={item}
                index={index}
                total={tiles.length}
                onNavigate={go}
              />
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        {operatingMode ? (
          <WorkPanel items={workItems} onNavigate={go} />
        ) : (
          <LaunchPathPanel tiles={tiles} onNavigate={go} />
        )}

        <ChannelPanel items={channels} onNavigate={go} />
      </div>
    </PageCanvas>
  );
}