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
import ChannelOverviewCard from "../components/channels/ChannelOverviewCard.jsx";
import useWorkspaceTenantKey from "../hooks/useWorkspaceTenantKey.js";
import {
  CHANNELS,
  CHANNEL_FILTERS,
  findChannelById,
  matchesChannelFilter,
  matchesChannelSearch,
} from "../components/channels/channelCatalogModel.js";
import Button from "../components/ui/Button.jsx";
import Badge from "../components/ui/Badge.jsx";
import {
  EmptyState,
  MetricCard,
  MetricGrid,
  PageCanvas,
  PageHeader,
  SectionHeader,
  SlidingDetailOverlay,
  StatusBanner,
  Surface,
} from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";
import {
  compactSentence,
  s,
  toneFromReadiness,
} from "../lib/appUi.js";
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
  loading: true,
  error: "",
  meta: null,
  telegram: null,
  website: null,
  truth: null,
};

function buildResultsLabel(filteredCount, totalCount, isFiltered) {
  if (!isFiltered) return `${totalCount} connectors`;
  return `${filteredCount} of ${totalCount}`;
}

function FilterTab({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-[12px]",
        active
          ? "border-line-strong bg-surface-subtle text-text"
          : "border-line bg-surface text-text-muted hover:border-line-strong hover:text-text"
      )}
    >
      <span>{label}</span>
      <span className="text-text-subtle">{count}</span>
    </button>
  );
}

function launchMetricHint(state, fallback) {
  return compactSentence(state?.summary, fallback);
}

export default function ChannelCatalog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspace = useWorkspaceTenantKey();
  const refreshToken = useLaunchSliceRefreshToken(
    workspace.tenantKey,
    workspace.ready
  );
  const [activeFilter, setActiveFilter] = useState("all");
  const [query] = useState("");

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

  useEffect(() => {
    if (!workspace.ready) return undefined;

    let alive = true;

    setReadinessState((current) =>
      current.tenantKey === workspace.tenantKey
        ? {
            ...current,
            loading: true,
            error: "",
          }
        : {
            ...EMPTY_READINESS_STATE,
            tenantKey: workspace.tenantKey,
          }
    );

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
          tenantKey: workspace.tenantKey,
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
          tenantKey: workspace.tenantKey,
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
  }, [refreshToken, workspace.ready, workspace.tenantKey]);

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
      };
    }

    return readinessState;
  }, [readinessState, workspace.ready, workspace.tenantKey]);

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

  const filterCounts = useMemo(
    () =>
      CHANNEL_FILTERS.map((filter) => ({
        ...filter,
        count: CHANNELS.filter((channel) =>
          matchesChannelFilter(channel, filter.id)
        ).length,
      })),
    []
  );

  const filteredChannels = useMemo(
    () =>
      CHANNELS.filter(
        (channel) =>
          matchesChannelFilter(channel, activeFilter) &&
          matchesChannelSearch(channel, query)
      ),
    [activeFilter, query]
  );

  const isFiltered = activeFilter !== "all";
  const resultsLabel = buildResultsLabel(
    filteredChannels.length,
    CHANNELS.length,
    isFiltered
  );

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
          truthBlockedApprovalTitle:
            "Business truth still needs approval.",
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

  const primaryChannels = useMemo(
    () => filteredChannels.filter((channel) => channel.status !== "phase2"),
    [filteredChannels]
  );

  const secondaryChannels = useMemo(
    () => filteredChannels.filter((channel) => channel.status === "phase2"),
    [filteredChannels]
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

  function handleResetView() {
    setActiveFilter("all");
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

  return (
    <>
      <PageCanvas className="py-1">
        <PageHeader
          eyebrow="Channels"
          title="Connect and verify launch channels."
          description={compactSentence(
            launchReadiness.summary,
            "Keep channel posture honest so setup, truth, runtime, and inbox stay aligned."
          )}
          actions={
            <>
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
            </>
          }
        />

        <StatusBanner
          tone={toneFromReadiness(launchReadiness)}
          label={s(launchReadiness.statusLabel, "Launch posture")}
          title={s(launchReadiness.title, "Launch posture")}
          description={compactSentence(
            launchReadiness.summary,
            "Launch posture is currently unavailable."
          )}
          detail={compactSentence(launchReadiness.detail)}
        />

        {s(effectiveReadinessState.error) ? (
          <StatusBanner
            tone="danger"
            label="Unavailable"
            title="Channel readiness unavailable"
            description={effectiveReadinessState.error}
          />
        ) : null}

        <MetricGrid>
          <MetricCard
            label="Launch posture"
            value={s(launchReadiness.statusLabel, "Unknown")}
            hint={compactSentence(launchReadiness.summary, "Readiness unavailable.")}
            tone={toneFromReadiness(launchReadiness)}
          />
          <MetricCard
            label="Instagram"
            value={s(effectiveReadinessState.meta?.statusLabel, "Unknown")}
            hint={launchMetricHint(
              effectiveReadinessState.meta,
              "Instagram posture unavailable."
            )}
            tone={toneFromReadiness(effectiveReadinessState.meta || {})}
          />
          <MetricCard
            label="Telegram"
            value={s(effectiveReadinessState.telegram?.statusLabel, "Unknown")}
            hint={launchMetricHint(
              effectiveReadinessState.telegram,
              "Telegram posture unavailable."
            )}
            tone={toneFromReadiness(effectiveReadinessState.telegram || {})}
          />
          <MetricCard
            label="Truth + runtime"
            value={s(effectiveReadinessState.truth?.statusLabel, "Unknown")}
            hint={launchMetricHint(
              effectiveReadinessState.truth,
              "Truth posture unavailable."
            )}
            tone={toneFromReadiness(effectiveReadinessState.truth || {})}
          />
        </MetricGrid>

        <Surface>
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {filterCounts.map((filter) => (
                  <FilterTab
                    key={filter.id}
                    label={filter.label}
                    count={filter.count}
                    active={activeFilter === filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Badge>{resultsLabel}</Badge>
                {isFiltered ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleResetView}
                  >
                    Reset
                  </Button>
                ) : null}
              </div>
            </div>

            {filteredChannels.length ? (
              <div className="space-y-6">
                {primaryChannels.length ? (
                  <section className="space-y-3">
                    <SectionHeader
                      eyebrow="Ready now"
                      title="Launch connectors"
                      description="These channels belong in the current launch lane."
                    />

                    <div
                      className={cx(
                        "grid gap-3 md:grid-cols-2 xl:grid-cols-3",
                        drawerChannel && drawerOpen && "opacity-60"
                      )}
                    >
                      {primaryChannels.map((channel) => (
                        <ChannelOverviewCard
                          key={channel.id}
                          channel={channel}
                          selected={selectedChannel?.id === channel.id}
                          onInspect={updateSelectedChannel}
                          onRunPrimaryAction={handlePrimaryAction}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {secondaryChannels.length ? (
                  <section className="space-y-3 border-t border-line-soft pt-5">
                    <SectionHeader
                      eyebrow="Later"
                      title="Not in the launch lane yet"
                      description="Keep these visible, but do not confuse them with the current launch path."
                    />

                    <div
                      className={cx(
                        "grid gap-3 md:grid-cols-2 xl:grid-cols-3",
                        drawerChannel && drawerOpen && "opacity-60"
                      )}
                    >
                      {secondaryChannels.map((channel) => (
                        <ChannelOverviewCard
                          key={channel.id}
                          channel={channel}
                          selected={selectedChannel?.id === channel.id}
                          onInspect={updateSelectedChannel}
                          onRunPrimaryAction={handlePrimaryAction}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : (
              <EmptyState
                title="No connector matched this view."
                description="Reset the catalog and bring the full launch surface back."
                action={
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleResetView}
                  >
                    Reset view
                  </Button>
                }
              />
            )}
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
