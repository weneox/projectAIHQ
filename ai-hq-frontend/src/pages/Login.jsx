import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogOut,
  Mail,
  WifiOff,
} from "lucide-react";

import { loginUser, logoutUser, selectWorkspaceUser } from "../api/auth.js";
import { clearAppSessionContext, getAppAuthContext } from "../lib/appSession.js";
import {
  WORKSPACE_SELECTION_ROUTE,
  hasMultipleWorkspaceChoices,
  resolveAuthenticatedLanding,
  resolveWorkspaceContractRoute,
} from "../lib/appEntry.js";
import googleIconSrc from "../assets/setup-studio/channels/google.svg";
import appleIconSrc from "../assets/setup-studio/channels/apple.svg";

const STUDIO_PREVIEW_VIDEO =
  "https://res.cloudinary.com/dppoomunj/video/upload/v1775016242/292914_medium_jlp8gi.mp4";

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
      .login-auth-field-input {
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

      .login-auth-field-input::-ms-reveal,
      .login-auth-field-input::-ms-clear {
        display: none;
      }

      .login-auth-field-input:-webkit-autofill,
      .login-auth-field-input:-webkit-autofill:hover,
      .login-auth-field-input:-webkit-autofill:focus,
      .login-auth-field-input:-webkit-autofill:active {
        -webkit-text-fill-color: #0f172a !important;
        caret-color: #0f172a !important;
        background: transparent !important;
        background-color: transparent !important;
        transition: background-color 999999s ease-in-out 0s;
      }
    `}</style>
  );
}

function StatusLine({ icon: Icon, title, body, tone = "neutral", spin = false }) {
  const toneClass =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : tone === "warning"
        ? "border-[#ead9a2] bg-[#fffaf0] text-[#7a5a08]"
        : "border-[#e5e9e8] bg-white text-slate-800";

  return (
    <div className={cn("rounded-[14px] border px-4 py-3", toneClass)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", spin && "animate-spin")} />
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em]">
            {title}
          </div>
          <div className="mt-1 text-[13px] leading-6 opacity-90">{body}</div>
        </div>
      </div>
    </div>
  );
}

function AuthField({
  label,
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
  invalid = false,
  rightSlot = null,
}) {
  return (
    <label className="block">
      <div className="mb-2 text-[12px] font-medium text-slate-800">{label}</div>

      <div
        className={cn(
          "relative h-[56px] overflow-hidden rounded-[14px] border bg-white transition-all duration-200",
          invalid
            ? "border-rose-300"
            : focused
              ? "border-[#0b6870] shadow-[0_0_0_1.5px_rgba(11,104,112,.14)]"
              : "border-[#d8dddd] hover:border-[#c5cbcb]"
        )}
      >
        <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[#98a4b8]">
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
            "login-auth-field-input text-[15px] text-slate-900 placeholder:text-slate-400",
            rightSlot ? "pr-[52px] pl-[54px]" : "pr-4 pl-[54px]"
          )}
        />

        {rightSlot ? (
          <div className="absolute right-4 top-1/2 z-10 -translate-y-1/2">
            {rightSlot}
          </div>
        ) : null}
      </div>
    </label>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-4 py-1">
      <div className="h-px flex-1 bg-[#e6ebea]" />
      <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-slate-400">
        Or
      </div>
      <div className="h-px flex-1 bg-[#e6ebea]" />
    </div>
  );
}

function SocialButton({ iconSrc, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[50px] w-full items-center justify-center gap-3 rounded-[12px] border border-[#dedfdf] bg-white px-4 text-[15px] font-medium text-slate-700 transition hover:border-[#c9d0cf] hover:text-slate-950"
    >
      <img
        src={iconSrc}
        alt=""
        aria-hidden="true"
        className="h-[18px] w-[18px] object-contain"
      />
      <span>{children}</span>
    </button>
  );
}

function WorkspaceChoiceCard({ account, selected, onSelect }) {
  const token = s(account?.selectionToken);
  const stateText = account?.setupRequired
    ? "Setup required"
    : account?.workspaceReady
      ? "Ready"
      : "Select";

  return (
    <button
      type="button"
      onClick={() => onSelect(token)}
      className={cn(
        "flex w-full items-start justify-between gap-4 rounded-[14px] border px-4 py-3 text-left transition-all duration-200",
        selected
          ? "border-[#0b5b60] bg-[#0b5b60] text-white"
          : "border-[#d8dfde] bg-white text-slate-800 hover:border-[#afc0be]"
      )}
    >
      <div className="min-w-0">
        <div className="text-[14px] font-semibold leading-6">
          {s(account?.companyName) ||
            formatWorkspaceName(account?.tenantKey) ||
            account?.tenantKey}
        </div>
        <div
          className={cn(
            "text-[12px] leading-6",
            selected ? "text-white/75" : "text-slate-500"
          )}
        >
          {s(account?.tenantKey)} · {s(account?.role || "member")}
        </div>
      </div>

      <div
        className={cn(
          "shrink-0 text-right text-[11px] font-semibold uppercase tracking-[0.16em]",
          selected ? "text-white/72" : "text-slate-400"
        )}
      >
        {selected ? "Selected" : stateText}
      </div>
    </button>
  );
}

function VideoColumn() {
  const videoRef = useRef(null);
  const previewPreparedRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const previewTime = 0.08;

    function preparePreviewFrame() {
      if (!video || previewPreparedRef.current) return;
      previewPreparedRef.current = true;

      const finishPause = () => {
        try {
          video.pause();
        } catch {}
      };

      try {
        if (Math.abs(video.currentTime - previewTime) > 0.02) {
          const handleSeeked = () => finishPause();
          video.addEventListener("seeked", handleSeeked, { once: true });
          video.currentTime = previewTime;
        } else {
          finishPause();
        }
      } catch {
        finishPause();
      }
    }

    if (video.readyState >= 1) {
      preparePreviewFrame();
    }

    video.addEventListener("loadedmetadata", preparePreviewFrame);
    video.addEventListener("loadeddata", preparePreviewFrame);
    video.addEventListener("canplay", preparePreviewFrame);

    return () => {
      video.removeEventListener("loadedmetadata", preparePreviewFrame);
      video.removeEventListener("loadeddata", preparePreviewFrame);
      video.removeEventListener("canplay", preparePreviewFrame);
    };
  }, []);

  async function handleHoverStart() {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
    } catch {}
  }

  function handleHoverEnd() {
    const video = videoRef.current;
    if (!video) return;

    try {
      video.pause();
    } catch {}
  }

  return (
    <div
      onPointerEnter={handleHoverStart}
      onPointerLeave={handleHoverEnd}
      className="relative h-full w-full overflow-hidden bg-[#09111a]"
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover object-top"
        style={{ objectPosition: "center top" }}
        src={STUDIO_PREVIEW_VIDEO}
        muted
        loop
        playsInline
        preload="auto"
      />

      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#f6f7f6]/16 to-transparent" />
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

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
        const auth = await getAppAuthContext();
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
      const auth = await getAppAuthContext({ force: true });
      const target = resolveAuthenticatedLanding({
        auth,
        bootstrap: auth,
      });

      navigate(target, { replace: true });
    } catch (sessionError) {
      setServiceNotice({
        visible: true,
        title: "Session check failed",
        body: getFriendlyError(
          sessionError,
          "We could not resolve the correct entry route."
        ),
        tone: "warning",
      });
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
        body: getFriendlyError(
          logoutError,
          "We could not end the current session."
        ),
        tone: "warning",
      });
    } finally {
      setSessionActionBusy(false);
    }
  }

  function handleProviderClick(message) {
    setServiceNotice({
      visible: true,
      title: "Unavailable",
      body: message,
      tone: "neutral",
    });
  }

  function onChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
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
    const usingInlineWorkspaceSelection = accountChoices.length > 0;

    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }

    if (usingInlineWorkspaceSelection && !selectedAccountToken) {
      setError("Select the correct workspace to continue.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setServiceNotice((prev) => ({ ...prev, visible: false }));

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

  return (
    <div className="h-screen overflow-hidden bg-[#f6f7f6] text-slate-950">
      <InputResetStyles />

      <div className="flex h-full w-full">
        <div className="flex h-full w-full items-center justify-center px-8 py-6 lg:w-1/2 lg:px-16 xl:px-20">
          <div className="w-full max-w-[430px]">
            {activeTenantKey ? (
              <div className="mb-6 text-[12px] font-medium uppercase tracking-[0.16em] text-[#0b6a71]">
                {workspaceName || activeTenantKey}
              </div>
            ) : null}

            <h1 className="text-[34px] font-semibold tracking-[-0.05em] text-slate-950 xl:text-[36px]">
              Welcome Back!
            </h1>

            <p className="mt-4 max-w-[390px] text-[15px] leading-8 text-slate-600">
              Sign in to access your dashboard and continue optimizing your QA
              process.
            </p>

            <div className="mt-6 space-y-3">
              {serviceNotice.visible ? (
                <StatusLine
                  icon={
                    activeSession || serviceNotice.tone === "neutral"
                      ? CheckCircle2
                      : WifiOff
                  }
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
                  spin
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
              <div className="mt-5 rounded-[14px] border border-[#d9dddd] bg-white p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Current session
                </div>

                <div className="mt-2 text-[14px] leading-6 text-slate-700">
                  {activeSession.fullName || activeSession.email || "Signed-in user"}
                  {activeSession.tenantKey
                    ? ` · ${formatWorkspaceName(activeSession.tenantKey) || activeSession.tenantKey}`
                    : ""}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleContinueWithSession}
                    disabled={sessionActionBusy}
                    className="inline-flex h-[46px] items-center justify-center rounded-[12px] bg-[#0b5b60] px-4 text-[14px] font-medium text-white transition hover:bg-[#08494c] disabled:opacity-60"
                  >
                    {sessionActionBusy ? "Opening..." : "Open workspace"}
                  </button>

                  <button
                    type="button"
                    onClick={handleSignOutCurrentSession}
                    disabled={sessionActionBusy}
                    className="inline-flex h-[46px] items-center justify-center gap-2 rounded-[12px] border border-[#d9dddd] bg-white px-4 text-[14px] font-medium text-slate-700 transition hover:border-[#c4cccc] hover:text-slate-950 disabled:opacity-60"
                  >
                    <LogOut className="h-4 w-4" />
                    Use another account
                  </button>
                </div>
              </div>
            ) : null}

            <form className="mt-7 space-y-4" onSubmit={onSubmit}>
              <AuthField
                label="Email"
                icon={Mail}
                name="email"
                type="email"
                value={form.email}
                placeholder="Enter your email"
                onChange={onChange}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField("")}
                autoComplete="email"
                focused={focusedField === "email"}
                invalid={!s(form.email) && !!error}
              />

              <AuthField
                label="Password"
                icon={Lock}
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                placeholder="Enter your password"
                onChange={onChange}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField("")}
                autoComplete="current-password"
                focused={focusedField === "password"}
                invalid={!s(form.password) && !!error}
                rightSlot={
                  <button
                    type="button"
                    className="text-[#9ba6bb] transition hover:text-slate-700"
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

              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  className="text-[13px] font-medium text-[#0b6a71] transition hover:text-[#084c52]"
                  onClick={() =>
                    handleProviderClick(
                      "Password recovery is not enabled yet for this workspace."
                    )
                  }
                >
                  Forgot Password?
                </button>
              </div>

              <motion.button
                whileHover={loading || checking ? {} : { y: -1 }}
                whileTap={loading || checking ? {} : { scale: 0.995 }}
                type="submit"
                disabled={loading || checking}
                className="inline-flex h-[54px] w-full items-center justify-center rounded-[14px] bg-[#0a5961] px-5 text-[15px] font-semibold text-white transition hover:bg-[#084a51] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </span>
                ) : accountChoices.length ? (
                  "Open selected workspace"
                ) : (
                  "Sign In"
                )}
              </motion.button>

              {accountChoices.length ? (
                <div className="space-y-3 rounded-[14px] border border-[#d8dfde] bg-[#fbfcfb] p-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Select workspace
                    </div>
                    <div className="mt-1 text-sm leading-6 text-slate-600">
                      Choose where you want to continue.
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

              <div className="pt-1">
                <Divider />
              </div>

              <div className="space-y-3">
                <SocialButton
                  iconSrc={googleIconSrc}
                  onClick={() =>
                    handleProviderClick("Google sign-in is not enabled yet.")
                  }
                >
                  Continue with Google
                </SocialButton>

                <SocialButton
                  iconSrc={appleIconSrc}
                  onClick={() =>
                    handleProviderClick("Apple sign-in is not enabled yet.")
                  }
                >
                  Continue with Apple
                </SocialButton>
              </div>

              <div className="pt-1 text-center text-[14px] text-slate-500">
                Don’t have an Account?{" "}
                <button
                  type="button"
                  className="font-medium text-[#0b6a71] transition hover:text-[#084c52]"
                  onClick={() => navigate("/signup")}
                >
                  Sign Up
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="hidden h-full w-1/2 lg:block">
          <VideoColumn />
        </div>
      </div>
    </div>
  );
}