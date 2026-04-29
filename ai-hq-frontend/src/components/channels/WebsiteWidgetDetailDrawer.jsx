import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
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
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
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
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
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

function toneTextClass(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "brand" || tone === "info") return "text-brand";
  return "text-text-muted";
}

function dotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand" || tone === "info") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

function normalizedTone(tone = "neutral") {
  if (tone === "success") return "success";
  if (tone === "warning" || tone === "warn") return "warning";
  if (tone === "danger") return "danger";
  if (tone === "brand" || tone === "info") return "brand";
  return "neutral";
}

function StatusBadge({ tone = "neutral", children }) {
  const safeTone = normalizedTone(tone);

  return (
    <Badge tone={safeTone} size="sm">
      <span className={cx("h-1.5 w-1.5 rounded-full", dotClass(safeTone))} />
      {children}
    </Badge>
  );
}

function Feedback({ success, error, info }) {
  if (error) return <InlineNotice tone="danger" description={error} compact />;
  if (success) return <InlineNotice tone="success" description={success} compact />;
  if (info) return <InlineNotice tone="info" description={info} compact />;

  return null;
}

function FieldLabel({ children }) {
  return (
    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
      {children}
    </label>
  );
}

function LedgerLine({ label, value, tone = "neutral" }) {
  return (
    <div className="grid grid-cols-[128px_minmax(0,1fr)] items-center gap-4 border-b border-line-soft py-3 last:border-b-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {label}
      </div>

      <div
        title={s(value)}
        className={cx(
          "min-w-0 truncate text-[13.5px] font-semibold tracking-[var(--tracking-tight-sm)]",
          toneTextClass(tone)
        )}
      >
        {value || "Not set"}
      </div>
    </div>
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
        "group grid w-full grid-cols-[36px_minmax(0,1fr)] items-center gap-3 border-b border-line-soft py-4 text-left last:border-b-0",
        "transition-[background-color,opacity] duration-base ease-premium hover:bg-surface-subtle/70",
        disabled && "cursor-not-allowed opacity-45 hover:bg-transparent"
      )}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-line-soft bg-surface text-text-muted shadow-[var(--shadow-inset-top)] transition-colors duration-base ease-premium group-hover:text-text">
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] font-medium text-text-muted">
          {description}
        </span>
      </span>
    </button>
  );
}

function SectionCard({ eyebrow, title, description, children, tone = "neutral" }) {
  return (
    <Card padded="md" tone={tone}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
              {eyebrow}
            </div>
          ) : null}

          {title ? (
            <div className="mt-1 text-[18px] font-semibold leading-6 tracking-[var(--tracking-tight-lg)] text-text">
              {title}
            </div>
          ) : null}

          {description ? (
            <div className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
              {description}
            </div>
          ) : null}
        </div>
      </div>

      {children ? (
        <div className={title || description || eyebrow ? "mt-4" : ""}>
          {children}
        </div>
      ) : null}
    </Card>
  );
}

function PanelTab({ active = false, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex h-9 items-center gap-2 rounded-[11px] px-3 text-[12.5px] font-semibold",
        "transition-[background-color,color,box-shadow] duration-base ease-premium",
        active
          ? "bg-surface text-text shadow-[var(--shadow-inset-top),0_12px_28px_-26px_rgba(15,23,42,0.22)]"
          : "text-text-muted hover:bg-surface-subtle hover:text-text"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function CodeBox({ value = "", empty = "Nothing to show yet." }) {
  const safe = s(value);

  return (
    <pre className="max-h-[280px] overflow-auto rounded-[16px] border border-line-soft bg-[#0F172A] px-4 py-4 text-[12px] font-medium leading-6 text-white/88 [scrollbar-width:thin]">
      {safe || empty}
    </pre>
  );
}

function AccentOption({ option, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.value)}
      className={cx(
        "flex h-10 items-center justify-between gap-3 rounded-[12px] border px-3 text-[12.5px] font-semibold transition-[background-color,border-color] duration-base ease-premium",
        selected
          ? "border-[rgba(var(--color-brand),0.24)] bg-brand-soft text-brand"
          : "border-line-soft bg-surface text-text-muted hover:bg-surface-subtle hover:text-text"
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className="h-3.5 w-3.5 rounded-full border border-white shadow-[0_0_0_1px_rgba(15,23,42,0.08)]"
          style={{ backgroundColor: option.preview }}
        />
        {option.label}
      </span>

      {selected ? <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> : null}
    </button>
  );
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
  const activeTone = normalizedTone(posture.tone);

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

  function renderFooterActions() {
    if (activePanel === "settings") {
      return (
        <>
          <Button
            type="button"
            fullWidth
            loading={saveMutation.isPending}
            disabled={!saveAllowed || saveMutation.isPending}
            onClick={handleSave}
            leftIcon={<Save className="h-4 w-4" strokeWidth={2.1} />}
          >
            {saveMutation.isPending ? "Saving" : "Save changes"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setActivePanel("overview")}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={statusQuery.isFetching}
            onClick={handleRefresh}
            leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
          >
            Refresh
          </Button>
        </>
      );
    }

    if (activePanel === "verify") {
      return (
        <>
          <Button
            type="button"
            fullWidth
            loading={checkVerificationMutation.isPending}
            disabled={!saveAllowed || statusQuery.isLoading || verificationBusy}
            onClick={handleVerifyNow}
          >
            Verify
          </Button>

          <Button
            type="button"
            variant="secondary"
            loading={createChallengeMutation.isPending}
            disabled={!saveAllowed || statusQuery.isLoading || verificationBusy}
            onClick={handleCreateChallenge}
          >
            Create TXT
          </Button>

          <Button
            type="button"
            variant="secondary"
            loading={refreshVerificationMutation.isPending}
            disabled={statusQuery.isLoading || verificationBusy}
            onClick={handleRefreshVerification}
            leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
          >
            Refresh
          </Button>
        </>
      );
    }

    if (activePanel === "install") {
      return (
        <>
          {packageAvailable ? (
            <Button
              type="button"
              fullWidth
              onClick={handleCopyHandoffPackage}
              leftIcon={<Copy className="h-4 w-4" strokeWidth={2.1} />}
            >
              Copy package
            </Button>
          ) : (
            <Button
              type="button"
              fullWidth
              disabled={!snippetAvailable}
              onClick={handleCopySnippet}
              leftIcon={<Copy className="h-4 w-4" strokeWidth={2.1} />}
            >
              Copy snippet
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            loading={handoffMutation.isPending}
            disabled={!developerHandoffReady || statusQuery.isLoading || handoffBusy}
            onClick={handlePrepareDeveloperInstall}
            leftIcon={<Package className="h-4 w-4" strokeWidth={2.1} />}
          >
            Package
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={statusQuery.isFetching}
            onClick={handleRefresh}
            leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
          >
            Refresh
          </Button>
        </>
      );
    }

    return (
      <>
        <Button
          type="button"
          fullWidth
          disabled={!snippetAvailable}
          onClick={handleCopySnippet}
          leftIcon={<Copy className="h-4 w-4" strokeWidth={2.1} />}
        >
          Copy snippet
        </Button>

        <Button
          type="button"
          variant="secondary"
          onClick={() => setActivePanel("settings")}
          leftIcon={<Settings2 className="h-4 w-4" strokeWidth={2.1} />}
        >
          Change
        </Button>

        <Button
          type="button"
          variant="secondary"
          disabled={statusQuery.isFetching}
          onClick={handleRefresh}
          leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
        >
          Refresh
        </Button>
      </>
    );
  }

  return (
    <aside
      aria-hidden={!open}
      className="flex h-full min-h-0 w-full flex-col border-l border-line-soft bg-surface shadow-panel"
    >
      <header className="relative z-20 shrink-0 border-b border-line-soft bg-surface px-6 py-5 shadow-[inset_0_-1px_0_rgba(15,23,42,0.025)]">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2">
          <div className="row-span-2 shrink-0 pt-0.5">
            <ChannelIcon channel={channel} size="lg" />
          </div>

          <div className="min-w-0 self-center">
            <h2 className="truncate text-[24px] font-semibold leading-7 tracking-[var(--tracking-tight-xl)] text-text">
              {channel?.name || "Website chat"}
            </h2>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Close channel details"
            onClick={handleClose}
            className="row-span-2 !h-9 !w-9"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </Button>

          <div className="min-w-0 self-start">
            <StatusBadge tone={widget.enabled === true ? "success" : "neutral"}>
              {widget.enabled === true ? "Connected" : "Disabled"}
            </StatusBadge>
          </div>
        </div>
      </header>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto bg-surface-muted px-6 py-6">
        <div className="space-y-4">
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
            <SectionCard eyebrow="Loading" title="Loading website chat">
              <div className="text-[13.5px] font-medium leading-6 text-text-muted">
                Checking widget settings, install posture, and domain verification.
              </div>
            </SectionCard>
          ) : null}

          <div className="flex flex-wrap gap-2 rounded-[16px] border border-line-soft bg-surface p-1.5">
            <PanelTab
              active={activePanel === "overview"}
              onClick={() => setActivePanel("overview")}
              icon={<Globe2 className="h-4 w-4" strokeWidth={2.05} />}
              label="Overview"
            />
            <PanelTab
              active={activePanel === "settings"}
              onClick={() => setActivePanel("settings")}
              icon={<Settings2 className="h-4 w-4" strokeWidth={2.05} />}
              label="Settings"
            />
            <PanelTab
              active={activePanel === "verify"}
              onClick={() => setActivePanel("verify")}
              icon={<ShieldAlert className="h-4 w-4" strokeWidth={2.05} />}
              label="Verify"
            />
            <PanelTab
              active={activePanel === "install"}
              onClick={() => setActivePanel("install")}
              icon={<Code2 className="h-4 w-4" strokeWidth={2.05} />}
              label="Install"
            />
          </div>

          {activePanel === "overview" ? (
            <>
              <Card padded="md" tone={activeTone}>
                <div className="flex items-start gap-4">
                  <span
                    className={cx(
                      "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border bg-surface shadow-[var(--shadow-inset-top)]",
                      activeTone === "success"
                        ? "border-[rgba(var(--color-success),0.18)] text-success"
                        : activeTone === "danger"
                          ? "border-[rgba(var(--color-danger),0.18)] text-danger"
                          : "border-[rgba(var(--color-warning),0.18)] text-warning"
                    )}
                  >
                    <PostureIcon className="h-5 w-5" strokeWidth={2.05} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                          {posture.title}
                        </div>

                        <div className="mt-1 text-[13.5px] font-medium leading-6 text-text-muted">
                          {posture.summary}
                        </div>
                      </div>

                      <StatusBadge tone={posture.tone}>{posture.next}</StatusBadge>
                    </div>
                  </div>
                </div>
              </Card>

              <SectionCard eyebrow="Widget ledger" title="Current configuration">
                <LedgerLine label="Widget ID" value={compactValue(widget.publicWidgetId)} />
                <LedgerLine label="Title" value={widget.title || "Not set"} />
                <LedgerLine label="Subtitle" value={widget.subtitle || "Not set"} />
                <LedgerLine
                  label="Accent"
                  value={widget.accentColor || "Not set"}
                  tone="brand"
                />
                <LedgerLine
                  label="Origins"
                  value={
                    arr(widget.allowedOrigins).length
                      ? `${arr(widget.allowedOrigins).length} set`
                      : "Not set"
                  }
                />
                <LedgerLine
                  label="Domains"
                  value={
                    arr(widget.allowedDomains).length
                      ? `${arr(widget.allowedDomains).length} set`
                      : "Not set"
                  }
                />
                <LedgerLine
                  label="Updated"
                  value={formatTimestamp(widget.updatedAt || payload.updatedAt)}
                />
              </SectionCard>

              <SectionCard eyebrow="Actions" title="Next best actions">
                <UtilityButton
                  title="Change widget settings"
                  description="Title, subtitle, accent, origins, and prompts"
                  icon={<Settings2 className="h-4 w-4" strokeWidth={2.05} />}
                  onClick={() => setActivePanel("settings")}
                />
                <UtilityButton
                  title="Verify domain"
                  description="Create or check the DNS TXT challenge"
                  icon={<ShieldAlert className="h-4 w-4" strokeWidth={2.05} />}
                  onClick={() => setActivePanel("verify")}
                />
                <UtilityButton
                  title="Prepare install package"
                  description={installHandoffMessage}
                  icon={<Package className="h-4 w-4" strokeWidth={2.05} />}
                  onClick={() => setActivePanel("install")}
                />
              </SectionCard>

              {blockers.length ? (
                <SectionCard tone="warning" eyebrow="Blockers" title="Needs attention">
                  <div className="space-y-3">
                    {blockers.map((item, index) => (
                      <Card
                        key={`${s(item.reasonCode || item.title || "blocker")}-${index}`}
                        padded="sm"
                        variant="subtle"
                        tone="warning"
                      >
                        <div className="text-[13.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
                          {s(item.title, "Runtime blocker")}
                        </div>
                        <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
                          {s(
                            item.subtitle || item.message || item.description,
                            "Review this blocker before treating the widget as ready."
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </SectionCard>
              ) : null}
            </>
          ) : null}

          {activePanel === "settings" ? (
            <SectionCard
              eyebrow="Settings"
              title="Widget configuration"
              description="Keep this small and controlled. Public install should only happen after allowed domains and verification are clean."
            >
              <div className="space-y-5">
                <label className="flex items-center justify-between gap-4 rounded-[15px] border border-line-soft bg-surface-muted px-4 py-3">
                  <span>
                    <span className="block text-[13.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
                      Enable widget
                    </span>
                    <span className="mt-1 block text-[12.5px] font-medium leading-5 text-text-muted">
                      Allows the website chat configuration to be used.
                    </span>
                  </span>

                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        enabled: event.target.checked,
                      }))
                    }
                    className="h-5 w-5 accent-[rgb(var(--color-brand))]"
                  />
                </label>

                <div>
                  <FieldLabel>Widget title</FieldLabel>
                  <Input
                    value={form.title}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Ask us anything"
                    appearance="quiet"
                  />
                </div>

                <div>
                  <FieldLabel>Widget subtitle</FieldLabel>
                  <Input
                    value={form.subtitle}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        subtitle: event.target.value,
                      }))
                    }
                    placeholder="We usually reply in a few minutes"
                    appearance="quiet"
                  />
                </div>

                <div>
                  <FieldLabel>Accent color</FieldLabel>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ACCENT_OPTIONS.map((option) => (
                      <AccentOption
                        key={option.value}
                        option={option}
                        selected={
                          s(form.accentColor).toLowerCase() ===
                          option.value.toLowerCase()
                        }
                        onSelect={(value) =>
                          updateForm((current) => ({
                            ...current,
                            accentColor: value,
                          }))
                        }
                      />
                    ))}
                  </div>
                </div>

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
                    placeholder="https://example.com"
                    rows={3}
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
                    placeholder="example.com"
                    rows={3}
                  />
                </div>

                <div>
                  <FieldLabel>Initial prompts</FieldLabel>
                  <Textarea
                    value={form.initialPrompts}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        initialPrompts: event.target.value,
                      }))
                    }
                    placeholder="How can I book?\nWhat services do you offer?"
                    rows={4}
                  />
                </div>
              </div>
            </SectionCard>
          ) : null}

          {activePanel === "verify" ? (
            <>
              <SectionCard
                eyebrow="Domain verification"
                title="Verify website ownership"
                description="Create a DNS TXT challenge, add it to the domain, then check verification."
                tone={verified ? "success" : "warning"}
              >
                <div className="space-y-4">
                  <div>
                    <FieldLabel>Domain</FieldLabel>
                    <Input
                      value={verificationInputValue}
                      onChange={(event) => setVerificationInput(event.target.value)}
                      placeholder="example.com"
                      appearance="quiet"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Card padded="sm" variant="subtle">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                        State
                      </div>
                      <div className="mt-2">
                        <StatusBadge tone={verified ? "success" : "warning"}>
                          {verificationStateLabel(verificationSurface.state)}
                        </StatusBadge>
                      </div>
                    </Card>

                    <Card padded="sm" variant="subtle">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                        Last checked
                      </div>
                      <div className="mt-2 text-[13.5px] font-semibold text-text">
                        {formatTimestamp(
                          verificationSurface.checkedAt ||
                            verificationSurface.updatedAt ||
                            verificationSurface.createdAt
                        )}
                      </div>
                    </Card>
                  </div>

                  {verificationMessage ? (
                    <InlineNotice tone="success" description={verificationMessage} compact />
                  ) : null}

                  {verificationError ? (
                    <InlineNotice tone="danger" description={verificationError} compact />
                  ) : null}

                  {verificationSurface.message ? (
                    <InlineNotice
                      tone={verified ? "success" : "warning"}
                      description={verificationSurface.message}
                      compact
                    />
                  ) : null}
                </div>
              </SectionCard>

              <SectionCard eyebrow="DNS TXT" title="Challenge record">
                <LedgerLine
                  label="Name"
                  value={
                    verificationChallenge.name ||
                    verificationChallenge.recordName ||
                    verificationChallenge.host ||
                    "Not available"
                  }
                />
                <LedgerLine
                  label="Value"
                  value={
                    verificationChallenge.value ||
                    verificationChallenge.recordValue ||
                    verificationChallenge.txtValue ||
                    "Not available"
                  }
                />
                <LedgerLine
                  label="Type"
                  value={verificationChallenge.type || "TXT"}
                />

                {verificationCandidateDomains.length ? (
                  <div className="mt-4">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                      Candidate domains
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {verificationCandidateDomains.map((domain) => (
                        <Badge key={domain} tone="neutral" size="sm">
                          {domain}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </SectionCard>
            </>
          ) : null}

          {activePanel === "install" ? (
            <>
              <SectionCard
                eyebrow="Install"
                title="Website install package"
                description={
                  productionInstallBlocked
                    ? installBlockMessage || "Production install is blocked."
                    : "Prepare a snippet or handoff package for the website."
                }
                tone={installTone}
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <Card padded="sm" variant="subtle">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                      State
                    </div>
                    <div className="mt-2">
                      <StatusBadge tone={installTone}>{installState}</StatusBadge>
                    </div>
                  </Card>

                  <Card padded="sm" variant="subtle">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                      Snippet
                    </div>
                    <div className="mt-2 text-[13.5px] font-semibold text-text">
                      {snippetAvailable ? "Available" : "Not available"}
                    </div>
                  </Card>

                  <Card padded="sm" variant="subtle">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                      Package
                    </div>
                    <div className="mt-2 text-[13.5px] font-semibold text-text">
                      {packageAvailable ? "Prepared" : "Not prepared"}
                    </div>
                  </Card>
                </div>

                {handoffMessage ? (
                  <div className="mt-4">
                    <InlineNotice tone="success" description={handoffMessage} compact />
                  </div>
                ) : null}

                {handoffWarning ? (
                  <div className="mt-4">
                    <InlineNotice tone="warning" description={handoffWarning} compact />
                  </div>
                ) : null}

                {handoffError ? (
                  <div className="mt-4">
                    <InlineNotice tone="danger" description={handoffError} compact />
                  </div>
                ) : null}
              </SectionCard>

              <SectionCard eyebrow="Prepare" title="Handoff options">
                <UtilityButton
                  title="Developer package"
                  description={installHandoffMessage}
                  disabled={!developerHandoffReady || statusQuery.isLoading || handoffBusy}
                  onClick={handlePrepareDeveloperInstall}
                  icon={<Package className="h-4 w-4" strokeWidth={2.05} />}
                />
                <UtilityButton
                  title="Google Tag Manager"
                  description={launchGtmHandoff.message || "Prepare a GTM-ready package."}
                  disabled={!gtmHandoffReady || statusQuery.isLoading || handoffBusy}
                  onClick={handlePrepareGtmInstall}
                  icon={<Code2 className="h-4 w-4" strokeWidth={2.05} />}
                />
                <UtilityButton
                  title="WordPress"
                  description={launchWordpressHandoff.message || "Prepare a WordPress-ready package."}
                  disabled={!wordpressHandoffReady || statusQuery.isLoading || handoffBusy}
                  onClick={handlePrepareWordpressInstall}
                  icon={<Globe2 className="h-4 w-4" strokeWidth={2.05} />}
                />
              </SectionCard>

              <SectionCard eyebrow="Snippet" title="Embed code">
                <CodeBox value={packageAvailable ? handoffSurface.packageText : install.embedSnippet} />
              </SectionCard>
            </>
          ) : null}
        </div>
      </div>

      <footer className="shrink-0 border-t border-line-soft bg-surface px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          {renderFooterActions()}
        </div>
      </footer>
    </aside>
  );
}