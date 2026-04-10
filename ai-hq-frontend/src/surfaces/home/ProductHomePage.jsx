import {
  ArrowRight,
  CheckCircle2,
  Circle,
  LockKeyhole,
  Radio,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
  Surface,
} from "../../components/ui/AppShellPrimitives.jsx";
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

function StepIcon({ step, active = false }) {
  if (step.complete) {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  }

  if (active) {
    return <Radio className="h-4 w-4 text-brand" />;
  }

  if (stepTone(step) === "danger") {
    return <LockKeyhole className="h-4 w-4 text-rose-600" />;
  }

  return <Circle className="h-4 w-4 text-slate-400" />;
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

  const liveValue = home.launchReady
    ? "Inbox ready"
    : s(home.inboxState?.statusLabel, "Waiting");

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-5 text-text-subtle">
      <span>
        <span className="text-text-muted">Channel:</span> {channelValue}
      </span>
      <span className="text-slate-300">•</span>
      <span>
        <span className="text-text-muted">Truth:</span> {truthValue}
      </span>
      <span className="text-slate-300">•</span>
      <span>
        <span className="text-text-muted">Live:</span> {liveValue}
      </span>
    </div>
  );
}

function StepRow({ step, active = false, onNavigate, last = false }) {
  const action = normalizeNavigationAction(step.action);
  const tone = stepTone(step);

  return (
    <button
      type="button"
      onClick={() => {
        if (action?.path) onNavigate(action);
      }}
      disabled={!action?.path}
      className={[
        "group flex w-full items-start gap-3 px-1 py-4 text-left transition disabled:cursor-default",
        !last && "border-b border-line-soft",
      ].join(" ")}
    >
      <div className="mt-0.5 shrink-0">
        <StepIcon step={step} active={active} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[14px] font-semibold text-text">
            {s(step.label, "Step")}
          </div>
          <Badge tone={tone}>
            {s(step.statusLabel, step.complete ? "Ready" : "Pending")}
          </Badge>
        </div>

        <div className="mt-1 text-[13px] leading-5 text-text-muted">
          {compactSentence(step.summary, "Needs review.")}
        </div>
      </div>

      {action?.path ? (
        <div className="mt-0.5 shrink-0 text-text-subtle transition group-hover:text-text">
          <ArrowRight className="h-4 w-4" />
        </div>
      ) : null}
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

  const laneLabel = home.launchReady
    ? "Ready"
    : blockerCount === 1
      ? "1 blocker"
      : `${blockerCount} blockers`;

  const headline = home.launchReady
    ? "Everything important is aligned."
    : s(nextStep?.label, "Review launch posture.");

  const summary = compactSentence(
    home.launchReady
      ? home.launchSummary || "Channel, setup, truth, and inbox are ready."
      : nextStep?.summary || home.launchSummary,
    "Review the next launch step."
  );

  return (
    <PageCanvas className="space-y-3">
      {home.availabilityNote ? (
        <InlineNotice
          tone="warning"
          title={s(home.availabilityNote.title, "Limited context")}
          description={compactSentence(home.availabilityNote.description)}
          compact
        />
      ) : null}

      <Surface padded="lg" className="rounded-[22px]">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 border-b border-line-soft pb-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone={home.launchReady ? "success" : "warning"}>
                  {laneLabel}
                </Badge>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                  Launch lane
                </div>
              </div>

              <h1 className="text-[1.55rem] font-semibold leading-tight tracking-[-0.03em] text-text md:text-[1.75rem]">
                {headline}
              </h1>

              <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-text-muted">
                {summary}
              </p>

              <div className="mt-3">
                <StateMetaLine home={home} />
              </div>

              {assistantRequested ? (
                <div className="mt-3 text-[12px] leading-5 text-text-subtle">
                  Setup assistant is open.
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
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

          <div>
            {steps.map((step, index) => (
              <StepRow
                key={step.id}
                step={step}
                active={step.id === nextStep?.id}
                onNavigate={navigateFromAction}
                last={index === steps.length - 1}
              />
            ))}
          </div>
        </div>
      </Surface>
    </PageCanvas>
  );
}