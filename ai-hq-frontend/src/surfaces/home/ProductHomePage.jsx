import { ArrowRight } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import {
  LoadingSurface,
  MetricCard,
  MetricGrid,
  PageCanvas,
  PageHeader,
  StatusBanner,
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

function AvailabilityNotice({ note, onRetry, isFetching }) {
  if (!note) return null;

  return (
    <StatusBanner
      tone="warning"
      label="Limited context"
      title={s(note.title, "Limited context")}
      description={compactSentence(note.description)}
      action={
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onRetry?.()}
          isLoading={isFetching}
        >
          Retry
        </Button>
      }
    />
  );
}

function StepRow({ step, active = false, onNavigate }) {
  const action = normalizeNavigationAction(step.action);
  const tone = stepTone(step);

  return (
    <div
      className={[
        "flex flex-col gap-3 rounded-panel border p-4 md:flex-row md:items-start md:justify-between",
        active ? "border-line-strong bg-surface-subtle" : "border-line bg-surface",
      ].join(" ")}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[15px] font-semibold text-text">
            {s(step.label, "Step")}
          </div>
          <Badge tone={tone}>
            {s(step.statusLabel, step.complete ? "Complete" : "Pending")}
          </Badge>
        </div>

        <div className="mt-2 text-[13px] leading-6 text-text-muted">
          {compactSentence(step.summary, "Still needs attention.")}
        </div>

        {s(step.detail) ? (
          <div className="mt-1 text-[12px] leading-5 text-text-subtle">
            {compactSentence(step.detail)}
          </div>
        ) : null}
      </div>

      {action?.path ? (
        <div className="shrink-0">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onNavigate(action)}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            {action.label}
          </Button>
        </div>
      ) : null}
    </div>
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
  const completeCount = steps.filter((step) => step.complete).length;
  const progressPercent = Math.min(
    Math.max(
      steps.length ? Math.round((completeCount / steps.length) * 100) : 0,
      0
    ),
    100
  );
  const channelIdentity = s(
    home.launchChannel?.accountDisplayName || home.launchChannel?.accountHandle
  );
  const laneStatusValue = home.launchReady
    ? "Ready"
    : blockerCount === 1
      ? "1 blocker"
      : `${blockerCount} blockers`;

  return (
    <PageCanvas>
      <AvailabilityNotice
        note={home.availabilityNote}
        onRetry={home.refetch}
        isFetching={home.isFetching}
      />

      <PageHeader
        eyebrow={s(home.launchPhaseLabel, "Launch posture")}
        title={s(home.launchHeadline, "Review launch posture.")}
        description={compactSentence(
          home.launchSummary,
          "Use Home to review the full launch lane and move only the next governed step."
        )}
        actions={
          <>
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
          </>
        }
      />

      <MetricGrid>
        <MetricCard
          label="Lane status"
          value={laneStatusValue}
          hint={
            home.launchReady
              ? "Setup, truth/runtime, channels, and inbox are aligned."
              : nextStep
                ? `Next: ${s(nextStep.label, "Launch step")}`
                : "Review the launch lane."
          }
          tone={home.launchReady ? "success" : "warning"}
        />
        <MetricCard
          label="Progress"
          value={`${completeCount}/${steps.length || 4}`}
          hint={`${progressPercent}% of the launch lane is currently clear`}
          tone={home.launchReady ? "success" : "info"}
        />
        <MetricCard
          label="Next step"
          value={s(nextStep?.title || nextStep?.label, "Launch lane")}
          hint={compactSentence(
            nextStep?.summary,
            "Open the next launch step to keep the lane moving."
          )}
          tone={home.launchReady ? "success" : stepTone(nextStep)}
        />
        <MetricCard
          label={s(home.launchChannel?.channelLabel, "Launch channel")}
          value={channelIdentity || s(home.launchChannel?.statusLabel, "Not connected")}
          hint={compactSentence(
            home.launchChannel?.summary,
            "Inspect the active launch channel before trusting delivery."
          )}
        />
      </MetricGrid>

      {assistantRequested ? (
        <StatusBanner
          tone="info"
          label="AI setup"
          title="Setup is open in the assistant widget."
          description="Home remains the operational surface while the floating assistant guides the setup draft."
        />
      ) : null}

      <Surface>
        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
              Launch lane
            </div>
            <div className="mt-1 text-[18px] font-semibold text-text">
              Setup, truth/runtime, channels, then inbox.
            </div>
            <div className="mt-1 text-[13px] leading-6 text-text-muted">
              {home.launchReady
                ? "The governed launch surfaces are aligned. Open the next live operator surface only when you need it."
                : "Keep setup, truth/runtime, channels, and inbox aligned before treating the tenant as live."}
            </div>
          </div>

          <div className="space-y-3">
            {steps.map((step) => (
              <StepRow
                key={step.id}
                step={step}
                active={step.id === nextStep?.id}
                onNavigate={navigateFromAction}
              />
            ))}
          </div>
        </div>
      </Surface>
    </PageCanvas>
  );
}