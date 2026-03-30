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

const PRIMARY_RAIL_W = 72;
const CONTEXT_RAIL_W = 248;

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
          failedResponse.message || "Shared workspace stats are temporarily unavailable.",
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
      className="min-h-screen bg-[#f3f5f7] text-slate-950 selection:bg-slate-900 selection:text-white"
      style={{
        "--primary-rail-w": `${PRIMARY_RAIL_W}px`,
        "--context-rail-w": `${CONTEXT_RAIL_W}px`,
      }}
    >
      <div className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.8),transparent_28%),linear-gradient(180deg,#f6f7f9_0%,#f3f5f7_100%)]" />
      <div className="pointer-events-none fixed inset-y-0 left-[calc(var(--primary-rail-w)+var(--context-rail-w))] w-px bg-slate-200/70 hidden md:block" />

      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        shellStats={shellStats}
      />

      <div className="min-h-screen md:pl-[calc(var(--primary-rail-w)+var(--context-rail-w))]">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          shellStats={shellStats}
          notifications={notifications}
          shellSection={shellSection}
          activeContextItem={activeContextItem}
        />

        <main className="min-h-[calc(100vh-76px)] px-4 py-5 md:px-6 md:py-6 lg:px-10 lg:py-8">
          <div className="mx-auto flex min-h-full w-full max-w-[1680px] flex-col">
            <div className="mb-6 hidden items-start justify-between gap-4 border-b border-slate-200/80 pb-5 md:flex">
              <div className="max-w-[52rem]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {shellSection.kicker}
                </div>
                <p className="mt-2 text-[14px] leading-7 text-slate-500">
                  {shellSection.description}
                </p>
              </div>

              {shellStats?.message ? (
                <div className="max-w-[22rem] text-right text-[12px] leading-6 text-amber-700">
                  {shellStats.message}
                </div>
              ) : null}
            </div>

            <div className="flex-1">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
