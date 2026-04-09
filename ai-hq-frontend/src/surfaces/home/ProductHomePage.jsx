import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import {
  InlineNotice,
  LoadingSurface,
  MetricCard,
  PageCanvas,
  PageHeader,
  Surface,
} from "../../components/ui/AppShellPrimitives.jsx";
import useProductHome from "../../view-models/useProductHome.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function sentence(value, fallback = "") {
  const text = s(value, fallback);
  if (!text) return "";
  const first = text.split(/(?<=[.!?])\s+/)[0] || text;
  return first.length > 180 ? `${first.slice(0, 177).trim()}...` : first;
}

function normalizeAction(action = null, fallback = null) {
  const primary = action && typeof action === "object" ? action : {};
  const secondary = fallback && typeof fallback === "object" ? fallback : {};
  const path = s(
    primary.path || primary.target?.path || secondary.path || secondary.target?.path
  );
  const label = s(primary.label || secondary.label);

  if (!path && !label) return null;

  return {
    label: label || "Open",
    path: path || "/home",
  };
}

function StepTone(step = {}) {
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
    <InlineNotice
      title={s(note.title, "Limited context")}
      description={sentence(note.description)}
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
  const action = normalizeAction(step.action);
  const tone = StepTone(step);

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
          {sentence(step.summary, "Still needs attention.")}
        </div>

        {s(step.detail) ? (
          <div className="mt-1 text-[12px] leading-5 text-text-subtle">
            {sentence(step.detail)}
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

  useEffect(() => {
    if (!assistantRequested) return;
    navigate("/setup", { replace: true });
  }, [assistantRequested, navigate]);

  function navigateFromAction(action = null) {
    const nextAction = normalizeAction(action);
    if (!nextAction?.path) return;
    navigate(nextAction.path);
  }

  if (assistantRequested || home.loading) {
    return <ProductHomeLoadingSurface />;
  }

  const primaryAction = normalizeAction(home.primaryAction);
  const secondaryAction = normalizeAction(home.secondaryAction);
  const steps = Array.isArray(home.launchSteps) ? home.launchSteps : [];
  const activeStep =
    steps.find((step) => step.complete !== true) || steps[steps.length - 1] || null;
  const blocker = home.primaryBlocker || activeStep || {};
  const completeCount = steps.filter((step) => step.complete).length;
  const progressPercent = Math.min(
    Math.max(Number(home.progressPercent || 0), 0),
    100
  );
  const channelIdentity = s(
    home.launchChannel?.accountDisplayName || home.launchChannel?.accountHandle
  );

  return (
    <PageCanvas>
      <AvailabilityNotice
        note={home.availabilityNote}
        onRetry={home.refetch}
        isFetching={home.isFetching}
      />

      <PageHeader
        eyebrow={s(home.launchPhaseLabel, "Launch lane")}
        title={s(home.launchHeadline, "Open the launch lane.")}
        description={sentence(
          home.launchSummary,
          "Use Home to see what is blocking launch and where to go next."
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Phase"
          value={s(home.launchPhaseLabel, "Unknown")}
          hint={s(home.launchReady ? "Launch ready" : "Still in progress")}
          tone={home.launchReady ? "success" : "neutral"}
        />
        <MetricCard
          label="Progress"
          value={`${progressPercent}%`}
          hint={`${completeCount}/${steps.length || 4} steps clear`}
          tone={home.launchReady ? "success" : "info"}
        />
        <MetricCard
          label="Current blocker"
          value={s(blocker.title || blocker.label, "Launch lane")}
          hint={sentence(
            blocker.summary,
            "Open the next launch step to keep the lane moving."
          )}
          tone={home.launchReady ? "success" : "warning"}
        />
        <MetricCard
          label={s(home.launchChannel?.channelLabel, "Launch channel")}
          value={channelIdentity || s(home.launchChannel?.statusLabel, "Not connected")}
          hint={sentence(
            home.launchChannel?.summary,
            "Inspect the active launch channel before trusting delivery."
          )}
        />
      </div>

      <Surface>
        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
              Main flow
            </div>
            <div className="mt-1 text-[18px] font-semibold text-text">
              Channels, setup, truth, then inbox.
            </div>
            <div className="mt-1 text-[13px] leading-6 text-text-muted">
              {sentence(
                blocker.detail ||
                  home.launchSummary ||
                  "Connect the channel, shape the draft, approve truth and runtime, then go live in inbox."
              )}
            </div>
          </div>

          <div className="space-y-3">
            {steps.map((step) => (
              <StepRow
                key={step.id}
                step={step}
                active={step.id === activeStep?.id}
                onNavigate={navigateFromAction}
              />
            ))}
          </div>
        </div>
      </Surface>
    </PageCanvas>
  );
}
