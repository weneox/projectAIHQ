import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
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

function AuthAutofillReset() {
  return (
    <style>{`
      .auth-page input,
      .auth-page input:hover,
      .auth-page input:focus,
      .auth-page input:active {
        background: #ffffff !important;
        background-color: #ffffff !important;
        box-shadow: none !important;
        outline: none !important;
      }

      .auth-page input:-webkit-autofill,
      .auth-page input:-webkit-autofill:hover,
      .auth-page input:-webkit-autofill:focus,
      .auth-page input:-webkit-autofill:active {
        -webkit-text-fill-color: #0f172a !important;
        caret-color: #0f172a !important;
        -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
        box-shadow: 0 0 0 1000px #ffffff inset !important;
        background-color: #ffffff !important;
        background-image: none !important;
        background-clip: border-box !important;
        transition: background-color 999999s ease-in-out 0s !important;
      }

      .auth-page input::selection {
        background: rgba(15, 23, 42, 0.08);
        color: #0f172a;
      }

      .auth-page input::-ms-reveal,
      .auth-page input::-ms-clear {
        display: none;
      }
    `}</style>
  );
}

function AuthField({
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  leftIcon,
  right = null,
}) {
  return (
    <div className="group relative flex h-[58px] items-center rounded-[17px] bg-white p-[1.5px] shadow-[0_18px_46px_-40px_rgba(15,23,42,0.48)] transition-[box-shadow,transform] duration-200 ease-out focus-within:shadow-[0_0_0_4px_rgba(46,96,255,0.08),0_22px_52px_-42px_rgba(46,96,255,0.48)]">
      <div className="absolute inset-0 rounded-[17px] bg-[#D4DBE7] transition-colors duration-200 ease-out group-hover:bg-[#C7D0DE] group-focus-within:bg-[#8EAAFF]" />

      <div className="relative z-10 flex h-full w-full items-center rounded-[15.5px] bg-white px-4">
        <div className="mr-3 flex h-5 w-5 shrink-0 items-center justify-center text-[#66758B] transition-colors duration-200 group-focus-within:text-[#2E60FF]">
          {leftIcon}
        </div>

        <input
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          spellCheck={false}
          className="h-full min-w-0 flex-1 appearance-none border-0 bg-white text-[15.5px] font-medium tracking-[-0.015em] text-[#0F172A] outline-none placeholder:text-[15.5px] placeholder:font-medium placeholder:text-[#778397] focus:border-0 focus:bg-white focus:outline-none focus:ring-0"
        />

        {right ? <div className="ml-2 shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}

function AuthSubmitButton({ disabled, loading, children, loadingLabel }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={cx(
        "mt-1 flex h-[56px] w-full items-center justify-center gap-2 rounded-[16px] text-[15.5px] font-semibold tracking-[-0.018em] text-white transition-[background-color,box-shadow,opacity] duration-200 ease-out",
        disabled
          ? "cursor-not-allowed bg-[#A7BBFF] shadow-none"
          : "bg-[#2E60FF] shadow-[0_18px_38px_-26px_rgba(46,96,255,0.92)] hover:bg-[#2456F2] hover:shadow-[0_20px_44px_-28px_rgba(46,96,255,1)] active:bg-[#214FE2]"
      )}
    >
      <span className="pointer-events-none select-none leading-none">
        {loading ? loadingLabel : children}
      </span>
      {!loading ? (
        <ArrowRight className="pointer-events-none h-4 w-4 shrink-0" />
      ) : null}
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
        "flex w-full items-center justify-between rounded-[15px] border px-4 py-3.5 text-left transition-[background-color,border-color] duration-200 ease-out",
        selected
          ? "border-[#B8C8FF] bg-[#F7F9FF]"
          : "border-[#E0E5EE] bg-white hover:border-[#C7D0DE]"
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[#0F172A]">
          {companyName}
        </div>
        <div className="mt-1 text-[13px] font-medium text-[#66758B]">
          {s(account?.tenantKey)} · {role}
        </div>
      </div>

      <span
        className={cx(
          "relative h-[18px] w-[18px] rounded-full border transition-colors",
          selected ? "border-[#2E60FF] bg-[#2E60FF]" : "border-[#B4BECE] bg-white"
        )}
      >
        {selected ? (
          <span className="absolute inset-[4px] rounded-full bg-white" />
        ) : null}
      </span>
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
    <div className="auth-page min-h-screen bg-white text-[#0F172A]">
      <AuthAutofillReset />

      <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center px-6 py-10">
        <section className="w-full">
          <h1 className="text-center text-[46px] font-semibold leading-[0.95] tracking-[-0.075em] text-[#0B1220] md:text-[54px]">
            {isSignupMode ? "Create workspace" : "Sign in"}
          </h1>

          <form className="mt-10 space-y-4" onSubmit={onSubmit}>
            {isSignupMode ? (
              <>
                <AuthField
                  name="fullName"
                  value={form.fullName}
                  onChange={onChange}
                  placeholder="Full name"
                  autoComplete="off"
                  leftIcon={<User2 className="h-4 w-4" strokeWidth={2} />}
                />

                <AuthField
                  name="companyName"
                  value={form.companyName}
                  onChange={onChange}
                  placeholder="Workspace name"
                  autoComplete="off"
                  leftIcon={<Building2 className="h-4 w-4" strokeWidth={2} />}
                />
              </>
            ) : null}

            <AuthField
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder="Email address"
              autoComplete="off"
              leftIcon={<Mail className="h-4 w-4" strokeWidth={2} />}
            />

            <AuthField
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={onChange}
              placeholder="Password"
              autoComplete="off"
              leftIcon={<Lock className="h-4 w-4" strokeWidth={2} />}
              right={
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-[#66758B] transition-colors hover:bg-[#F5F7FA] hover:text-[#0F172A]"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" strokeWidth={2} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={2} />
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
              <div className="space-y-3 rounded-[16px] border border-[#E0E5EE] bg-white p-4">
                <div>
                  <div className="text-[14px] font-semibold tracking-[-0.02em] text-[#0F172A]">
                    Choose workspace
                  </div>
                  <div className="mt-1 text-[13px] font-medium leading-5 text-[#66758B]">
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

            <AuthSubmitButton
              disabled={isSignupMode ? isSignupDisabled : isLoginDisabled}
              loading={loading}
              loadingLabel={
                isSignupMode ? "Creating workspace..." : "Signing in..."
              }
            >
              {isSignupMode
                ? "Create workspace"
                : accountChoices.length
                  ? "Open selected workspace"
                  : "Sign in"}
            </AuthSubmitButton>

            <div className="pt-2 text-center text-[16px] font-medium tracking-[-0.018em] text-[#5F6D82]">
              {isSignupMode ? "Already have an account?" : "New workspace?"}{" "}
              <button
                type="button"
                className="font-semibold text-[#0F172A] underline underline-offset-[3px] transition-colors hover:text-[#2E60FF]"
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
