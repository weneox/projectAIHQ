import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleAlert,
  Globe2,
  Inbox,
  MailCheck,
  Network,
  RefreshCw,
  Rocket,
  ShieldCheck,
} from "lucide-react";

import { getAuthMe, resendVerificationEmail } from "../api/auth.js";
import { getLaunchPosture } from "../api/launch.js";
import { createWebsiteWidgetTestMessage } from "../api/channelConnect.js";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
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

function statusTone(done, blocked = false) {
  if (done) return "success";
  if (blocked) return "danger";
  return "warning";
}

function toneTextClass(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "brand" || tone === "info") return "text-brand";
  return "text-text-muted";
}

function toneDotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand" || tone === "info") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

function StepIcon({ icon: Icon, tone = "neutral" }) {
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-line-soft bg-surface">
      <Icon className={cx("h-5 w-5", toneTextClass(tone))} strokeWidth={2.1} />
    </span>
  );
}

function StatusText({ tone = "neutral", children }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold">
      <span className={cx("h-1.5 w-1.5 rounded-full", toneDotClass(tone))} />
      <span className={toneTextClass(tone)}>{children}</span>
    </span>
  );
}

function resolveAnyChannelReady(posture = {}) {
  const summary = obj(posture?.channelSummary);
  if (Number(summary.readyCount || 0) > 0) return true;

  return arr(summary.deliveryReadyChannelIds).length > 0;
}

function buildSteps({ auth, posture }) {
  const emailVerified = isEmailVerified(auth);
  const truthReady =
    posture?.truth?.ready === true && s(posture?.truth?.status).toLowerCase() === "ready";
  const runtimeReady =
    posture?.runtime?.ready === true && s(posture?.runtime?.status).toLowerCase() === "ready";
  const channelReady = resolveAnyChannelReady(posture);
  const inboxAvailable = posture?.inbox?.available === true;

  return [
    {
      id: "email",
      title: "Verify email",
      description: "Secure the workspace before changing sensitive channel and team settings.",
      icon: MailCheck,
      done: emailVerified,
      status: emailVerified ? "Verified" : "Required",
      actionLabel: emailVerified ? "Verified" : "Open verification",
      path: "/verify-email?sent=1",
    },
    {
      id: "business",
      title: "Approve Business Info",
      description: "Add the business facts the AI is allowed to use with customers.",
      icon: ShieldCheck,
      done: truthReady && runtimeReady,
      blocked: truthReady && !runtimeReady,
      status: truthReady && runtimeReady ? "Ready" : truthReady ? "Runtime review" : "Needs setup",
      actionLabel: truthReady ? "Open Business Info" : "Continue setup",
      path: truthReady ? "/truth" : "/home?assistant=setup",
    },
    {
      id: "channels",
      title: "Connect customer channels",
      description: "Connect Website Chat, Instagram, or Telegram. Every channel routes into the same Inbox.",
      icon: Network,
      done: channelReady,
      status: channelReady ? "Channel ready" : "Not connected",
      actionLabel: "Open channels",
      path: "/channels",
    },
    {
      id: "inbox",
      title: "Prove Inbox flow",
      description: "Send a test website message and confirm it appears in Inbox.",
      icon: Inbox,
      done: inboxAvailable && channelReady,
      status: inboxAvailable && channelReady ? "Ready for test" : "Waiting",
      actionLabel: "Open inbox",
      path: "/inbox",
    },
  ];
}

function StepCard({ step, onNavigate }) {
  const tone = statusTone(step.done, step.blocked);
  const DoneIcon = step.done ? CheckCircle2 : CircleAlert;

  return (
    <Card padded={false} clip>
      <div className="grid gap-4 px-4 py-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
        <div className="flex items-start gap-3">
          <StepIcon icon={step.icon} tone={tone} />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                {step.title}
              </h2>

              <StatusText tone={tone}>{step.status}</StatusText>
            </div>

            <p className="mt-1.5 max-w-[680px] text-[13.5px] font-medium leading-6 text-text-muted">
              {step.description}
            </p>
          </div>
        </div>

        <div className="hidden md:block">
          <DoneIcon className={cx("h-5 w-5", toneTextClass(tone))} strokeWidth={2.1} />
        </div>

        <Button
          type="button"
          variant={step.done ? "secondary" : "primary"}
          size="sm"
          onClick={() => onNavigate(step.path)}
          rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
        >
          {step.actionLabel}
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
        error: s(error?.message || "Launch checklist could not be loaded."),
        auth: null,
        posture: null,
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const steps = useMemo(
    () => buildSteps({ auth: state.auth, posture: state.posture || {} }),
    [state.auth, state.posture]
  );

  const doneCount = steps.filter((step) => step.done).length;
  const ready = doneCount === steps.length;

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
        description: s(error?.payload?.error || error?.message || "Open Channels and review Website Chat setup."),
      });
    } finally {
      setTestBusy(false);
    }
  }

  if (state.loading) {
    return (
      <PageCanvas className="max-w-[1180px] py-2">
        <LoadingSurface title="Loading launch checklist" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="max-w-[1180px] space-y-4 py-2">
      {state.error ? (
        <InlineNotice
          tone="danger"
          title="Launch checklist unavailable"
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

      <Card padded={false} clip>
        <section className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
              <Rocket className="h-4 w-4" strokeWidth={2.1} />
              Launch
            </div>

            <h1 className="mt-3 max-w-[820px] font-display text-[34px] font-semibold leading-[1.02] tracking-[var(--tracking-tight-xl)] text-text md:text-[44px]">
              Finish the workspace launch path
            </h1>

            <p className="mt-3 max-w-[720px] text-[14.5px] font-medium leading-6 text-text-muted">
              This is the clean SaaS launch path: verified owner, approved Business Info,
              at least one customer channel connected, and Inbox tested before live usage.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={ready ? "success" : "warning"} size="sm">
                {doneCount}/4 ready
              </Badge>
              <Badge tone="neutral" size="sm">
                Manual-first launch
              </Badge>
              <Badge tone="neutral" size="sm">
                Omnichannel V1
              </Badge>
            </div>
          </div>

          <div className="rounded-[22px] border border-line-soft bg-surface-subtle px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                  Launch state
                </div>
                <div className="mt-2 text-[32px] font-semibold leading-none tracking-[var(--tracking-tight-xl)] text-text">
                  {doneCount}/4
                </div>
              </div>

              {ready ? (
                <CheckCircle2 className="h-8 w-8 text-success" strokeWidth={2.1} />
              ) : (
                <CircleAlert className="h-8 w-8 text-warning" strokeWidth={2.1} />
              )}
            </div>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white">
              <div
                className={cx(
                  "h-full rounded-full transition-all duration-base ease-premium",
                  ready ? "bg-success" : "bg-warning"
                )}
                style={{ width: `${Math.max(8, doneCount * 25)}%` }}
              />
            </div>
          </div>
        </section>
      </Card>

      <div className="grid gap-3">
        {steps.map((step) => (
          <StepCard
            key={step.id}
            step={step}
            onNavigate={(path) => navigate(path)}
          />
        ))}
      </div>

      <Card padded={false} clip>
        <div className="grid gap-3 px-4 py-4 md:grid-cols-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={resending}
            onClick={handleResendCode}
            leftIcon={!resending ? <MailCheck className="h-4 w-4" strokeWidth={2.1} /> : undefined}
          >
            Resend email code
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={testBusy}
            onClick={handleSendWebsiteTest}
            leftIcon={!testBusy ? <Globe2 className="h-4 w-4" strokeWidth={2.1} /> : undefined}
          >
            Send test message
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => navigate("/inbox")}
            leftIcon={<Bot className="h-4 w-4" strokeWidth={2.1} />}
          >
            Open Inbox
          </Button>
        </div>
      </Card>
    </PageCanvas>
  );
}
