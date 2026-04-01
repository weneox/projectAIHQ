import { useEffect, useMemo, useState } from "react";
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
    message.includes("vite_api_base is not set")
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

function TopBar() {
  return (
    <div className="flex items-center justify-between px-6 py-6 sm:px-10 lg:px-14">
      <button
        type="button"
        className="text-left text-[34px] font-semibold tracking-[-0.05em] text-slate-950"
      >
        <span>NEOX</span>{" "}
        <span className="font-medium text-slate-500">AI Studio</span>
      </button>

      <button
        type="button"
        className="inline-flex h-[46px] items-center gap-2 rounded-[14px] border border-[#DADDE5] bg-white px-4 text-[15px] font-medium text-slate-700 transition hover:bg-slate-50"
      >
        <Globe className="h-4 w-4" />
        <span>English</span>
        <ChevronDown className="h-4 w-4" />
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
        "relative h-[68px] overflow-hidden rounded-[16px] border bg-white transition-all duration-200",
        focused
          ? "border-[#121826] shadow-[0_0_0_1.5px_rgba(15,23,42,0.10)]"
          : "border-[#E2E5EC] hover:border-[#D4D9E2]"
      )}
    >
      <span className="pointer-events-none absolute left-5 top-1/2 z-10 -translate-y-1/2 text-[#A0A8B8]">
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
          "auth-clean-input text-[20px] text-slate-900 placeholder:text-[#B6BCC8]",
          rightSlot ? "pl-[58px] pr-[58px]" : "pl-[58px] pr-5"
        )}
      />

      {rightSlot ? (
        <div className="absolute right-5 top-1/2 z-10 -translate-y-1/2">
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
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, index) => {
          const threshold = (index + 1) * 2;
          const filled = progress >= threshold;
          return (
            <div
              key={index}
              className={cn(
                "h-[4px] rounded-full transition",
                filled ? "bg-[#121826]" : "bg-[#E5E7EB]"
              )}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[13px] text-slate-600">
        <span>At least 8 symbols, one uppercase letter and one digit</span>
        <span>{Math.min(length, 8)}/8</span>
      </div>
    </div>
  );
}

function InlineError({ message }) {
  if (!message) return null;

  return (
    <div className="text-[14px] leading-6 text-[#C43C3C]">
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
        "flex w-full items-center justify-between rounded-[16px] border px-4 py-4 text-left transition",
        selected
          ? "border-[#121826] bg-slate-50"
          : "border-[#E2E5EC] bg-white hover:border-[#C9D0DB]"
      )}
    >
      <div className="min-w-0">
        <div className="text-[15px] font-medium text-slate-900">
          {s(account?.companyName) || s(account?.tenantKey) || "Workspace"}
        </div>
        <div className="mt-1 text-[13px] text-slate-500">
          {s(account?.tenantKey)} · {s(account?.role || "member")}
        </div>
      </div>

      <div
        className={cn(
          "h-4 w-4 rounded-full border transition",
          selected
            ? "border-[#121826] bg-[#121826]"
            : "border-[#C9D0DB] bg-white"
        )}
      />
    </button>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const isSignupMode = location.pathname === "/signup";
  const redirectTo = location.state?.from?.pathname || "/";
  const detectedTenantKey = useMemo(() => getTenantKeyFromHost(), []);
  const activeTenantKey = useMemo(
    () => normalizeTenantKey(detectedTenantKey),
    [detectedTenantKey]
  );

  const [checking, setChecking] = useState(true);
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

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const auth = await getAppAuthContext();

        if (!alive) return;

        if (auth?.authenticated) {
          const target = resolveAuthenticatedLanding({
            auth,
            bootstrap: auth?.bootstrap || auth?.workspace || auth,
          });
          navigate(target, { replace: true });
          return;
        }
      } catch {
      } finally {
        if (alive) setChecking(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate]);

  useEffect(() => {
    setError("");
    setAccountChoices([]);
    setSelectedAccountToken("");
    setShowPassword(false);
  }, [isSignupMode]);

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
    if (loading || checking) return;

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

  const isLoginDisabled =
    checking || loading || !s(form.email) || !s(form.password);

  const isSignupDisabled =
    checking ||
    loading ||
    !s(form.companyName) ||
    !s(form.email) ||
    !s(form.password);

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <InputResetStyles />

      <TopBar />

      <main className="mx-auto flex w-full max-w-[760px] justify-center px-6 pb-16 pt-6 sm:px-8 lg:px-10">
        <div className="w-full max-w-[636px]">
          <div className="pt-6 text-center">
            <h1 className="text-[64px] font-semibold leading-none tracking-[-0.06em] text-[#121826] sm:text-[74px]">
              {isSignupMode ? "Create account" : "Log in"}
            </h1>
          </div>

          <form className="mt-12 space-y-6" onSubmit={onSubmit}>
            {isSignupMode ? (
              <>
                <AuthField
                  icon={User2}
                  name="fullName"
                  value={form.fullName}
                  placeholder="Enter full name"
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
                  placeholder="Enter business name"
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
              placeholder="Enter email address"
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
              placeholder="Enter password"
              onChange={onChange}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField("")}
              autoComplete={isSignupMode ? "new-password" : "current-password"}
              focused={focusedField === "password"}
              rightSlot={
                <button
                  type="button"
                  className="text-[#9BA3B2] transition hover:text-slate-700"
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
                  className="text-[16px] font-medium text-[#1F2A3D] underline underline-offset-4 transition hover:text-slate-950"
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
                "mt-2 inline-flex h-[72px] w-full items-center justify-center rounded-full px-6 text-[20px] font-semibold transition",
                (isSignupMode ? isSignupDisabled : isLoginDisabled)
                  ? "bg-[#F1F1F1] text-[#B7BCC6]"
                  : "bg-[#121826] text-white hover:bg-[#0B1020]"
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

            <div className="pt-2 text-center text-[18px] text-[#1F2A3D]">
              {isSignupMode ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                className="font-medium underline underline-offset-4"
                onClick={() =>
                  navigate(isSignupMode ? "/login" : "/signup")
                }
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