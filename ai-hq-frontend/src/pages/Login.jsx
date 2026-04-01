import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  LogOut,
  WifiOff,
} from "lucide-react";
import { getAuthMe, loginUser, logoutUser } from "../api/auth.js";
import { clearAppSessionContext } from "../lib/appSession.js";

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
  return s(value)
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function formatWorkspaceName(key) {
  const clean = s(key);
  if (!clean) return "";

  return clean
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  const code = s(error?.code || error?.payload?.code || error?.response?.data?.code).toLowerCase();
  return code === "multiple_accounts";
}

function normalizeAccountChoices(error) {
  const accounts =
    error?.payload?.accounts ||
    error?.response?.data?.accounts ||
    [];

  return Array.isArray(accounts) ? accounts : [];
}

function StatusLine({ icon: Icon, title, body, tone = "neutral" }) {
  const toneClass =
    tone === "error"
      ? "border-rose-200/70 bg-rose-50/90 text-rose-900"
      : tone === "warning"
        ? "border-amber-200/70 bg-amber-50/90 text-amber-950"
        : "border-black/8 bg-white/72 text-slate-800";

  return (
    <div className={`rounded-[20px] border px-4 py-3 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-[0.18em]">
            {title}
          </div>
          <div className="mt-1 text-sm leading-6 opacity-80">{body}</div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
  right = null,
  focused = false,
  invalid = false,
}) {
  const stateClass = invalid
    ? "border-rose-300/90 bg-rose-50/70 shadow-[0_0_0_1px_rgba(244,63,94,.08)]"
    : focused
      ? "border-slate-900/18 bg-white/95 shadow-[0_18px_40px_-24px_rgba(15,23,42,.35)]"
      : "border-black/10 bg-white/78 hover:border-black/16";

  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          {label}
        </span>
        {right}
      </div>

      <div
        className={`flex h-15 items-center gap-3 rounded-[22px] border px-4 transition duration-200 ${stateClass}`}
      >
        <span className="shrink-0 text-slate-400">
          <Icon className="h-[17px] w-[17px]" />
        </span>
        {children}
      </div>
    </label>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const pointerX = useMotionValue(50);
  const pointerY = useMotionValue(36);
  const glow = useMotionTemplate`radial-gradient(520px circle at ${pointerX}% ${pointerY}%, rgba(255,255,255,.92), rgba(255,255,255,.34) 34%, rgba(255,255,255,.06) 62%, transparent 78%)`;

  const detectedTenantKey = useMemo(() => getTenantKeyFromHost(), []);
  const redirectTo = location.state?.from?.pathname || "/";

  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sessionActionBusy, setSessionActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [accountChoices, setAccountChoices] = useState([]);
  const [selectedAccountToken, setSelectedAccountToken] = useState("");
  const [serviceNotice, setServiceNotice] = useState({
    visible: false,
    title: "",
    body: "",
    tone: "warning",
  });

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const activeTenantKey = useMemo(
    () => normalizeTenantKey(detectedTenantKey),
    [detectedTenantKey]
  );

  const workspaceName = useMemo(
    () => formatWorkspaceName(activeTenantKey),
    [activeTenantKey]
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const auth = await getAuthMe();
        if (!alive) return;

        if (auth?.authenticated) {
          const user = auth?.user || {};
          setActiveSession({
            email: s(user.email),
            fullName: s(user.fullName),
            tenantKey: s(user.tenantKey).toLowerCase(),
          });

          setServiceNotice({
            visible: true,
            title: "Already signed in",
            body: "This session is active. Continue to your workspace or sign out to switch accounts.",
            tone: "neutral",
          });
        } else {
          setActiveSession(null);
          setServiceNotice({
            visible: false,
            title: "",
            body: "",
            tone: "warning",
          });
        }
      } catch (authError) {
        if (!alive) return;

        setActiveSession(null);
        setServiceNotice({
          visible: true,
          title: "Service unavailable",
          body: getFriendlyError(
            authError,
            "We could not verify your session."
          ),
          tone: "warning",
        });
      } finally {
        if (alive) setChecking(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate, redirectTo]);

  async function handleContinueWithSession() {
    if (sessionActionBusy) return;

    setSessionActionBusy(true);
    try {
      navigate(redirectTo === "/login" ? "/" : redirectTo, { replace: true });
    } finally {
      setSessionActionBusy(false);
    }
  }

  async function handleSignOutCurrentSession() {
    if (sessionActionBusy) return;

    setSessionActionBusy(true);
    try {
      await logoutUser();
      clearAppSessionContext();
      setActiveSession(null);
      setAccountChoices([]);
      setSelectedAccountToken("");
      setError("");
      setServiceNotice({
        visible: false,
        title: "",
        body: "",
        tone: "warning",
      });
    } catch (logoutError) {
      setServiceNotice({
        visible: true,
        title: "Session sign-out failed",
        body: getFriendlyError(logoutError, "We could not end the current session."),
        tone: "warning",
      });
    } finally {
      setSessionActionBusy(false);
    }
  }

  function onChange(e) {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (error) setError("");
    if (name === "email") {
      setAccountChoices([]);
      setSelectedAccountToken("");
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (loading) return;

    const email = s(form.email);
    const password = String(form.password || "");

    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }

    if (accountChoices.length > 0 && !selectedAccountToken) {
      setError("Select the correct workspace to continue.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setServiceNotice((prev) => ({ ...prev, visible: false }));

      await loginUser({
        email,
        password,
        tenantKey: activeTenantKey || undefined,
        accountSelectionToken: selectedAccountToken || undefined,
      });
      clearAppSessionContext();

      window.location.replace(redirectTo);
    } catch (submitError) {
      if (isServiceUnavailableError(submitError)) {
        setServiceNotice({
          visible: true,
          title: "Authentication paused",
          body: getFriendlyError(submitError),
          tone: "warning",
        });
        setError("");
      } else if (isMultipleAccountsError(submitError)) {
        setAccountChoices(normalizeAccountChoices(submitError));
        setSelectedAccountToken("");
        setServiceNotice({
          visible: true,
          title: "Choose workspace",
          body: "This email is active in more than one workspace. Select the correct one to continue.",
          tone: "neutral",
        });
        setError("");
      } else {
        setError(getFriendlyError(submitError, "Sign in failed."));
      }
    } finally {
      setLoading(false);
    }
  }

  function handlePointerMove(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    pointerX.set(Math.max(0, Math.min(100, x)));
    pointerY.set(Math.max(0, Math.min(100, y)));
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#ebe6dd] text-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,.95),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(208,214,226,.55),transparent_28%),linear-gradient(180deg,#f4efe7_0%,#e7e1d7_100%)]" />
      <div className="absolute inset-y-0 left-[11vw] hidden w-px bg-black/6 xl:block" />
      <div className="absolute inset-y-0 right-[10vw] hidden w-px bg-black/5 xl:block" />
      <div className="absolute left-[8vw] top-[14vh] h-[32vh] w-[18vw] rounded-full bg-white/65 blur-[80px]" />
      <div className="absolute right-[6vw] top-[10vh] h-[56vh] w-[24vw] rounded-full bg-[#c9d1dd]/50 blur-[90px]" />
      <div className="absolute bottom-[8vh] left-[22vw] h-[26vh] w-[28vw] rounded-full bg-[#f8f3ec]/85 blur-[70px]" />

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 18, scale: 0.992 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          onMouseMove={handlePointerMove}
          className="relative w-full max-w-[1180px] overflow-hidden rounded-[34px] border border-white/70 bg-[rgba(251,249,245,.72)] shadow-[0_50px_120px_-54px_rgba(15,23,42,.42)] backdrop-blur-[24px]"
        >
          <motion.div
            aria-hidden="true"
            style={{ background: glow }}
            className="pointer-events-none absolute inset-0 opacity-95"
          />

          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,.55),transparent_26%,transparent_74%,rgba(255,255,255,.35))]" />
          <div className="absolute left-[clamp(1rem,4vw,2.5rem)] top-[clamp(1rem,4vw,2.4rem)] h-[calc(100%-2rem)] w-[min(44%,390px)] rounded-[28px] border border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,.48),rgba(255,255,255,.14))] shadow-[inset_0_1px_0_rgba(255,255,255,.45)] backdrop-blur-[10px] sm:h-[calc(100%-2.4rem)] sm:w-[min(42%,410px)]" />
          <div className="absolute right-[clamp(1rem,4vw,2.5rem)] top-[clamp(1rem,4vw,2.4rem)] h-[88px] w-[88px] rounded-full border border-white/55 bg-white/28 blur-[1px]" />
          <div className="absolute bottom-[clamp(1rem,4vw,2.4rem)] right-[clamp(1rem,4vw,2.5rem)] h-[120px] w-[120px] rounded-[28px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,.38),rgba(255,255,255,.14))]" />

          <div className="relative grid min-h-[760px] grid-cols-1 lg:grid-cols-[minmax(280px,34%)_1fr]">
            <div className="relative flex min-h-[260px] flex-col justify-between p-6 sm:p-8 lg:p-10">
              <div>
                <div className="inline-flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] bg-slate-950 text-white shadow-[0_20px_40px_-24px_rgba(15,23,42,.7)]">
                    <div className="h-2.5 w-2.5 rounded-full bg-white" />
                  </div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.28em] text-slate-600">
                    AIHQ
                  </div>
                </div>

                <div className="mt-10 max-w-[220px]">
                  <div className="font-['Cormorant_Garamond',Georgia,serif] text-[54px] leading-[0.9] tracking-[-0.05em] text-slate-950 sm:text-[64px]">
                    Enter
                  </div>
                  <div className="mt-4 text-[12px] uppercase tracking-[0.22em] text-slate-500">
                    {workspaceName || activeTenantKey || "Private system"}
                  </div>
                </div>
              </div>

              <div className="hidden lg:block">
                <div className="flex items-end justify-between gap-4">
                  <div className="max-w-[180px] text-[13px] leading-6 text-slate-500">
                    Quiet, controlled access.
                  </div>
                  <div className="h-px w-16 bg-black/10" />
                </div>
              </div>
            </div>

            <div className="relative flex items-center px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
              <div className="relative ml-auto w-full max-w-[620px] rounded-[30px] border border-black/8 bg-[rgba(255,255,255,.58)] p-5 shadow-[0_30px_70px_-44px_rgba(15,23,42,.44)] backdrop-blur-[22px] sm:p-7 lg:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Login
                    </div>
                    <h1 className="mt-4 max-w-[360px] font-['Sora',ui-sans-serif,system-ui] text-[32px] font-semibold leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-[40px]">
                      Back inside.
                    </h1>
                    <p className="mt-3 max-w-[320px] text-sm leading-7 text-slate-600">
                      Use your email and password to open your operator session.
                    </p>
                  </div>

                  <div className="rounded-full border border-black/8 bg-white/72 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                    {checking ? "Checking" : "Ready"}
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {serviceNotice.visible ? (
                    <StatusLine
                      icon={activeSession || serviceNotice.tone === "neutral" ? CheckCircle2 : WifiOff}
                      title={serviceNotice.title}
                      body={serviceNotice.body}
                      tone={serviceNotice.tone}
                    />
                  ) : null}

                  {checking ? (
                    <StatusLine
                      icon={Loader2}
                      title="Session"
                      body="Checking your current sign-in state."
                    />
                  ) : null}

                  {error ? (
                    <StatusLine
                      icon={AlertCircle}
                      title="Unable to continue"
                      body={error}
                      tone="error"
                    />
                  ) : null}
                </div>

                {activeSession ? (
                  <div className="mt-6 rounded-[24px] border border-black/8 bg-white/72 px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Current session
                    </div>
                    <div className="mt-2 text-sm leading-7 text-slate-700">
                      {activeSession.fullName || activeSession.email || "Signed-in user"}
                      {activeSession.tenantKey
                        ? ` - ${formatWorkspaceName(activeSession.tenantKey) || activeSession.tenantKey}`
                        : ""}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleContinueWithSession}
                        disabled={sessionActionBusy}
                        className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-[14px] font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                      >
                        {sessionActionBusy ? "Opening..." : "Open workspace"}
                      </button>
                      <button
                        type="button"
                        onClick={handleSignOutCurrentSession}
                        disabled={sessionActionBusy}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-5 text-[14px] font-medium text-slate-700 transition hover:border-black/20 hover:text-slate-950 disabled:opacity-60"
                      >
                        <LogOut className="h-4 w-4" />
                        Use another account
                      </button>
                    </div>
                  </div>
                ) : null}

                <form className="mt-7 space-y-5" onSubmit={onSubmit}>
                  {activeTenantKey ? (
                    <div className="rounded-[22px] border border-black/8 bg-white/64 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Workspace
                      </div>
                      <div className="mt-1 text-sm leading-6 text-slate-700">
                        {workspaceName || activeTenantKey}
                      </div>
                      <div className="text-[12px] leading-6 text-slate-500">
                        Resolved automatically from this host.
                      </div>
                    </div>
                  ) : null}

                  <Field
                    label="Email"
                    icon={Mail}
                    focused={focusedField === "email"}
                    invalid={!s(form.email) && !!error}
                  >
                    <input
                      type="email"
                      name="email"
                      placeholder="name@company.com"
                      value={form.email}
                      onChange={onChange}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField("")}
                      autoComplete="email"
                      className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400"
                    />
                  </Field>

                  <Field
                    label="Password"
                    icon={Lock}
                    focused={focusedField === "password"}
                    invalid={!s(form.password) && !!error}
                  >
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Password"
                      value={form.password}
                      onChange={onChange}
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => setFocusedField("")}
                      autoComplete="current-password"
                      className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400"
                    />

                    <button
                      type="button"
                      className="shrink-0 text-slate-400 transition hover:text-slate-800"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? (
                        <EyeOff className="h-[18px] w-[18px]" />
                      ) : (
                        <Eye className="h-[18px] w-[18px]" />
                      )}
                    </button>
                  </Field>

                  {accountChoices.length ? (
                    <div className="rounded-[24px] border border-black/8 bg-white/72 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Select workspace
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">
                        Choose the account you want to access with this email.
                      </div>
                      <div className="mt-4 space-y-3">
                        {accountChoices.map((account) => {
                          const token = s(account.selectionToken);
                          const selected = token && token === selectedAccountToken;
                          const passwordUnavailable =
                            s(account.authProvider || "local").toLowerCase() !== "local" ||
                            account.passwordReady === false;

                          return (
                            <button
                              key={token || `${account.tenantKey}-${account.role}`}
                              type="button"
                              disabled={passwordUnavailable}
                              onClick={() => {
                                setSelectedAccountToken(token);
                                setError("");
                              }}
                              className={`flex w-full items-start justify-between gap-4 rounded-[20px] border px-4 py-3 text-left transition ${
                                selected
                                  ? "border-slate-950 bg-slate-950 text-white"
                                  : "border-black/8 bg-[#fbfaf7] text-slate-800 hover:border-black/16"
                              } ${passwordUnavailable ? "cursor-not-allowed opacity-55" : ""}`}
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium leading-6">
                                  {s(account.companyName) || formatWorkspaceName(account.tenantKey) || account.tenantKey}
                                </div>
                                <div className={`text-[12px] leading-6 ${selected ? "text-white/75" : "text-slate-500"}`}>
                                  {s(account.tenantKey)} · {s(account.role || "member")}
                                </div>
                              </div>
                              <div className={`shrink-0 text-[11px] font-semibold uppercase tracking-[0.18em] ${selected ? "text-white/72" : "text-slate-400"}`}>
                                {passwordUnavailable
                                  ? s(account.authProvider || "access")
                                  : selected
                                    ? "Selected"
                                    : "Choose"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <motion.button
                    whileHover={loading || checking ? {} : { y: -1 }}
                    whileTap={loading || checking ? {} : { scale: 0.995 }}
                    type="submit"
                    disabled={loading || checking}
                    className="group relative inline-flex h-[62px] w-full items-center justify-between overflow-hidden rounded-[24px] border border-slate-950 bg-slate-950 px-5 text-left text-white shadow-[0_28px_44px_-26px_rgba(15,23,42,.78)] transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.10),transparent_28%,transparent_72%,rgba(255,255,255,.08))]" />
                    <span className="relative">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                        Continue
                      </span>
                      <span className="mt-1 block text-[15px] font-medium">
                        {loading
                          ? "Signing in..."
                          : accountChoices.length
                            ? "Open selected workspace"
                            : "Open session"}
                      </span>
                    </span>

                    <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/8 transition group-hover:translate-x-[2px]">
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                    </span>
                  </motion.button>
                </form>
              </div>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
