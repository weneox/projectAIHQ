import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { PageCanvas } from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

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

export default function ChannelCatalog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeFilter, setActiveFilter] = useState("all");
  const [query] = useState("");

  const selectedChannelId = searchParams.get("channel") || "";

  const selectedChannel = useMemo(
    () => findChannelById(selectedChannelId),
    [selectedChannelId]
  );

  const [drawerChannel, setDrawerChannel] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeTimerRef = useRef(null);

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