import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiGet } from "../../api/client.js";
import { useNotificationsSurface } from "../../hooks/useNotificationsSurface.js";
import { realtimeStore } from "../../lib/realtime/realtimeStore.js";
import FloatingAiWidget from "./FloatingAiWidget.jsx";
import EmailVerificationBanner from "../auth/EmailVerificationBanner.jsx";
import Sidebar, {
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
  if (path.startsWith("/inbox")) return "immersive";
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

function extractWorkspaceMeta(payload) {
  const root = obj(payload);
  const bootstrap = obj(root.bootstrap);
  const session = obj(root.session);
  const auth = obj(root.auth);

  const workspace = obj(
    root.workspace ||
      bootstrap.workspace ||
      session.workspace ||
      auth.workspace ||
      root.account
  );

  const tenant = obj(
    root.tenant ||
      bootstrap.tenant ||
      workspace.tenant ||
      session.tenant ||
      auth.tenant ||
      bootstrap.workspace?.tenant ||
      auth.workspace?.tenant
  );

  const membership = obj(
    root.membership ||
      bootstrap.membership ||
      session.membership ||
      auth.membership ||
      arr(root.memberships)[0] ||
      arr(auth.memberships)[0]
  );

  const user = obj(
    root.user ||
      root.profile ||
      root.viewer ||
      bootstrap.viewer ||
      session.user ||
      auth.user
  );

  const workspaceName = pickFirstWorkspaceName(
    workspace.displayName,
    workspace.display_name,
    workspace.companyName,
    workspace.company_name,
    workspace.businessName,
    workspace.business_name,
    workspace.name,
    workspace.workspaceName,
    workspace.workspace_name,
    workspace.tenantName,
    workspace.tenant_name,

    tenant.displayName,
    tenant.display_name,
    tenant.companyName,
    tenant.company_name,
    tenant.businessName,
    tenant.business_name,
    tenant.name,
    tenant.workspaceName,
    tenant.workspace_name,
    tenant.tenantName,
    tenant.tenant_name,

    membership.workspaceName,
    membership.workspace_name,
    membership.companyName,
    membership.company_name,
    membership.tenantName,
    membership.tenant_name,

    root.workspaceName,
    root.workspace_name,
    root.companyName,
    root.company_name,
    root.businessName,
    root.business_name,
    root.tenantName,
    root.tenant_name,

    bootstrap.workspaceName,
    bootstrap.workspace_name,
    bootstrap.companyName,
    bootstrap.company_name,
    bootstrap.businessName,
    bootstrap.business_name,
    bootstrap.tenantName,
    bootstrap.tenant_name,

    session.workspaceName,
    session.workspace_name,
    session.companyName,
    session.company_name,
    session.tenantName,
    session.tenant_name,

    auth.workspaceName,
    auth.workspace_name,
    auth.companyName,
    auth.company_name,
    auth.tenantName,
    auth.tenant_name
  );

  const workspaceKey = pickFirstString(
    workspace.key,
    workspace.slug,
    workspace.workspaceKey,
    workspace.workspace_key,
    workspace.tenantKey,
    workspace.tenant_key,

    tenant.key,
    tenant.slug,
    tenant.workspaceKey,
    tenant.workspace_key,
    tenant.tenantKey,
    tenant.tenant_key,

    membership.workspaceKey,
    membership.workspace_key,
    membership.tenantKey,
    membership.tenant_key,

    root.workspaceKey,
    root.workspace_key,
    root.tenantKey,
    root.tenant_key,

    bootstrap.workspaceKey,
    bootstrap.workspace_key,
    bootstrap.tenantKey,
    bootstrap.tenant_key,

    session.workspaceKey,
    session.workspace_key,
    session.tenantKey,
    session.tenant_key,

    auth.workspaceKey,
    auth.workspace_key,
    auth.tenantKey,
    auth.tenant_key
  );

  const userName = pickFirstString(
    user.name,
    user.fullName,
    user.full_name,
    user.displayName,
    user.display_name,
    root.userName,
    root.user_name,
    root.viewerName,
    root.viewer_name
  );

  const userEmail = pickFirstString(
    user.email,
    user.user_email,
    root.userEmail,
    root.user_email,
    membership.email
  );

  return {
    workspaceName,
    workspaceKey,
    userName,
    userEmail,
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

function getInitialCollapsedState() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
}

export default function Shell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [shellStats, setShellStats] = useState(INITIAL_SHELL_STATS);
  const [workspaceMeta, setWorkspaceMeta] = useState(() =>
    mergeWorkspaceMeta(INITIAL_WORKSPACE_META, buildHostFallbackMeta())
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    getInitialCollapsedState
  );
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [topBannerActive, setTopBannerActive] = useState(false);
  const [emailVerificationNotice, setEmailVerificationNotice] = useState(null);
  const [emailVerificationSending, setEmailVerificationSending] =
    useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const notifications = useNotificationsSurface();

  const refreshTimerRef = useRef(0);
  const statsRequestRef = useRef(null);
  const warningMessageRef = useRef(INITIAL_SHELL_STATS.message);

  const assistantRequested = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    return s(params.get("assistant")).toLowerCase() === "setup";
  }, [location.search]);

  const shellMode = useMemo(
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
  );


  useEffect(() => {
    let cancelled = false;

    const loadWorkspaceMeta = async () => {
      try {
        const response = await apiGet("/api/app/bootstrap");
        if (cancelled) return;

        const extracted = extractWorkspaceMeta(response);
        const hostFallback = buildHostFallbackMeta();

        setWorkspaceMeta((prev) =>
          mergeWorkspaceMeta(mergeWorkspaceMeta(prev, hostFallback), extracted)
        );
      } catch {
        if (cancelled) return;

        setWorkspaceMeta((prev) =>
          mergeWorkspaceMeta(prev, buildHostFallbackMeta())
        );
      }
    };

    loadWorkspaceMeta();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      sidebarCollapsed ? "1" : "0"
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMobileOpen(false);
    });

    loadShellStats();

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [location.pathname, loadShellStats]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = mobileOpen || widgetOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen, widgetOpen]);

  useEffect(() => {
    if (!assistantRequested) return undefined;

    const frame = window.requestAnimationFrame(() => {
      setWidgetOpen(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [assistantRequested]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function handleTopBannerVisibility(event) {
      setTopBannerActive(Boolean(event?.detail?.visible));
    }

    window.addEventListener(
      "aihq:top-banner-visibility",
      handleTopBannerVisibility
    );

    return () => {
      window.removeEventListener(
        "aihq:top-banner-visibility",
        handleTopBannerVisibility
      );
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleOpenAssistant = () => {
      setWidgetOpen(true);
    };

    window.addEventListener("aihq:open-assistant", handleOpenAssistant);

    return () => {
      window.removeEventListener("aihq:open-assistant", handleOpenAssistant);
    };
  }, []);

  useEffect(() => {
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


  const handleWidgetOpenChange = useCallback(
    (nextOpen) => {
      setWidgetOpen(Boolean(nextOpen));

      if (!nextOpen && assistantRequested) {
        const params = new URLSearchParams(location.search || "");
        params.delete("assistant");
        navigate(
          {
            pathname: location.pathname,
            search: params.toString() ? `?${params.toString()}` : "",
          },
          { replace: true }
        );
      }
    },
    [assistantRequested, location.pathname, location.search, navigate]
  );

  const shellSidebarWidth = sidebarCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH
    : SIDEBAR_WIDTH;

  const statsBannerVisible = Boolean(shellStats?.message) && !warningDismissed;
  const topOffset = topBannerActive ? GLOBAL_ALERT_HEIGHT : 0;


  return (
    <div
      className="relative h-screen overflow-hidden bg-white text-text"
      style={{
        "--shell-sidebar-w": `${shellSidebarWidth}px`,
        "--shell-top-offset": `${topOffset}px`,
      }}
    >
      <EmailVerificationBanner
        statsMessage={statsBannerVisible ? shellStats?.message : ""}
        onStatsDismiss={() => setWarningDismissed(true)}
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
            <div className="h-full min-h-0 overflow-hidden bg-white">
              <Outlet />
            </div>
          ) : (
            <div className="page-scroll h-full min-h-0 overflow-y-auto bg-white">
              <div className="relative mx-auto min-h-full w-full max-w-shell-content bg-white px-6 pb-10 pt-6">
                <Outlet />
              </div>
            </div>
          )}
        </main>

        <FloatingAiWidget
          open={widgetOpen}
          onOpenChange={handleWidgetOpenChange}
        />
      </div>
    </div>
  );
}


