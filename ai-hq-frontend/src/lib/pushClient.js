// src/lib/pushClient.js — FINAL (AI HQ)
// ✅ Uses VITE_API_BASE when available
// ✅ Dev fallback: if env not loaded and hostname=localhost => Railway backend
// ✅ Prod: same-origin fallback
// ✅ Stable SW registration + update + skipWaiting
// ✅ Safe JSON reading + good error surfaces

function urlBase64ToUint8Array(base64String) {
  const s = String(base64String || "").trim();
  const padding = "=".repeat((4 - (s.length % 4)) % 4);
  const base64 = (s + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function trimSlashEnd(s) {
  return String(s || "").trim().replace(/\/+$/, "");
}

// Import-meta env safe getter (avoid weird runtime contexts)
function getViteEnv(key) {
  try {
    return String(import.meta?.env?.[key] || "").trim();
  } catch {
    return "";
  }
}

function isLocalhost() {
  try {
    return typeof window !== "undefined" && window.location?.hostname === "localhost";
  } catch {
    return false;
  }
}

// Backend URL (prod: same-origin, dev: VITE_API_BASE; fallback: localhost => Railway)
export function getApiBase() {
  const v = trimSlashEnd(getViteEnv("VITE_API_BASE"));
  if (v) return v;

  // Fail-safe: env oxunmasa belə dev-də 404 olmasın
  if (isLocalhost()) return "https://ai-hq-backend-production.up.railway.app";

  return ""; // prod: same-origin
}

// Build endpoint URL safely (handles empty base)
export function apiUrl(pathname) {
  const base = getApiBase();
  const p = String(pathname || "").startsWith("/") ? pathname : `/${pathname}`;
  return base ? `${base}${p}` : p;
}

export function canPush() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function getNotificationPermission() {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

export async function askPermission() {
  if (!("Notification" in window)) return "denied";
  const p = await Notification.requestPermission();
  return p;
}

async function safeReadText(resp) {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}

async function safeReadJson(resp) {
  try {
    const ct = String(resp.headers.get("content-type") || "");
    if (ct.includes("application/json")) return await resp.json();
    // try anyway (backend might forget header)
    return await resp.json();
  } catch {
    return null;
  }
}

function normalizeErr(e) {
  if (!e) return "unknown";
  if (typeof e === "string") return e;
  return String(e?.message || e);
}

/**
 * Register and ensure latest service worker is active
 * - register /sw.js (or reuse existing)
 * - reg.update() to fetch latest sw.js (Cloudflare cache)
 * - if waiting -> postMessage SKIP_WAITING
 */
export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return { ok: false, error: "serviceWorker not supported" };

  try {
    // reuse existing registration if present
    const existing = await navigator.serviceWorker.getRegistration("/");
    const reg = existing || (await navigator.serviceWorker.register("/sw.js"));

    // wait until ready
    await navigator.serviceWorker.ready;

    // force check for update
    try {
      await reg.update();
    } catch {}

    // if new worker is waiting, activate it
    try {
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {}

    return { ok: true, reg };
  } catch (e) {
    return { ok: false, error: normalizeErr(e) };
  }
}

/**
 * Subscribe for push and send subscription to backend
 * @param {string} vapidPublicKey - from backend /api/push/vapid or env VITE_VAPID_PUBLIC_KEY
 * @param {string} recipient - e.g. "ceo"
 */
export async function subscribePush({ vapidPublicKey, recipient = "ceo" }) {
  if (!canPush()) return { ok: false, error: "push not supported in this browser" };

  const key = String(vapidPublicKey || "").trim();
  if (!key) return { ok: false, error: "missing VAPID public key" };

  const perm = await getNotificationPermission();
  if (perm !== "granted") return { ok: false, error: `permission=${perm}` };

  const sw = await registerServiceWorker();
  if (!sw.ok) return { ok: false, error: sw.error };

  const reg = sw.reg;
  const appServerKey = urlBase64ToUint8Array(key);

  // get or create subscription
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });
  }

  const url = apiUrl("/api/push/subscribe");

  // optional debug logs
  try {
    const isDev = getViteEnv("DEV") === "true" || getViteEnv("MODE") === "development";
    if (isDev) {
      console.log("[push] VITE_API_BASE =", getViteEnv("VITE_API_BASE") || "(empty)");
      console.log("[push] resolved base =", getApiBase() || "(same-origin)");
      console.log("[push] subscribe url =", url);
    }
  } catch {}

  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        recipient,
        subscription: sub.toJSON(),
      }),
    });
  } catch (e) {
    return { ok: false, error: `network: ${normalizeErr(e)}` };
  }

  const json = await safeReadJson(resp);
  const text = json ? "" : await safeReadText(resp);

  const ok = Boolean(resp.ok && (json?.ok ?? true));

  return {
    ok,
    status: resp.status,
    json,
    text,
    subscription: sub,
  };
}

/**
 * Unsubscribe locally (browser) + optionally tell backend to delete if you add endpoint later
 */
export async function unsubscribePush() {
  if (!("serviceWorker" in navigator)) return { ok: false, error: "serviceWorker not supported" };

  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) return { ok: true, unsubscribed: false };

    const sub = await reg.pushManager.getSubscription();
    if (!sub) return { ok: true, unsubscribed: false };

    const done = await sub.unsubscribe();
    return { ok: true, unsubscribed: Boolean(done) };
  } catch (e) {
    return { ok: false, error: normalizeErr(e) };
  }
}

/**
 * Debug helper: run a push test from the browser (needs backend /api/push/test POST)
 * If backend requires DEBUG_API_TOKEN, pass debugToken and backend should read x-debug-token
 */
export async function sendPushTest({
  title = "AI HQ Test ✅",
  body = "Push from browser",
  data = { type: "push.test", ts: new Date().toISOString() },
  debugToken = "",
} = {}) {
  const url = apiUrl("/api/push/test");

  const headers = { "Content-Type": "application/json; charset=utf-8" };
  if (debugToken) headers["x-debug-token"] = String(debugToken);

  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ title, body, data }),
    });
  } catch (e) {
    return { ok: false, error: `network: ${normalizeErr(e)}` };
  }

  const json = await safeReadJson(resp);
  const text = json ? "" : await safeReadText(resp);

  return {
    ok: Boolean(resp.ok && (json?.ok ?? true)),
    status: resp.status,
    json,
    text,
  };
}