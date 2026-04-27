import {
  ArrowRight,
  CheckCircle2,
  Circle,
  LockKeyhole,
  Radio,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button.jsx";
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

function unreadCount(home) {
  return n(home?.inboxState?.counts?.unreadCount);
}

function openConversationCount(home) {
  return Math.max(1, n(home?.inboxState?.counts?.openCount));
}

function shortChannelLabel(channel = {}) {
  const provider = lower(channel.provider);
  if (provider === "telegram") return "Telegram";
  if (provider === "meta") return "Instagram";
  if (provider === "website" || provider === "webchat") return "Website chat";
  return s(channel.channelLabel, "Live channel");
}

function channelHandle(channel = {}) {
  return s(channel.accountHandle);
}

function humanTruthState(home) {
  const truthReady = home?.truthRuntime?.truthReady === true;
  const runtimeReady = home?.truthRuntime?.ready === true;
  const readyForApproval = home?.assistant?.readyForApproval === true;

  if (truthReady && runtimeReady) {
    return {
      label: "Business truth",
      value: "Approved",
      hint: "Runtime is using approved truth",
      tone: "success",
    };
  }

  if (truthReady) {
    return {
      label: "Business truth",
      value: "Runtime review",
      hint: compactSentence(
        home?.truthRuntime?.summary,
        "Approved truth exists, but runtime needs review."
      ),
      tone: "danger",
    };
  }

  if (readyForApproval) {
    return {
      label: "Business truth",
      value: "Review draft",
      hint: "Approve setup before live replies",
      tone: "warning",
    };
  }

  return {
    label: "Business truth",
    value: "Not approved",
    hint: "Define the facts AI can use",
    tone: "danger",
  };
}

function humanChannelState(home) {
  const channel = home?.launchChannel || {};
  const connected = channel.connected === true;
  const deliveryReady = channel.deliveryReady === true;
  const label = shortChannelLabel(channel);
  const handle = channelHandle(channel);

  if (connected && deliveryReady) {
    return {
      label: "Channel",
      value: label,
      hint: handle ? `${label} ${handle}` : "Ready for live delivery",
      tone: "success",
    };
  }

  if (connected) {
    return {
      label: "Channel",
      value: label,
      hint: "Connected, but delivery is blocked",
      tone: "danger",
    };
  }

  return {
    label: "Channel",
    value: "Not connected",
    hint: "Choose one live channel",
    tone: "warning",
  };
}

function humanInboxState(home) {
  const status = lower(home?.inboxState?.status);
  const unread = unreadCount(home);
  const openCount = openConversationCount(home);

  if (status === "unavailable") {
    return {
      label: "Inbox",
      value: "Unavailable",
      hint: "Inbox state could not load",
      tone: "danger",
    };
  }

  if (unread > 0) {
    return {
      label: "Inbox",
      value: `${unread} unread`,
      hint: `${pluralize(openCount, "open conversation")} waiting`,
      tone: "warning",
    };
  }

  if (status === "active") {
    return {
      label: "Inbox",
      value: "Active",
      hint: "Conversation work is present",
      tone: "info",
    };
  }

  return {
    label: "Inbox",
    value: "Ready",
    hint: "No unread pressure",
    tone: "success",
  };
}

function buildHeroCopy(home) {
  const channel = home?.launchChannel || {};
  const channelName = shortChannelLabel(channel);
  const truthReady = home?.truthRuntime?.truthReady === true;
  const runtimeReady = home?.truthRuntime?.ready === true;
  const channelReady = channel.connected === true && channel.deliveryReady === true;
  const inboxUnavailable = lower(home?.inboxState?.status) === "unavailable";
  const unread = unreadCount(home);

  if (home?.launchReady) {
    return {
      title: "Ready for inbox work.",
      summary:
        unread > 0
          ? `${channelName} is live and ${pluralize(unread, "message")} need review.`
          : "Approved truth, one live channel, and inbox state are aligned.",
    };
  }

  if (!truthReady) {
    return {
      title: "Approve business truth.",
      summary: "Define the facts AI can use before any channel is treated as live.",
    };
  }

  if (!runtimeReady) {
    return {
      title: "Review truth runtime.",
      summary: "Approved truth exists, but runtime is not ready for live replies.",
    };
  }

  if (!channelReady) {
    return {
      title: "Connect one live channel.",
      summary: "Choose website chat, Instagram, or Telegram for the launch lane.",
    };
  }

  if (inboxUnavailable) {
    return {
      title: "Inbox needs a check.",
      summary: "Truth and channel are ready, but inbox state is unavailable.",
    };
  }

  return {
    title: "Finish the launch check.",
    summary: "Only the inbox handoff remains before live operation.",
  };
}

function buildMetaLine(home) {
  const truth = humanTruthState(home);
  const channel = humanChannelState(home);
  const inbox = humanInboxState(home);
  return [truth.value, channel.value, inbox.value].filter(Boolean);
}

function toneClass(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "info") return "text-brand";
  return "text-text-subtle";
}

function StatusStripItem({ item, last = false }) {
  return (
    <div
      className={cx(
        "min-w-0 px-4 py-3.5",
        !last && "border-b border-line-soft md:border-b-0 md:border-r"
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {item.label}
      </div>
      <div
        className={cx(
          "mt-2 text-[1rem] font-semibold tracking-[-0.025em]",
          toneClass(item.tone)
        )}
      >
        {item.value}
      </div>
      <div className="mt-1 text-[13px] leading-5 text-text-muted">{item.hint}</div>
    </div>
  );
}

function stepTone(step = {}) {
  if (step.complete) return "success";

  const tone = lower(step.tone || step.status);

  if (tone === "warn" || tone === "warning" || tone === "attention") {
    return "warning";
  }

  if (tone === "danger" || tone === "blocked" || tone === "error") {
    return "danger";
  }

  if (tone === "info" || tone === "pending" || tone === "connecting") {
    return "info";
  }

  return "neutral";
}

function stepStatus(step = {}) {
  if (step.complete) return "Ready";
  return s(step.statusLabel, "Waiting");
}

function StepLeading({ step, active = false }) {
  if (step.complete) {
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  }

  if (active) {
    return <Radio className="h-4 w-4 text-brand" />;
  }

  if (stepTone(step) === "danger") {
    return <LockKeyhole className="h-4 w-4 text-danger" />;
  }

  return <Circle className="h-4 w-4 text-text-subtle" />;
}

function StepRow({ step, active = false, last = false, onNavigate }) {
  const action = normalizeNavigationAction(step.action);
  const clickable = Boolean(action?.path);

  return (
    <button
      type="button"
      onClick={() => {
        if (clickable) onNavigate(action);
      }}
      disabled={!clickable}
      className={cx(
        "group grid w-full grid-cols-[34px_minmax(0,1fr)_22px] items-start gap-4 px-4 py-3.5 text-left transition-[background-color] duration-base ease-premium",
        !last && "border-b border-line-soft",
        active && "bg-surface-subtle",
        clickable ? "hover:bg-surface-subtle" : "cursor-default"
      )}
    >
      <div className="flex items-start justify-center pt-[2px]">
        <StepLeading step={step} active={active} />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="text-[15px] font-semibold tracking-[-0.02em] text-text">
            {s(step.label, "Step")}
          </div>
          <div className={cx("text-[12px] font-medium", toneClass(stepTone(step)))}>
            {stepStatus(step)}
          </div>
        </div>

        <div className="mt-1 text-[14px] leading-6 text-text-muted">
          {compactSentence(step.summary || step.detail, "Needs review.")}
        </div>
      </div>

      <div className="flex items-start justify-end pt-[2px]">
        {clickable ? (
          <ArrowRight className="h-4 w-4 text-text-subtle transition-colors group-hover:text-text" />
        ) : null}
      </div>
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

  function navigateFromAction(action = null) {
    const nextAction = normalizeNavigationAction(action);
    if (!nextAction?.path) return;
    navigate(nextAction.path);
  }

  if (home.loading) {
    return <ProductHomeLoadingSurface />;
  }

  const hero = buildHeroCopy(home);
  const metaParts = buildMetaLine(home);

  const primaryAction = normalizeNavigationAction(
    home.primaryAction || home.assistant?.primaryAction
  );

  let secondaryAction = normalizeNavigationAction(
    home.secondaryAction || home.assistant?.secondaryAction
  );

  if (
    primaryAction?.path &&
    secondaryAction?.path &&
    primaryAction.path === secondaryAction.path
  ) {
    secondaryAction = null;
  }

  const stripItems = [
    humanTruthState(home),
    humanChannelState(home),
    humanInboxState(home),
  ];
  const steps = arr(home.launchSteps);
  const activeStepId = s(home?.nextStep?.id);

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
          <div className="min-w-0 max-w-[780px]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brand">
              AI HQ v1
            </div>

            <h1 className="mt-3 text-[1.95rem] font-semibold leading-[1.02] tracking-[-0.045em] text-text md:text-[2.25rem]">
              {hero.title}
            </h1>

            <p className="mt-3 max-w-[680px] text-[15px] leading-7 text-text-muted">
              {hero.summary}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-5 text-text-subtle">
              {metaParts.map((item, index) => (
                <span key={`${item}-${index}`} className="inline-flex items-center gap-3">
                  {index > 0 ? <span className="text-line-strong">/</span> : null}
                  <span>{item}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            {primaryAction?.path ? (
              <Button
                type="button"
                size="md"
                className="min-w-[148px] justify-center"
                onClick={() => navigateFromAction(primaryAction)}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                {primaryAction.label}
              </Button>
            ) : null}

            {secondaryAction?.path ? (
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="min-w-[132px] justify-center"
                onClick={() => navigateFromAction(secondaryAction)}
              >
                {secondaryAction.label}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-panel border border-line-soft bg-surface">
        <div className="grid md:grid-cols-3">
          {stripItems.map((item, index) => (
            <StatusStripItem
              key={item.label}
              item={item}
              last={index === stripItems.length - 1}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <div className="text-[1.1rem] font-semibold tracking-[-0.025em] text-text">
            Launch path
          </div>
          <div className="mt-1 text-[14px] leading-6 text-text-muted">
            Business truth, one live channel, then inbox.
          </div>
        </div>

        <div className="overflow-hidden rounded-panel border border-line-soft bg-surface">
          {steps.map((step, index) => (
            <StepRow
              key={step.id}
              step={step}
              active={s(step.id) === activeStepId}
              last={index === steps.length - 1}
              onNavigate={navigateFromAction}
            />
          ))}
        </div>
      </section>
    </PageCanvas>
  );
}
