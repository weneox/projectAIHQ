import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiGet } from "../../api/client.js";
import { useNotificationsSurface } from "../../hooks/useNotificationsSurface.js";
import { SETUP_WIDGET_ROUTE } from "../../lib/appEntry.js";
import { cx } from "../../lib/cx.js";
import { realtimeStore } from "../../lib/realtime/realtimeStore.js";
import useProductHome from "../../view-models/useProductHome.js";
import { InlineNotice } from "../ui/AppShellPrimitives.jsx";
import FloatingAiWidget from "./FloatingAiWidget.jsx";
import Sidebar, {
  SHELL_TOPBAR_HEIGHT,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_WIDTH,
} from "./Sidebar.jsx";
import Header from "./Header.jsx";

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
  workspaceName: "Workspace",
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

const HOME_ASSISTANT_FALLBACK = {
  mode: "setup",
  title: "AI setup lives on Home",
  statusLabel: "Home",
  summary:
    "Open Home to connect the active launch channel, continue setup, and inspect truth and runtime posture.",
  primaryAction: {
    label: "Open home assistant",
    path: SETUP_WIDGET_ROUTE,
  },
  secondaryAction: {
    label: "Open channels",
    path: "/channels",
  },
};

const LOADING_ASSISTANT_FALLBACK = {
  ...HOME_ASSISTANT_FALLBACK,
  title: "Loading AI setup",
  statusLabel: "Loading",
  summary: "Preparing the current Home setup state for the assistant.",
  primaryAction: {
    label: "Open home",
    path: "/home",
  },
};

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
  const name = key
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

  return {
    workspaceName: name,
    workspaceKey: key,
    userName: "",
    userEmail: "",
  };
}

function extractWorkspaceMeta(payload) {
  const root = obj(payload);
  const workspace = obj(
    root.workspace ||
      root.tenant ||
      root.account ||
      obj(root.bootstrap).workspace ||
      obj(root.bootstrap).tenant ||
      obj(root.session).workspace
  );

  const user = obj(
    root.user ||
      root.profile ||
      obj(root.session).user ||
      obj(root.auth).user
  );

  const membership = obj(arr(root.memberships)[0]);

  const workspaceName = pickFirstString(
    workspace.displayName,
    workspace.name,
    workspace.workspaceName,
    workspace.tenantName,
    membership.workspaceName,
    membership.tenantName,
    root.workspaceName,
    root.tenantName
  );

  const workspaceKey = pickFirstString(
    workspace.key,
    workspace.slug,
    workspace.workspaceKey,
    workspace.tenantKey,
    membership.workspaceKey,
    membership.tenantKey,
    root.workspaceKey,
    root.tenantKey
  );

  const userName = pickFirstString(
    user.name,
    user.fullName,
    user.displayName,
    root.userName
  );

  const userEmail = pickFirstString(
    user.email,
    root.userEmail,
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
    workspaceName: pickFirstString(nextMeta?.workspaceName, currentMeta?.workspaceName),
    workspaceKey: pickFirstString(nextMeta?.workspaceKey, currentMeta?.workspaceKey),
    userName: pickFirstString(nextMeta?.userName, currentMeta?.userName),
    userEmail: pickFirstString(nextMeta?.userEmail, currentMeta?.userEmail),
  };
}

function SharedStatsNotice({ message }) {
  if (!message) return null;

  return (
    <InlineNotice
      tone="warning"
      title="Workspace stats unavailable"
      description={message}
      className="mb-5"
      compact
    />
  );
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

  const location = useLocation();
  const navigate = useNavigate();
  const notifications = useNotificationsSurface();
  const homeRouteActive = location.pathname === "/home";

  const assistantRequested = useMemo(() => {
    if (!homeRouteActive) return false;
    const params = new URLSearchParams(location.search || "");
    return s(params.get("assistant")).toLowerCase() === "setup";
  }, [homeRouteActive, location.search]);

  const homeDataEnabled = homeRouteActive || widgetOpen;
  const home = useProductHome({
    enabled: homeDataEnabled,
  });

  const refreshTimerRef = useRef(0);
  const statsRequestRef = useRef(null);
  const shellMode = useMemo(
    () => resolveShellMode(location.pathname),
    [location.pathname]
  );

  const assistantModel = useMemo(() => {
    if (home.assistant) return home.assistant;
    return homeDataEnabled && home.loading
      ? LOADING_ASSISTANT_FALLBACK
      : HOME_ASSISTANT_FALLBACK;
  }, [home.assistant, home.loading, homeDataEnabled]);

  const loadShellStats = useCallback(async () => {
    if (statsRequestRef.current) return statsRequestRef.current;

    const request = Promise.all([
      fetchShellResource("/api/inbox/threads"),
      fetchShellResource("/api/leads"),
    ])
      .then(([inboxRes, leadsRes]) => {
        const nextStats = buildShellStatsFromResponses(inboxRes, leadsRes);

        setShellStats((prev) => ({
          ...prev,
          ...nextStats,
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
        setWorkspaceMeta((prev) => mergeWorkspaceMeta(prev, extracted));
      } catch {
        if (cancelled) return;
        setWorkspaceMeta((prev) => mergeWorkspaceMeta(prev, buildHostFallbackMeta()));
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

  const handleAssistantNavigate = useCallback(
    (path = "") => {
      const target = s(path);
      if (!target) return;
      setWidgetOpen(false);
      navigate(target);
    },
    [navigate]
  );

  const shellSidebarWidth = sidebarCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH
    : SIDEBAR_WIDTH;

  const contentMinHeight = `calc(100vh - ${SHELL_TOPBAR_HEIGHT}px)`;
  const pageTransition = {
    duration: 0.2,
    ease: [0.22, 1, 0.36, 1],
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden text-text"
      style={{ "--shell-sidebar-w": `${shellSidebarWidth}px` }}
    >
      <div className="pointer-events-none fixed inset-0 -z-[6] bg-[linear-gradient(180deg,#f4f5f7_0%,#f6f7f9_100%)]" />

      <div className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden">
        <div className="absolute left-[6%] top-[-90px] h-[240px] w-[240px] rounded-full bg-[radial-gradient(circle,rgba(46,96,255,0.08)_0%,rgba(46,96,255,0.02)_44%,rgba(46,96,255,0)_74%)] blur-3xl" />
      </div>

      <div
        className="pointer-events-none fixed inset-y-0 left-0 z-[1] hidden bg-white shadow-[inset_-1px_0_0_rgba(15,23,42,0.06)] transition-[width] duration-slow ease-premium md:block"
        style={{ width: "var(--shell-sidebar-w)" }}
      />

      <div
        className="pointer-events-none fixed left-0 right-0 top-0 z-[1] bg-white shadow-[inset_0_-1px_0_rgba(15,23,42,0.06)]"
        style={{ height: `${SHELL_TOPBAR_HEIGHT}px` }}
      />

      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        shellStats={shellStats}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      <div className="relative z-[2] min-h-screen transition-[padding-left] duration-slow ease-premium md:pl-[var(--shell-sidebar-w)]">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          notifications={notifications}
          shellStats={shellStats}
          workspaceMeta={workspaceMeta}
        />

        <main
          className={cx(
            "relative",
            shellMode === "immersive"
              ? "overflow-hidden"
              : "page-scroll overflow-y-auto"
          )}
          style={{ minHeight: contentMinHeight }}
        >
          {shellMode === "immersive" ? (
            <div style={{ height: contentMinHeight }} className="min-h-0 overflow-hidden">
              <Outlet />
            </div>
          ) : (
            <div className="relative mx-auto w-full max-w-shell-content px-5 py-6 md:px-7 md:py-7">
              <SharedStatsNotice message={shellStats?.message} />

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${location.pathname}${location.search}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={pageTransition}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </main>

        <FloatingAiWidget
          open={widgetOpen}
          onOpenChange={handleWidgetOpenChange}
          onNavigate={handleAssistantNavigate}
          assistant={assistantModel}
        />
      </div>
    </div>
  );
}