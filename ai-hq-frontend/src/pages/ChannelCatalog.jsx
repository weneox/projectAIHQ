import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ShieldCheck, Wrench } from "lucide-react";
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
import { ChannelActionButton } from "../components/channels/ChannelPrimitives.jsx";
import Button from "../components/ui/Button.jsx";
import { PageCanvas } from "../components/ui/AppShellPrimitives.jsx";
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
        "group relative inline-flex h-9 items-center gap-2 px-0.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-all duration-fast ease-premium",
        active ? "text-[#0f172a]" : "text-[#5f6b7c] hover:text-[#0f172a]"
      )}
    >
      <span>{label}</span>

      <span
        className={cx(
          "text-[12px] font-bold tracking-[-0.02em] transition-colors duration-fast ease-premium",
          active ? "text-[#264ca5]" : "text-[#111827]"
        )}
      >
        {count}
      </span>

      <span
        aria-hidden="true"
        className={cx(
          "absolute inset-x-0 -bottom-[7px] h-[2px] rounded-full transition-all duration-fast ease-premium",
          active
            ? "bg-[#264ca5] opacity-100"
            : "bg-[#d4dce7] opacity-0 group-hover:opacity-100"
        )}
      />
    </button>
  );
}

function LaunchReadinessStrip({ readiness, onNavigate }) {
  const palette =
    readiness.status === "ready"
      ? {
          border: "border-[#d8ebe0]",
          bg: "bg-[#f7fcf8]",
          icon: ShieldCheck,
          iconColor: "text-[#156f3d]",
          text: "text-[#156f3d]",
        }
      : readiness.status === "attention"
        ? {
            border: "border-[#f0dfc5]",
            bg: "bg-[#fffaf1]",
            icon: Wrench,
            iconColor: "text-[#b76a11]",
            text: "text-[#8d4f07]",
          }
        : {
            border: "border-[#f0d3d5]",
            bg: "bg-[#fff7f7]",
            icon: Wrench,
            iconColor: "text-[#b42318]",
            text: "text-[#912018]",
          };

  const Icon = palette.icon;

  return (
    <div className={`border border-[#e6ebf2] ${palette.border} ${palette.bg} px-4 py-4`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${palette.iconColor}`} strokeWidth={2} />
            <div className={`text-[11px] font-bold uppercase tracking-[0.14em] ${palette.text}`}>
              {s(readiness.statusLabel, "Unknown")}
            </div>
          </div>

          <div className="mt-2 text-[15px] font-semibold tracking-[-0.03em] text-[#0f1728]">
            {s(readiness.title, "Launch readiness")}
          </div>

          <div className="mt-1 text-[13px] leading-6 text-[#5f6b7c]">
            {s(readiness.summary)}
          </div>

          {s(readiness.detail) ? (
            <div className="mt-1 text-[12px] leading-5 text-[#7a8698]">
              {s(readiness.detail)}
            </div>
          ) : null}
        </div>

        {readiness.action?.path ? (
          <div className="shrink-0">
            <Button
              size="sm"
              onClick={() => onNavigate(readiness.action.path)}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              {readiness.action.label}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
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

  const selectedChannelId = searchParams.get("channel") || "";
  const selectedChannel = useMemo(
    () => findChannelById(selectedChannelId),
    [selectedChannelId]
  );

  const [drawerChannel, setDrawerChannel] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeTimerRef = useRef(null);

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
          error: s(error?.message || error || "Channel readiness could not be loaded."),
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
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (selectedChannel) {
      setDrawerChannel(selectedChannel);

      const raf = window.requestAnimationFrame(() => {
        setDrawerOpen(true);
      });

      return () => window.cancelAnimationFrame(raf);
    }

    setDrawerOpen(false);

    closeTimerRef.current = window.setTimeout(() => {
      setDrawerChannel(null);
    }, 320);

    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
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
            "No launch channel is currently connected. Connect Meta or Telegram before the launch path can go live.",
          noChannelDetail:
            "The launch path expects at least one connected and delivery-ready channel.",
          deliveryBlockedSummary:
            "A channel is connected, but delivery is still blocked.",
          deliveryBlockedDetail:
            "Inspect the connected channel and fix delivery blockers before trusting live automation.",
          truthBlockedApprovalTitle:
            "Business truth still needs approval.",
          truthBlockedRuntimeTitle:
            "Runtime still needs repair.",
          truthBlockedDetail:
            "Channel connection alone is not enough. Approved truth and healthy runtime must also be aligned.",
          readyTitle:
            "A launch channel is connected and the operating posture is healthy.",
          readySummary:
            "Channels, approved truth, and runtime are aligned for the current launch promise.",
          readyDetail:
            "You can inspect channels here, but the launch spine no longer has a blocker at the channel layer.",
        },
      }),
    [readinessState.error, readinessState.meta, readinessState.telegram, readinessState.truth]
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
    updateSelectedChannel(channel.id);
  }

  function handleDrawerClose() {
    updateSelectedChannel("");
  }

  return (
    <>
      <PageCanvas className="px-3 py-3 md:px-4 md:py-4">
        <div className="space-y-3.5">
          <LaunchReadinessStrip
            readiness={launchReadiness}
            onNavigate={handleNavigate}
          />

          {s(readinessState.error) ? (
            <div className="border border-[#f0d3d5] bg-[#fff7f7] px-4 py-3 text-[13px] leading-6 text-[#912018]">
              {readinessState.error}
            </div>
          ) : null}

          <div className="border-b border-[#e6ebf2] pb-2.5">
            <div className="flex flex-col gap-2.5 md:flex-row md:items-end md:justify-between">
              <div className="flex items-end gap-8">
                <div className="flex items-center gap-7">
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
              </div>

              <div className="flex items-center gap-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#667085]">
                  {resultsLabel}
                </div>

                {isFiltered ? (
                  <ChannelActionButton
                    quiet
                    showArrow={false}
                    onClick={handleResetView}
                    className="!h-[30px] !rounded-[8px] !px-3 !text-[10px] !tracking-[0.1em]"
                  >
                    Reset
                  </ChannelActionButton>
                ) : null}
              </div>
            </div>
          </div>

          {filteredChannels.length ? (
            <section className="relative min-h-[280px]">
              <div
                className={cx(
                  "grid gap-3.5 md:grid-cols-2 xl:grid-cols-3 transition-[opacity,transform] duration-300 ease-premium",
                  drawerChannel
                    ? drawerOpen
                      ? "opacity-[0.28] scale-[0.992]"
                      : "opacity-[0.55] scale-[0.996]"
                    : "opacity-100 scale-100"
                )}
              >
                {filteredChannels.map((channel) => (
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
          ) : (
            <div className="grid min-h-[220px] place-items-center rounded-[14px] border border-dashed border-line-soft bg-white px-5 py-10">
              <div className="max-w-[360px] text-center">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                  No matches
                </div>

                <div className="mt-2 text-[20px] font-semibold tracking-[-0.04em] text-text">
                  No connectors matched this filter.
                </div>

                <p className="mt-3 text-[14px] leading-6 text-text-muted">
                  Reset the view to bring the full catalog back.
                </p>

                <div className="mt-5 flex justify-center">
                  <ChannelActionButton
                    quiet
                    showArrow={false}
                    onClick={handleResetView}
                  >
                    Reset view
                  </ChannelActionButton>
                </div>
              </div>
            </div>
          )}
        </div>
      </PageCanvas>

      {drawerChannel ? (
        <div className="fixed inset-0 z-[120] overflow-hidden">
          <button
            type="button"
            aria-label="Close connector details"
            onClick={handleDrawerClose}
            className={cx(
              "absolute inset-0 transition-opacity duration-300 ease-premium",
              drawerOpen
                ? "bg-[rgba(12,16,24,0.16)] opacity-100"
                : "bg-[rgba(12,16,24,0)] opacity-0"
            )}
          />

          <div className="absolute inset-y-0 right-0 flex w-full justify-end">
            <div
              className={cx(
                "h-full w-full max-w-[620px] transform-gpu will-change-transform transition-[transform] duration-[320ms] ease-premium",
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