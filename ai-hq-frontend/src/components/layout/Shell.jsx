import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { apiGet } from "../../api/client.js";
import { useNotificationsSurface } from "../../hooks/useNotificationsSurface.js";
import { realtimeStore } from "../../lib/realtime/realtimeStore.js";
import Sidebar, { SIDEBAR_WIDTH, SHELL_TOPBAR_HEIGHT } from "./Sidebar.jsx";
import Header from "./Header.jsx";
import AskAIWidget from "./AskAIWidget.jsx";
import {
  getActiveContextItem,
  getActiveShellSection,
} from "./shellNavigation.js";

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

const INITIAL_SHELL_STATS = {
  inboxUnread: null,
  inboxOpen: null,
  leadsOpen: null,
  dbDisabled: false,
  wsState: "idle",
  availability: "loading",
  message: "",
};

export default function Shell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shellStats, setShellStats] = useState(INITIAL_SHELL_STATS);

  const location = useLocation();
  const notifications = useNotificationsSurface();

  const refreshTimerRef = useRef(0);
  const statsRequestRef = useRef(null);

  const shellSection = getActiveShellSection(location.pathname);
  const activeContextItem = getActiveContextItem(shellSection, location.pathname);

  const isImmersiveRoute =
    location.pathname.startsWith("/inbox") ||
    location.pathname.startsWith("/comments") ||
    location.pathname.startsWith("/voice") ||
    location.pathname.startsWith("/channels");

  const loadShellStats = useCallback(async () => {
    if (statsRequestRef.current) return statsRequestRef.current;

    const request = Promise.all([
      fetchShellResource("/api/inbox/threads"),
      fetchShellResource("/api/leads"),
    ])
      .then(([inboxRes, leadsRes]) => {
        const failedResponse = [inboxRes, leadsRes].find((entry) => !entry?.ok);

        if (failedResponse) {
          setShellStats((prev) => ({
            ...prev,
            inboxUnread: null,
            inboxOpen: null,
            leadsOpen: null,
            dbDisabled: false,
            availability: "unavailable",
            message:
              failedResponse.message ||
              "Shared workspace stats are temporarily unavailable.",
          }));
          return;
        }

        const inboxData = inboxRes.data;
        const leadsData = leadsRes.data;
        const threads = Array.isArray(inboxData?.threads) ? inboxData.threads : [];
        const leads = Array.isArray(leadsData?.leads) ? leadsData.leads : [];

        const inboxUnread = threads.reduce(
          (sum, thread) => sum + Number(thread?.unread_count || 0),
          0
        );

        const leadsOpen = leads.filter(
          (lead) => String(lead?.status || "open").toLowerCase() === "open"
        ).length;

        setShellStats((prev) => ({
          ...prev,
          inboxUnread,
          inboxOpen: threads.length,
          leadsOpen,
          dbDisabled: Boolean(inboxData?.dbDisabled || leadsData?.dbDisabled),
          availability: "ready",
          message: "",
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
      refreshTimerRef.current = setTimeout(() => {
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

      if (
        type === "inbox.message.created" ||
        type === "inbox.thread.updated" ||
        type === "inbox.thread.read" ||
        type === "inbox.thread.created" ||
        type === "lead.created" ||
        type === "lead.updated"
      ) {
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
          className={
            isImmersiveRoute
              ? "bg-canvas px-0 py-0"
              : "bg-canvas px-3 py-3 md:px-4 md:py-4 xl:px-6 xl:py-5"
          }
          style={{
            minHeight: `calc(100vh - ${SHELL_TOPBAR_HEIGHT}px)`,
          }}
        >
          <div
            className={
              isImmersiveRoute ? "h-full w-full" : "mx-auto max-w-shell-content"
            }
          >
            {!isImmersiveRoute && shellStats?.message ? (
              <div className="mb-4 rounded-md border border-line bg-surface px-4 py-3 text-sm text-text-muted">
                {shellStats.message}
              </div>
            ) : null}

            <Outlet />
          </div>
        </main>
      </div>

      <AskAIWidget
        shellSection={shellSection}
        activeContextItem={activeContextItem}
        shellStats={shellStats}
      />
    </div>
  );
}
