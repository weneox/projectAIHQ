import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDashed,
  Link2,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button.jsx";
import {
  LoadingSurface,
  PageCanvas,
} from "../../components/ui/AppShellPrimitives.jsx";
import useProductHome from "../../view-models/useProductHome.js";

const STEP_ICON_MAP = {
  channel: Link2,
  setup: Bot,
  approval: ShieldCheck,
  live: MessageSquareText,
};

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

function toneClasses(step = {}) {
  if (step.complete) {
    return {
      icon: "text-emerald-600",
      pill:
        "border-[rgba(5,150,105,0.14)] bg-[rgba(236,253,245,0.9)] text-[rgba(5,150,105,0.9)]",
      row: "border-[rgba(5,150,105,0.12)] bg-[rgba(247,253,250,0.96)]",
    };
  }

  const tone = s(step.tone || step.status).toLowerCase();

  if (tone === "warn" || tone === "warning" || tone === "attention") {
    return {
      icon: "text-amber-600",
      pill:
        "border-[rgba(217,119,6,0.14)] bg-[rgba(255,251,235,0.92)] text-[rgba(180,83,9,0.92)]",
      row: "border-[rgba(217,119,6,0.12)] bg-[rgba(255,252,247,0.98)]",
    };
  }

  if (tone === "danger" || tone === "blocked" || tone === "error") {
    return {
      icon: "text-rose-600",
      pill:
        "border-[rgba(225,29,72,0.14)] bg-[rgba(255,241,242,0.92)] text-[rgba(190,24,93,0.9)]",
      row: "border-[rgba(225,29,72,0.12)] bg-[rgba(255,250,251,0.98)]",
    };
  }

  if (tone === "info" || tone === "pending" || tone === "connecting") {
    return {
      icon: "text-[rgba(31,77,168,0.92)]",
      pill:
        "border-[rgba(31,77,168,0.14)] bg-[rgba(239,244,255,0.94)] text-[rgba(31,77,168,0.92)]",
      row: "border-[rgba(31,77,168,0.1)] bg-[rgba(250,252,255,0.98)]",
    };
  }

  return {
    icon: "text-[rgba(15,23,42,0.62)]",
    pill:
      "border-[rgba(15,23,42,0.08)] bg-[rgba(248,250,252,0.94)] text-[rgba(15,23,42,0.68)]",
    row: "border-[rgba(15,23,42,0.08)] bg-white",
  };
}

function QuietNotice({ note, onRetry, isFetching }) {
  if (!note) return null;

  return (
    <div className="rounded-[18px] border border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.84)] px-4 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.92)]">
            {s(note.title, "Limited context")}
          </div>
          <div className="mt-1 text-[13px] leading-6 text-[rgba(15,23,42,0.58)]">
            {sentence(note.description)}
          </div>
        </div>

        <div className="shrink-0">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onRetry?.()}
            isLoading={isFetching}
          >
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepRow({ step, active = false, onNavigate }) {
  const Icon = STEP_ICON_MAP[step.id] || CircleDashed;
  const tone = toneClasses(step);

  return (
    <div
      className={[
        "grid gap-4 rounded-[22px] border px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center",
        active ? tone.row : "border-[rgba(15,23,42,0.07)] bg-white/72",
      ].join(" ")}
    >
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <div
            className={[
              "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[rgba(15,23,42,0.04)]",
              tone.icon,
            ].join(" ")}
          >
            {step.complete ? (
              <CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={1.95} />
            ) : (
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.95} />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="truncate text-[15px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.94)]">
                {s(step.label, "Step")}
              </div>

              <div
                className={[
                  "inline-flex min-h-[24px] items-center rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                  tone.pill,
                ].join(" ")}
              >
                {s(step.statusLabel, "Pending")}
              </div>
            </div>

            <div className="mt-1 text-[13px] leading-6 text-[rgba(15,23,42,0.58)]">
              {sentence(step.summary, "Still needs attention.")}
            </div>

            {s(step.detail) ? (
              <div className="mt-1 text-[12px] leading-6 text-[rgba(15,23,42,0.44)]">
                {sentence(step.detail)}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {step.action?.path ? (
        <button
          type="button"
          onClick={() => onNavigate(step.action)}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.7)] transition-colors duration-200 hover:text-[rgba(31,77,168,0.92)]"
        >
          <span>{s(step.action.label, "Open")}</span>
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}

function ProductHomeLoadingSurface() {
  return (
    <PageCanvas className="px-0 py-0">
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
  const activeStep = steps.find((step) => step.complete !== true) || steps[steps.length - 1] || null;
  const blocker = home.primaryBlocker || activeStep || {};
  const completeCount = steps.filter((step) => step.complete).length;
  const channelIdentity = s(
    home.launchChannel?.accountDisplayName || home.launchChannel?.accountHandle
  );

  return (
    <PageCanvas className="px-0 py-0">
      <div className="space-y-6">
        <QuietNotice
          note={home.availabilityNote}
          onRetry={home.refetch}
          isFetching={home.isFetching}
        />

        <section className="overflow-hidden rounded-[34px] border border-[rgba(15,23,42,0.08)] bg-white">
          <div className="pointer-events-none absolute inset-0" />
          <div className="grid gap-8 bg-[radial-gradient(circle_at_top_left,rgba(68,116,245,0.08),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.04),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,251,255,0.98))] px-5 py-6 md:px-7 md:py-7 xl:grid-cols-[minmax(0,1fr)_300px] xl:px-8">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
                <span className="text-[rgba(31,77,168,0.92)]">Launch lane</span>
                <span className="h-1 w-1 rounded-full bg-[rgba(15,23,42,0.16)]" />
                <span>{s(home.launchPhaseLabel, "Current phase")}</span>
              </div>

              <div className="mt-5 max-w-[14ch] text-[2.3rem] font-semibold leading-[0.94] tracking-[-0.065em] text-[rgba(15,23,42,0.98)] md:text-[3.25rem]">
                {s(home.launchHeadline, "Open the launch lane.")}
              </div>

              <div className="mt-4 max-w-[46rem] text-[15px] leading-7 text-[rgba(15,23,42,0.6)]">
                {sentence(
                  home.launchSummary,
                  "Use Home to see what is blocking launch and where to go next."
                )}
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
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
                    size="hero"
                    variant="secondary"
                    onClick={() => navigateFromAction(secondaryAction)}
                  >
                    {secondaryAction.label}
                  </Button>
                ) : null}
              </div>
            </div>

            <aside className="rounded-[28px] border border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.82)] p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
                Launch progress
              </div>

              <div className="mt-3 text-[40px] font-semibold leading-none tracking-[-0.06em] text-[rgba(15,23,42,0.98)]">
                {Number(home.progressPercent || 0)}%
              </div>

              <div className="mt-2 text-[13px] leading-6 text-[rgba(15,23,42,0.58)]">
                {completeCount}/{steps.length || 4} launch steps are clear.
              </div>

              <div className="mt-4 h-[8px] overflow-hidden rounded-full bg-[rgba(15,23,42,0.08)]">
                <div
                  className="h-full rounded-full bg-[rgb(var(--color-brand))] transition-[width] duration-300 ease-premium"
                  style={{
                    width: `${Math.min(Math.max(Number(home.progressPercent || 0), 0), 100)}%`,
                  }}
                />
              </div>

              <div className="mt-5 border-t border-[rgba(15,23,42,0.06)] pt-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
                  {home.launchReady ? "Live posture" : "Current blocker"}
                </div>
                <div className="mt-2 text-[17px] font-semibold tracking-[-0.04em] text-[rgba(15,23,42,0.96)]">
                  {s(blocker.title || blocker.label, "Launch lane")}
                </div>
                <div className="mt-2 text-[13px] leading-6 text-[rgba(15,23,42,0.58)]">
                  {sentence(
                    blocker.summary,
                    "Open the next launch step to keep the lane moving."
                  )}
                </div>

                {channelIdentity ? (
                  <div className="mt-4 rounded-[16px] border border-[rgba(15,23,42,0.07)] bg-[rgba(248,250,252,0.88)] px-3.5 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(15,23,42,0.34)]">
                      Connected identity
                    </div>
                    <div className="mt-1 text-[13px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.82)]">
                      {channelIdentity}
                    </div>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </section>

        <section className="rounded-[32px] border border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.88)] p-5 md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
                Launch checks
              </div>
              <div className="mt-2 text-[1.6rem] font-semibold leading-none tracking-[-0.05em] text-[rgba(15,23,42,0.98)]">
                One lane. Four steps.
              </div>
            </div>

            <div className="max-w-[32rem] text-[13px] leading-6 text-[rgba(15,23,42,0.58)]">
              {sentence(
                blocker.detail ||
                  home.launchSummary ||
                  "Connect the channel, shape the draft, approve truth and runtime, then go live in inbox."
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {steps.map((step) => (
              <StepRow
                key={step.id}
                step={step}
                active={step.id === activeStep?.id}
                onNavigate={navigateFromAction}
              />
            ))}
          </div>
        </section>
      </div>
    </PageCanvas>
  );
}
