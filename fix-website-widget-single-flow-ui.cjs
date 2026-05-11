const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "ai-hq-frontend/src/components/channels/WebsiteWidgetDetailDrawer.jsx");

const code = `import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Copy,
  Globe2,
  Inbox,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";

import {
  checkWebsiteDomainVerification,
  createWebsiteDomainVerificationChallenge,
  createWebsiteWidgetInstallHandoff,
  createWebsiteWidgetTestMessage,
  getWebsiteDomainVerificationStatus,
  getWebsiteWidgetStatus,
  saveWebsiteWidgetConfig,
} from "../../api/channelConnect.js";
import {
  buildWorkspaceScopedQueryKey,
  useWorkspaceTenantKey,
} from "../../hooks/useWorkspaceTenantKey.js";
import { s } from "../../lib/appUi.js";
import { cx } from "../../lib/cx.js";
import { emitLaunchSliceRefresh } from "../../lib/launchSliceRefresh.js";
import Button from "../ui/Button.jsx";
import { InlineNotice } from "../ui/AppShellPrimitives.jsx";
import ChannelIcon from "./ChannelIcon.jsx";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeDomain(value = "") {
  const raw = s(value).replace(/^https?:\\/\\//i, "").replace(/^www\\./i, "");
  return raw.split("/")[0].split("?")[0].trim().toLowerCase();
}

function firstText(...values) {
  for (const value of values) {
    const next = s(value);
    if (next) return next;
  }
  return "";
}

function firstArrayValue(value) {
  return arr(value).map((item) => s(item)).filter(Boolean)[0] || "";
}

function buildInitialForm(payload = {}) {
  const widget = obj(payload.widget);
  const domain = firstText(
    widget.domain,
    widget.websiteDomain,
    firstArrayValue(widget.allowedDomains),
    firstArrayValue(widget.allowedOrigins)
  );

  return {
    enabled: widget.enabled !== false,
    domain: normalizeDomain(domain),
    title: s(widget.title, "How can we help?"),
    subtitle: s(widget.subtitle, "Ask anything about the business."),
    accentColor: s(widget.accentColor, "#2e60ff"),
  };
}

function getWidgetId(payload = {}) {
  const widget = obj(payload.widget);
  return s(widget.publicWidgetId || widget.widgetId || payload.publicWidgetId || payload.widgetId);
}

function getVerificationState(payload = {}, verification = {}) {
  const surface = obj(payload.verificationSurface);
  const launch = obj(payload.launchReadiness);
  const direct = obj(verification);

  return s(
    direct.state ||
      surface.state ||
      launch.domainVerificationState ||
      payload.domainVerificationState ||
      "unverified"
  ).toLowerCase();
}

function isVerified(payload = {}, verification = {}) {
  return getVerificationState(payload, verification) === "verified";
}

function isProductionReady(payload = {}, verification = {}) {
  const install = obj(payload.install);
  const launch = obj(payload.launchReadiness);
  const readiness = obj(payload.readiness);

  return (
    isVerified(payload, verification) &&
    (install.productionInstallReady === true ||
      launch.productionLaunchAllowed === true ||
      s(readiness.status).toLowerCase() === "ready")
  );
}

function statusCopy(payload = {}, verification = {}) {
  const widget = obj(payload.widget);
  const widgetId = getWidgetId(payload);
  const verified = isVerified(payload, verification);
  const ready = isProductionReady(payload, verification);

  if (ready) {
    return {
      tone: "success",
      eyebrow: "Ready",
      title: "Website chat is ready to install.",
      body: "The widget is configured, the domain is verified, and the install snippet can be used on the website.",
    };
  }

  if (!widget.enabled) {
    return {
      tone: "warning",
      eyebrow: "Off",
      title: "Website chat is disabled.",
      body: "Turn it on and save changes before testing the public widget.",
    };
  }

  if (!widgetId) {
    return {
      tone: "warning",
      eyebrow: "Save first",
      title: "Create the public widget ID.",
      body: "Save this setup once. After that, the install snippet and test flow will become available.",
    };
  }

  if (!verified) {
    return {
      tone: "warning",
      eyebrow: "Domain review",
      title: "Verify the website domain.",
      body: "Confirm that this domain is allowed to load the widget before public installation.",
    };
  }

  return {
    tone: "warning",
    eyebrow: "Install pending",
    title: "Install and test the widget.",
    body: "The domain is verified. Copy the snippet and send one test message to Inbox.",
  };
}

function toneClass(tone = "neutral") {
  if (tone === "success") return "border-success/25 bg-success/5 text-success";
  if (tone === "danger") return "border-danger/25 bg-danger/5 text-danger";
  if (tone === "warning") return "border-warning/25 bg-warning/5 text-warning";
  return "border-line-soft bg-surface-subtle text-text-muted";
}

function buildSnippet({ widgetId = "", accentColor = "" } = {}) {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://hq.weneox.com";

  if (!s(widgetId)) return "";

  return [
    "<script",
    "src=\\"" + origin + "/website-widget-loader.js\\"",
    "data-widget-id=\\"" + s(widgetId) + "\\"",
    "data-api-base=\\"" + origin + "/api\\"",
    s(accentColor) ? "data-accent=\\"" + s(accentColor) + "\\"" : "",
    "async",
    "></script>",
  ]
    .filter(Boolean)
    .join(" ");
}

async function copyText(value = "") {
  const text = s(value);
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function TextField({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-md border border-line-soft bg-white px-3.5 text-[14px] font-semibold text-text outline-none transition-[border-color,box-shadow] placeholder:text-text-subtle focus:border-[rgba(var(--color-brand),0.45)] focus:shadow-[0_0_0_3px_rgba(var(--color-brand),0.10)]"
      />
    </label>
  );
}

function StepPill({ done, active, label }) {
  return (
    <div
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12.5px] font-semibold",
        done
          ? "border-success/25 bg-success/5 text-success"
          : active
            ? "border-[rgba(var(--color-brand),0.28)] bg-brand-soft text-brand"
            : "border-line-soft bg-surface-subtle text-text-muted"
      )}
    >
      {done ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.25} /> : null}
      {label}
    </div>
  );
}

function Surface({ children, className = "" }) {
  return (
    <section
      className={cx(
        "rounded-xl border border-line-soft bg-white p-5 shadow-[0_24px_70px_-58px_rgba(15,23,42,0.55)]",
        className
      )}
    >
      {children}
    </section>
  );
}

export default function WebsiteWidgetDetailDrawer({
  channel,
  open = false,
  onClose,
  onNavigate,
}) {
  const queryClient = useQueryClient();
  const workspace = useWorkspaceTenantKey({ enabled: open });
  const [formDraft, setFormDraft] = useState(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState(null);

  const statusQueryKey = buildWorkspaceScopedQueryKey(
    ["website-widget-status"],
    workspace.tenantKey
  );

  const statusQuery = useQuery({
    queryKey: statusQueryKey,
    queryFn: getWebsiteWidgetStatus,
    enabled: open && workspace.ready,
    staleTime: 8_000,
    refetchOnWindowFocus: false,
  });

  const widgetStatus = obj(statusQuery.data);
  const form = formDraft || buildInitialForm(widgetStatus);
  const domain = normalizeDomain(form.domain);
  const widgetId = getWidgetId(widgetStatus);

  const verificationQuery = useQuery({
    queryKey: buildWorkspaceScopedQueryKey(
      ["website-domain-verification", domain],
      workspace.tenantKey
    ),
    queryFn: () => getWebsiteDomainVerificationStatus({ domain }),
    enabled: open && workspace.ready && Boolean(domain),
    staleTime: 8_000,
    refetchOnWindowFocus: false,
  });

  const verification = obj(verificationQuery.data);
  const verified = isVerified(widgetStatus, verification);
  const productionReady = isProductionReady(widgetStatus, verification);
  const currentStatus = statusCopy(widgetStatus, verification);
  const snippet = buildSnippet({ widgetId, accentColor: form.accentColor });

  function updateForm(patch = {}) {
    setFormDraft((current) => ({
      ...form,
      ...(current || {}),
      ...patch,
    }));
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      saveWebsiteWidgetConfig({
        enabled: form.enabled,
        title: s(form.title),
        subtitle: s(form.subtitle),
        accentColor: s(form.accentColor),
        allowedDomains: domain ? [domain] : [],
        allowedOrigins: domain ? ["https://" + domain] : [],
        initialPrompts: [],
      }),
    async onSuccess() {
      setNotice({ tone: "success", text: "Website chat settings saved." });
      setFormDraft(null);
      await queryClient.invalidateQueries({ queryKey: statusQueryKey });
      emitLaunchSliceRefresh({
        tenantKey: workspace.tenantKey,
        reason: "website-widget-saved",
      });
    },
    onError(error) {
      setNotice({
        tone: "danger",
        text: s(error?.message, "Website chat settings could not be saved."),
      });
    },
  });

  const challengeMutation = useMutation({
    mutationFn: () => createWebsiteDomainVerificationChallenge({ domain }),
    async onSuccess() {
      setNotice({ tone: "success", text: "Domain verification challenge prepared." });
      await verificationQuery.refetch();
    },
    onError(error) {
      setNotice({
        tone: "danger",
        text: s(error?.message, "Domain verification challenge failed."),
      });
    },
  });

  const checkMutation = useMutation({
    mutationFn: () => checkWebsiteDomainVerification({ domain }),
    async onSuccess() {
      setNotice({ tone: "success", text: "Domain verification checked." });
      await verificationQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: statusQueryKey });
      emitLaunchSliceRefresh({
        tenantKey: workspace.tenantKey,
        reason: "website-domain-verification-checked",
      });
    },
    onError(error) {
      setNotice({
        tone: "danger",
        text: s(error?.message, "Domain verification check failed."),
      });
    },
  });

  const installMutation = useMutation({
    mutationFn: () =>
      createWebsiteWidgetInstallHandoff({
        domain,
        widgetId,
        method: "manual_snippet",
      }),
    onSuccess() {
      setNotice({ tone: "success", text: "Install package prepared." });
    },
    onError(error) {
      setNotice({
        tone: "danger",
        text: s(error?.message, "Install package could not be prepared."),
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: () =>
      createWebsiteWidgetTestMessage({
        text: "Website chat setup test message",
        domain,
        widgetId,
      }),
    onSuccess() {
      setNotice({ tone: "success", text: "Test message sent to Inbox." });
      emitLaunchSliceRefresh({
        tenantKey: workspace.tenantKey,
        reason: "website-widget-test-message",
      });
    },
    onError(error) {
      setNotice({
        tone: "danger",
        text: s(error?.message, "Test message could not be sent."),
      });
    },
  });

  async function handleCopy() {
    const ok = await copyText(snippet);
    setCopied(ok);
    setNotice({
      tone: ok ? "success" : "danger",
      text: ok ? "Snippet copied." : "Snippet could not be copied.",
    });
  }

  const loading = statusQuery.isLoading && !statusQuery.data;

  return (
    <aside
      aria-hidden={!open}
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface"
    >
      <header className="shrink-0 border-b border-line-soft bg-surface px-6 py-5">
        <div className="flex items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line-soft bg-white shadow-[0_16px_36px_-30px_rgba(15,23,42,0.55)]">
              <ChannelIcon channel={channel} size="lg" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-[24px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
                Website chat
              </h1>
              <p className="mt-1 text-[13px] font-medium text-text-muted">
                Configure, verify, install.
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close website chat setup"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line-soft bg-white text-text-muted transition-colors hover:bg-surface-subtle hover:text-text"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted px-6 py-5">
        <div className="mx-auto max-w-[860px] space-y-4">
          {loading ? (
            <InlineNotice tone="info" compact description="Loading website chat status..." />
          ) : null}

          {notice?.text ? (
            <InlineNotice tone={notice.tone} compact description={notice.text} />
          ) : null}

          {statusQuery.error ? (
            <InlineNotice
              tone="danger"
              compact
              description={s(statusQuery.error?.message, "Website chat status could not be loaded.")}
            />
          ) : null}

          <Surface className="overflow-hidden">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className={cx("inline-flex rounded-full border px-3 py-1.5 text-[12px] font-semibold", toneClass(currentStatus.tone))}>
                  {currentStatus.eyebrow}
                </div>

                <h2 className="mt-4 text-[24px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
                  {currentStatus.title}
                </h2>

                <p className="mt-2 max-w-[620px] text-[14px] font-medium leading-6 text-text-muted">
                  {currentStatus.body}
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={statusQuery.isFetching || verificationQuery.isFetching}
                onClick={() => {
                  statusQuery.refetch();
                  if (domain) verificationQuery.refetch();
                }}
                leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
              >
                Refresh
              </Button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <StepPill done={Boolean(widgetId)} active={!widgetId} label="1. Configure" />
              <StepPill done={verified} active={Boolean(widgetId) && !verified} label="2. Verify domain" />
              <StepPill done={productionReady} active={Boolean(widgetId) && verified && !productionReady} label="3. Install & test" />
            </div>
          </Surface>

          <Surface>
            <div className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-text-muted" strokeWidth={2.1} />
              <h3 className="text-[17px] font-semibold text-text">Basics</h3>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <TextField
                label="Website domain"
                value={form.domain}
                onChange={(value) => updateForm({ domain: value })}
                placeholder="example.com"
              />

              <TextField
                label="Accent color"
                value={form.accentColor}
                onChange={(value) => updateForm({ accentColor: value })}
                placeholder="#2e60ff"
              />

              <TextField
                label="Widget title"
                value={form.title}
                onChange={(value) => updateForm({ title: value })}
                placeholder="How can we help?"
              />

              <TextField
                label="Widget subtitle"
                value={form.subtitle}
                onChange={(value) => updateForm({ subtitle: value })}
                placeholder="Ask anything about the business."
              />
            </div>

            <label className="mt-4 flex items-center gap-3 rounded-lg border border-line-soft bg-surface-subtle px-4 py-3">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => updateForm({ enabled: event.target.checked })}
                className="h-4 w-4 accent-[rgb(var(--color-brand))]"
              />
              <span className="text-[13.5px] font-semibold text-text">
                Enable website chat widget
              </span>
            </label>
          </Surface>

          <div className="grid gap-4 md:grid-cols-2">
            <Surface>
              <h3 className="text-[17px] font-semibold text-text">Verify domain</h3>
              <p className="mt-2 text-[13px] font-medium leading-6 text-text-muted">
                Prepare verification, add it to the website or domain, then check status.
              </p>

              <div className="mt-4 grid gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  disabled={!domain}
                  loading={challengeMutation.isPending}
                  onClick={() => challengeMutation.mutate()}
                  leftIcon={<ShieldAlert className="h-4 w-4" strokeWidth={2.1} />}
                >
                  Prepare challenge
                </Button>

                <Button
                  type="button"
                  fullWidth
                  disabled={!domain}
                  loading={checkMutation.isPending}
                  onClick={() => checkMutation.mutate()}
                  leftIcon={<CheckCircle2 className="h-4 w-4" strokeWidth={2.1} />}
                >
                  Check verification
                </Button>
              </div>
            </Surface>

            <Surface>
              <h3 className="text-[17px] font-semibold text-text">Install & test</h3>
              <p className="mt-2 text-[13px] font-medium leading-6 text-text-muted">
                Prepare install, copy the snippet, then send a test message into Inbox.
              </p>

              <div className="mt-4 grid gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  disabled={!widgetId}
                  loading={installMutation.isPending}
                  onClick={() => installMutation.mutate()}
                  leftIcon={<Save className="h-4 w-4" strokeWidth={2.1} />}
                >
                  Prepare install
                </Button>

                <Button
                  type="button"
                  fullWidth
                  disabled={!widgetId}
                  loading={testMutation.isPending}
                  onClick={() => testMutation.mutate()}
                  leftIcon={<Send className="h-4 w-4" strokeWidth={2.1} />}
                >
                  Send test
                </Button>
              </div>
            </Surface>
          </div>

          <Surface>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-[17px] font-semibold text-text">Install snippet</h3>
                <p className="mt-2 text-[13px] font-medium leading-6 text-text-muted">
                  Add once before the closing body tag, or send it to the website manager.
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                disabled={!snippet}
                onClick={handleCopy}
                leftIcon={<Copy className="h-4 w-4" strokeWidth={2.1} />}
              >
                {copied ? "Copied" : "Copy snippet"}
              </Button>
            </div>

            <pre className="mt-4 max-h-[128px] overflow-auto rounded-lg border border-line-soft bg-slate-950 p-4 text-[12px] font-semibold leading-6 text-slate-100">
              {snippet || "Save settings first to create the widget ID."}
            </pre>
          </Surface>
        </div>
      </div>

      <footer className="shrink-0 border-t border-line-soft bg-white px-6 py-4">
        <div className="mx-auto flex max-w-[860px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-[430px] text-[12.5px] font-medium leading-5 text-text-muted">
            Answers use approved Business Info only. Unknown questions stay manual-first.
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onNavigate?.("/inbox")}
              leftIcon={<Inbox className="h-4 w-4" strokeWidth={2.1} />}
            >
              Inbox
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={!snippet}
              onClick={handleCopy}
              leftIcon={<Copy className="h-4 w-4" strokeWidth={2.1} />}
            >
              Copy
            </Button>

            <Button
              type="button"
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              leftIcon={<Save className="h-4 w-4" strokeWidth={2.1} />}
            >
              Save
            </Button>
          </div>
        </div>
      </footer>
    </aside>
  );
}
`;

fs.writeFileSync(file, code, "utf8");
console.log("rewrote WebsiteWidgetDetailDrawer as single-flow premium panel");
