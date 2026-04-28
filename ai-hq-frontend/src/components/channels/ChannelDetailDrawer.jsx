import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Copy,
  RefreshCw,
  X,
} from "lucide-react";

import {
  getMetaChannelStatus,
  getTelegramChannelStatus,
  getWebsiteWidgetStatus,
} from "../../api/channelConnect.js";
import { InlineNotice } from "../ui/AppShellPrimitives.jsx";
import ChannelIcon from "./ChannelIcon.jsx";
import { s } from "../../lib/appUi.js";

const CHANNEL_DETAIL_COPY = {
  website: {
    fallbackName: "Website chat",
    readySummary: "Widget is live and domain ownership is verified.",
    blockedSummary: "Website chat is connected, but delivery needs one more check.",
    availableSummary: "Website chat can be connected when the install is ready.",
    primaryReady: "Open inbox",
    primaryFallback: "Refresh status",
    metricOne: "Domain",
    metricTwo: "Widget",
    metricThree: "Install",
  },
  instagram: {
    fallbackName: "Instagram",
    readySummary: "Instagram DMs are ready for operator and AI workflows.",
    blockedSummary: "Instagram is connected, but delivery needs attention.",
    availableSummary: "Instagram can be connected when your Meta setup is ready.",
    primaryReady: "Open inbox",
    primaryFallback: "Refresh status",
    metricOne: "Account",
    metricTwo: "Inbox",
    metricThree: "Delivery",
  },
  telegram: {
    fallbackName: "Telegram",
    readySummary: "Telegram bot delivery is ready for live conversations.",
    blockedSummary: "Telegram is connected, but webhook delivery needs attention.",
    availableSummary: "Telegram can be connected when your bot setup is ready.",
    primaryReady: "Open inbox",
    primaryFallback: "Refresh status",
    metricOne: "Bot",
    metricTwo: "Webhook",
    metricThree: "Delivery",
  },
};

const STATUS_TONE = {
  success: {
    dot: "bg-[rgba(22,163,74,0.96)]",
    text: "text-[rgba(22,163,74,0.96)]",
  },
  warning: {
    dot: "bg-[rgba(245,158,11,0.96)]",
    text: "text-[rgba(180,83,9,0.96)]",
  },
  muted: {
    dot: "bg-[rgba(148,163,184,0.96)]",
    text: "text-[rgba(100,116,139,0.96)]",
  },
};

function isFilled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function readPath(source, path) {
  if (!source || !path) return undefined;

  return path.split(".").reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, source);
}

function pickValue(source, paths = [], fallback = "") {
  for (const path of paths) {
    const value = readPath(source, path);
    if (isFilled(value)) return value;
  }

  return fallback;
}

function pickText(source, paths = [], fallback = "") {
  const value = pickValue(source, paths, fallback);
  return s(value || fallback);
}

function toBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;

  const text = s(value).toLowerCase();

  if (["true", "yes", "ready", "connected", "verified", "active", "ok"].includes(text)) {
    return true;
  }

  if (["false", "no", "blocked", "failed", "inactive", "missing"].includes(text)) {
    return false;
  }

  return fallback;
}

function hasAnyWord(value, words = []) {
  const text = s(value).toLowerCase();
  return words.some((word) => text.includes(word));
}

function compactValue(value, max = 26) {
  const text = s(value);
  if (text.length <= max) return text;
  const head = Math.max(8, Math.floor(max * 0.55));
  const tail = Math.max(5, max - head - 1);
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

function normalizeDomain(value) {
  const text = s(value)
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/g, "")
    .trim();

  return text || "Not set";
}

function buildSnippet(payload, domain, installId) {
  const directSnippet = pickText(payload, [
    "snippet",
    "installSnippet",
    "installationSnippet",
    "widget.snippet",
    "widget.installSnippet",
    "install.snippet",
    "data.snippet",
    "data.installSnippet",
  ]);

  if (directSnippet) return directSnippet;

  if (!installId || installId === "Not set") return "";

  const safeDomain = domain && domain !== "Not set" ? ` data-domain="${domain}"` : "";

  return `<script async src="https://hq.weneox.com/widget.js" data-neox-widget="${installId}"${safeDomain}></script>`;
}

function buildWebsiteModel(channel, payload) {
  const copy = CHANNEL_DETAIL_COPY.website;

  const domain = normalizeDomain(
    pickText(payload, [
      "domain",
      "siteDomain",
      "verifiedDomain",
      "origin",
      "trustedOrigin",
      "widget.domain",
      "widget.origin",
      "install.domain",
      "data.domain",
      "data.siteDomain",
    ])
  );

  const installId =
    pickText(payload, [
      "installId",
      "installationId",
      "publishableInstallId",
      "publicInstallId",
      "widgetInstallId",
      "widget.id",
      "widget.installId",
      "widget.publicInstallId",
      "install.id",
      "install.installId",
      "data.installId",
      "data.widgetInstallId",
    ]) || "Not set";

  const rawStatus = pickText(payload, [
    "status",
    "statusLabel",
    "installStatus",
    "widget.status",
    "install.status",
    "data.status",
  ]);

  const connected =
    toBool(
      pickValue(payload, [
        "connected",
        "isConnected",
        "widget.connected",
        "install.connected",
        "data.connected",
      ]),
      false
    ) ||
    hasAnyWord(rawStatus, ["connected", "ready", "verified", "active", "live"]);

  const verified =
    toBool(
      pickValue(payload, [
        "verified",
        "domainVerified",
        "dnsVerified",
        "verification.verified",
        "domain.verified",
        "domainVerification.verified",
        "widget.domainVerified",
        "data.verified",
      ]),
      false
    ) || hasAnyWord(rawStatus, ["verified", "ready", "active", "live"]);

  const deliveryReady =
    toBool(
      pickValue(payload, [
        "deliveryReady",
        "ready",
        "installReady",
        "widget.ready",
        "install.ready",
        "data.deliveryReady",
        "data.ready",
      ]),
      false
    ) || hasAnyWord(rawStatus, ["ready", "active", "live"]);

  const isReady = connected && (deliveryReady || verified);
  const isBlocked = connected && !isReady;

  const statusLabel = isReady ? "Connected" : isBlocked ? "Needs check" : "Available";
  const tone = isReady ? "success" : isBlocked ? "warning" : "muted";

  const snippet = buildSnippet(payload, domain, installId);

  return {
    id: channel?.id || "website",
    name: channel?.name || copy.fallbackName,
    statusLabel,
    tone,
    connected,
    deliveryReady: isReady,
    blocked: isBlocked,
    summary: isReady
      ? `Widget is live on ${domain}.`
      : isBlocked
        ? copy.blockedSummary
        : copy.availableSummary,
    primaryLabel: isReady ? copy.primaryReady : copy.primaryFallback,
    metrics: [
      {
        label: copy.metricOne,
        value: domain,
      },
      {
        label: copy.metricTwo,
        value: compactValue(installId, 24),
        title: installId,
      },
      {
        label: copy.metricThree,
        value: isReady ? "Ready" : isBlocked ? "Review" : "Pending",
      },
    ],
    details: [
      ["Channel", channel?.name || copy.fallbackName],
      ["Domain", domain],
      ["Widget ID", installId],
      ["Domain verified", verified ? "Yes" : "No"],
      ["Delivery ready", isReady ? "Yes" : "No"],
      ["Status", statusLabel],
    ],
    snippet,
  };
}

function buildInstagramModel(channel, payload) {
  const copy = CHANNEL_DETAIL_COPY.instagram;

  const account =
    pickText(payload, [
      "username",
      "account.username",
      "instagram.username",
      "page.username",
      "page.name",
      "business.name",
      "data.username",
      "data.account.username",
    ]) || "Instagram";

  const rawStatus = pickText(payload, [
    "status",
    "statusLabel",
    "connectionStatus",
    "deliveryStatus",
    "data.status",
  ]);

  const connected =
    toBool(
      pickValue(payload, [
        "connected",
        "isConnected",
        "account.connected",
        "instagram.connected",
        "data.connected",
      ]),
      false
    ) || hasAnyWord(rawStatus, ["connected", "ready", "active", "live"]);

  const deliveryReady =
    toBool(
      pickValue(payload, [
        "deliveryReady",
        "ready",
        "automationReady",
        "inboxReady",
        "data.deliveryReady",
        "data.ready",
      ]),
      false
    ) || hasAnyWord(rawStatus, ["ready", "active", "live"]);

  const isReady = connected && deliveryReady;
  const isBlocked = connected && !isReady;

  const statusLabel = isReady ? "Connected" : isBlocked ? "Needs check" : "Available";
  const tone = isReady ? "success" : isBlocked ? "warning" : "muted";

  return {
    id: channel?.id || "instagram",
    name: channel?.name || copy.fallbackName,
    statusLabel,
    tone,
    connected,
    deliveryReady: isReady,
    blocked: isBlocked,
    summary: isReady ? copy.readySummary : isBlocked ? copy.blockedSummary : copy.availableSummary,
    primaryLabel: isReady ? copy.primaryReady : copy.primaryFallback,
    metrics: [
      {
        label: copy.metricOne,
        value: compactValue(account, 24),
        title: account,
      },
      {
        label: copy.metricTwo,
        value: isReady ? "Ready" : isBlocked ? "Review" : "Pending",
      },
      {
        label: copy.metricThree,
        value: isReady ? "Live" : isBlocked ? "Blocked" : "Off",
      },
    ],
    details: [
      ["Channel", channel?.name || copy.fallbackName],
      ["Account", account],
      ["Connected", connected ? "Yes" : "No"],
      ["Delivery ready", isReady ? "Yes" : "No"],
      ["Status", statusLabel],
    ],
    snippet: "",
  };
}

function buildTelegramModel(channel, payload) {
  const copy = CHANNEL_DETAIL_COPY.telegram;

  const bot =
    pickText(payload, [
      "botUsername",
      "bot.username",
      "telegram.botUsername",
      "telegram.username",
      "webhook.botUsername",
      "data.botUsername",
      "data.bot.username",
    ]) || "Telegram bot";

  const rawStatus = pickText(payload, [
    "status",
    "statusLabel",
    "connectionStatus",
    "webhookStatus",
    "deliveryStatus",
    "data.status",
  ]);

  const connected =
    toBool(
      pickValue(payload, [
        "connected",
        "isConnected",
        "bot.connected",
        "telegram.connected",
        "data.connected",
      ]),
      false
    ) || hasAnyWord(rawStatus, ["connected", "ready", "active", "live"]);

  const webhookReady =
    toBool(
      pickValue(payload, [
        "webhookReady",
        "webhook.ready",
        "telegram.webhookReady",
        "data.webhookReady",
      ]),
      false
    ) || hasAnyWord(rawStatus, ["webhook", "ready", "active", "live"]);

  const deliveryReady =
    toBool(
      pickValue(payload, [
        "deliveryReady",
        "ready",
        "bot.ready",
        "data.deliveryReady",
        "data.ready",
      ]),
      false
    ) || hasAnyWord(rawStatus, ["ready", "active", "live"]);

  const isReady = connected && (deliveryReady || webhookReady);
  const isBlocked = connected && !isReady;

  const statusLabel = isReady ? "Connected" : isBlocked ? "Needs check" : "Available";
  const tone = isReady ? "success" : isBlocked ? "warning" : "muted";

  return {
    id: channel?.id || "telegram",
    name: channel?.name || copy.fallbackName,
    statusLabel,
    tone,
    connected,
    deliveryReady: isReady,
    blocked: isBlocked,
    summary: isReady ? copy.readySummary : isBlocked ? copy.blockedSummary : copy.availableSummary,
    primaryLabel: isReady ? copy.primaryReady : copy.primaryFallback,
    metrics: [
      {
        label: copy.metricOne,
        value: compactValue(bot, 24),
        title: bot,
      },
      {
        label: copy.metricTwo,
        value: webhookReady ? "Ready" : isBlocked ? "Review" : "Pending",
      },
      {
        label: copy.metricThree,
        value: isReady ? "Live" : isBlocked ? "Blocked" : "Off",
      },
    ],
    details: [
      ["Channel", channel?.name || copy.fallbackName],
      ["Bot", bot],
      ["Connected", connected ? "Yes" : "No"],
      ["Webhook ready", webhookReady ? "Yes" : "No"],
      ["Delivery ready", isReady ? "Yes" : "No"],
      ["Status", statusLabel],
    ],
    snippet: "",
  };
}

function buildChannelModel(channel, payload) {
  if (channel?.id === "website") return buildWebsiteModel(channel, payload);
  if (channel?.id === "instagram") return buildInstagramModel(channel, payload);
  if (channel?.id === "telegram") return buildTelegramModel(channel, payload);

  return {
    id: channel?.id || "channel",
    name: channel?.name || "Channel",
    statusLabel: "Available",
    tone: "muted",
    connected: false,
    deliveryReady: false,
    blocked: false,
    summary: "Channel details are available.",
    primaryLabel: "Refresh status",
    metrics: [
      ["Channel", channel?.name || "Channel"],
      ["Status", "Available"],
      ["Delivery", "Pending"],
    ].map(([label, value]) => ({ label, value })),
    details: [
      ["Channel", channel?.name || "Channel"],
      ["Status", "Available"],
    ],
    snippet: "",
  };
}

async function fetchChannelPayload(channelId) {
  if (channelId === "website") return getWebsiteWidgetStatus();
  if (channelId === "instagram") return getMetaChannelStatus();
  if (channelId === "telegram") return getTelegramChannelStatus();
  return {};
}

function StatusLine({ model }) {
  const tone = STATUS_TONE[model.tone] || STATUS_TONE.muted;

  return (
    <div className="inline-flex min-w-0 items-center gap-2">
      <span className={["h-1.5 w-1.5 shrink-0 rounded-full", tone.dot].join(" ")} />
      <span className={["text-[12px] font-semibold leading-none", tone.text].join(" ")}>
        {model.statusLabel}
      </span>
    </div>
  );
}

function MetricCell({ label, value, title }) {
  return (
    <div className="min-w-0 rounded-[12px] bg-[rgba(248,250,252,0.82)] px-4 py-3 ring-1 ring-[rgba(15,23,42,0.055)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(100,116,139,0.82)]">
        {label}
      </div>

      <div
        title={title || value}
        className="mt-2 truncate text-[13px] font-semibold tracking-[-0.015em] text-[rgba(15,23,42,0.96)]"
      >
        {value || "—"}
      </div>
    </div>
  );
}

function PlainActionButton({
  children,
  primary = false,
  disabled = false,
  onClick,
  icon = null,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] px-4",
        "text-[13px] font-semibold tracking-[-0.01em]",
        "transition-all duration-200 ease-out",
        primary
          ? [
              "bg-[rgb(var(--color-brand))] text-white",
              "shadow-[0_18px_34px_-22px_rgba(46,96,255,0.72)]",
              "hover:-translate-y-[1px] hover:bg-[rgb(var(--color-brand-strong))]",
              "hover:shadow-[0_24px_42px_-24px_rgba(46,96,255,0.82)]",
            ].join(" ")
          : [
              "bg-white text-[rgba(15,23,42,0.92)]",
              "ring-1 ring-[rgba(15,23,42,0.08)]",
              "hover:-translate-y-[1px] hover:ring-[rgba(46,96,255,0.18)]",
              "hover:shadow-[0_16px_34px_-28px_rgba(15,23,42,0.3)]",
            ].join(" "),
        disabled ? "cursor-not-allowed opacity-50 hover:translate-y-0 hover:shadow-none" : "",
      ].join(" ")}
    >
      <span>{children}</span>
      {icon}
    </button>
  );
}

function SkeletonContent() {
  return (
    <div className="space-y-5">
      <div className="h-16 rounded-[12px] bg-[rgba(248,250,252,0.9)] ring-1 ring-[rgba(15,23,42,0.05)]" />

      <div className="grid grid-cols-3 gap-3">
        <div className="h-[74px] rounded-[12px] bg-[rgba(248,250,252,0.9)] ring-1 ring-[rgba(15,23,42,0.05)]" />
        <div className="h-[74px] rounded-[12px] bg-[rgba(248,250,252,0.9)] ring-1 ring-[rgba(15,23,42,0.05)]" />
        <div className="h-[74px] rounded-[12px] bg-[rgba(248,250,252,0.9)] ring-1 ring-[rgba(15,23,42,0.05)]" />
      </div>

      <div className="h-11 rounded-[10px] bg-[rgba(248,250,252,0.9)] ring-1 ring-[rgba(15,23,42,0.05)]" />
    </div>
  );
}

export default function ChannelDetailDrawer({
  channel,
  open = true,
  onClose,
  onNavigate,
}) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const model = useMemo(() => buildChannelModel(channel, payload || {}), [channel, payload]);

  const load = useCallback(async () => {
    if (!channel?.id) return;

    setLoading(true);
    setLoadError("");

    try {
      const nextPayload = await fetchChannelPayload(channel.id);
      setPayload(nextPayload || {});
    } catch (error) {
      setPayload({});
      setLoadError(s(error?.message || error || "Channel details could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [channel?.id]);

  useEffect(() => {
    if (!open || !channel?.id) return undefined;

    let alive = true;

    setLoading(true);
    setLoadError("");
    setCopied(false);
    setDetailsOpen(false);

    fetchChannelPayload(channel.id)
      .then((nextPayload) => {
        if (!alive) return;
        setPayload(nextPayload || {});
      })
      .catch((error) => {
        if (!alive) return;
        setPayload({});
        setLoadError(s(error?.message || error || "Channel details could not be loaded."));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [channel?.id, open]);

  async function handleCopy() {
    const technicalText = model.details
      .map(([label, value]) => `${label}: ${value || "—"}`)
      .join("\n");

    const copyText = model.snippet || technicalText;

    if (!copyText) return;

    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  function handlePrimaryAction() {
    if (model.deliveryReady) {
      onNavigate?.("/inbox");
      return;
    }

    load();
  }

  return (
    <aside className="flex h-full min-h-0 flex-col bg-white">
      <header className="relative z-10 shrink-0 border-b border-[rgba(15,23,42,0.08)] bg-white px-7 py-6">
        <div className="flex items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <div className="mt-0.5 shrink-0">
              <ChannelIcon channel={channel} size="lg" />
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-[24px] font-semibold leading-7 tracking-[-0.04em] text-[rgba(15,23,42,0.98)]">
                {model.name}
              </h2>

              <div className="mt-3">
                <StatusLine model={model} />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close connector details"
            className={[
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]",
              "bg-white text-[rgba(15,23,42,0.78)]",
              "ring-1 ring-[rgba(15,23,42,0.1)]",
              "transition-all duration-200 ease-out",
              "hover:-translate-y-[1px] hover:text-[rgba(15,23,42,0.98)]",
              "hover:ring-[rgba(46,96,255,0.22)] hover:shadow-[0_16px_34px_-26px_rgba(15,23,42,0.3)]",
            ].join(" ")}
          >
            <X className="h-5 w-5" strokeWidth={2.1} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
        {loading ? (
          <SkeletonContent />
        ) : (
          <div className="space-y-5">
            {loadError ? (
              <InlineNotice
                tone="warning"
                title="Status could not be refreshed"
                description={loadError}
                compact
              />
            ) : null}

            <section className="rounded-[14px] bg-white p-5 ring-1 ring-[rgba(15,23,42,0.08)] shadow-[0_22px_54px_-42px_rgba(15,23,42,0.42)]">
              <div className="max-w-[420px]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[rgba(100,116,139,0.82)]">
                  Current state
                </div>

                <p className="mt-2 text-[18px] font-semibold leading-6 tracking-[-0.035em] text-[rgba(15,23,42,0.98)]">
                  {model.deliveryReady
                    ? "Ready for live messages."
                    : model.blocked
                      ? "Connected, but needs review."
                      : "Waiting for setup."}
                </p>

                <p className="mt-2 text-[13px] font-medium leading-6 text-[rgba(71,85,105,0.92)]">
                  {model.summary}
                </p>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {model.metrics.map((metric) => (
                  <MetricCell
                    key={`${metric.label}-${metric.value}`}
                    label={metric.label}
                    value={metric.value}
                    title={metric.title}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <PlainActionButton
                primary
                onClick={handlePrimaryAction}
                icon={
                  model.deliveryReady ? (
                    <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
                  ) : (
                    <RefreshCw className="h-4 w-4" strokeWidth={2.2} />
                  )
                }
              >
                {model.primaryLabel}
              </PlainActionButton>

              <div className="grid grid-cols-2 gap-3">
                <PlainActionButton
                  onClick={handleCopy}
                  icon={<Copy className="h-4 w-4" strokeWidth={2.1} />}
                >
                  {copied ? "Copied" : model.snippet ? "Copy snippet" : "Copy details"}
                </PlainActionButton>

                <PlainActionButton
                  onClick={load}
                  icon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
                >
                  Refresh
                </PlainActionButton>
              </div>
            </section>

            <section className="rounded-[14px] bg-white ring-1 ring-[rgba(15,23,42,0.08)]">
              <button
                type="button"
                onClick={() => setDetailsOpen((value) => !value)}
                className={[
                  "flex w-full items-center justify-between gap-4 px-5 py-4 text-left",
                  "transition-colors duration-200 hover:bg-[rgba(248,250,252,0.8)]",
                ].join(" ")}
              >
                <span>
                  <span className="block text-[13px] font-semibold tracking-[-0.015em] text-[rgba(15,23,42,0.96)]">
                    Installation details
                  </span>
                  <span className="mt-1 block text-[12px] font-medium text-[rgba(100,116,139,0.88)]">
                    Technical values only when needed.
                  </span>
                </span>

                <ChevronDown
                  className={[
                    "h-4 w-4 shrink-0 text-[rgba(100,116,139,0.86)] transition-transform duration-200",
                    detailsOpen ? "rotate-180" : "",
                  ].join(" ")}
                  strokeWidth={2.2}
                />
              </button>

              {detailsOpen ? (
                <div className="border-t border-[rgba(15,23,42,0.07)] px-5 py-4">
                  <dl className="space-y-3">
                    {model.details.map(([label, value]) => (
                      <div
                        key={label}
                        className="grid grid-cols-[128px_minmax(0,1fr)] items-start gap-4"
                      >
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(100,116,139,0.82)]">
                          {label}
                        </dt>

                        <dd className="min-w-0 break-words text-[12.5px] font-semibold leading-5 text-[rgba(15,23,42,0.92)]">
                          {value || "—"}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {model.snippet ? (
                    <div className="mt-4 rounded-[12px] bg-[rgba(248,250,252,0.86)] p-3 ring-1 ring-[rgba(15,23,42,0.06)]">
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(100,116,139,0.82)]">
                        Snippet
                      </div>

                      <code className="block max-h-[96px] overflow-auto whitespace-pre-wrap break-words text-[11.5px] font-semibold leading-5 text-[rgba(15,23,42,0.82)]">
                        {model.snippet}
                      </code>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </aside>
  );
}