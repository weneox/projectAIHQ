import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User2,
} from "lucide-react";

import { loginUser, selectWorkspaceUser, signupUser } from "../api/auth.js";
import {
  clearAppSessionContext,
  getAppAuthContext,
  getAppBootstrapContext,
} from "../lib/appSession.js";
import {
  PRODUCT_HOME_ROUTE,
  WORKSPACE_SELECTION_ROUTE,
  hasMultipleWorkspaceChoices,
  resolveAuthenticatedLanding,
} from "../lib/appEntry.js";
import { isWelcomeIdentityComplete } from "../lib/welcomeIdentity.js";
import AppBootSurface from "../components/loading/AppBootSurface.jsx";

import AIVisual from "../assets/channels/AI.png";
import GmailIconAsset from "../assets/channels/gmail.svg";
import AppleIconAsset from "../assets/channels/apple.svg";

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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ignoreError() {
  return undefined;
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
        "relative h-[66px] overflow-hidden rounded-[18px] border bg-white transition-all duration-200",
        focused
          ? "border-[#2d61ff] shadow-[0_0_0_4px_rgba(45,97,255,0.07)]"
          : "border-slate-200 hover:border-slate-300"
      )}
    >
      <span className="pointer-events-none absolute left-5 top-1/2 z-10 -translate-y-1/2 text-slate-400">
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
          "auth-clean-input text-[15px] font-medium tracking-[-0.015em] text-slate-950 placeholder:font-normal placeholder:text-slate-400",
          rightSlot ? "pl-[56px] pr-[56px]" : "pl-[56px] pr-5"
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

function Divider({ label = "or continue with email" }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-px flex-1 bg-slate-200" />
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
        {label}
      </div>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function InlineError({ message }) {
  if (!message) return null;

  return (
    <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium leading-6 text-rose-700">
      {message}
    </div>
  );
}

function SocialButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[62px] w-full items-center justify-center gap-3 rounded-[16px] border border-slate-200 bg-white px-5 text-[16px] font-semibold tracking-[-0.02em] text-slate-800 transition duration-200 hover:border-slate-300 hover:bg-slate-50"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function WorkspaceChoiceCard({ account, selected, onSelect }) {
  const token = s(account?.selectionToken);

  return (
    <button
      type="button"
      onClick={() => onSelect(token)}
      className={cn(
        "flex w-full items-center justify-between rounded-[18px] border px-4 py-3.5 text-left transition",
        selected
          ? "border-[#2962ff]/25 bg-[#2962ff]/[0.04]"
          : "border-slate-200 bg-white hover:border-slate-300"
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
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
            ? "border-[#2962ff] bg-[#2962ff]"
            : "border-slate-300 bg-white"
        )}
      >
        {selected ? (
          <div className="absolute inset-[4px] rounded-full bg-white" />
        ) : null}
      </div>
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
  const [checkingSession, setCheckingSession] = useState(true);
  const [focusedField, setFocusedField] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [accountChoices, setAccountChoices] = useState([]);
  const [selectedAccountToken, setSelectedAccountToken] = useState("");
  const [submitBurst, setSubmitBurst] = useState(false);
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

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const auth = await getAppAuthContext();
        if (!alive) return;

        if (!auth?.authenticated) {
          setCheckingSession(false);
          return;
        }

        if (hasMultipleWorkspaceChoices(auth)) {
          navigate(WORKSPACE_SELECTION_ROUTE, { replace: true });
          return;
        }

        let bootstrap = null;
        try {
          bootstrap = await getAppBootstrapContext();
        } catch {
          ignoreError();
        }

        if (!alive) return;

        if (!isWelcomeIdentityComplete({ auth, bootstrap })) {
          navigate("/welcome", { replace: true });
          return;
        }

        navigate(
          resolveAuthenticatedLanding({
            auth,
            bootstrap,
          }),
          { replace: true }
        );
      } catch {
        if (!alive) return;
        setCheckingSession(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [navigate]);

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
      navigate(PRODUCT_HOME_ROUTE, { replace: true });
      return;
    }

    let auth = null;
    let bootstrap = null;

    try {
      auth = await getAppAuthContext({ force: true });

      if (hasMultipleWorkspaceChoices(auth)) {
        navigate(WORKSPACE_SELECTION_ROUTE, { replace: true });
        return;
      }

      bootstrap = await getAppBootstrapContext({ force: true }).catch(() => ({}));
    } catch {
      ignoreError();
    }

    if (!isWelcomeIdentityComplete({ auth, bootstrap })) {
      navigate("/welcome", { replace: true });
      return;
    }

    navigate(
      resolvePostAuthTarget({
        auth,
        payload: bootstrap && Object.keys(bootstrap).length ? bootstrap : response,
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
      },
    });
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (loading) return;

    try {
      setError("");
      setSubmitBurst(true);
      setLoading(true);
      await wait(180);

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
      setSubmitBurst(false);
    }
  }

  const isLoginDisabled = loading || !s(form.email) || !s(form.password);
  const isSignupDisabled =
    loading ||
    !s(form.companyName) ||
    !s(form.email) ||
    !s(form.password);

  function onSocialAuth(provider) {
    setError(`${provider} sign-in is not enabled yet.`);
  }

  if (checkingSession) {
    return (
      <AppBootSurface
        label="Checking account"
        detail="Looking for an active session before we show the sign-in screen."
      />
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-slate-950">
      <InputResetStyles />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-9%] top-1/2 h-[760px] w-[760px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.12)_0%,rgba(59,130,246,0.05)_34%,rgba(255,255,255,0)_72%)]" />
        <div className="absolute left-0 top-0 hidden h-full w-[54vw] min-w-[620px] max-w-[980px] lg:block">
          <div className="flex h-full w-full items-center justify-start">
            <img
              src={AIVisual}
              alt=""
              className="h-auto w-[clamp(560px,44vw,840px)] max-w-none object-contain translate-x-[-4%] translate-y-[9%]"
            />
          </div>
        </div>
      </div>

      <main className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1720px] grid-cols-1 px-4 sm:px-6 lg:grid-cols-[minmax(620px,1fr)_620px] lg:px-10 xl:px-14">
        <section className="hidden lg:block" />

        <section className="flex min-h-screen items-center justify-center lg:justify-start">
          <div className="w-full max-w-[648px] py-10 lg:-ml-6 xl:-ml-10">
            <div className="mb-10">
              <h1 className="text-[3rem] font-semibold leading-[0.93] tracking-[-0.07em] text-[#081121] sm:text-[3.35rem]">
                Log in
              </h1>
            </div>

            <div className="space-y-4">
              {activeTenantKey ? (
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {activeTenantKey}
                </div>
              ) : null}

              {!isSignupMode ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <SocialButton
                      icon={
                        <img
                          src={GmailIconAsset}
                          alt=""
                          className="h-5 w-5"
                        />
                      }
                      label="Gmail"
                      onClick={() => onSocialAuth("Gmail")}
                    />
                    <SocialButton
                      icon={<OutlookIcon />}
                      label="Outlook"
                      onClick={() => onSocialAuth("Outlook")}
                    />
                    <SocialButton
                      icon={
                        <img
                          src={AppleIconAsset}
                          alt=""
                          className="h-5 w-5"
                        />
                      }
                      label="Apple"
                      onClick={() => onSocialAuth("Apple")}
                    />
                  </div>

                  <Divider />
                </>
              ) : null}

              <form className="space-y-4 pt-1" onSubmit={onSubmit}>
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
                      placeholder="Workspace name"
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

                {!isSignupMode ? (
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      className="text-[14px] font-medium tracking-[-0.01em] text-slate-600 transition hover:text-slate-900"
                      onClick={() =>
                        setError("Password recovery is not enabled yet.")
                      }
                    >
                      Forgot your password?
                    </button>
                  </div>
                ) : null}

                <InlineError message={error} />

                {accountChoices.length ? (
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 text-[14px] font-semibold tracking-[-0.02em] text-slate-950">
                      Choose workspace
                    </div>
                    <div className="space-y-3">
                      {accountChoices.map((account) => (
                        <WorkspaceChoiceCard
                          key={
                            s(account?.selectionToken) ||
                            `${account?.tenantKey}-${account?.role}`
                          }
                          account={account}
                          selected={
                            s(account?.selectionToken) === selectedAccountToken
                          }
                          onSelect={setSelectedAccountToken}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSignupMode ? isSignupDisabled : isLoginDisabled}
                  className={cn(
                    "group relative inline-flex h-[66px] w-full items-center justify-center overflow-hidden rounded-[20px] px-5 text-[16px] font-semibold tracking-[-0.03em] transition duration-200",
                    isSignupMode ? isSignupDisabled : isLoginDisabled
                      ? "bg-slate-200 text-slate-400"
                      : "bg-[linear-gradient(135deg,#5f88ff_0%,#3a67f5_38%,#2a4ed0_100%)] text-white shadow-[0_22px_50px_rgba(37,99,235,0.25)] hover:translate-y-[-1px] hover:shadow-[0_26px_60px_rgba(37,99,235,0.30)]"
                  )}
                >
                  {!((isSignupMode ? isSignupDisabled : isLoginDisabled)) ? (
                    <>
                      <span
                        className={cn(
                          "absolute inset-y-0 left-1/2 w-[58%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.30)_0%,rgba(255,255,255,0.08)_46%,rgba(255,255,255,0)_72%)] blur-xl transition-all duration-500",
                          submitBurst
                            ? "scale-[2.1] opacity-0"
                            : "scale-100 opacity-100"
                        )}
                      />
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 w-1/2 bg-white/10 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          submitBurst
                            ? "-translate-x-full opacity-0"
                            : "translate-x-0 opacity-100"
                        )}
                      />
                      <span
                        className={cn(
                          "absolute inset-y-0 right-0 w-1/2 bg-white/10 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          submitBurst
                            ? "translate-x-full opacity-0"
                            : "translate-x-0 opacity-100"
                        )}
                      />
                    </>
                  ) : null}

                  <span className="relative z-10 inline-flex items-center gap-2">
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        {isSignupMode ? "Creating..." : "Logging in..."}
                      </>
                    ) : isSignupMode ? (
                      "Create workspace"
                    ) : accountChoices.length ? (
                      "Open selected workspace"
                    ) : (
                      "Log in"
                    )}
                  </span>
                </button>

                <div className="pt-1 text-center text-[15px] font-medium tracking-[-0.01em] text-slate-700">
                  {isSignupMode ? "Already have an account?" : "Don't have an account?"}{" "}
                  <button
                    type="button"
                    className="font-semibold text-slate-950 underline underline-offset-2 transition hover:text-blue-600"
                    onClick={() => navigate(isSignupMode ? "/login" : "/signup")}
                  >
                    {isSignupMode ? "Log in" : "Sign up"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}