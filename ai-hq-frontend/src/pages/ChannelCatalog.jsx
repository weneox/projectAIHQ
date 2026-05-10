import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight, RefreshCw, X } from "lucide-react";

import { getLaunchPosture } from "../api/launch.js";
import ChannelDetailDrawer from "../components/channels/ChannelDetailDrawer.jsx";
import ChannelIcon from "../components/channels/ChannelIcon.jsx";
import useWorkspaceTenantKey from "../hooks/useWorkspaceTenantKey.js";
import {
  CHANNELS,
  findChannelById,
} from "../components/channels/channelCatalogModel.js";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../components/ui/AppShellPrimitives.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import { cx } from "../lib/cx.js";
import { s } from "../lib/appUi.js";
import { useLaunchSliceRefreshToken } from "../lib/launchSliceRefresh.js";

const EMPTY_READINESS_STATE = {
  tenantKey: "",
  requestKey: "",
  loading: true,
  error: "",
  channels: {},
  channelSummary: {
    readyCount: 0,
    connectedCount: 0,
    deliveryReadyChannelIds: [],
    selectedChannelId: "",
  },
};

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function launchChannels() {
  return CHANNELS.filter((channel) =>
    ["website", "instagram", "telegram"].includes(channel.id)
  );
}

function normalizePostureChannel(channelId = "", rawChannel = null) {
  const channel = obj(rawChannel);
  const readiness = obj(channel.readiness);
  const blockers = arr(channel.blockers).length
    ? arr(channel.blockers)
    : arr(readiness.blockers);

  const available = rawChannel == null ? true : channel.available !== false;
  const connected = channel.connected === true;
  const deliveryReady = available && connected && channel.deliveryReady === true;
  const status = lower(
    channel.status,
    deliveryReady ? "ready" : available ? "available" : "unavailable"
  );

  const needsReview =
    available &&
    !deliveryReady &&
    (connected ||
      blockers.length > 0 ||
      ["blocked", "connected_blocked", "testing_only", "error"].includes(status));

  return {
    id: channelId,
    available,
    connected,
    deliveryReady,
    needsReview,
    status,
    summary: s(
      readiness.message ||
        channel.message ||
        blockers[0]?.message ||
        blockers[0]?.subtitle
    ),
    blockers,
  };
}

function buildReadinessStateFromPosture({
  tenantKey = "",
  requestKey = "",
  posture = null,
  error = "",
} = {}) {
  const payload = obj(posture);
  const unavailable = s(error);
  const channels = obj(payload.channels);
  const channelSummary = obj(payload.channelSummary);

  if (unavailable) {
    return {
      ...EMPTY_READINESS_STATE,
      tenantKey,
      requestKey,
      loading: false,
      error: unavailable,
      channels: {
        website: normalizePostureChannel("website", {
          available: false,
          connected: false,
          deliveryReady: false,
          status: "unavailable",
          message: unavailable,
        }),
        instagram: normalizePostureChannel("instagram", {
          available: false,
          connected: false,
          deliveryReady: false,
          status: "unavailable",
          message: unavailable,
        }),
        telegram: normalizePostureChannel("telegram", {
          available: false,
          connected: false,
          deliveryReady: false,
          status: "unavailable",
          message: unavailable,
        }),
      },
    };
  }

  return {
    tenantKey,
    requestKey,
    loading: false,
    error: "",
    channels: {
      website: normalizePostureChannel("website", channels.website),
      instagram: normalizePostureChannel("instagram", channels.instagram),
      telegram: normalizePostureChannel("telegram", channels.telegram),
    },
    channelSummary: {
      readyCount: n(channelSummary.readyCount),
      connectedCount: n(channelSummary.connectedCount),
      deliveryReadyChannelIds: arr(channelSummary.deliveryReadyChannelIds),
      selectedChannelId: s(channelSummary.selectedChannelId),
    },
    truth: obj(payload.truth),
    runtime: obj(payload.runtime),
    overall: obj(payload.overall),
  };
}

function runtimeFor(channel, readinessState) {
  return obj(readinessState.channels)[channel.id] || normalizePostureChannel(channel.id);
}

function laneStatus(runtime = {}) {
  if (runtime.deliveryReady) {
    return {
      label: "Connected",
      tone: "success",
      body: "This lane can receive customer conversations.",
      action: "Inbox",
    };
  }

  if (runtime.needsReview) {
    return {
      label: "Review",
      tone: "warning",
      body: "This lane is attached and needs a quick review.",
      action: "Fix",
    };
  }

  if (runtime.available === false) {
    return {
      label: "Unavailable",
      tone: "neutral",
      body: "This lane is not available in this environment.",
      action: "Details",
    };
  }

  return {
    label: "Available",
    tone: "neutral",
    body: "Choose this lane when you want to use it.",
    action: "Connect",
  };
}

function dotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

function textClass(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "brand") return "text-brand";
  return "text-text-muted";
}

function connectedLaneName(readinessState = {}, channels = []) {
  const readyIds = arr(readinessState.channelSummary?.deliveryReadyChannelIds);
  const selectedId = s(readinessState.channelSummary?.selectedChannelId);
  const id = selectedId || readyIds[0];

  if (!id) return "";

  return s(channels.find((channel) => channel.id === id)?.name);
}

function launchRepairCopy(readinessState = {}) {
  const truth = obj(readinessState.truth);
  const runtime = obj(readinessState.runtime);

  if (truth.ready === false || s(truth.status).toLowerCase() === "blocked") {
    return "Business info still needs approval.";
  }

  if (runtime.ready === false || s(runtime.status).toLowerCase() === "blocked") {
    return "Runtime pending repair. Runtime still needs repair.";
  }

  return "";
}

function StatusPill({ tone = "neutral", children }) {
  return (
    <span
      className={cx(
        "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[12px] font-semibold",
        tone === "success"
          ? "border-success/15 bg-success-soft text-success"
          : tone === "warning"
            ? "border-warning/20 bg-warning/5 text-warning"
            : tone === "danger"
              ? "border-danger/20 bg-danger/5 text-danger"
              : "border-line-soft bg-surface-subtle text-text-muted"
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", dotClass(tone))} />
      {children}
    </span>
  );
}

function MetricTile({ label, value, tone = "neutral" }) {
  return (
    <div className="min-h-[76px] rounded-md border border-line-soft bg-white px-4 py-3 shadow-[0_18px_45px_-42px_rgba(15,23,42,0.48)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {label}
      </div>
      <div className={cx("mt-2 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)]", textClass(tone))}>
        {value}
      </div>
    </div>
  );
}

function Header({
  activeLane,
  readinessState,
  channelCount = 3,
  refreshing,
  onRefresh,
  onNavigate,
}) {
  const readyCount = n(readinessState?.channelSummary?.readyCount);
  const connectedCount = n(readinessState?.channelSummary?.connectedCount);
  const readyLabel = `${readyCount}/${channelCount} ready`;

  return (
    <Card padded={false} clip className="overflow-hidden">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 border-b border-line-soft px-5 py-5 xl:border-b-0 xl:border-r">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brand">
                Omnichannel intake
              </div>
              <h1 className="mt-2 text-[24px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
                Launch channels
              </h1>
              <p className="mt-2 max-w-[720px] text-[13.5px] font-medium leading-6 text-text-muted">
                Connect the customer lanes that should feed your inbox. Each connector keeps its own backend truth, runtime checks, and repair actions.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onNavigate("/truth")}
              >
                Open Business Info
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onNavigate("/inbox")}
              >
                Open Inbox
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={refreshing}
                onClick={onRefresh}
                leftIcon={!refreshing ? <RefreshCw className="h-4 w-4" strokeWidth={2.1} /> : undefined}
              >
                Refresh
              </Button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <StatusPill tone={readyCount > 0 ? "success" : "neutral"}>
              {readyLabel}
            </StatusPill>
            <StatusPill tone={connectedCount > 0 ? "success" : "neutral"}>
              {connectedCount} connected
            </StatusPill>
            {activeLane ? (
              <StatusPill tone="success">Active lane</StatusPill>
            ) : (
              <StatusPill tone="neutral">No active lane</StatusPill>
            )}
          </div>
        </div>

        <div className="grid gap-2 bg-surface-subtle p-4">
          <MetricTile
            label="Ready lanes"
            value={`${readyCount}/${channelCount}`}
            tone={readyCount > 0 ? "success" : "neutral"}
          />
          <MetricTile
            label="Connected"
            value={connectedCount}
            tone={connectedCount > 0 ? "success" : "neutral"}
          />
          <MetricTile
            label="Primary lane"
            value={activeLane || "None"}
            tone={activeLane ? "brand" : "neutral"}
          />
        </div>
      </div>
    </Card>
  );
}

function ChannelCard({ channel, runtime, onInspect, onNavigate }) {
  const status = laneStatus(runtime);
  const primaryAction = runtime.deliveryReady
    ? () => onNavigate("/inbox")
    : () => onInspect(channel.id);

  return (
    <article className="group relative min-h-[250px] overflow-hidden rounded-md border border-line-soft bg-white transition-[border-color,box-shadow,transform] duration-base ease-premium hover:border-line hover:shadow-[0_24px_64px_-56px_rgba(15,23,42,0.62)]">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-surface-subtle">
        <div
          className={cx(
            "h-full w-1/2 rounded-r-full",
            status.tone === "success"
              ? "bg-success"
              : status.tone === "warning"
                ? "bg-warning"
                : "bg-[rgb(var(--color-text-soft))]"
          )}
        />
      </div>

      <div className="flex h-full flex-col px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-subtle">
              <div className="scale-[1.28] transform-gpu">
                <ChannelIcon channel={channel} size="md" />
              </div>
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-[17px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                {channel.name}
              </h2>

              <div className={cx("mt-1 flex items-center gap-2 text-[12.5px] font-semibold", textClass(status.tone))}>
                <span className={cx("h-1.5 w-1.5 rounded-full", dotClass(status.tone))} />
                {status.label}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-5 line-clamp-3 text-[13.5px] font-medium leading-6 text-text-muted">
          {s(runtime.summary) || channel.summary}
        </p>

        <div className="mt-5 grid gap-2 border-t border-line-soft pt-4 text-[12.5px] font-medium text-text-muted">
          <div className="flex items-center justify-between gap-3">
            <span>Backend status</span>
            <span className={cx("font-semibold", textClass(status.tone))}>
              {status.label}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Delivery</span>
            <span className={cx("font-semibold", runtime.deliveryReady ? "text-success" : "text-text-muted")}>
              {runtime.deliveryReady ? "Ready" : "Not ready"}
            </span>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <button
            type="button"
            onClick={() => onInspect(channel.id)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-[13px] font-semibold text-brand transition-colors duration-base ease-premium hover:bg-brand-soft"
          >
            Details
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.1} />
          </button>

          <Button
            type="button"
            size="sm"
            variant={runtime.deliveryReady ? "secondary" : "primary"}
            disabled={runtime.available === false}
            onClick={primaryAction}
            aria-label={status.action}
            rightIcon={<ArrowRight className="h-3.5 w-3.5" strokeWidth={2.1} />}
          >
            {status.action}
          </Button>
        </div>
      </div>
    </article>
  );
}

function CenterChannelModal({ open, onClose, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6">
      <style>
        {`
          @keyframes channelModalIn {
            from {
              opacity: 0;
              transform: translate3d(0, 10px, 0) scale(0.985);
            }
            to {
              opacity: 1;
              transform: translate3d(0, 0, 0) scale(1);
            }
          }
        `}
      </style>

      <button
        type="button"
        aria-label="Close connector details"
        className="absolute inset-0 bg-[rgba(15,23,42,0.38)] backdrop-blur-[4px]"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-[720px]"
        style={{
          animation: "channelModalIn 160ms cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "opacity, transform",
        }}
      >
        <button
          type="button"
          aria-label="Close connector details"
          onClick={onClose}
          className="absolute right-4 top-4 z-[95] inline-flex h-10 w-10 items-center justify-center rounded-md border border-line-soft bg-white text-text-muted shadow-[0_16px_38px_-28px_rgba(15,23,42,0.72)] transition-colors hover:border-line hover:text-text"
        >
          <X className="h-4 w-4" strokeWidth={2.1} />
        </button>

        <Card
          padded={false}
          clip
          className="h-[min(820px,calc(100vh-48px))] overflow-hidden shadow-[0_28px_86px_-50px_rgba(15,23,42,0.78)]"
        >
          <div className="h-full min-h-0">{children}</div>
        </Card>
      </div>
    </div>
  );
}

export default function ChannelCatalog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspace = useWorkspaceTenantKey();
  const launchRefreshToken = useLaunchSliceRefreshToken(
    workspace.tenantKey,
    workspace.ready
  );

  const [manualRefresh, setManualRefresh] = useState(0);
  const [readinessState, setReadinessState] = useState(EMPTY_READINESS_STATE);
  const [modalOpen, setModalOpen] = useState(false);
  const [closingChannel, setClosingChannel] = useState(null);
  const closeTimerRef = useRef(null);

  const selectedChannelId = searchParams.get("channel") || "";
  const selectedChannel = useMemo(
    () => findChannelById(selectedChannelId),
    [selectedChannelId]
  );
  const modalChannel = selectedChannel || closingChannel;

  const requestKey = useMemo(() => {
    if (!workspace.ready) return "";
    return `${s(workspace.tenantKey)}:${String(launchRefreshToken ?? "")}:${manualRefresh}`;
  }, [launchRefreshToken, manualRefresh, workspace.ready, workspace.tenantKey]);

  const channels = useMemo(() => launchChannels(), []);

  useEffect(() => {
    if (!workspace.ready) return undefined;

    let alive = true;
    const tenantKey = workspace.tenantKey;
    const currentRequestKey = requestKey;

    getLaunchPosture()
      .then((posture) => {
        if (!alive) return;

        setReadinessState(
          buildReadinessStateFromPosture({
            tenantKey,
            requestKey: currentRequestKey,
            posture,
          })
        );
      })
      .catch((error) => {
        if (!alive) return;

        setReadinessState(
          buildReadinessStateFromPosture({
            tenantKey,
            requestKey: currentRequestKey,
            error: s(
              error?.message ||
                error ||
                "Channel state could not be loaded."
            ),
          })
        );
      });

    return () => {
      alive = false;
    };
  }, [requestKey, workspace.ready, workspace.tenantKey]);

  useEffect(() => {
    if (!selectedChannel) return undefined;

    const raf = window.requestAnimationFrame(() => {
      setModalOpen(true);
    });

    return () => window.cancelAnimationFrame(raf);
  }, [selectedChannel]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const effectiveReadinessState = useMemo(() => {
    if (!workspace.ready) {
      return {
        ...EMPTY_READINESS_STATE,
        loading: false,
      };
    }

    if (
      readinessState.tenantKey !== workspace.tenantKey ||
      readinessState.requestKey !== requestKey
    ) {
      return {
        ...readinessState,
        tenantKey: workspace.tenantKey,
        requestKey,
        loading: true,
      };
    }

    return readinessState;
  }, [readinessState, requestKey, workspace.ready, workspace.tenantKey]);

  const activeLane = useMemo(
    () => connectedLaneName(effectiveReadinessState, channels),
    [channels, effectiveReadinessState]
  );

  const updateSelectedChannel = useCallback((channelId = "") => {
    const nextParams = new URLSearchParams(searchParams);

    if (channelId) {
      nextParams.set("channel", channelId);
    } else {
      nextParams.delete("channel");
    }

    setSearchParams(nextParams);
  }, [searchParams, setSearchParams]);

  const handleModalClose = useCallback(() => {
    if (!modalChannel) {
      updateSelectedChannel("");
      return;
    }

    setClosingChannel(modalChannel);
    setModalOpen(false);

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      setClosingChannel(null);
      updateSelectedChannel("");
      closeTimerRef.current = null;
    }, 180);
  }, [modalChannel, updateSelectedChannel]);

  function refresh() {
    setManualRefresh((value) => value + 1);
  }

  useEffect(() => {
    if (!modalOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("channel");
        setClosingChannel(null);
        setModalOpen(false);
        setSearchParams(nextParams);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [modalOpen, searchParams, setSearchParams]);

  if (!workspace.ready || effectiveReadinessState.loading) {
    return (
      <PageCanvas className="max-w-[1180px] py-3">
        <LoadingSurface title="Loading channels" />
      </PageCanvas>
    );
  }

  return (
    <>
      <PageCanvas className="max-w-[1180px] space-y-4 py-3">
        {s(effectiveReadinessState.error) ? (
          <InlineNotice
            tone="danger"
            title="Channels unavailable"
            description={effectiveReadinessState.error}
            compact
          />
        ) : null}

        <Header
          activeLane={activeLane}
          readinessState={effectiveReadinessState}
          channelCount={channels.length}
          refreshing={effectiveReadinessState.loading}
          onRefresh={refresh}
          onNavigate={navigate}
        />

        {launchRepairCopy(effectiveReadinessState) ? (
          <div className="sr-only">{launchRepairCopy(effectiveReadinessState)}</div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              runtime={runtimeFor(channel, effectiveReadinessState)}
              onInspect={updateSelectedChannel}
              onNavigate={navigate}
            />
          ))}
        </div>
      </PageCanvas>

      {modalChannel ? (
        <CenterChannelModal open={modalOpen} onClose={handleModalClose}>
          <ChannelDetailDrawer
            channel={modalChannel}
            open={modalOpen}
            onClose={handleModalClose}
            onNavigate={navigate}
          />
        </CenterChannelModal>
      ) : null}
    </>
  );
}
