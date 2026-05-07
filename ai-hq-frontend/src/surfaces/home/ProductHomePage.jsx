import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../../components/ui/AppShellPrimitives.jsx";
import { cx } from "../../lib/cx.js";
import useProductHome from "../../view-models/useProductHome.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function providerStates(home = {}) {
  return arr(home?.launchChannel?.providerStates);
}

function unreadCount(home = {}) {
  return n(home?.inboxState?.counts?.unreadCount);
}

function openCount(home = {}) {
  return n(home?.inboxState?.counts?.openCount);
}

function handoffCount(home = {}) {
  return n(home?.inboxState?.counts?.handoffCount);
}

function pendingOutboundCount(home = {}) {
  return n(
    home?.inboxState?.counts?.pendingOutboundCount ??
      home?.inboxState?.counts?.outboundPending
  );
}

function failedOutboundCount(home = {}) {
  return n(home?.inboxState?.counts?.failedOutboundCount);
}

function retryingOutboundCount(home = {}) {
  return n(home?.inboxState?.counts?.retryingOutboundCount);
}

function outboundAttention(home = {}) {
  return (
    pendingOutboundCount(home) +
    failedOutboundCount(home) +
    retryingOutboundCount(home)
  );
}

function truthReady(home = {}) {
  return home?.truthRuntime?.truthReady === true;
}

function runtimeReady(home = {}) {
  return home?.truthRuntime?.ready === true;
}

function businessReady(home = {}) {
  return truthReady(home) && runtimeReady(home);
}

function readyChannelCount(home = {}) {
  const states = providerStates(home);

  if (states.length) {
    return states.filter(
      (item) => item?.connected === true && item?.deliveryReady === true
    ).length;
  }

  return n(home?.launchChannel?.readyCount);
}

function connectedChannelCount(home = {}) {
  const states = providerStates(home);
  if (states.length) {
    return states.filter((item) => item?.connected === true).length;
  }

  return n(home?.launchChannel?.connectedCount);
}

function channelReady(home = {}) {
  return readyChannelCount(home) > 0;
}

function inboxUnavailable(home = {}) {
  return lower(home?.inboxState?.status) === "unavailable";
}

function aiReady(home = {}) {
  return businessReady(home) && channelReady(home) && !inboxUnavailable(home);
}

function normalizeAction(action = {}, fallback = {}) {
  const source = obj(action);
  const backup = obj(fallback);

  return {
    label: s(source.label || backup.label || "Continue"),
    path: s(source.path || source?.target?.path || backup.path || "/home"),
  };
}

function channelName(provider = "") {
  const key = lower(provider);

  if (key === "website" || key === "webchat") return "Website";
  if (key === "instagram" || key === "meta") return "Instagram";
  if (key === "telegram") return "Telegram";

  return "Channel";
}

function activeChannels(home = {}) {
  const states = providerStates(home);

  if (!states.length) return [];

  return states
    .filter((item) => item?.connected === true || item?.deliveryReady === true)
    .map((item) => {
      const provider = lower(item?.provider || item?.id);
      const ready = item?.connected === true && item?.deliveryReady === true;

      return {
        id: provider || s(item?.id) || "channel",
        name: s(item?.channelLabel) || channelName(provider),
        ready,
      };
    });
}

function toneClass(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "brand") return "text-brand";
  return "text-text-muted";
}

function dotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

function buildMode(home = {}) {
  const unread = unreadCount(home);
  const outbound = outboundAttention(home);
  const open = openCount(home);

  if (unread > 0) {
    return {
      tone: "warning",
      label: "Attention",
      title: "Customer messages are waiting.",
      body:
        open > 0
          ? "Open the inbox when you are ready to handle today’s customer work."
          : "A customer message needs attention.",
      action: { label: "Open inbox", path: "/inbox" },
    };
  }

  if (outbound > 0) {
    return {
      tone: "warning",
      label: "Review",
      title: "Some replies need delivery review.",
      body: "The workspace is holding outbound work until it is safe to continue.",
      action: { label: "Review inbox", path: "/inbox" },
    };
  }

  if (!truthReady(home)) {
    return {
      tone: "brand",
      label: "Setup mode",
      title: "Prepare the business profile.",
      body:
        "Start with the facts the AI should use when it speaks with customers.",
      action: normalizeAction(home?.assistant?.primaryAction, {
        label: "Review setup",
        path: "/welcome",
      }),
    };
  }

  if (!runtimeReady(home)) {
    return {
      tone: "brand",
      label: "Review mode",
      title: "Review the AI runtime.",
      body:
        "The business profile exists. Review the runtime before using it with customers.",
      action: { label: "Review", path: "/truth" },
    };
  }

  if (!channelReady(home)) {
    return {
      tone: "brand",
      label: "Channel setup",
      title: "Choose one customer lane.",
      body:
        "Connect the channel you actually want to use. Other channels can stay hidden until you need them.",
      action: { label: "Open channels", path: "/channels" },
    };
  }

  if (inboxUnavailable(home)) {
    return {
      tone: "danger",
      label: "Unavailable",
      title: "Inbox activity could not be checked.",
      body:
        "The workspace is configured, but customer activity is temporarily unavailable.",
      action: { label: "Open inbox", path: "/inbox" },
    };
  }

  return {
    tone: "success",
    label: "Live",
    title: "Workspace is calm.",
    body:
      "No customer queue or delivery issue is visible right now.",
    action: { label: "Open inbox", path: "/inbox" },
  };
}

function buildActivity(home = {}) {
  const unread = unreadCount(home);
  const open = openCount(home);
  const handoff = handoffCount(home);
  const outbound = outboundAttention(home);

  if (unread || open || handoff || outbound) {
    const parts = [];

    if (unread) parts.push(`${unread} unread`);
    if (open) parts.push(`${open} open`);
    if (handoff) parts.push(`${handoff} handoff`);
    if (outbound) parts.push(`${outbound} reply review`);

    return {
      title: "Today",
      body: parts.join(" / "),
      muted: false,
    };
  }

  return {
    title: "Today",
    body: channelReady(home)
      ? "No customer activity yet today."
      : "Customer activity will appear after one channel goes live.",
    muted: true,
  };
}

function buildLane(home = {}) {
  const channels = activeChannels(home);

  if (channels.length) {
    const ready = channels.find((item) => item.ready);
    const selected = ready || channels[0];

    return {
      title: "Customer lane",
      body: selected.ready
        ? `${selected.name} is the active customer lane.`
        : `${selected.name} is attached and waiting for review.`,
      tone: selected.ready ? "success" : "brand",
    };
  }

  if (!truthReady(home)) {
    return {
      title: "Customer lane",
      body: "No channel needs attention yet. Finish the business profile first.",
      tone: "neutral",
    };
  }

  return {
    title: "Customer lane",
    body: "Choose the first customer channel when you are ready.",
    tone: "brand",
  };
}

function StatusPill({ tone = "neutral", children }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full bg-surface-subtle px-3 py-1 text-[12px] font-semibold",
        toneClass(tone)
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", dotClass(tone))} />
      {children}
    </span>
  );
}

function MainPanel({ mode, onNavigate }) {
  return (
    <Card
      padded={false}
      clip
      className="shadow-[0_28px_80px_-64px_rgba(15,23,42,0.55)]"
    >
      <div className="grid gap-8 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-brand">Home</div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
              Workspace
            </h1>
            <StatusPill tone={mode.tone}>{mode.label}</StatusPill>
          </div>

          <div className="mt-7 max-w-[680px]">
            <div className="text-[18px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              {mode.title}
            </div>
            <p className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
              {mode.body}
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => onNavigate(mode.action.path)}
          rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
        >
          {mode.action.label}
        </Button>
      </div>
    </Card>
  );
}

function QuietInfo({ title, body, tone = "neutral", muted = false }) {
  return (
    <Card
      padded={false}
      clip
      className="shadow-[0_24px_70px_-64px_rgba(15,23,42,0.52)]"
    >
      <div className="px-6 py-5">
        <div className="flex items-center gap-2">
          <span className={cx("h-1.5 w-1.5 rounded-full", dotClass(tone))} />
          <div className="text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
            {title}
          </div>
        </div>

        <div
          className={cx(
            "mt-3 text-[13.5px] font-medium leading-6",
            muted ? "text-text-muted" : "text-text"
          )}
        >
          {body}
        </div>
      </div>
    </Card>
  );
}

function SmallFacts({ home }) {
  const facts = [
    {
      label: "AI",
      value: aiReady(home) ? "Ready for live use" : "Not live yet",
      tone: aiReady(home) ? "success" : "neutral",
    },
    {
      label: "Business profile",
      value: truthReady(home) ? "Approved" : "In setup",
      tone: truthReady(home) ? "success" : "brand",
    },
  ];

  if (connectedChannelCount(home) > 0 || readyChannelCount(home) > 0) {
    facts.push({
      label: "Customer channel",
      value: readyChannelCount(home) > 0 ? "Live" : "Attached",
      tone: readyChannelCount(home) > 0 ? "success" : "brand",
    });
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {facts.map((item) => (
        <div
          key={item.label}
          className="rounded-[22px] border border-line-soft bg-white px-4 py-3"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-subtle">
            {item.label}
          </div>
          <div className={cx("mt-1 text-[13px] font-semibold", toneClass(item.tone))}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProductHomePage() {
  const navigate = useNavigate();
  const home = useProductHome();

  const loading = home?.loading === true || home?.isLoading === true;
  const mode = useMemo(() => buildMode(home), [home]);
  const activity = useMemo(() => buildActivity(home), [home]);
  const lane = useMemo(() => buildLane(home), [home]);

  function handleNavigate(path = "") {
    const target = s(path);
    if (!target) return;
    navigate(target);
  }

  if (loading) {
    return (
      <PageCanvas className="max-w-[1120px] py-3">
        <LoadingSurface title="Loading home" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="max-w-[1120px] space-y-4 py-3">
      {home?.availabilityNote ? (
        <InlineNotice
          tone="warning"
          title={home.availabilityNote.title}
          description={home.availabilityNote.description}
          compact
        />
      ) : null}

      <MainPanel mode={mode} onNavigate={handleNavigate} />

      <div className="grid gap-4 lg:grid-cols-2">
        <QuietInfo
          title={activity.title}
          body={activity.body}
          tone={activity.muted ? "neutral" : "brand"}
          muted={activity.muted}
        />

        <QuietInfo
          title={lane.title}
          body={lane.body}
          tone={lane.tone}
          muted={lane.tone === "neutral"}
        />
      </div>

      <SmallFacts home={home} />
    </PageCanvas>
  );
}