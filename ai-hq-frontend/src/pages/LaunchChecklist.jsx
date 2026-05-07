import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Circle,
  Globe2,
  Inbox,
  MailCheck,
  RefreshCw,
  Rocket,
  ShieldCheck,
} from "lucide-react";

import { getAuthMe, resendVerificationEmail } from "../api/auth.js";
import { getLaunchPosture } from "../api/launch.js";
import { createWebsiteWidgetTestMessage } from "../api/channelConnect.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function isEmailVerified(auth = {}) {
  return (
    auth?.user?.emailVerified === true ||
    auth?.user?.email_verified === true ||
    auth?.auth?.emailVerified === true ||
    auth?.auth?.email_verified === true
  );
}

function hasReadyChannel(posture = {}) {
  const summary = obj(posture?.channelSummary);

  if (Number(summary.readyCount || 0) > 0) return true;
  if (arr(summary.deliveryReadyChannelIds).length > 0) return true;

  return false;
}

function businessReady(posture = {}) {
  const truthReady =
    posture?.truth?.ready === true &&
    s(posture?.truth?.status).toLowerCase() === "ready";

  const runtimeReady =
    posture?.runtime?.ready === true &&
    s(posture?.runtime?.status).toLowerCase() === "ready";

  return truthReady && runtimeReady;
}

function inboxReady(posture = {}) {
  return posture?.inbox?.available === true;
}

function buildLaunchPath({ auth, posture }) {
  const email = isEmailVerified(auth);
  const business = businessReady(posture);
  const channel = hasReadyChannel(posture);
  const inbox = inboxReady(posture) && channel;

  return [
    {
      id: "email",
      icon: MailCheck,
      label: "Account",
      title: "Verify your email",
      body: "Secure sensitive workspace changes before launch.",
      done: email,
      actionLabel: "Open verification",
      path: "/verify-email?sent=1",
    },
    {
      id: "business",
      icon: ShieldCheck,
      label: "Business profile",
      title: "Approve the business profile",
      body: "Confirm the facts AI is allowed to use with customers.",
      done: business,
      actionLabel: "Review profile",
      path: business ? "/truth" : "/home?assistant=setup",
    },
    {
      id: "channel",
      icon: Globe2,
      label: "Customer lane",
      title: "Choose one customer lane",
      body: "Connect the channel you actually want to use first.",
      done: channel,
      actionLabel: "Open channels",
      path: "/channels",
    },
    {
      id: "inbox",
      icon: Inbox,
      label: "Inbox test",
      title: "Confirm the inbox flow",
      body: "Send or receive a test message before live usage.",
      done: inbox,
      actionLabel: "Open inbox",
      path: "/inbox",
    },
  ];
}

function firstOpenStep(steps = []) {
  return steps.find((step) => !step.done) || null;
}

function StepState({ done, active }) {
  if (done) {
    return (
      <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-success">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-soft">
          <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
        Done
      </span>
    );
  }

  if (active) {
    return (
      <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-brand">
        <span className="h-2 w-2 rounded-full bg-brand" />
        Current
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-text-muted">
      <span className="h-2 w-2 rounded-full bg-[rgb(var(--color-text-soft))]" />
      Later
    </span>
  );
}

function MainPanel({ step, complete, onNavigate }) {
  const Icon = step?.icon || Rocket;

  return (
    <Card padded={false} clip className="shadow-[0_28px_80px_-64px_rgba(15,23,42,0.55)]">
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-brand">
            <Rocket className="h-4 w-4" strokeWidth={2.1} />
            Launch
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-[22px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
              {complete ? "Workspace is ready for live use" : "Prepare for live use"}
            </h1>

            <span
              className={cx(
                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold",
                complete
                  ? "bg-success-soft text-success"
                  : "bg-brand-soft text-brand"
              )}
            >
              <span
                className={cx(
                  "h-1.5 w-1.5 rounded-full",
                  complete ? "bg-success" : "bg-brand"
                )}
              />
              {complete ? "Ready" : "Setup path"}
            </span>
          </div>

          <div className="mt-7 max-w-[680px]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-surface-subtle">
                <Icon className="h-5 w-5 text-brand" strokeWidth={2.1} />
              </div>

              <div className="min-w-0">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                  {complete ? "Live posture" : step.label}
                </div>

                <div className="mt-1 text-[18px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                  {complete ? "No launch blocker is visible." : step.title}
                </div>
              </div>
            </div>

            <p className="mt-4 text-[13.5px] font-medium leading-6 text-text-muted">
              {complete
                ? "Keep using the workspace normally. You can still review channels, settings, and inbox activity whenever needed."
                : step.body}
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => onNavigate(complete ? "/inbox" : step.path)}
          rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
        >
          {complete ? "Open inbox" : step.actionLabel}
        </Button>
      </div>
    </Card>
  );
}

function LaunchPath({ steps, currentStep, onNavigate }) {
  return (
    <Card padded={false} clip className="shadow-[0_24px_70px_-64px_rgba(15,23,42,0.52)]">
      <div className="px-5 py-4">
        <div className="text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
          Launch path
        </div>
        <p className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
          A simple path to live usage. Only one customer lane is needed.
        </p>
      </div>

      <div>
        {steps.map((step) => {
          const Icon = step.icon;
          const active = currentStep?.id === step.id;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onNavigate(step.path)}
              className="grid w-full gap-3 border-t border-line-soft px-5 py-4 text-left transition-colors duration-base ease-premium hover:bg-surface-subtle/70 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-[15px] bg-surface-subtle">
                <Icon
                  className={cx(
                    "h-4.5 w-4.5",
                    step.done || active ? "text-brand" : "text-text-muted"
                  )}
                  strokeWidth={2.1}
                />
              </div>

              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-text">
                  {step.title}
                </div>
                <div className="mt-0.5 text-[12.5px] font-medium text-text-muted">
                  {step.body}
                </div>
              </div>

              <StepState done={step.done} active={active} />
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function UtilityActions({
  resending,
  onResend,
  testBusy,
  onSendTest,
}) {
  return (
    <Card padded={false} clip className="shadow-[0_24px_70px_-64px_rgba(15,23,42,0.52)]">
      <div className="grid gap-3 px-5 py-4 md:grid-cols-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={resending}
          onClick={onResend}
          leftIcon={!resending ? <MailCheck className="h-4 w-4" strokeWidth={2.1} /> : undefined}
        >
          Resend email code
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={testBusy}
          onClick={onSendTest}
          leftIcon={!testBusy ? <Globe2 className="h-4 w-4" strokeWidth={2.1} /> : undefined}
        >
          Send website test message
        </Button>
      </div>
    </Card>
  );
}

export default function LaunchChecklist() {
  const navigate = useNavigate();
  const [state, setState] = useState({
    loading: true,
    error: "",
    auth: null,
    posture: null,
  });
  const [resending, setResending] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  async function load() {
    setState((current) => ({ ...current, loading: true, error: "" }));

    try {
      const [auth, posture] = await Promise.all([
        getAuthMe(),
        getLaunchPosture(),
      ]);

      setState({
        loading: false,
        error: "",
        auth,
        posture,
      });
    } catch (error) {
      setState({
        loading: false,
        error: s(error?.message || "Launch state could not be loaded."),
        auth: null,
        posture: null,
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const steps = useMemo(
    () => buildLaunchPath({ auth: state.auth, posture: state.posture || {} }),
    [state.auth, state.posture]
  );

  const currentStep = firstOpenStep(steps);
  const complete = !currentStep;

  async function handleResendCode() {
    if (resending) return;

    try {
      setResending(true);
      setNotice(null);

      const result = await resendVerificationEmail();

      setNotice({
        tone: result?.alreadyVerified ? "success" : result?.sent ? "success" : "warning",
        title: result?.alreadyVerified
          ? "Email already verified"
          : result?.sent
            ? "Verification code sent"
            : "Verification code created",
        description: result?.alreadyVerified
          ? "Your email is already verified."
          : result?.sent
            ? "Check your inbox for the 6-digit code."
            : "Email delivery is not configured yet. Check Resend settings.",
      });

      await load();
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Could not resend code",
        description: s(error?.payload?.error || error?.message || "Try again later."),
      });
    } finally {
      setResending(false);
    }
  }

  async function handleSendWebsiteTest() {
    if (testBusy) return;

    try {
      setTestBusy(true);
      setNotice(null);

      const result = await createWebsiteWidgetTestMessage({
        message: "Website chat setup test message",
      });

      setNotice({
        tone: "success",
        title: "Test message created",
        description: "Open Inbox and confirm the website test conversation is visible.",
      });

      const threadId = s(result?.inbox?.threadId || result?.threadId);
      if (threadId) {
        navigate(`/inbox?threadId=${encodeURIComponent(threadId)}`);
      } else {
        await load();
      }
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Could not create test message",
        description: s(error?.payload?.error || error?.message || "Review Website Chat setup."),
      });
    } finally {
      setTestBusy(false);
    }
  }

  if (state.loading) {
    return (
      <PageCanvas className="max-w-[1120px] py-3">
        <LoadingSurface title="Loading launch" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="max-w-[1120px] space-y-4 py-3">
      {state.error ? (
        <InlineNotice
          tone="danger"
          title="Launch unavailable"
          description={state.error}
          compact
        />
      ) : null}

      {notice ? (
        <InlineNotice
          tone={notice.tone}
          title={notice.title}
          description={notice.description}
          compact
        />
      ) : null}

      <MainPanel
        step={currentStep}
        complete={complete}
        onNavigate={(path) => navigate(path)}
      />

      <LaunchPath
        steps={steps}
        currentStep={currentStep}
        onNavigate={(path) => navigate(path)}
      />

      <UtilityActions
        resending={resending}
        onResend={handleResendCode}
        testBusy={testBusy}
        onSendTest={handleSendWebsiteTest}
      />
    </PageCanvas>
  );
}