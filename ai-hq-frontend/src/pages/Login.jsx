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
      setError("Enter your workspace name, email, and password.");
      return;
    }

    await signupUser(payload);
    clearAppSessionContext();

    navigate("/verify-email", {
      replace: true,
      state: { email: payload.email },
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
            isSignupMode ? "Unable to create your workspace." : "Sign in failed."
          )
        );
      }
    } finally {
      setLoading(false);
    }
  }

  const isLoginDisabled = loading || !s(form.email) || !s(form.password);
  const isSignupDisabled =
    loading || !s(form.companyName) || !s(form.email) || !s(form.password);

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

            {error ? (
              <InlineNotice
                tone="danger"
                title="Authentication issue"
                description={error}
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