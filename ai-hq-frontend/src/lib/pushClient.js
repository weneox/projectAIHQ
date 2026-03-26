function urlBase64ToUint8Array(base64String) {
  const s = String(base64String || "").trim();
  const padding = "=".repeat((4 - (s.length % 4)) % 4);
  const base64 = (s + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function trimSlashEnd(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getViteEnv(key) {
  try {
    return String(import.meta?.env?.[key] || "").trim();
  } catch {
    return "";
  }
}

function isTruthyFlag(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

export function getApiBase() {
  return trimSlashEnd(getViteEnv("VITE_API_BASE"));
}

export function isServiceWorkerEnabled() {
  const prod = getViteEnv("PROD") === "true" || getViteEnv("MODE") === "production";
  return prod && isTruthyFlag(getViteEnv("VITE_ENABLE_SERVICE_WORKER"));
}

export function apiUrl(pathname) {
  const base = getApiBase();
  if (!base) return "";

  const path = String(pathname || "").startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${path}`;
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
  return Notification.requestPermission();
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
    return await resp.json();
  } catch {
    return null;
  }
}

function normalizeErr(error) {
  if (!error) return "unknown";
  if (typeof error === "string") return error;
  return String(error?.message || error);
}

export async function registerServiceWorker() {
  if (!isServiceWorkerEnabled()) {
    return { ok: false, error: "service worker disabled" };
  }

  if (!("serviceWorker" in navigator)) {
    return { ok: false, error: "serviceWorker not supported" };
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    const reg = existing || (await navigator.serviceWorker.register("/sw.js"));

    await navigator.serviceWorker.ready;

    try {
      await reg.update();
    } catch {}

    try {
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {}

    return { ok: true, reg };
  } catch (error) {
    return { ok: false, error: normalizeErr(error) };
  }
}

export async function subscribePush({ vapidPublicKey, recipient = "ceo" }) {
  if (!canPush()) return { ok: false, error: "push not supported in this browser" };

  const key = String(vapidPublicKey || "").trim();
  if (!key) return { ok: false, error: "missing VAPID public key" };
  if (!getApiBase()) return { ok: false, error: "missing VITE_API_BASE" };

  const perm = await getNotificationPermission();
  if (perm !== "granted") return { ok: false, error: `permission=${perm}` };

  const sw = await registerServiceWorker();
  if (!sw.ok) return { ok: false, error: sw.error };

  const reg = sw.reg;
  const appServerKey = urlBase64ToUint8Array(key);

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });
  }

  const url = apiUrl("/api/push/subscribe");

  try {
    const isDev = getViteEnv("DEV") === "true" || getViteEnv("MODE") === "development";
    if (isDev) {
      console.log("[push] VITE_API_BASE =", getViteEnv("VITE_API_BASE") || "(empty)");
      console.log("[push] resolved base =", getApiBase() || "(missing)");
      console.log("[push] subscribe url =", url || "(missing)");
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
  } catch (error) {
    return { ok: false, error: `network: ${normalizeErr(error)}` };
  }

  const json = await safeReadJson(resp);
  const text = json ? "" : await safeReadText(resp);

  return {
    ok: Boolean(resp.ok && (json?.ok ?? true)),
    status: resp.status,
    json,
    text,
    subscription: sub,
  };
}

export async function unsubscribePush() {
  if (!("serviceWorker" in navigator)) {
    return { ok: false, error: "serviceWorker not supported" };
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) return { ok: true, unsubscribed: false };

    const sub = await reg.pushManager.getSubscription();
    if (!sub) return { ok: true, unsubscribed: false };

    const done = await sub.unsubscribe();
    return { ok: true, unsubscribed: Boolean(done) };
  } catch (error) {
    return { ok: false, error: normalizeErr(error) };
  }
}

export async function sendPushTest({
  title = "AI HQ Test",
  body = "Push from browser",
  data = { type: "push.test", ts: new Date().toISOString() },
  debugToken = "",
} = {}) {
  if (!getApiBase()) return { ok: false, error: "missing VITE_API_BASE" };

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
  } catch (error) {
    return { ok: false, error: `network: ${normalizeErr(error)}` };
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
