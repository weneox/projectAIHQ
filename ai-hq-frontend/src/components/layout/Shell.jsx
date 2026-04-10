import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function resolveShellMode(pathname = "") {
  const path = String(pathname || "");
  if (path.startsWith("/inbox")) return "immersive";
  return "standard";
}

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
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

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-canvas-muted text-text"
      style={{ "--shell-sidebar-w": `${shellSidebarWidth}px` }}
    >
      <div className="pointer-events-none fixed inset-0 -z-[3] overflow-hidden">
        <div className="absolute left-[-12%] top-[-14%] h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(46,96,255,0.12)_0%,rgba(46,96,255,0.04)_42%,rgba(46,96,255,0)_72%)] blur-3xl" />
        <div className="absolute right-[-10%] top-[8%] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(15,23,42,0.10)_0%,rgba(15,23,42,0.03)_48%,rgba(15,23,42,0)_76%)] blur-3xl" />
        <div className="absolute bottom-[-14%] left-[28%] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(21,128,61,0.06)_0%,rgba(21,128,61,0.015)_54%,rgba(21,128,61,0)_76%)] blur-3xl" />
      </div>

      <div className="pointer-events-none fixed inset-y-0 left-0 z-[1] hidden border-r border-white/60 bg-surface/88 shadow-[inset_-1px_0_0_rgba(255,255,255,0.7)] backdrop-blur md:block"
        style={{ width: "var(--shell-sidebar-w)" }}
      />

      <div className="pointer-events-none fixed left-0 right-0 top-0 z-[1] h-[56px] border-b border-white/60 bg-surface/86 shadow-[inset_0_-1px_0_rgba(255,255,255,0.72)] backdrop-blur" />

      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        shellStats={shellStats}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      <div className="relative z-[2] min-h-screen md:pl-[var(--shell-sidebar-w)]">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          notifications={notifications}
        />

        <main
          className={cx(
            "relative min-h-[calc(100vh-56px)]",
            shellMode === "immersive"
              ? "overflow-hidden"
              : "page-scroll overflow-y-auto"
          )}
        >
          {shellMode === "immersive" ? (
            <div className="h-[calc(100vh-56px)] min-h-0 overflow-hidden">
              <Outlet />
            </div>
          ) : (
            <div className="relative">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[220px] bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(255,255,255,0))]" />

              <div className="relative mx-auto w-full max-w-shell-content px-5 py-6 md:px-7 md:py-7">
                <SharedStatsNotice message={shellStats?.message} />

                <div className="min-h-[calc(100vh-56px-56px)]">
                  <Outlet />
                </div>
              </div>
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