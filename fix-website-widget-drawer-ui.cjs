const fs = require("fs");
const path = require("path");

const root = process.cwd();
const file = path.join(root, "ai-hq-frontend/src/components/channels/WebsiteWidgetDetailDrawer.jsx");

const code = `import { useEffect, useMemo, useState } from "react";
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
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
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
    initialPrompts: arr(widget.initialPrompts).join("\\n"),
  };
}

function getWidgetId(payload = {}) {
  const widget = obj(payload.widget);
  return s(
    widget.publicWidgetId ||
      widget.widgetId ||
      payload.publicWidgetId ||
      payload.widgetId
  );
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

function getStatusCopy(payload = {}, verification = {}) {
  const widget = obj(payload.widget);
  const widgetId = getWidgetId(payload);
  const verified = isVerified(payload, verification);
  const productionReady = isProductionReady(payload, verification);

  if (productionReady) {
    return {
      tone: "success",
      title: "Ready to install",
      body: "Website chat is configured, verified, and ready for the public snippet.",
      label: "Ready",
    };
  }

  if (!widget.enabled) {
    return {
      tone: "warning",
      title: "Widget is off",
      body: "Enable the widget and save changes before testing it.",
      label: "Off",
    };
  }

  if (!widgetId) {
    return {
      tone: "warning",
      title: "Save settings",
      body: "Save once to create the public widget ID.",
      label: "Save",
    };
  }

  if (!verified) {
    return {
      tone: "warning",
      title: "Verify domain",
      body: "Add the website domain and verify ownership before public install.",
      label: "Review",
    };
  }

  return {
    tone: "warning",
    title: "Install not complete",
    body: "Domain is verified. Prepare the install package and test the inbox flow.",
    label: "Setup",
  };
}

function toneClasses(tone = "neutral") {
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
    '<script',
    \`src="\${origin}/website-widget-loader.js"\`,
    \`data-widget-id="\${s(widgetId)}"\`,
    \`data-api-base="\${origin}/api"\`,
    s(accentColor) ? \`data-accent="\${s(accentColor)}"\` : "",
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
  } catch (_error) {
    return false;
  }
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function TextInput({ value, onChange, placeholder, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-11 w-full border border-line-soft bg-white px-3.5 text-[14px] font-semibold text-text outline-none transition-[border-color,box-shadow] duration-base ease-premium placeholder:text-text-subtle focus:border-[rgba(var(--color-brand),0.45)] focus:shadow-[0_0_0_3px_rgba(var(--color-brand),0.10)]"
    />
  );
}

function StepRow({ index, title, body, done, current }) {
  return (
    <div
      className={cx(
        "grid grid-cols-[34px_minmax(0,1fr)] gap-3 border-b border-line-soft py-4 last:border-b-0",
        current ? "bg-brand-soft/40 -mx-3 px-3" : ""
      )}
    >
      <div
        className={cx(
          "flex h-7 w-7 items-center justify-center border text-[12px] font-bold",
          done
            ? "border-success bg-success text-white"
            : current
              ? "border-brand bg-brand text-white"
              : "border-line-soft bg-white text-text-muted"
        )}
      >
        {done ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.3} /> : index}
      </div>

      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-text">{title}</div>
        <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
          {body}
        </div>
      </div>
    </div>
  );
}

function MiniStatus({ label, value, tone = "neutral" }) {
  return (
    <div className="border border-line-soft bg-white px-3.5 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {label}
      </div>
      <div className={cx("mt-1 truncate text-[13.5px] font-semibold", toneClasses(tone).split(" ").at(-1))}>
        {value}
      </div>
    </div>
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
  const [form, setForm] = useState(() => buildInitialForm());
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

  const domain = normalizeDomain(form.domain);
  const widgetStatus = obj(statusQuery.data);
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
  const copy = getStatusCopy(widgetStatus, verification);
  const snippet = buildSnippet({ widgetId, accentColor: form.accentColor });

  useEffect(() => {
    if (!statusQuery.data) return;
    setForm(buildInitialForm(statusQuery.data));
  }, [statusQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveWebsiteWidgetConfig({
        enabled: form.enabled,
        title: s(form.title),
        subtitle: s(form.subtitle),
        accentColor: s(form.accentColor),
        allowedDomains: domain ? [domain] : [],
        allowedOrigins: domain ? [\`https://\${domain}\`] : [],
        initialPrompts: String(form.initialPrompts || "")
          .split(/[\\n,]/)
          .map((item) => s(item))
          .filter(Boolean),
      }),
    async onSuccess() {
      setNotice({ tone: "success", text: "Website chat settings saved." });
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
      setNotice({
        tone: "success",
        text: "Domain verification challenge prepared.",
      });
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
      setNotice({
        tone: "success",
        text: "Install package prepared. Copy the snippet below.",
      });
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
      setNotice({
        tone: "success",
        text: "Test message sent to Inbox.",
      });
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

  const steps = useMemo(
    () => [
      {
        title: "Configure",
        body: widgetId
          ? "Widget identity is created."
          : "Save once to create the public widget ID.",
        done: Boolean(widgetId),
        current: !widgetId,
      },
      {
        title: "Verify domain",
        body: verified
          ? "Domain ownership is verified."
          : "Confirm this website can load the widget.",
        done: verified,
        current: Boolean(widgetId) && !verified,
      },
      {
        title: "Install & test",
        body: productionReady
          ? "Snippet is ready for production install."
          : "Copy snippet and send a test message to Inbox.",
        done: productionReady,
        current: Boolean(widgetId) && verified && !productionReady,
      },
    ],
    [productionReady, verified, widgetId]
  );

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
        <div className="flex items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center">
              <ChannelIcon channel={channel} size="lg" />
            </div>

            <div className="min-w-0">
              <div className="truncate text-[23px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
                Website chat
              </div>
              <div className={cx("mt-2 inline-flex border px-2.5 py-1 text-[12px] font-semibold", toneClasses(copy.tone))}>
                {copy.label}
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close website chat setup"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-line-soft bg-white text-text-muted transition-colors hover:bg-surface-subtle hover:text-text"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted px-6 py-5">
        <div className="mx-auto grid max-w-[1040px] gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="space-y-4">
            <div className="border border-line-soft bg-white p-5 shadow-[0_18px_54px_-48px_rgba(15,23,42,0.45)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                Setup path
              </div>

              <div className="mt-3">
                {steps.map((step, index) => (
                  <StepRow
                    key={step.title}
                    index={index + 1}
                    title={step.title}
                    body={step.body}
                    done={step.done}
                    current={step.current}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MiniStatus
                label="Widget"
                value={form.enabled ? "Enabled" : "Off"}
                tone={form.enabled ? "success" : "warning"}
              />
              <MiniStatus
                label="Domain"
                value={verified ? "Verified" : "Unverified"}
                tone={verified ? "success" : "warning"}
              />
              <MiniStatus
                label="Widget ID"
                value={widgetId || "Not set"}
                tone={widgetId ? "success" : "warning"}
              />
              <MiniStatus
                label="Install"
                value={productionReady ? "Ready" : "Pending"}
                tone={productionReady ? "success" : "warning"}
              />
            </div>
          </section>

          <section className="space-y-4">
            {loading ? (
              <InlineNotice
                tone="info"
                compact
                description="Loading website chat status..."
              />
            ) : null}

            {notice?.text ? (
              <InlineNotice
                tone={notice.tone}
                compact
                description={notice.text}
              />
            ) : null}

            {statusQuery.error ? (
              <InlineNotice
                tone="danger"
                compact
                description={s(statusQuery.error?.message, "Website chat status could not be loaded.")}
              />
            ) : null}

            <div className="border border-line-soft bg-white p-5 shadow-[0_18px_54px_-48px_rgba(15,23,42,0.45)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                    Status
                  </div>
                  <h2 className="mt-1 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                    {copy.title}
                  </h2>
                  <p className="mt-2 max-w-[620px] text-[13.5px] font-medium leading-6 text-text-muted">
                    {copy.body}
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
            </div>

            <div className="border border-line-soft bg-white p-5 shadow-[0_18px_54px_-48px_rgba(15,23,42,0.45)]">
              <div className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-text-muted" strokeWidth={2.1} />
                <h3 className="text-[16px] font-semibold text-text">
                  Domain & appearance
                </h3>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Website domain">
                  <TextInput
                    value={form.domain}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        domain: value,
                      }))
                    }
                    placeholder="example.com"
                  />
                </Field>

                <Field label="Accent color">
                  <TextInput
                    value={form.accentColor}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        accentColor: value,
                      }))
                    }
                    placeholder="#2e60ff"
                  />
                </Field>

                <Field label="Widget title">
                  <TextInput
                    value={form.title}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        title: value,
                      }))
                    }
                    placeholder="How can we help?"
                  />
                </Field>

                <Field label="Widget subtitle">
                  <TextInput
                    value={form.subtitle}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        subtitle: value,
                      }))
                    }
                    placeholder="Ask anything about the business."
                  />
                </Field>
              </div>

              <label className="mt-4 flex items-center gap-3 border border-line-soft bg-surface-subtle px-3.5 py-3">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      enabled: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[rgb(var(--color-brand))]"
                />
                <span className="text-[13.5px] font-semibold text-text">
                  Enable website chat widget
                </span>
              </label>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="border border-line-soft bg-white p-5 shadow-[0_18px_54px_-48px_rgba(15,23,42,0.45)]">
                <h3 className="text-[16px] font-semibold text-text">
                  Verify domain
                </h3>
                <p className="mt-2 text-[13px] font-medium leading-6 text-text-muted">
                  Prepare the challenge, add it to the website/domain, then check verification.
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
              </div>

              <div className="border border-line-soft bg-white p-5 shadow-[0_18px_54px_-48px_rgba(15,23,42,0.45)]">
                <h3 className="text-[16px] font-semibold text-text">
                  Install & test
                </h3>
                <p className="mt-2 text-[13px] font-medium leading-6 text-text-muted">
                  Copy the loader snippet, install it on the website, then send one test message to Inbox.
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
              </div>
            </div>

            <div className="border border-line-soft bg-white p-5 shadow-[0_18px_54px_-48px_rgba(15,23,42,0.45)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[16px] font-semibold text-text">
                    Website snippet
                  </h3>
                  <p className="mt-2 text-[13px] font-medium leading-6 text-text-muted">
                    Add this once before the closing body tag, or send it to the person managing the website.
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  disabled={!snippet}
                  onClick={handleCopy}
                  leftIcon={<Copy className="h-4 w-4" strokeWidth={2.1} />}
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>

              <pre className="mt-4 max-h-[150px] overflow-auto border border-line-soft bg-surface-subtle p-4 text-[12px] font-semibold leading-6 text-text">
                {snippet || "Save settings first to create the widget ID."}
              </pre>
            </div>
          </section>
        </div>
      </div>

      <footer className="shrink-0 border-t border-line-soft bg-white px-6 py-4">
        <div className="mx-auto flex max-w-[1040px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[12.5px] font-medium text-text-muted">
            Website chat answers only from approved Business Info. Unknown questions stay manual-first.
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onNavigate?.("/inbox")}
              leftIcon={<Inbox className="h-4 w-4" strokeWidth={2.1} />}
            >
              Open Inbox
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={!snippet}
              onClick={handleCopy}
              leftIcon={<Copy className="h-4 w-4" strokeWidth={2.1} />}
            >
              Copy snippet
            </Button>

            <Button
              type="button"
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              leftIcon={<Save className="h-4 w-4" strokeWidth={2.1} />}
            >
              Save changes
            </Button>
          </div>
        </div>
      </footer>
    </aside>
  );
}
`;

fs.writeFileSync(file, code, "utf8");
console.log("replaced WebsiteWidgetDetailDrawer with clean 3-step UI");
