import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import {
  getMetaChannelStatus,
  getTelegramChannelStatus,
  getWebsiteWidgetStatus,
} from "../api/channelConnect.js";
import { getSettingsTrustView } from "../api/trust.js";
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
import Badge from "../components/ui/Badge.jsx";
import { s } from "../lib/appUi.js";
import {
  buildMetaLaunchChannelState,
  buildTelegramLaunchChannelState,
  buildWebsiteLaunchChannelState,
  buildTruthOperationalState,
} from "../lib/readinessViewModel.js";
import { useLaunchSliceRefreshToken } from "../lib/launchSliceRefresh.js";
import globeIcon from "../assets/channels/globe.png";

const EMPTY_READINESS_STATE = {
  tenantKey: "",
  requestKey: "",
  loading: true,
  error: "",
  meta: null,
  telegram: null,
  website: null,
  truth: null,
};

const CONNECTOR_COPY = {
  website: {
    summary: "Website chat is configured in design mode.",
  },
  instagram: {
    summary: "Instagram is available for design preview.",
  },
  telegram: {
    summary: "Telegram is connected in design mode.",
  },
};

function resolveLaunchChannels() {
  return CHANNELS.filter((channel) =>
    ["website", "instagram", "telegram"].includes(channel.id)
  );
}

function buildRuntimeMeta(channel, readinessState) {
  if (channel.id === "instagram") return readinessState.meta;
  if (channel.id === "telegram") return readinessState.telegram;
  if (channel.id === "website") return readinessState.website;
  return null;
}

function normalizeStatus(runtime = null) {
  const raw = s(runtime?.statusLabel).toLowerCase();

  if (runtime?.connected === true && runtime?.deliveryReady === true) {
    return {
      label: "Connected",
      tone: "success",
      connected: true,
      deliveryReady: true,
      blocked: false,
    };
  }

  if (runtime?.connected === true) {
    return {
      label: "Needs attention",
      tone: "warning",
      connected: true,
      deliveryReady: false,
      blocked: true,
    };
  }

  if (
    raw.includes("blocked") ||
    raw.includes("reconnect") ||
    raw.includes("repair") ||
    raw.includes("required")
  ) {
    return {
      label: "Needs attention",
      tone: "warning",
      connected: false,
      deliveryReady: false,
      blocked: true,
    };
  }

  if (raw.includes("connecting") || raw.includes("pending")) {
    return {
      label: "Connecting",
      tone: "neutral",
      connected: false,
      deliveryReady: false,
      blocked: false,
    };
  }

  return {
    label: "Available",
    tone: "neutral",
    connected: false,
    deliveryReady: false,
    blocked: false,
  };
}

function resolveTruthReady(truth = null) {
  return s(truth?.status).toLowerCase() === "ready";
}

function resolvePrimaryAction(channel, runtime) {
  const status = normalizeStatus(runtime);

  if (status.connected && status.deliveryReady) {
    return { label: "Inbox", mode: "inbox" };
  }

  if (status.blocked) {
    return { label: "Fix", mode: "details" };
  }

  return { label: "Connect", mode: "details" };
}

function statusDotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "info" || tone === "brand") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

function ChannelVisual({ channel }) {
  if (channel.id === "website") {
    return (
      <div className="flex h-[98px] w-[98px] items-center justify-center">
        <img
          src={globeIcon}
          alt="Website"
          className="h-[72px] w-[72px] translate-y-[2px] select-none object-contain transform-gpu"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[98px] w-[98px] items-center justify-center">
      <div className="scale-[2.3] translate-y-[2px] transform-gpu">
        <ChannelIcon channel={channel} size="md" />
      </div>
    </div>
  );
}

function CompactHeader({
  availableCount,
  readyCount,
  truthReady,
  hasDeliveryReadyLaunchChannel,
  onOpenTruth,
  onOpenInbox,
}) {
  return (
    <section className="pb-4">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            Channels
          </div>

          <h1 className="font-display text-[24px] font-semibold leading-[var(--line-title)] tracking-[var(--tracking-tight-lg)] text-text">
            Launch channels
          </h1>

          <div className="mt-2 text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text-muted">
            {readyCount}/{availableCount} ready
            {!truthReady ? (
              <span className="ml-2 text-warning">/ truth pending approval</span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={onOpenTruth}>
            Open truth
          </Button>

          <Button
            size="sm"
            disabled={!hasDeliveryReadyLaunchChannel}
            onClick={onOpenInbox}
            rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
          >
            Open inbox
          </Button>
        </div>
      </div>
    </section>
  );
}

function ChannelCard({ channel, runtime, onInspect, onRunPrimaryAction }) {
  const copy = CONNECTOR_COPY[channel.id] || CONNECTOR_COPY.website;
  const status = normalizeStatus(runtime);
  const action = resolvePrimaryAction(channel, runtime);
  const summary = s(runtime?.summary || copy.summary) || copy.summary;

  return (
    <Card
      variant="surface"
      padded={false}
      clip
      outerClassName="group min-h-[184px]"
      innerClassName="min-h-[184px]"
    >
      <div className="relative flex min-h-[184px] flex-col px-5 py-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.98),transparent)]" />
        <div className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(15,23,42,0.06),transparent)]" />

        <div className="absolute right-5 top-5 z-[2]">
          <Badge tone={status.tone} size="sm">
            <span className={["mr-1 h-1.5 w-1.5 rounded-full", statusDotClass(status.tone)].join(" ")} />
            {status.label}
          </Badge>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="grid grid-cols-[108px_minmax(0,1fr)] items-center gap-4 pr-[122px]">
            <ChannelVisual channel={channel} />

            <div className="flex min-h-[98px] min-w-0 flex-col justify-center pt-[5px]">
              <h2 className="truncate text-[18px] font-semibold leading-[1.12] tracking-[var(--tracking-tight-lg)] text-text">
                {channel.name}
              </h2>

              <p className="mt-[6px] line-clamp-2 max-w-[290px] text-[14px] font-semibold leading-[1.46] tracking-[var(--tracking-tight-sm)] text-text-muted">
                {summary}
              </p>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => onInspect?.(channel.id)}
              className="inline-flex h-9 items-center gap-1.5 text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-brand transition-colors duration-base ease-premium hover:text-text"
            >
              <span>Details</span>
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.1} />
            </button>

            <Button
              size="sm"
              onClick={() => onRunPrimaryAction?.(channel, action)}
              rightIcon={<ArrowRight className="h-3.5 w-3.5" strokeWidth={2.1} />}
            >
              {action.label}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function ChannelCatalog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspace = useWorkspaceTenantKey();
  const refreshToken = useLaunchSliceRefreshToken(
    workspace.tenantKey,
    workspace.ready
  );

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

  const currentReadinessRequestKey = useMemo(() => {
    if (!workspace.ready) return "";
    return `${s(workspace.tenantKey)}:${String(refreshToken ?? "")}`;
  }, [refreshToken, workspace.ready, workspace.tenantKey]);

  useEffect(() => {
    if (!workspace.ready) return undefined;

    let alive = true;
    const tenantKey = workspace.tenantKey;
    const requestKey = currentReadinessRequestKey;

    Promise.allSettled([
      getMetaChannelStatus(),
      getTelegramChannelStatus(),
      getWebsiteWidgetStatus(),
      getSettingsTrustView({ limit: 4 }),
    ])
      .then((results) => {
        if (!alive) return;

        const meta =
          results[0].status === "fulfilled"
            ? buildMetaLaunchChannelState(results[0].value)
            : buildMetaLaunchChannelState({});
        const telegram =
          results[1].status === "fulfilled"
            ? buildTelegramLaunchChannelState(results[1].value)
            : buildTelegramLaunchChannelState({});
        const website =
          results[2].status === "fulfilled"
            ? buildWebsiteLaunchChannelState(results[2].value)
            : buildWebsiteLaunchChannelState({});
        const truth =
          results[3].status === "fulfilled"
            ? buildTruthOperationalState(results[3].value)
            : buildTruthOperationalState(null);

        setReadinessState({
          tenantKey,
          requestKey,
          loading: false,
          error: "",
          meta,
          telegram,
          website,
          truth,
        });
      })
      .catch((error) => {
        if (!alive) return;

        setReadinessState({
          tenantKey,
          requestKey,
          loading: false,
          error: s(
            error?.message || error || "Channel readiness could not be loaded."
          ),
          meta: buildMetaLaunchChannelState({}),
          telegram: buildTelegramLaunchChannelState({}),
          website: buildWebsiteLaunchChannelState({}),
          truth: buildTruthOperationalState(null),
        });
      });

    return () => {
      alive = false;
    };
  }, [currentReadinessRequestKey, workspace.ready, workspace.tenantKey]);

  const effectiveReadinessState = useMemo(() => {
    if (!workspace.ready) {
      return {
        ...EMPTY_READINESS_STATE,
        loading: false,
      };
    }

    if (readinessState.tenantKey !== workspace.tenantKey) {
      return {
        ...EMPTY_READINESS_STATE,
        tenantKey: workspace.tenantKey,
        requestKey: currentReadinessRequestKey,
        loading: true,
      };
    }

    if (readinessState.requestKey !== currentReadinessRequestKey) {
      return {
        ...readinessState,
        requestKey: currentReadinessRequestKey,
        loading: true,
        error: "",
      };
    }

    return readinessState;
  }, [
    currentReadinessRequestKey,
    readinessState,
    workspace.ready,
    workspace.tenantKey,
  ]);

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

  const launchChannels = useMemo(() => resolveLaunchChannels(), []);

  const readyCount = useMemo(() => {
    const items = [
      effectiveReadinessState.website,
      effectiveReadinessState.meta,
      effectiveReadinessState.telegram,
    ];

    return items.reduce(
      (sum, item) =>
        item?.connected === true && item?.deliveryReady === true ? sum + 1 : sum,
      0
    );
  }, [
    effectiveReadinessState.website,
    effectiveReadinessState.meta,
    effectiveReadinessState.telegram,
  ]);

  const hasDeliveryReadyLaunchChannel = readyCount > 0;
  const truthReady = resolveTruthReady(effectiveReadinessState.truth);

  function updateSelectedChannel(channelId = "") {
    const nextParams = new URLSearchParams(searchParams);

    if (channelId) {
      nextParams.set("channel", channelId);
    } else {
      nextParams.delete("channel");
    }

    setSearchParams(nextParams);
  }

  function handlePrimaryAction(channel, action) {
    if (!channel?.id) return;

    if (action?.mode === "inbox") {
      navigate("/inbox");
      return;
    }

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setClosingChannel(null);
    updateSelectedChannel(channel.id);
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

  if (!workspace.ready || effectiveReadinessState.loading) {
    return (
      <PageCanvas className="max-w-[1520px] py-2">
        <LoadingSurface title="Loading channels" />
      </PageCanvas>
    );
  }

  return (
    <>
      <PageCanvas className="max-w-[1520px] py-2">
        <div className="space-y-4">
          {s(effectiveReadinessState.error) ? (
            <InlineNotice
              tone="danger"
              title="Channel readiness unavailable"
              description={effectiveReadinessState.error}
              compact
            />
          ) : null}

          {hasDeliveryReadyLaunchChannel && !truthReady ? (
            <InlineNotice
              tone="warning"
              title="A channel is connected, but truth still needs approval."
              description="Approve truth before relying on live AI replies."
              compact
            />
          ) : null}

          <CompactHeader
            truthReady={truthReady}
            readyCount={readyCount}
            availableCount={launchChannels.length}
            hasDeliveryReadyLaunchChannel={hasDeliveryReadyLaunchChannel}
            onOpenTruth={() => navigate("/truth")}
            onOpenInbox={() => navigate("/inbox")}
          />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {launchChannels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                runtime={buildRuntimeMeta(channel, effectiveReadinessState)}
                onInspect={updateSelectedChannel}
                onRunPrimaryAction={handlePrimaryAction}
              />
            ))}
          </div>
        </div>
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