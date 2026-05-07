import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Globe2,
  LogOut,
  MailCheck,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  User2,
} from "lucide-react";

import {
  getAuthMe,
  logoutUser,
  resendVerificationEmail,
} from "../api/auth.js";
import { getLaunchPosture } from "../api/launch.js";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../components/ui/AppShellPrimitives.jsx";
import { clearAppAuthContext, clearAppSessionContext } from "../lib/appSession.js";
import { cx } from "../lib/cx.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function isEmailVerified(auth = {}) {
  return (
    auth?.user?.emailVerified === true ||
    auth?.user?.email_verified === true ||
    auth?.auth?.emailVerified === true ||
    auth?.auth?.email_verified === true
  );
}

function pickUser(auth = {}) {
  const user = obj(auth?.user || auth?.auth);
  return {
    email: s(user.email),
    name: s(user.fullName || user.full_name || user.name),
    role: s(user.role, "member"),
    tenantKey: s(user.tenantKey || user.tenant_key),
    tenantId: s(user.tenantId || user.tenant_id),
    planKey: s(user.planKey || user.plan_key, "starter"),
  };
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

function StatusLine({ tone = "neutral", children }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold">
      <span className={cx("h-1.5 w-1.5 rounded-full", toneDotClass(tone))} />
      <span className={toneTextClass(tone)}>{children}</span>
    </span>
  );
}

function SettingRow({ icon: Icon, title, description, status, tone = "neutral", action }) {
  return (
    <div className="grid gap-4 border-b border-line-soft px-4 py-4 last:border-b-0 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] border border-line-soft bg-surface">
        <Icon className={cx("h-5 w-5", toneTextClass(tone))} strokeWidth={2.1} />
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[15px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
            {title}
          </div>
          {status ? <StatusLine tone={tone}>{status}</StatusLine> : null}
        </div>

        <div className="mt-1 text-[13.5px] font-medium leading-6 text-text-muted">
          {description}
        </div>
      </div>

      {action}
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const [state, setState] = useState({
    loading: true,
    error: "",
    auth: null,
    posture: null,
  });
  const [notice, setNotice] = useState(null);
  const [resending, setResending] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function load() {
    setState((current) => ({ ...current, loading: true, error: "" }));

    try {
      const [auth, posture] = await Promise.all([
        getAuthMe(),
        getLaunchPosture().catch(() => null),
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
        error: s(error?.message || "Settings could not be loaded."),
        auth: null,
        posture: null,
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const user = useMemo(() => pickUser(state.auth || {}), [state.auth]);
  const verified = isEmailVerified(state.auth || {});
  const channelReady = Number(state.posture?.channelSummary?.readyCount || 0) > 0;
  const truthReady = state.posture?.truth?.ready === true;
  const runtimeReady = state.posture?.runtime?.ready === true;

  async function handleResend() {
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
        title: "Could not resend verification code",
        description: s(error?.payload?.error || error?.message || "Try again later."),
      });
    } finally {
      setResending(false);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      await logoutUser();
    } catch {
      // Still clear local app session context below.
    } finally {
      clearAppAuthContext();
      clearAppSessionContext();
      navigate("/login", { replace: true });
    }
  }

  if (state.loading) {
    return (
      <PageCanvas className="max-w-[1120px] py-2">
        <LoadingSurface title="Loading settings" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="max-w-[1120px] space-y-4 py-2">
      {state.error ? (
        <InlineNotice
          tone="danger"
          title="Settings unavailable"
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
              <SettingsIcon className="h-4 w-4" strokeWidth={2.1} />
              Settings
            </div>

            <h1 className="mt-3 max-w-[780px] font-display text-[34px] font-semibold leading-[1.02] tracking-[var(--tracking-tight-xl)] text-text md:text-[44px]">
              Workspace settings
            </h1>

            <p className="mt-3 max-w-[720px] text-[14.5px] font-medium leading-6 text-text-muted">
              Manage account security, workspace state, omnichannel readiness, and launch controls.
            </p>
          </div>

          <div className="rounded-[22px] border border-line-soft bg-surface-subtle px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
              Workspace
            </div>
            <div className="mt-2 truncate text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
              {user.tenantKey || "Workspace"}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone={verified ? "success" : "warning"} size="sm">
                {verified ? "Email verified" : "Email required"}
              </Badge>
              <Badge tone="neutral" size="sm">
                {user.planKey}
              </Badge>
            </div>
          </div>
        </section>
      </Card>

      <Card padded={false} clip>
        <div className="border-b border-line-soft px-4 py-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            Account
          </div>
          <div className="mt-1 text-[19px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            Identity and security
          </div>
        </div>

        <SettingRow
          icon={User2}
          title={user.name || "User profile"}
          description={user.email || "Signed-in workspace user"}
          status={user.role}
          tone="neutral"
          action={
            <Button type="button" variant="secondary" size="sm" disabled>
              Profile soon
            </Button>
          }
        />

        <SettingRow
          icon={MailCheck}
          title="Email verification"
          description={
            verified
              ? "This account can change sensitive workspace and channel settings."
              : "Verify email before changing sensitive workspace and channel settings."
          }
          status={verified ? "Verified" : "Required"}
          tone={verified ? "success" : "warning"}
          action={
            verified ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => navigate("/launch")}>
                Launch
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={resending}
                  onClick={handleResend}
                  leftIcon={!resending ? <RefreshCw className="h-4 w-4" strokeWidth={2.1} /> : undefined}
                >
                  Resend code
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => navigate("/verify-email?sent=1")}
                >
                  Verify
                </Button>
              </div>
            )
          }
        />
      </Card>

      <Card padded={false} clip>
        <div className="border-b border-line-soft px-4 py-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            Workspace readiness
          </div>
          <div className="mt-1 text-[19px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            Omnichannel workspace checks
          </div>
        </div>

        <SettingRow
          icon={ShieldCheck}
          title="Business Info"
          description="Approved business facts and runtime authority used by the AI."
          status={truthReady && runtimeReady ? "Ready" : truthReady ? "Runtime review" : "Needs setup"}
          tone={truthReady && runtimeReady ? "success" : "warning"}
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate(truthReady ? "/truth" : "/home?assistant=setup")}
              rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
            >
              Open
            </Button>
          }
        />

        <SettingRow
          icon={Globe2}
          title="Customer Channels"
          description="Website Chat, Instagram, and Telegram all route into the same Inbox and Business Info runtime."
          status={channelReady ? "Ready" : "Not connected"}
          tone={channelReady ? "success" : "warning"}
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate("/channels")}
              rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
            >
              Open
            </Button>
          }
        />

        <SettingRow
          icon={CheckCircle2}
          title="Launch Checklist"
          description="Finish the omnichannel launch path before relying on live AI replies."
          status="Open"
          tone="brand"
          action={
            <Button
              type="button"
              size="sm"
              onClick={() => navigate("/launch")}
              rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
            >
              Review
            </Button>
          }
        />
      </Card>

      <Card padded={false} clip>
        <div className="border-b border-line-soft px-4 py-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            Session
          </div>
          <div className="mt-1 text-[19px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            Access
          </div>
        </div>

        <SettingRow
          icon={LogOut}
          title="Sign out"
          description="End this browser session and return to login."
          status="Current session"
          tone="neutral"
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={loggingOut}
              onClick={handleLogout}
            >
              Sign out
            </Button>
          }
        />
      </Card>
    </PageCanvas>
  );
}
