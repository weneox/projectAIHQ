import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight, RefreshCw } from "lucide-react";

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
  SlidingDetailOverlay,
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
        website: normalizePostureChannel("website"),
        instagram: normalizePostureChannel("instagram"),
        telegram: normalizePostureChannel("telegram"),
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
  };
}

function runtimeFor(channel, readinessState) {
  return obj(readinessState.channels)[channel.id] || normalizePostureChannel(channel.id);
}

function laneStatus(runtime = {}) {
  if (runtime.deliveryReady) {
    return {
      label: "Active",
      tone: "success",
      body: "This lane can receive customer conversations.",
      action: "Manage",
    };
  }

  if (runtime.needsReview) {
    return {
      label: "Review",
      tone: "warning",
      body: "This lane is attached and needs a quick review.",
      action: "Review",
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
    action: "Details",
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

function Header({ activeLane, refreshing, onRefresh }) {
  return (
    <div className="flex flex-col gap-4 border-b border-line-soft px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-brand">Channels</div>
        <h1 className="mt-1 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
          Customer lanes
        </h1>
        <p className="mt-2 max-w-[680px] text-[13.5px] font-medium leading-6 text-text-muted">
          Pick the channel you want to use with customers. Unused lanes can stay quiet.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {activeLane ? (
          <span className="inline-flex h-9 items-center gap-2 rounded-full bg-success-soft px-3 text-[12px] font-semibold text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {activeLane}
          </span>
        ) : (
          <span className="inline-flex h-9 items-center gap-2 rounded-full bg-surface-subtle px-3 text-[12px] font-semibold text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--color-text-soft))]" />
            No active lane yet
          </span>
        )}

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
  );
}
function ChannelCard({ channel, runtime, onInspect }) {
  const status = laneStatus(runtime);
  const actionLabel = runtime.deliveryReady
    ? "Manage"
    : runtime.needsReview
      ? "Review"
      : "Choose";

  return (
    <div className="flex min-h-[230px] flex-col px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center">
            <div className="scale-[1.35] transform-gpu">
              <ChannelIcon channel={channel} size="md" />
            </div>
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              {channel.name}
            </h2>

            <div className={cx("mt-1 flex items-center gap-2 text-[12px] font-semibold", textClass(status.tone))}>
              <span className={cx("h-1.5 w-1.5 rounded-full", dotClass(status.tone))} />
              {status.label}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-5 line-clamp-3 text-[13.5px] font-medium leading-6 text-text-muted">
        {s(runtime.summary) || channel.summary}
      </p>

      <div className="mt-auto pt-5">
        <button
          type="button"
          onClick={() => onInspect(channel.id)}
          className="inline-flex h-9 items-center gap-2 rounded-full bg-brand px-4 text-[13px] font-semibold text-white shadow-[0_16px_36px_-24px_rgba(37,99,235,0.75)] transition-all duration-base ease-premium hover:-translate-y-px"
        >
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.1} />
        </button>
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [closingChannel, setClosingChannel] = useState(null);
  const closeTimerRef = useRef(null);

  const selectedChannelId = searchParams.get("channel") || "";
  const selectedChannel = useMemo(
    () => findChannelById(selectedChannelId),
    [selectedChannelId]
  );
  const drawerChannel = selectedChannel || closingChannel;

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
      setDrawerOpen(true);
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

  function updateSelectedChannel(channelId = "") {
    const nextParams = new URLSearchParams(searchParams);

    if (channelId) {
      nextParams.set("channel", channelId);
    } else {
      nextParams.delete("channel");
    }

    setSearchParams(nextParams);
  }

  function handleDrawerClose() {
    if (!drawerChannel) {
      updateSelectedChannel("");
      return;
    }

    setClosingChannel(drawerChannel);
    setDrawerOpen(false);

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      setClosingChannel(null);
      updateSelectedChannel("");
      closeTimerRef.current = null;
    }, 320);
  }

  function refresh() {
    setManualRefresh((value) => value + 1);
  }

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

        <Card
          padded={false}
          clip
          className="shadow-[0_28px_80px_-64px_rgba(15,23,42,0.55)]"
        >
          <Header
            activeLane={activeLane}
            refreshing={effectiveReadinessState.loading}
            onRefresh={refresh}
          />

          <div className="grid divide-y divide-line-soft md:grid-cols-3 md:divide-x md:divide-y-0">
            {channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                runtime={runtimeFor(channel, effectiveReadinessState)}
                onInspect={updateSelectedChannel}
              />
            ))}
          </div>
        </Card>
      </PageCanvas>

      {drawerChannel ? (
        <SlidingDetailOverlay
          open={drawerOpen}
          onClose={handleDrawerClose}
          closeLabel="Close connector details"
          className="top-[56px]"
          panelWidthClassName="max-w-[640px]"
          backdropClassName="bg-transparent"
          panelClassName="bg-white shadow-[0_24px_80px_-38px_rgba(15,23,42,0.35)]"
        >
          <ChannelDetailDrawer
            channel={drawerChannel}
            open={drawerOpen}
            onClose={handleDrawerClose}
            onNavigate={navigate}
          />
        </SlidingDetailOverlay>
      ) : null}
    </>
  );
}