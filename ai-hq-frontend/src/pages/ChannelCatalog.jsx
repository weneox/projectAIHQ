import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe2,
  Instagram,
  Mail,
  MessageCircle,
  Package,
  Plug,
  RefreshCw,
  Send,
  ShieldAlert,
  Smartphone,
} from "lucide-react";

import {
  checkWebsiteDomainVerification,
  connectTelegramChannel,
  createWebsiteDomainVerificationChallenge,
  createWebsiteWidgetGtmInstallHandoff,
  createWebsiteWidgetInstallHandoff,
  createWebsiteWidgetTestMessage,
  createWebsiteWidgetWordpressInstallHandoff,
  disconnectMetaChannel,
  disconnectTelegramChannel,
  getMetaChannelStatus,
  getMetaConnectUrl,
  getTelegramChannelStatus,
  getWebsiteDomainVerificationStatus,
  getWebsiteWidgetStatus,
  saveWebsiteWidgetConfig,
  selectMetaChannelCandidate,
} from "../api/channelConnect.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import AppTag from "../components/ui/AppTag.jsx";
import AppModal, {
  AppModalBody,
  AppModalCloseButton,
  AppModalFooter,
  AppModalHeader,
} from "../components/ui/AppModal.jsx";
import { PageCanvas, PageHeader } from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

const BASE_CHANNELS = [
  {
    id: "website-chat",
    backendKey: "website",
    name: "Website Chat",
    type: "Website",
    status: "not connected",
    health: "disabled",
    icon: Globe2,
    description: "Capture website visitors and route conversations into Inbox.",
    setupNote: "Website chat status, config, domain verification, install packages, and setup test messages are loaded from backend.",
    connects: ["Website widget", "Inbox routing", "Lead capture"],
    requirements: ["Website domain", "Widget installation", "Workspace inbox"],
  },
  {
    id: "instagram",
    backendKey: "instagram",
    name: "Instagram",
    type: "Social",
    status: "not connected",
    health: "disabled",
    icon: Instagram,
    description: "Connect Instagram DMs and qualify social conversations.",
    setupNote: "Instagram status, Meta OAuth redirect, pending account selection, reconnect, and disconnect are loaded from backend.",
    connects: ["Instagram DMs", "Conversation history", "Lead qualification"],
    requirements: ["Instagram Business account", "Meta permission", "Connected page"],
  },
  {
    id: "facebook",
    backendKey: "",
    name: "Facebook",
    type: "Social",
    status: "not connected",
    health: "disabled",
    icon: MessageCircle,
    description: "Facebook page messaging is not mounted as a separate live backend connector yet.",
    setupNote: "This channel is visible as roadmap only. No live backend action is exposed here.",
    connects: ["Future Meta surface", "Inbox routing", "Customer handoff"],
    requirements: ["Facebook page", "Meta permission", "Backend connector"],
  },
  {
    id: "telegram",
    backendKey: "telegram",
    name: "Telegram",
    type: "Messaging",
    status: "not connected",
    health: "disabled",
    icon: Send,
    description: "Route Telegram conversations into your workspace inbox.",
    setupNote: "Telegram status, bot token connect, webhook/runtime readiness, and disconnect are loaded from backend.",
    connects: ["Telegram bot", "Inbox routing", "Message automation"],
    requirements: ["Telegram bot token", "Workspace routing", "Webhook access"],
  },
  {
    id: "whatsapp",
    backendKey: "",
    name: "WhatsApp",
    type: "Messaging",
    status: "not connected",
    health: "disabled",
    icon: Smartphone,
    description: "WhatsApp Business is not mounted as a live backend connector on this screen yet.",
    setupNote: "This channel is visible as roadmap only. No live backend action is exposed here.",
    connects: ["WhatsApp Business", "Customer conversations", "Inbox routing"],
    requirements: ["WhatsApp Business account", "Meta business verification", "Phone number"],
  },
  {
    id: "email",
    backendKey: "",
    name: "Email",
    type: "Email",
    status: "not connected",
    health: "disabled",
    icon: Mail,
    description: "Email is not mounted as a live backend connector on this screen yet.",
    setupNote: "This channel is visible as roadmap only. No live backend action is exposed here.",
    connects: ["Outbound email", "Follow-up messages", "Customer handoff"],
    requirements: ["Sender address", "Domain verification", "Email provider access"],
  },
];

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function bool(...values) {
  return values.some(
    (value) => value === true || value === "true" || value === 1
  );
}

function titleize(value = "") {
  return s(value || "unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function firstText(...values) {
  for (const value of values) {
    const next = s(value);
    if (next) return next;
  }

  return "";
}

function parseLines(value = "") {
  return String(value || "")
    .split(/[,\n]/)
    .map((item) => s(item))
    .filter(Boolean);
}

function listToText(value) {
  return arr(value)
    .map((item) => s(item))
    .filter(Boolean)
    .join("\n");
}

function formatBoolean(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}

function formatTimestamp(value = "") {
  const raw = s(value);
  if (!raw) return "Not available";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleString();
}

function readReadiness(payload = {}) {
  const source = obj(payload);

  return obj(
    source.readiness ||
      source.launchReadiness ||
      source.runtime ||
      source.install?.launchReadiness
  );
}

function readBlockers(payload = {}) {
  const source = obj(payload);
  const readiness = readReadiness(source);
  const launchReadiness = obj(source.launchReadiness || source.install?.launchReadiness);

  return [
    ...arr(source.blockers),
    ...arr(readiness.blockers),
    ...arr(launchReadiness.blockers),
  ].filter(Boolean);
}

function normalizeBackendChannelStatus(payload = {}) {
  const source = obj(payload);
  const readiness = readReadiness(source);
  const account = obj(source.account);
  const widget = obj(source.widget);
  const runtime = obj(source.runtime);
  const launchReadiness = obj(source.launchReadiness || source.install?.launchReadiness);
  const pendingSelection = obj(source.pendingSelection);

  const state = lower(
    firstText(
      source.state,
      source.status,
      source.channel?.state,
      source.channel?.status,
      readiness.status,
      launchReadiness.status
    )
  );

  const connected = bool(
    source.connected,
    source.isConnected,
    source.configured,
    source.enabled,
    source.channel?.connected,
    account.connected,
    widget.enabled && s(widget.publicWidgetId),
    state === "connected"
  );

  const deliveryReady = bool(
    source.deliveryReady,
    source.productionReady,
    source.launchReady,
    runtime.deliveryReady,
    runtime.webhookReady,
    launchReadiness.deliveryReady,
    launchReadiness.productionReady,
    launchReadiness.productionLaunchAllowed,
    readiness.ready,
    readiness.status === "ready"
  );

  const unavailable = [
    state,
    lower(readiness.status),
    lower(launchReadiness.status),
  ].some((value) =>
    ["unavailable", "disabled", "not_available", "not available"].includes(value)
  );

  const blocked = [
    state,
    lower(readiness.status),
    lower(launchReadiness.status),
  ].some((value) =>
    [
      "blocked",
      "error",
      "failed",
      "reconnect_required",
      "deauthorized",
      "connected_blocked",
    ].includes(value)
  );

  const pending = [
    state,
    lower(readiness.status),
    lower(launchReadiness.status),
  ].some((value) =>
    [
      "pending",
      "connecting",
      "needs_setup",
      "needs setup",
      "action_required",
      "testing_only",
      "review",
    ].includes(value)
  );

  if (deliveryReady) {
    return {
      status: "connected",
      health: "ready",
      connected: true,
      deliveryReady: true,
      backendStatus: state || "ready",
    };
  }

  if (connected) {
    return {
      status: "connected",
      health: blocked ? "action required" : "ready",
      connected: true,
      deliveryReady: false,
      backendStatus: state || "connected",
    };
  }

  if (pendingSelection.required === true || pending || blocked) {
    return {
      status: "pending",
      health: "action required",
      connected: false,
      deliveryReady: false,
      backendStatus: state || "pending",
    };
  }

  if (unavailable) {
    return {
      status: "not connected",
      health: "unavailable",
      connected: false,
      deliveryReady: false,
      backendStatus: state || "unavailable",
    };
  }

  return {
    status: "not connected",
    health: "disabled",
    connected: false,
    deliveryReady: false,
    backendStatus: state || "not_connected",
  };
}


async function safeStatus(loader) {
  try {
    const payload = await loader();
    const normalized = normalizeBackendChannelStatus(payload);

    return {
      ok: true,
      error: "",
      payload: obj(payload),
      ...normalized,
    };
  } catch (error) {
    const payload = obj(error?.payload);
    const code = lower(error?.code || payload.code || payload.error);
    const surface = lower(payload.surface);

    if (code === "surface_frozen") {
      return {
        ok: true,
        status: "not connected",
        health: "disabled",
        connected: false,
        deliveryReady: false,
        backendStatus: surface ? `${surface}_surface_frozen` : "surface_frozen",
        error: "",
        payload,
      };
    }

    return {
      ok: false,
      status: "not connected",
      health: "unavailable",
      connected: false,
      deliveryReady: false,
      backendStatus: "unavailable",
      error:
        s(payload.error || payload.message || error?.message) ||
        "Channel status unavailable.",
      payload,
    };
  }
}

function mergeChannel(base = {}, remoteByKey = {}) {
  if (!base.backendKey) {
    return {
      ...base,
      backendOk: true,
      backendBound: false,
      connected: false,
      deliveryReady: false,
      backendStatus: "not_mounted",
      backendError: "",
      payload: null,
    };
  }

  const remote = obj(remoteByKey[base.backendKey]);

  return {
    ...base,
    status: s(remote.status, base.status),
    health: s(remote.health, base.health),
    connected: remote.connected === true,
    deliveryReady: remote.deliveryReady === true,
    backendStatus: s(remote.backendStatus),
    backendOk: remote.ok !== false,
    backendBound: true,
    backendError: s(remote.error),
    payload: remote.payload || null,
  };
}

function actionLabel(channel = {}) {
  const status = lower(channel.status);

  if (!channel.backendBound) return "Roadmap";
  if (status === "connected") return "Manage";
  if (status === "pending") return "Continue";

  return "Connect";
}

function actionVariant(channel = {}) {
  return lower(channel.status) === "connected" ? "secondary" : "primary";
}

function statusTone(status = "") {
  const safe = lower(status);

  if (safe === "connected") return "success";
  if (safe === "pending") return "warning";

  return "neutral";
}

function healthSignal(channel = {}) {
  const status = lower(channel.status);
  const health = lower(channel.health);

  if (status === "connected" && health === "ready") {
    return {
      icon: CheckCircle2,
      label: "Ready",
      tone: "success",
      className: "text-success",
    };
  }

  if (health === "action required") {
    return {
      icon: ShieldAlert,
      label: "Needs setup",
      tone: "warning",
      className: "text-warning",
    };
  }

  if (health === "unavailable") {
    return {
      icon: ShieldAlert,
      label: "Backend unavailable",
      tone: "warning",
      className: "text-warning",
    };
  }

  if (status === "pending") {
    return {
      icon: ShieldAlert,
      label: "Setup paused",
      tone: "warning",
      className: "text-warning",
    };
  }

  return {
    icon: Plug,
    label: channel.backendBound ? "Not connected" : "Not mounted",
    tone: "neutral",
    className: "text-text-muted",
  };
}

function backendReasonCode(channel = {}) {
  const payload = obj(channel.payload);
  const readiness = readReadiness(payload);
  const runtime = obj(payload.runtime);
  const launchReadiness = obj(payload.launchReadiness || payload.install?.launchReadiness);

  return lower(
    firstText(
      payload.reasonCode,
      payload.code,
      payload.error,
      readiness.reasonCode,
      launchReadiness.reasonCode,
      runtime.reasonCode
    )
  );
}

function isPlanRestricted(channel = {}) {
  return backendReasonCode(channel) === "plan_capability_restricted";
}

function backendFacts(channel = {}) {
  const payload = obj(channel.payload);
  const readiness = readReadiness(payload);
  const runtime = obj(payload.runtime);
  const account = obj(payload.account);
  const widget = obj(payload.widget);
  const launchReadiness = obj(payload.launchReadiness || payload.install?.launchReadiness);
  const pendingSelection = obj(payload.pendingSelection);
  const blockers = readBlockers(payload);

  const facts = [
    ["Backend mounted", channel.backendBound ? "Yes" : "No"],
    ["Backend request", channel.backendOk ? "OK" : "Failed"],
    ["Backend state", s(channel.backendStatus, "Not available")],
    ["Connected", formatBoolean(channel.connected)],
    ["Delivery ready", formatBoolean(channel.deliveryReady)],
  ];

  if (channel.backendError) facts.push(["Backend error", channel.backendError]);

  const readinessMessage = firstText(
    readiness.message,
    launchReadiness.message,
    payload.message
  );

  if (readinessMessage) facts.push(["Readiness", readinessMessage]);

  const reasonCode = firstText(
    payload.reasonCode,
    readiness.reasonCode,
    launchReadiness.reasonCode,
    runtime.reasonCode
  );

  if (reasonCode) facts.push(["Reason code", reasonCode]);

  const accountName = firstText(
    account.displayName,
    account.username,
    account.botUsername,
    account.targetDomain,
    payload.displayName
  );

  if (accountName) facts.push(["Account", accountName]);

  if (s(widget.publicWidgetId)) facts.push(["Widget ID", widget.publicWidgetId]);
  if (widget.enabled !== undefined) facts.push(["Widget enabled", formatBoolean(widget.enabled)]);
  if (pendingSelection.required === true) facts.push(["Pending selection", "Required"]);
  if (blockers.length) facts.push(["Blockers", `${blockers.length} blocker(s)`]);

  return facts;
}

function buildWebsiteInitialForm(channel = {}) {
  const payload = obj(channel.payload);
  const widget = obj(payload.widget || payload.widgetConfig);
  const launchReadiness = obj(payload.launchReadiness || payload.install?.launchReadiness);

  return {
    enabled: widget.enabled === true,
    title: s(widget.title, "Website chat"),
    subtitle: s(widget.subtitle, "Ask a question or leave a message for the team."),
    accentColor: s(widget.accentColor, "#0f172a"),
    websiteUrl: s(payload.websiteUrl || widget.websiteUrl || launchReadiness.targetDomain),
    allowedOrigins: listToText(widget.allowedOrigins),
    allowedDomains: listToText(widget.allowedDomains),
    initialPrompts: listToText(widget.initialPrompts),
  };
}

function buildWebsiteConfigPayload(form = {}) {
  return {
    enabled: form.enabled === true,
    title: s(form.title),
    subtitle: s(form.subtitle),
    accentColor: s(form.accentColor),
    websiteUrl: s(form.websiteUrl),
    allowedOrigins: parseLines(form.allowedOrigins),
    allowedDomains: parseLines(form.allowedDomains),
    initialPrompts: parseLines(form.initialPrompts),
  };
}

function initialWebsiteDomain(channel = {}) {
  const payload = obj(channel.payload);
  const domainVerification = obj(payload.domainVerification);
  const widget = obj(payload.widget);
  const launchReadiness = obj(payload.launchReadiness || payload.install?.launchReadiness);

  return firstText(
    domainVerification.domain,
    domainVerification.candidateDomain,
    launchReadiness.targetDomain,
    payload.websiteUrl,
    widget.allowedDomains?.[0],
    widget.allowedOrigins?.[0]
  );
}

function ActionNotice({ tone = "success", children }) {
  if (!children) return null;

  return (
    <div
      className={cx(
        "rounded-md border px-4 py-3 text-[13px] font-medium leading-5",
        tone === "danger"
          ? "border-danger/20 bg-danger/5 text-danger"
          : tone === "warning"
            ? "border-warning/25 bg-warning/5 text-warning"
            : "border-success/20 bg-success/5 text-success"
      )}
    >
      {children}
    </div>
  );
}

function InfoGrid({ title, rows = [] }) {
  const cleanRows = rows.filter((row) => s(row?.[1]));

  if (!cleanRows.length) return null;

  return (
    <div className="rounded-md border border-line-soft bg-surface-subtle p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {title}
      </div>

      <div className="mt-3 grid gap-2">
        {cleanRows.map(([label, value]) => (
          <div
            key={`${label}-${value}`}
            className="grid gap-2 border-b border-line-soft pb-2 last:border-b-0 last:pb-0 sm:grid-cols-[150px_minmax(0,1fr)]"
          >
            <div className="text-[12px] font-semibold text-text-muted">
              {label}
            </div>
            <div className="min-w-0 break-words text-[12.5px] font-medium leading-5 text-text">
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailList({ title, items = [] }) {
  return (
    <div className="rounded-md border border-line-soft bg-surface-subtle p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {title}
      </div>

      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2 text-[13px] font-medium text-text">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" strokeWidth={2.05} />
            <span className="min-w-0">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder = "", type = "text" }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-md border border-line-soft bg-white px-3 text-[13px] font-medium text-text outline-none transition-colors focus:border-brand"
      />
    </label>
  );
}

function TextAreaInput({ label, value, onChange, placeholder = "", rows = 3 }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="mt-2 w-full resize-y rounded-md border border-line-soft bg-white px-3 py-2 text-[13px] font-medium leading-5 text-text outline-none transition-colors focus:border-brand"
      />
    </label>
  );
}

function BackendFactGrid({ channel }) {
  return <InfoGrid title="Backend truth" rows={backendFacts(channel)} />;
}

function PackageOutput({ payload = {}, onCopy }) {
  const safePayload = obj(payload);
  const packageText = firstText(
    safePayload.packageText,
    safePayload.packageSnippet,
    safePayload.embedSnippet,
    safePayload.gtmCustomHtmlSnippet
  );

  if (!Object.keys(safePayload).length) return null;

  return (
    <div className="rounded-md border border-line-soft bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            Install package
          </div>
          <div className="mt-1 text-[14px] font-semibold text-text">
            {s(safePayload.packageTitle || safePayload.packageType, "Website install package")}
          </div>
        </div>

        {packageText ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onCopy(packageText)}
            leftIcon={<Copy className="h-3.5 w-3.5" strokeWidth={2.1} />}
          >
            Copy
          </Button>
        ) : null}
      </div>

      <InfoGrid
        title="Package readiness"
        rows={[
          ["Ready", formatBoolean(safePayload.ready)],
          ["Production ready", formatBoolean(safePayload.productionReady)],
          ["Testing only", formatBoolean(safePayload.testingOnly)],
          ["Target domain", s(safePayload.targetDomain)],
          ["Verification state", s(safePayload.verificationState)],
          ["Message", s(safePayload.message)],
        ]}
      />

      {arr(safePayload.instructions).length ? (
        <div className="mt-4 rounded-md border border-line-soft bg-surface-subtle p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            Instructions
          </div>
          <ol className="mt-3 grid gap-2 pl-4 text-[13px] font-medium leading-5 text-text">
            {arr(safePayload.instructions).map((item, index) => (
              <li key={`${item}-${index}`} className="list-decimal">
                {s(item)}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {packageText ? (
        <pre className="mt-4 max-h-[260px] overflow-auto rounded-md border border-line-soft bg-slate-950 p-4 text-[12px] leading-5 text-white">
          {packageText}
        </pre>
      ) : null}
    </div>
  );
}

function WebsitePanel({
  channel,
  busyAction,
  onWebsiteSave,
  onWebsiteDomainStatus,
  onWebsiteChallenge,
  onWebsiteCheck,
  onWebsiteHandoff,
  onWebsiteTest,
  onCopy,
}) {
  const [form, setForm] = useState(() => buildWebsiteInitialForm(channel));
  const [domain, setDomain] = useState(() => initialWebsiteDomain(channel));
  const [testText, setTestText] = useState("Salam, bu Website Chat test mesajıdır.");
  const [localMessage, setLocalMessage] = useState("");
  const [localError, setLocalError] = useState("");
  const [verificationPayload, setVerificationPayload] = useState(null);
  const [packagePayload, setPackagePayload] = useState(null);

  const payload = obj(channel.payload);
  const widget = obj(payload.widget);
  const launchReadiness = obj(payload.launchReadiness || payload.install?.launchReadiness);
  const domainVerification = obj(payload.domainVerification);

  async function runLocal(action, successMessage, setPayload = null) {
    setLocalMessage("");
    setLocalError("");

    try {
      const result = await action();
      if (setPayload) setPayload(obj(result));
      setLocalMessage(successMessage);
    } catch (error) {
      setLocalError(
        s(error?.payload?.error || error?.payload?.message || error?.message) ||
          "Backend action failed."
      );
    }
  }

  return (
    <div className="grid gap-4">
      <InfoGrid
        title="Website status"
        rows={[
          ["Widget enabled", formatBoolean(widget.enabled)],
          ["Public widget ID", s(widget.publicWidgetId)],
          ["Website URL", s(payload.websiteUrl)],
          ["Launch status", s(launchReadiness.status)],
          ["Production ready", formatBoolean(launchReadiness.productionReady || launchReadiness.productionLaunchAllowed)],
          ["Target domain", s(launchReadiness.targetDomain)],
          ["Domain state", s(domainVerification.state || launchReadiness.domainVerificationState)],
          ["Domain verified", formatBoolean(domainVerification.verified || launchReadiness.domainVerified)],
          ["Message", s(launchReadiness.message)],
        ]}
      />

      <ActionNotice>{localMessage}</ActionNotice>
      <ActionNotice tone="danger">{localError}</ActionNotice>

      {planRestricted ? (
        <ActionNotice tone="warning">
          Instagram connect is blocked by the current workspace plan. Backend returned plan_capability_restricted, so this button is intentionally disabled until the tenant plan/capability is upgraded internally.
        </ActionNotice>
      ) : null}

      <div className="rounded-md border border-line-soft bg-white p-4">
        <div className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            Widget configuration
          </div>
          <div className="mt-1 text-[13px] font-medium leading-5 text-text-muted">
            Saves directly to the backend webchat config endpoint.
          </div>
        </div>

        <div className="grid gap-4">
          <label className="flex items-center gap-3 rounded-md border border-line-soft bg-surface-subtle px-3 py-3">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) =>
                setForm((value) => ({ ...value, enabled: event.target.checked }))
              }
            />
            <span className="text-[13px] font-semibold text-text">
              Enable Website Chat
            </span>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="Title"
              value={form.title}
              onChange={(value) => setForm((next) => ({ ...next, title: value }))}
            />
            <TextInput
              label="Accent color"
              value={form.accentColor}
              onChange={(value) => setForm((next) => ({ ...next, accentColor: value }))}
              placeholder="#0f172a"
            />
          </div>

          <TextInput
            label="Subtitle"
            value={form.subtitle}
            onChange={(value) => setForm((next) => ({ ...next, subtitle: value }))}
          />

          <TextInput
            label="Website URL / target domain"
            value={form.websiteUrl}
            onChange={(value) => {
              setForm((next) => ({ ...next, websiteUrl: value }));
              setDomain(value);
            }}
            placeholder="https://example.com"
          />

          <div className="grid gap-4 md:grid-cols-2">
            <TextAreaInput
              label="Allowed origins"
              value={form.allowedOrigins}
              onChange={(value) => setForm((next) => ({ ...next, allowedOrigins: value }))}
              placeholder="https://example.com"
            />
            <TextAreaInput
              label="Allowed domains"
              value={form.allowedDomains}
              onChange={(value) => setForm((next) => ({ ...next, allowedDomains: value }))}
              placeholder="example.com"
            />
          </div>

          <TextAreaInput
            label="Initial prompts"
            value={form.initialPrompts}
            onChange={(value) => setForm((next) => ({ ...next, initialPrompts: value }))}
            placeholder="How can you help me?"
          />

          <div className="flex justify-end">
            <Button
              type="button"
              size="md"
              loading={busyAction === "website-save"}
              onClick={() =>
                runLocal(
                  () => onWebsiteSave(buildWebsiteConfigPayload(form)),
                  "Website Chat config saved. Status is refreshing."
                )
              }
            >
              Save config
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-line-soft bg-white p-4">
        <div className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            Domain verification
          </div>
          <div className="mt-1 text-[13px] font-medium leading-5 text-text-muted">
            Creates and checks the backend DNS TXT ownership challenge.
          </div>
        </div>

        <TextInput
          label="Domain"
          value={domain}
          onChange={setDomain}
          placeholder="example.com"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={busyAction === "website-domain-status"}
            onClick={() =>
              runLocal(
                () => onWebsiteDomainStatus(domain),
                "Domain verification status loaded.",
                setVerificationPayload
              )
            }
          >
            Load status
          </Button>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={busyAction === "website-domain-challenge"}
            onClick={() =>
              runLocal(
                () => onWebsiteChallenge(domain),
                "Domain verification challenge created.",
                setVerificationPayload
              )
            }
          >
            Create challenge
          </Button>

          <Button
            type="button"
            size="sm"
            loading={busyAction === "website-domain-check"}
            onClick={() =>
              runLocal(
                () => onWebsiteCheck(domain),
                "Domain verification check completed.",
                setVerificationPayload
              )
            }
          >
            Check domain
          </Button>
        </div>

        <InfoGrid
          title="Verification response"
          rows={[
            ["Domain", s(verificationPayload?.domain || verificationPayload?.candidateDomain)],
            ["State", s(verificationPayload?.state)],
            ["Verified", formatBoolean(verificationPayload?.verified)],
            ["TXT name", s(verificationPayload?.challenge?.txtName || verificationPayload?.txtName)],
            ["TXT value", s(verificationPayload?.challenge?.txtValue || verificationPayload?.txtValue)],
            ["Message", s(verificationPayload?.message)],
            ["Reason code", s(verificationPayload?.reasonCode)],
          ]}
        />
      </div>

      <div className="rounded-md border border-line-soft bg-white p-4">
        <div className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            Install handoffs
          </div>
          <div className="mt-1 text-[13px] font-medium leading-5 text-text-muted">
            Generates developer, GTM, or WordPress install package from backend.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={busyAction === "website-handoff-developer"}
            onClick={() =>
              runLocal(
                () => onWebsiteHandoff("developer", domain),
                "Developer install handoff generated.",
                setPackagePayload
              )
            }
            leftIcon={<Package className="h-3.5 w-3.5" strokeWidth={2.1} />}
          >
            Developer package
          </Button>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={busyAction === "website-handoff-gtm"}
            onClick={() =>
              runLocal(
                () => onWebsiteHandoff("gtm", domain),
                "GTM install handoff generated.",
                setPackagePayload
              )
            }
            leftIcon={<Package className="h-3.5 w-3.5" strokeWidth={2.1} />}
          >
            GTM package
          </Button>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={busyAction === "website-handoff-wordpress"}
            onClick={() =>
              runLocal(
                () => onWebsiteHandoff("wordpress", domain),
                "WordPress install package generated.",
                setPackagePayload
              )
            }
            leftIcon={<Package className="h-3.5 w-3.5" strokeWidth={2.1} />}
          >
            WordPress package
          </Button>
        </div>

        <PackageOutput payload={packagePayload} onCopy={onCopy} />
      </div>

      <div className="rounded-md border border-line-soft bg-white p-4">
        <div className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            Inbox setup test
          </div>
          <div className="mt-1 text-[13px] font-medium leading-5 text-text-muted">
            Creates a Website Chat setup-test message in Inbox.
          </div>
        </div>

        <TextAreaInput
          label="Test message"
          value={testText}
          onChange={setTestText}
          rows={2}
        />

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            size="md"
            loading={busyAction === "website-test-message"}
            onClick={() =>
              runLocal(
                () => onWebsiteTest(testText),
                "Website test message created. Open Inbox to verify it."
              )
            }
          >
            Send test message
          </Button>
        </div>
      </div>
    </div>
  );
}

function MetaPanel({
  channel,
  busyAction,
  onMetaConnect,
  onMetaDisconnect,
  onMetaSelect,
}) {
  const [localMessage, setLocalMessage] = useState("");
  const [localError, setLocalError] = useState("");

  const payload = obj(channel.payload);
  const account = obj(payload.account);
  const lifecycle = obj(payload.lifecycle);
  const runtime = obj(payload.runtime);
  const readiness = readReadiness(payload);
  const pendingSelection = obj(payload.pendingSelection);
  const review = obj(payload.review);
  const candidates = arr(pendingSelection.candidates);
  const blockers = readBlockers(payload);
  const connectDisabled = backendConnectDisabled(channel);
  const connectDisabledMessage = connectDisabled ? backendExactMessage(payload) : "";
const connectDisabled = backendConnectDisabled(channel);
  const connectDisabledMessage = connectDisabled ? backendExactMessage(payload) : "";
async function runLocal(action, successMessage) {
    setLocalMessage("");
    setLocalError("");

    try {
      await action();
      setLocalMessage(successMessage);
    } catch (error) {
      setLocalError(
        s(error?.payload?.error || error?.payload?.message || error?.message) ||
          "Meta backend action failed."
      );
    }
  }

  return (
    <div className="grid gap-4">
      <InfoGrid
        title="Instagram backend status"
        rows={[
          ["State", s(payload.state || channel.backendStatus)],
          ["Display", s(account.displayName)],
          ["Username", s(account.username)],
          ["Instagram user ID", s(account.igUserId)],
          ["Meta app user ID", s(account.metaUserId)],
          ["Webhook ready", formatBoolean(runtime.webhookReady)],
          ["Delivery ready", formatBoolean(runtime.deliveryReady)],
          ["Token status", s(lifecycle.userToken?.status)],
          ["Token expires", formatTimestamp(lifecycle.userToken?.expiresAt || lifecycle.userTokenExpiresAt)],
          ["Readiness", s(readiness.message)],
        ]}
      />

      <ActionNotice>{localMessage}</ActionNotice>
      <ActionNotice tone="danger">{localError}</ActionNotice>

      {pendingSelection.required === true ? (
        <div className="rounded-md border border-warning/25 bg-warning/5 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            Pending account selection
          </div>
          <div className="mt-1 text-[13px] font-medium leading-5 text-text-muted">
            Meta returned multiple eligible Instagram accounts. Select one to complete connection.
          </div>

          <div className="mt-4 grid gap-3">
            {candidates.map((candidate) => {
              const candidateId = s(candidate.id);

              return (
                <div
                  key={candidateId}
                  className="rounded-md border border-line-soft bg-white p-4"
                >
                  <InfoGrid
                    title={s(candidate.displayName, "Instagram account")}
                    rows={[
                      ["Page", s(candidate.pageName)],
                      ["Handle", s(candidate.igUsername)],
                      ["Instagram user ID", s(candidate.igUserId)],
                      ["Page ID", s(candidate.pageId)],
                    ]}
                  />

                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      loading={busyAction === `meta-select-${candidateId}`}
                      onClick={() =>
                        runLocal(
                          () =>
                            onMetaSelect({
                              selectionToken: s(pendingSelection.selectionToken),
                              candidateId,
                            }),
                          "Instagram account selected. Status is refreshing."
                        )
                      }
                    >
                      Select account
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {blockers.length ? (
        <div className="rounded-md border border-warning/25 bg-warning/5 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            Backend blockers
          </div>
          <div className="mt-3 grid gap-2">
            {blockers.map((blocker, index) => (
              <div
                key={`${s(blocker.reasonCode) || "blocker"}-${index}`}
                className="rounded-md border border-line-soft bg-white p-3"
              >
                <div className="text-[13px] font-semibold text-text">
                  {s(blocker.title || blocker.reasonCode, "Backend blocker")}
                </div>
                <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
                  {s(blocker.subtitle || blocker.message || blocker.description)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <InfoGrid
        title="Meta permission model"
        rows={[
          ["Requested scopes", arr(review.requestedScopes || payload.requestedScopes).join(", ")],
          ["Excluded scopes", arr(review.excludedScopes || payload.excludedScopes).join(", ")],
          ["Review story", s(review.story || payload.reviewStory)],
        ]}
      />

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={connectDisabled}
          loading={busyAction === "instagram-connect"}
          onClick={onMetaConnect}
          rightIcon={<ExternalLink className="h-4 w-4" strokeWidth={2.1} />}
        >
          {channel.connected ? "Reconnect Instagram" : "Connect Instagram"}
        </Button>

        {channel.connected ? (
          <Button
            type="button"
            size="md"
            variant="secondary"
            loading={busyAction === "instagram-disconnect"}
            onClick={() =>
              runLocal(
                onMetaDisconnect,
                "Instagram disconnected. Status is refreshing."
              )
            }
          >
            Disconnect
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function TelegramPanel({
  channel,
  busyAction,
  onTelegramConnect,
  onTelegramDisconnect,
}) {
  const [botToken, setBotToken] = useState("");
  const [localMessage, setLocalMessage] = useState("");
  const [localError, setLocalError] = useState("");

  const payload = obj(channel.payload);
  const account = obj(payload.account);
  const webhook = obj(payload.webhook);
  const runtime = obj(payload.runtime);
  const readiness = readReadiness(payload);
  const blockers = readBlockers(payload);

  async function runLocal(action, successMessage) {
    setLocalMessage("");
    setLocalError("");

    try {
      await action();
      setLocalMessage(successMessage);
    } catch (error) {
      setLocalError(
        s(error?.payload?.error || error?.payload?.message || error?.message) ||
          "Telegram backend action failed."
      );
    }
  }

  return (
    <div className="grid gap-4">
      <InfoGrid
        title="Telegram backend status"
        rows={[
          ["State", s(payload.state || channel.backendStatus)],
          ["Bot", s(account.botUsername || account.username || account.displayName)],
          ["Bot ID", s(account.botId)],
          ["Webhook ready", formatBoolean(webhook.ready || runtime.webhookReady)],
          ["Webhook URL", s(webhook.url)],
          ["Delivery ready", formatBoolean(runtime.deliveryReady)],
          ["Readiness", s(readiness.message)],
          ["Reason code", s(readiness.reasonCode || payload.reasonCode)],
        ]}
      />

      <ActionNotice>{localMessage}</ActionNotice>
      <ActionNotice tone="danger">{localError}</ActionNotice>

      {!channel.connected ? (
        <div className="rounded-md border border-line-soft bg-white p-4">
          <div className="mb-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Bot token connect
            </div>
            <div className="mt-1 text-[13px] font-medium leading-5 text-text-muted">
              This calls the live backend Telegram connect endpoint.
            </div>
          </div>

          <TextInput
            label="Telegram bot token"
            type="password"
            value={botToken}
            onChange={setBotToken}
            placeholder="Paste Telegram bot token"
          />

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              size="md"
              disabled={!s(botToken)}
              loading={busyAction === "telegram-connect"}
              onClick={() =>
                runLocal(
                  () => onTelegramConnect(botToken),
                  "Telegram connected. Status is refreshing."
                )
              }
            >
              Connect Telegram
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button
            type="button"
            size="md"
            variant="secondary"
            loading={busyAction === "telegram-disconnect"}
            onClick={() =>
              runLocal(
                onTelegramDisconnect,
                "Telegram disconnected. Status is refreshing."
              )
            }
          >
            Disconnect Telegram
          </Button>
        </div>
      )}

      {blockers.length ? (
        <div className="rounded-md border border-warning/25 bg-warning/5 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            Backend blockers
          </div>
          <div className="mt-3 grid gap-2">
            {blockers.map((blocker, index) => (
              <div
                key={`${s(blocker.reasonCode) || "blocker"}-${index}`}
                className="rounded-md border border-line-soft bg-white p-3"
              >
                <div className="text-[13px] font-semibold text-text">
                  {s(blocker.title || blocker.reasonCode, "Backend blocker")}
                </div>
                <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
                  {s(blocker.subtitle || blocker.message || blocker.description)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StaticRoadmapPanel({ channel }) {
  return (
    <div className="grid gap-4">
      <ActionNotice tone="warning">
        This channel has no mounted backend route on this screen. It is intentionally not pretending to be connected.
      </ActionNotice>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailList title="This connects" items={channel.connects} />
        <DetailList title="Requirements" items={channel.requirements} />
      </div>
    </div>
  );
}

function ChannelCard({ channel, selected = false, onOpen }) {
  const Icon = channel.icon || Plug;
  const signal = healthSignal(channel);
  const SignalIcon = signal.icon;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.();
        }
      }}
      className={cx(
        "group cursor-pointer rounded-md border bg-white p-5 transition-[background-color,border-color,box-shadow,transform] duration-base ease-premium",
        selected
          ? "border-brand shadow-[inset_3px_0_0_rgb(var(--color-brand)),0_18px_34px_-30px_rgba(37,99,235,0.62)]"
          : "border-line-soft hover:border-line hover:bg-surface-subtle hover:shadow-[0_14px_30px_-28px_rgba(15,23,42,0.45)]"
      )}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_150px] xl:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center text-text">
              <Icon className="h-9 w-9" strokeWidth={1.85} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                  {channel.name}
                </h3>

                <AppTag tone={statusTone(channel.status)}>
                  {titleize(channel.status)}
                </AppTag>

                {channel.backendBound ? (
                  <AppTag tone={channel.backendOk ? "success" : "warning"} dot>
                    Backend
                  </AppTag>
                ) : (
                  <AppTag tone="neutral">No backend route</AppTag>
                )}
              </div>

              <p className="mt-1.5 max-w-[680px] text-[13.5px] font-medium leading-6 text-text-muted">
                {channel.backendError || channel.description}
              </p>

              <div className="mt-4 border-t border-line-soft pt-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <div className="flex items-center gap-2">
                    <SignalIcon
                      className={cx("h-4 w-4 shrink-0", signal.className)}
                      strokeWidth={2.1}
                    />
                    <span className={cx("text-[12.5px] font-semibold", signal.className)}>
                      {signal.label}
                    </span>
                  </div>

                  <div className="text-[12.5px] font-medium text-text-muted">
                    {channel.type}
                  </div>

                  <div className="min-w-0 truncate text-[12.5px] font-medium text-text-muted">
                    {channel.setupNote}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-start xl:justify-end">
          <Button
            type="button"
            size="md"
            variant={actionVariant(channel)}
            onClick={(event) => {
              event.stopPropagation();
              onOpen?.();
            }}
            rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
          >
            {actionLabel(channel)}
          </Button>
        </div>
      </div>
    </article>
  );
}

function ChannelModal({
  channel,
  open,
  onClose,
  busyAction,
  actionMessage,
  actionError,
  onRefresh,
  onCopy,
  onWebsiteSave,
  onWebsiteDomainStatus,
  onWebsiteChallenge,
  onWebsiteCheck,
  onWebsiteHandoff,
  onWebsiteTest,
  onMetaConnect,
  onMetaDisconnect,
  onMetaSelect,
  onTelegramConnect,
  onTelegramDisconnect,
}) {
  if (!open || !channel) return null;

  const Icon = channel.icon || Plug;
  const signal = healthSignal(channel);

  return (
    <AppModal open={open} onClose={onClose} maxWidth="max-w-[900px]">
      <AppModalHeader>
        <div className="flex min-w-0 items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center text-text">
            <Icon className="h-11 w-11" strokeWidth={1.78} />
          </div>

          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand">
              Channel connect
            </div>

            <h2 className="mt-2 text-[24px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
              {channel.name}
            </h2>

            <p className="mt-2 max-w-[620px] text-[13.5px] font-medium leading-6 text-text-muted">
              {channel.backendError || channel.description}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <AppTag tone={statusTone(channel.status)}>
                {titleize(channel.status)}
              </AppTag>
              <AppTag tone={signal.tone} dot>
                {signal.label}
              </AppTag>
              <AppTag tone="neutral">{channel.type}</AppTag>
              <AppTag tone={channel.backendBound ? "success" : "neutral"}>
                {channel.backendBound ? "Live backend" : "Static roadmap"}
              </AppTag>
            </div>
          </div>
        </div>

        <AppModalCloseButton onClick={onClose} label="Close channel connect" />
      </AppModalHeader>

      <AppModalBody className="max-h-[calc(100vh-280px)] overflow-y-auto overscroll-contain">
        <ActionNotice>{actionMessage}</ActionNotice>
        <ActionNotice tone="danger">{actionError}</ActionNotice>

        <BackendFactGrid channel={channel} />

        {channel.id === "website-chat" ? (
          <WebsitePanel
            channel={channel}
            busyAction={busyAction}
            onWebsiteSave={onWebsiteSave}
            onWebsiteDomainStatus={onWebsiteDomainStatus}
            onWebsiteChallenge={onWebsiteChallenge}
            onWebsiteCheck={onWebsiteCheck}
            onWebsiteHandoff={onWebsiteHandoff}
            onWebsiteTest={onWebsiteTest}
            onCopy={onCopy}
          />
        ) : null}

        {channel.id === "instagram" ? (
          <MetaPanel
            channel={channel}
            busyAction={busyAction}
            onMetaConnect={onMetaConnect}
            onMetaDisconnect={onMetaDisconnect}
            onMetaSelect={onMetaSelect}
          />
        ) : null}

        {channel.id === "telegram" ? (
          <TelegramPanel
            channel={channel}
            busyAction={busyAction}
            onTelegramConnect={onTelegramConnect}
            onTelegramDisconnect={onTelegramDisconnect}
          />
        ) : null}

        {!["website-chat", "instagram", "telegram"].includes(channel.id) ? (
          <StaticRoadmapPanel channel={channel} />
        ) : null}
      </AppModalBody>

      <AppModalFooter>
        <Button type="button" variant="secondary" size="md" onClick={onClose}>
          Close
        </Button>

        <Button
          type="button"
          size="md"
          variant="secondary"
          loading={busyAction === "refresh"}
          onClick={onRefresh}
          leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
        >
          Refresh backend
        </Button>
      </AppModalFooter>
    </AppModal>
  );
}

export default function ChannelCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialChannelId =
    searchParams.get("channel") ||
    (searchParams.get("meta_connected") ||
    searchParams.get("meta_selection") ||
    searchParams.get("meta_error")
      ? "instagram"
      : "");

  const [selectedChannelId, setSelectedChannelId] = useState(initialChannelId);
  const [dialogChannelId, setDialogChannelId] = useState(initialChannelId);
  const [remoteByKey, setRemoteByKey] = useState({});
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [busyAction, setBusyAction] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setCatalogError("");

      const [website, instagram, telegram] = await Promise.all([
        safeStatus(getWebsiteWidgetStatus),
        safeStatus(getMetaChannelStatus),
        safeStatus(getTelegramChannelStatus),
      ]);

      if (!alive) return;

      setRemoteByKey({
        website,
        instagram,
        telegram,
      });

      const failed = [website, instagram, telegram].filter(
        (item) => item.ok === false
      );

      setCatalogError(
        failed.length
          ? `${failed.length} backend channel status request(s) failed.`
          : ""
      );
      setLoading(false);
    }

    load().catch((error) => {
      if (!alive) return;

      setCatalogError(
        s(error?.message || error, "Channel catalog could not be loaded.")
      );
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [refreshToken]);

  const channels = useMemo(() => {
    return BASE_CHANNELS.map((channel) => mergeChannel(channel, remoteByKey));
  }, [remoteByKey]);

  const selectedChannel = useMemo(() => {
    return channels.find((channel) => channel.id === selectedChannelId) || null;
  }, [channels, selectedChannelId]);

  const dialogChannel = useMemo(() => {
    return channels.find((channel) => channel.id === dialogChannelId) || null;
  }, [channels, dialogChannelId]);

  const stats = useMemo(() => {
    const backendChannels = channels.filter((channel) => channel.backendBound);
    const ready = backendChannels.filter((channel) => channel.deliveryReady).length;
    const connected = backendChannels.filter((channel) => channel.connected).length;
    const failed = backendChannels.filter((channel) => channel.backendOk === false).length;

    return {
      total: backendChannels.length,
      ready,
      connected,
      failed,
    };
  }, [channels]);

  function refresh() {
    setRefreshToken((value) => value + 1);
  }

  function openChannel(channel) {
    setSelectedChannelId(channel.id);
    setDialogChannelId(channel.id);
    setActionMessage("");
    setActionError("");

    const next = new URLSearchParams(searchParams);
    next.set("channel", channel.id);
    setSearchParams(next, { replace: true });
  }

  function closeChannel() {
    setDialogChannelId("");
    setActionMessage("");
    setActionError("");

    const next = new URLSearchParams(searchParams);
    next.delete("channel");
    next.delete("meta_connected");
    next.delete("meta_selection");
    next.delete("meta_error");
    next.delete("meta_reason");
    next.delete("section");
    setSearchParams(next, { replace: true });
  }

  async function runBackendAction(key, action, successMessage, options = {}) {
    setBusyAction(key);
    setActionMessage("");
    setActionError("");

    try {
      const payload = await action();
      setActionMessage(successMessage);

      if (options.refresh !== false) {
        refresh();
      }

      return payload;
    } catch (error) {
      const message =
        s(error?.payload?.error || error?.payload?.message || error?.message) ||
        "Backend action failed.";

      setActionError(message);
      throw error;
    } finally {
      setBusyAction("");
    }
  }

  async function handleCopy(value = "") {
    const text = s(value);
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setActionMessage("Copied.");
      setActionError("");
    } catch {
      setActionError("Copy failed. Select and copy manually.");
    }
  }

  async function handleMetaConnect() {
    setBusyAction("instagram-connect");
    setActionMessage("");
    setActionError("");

    try {
      const payload = await getMetaConnectUrl();
      const url = s(payload?.url || payload?.redirectUrl);

      if (!url) {
        throw new Error("Meta connect URL was not returned by backend.");
      }

      window.location.assign(url);
    } catch (error) {
      setActionError(
        s(error?.payload?.error || error?.payload?.message || error?.message) ||
          "Failed to start Instagram connect."
      );
      setBusyAction("");
    }
  }

  function handleMetaDisconnect() {
    return runBackendAction(
      "instagram-disconnect",
      () => disconnectMetaChannel(),
      "Instagram disconnected. Status is refreshing."
    );
  }

  function handleMetaSelect({ selectionToken = "", candidateId = "" } = {}) {
    return runBackendAction(
      `meta-select-${s(candidateId)}`,
      () => selectMetaChannelCandidate({ selectionToken, candidateId }),
      "Instagram account selected. Status is refreshing."
    );
  }

  function handleTelegramConnect(botToken) {
    const token = s(botToken);

    if (!token) {
      setActionError("Telegram bot token is required.");
      return Promise.reject(new Error("Telegram bot token is required."));
    }

    return runBackendAction(
      "telegram-connect",
      () => connectTelegramChannel({ botToken: token }),
      "Telegram connected. Status is refreshing."
    );
  }

  function handleTelegramDisconnect() {
    return runBackendAction(
      "telegram-disconnect",
      () => disconnectTelegramChannel(),
      "Telegram disconnected. Status is refreshing."
    );
  }

  function handleWebsiteSave(payload) {
    return runBackendAction(
      "website-save",
      () => saveWebsiteWidgetConfig(payload),
      "Website Chat config saved. Status is refreshing."
    );
  }

  function handleWebsiteDomainStatus(domain) {
    return runBackendAction(
      "website-domain-status",
      () => getWebsiteDomainVerificationStatus({ domain: s(domain) }),
      "Domain verification status loaded.",
      { refresh: false }
    );
  }

  function handleWebsiteChallenge(domain) {
    return runBackendAction(
      "website-domain-challenge",
      () => createWebsiteDomainVerificationChallenge({ domain: s(domain) }),
      "Domain verification challenge created.",
      { refresh: false }
    );
  }

  function handleWebsiteCheck(domain) {
    return runBackendAction(
      "website-domain-check",
      () => checkWebsiteDomainVerification({ domain: s(domain) }),
      "Domain verification check completed."
    );
  }

  function handleWebsiteHandoff(type = "developer", domain = "") {
    const safeType = s(type, "developer");

    const action =
      safeType === "gtm"
        ? () => createWebsiteWidgetGtmInstallHandoff({ domain: s(domain) })
        : safeType === "wordpress"
          ? () => createWebsiteWidgetWordpressInstallHandoff({ domain: s(domain) })
          : () => createWebsiteWidgetInstallHandoff({ domain: s(domain) });

    return runBackendAction(
      `website-handoff-${safeType}`,
      action,
      `${titleize(safeType)} install package generated.`,
      { refresh: false }
    );
  }

  function handleWebsiteTest(text) {
    return runBackendAction(
      "website-test-message",
      () => createWebsiteWidgetTestMessage({ text: s(text) }),
      "Website test message created. Open Inbox to verify it."
    );
  }

  return (
    <PageCanvas>
      <PageHeader
        title="Channel catalog"
        description="Connect the places where customers message you and route every conversation into the workspace."
      />

      <Card padded="md" className="mb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
              Backend readiness
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <AppTag tone="success" dot>
                {stats.ready}/{stats.total} delivery ready
              </AppTag>
              <AppTag tone={stats.connected ? "success" : "neutral"} dot>
                {stats.connected} connected
              </AppTag>
              <AppTag tone={stats.failed ? "warning" : "success"} dot>
                {stats.failed} failed
              </AppTag>
              {loading ? <AppTag tone="neutral">Loading</AppTag> : null}
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="md"
            loading={loading}
            onClick={refresh}
            leftIcon={!loading ? <RefreshCw className="h-4 w-4" strokeWidth={2.1} /> : undefined}
          >
            Refresh backend
          </Button>
        </div>

        {catalogError ? (
          <div className="mt-4 rounded-md border border-warning/25 bg-warning/5 px-4 py-3 text-[13px] font-medium text-warning">
            {catalogError}
          </div>
        ) : null}
      </Card>

      <div className="grid gap-3">
        {channels.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            selected={selectedChannel?.id === channel.id}
            onOpen={() => openChannel(channel)}
          />
        ))}
      </div>

      <ChannelModal
        key={dialogChannelId || "closed"}
        channel={dialogChannel}
        open={Boolean(dialogChannel)}
        onClose={closeChannel}
        busyAction={busyAction}
        actionMessage={actionMessage}
        actionError={actionError}
        onRefresh={refresh}
        onCopy={handleCopy}
        onWebsiteSave={handleWebsiteSave}
        onWebsiteDomainStatus={handleWebsiteDomainStatus}
        onWebsiteChallenge={handleWebsiteChallenge}
        onWebsiteCheck={handleWebsiteCheck}
        onWebsiteHandoff={handleWebsiteHandoff}
        onWebsiteTest={handleWebsiteTest}
        onMetaConnect={handleMetaConnect}
        onMetaDisconnect={handleMetaDisconnect}
        onMetaSelect={handleMetaSelect}
        onTelegramConnect={handleTelegramConnect}
        onTelegramDisconnect={handleTelegramDisconnect}
      />
    </PageCanvas>
  );
}
