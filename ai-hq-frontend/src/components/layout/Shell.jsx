import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Header from "./Header.jsx";
import { useNotificationsSurface } from "../../hooks/useNotificationsSurface.js";
import { realtimeStore } from "../../lib/realtime/realtimeStore.js";
import { apiGet } from "../../api/client.js";
import {
  getActiveContextItem,
  getActiveShellSection,
} from "./shellNavigation.js";

const SHELL_SIDEBAR_W = 184;

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

export default function Shell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const notifications = useNotificationsSurface();
  const refreshTimerRef = useRef(0);

  const [shellStats, setShellStats] = useState({
    inboxUnread: null,
    inboxOpen: null,
    leadsOpen: null,
    dbDisabled: false,
    wsState: "idle",
    availability: "loading",
    message: "",
  });

  const shellSection = getActiveShellSection(location.pathname);
  const activeContextItem = getActiveContextItem(shellSection, location.pathname);
  const isInboxRoute = location.pathname.startsWith("/inbox");
  const isChannelsRoute = location.pathname.startsWith("/channels");
  const hideTopHeader = isInboxRoute || isChannelsRoute;

  async function loadShellStats() {
    const [inboxRes, leadsRes] = await Promise.all([
      fetchShellResource("/api/inbox/threads"),
      fetchShellResource("/api/leads"),
    ]);

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
    const inboxOpen = threads.filter((thread) => {
      const status = String(thread?.status || "open").toLowerCase();
      return status !== "resolved" && status !== "closed";
    }).length;
    const leadsOpen = leads.filter(
      (lead) => String(lead?.status || "open").toLowerCase() === "open"
    ).length;

    setShellStats((prev) => ({
      ...prev,
      inboxUnread,
      inboxOpen,
      leadsOpen,
      dbDisabled: Boolean(inboxData?.dbDisabled || leadsData?.dbDisabled),
      availability: "ready",
      message: "",
    }));
  }

  function scheduleShellRefresh(delay = 180) {
    clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      loadShellStats();
    }, delay);
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverflowX = document.body.style.overflowX;
    const previousOverflowY = document.body.style.overflowY;

    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.body.style.overflowX = "hidden";
      document.body.style.overflowY = "auto";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overflowX = previousOverflowX;
      document.body.style.overflowY = previousOverflowY;
    };
  }, [mobileOpen]);

  useEffect(() => {
    loadShellStats();
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    loadShellStats();
  }, [location.pathname]);

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
  }, []);

  return (
    <div
      className={[
        "premium-page bg-transparent text-slate-950 selection:bg-slate-900 selection:text-white",
        isInboxRoute ? "h-screen overflow-hidden" : "min-h-screen",
      ].join(" ")}
      style={{
        "--shell-sidebar-w": `${SHELL_SIDEBAR_W}px`,
      }}
    >
      <div className="pointer-events-none fixed inset-0 -z-20 bg-[linear-gradient(180deg,#f3f4f4_0%,#eef1f2_100%)]" />

      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        shellStats={shellStats}
      />

      <div
        className={[
          "md:pl-[var(--shell-sidebar-w)]",
          isInboxRoute ? "h-screen overflow-hidden" : "min-h-screen",
        ].join(" ")}
      >
        {!hideTopHeader ? (
          <Header
            onMenuClick={() => setMobileOpen(true)}
            shellStats={shellStats}
            notifications={notifications}
            shellSection={shellSection}
            activeContextItem={activeContextItem}
          />
        ) : null}

        <main
          className={
            isInboxRoute
              ? "h-full overflow-hidden p-0"
              : hideTopHeader
                ? "min-h-screen px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-8"
                : "min-h-[calc(100vh-72px)] px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-8"
          }
        >
          <div
            className={
              isInboxRoute
                ? "h-full w-full overflow-hidden"
                : "mx-auto w-full max-w-[1480px]"
            }
          >
            {!isInboxRoute && shellStats?.message ? (
              <div className="premium-panel-subtle mb-4 px-4 py-3 text-sm text-amber-800">
                {shellStats.message}
              </div>
            ) : null}

            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}