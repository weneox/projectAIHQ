import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Inbox,
  MessageCircle,
  PlugZap,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

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

function pluralVerb(count, singular, plural) {
  return count === 1 ? singular : plural;
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

function outboundPendingCount(home) {
  return n(home?.inboxState?.counts?.outboundPending);
}

function pendingOutboundCount(home) {
  return n(
    home?.inboxState?.counts?.pendingOutboundCount ??
      home?.inboxState?.counts?.outboundPending
  );
}

function readyChannelCount(home) {
  const channel = home?.launchChannel || {};

  if (n(channel.readyCount) > 0) return n(channel.readyCount);
  if (channel.connected === true && channel.deliveryReady === true) return 1;

  return 0;
}

function availableChannelCount(home) {
  const states = arr(home?.launchChannel?.providerStates);
  if (states.length) {
    return states.filter((item) => item?.available !== false).length;
  }

  return 3;
}

function businessInfoReady(home) {
  return (
    home?.truthRuntime?.truthReady === true &&
    home?.truthRuntime?.ready === true
  );
}

function channelReady(home) {
  return (
    home?.launchChannel?.connected === true &&
    home?.launchChannel?.deliveryReady === true
  );
}

function inboxUnavailable(home) {
  return lower(home?.inboxState?.status) === "unavailable";
}

function buildPageCopy(home) {
  const unread = unreadCount(home);
  const channels = readyChannelCount(home);

  if (unread > 0) {
    const businessReady = businessInfoReady(home);
    const channelCopy =
      channels > 0
        ? `${pluralize(channels, "channel")} can receive messages`
        : "no channels are marked live";

    return {
      eyebrow: "Customer work",
      title: `${pluralize(unread, "customer message")} waiting`,
      summary: `${pluralize(unread, "customer message")} ${pluralVerb(
        unread,
        "needs",
        "need"
      )} a reply. ${
        businessReady ? "Business info is ready" : "Business info still needs review"
      } and ${channelCopy}.`,
      primaryLabel: "Reply now",
      primaryPath: "/inbox",
      tone: "warning",
    };
  }

  if (!businessInfoReady(home)) {
    return {
      eyebrow: "Setup needed",
      title: "Approve your business info",
      summary:
        "AI should not answer customers until your business details are reviewed and approved.",
      primaryLabel: "Review business info",
      primaryPath: "/truth",
      tone: "warning",
    };
  }

  if (!channelReady(home)) {
    return {
      eyebrow: "Setup needed",
      title: "Connect a customer channel",
      summary:
        "Choose where customers can message you first: website chat, Instagram, or Telegram.",
      primaryLabel: "Connect channel",
      primaryPath: "/channels",
      tone: "warning",
    };
  }

  if (inboxUnavailable(home)) {
    return {
      eyebrow: "Needs check",
      title: "Inbox could not be loaded",
      summary:
        "Business info and channels look ready, but customer activity could not be checked.",
      primaryLabel: "Open inbox",
      primaryPath: "/inbox",
      tone: "danger",
    };
  }

  return {
    eyebrow: "All clear",
    title: "No customer work waiting",
    summary:
      channels > 0
        ? `${pluralize(channels, "channel")} live. Inbox is clear right now.`
        : "Workspace is calm right now.",
    primaryLabel: "Open inbox",
    primaryPath: "/inbox",
    tone: "success",
  };
}

function buildMainActions(home) {
  const unread = unreadCount(home);
  const pendingOutbound = outboundPendingCount(home);

  const actions = [];

  if (unread > 0) {
    actions.push({
      id: "reply",
      title: `Reply to ${pluralize(unread, "customer message")}`,
      detail: `${pluralize(unread, "customer message")} waiting in the inbox.`,
      path: "/inbox",
      label: "Open inbox",
      tone: "warning",
      icon: MessageCircle,
    });
  }

  if (pendingOutbound > 0) {
    actions.push({
      id: "outbound",
      title: `Check ${pluralize(pendingOutbound, "outbound reply")}`,
      detail: "Some replies may need retry or delivery review.",
      path: "/inbox",
      label: "Review replies",
      tone: "warning",
      icon: Inbox,
    });
  }

  if (!businessInfoReady(home)) {
    actions.push({
      id: "business",
      title: "Review business info",
      detail: "Approve the facts AI is allowed to use with customers.",
      path: "/truth",
      label: "Review info",
      tone: "warning",
      icon: ShieldCheck,
    });
  }

  if (!channelReady(home)) {
    actions.push({
      id: "channel",
      title: "Connect one customer channel",
      detail: "Website chat, Instagram, or Telegram can become your first live channel.",
      path: "/channels",
      label: "Open channels",
      tone: "warning",
      icon: PlugZap,
    });
  }

  if (!actions.length) {
    actions.push({
      id: "clear",
      title: "Nothing urgent right now",
      detail: "Customer messages are clear. You can open the inbox or review setup anytime.",
      path: "/inbox",
      label: "Open inbox",
      tone: "success",
      icon: CheckCircle2,
    });
  }

  return actions.slice(0, 3);
}

function buildSafetyChecks(home) {
  const unread = unreadCount(home);
  const channels = readyChannelCount(home);
  const total = availableChannelCount(home);

  return [
    {
      id: "business",
      label: "Business info",
      value: businessInfoReady(home) ? "Ready" : "Needs review",
      detail: businessInfoReady(home)
        ? "AI can use approved business details."
        : "Approve the business details AI should use.",
      tone: businessInfoReady(home) ? "success" : "warning",
      path: "/truth",
    },
    {
      id: "channels",
      label: "Customer channels",
      value: channels > 0 ? `${channels}/${total} live` : "Not live",
      detail:
        channels > 0
          ? `${pluralize(channels, "channel")} can receive messages.`
          : "Connect at least one customer channel.",
      tone: channels > 0 ? "success" : "warning",
      path: "/channels",
    },
    {
      id: "inbox",
      label: "Inbox",
      value: unread > 0 ? `${unread} waiting` : "Clear",
      detail:
        unread > 0
          ? `${pluralize(unread, "message")} ${pluralVerb(unread, "needs", "need")} review.`
          : "No urgent message work right now.",
      tone: unread > 0 ? "warning" : "success",
      path: "/inbox",
    },
  ];
}

function toneTextClass(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "brand" || tone === "info") return "text-brand";

  return "text-text-muted";
}

function toneBgClass(tone = "neutral") {
  if (tone === "success") {
    return "border-[rgba(var(--color-success),0.22)] bg-success-soft text-success";
  }

  if (tone === "warning") {
    return "border-[rgba(var(--color-warning),0.24)] bg-warning-soft text-warning";
  }

  if (tone === "danger") {
    return "border-[rgba(var(--color-danger),0.22)] bg-danger-soft text-danger";
  }

  if (tone === "brand" || tone === "info") {
    return "border-[rgba(var(--color-brand),0.22)] bg-brand-soft text-brand";
  }

  return "border-line-soft bg-surface-muted text-text-muted";
}

function toneDotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand" || tone === "info") return "bg-brand";

  return "bg-[rgb(var(--color-text-soft))]";
}

function StatusDot({ tone = "neutral" }) {
  return <span className={cx("h-1.5 w-1.5 rounded-full", toneDotClass(tone))} />;
}

function MiniStatus({ tone = "neutral", children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold">
      <StatusDot tone={tone} />
      <span className={toneTextClass(tone)}>{children}</span>
    </span>
  );
}

function Metric({ label, value, detail, tone = "neutral", last = false }) {
  return (
    <div
      className={cx(
        "min-w-0 px-4 py-3",
        !last && "border-b border-line-soft sm:border-b-0 sm:border-r"
      )}
    >
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
        {label}
      </div>

      <div
        className={cx(
          "mt-1 text-[20px] font-semibold leading-6 tracking-[var(--tracking-tight-lg)]",
          toneTextClass(tone)
        )}
      >
        {value}
      </div>

      <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
        {detail}
      </div>
    </div>
  );
}

function ActionItem({ item, index, last = false, onNavigate }) {
  const Icon = item.icon || ArrowRight;

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.path)}
      className={cx(
        "group grid w-full grid-cols-[42px_minmax(0,1fr)_auto] items-start gap-3 px-4 py-4 text-left",
        !last && "border-b border-line-soft",
        "transition-colors duration-base ease-premium hover:bg-surface-subtle"
      )}
    >
      <span
        className={cx(
          "inline-flex h-10 w-10 items-center justify-center rounded-[13px] border shadow-[var(--shadow-inset-top)]",
          toneBgClass(item.tone)
        )}
      >
        <Icon className="h-4.5 w-4.5" strokeWidth={2.05} />
      </span>

      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[15px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
            {item.title}
          </span>

          {index === 0 ? (
            <MiniStatus tone={item.tone}>
              {item.tone === "success" ? "Clear" : "Needs attention"}
            </MiniStatus>
          ) : null}
        </span>

        <span className="mt-1.5 block text-[13px] font-medium leading-5 text-text-muted">
          {item.detail}
        </span>
      </span>

      <span className="mt-1.5 inline-flex items-center gap-2 text-[12.5px] font-semibold text-text-muted transition-colors duration-base ease-premium group-hover:text-text">
        {item.label}
        <ArrowRight className="h-4 w-4" strokeWidth={2.1} />
      </span>
    </button>
  );
}

function CheckItem({ item, last = false, onNavigate }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.path)}
      className={cx(
        "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left",
        !last && "border-b border-line-soft",
        "transition-colors duration-base ease-premium hover:bg-surface-subtle"
      )}
    >
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            {item.label}
          </span>
          <MiniStatus tone={item.tone}>{item.value}</MiniStatus>
        </span>

        <span className="mt-1.5 block text-[13px] font-medium leading-5 text-text-muted">
          {item.detail}
        </span>
      </span>

      <ArrowRight
        className="h-4 w-4 shrink-0 text-text-subtle transition-colors duration-base ease-premium group-hover:text-text"
        strokeWidth={2.1}
      />
    </button>
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

  if (home.loading) {
    return <ProductHomeLoadingSurface />;
  }

  const page = buildPageCopy(home);
  const actions = buildMainActions(home);
  const checks = buildSafetyChecks(home);

  const unread = unreadCount(home);
  const open = openConversationCount(home);
  const owned = handoffCount(home);
  const pendingOutbound = pendingOutboundCount(home);
  const channels = readyChannelCount(home);
  const totalChannels = availableChannelCount(home);

  const primaryAction =
    normalizeNavigationAction(home.primaryAction || home.assistant?.primaryAction) ||
    {
      label: page.primaryLabel,
      path: page.primaryPath,
    };

  const secondaryAction =
    normalizeNavigationAction(home.secondaryAction || home.assistant?.secondaryAction) ||
    {
      label: "Review setup",
      path: "/channels",
    };

  return (
    <PageCanvas className="space-y-4">
      {home.availabilityNote ? (
        <InlineNotice
          tone="warning"
          title={s(home.availabilityNote.title, "Some live context is limited")}
          description={compactSentence(home.availabilityNote.description)}
          compact
        />
      ) : null}

      <section className="border-b border-line-soft pb-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-[820px]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brand">
              Home
            </div>

            <h1 className="mt-3 font-display text-[34px] font-semibold leading-[1.01] tracking-[var(--tracking-tight-xl)] text-text md:text-[42px]">
              {page.title}
            </h1>

            <p className="mt-3 max-w-[720px] text-[15px] font-medium leading-7 tracking-[var(--tracking-tight-sm)] text-text-muted">
              {page.summary}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] font-medium leading-5 text-text-subtle">
              <span>{businessInfoReady(home) ? "Business info ready" : "Business info needs review"}</span>
              <span className="text-line-strong">/</span>
              <span>{channels} live channel{channels === 1 ? "" : "s"}</span>
              <span className="text-line-strong">/</span>
              <span>{unread} message{unread === 1 ? "" : "s"} waiting</span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <Button
              type="button"
              size="md"
              className="min-w-[148px] justify-center"
              onClick={() => goFromAction(primaryAction)}
              rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
            >
              {primaryAction.label || page.primaryLabel}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              className="min-w-[132px] justify-center"
              onClick={() => goFromAction(secondaryAction)}
            >
              {secondaryAction.label || "Review setup"}
            </Button>
          </div>
        </div>
      </section>

      <Card padded={false} clip>
        <div className="grid sm:grid-cols-4">
          <Metric
            label="Waiting"
            value={String(unread)}
            detail="Customer messages"
            tone={unread > 0 ? "warning" : "success"}
          />

          <Metric
            label="Open"
            value={String(open)}
            detail="Conversations"
            tone={open > 0 ? "brand" : "success"}
          />

          <Metric
            label="Channels"
            value={`${channels}/${totalChannels}`}
            detail="Live for customers"
            tone={channels > 0 ? "success" : "warning"}
          />

          <Metric
            label={pendingOutbound > 0 ? "Pending" : "Owned"}
            value={String(pendingOutbound > 0 ? pendingOutbound : owned)}
            detail={pendingOutbound > 0 ? "Replies pending" : "Operator handoff"}
            tone={pendingOutbound > 0 ? "warning" : owned > 0 ? "brand" : "success"}
            last
          />
        </div>

        <div className="grid border-t border-line-soft xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                  What to do now
                </div>
                <div className="mt-1 text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                  Next action
                </div>
              </div>

              <MiniStatus tone={page.tone}>
                {page.tone === "success" ? "Clear" : page.tone === "danger" ? "Blocked" : "Needs attention"}
              </MiniStatus>
            </div>

            <div className="border-t border-line-soft">
              {actions.map((item, index) => (
                <ActionItem
                  key={item.id}
                  item={item}
                  index={index}
                  last={index === actions.length - 1}
                  onNavigate={go}
                />
              ))}
            </div>
          </div>

          <div className="min-w-0 border-t border-line-soft xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                  Can AI help?
                </div>
                <div className="mt-1 text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                  Safety check
                </div>
              </div>

              {businessInfoReady(home) && channelReady(home) ? (
                <CheckCircle2 className="h-5 w-5 text-success" strokeWidth={2.05} />
              ) : (
                <CircleAlert className="h-5 w-5 text-warning" strokeWidth={2.05} />
              )}
            </div>

            <div className="border-t border-line-soft">
              {checks.map((item, index) => (
                <CheckItem
                  key={item.id}
                  item={item}
                  last={index === checks.length - 1}
                  onNavigate={go}
                />
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card
        padded="sm"
        tone={businessInfoReady(home) && channelReady(home) ? "success" : "warning"}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-line-soft bg-surface shadow-[var(--shadow-inset-top)]">
              {businessInfoReady(home) && channelReady(home) ? (
                <ShieldCheck className="h-4 w-4 text-success" strokeWidth={2.1} />
              ) : (
                <CircleAlert className="h-4 w-4 text-warning" strokeWidth={2.1} />
              )}
            </span>

            <div className="min-w-0">
              <div className="text-[14px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                {businessInfoReady(home) && channelReady(home)
                  ? "AI can safely support customer messages."
                  : "Finish setup before relying on AI replies."}
              </div>

              <div className="mt-1 text-[13px] font-medium leading-5 text-text-muted">
                {businessInfoReady(home) && channelReady(home)
                  ? "Business info is approved and at least one customer channel is live."
                  : "AI stays cautious until business info and a live channel are ready."}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate("/truth")}
            >
              Business info
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate("/channels")}
            >
              Channels
            </Button>
          </div>
        </div>
      </Card>
    </PageCanvas>
  );
}
