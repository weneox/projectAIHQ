import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Lock,
  Mail,
  User2,
  Building2,
} from "lucide-react";

import { loginUser, selectWorkspaceUser, signupUser } from "../api/auth.js";
import { clearAppSessionContext, getAppAuthContext } from "../lib/appSession.js";
import {
  WORKSPACE_SELECTION_ROUTE,
  hasMultipleWorkspaceChoices,
  resolveAuthenticatedLanding,
  resolveWorkspaceContractRoute,
} from "../lib/appEntry.js";

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

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
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

function resolvePostAuthTarget({ auth = {}, payload = {} } = {}) {
  return resolveAuthenticatedLanding({
    auth,
    bootstrap: payload,
  });
}

function InputResetStyles() {
  return (
    <style>{`
      .auth-clean-input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        min-width: 0;
        margin: 0;
        border: 0 !important;
        outline: none !important;
        border-radius: 0 !important;
        background: transparent !important;
        background-color: transparent !important;
        box-shadow: none !important;
        -webkit-box-shadow: none !important;
        appearance: none;
        -webkit-appearance: none;
        font: inherit;
      }

      .auth-clean-input::-ms-reveal,
      .auth-clean-input::-ms-clear {
        display: none;
      }

      .auth-clean-input:-webkit-autofill,
      .auth-clean-input:-webkit-autofill:hover,
      .auth-clean-input:-webkit-autofill:focus,
      .auth-clean-input:-webkit-autofill:active {
        -webkit-text-fill-color: #0f172a !important;
        caret-color: #0f172a !important;
        background: transparent !important;
        background-color: transparent !important;
        transition: background-color 999999s ease-in-out 0s;
      }
    `}</style>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.805 12.23c0-.72-.064-1.412-.184-2.077H12v3.932h5.498a4.704 4.704 0 0 1-2.041 3.087v2.564h3.3c1.932-1.78 3.048-4.404 3.048-7.506Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.76 0 5.076-.914 6.768-2.472l-3.3-2.564c-.914.612-2.083.973-3.468.973-2.664 0-4.922-1.798-5.728-4.215H2.86v2.645A10.22 10.22 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.272 13.722A6.142 6.142 0 0 1 5.952 12c0-.598.108-1.177.32-1.722V7.633H2.86A10.22 10.22 0 0 0 1.777 12c0 1.648.395 3.208 1.083 4.367l3.412-2.645Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.064c1.5 0 2.848.516 3.909 1.53l2.932-2.932C17.072 3.014 14.756 2 12 2 7.86 2 4.293 4.379 2.86 7.633l3.412 2.645C7.078 7.862 9.336 6.064 12 6.064Z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        fill="currentColor"
        d="M15.1 3.5c.77-.94 1.3-2.22 1.16-3.5-1.12.05-2.47.74-3.28 1.68-.74.85-1.38 2.14-1.2 3.4 1.25.1 2.53-.64 3.32-1.58Zm3.86 12.81c-.03-2.64 2.16-3.9 2.26-3.96-1.24-1.8-3.15-2.05-3.82-2.08-1.63-.17-3.18.96-4.01.96-.85 0-2.14-.94-3.52-.91-1.82.03-3.49 1.05-4.43 2.68-1.9 3.29-.48 8.15 1.35 10.8.9 1.28 1.95 2.71 3.35 2.66 1.35-.06 1.86-.86 3.49-.86 1.62 0 2.08.86 3.52.83 1.46-.02 2.37-1.31 3.26-2.6 1.03-1.47 1.45-2.9 1.48-2.98-.04-.01-2.84-1.09-2.93-4.54Z"
      />
    </svg>
  );
}

function TopBar() {
  return (
    <div className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10 lg:px-14">
      <button
        type="button"
        className="text-left"
      >
        <div className="bg-[linear-gradient(135deg,#0f172a_0%,#344256_45%,#94a3b8_100%)] bg-clip-text text-[31px] font-semibold tracking-[-0.07em] text-transparent sm:text-[34px]">
          NEOX <span className="font-medium opacity-75">AI Studio</span>
        </div>
      </button>

      <button
        type="button"
        className="inline-flex h-[44px] items-center gap-2 rounded-full border border-slate-200/90 bg-white/78 px-4 text-[14px] font-medium text-slate-700 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur-md transition hover:border-slate-300 hover:bg-white"
      >
        <Globe className="h-4 w-4 text-slate-500" />
        <span>English</span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
    </div>
  );
}

function AuthField({
  icon: Icon,
  type = "text",
  name,
  value,
  placeholder,
  onChange,
  onFocus,
  onBlur,
  autoComplete,
  focused = false,
  rightSlot = null,
}) {
  return (
    <div
      className={cn(
        "relative h-[72px] overflow-hidden rounded-[22px] border bg-white/78 shadow-[0_12px_38px_rgba(15,23,42,0.045)] backdrop-blur-md transition-all duration-200",
        focused
          ? "border-slate-300 bg-white shadow-[0_18px_46px_rgba(15,23,42,0.08)]"
          : "border-slate-200/80 hover:border-slate-300/80 hover:bg-white"
      )}
    >
      <span className="pointer-events-none absolute left-6 top-1/2 z-10 -translate-y-1/2 text-slate-400">
        <Icon className="h-[18px] w-[18px]" />
      </span>

      <input
        type={type}
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        autoComplete={autoComplete}
        className={cn(
          "auth-clean-input text-[18px] font-medium tracking-[-0.03em] text-slate-900 placeholder:font-normal placeholder:text-slate-400",
          rightSlot ? "pl-[62px] pr-[62px]" : "pl-[62px] pr-6"
        )}
      />

      {rightSlot ? (
        <div className="absolute right-6 top-1/2 z-10 -translate-y-1/2">
          {rightSlot}
        </div>
      ) : null}
    </div>
  );
}

function PasswordHint({ password = "" }) {
  const length = String(password || "").length;
  const progress = Math.min(length, 8);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2.5">
        {Array.from({ length: 4 }).map((_, index) => {
          const threshold = (index + 1) * 2;
          const filled = progress >= threshold;
          return (
            <div
              key={index}
              className={cn(
                "h-[4px] rounded-full transition duration-200",
                filled
                  ? "bg-[linear-gradient(90deg,#0f172a_0%,#475569_100%)]"
                  : "bg-slate-200"
              )}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[12px] font-medium tracking-[-0.01em] text-slate-500">
        <span>At least 8 symbols, one uppercase letter and one digit</span>
        <span>{Math.min(length, 8)}/8</span>
      </div>
    </div>
  );
}

function InlineError({ message }) {
  if (!message) return null;

  return (
    <div className="rounded-[18px] border border-rose-200/80 bg-rose-50/90 px-4 py-3 text-[13px] font-medium leading-6 text-rose-700">
      {message}
    </div>
  );
}

function WorkspaceChoiceCard({ account, selected, onSelect }) {
  const token = s(account?.selectionToken);

  return (
    <button
      type="button"
      onClick={() => onSelect(token)}
      className={cn(
        "flex w-full items-center justify-between rounded-[20px] border px-4 py-4 text-left shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition",
        selected
          ? "border-slate-300 bg-slate-50"
          : "border-slate-200/80 bg-white/80 hover:border-slate-300 hover:bg-white"
      )}
    >
      <div className="min-w-0">
        <div className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">
          {s(account?.companyName) || s(account?.tenantKey) || "Workspace"}
        </div>
        <div className="mt-1 text-[13px] font-medium text-slate-500">
          {s(account?.tenantKey)} · {s(account?.role || "member")}
        </div>
      </div>

      <div
        className={cn(
          "relative h-[18px] w-[18px] rounded-full border transition",
          selected
            ? "border-slate-900 bg-slate-900"
            : "border-slate-300 bg-white"
        )}
      >
        {selected ? <div className="absolute inset-[4px] rounded-full bg-white" /> : null}
      </div>
    </button>
  );
}

function SocialButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[56px] w-full items-center justify-center gap-3 rounded-[18px] border border-slate-200/85 bg-white/78 px-4 text-[15px] font-medium tracking-[-0.01em] text-slate-800 shadow-[0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-md transition duration-200 hover:border-slate-300 hover:bg-white"
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function Divider() {
  return (
    <div className="relative flex items-center py-1">
      <div className="h-px flex-1 bg-slate-200" />
      <span className="px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        Or
      </span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function BackgroundGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-[-8%] top-[-10%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.08),rgba(15,23,42,0)_68%)] blur-3xl" />
      <div className="absolute right-[-6%] top-[12%] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.07),rgba(59,130,246,0)_70%)] blur-3xl" />
      <div className="absolute bottom-[-16%] left-1/2 h-[320px] w-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.10),rgba(148,163,184,0)_70%)] blur-3xl" />
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
  const [focusedField, setFocusedField] = useState("");
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

  function handleUnavailableProvider(provider) {
    setError(`${provider} sign in is not enabled yet.`);
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

    const response = usingInlineWorkspaceSelection
      ? await selectWorkspaceUser({
          email,
          password,
          tenantKey: activeTenantKey || undefined,
          accountSelectionToken: selectedAccountToken || undefined,
        })
      : await loginUser({
          email,
          password,
          tenantKey: activeTenantKey || undefined,
          accountSelectionToken: undefined,
        });

    clearAppSessionContext();

    if (usingInlineWorkspaceSelection) {
      navigate(resolveWorkspaceContractRoute(response), { replace: true });
      return;
    }

    let auth = null;

    try {
      auth = await getAppAuthContext({ force: true });

      if (hasMultipleWorkspaceChoices(auth)) {
        navigate(WORKSPACE_SELECTION_ROUTE, { replace: true });
        return;
      }
    } catch {}

    navigate(
      resolvePostAuthTarget({
        auth,
        payload: response,
      }),
      { replace: true }
    );
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
        postVerifyPath: "/setup/studio",
      },
    });
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (loading) return;

    try {
      setLoading(true);
      setError("");

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

  const isLoginDisabled = loading || !s(form.email) || !s(form.password);
  const isSignupDisabled =
    loading ||
    !s(form.companyName) ||
    !s(form.email) ||
    !s(form.password);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F7F8FA] text-slate-950">
      <InputResetStyles />
      <BackgroundGlow />
      <TopBar />

      <main className="relative z-10 mx-auto flex w-full max-w-[760px] justify-center px-6 pb-16 pt-4 sm:px-8 lg:px-10">
        <div className="w-full max-w-[620px]">
          <div className="pt-4 text-center">
            <h1 className="text-[56px] font-semibold leading-[0.94] tracking-[-0.08em] text-slate-950 sm:text-[68px]">
              {isSignupMode ? "Create account" : "Log in"}
            </h1>
          </div>

          <div className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SocialButton
              icon={<GoogleMark />}
              label="Continue with Google"
              onClick={() => handleUnavailableProvider("Google")}
            />
            <SocialButton
              icon={<AppleMark />}
              label="Continue with Apple"
              onClick={() => handleUnavailableProvider("Apple")}
            />
          </div>

          <div className="mt-6">
            <Divider />
          </div>

          <form className="mt-6 space-y-5" onSubmit={onSubmit}>
            {isSignupMode ? (
              <>
                <AuthField
                  icon={User2}
                  name="fullName"
                  value={form.fullName}
                  placeholder="Full name"
                  onChange={onChange}
                  onFocus={() => setFocusedField("fullName")}
                  onBlur={() => setFocusedField("")}
                  autoComplete="name"
                  focused={focusedField === "fullName"}
                />

                <AuthField
                  icon={Building2}
                  name="companyName"
                  value={form.companyName}
                  placeholder="Business name"
                  onChange={onChange}
                  onFocus={() => setFocusedField("companyName")}
                  onBlur={() => setFocusedField("")}
                  autoComplete="organization"
                  focused={focusedField === "companyName"}
                />
              </>
            ) : null}

            <AuthField
              icon={Mail}
              name="email"
              type="email"
              value={form.email}
              placeholder="Email address"
              onChange={onChange}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField("")}
              autoComplete="email"
              focused={focusedField === "email"}
            />

            <AuthField
              icon={Lock}
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              placeholder="Password"
              onChange={onChange}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField("")}
              autoComplete={isSignupMode ? "new-password" : "current-password"}
              focused={focusedField === "password"}
              rightSlot={
                <button
                  type="button"
                  className="text-slate-400 transition hover:text-slate-700"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
                  )}
                </button>
              }
            />

            {isSignupMode ? (
              <PasswordHint password={form.password} />
            ) : (
              <div className="flex justify-start">
                <button
                  type="button"
                  className="text-[14px] font-semibold tracking-[-0.02em] text-slate-500 transition hover:text-slate-900"
                  onClick={() =>
                    setError("Password recovery is not enabled yet.")
                  }
                >
                  Forgot your password?
                </button>
              </div>
            )}

            <InlineError message={error} />

            {accountChoices.length ? (
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
            ) : null}

            <button
              type="submit"
              disabled={isSignupMode ? isSignupDisabled : isLoginDisabled}
              className={cn(
                "mt-1 inline-flex h-[72px] w-full items-center justify-center rounded-[24px] px-6 text-[18px] font-semibold tracking-[-0.03em] transition duration-200",
                (isSignupMode ? isSignupDisabled : isLoginDisabled)
                  ? "bg-slate-200 text-slate-400"
                  : "bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#334155_100%)] text-white shadow-[0_20px_44px_rgba(15,23,42,0.22)] hover:translate-y-[-1px] hover:shadow-[0_26px_58px_rgba(15,23,42,0.26)]"
              )}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {isSignupMode ? "Creating account..." : "Logging in..."}
                </span>
              ) : isSignupMode ? (
                "Create account"
              ) : accountChoices.length ? (
                "Open selected workspace"
              ) : (
                "Log in"
              )}
            </button>

            <div className="pt-2 text-center text-[15px] font-medium tracking-[-0.01em] text-slate-500">
              {isSignupMode ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                className="font-semibold text-slate-900 transition hover:text-slate-600"
                onClick={() => navigate(isSignupMode ? "/login" : "/signup")}
              >
                {isSignupMode ? "Log in" : "Sign up"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}