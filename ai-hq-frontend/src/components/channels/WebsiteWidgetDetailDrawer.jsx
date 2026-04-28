import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Code2,
  Copy,
  Globe2,
  Package,
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

const ACCENT_OPTIONS = [
  { label: "Blue", value: "#2e60ff", preview: "#2e60ff" },
  { label: "Navy", value: "#0f172a", preview: "#0f172a" },
  { label: "Cyan", value: "#0ea5e9", preview: "#0ea5e9" },
  { label: "Green", value: "#16a34a", preview: "#16a34a" },
];

function scheduleAsyncState(callback) {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(callback);
    return;
  }

  Promise.resolve().then(callback);
}

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

function compactValue(value, max = 30) {
  const text = s(value, "Not set");
  if (text.length <= max) return text;
  return `${text.slice(0, 17)}…${text.slice(-8)}`;
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
      summary: "Turn it on when you are ready.",
      next: "Change settings",
      icon: ShieldAlert,
    };
  }

  if (!s(widget.publicWidgetId)) {
    return {
      tone: "warning",
      title: "Widget ID missing",
      summary: "Save settings once to create the public widget ID.",
      next: "Save settings",
      icon: ShieldAlert,
    };
  }

  if (productionBlocked) {
    return {
      tone: verificationState === "failed" ? "danger" : "warning",
      title: "Domain needs verification",
      summary: firstText(
        developerHandoff.blockingMessage,
        launchReadiness.message,
        verificationSurface.message,
        "Verify DNS ownership before public install."
      ),
      next: "Verify domain",
      icon: ShieldAlert,
    };
  }

  if (productionReady || s(readiness.status).toLowerCase() === "ready") {
    return {
      tone: "success",
      title: "Ready to install",
      summary: "The widget is configured. Copy the snippet when you need it.",
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

function toneClass(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  return "text-text-muted";
}

function toneSurfaceClass(tone = "neutral") {
  if (tone === "success") {
    return "border-success/20 bg-success/5 text-success";
  }

  if (tone === "warning") {
    return "border-warning/20 bg-warning/5 text-warning";
  }

  if (tone === "danger") {
    return "border-danger/20 bg-danger/5 text-danger";
  }

  return "border-line bg-surface-subtle text-text-muted";
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

function UtilityButton({
  icon,
  title,
  description,
  disabled = false,
  onClick,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "group grid grid-cols-[34px_minmax(0,1fr)] items-center gap-3 border-b border-line-soft py-4 text-left last:border-b-0",
        "transition-colors duration-200 hover:bg-surface-subtle/55",
        disabled && "cursor-not-allowed opacity-45 hover:bg-transparent"
      )}
    >
      <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-line bg-surface text-text-muted transition-colors group-hover:text-text">
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold tracking-[-0.02em] text-text">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] font-semibold text-text-muted">
          {description}
        </span>
      </span>
    </button>
  );
}

function LedgerLine({ label, value, tone = "neutral" }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center border-b border-line-soft py-3 last:border-b-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
        {label}
      </div>

      <div
        title={s(value)}
        className={cx(
          "min-w-0 truncate text-[14px] font-semibold tracking-[-0.015em]",
          toneClass(tone)
        )}
      >
        {value || "Not set"}
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

  const [activePanel, setActivePanel] = useState("overview");
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

  useEffect(() => {
    if (!open) return undefined;

    let alive = true;

    scheduleAsyncState(() => {
      if (!alive) return;

      setActivePanel("overview");
      setStatusMessage("");
      setCopyFeedback("");
      setVerificationMessage("");
      setHandoffMessage("");
    });

    return () => {
      alive = false;
    };
  }, [open, channel?.id]);

  const handoffMutation = useMutation({
    mutationFn: createWebsiteWidgetInstallHandoff,
    onSuccess(nextPayload) {
      setHandoffPackage(obj(nextPayload));
      setHandoffMessage("Developer package prepared.");
      setCopyFeedback("");
      setActivePanel("install");
    },
  });

  const gtmHandoffMutation = useMutation({
    mutationFn: createWebsiteWidgetGtmInstallHandoff,
    onSuccess(nextPayload) {
      setHandoffPackage(obj(nextPayload));
      setHandoffMessage("GTM package prepared.");
      setCopyFeedback("");
      setActivePanel("install");
    },
  });

  const wordpressHandoffMutation = useMutation({
    mutationFn: createWebsiteWidgetWordpressInstallHandoff,
    onSuccess(nextPayload) {
      setHandoffPackage(obj(nextPayload));
      setHandoffMessage("WordPress package prepared.");
      setCopyFeedback("");
      setActivePanel("install");
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
      setActivePanel("overview");

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
      setActivePanel("verify");

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
      setActivePanel("verify");

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
      setActivePanel("verify");

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

  const posture = buildPosture({
    widget,
    install,
    launchReadiness,
    handoffs: launchHandoffs,
    verificationSurface,
    readiness,
  });

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
        setActivePanel("overview");
        return;
      }
    } catch {
      // Clipboard can fail in restricted browser contexts.
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

  function renderFooter() {
    if (activePanel === "settings") {
      return (
        <>
          <ActionButton
            primary
            icon={<Save className="h-4 w-4" strokeWidth={2.1} />}
            onClick={handleSave}
            disabled={!saveAllowed || saveMutation.isPending}
            className="w-full"
          >
            {saveMutation.isPending ? "Saving" : "Save changes"}
          </ActionButton>

          <ActionButton onClick={() => setActivePanel("overview")}>
            Cancel
          </ActionButton>

          <ActionButton
            icon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
            onClick={handleRefresh}
            disabled={statusQuery.isFetching}
          >
            Refresh
          </ActionButton>
        </>
      );
    }

    if (activePanel === "verify") {
      return (
        <>
          <ActionButton
            primary
            onClick={handleVerifyNow}
            disabled={!saveAllowed || statusQuery.isLoading || verificationBusy}
            className="w-full"
          >
            Verify
          </ActionButton>

          <ActionButton
            onClick={handleCreateChallenge}
            disabled={!saveAllowed || statusQuery.isLoading || verificationBusy}
          >
            Create TXT
          </ActionButton>

          <ActionButton
            icon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
            onClick={handleRefreshVerification}
            disabled={statusQuery.isLoading || verificationBusy}
          >
            Refresh
          </ActionButton>
        </>
      );
    }

    if (activePanel === "install") {
      return (
        <>
          {packageAvailable ? (
            <ActionButton
              primary
              icon={<Copy className="h-4 w-4" strokeWidth={2.1} />}
              onClick={handleCopyHandoffPackage}
              className="w-full"
            >
              Copy package
            </ActionButton>
          ) : (
            <ActionButton
              primary
              icon={<Copy className="h-4 w-4" strokeWidth={2.1} />}
              onClick={handleCopySnippet}
              disabled={!snippetAvailable}
              className="w-full"
            >
              Copy snippet
            </ActionButton>
          )}

          <ActionButton
            onClick={handlePrepareDeveloperInstall}
            disabled={!developerHandoffReady || statusQuery.isLoading || handoffBusy}
          >
            Package
          </ActionButton>

          <ActionButton
            icon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
            onClick={handleRefresh}
            disabled={statusQuery.isFetching}
          >
            Refresh
          </ActionButton>
        </>
      );
    }

    return (
      <>
        <ActionButton
          primary
          icon={<Copy className="h-4 w-4" strokeWidth={2.1} />}
          onClick={handleCopySnippet}
          disabled={!snippetAvailable}
          className="w-full"
        >
          Copy snippet
        </ActionButton>

        <ActionButton
          icon={<Settings2 className="h-4 w-4" strokeWidth={2.1} />}
          onClick={() => setActivePanel("settings")}
        >
          Change
        </ActionButton>

        <ActionButton
          icon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
          onClick={handleRefresh}
          disabled={statusQuery.isFetching}
        >
          Refresh
        </ActionButton>
      </>
    );
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

              <div
                className={cx(
                  "mt-2 inline-flex items-center gap-2 text-[12px] font-semibold leading-none",
                  widget.enabled === true ? "text-success" : "text-text-muted"
                )}
              >
                <span
                  className={cx(
                    "h-1.5 w-1.5 rounded-full",
                    widget.enabled === true ? "bg-success" : "bg-text-subtle"
                  )}
                />
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

      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
        <div className="space-y-6">
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

          {statusQuery.isLoading || workspace.loading ? (
            <InlineNotice tone="info" description="Loading website channel state." compact />
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

          {activePanel === "overview" ? (
            <>
              <section>
                <div className="flex items-start gap-4">
                  <div className={cx("pt-0.5", toneClass(posture.tone))}>
                    <PostureIcon className="h-5 w-5" strokeWidth={2.1} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[22px] font-semibold leading-7 tracking-[-0.045em] text-text">
                      {posture.title}
                    </div>

                    <div className="mt-1 text-[14px] font-semibold leading-6 text-text-muted">
                      {posture.summary}
                    </div>

                    <div className="mt-4 inline-flex items-center rounded-[10px] border border-line bg-surface-subtle px-3 py-2 text-[12px] font-semibold text-text-muted">
                      Next: {posture.next}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[16px] border border-line bg-surface p-4 shadow-soft">
                <SectionHeading
                  eyebrow="Channel"
                  title="Website widget"
                  description="Runtime, install and verification posture."
                  right={
                    <span
                      className={cx(
                        "inline-flex h-8 items-center rounded-[9px] border px-3 text-[12px] font-semibold",
                        toneSurfaceClass(installTone)
                      )}
                    >
                      {installState}
                    </span>
                  }
                />

                <div className="mt-4 rounded-[12px] border border-line-soft bg-surface-subtle px-4">
                  <LedgerLine
                    label="Widget ID"
                    value={compactValue(widget.publicWidgetId)}
                    tone={s(widget.publicWidgetId) ? "neutral" : "warning"}
                  />
                  <LedgerLine
                    label="Status"
                    value={widget.enabled === true ? "Enabled" : "Disabled"}
                    tone={widget.enabled === true ? "success" : "warning"}
                  />
                  <LedgerLine
                    label="Domain"
                    value={compactValue(verificationTargetDomain || suggestedVerificationDomain)}
                  />
                  <LedgerLine
                    label="Verification"
                    value={verificationStateLabel(verificationSurface.state)}
                    tone={verified ? "success" : "warning"}
                  />
                  <LedgerLine
                    label="Updated"
                    value={formatTimestamp(widget.updatedAt || payload.updatedAt)}
                  />
                </div>
              </section>

              <section className="rounded-[16px] border border-line bg-surface p-4 shadow-soft">
                <SectionHeading
                  eyebrow="Actions"
                  title="Operate"
                  description="Prepare install packages or review settings."
                />

                <div className="mt-3 overflow-hidden rounded-[12px] border border-line-soft bg-surface">
                  <UtilityButton
                    icon={<Settings2 className="h-4 w-4" strokeWidth={2.1} />}
                    title="Widget settings"
                    description="Title, color, allowed domains and prompts."
                    disabled={!saveAllowed}
                    onClick={() => setActivePanel("settings")}
                  />

                  <UtilityButton
                    icon={<ShieldAlert className="h-4 w-4" strokeWidth={2.1} />}
                    title="Domain verification"
                    description={
                      verified
                        ? "Domain is verified."
                        : "Create or check the DNS TXT challenge."
                    }
                    disabled={!saveAllowed}
                    onClick={() => setActivePanel("verify")}
                  />

                  <UtilityButton
                    icon={<Package className="h-4 w-4" strokeWidth={2.1} />}
                    title="Install package"
                    description="Snippet, developer, GTM or WordPress package."
                    onClick={() => setActivePanel("install")}
                  />
                </div>
              </section>
            </>
          ) : null}

          {activePanel === "settings" ? (
            <section className="rounded-[16px] border border-line bg-surface p-4 shadow-soft">
              <SectionHeading
                eyebrow="Settings"
                title="Widget configuration"
                description="Control the public widget experience."
              />

              <div className="mt-5 space-y-5">
                <div className="flex items-center justify-between gap-4 rounded-[12px] border border-line-soft bg-surface-subtle px-4 py-3">
                  <div>
                    <div className="text-[14px] font-semibold tracking-[-0.02em] text-text">
                      Enable widget
                    </div>
                    <div className="mt-0.5 text-[12.5px] font-semibold text-text-muted">
                      Public chat launcher can be installed when enabled.
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
                      "relative h-7 w-12 rounded-full border transition-colors duration-200",
                      form.enabled
                        ? "border-brand/20 bg-brand"
                        : "border-line bg-surface",
                      !saveAllowed && "cursor-not-allowed opacity-50"
                    )}
                    aria-pressed={form.enabled}
                  >
                    <span
                      className={cx(
                        "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-200",
                        form.enabled ? "translate-x-[22px]" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>

                <div>
                  <FieldLabel>Title</FieldLabel>
                  <Input
                    value={form.title}
                    placeholder="Ask us anything"
                    disabled={!saveAllowed}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <FieldLabel>Subtitle</FieldLabel>
                  <Input
                    value={form.subtitle}
                    placeholder="We usually reply fast."
                    disabled={!saveAllowed}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        subtitle: event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <FieldLabel>Accent color</FieldLabel>
                  <div className="grid grid-cols-4 gap-2">
                    {ACCENT_OPTIONS.map((option) => {
                      const selected = s(form.accentColor) === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={!saveAllowed}
                          onClick={() =>
                            updateForm((current) => ({
                              ...current,
                              accentColor: option.value,
                            }))
                          }
                          className={cx(
                            "flex h-10 items-center justify-center gap-2 rounded-[10px] border text-[12px] font-semibold transition-all duration-200",
                            selected
                              ? "border-brand bg-brand/5 text-text"
                              : "border-line bg-surface text-text-muted hover:bg-surface-subtle",
                            !saveAllowed && "cursor-not-allowed opacity-50"
                          )}
                        >
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ background: option.preview }}
                          />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <FieldLabel>Allowed origins</FieldLabel>
                  <Textarea
                    rows={3}
                    value={form.allowedOrigins}
                    placeholder="https://example.com"
                    disabled={!saveAllowed}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        allowedOrigins: event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <FieldLabel>Allowed domains</FieldLabel>
                  <Textarea
                    rows={3}
                    value={form.allowedDomains}
                    placeholder="example.com"
                    disabled={!saveAllowed}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        allowedDomains: event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <FieldLabel>Initial prompts</FieldLabel>
                  <Textarea
                    rows={4}
                    value={form.initialPrompts}
                    placeholder="How can I book?\nWhat services do you offer?"
                    disabled={!saveAllowed}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        initialPrompts: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </section>
          ) : null}

          {activePanel === "verify" ? (
            <section className="rounded-[16px] border border-line bg-surface p-4 shadow-soft">
              <SectionHeading
                eyebrow="Verification"
                title="Domain ownership"
                description="Verify DNS before public production install."
                right={
                  <span
                    className={cx(
                      "inline-flex h-8 items-center rounded-[9px] border px-3 text-[12px] font-semibold",
                      verified
                        ? "border-success/20 bg-success/5 text-success"
                        : "border-warning/20 bg-warning/5 text-warning"
                    )}
                  >
                    {verificationStateLabel(verificationSurface.state)}
                  </span>
                }
              />

              <div className="mt-5 space-y-5">
                <Feedback
                  success={verificationMessage}
                  error={verificationError}
                  info={verificationSurface.message}
                />

                <div>
                  <FieldLabel>Domain</FieldLabel>
                  <Input
                    value={verificationInputValue}
                    placeholder="example.com"
                    disabled={!saveAllowed || verificationBusy}
                    onChange={(event) => setVerificationInput(event.target.value)}
                  />
                </div>

                {verificationCandidateDomains.length ? (
                  <div className="rounded-[12px] border border-line-soft bg-surface-subtle p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
                      Suggested domains
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {verificationCandidateDomains.map((domain) => (
                        <button
                          key={domain}
                          type="button"
                          disabled={!saveAllowed || verificationBusy}
                          onClick={() => setVerificationInput(domain)}
                          className="rounded-[9px] border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-text-muted transition-colors hover:bg-surface-subtle hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {domain}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-[12px] border border-line-soft bg-surface-subtle px-4">
                  <LedgerLine
                    label="State"
                    value={verificationStateLabel(verificationSurface.state)}
                    tone={verified ? "success" : "warning"}
                  />
                  <LedgerLine
                    label="Domain"
                    value={verificationSurface.domain || verificationTargetDomain}
                  />
                  <LedgerLine
                    label="Record"
                    value={verificationChallenge.recordType || "TXT"}
                  />
                  <LedgerLine
                    label="Name"
                    value={compactValue(
                      verificationChallenge.name || verificationChallenge.host,
                      42
                    )}
                  />
                  <LedgerLine
                    label="Value"
                    value={compactValue(
                      verificationChallenge.value || verificationChallenge.txtValue,
                      42
                    )}
                  />
                  <LedgerLine
                    label="Checked"
                    value={formatTimestamp(
                      verificationSurface.checkedAt || verificationSurface.updatedAt
                    )}
                  />
                </div>
              </div>
            </section>
          ) : null}

          {activePanel === "install" ? (
            <section className="rounded-[16px] border border-line bg-surface p-4 shadow-soft">
              <SectionHeading
                eyebrow="Install"
                title="Website install package"
                description="Copy the snippet or prepare a platform-specific package."
                right={
                  <span
                    className={cx(
                      "inline-flex h-8 items-center rounded-[9px] border px-3 text-[12px] font-semibold",
                      toneSurfaceClass(installTone)
                    )}
                  >
                    {installState}
                  </span>
                }
              />

              <div className="mt-5 space-y-5">
                <Feedback
                  success={handoffMessage}
                  error={handoffError}
                  info={handoffWarning || installBlockMessage || installHandoffMessage}
                />

                <div className="grid grid-cols-3 gap-2">
                  <ActionButton
                    icon={<Code2 className="h-4 w-4" strokeWidth={2.1} />}
                    onClick={handlePrepareDeveloperInstall}
                    disabled={!developerHandoffReady || statusQuery.isLoading || handoffBusy}
                    className="w-full"
                  >
                    Developer
                  </ActionButton>

                  <ActionButton
                    icon={<Globe2 className="h-4 w-4" strokeWidth={2.1} />}
                    onClick={handlePrepareGtmInstall}
                    disabled={!gtmHandoffReady || statusQuery.isLoading || handoffBusy}
                    className="w-full"
                  >
                    GTM
                  </ActionButton>

                  <ActionButton
                    icon={<Package className="h-4 w-4" strokeWidth={2.1} />}
                    onClick={handlePrepareWordpressInstall}
                    disabled={
                      !wordpressHandoffReady || statusQuery.isLoading || handoffBusy
                    }
                    className="w-full"
                  >
                    WordPress
                  </ActionButton>
                </div>

                <div className="rounded-[12px] border border-line-soft bg-surface-subtle p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
                      {packageAvailable ? "Package" : "Snippet"}
                    </div>

                    <button
                      type="button"
                      disabled={packageAvailable ? !s(handoffSurface.packageText) : !snippetAvailable}
                      onClick={
                        packageAvailable ? handleCopyHandoffPackage : handleCopySnippet
                      }
                      className="inline-flex h-8 items-center gap-2 rounded-[9px] border border-line bg-surface px-3 text-[12px] font-semibold text-text-muted transition-colors hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Copy className="h-3.5 w-3.5" strokeWidth={2.1} />
                      Copy
                    </button>
                  </div>

                  <pre className="max-h-[280px] overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-line bg-surface p-3 text-[11.5px] font-semibold leading-5 text-text-muted">
                    {packageAvailable
                      ? handoffSurface.packageText
                      : s(install.embedSnippet) || "Install snippet is not available yet."}
                  </pre>
                </div>

                <div className="rounded-[12px] border border-line-soft bg-surface-subtle px-4">
                  <LedgerLine
                    label="Type"
                    value={s(handoffSurface.packageType) || "Snippet"}
                  />
                  <LedgerLine
                    label="Ready"
                    value={productionInstallReady ? "Yes" : "No"}
                    tone={productionInstallReady ? "success" : "warning"}
                  />
                  <LedgerLine
                    label="Mode"
                    value={handoffTestingOnly ? "Testing only" : "Production"}
                    tone={handoffTestingOnly ? "warning" : "success"}
                  />
                  <LedgerLine
                    label="Domain"
                    value={verificationTargetDomain || suggestedVerificationDomain}
                  />
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <footer className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-t border-line-soft bg-surface px-7 py-4">
        {renderFooter()}
      </footer>
    </aside>
  );
}