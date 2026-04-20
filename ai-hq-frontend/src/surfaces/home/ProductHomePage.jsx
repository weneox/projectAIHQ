import {
  ArrowRight,
  CheckCircle2,
  Circle,
  LockKeyhole,
  Radio,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

function stepTone(step = {}) {
  if (step.complete) return "success";

  const tone = s(step.tone || step.status).toLowerCase();

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

function StepLeading({ step, active = false, index = 0 }) {
  if (step.complete) {
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  }

  if (active) {
    return (
      <span className="text-[12px] font-semibold tracking-[0.02em] text-brand">
        {String(index + 1).padStart(2, "0")}
      </span>
    );
  }

  if (stepTone(step) === "danger") {
    return <LockKeyhole className="h-4 w-4 text-danger" />;
  }

  if (stepTone(step) === "warning") {
    return <Radio className="h-4 w-4 text-warning" />;
  }

  return <Circle className="h-4 w-4 text-text-subtle" />;
}

function StepStateText({ step }) {
  if (step.complete) {
    return <span className="text-[12px] font-medium text-success">Ready</span>;
  }

  const tone = stepTone(step);
  const label = s(step.statusLabel, "Pending");

  return (
    <span
      className={cx(
        "text-[12px] font-medium",
        tone === "danger" && "text-danger",
        tone === "warning" && "text-warning",
        tone === "info" && "text-brand",
        tone === "neutral" && "text-text-subtle"
      )}
    >
      {label}
    </span>
  );
}

function StepRow({
  step,
  active = false,
  onNavigate,
  last = false,
  index = 0,
}) {
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
        "group grid w-full grid-cols-[40px_minmax(0,1fr)_24px] items-start gap-4 py-5 text-left transition-[background-color,color] duration-base ease-premium",
        !last && "border-b border-white/60",
        clickable ? "hover:bg-white/24" : "cursor-default"
      )}
    >
      <div className="flex items-start justify-center pt-[2px]">
        <StepLeading step={step} active={active} index={index} />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="text-[16px] font-semibold tracking-[-0.02em] text-text">
            {s(step.label, "Step")}
          </div>
          <StepStateText step={step} />
        </div>

        <div className="mt-1.5 max-w-[880px] text-[14px] leading-7 text-text-muted">
          {compactSentence(step.summary, "Needs review.")}
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

function SetupMetaLine({ home }) {
  const channelValue =
    s(
      home.launchChannel?.accountDisplayName ||
        home.launchChannel?.accountHandle ||
        home.launchChannel?.statusLabel
    ) || "Not connected";

  const truthValue = home.truthRuntime?.truthVersionId
    ? `v${home.truthRuntime.truthVersionId}`
    : s(home.truthRuntime?.statusLabel, "Needs review");

  const inboxValue = home.launchReady
    ? "Ready"
    : s(home.inboxState?.statusLabel, "Waiting");

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-5 text-text-subtle">
      <span>
        <span className="text-text-muted">Channel</span> {channelValue}
      </span>
      <span>·</span>
      <span>
        <span className="text-text-muted">Truth</span> {truthValue}
      </span>
      <span>·</span>
      <span>
        <span className="text-text-muted">Inbox</span> {inboxValue}
      </span>
    </div>
  );
}

export default function ProductHomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const home = useProductHome();
  const assistantRequested = searchParams.get("assistant") === "setup";

  function navigateFromAction(action = null) {
    const nextAction = normalizeNavigationAction(action);
    if (!nextAction?.path) return;
    navigate(nextAction.path);
  }

  if (home.loading) {
    return <ProductHomeLoadingSurface />;
  }

  const assistant = home.assistant || {};
  const setupPrimaryAction = normalizeNavigationAction(
    assistant.primaryAction || home.primaryAction
  );
  const setupSecondaryAction = normalizeNavigationAction(
    assistant.secondaryAction || home.secondaryAction
  );

  const launchSteps = Array.isArray(home.launchSteps)
    ? home.launchSteps.filter((step) => s(step.id).toLowerCase() !== "setup")
    : [];

  const nextLaunchStep =
    launchSteps.find((step) => step.complete !== true) ||
    launchSteps[launchSteps.length - 1] ||
    null;

  const launchBlockerCount = launchSteps.filter(
    (step) => step.complete !== true
  ).length;

  const launchLabel = home.launchReady
    ? "Launch posture"
    : launchBlockerCount === 1
      ? "1 launch dependency left"
      : `${launchBlockerCount} launch dependencies left`;

  const launchHeadline = home.launchReady
    ? "Launch posture is aligned."
    : s(nextLaunchStep?.label, "Review launch posture.");

  const launchSummary = compactSentence(
    home.launchReady
      ? home.launchSummary ||
          "Channel, approved truth, runtime, and inbox are aligned for the current launch slice."
      : nextLaunchStep?.summary ||
          "Setup is separate. This section only shows live launch dependencies.",
    "Review the current launch dependency."
  );

  return (
    <PageCanvas className="space-y-7">
      {home.availabilityNote ? (
        <InlineNotice
          tone="warning"
          title={s(home.availabilityNote.title, "Some launch signals are limited")}
          description={compactSentence(home.availabilityNote.description)}
          compact
        />
      ) : null}

      <section className="relative border-b border-white/70 pb-7">
        <div className="pointer-events-none absolute right-[-4%] top-[-18%] h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,rgba(65,105,255,0.14)_0%,rgba(65,105,255,0.04)_46%,rgba(65,105,255,0)_74%)] blur-3xl" />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-[920px]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brand">
              {s(assistant.statusLabel, "Setup")}
            </div>

            <h1 className="mt-3 text-[2.05rem] font-semibold leading-[0.96] tracking-[-0.055em] text-text md:text-[2.45rem]">
              {s(assistant.title, "Setup")}
            </h1>

            <p className="mt-3 max-w-[760px] text-[15px] leading-7 text-text-muted">
              {compactSentence(
                assistant.summary,
                "Start or continue the structured business setup."
              )}
            </p>

            <div className="mt-4">
              <SetupMetaLine home={home} />
            </div>

            {assistantRequested ? (
              <div className="mt-3 text-[12px] font-medium text-brand">
                Setup is in focus.
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            {setupPrimaryAction?.path ? (
              <Button
                type="button"
                onClick={() => navigateFromAction(setupPrimaryAction)}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                {setupPrimaryAction.label}
              </Button>
            ) : null}

            {setupSecondaryAction?.path ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigateFromAction(setupSecondaryAction)}
              >
                {setupSecondaryAction.label}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 border-b border-white/70 pb-3">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand">
              {launchLabel}
            </div>
            <div className="mt-2 text-[22px] font-semibold tracking-[-0.035em] text-text">
              {launchHeadline}
            </div>
            <div className="mt-2 max-w-[780px] text-[14px] leading-7 text-text-muted">
              {launchSummary}
            </div>
          </div>
        </div>

        <div className="border-t border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.22),rgba(255,255,255,0.08))]">
          {launchSteps.map((step, index) => (
            <StepRow
              key={step.id}
              step={step}
              index={index}
              active={step.id === nextLaunchStep?.id}
              onNavigate={navigateFromAction}
              last={index === launchSteps.length - 1}
            />
          ))}
        </div>
      </section>
    </PageCanvas>
  );
}