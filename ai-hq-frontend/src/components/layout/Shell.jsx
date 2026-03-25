import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Header from "./Header.jsx";
import { realtimeStore } from "../../lib/realtime/realtimeStore.js";
import { apiGet } from "../../api/client.js";

const SIDEBAR_RAIL_W = 84;

async function fetchShellResource(path) {
  try {
    return { ok: true, data: await apiGet(path) };
  } catch (e) {
    return {
      ok: false,
      status: Number(e?.status || 0),
      message:
        typeof e?.message === "string" && e.message.trim()
          ? e.message.trim()
          : "Shared workspace stats are temporarily unavailable.",
    };
  }
}

function normalizeArray(j, key) {
  if (Array.isArray(j)) return j;
  if (Array.isArray(j?.[key])) return j[key];
  if (Array.isArray(j?.items)) return j.items;
  if (Array.isArray(j?.rows)) return j.rows;
  return [];
}

function isLiveVoiceStatus(v) {
  const s = String(v || "").trim().toLowerCase();
  return [
    "live",
    "active",
    "in_progress",
    "ongoing",
    "ringing",
    "queued",
    "bridged",
  ].includes(s);
}

export default function Shell() {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const refreshTimerRef = useRef(0);

  const [shellStats, setShellStats] = useState({
    inboxUnread: null,
    inboxOpen: null,
    leadsOpen: null,
    commentsCount: null,
    voiceLive: null,
    notificationsUnread: null,
    dbDisabled: false,
    wsState: "idle",
    availability: "loading",
    message: "",
  });

  async function loadShellStats() {
    const [inboxRes, leadsRes, commentsRes, voiceRes] = await Promise.all([
      fetchShellResource("/api/inbox/threads"),
      fetchShellResource("/api/leads"),
      fetchShellResource("/api/comments?limit=200"),
      fetchShellResource("/api/voice/calls?limit=100"),
    ]);

    const responses = [inboxRes, leadsRes, commentsRes, voiceRes];
    const failedResponse = responses.find((entry) => !entry?.ok);

    if (failedResponse) {
      setShellStats((prev) => ({
        ...prev,
        inboxUnread: null,
        inboxOpen: null,
        leadsOpen: null,
        commentsCount: null,
        voiceLive: null,
        notificationsUnread: null,
        dbDisabled: false,
        availability: "unavailable",
        message:
          failedResponse.message || "Shared workspace stats are temporarily unavailable.",
      }));
      return;
    }

    const inboxData = inboxRes.data;
    const leadsData = leadsRes.data;
    const commentsData = commentsRes.data;
    const voiceData = voiceRes.data;

    const threads = Array.isArray(inboxData?.threads) ? inboxData.threads : [];
    const leads = Array.isArray(leadsData?.leads) ? leadsData.leads : [];
    const comments = Array.isArray(commentsData?.comments) ? commentsData.comments : [];
    const voiceCalls = normalizeArray(voiceData, "calls");

    const inboxUnread = threads.reduce(
      (sum, t) => sum + Number(t?.unread_count || 0),
      0
    );

    const inboxOpen = threads.filter((t) => {
      const status = String(t?.status || "open").toLowerCase();
      return status !== "resolved" && status !== "closed";
    }).length;

    const leadsOpen = leads.filter(
      (l) => String(l?.status || "open").toLowerCase() === "open"
    ).length;

    const commentsCount = comments.length;

    const voiceLive = voiceCalls.filter((c) =>
      isLiveVoiceStatus(c?.status || c?.callStatus || c?.call_status)
    ).length;

    setShellStats((prev) => ({
      ...prev,
      inboxUnread,
      inboxOpen,
      leadsOpen,
      commentsCount,
      voiceLive,
      notificationsUnread: inboxUnread + leadsOpen + commentsCount + voiceLive,
      dbDisabled: Boolean(
        inboxData?.dbDisabled ||
          leadsData?.dbDisabled ||
          commentsData?.dbDisabled ||
          voiceData?.dbDisabled
      ),
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
    const prevOverflow = document.body.style.overflow;
    const prevOverflowX = document.body.style.overflowX;
    const prevOverflowY = document.body.style.overflowY;

    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.body.style.overflowX = "hidden";
      document.body.style.overflowY = "auto";
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overflowX = prevOverflowX;
      document.body.style.overflowY = prevOverflowY;
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

    const unsubscribeEvents = realtimeStore.subscribeEvents((evt) => {
        const type = String(evt?.type || "");

        if (
          type === "inbox.message.created" ||
          type === "inbox.thread.updated" ||
          type === "inbox.thread.read" ||
          type === "inbox.thread.created" ||
          type === "lead.created" ||
          type === "lead.updated" ||
          type === "comment.created" ||
          type === "comment.updated" ||
          type === "voice.call.created" ||
          type === "voice.call.updated" ||
          type === "voice.call.ended" ||
          type === "voice.session.created" ||
          type === "voice.session.updated"
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
      className="relative min-h-screen overflow-x-clip bg-[#02050c] text-white selection:bg-cyan-300/20 selection:text-white"
      style={{
        "--sidebar-rail-w": `${SIDEBAR_RAIL_W}px`,
      }}
    >
      <div className="pointer-events-none fixed inset-0 -z-[100] bg-[linear-gradient(180deg,#02050c_0%,#040814_34%,#030611_72%,#02050c_100%)]" />
      <div className="pointer-events-none fixed inset-0 -z-[90] bg-[radial-gradient(1100px_circle_at_0%_0%,rgba(44,212,255,0.10),transparent_24%),radial-gradient(920px_circle_at_100%_0%,rgba(99,102,241,0.10),transparent_24%),radial-gradient(1100px_circle_at_50%_100%,rgba(109,40,217,0.08),transparent_28%)]" />
      <div className="pointer-events-none fixed inset-0 -z-[80] opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(circle_at_center,black,transparent_88%)]" />
      <div className="pointer-events-none fixed left-[var(--sidebar-rail-w)] top-0 -z-[50] h-[260px] w-[440px] bg-[radial-gradient(circle_at_0%_0%,rgba(64,220,255,0.08),transparent_70%)] blur-3xl" />
      <div className="pointer-events-none fixed right-0 top-0 -z-[50] h-[320px] w-[560px] bg-[radial-gradient(circle_at_100%_0%,rgba(129,92,255,0.10),transparent_68%)] blur-3xl" />

      <Sidebar
        expanded={expanded}
        setExpanded={setExpanded}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        shellStats={shellStats}
      />

      <div className="relative z-10 md:pl-[var(--sidebar-rail-w)]">
        <div className="relative min-h-screen">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.06),transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_0%_0%,rgba(34,211,238,0.028),transparent_22%),radial-gradient(900px_circle_at_100%_0%,rgba(99,102,241,0.042),transparent_24%),radial-gradient(900px_circle_at_50%_100%,rgba(91,33,182,0.038),transparent_30%)]" />
          </div>

          <div className="relative flex min-h-screen flex-col">
            <div className="px-3 pt-3 md:px-4 md:pt-4 lg:px-5 lg:pt-5">
              <Header
                onMenuClick={() => setMobileOpen(true)}
                shellStats={shellStats}
              />
            </div>

            <main className="relative flex-1 px-3 pb-4 pt-4 md:px-4 md:pb-5 lg:px-5 lg:pb-6">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
