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
import { s } from "../lib/appUi.js";
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
    summary:
      "Website chat is configured with approved origin and trusted runtime delivery.",
  },
  instagram: {
    eyebrow: "Instagram",
    title: "Instagram inbox",
    summary: "Instagram DM automation is ready.",
  },
  telegram: {
    eyebrow: "Telegram",
    title: "Telegram chat",
    summary: "Telegram bot, webhook, and tenant runtime are ready for live delivery.",
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
      label: "Delivery blocked",
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
      tone: "muted",
      connected: false,
      deliveryReady: false,
      blocked: false,
    };
  }

  return {
    label: "Available",
    tone: "muted",
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
    return { label: "Open inbox", mode: "inbox" };
  }

  if (status.blocked) {
    return { label: "Fix", mode: "details" };
  }

  return { label: "Connect", mode: "details" };
}

function statusToneClasses(tone) {
  if (tone === "success") {
    return {
      dot: "bg-[rgba(22,163,74,0.96)]",
      text: "text-[rgba(22,163,74,0.96)]",
    };
  }

  if (tone === "warning") {
    return {
      dot: "bg-[rgba(245,158,11,0.96)]",
      text: "text-[rgba(180,83,9,0.96)]",
    };
  }

  return {
    dot: "bg-[rgba(148,163,184,0.96)]",
    text: "text-[rgba(100,116,139,0.96)]",
  };
}

function TopActionButton({
  children,
  primary = false,
  disabled = false,
  onClick,
  icon = null,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex h-11 items-center justify-center gap-2 px-5",
        "rounded-[10px] text-[13px] font-semibold tracking-[-0.01em]",
        "transition-all duration-200 ease-out",
        primary
          ? [
              "bg-[rgb(var(--color-brand))] text-white",
              "shadow-[0_16px_34px_-20px_rgba(46,96,255,0.65)]",
              "hover:-translate-y-[1px] hover:bg-[rgb(var(--color-brand-strong))]",
              "hover:shadow-[0_18px_36px_-18px_rgba(46,96,255,0.72)]",
            ].join(" ")
          : [
              "bg-white text-[rgba(15,23,42,0.96)]",
              "shadow-[0_16px_34px_-24px_rgba(15,23,42,0.24)]",
              "hover:-translate-y-[1px] hover:shadow-[0_18px_36px_-22px_rgba(15,23,42,0.28)]",
            ].join(" "),
        disabled
          ? "cursor-not-allowed opacity-50 hover:translate-y-0 hover:shadow-[0_16px_34px_-24px_rgba(15,23,42,0.18)]"
          : "",
      ].join(" ")}
    >
      <span>{children}</span>
      {icon}
    </button>
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
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(100,116,139,0.92)]">
            Channels
          </div>

          <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.98)] md:text-[24px]">
            Launch channels
          </h1>

          <div className="mt-2 text-[13px] font-medium text-[rgba(100,116,139,0.96)]">
            {availableCount} available / {readyCount} ready
            {!truthReady ? (
              <span className="ml-2 text-[rgba(180,83,9,0.96)]">
                / truth pending approval
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <TopActionButton onClick={onOpenTruth}>Open truth</TopActionButton>

          <TopActionButton
            primary
            disabled={!hasDeliveryReadyLaunchChannel}
            onClick={onOpenInbox}
            icon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
          >
            Open inbox
          </TopActionButton>
        </div>
      </div>
    </section>
  );
}

function ChannelCard({ channel, runtime, onInspect, onRunPrimaryAction }) {
  const copy = CONNECTOR_COPY[channel.id] || CONNECTOR_COPY.website;
  const status = normalizeStatus(runtime);
  const action = resolvePrimaryAction(channel, runtime);
  const tone = statusToneClasses(status.tone);
  const summary = s(runtime?.summary || copy.summary) || copy.summary;

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-[10px] bg-white",
        "px-6 py-5",
        "shadow-[0_14px_30px_-22px_rgba(15,23,42,0.18)]",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-[2px] hover:shadow-[0_26px_48px_-24px_rgba(15,23,42,0.24)]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="mt-0.5 shrink-0">
            <ChannelIcon channel={channel} size="lg" />
          </div>

          <div className="min-w-0">
            <div className="text-[14px] font-semibold leading-5 tracking-[-0.015em] text-[rgba(15,23,42,0.98)]">
              {channel.name}
            </div>

            <div className="mt-1 text-[12px] font-medium leading-5 text-[rgba(100,116,139,0.96)]">
              {copy.eyebrow}
            </div>

            <div className="mt-3 text-[13px] font-semibold leading-5 tracking-[-0.01em] text-[rgba(15,23,42,0.96)]">
              {copy.title}
            </div>

            <div className="mt-1.5 max-w-[460px] text-[12.5px] font-medium leading-6 text-[rgba(100,116,139,0.96)]">
              {summary}
            </div>
          </div>
        </div>

        <div
          className={[
            "mt-1 inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold",
            tone.text,
          ].join(" ")}
        >
          <span className={["h-1.5 w-1.5 rounded-full", tone.dot].join(" ")} />
          <span>{status.label}</span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onInspect?.(channel.id)}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[rgb(var(--color-brand))] transition-colors hover:text-[rgba(15,23,42,0.96)]"
        >
          <span>Details</span>
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.1} />
        </button>

        <button
          type="button"
          onClick={() => onRunPrimaryAction?.(channel, action)}
          className={[
            "inline-flex h-10 min-w-[128px] items-center justify-center gap-2 rounded-[9px]",
            "bg-[rgb(var(--color-brand))] px-4",
            "text-[12.5px] font-semibold tracking-[-0.01em] text-white",
            "shadow-[0_14px_28px_-18px_rgba(46,96,255,0.62)]",
            "transition-all duration-200 ease-out",
            "hover:-translate-y-[1px] hover:bg-[rgb(var(--color-brand-strong))]",
            "hover:shadow-[0_18px_32px_-18px_rgba(46,96,255,0.72)]",
          ].join(" ")}
        >
          <span>{action.label}</span>
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.1} />
        </button>
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
      <PageCanvas className="max-w-[1180px] py-2">
        <LoadingSurface title="Loading channels" />
      </PageCanvas>
    );
  }

  return (
    <>
      <PageCanvas className="max-w-[1180px] py-2">
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

          <div className="max-w-[760px] space-y-4">
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