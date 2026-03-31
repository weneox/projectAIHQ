import { validateRealtimeEnvelope } from "@aihq/shared-contracts/realtime";

const RAW_API_BASE = String(import.meta.env.VITE_API_BASE || "").trim();
const RAW_WS_URL = String(import.meta.env.VITE_WS_URL || "").trim();

function s(v, d = "") {
  return String(v ?? d).trim();
}

function trimTrailingSlash(value = "") {
  return s(value).replace(/\/+$/, "");
}

function safeJson(x) {
  try {
    if (typeof x === "string") return JSON.parse(x);
    return x ?? null;
  } catch {
    return null;
  }
}

function isAbsoluteHttpUrl(value = "") {
  return /^https?:\/\//i.test(s(value));
}

function isAbsoluteWsUrl(value = "") {
  return /^wss?:\/\//i.test(s(value));
}

function getBrowserHttpOrigin() {
  if (typeof window === "undefined") return "http://localhost:5173";
  return `${window.location.protocol}//${window.location.host}`;
}

function getBrowserWsOrigin() {
  if (typeof window === "undefined") return "ws://localhost:5173";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}`;
}

function absolutizeWsBase(value = "") {
  const raw = trimTrailingSlash(value);
  if (!raw) return "";

  if (isAbsoluteWsUrl(raw)) {
    return raw;
  }

  if (isAbsoluteHttpUrl(raw)) {
    return raw.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
  }

  if (raw.startsWith("/")) {
    return `${getBrowserWsOrigin()}${raw}`;
  }

  try {
    return new URL(raw, `${getBrowserWsOrigin()}/`).toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function resolveApiBase() {
  const raw = trimTrailingSlash(RAW_API_BASE);
  if (!raw) return "/api";
  return raw;
}

function buildRealtimeSessionEndpoint() {
  const base = resolveApiBase();

  if (/\/api$/i.test(base)) {
    return `${base}/auth/realtime-session`;
  }

  return `${base}/api/auth/realtime-session`;
}

function buildFallbackWsUrl() {
  const configuredWs = absolutizeWsBase(RAW_WS_URL);
  if (configuredWs) return configuredWs;

  const base = resolveApiBase();

  if (isAbsoluteHttpUrl(base)) {
    return base
      .replace(/^https:/i, "wss:")
      .replace(/^http:/i, "ws:")
      .replace(/\/api$/i, "") + "/ws";
  }

  return `${getBrowserWsOrigin()}/ws`;
}

async function requestRealtimeSession() {
  const endpoint = buildRealtimeSessionEndpoint();

  const res = await fetch(endpoint, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  const text = await res.text().catch(() => "");
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok || json?.ok === false || !json?.realtime?.ticket) {
    const err = new Error(
      s(json?.reason || json?.error || `realtime_session_failed_${res.status}`)
    );
    err.status = res.status;
    err.payload = json;
    throw err;
  }

  return {
    wsUrl: s(json?.realtime?.wsUrl),
    ticket: s(json?.realtime?.ticket),
    scope: {
      tenantKey: s(json?.realtime?.tenantKey).toLowerCase(),
      tenantId: s(json?.realtime?.tenantId),
      role: s(json?.realtime?.role || "member").toLowerCase(),
      audience: s(json?.realtime?.audience || "tenant").toLowerCase(),
    },
  };
}

function buildSocketUrl(session = {}) {
  const preferredWsBase =
    absolutizeWsBase(RAW_WS_URL) ||
    absolutizeWsBase(session.wsUrl) ||
    buildFallbackWsUrl();

  const wsBase = trimTrailingSlash(preferredWsBase);
  const ticket = s(session.ticket);

  if (!wsBase || !ticket) return "";

  const sep = wsBase.includes("?") ? "&" : "?";
  return `${wsBase}${sep}ticket=${encodeURIComponent(ticket)}`;
}

export function createWsClient({ onEvent, onStatus, maxDelayMs = 12000 } = {}) {
  let ws = null;
  let stopped = false;
  let attempt = 0;
  let reconnectTimer = null;
  let currentUrl = "";
  let manuallyClosed = false;
  let realtimeScope = null;

  const notifyStatus = (status) => {
    try {
      if (typeof onStatus === "function") onStatus(status);
    } catch {}
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const cleanupSocket = () => {
    if (!ws) return;

    try {
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
    } catch {}

    try {
      if (ws.readyState === WebSocket.OPEN) {
        manuallyClosed = true;
        ws.close(1000, "manual");
      }
    } catch {}

    ws = null;
  };

  const scheduleReconnect = () => {
    if (stopped) return;

    attempt = Math.min(attempt + 1, 50);
    const base = Math.min(maxDelayMs, 450 * Math.pow(1.6, attempt));
    const jitter = Math.floor(Math.random() * 300);
    const delay = Math.min(maxDelayMs, base + jitter);

    clearReconnectTimer();

    notifyStatus({
      state: "reconnecting",
      attempt,
      delayMs: delay,
      scope: realtimeScope,
    });

    reconnectTimer = setTimeout(() => {
      if (stopped) return;
      void connect();
    }, delay);
  };

  const connect = async () => {
    if (stopped) return;

    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (!buildFallbackWsUrl()) {
      notifyStatus({
        state: "off",
        detail: "missing realtime endpoint configuration",
      });
      return;
    }

    clearReconnectTimer();
    manuallyClosed = false;

    notifyStatus({
      state: attempt === 0 ? "authorizing" : "reauthorizing",
      attempt,
    });

    let session;
    try {
      session = await requestRealtimeSession();
      realtimeScope = session.scope || null;
    } catch (err) {
      notifyStatus({
        state: Number(err?.status || 0) === 401 ? "unauthorized" : "error",
        detail: s(err?.message || "realtime session failed"),
      });

      if (!stopped && Number(err?.status || 0) !== 401) {
        scheduleReconnect();
      }
      return;
    }

    const url = buildSocketUrl(session);
    currentUrl = url;

    if (!url) {
      notifyStatus({
        state: "error",
        detail: "realtime socket url missing",
      });
      scheduleReconnect();
      return;
    }

    notifyStatus({
      state: attempt === 0 ? "connecting" : "reconnecting",
      attempt,
      url,
      scope: realtimeScope,
    });

    try {
      ws = new WebSocket(url);

      ws.onopen = () => {
        attempt = 0;
        notifyStatus({
          state: "connected",
          url: currentUrl,
          scope: realtimeScope,
        });
      };

      ws.onclose = (ev) => {
        const wasManual = manuallyClosed;
        manuallyClosed = false;
        ws = null;

        const unauthorized = Number(ev?.code || 0) === 1008;

        notifyStatus({
          state: unauthorized ? "unauthorized" : "disconnected",
          code: ev?.code ?? null,
          reason: ev?.reason || "",
          wasClean: Boolean(ev?.wasClean),
          scope: realtimeScope,
        });

        if (stopped || wasManual || unauthorized) return;
        scheduleReconnect();
      };

      ws.onerror = () => {
        notifyStatus({
          state: "error",
          url: currentUrl,
          scope: realtimeScope,
        });
      };

      ws.onmessage = (ev) => {
        const msg = safeJson(ev.data);
        if (!msg || typeof msg !== "object") return;

        const type = msg.type || msg.event;
        if (!type) return;

        if (type !== "hello") {
          const checked = validateRealtimeEnvelope(msg);
          if (!checked.ok) {
            notifyStatus({
              state: "error",
              detail: checked.error,
              scope: realtimeScope,
            });
            return;
          }
        }

        try {
          if (typeof onEvent === "function") {
            onEvent({
              type,
              payload: msg,
              raw: ev.data,
            });
          }
        } catch {}
      };
    } catch (err) {
      notifyStatus({
        state: "error",
        detail: s(err?.message || "WebSocket init failed"),
      });
      scheduleReconnect();
    }
  };

  return {
    start() {
      stopped = false;
      attempt = 0;
      clearReconnectTimer();
      void connect();
    },

    stop() {
      stopped = true;
      clearReconnectTimer();
      cleanupSocket();
      notifyStatus({ state: "stopped", scope: realtimeScope });
    },

    send(obj) {
      try {
        if (!ws || ws.readyState !== WebSocket.OPEN) return false;
        ws.send(JSON.stringify(obj));
        return true;
      } catch {
        return false;
      }
    },

    canUseWs() {
      return Boolean(buildFallbackWsUrl());
    },

    getState() {
      if (!ws) return "idle";
      if (ws.readyState === WebSocket.CONNECTING) return "connecting";
      if (ws.readyState === WebSocket.OPEN) return "open";
      if (ws.readyState === WebSocket.CLOSING) return "closing";
      return "closed";
    },
  };
}