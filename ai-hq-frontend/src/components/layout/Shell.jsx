import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiGet } from "../../api/client.js";
import { useNotificationsSurface } from "../../hooks/useNotificationsSurface.js";
import { realtimeStore } from "../../lib/realtime/realtimeStore.js";
import useProductHome from "../../view-models/useProductHome.js";
import FloatingAiWidget from "../layout/FloatingAiWidget.jsx";
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
    <div className="mb-4 border-b border-[rgba(185,28,28,0.12)] pb-3">
      <div className="text-[12px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.92)]">
        Workspace stats unavailable
      </div>
      <div className="mt-1 text-[13px] leading-6 text-[rgba(15,23,42,0.58)]">
        {message}
      </div>
    </div>
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
    const params = new URLSearchParams(location.search || "");
    return s(params.get("assistant")).toLowerCase() === "setup";
  }, [location.search]);

  const homeDataEnabled =
    homeRouteActive || widgetOpen || assistantRequested;

  const home = useProductHome({
    enabled: homeDataEnabled,
  });

  const refreshTimerRef = useRef(0);
  const statsRequestRef = useRef(null);
  const autoOpenedRef = useRef("");

  const shellMode = useMemo(
    () => resolveShellMode(location.pathname),
    [location.pathname]
  );

  const shortcutAssistant = useMemo(
    () => ({
      mode: "shortcut",
      title: "AI setup lives on Home",
      statusLabel: "Home shortcut",
      summary:
        "Use Home to connect the launch channel, continue setup, and inspect truth and runtime posture.",
      primaryAction: {
        label: "Open home assistant",
        path: "/home?assistant=setup",
      },
      secondaryAction: {
        label: "Open channels",
        path: "/channels",
      },
      messages: [
        {
          id: "shortcut",
          role: "assistant",
          title: "Open Home",
          body:
            "The setup flow is available on Home, where launch channel, setup draft, and runtime posture are already aligned.",
        },
      ],
      review: {
        message:
          "Draft-only setup remains intentionally separate from truth approval and runtime activation in this batch.",
      },
      launchPosture: "shortcut",
      setupNeeded: false,
      session: {},
      draft: {
        businessProfile: {},
        services: [],
        contacts: [],
        hours: [],
        pricingPosture: {},
        handoffRules: {},
        version: 0,
        updatedAt: null,
      },
      websitePrefill: {
        supported: true,
        status: "awaiting_input",
        websiteUrl: "",
      },
      launchChannel: {
        id: "shortcut-launch",
        type: "launch_channel",
        provider: "",
        connected: false,
        available: true,
        status: "shortcut",
        statusLabel: "Home shortcut",
        title: "Launch channel posture lives on Home",
        summary:
          "Open Home to inspect Instagram or Telegram launch posture in one place.",
        detail:
          "Home resolves the current launch channel and keeps setup, truth, runtime, and inbox posture aligned.",
        action: {
          label: "Open channels",
          path: "/channels",
        },
        deliveryReady: false,
        reasonCode: "",
        channelLabel: "Launch channel",
        accountLabel: "",
        accountDisplayName: "",
        accountHandle: "",
        account: {},
      },
      truthRuntime: {},
    }),
    []
  );

  const loadingAssistant = useMemo(
    () => ({
      ...shortcutAssistant,
      mode: "setup",
      title: "Loading AI setup",
      statusLabel: "Loading",
      summary:
        "Preparing launch channel, setup draft, and strict runtime posture for the assistant.",
      primaryAction: {
        label: "Open home",
        path: "/home",
      },
      secondaryAction: {
        label: "Open channels",
        path: "/channels",
      },
      messages: [
        {
          id: "loading",
          role: "assistant",
          title: "Loading setup posture",
          body:
            "The assistant is waiting for the current Home state before it suggests the next step.",
        },
      ],
    }),
    [shortcutAssistant]
  );

  const assistantModel = useMemo(() => {
    if (!homeDataEnabled) return shortcutAssistant;
    if (home.loading) return loadingAssistant;
    return home.assistant || loadingAssistant;
  }, [
    homeDataEnabled,
    home.loading,
    home.assistant,
    loadingAssistant,
    shortcutAssistant,
  ]);

  const setupFlow = home.setupFlow || {};
  const autoOpenKey =
    homeRouteActive && setupFlow.autoOpen
      ? [
          s(setupFlow.launchPosture),
          s(setupFlow.sessionId, "no-session"),
          String(setupFlow.draftVersion || 0),
        ].join(":")
      : "";

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
    if (!homeRouteActive || !setupFlow.autoOpen || !autoOpenKey) {
      return undefined;
    }

    if (autoOpenedRef.current === autoOpenKey) return undefined;

    const frame = window.requestAnimationFrame(() => {
      autoOpenedRef.current = autoOpenKey;
      setWidgetOpen(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [autoOpenKey, homeRouteActive, setupFlow.autoOpen]);

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
      className="relative h-screen overflow-hidden bg-white text-text"
      style={{ "--shell-sidebar-w": `${shellSidebarWidth}px` }}
    >
      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        shellStats={shellStats}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      <div className="relative flex h-full min-w-0 flex-col transition-[padding-left] duration-200 ease-premium md:pl-[var(--shell-sidebar-w)]">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          notifications={notifications}
        />

        <main className="relative flex-1 min-h-0 overflow-hidden bg-canvas">
          {shellMode === "immersive" ? (
            <div className="h-full min-h-0 overflow-hidden">
              <Outlet />
            </div>
          ) : (
            <div className="page-scroll h-full min-h-0 overflow-y-auto">
              <div className="mx-auto flex min-h-full w-full max-w-shell-content flex-col px-5 py-6 md:px-7 md:py-6 xl:px-8">
                <SharedStatsNotice message={shellStats?.message} />
                <div className="flex-1 min-h-0">
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