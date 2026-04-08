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
import { cx } from "../../lib/cx.js";
import Input, { Textarea } from "../ui/Input.jsx";
import ChannelIcon from "./ChannelIcon.jsx";
import { ChannelActionButton, ChannelStatus } from "./ChannelPrimitives.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

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

function SectionBlock({ eyebrow, title, description, children, last = false }) {
  return (
    <section
      className={cx(!last && "border-b border-[#e8edf3] pb-7", last && "pb-0")}
    >
      {eyebrow ? (
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#667085]">
          {eyebrow}
        </div>
      ) : null}

      {title ? (
        <div className="mt-3 text-[18px] font-semibold tracking-[-0.04em] text-[#101828]">
          {title}
        </div>
      ) : null}

      {description ? (
        <p className="mt-3 max-w-[640px] text-[14px] leading-8 text-[#5f6c80]">
          {description}
        </p>
      ) : null}

      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

function FeedbackBanner({ tone = "success", children }) {
  return (
    <div
      className={cx(
        "rounded-[10px] border px-4 py-3 text-[13px] leading-6",
        tone === "danger"
          ? "border-[rgba(var(--color-danger),0.18)] bg-[rgba(var(--color-danger),0.05)] text-danger"
          : tone === "warning"
            ? "border-[rgba(var(--color-warning),0.18)] bg-[rgba(var(--color-warning),0.05)] text-warning"
            : "border-[rgba(var(--color-success),0.18)] bg-[rgba(var(--color-success),0.05)] text-success"
      )}
    >
      {children}
    </div>
  );
}

function DataRow({ label, value }) {
  return (
    <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-4 border-b border-[#eef2f6] py-3 last:border-b-0">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#667085]">
        {label}
      </div>

      <div className="min-w-0 text-[13px] font-medium leading-6 text-[#101828]">
        {value || "Not available"}
      </div>
    </div>
  );
}

function SettingField({ label, description, children }) {
  return (
    <div className="space-y-2">
      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#667085]">
        {label}
      </div>
      {description ? (
        <div className="text-[12px] leading-6 text-[#667085]">{description}</div>
      ) : null}
      {children}
    </div>
  );
}

export default function WebsiteWidgetDetailDrawer({
  channel,
  open = false,
  onClose,
}) {
  const queryClient = useQueryClient();
  const [draftForm, setDraftForm] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState("");

  const statusQuery = useQuery({
    queryKey: ["website-widget-status"],
    queryFn: getWebsiteWidgetStatus,
    enabled: open,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const saveMutation = useMutation({
    mutationFn: saveWebsiteWidgetConfig,
    async onSuccess(payload) {
      setDraftForm(buildFormState(payload));
      setCopyFeedback("Website widget settings saved.");
      await queryClient.invalidateQueries({
        queryKey: ["website-widget-status"],
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
        return;
      }
    } catch {
      // Fall through to the fallback message below.
    }

    setCopyFeedback("Copy is unavailable in this browser context.");
  }

  function handleSave() {
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
    statusQuery.refetch();
  }

  function handleClose() {
    setDraftForm(null);
    onClose?.();
  }

  const actionError = s(
    saveMutation.error?.message || statusQuery.error?.message
  );

  return (
    <aside
      aria-hidden={!open}
      className="flex h-full w-full flex-col border-l border-[#dbe3ec] bg-white shadow-[-18px_0_40px_-26px_rgba(15,23,42,0.16)]"
    >
      <div className="border-b border-[#e8edf3] px-7 py-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1">
          <div className="row-span-2 shrink-0 pt-0.5">
            <ChannelIcon channel={channel} size="lg" />
          </div>

          <div className="min-w-0 self-center">
            <div className="truncate text-[30px] font-semibold leading-none tracking-[-0.06em] text-[#101828]">
              {channel?.name}
            </div>
          </div>

          <button
            type="button"
            aria-label="Close channel details"
            onClick={handleClose}
            className="row-span-2 inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-[#dbe3ec] bg-white text-[#667085] transition duration-fast ease-premium hover:border-[#c8d2df] hover:text-[#101828]"
          >
            <X className="h-4.5 w-4.5" strokeWidth={2.35} />
          </button>

          <div className="min-w-0 self-start pt-1">
            <ChannelStatus status={headerStatus} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-7 py-6">
        <div className="space-y-7">
          {saveMutation.isSuccess && copyFeedback ? (
            <FeedbackBanner>{copyFeedback}</FeedbackBanner>
          ) : null}

          {actionError ? (
            <FeedbackBanner tone="danger">{actionError}</FeedbackBanner>
          ) : null}

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

          <SectionBlock
            eyebrow="Summary"
            title="Install-safe website chat"
            description="The public loader now uses a short-lived bootstrap token tied to this tenant widget config. Random third-party pages cannot spoof a tenant install just by posting a tenant key and fake page data."
          >
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-[10px] border border-[rgba(22,101,52,0.10)] bg-[rgba(236,253,245,0.72)] px-3 py-2 text-[12px] font-semibold text-[rgba(22,101,52,0.82)]">
                <ShieldCheck className="h-4 w-4" />
                Loader-signed install token
              </span>
              <span className="inline-flex items-center gap-2 rounded-[10px] border border-[rgba(15,23,42,0.08)] bg-[#f8fafc] px-3 py-2 text-[12px] font-semibold text-[#475467]">
                <Globe2 className="h-4 w-4" />
                Per-tenant allowed origin rules
              </span>
            </div>
          </SectionBlock>

          <SectionBlock
            eyebrow="Status"
            title="Current posture"
            description={s(
              readiness.message,
              "Website chat posture is unavailable right now."
            )}
          >
            <div className="space-y-0">
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
          </SectionBlock>

          <SectionBlock
            eyebrow="Settings"
            title="Tenant-managed widget config"
            description="Allowed origins are exact browser origins such as https://www.example.com. Allowed domains are hostnames such as example.com and match the domain plus its subdomains."
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-[12px] border border-[#e6ebf2] bg-[#fbfcfe] px-4 py-4">
                <div>
                  <div className="text-[14px] font-semibold text-[#101828]">
                    Public website chat
                  </div>
                  <div className="mt-1 text-[12px] leading-6 text-[#667085]">
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
                    "inline-flex min-w-[110px] items-center justify-center rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition",
                    form.enabled
                      ? "border-[rgba(22,101,52,0.16)] bg-[rgba(236,253,245,0.82)] text-[rgba(22,101,52,0.88)]"
                      : "border-[#dbe3ec] bg-white text-[#667085]",
                    !saveAllowed && "cursor-not-allowed opacity-70"
                  )}
                >
                  {form.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>

              <SettingField label="Allowed origins">
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
              </SettingField>

              <SettingField label="Allowed domains">
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
              </SettingField>

              <div className="grid gap-4 md:grid-cols-2">
                <SettingField label="Widget title">
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
                </SettingField>

                <SettingField label="Accent color">
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
                </SettingField>
              </div>

              <SettingField label="Subtitle">
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
              </SettingField>

              <SettingField label="Quick prompts">
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
              </SettingField>
            </div>
          </SectionBlock>

          <SectionBlock
            eyebrow="Install"
            title="Embed this widget on the public website"
            description="The loader script requests a short-lived bootstrap token from the backend using the real customer page request context, then opens the iframe with that signed install token."
            last
          >
            <div className="space-y-4">
              <div className="space-y-0">
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

              <SettingField label="Embed snippet">
                <Textarea
                  value={s(install.embedSnippet)}
                  readOnly
                  rows={5}
                  appearance="quiet"
                  placeholder="Save the website widget settings to generate the install snippet."
                />
              </SettingField>

              {copyFeedback && !saveMutation.isSuccess ? (
                <div className="text-[12px] leading-6 text-[#667085]">
                  {copyFeedback}
                </div>
              ) : null}
            </div>
          </SectionBlock>
        </div>
      </div>

      <div className="border-t border-[#e8edf3] bg-white px-7 py-4">
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
