import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User2,
} from "lucide-react";
import { getPasswordRuleResults } from "@aihq/shared-contracts/auth";

import { loginUser, selectWorkspaceUser, signupUser } from "../api/auth.js";
import {
  clearAppSessionContext,
  getAppSessionContext,
} from "../lib/appSession.js";
import { cx } from "../lib/cx.js";
import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import Card from "../components/ui/Card.jsx";
import { InlineNotice } from "../components/ui/AppShellPrimitives.jsx";

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "hq",
  "mail",
  "docs",
  "status",
  "admin",
  "app",
  "cdn",
  "assets",
  "blog",
  "help",
  "support",
  "auth",
  "m",
  "dev",
  "staging",
  "demo",
]);

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function getTenantKeyFromHost() {
  if (typeof window === "undefined") return "";

  const host = s(window.location.hostname).toLowerCase();
  if (!host) return "";

  if (host === "localhost" || host === "127.0.0.1") {
    const url = new URL(window.location.href);
    return s(
      url.searchParams.get("tenant") ||
        url.searchParams.get("tenantKey") ||
        url.searchParams.get("workspace")
    ).toLowerCase();
  }

  if (host === "weneox.com" || host === "hq.weneox.com") return "";

  if (host.endsWith(".weneox.com")) {
    const sub = host.slice(0, -".weneox.com".length).trim().toLowerCase();
    if (!sub || RESERVED_SUBDOMAINS.has(sub)) return "";
    return sub;
  }

  return "";
}

function normalizeTenantKey(value) {
  return s(value).toLowerCase().replace(/\s+/g, "-");
}

function isServiceUnavailableError(error) {
  const message = s(error?.message).toLowerCase();

  return (
    message.includes("failed to fetch") ||
    message.includes("load failed") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("auth check failed") ||
    message.includes("vite_api_base is not set") ||
    message.includes("request timeout")
  );
}

function getFriendlyError(error, fallback = "Unable to continue.") {
  if (isServiceUnavailableError(error)) {
    return "Authentication is temporarily unavailable. Try again shortly.";
  }

  return s(
    error?.payload?.error ||
      error?.payload?.message ||
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.message ||
      fallback,
    fallback
  );
}

function formatRetryDelay(retryAfterSeconds) {
  const seconds = Math.max(1, Number(retryAfterSeconds || 0));
  if (!Number.isFinite(seconds) || seconds <= 0) return "";

  if (seconds < 60) {
    return `Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`;
  }

  const minutes = Math.ceil(seconds / 60);
  return `Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

const PASSWORD_FAILURE_COPY = {
  minimum_length: "at least 8 characters",
  letter_required: "a letter",
  number_required: "a number",
  must_not_equal_email: "not your email address",
  common_pattern: "not an obvious weak pattern",
};

function getSignupPasswordError(error) {
  const code = s(error?.code || error?.payload?.code).toLowerCase();
  if (code !== "weak_password") return "";

  const failures = Array.isArray(error?.payload?.failures)
    ? error.payload.failures
    : [];
  const missing = failures
    .map((failure) => PASSWORD_FAILURE_COPY[failure])
    .filter(Boolean);

  if (!missing.length) {
    return "Password does not meet the workspace security requirements.";
  }

  return `Password still needs ${missing.join(", ")}.`;
}

function getAuthErrorPresentation(error, { isSignupMode = false } = {}) {
  const code = s(
    error?.code || error?.payload?.code || error?.response?.data?.code
  ).toLowerCase();
  const retryCopy = formatRetryDelay(
    error?.payload?.retryAfterSeconds ??
      error?.response?.data?.retryAfterSeconds
  );

  if (isSignupMode) {
    const passwordError = getSignupPasswordError(error);
    if (passwordError) {
      return {
        title: "Choose a stronger password",
        description: passwordError,
      };
    }
  }

  if (code === "signup_rate_limited" || code === "login_rate_limited") {
    return {
      title: "Too many attempts",
      description: retryCopy || "Try again in a few minutes.",
    };
  }

  if (isServiceUnavailableError(error) || code === "auth_temporarily_unavailable") {
    return {
      title: "Temporary issue",
      description: "Authentication is temporarily unavailable. Try again shortly.",
    };
  }

  return {
    title: isSignupMode ? "Unable to create workspace" : "Sign in failed",
    description: getFriendlyError(
      error,
      isSignupMode ? "Unable to create your workspace." : "Sign in failed."
    ),
  };
}

function isMultipleAccountsError(error) {
  const code = s(
    error?.code || error?.payload?.code || error?.response?.data?.code
  ).toLowerCase();

  return code === "multiple_accounts" || code === "multiple_memberships";
}

function normalizeAccountChoices(error) {
  const accounts =
    error?.payload?.memberships ||
    error?.payload?.accounts ||
    error?.response?.data?.memberships ||
    error?.response?.data?.accounts ||
    [];

  return Array.isArray(accounts) ? accounts : [];
}

function SelectionMark({ selected = false }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[7px] border",
        "transition-[background-color,border-color,color] duration-base ease-premium",
        selected
          ? "border-brand bg-brand text-white"
          : "border-line bg-surface text-transparent"
      )}
    >
      <Check
        className={cx(
          "h-[12px] w-[12px] transition-opacity duration-base ease-premium",
          selected ? "opacity-100" : "opacity-0"
        )}
        strokeWidth={3}
      />
    </span>
  );
}

function WorkspaceChoiceCard({ account, selected, onSelect }) {
  const token = s(account?.selectionToken);
  const companyName =
    s(account?.companyName) || s(account?.tenantKey) || "Workspace";
  const role = s(account?.role || "member");
  const tenantKey = s(account?.tenantKey);

  return (
    <button
      type="button"
      onClick={() => onSelect(token)}
      className="block w-full text-left"
    >
      <Card
        padded="sm"
        interactive
        tone={selected ? "brand" : "neutral"}
        className={cx(selected && "bg-brand-soft/55")}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              {companyName}
            </div>

            <div className="mt-1 truncate text-[13px] font-medium leading-5 text-text-muted">
              {tenantKey ? `${tenantKey} · ${role}` : role}
            </div>
          </div>

          <SelectionMark selected={selected} />
        </div>
      </Card>
    </button>
  );
}

function PasswordStrengthPanel({ assessment }) {
  const strengthTone =
    assessment.strengthLevel >= 4
      ? "bg-[rgb(var(--color-success))]"
      : assessment.strengthLevel === 3
        ? "bg-[rgba(var(--color-brand),0.72)]"
        : assessment.strengthLevel === 2
          ? "bg-[rgba(var(--color-warning),0.62)]"
          : "bg-[rgba(var(--color-danger),0.56)]";

  return (
    <div
      className="space-y-3 rounded-[var(--ui-radius-control-inner)] border border-line-soft bg-surface-muted px-4 py-3"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] font-semibold tracking-[var(--tracking-tight-sm)] text-text-muted">
          Password strength
        </div>

        <div className="text-[13px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
          {assessment.strengthLabel}
        </div>
      </div>

      <div
        className="grid grid-cols-4 gap-1"
        aria-label={`Password strength: ${assessment.strengthLabel}`}
      >
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            aria-hidden="true"
            className={cx(
              "h-1.5 rounded-[3px]",
              segment <= assessment.strengthLevel
                ? strengthTone
                : "bg-line-soft"
            )}
          />
        ))}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2" aria-label="Password requirements">
        {assessment.rules.map((rule) => (
          <li
            key={rule.id}
            className={cx(
              "flex items-start gap-2 text-[12.5px] font-medium leading-5 tracking-[var(--tracking-tight-xs)]",
              rule.passed ? "text-text-muted" : "text-text-subtle"
            )}
            aria-label={`${rule.label}: ${rule.passed ? "met" : "missing"}`}
          >
            <span
              aria-hidden="true"
              className={cx(
                "mt-[3px] inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[5px] border",
                rule.passed
                  ? "border-success/30 bg-success-soft text-success"
                  : "border-line-soft bg-surface text-text-subtle"
              )}
            >
              {rule.passed ? (
                <Check className="h-[9px] w-[9px]" strokeWidth={3} />
              ) : (
                <span className="h-[3px] w-[3px] rounded-full bg-text-subtle" />
              )}
            </span>
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const isSignupMode = location.pathname === "/signup";
  const detectedTenantKey = useMemo(() => getTenantKeyFromHost(), []);
  const activeTenantKey = useMemo(
    () => normalizeTenantKey(detectedTenantKey),
    [detectedTenantKey]
  );

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [accountChoices, setAccountChoices] = useState([]);
  const [selectedAccountToken, setSelectedAccountToken] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    companyName: "",
    email: "",
    password: "",
  });
  const passwordAssessment = useMemo(
    () =>
      getPasswordRuleResults(form.password, {
        email: form.email,
        companyName: form.companyName,
        fullName: form.fullName,
      }),
    [form.password, form.email, form.companyName, form.fullName]
  );

  function onChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    if (error) setError(null);

    if (name === "email") {
      setAccountChoices([]);
      setSelectedAccountToken("");
    }
  }

  async function handleLogin() {
    const email = s(form.email);
    const password = String(form.password || "");
    const usingInlineWorkspaceSelection = accountChoices.length > 0;

    if (!email || !password) {
      setError({
        title: "Missing details",
        description: "Enter your email and password.",
      });
      return;
    }

    if (usingInlineWorkspaceSelection && !selectedAccountToken) {
      setError({
        title: "Choose workspace",
        description: "Select the correct workspace to continue.",
      });
      return;
    }

    if (usingInlineWorkspaceSelection) {
      await selectWorkspaceUser({
        email,
        password,
        tenantKey: activeTenantKey || undefined,
        accountSelectionToken: selectedAccountToken || undefined,
      });
    } else {
      await loginUser({
        email,
        password,
        tenantKey: activeTenantKey || undefined,
        accountSelectionToken: undefined,
      });
    }

    clearAppSessionContext();

    try {
      await getAppSessionContext({ force: true });
    } catch {
      // Protected routes verify the session again if warmup fails.
    }

    navigate("/home", { replace: true });
  }

  async function handleSignup() {
    const payload = {
      fullName: s(form.fullName),
      companyName: s(form.companyName),
      email: s(form.email),
      password: String(form.password || ""),
    };

    if (!payload.companyName || !payload.email || !payload.password) {
      setError({
        title: "Missing details",
        description: "Enter your workspace name, email, and password.",
      });
      return;
    }

    if (!passwordAssessment.ok) {
      setError({
        title: "Choose a stronger password",
        description: "Choose a stronger password before creating your workspace.",
      });
      return;
    }

    await signupUser(payload);
    clearAppSessionContext();

    try {
      await getAppSessionContext({ force: true });
    } catch {
      // Protected routes verify the session again if warmup fails.
    }

    navigate("/home", { replace: true });
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (loading) return;

    try {
      setError(null);
      setLoading(true);

      if (isSignupMode) {
        await handleSignup();
      } else {
        await handleLogin();
      }
    } catch (submitError) {
      if (!isSignupMode && isMultipleAccountsError(submitError)) {
        setAccountChoices(normalizeAccountChoices(submitError));
        setSelectedAccountToken("");
        setError({
          title: "Choose workspace",
          description: "Select your workspace to continue.",
        });
      } else {
        setError(getAuthErrorPresentation(submitError, { isSignupMode }));
      }
    } finally {
      setLoading(false);
    }
  }

  const isLoginDisabled = loading || !s(form.email) || !s(form.password);
  const isSignupDisabled =
    loading ||
    !s(form.companyName) ||
    !s(form.email) ||
    !s(form.password) ||
    !passwordAssessment.ok;

  return (
    <div className="auth-page min-h-screen bg-white text-text">
      <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center px-6 py-10">
        <section className="w-full">
          <h1 className="text-center font-display text-[46px] font-semibold leading-[0.95] tracking-[var(--tracking-tight-xl)] text-text md:text-[54px]">
            {isSignupMode ? "Create workspace" : "Sign in"}
          </h1>

          <form className="mt-10 space-y-4" onSubmit={onSubmit}>
            {isSignupMode ? (
              <>
                <Input
                  name="fullName"
                  value={form.fullName}
                  onChange={onChange}
                  placeholder="Full name"
                  autoComplete="off"
                  appearance="large"
                  leftIcon={<User2 className="h-4 w-4" strokeWidth={2.1} />}
                />

                <Input
                  name="companyName"
                  value={form.companyName}
                  onChange={onChange}
                  placeholder="Workspace name"
                  autoComplete="off"
                  appearance="large"
                  leftIcon={<Building2 className="h-4 w-4" strokeWidth={2.1} />}
                />
              </>
            ) : null}

            <Input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder="Email address"
              autoComplete="off"
              appearance="large"
              leftIcon={<Mail className="h-4 w-4" strokeWidth={2.1} />}
            />

            <Input
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={onChange}
              placeholder="Password"
              autoComplete="off"
              appearance="large"
              leftIcon={<Lock className="h-4 w-4" strokeWidth={2.1} />}
              right={
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-text-subtle transition-colors duration-base ease-premium hover:bg-surface-subtle hover:text-text"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" strokeWidth={2.1} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={2.1} />
                  )}
                </button>
              }
            />

            {isSignupMode ? (
              <PasswordStrengthPanel assessment={passwordAssessment} />
            ) : null}

            {error ? (
              <InlineNotice
                tone="danger"
                title={error.title}
                description={error.description}
                compact
              />
            ) : null}

            {accountChoices.length ? (
              <Card padded="sm" className="space-y-3">
                <div>
                  <div className="text-[14px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                    Choose workspace
                  </div>

                  <div className="mt-1 text-[13px] font-medium leading-5 text-text-muted">
                    We found more than one workspace for this email.
                  </div>
                </div>

                <div className="space-y-3">
                  {accountChoices.map((account) => (
                    <WorkspaceChoiceCard
                      key={
                        s(account?.selectionToken) ||
                        `${account?.tenantKey}-${account?.role}`
                      }
                      account={account}
                      selected={s(account?.selectionToken) === selectedAccountToken}
                      onSelect={setSelectedAccountToken}
                    />
                  ))}
                </div>
              </Card>
            ) : null}

            <Button
              type="submit"
              size="hero"
              fullWidth
              disabled={isSignupMode ? isSignupDisabled : isLoginDisabled}
              loading={loading}
              rightIcon={
                !loading ? <ArrowRight className="h-4 w-4" strokeWidth={2.2} /> : undefined
              }
            >
              {isSignupMode
                ? loading
                  ? "Creating workspace..."
                  : "Create workspace"
                : accountChoices.length
                  ? loading
                    ? "Opening workspace..."
                    : "Open selected workspace"
                  : loading
                    ? "Signing in..."
                    : "Sign in"}
            </Button>

            <div className="pt-2 text-center text-[16px] font-medium tracking-[var(--tracking-tight-sm)] text-text-muted">
              {isSignupMode ? "Already have an account?" : "New workspace?"}{" "}
              <button
                type="button"
                className="font-semibold text-text underline underline-offset-[3px] transition-colors duration-base ease-premium hover:text-brand"
                onClick={() => navigate(isSignupMode ? "/login" : "/signup")}
              >
                {isSignupMode ? "Sign in" : "Create one"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
