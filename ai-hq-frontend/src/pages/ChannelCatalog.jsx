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
import Button from "../components/ui/Button.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
  SlidingDetailOverlay,
} from "../components/ui/AppShellPrimitives.jsx";
import { compactSentence, s } from "../lib/appUi.js";
import {
  buildMetaLaunchChannelState,
  buildTelegramLaunchChannelState,
  buildWebsiteLaunchChannelState,
  buildTruthOperationalState,
} from "../lib/readinessViewModel.js";
import { useLaunchSliceRefreshToken } from "../lib/launchSliceRefresh.js";

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
    eyebrow: "Website",
    title: "Approved site chat",
    summary: "Customer conversations from approved site origins.",
  },
  instagram: {
    eyebrow: "Instagram",
    title: "Instagram inbox",
    summary: "Customer DMs from the connected business account.",
  },
  telegram: {
    eyebrow: "Telegram",
    title: "Telegram chat",
    summary: "Private chat intake.",
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
      textClass: "text-[rgba(22,163,74,0.96)]",
      dotClass: "bg-[rgba(22,163,74,0.96)]",
      connected: true,
      deliveryReady: true,
      blocked: false,
    };
  }

  if (runtime?.connected === true) {
    return {
      label: "Delivery blocked",
      textClass: "text-[rgba(180,83,9,0.96)]",
      dotClass: "bg-[rgba(245,158,11,0.96)]",
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
      textClass: "text-[rgba(180,83,9,0.96)]",
      dotClass: "bg-[rgba(245,158,11,0.96)]",
      connected: false,
      deliveryReady: false,
      blocked: true,
    };
  }

  if (raw.includes("connecting") || raw.includes("pending")) {
    return {
      label: "Connecting",
      textClass: "text-[rgba(180,83,9,0.96)]",
      dotClass: "bg-[rgba(245,158,11,0.96)]",
      connected: false,
      deliveryReady: false,
      blocked: false,
    };
  }

  return {
    label: "Available",
    textClass: "text-[rgba(100,116,139,0.96)]",
    dotClass: "bg-[rgba(148,163,184,0.96)]",
    connected: false,
    blocked: false,
  };
}

function resolveTruthReady(truth = null) {
  return s(truth?.status).toLowerCase() === "ready";
}

function resolveChannelPrimaryAction(channel, runtime) {
  const status = normalizeStatus(runtime);

  if (status.connected && status.deliveryReady) {
    return {
      label: "Open inbox",
      mode: "inbox",
    };
  }

  if (status.blocked) {
    return {
      label: "Fix",
      mode: "details",
    };
  }

  return {
    label: "Connect",
    mode: "details",
  };
}

function CompactHeader({
  truthReady,
  readyCount,
  availableCount,
  hasDeliveryReadyLaunchChannel,
  onOpenTruth,
  onOpenInbox,
}) {
  return (
    <section className="pb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(100,116,139,0.96)]">
              Channels
            </span>

            {!truthReady ? (
              <span className="text-[11px] font-medium text-[rgba(180,83,9,0.96)]">
                / Truth pending approval
              </span>
            ) : null}
          </div>

          <h1 className="text-[22px] font-semibold tracking-[-0.035em] text-[rgba(15,23,42,0.96)] md:text-[24px]">
            Launch channels
          </h1>

          <div className="mt-2 text-[13px] leading-6 text-[rgba(100,116,139,0.96)]">
            {availableCount} available / {readyCount} ready
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onOpenTruth}
            className="!h-10 !rounded-[8px] !px-4"
          >
            Open truth
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onOpenInbox}
            rightIcon={<ArrowRight className="h-4 w-4" />}
            disabled={!hasDeliveryReadyLaunchChannel}
            className="!h-10 !rounded-[8px] !px-4"
          >
            Open inbox
          </Button>
        </div>
      </div>
    </section>
  );
}

function CardPrimaryButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex h-9 min-w-[118px] items-center justify-center gap-2 rounded-[8px]",
        "bg-[rgb(var(--color-brand))] px-4",
        "text-[12.5px] font-semibold tracking-[-0.015em] text-white",
        "shadow-[0_16px_30px_-22px_rgba(46,96,255,0.62)]",
        "transition-[background-color,box-shadow,transform] duration-200 ease-out",
        "hover:-translate-y-[1px] hover:bg-[rgb(var(--color-brand-strong))]",
        "hover:shadow-[0_20px_36px_-22px_rgba(46,96,255,0.72)]",
        "active:translate-y-0",
      ].join(" ")}
    >
      <span>{children}</span>
      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.1} />
    </button>
  );
}

function ConnectorCard({
  channel,
  runtime,
  onInspect,
  onRunPrimaryAction,
}) {
  const copy = CONNECTOR_COPY[channel.id] || CONNECTOR_COPY.website;
  const status = normalizeStatus(runtime);
  const action = resolveChannelPrimaryAction(channel, runtime);
  const statusSummary = compactSentence(
    runtime?.summary || copy.summary,
    copy.summary
  );

  return (
    <article
      className={[
        "group relative min-h-[198px] overflow-hidden rounded-[10px]",
        "bg-white px-5 py-5",
        "shadow-[0_22px_55px_-46px_rgba(15,23,42,0.42)]",
        "ring-1 ring-white",
        "transition-[box-shadow,transform] duration-200 ease-out",
        "hover:-translate-y-[2px]",
        "hover:shadow-[0_34px_82px_-48px_rgba(15,23,42,0.34)]",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white" />

      <div className="relative z-[1] flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="shrink-0 rounded-[9px] bg-white shadow-[0_12px_26px_-22px_rgba(15,23,42,0.22)] ring-1 ring-[rgba(15,23,42,0.04)]">
              <ChannelIcon channel={channel} size="lg" />
            </div>

            <div className="min-w-0 pt-0.5">
              <div className="truncate text-[15px] font-semibold tracking-[-0.018em] text-[rgba(15,23,42,0.96)]">
                {channel.name}
              </div>

              <div className="mt-0.5 truncate text-[12.5px] font-medium text-[rgba(100,116,139,0.96)]">
                {copy.eyebrow}
              </div>
            </div>
          </div>

          <div
            className={[
              "mt-0.5 inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold",
              status.textClass,
            ].join(" ")}
          >
            <span className={["h-1.5 w-1.5 rounded-full", status.dotClass].join(" ")} />
            <span>{status.label}</span>
          </div>
        </div>

        <div className="mt-5 h-px bg-[rgba(15,23,42,0.06)]" />

        <div className="mt-4">
          <div className="text-[13.5px] font-semibold tracking-[-0.01em] text-[rgba(15,23,42,0.94)]">
            {copy.title}
          </div>

          <div className="mt-1.5 line-clamp-2 text-[12.5px] font-medium leading-6 text-[rgba(100,116,139,0.96)]">
            {statusSummary}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <button
            type="button"
            onClick={() => onInspect?.(channel.id)}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[rgba(37,99,235,0.96)] transition-colors hover:text-[rgba(15,23,42,0.94)]"
          >
            <span>Details</span>
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.1} />
          </button>

          <CardPrimaryButton onClick={() => onRunPrimaryAction?.(channel, action)}>
            {action.label}
          </CardPrimaryButton>
        </div>
      </div>
    </article>
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
      <PageCanvas className="max-w-[1220px] py-2">
        <LoadingSurface title="Loading channels" />
      </PageCanvas>
    );
  }

  return (
    <>
      <PageCanvas className="max-w-[1220px] space-y-4 py-2">
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

        <div className="grid gap-4 lg:grid-cols-3">
          {launchChannels.map((channel) => (
            <ConnectorCard
              key={channel.id}
              channel={channel}
              runtime={buildRuntimeMeta(channel, effectiveReadinessState)}
              onInspect={updateSelectedChannel}
              onRunPrimaryAction={handlePrimaryAction}
            />
          ))}
        </div>
      </PageCanvas>

      {drawerChannel ? (
        <SlidingDetailOverlay
          open={drawerOpen}
          onClose={handleDrawerClose}
          closeLabel="Close connector details"
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
