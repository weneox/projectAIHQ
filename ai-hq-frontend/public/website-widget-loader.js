/* global document, window, URL, console, fetch */

(function websiteWidgetLoader() {
  const script = document.currentScript;
  if (!script) return;

  const widgetId = String(script.dataset.widgetId || "").trim().toLowerCase();
  if (!widgetId) {
    if (String(script.dataset.tenantKey || "").trim()) {
      console.warn("[aihq-widget] data-tenant-key is no longer supported. Use data-widget-id.");
    } else {
      console.warn("[aihq-widget] data-widget-id is required");
    }
    return;
  }

  const widgetBase =
    String(script.dataset.widgetBase || "").trim() ||
    new URL(script.src, window.location.href).origin;
  const apiBase = String(script.dataset.apiBase || "").trim() || widgetBase;
  const accent = String(script.dataset.accent || "").trim();
  const launcherLabel = String(script.dataset.label || "").trim() || "Chat";
  const side =
    String(script.dataset.side || "").trim().toLowerCase() === "left"
      ? "left"
      : "right";

  function normalizeApiBase(raw) {
    const clean = String(raw || "").trim().replace(/\/+$/, "");
    if (!clean) return "/api";
    return /\/api$/i.test(clean) ? clean : `${clean}/api`;
  }

  function buildApiUrl(path) {
    const cleanPath = String(path || "").startsWith("/")
      ? String(path || "")
      : `/${String(path || "")}`;
    return `${normalizeApiBase(apiBase)}${cleanPath}`;
  }

  function buildIframeUrl(bootstrapToken) {
    const url = new URL("/widget/website-chat", widgetBase);
    url.searchParams.set("widgetId", widgetId);
    url.searchParams.set("bootstrapToken", bootstrapToken);
    url.searchParams.set("apiBase", apiBase);
    if (accent) url.searchParams.set("accent", accent);
    return url.toString();
  }

  async function requestInstallToken() {
    const response = await fetch(buildApiUrl("/public/widget/install-token"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
      },
      credentials: "omit",
      body: JSON.stringify({
        widgetId,
        page: {
          url: window.location.href,
          title: document.title || "",
          referrer: document.referrer || "",
        },
      }),
    });

    const payload = await response.json().catch(() => ({
      ok: false,
      error: "invalid_response",
    }));

    if (!response.ok || payload?.ok === false) {
      throw new Error(
        String(
          payload?.details?.message ||
            payload?.error ||
            "Website chat could not be verified for this page."
        ).trim()
      );
    }

    return payload;
  }

  const root = document.createElement("div");
  root.setAttribute("data-aihq-website-widget", "true");
  Object.assign(root.style, {
    position: "fixed",
    bottom: "20px",
    [side]: "20px",
    zIndex: "2147483000",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  });

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    width: "min(92vw, 400px)",
    height: "min(78vh, 680px)",
    borderRadius: "28px",
    overflow: "hidden",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.22)",
    border: "1px solid rgba(255,255,255,0.6)",
    background: "#ffffff",
    display: "none",
    marginBottom: "14px",
    position: "relative",
  });

  const iframe = document.createElement("iframe");
  iframe.title = "AI HQ website chat";
  iframe.loading = "lazy";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";

  const statusBox = document.createElement("div");
  Object.assign(statusBox.style, {
    position: "absolute",
    inset: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    textAlign: "center",
    color: "#475467",
    fontSize: "14px",
    lineHeight: "1.7",
    background: "linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)",
  });
  statusBox.textContent = "Opening website chat...";

  panel.appendChild(iframe);
  panel.appendChild(statusBox);

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = launcherLabel;
  Object.assign(button.style, {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    minWidth: "68px",
    height: "56px",
    padding: "0 22px",
    border: "0",
    borderRadius: "999px",
    background: accent || "#0f172a",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.26)",
  });

  let open = false;
  let loading = false;

  function setStatus(message, tone) {
    statusBox.textContent = String(message || "").trim();
    statusBox.style.display = "flex";
    statusBox.style.color = tone === "danger" ? "#b42318" : "#475467";
    statusBox.style.background =
      tone === "danger"
        ? "linear-gradient(180deg,#fff5f5 0%,#fef2f2 100%)"
        : "linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)";
  }

  function hideStatus() {
    statusBox.style.display = "none";
  }

  function sync() {
    panel.style.display = open ? "block" : "none";

    if (loading) {
      button.textContent = "Opening...";
      return;
    }

    button.textContent = open ? "Close" : launcherLabel;
  }

  async function ensureIframeReady() {
    if (iframe.src) {
      hideStatus();
      return true;
    }

    loading = true;
    setStatus("Verifying this website install...", "neutral");
    sync();

    try {
      const payload = await requestInstallToken();
      iframe.src = buildIframeUrl(String(payload.bootstrapToken || "").trim());
      hideStatus();
      return true;
    } catch (error) {
      setStatus(
        error?.message ||
          "Website chat could not be verified for this page.",
        "danger"
      );
      return false;
    } finally {
      loading = false;
      sync();
    }
  }

  button.addEventListener("click", async function handleToggle() {
    if (open) {
      open = false;
      sync();
      return;
    }

    open = true;
    sync();
    await ensureIframeReady();
  });

  root.appendChild(panel);
  root.appendChild(button);
  document.body.appendChild(root);
  sync();
})();
