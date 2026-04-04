import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { apiGet } from "../../api/client.js";
import { useNotificationsSurface } from "../../hooks/useNotificationsSurface.js";
import { realtimeStore } from "../../lib/realtime/realtimeStore.js";
import { InlineNotice } from "../ui/AppShellPrimitives.jsx";
import Sidebar, { SIDEBAR_WIDTH, SHELL_TOPBAR_HEIGHT } from "./Sidebar.jsx";
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

function isImmersivePath(pathname = "") {
  const path = String(pathname || "");
  return (
    path.startsWith("/inbox") ||
    path.startsWith("/comments") ||
    path.startsWith("/voice") ||
    path.startsWith("/channels")
  );
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
      className="mb-3"
      compact
    />
  );
}

export default function Shell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shellStats, setShellStats] = useState(INITIAL_SHELL_STATS);

  const location = useLocation();
  const notifications = useNotificationsSurface();

  const refreshTimerRef = useRef(0);
  const statsRequestRef = useRef(null);

  const shellSection = getActiveShellSection(location.pathname);
  const activeContextItem = getActiveContextItem(shellSection, location.pathname);

  const immersive = useMemo(
    () => isImmersivePath(location.pathname),
    [location.pathname]
  );

  const shellPaddingClass = immersive
    ? "px-0 py-0"
    : "px-4 py-4 md:px-5 md:py-5 xl:px-6 xl:py-6";

  const shellContentClass = immersive
    ? "h-full w-full"
    : "mx-auto w-full max-w-shell-content";

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
    setMobileOpen(false);
    loadShellStats();
  }, [location.pathname, loadShellStats]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = mobileOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

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

  return (
    <div
      className="min-h-screen bg-canvas text-text"
      style={{ "--shell-sidebar-w": `${SIDEBAR_WIDTH}px` }}
    >
      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        shellStats={shellStats}
      />

      <div className="min-h-screen md:pl-[var(--shell-sidebar-w)]">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          notifications={notifications}
          shellSection={shellSection}
          activeContextItem={activeContextItem}
        />

        <main
          className={shellPaddingClass}
          style={{
            minHeight: `calc(100vh - ${SHELL_TOPBAR_HEIGHT}px)`,
          }}
        >
          <div className={shellContentClass}>
            {!immersive ? (
              <SharedStatsNotice message={shellStats?.message} />
            ) : null}

            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
