/* public/sw.js — AI HQ PWA Service Worker (Push + Notification Click) */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ✅ allow page to force-activate updated SW
self.addEventListener("message", (event) => {
  const t = event?.data?.type;
  if (t === "SKIP_WAITING") self.skipWaiting();
});

// Push event (backend web-push buranı vurur)
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "AI HQ";
  const body = data.body || "";
  const payload = data.data || {};

  const type = payload?.type || "ai-hq";
  const proposalId = payload?.proposalId || payload?.proposal_id || null;
  const jobId = payload?.jobId || payload?.job_id || null;

  // ✅ IMPORTANT: tag unique olmalıdır, yoxsa notification “üst-üstə yazılır”
  const uniqueTag =
    payload?.tag ||
    `ai-hq:${type}:${proposalId || jobId || Date.now()}`;

  // routing
  let target = "/";
  if (type === "proposal.created" || type === "proposal.updated") target = "/proposals";
  if (type === "job.updated") target = "/executions";
  if (type === "notification.created") target = "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { ...payload, _target: target },
      badge: "/pwa-192.png",
      icon: "/pwa-192.png",

      tag: uniqueTag,
      renotify: true,                 // ✅ eyni tag olsa belə xəbər versin
      requireInteraction: false,       // istəsən true eləyərik (bildiriş ekranda qalacaq)
      silent: false,
    })
  );
});

// Notification click → app aç + uyğun səhifəyə get
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification?.data || {};
  const target = data._target || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          try { await client.navigate(target); } catch {}
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })()
  );
});