/* global document, window, URL, console */

(function websiteWidgetLoader() {
  const script = document.currentScript;
  if (!script) return;

  const tenantKey = String(script.dataset.tenantKey || "").trim();
  if (!tenantKey) {
    console.warn("[aihq-widget] data-tenant-key is required");
    return;
  }

  const widgetBase =
    String(script.dataset.widgetBase || "").trim() ||
    new URL(script.src, window.location.href).origin;
  const apiBase = String(script.dataset.apiBase || "").trim();
  const accent = String(script.dataset.accent || "").trim();
  const launcherLabel = String(script.dataset.label || "").trim() || "Chat";
  const side = String(script.dataset.side || "").trim().toLowerCase() === "left"
    ? "left"
    : "right";

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
  });

  const iframe = document.createElement("iframe");
  iframe.title = "AI HQ website chat";
  iframe.loading = "lazy";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  panel.appendChild(iframe);

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

  function buildIframeUrl() {
    const url = new URL("/widget/website-chat", widgetBase);
    url.searchParams.set("tenantKey", tenantKey);
    url.searchParams.set("pageUrl", window.location.href);
    url.searchParams.set("pageTitle", document.title || "");
    url.searchParams.set("referrer", document.referrer || "");
    if (apiBase) url.searchParams.set("apiBase", apiBase);
    if (accent) url.searchParams.set("accent", accent);
    return url.toString();
  }

  let open = false;

  function sync() {
    panel.style.display = open ? "block" : "none";
    button.textContent = open ? "Close" : launcherLabel;
    if (open && iframe.src !== buildIframeUrl()) {
      iframe.src = buildIframeUrl();
    }
  }

  button.addEventListener("click", function handleToggle() {
    open = !open;
    sync();
  });

  root.appendChild(panel);
  root.appendChild(button);
  document.body.appendChild(root);
  sync();
})();
