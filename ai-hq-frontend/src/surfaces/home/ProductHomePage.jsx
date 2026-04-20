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
  MetricCard,
  MetricGrid,
  PageCanvas,
  Surface,
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

function pluralize(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function hasSetupDraft(home) {
  const draft = home?.assistant?.draft || {};
  const profile = draft.businessProfile || {};

  return Boolean(
    s(profile.companyName) ||
      s(profile.description) ||
      s(profile.websiteUrl) ||
      arr(draft.services).length ||
      arr(draft.contacts).length ||
      arr(draft.hours).length
  );
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

function channelDisplayName(channel = {}) {
  return (
    s(channel.accountDisplayName) ||
    s(channel.channelLabel) ||
    shortChannelLabel(channel)
  );
}

function humanSetupState(home) {
  const approved = home?.assistant?.hasApprovedSetupBaseline === true;
  const draftExists = hasSetupDraft(home);
  const blockers = n(home?.assistant?.draft?.blockerCount, n(home?.blockerCount));

  if (approved && !draftExists) {
    return {
      value: "Approved",
      hint: "Current business setup is already live.",
      tone: "success",
    };
  }

  if (approved && draftExists) {
    return {
      value: "Updating",
      hint: "Approved setup is live while new draft changes are being prepared.",
      tone: "info",
    };
  }

  if (draftExists && blockers > 0) {
    return {
      value: "In progress",
      hint: `${pluralize(blockers, "blocker")} still need review.`,
      tone: "warning",
    };
  }

  if (draftExists) {
    return {
      value: "Ready for review",
      hint: "Draft exists and looks structurally ready.",
      tone: "info",
    };
  }

  return {
    value: "Not started",
    hint: "No structured business setup draft is visible yet.",
    tone: "neutral",
  };
}

function humanRuntimeState(home) {
  const truthReady = home?.truthRuntime?.truthReady === true;
  const runtimeReady = home?.truthRuntime?.ready === true;

  if (runtimeReady) {
    return {
      value: "Healthy",
      hint: "Approved setup is actively backing the workspace.",
      tone: "success",
    };
  }

  if (truthReady) {
    return {
      value: "Repair needed",
      hint: "Approved setup exists, but runtime still needs repair.",
      tone: "warning",
    };
  }

  return {
    value: "Needs review",
    hint: "The current setup still needs approval before runtime goes live.",
    tone: "danger",
  };
}

function humanInboxState(home) {
  const status = lower(home?.inboxState?.status);
  const unread = unreadCount(home);
  const openCount = openConversationCount(home);

  if (status === "unavailable") {
    return {
      value: "Unavailable",
      hint: "Inbox telemetry is temporarily unavailable.",
      tone: "danger",
    };
  }

  if (unread > 0) {
    return {
      value: `${unread} unread`,
      hint: `${pluralize(openCount, "open conversation")} waiting now.`,
      tone: "warning",
    };
  }

  if (status === "active") {
    return {
      value: "Active",
      hint: "Live work is present, but nothing unread is waiting.",
      tone: "info",
    };
  }

  return {
    value: "Ready",
    hint: "No unread pressure right now.",
    tone: "success",
  };
}

function humanChannelState(home) {
  const channel = home?.launchChannel || {};
  const connected = channel.connected === true;
  const deliveryReady = channel.deliveryReady === true;
  const handle = channelHandle(channel);
  const name = shortChannelLabel(channel);

  if (connected && deliveryReady) {
    return {
      value: name,
      hint: handle ? `${name} ${handle}` : `${name} is connected and ready.`,
      tone: "success",
    };
  }

  if (connected) {
    return {
      value: name,
      hint: "Connected, but still not safe to treat as fully live.",
      tone: "warning",
    };
  }

  return {
    value: "Not connected",
    hint: "Choose Instagram, Telegram, or website chat first.",
    tone: "danger",
  };
}

function buildHeroCopy(home) {
  const channel = home?.launchChannel || {};
  const channelName = shortChannelLabel(channel);
  const unread = unreadCount(home);
  const approved = home?.assistant?.hasApprovedSetupBaseline === true;
  const draftExists = hasSetupDraft(home);
  const truthReady = home?.truthRuntime?.truthReady === true;
  const runtimeReady = home?.truthRuntime?.ready === true;
  const connected = channel.connected === true;

  if (home?.launchReady) {
    return {
      title: "Workspace is live.",
      summary:
        unread > 0
          ? `${channelName} is connected and ${pluralize(unread, "unread message")} are waiting in the inbox.`
          : `${channelName} is connected and the inbox is ready for live work.`,
    };
  }

  if (!connected) {
    return {
      title: "Connect a live channel.",
      summary:
        "Start by attaching Instagram, Telegram, or website chat before treating this workspace as live.",
    };
  }

  if (!approved && !draftExists) {
    return {
      title: "Start the business setup.",
      summary:
        "Add the business details first, then review them before anything goes live.",
    };
  }

  if (draftExists && !truthReady) {
    return {
      title: "Review the current setup.",
      summary:
        "A draft already exists, but it still needs approval before the workspace should go live.",
    };
  }

  if (!truthReady) {
    return {
      title: "Approve the current setup.",
      summary:
        "The channel is connected, but live automation should wait until the setup is approved.",
    };
  }

  if (!runtimeReady) {
    return {
      title: "Runtime still needs repair.",
      summary:
        "Approved setup exists, but the runtime is not healthy enough for live automation yet.",
    };
  }

  if (lower(home?.inboxState?.status) === "unavailable") {
    return {
      title: "Inbox signal is limited.",
      summary:
        "Channel and setup are in place, but inbox telemetry is temporarily unavailable.",
    };
  }

  return {
    title: "Finish the last step.",
    summary: "Only one final live check remains before this workspace is fully clear.",
  };
}

function heroSupportLine(home) {
  const channel = home?.launchChannel || {};
  const inbox = home?.inboxState || {};
  const setupState = humanSetupState(home);
  const unread = unreadCount(home);
  const parts = [];

  if (channel.connected) {
    const name = shortChannelLabel(channel);
    const handle = channelHandle(channel);
    parts.push(handle ? `${name} ${handle}` : channelDisplayName(channel));
  } else {
    parts.push("No live channel");
  }

  parts.push(setupState.value === "Approved" ? "Approved setup" : setupState.value);

  if (lower(inbox.status) === "unavailable") {
    parts.push("Inbox unavailable");
  } else if (unread > 0) {
    parts.push(`${pluralize(unread, "unread message")}`);
  } else {
    parts.push("Inbox ready");
  }

  return parts.filter(Boolean);
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

function stepTitle(step = {}, home) {
  switch (s(step.id).toLowerCase()) {
    case "channel":
      return home?.launchChannel?.connected ? "Live channel" : "Connect a channel";
    case "setup":
      return home?.assistant?.hasApprovedSetupBaseline === true && !hasSetupDraft(home)
        ? "Business setup"
        : hasSetupDraft(home)
          ? "Setup draft"
          : "Start setup";
    case "approval":
      return home?.truthRuntime?.ready === true
        ? "Approved setup"
        : home?.truthRuntime?.truthReady === true
          ? "Runtime health"
          : "Approve setup";
    case "live":
      return "Inbox";
    default:
      return s(step.label, "Step");
  }
}

function stepSummary(step = {}, home) {
  const id = lower(step.id);
  const channel = home?.launchChannel || {};
  const setup = humanSetupState(home);
  const runtime = humanRuntimeState(home);
  const inbox = humanInboxState(home);
  const unread = unreadCount(home);
  const openCount = openConversationCount(home);

  if (id === "channel") {
    if (channel.connected && channel.deliveryReady) {
      return `${shortChannelLabel(channel)} is connected and ready for live delivery.`;
    }

    if (channel.connected) {
      return "A live channel is attached, but it still needs repair before it should be trusted.";
    }

    return "Connect Instagram, Telegram, or website chat to open the live lane.";
  }

  if (id === "setup") {
    if (setup.value === "Approved") {
      return "The approved business setup is already in use.";
    }

    return setup.hint;
  }

  if (id === "approval") {
    if (runtime.value === "Healthy") {
      return "Approved setup is active and the runtime is healthy.";
    }

    return runtime.hint;
  }

  if (id === "live") {
    if (unread > 0) {
      return `${pluralize(unread, "unread message")} are waiting across ${pluralize(openCount, "open conversation")}.`;
    }

    return inbox.hint;
  }

  return compactSentence(step.summary, "Needs attention.");
}

function stepStatus(step = {}, home) {
  const id = lower(step.id);

  if (step.complete) {
    if (id === "live" && unreadCount(home) > 0) return "Live now";
    return "Done";
  }

  if (id === "channel") {
    return home?.launchChannel?.connected ? "Repair" : "Connect";
  }

  if (id === "setup") {
    const setup = humanSetupState(home);
    if (setup.value === "Not started") return "Start";
    if (setup.value === "In progress") return "In progress";
    if (setup.value === "Ready for review") return "Review";
    if (setup.value === "Updating") return "Updating";
  }

  if (id === "approval") {
    return home?.truthRuntime?.truthReady === true ? "Repair" : "Review";
  }

  if (id === "live") {
    return home?.launchReady ? "Live" : "Waiting";
  }

  const label = s(step.statusLabel, "Pending");
  if (!label) return "Pending";
  return label;
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

  if (stepTone(step) === "warning") {
    return <Radio className="h-4 w-4 text-warning" />;
  }

  return <Circle className="h-4 w-4 text-text-subtle" />;
}

function statusClass(step = {}) {
  const tone = stepTone(step);

  if (step.complete) return "text-success";
  if (tone === "danger") return "text-danger";
  if (tone === "warning") return "text-warning";
  if (tone === "info") return "text-brand";
  return "text-text-subtle";
}

function StepRow({ step, home, active = false, last = false, onNavigate }) {
  const action = normalizeNavigationAction(step.action);
  const clickable = Boolean(action?.path);

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => {
        if (clickable) onNavigate(action);
      }}
      className={cx(
        "group grid w-full grid-cols-[42px_minmax(0,1fr)_auto] items-start gap-4 px-5 py-4.5 text-left transition-[background-color,border-color] duration-base ease-premium",
        !last && "border-b border-line-soft",
        active && "bg-[rgba(var(--color-brand),0.05)]",
        clickable ? "hover:bg-surface-subtle" : "cursor-default"
      )}
    >
      <div className="flex items-start justify-center pt-[2px]">
        <StepLeading step={step} active={active} />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="text-[15px] font-semibold tracking-[-0.02em] text-text">
            {stepTitle(step, home)}
          </div>
          <div className={cx("text-[12px] font-medium", statusClass(step))}>
            {stepStatus(step, home)}
          </div>
        </div>

        <div className="mt-1.5 max-w-[860px] text-[14px] leading-6 text-text-muted">
          {stepSummary(step, home)}
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

  const hero = buildHeroCopy(home);
  const support = heroSupportLine(home);

  const checklistTitle = home.launchReady
    ? "Everything is ready"
    : home.blockerCount === 1
      ? "One thing still needs attention"
      : "What still needs attention";

  const checklistDescription = home.launchReady
    ? "Use inbox for live work. Open setup only when the business changes."
    : "Only the live checklist stays here. Internal IDs and raw system language are removed.";

  const heroGlowPrimary = home.launchReady
    ? "bg-[radial-gradient(circle,rgba(34,197,94,0.16)_0%,rgba(34,197,94,0.06)_40%,rgba(34,197,94,0)_74%)]"
    : "bg-[radial-gradient(circle,rgba(65,105,255,0.18)_0%,rgba(65,105,255,0.06)_42%,rgba(65,105,255,0)_74%)]";

  const heroGlowSecondary = home.launchReady
    ? "bg-[radial-gradient(circle,rgba(65,105,255,0.14)_0%,rgba(65,105,255,0.04)_44%,rgba(65,105,255,0)_76%)]"
    : "bg-[radial-gradient(circle,rgba(245,158,11,0.14)_0%,rgba(245,158,11,0.04)_42%,rgba(245,158,11,0)_74%)]";

  const metrics = [
    {
      label: "Channel",
      ...humanChannelState(home),
    },
    {
      label: "Setup",
      ...humanSetupState(home),
    },
    {
      label: "Runtime",
      ...humanRuntimeState(home),
    },
    {
      label: "Inbox",
      ...humanInboxState(home),
    },
  ];

  const launchSteps = arr(home.launchSteps);
  const activeStepId = s(home?.nextStep?.id) || (home.launchReady ? "live" : "");

  return (
    <PageCanvas className="space-y-6">
      {home.availabilityNote ? (
        <InlineNotice
          tone="warning"
          title={s(home.availabilityNote.title, "Some live context is limited")}
          description={compactSentence(home.availabilityNote.description)}
          compact
        />
      ) : null}

      <section className="relative overflow-hidden rounded-panel border border-line-soft bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(255,255,255,0.64))] px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.92)_inset] md:px-6 md:py-6">
        <div
          className={cx(
            "pointer-events-none absolute right-[-8%] top-[-22%] h-[240px] w-[240px] rounded-full blur-3xl",
            heroGlowPrimary
          )}
        />
        <div
          className={cx(
            "pointer-events-none absolute left-[48%] top-[32%] h-[180px] w-[180px] rounded-full blur-3xl",
            heroGlowSecondary
          )}
        />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-[860px]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brand">
              Home
            </div>

            <h1 className="mt-3 text-[2rem] font-semibold leading-[0.96] tracking-[-0.055em] text-text md:text-[2.45rem]">
              {hero.title}
            </h1>

            <p className="mt-3 max-w-[760px] text-[15px] leading-7 text-text-muted">
              {hero.summary}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-5 text-text-subtle">
              {support.map((item, index) => (
                <span key={`${item}-${index}`} className="inline-flex items-center gap-3">
                  {index > 0 ? <span className="text-line-strong">•</span> : null}
                  <span>{item}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            {primaryAction?.path ? (
              <Button
                type="button"
                size="hero"
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
                size="hero"
                onClick={() => navigateFromAction(secondaryAction)}
              >
                {secondaryAction.label}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <MetricGrid columns={4} className="gap-3">
        {metrics.map((item) => (
          <MetricCard
            key={item.label}
            label={item.label}
            value={item.value}
            hint={item.hint}
            tone={item.tone}
            className="min-h-[118px]"
          />
        ))}
      </MetricGrid>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-[760px]">
            <div className="text-[1.24rem] font-semibold tracking-[-0.035em] text-text md:text-[1.34rem]">
              {checklistTitle}
            </div>
            <div className="mt-1.5 text-[14px] leading-6 text-text-muted">
              {checklistDescription}
            </div>
          </div>
        </div>

        <Surface
          padded={false}
          className="overflow-hidden border-line-soft bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(255,255,255,0.52))]"
        >
          {launchSteps.map((step, index) => (
            <StepRow
              key={step.id}
              step={step}
              home={home}
              active={s(step.id) === activeStepId}
              last={index === launchSteps.length - 1}
              onNavigate={navigateFromAction}
            />
          ))}
        </Surface>
      </section>
    </PageCanvas>
  );
}