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

function StateMetaLine({ home }) {
  const channelValue =
    s(
      home.launchChannel?.accountDisplayName ||
        home.launchChannel?.accountHandle ||
        home.launchChannel?.statusLabel
    ) || "Not connected";

  const truthValue =
    home.truthRuntime?.truthVersionId
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

  const primaryAction = normalizeNavigationAction(home.primaryAction);
  const secondaryAction = normalizeNavigationAction(home.secondaryAction);
  const steps = Array.isArray(home.launchSteps) ? home.launchSteps : [];

  const nextStep =
    home.nextStep ||
    steps.find((step) => step.complete !== true) ||
    steps[steps.length - 1] ||
    null;

  const blockerCount =
    typeof home.blockerCount === "number"
      ? home.blockerCount
      : steps.filter((step) => step.complete !== true).length;

  const topLabel = home.launchReady
    ? "Launch lane ready"
    : blockerCount === 1
      ? "1 launch step left"
      : `${blockerCount} launch steps left`;

  const headline = home.launchReady
    ? "Launch slice is ready."
    : s(nextStep?.label, "Finish the next launch step.");

  const summary = compactSentence(
    home.launchReady
      ? home.launchSummary ||
          "Setup, truth, one live channel, and inbox are aligned for the current launch slice."
      : nextStep?.summary ||
          "Only the current launch slice matters right now: setup, truth, one channel, inbox.",
    "Review the next launch step."
  );

  return (
    <PageCanvas className="space-y-6">
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
              {topLabel}
            </div>

            <h1 className="mt-3 text-[2.05rem] font-semibold leading-[0.96] tracking-[-0.055em] text-text md:text-[2.45rem]">
              {headline}
            </h1>

            <p className="mt-3 max-w-[760px] text-[15px] leading-7 text-text-muted">
              {summary}
            </p>

            <div className="mt-4">
              <StateMetaLine home={home} />
            </div>

            {assistantRequested ? (
              <div className="mt-3 text-[12px] font-medium text-brand">
                Setup draft is open.
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            {primaryAction?.path ? (
              <Button
                type="button"
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
                onClick={() => navigateFromAction(secondaryAction)}
              >
                {secondaryAction.label}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="border-t border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.22),rgba(255,255,255,0.08))]">
        {steps.map((step, index) => (
          <StepRow
            key={step.id}
            step={step}
            index={index}
            active={step.id === nextStep?.id}
            onNavigate={navigateFromAction}
            last={index === steps.length - 1}
          />
        ))}
      </section>
    </PageCanvas>
  );
}