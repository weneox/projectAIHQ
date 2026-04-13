import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User2,
} from "lucide-react";

import { loginUser, selectWorkspaceUser, signupUser } from "../api/auth.js";
import { clearAppSessionContext } from "../lib/appSession.js";
import { cx } from "../lib/cx.js";

import GmailIconAsset from "../assets/channels/gmail.svg";
import AppleIconAsset from "../assets/channels/apple.svg";

import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
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

function OutlookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#0A64D0"
        d="M3 5.25A2.25 2.25 0 0 1 5.25 3h7.5A2.25 2.25 0 0 1 15 5.25v13.5A2.25 2.25 0 0 1 12.75 21h-7.5A2.25 2.25 0 0 1 3 18.75V5.25Z"
      />
      <path
        fill="#1274E7"
        d="M14.25 7H20a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-5.75V7Z"
      />
      <path fill="#1490FF" d="M14.25 8.2 20.7 12l-6.45 3.8V8.2Z" />
      <path
        fill="#fff"
        d="M8.88 8.22c2.24 0 3.87 1.54 3.87 3.79 0 2.31-1.57 3.77-3.89 3.77-2.23 0-3.82-1.5-3.82-3.75 0-2.33 1.62-3.81 3.84-3.81Zm.02 1.54c-1.14 0-1.9.88-1.9 2.28 0 1.39.77 2.27 1.9 2.27 1.15 0 1.91-.88 1.91-2.29 0-1.37-.79-2.26-1.91-2.26Z"
      />
    </svg>
  );
}

function SocialButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-soft border border-line bg-surface px-4 text-[13px] font-semibold tracking-[-0.01em] text-text",
        "transition-[background-color,border-color,color,box-shadow,transform] duration-base ease-premium",
        "shadow-[0_1px_0_rgba(255,255,255,0.92)_inset]",
        "hover:border-line-strong hover:bg-surface-muted"
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function WorkspaceChoiceCard({ account, selected, onSelect }) {
  const token = s(account?.selectionToken);
  const companyName =
    s(account?.companyName) || s(account?.tenantKey) || "Workspace";
  const role = s(account?.role || "member");

  return (
    <button
      type="button"
      onClick={() => onSelect(token)}
      className={cx(
        "flex w-full items-center justify-between rounded-panel border px-4 py-3.5 text-left transition-[background-color,border-color,box-shadow] duration-base ease-premium",
        selected
          ? "border-[rgba(var(--color-brand),0.22)] bg-brand-soft shadow-panel"
          : "border-line-soft bg-surface hover:border-line hover:bg-surface-muted"
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-text">
          {companyName}
        </div>
        <div className="mt-1 text-[12px] text-text-muted">
          {s(account?.tenantKey)} · {role}
        </div>
      </div>

      <span
        className={cx(
          "relative h-[18px] w-[18px] rounded-full border transition-colors",
          selected
            ? "border-brand bg-brand"
            : "border-line-strong bg-surface"
        )}
      >
        {selected ? (
          <span className="absolute inset-[4px] rounded-full bg-white" />
        ) : null}
      </span>
    </button>
  );
}

function LegalFooter() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-2 text-[12px] text-text-subtle">
      <Link
        to="/privacy"
        className="font-medium transition-colors hover:text-text"
      >
        Privacy
      </Link>
      <Link
        to="/terms"
        className="font-medium transition-colors hover:text-text"
      >
        Terms
      </Link>
      <Link
        to="/contact"
        className="font-medium transition-colors hover:text-text"
      >
        Contact
      </Link>
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
  const [error, setError] = useState("");
  const [accountChoices, setAccountChoices] = useState([]);
  const [selectedAccountToken, setSelectedAccountToken] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    companyName: "",
    email: "",
    password: "",
  });

  function onChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    if (error) setError("");

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
      setError("Enter your email and password.");
      return;
    }

    if (usingInlineWorkspaceSelection && !selectedAccountToken) {
      setError("Select the correct workspace to continue.");
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
    navigate("/", { replace: true });
  }

  async function handleSignup() {
    const payload = {
      fullName: s(form.fullName),
      companyName: s(form.companyName),
      email: s(form.email),
      password: String(form.password || ""),
    };

    if (!payload.companyName || !payload.email || !payload.password) {
      setError("Enter your business name, email, and password.");
      return;
    }

    await signupUser(payload);
    clearAppSessionContext();

    navigate("/verify-email", {
      replace: true,
      state: {
        email: payload.email,
      },
    });
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (loading) return;

    try {
      setError("");
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
        setError("Select your workspace to continue.");
      } else {
        setError(
          getFriendlyError(
            submitError,
            isSignupMode ? "Unable to create your account." : "Sign in failed."
          )
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function onSocialAuth(provider) {
    setError(`${provider} sign-in is not enabled yet.`);
  }

  const isLoginDisabled = loading || !s(form.email) || !s(form.password);
  const isSignupDisabled =
    loading || !s(form.companyName) || !s(form.email) || !s(form.password);

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas text-text">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8%] top-[-12%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(46,96,255,0.14)_0%,rgba(46,96,255,0.04)_48%,rgba(46,96,255,0)_72%)] blur-3xl" />
        <div className="absolute right-[-10%] top-[10%] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.02)_50%,rgba(15,23,42,0)_74%)] blur-3xl" />
        <div className="absolute bottom-[-14%] left-[24%] h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle,rgba(21,128,61,0.06)_0%,rgba(21,128,61,0.02)_54%,rgba(21,128,61,0)_76%)] blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center px-6 py-10">
        <div>
          <h1 className="text-[2.65rem] font-semibold leading-[0.92] tracking-[-0.065em] text-text md:text-[3rem]">
            {isSignupMode ? "Create workspace" : "Sign in"}
          </h1>

          <p className="mt-3 text-[15px] leading-7 text-text-muted">
            {isSignupMode
              ? "Use your business details to open a new workspace."
              : activeTenantKey
                ? `Use your ${activeTenantKey} workspace email and password.`
                : "Use your workspace email and password."}
          </p>
        </div>

        <div className="mt-8">
          {!isSignupMode ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <SocialButton
                  icon={<img src={GmailIconAsset} alt="" className="h-5 w-5" />}
                  label="Gmail"
                  onClick={() => onSocialAuth("Gmail")}
                />

                <SocialButton
                  icon={<OutlookIcon />}
                  label="Outlook"
                  onClick={() => onSocialAuth("Outlook")}
                />

                <SocialButton
                  icon={<img src={AppleIconAsset} alt="" className="h-5 w-5" />}
                  label="Apple"
                  onClick={() => onSocialAuth("Apple")}
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-line-soft" />
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-subtle">
                  Or continue with email
                </div>
                <div className="h-px flex-1 bg-line-soft" />
              </div>
            </div>
          ) : null}

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            {isSignupMode ? (
              <>
                <Input
                  name="fullName"
                  value={form.fullName}
                  onChange={onChange}
                  placeholder="Full name"
                  autoComplete="name"
                  leftIcon={<User2 className="h-4 w-4" />}
                  appearance="product"
                />

                <Input
                  name="companyName"
                  value={form.companyName}
                  onChange={onChange}
                  placeholder="Workspace name"
                  autoComplete="organization"
                  leftIcon={<Building2 className="h-4 w-4" />}
                  appearance="product"
                />
              </>
            ) : null}

            <Input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder="Email address"
              autoComplete="email"
              leftIcon={<Mail className="h-4 w-4" />}
              appearance="product"
            />

            <Input
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={onChange}
              placeholder="Password"
              autoComplete={isSignupMode ? "new-password" : "current-password"}
              leftIcon={<Lock className="h-4 w-4" />}
              appearance="product"
              right={
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-soft text-text-subtle transition-colors hover:bg-surface-subtle hover:text-text"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              }
            />

            {!isSignupMode ? (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  className="text-[13px] font-medium tracking-[-0.01em] text-text-muted transition-colors hover:text-text"
                  onClick={() =>
                    setError("Password recovery is not enabled yet.")
                  }
                >
                  Forgot your password?
                </button>
              </div>
            ) : null}

            {error ? (
              <InlineNotice
                tone="danger"
                title="Authentication issue"
                description={error}
                compact
              />
            ) : null}

            {accountChoices.length ? (
              <div className="space-y-3 rounded-panel border border-line-soft bg-surface/74 p-4 backdrop-blur">
                <div>
                  <div className="text-[14px] font-semibold tracking-[-0.02em] text-text">
                    Choose workspace
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-text-muted">
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
              </div>
            ) : null}

            <Button
              type="submit"
              size="lg"
              fullWidth
              disabled={isSignupMode ? isSignupDisabled : isLoginDisabled}
              rightIcon={
                loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )
              }
              className="h-12 text-[14px]"
            >
              {loading
                ? isSignupMode
                  ? "Creating workspace..."
                  : "Signing in..."
                : isSignupMode
                  ? "Create workspace"
                  : accountChoices.length
                    ? "Open selected workspace"
                    : "Sign in"}
            </Button>

            <div className="pt-1 text-center text-[14px] text-text-muted">
              {isSignupMode
                ? "Already have an account?"
                : "Don’t have an account?"}{" "}
              <button
                type="button"
                className="font-semibold text-text underline underline-offset-2 transition-colors hover:text-brand"
                onClick={() => navigate(isSignupMode ? "/login" : "/signup")}
              >
                {isSignupMode ? "Sign in" : "Create one"}
              </button>
            </div>

            <LegalFooter />
          </form>
        </div>
      </main>
    </div>
  );
}