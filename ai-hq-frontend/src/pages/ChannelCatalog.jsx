import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
  getMetaChannelStatus,
  getTelegramChannelStatus,
} from "../api/channelConnect.js";
import { getSettingsTrustView } from "../api/trust.js";
import ChannelDetailDrawer from "../components/channels/ChannelDetailDrawer.jsx";
import ChannelOverviewCard from "../components/channels/ChannelOverviewCard.jsx";
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
  InlineNotice,
  MetricCard,
  PageCanvas,
  PageHeader,
  Surface,
  SectionHeader,
} from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";
import {
  buildChannelTruthLaunchReadiness,
  buildMetaLaunchChannelState,
  buildTelegramLaunchChannelState,
  buildTruthOperationalState,
} from "../lib/readinessViewModel.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function compactSentence(value, fallback = "") {
  const text = s(value, fallback);
  if (!text) return "";
  const sentence = text.split(/(?<=[.!?])\s+/)[0] || text;
  return sentence.length > 150
    ? `${sentence.slice(0, 147).trim()}...`
    : sentence;
}

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

function readinessTone(readiness) {
  if (readiness.status === "ready") return "success";
  if (readiness.status === "attention") return "warning";
  if (readiness.status === "blocked") return "danger";
  return "info";
}

function launchMetricHint(state, fallback) {
  return compactSentence(state?.summary, fallback);
}

function EmptyState({ onReset }) {
  return (
    <Surface>
      <div className="text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
          No matches
        </div>
        <div className="mt-2 text-[18px] font-semibold text-text">
          No connector matched this view.
        </div>
        <div className="mt-2 text-[13px] leading-6 text-text-muted">
          Reset the catalog and bring the full launch surface back.
        </div>
        <div className="mt-4">
          <Button type="button" size="sm" variant="secondary" onClick={onReset}>
            Reset view
          </Button>
        </div>
      </div>
    </Surface>
  );
}

export default function ChannelCatalog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeFilter, setActiveFilter] = useState("all");
  const [query] = useState("");

  const [readinessState, setReadinessState] = useState({
    loading: true,
    error: "",
    meta: null,
    telegram: null,
    truth: null,
  });

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
    let alive = true;

    Promise.allSettled([
      getMetaChannelStatus(),
      getTelegramChannelStatus(),
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
        const truth =
          results[2].status === "fulfilled"
            ? buildTruthOperationalState(results[2].value)
            : buildTruthOperationalState(null);

        setReadinessState({
          loading: false,
          error: "",
          meta,
          telegram,
          truth,
        });
      })
      .catch((error) => {
        if (!alive) return;
        setReadinessState({
          loading: false,
          error: s(
            error?.message || error || "Channel readiness could not be loaded."
          ),
          meta: buildMetaLaunchChannelState({}),
          telegram: buildTelegramLaunchChannelState({}),
          truth: buildTruthOperationalState(null),
        });
      });

    return () => {
      alive = false;
    };
  }, []);

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
        channels: [readinessState.meta, readinessState.telegram],
        truthState: readinessState.truth,
        surface: { unavailable: false, error: readinessState.error },
        copy: {
          channelsPath: "/channels",
          truthPath: "/truth",
          noChannelSummary:
            "No launch channel is currently connected. Connect Instagram or Telegram first.",
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
      readinessState.error,
      readinessState.meta,
      readinessState.telegram,
      readinessState.truth,
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

        <InlineNotice
          tone={readinessTone(launchReadiness)}
          title={s(launchReadiness.title, "Launch posture")}
          description={compactSentence(
            launchReadiness.detail || launchReadiness.summary,
            "Launch posture is currently unavailable."
          )}
        />

        {s(readinessState.error) ? (
          <InlineNotice
            tone="danger"
            title="Channel readiness unavailable"
            description={readinessState.error}
          />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Launch posture"
            value={s(launchReadiness.statusLabel, "Unknown")}
            hint={compactSentence(launchReadiness.summary, "Readiness unavailable.")}
            tone={readinessTone(launchReadiness)}
          />
          <MetricCard
            label="Instagram"
            value={s(readinessState.meta?.statusLabel, "Unknown")}
            hint={launchMetricHint(
              readinessState.meta,
              "Instagram posture unavailable."
            )}
            tone={readinessTone(readinessState.meta || {})}
          />
          <MetricCard
            label="Telegram"
            value={s(readinessState.telegram?.statusLabel, "Unknown")}
            hint={launchMetricHint(
              readinessState.telegram,
              "Telegram posture unavailable."
            )}
            tone={readinessTone(readinessState.telegram || {})}
          />
          <MetricCard
            label="Truth + runtime"
            value={s(readinessState.truth?.statusLabel, "Unknown")}
            hint={launchMetricHint(
              readinessState.truth,
              "Truth posture unavailable."
            )}
            tone={readinessTone(readinessState.truth || {})}
          />
        </div>

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
              <EmptyState onReset={handleResetView} />
            )}
          </div>
        </Surface>
      </PageCanvas>

      {drawerChannel ? (
        <div className="fixed inset-0 z-[120] overflow-hidden">
          <button
            type="button"
            aria-label="Close connector details"
            onClick={handleDrawerClose}
            className={cx(
              "absolute inset-0 transition-opacity duration-200",
              drawerOpen ? "bg-[rgba(17,24,39,0.18)] opacity-100" : "opacity-0"
            )}
          />

          <div className="absolute inset-y-0 right-0 flex w-full justify-end">
            <div
              className={cx(
                "h-full w-full max-w-[620px] transform-gpu transition-transform duration-200",
                drawerOpen ? "translate-x-0" : "translate-x-full"
              )}
            >
              <ChannelDetailDrawer
                channel={drawerChannel}
                open={drawerOpen}
                onClose={handleDrawerClose}
                onNavigate={handleNavigate}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
