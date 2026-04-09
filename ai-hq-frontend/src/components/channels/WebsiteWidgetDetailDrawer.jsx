import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Globe2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

import {
  getWebsiteWidgetStatus,
  saveWebsiteWidgetConfig,
} from "../../api/channelConnect.js";
import {
  buildWorkspaceScopedQueryKey,
  useWorkspaceTenantKey,
} from "../../hooks/useWorkspaceTenantKey.js";
import { s } from "../../lib/appUi.js";
import { cx } from "../../lib/cx.js";
import Input, { Textarea } from "../ui/Input.jsx";
import {
  FieldGroup,
  InlineNotice,
  PropertyRow,
  SaveFeedback,
  Section,
} from "../ui/AppShellPrimitives.jsx";
import ChannelIcon from "./ChannelIcon.jsx";
import { ChannelActionButton, ChannelStatus } from "./ChannelPrimitives.jsx";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function listToText(value) {
  return arr(value).map((item) => s(item)).filter(Boolean).join("\n");
}

function parseList(value = "") {
  return String(value || "")
    .split(/[,\n]/)
    .map((item) => s(item))
    .filter(Boolean);
}

function buildFormState(payload = {}) {
  const widget = obj(payload.widget);

  return {
    enabled: widget.enabled === true,
    title: s(widget.title),
    subtitle: s(widget.subtitle),
    accentColor: s(widget.accentColor),
    allowedOrigins: listToText(widget.allowedOrigins),
    allowedDomains: listToText(widget.allowedDomains),
    initialPrompts: listToText(widget.initialPrompts),
  };
}

function FeedbackBanner({ tone = "success", children }) {
  return (
    <InlineNotice
      tone={tone === "danger" ? "danger" : tone === "warning" ? "warning" : "success"}
      description={children}
      compact
    />
  );
}

function DataRow({ label, value }) {
  return <PropertyRow label={label} value={value || "Not available"} labelWidth="160px" />;
}

export default function WebsiteWidgetDetailDrawer({
  channel,
  open = false,
  onClose,
}) {
  const queryClient = useQueryClient();
  const workspace = useWorkspaceTenantKey({ enabled: open });
  const [draftForm, setDraftForm] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const websiteStatusQueryKey = buildWorkspaceScopedQueryKey(
    ["website-widget-status"],
    workspace.tenantKey
  );

  const statusQuery = useQuery({
    queryKey: websiteStatusQueryKey,
    queryFn: getWebsiteWidgetStatus,
    enabled: open && workspace.ready,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const saveMutation = useMutation({
    mutationFn: saveWebsiteWidgetConfig,
    async onSuccess(payload) {
      setDraftForm(buildFormState(payload));
      setStatusMessage("Website widget settings saved.");
      setCopyFeedback("");
      await queryClient.invalidateQueries({
        queryKey: websiteStatusQueryKey,
      });
    },
  });

  const payload = statusQuery.data || {};
  const widget = obj(payload.widget);
  const install = obj(payload.install);
  const readiness = obj(payload.readiness);
  const permissions = obj(payload.permissions);
  const blockers = arr(readiness.blockers);
  const saveAllowed = permissions.saveAllowed !== false;
  const form = draftForm || buildFormState(payload);

  const headerStatus =
    readiness.status === "ready"
      ? "connected"
      : widget.enabled === true
        ? "blocked"
        : "not_connected";

  function updateForm(updater) {
    setDraftForm((current) => {
      const nextCurrent = current || buildFormState(statusQuery.data || {});
      return typeof updater === "function" ? updater(nextCurrent) : updater;
    });
  }

  async function handleCopySnippet() {
    const snippet = s(install.embedSnippet);
    if (!snippet) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet);
        setCopyFeedback("Embed snippet copied.");
        setStatusMessage("");
        return;
      }
    } catch {
      // Fall through to the fallback message below.
    }

    setCopyFeedback("Copy is unavailable in this browser context.");
    setStatusMessage("");
  }

  function handleSave() {
    setStatusMessage("");
    setCopyFeedback("");
    saveMutation.mutate({
      enabled: form.enabled,
      title: form.title,
      subtitle: form.subtitle,
      accentColor: form.accentColor,
      allowedOrigins: parseList(form.allowedOrigins),
      allowedDomains: parseList(form.allowedDomains),
      initialPrompts: parseList(form.initialPrompts),
    });
  }

  function handleRefresh() {
    setDraftForm(null);
    setStatusMessage("");
    statusQuery.refetch();
  }

  function handleClose() {
    setDraftForm(null);
    setStatusMessage("");
    setCopyFeedback("");
    onClose?.();
  }

  const actionError = s(
    saveMutation.error?.message || statusQuery.error?.message
  );

  return (
    <aside
      aria-hidden={!open}
      className="flex h-full w-full flex-col border-l border-line-soft bg-surface shadow-panel"
    >
      <div className="border-b border-line-soft px-6 py-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1">
          <div className="row-span-2 shrink-0 pt-0.5">
            <ChannelIcon channel={channel} size="lg" />
          </div>

          <div className="min-w-0 self-center">
            <div className="truncate text-[28px] font-semibold leading-none tracking-[-0.04em] text-text">
              {channel?.name}
            </div>
          </div>

          <button
            type="button"
            aria-label="Close channel details"
            onClick={handleClose}
            className="row-span-2 inline-flex h-10 w-10 items-center justify-center rounded-soft border border-line bg-surface text-text-muted transition-colors hover:border-line-strong hover:text-text"
          >
            <X className="h-4.5 w-4.5" strokeWidth={2.35} />
          </button>

          <div className="min-w-0 self-start pt-1">
            <ChannelStatus status={headerStatus} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="space-y-6">
          <SaveFeedback success={statusMessage} error={actionError} />

          {!saveAllowed ? (
            <FeedbackBanner tone="warning">
              {s(
                permissions.message,
                "This control-plane surface is visible here, but only owner/admin can change it."
              )}
            </FeedbackBanner>
          ) : null}

          {blockers.map((item, index) => (
            <FeedbackBanner
              key={`${s(item.reasonCode)}-${index}`}
              tone="warning"
            >
              <span className="font-semibold">{s(item.title)}</span>{" "}
              {s(item.subtitle)}
            </FeedbackBanner>
          ))}

          <Section
            eyebrow="Summary"
            title="Install-safe website chat"
            description="The public loader now uses a short-lived bootstrap token tied to this tenant widget config. Random third-party pages cannot spoof a tenant install just by posting a tenant key and fake page data."
          >
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-pill border border-[rgba(var(--color-success),0.18)] bg-success-soft px-3 py-1.5 text-[12px] font-medium text-success">
                <ShieldCheck className="h-4 w-4" />
                Loader-signed install token
              </span>
              <span className="inline-flex items-center gap-2 rounded-pill border border-line bg-surface-subtle px-3 py-1.5 text-[12px] font-medium text-text-muted">
                <Globe2 className="h-4 w-4" />
                Per-tenant allowed origin rules
              </span>
            </div>
          </Section>

          <Section
            eyebrow="Status"
            title="Current posture"
            description={s(
              readiness.message,
              "Website chat posture is unavailable right now."
            )}
          >
            <div className="overflow-hidden rounded-panel border border-line-soft bg-surface">
              <DataRow
                label="Widget enabled"
                value={widget.enabled === true ? "Enabled" : "Disabled"}
              />
              <DataRow
                label="Public widget ID"
                value={s(widget.publicWidgetId, "Not issued yet")}
              />
              <DataRow
                label="Reference website"
                value={s(widget.websiteUrl, "Not available")}
              />
              <DataRow
                label="Install validation"
                value={
                  readiness.status === "ready"
                    ? "Ready"
                    : readiness.status === "blocked"
                      ? "Blocked"
                      : "Needs setup"
                }
              />
            </div>
          </Section>

          <Section
            eyebrow="Settings"
            title="Tenant-managed widget config"
            description="Allowed origins are exact browser origins such as https://www.example.com. Allowed domains are hostnames such as example.com and match the domain plus its subdomains."
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-panel border border-line bg-surface-muted px-4 py-4">
                <div>
                  <div className="text-[14px] font-semibold text-text">
                    Public website chat
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-text-muted">
                    Disable this to fail closed for new public installs immediately.
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!saveAllowed}
                  onClick={() =>
                    updateForm((current) => ({
                      ...current,
                      enabled: !current.enabled,
                    }))
                  }
                  className={cx(
                    "inline-flex min-w-[110px] items-center justify-center rounded-pill border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
                    form.enabled
                      ? "border-[rgba(var(--color-success),0.18)] bg-success-soft text-success"
                      : "border-line bg-surface text-text-muted",
                    !saveAllowed && "cursor-not-allowed opacity-70"
                  )}
                >
                  {form.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>

              <FieldGroup label="Allowed origins">
                <Textarea
                  value={form.allowedOrigins}
                  onChange={(event) =>
                    updateForm((current) => ({
                      ...current,
                      allowedOrigins: event.target.value,
                    }))
                  }
                  rows={4}
                  readOnly={!saveAllowed}
                  appearance="quiet"
                  placeholder="https://www.example.com&#10;https://shop.example.com"
                />
              </FieldGroup>

              <FieldGroup label="Allowed domains">
                <Textarea
                  value={form.allowedDomains}
                  onChange={(event) =>
                    updateForm((current) => ({
                      ...current,
                      allowedDomains: event.target.value,
                    }))
                  }
                  rows={3}
                  readOnly={!saveAllowed}
                  appearance="quiet"
                  placeholder="example.com&#10;support.example.org"
                />
              </FieldGroup>

              <div className="grid gap-4 md:grid-cols-2">
                <FieldGroup label="Widget title">
                  <Input
                    value={form.title}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    readOnly={!saveAllowed}
                    appearance="quiet"
                    placeholder="Website chat"
                  />
                </FieldGroup>

                <FieldGroup label="Accent color">
                  <Input
                    value={form.accentColor}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        accentColor: event.target.value,
                      }))
                    }
                    readOnly={!saveAllowed}
                    appearance="quiet"
                    placeholder="#0f172a"
                  />
                </FieldGroup>
              </div>

              <FieldGroup label="Subtitle">
                <Input
                  value={form.subtitle}
                  onChange={(event) =>
                    updateForm((current) => ({
                      ...current,
                      subtitle: event.target.value,
                    }))
                  }
                  readOnly={!saveAllowed}
                  appearance="quiet"
                  placeholder="Ask a question or leave a message for the team."
                />
              </FieldGroup>

              <FieldGroup label="Quick prompts">
                <Textarea
                  value={form.initialPrompts}
                  onChange={(event) =>
                    updateForm((current) => ({
                      ...current,
                      initialPrompts: event.target.value,
                    }))
                  }
                  rows={4}
                  readOnly={!saveAllowed}
                  appearance="quiet"
                  placeholder="What services do you offer?&#10;Can someone contact me today?"
                />
              </FieldGroup>
            </div>
          </Section>

          <Section
            eyebrow="Install"
            title="Embed this widget on the public website"
            description="The loader script requests a short-lived bootstrap token from the backend using the real customer page request context, then opens the iframe with that signed install token."
          >
            <div className="space-y-4">
              <div className="overflow-hidden rounded-panel border border-line-soft bg-surface">
                <DataRow
                  label="Loader script"
                  value={s(install.scriptUrl, "Not available")}
                />
                <DataRow
                  label="API base"
                  value={s(install.apiBase, "Not available")}
                />
                <DataRow
                  label="Widget ID"
                  value={s(widget.publicWidgetId, "Generated after save")}
                />
              </div>

              <FieldGroup label="Embed snippet">
                <Textarea
                  value={s(install.embedSnippet)}
                  readOnly
                  rows={5}
                  appearance="quiet"
                  placeholder="Save the website widget settings to generate the install snippet."
                />
              </FieldGroup>

              {copyFeedback ? (
                <InlineNotice tone="info" description={copyFeedback} compact />
              ) : null}
            </div>
          </Section>
        </div>
      </div>

      <div className="border-t border-line-soft bg-surface px-6 py-4">
        <div className="grid grid-cols-2 gap-3">
          <ChannelActionButton
            fullWidth
            showArrow={false}
            onClick={handleSave}
            disabled={!saveAllowed || statusQuery.isLoading}
            isLoading={saveMutation.isPending}
            className="!h-[40px] !rounded-[10px] !text-[10px]"
          >
            Save widget config
          </ChannelActionButton>

          <ChannelActionButton
            quiet
            fullWidth
            showArrow={false}
            onClick={handleCopySnippet}
            disabled={!s(install.embedSnippet)}
            leftIcon={<Copy className="h-4 w-4" strokeWidth={2.2} />}
            className="!h-[40px] !rounded-[10px] !text-[10px]"
          >
            Copy snippet
          </ChannelActionButton>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <ChannelActionButton
            quiet
            fullWidth
            showArrow={false}
            onClick={handleRefresh}
            isLoading={statusQuery.isFetching}
            leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.2} />}
            className="!h-[38px] !rounded-[10px] !text-[10px]"
          >
            Refresh
          </ChannelActionButton>

          <ChannelActionButton
            quiet
            fullWidth
            showArrow={false}
            onClick={handleClose}
            leftIcon={<ShieldAlert className="h-4 w-4" strokeWidth={2.2} />}
            className="!h-[38px] !rounded-[10px] !text-[10px]"
          >
            Close
          </ChannelActionButton>
        </div>
      </div>
    </aside>
  );
}
