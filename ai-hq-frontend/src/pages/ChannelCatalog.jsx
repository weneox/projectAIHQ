import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { getLaunchPosture } from "../api/launch.js";
import ChannelDetailDrawer from "../components/channels/ChannelDetailDrawer.jsx";
import ChannelIcon from "../components/channels/ChannelIcon.jsx";
import useWorkspaceTenantKey from "../hooks/useWorkspaceTenantKey.js";
import { CHANNELS } from "../components/channels/channelCatalogModel.js";
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
    ["website", "instagram"].includes(channel.id)
  );
}

function findLaunchChannelById(channelId = "") {
  const id = s(channelId);
  if (!id) return null;
  return launchChannels().find((channel) => channel.id === id) || null;
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

function ChannelCard({ channel, runtime, onInspect, onNavigate }) {
  const status = laneStatus(runtime);
  const primaryAction = runtime.deliveryReady
    ? () => onNavigate("/inbox")
    : () => onInspect(channel.id);

  return (
    <article className="group relative min-h-[268px] overflow-hidden rounded-md border border-line-soft bg-white shadow-[0_20px_54px_-48px_rgba(15,23,42,0.56)] transition-[border-color,box-shadow,transform] duration-base ease-premium hover:-translate-y-0.5 hover:border-line hover:shadow-[0_30px_74px_-56px_rgba(15,23,42,0.68)]">
      <div
        className={cx(
          "absolute inset-x-0 top-0 h-[3px]",
          status.tone === "success"
            ? "bg-success"
            : status.tone === "warning"
              ? "bg-warning"
              : "bg-line"
        )}
      />

      <div className="flex h-full flex-col px-5 py-5">
        <div className="flex items-start gap-4">
          <div className="flex h-[66px] w-[66px] shrink-0 items-center justify-center">
            <div className="scale-[1.58] transform-gpu">
              <ChannelIcon channel={channel} size="lg" />
            </div>
          </div>

          <div className="min-w-0 pt-1">
            <h2 className="truncate text-[19px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
              {channel.name}
            </h2>

            <div
              className={cx(
                "mt-2 inline-flex items-center gap-2 text-[13px] font-semibold",
                textClass(status.tone)
              )}
            >
              <span className={cx("h-1.5 w-1.5 rounded-full", dotClass(status.tone))} />
              {status.label}
            </div>
          </div>
        </div>

        <p className="mt-5 line-clamp-2 text-[13.5px] font-medium leading-6 text-text-muted">
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
            className="inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-[13px] font-semibold text-brand transition-colors duration-base ease-premium hover:bg-brand-soft"
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
        className="absolute inset-0 bg-[rgba(15,23,42,0.46)] backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-[720px]"
        style={{
          animation: "channelModalIn 160ms cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "opacity, transform",
        }}
      >
        <div className="h-[min(560px,calc(100vh-120px))] overflow-hidden rounded-md border border-white/70 bg-surface shadow-[0_34px_90px_-54px_rgba(15,23,42,0.86)]">
          {children}
        </div>
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
  const [readinessState, setReadinessState] = useState(EMPTY_READINESS_STATE);
  const [modalOpen, setModalOpen] = useState(false);
  const [closingChannel, setClosingChannel] = useState(null);
  const closeTimerRef = useRef(null);

  const selectedChannelId = searchParams.get("channel") || "";
  const selectedChannel = useMemo(
    () => findLaunchChannelById(selectedChannelId),
    [selectedChannelId]
  );
  const modalChannel = selectedChannel || closingChannel;

  const requestKey = useMemo(() => {
    if (!workspace.ready) return "";
    return `${s(workspace.tenantKey)}:${String(launchRefreshToken ?? "")}`;
  }, [launchRefreshToken, workspace.ready, workspace.tenantKey]);

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
        <LoadingSurface title="Loading channels" description="Reading live channel readiness from launch posture." />
      </PageCanvas>
    );
  }

  return (
    <>
      <PageCanvas className="max-w-[1120px] space-y-4 py-3">
        {s(effectiveReadinessState.error) ? (
          <InlineNotice
            tone="danger"
            title="Channels unavailable"
            description={effectiveReadinessState.error}
            compact
          />
        ) : null}

        <h1 className="sr-only">Launch channels</h1>

        <div className="sr-only">
          {n(effectiveReadinessState?.channelSummary?.readyCount)}/{channels.length} ready
          {" "}
          {n(effectiveReadinessState?.channelSummary?.connectedCount)} connected
        </div>

        {launchRepairCopy(effectiveReadinessState) ? (
          <div className="sr-only">{launchRepairCopy(effectiveReadinessState)}</div>
        ) : null}

        <div className="grid gap-4 xl:gap-5 md:grid-cols-3">
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
