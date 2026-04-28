import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Code2,
  Copy,
  Globe2,
  RefreshCw,
  Save,
  Settings2,
  ShieldAlert,
  X,
} from "lucide-react";

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
import { InlineNotice } from "../ui/AppShellPrimitives.jsx";
import ChannelIcon from "./ChannelIcon.jsx";

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

function firstText(...values) {
  for (const value of values) {
    const next = s(value);
    if (next) return next;
  }

  return "";
}

function formatTimestamp(value) {
  const raw = s(value);
  if (!raw) return "Not available";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleString();
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

function verificationStateLabel(state = "") {
  const normalized = s(state).toLowerCase();

  if (normalized === "verified") return "Verified";
  if (normalized === "pending") return "Pending";
  if (normalized === "failed") return "Failed";

  return "Unverified";
}

function buildPosture({
  widget = {},
  install = {},
  launchReadiness = {},
  handoffs = {},
  verificationSurface = {},
  readiness = {},
}) {
  const developerHandoff = obj(handoffs.developer);

  const productionReady =
    launchReadiness.productionLaunchAllowed === true ||
    install.productionInstallReady === true;

  const productionBlocked =
    launchReadiness.productionBlocked === true ||
    install.productionBlocked === true;

  const testingOnly =
    launchReadiness.testingOnly === true || developerHandoff.testingOnly === true;

  const verificationState = s(
    verificationSurface.state || launchReadiness.domainVerificationState
  ).toLowerCase();

  if (widget.enabled !== true) {
    return {
      tone: "warning",
      title: "Widget is off",
      summary: "Enable it and save once.",
      next: "Save required",
      icon: ShieldAlert,
    };
  }

  if (!s(widget.publicWidgetId)) {
    return {
      tone: "warning",
      title: "Widget ID missing",
      summary: "Save once to generate the public install ID.",
      next: "Save required",
      icon: ShieldAlert,
    };
  }

  if (productionBlocked) {
    return {
      tone: verificationState === "failed" ? "danger" : "warning",
      title: "Domain verification needed",
      summary: firstText(
        developerHandoff.blockingMessage,
        launchReadiness.message,
        verificationSurface.message,
        "Verify DNS TXT ownership before public install."
      ),
      next: "Verify domain",
      icon: ShieldAlert,
    };
  }

  if (productionReady || s(readiness.status).toLowerCase() === "ready") {
    return {
      tone: "success",
      title: "Ready to install",
      summary: "Snippet and install packages are available.",
      next: "Copy snippet",
      icon: CheckCircle2,
    };
  }

  if (testingOnly) {
    return {
      tone: "warning",
      title: "Testing mode",
      summary: firstText(
        developerHandoff.message,
        launchReadiness.message,
        "Install packages are available for local or test usage only."
      ),
      next: "Verify domain",
      icon: ShieldAlert,
    };
  }

  return {
    tone: "warning",
    title: "Setup needs review",
    summary: firstText(
      launchReadiness.message,
      readiness.message,
      "Finish the remaining website setup."
    ),
    next: "Review setup",
    icon: ShieldAlert,
  };
}

function compactValue(value, max = 28) {
  const text = s(value, "Not set");
  if (text.length <= max) return text;
  return `${text.slice(0, 16)}…${text.slice(-8)}`;
}

function toneClass(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  return "text-text-muted";
}

function ActionButton({
  children,
  icon = null,
  primary = false,
  disabled = false,
  onClick,
  className = "",
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-4",
        "text-[13px] font-semibold tracking-[-0.01em]",
        "transition-all duration-200 ease-out",
        primary
          ? "bg-brand text-white shadow-[0_16px_34px_-22px_rgba(46,96,255,0.68)] hover:-translate-y-[1px] hover:bg-brand-strong"
          : "border border-line bg-surface text-text hover:-translate-y-[1px] hover:bg-surface-subtle",
        disabled && "cursor-not-allowed opacity-45 hover:translate-y-0",
        className
      )}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function TextNavButton({ active, icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "relative inline-flex h-11 items-center gap-2 border-b-2 px-1",
        "text-[13px] font-semibold tracking-[-0.01em] transition-colors",
        active
          ? "border-brand text-brand"
          : "border-transparent text-text-muted hover:text-text"
      )}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function LedgerCell({ label, value, tone = "neutral" }) {
  return (
    <div className="min-w-0 border-r border-line-soft px-4 last:border-r-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
        {label}
      </div>

      <div
        className={cx(
          "mt-1 truncate text-[14px] font-semibold tracking-[-0.015em]",
          toneClass(tone)
        )}
        title={s(value)}
      >
        {value || "Not set"}
      </div>
    </div>
  );
}

function KeyValueLine({ label, value }) {
  return (
    <div className="grid grid-cols-[126px_minmax(0,1fr)] items-center border-b border-line-soft py-3 last:border-b-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {label}
      </div>

      <div className="min-w-0 truncate text-[13.5px] font-semibold tracking-[-0.01em] text-text">
        {value || "Not available"}
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
      {children}
    </label>
  );
}

function SectionHeading({ eyebrow, title, description, right = null }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            {eyebrow}
          </div>
        ) : null}

        <div className="mt-1 text-[20px] font-semibold leading-6 tracking-[-0.04em] text-text">
          {title}
        </div>

        {description ? (
          <div className="mt-1 text-[13px] font-semibold leading-5 text-text-muted">
            {description}
          </div>
        ) : null}
      </div>

      {right}
    </div>
  );
}

function Feedback({ success, error, info }) {
  if (error) return <InlineNotice tone="danger" description={error} compact />;
  if (success) return <InlineNotice tone="success" description={success} compact />;
  if (info) return <InlineNotice tone="info" description={info} compact />;

  return null;
}

export default function WebsiteWidgetDetailDrawer({
  channel,
  open = false,
  onClose,
}) {
  const queryClient = useQueryClient();
  const workspace = useWorkspaceTenantKey({ enabled: open });

  const [activeMode, setActiveMode] = useState("status");
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
      setActiveMode("install");
    },
  });

  const gtmHandoffMutation = useMutation({
    mutationFn: createWebsiteWidgetGtmInstallHandoff,
    onSuccess(nextPayload) {
      setHandoffPackage(obj(nextPayload));
      setHandoffMessage("GTM package prepared.");
      setCopyFeedback("");
      setActiveMode("install");
    },
  });

  const wordpressHandoffMutation = useMutation({
    mutationFn: createWebsiteWidgetWordpressInstallHandoff,
    onSuccess(nextPayload) {
      setHandoffPackage(obj(nextPayload));
      setHandoffMessage("WordPress package prepared.");
      setCopyFeedback("");
      setActiveMode("install");
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
      setActiveMode("verify");

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
      setActiveMode("verify");

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
  const launchReadiness = obj(payload.launchReadiness);
  const launchHandoffs = obj(launchReadiness.handoffs);
  const launchDeveloperHandoff = obj(launchHandoffs.developer);
  const launchGtmHandoff = obj(launchHandoffs.gtm);
  const launchWordpressHandoff = obj(launchHandoffs.wordpress);
  const serverVerification = obj(payload.domainVerification);
  const verificationSurface = Object.keys(obj(verificationOverride)).length
    ? obj(verificationOverride)
    : serverVerification;
  const handoffSurface = obj(handoffPackage);
  const handoffSurfaceLaunchReadiness = obj(handoffSurface.launchReadiness);
  const verificationChallenge = obj(verificationSurface.challenge);
  const verificationCandidateDomains = arr(verificationSurface.candidateDomains);
  const verificationReadiness = obj(verificationSurface.readiness);
  const handoffReadiness = obj(handoffSurface.readiness);
  const permissions = obj(payload.permissions);
  const blockers =
    arr(launchReadiness.blockers).length > 0
      ? arr(launchReadiness.blockers)
      : arr(readiness.blockers);

  const saveAllowed = permissions.saveAllowed !== false;
  const form = draftForm || buildFormState(payload);

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

  const productionInstallReady =
    launchReadiness.productionLaunchAllowed === true ||
    install.productionInstallReady === true;

  const productionInstallBlocked =
    launchReadiness.productionBlocked === true ||
    install.productionBlocked === true ||
    (verificationReadiness.enforcementActive === true &&
      verificationReadiness.productionInstallReady !== true);

  const installBlockMessage = firstText(
    launchDeveloperHandoff.blockingMessage,
    install.blockMessage,
    productionInstallBlocked ? launchReadiness.message : "",
    productionInstallBlocked ? verificationSurface.message : ""
  );

  const developerHandoffReady =
    saveAllowed &&
    (launchDeveloperHandoff.ready === true ||
      install.developerHandoffReady === true);

  const gtmHandoffReady =
    saveAllowed &&
    (launchGtmHandoff.ready === true || install.gtmHandoffReady === true);

  const wordpressHandoffReady =
    saveAllowed &&
    (launchWordpressHandoff.ready === true ||
      install.wordpressHandoffReady === true);

  const anyHandoffReady =
    developerHandoffReady || gtmHandoffReady || wordpressHandoffReady;

  const installHandoffMessage = firstText(
    launchDeveloperHandoff.message,
    install.handoffMessage,
    productionInstallBlocked ? launchReadiness.message : "",
    productionInstallBlocked ? verificationSurface.message : "",
    "Install package is unavailable right now."
  );

  const handoffTestingOnly =
    handoffSurface.testingOnly === true ||
    handoffReadiness.testingOnly === true ||
    handoffSurfaceLaunchReadiness.testingOnly === true;

  const handoffWarning = firstText(
    handoffReadiness.warning,
    handoffSurface.warning,
    handoffReadiness.blockingMessage,
    handoffSurface.blockingMessage,
    handoffTestingOnly
      ? "Testing only. Public launch still needs verified DNS TXT."
      : ""
  );

  const verificationError = s(
    createChallengeMutation.error?.message ||
      checkVerificationMutation.error?.message ||
      refreshVerificationMutation.error?.message
  );

  const handoffError = s(
    handoffMutation.error?.message ||
      gtmHandoffMutation.error?.message ||
      wordpressHandoffMutation.error?.message
  );

  const actionError = s(saveMutation.error?.message || statusQuery.error?.message);

  const verificationBusy =
    createChallengeMutation.isPending ||
    checkVerificationMutation.isPending ||
    refreshVerificationMutation.isPending;

  const handoffBusy =
    handoffMutation.isPending ||
    gtmHandoffMutation.isPending ||
    wordpressHandoffMutation.isPending;

  const posture = useMemo(
    () =>
      buildPosture({
        widget,
        install,
        launchReadiness,
        handoffs: launchHandoffs,
        verificationSurface,
        readiness,
      }),
    [widget, install, launchReadiness, launchHandoffs, verificationSurface, readiness]
  );

  const PostureIcon = posture.icon;

  const verified = s(verificationSurface.state).toLowerCase() === "verified";

  const installState = productionInstallReady
    ? "Ready"
    : launchReadiness.testingOnly === true
      ? "Testing"
      : productionInstallBlocked
        ? "Blocked"
        : "Pending";

  const installTone = productionInstallReady
    ? "success"
    : productionInstallBlocked || launchReadiness.testingOnly === true
      ? "warning"
      : "neutral";

  const snippetAvailable = Boolean(s(install.embedSnippet));
  const packageAvailable = Boolean(s(handoffSurface.packageText));

  function updateForm(updater) {
    setDraftForm((current) => {
      const nextCurrent = current || buildFormState(statusQuery.data || {});
      return typeof updater === "function" ? updater(nextCurrent) : updater;
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

  async function copyTextValue(value, successMessage) {
    const text = s(value);
    if (!text) return;

    try {
      if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyFeedback(successMessage);
        setStatusMessage("");
        return;
      }
    } catch {
      // Clipboard can fail in restricted test/browser contexts.
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
    if (!saveAllowed) return;

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

  return (
    <aside
      aria-hidden={!open}
      className="flex h-full min-h-0 w-full flex-col border-l border-line-soft bg-surface shadow-panel"
    >
      <header className="relative z-20 shrink-0 border-b border-line-soft bg-surface px-7 py-5">
        <div className="flex items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <ChannelIcon channel={channel} size="lg" />

            <div className="min-w-0">
              <h2 className="truncate text-[25px] font-semibold leading-7 tracking-[-0.045em] text-text">
                {channel?.name || "Website chat"}
              </h2>

              <div className="mt-2 inline-flex items-center gap-2 text-[12px] font-semibold leading-none text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                <span>{widget.enabled === true ? "Connected" : "Disabled"}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close channel details"
            onClick={handleClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-text-muted transition-all duration-200 hover:-translate-y-[1px] hover:bg-surface-subtle hover:text-text"
          >
            <X className="h-5 w-5" strokeWidth={2.15} />
          </button>
        </div>
      </header>

      <div className="shrink-0 border-b border-line-soft bg-surface px-7 py-5">
        <div className="flex items-start gap-4">
          <div className={cx("pt-0.5", toneClass(posture.tone))}>
            <PostureIcon className="h-5 w-5" strokeWidth={2.1} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div className="truncate text-[19px] font-semibold leading-6 tracking-[-0.04em] text-text">
                {posture.title}
              </div>

              <div className={cx("shrink-0 text-[12px] font-semibold", toneClass(posture.tone))}>
                {posture.next}
              </div>
            </div>

            <div className="mt-1 text-[13px] font-semibold leading-5 text-text-muted">
              {posture.summary}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 overflow-hidden border-y border-line-soft py-4">
          <LedgerCell
            label="Widget"
            value={
              widget.enabled === true
                ? compactValue(widget.publicWidgetId || "Enabled")
                : "Disabled"
            }
            tone={widget.enabled === true ? "success" : "warning"}
          />

          <LedgerCell
            label="Domain"
            value={compactValue(
              verificationSurface.domain ||
                verificationSurface.candidateDomain ||
                "Not set"
            )}
            tone={verified ? "success" : productionInstallBlocked ? "warning" : "neutral"}
          />

          <LedgerCell label="Install" value={installState} tone={installTone} />
        </div>

        <div className="mt-2 flex items-center gap-7">
          <TextNavButton
            active={activeMode === "status"}
            onClick={() => setActiveMode("status")}
            icon={<Settings2 className="h-4 w-4" strokeWidth={2.1} />}
          >
            Surface
          </TextNavButton>

          <TextNavButton
            active={activeMode === "verify"}
            onClick={() => setActiveMode("verify")}
            icon={<Globe2 className="h-4 w-4" strokeWidth={2.1} />}
          >
            Verify
          </TextNavButton>

          <TextNavButton
            active={activeMode === "install"}
            onClick={() => setActiveMode("install")}
            icon={<Code2 className="h-4 w-4" strokeWidth={2.1} />}
          >
            Install
          </TextNavButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
        <div className="space-y-5">
          <Feedback success={statusMessage} error={actionError} info={copyFeedback} />

          {!saveAllowed ? (
            <InlineNotice
              tone="warning"
              description={s(
                permissions.message,
                "Only owner/admin can change Website Chat settings."
              )}
              compact
            />
          ) : null}

          {blockers.map((item, index) => (
            <InlineNotice
              key={`${s(item.reasonCode)}-${index}`}
              tone="warning"
              title={s(item.title, "Setup blocker")}
              description={s(item.subtitle)}
              compact
            />
          ))}

          {activeMode === "status" ? (
            <section>
              <SectionHeading
                eyebrow="Settings"
                title="Public surface"
                description="Only the public widget controls. No install data here."
                right={
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
                      "inline-flex h-9 min-w-[108px] items-center justify-center rounded-[10px] border px-3",
                      "text-[12px] font-semibold uppercase tracking-[0.08em] transition-all duration-200",
                      form.enabled
                        ? "border-[rgba(var(--color-success),0.18)] bg-success-soft text-success"
                        : "border-line bg-surface-subtle text-text-muted",
                      !saveAllowed && "cursor-not-allowed opacity-50"
                    )}
                  >
                    {form.enabled ? "Enabled" : "Disabled"}
                  </button>
                }
              />

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel>Title</FieldLabel>
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
                    placeholder="NEOX Website Chat"
                  />
                </div>

                <div>
                  <FieldLabel>Accent</FieldLabel>
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
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel>Allowed origins</FieldLabel>
                  <Textarea
                    value={form.allowedOrigins}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        allowedOrigins: event.target.value,
                      }))
                    }
                    readOnly={!saveAllowed}
                    rows={3}
                    appearance="quiet"
                    placeholder="https://www.example.com"
                    textClassName="!min-h-[82px]"
                  />
                </div>

                <div>
                  <FieldLabel>Allowed domains</FieldLabel>
                  <Textarea
                    value={form.allowedDomains}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        allowedDomains: event.target.value,
                      }))
                    }
                    readOnly={!saveAllowed}
                    rows={3}
                    appearance="quiet"
                    placeholder="example.com"
                    textClassName="!min-h-[82px]"
                  />
                </div>
              </div>

              <div className="mt-5">
                <FieldLabel>Quick prompts</FieldLabel>
                <Textarea
                  value={form.initialPrompts}
                  onChange={(event) =>
                    updateForm((current) => ({
                      ...current,
                      initialPrompts: event.target.value,
                    }))
                  }
                  readOnly={!saveAllowed}
                  rows={3}
                  appearance="quiet"
                  placeholder="What services do you offer?"
                  textClassName="!min-h-[82px]"
                />
              </div>
            </section>
          ) : null}

          {activeMode === "verify" ? (
            <section>
              <SectionHeading
                eyebrow="Verification"
                title="Domain gate"
                description="One domain. One TXT challenge. Then verify."
              />

              <div className="mt-6">
                <FieldLabel>Domain</FieldLabel>
                <Input
                  value={verificationInputValue}
                  onChange={(event) => setVerificationInput(event.target.value)}
                  readOnly={!saveAllowed}
                  appearance="quiet"
                  placeholder={s(verificationSurface.candidateDomain, "example.com")}
                />
              </div>

              <div className="mt-5 border-y border-line-soft">
                <KeyValueLine
                  label="State"
                  value={verificationStateLabel(verificationSurface.state)}
                />
                <KeyValueLine
                  label="TXT host"
                  value={s(verificationChallenge.name, "Create a challenge first.")}
                />
                <KeyValueLine
                  label="Last check"
                  value={formatTimestamp(verificationSurface.lastCheckedAt)}
                />
                <KeyValueLine
                  label="Verified at"
                  value={formatTimestamp(verificationSurface.verifiedAt)}
                />
              </div>

              <div className="mt-5">
                <FieldLabel>TXT value</FieldLabel>
                <Textarea
                  value={s(verificationChallenge.value)}
                  readOnly
                  rows={3}
                  appearance="quiet"
                  placeholder="Create a challenge to generate the TXT value."
                  textClassName="!min-h-[86px]"
                />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <ActionButton
                  onClick={handleCreateChallenge}
                  disabled={!saveAllowed || statusQuery.isLoading || verificationBusy}
                >
                  Create TXT
                </ActionButton>

                <ActionButton
                  primary
                  onClick={handleVerifyNow}
                  disabled={!saveAllowed || statusQuery.isLoading || verificationBusy}
                >
                  Verify
                </ActionButton>

                <ActionButton
                  onClick={handleRefreshVerification}
                  disabled={statusQuery.isLoading || verificationBusy}
                >
                  Refresh
                </ActionButton>
              </div>

              <div className="mt-5">
                <Feedback success={verificationMessage} error={verificationError} />
              </div>

              {verificationCandidateDomains.length > 1 ? (
                <div className="mt-4 text-[12px] font-semibold leading-5 text-text-muted">
                  Candidates: {verificationCandidateDomains.join(", ")}
                </div>
              ) : null}
            </section>
          ) : null}

          {activeMode === "install" ? (
            <section>
              <SectionHeading
                eyebrow="Install"
                title="Go live"
                description="Copy snippet first. Packages only if needed."
              />

              {productionInstallBlocked ? (
                <div className="mt-5">
                  <InlineNotice
                    tone="warning"
                    title="Install blocked"
                    description={s(
                      installBlockMessage,
                      "Verify the domain before public install."
                    )}
                    compact
                  />
                </div>
              ) : null}

              {!anyHandoffReady ? (
                <div className="mt-5">
                  <InlineNotice
                    tone={productionInstallBlocked ? "warning" : "info"}
                    description={installHandoffMessage}
                    compact
                  />
                </div>
              ) : null}

              <div className="mt-5 border-y border-line-soft">
                <KeyValueLine
                  label="Widget ID"
                  value={s(widget.publicWidgetId, "Generated after save")}
                />
                <KeyValueLine
                  label="Script"
                  value={s(install.scriptUrl, "Not available")}
                />
                <KeyValueLine
                  label="API base"
                  value={s(install.apiBase, "Not available")}
                />
              </div>

              <div className="mt-5">
                <FieldLabel>Snippet</FieldLabel>
                <Textarea
                  value={s(install.embedSnippet)}
                  readOnly
                  rows={4}
                  appearance="quiet"
                  placeholder={
                    productionInstallBlocked
                      ? "Verify domain ownership to unlock the production snippet."
                      : "Save widget settings to generate the snippet."
                  }
                  textClassName="!min-h-[104px] font-mono !text-[12.5px]"
                />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <ActionButton
                  onClick={handlePrepareDeveloperInstall}
                  disabled={!developerHandoffReady || statusQuery.isLoading || handoffBusy}
                >
                  Developer
                </ActionButton>

                <ActionButton
                  onClick={handlePrepareGtmInstall}
                  disabled={!gtmHandoffReady || statusQuery.isLoading || handoffBusy}
                >
                  GTM
                </ActionButton>

                <ActionButton
                  onClick={handlePrepareWordpressInstall}
                  disabled={!wordpressHandoffReady || statusQuery.isLoading || handoffBusy}
                >
                  WordPress
                </ActionButton>
              </div>

              <div className="mt-5">
                <Feedback success={handoffMessage} error={handoffError} />
              </div>

              {handoffWarning ? (
                <div className="mt-5">
                  <InlineNotice tone="warning" description={handoffWarning} compact />
                </div>
              ) : null}

              {packageAvailable ? (
                <div className="mt-5">
                  <FieldLabel>Package</FieldLabel>
                  <Textarea
                    value={s(handoffSurface.packageText)}
                    readOnly
                    rows={4}
                    appearance="quiet"
                    textClassName="!min-h-[104px] font-mono !text-[12.5px]"
                  />
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      <footer className="relative z-20 shrink-0 border-t border-line-soft bg-surface px-7 py-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
          <ActionButton
            primary
            icon={<Save className="h-4 w-4" strokeWidth={2.1} />}
            onClick={handleSave}
            disabled={!saveAllowed || saveMutation.isPending}
            className="w-full"
          >
            {saveMutation.isPending ? "Saving" : "Save"}
          </ActionButton>

          {activeMode === "install" && packageAvailable ? (
            <ActionButton
              icon={<Copy className="h-4 w-4" strokeWidth={2.1} />}
              onClick={handleCopyHandoffPackage}
            >
              Copy package
            </ActionButton>
          ) : (
            <ActionButton
              icon={<Copy className="h-4 w-4" strokeWidth={2.1} />}
              onClick={handleCopySnippet}
              disabled={!snippetAvailable}
            >
              Copy snippet
            </ActionButton>
          )}

          <ActionButton
            icon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
            onClick={handleRefresh}
            disabled={statusQuery.isFetching}
          >
            Refresh
          </ActionButton>
        </div>
      </footer>
    </aside>
  );
}