import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, RefreshCw, ShieldAlert, ShieldCheck, X } from "lucide-react";

import {
  checkWebsiteDomainVerification,
  createWebsiteDomainVerificationChallenge,
  createWebsiteWidgetGtmInstallHandoff,
  createWebsiteWidgetInstallHandoff,
  createWebsiteWidgetWordpressInstallHandoff,
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
import Input, { Textarea } from "../ui/Input.jsx";
import {
  FieldGroup,
  InlineNotice,
  PropertyRow,
  SaveFeedback,
  Section,
  Surface,
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
  return arr(value)
    .map((item) => s(item))
    .filter(Boolean)
    .join("\n");
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

function formatTimestamp(value) {
  const raw = s(value);
  if (!raw) return "Not available";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

function verificationTone(state = "") {
  const normalized = s(state).toLowerCase();
  if (normalized === "verified") return "success";
  if (normalized === "failed") return "danger";
  if (normalized === "pending") return "warning";
  return "info";
}

function verificationStateLabel(state = "") {
  const normalized = s(state).toLowerCase();
  if (normalized === "verified") return "Verified";
  if (normalized === "pending") return "Pending";
  if (normalized === "failed") return "Failed";
  return "Unverified";
}

function FeedbackBanner({ tone = "success", children }) {
  return (
    <InlineNotice
      tone={
        tone === "danger"
          ? "danger"
          : tone === "warning"
            ? "warning"
            : "success"
      }
      description={children}
      compact
    />
  );
}

function DataRow({ label, value }) {
  return (
    <PropertyRow
      label={label}
      value={value || "Not available"}
      labelWidth="156px"
    />
  );
}

function TinyMetric({ label, value, tone = "neutral" }) {
  return (
    <div
      className={cx(
        "rounded-[18px] border px-4 py-3",
        tone === "success" &&
          "border-[rgba(var(--color-success),0.16)] bg-success-soft",
        tone === "warning" &&
          "border-[rgba(var(--color-warning),0.18)] bg-warning-soft",
        tone === "danger" &&
          "border-[rgba(var(--color-danger),0.16)] bg-danger-soft",
        tone === "neutral" && "border-line-soft bg-surface-muted"
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
        {label}
      </div>
      <div className="mt-1 text-[14px] font-semibold tracking-[-0.02em] text-text">
        {value}
      </div>
    </div>
  );
}

function buildPosture({
  widget = {},
  install = {},
  verificationSurface = {},
  readiness = {},
}) {
  const verificationState = s(verificationSurface.state).toLowerCase();

  if (widget.enabled !== true) {
    return {
      tone: "warning",
      title: "Website chat is off.",
      summary: "Enable it, save, then continue.",
      next: "Next: enable widget",
      icon: ShieldAlert,
    };
  }

  if (!s(widget.publicWidgetId)) {
    return {
      tone: "warning",
      title: "Widget ID not issued yet.",
      summary: "Save once to generate the public install ID.",
      next: "Next: save config",
      icon: ShieldAlert,
    };
  }

  if (install.productionBlocked === true) {
    return {
      tone: verificationState === "failed" ? "danger" : "warning",
      title: "Public install is blocked.",
      summary: s(
        verificationSurface.message,
        "Verify DNS TXT ownership first."
      ),
      next: "Next: verify domain",
      icon: ShieldAlert,
    };
  }

  if (s(readiness.status).toLowerCase() === "ready") {
    return {
      tone: "success",
      title: "Ready to install.",
      summary: "Snippet and install packages are available.",
      next: "Next: copy snippet or package",
      icon: ShieldCheck,
    };
  }

  return {
    tone: "warning",
    title: "Setup still needs a pass.",
    summary: s(readiness.message, "Finish the remaining website setup."),
    next: "Next: review setup",
    icon: ShieldAlert,
  };
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
  const [verificationInput, setVerificationInput] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationOverride, setVerificationOverride] = useState(null);
  const [handoffMessage, setHandoffMessage] = useState("");
  const [handoffPackage, setHandoffPackage] = useState(null);

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

  const handoffMutation = useMutation({
    mutationFn: createWebsiteWidgetInstallHandoff,
    onSuccess(nextPayload) {
      setHandoffPackage(obj(nextPayload));
      setHandoffMessage("Developer package prepared.");
      setCopyFeedback("");
    },
  });

  const gtmHandoffMutation = useMutation({
    mutationFn: createWebsiteWidgetGtmInstallHandoff,
    onSuccess(nextPayload) {
      setHandoffPackage(obj(nextPayload));
      setHandoffMessage("GTM package prepared.");
      setCopyFeedback("");
    },
  });

  const wordpressHandoffMutation = useMutation({
    mutationFn: createWebsiteWidgetWordpressInstallHandoff,
    onSuccess(nextPayload) {
      setHandoffPackage(obj(nextPayload));
      setHandoffMessage("WordPress package prepared.");
      setCopyFeedback("");
    },
  });

  const saveMutation = useMutation({
    mutationFn: saveWebsiteWidgetConfig,
    async onSuccess(payload) {
      setDraftForm(buildFormState(payload));
      setStatusMessage("Widget settings saved.");
      setCopyFeedback("");
      setVerificationInput("");
      setVerificationMessage("");
      setVerificationOverride(null);
      setHandoffMessage("");
      setHandoffPackage(null);
      handoffMutation.reset();
      gtmHandoffMutation.reset();
      wordpressHandoffMutation.reset();

      await queryClient.invalidateQueries({
        queryKey: websiteStatusQueryKey,
      });

      emitLaunchSliceRefresh({
        tenantKey: workspace.tenantKey,
        reason: "website-widget-saved",
      });
    },
  });

  const refreshVerificationMutation = useMutation({
    mutationFn: getWebsiteDomainVerificationStatus,
    async onSuccess(nextPayload) {
      setVerificationOverride(obj(nextPayload));
      setVerificationInput(
        s(nextPayload.domain || nextPayload.candidateDomain || verificationInput)
      );
      setVerificationMessage("Verification status refreshed.");
      setHandoffMessage("");
      setHandoffPackage(null);
      handoffMutation.reset();
      gtmHandoffMutation.reset();
      wordpressHandoffMutation.reset();

      await queryClient.invalidateQueries({
        queryKey: websiteStatusQueryKey,
      });
    },
  });

  const createChallengeMutation = useMutation({
    mutationFn: createWebsiteDomainVerificationChallenge,
    async onSuccess(nextPayload) {
      setVerificationOverride(obj(nextPayload));
      setVerificationInput(
        s(nextPayload.domain || nextPayload.candidateDomain || verificationInput)
      );
      setVerificationMessage("TXT challenge created.");
      setHandoffMessage("");
      setHandoffPackage(null);
      handoffMutation.reset();
      gtmHandoffMutation.reset();
      wordpressHandoffMutation.reset();

      await queryClient.invalidateQueries({
        queryKey: websiteStatusQueryKey,
      });
    },
  });

  const checkVerificationMutation = useMutation({
    mutationFn: checkWebsiteDomainVerification,
    async onSuccess(nextPayload) {
      setVerificationOverride(obj(nextPayload));
      setVerificationInput(
        s(nextPayload.domain || nextPayload.candidateDomain || verificationInput)
      );
      setVerificationMessage(
        s(nextPayload.state).toLowerCase() === "verified"
          ? "Domain verified."
          : "Verification checked."
      );
      setHandoffMessage("");
      setHandoffPackage(null);
      handoffMutation.reset();
      gtmHandoffMutation.reset();
      wordpressHandoffMutation.reset();

      await queryClient.invalidateQueries({
        queryKey: websiteStatusQueryKey,
      });
    },
  });

  const payload = statusQuery.data || {};
  const widget = obj(payload.widget);
  const install = obj(payload.install);
  const readiness = obj(payload.readiness);
  const serverVerification = obj(payload.domainVerification);
  const verificationSurface = Object.keys(obj(verificationOverride)).length
    ? obj(verificationOverride)
    : serverVerification;
  const handoffSurface = obj(handoffPackage);
  const verificationChallenge = obj(verificationSurface.challenge);
  const verificationCandidateDomains = arr(
    verificationSurface.candidateDomains
  );
  const verificationReadiness = obj(verificationSurface.readiness);
  const handoffReadiness = obj(handoffSurface.readiness);
  const permissions = obj(payload.permissions);
  const blockers = arr(readiness.blockers);
  const saveAllowed = permissions.saveAllowed !== false;
  const form = draftForm || buildFormState(payload);

  const verificationError = s(
    createChallengeMutation.error?.message ||
      checkVerificationMutation.error?.message ||
      refreshVerificationMutation.error?.message
  );

  const suggestedVerificationDomain = s(
    verificationSurface.domain || verificationSurface.candidateDomain
  );
  const verificationInputValue =
    verificationInput === "" ? suggestedVerificationDomain : verificationInput;
  const verificationTargetDomain = s(
    verificationInputValue ||
      verificationSurface.domain ||
      verificationSurface.candidateDomain
  );

  const productionInstallBlocked =
    install.productionBlocked === true ||
    (verificationReadiness.enforcementActive === true &&
      verificationReadiness.productionInstallReady !== true);

  const installBlockMessage = s(
    install.blockMessage ||
      (productionInstallBlocked ? verificationSurface.message : "")
  );

  const developerHandoffReady =
    saveAllowed && install.developerHandoffReady === true;
  const gtmHandoffReady = saveAllowed && install.gtmHandoffReady === true;
  const wordpressHandoffReady =
    saveAllowed && install.wordpressHandoffReady === true;
  const anyHandoffReady =
    developerHandoffReady || gtmHandoffReady || wordpressHandoffReady;

  const installHandoffMessage = s(
    install.handoffMessage ||
      (productionInstallBlocked
        ? verificationSurface.message
        : "Install package is unavailable right now.")
  );

  const handoffTestingOnly =
    handoffSurface.testingOnly === true || handoffReadiness.testingOnly === true;

  const handoffWarning = s(
    handoffReadiness.warning ||
      handoffSurface.warning ||
      (handoffTestingOnly
        ? "Testing only. Public launch still needs verified DNS TXT."
        : "")
  );

  const handoffError = s(
    handoffMutation.error?.message ||
      gtmHandoffMutation.error?.message ||
      wordpressHandoffMutation.error?.message
  );

  const verificationBusy =
    createChallengeMutation.isPending ||
    checkVerificationMutation.isPending ||
    refreshVerificationMutation.isPending;

  const handoffBusy =
    handoffMutation.isPending ||
    gtmHandoffMutation.isPending ||
    wordpressHandoffMutation.isPending;

  const headerStatus =
    readiness.status === "ready"
      ? "connected"
      : widget.enabled === true
        ? "blocked"
        : "not_connected";

  const posture = buildPosture({
    widget,
    install,
    verificationSurface,
    readiness,
  });

  function updateForm(updater) {
    setDraftForm((current) => {
      const nextCurrent = current || buildFormState(statusQuery.data || {});
      return typeof updater === "function" ? updater(nextCurrent) : updater;
    });
  }

  async function copyTextValue(value, successMessage) {
    const text = s(value);
    if (!text) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyFeedback(successMessage);
        setStatusMessage("");
        return;
      }
    } catch {
      // ignore
    }

    setCopyFeedback("Copy is unavailable in this browser context.");
    setStatusMessage("");
  }

  function handleCopySnippet() {
    return copyTextValue(s(install.embedSnippet), "Snippet copied.");
  }

  function handleCopyHandoffPackage() {
    return copyTextValue(
      handoffSurface.packageText,
      s(handoffSurface.packageType) === "gtm"
        ? "GTM package copied."
        : s(handoffSurface.packageType) === "wordpress"
          ? "WordPress package copied."
          : "Developer package copied."
    );
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

  function resetVerificationFeedback() {
    setVerificationMessage("");
    createChallengeMutation.reset();
    checkVerificationMutation.reset();
    refreshVerificationMutation.reset();
  }

  function resetHandoffFeedback() {
    setHandoffMessage("");
    setHandoffPackage(null);
    handoffMutation.reset();
    gtmHandoffMutation.reset();
    wordpressHandoffMutation.reset();
  }

  function handleCreateChallenge() {
    resetVerificationFeedback();
    createChallengeMutation.mutate(
      verificationTargetDomain ? { domain: verificationTargetDomain } : {}
    );
  }

  function handleVerifyNow() {
    resetVerificationFeedback();
    checkVerificationMutation.mutate(
      verificationTargetDomain ? { domain: verificationTargetDomain } : {}
    );
  }

  function handleRefreshVerification() {
    resetVerificationFeedback();
    refreshVerificationMutation.mutate(
      verificationTargetDomain ? { domain: verificationTargetDomain } : {}
    );
  }

  function handlePrepareDeveloperInstall() {
    resetHandoffFeedback();
    setCopyFeedback("");
    handoffMutation.mutate(
      verificationTargetDomain ? { domain: verificationTargetDomain } : {}
    );
  }

  function handlePrepareGtmInstall() {
    resetHandoffFeedback();
    setCopyFeedback("");
    gtmHandoffMutation.mutate(
      verificationTargetDomain ? { domain: verificationTargetDomain } : {}
    );
  }

  function handlePrepareWordpressInstall() {
    resetHandoffFeedback();
    setCopyFeedback("");
    wordpressHandoffMutation.mutate(
      verificationTargetDomain ? { domain: verificationTargetDomain } : {}
    );
  }

  function handleRefresh() {
    setDraftForm(null);
    setStatusMessage("");
    setCopyFeedback("");
    setVerificationInput("");
    setVerificationMessage("");
    setVerificationOverride(null);
    resetVerificationFeedback();
    resetHandoffFeedback();
    statusQuery.refetch();
  }

  function handleClose() {
    setDraftForm(null);
    setStatusMessage("");
    setCopyFeedback("");
    setVerificationInput("");
    setVerificationMessage("");
    setVerificationOverride(null);
    resetVerificationFeedback();
    resetHandoffFeedback();
    onClose?.();
  }

  const actionError = s(
    saveMutation.error?.message || statusQuery.error?.message
  );

  const PostureIcon = posture.icon;

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
            <div className="truncate text-[26px] font-semibold leading-none tracking-[-0.04em] text-text">
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

          {copyFeedback ? (
            <InlineNotice tone="info" description={copyFeedback} compact />
          ) : null}

          <Surface padded="lg" className="rounded-[24px]">
            <div className="flex flex-col gap-5">
              <div className="flex items-start gap-3">
                <div
                  className={cx(
                    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border",
                    posture.tone === "success" &&
                      "border-[rgba(var(--color-success),0.16)] bg-success-soft text-success",
                    posture.tone === "warning" &&
                      "border-[rgba(var(--color-warning),0.18)] bg-warning-soft text-warning",
                    posture.tone === "danger" &&
                      "border-[rgba(var(--color-danger),0.16)] bg-danger-soft text-danger"
                  )}
                >
                  <PostureIcon className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <div className="text-[22px] font-semibold tracking-[-0.035em] text-text">
                    {posture.title}
                  </div>
                  <div className="mt-1 text-[13px] leading-6 text-text-muted">
                    {posture.summary}
                  </div>
                  <div className="mt-2 text-[12px] font-medium text-text-subtle">
                    {posture.next}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <TinyMetric
                  label="Widget"
                  value={
                    widget.enabled === true
                      ? s(widget.publicWidgetId, "Enabled")
                      : "Disabled"
                  }
                  tone={widget.enabled === true ? "success" : "warning"}
                />
                <TinyMetric
                  label="Domain"
                  value={s(
                    verificationSurface.domain ||
                      verificationSurface.candidateDomain,
                    "Not set"
                  )}
                  tone={
                    s(verificationSurface.state).toLowerCase() === "verified"
                      ? "success"
                      : productionInstallBlocked
                        ? "warning"
                        : "neutral"
                  }
                />
                <TinyMetric
                  label="Install"
                  value={
                    productionInstallBlocked
                      ? "Blocked"
                      : install.productionInstallReady === true
                        ? "Ready"
                        : "Pending"
                  }
                  tone={
                    install.productionInstallReady === true
                      ? "success"
                      : productionInstallBlocked
                        ? "warning"
                        : "neutral"
                  }
                />
              </div>
            </div>
          </Surface>

          {!saveAllowed ? (
            <FeedbackBanner tone="warning">
              {s(
                permissions.message,
                "Only owner/admin can change Website Chat settings."
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
            eyebrow="Verification"
            title="Domain"
            description="Public install needs verified DNS TXT."
          >
            <div className="space-y-4">
              <SaveFeedback
                success={verificationMessage}
                error={verificationError}
              />

              <InlineNotice
                tone={verificationTone(verificationSurface.state)}
                title={verificationStateLabel(verificationSurface.state)}
                description={s(
                  verificationSurface.message,
                  "Create a TXT challenge, publish it, then verify."
                )}
                compact
              />

              {verificationCandidateDomains.length > 1 ? (
                <InlineNotice
                  tone="info"
                  description={`Candidates: ${verificationCandidateDomains.join(
                    ", "
                  )}`}
                  compact
                />
              ) : null}

              <FieldGroup label="Domain">
                <Input
                  value={verificationInputValue}
                  onChange={(event) => setVerificationInput(event.target.value)}
                  readOnly={!saveAllowed}
                  appearance="quiet"
                  placeholder={s(
                    verificationSurface.candidateDomain,
                    "example.com"
                  )}
                />
              </FieldGroup>

              <Surface padded={false} className="overflow-hidden rounded-[20px]">
                <DataRow
                  label="State"
                  value={verificationStateLabel(verificationSurface.state)}
                />
                <DataRow
                  label="TXT host"
                  value={s(
                    verificationChallenge.name,
                    "Create a challenge first."
                  )}
                />
                <DataRow
                  label="Last checked"
                  value={formatTimestamp(verificationSurface.lastCheckedAt)}
                />
                <DataRow
                  label="Verified at"
                  value={formatTimestamp(verificationSurface.verifiedAt)}
                />
              </Surface>

              <FieldGroup label="TXT value">
                <Textarea
                  value={s(verificationChallenge.value)}
                  readOnly
                  rows={2}
                  appearance="quiet"
                  placeholder="Create a challenge to generate the TXT value."
                />
              </FieldGroup>

              <div className="grid gap-3 md:grid-cols-3">
                <ChannelActionButton
                  quiet
                  fullWidth
                  showArrow={false}
                  onClick={handleCreateChallenge}
                  disabled={
                    !saveAllowed || statusQuery.isLoading || verificationBusy
                  }
                  isLoading={createChallengeMutation.isPending}
                  className="!h-[40px] !rounded-[12px] !text-[11px]"
                >
                  Create TXT
                </ChannelActionButton>

                <ChannelActionButton
                  fullWidth
                  showArrow={false}
                  onClick={handleVerifyNow}
                  disabled={
                    !saveAllowed || statusQuery.isLoading || verificationBusy
                  }
                  isLoading={checkVerificationMutation.isPending}
                  className="!h-[40px] !rounded-[12px] !text-[11px]"
                >
                  Verify
                </ChannelActionButton>

                <ChannelActionButton
                  quiet
                  fullWidth
                  showArrow={false}
                  onClick={handleRefreshVerification}
                  disabled={statusQuery.isLoading || verificationBusy}
                  isLoading={refreshVerificationMutation.isPending}
                  className="!h-[40px] !rounded-[12px] !text-[11px]"
                >
                  Refresh
                </ChannelActionButton>
              </div>
            </div>
          </Section>

          <Section
            eyebrow="Install"
            title="Go live"
            description="Snippet first. Packages if needed."
          >
            <div className="space-y-4">
              {productionInstallBlocked ? (
                <InlineNotice
                  tone="warning"
                  title="Install blocked"
                  description={s(
                    installBlockMessage,
                    "Verify the domain before public install."
                  )}
                  compact
                />
              ) : null}

              {!anyHandoffReady ? (
                <InlineNotice
                  tone={productionInstallBlocked ? "warning" : "info"}
                  description={installHandoffMessage}
                  compact
                />
              ) : null}

              {anyHandoffReady &&
              productionInstallBlocked &&
              install.unverifiedHandoffsAllowed === true ? (
                <InlineNotice
                  tone="warning"
                  description={installHandoffMessage}
                  compact
                />
              ) : null}

              <Surface padded={false} className="overflow-hidden rounded-[20px]">
                <DataRow
                  label="Widget ID"
                  value={s(widget.publicWidgetId, "Generated after save")}
                />
                <DataRow
                  label="Script"
                  value={s(install.scriptUrl, "Not available")}
                />
                <DataRow
                  label="API base"
                  value={s(install.apiBase, "Not available")}
                />
              </Surface>

              <FieldGroup label="Snippet">
                <Textarea
                  value={s(install.embedSnippet)}
                  readOnly
                  rows={5}
                  appearance="quiet"
                  placeholder={
                    productionInstallBlocked
                      ? "Verify domain ownership to unlock the production snippet."
                      : "Save widget settings to generate the snippet."
                  }
                />
              </FieldGroup>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ChannelActionButton
                  fullWidth
                  showArrow={false}
                  onClick={handlePrepareDeveloperInstall}
                  disabled={
                    !developerHandoffReady || statusQuery.isLoading || handoffBusy
                  }
                  isLoading={handoffMutation.isPending}
                  className="!h-[42px] !rounded-[12px] !text-[11px]"
                >
                  Developer package
                </ChannelActionButton>

                <ChannelActionButton
                  quiet
                  fullWidth
                  showArrow={false}
                  onClick={handlePrepareGtmInstall}
                  disabled={!gtmHandoffReady || statusQuery.isLoading || handoffBusy}
                  isLoading={gtmHandoffMutation.isPending}
                  className="!h-[42px] !rounded-[12px] !text-[11px]"
                >
                  GTM package
                </ChannelActionButton>

                <ChannelActionButton
                  quiet
                  fullWidth
                  showArrow={false}
                  onClick={handlePrepareWordpressInstall}
                  disabled={
                    !wordpressHandoffReady ||
                    statusQuery.isLoading ||
                    handoffBusy
                  }
                  isLoading={wordpressHandoffMutation.isPending}
                  className="!h-[42px] !rounded-[12px] !text-[11px]"
                >
                  WordPress package
                </ChannelActionButton>

                <ChannelActionButton
                  quiet
                  fullWidth
                  showArrow={false}
                  onClick={handleCopyHandoffPackage}
                  disabled={!s(handoffSurface.packageText)}
                  leftIcon={<Copy className="h-4 w-4" strokeWidth={2.2} />}
                  className="!h-[42px] !rounded-[12px] !text-[11px]"
                >
                  Copy package
                </ChannelActionButton>
              </div>

              <SaveFeedback success={handoffMessage} error={handoffError} />

              {s(handoffSurface.packageText) ? (
                <div className="space-y-4">
                  {handoffTestingOnly ? (
                    <InlineNotice
                      tone="warning"
                      title="Testing only"
                      description={handoffWarning}
                      compact
                    />
                  ) : null}

                  <Surface padded={false} className="overflow-hidden rounded-[20px]">
                    <DataRow
                      label="Package"
                      value={s(
                        handoffSurface.packageTitle,
                        "Developer install package"
                      )}
                    />
                    <DataRow
                      label={handoffTestingOnly ? "Target domain" : "Verified domain"}
                      value={s(
                        handoffSurface.targetDomain ||
                          handoffSurface.verifiedDomain,
                        "Not available"
                      )}
                    />
                    <DataRow
                      label="Generated"
                      value={formatTimestamp(handoffSurface.generatedAt)}
                    />
                    <DataRow
                      label="Production ready"
                      value={
                        handoffTestingOnly ||
                        handoffSurface.productionReady !== true ||
                        handoffReadiness.productionReady !== true
                          ? "No"
                          : "Yes"
                      }
                    />
                  </Surface>

                  <FieldGroup label="Package body">
                    <Textarea
                      value={s(handoffSurface.packageText)}
                      readOnly
                      rows={12}
                      appearance="quiet"
                    />
                  </FieldGroup>
                </div>
              ) : null}
            </div>
          </Section>

          <Section
            eyebrow="Settings"
            title="Public surface"
            description="Keep this lean."
          >
            <div className="space-y-5">
              <Surface
                padded="md"
                className="flex items-center justify-between rounded-[20px]"
                tone="muted"
              >
                <div>
                  <div className="text-[14px] font-semibold text-text">
                    Widget
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-text-muted">
                    New public sessions follow this immediately.
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
              </Surface>

              <div className="grid gap-4 md:grid-cols-2">
                <FieldGroup label="Title">
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

                <FieldGroup label="Accent">
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
                  placeholder="Ask a question."
                />
              </FieldGroup>

              <FieldGroup label="Allowed origins">
                <Textarea
                  value={form.allowedOrigins}
                  onChange={(event) =>
                    updateForm((current) => ({
                      ...current,
                      allowedOrigins: event.target.value,
                    }))
                  }
                  rows={3}
                  readOnly={!saveAllowed}
                  appearance="quiet"
                  placeholder={"https://www.example.com\nhttps://shop.example.com"}
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
                  placeholder={"example.com\nsupport.example.org"}
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
                  rows={3}
                  readOnly={!saveAllowed}
                  appearance="quiet"
                  placeholder={
                    "What services do you offer?\nCan someone contact me today?"
                  }
                />
              </FieldGroup>
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
            className="!h-[42px] !rounded-[12px] !text-[11px]"
          >
            Save
          </ChannelActionButton>

          <ChannelActionButton
            quiet
            fullWidth
            showArrow={false}
            onClick={handleCopySnippet}
            disabled={productionInstallBlocked || !s(install.embedSnippet)}
            leftIcon={<Copy className="h-4 w-4" strokeWidth={2.2} />}
            className="!h-[42px] !rounded-[12px] !text-[11px]"
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
            className="!h-[40px] !rounded-[12px] !text-[11px]"
          >
            Refresh
          </ChannelActionButton>

          <ChannelActionButton
            quiet
            fullWidth
            showArrow={false}
            onClick={handleClose}
            leftIcon={<ShieldAlert className="h-4 w-4" strokeWidth={2.2} />}
            className="!h-[40px] !rounded-[12px] !text-[11px]"
          >
            Close
          </ChannelActionButton>
        </div>
      </div>
    </aside>
  );
}