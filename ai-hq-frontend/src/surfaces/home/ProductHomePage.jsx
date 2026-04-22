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
import { SETUP_WIDGET_ROUTE } from "../../lib/appEntry.js";
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

function hasSetupDraft(home) {
  const assistant = home?.assistant || {};
  const draft = assistant?.draft || {};
  const reviewDraft = assistant?.reviewDraft || {};
  const profile = draft.businessProfile || {};
  const reviewProfile = reviewDraft.businessProfile || {};

  return Boolean(
    s(profile.companyName) ||
      s(profile.description) ||
      s(profile.websiteUrl) ||
      arr(draft.services).length ||
      arr(draft.contacts).length ||
      arr(draft.hours).length ||
      s(reviewProfile.companyName) ||
      s(reviewProfile.description) ||
      s(reviewProfile.websiteUrl) ||
      arr(reviewDraft.coreServices).length ||
      arr(reviewDraft.contactRoutes).length ||
      arr(reviewDraft.workingHoursLines).length ||
      arr(assistant.sections).length
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

function assistantSections(home) {
  return arr(home?.assistant?.sections);
}

function phaseKey(section = {}) {
  return lower(section.phase) || "business_truth";
}

function applicablePhaseSections(home, targetPhase = "") {
  return assistantSections(home).filter((section) => {
    const status = lower(section.status);
    return phaseKey(section) === targetPhase && status !== "not_applicable";
  });
}

function phaseProgress(home, targetPhase = "") {
  const sections = applicablePhaseSections(home, targetPhase);
  const total = sections.length;
  const ready = sections.filter((item) => lower(item.status) === "ready").length;
  const needsReview = sections.filter(
    (item) => lower(item.status) === "needs_review"
  ).length;
  const missing = sections.filter((item) => lower(item.status) === "missing").length;
  const started = ready > 0 || needsReview > 0;
  const complete = total > 0 && ready === total;

  return {
    total,
    ready,
    needsReview,
    missing,
    started,
    complete,
  };
}

function setupInterviewPhase(home) {
  const phase = lower(home?.assistant?.phase);
  if (!phase) return "";
  return phase;
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
      hint: handle ? `${label} ${handle}` : `${label} is connected`,
      tone: "success",
    };
  }

  if (connected) {
    return {
      label: "Channel",
      value: label,
      hint: "Connected, but still gated",
      tone: "warning",
    };
  }

  return {
    label: "Channel",
    value: "Not connected",
    hint: "Choose Instagram, Telegram, or website chat",
    tone: "danger",
  };
}

function humanSetupState(home) {
  const approved = home?.assistant?.hasApprovedSetupBaseline === true;
  const draftExists = hasSetupDraft(home);
  const businessTruth = phaseProgress(home, "business_truth");
  const conversationPolicy = phaseProgress(home, "conversation_policy");
  const readyForApproval = home?.assistant?.readyForApproval === true;
  const phase = setupInterviewPhase(home);

  if (approved && !draftExists) {
    return {
      label: "Setup",
      value: "Approved",
      hint: "Current business setup is live",
      tone: "success",
    };
  }

  if (approved && draftExists) {
    return {
      label: "Setup",
      value: "Updating",
      hint: "Live setup exists while changes are being prepared",
      tone: "info",
    };
  }

  if (readyForApproval) {
    return {
      label: "Setup",
      value: "Review ready",
      hint: "Business truth and conversation policy are ready for final review",
      tone: "success",
    };
  }

  if (conversationPolicy.started && !conversationPolicy.complete) {
    return {
      label: "Setup",
      value: "Behavior in progress",
      hint: "Conversation policy is still being shaped",
      tone: "warning",
    };
  }

  if (businessTruth.started && !businessTruth.complete) {
    return {
      label: "Setup",
      value: "Business truth",
      hint: "Core business facts are still being confirmed",
      tone: "warning",
    };
  }

  if (draftExists || phase === "interview") {
    return {
      label: "Setup",
      value: "In progress",
      hint: "A setup draft exists and still needs review",
      tone: "warning",
    };
  }

  return {
    label: "Setup",
    value: "Not started",
    hint: "No structured business setup draft is visible yet",
    tone: "neutral",
  };
}

function humanRuntimeState(home) {
  const truthReady = home?.truthRuntime?.truthReady === true;
  const runtimeReady = home?.truthRuntime?.ready === true;

  if (runtimeReady) {
    return {
      label: "Runtime",
      value: "Healthy",
      hint: "Approved setup is backing the workspace",
      tone: "success",
    };
  }

  if (truthReady) {
    return {
      label: "Runtime",
      value: "Repair needed",
      hint: "Approved setup exists, but runtime still needs repair",
      tone: "warning",
    };
  }

  return {
    label: "Runtime",
    value: "Needs review",
    hint: "Setup still needs approval before runtime goes live",
    tone: "danger",
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
      hint: "Inbox telemetry is temporarily unavailable",
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
      hint: "Live work is present",
      tone: "info",
    };
  }

  return {
    label: "Inbox",
    value: "Ready",
    hint: "No unread pressure right now",
    tone: "success",
  };
}

function buildHeroCopy(home) {
  const channel = home?.launchChannel || {};
  const channelName = shortChannelLabel(channel);
  const connected = channel.connected === true;
  const approved = home?.assistant?.hasApprovedSetupBaseline === true;
  const draftExists = hasSetupDraft(home);
  const truthReady = home?.truthRuntime?.truthReady === true;
  const runtimeReady = home?.truthRuntime?.ready === true;
  const unread = unreadCount(home);
  const inboxUnavailable = lower(home?.inboxState?.status) === "unavailable";
  const businessTruth = phaseProgress(home, "business_truth");
  const conversationPolicy = phaseProgress(home, "conversation_policy");
  const readyForApproval = home?.assistant?.readyForApproval === true;

  if (home?.launchReady) {
    return {
      title: "Workspace is live.",
      summary:
        unread > 0
          ? `${channelName} is connected and ${pluralize(unread, "unread message")} are waiting.`
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
        "Begin with business truth first, then shape conversation policy before anything goes live.",
    };
  }

  if (!businessTruth.complete) {
    return {
      title: "Finish the business truth.",
      summary:
        "The system still needs the core business facts it can safely answer from.",
    };
  }

  if (!conversationPolicy.complete) {
    return {
      title: "Shape the conversation policy.",
      summary:
        "Now define greeting, closing, tone, and response behavior before review.",
    };
  }

  if (readyForApproval && !truthReady) {
    return {
      title: "Review the setup draft.",
      summary:
        "Business truth and conversation policy are ready. Review them before launch.",
    };
  }

  if (draftExists && !truthReady) {
    return {
      title: "Review the current setup.",
      summary:
        "A setup draft already exists, but it still needs approval before the workspace should go live.",
    };
  }

  if (!truthReady) {
    return {
      title: "Approve the setup.",
      summary:
        "The channel is connected, but live automation should wait until setup is approved.",
    };
  }

  if (!runtimeReady) {
    return {
      title: "Runtime still needs repair.",
      summary:
        "Approved setup exists, but runtime is not healthy enough for live automation yet.",
    };
  }

  if (inboxUnavailable) {
    return {
      title: "Inbox signal is limited.",
      summary:
        "The workspace is mostly aligned, but inbox telemetry is temporarily unavailable.",
    };
  }

  return {
    title: "Finish the last step.",
    summary: "Only one final live check remains before this workspace is fully ready.",
  };
}

function buildMetaLine(home) {
  const parts = [];
  const channel = home?.launchChannel || {};
  const setup = humanSetupState(home);
  const inbox = humanInboxState(home);

  if (channel.connected) {
    const label = shortChannelLabel(channel);
    const handle = channelHandle(channel);
    parts.push(handle ? `${label} ${handle}` : label);
  } else {
    parts.push("No live channel");
  }

  parts.push(setup.value);

  if (inbox.value) {
    parts.push(inbox.value);
  }

  return parts;
}

function buildSetupPhaseCards(home) {
  const businessTruth = phaseProgress(home, "business_truth");
  const conversationPolicy = phaseProgress(home, "conversation_policy");
  const readyForApproval = home?.assistant?.readyForApproval === true;
  const approved = home?.assistant?.hasApprovedSetupBaseline === true;
  const draftHidden = home?.assistant?.draftPreviewHidden === true;
  const setupStarted = hasSetupDraft(home);
  const openSetupAction = {
    label: "Open setup",
    path: SETUP_WIDGET_ROUTE,
  };
  const reviewAction = {
    label: "Review setup",
    path: SETUP_WIDGET_ROUTE,
  };

  const businessTruthCard = (() => {
    if (!setupStarted && businessTruth.total === 0) {
      return {
        key: "business_truth",
        title: "Business truth",
        status: "Start",
        summary:
          "Capture the core facts the AI can safely answer from: business identity, services, contact routes, hours, pricing, and handoff cases.",
        tone: "neutral",
        complete: false,
        action: openSetupAction,
      };
    }

    if (businessTruth.complete) {
      return {
        key: "business_truth",
        title: "Business truth",
        status: "Ready",
        summary:
          "Core business facts are present and ready for final review.",
        tone: "success",
        complete: true,
        action: reviewAction,
      };
    }

    return {
      key: "business_truth",
      title: "Business truth",
      status:
        businessTruth.ready > 0
          ? `${businessTruth.ready}/${businessTruth.total} ready`
          : "In progress",
      summary:
        businessTruth.missing > 0
          ? `${pluralize(businessTruth.missing, "area")} still need confirmation before the AI can answer reliably.`
          : "Business truth is being shaped.",
      tone: "warning",
      complete: false,
      action: openSetupAction,
    };
  })();

  const conversationCard = (() => {
    if (!setupStarted && conversationPolicy.total === 0) {
      return {
        key: "conversation_policy",
        title: "Conversation policy",
        status: "Later",
        summary:
          "After the business truth is clear, define greeting, closing, tone, and response behavior.",
        tone: "neutral",
        complete: false,
        action: openSetupAction,
      };
    }

    if (conversationPolicy.total === 0) {
      return {
        key: "conversation_policy",
        title: "Conversation policy",
        status: "Waiting",
        summary:
          "Behavior questions will appear after the business truth is filled enough to shape the assistant.",
        tone: "info",
        complete: false,
        action: openSetupAction,
      };
    }

    if (conversationPolicy.complete) {
      return {
        key: "conversation_policy",
        title: "Conversation policy",
        status: "Ready",
        summary:
          "Greeting, closing, tone, and channel response behavior are ready for review.",
        tone: "success",
        complete: true,
        action: reviewAction,
      };
    }

    return {
      key: "conversation_policy",
      title: "Conversation policy",
      status:
        conversationPolicy.ready > 0
          ? `${conversationPolicy.ready}/${conversationPolicy.total} ready`
          : "In progress",
      summary:
        conversationPolicy.missing > 0
          ? `${pluralize(conversationPolicy.missing, "behavior rule")} still need to be confirmed.`
          : "Behavior policy is being shaped.",
      tone: "warning",
      complete: false,
      action: openSetupAction,
    };
  })();

  const reviewCard = (() => {
    if (approved) {
      return {
        key: "review_and_launch",
        title: "Review & launch",
        status: "Approved",
        summary:
          "Approved setup is already backing the live workspace.",
        tone: "success",
        complete: true,
        action: { label: "Open truth", path: "/truth" },
      };
    }

    if (readyForApproval) {
      return {
        key: "review_and_launch",
        title: "Review & launch",
        status: "Ready",
        summary: draftHidden
          ? "The polished draft stays hidden until review. Open setup to review and approve it."
          : "Open setup to review the final draft and approve launch.",
        tone: "success",
        complete: false,
        action: reviewAction,
      };
    }

    return {
      key: "review_and_launch",
      title: "Review & launch",
      status: "Blocked",
      summary:
        "Final review stays locked until both business truth and conversation policy are ready.",
      tone: "danger",
      complete: false,
      action: openSetupAction,
    };
  })();

  return [businessTruthCard, conversationCard, reviewCard];
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
        "min-w-0 py-3.5 md:px-4",
        !last && "border-b border-line-soft md:border-b-0 md:border-r"
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {item.label}
      </div>
      <div className={cx("mt-2 text-[1.04rem] font-semibold tracking-[-0.03em]", toneClass(item.tone))}>
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

function stepTitle(step = {}, home) {
  switch (lower(step.id)) {
    case "channel":
      return home?.launchChannel?.connected ? "Live channel" : "Connect a channel";
    case "setup":
      return hasSetupDraft(home) ? "Setup draft" : "Start setup";
    case "approval":
      return home?.truthRuntime?.ready === true ? "Approved setup" : "Approve setup";
    case "live":
      return "Inbox";
    default:
      return s(step.label, "Step");
  }
}

function stepStatus(step = {}, home) {
  if (step.complete) {
    if (lower(step.id) === "live" && unreadCount(home) > 0) return "Live now";
    return "Done";
  }

  switch (lower(step.id)) {
    case "channel":
      return home?.launchChannel?.connected ? "Repair" : "Connect";
    case "setup":
      return hasSetupDraft(home) ? "Continue" : "Start";
    case "approval":
      return home?.truthRuntime?.truthReady === true ? "Repair" : "Review";
    case "live":
      return "Waiting";
    default:
      return s(step.statusLabel, "Pending");
  }
}

function stepSummary(step = {}, home) {
  const channel = home?.launchChannel || {};
  const setup = humanSetupState(home);
  const runtime = humanRuntimeState(home);
  const inbox = humanInboxState(home);
  const id = lower(step.id);

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
    return setup.hint;
  }

  if (id === "approval") {
    return runtime.hint;
  }

  if (id === "live") {
    return inbox.hint;
  }

  return compactSentence(step.summary, "Needs attention.");
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

function StepRow({ step, home, active = false, last = false, onNavigate }) {
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
            {stepTitle(step, home)}
          </div>
          <div className={cx("text-[12px] font-medium", toneClass(stepTone(step)))}>
            {stepStatus(step, home)}
          </div>
        </div>

        <div className="mt-1 text-[14px] leading-6 text-text-muted">
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

function SetupPhaseRow({ item, last = false, onNavigate }) {
  const action = normalizeNavigationAction(item.action);
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
        clickable ? "hover:bg-surface-subtle" : "cursor-default"
      )}
    >
      <div className="flex items-start justify-center pt-[2px]">
        <StepLeading step={item} active={false} />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="text-[15px] font-semibold tracking-[-0.02em] text-text">
            {item.title}
          </div>
          <div className={cx("text-[12px] font-medium", toneClass(item.tone))}>
            {item.status}
          </div>
        </div>

        <div className="mt-1 text-[14px] leading-6 text-text-muted">
          {item.summary}
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
    humanChannelState(home),
    humanSetupState(home),
    humanRuntimeState(home),
    humanInboxState(home),
  ];

  const steps = arr(home.launchSteps);
  const activeStepId = s(home?.nextStep?.id);
  const setupPhaseCards = buildSetupPhaseCards(home);
  const showSetupPhases =
    setupPhaseCards.length > 0 &&
    (hasSetupDraft(home) ||
      home?.assistant?.readyForApproval === true ||
      home?.assistant?.hasApprovedSetupBaseline === true ||
      home?.launchReady !== true);

  return (
    <PageCanvas className="space-y-5">
      {home.availabilityNote ? (
        <InlineNotice
          tone="warning"
          title={s(home.availabilityNote.title, "Some live context is limited")}
          description={compactSentence(home.availabilityNote.description)}
          compact
        />
      ) : null}

      <section className="relative border-b border-line-soft pb-5">
        <div className="pointer-events-none absolute right-[-6%] top-[-28px] h-[180px] w-[180px] rounded-full bg-[radial-gradient(circle,rgba(65,105,255,0.12)_0%,rgba(65,105,255,0.04)_42%,rgba(65,105,255,0)_76%)] blur-3xl" />
        <div className="pointer-events-none absolute left-[30%] top-[34px] h-[120px] w-[120px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.85)_0%,rgba(255,255,255,0.1)_58%,rgba(255,255,255,0)_82%)] blur-2xl" />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-[860px]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brand">
              Home
            </div>

            <h1 className="mt-3 text-[2rem] font-semibold leading-[0.96] tracking-[-0.055em] text-text md:text-[2.35rem]">
              {hero.title}
            </h1>

            <p className="mt-3 max-w-[760px] text-[15px] leading-7 text-text-muted">
              {hero.summary}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-5 text-text-subtle">
              {metaParts.map((item, index) => (
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
                className="min-w-[140px] justify-center"
                onClick={() => navigateFromAction(secondaryAction)}
              >
                {secondaryAction.label}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="border-y border-line-soft">
        <div className="grid md:grid-cols-4">
          {stripItems.map((item, index) => (
            <StatusStripItem
              key={item.label}
              item={item}
              last={index === stripItems.length - 1}
            />
          ))}
        </div>
      </section>

      {showSetupPhases ? (
        <section className="space-y-3">
          <div>
            <div className="text-[1.2rem] font-semibold tracking-[-0.035em] text-text">
              Setup flow
            </div>
            <div className="mt-1.5 text-[14px] leading-6 text-text-muted">
              Business truth comes first, then conversation policy, then final review and launch.
            </div>
          </div>

          <div className="overflow-hidden rounded-panel border border-line-soft bg-surface">
            {setupPhaseCards.map((item, index) => (
              <SetupPhaseRow
                key={item.key}
                item={item}
                last={index === setupPhaseCards.length - 1}
                onNavigate={navigateFromAction}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <div className="text-[1.2rem] font-semibold tracking-[-0.035em] text-text">
            {home.launchReady ? "Live checklist" : "What needs attention"}
          </div>
          <div className="mt-1.5 text-[14px] leading-6 text-text-muted">
            {home.launchReady
              ? "Everything important is aligned. Use inbox for live work."
              : "Only the essential live path stays here."}
          </div>
        </div>

        <div className="overflow-hidden rounded-panel border border-line-soft bg-surface">
          {steps.map((step, index) => (
            <StepRow
              key={step.id}
              step={step}
              home={home}
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