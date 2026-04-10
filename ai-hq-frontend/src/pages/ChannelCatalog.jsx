import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
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
import Badge from "../components/ui/Badge.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
  SlidingDetailOverlay,
  Surface,
} from "../components/ui/AppShellPrimitives.jsx";
import { compactSentence, s, toneFromReadiness } from "../lib/appUi.js";
import {
  buildChannelTruthLaunchReadiness,
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

function statusToneFromLabel(label = "") {
  const value = s(label).toLowerCase();

  if (
    value.includes("connected") ||
    value.includes("ready") ||
    value.includes("live") ||
    value.includes("available")
  ) {
    return "success";
  }

  if (
    value.includes("reconnect") ||
    value.includes("repair") ||
    value.includes("blocked") ||
    value.includes("required") ||
    value.includes("waiting")
  ) {
    return "danger";
  }

  if (value.includes("connecting") || value.includes("pending")) {
    return "warning";
  }

  return "neutral";
}

function buildRuntimeMeta(channel, readinessState) {
  if (channel.id === "instagram") return readinessState.meta;
  if (channel.id === "telegram") return readinessState.telegram;
  if (channel.id === "website") return readinessState.website;
  return null;
}

function ChannelRow({
  channel,
  runtime,
  onInspect,
  onRunPrimaryAction,
  muted = false,
  last = false,
  showPrimaryAction = true,
}) {
  const statusLabel = s(
    runtime?.statusLabel,
    channel.status === "phase2" ? "Later" : "Available"
  );
  const summary = compactSentence(
    runtime?.summary || channel.summary,
    channel.summary
  );
  const eyebrow = s(channel.eyebrow);
  const tone = statusToneFromLabel(statusLabel);

  return (
    <div
      className={[
        "flex flex-col gap-3 px-1 py-3.5 md:flex-row md:items-center md:justify-between",
        !last && "border-b border-line-soft",
        muted && "opacity-80",
      ].join(" ")}
    >
      <div className="min-w-0 flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <ChannelIcon channel={channel} size="md" />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[14px] font-semibold text-text">
              {channel.name}
            </div>
            <Badge tone={tone}>{statusLabel}</Badge>
          </div>

          {eyebrow ? (
            <div className="mt-0.5 text-[12px] leading-5 text-text-subtle">
              {eyebrow}
            </div>
          ) : null}

          <div className="mt-1 text-[13px] leading-5 text-text-muted">
            {summary}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onInspect?.(channel.id)}
        >
          Details
        </Button>

        {showPrimaryAction ? (
          <Button
            type="button"
            size="sm"
            onClick={() => onRunPrimaryAction?.(channel)}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            {s(channel.primaryAction?.label, "Open")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function MetaLine({ launchReadiness, readinessState }) {
  const instagram = s(readinessState.meta?.statusLabel, "Unknown");
  const telegram = s(readinessState.telegram?.statusLabel, "Unknown");
  const website = s(readinessState.website?.statusLabel, "Unknown");
  const truth = s(readinessState.truth?.statusLabel, "Unknown");

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-5 text-text-subtle">
      <span>
        <span className="text-text-muted">Launch:</span>{" "}
        {s(launchReadiness.statusLabel, "Unknown")}
      </span>
      <span className="text-slate-300">•</span>
      <span>
        <span className="text-text-muted">Instagram:</span> {instagram}
      </span>
      <span className="text-slate-300">•</span>
      <span>
        <span className="text-text-muted">Telegram:</span> {telegram}
      </span>
      <span className="text-slate-300">•</span>
      <span>
        <span className="text-text-muted">Website:</span> {website}
      </span>
      <span className="text-slate-300">•</span>
      <span>
        <span className="text-text-muted">Truth:</span> {truth}
      </span>
    </div>
  );
}

function ChannelsLoadingSurface() {
  return (
    <PageCanvas>
      <LoadingSurface title="Loading channels" />
    </PageCanvas>
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
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [selectedChannel]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const launchReadiness = useMemo(
    () =>
      buildChannelTruthLaunchReadiness({
        channels: [
          effectiveReadinessState.meta,
          effectiveReadinessState.telegram,
          effectiveReadinessState.website,
        ],
        truthState: effectiveReadinessState.truth,
        surface: { unavailable: false, error: effectiveReadinessState.error },
        copy: {
          channelsPath: "/channels",
          truthPath: "/truth",
          noChannelSummary:
            "No launch channel is currently connected. Connect website chat, Instagram, or Telegram first.",
          noChannelDetail:
            "The launch lane expects at least one connected and delivery-ready channel.",
          deliveryBlockedSummary:
            "A channel is connected, but delivery is still blocked.",
          deliveryBlockedDetail:
            "Inspect the connected channel and clear delivery blockers before trusting live automation.",
          truthBlockedApprovalTitle: "Business truth still needs approval.",
          truthBlockedRuntimeTitle: "Runtime still needs repair.",
          truthBlockedDetail:
            "Connected channels alone are not enough. Approved truth and healthy runtime must also be aligned.",
          readyTitle:
            "A launch channel is connected and the operating posture is healthy.",
          readySummary:
            "Channels, approved truth, and runtime are aligned for the current launch promise.",
          readyDetail:
            "The launch spine is not blocked at the channel layer right now.",
        },
      }),
    [
      effectiveReadinessState.error,
      effectiveReadinessState.meta,
      effectiveReadinessState.telegram,
      effectiveReadinessState.website,
      effectiveReadinessState.truth,
    ]
  );

  const launchChannels = useMemo(
    () => CHANNELS.filter((channel) => channel.status !== "phase2"),
    []
  );

  const laterChannels = useMemo(
    () => CHANNELS.filter((channel) => channel.status === "phase2"),
    []
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

  function handleNavigate(path) {
    navigate(path);
  }

  function handlePrimaryAction(channel) {
    if (!channel?.id) return;

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

  if (!workspace.ready && effectiveReadinessState.loading) {
    return <ChannelsLoadingSurface />;
  }

  return (
    <>
      <PageCanvas className="space-y-3">
        {s(effectiveReadinessState.error) ? (
          <InlineNotice
            tone="danger"
            title="Channel readiness unavailable"
            description={effectiveReadinessState.error}
            compact
          />
        ) : null}

        <Surface padded="lg" className="rounded-[22px]">
          <div className="space-y-5">
            <div className="flex flex-col gap-4 border-b border-line-soft pb-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone={toneFromReadiness(launchReadiness)}>
                    {s(launchReadiness.statusLabel, "Launch posture")}
                  </Badge>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                    Channels
                  </div>
                </div>

                <h1 className="text-[1.55rem] font-semibold leading-tight tracking-[-0.03em] text-text md:text-[1.75rem]">
                  Connect and verify launch channels.
                </h1>

                <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-text-muted">
                  {compactSentence(
                    launchReadiness.summary,
                    "Keep channel posture honest so setup, truth, runtime, and inbox stay aligned."
                  )}
                </p>

                <div className="mt-3">
                  <MetaLine
                    launchReadiness={launchReadiness}
                    readinessState={effectiveReadinessState}
                  />
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {launchReadiness.action?.path ? (
                  <Button
                    size="sm"
                    onClick={() => handleNavigate(launchReadiness.action.path)}
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    {launchReadiness.action.label}
                  </Button>
                ) : null}

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => handleNavigate("/truth")}
                >
                  Open truth
                </Button>
              </div>
            </div>

            <div>
              <div className="pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                Launch connectors
              </div>

              <div>
                {launchChannels.map((channel, index) => (
                  <ChannelRow
                    key={channel.id}
                    channel={channel}
                    runtime={buildRuntimeMeta(channel, effectiveReadinessState)}
                    onInspect={updateSelectedChannel}
                    onRunPrimaryAction={handlePrimaryAction}
                    muted={false}
                    last={index === launchChannels.length - 1}
                    showPrimaryAction
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-line-soft pt-4">
              <div className="pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                Later
              </div>

              <div>
                {laterChannels.map((channel, index) => (
                  <ChannelRow
                    key={channel.id}
                    channel={channel}
                    runtime={null}
                    onInspect={updateSelectedChannel}
                    onRunPrimaryAction={handlePrimaryAction}
                    muted
                    last={index === laterChannels.length - 1}
                    showPrimaryAction={false}
                  />
                ))}
              </div>
            </div>
          </div>
        </Surface>
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
            onNavigate={handleNavigate}
          />
        </SlidingDetailOverlay>
      ) : null}
    </>
  );
}