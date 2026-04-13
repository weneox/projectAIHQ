// src/pages/Admin/AdminChats.tsx
// MOBILE-READY — stacked list/thread + back button + sticky reply bar
// ✅ FIX: API_BASE + token from adminContext (NO localhost fallback)
// ✅ FIX: remove duplicated localStorage auth flow (single source of truth)
// ✅ NEW: Translation-aware message rendering (adminLang from AdminContext)
// ✅ NEW: sendReply includes admin_lang for backend auto-translation pipeline
// ✅ FIX: fetchConversations + fetchThread now send admin_lang too
// ✅ POLISH: autosize textarea + jump-to-bottom + better mobile wrap + better thread sizing
// ✅ PRO ADD: search + unread badge + quick replies + copy message
// ✅ CRITICAL FIX: fetchThread uses GET /api/admin/conversations/:id (NOT /messages) + robust parsing

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams, Link } from "react-router-dom";
import { useAdmin } from "./adminContext";

type Conv = {
  id: string;
  session_id: string;
  createdAt: string;
  updatedAt?: string;
  lastMessageAt?: string | null;
  lang?: string;
  page?: string;
  channel?: string;
  lead_id?: string | null;
  handoff?: boolean;

  // ✅ optional from backend (if later you add it)
  unread_count?: number;
};

type Msg = {
  id: string;
  conversation_id: string;
  session_id: string;
  createdAt: string;
  ts: number;
  role: "user" | "assistant" | string;
  content: string;
  lang?: string;
  page?: string;
  channel?: string;
  meta?: any;
};

function formatDt(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function useLangAndChatId() {
  // NOTE: route lang is website language, not adminLang (adminLang comes from context dropdown)
  const { lang, id } = useParams<{ lang?: string; id?: string }>();
  return {
    routeLang: (lang || "az").toLowerCase(),
    chatId: (id || "").trim() || null,
  };
}

function pickPreview(ms: Msg[]) {
  const last = ms.length ? ms[ms.length - 1] : null;
  const txt = String(last?.content || "").trim();
  return txt ? txt.slice(0, 140) : "—";
}

function buildAdminHeaders(token: string) {
  const t = String(token || "").trim();
  return {
    "x-admin-token": t,
    Authorization: `Bearer ${t}`,
  };
}

function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width:${breakpoint}px)`).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${breakpoint}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    if ((mq as any).addEventListener) mq.addEventListener("change", onChange);
    else (mq as any).addListener?.(onChange);
    return () => {
      if ((mq as any).removeEventListener) mq.removeEventListener("change", onChange);
      else (mq as any).removeListener?.(onChange);
    };
  }, [breakpoint]);

  return isMobile;
}

function normLang(x?: string) {
  return String(x || "").trim().toLowerCase() || "";
}

// ✅ Safe: adds/updates query params for both absolute and relative URLs
function withQuery(url: string, params: Record<string, string>) {
  const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const u = new URL(url, base);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  const looksAbs = /^https?:\/\//i.test(url);
  return looksAbs ? u.toString() : u.pathname + (u.search || "") + (u.hash || "");
}

// Pick best translation for admin language:
// 1) translations[adminLang]
// 2) translations["az"] (common fallback)
// 3) first available translations value
function pickAdminTranslation(meta: any, adminLang: string) {
  const tr = meta?.translations;
  if (!tr || typeof tr !== "object") return "";
  const a = normLang(adminLang);
  const direct = tr[a];
  if (direct) return String(direct || "").trim();

  const az = tr["az"];
  if (az) return String(az || "").trim();

  const firstKey = Object.keys(tr)[0];
  if (firstKey) return String(tr[firstKey] || "").trim();

  return "";
}

/* ------------------ textarea autosize ------------------ */
function useAutosizeTextarea(ref: React.RefObject<HTMLTextAreaElement>, value: string, maxPx = 180) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, maxPx);
    el.style.height = `${Math.max(44, next)}px`;
  }, [ref, value, maxPx]);
}

/* ------------------ unread helpers ------------------ */
const LS_LAST_READ = "neox_admin_last_read_ts_v1";
function readMap(): Record<string, number> {
  try {
    const j = JSON.parse(localStorage.getItem(LS_LAST_READ) || "{}");
    if (!j || typeof j !== "object") return {};
    const out: Record<string, number> = {};
    for (const k of Object.keys(j)) out[k] = Number((j as any)[k] || 0) || 0;
    return out;
  } catch {
    return {};
  }
}
function writeMap(m: Record<string, number>) {
  try {
    localStorage.setItem(LS_LAST_READ, JSON.stringify(m));
  } catch {}
}
function getLastReadTs(convId: string) {
  const m = readMap();
  return Number(m[convId] || 0) || 0;
}
function setLastReadTs(convId: string, ts: number) {
  const m = readMap();
  m[convId] = Number(ts || 0) || 0;
  writeMap(m);
}

// ✅ for list item: get a ts from conv timestamps
function convLastTs(c: Conv) {
  const iso = c.lastMessageAt || c.updatedAt || c.createdAt;
  const t = new Date(iso || "").getTime();
  return Number.isFinite(t) ? t : 0;
}

/* ------------------ quick replies ------------------ */
const QUICK_REPLIES = [
  "Salam! Sizə necə kömək edə bilərəm?",
  "Qiymətlər və paketlər barədə məlumat göndərirəm.",
  "Demo üçün uyğun vaxtınızı yazın, zəhmət olmasa.",
  "Əlaqə nömrənizi paylaşa bilərsiniz?",
  "Təşəkkürlər! Tezliklə geri dönəcəyik.",
];

async function copyText(txt: string) {
  const t = String(txt || "").trim();
  if (!t) return;
  try {
    await navigator.clipboard.writeText(t);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {}
    document.body.removeChild(ta);
  }
}

export default function AdminChats() {
  const loc = useLocation();
  const { routeLang, chatId } = useLangAndChatId();
  const isMobile = useIsMobile(900);

  // ✅ single source of truth
  const {
    apiBase: apiBaseRaw,
    token,
    setToken,
    logout: ctxLogout,
    adminLang, // ✅ from dropdown (AdminLayout)
  } = useAdmin();

  // ✅ normalize api base (remove trailing slash). "" => same-origin
  const API_BASE = useMemo(() => String(apiBaseRaw || "").replace(/\/+$/, ""), [apiBaseRaw]);

  // login draft
  const [tempToken, setTempToken] = useState(() => token || "");
  useEffect(() => setTempToken(token || ""), [token]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");

  const [handoffBusy, setHandoffBusy] = useState(false);

  // mobile: list vs thread
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");

  const active = useMemo(() => convs.find((c) => c.id === activeId) || null, [convs, activeId]);

  const orderedMessages = useMemo(() => {
    const arr = Array.isArray(messages) ? messages.slice() : [];
    arr.sort((a, b) => (Number(a.ts || 0) || 0) - (Number(b.ts || 0) || 0));
    return arr;
  }, [messages]);

  // ✅ reply input ref (for ?focus=reply)
  const replyInputRef = useRef<HTMLTextAreaElement | null>(null);
  useAutosizeTextarea(replyInputRef, reply, 180);

  // Thread auto-scroll
  const threadRef = useRef<HTMLDivElement | null>(null);
  const autoScrollLockRef = useRef(false);
  const [showJump, setShowJump] = useState(false);

  const scrollToBottom = () => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    autoScrollLockRef.current = false;
    setShowJump(false);
  };

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    if (autoScrollLockRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [orderedMessages.length]);

  // detect manual scroll up (lock autoscroll)
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;

    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
      autoScrollLockRef.current = !nearBottom;
      setShowJump(!nearBottom);
    };

    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll as any);
  }, []);

  // Abort controllers
  const convAbortRef = useRef<AbortController | null>(null);
  const threadAbortRef = useRef<AbortController | null>(null);

  // inflight flags (avoid abort-thrash from polling)
  const convInflight = useRef(false);
  const threadInflight = useRef(false);

  // Poll interval
  const pollRef = useRef<number | null>(null);

  // ✅ search
  const [q, setQ] = useState("");
  const filteredConvs = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return convs;
    return convs.filter((c) => {
      const a = [c.id, c.session_id, c.page || "", c.channel || "", c.lead_id || "", c.lang || "", c.createdAt || ""]
        .join(" ")
        .toLowerCase();
      return a.includes(s);
    });
  }, [q, convs]);

  function stopAllNetworking() {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;

    try {
      convAbortRef.current?.abort();
      threadAbortRef.current?.abort();
    } catch {}

    convAbortRef.current = null;
    threadAbortRef.current = null;

    convInflight.current = false;
    threadInflight.current = false;
  }

  function clearUI(msg?: string | null) {
    stopAllNetworking();
    setConvs([]);
    setActiveId(null);
    setMessages([]);
    setReply("");
    setErr(msg || null);
    setMobileView("list");
    setShowJump(false);
    autoScrollLockRef.current = false;
  }

  function on401(msg?: string) {
    clearUI(msg || "Token vaxtı bitib və ya səhvdir. Yenidən daxil ol.");
    window.setTimeout(() => ctxLogout(), 200);
  }

  function doLogin() {
    const t = tempToken.trim();
    if (!t) return setErr("Token yaz.");
    setToken(t);
    setErr(null);
  }

  function logout() {
    clearUI(null);
    ctxLogout();
  }

  async function fetchConversations(opts?: { silent?: boolean; keepActive?: boolean }) {
    const silent = opts?.silent ?? false;
    const keepActive = opts?.keepActive ?? true;
    if (!token) return;

    if (convInflight.current) return;
    convInflight.current = true;

    try {
      try {
        convAbortRef.current?.abort();
      } catch {}
      const ac = new AbortController();
      convAbortRef.current = ac;

      if (!silent) setLoading(true);
      if (!silent) setErr(null);

      const url = withQuery(`${API_BASE}/api/admin/conversations`, {
        admin_lang: String(adminLang || "az"),
      });

      const r = await fetch(url, {
        headers: buildAdminHeaders(token),
        signal: ac.signal,
      });

      if (r.status === 401) return on401("Token səhvdir. Yenidən daxil ol.");

      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`${r.status} ${t || "fetch failed"}`);
      }

      const j = await r.json().catch(() => ({} as any));
      const list: Conv[] = (j as any).conversations || [];
      setConvs(list);

      setActiveId((prev) => {
        if (chatId && list.some((x) => x.id === chatId)) return chatId;
        if (keepActive && prev && list.some((x) => x.id === prev)) return prev;
        return list[0]?.id || null;
      });
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      if (!silent) setErr(e?.message || "Failed to fetch");
    } finally {
      if (!silent) setLoading(false);
      convInflight.current = false;
    }
  }

  async function fetchThread(id: string, opts?: { silent?: boolean }) {
    const silent = opts?.silent ?? true;
    if (!token || !id) return;

    if (threadInflight.current) return;
    threadInflight.current = true;

    try {
      try {
        threadAbortRef.current?.abort();
      } catch {}
      const ac = new AbortController();
      threadAbortRef.current = ac;

      // ✅ CRITICAL FIX: backend endpoint is /api/admin/conversations/:id (no /messages)
      const url = withQuery(`${API_BASE}/api/admin/conversations/${id}`, {
        admin_lang: String(adminLang || "az"),
      });

      const r = await fetch(url, {
        headers: buildAdminHeaders(token),
        signal: ac.signal,
      });

      if (r.status === 401) return on401("Token vaxtı bitib və ya səhvdir. Yenidən daxil ol.");

      if (!r.ok) {
        if (!silent) {
          const t = await r.text().catch(() => "");
          setErr(`${r.status} ${t || "thread fetch failed"}`);
        }
        return;
      }

      const j = await r.json().catch(() => ({} as any));

      // ✅ robust shapes
      const list: Msg[] =
        (j as any).messages ||
        (j as any).conversation?.messages ||
        (j as any).data?.messages ||
        [];

      setMessages(Array.isArray(list) ? list : []);
      if (!silent) setErr(null);

      // ✅ also merge conversation fields if backend returns updated conv
      const convObj: any = (j as any).conversation || (j as any).conv || (j as any).data || null;
      if (convObj?.id) {
        setConvs((prev) => prev.map((c) => (c.id === convObj.id ? { ...c, ...convObj } : c)));
      }

      // ✅ mark as read (client-side)
      const lastTs = Math.max(0, ...(Array.isArray(list) ? list.map((m) => Number(m.ts || 0) || 0) : [0]));
      if (lastTs > 0) setLastReadTs(id, lastTs);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      if (!silent) setErr(e?.message || "Thread fetch failed");
    } finally {
      threadInflight.current = false;
    }
  }

  // ✅ Robust handoff update (tries multiple endpoint shapes)
  async function setConversationHandoff(next: boolean) {
    if (!token || !activeId) return;

    setHandoffBusy(true);
    setErr(null);

    const prevHandoff = !!active?.handoff;

    // optimistic UI
    setConvs((prev) => prev.map((c) => (c.id === activeId ? { ...c, handoff: next } : c)));

    const headers = {
      "Content-Type": "application/json",
      ...buildAdminHeaders(token),
    };

    const attempts: Array<{ url: string; method: string; body?: any }> = [
      { url: `${API_BASE}/api/admin/conversations/${activeId}`, method: "PATCH", body: { handoff: next } },
      { url: `${API_BASE}/api/admin/conversations/${activeId}/handoff`, method: "PATCH", body: { handoff: next } },
      { url: `${API_BASE}/api/admin/conversations/${activeId}/handoff`, method: "POST", body: { handoff: next } },
      { url: `${API_BASE}/api/admin/conversations/${activeId}`, method: "PATCH", body: { ai_enabled: !next } },
    ];

    let ok = false;
    let lastErr = "";

    try {
      for (const a of attempts) {
        try {
          const r = await fetch(a.url, {
            method: a.method,
            headers,
            body: JSON.stringify(a.body ?? {}),
          });

          if (r.status === 401) return on401("Token vaxtı bitib və ya səhvdir. Yenidən daxil ol.");

          if (r.ok) {
            ok = true;

            const j = await r.json().catch(() => ({} as any));
            const updated: Conv | undefined = (j as any).conversation || (j as any).conv || (j as any).data || undefined;

            if (updated?.id) {
              setConvs((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
            }
            break;
          } else {
            const t = await r.text().catch(() => "");
            lastErr = `${r.status} ${t || "handoff update failed"}`;
          }
        } catch (e: any) {
          lastErr = e?.message || "handoff update failed";
        }
      }

      if (!ok) {
        setConvs((prev) => prev.map((c) => (c.id === activeId ? { ...c, handoff: prevHandoff } : c)));
        setErr(lastErr || "Handoff dəyişmədi (endpoint tapılmadı).");
        return;
      }

      fetchConversations({ silent: true, keepActive: true });
      fetchThread(activeId, { silent: true });
    } finally {
      setHandoffBusy(false);
    }
  }

  async function sendReply() {
    if (!token || !activeId) return;
    const text = reply.trim();
    if (!text) return;

    setLoading(true);
    setErr(null);

    try {
      const r = await fetch(`${API_BASE}/api/admin/conversations/${activeId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAdminHeaders(token),
        },
        // ✅ send admin_lang so backend can translate to user language + store original
        body: JSON.stringify({ content: text, admin_lang: adminLang }),
      });

      if (r.status === 401) return on401("Token vaxtı bitib və ya səhvdir. Yenidən daxil ol.");

      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`${r.status} ${t || "send failed"}`);
      }

      const j = await r.json().catch(() => ({} as any));
      const msg: Msg | undefined = (j as any).message;

      setReply("");

      if (msg?.id) setMessages((prev) => [...prev, msg]);

      // operator replied => handoff true
      setConvs((prev) => prev.map((c) => (c.id === activeId ? { ...c, handoff: true } : c)));

      if (isMobile) setMobileView("thread");

      autoScrollLockRef.current = false;
      setShowJump(false);

      fetchConversations({ silent: true, keepActive: true });
      fetchThread(activeId, { silent: true });

      window.setTimeout(() => scrollToBottom(), 50);
    } catch (e: any) {
      setErr(e?.message || "Send failed");
    } finally {
      setLoading(false);
    }
  }

  // Boot: when token appears
  useEffect(() => {
    if (!token) return;
    clearUI(null);
    fetchConversations({ silent: false, keepActive: true });
    return () => stopAllNetworking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, API_BASE, adminLang]);

  // When active changes, load thread
  useEffect(() => {
    if (!token || !activeId) return;
    fetchThread(activeId, { silent: false });
    if (isMobile) setMobileView("thread");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeId, API_BASE, adminLang]);

  // Poll (uses latest activeId)
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    if (!token) return;

    if (pollRef.current) window.clearInterval(pollRef.current);

    pollRef.current = window.setInterval(() => {
      fetchConversations({ silent: true, keepActive: true });
      const cur = activeIdRef.current;
      if (cur) fetchThread(cur, { silent: true });
    }, 6000);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, API_BASE, adminLang]);

  // ✅ focus=reply support (for magic link)
  useEffect(() => {
    if (!token || !activeId) return;

    const qs = new URLSearchParams(loc.search);
    const focus = (qs.get("focus") || "").toLowerCase();
    if (focus !== "reply") return;

    if (isMobile) setMobileView("thread");

    const t = window.setTimeout(() => {
      replyInputRef.current?.focus();
    }, 220);

    return () => window.clearTimeout(t);
  }, [loc.search, token, activeId, isMobile, orderedMessages.length]);

  // If switching to desktop, show both panels again
  useEffect(() => {
    if (!isMobile) setMobileView("list");
  }, [isMobile]);

  // LOGIN
  if (!token) {
    return (
      <div style={S.page}>
        <div style={S.shellLogin}>
          <div style={S.cardLogin}>
            <div style={S.brandRow}>
              <div style={S.brandDot} />
              <div style={S.brandText}>NEOX Admin</div>
            </div>

            <div style={{ marginTop: 10, fontSize: 26, fontWeight: 980 }}>Daxil ol</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,.65)" }}>
              Token-i bir dəfə yaz — yadda qalacaq. (<code style={S.code}>ADMIN_TOKEN</code>)
            </div>

            {err && <div style={S.err}>{err}</div>}

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <input value={tempToken} onChange={(e) => setTempToken(e.target.value)} placeholder="ADMIN TOKEN" style={S.input} />
              <button onClick={doLogin} style={S.btnPrimary}>
                Daxil ol
              </button>

              <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>
                Backend test: <code style={S.code}>{API_BASE || "(same-origin)"}/health</code>
              </div>
            </div>

            <div style={{ marginTop: 14, fontSize: 12, color: "rgba(255,255,255,.55)" }}>
              <Link to={`/${routeLang}/admin/leads`} style={{ color: "rgba(255,255,255,.8)" }}>
                ← Admin Leads
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const aiOff = !!active?.handoff;

  const showList = !isMobile || mobileView === "list";
  const showThread = !isMobile || mobileView === "thread";

  // MAIN
  return (
    <div style={S.page}>
      <div style={S.shell}>
        <div style={S.topbar}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 950 }}>Admin Chats</div>

            {/* ✅ mobile wrap */}
            <div style={S.subWrap}>
              <span>
                Token: <b style={{ color: "rgba(255,255,255,.92)" }}>ON</b>
              </span>
              <span>
                • Route: <code style={S.code}>{loc.pathname}</code>
              </span>
              <span style={{ opacity: 0.75 }}>• Auto: 6s</span>
              <span style={{ opacity: 0.75 }}>• AdminLang: {String(adminLang || "az").toUpperCase()}</span>
            </div>
          </div>

          <div style={S.actions}>
            <Link to={`/${routeLang}/admin/leads`} style={S.btnLinkNav as any}>
              Leads
            </Link>

            {isMobile && mobileView === "thread" && (
              <button onClick={() => setMobileView("list")} style={S.btn} disabled={loading}>
                ← List
              </button>
            )}

            <button onClick={() => fetchConversations({ silent: false, keepActive: true })} style={S.btn} disabled={loading}>
              Yenilə
            </button>

            <button onClick={logout} style={S.btnGhost}>
              Çıxış
            </button>
          </div>
        </div>

        {err && <div style={S.err}>{err}</div>}

        <div style={isMobile ? S.stack : S.grid}>
          {/* LEFT — Conversations */}
          {showList && (
            <div style={S.panel}>
              <div style={S.panelHead}>
                <div style={S.panelTitle}>Conversations</div>
                <div style={S.badge}>{loading ? "..." : `${filteredConvs.length}`}</div>
              </div>

              {/* ✅ SEARCH */}
              <div style={S.searchBar}>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Axtar: session/page/channel/lang/lead…"
                  style={S.searchInput}
                />
                {q.trim() ? (
                  <button onClick={() => setQ("")} style={S.searchClear} title="Clear">
                    ✕
                  </button>
                ) : null}
              </div>

              <div style={S.list}>
                {filteredConvs.length === 0 ? (
                  <div style={S.empty}>{q.trim() ? "Uyğun chat tapılmadı." : "Hələ chat yoxdur."}</div>
                ) : (
                  filteredConvs.map((c) => {
                    const isActiveItem = c.id === activeId;
                    const label = `SID: ${c.session_id?.slice?.(0, 8) || c.id.slice(0, 8)}`;
                    const sub = `Lang: ${(c.lang || "az").toUpperCase()} • ${c.page || "—"}`;

                    // ✅ UNREAD badge (backend unread_count if exists, else client fallback)
                    const unreadFromBackend = typeof c.unread_count === "number" ? Math.max(0, c.unread_count) : null;
                    const lastRead = getLastReadTs(c.id);
                    const lastTs = convLastTs(c);
                    const unreadClient = lastTs > lastRead ? 1 : 0;
                    const unread = unreadFromBackend != null ? unreadFromBackend : unreadClient;

                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          setActiveId(c.id);
                          if (isMobile) setMobileView("thread");
                        }}
                        style={{ ...S.item, ...(isActiveItem ? S.itemActive : null) }}
                        title={c.id}
                      >
                        <div style={S.itemRow}>
                          <div style={S.itemName}>{label}</div>

                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            {unread ? <div style={S.unreadBadge}>{unread}</div> : null}
                            {c.handoff ? <div style={S.pillAiOff}>AI OFF</div> : <div style={S.pillAiOn}>AI ON</div>}
                            <div style={S.pill}>{String(c.channel || "WEB").toUpperCase()}</div>
                          </div>
                        </div>

                        <div style={S.itemMeta}>{sub}</div>
                        <div style={S.itemTime}>{formatDt(c.lastMessageAt || c.updatedAt || c.createdAt)}</div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* RIGHT — Thread */}
          {showThread && (
            <div style={S.panel}>
              <div style={S.panelHead}>
                <div style={S.panelTitle}>Thread</div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {active ? (
                    <>
                      {aiOff ? <div style={S.badgeAiOff}>Operator Active</div> : <div style={S.badgeAiOn}>AI Active</div>}
                      <div style={S.badgeDim}>{handoffBusy ? "..." : "Seçilib"}</div>
                    </>
                  ) : (
                    <div style={S.badgeDim}>—</div>
                  )}
                </div>
              </div>

              {!active ? (
                <div style={S.empty}>Soldan chat seç.</div>
              ) : (
                <div style={S.threadLayout}>
                  {/* meta card */}
                  <div style={S.card}>
                    <div style={S.kv}>
                      <div style={S.k}>Session</div>
                      <div style={S.v}>{active.session_id || "—"}</div>
                    </div>
                    <div style={S.kv}>
                      <div style={S.k}>Lead</div>
                      <div style={S.v}>{active.lead_id || "—"}</div>
                    </div>
                    <div style={S.kv}>
                      <div style={S.k}>Dil</div>
                      <div style={S.v}>{(active.lang || "az").toUpperCase()}</div>
                    </div>
                    <div style={S.kv}>
                      <div style={S.k}>Son</div>
                      <div style={S.v}>{formatDt(active.lastMessageAt || active.updatedAt || active.createdAt)}</div>
                    </div>

                    <div style={S.metaRow}>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,.70)" }}>
                        AI status:{" "}
                        <b style={{ color: aiOff ? "rgba(255,120,120,.95)" : "rgba(140,255,200,.95)" }}>
                          {aiOff ? "OFF (Operator)" : "ON"}
                        </b>
                      </div>

                      <div style={{ flex: 1 }} />

                      <button
                        onClick={() => setConversationHandoff(!aiOff)}
                        disabled={handoffBusy}
                        style={aiOff ? S.btnAiOn : S.btnAiOff}
                        title="AI ON/OFF (handoff)"
                      >
                        {handoffBusy ? "..." : aiOff ? "AI-ni aktiv et" : "Operator takeover (AI OFF)"}
                      </button>
                    </div>

                    {aiOff && (
                      <div style={S.noticeOff}>
                        Operator takeover aktivdir — widgetdə AI cavabları dayanacaq. İstəsən “AI-ni aktiv et” ilə geri aça bilərsən.
                      </div>
                    )}

                    {isMobile && (
                      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button onClick={() => setMobileView("list")} style={S.btn} disabled={loading}>
                          ← List
                        </button>
                        <button onClick={() => replyInputRef.current?.focus()} style={S.btn} title="Reply">
                          Reply
                        </button>
                        <button onClick={scrollToBottom} style={S.btn} title="Bottom">
                          ↓ Bottom
                        </button>
                      </div>
                    )}
                  </div>

                  {/* thread scroll */}
                  <div style={S.thread} ref={threadRef as any}>
                    {showJump && (
                      <button style={S.jumpBtn} onClick={scrollToBottom} title="Jump to latest">
                        ↓ Yeni mesajlara
                      </button>
                    )}

                    {orderedMessages.length === 0 ? (
                      <div style={{ padding: 10, color: "rgba(255,255,255,.65)" }}>Mesaj yoxdur.</div>
                    ) : (
                      orderedMessages.map((m) => {
                        const isAdminReply =
                          m.role === "assistant" && (m?.meta?.source === "admin_panel" || m.channel === "admin");
                        const isUser = m.role === "user";
                        const mine = isAdminReply;

                        const roleLabel = isAdminReply ? "OPERATOR" : isUser ? "USER" : String(m.role || "").toUpperCase();
                        const userLang = normLang(m.lang) || normLang(active?.lang) || "az";

                        // ---- translation-aware rendering ----
                        // USER: primary = translated-to-adminLang (if exists), secondary = original
                        // OPERATOR: primary = meta.original.text (admin text), secondary = content (sent to user)
                        let primary = String(m.content || "");
                        let secondary = "";
                        let secondaryTag = "";

                        if (isUser) {
                          const tr = pickAdminTranslation(m.meta, adminLang);
                          if (tr && tr !== primary) {
                            secondary = primary;
                            secondaryTag = userLang.toUpperCase();
                            primary = tr;
                          }
                        }

                        if (isAdminReply) {
                          const origText = String(m?.meta?.original?.text || "").trim();
                          const origLang = normLang(m?.meta?.original?.lang) || normLang(adminLang) || "az";
                          if (origText) {
                            primary = origText;

                            const sent = String(m.content || "").trim();
                            if (sent && sent !== origText) {
                              secondary = sent;
                              secondaryTag = userLang.toUpperCase();
                            }
                          } else {
                            primary = String(m.content || "");
                          }

                          void origLang;
                        }

                        return (
                          <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                            <div style={{ ...S.bubble, ...(mine ? S.bubbleMine : S.bubbleUser) }}>
                              <div style={S.bubbleRoleRow}>
                                <div style={S.bubbleRole}>
                                  {roleLabel}
                                  <span style={{ opacity: 0.65, marginLeft: 10 }}>
                                    · {isAdminReply ? String(adminLang || "az").toUpperCase() : userLang.toUpperCase()}
                                  </span>
                                </div>

                                <button
                                  onClick={() => copyText(primary)}
                                  style={S.copyBtn}
                                  title="Copy message"
                                  aria-label="Copy message"
                                >
                                  Copy
                                </button>
                              </div>

                              <div style={S.bubbleText}>{primary}</div>

                              {secondary ? (
                                <div style={S.bubbleSecondary}>
                                  <div style={S.secondaryTag}>{secondaryTag}</div>
                                  <div style={S.secondaryText}>{secondary}</div>

                                  <div style={{ marginTop: 8 }}>
                                    <button onClick={() => copyText(secondary)} style={S.copyBtnSmall} title="Copy original">
                                      Copy original
                                    </button>
                                  </div>
                                </div>
                              ) : null}

                              <div style={S.bubbleTime}>{formatDt(m.createdAt)}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* ✅ QUICK REPLIES */}
                  <div style={S.quickRow}>
                    {QUICK_REPLIES.map((t) => (
                      <button
                        key={t}
                        style={S.quickChip}
                        onClick={() => {
                          setReply(t);
                          window.setTimeout(() => replyInputRef.current?.focus(), 0);
                        }}
                        title="Insert quick reply"
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* sticky reply */}
                  <div style={S.replyBar}>
                    <textarea
                      ref={replyInputRef}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder={`Operator reply yaz… (${String(adminLang || "az").toUpperCase()})`}
                      style={S.textarea}
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          sendReply();
                        }
                      }}
                    />
                    <div style={S.replyRow}>
                      <button onClick={sendReply} style={S.btnPrimary} disabled={loading || !reply.trim()}>
                        Göndər
                      </button>
                      <button onClick={scrollToBottom} style={S.btn} title="Bottom">
                        ↓
                      </button>
                      <div style={S.replyTip}>
                        Tip: <code style={S.code}>Ctrl+Enter</code> • Yeni sətir: <code style={S.code}>Shift+Enter</code>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={S.footerLine}>
          token headers: <code style={S.code}>x-admin-token</code> / <code style={S.code}>Authorization</code> • API:{" "}
          <code style={S.code}>{API_BASE || "(same-origin)"}</code> • preview:{" "}
          <code style={S.code}>{pickPreview(orderedMessages)}</code>
        </div>
      </div>
    </div>
  );
}

/* ------------------ styles ------------------ */
const S: Record<string, any> = {
  page: {
    minHeight: "100dvh",
    padding: "14px",
    paddingTop: "calc(14px + env(safe-area-inset-top))",
    paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
    background:
      "radial-gradient(1200px 600px at 18% 8%, rgba(20,82,199,.22), transparent 58%), radial-gradient(900px 520px at 82% 18%, rgba(122,92,255,.16), transparent 55%), #05070f",
    color: "rgba(255,255,255,.92)",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
    overflowX: "hidden",
  },

  shell: { maxWidth: 1180, margin: "0 auto", paddingTop: 14 },
  shellLogin: { maxWidth: 1180, margin: "0 auto" },

  topbar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.10)",
    background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.03))",
    boxShadow: "0 18px 60px rgba(0,0,0,.35)",
    marginBottom: 12,
    backdropFilter: "blur(10px)",
    overflow: "hidden",
  },

  subWrap: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(255,255,255,.65)",
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    rowGap: 6,
    minWidth: 0,
  },

  actions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

  grid: { display: "grid", gridTemplateColumns: "420px minmax(0, 1fr)", gap: 12 },
  stack: { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 },

  panel: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.03)",
    boxShadow: "0 18px 60px rgba(0,0,0,.30)",
    overflow: "hidden",
    backdropFilter: "blur(10px)",
    minWidth: 0,
  },

  panelHead: {
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid rgba(255,255,255,.08)",
    background: "rgba(0,0,0,.14)",
  },

  panelTitle: {
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: ".16em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,.82)",
  },

  badge: {
    fontSize: 12,
    padding: "3px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.05)",
    color: "rgba(255,255,255,.80)",
  },

  badgeDim: {
    fontSize: 12,
    padding: "3px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.03)",
    color: "rgba(255,255,255,.62)",
  },

  badgeAiOff: {
    fontSize: 11,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,90,90,.28)",
    background: "rgba(255,90,90,.10)",
    color: "rgba(255,255,255,.86)",
    letterSpacing: ".10em",
    textTransform: "uppercase",
  },

  badgeAiOn: {
    fontSize: 11,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(140,255,200,.20)",
    background: "rgba(140,255,200,.08)",
    color: "rgba(255,255,255,.86)",
    letterSpacing: ".10em",
    textTransform: "uppercase",
  },

  // ✅ Search bar
  searchBar: {
    padding: 10,
    display: "flex",
    gap: 10,
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,.06)",
    background: "rgba(0,0,0,.10)",
  },
  searchInput: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.92)",
    outline: "none",
  },
  searchClear: {
    height: 40,
    minWidth: 40,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.88)",
    cursor: "pointer",
  },

  list: {
    maxHeight: "calc(100dvh - 300px)",
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
  },

  item: {
    width: "100%",
    textAlign: "left",
    padding: 12,
    border: 0,
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    borderBottom: "1px solid rgba(255,255,255,.06)",
    transition: "background .15s ease, transform .15s ease",
  },

  itemActive: { background: "rgba(255,255,255,.05)", transform: "translateY(-1px)" },

  itemRow: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", minWidth: 0 },

  itemName: {
    fontWeight: 900,
    fontSize: 14,
    color: "rgba(255,255,255,.92)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  itemMeta: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(255,255,255,.70)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  itemTime: { marginTop: 6, fontSize: 11, color: "rgba(255,255,255,.46)" },

  unreadBadge: {
    fontSize: 11,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,90,90,.28)",
    background: "rgba(255,90,90,.12)",
    color: "rgba(255,255,255,.92)",
    fontWeight: 900,
  },

  pill: {
    fontSize: 10,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(20,82,199,.18)",
    color: "rgba(255,255,255,.86)",
    letterSpacing: ".12em",
    whiteSpace: "nowrap",
  },

  pillAiOff: {
    fontSize: 10,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,90,90,.28)",
    background: "rgba(255,90,90,.10)",
    color: "rgba(255,255,255,.86)",
    letterSpacing: ".12em",
    whiteSpace: "nowrap",
  },

  pillAiOn: {
    fontSize: 10,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(140,255,200,.20)",
    background: "rgba(140,255,200,.08)",
    color: "rgba(255,255,255,.86)",
    letterSpacing: ".12em",
    whiteSpace: "nowrap",
  },

  threadLayout: { padding: 14, display: "grid", gap: 12, minWidth: 0 },

  card: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.22)",
    padding: 12,
    minWidth: 0,
  },

  kv: {
    display: "grid",
    gridTemplateColumns: "120px minmax(0, 1fr)",
    gap: 10,
    padding: "8px 0",
    borderBottom: "1px solid rgba(255,255,255,.06)",
  },

  k: { fontSize: 12, color: "rgba(255,255,255,.55)", letterSpacing: ".08em", textTransform: "uppercase" },
  v: { fontSize: 13, color: "rgba(255,255,255,.90)", overflow: "hidden", textOverflow: "ellipsis" },

  metaRow: { display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" },

  noticeOff: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,90,90,.22)",
    background: "rgba(255,90,90,.08)",
    color: "rgba(255,255,255,.85)",
    fontSize: 12,
    lineHeight: 1.4,
  },

  thread: {
    position: "relative",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.18)",
    padding: 12,
    height: "min(56dvh, 560px)",
    overflow: "auto",
    display: "grid",
    gap: 10,
    WebkitOverflowScrolling: "touch",
  },

  jumpBtn: {
    position: "sticky",
    top: 10,
    justifySelf: "center",
    zIndex: 5,
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(10,12,22,.72)",
    color: "rgba(255,255,255,.88)",
    cursor: "pointer",
    backdropFilter: "blur(8px)",
  },

  bubble: {
    maxWidth: "78%",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.10)",
    padding: 10,
    minWidth: 0,
  },

  bubbleMine: { background: "linear-gradient(135deg, rgba(20,82,199,.26), rgba(122,92,255,.16))" },
  bubbleUser: { background: "rgba(255,255,255,.05)" },

  bubbleRoleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 },
  bubbleRole: { fontSize: 10, letterSpacing: ".16em", opacity: 0.75 },
  bubbleText: { whiteSpace: "pre-wrap", lineHeight: 1.45, wordBreak: "break-word" },
  bubbleTime: { marginTop: 8, fontSize: 11, opacity: 0.55 },

  copyBtn: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.86)",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 850,
  },
  copyBtnSmall: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.03)",
    color: "rgba(255,255,255,.76)",
    cursor: "pointer",
    fontSize: 11,
  },

  bubbleSecondary: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px dashed rgba(255,255,255,.14)",
    opacity: 0.92,
  },

  secondaryTag: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    letterSpacing: ".16em",
    padding: "3px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.72)",
    textTransform: "uppercase",
    marginBottom: 6,
  },

  secondaryText: {
    whiteSpace: "pre-wrap",
    lineHeight: 1.45,
    wordBreak: "break-word",
    color: "rgba(255,255,255,.72)",
    fontStyle: "italic",
  },

  quickRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    padding: "2px 2px",
  },
  quickChip: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.86)",
    cursor: "pointer",
    fontSize: 12,
    maxWidth: "100%",
  },

  replyBar: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.22)",
    padding: 12,
    display: "grid",
    gap: 10,
    position: "sticky",
    bottom: 0,
    zIndex: 2,
    backdropFilter: "blur(8px)",
  },

  replyRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  replyTip: { fontSize: 12, color: "rgba(255,255,255,.55)" },

  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.92)",
    outline: "none",
    maxWidth: "100%",
  },

  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.92)",
    outline: "none",
    maxWidth: "100%",
    resize: "none",
    lineHeight: 1.45,
    overflow: "hidden",
  },

  btn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.86)",
    cursor: "pointer",
  },

  btnGhost: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "transparent",
    color: "rgba(255,255,255,.74)",
    cursor: "pointer",
  },

  btnPrimary: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(20,82,199,.35)",
    background: "linear-gradient(135deg, rgba(20,82,199,.85), rgba(122,92,255,.55))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  },

  btnAiOff: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,90,90,.28)",
    background: "rgba(255,90,90,.10)",
    color: "rgba(255,255,255,.90)",
    cursor: "pointer",
    fontWeight: 850,
  },

  btnAiOn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(140,255,200,.20)",
    background: "rgba(140,255,200,.08)",
    color: "rgba(255,255,255,.90)",
    cursor: "pointer",
    fontWeight: 850,
  },

  btnLinkNav: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.03)",
    color: "rgba(255,255,255,.86)",
    textDecoration: "none",
  },

  err: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,90,90,.28)",
    background: "rgba(255,90,90,.10)",
    color: "rgba(255,255,255,.92)",
    marginBottom: 12,
  },

  empty: { padding: 16, color: "rgba(255,255,255,.65)" },

  code: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 11,
    padding: "2px 6px",
    borderRadius: 8,
    background: "rgba(255,255,255,.06)",
    border: "1px solid rgba(255,255,255,.10)",
  },

  cardLogin: {
    width: "min(560px, 92vw)",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.05)",
    boxShadow: "0 18px 60px rgba(0,0,0,.45)",
    padding: 18,
    backdropFilter: "blur(10px)",
    margin: "12dvh auto 0",
  },

  brandRow: { display: "flex", alignItems: "center", gap: 10 },

  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
    background: "linear-gradient(135deg, rgba(20,82,199,1), rgba(122,92,255,1))",
    boxShadow: "0 0 0 6px rgba(20,82,199,.12)",
  },

  brandText: {
    fontWeight: 950,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    fontSize: 12,
    color: "rgba(255,255,255,.78)",
  },

  footerLine: { marginTop: 10, fontSize: 12, color: "rgba(255,255,255,.55)" },
};
