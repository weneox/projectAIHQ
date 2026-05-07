import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock3,
  LogOut,
  MailCheck,
  RefreshCw,
  Save,
  SlidersHorizontal,
} from "lucide-react";

import {
  getAuthMe,
  logoutUser,
  resendVerificationEmail,
} from "../api/auth.js";
import {
  getWorkspaceSettings,
  saveWorkspaceAiPolicy,
} from "../api/settings.js";
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
  return String(value ?? fallback).trim() || fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function bool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function number(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function padHour(value = 0) {
  return String(Math.max(0, Math.min(23, number(value)))).padStart(2, "0");
}

function hourOptions() {
  return Array.from({ length: 24 }, (_, index) => ({
    value: index,
    label: `${padHour(index)}:00`,
  }));
}

function isEmailVerified(auth = {}) {
  return (
    auth?.user?.emailVerified === true ||
    auth?.user?.email_verified === true ||
    auth?.auth?.emailVerified === true ||
    auth?.auth?.email_verified === true
  );
}

function normalizeAiPolicy(input = {}) {
  const policy = obj(input);
  const quietHours = obj(policy.quiet_hours || policy.quietHours);

  return {
    auto_reply_enabled: bool(policy.auto_reply_enabled, true),
    suppress_ai_during_handoff: bool(policy.suppress_ai_during_handoff, true),
    mark_seen_enabled: bool(policy.mark_seen_enabled, true),
    typing_indicator_enabled: bool(policy.typing_indicator_enabled, true),
    create_lead_enabled: bool(policy.create_lead_enabled, true),
    approval_required_content: bool(policy.approval_required_content, true),
    approval_required_publish: bool(policy.approval_required_publish, true),
    quiet_hours_enabled: bool(policy.quiet_hours_enabled, false),
    quiet_hours: {
      startHour: number(quietHours.startHour ?? quietHours.start_hour, 22),
      endHour: number(quietHours.endHour ?? quietHours.end_hour, 8),
    },
    inbox_policy: obj(policy.inbox_policy),
    comment_policy: obj(policy.comment_policy),
    content_policy: obj(policy.content_policy),
    escalation_rules: obj(policy.escalation_rules),
    risk_rules: obj(policy.risk_rules),
    lead_scoring_rules: obj(policy.lead_scoring_rules),
    publish_policy: obj(policy.publish_policy),
  };
}

function extractAiPolicy(payload = {}) {
  return normalizeAiPolicy(
    payload?.aiPolicy ||
      payload?.ai_policy ||
      payload?.settings?.aiPolicy ||
      payload?.data?.aiPolicy ||
      {}
  );
}

function SettingSwitch({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-base ease-premium disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-brand" : "bg-surface-subtle"
      )}
      aria-pressed={checked}
    >
      <span
        className={cx(
          "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-base ease-premium",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

function SettingRow({
  title,
  description,
  checked,
  onChange,
  disabled = false,
}) {
  return (
    <div className="grid gap-4 border-t border-line-soft px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
          {title}
        </div>
        <div className="mt-1 max-w-[720px] text-[12.5px] font-medium leading-5 text-text-muted">
          {description}
        </div>
      </div>

      <SettingSwitch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

function SectionTitle({ icon: Icon, title, description }) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-brand" strokeWidth={2.1} /> : null}
        <div className="text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
          {title}
        </div>
      </div>
      {description ? (
        <p className="mt-1 max-w-[760px] text-[12.5px] font-medium leading-5 text-text-muted">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function QuietHours({ policy, onChange, disabled = false }) {
  const hours = hourOptions();

  function updateQuietHours(next = {}) {
    onChange({
      ...policy,
      quiet_hours: {
        ...policy.quiet_hours,
        ...next,
      },
    });
  }

  return (
    <div className="border-t border-line-soft px-5 py-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
            Quiet hours
          </div>
          <div className="mt-1 max-w-[720px] text-[12.5px] font-medium leading-5 text-text-muted">
            Pause automatic AI replies during the hours you choose.
          </div>
        </div>

        <SettingSwitch
          checked={policy.quiet_hours_enabled}
          onChange={(value) =>
            onChange({
              ...policy,
              quiet_hours_enabled: value,
            })
          }
          disabled={disabled}
        />
      </div>

      {policy.quiet_hours_enabled ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-[12px] font-semibold text-text-muted">
              Start
            </span>
            <select
              value={number(policy.quiet_hours.startHour, 22)}
              disabled={disabled}
              onChange={(event) =>
                updateQuietHours({ startHour: number(event.target.value, 22) })
              }
              className="h-10 rounded-full border border-line bg-white px-3 text-[13px] font-semibold text-text outline-none transition-colors duration-base ease-premium focus:border-brand disabled:bg-surface-subtle"
            >
              {hours.map((item) => (
                <option key={`start-${item.value}`} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-[12px] font-semibold text-text-muted">
              End
            </span>
            <select
              value={number(policy.quiet_hours.endHour, 8)}
              disabled={disabled}
              onChange={(event) =>
                updateQuietHours({ endHour: number(event.target.value, 8) })
              }
              className="h-10 rounded-full border border-line bg-white px-3 text-[13px] font-semibold text-text outline-none transition-colors duration-base ease-premium focus:border-brand disabled:bg-surface-subtle"
            >
              {hours.map((item) => (
                <option key={`end-${item.value}`} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}

function SessionPanel({ verified, resending, onResend, loggingOut, onLogout }) {
  return (
    <Card padded={false} clip className="shadow-[0_24px_70px_-64px_rgba(15,23,42,0.52)]">
      <SectionTitle
        icon={MailCheck}
        title="Account access"
        description="Security actions for the current browser session."
      />

      <div className="grid gap-3 border-t border-line-soft px-5 py-4 md:grid-cols-2">
        <div className="rounded-[20px] bg-surface-subtle px-4 py-4">
          <div className="text-[13px] font-semibold text-text">
            Email verification
          </div>
          <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
            {verified
              ? "Your email is verified."
              : "Verify email before sensitive workspace changes."}
          </div>

          {!verified ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              loading={resending}
              onClick={onResend}
              leftIcon={!resending ? <RefreshCw className="h-4 w-4" strokeWidth={2.1} /> : undefined}
            >
              Resend code
            </Button>
          ) : null}
        </div>

        <div className="rounded-[20px] bg-surface-subtle px-4 py-4">
          <div className="text-[13px] font-semibold text-text">
            Session
          </div>
          <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
            End this browser session and return to login.
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            loading={loggingOut}
            onClick={onLogout}
            leftIcon={!loggingOut ? <LogOut className="h-4 w-4" strokeWidth={2.1} /> : undefined}
          >
            Sign out
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DangerPanel() {
  return (
    <Card padded={false} clip className="shadow-[0_24px_70px_-64px_rgba(15,23,42,0.52)]">
      <SectionTitle
        title="Danger zone"
        description="Destructive workspace actions should live here when the backend supports them."
      />

      <div className="grid gap-3 border-t border-line-soft px-5 py-4 md:grid-cols-3">
        <Button type="button" variant="secondary" size="sm" disabled>
          Export data
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled>
          Reset workspace
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled>
          Delete workspace
        </Button>
      </div>
    </Card>
  );
}

export default function Settings() {
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    saving: false,
    error: "",
    auth: null,
    policy: normalizeAiPolicy(),
    originalPolicy: normalizeAiPolicy(),
  });
  const [notice, setNotice] = useState(null);
  const [resending, setResending] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async ({ refreshing = false } = {}) => {
    setState((current) => ({
      ...current,
      loading: !refreshing,
      refreshing,
      error: "",
    }));

    try {
      const [auth, settings] = await Promise.all([
        getAuthMe(),
        getWorkspaceSettings(),
      ]);

      const policy = extractAiPolicy(settings);

      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        error: "",
        auth,
        policy,
        originalPolicy: policy,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        error:
          s(error?.payload?.reason || error?.payload?.error || error?.message) ||
          "Settings could not be loaded.",
      }));
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const verified = isEmailVerified(state.auth || {});
  const dirty = useMemo(
    () => JSON.stringify(state.policy) !== JSON.stringify(state.originalPolicy),
    [state.originalPolicy, state.policy]
  );

  function updatePolicy(patch = {}) {
    setState((current) => ({
      ...current,
      policy: {
        ...current.policy,
        ...patch,
      },
    }));
  }

  async function savePolicy() {
    if (state.saving || !dirty) return;

    try {
      setState((current) => ({
        ...current,
        saving: true,
      }));
      setNotice(null);

      const payload = await saveWorkspaceAiPolicy(state.policy);
      const policy = extractAiPolicy(payload);

      setState((current) => ({
        ...current,
        saving: false,
        policy,
        originalPolicy: policy,
      }));

      setNotice({
        tone: "success",
        title: "Settings saved",
        description: "AI behavior settings were updated.",
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        saving: false,
      }));

      setNotice({
        tone: "danger",
        title: "Settings could not be saved",
        description:
          s(error?.payload?.message || error?.payload?.error || error?.message) ||
          "Check permissions and try again.",
      });
    }
  }

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

      await load({ refreshing: true });
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
      // local cleanup below
    } finally {
      clearAppAuthContext();
      clearAppSessionContext();
      window.location.assign("/login");
    }
  }

  if (state.loading) {
    return (
      <PageCanvas className="max-w-[1100px] py-3">
        <LoadingSurface title="Loading settings" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="max-w-[1100px] space-y-4 py-3">
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

      <Card padded={false} clip className="shadow-[0_28px_80px_-64px_rgba(15,23,42,0.55)]">
        <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-brand">
              Settings
            </div>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
              System behavior
            </h1>
            <p className="mt-2 max-w-[720px] text-[13.5px] font-medium leading-6 text-text-muted">
              Control how the workspace replies, marks messages, creates leads, and handles quiet hours.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {dirty ? (
              <span className="text-[12.5px] font-semibold text-warning">
                Unsaved changes
              </span>
            ) : (
              <span className="text-[12.5px] font-semibold text-text-muted">
                Saved
              </span>
            )}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={state.refreshing}
              onClick={() => load({ refreshing: true })}
              leftIcon={!state.refreshing ? <RefreshCw className="h-4 w-4" strokeWidth={2.1} /> : undefined}
            >
              Refresh
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={!dirty}
              loading={state.saving}
              onClick={savePolicy}
              leftIcon={!state.saving ? <Save className="h-4 w-4" strokeWidth={2.1} /> : undefined}
            >
              Save
            </Button>
          </div>
        </div>

        <SectionTitle
          icon={SlidersHorizontal}
          title="AI replies"
          description="Controls that change live inbox behavior."
        />

        <SettingRow
          title="Automatic replies"
          description="Allow AI to answer customer messages when the workspace is allowed to operate."
          checked={state.policy.auto_reply_enabled}
          onChange={(value) => updatePolicy({ auto_reply_enabled: value })}
        />

        <SettingRow
          title="Pause AI during human handoff"
          description="When a human takes over, AI will stay silent in that conversation."
          checked={state.policy.suppress_ai_during_handoff}
          onChange={(value) => updatePolicy({ suppress_ai_during_handoff: value })}
        />

        <SettingRow
          title="Typing indicator"
          description="Show typing activity before AI sends a reply."
          checked={state.policy.typing_indicator_enabled}
          onChange={(value) => updatePolicy({ typing_indicator_enabled: value })}
        />

        <SettingRow
          title="Mark messages as seen"
          description="Mark customer messages as seen after they are processed."
          checked={state.policy.mark_seen_enabled}
          onChange={(value) => updatePolicy({ mark_seen_enabled: value })}
        />

        <SectionTitle
          icon={Clock3}
          title="Operations"
          description="Controls that affect records, publishing, and operating hours."
        />

        <SettingRow
          title="Create leads from conversations"
          description="Create customer records when conversations contain useful lead information."
          checked={state.policy.create_lead_enabled}
          onChange={(value) => updatePolicy({ create_lead_enabled: value })}
        />

        <SettingRow
          title="Require approval for generated content"
          description="Keep generated content in review before it can be used externally."
          checked={state.policy.approval_required_content}
          onChange={(value) => updatePolicy({ approval_required_content: value })}
        />

        <SettingRow
          title="Require approval before publishing"
          description="Prevent automated publishing unless a human approves it."
          checked={state.policy.approval_required_publish}
          onChange={(value) => updatePolicy({ approval_required_publish: value })}
        />

        <QuietHours
          policy={state.policy}
          onChange={(nextPolicy) => setState((current) => ({
            ...current,
            policy: nextPolicy,
          }))}
        />
      </Card>

      <SessionPanel
        verified={verified}
        resending={resending}
        onResend={handleResend}
        loggingOut={loggingOut}
        onLogout={handleLogout}
      />

      <DangerPanel />
    </PageCanvas>
  );
}