import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiGet } from "../../api/client.js";
import { useNotificationsSurface } from "../../hooks/useNotificationsSurface.js";
import { realtimeStore } from "../../lib/realtime/realtimeStore.js";
import useProductHome from "../../view-models/useProductHome.js";
import { InlineNotice } from "../ui/AppShellPrimitives.jsx";
import FloatingAiWidget from "../layout/FloatingAiWidget.jsx";
import Sidebar, {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_WIDTH,
} from "./Sidebar.jsx";
import Header from "./Header.jsx";
import {
  getActiveContextItem,
  getActiveShellSection,
} from "./shellNavigation.js";

const INITIAL_SHELL_STATS = {
  inboxUnread: null,
  inboxOpen: null,
  leadsOpen: null,
  dbDisabled: false,
  wsState: "idle",
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

function isImmersivePath(pathname = "") {
  const path = String(pathname || "");
  return (
    path.startsWith("/inbox") ||
    path.startsWith("/comments") ||
    path.startsWith("/voice") ||
    path.startsWith("/channels")
  );
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
          : "Shared workspace stats are temporarily unavailable.",
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
        failedResponse.message ||
        "Shared workspace stats are temporarily unavailable.",
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
      title="Shared workspace stats unavailable"
      description={message}
      className="mb-4"
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
  const home = useProductHome({
    enabled: homeRouteActive,
  });

  const refreshTimerRef = useRef(0);
  const statsRequestRef = useRef(null);
  const autoOpenedRef = useRef("");

  const shellSection = getActiveShellSection(location.pathname);
  const activeContextItem = getActiveContextItem(shellSection, location.pathname);

  const immersive = useMemo(
    () => isImmersivePath(location.pathname),
    [location.pathname]
  );

  const assistantRequested = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    const assistant = s(params.get("assistant")).toLowerCase();
    return assistant === "setup" || assistant === "onboarding";
  }, [location.search]);

  const shortcutAssistant = useMemo(
    () => ({
      mode: "shortcut",
      title: "AI setup lives on Home",
      statusLabel: "Home shortcut",
      summary:
        "Use Home to connect Telegram, continue the structured setup draft, and inspect strict runtime readiness.",
      primaryAction: {
        label: "Open home assistant",
        path: "/home?assistant=setup",
      },
      secondaryAction: {
        label: "Open channels",
        path: "/channels?channel=telegram",
      },
      messages: [
        {
          id: "shortcut",
          role: "assistant",
          title: "Open Home",
          body:
            "The setup shell is available on Home, where Telegram connect and runtime posture are already composed together.",
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
      launchChannel: {},
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
        "Preparing Telegram, draft, and strict runtime posture for the setup shell.",
      primaryAction: {
        label: "Open channels",
        path: "/channels?channel=telegram",
      },
      secondaryAction: {
        label: "Open home",
        path: "/home",
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
    if (!homeRouteActive) return shortcutAssistant;
    if (home.loading) return loadingAssistant;
    return home.assistant || loadingAssistant;
  }, [
    homeRouteActive,
    home.loading,
    home.assistant,
    loadingAssistant,
    shortcutAssistant,
  ]);

  const autoOpenKey = useMemo(() => {
    if (!homeRouteActive || !home.setupFlow?.autoOpen) return "";

    return [
      s(home.setupFlow.launchPosture),
      s(home.setupFlow.sessionId, "no-session"),
      String(home.setupFlow.draftVersion || 0),
    ].join(":");
  }, [
    homeRouteActive,
    home.setupFlow?.autoOpen,
    home.setupFlow?.launchPosture,
    home.setupFlow?.sessionId,
    home.setupFlow?.draftVersion,
  ]);

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
    (delay = 180) => {
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
    setMobileOpen(false);
    loadShellStats();
  }, [location.pathname, loadShellStats]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = mobileOpen || widgetOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen, widgetOpen]);

  useEffect(() => {
    if (assistantRequested) {
      setWidgetOpen(true);
    }
  }, [assistantRequested]);

  useEffect(() => {
    if (!homeRouteActive || !home.setupFlow?.autoOpen || !autoOpenKey) {
      return;
    }

    if (autoOpenedRef.current === autoOpenKey) return;

    autoOpenedRef.current = autoOpenKey;
    setWidgetOpen(true);
  }, [autoOpenKey, homeRouteActive, home.setupFlow?.autoOpen]);

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

    if (!realtimeStore.canUseWs()) {
      setShellStats((prev) => ({
        ...prev,
        wsState: "off",
      }));
    }

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
      className="h-screen overflow-hidden bg-canvas text-text"
      style={{ "--shell-sidebar-w": `${shellSidebarWidth}px` }}
    >
      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        shellStats={shellStats}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      <div className="flex h-full min-w-0 flex-col transition-[padding-left] duration-[460ms] ease-[cubic-bezier(0.22,1,0.36,1)] md:pl-[var(--shell-sidebar-w)]">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          notifications={notifications}
          shellSection={shellSection}
          activeContextItem={activeContextItem}
        />

        <main className="flex-1 min-h-0 overflow-hidden">
          {immersive ? (
            <div className="h-full min-h-0 overflow-hidden">
              <Outlet />
            </div>
          ) : (
            <div className="page-scroll h-full min-h-0 overflow-y-auto">
              <div className="mx-auto w-full max-w-shell-content px-5 py-5 md:px-6 md:py-6 xl:px-8 xl:py-7">
                <SharedStatsNotice message={shellStats?.message} />
                <Outlet />
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
