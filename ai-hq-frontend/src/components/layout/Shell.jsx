import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Mail, X } from "lucide-react";
import { apiGet } from "../../api/client.js";
import { resendVerificationEmail } from "../../api/auth.js";
import warningIcon from "../../assets/channels/warning.png";
import { clearAppAuthContext } from "../../lib/appSession.js";
import { useNotificationsSurface } from "../../hooks/useNotificationsSurface.js";
import { realtimeStore } from "../../lib/realtime/realtimeStore.js";import Sidebar, {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_WIDTH,
} from "./Sidebar.jsx";
import Header, { HEADER_HEIGHT } from "./Header.jsx";

const INITIAL_SHELL_STATS = {
  inboxUnread: null,
  inboxOpen: null,
  leadsOpen: null,
  dbDisabled: false,
  wsState: realtimeStore.canUseWs() ? "idle" : "off",
  availability: "loading",
  message: "",
};

const INITIAL_WORKSPACE_META = {
  workspaceName: "",
  workspaceKey: "",
  userName: "",
  userEmail: "",
};

const INITIAL_EMAIL_VERIFICATION_STATE = {
  loading: true,
  visible: false,
  email: "",
};

const SHELL_REFRESH_EVENT_TYPES = new Set([
  "inbox.message.created",
  "inbox.thread.updated",
  "inbox.thread.read",
  "inbox.thread.created",
  "lead.created",
  "lead.updated",
]);

const SIDEBAR_STORAGE_KEY = "aihq.sidebar.collapsed";
const GLOBAL_ALERT_HEIGHT = 42;

const GENERIC_WORKSPACE_KEYS = new Set([
  "www",
  "app",
  "hq",
  "dashboard",
  "admin",
  "portal",
  "api",
  "web",
  "site",
  "localhost",
  "local",
]);

const GENERIC_WORKSPACE_NAMES = new Set([
  "workspace",
  "local workspace",
  "www",
  "app",
  "hq",
  "dashboard",
  "admin",
  "portal",
  "api",
  "web",
  "site",
]);

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function pickFirstString(...values) {
  for (const value of values) {
    const text = s(value);
    if (text) return text;
  }
  return "";
}



function normalizeWorkspaceName(value, { allowGeneric = false } = {}) {
  const text = s(value);
  if (!text) return "";

  const normalized = text.toLowerCase();
  if (!allowGeneric && GENERIC_WORKSPACE_NAMES.has(normalized)) {
    return "";
  }

  return text;
}

function pickFirstWorkspaceName(...values) {
  for (const value of values) {
    const text = normalizeWorkspaceName(value);
    if (text) return text;
  }
  return "";
}

function resolveShellMode(pathname = "") {
  const path = String(pathname || "");
  if (path.startsWith("/home") || path.startsWith("/inbox") || path.startsWith("/customers") || path.startsWith("/leads") || path.startsWith("/reports") || path.startsWith("/channels") || path.startsWith("/knowledge") || path.startsWith("/settings") || path.startsWith("/launch") || path.startsWith("/welcome") || path.startsWith("/truth") || path.startsWith("/team")) return "immersive";
  return "standard";
}

async function fetchShellResource(path) {
  try {
    return { ok: true, data: await apiGet(path) };
  } catch (error) {
    return {
      ok: false,
      status: Number(error?.status || 0),
      message:
        typeof error?.message === "string" && error.message.trim()
          ? error.message.trim()
          : "Workspace stats are temporarily unavailable.",
    };
  }
}

function buildShellStatsFromResponses(inboxRes, leadsRes) {
  const failedResponse = [inboxRes, leadsRes].find((entry) => !entry?.ok);

  if (failedResponse) {
    return {
      inboxUnread: null,
      inboxOpen: null,
      leadsOpen: null,
      dbDisabled: false,
      availability: "unavailable",
      message:
        failedResponse.message || "Workspace stats are temporarily unavailable.",
    };
  }

  const inboxData = inboxRes?.data;
  const leadsData = leadsRes?.data;

  const threads = Array.isArray(inboxData?.threads) ? inboxData.threads : [];
  const leads = Array.isArray(leadsData?.leads) ? leadsData.leads : [];

  const inboxUnread = threads.reduce(
    (sum, thread) => sum + Number(thread?.unread_count || 0),
    0
  );

  const leadsOpen = leads.filter(
    (lead) => String(lead?.status || "open").toLowerCase() === "open"
  ).length;

  return {
    inboxUnread,
    inboxOpen: threads.length,
    leadsOpen,
    dbDisabled: Boolean(inboxData?.dbDisabled || leadsData?.dbDisabled),
    availability: "ready",
    message: "",
  };
}

function humanizeHostKey(value = "") {
  return s(value)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildHostFallbackMeta() {
  if (typeof window === "undefined") return INITIAL_WORKSPACE_META;

  const hostname = s(window.location.hostname, "localhost").toLowerCase();

  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
    return {
      workspaceName: "Local workspace",
      workspaceKey: "localhost",
      userName: "",
      userEmail: "",
    };
  }

  const key = hostname.split(".")[0] || "workspace";
  const isGenericKey = GENERIC_WORKSPACE_KEYS.has(key);

  return {
    workspaceName: isGenericKey ? "" : humanizeHostKey(key),
    workspaceKey: key,
    userName: "",
    userEmail: "",
  };
}


function mergeWorkspaceMeta(currentMeta, nextMeta) {
  return {
    workspaceName: pickFirstWorkspaceName(
      nextMeta?.workspaceName,
      currentMeta?.workspaceName
    ),
    workspaceKey: pickFirstString(
      nextMeta?.workspaceKey,
      currentMeta?.workspaceKey
    ),
    userName: pickFirstString(nextMeta?.userName, currentMeta?.userName),
    userEmail: pickFirstString(nextMeta?.userEmail, currentMeta?.userEmail),
  };
}

function GlobalWarningRibbon({
  statsMessage = "",
  emailVisible = false,
  email = "",
  emailNotice = null,
  sending = false,
  onVerify,
  onResend,
  onClose,
}) {
  const hasStatsMessage = Boolean(s(statsMessage));
  if (!hasStatsMessage && !emailVisible) return null;

  const title = emailVisible
    ? "Verify your email to secure this workspace"
    : "Workspace stats unavailable";

  const description = emailVisible
    ? emailNotice?.message ||
      `We sent a 6-digit verification code${email ? ` to ${email}` : ""}. Some sensitive actions stay limited until verification is complete.`
    : s(statsMessage);

  const statsInline =
    emailVisible && hasStatsMessage ? `Workspace stats unavailable · ${s(statsMessage)}` : "";

  return (
    <div className="fixed left-0 right-0 top-0 z-[120] h-[42px] border-b border-[#d8c35c] bg-[#f7e995] text-[#5f4a00]">
      <div className="flex h-full items-center gap-3 px-4">
        <img
          src={warningIcon}
          alt=""
          className="h-[13px] w-[13px] shrink-0 object-contain"
          draggable="false"
        />

        <div className="min-w-0 flex-1 truncate text-[12px] leading-[1.15] tracking-[-0.01em]">
          <div className="truncate">
            <span className="mr-2 font-semibold">{title}</span>
            {statsInline ? (
              <span className="font-medium opacity-85">{statsInline}</span>
            ) : null}
          </div>

          <div className="truncate font-medium opacity-85">
            {description}
          </div>
        </div>

        {emailVisible ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onVerify}
              className="inline-flex h-8 items-center rounded-[10px] bg-[#5f4a00] px-3 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Verify now
            </button>

            <button
              type="button"
              onClick={onResend}
              disabled={sending}
              className="inline-flex h-8 items-center gap-2 rounded-[10px] border border-[#d2a23d] bg-[#fff3c6] px-3 text-[12px] font-semibold text-[#5f4a00] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Mail className="h-3.5 w-3.5" strokeWidth={2.2} />
              {sending ? "Sending..." : "Resend code"}
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          title="Dismiss"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[#6f5600]/80 transition-colors hover:bg-[#edd96f] hover:text-[#5f4a00]"
        >
          <X className="h-[14px] w-[14px]" strokeWidth={2.1} />
        </button>
      </div>
    </div>
  );
}

function getInitialCollapsedState() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
}

export default function Shell() {
  const [mobileOpen, setMobileOpen] = useState(false);  const [shellStats, setShellStats] = useState(INITIAL_SHELL_STATS);
  const [workspaceMeta] = useState(() =>
    mergeWorkspaceMeta(INITIAL_WORKSPACE_META, buildHostFallbackMeta())
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    getInitialCollapsedState
  );
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [emailVerificationState, setEmailVerificationState] = useState(
    INITIAL_EMAIL_VERIFICATION_STATE
  );
  const [emailVerificationDismissed, setEmailVerificationDismissed] =
    useState(false);
  const [emailVerificationNotice, setEmailVerificationNotice] = useState(null);
  const [emailVerificationSending, setEmailVerificationSending] =
    useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const notifications = useNotificationsSurface();

  const refreshTimerRef = useRef(0);
  const statsRequestRef = useRef(null);
  const warningMessageRef = useRef(INITIAL_SHELL_STATS.message);  const shellMode = useMemo(
    () => resolveShellMode(location.pathname),
    [location.pathname]
  );

  const loadShellStats = useCallback(async () => {
    if (statsRequestRef.current) return statsRequestRef.current;

    const request = Promise.all([
      fetchShellResource("/api/inbox/threads"),
      fetchShellResource("/api/leads"),
    ])
      .then(([inboxRes, leadsRes]) => {
        const nextStats = buildShellStatsFromResponses(inboxRes, leadsRes);
        const nextMessage = String(nextStats.message || "");

        if (warningMessageRef.current !== nextMessage) {
          warningMessageRef.current = nextMessage;

          if (nextMessage) {
            setWarningDismissed(false);
          }
        }

        setShellStats((prev) => ({
          ...prev,
          ...nextStats,
          message: nextMessage,
        }));
      })
      .finally(() => {
        if (statsRequestRef.current === request) {
          statsRequestRef.current = null;
        }
      });

    statsRequestRef.current = request;
    return request;
  }, []);

  const scheduleShellRefresh = useCallback(
    (delay = 160) => {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        loadShellStats();
      }, delay);
    },
    [loadShellStats]
  );  useEffect(() => {
    const unsubscribeStatus = realtimeStore.subscribeStatus((status) => {
      setShellStats((prev) => ({
        ...prev,
        wsState: String(status?.state || "idle"),
      }));
    });

    const unsubscribeEvents = realtimeStore.subscribeEvents((event) => {
      const type = String(event?.type || "");
      if (SHELL_REFRESH_EVENT_TYPES.has(type)) {
        scheduleShellRefresh(120);
      }
    });

    return () => {
      clearTimeout(refreshTimerRef.current);
      unsubscribeEvents();
      unsubscribeStatus();
    };
  }, [scheduleShellRefresh]);

  const handleResendVerificationCode = useCallback(async () => {
    if (emailVerificationSending) return;

    try {
      setEmailVerificationSending(true);
      setEmailVerificationNotice(null);

      const result = await resendVerificationEmail();

      if (result?.alreadyVerified) {
        clearAppAuthContext();
        setEmailVerificationState((current) => ({
          ...current,
          visible: false,
        }));
        setEmailVerificationNotice({
          tone: "success",
          message: "Email already verified.",
        });
        return;
      }

      if (result?.sent) {
        setEmailVerificationNotice({
          tone: "success",
          message: "Verification code sent. Check your inbox.",
        });
        return;
      }

      setEmailVerificationNotice({
        tone: "warning",
        message:
          "Verification code was created, but email delivery is not configured yet.",
      });
    } catch (error) {
      const retryAfter = error?.payload?.retryAfterSeconds;

      setEmailVerificationNotice({
        tone: "danger",
        message: retryAfter
          ? `Wait ${retryAfter} seconds before requesting another code.`
          : s(error?.payload?.error || error?.message) ||
            "Could not resend verification code.",
      });
    } finally {
      setEmailVerificationSending(false);
    }
  }, [emailVerificationSending]);  const shellSidebarWidth = sidebarCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH
    : SIDEBAR_WIDTH;

  const topWarningVisible = Boolean(shellStats?.message) && !warningDismissed;
  const emailVerificationVisible =
    emailVerificationState.loading !== true &&
    emailVerificationState.visible === true &&
    !emailVerificationDismissed;
  const topBannerVisible = topWarningVisible || emailVerificationVisible;
  const topOffset = topBannerVisible ? GLOBAL_ALERT_HEIGHT : 0;
  const standardFullBleed = ["/customers", "/leads", "/reports", "/channels", "/team", "/settings"].some((prefix) => String(location.pathname || "").startsWith(prefix));


  return (
    <div
      className="relative h-screen overflow-hidden bg-white text-text"
      style={{
        "--shell-sidebar-w": `${shellSidebarWidth}px`,
        "--shell-top-offset": `${topOffset}px`,
      }}
    >
      <GlobalWarningRibbon
        statsMessage={topWarningVisible ? shellStats?.message : ""}
        emailVisible={emailVerificationVisible}
        email={emailVerificationState.email}
        emailNotice={emailVerificationNotice}
        sending={emailVerificationSending}
        onVerify={() => navigate("/verify-email?sent=1")}
        onResend={handleResendVerificationCode}
        onClose={() => {
          if (topWarningVisible) setWarningDismissed(true);
          if (emailVerificationVisible) setEmailVerificationDismissed(true);
        }}
      />
<div className="pointer-events-none fixed inset-0 -z-[8] bg-white" />

      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        shellStats={shellStats}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        topOffset={topOffset}
      />

      <div
        className="pointer-events-none fixed left-0 right-0 z-[58]"
        style={{
          top: `${topOffset + HEADER_HEIGHT}px`,
          height: "1px",
          background: "rgba(15,23,42,0.045)",
          boxShadow: "0 12px 20px -18px rgba(15,23,42,0.16)",
        }}
      />

      <div className="relative z-[2] flex h-full min-h-0 flex-col bg-white pt-[var(--shell-top-offset)] transition-[padding-left,padding-top] duration-slow ease-premium md:pl-[var(--shell-sidebar-w)]">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          notifications={notifications}
          shellStats={shellStats}
          workspaceMeta={workspaceMeta}
        />

        <main className="relative min-h-0 flex-1 overflow-hidden bg-white">
          {shellMode === "immersive" ? (
            <div className="page-scroll h-full min-h-0 overflow-y-auto bg-white p-6 box-border [&>*]:min-h-0">
              <Outlet />
            </div>
          ) : (
            <div className="page-scroll h-full min-h-0 overflow-y-auto bg-white">
              <div
                className={
                  standardFullBleed
                    ? "relative min-h-full w-full bg-white pb-10 pt-6"
                    : "relative mx-auto min-h-full w-full max-w-shell-content bg-white px-6 pb-10 pt-6"
                }
              >
                <Outlet />
              </div>
            </div>
          )}
        </main>
</div>
    </div>
  );
}




