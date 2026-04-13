// src/components/NeoxAIWidget.tsx (FINAL — background scroll ENABLED while open + no hero jump + no dim)

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

type UiRole = "user" | "ai";
type LlmRole = "user" | "assistant";
type MsgSource = "ai" | "admin";
type MsgKind = "welcome" | "system" | "normal";
type Msg = { id: string; role: UiRole; text: string; ts?: number; source?: MsgSource; kind?: MsgKind };

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const PROD_BACKEND_FALLBACK = "https://neox-backend-production.up.railway.app";
const API_BASE_RAW =
  ((globalThis as any)?.__NEOX_API__ as string | undefined) ||
  (import.meta as any)?.env?.VITE_API_BASE ||
  PROD_BACKEND_FALLBACK;

const API_BASE = String(API_BASE_RAW || "").replace(/\/+$/, "");

const SESSION_KEY = "neox_session_id";
const LEAD_KEY = "neox_lead_id";

function handoffKey(sessionId: string) {
  return `neox_handoff:${sessionId}`;
}
function lastAdminTsKey(leadId: string) {
  return `neox_last_admin_ts:${leadId}`;
}

function safeLSGet(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeLSSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {}
}
function safeLSRemove(k: string) {
  try {
    localStorage.removeItem(k);
  } catch {}
}

function getOrCreateSessionId() {
  const existing = safeLSGet(SESSION_KEY);
  if (existing) return existing;

  let sid = "";
  try {
    sid = (globalThis.crypto as any)?.randomUUID?.() ?? uid();
  } catch {
    sid = uid();
  }
  safeLSSet(SESSION_KEY, sid);
  return sid;
}

function getStoredLeadId(): string | null {
  return safeLSGet(LEAD_KEY) || null;
}
function setStoredLeadId(leadId: string) {
  const v = String(leadId || "").trim();
  if (!v) return;
  safeLSSet(LEAD_KEY, v);
}

function getStoredHandoff(sessionId: string): boolean {
  return safeLSGet(handoffKey(sessionId)) === "1";
}
function setStoredHandoff(sessionId: string, on: boolean) {
  safeLSSet(handoffKey(sessionId), on ? "1" : "0");
}

function clearSessionAndLead() {
  safeLSRemove(SESSION_KEY);
  safeLSRemove(LEAD_KEY);
}

function getLangSafe(i18nLang?: string) {
  const raw = String(i18nLang || "").toLowerCase();
  const ok = ["az", "tr", "en", "ru", "es"];
  const short = raw.split("-")[0];
  return ok.includes(short) ? short : "az";
}

function toLlmRole(r: UiRole): LlmRole {
  return r === "user" ? "user" : "assistant";
}

function detectOperatorIntent(text: string) {
  const s = String(text || "").toLowerCase();
  return (
    s.includes("operator") ||
    s.includes("canlı dəstək") ||
    s.includes("canli destek") ||
    s.includes("insan") ||
    s.includes("real adam") ||
    s.includes("müştəri xidm") ||
    s.includes("musteri xidm") ||
    s.includes("call") ||
    s.includes("support") ||
    s.includes("live support") ||
    s.includes("human") ||
    s.includes("менеджер") ||
    s.includes("оператор") ||
    s.includes("поддерж") ||
    s.includes("zəng") ||
    s.includes("zeng") ||
    s.includes("whatsappda danış") ||
    (s.includes("whatsapp") && s.includes("yaz"))
  );
}

function RobotHeadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <path d="M32 6v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
      <circle cx="32" cy="4" r="2.2" fill="currentColor" opacity="0.9" />
      <path
        d="M16 24c0-7.732 6.268-14 14-14h4c7.732 0 14 6.268 14 14v18c0 6.627-5.373 12-12 12H28c-6.627 0-12-5.373-12-12V24Z"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.95"
      />
      <path
        d="M20 26c0-6.075 4.925-11 11-11h2c6.075 0 11 4.925 11 11v14c0 5.523-4.477 10-10 10H30c-5.523 0-10-4.477-10-10V26Z"
        fill="currentColor"
        opacity="0.08"
      />
      <path
        d="M23 33c0-2.761 2.239-5 5-5h8c2.761 0 5 2.239 5 5v2c0 2.761-2.239 5-5 5h-8c-2.761 0-5-2.239-5-5v-2Z"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.9"
      />
      <circle cx="29.5" cy="34" r="1.8" fill="currentColor" opacity="0.95" />
      <circle cx="34.5" cy="34" r="1.8" fill="currentColor" opacity="0.95" />
      <path d="M26 44h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
      <path d="M28 48h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <path d="M14 32h3M47 32h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

type WidgetServerMsg = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  ts?: number;
  channel?: string;
  meta?: any;
};

function isAdminPath(pathname: string) {
  return /^\/(az|en|tr|ru|es)\/admin(\/|$)/.test(pathname || "");
}
function isApiBaseValid(base: string) {
  if (!base) return false;
  return /^https?:\/\/[^ "]+$/i.test(base);
}

/**
 * ✅ Fix “open -> hero jump”.
 * Only on OPEN: remember current Y and restore it in the next frame(s).
 * After that, user can scroll normally.
 */
function useRestoreScrollOnOpen(open: boolean) {
  const lastYRef = useRef<number>(0);

  useEffect(() => {
    if (!open) return;

    const y = window.scrollY || 0;
    lastYRef.current = y;

    const restore = () => window.scrollTo(0, lastYRef.current);

    // 1) next paint
    const raf = requestAnimationFrame(restore);
    // 2) plus a microtask-ish tick (covers some routers/GSAP timing)
    const to = window.setTimeout(restore, 0);
    // 3) and a tiny delayed restore (covers late scrollTo)
    const to2 = window.setTimeout(restore, 60);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(to);
      window.clearTimeout(to2);
    };
  }, [open]);
}

export default function NeoxAIWidget() {
  const { t, i18n } = useTranslation();
  const location = useLocation();

  if (isAdminPath(location.pathname)) return null;

  const apiOk = useMemo(() => isApiBaseValid(API_BASE), []);
  if (!apiOk) return null;

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "suallar">("chat");
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);

  const sessionIdRef = useRef<string>(getOrCreateSessionId());
  const [handoff, setHandoff] = useState<boolean>(() => getStoredHandoff(sessionIdRef.current));

  // ✅ keeps position on open, but DOES NOT block scrolling
  useRestoreScrollOnOpen(open);

  const welcomeIdRef = useRef<string>(uid());

  const QUICK = useMemo(() => {
    const arr = t("neoxAi.quick.items", { returnObjects: true }) as unknown;
    if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) return arr as string[];
    return [
      "Instagram DM-ləri necə avtomatik cavablandıra bilərik?",
      "WhatsApp-dan gələn mesajları CRM-ə necə yazırsınız?",
      "Lead score necə hesablanır? Nələrə baxırsınız?",
      "Operatora nə vaxt route edirsiniz?",
      "Məhsul soruşan müştəriyə nümunə cavab yaz.",
      "Bir kampaniya üçün 3 hazır reply şablonu ver.",
    ];
  }, [t, i18n.language]);

  const [msgs, setMsgs] = useState<Msg[]>(() => [
    { id: welcomeIdRef.current, role: "ai", text: String(t("neoxAi.welcome")), ts: Date.now(), source: "ai", kind: "welcome" },
  ]);

  const msgsRef = useRef<Msg[]>(msgs);
  useEffect(() => {
    msgsRef.current = msgs;
  }, [msgs]);

  const [leadIdLive, setLeadIdLive] = useState<string | null>(() => getStoredLeadId());

  useEffect(() => {
    setMsgs((p) => p.map((m) => (m.kind === "welcome" ? { ...m, text: String(t("neoxAi.welcome")) } : m)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const canSend = useMemo(() => input.trim().length > 0 && !typing, [input, typing]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("neox-ai:open", onOpen as any);
    return () => window.removeEventListener("neox-ai:open", onOpen as any);
  }, []);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [msgs.length, open, typing]);

  // ===== Polling admin replies =====
  const lastSeenTsRef = useRef<number>(0);
  const pollRef = useRef<number | null>(null);
  const inflightPoll = useRef(false);
  const seenAdminIdsRef = useRef<Set<string>>(new Set());
  const pollAbortRef = useRef<AbortController | null>(null);
  const sendAbortRef = useRef<AbortController | null>(null);

  function loadLastSeenTs(leadId: string) {
    const raw = safeLSGet(lastAdminTsKey(leadId));
    lastSeenTsRef.current = Number(raw || "0") || 0;
  }
  function persistLastSeenTs(leadId: string, ts: number) {
    safeLSSet(lastAdminTsKey(leadId), String(ts || 0));
  }

  async function pollAdminReplies() {
    if (!leadIdLive) return;
    if (inflightPoll.current) return;
    inflightPoll.current = true;

    try {
      pollAbortRef.current?.abort();
    } catch {}
    const ac = new AbortController();
    pollAbortRef.current = ac;

    try {
      const sessionId = sessionIdRef.current;
      const after = lastSeenTsRef.current || 0;

      const url =
        `${API_BASE}/api/widget/messages` +
        `?lead_id=${encodeURIComponent(leadIdLive)}` +
        `&session_id=${encodeURIComponent(sessionId)}` +
        `&after=${encodeURIComponent(String(after))}`;

      const r = await fetch(url, { signal: ac.signal });
      if (!r.ok) return;

      const j = await r.json().catch(() => null);
      if (!j) return;

      const items: WidgetServerMsg[] = (j as any)?.messages || [];
      if (!Array.isArray(items) || items.length === 0) return;

      const normalized = items
        .map((x) => {
          const ts = x.ts ?? (x.createdAt ? new Date(x.createdAt).getTime() : Date.now());
          const isAdmin = x?.channel === "admin" || x?.meta?.source === "admin_panel";
          return {
            id: String(x.id || `${ts}_${Math.random().toString(16).slice(2)}`),
            role: x.role,
            text: String(x.content || "").trim(),
            ts,
            source: (isAdmin ? "admin" : "ai") as MsgSource,
          };
        })
        .filter((x) => x.role === "assistant" && x.text);

      if (normalized.length === 0) return;

      let maxTs = lastSeenTsRef.current;
      for (const it of normalized) maxTs = Math.max(maxTs, it.ts || 0);
      if (maxTs > lastSeenTsRef.current) {
        lastSeenTsRef.current = maxTs;
        persistLastSeenTs(leadIdLive, maxTs);
      }

      const fresh = normalized.filter((x) => !seenAdminIdsRef.current.has(x.id));
      if (fresh.length === 0) return;
      for (const it of fresh) seenAdminIdsRef.current.add(it.id);

      if (fresh.some((x) => x.source === "admin")) {
        setHandoff(true);
        setStoredHandoff(sessionIdRef.current, true);
      }

      setMsgs((p) => [
        ...p,
        ...fresh.map((x) => ({
          id: x.id,
          role: "ai" as const,
          text: x.text,
          ts: x.ts,
          source: x.source,
          kind: "normal" as const,
        })),
      ]);
    } catch {
      // silent
    } finally {
      inflightPoll.current = false;
    }
  }

  useEffect(() => {
    if (!leadIdLive) return;
    loadLastSeenTs(leadIdLive);
    seenAdminIdsRef.current = new Set();
    pollAdminReplies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadIdLive]);

  useEffect(() => {
    if (!leadIdLive) return;

    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => pollAdminReplies(), open ? 3500 : 9000);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      try {
        pollAbortRef.current?.abort();
      } catch {}
      pollAbortRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadIdLive, open]);

  useEffect(() => {
    return () => {
      try {
        pollAbortRef.current?.abort();
        sendAbortRef.current?.abort();
      } catch {}
    };
  }, []);

  function hardResetChat() {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;

    try {
      pollAbortRef.current?.abort();
      sendAbortRef.current?.abort();
    } catch {}

    const oldLead = getStoredLeadId();
    const oldSession = safeLSGet(SESSION_KEY) || "";

    clearSessionAndLead();
    if (oldLead) safeLSRemove(lastAdminTsKey(oldLead));
    if (oldSession) safeLSRemove(handoffKey(oldSession));

    sessionIdRef.current = getOrCreateSessionId();

    setLeadIdLive(null);
    lastSeenTsRef.current = 0;
    seenAdminIdsRef.current = new Set();
    setHandoff(false);

    setTyping(false);
    setInput("");
    setTab("chat");

    welcomeIdRef.current = uid();
    setMsgs([
      { id: welcomeIdRef.current, role: "ai", text: String(t("neoxAi.welcome")), ts: Date.now(), source: "ai", kind: "welcome" },
    ]);
  }

  async function send(text: string, opts?: { requestOperator?: boolean }) {
    const tt = text.trim();
    if (!tt || typing) return;

    const autoOp = detectOperatorIntent(tt);
    const requestOperator = handoff ? true : (opts?.requestOperator === true || autoOp === true);

    const sessionId = sessionIdRef.current;
    const lang = getLangSafe(i18n.language);
    const page = window.location.pathname;
    const leadId = getStoredLeadId();

    const userMsg: Msg = { id: uid(), role: "user", text: tt, ts: Date.now(), kind: "normal" };
    setMsgs((p) => [...p, userMsg]);
    setInput("");
    setTyping(true);

    const aiId = uid();
    setMsgs((p) => [...p, { id: aiId, role: "ai", text: "", ts: Date.now(), source: "ai", kind: "normal" }]);

    try {
      sendAbortRef.current?.abort();
    } catch {}
    const ac = new AbortController();
    sendAbortRef.current = ac;

    try {
      const history = msgsRef.current
        .filter((m) => (m.text || "").trim().length > 0)
        .filter((m) => !(m.role === "ai" && m.source === "admin"))
        .map((m) => ({ role: toLlmRole(m.role), content: m.text }));

      const payload = {
        messages: [...history, { role: "user" as const, content: tt }],
        session_id: sessionId,
        lead_id: leadId,
        lang,
        channel: "web",
        page,
        source: "ai_widget",
        request_operator: requestOperator ? true : false,
      };

      if (requestOperator) {
        setHandoff(true);
        setStoredHandoff(sessionId, true);
      }

      const r = await fetch(`${API_BASE}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ac.signal,
      });

      if (r.status === 401 || r.status === 403) {
        hardResetChat();
        throw new Error("Unauthorized");
      }

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`${r.status} ${txt || "Request failed"}`);
      }

      const data = await r.json().catch(() => ({} as any));

      const newLeadId = String((data as any)?.lead_id ?? "").trim();
      if (newLeadId) {
        setStoredLeadId(newLeadId);
        setLeadIdLive(newLeadId);
      }

      const serverHandoff = Boolean((data as any)?.handoff);
      if (requestOperator) {
        setHandoff(serverHandoff);
        setStoredHandoff(sessionId, serverHandoff);
      } else {
        setHandoff(false);
        setStoredHandoff(sessionId, false);
      }

      const full = String((data as any)?.text ?? (data as any)?.reply ?? "").trim();
      if (!full) throw new Error("Empty response from backend");

      let i = 0;
      const step = () => {
        const inc = Math.max(1, Math.floor(full.length / 120));
        i += inc;
        const next = full.slice(0, i);
        setMsgs((p) => p.map((m) => (m.id === aiId ? { ...m, text: next, source: "ai" } : m)));
        if (i < full.length) requestAnimationFrame(step);
        else setTyping(false);
      };
      requestAnimationFrame(step);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setTyping(false);
        setMsgs((p) => p.filter((m) => m.id !== aiId));
        return;
      }

      console.error("[NEOX AI] chat fail:", err);
      const msg = String(err?.message || "Request failed");

      const translated = t("neoxAi.errors.sessionReset") as string;
      const safeResetText =
        translated && !translated.includes("neoxAi.errors.")
          ? translated
          : "Xəta oldu və sessiya yeniləndi. Zəhmət olmasa mesajı yenidən yazın.";

      const shouldReset = /jwt|auth|unauthorized|invalid|expired|permission|403|401/i.test(msg);
      if (shouldReset) hardResetChat();

      setMsgs((p) =>
        p.map((m) => (m.id === aiId ? { ...m, text: shouldReset ? safeResetText : `Xəta: ${msg}`, source: "ai" } : m))
      );

      setTyping(false);
    }
  }

  function onQuick(q: string) {
    setOpen(true);
    setTab("chat");
    send(q);
  }

  function requestOperatorTextByLang() {
    const l = getLangSafe(i18n.language);
    const azText = "Operator istəyirəm. Zəhmət olmasa canlı dəstəyə qoşun.";
    const enText = "I want a human operator. Please connect me to live support.";
    const ruText = "Хочу оператора. Пожалуйста, подключите меня к живой поддержке.";
    const trText = "Canlı operatör istiyorum. Lütfen canlı desteğe bağlayın.";
    const esText = "Quiero un operador humano. Por favor, conéctenme con soporte en vivo.";
    return l === "en" ? enText : l === "ru" ? ruText : l === "tr" ? trText : l === "es" ? esText : azText;
  }

  function toggleOperator() {
    setOpen(true);
    setTab("chat");

    if (handoff) {
      const sessionId = sessionIdRef.current;
      setHandoff(false);
      setStoredHandoff(sessionId, false);
      setMsgs((p) => [...p, { id: uid(), role: "ai", text: "Operator OFF • AI ON", ts: Date.now(), source: "ai", kind: "system" }]);
      return;
    }

    const txt = requestOperatorTextByLang();
    send(txt, { requestOperator: true });
  }

  const OP_LABEL =
    (t("neoxAi.chat.operator") as string) && !String(t("neoxAi.chat.operator")).includes("neoxAi.chat.operator")
      ? (t("neoxAi.chat.operator") as string)
      : "Operator";

  const AI_LABEL =
    (t("neoxAi.chat.ai") as string) && !String(t("neoxAi.chat.ai")).includes("neoxAi.chat.ai")
      ? (t("neoxAi.chat.ai") as string)
      : "NEOX AI";

  const modeText =
    handoff
      ? ((t("neoxAi.mode.operatorOn") as string) && !String(t("neoxAi.mode.operatorOn")).includes("neoxAi.mode.operatorOn")
          ? (t("neoxAi.mode.operatorOn") as string)
          : "Operator ON • AI OFF")
      : ((t("neoxAi.mode.aiOn") as string) && !String(t("neoxAi.mode.aiOn")).includes("neoxAi.mode.aiOn")
          ? (t("neoxAi.mode.aiOn") as string)
          : "AI ON • Operator OFF");

  return (
    <div className={cx("neox-ai", open && "is-open", handoff ? "is-operator" : "is-ai")} data-open={open ? "1" : "0"}>
      {/* ✅ overlay is transparent AND does not block scrolling/clicking (so scrollbar drag works) */}
      <div
        className={cx("neox-ai-overlay", open && "is-open")}
        aria-hidden="true"
        style={{
          background: "transparent",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
          pointerEvents: "none", // IMPORTANT: allow background scroll + scrollbar drag
        }}
      />

      <button
        type="button"
        className={cx("neox-ai-fab", open && "is-open")}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((s) => !s);
        }}
        aria-label={t("neoxAi.fabAria")}
      >
        <span className="neox-ai-fabRing" aria-hidden="true" />
        <span className="neox-ai-fabCore" aria-hidden="true" />
        <span className="neox-ai-fabIcon" aria-hidden="true">
          <RobotHeadIcon className="neox-ai-robotMini" />
        </span>
        <span className="neox-ai-fabText">{t("neoxAi.brand")}</span>
        <span className="neox-ai-fabPing" aria-hidden="true" />
      </button>

      <div
        className={cx("neox-ai-panel", open && "is-open")}
        role="dialog"
        aria-modal="true"
        aria-label={t("neoxAi.panelAria")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="neox-ai-shell">
          <div className="neox-ai-decorFrame" aria-hidden="true" />
          <div className="neox-ai-decorCorners" aria-hidden="true" />
          <div className="neox-ai-scan" aria-hidden="true" />
          <div className="neox-ai-noise" aria-hidden="true" />

          <div className="neox-ai-top">
            <div className="neox-ai-brand">
              <div className="neox-ai-mark" aria-hidden="true">
                <div className="neox-ai-markGlow" />
                <div className="neox-ai-markRing" />
                <RobotHeadIcon className="neox-ai-robot" />
              </div>

              <div className="neox-ai-brandText">
                <div className="neox-ai-titleRow">
                  <div className="neox-ai-title">{t("neoxAi.brand")}</div>
                  <div className="neox-ai-status" title={modeText}>
                    <span className="neox-ai-statusDot" />
                    <span className="neox-ai-statusTxt">{t("neoxAi.status")}</span>
                  </div>
                </div>

                <div className="neox-ai-sub">{t("neoxAi.subtitle")}</div>

                <div className="neox-ai-controls">
                  <span className="neox-ai-modePill">{modeText}</span>
                  <button type="button" onClick={toggleOperator} className={cx("neox-ai-pillBtn", handoff && "is-on")}>
                    {OP_LABEL}
                  </button>
                  <button type="button" onClick={hardResetChat} className={cx("neox-ai-pillBtn", "is-reset")}>
                    {(t("neoxAi.reset") as string) && !String(t("neoxAi.reset")).includes("neoxAi.reset") ? (t("neoxAi.reset") as string) : "Reset"}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="neox-ai-x"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              aria-label={t("common.close")}
            >
              ✕
            </button>
          </div>

          <div className="neox-ai-tabs">
            <button type="button" className={cx("neox-ai-tab", tab === "chat" && "is-active")} onClick={() => setTab("chat")}>
              {t("neoxAi.tabs.chat")}
            </button>

            <button type="button" className={cx("neox-ai-tab", tab === "suallar" && "is-active")} onClick={() => setTab("suallar")}>
              {t("neoxAi.tabs.quick")}
            </button>

            <a className="neox-ai-join" href={t("neoxAi.join.href")} target="_blank" rel="noreferrer" title={t("neoxAi.join.title")}>
              {t("neoxAi.join.label")}
            </a>
          </div>

          {tab === "suallar" ? (
            <div className="neox-ai-quick">
              <div className="neox-ai-quickTitle">{t("neoxAi.quick.title")}</div>
              <div className="neox-ai-quickGrid">
                {QUICK.map((q) => (
                  <button key={q} type="button" className="neox-ai-q" onClick={() => onQuick(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="neox-ai-list" ref={listRef}>
                {msgs.map((m) => {
                  const isAdmin = m.role !== "user" && m.source === "admin";
                  return (
                    <div key={m.id} className={cx("neox-ai-msg", m.role === "user" ? "is-user" : isAdmin ? "is-admin" : "is-ai")}>
                      <div className="neox-ai-bubble">
                        <div className="neox-ai-who">{m.role === "user" ? t("neoxAi.chat.you") : isAdmin ? OP_LABEL : AI_LABEL}</div>
                        <div className="neox-ai-text">{m.text || (typing && m.role === "ai" ? "…" : "")}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="neox-ai-inputRow">
                <input
                  className="neox-ai-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("neoxAi.input.placeholder")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (canSend) send(input);
                    }
                  }}
                />

                <button type="button" className={cx("neox-ai-send", !canSend && "is-disabled")} onClick={() => send(input)} disabled={!canSend}>
                  {t("neoxAi.input.send")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
