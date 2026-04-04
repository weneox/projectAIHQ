import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cx } from "../lib/cx.js";
import ChannelDetailDrawer from "../components/channels/ChannelDetailDrawer.jsx";
import ChannelOverviewCard from "../components/channels/ChannelOverviewCard.jsx";
import {
  CHANNELS,
  CHANNEL_FILTERS,
  findChannelById,
  matchesChannelFilter,
  matchesChannelSearch,
  pickHeroChannel,
} from "../components/channels/channelCatalogModel.js";
import { PageCanvas } from "../components/ui/AppShellPrimitives.jsx";
import Input from "../components/ui/Input.jsx";
import { ChannelActionButton } from "../components/channels/ChannelPrimitives.jsx";

function buildResultsLabel(filteredCount, totalCount) {
  if (filteredCount === totalCount) {
    return `${totalCount} total`;
  }

  return `Showing ${filteredCount} of ${totalCount}`;
}

function FilterControl({ filter, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(filter.id)}
      aria-pressed={active}
      className={cx(
        "flex min-h-[72px] flex-col justify-between bg-surface px-3 py-3 text-left transition duration-fast ease-premium",
        active
          ? "bg-[rgba(var(--color-brand),0.05)] text-text"
          : "text-text-muted hover:bg-surface-subtle hover:text-text"
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">
        {filter.label}
      </span>
      <span className="mt-3 text-[18px] font-semibold tracking-[-0.05em] text-text">
        {filter.count}
      </span>
    </button>
  );
}

export default function ChannelCatalog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeFilter, setActiveFilter] = useState("all");
  const [query, setQuery] = useState("");

  const heroChannel = pickHeroChannel();
  const selectedChannelId = searchParams.get("channel") || "";
  const selectedChannel = useMemo(
    () => findChannelById(selectedChannelId),
    [selectedChannelId]
  );

  const filterCounts = useMemo(
    () =>
      CHANNEL_FILTERS.map((filter) => ({
        ...filter,
        count: CHANNELS.filter((channel) => matchesChannelFilter(channel, filter.id)).length,
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

  const activeFilterMeta =
    filterCounts.find((filter) => filter.id === activeFilter) || filterCounts[0];
  const resultsLabel = buildResultsLabel(filteredChannels.length, CHANNELS.length);

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

  return (
    <>
      <PageCanvas className="px-3 py-3 md:px-4 md:py-4">
        <section className="overflow-hidden border border-line bg-surface">
          <div className="px-4 py-4 md:px-5 md:py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-[760px]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                  Operational matrix
                </div>

                <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
                  <h1 className="text-[1.75rem] font-semibold tracking-[-0.06em] text-text md:text-[2rem]">
                    Channels
                  </h1>
                  <div className="pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                    {resultsLabel}
                  </div>
                </div>

                <p className="mt-3 max-w-[42rem] text-[13px] leading-6 text-text-muted">
                  Live lanes, limited coverage, setup pressure, and context sources in
                  one compact routing matrix.
                </p>
              </div>

              <ChannelActionButton
                onClick={() => navigate(heroChannel.primaryAction.path)}
                ariaLabel="Open live inbox"
                className="self-start"
              >
                Open inbox
              </ChannelActionButton>
            </div>

            <div className="mt-4 grid gap-3 border-t border-line-soft pt-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid gap-px border border-line-soft bg-line-soft sm:grid-cols-3 xl:grid-cols-5">
                {filterCounts.map((filter) => (
                  <FilterControl
                    key={filter.id}
                    filter={filter}
                    active={activeFilter === filter.id}
                    onSelect={setActiveFilter}
                  />
                ))}
              </div>

              <div className="border border-line-soft bg-surface px-3 py-3">
                <div className="flex items-center justify-between gap-3 pb-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                    {activeFilterMeta.label} view
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                    {resultsLabel}
                  </div>
                </div>

                <Input
                  aria-label="Search channels"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, capability, or state"
                  leftIcon={<Search className="h-4 w-4" />}
                  appearance="quiet"
                  className="!rounded-none"
                  inputClassName="!text-[13px]"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-line-soft">
            {filteredChannels.length ? (
              <div className="grid bg-line-soft md:grid-cols-2 md:gap-px xl:grid-cols-3 2xl:grid-cols-4">
                {filteredChannels.map((channel) => (
                  <ChannelOverviewCard
                    key={channel.id}
                    channel={channel}
                    selected={selectedChannel?.id === channel.id}
                    onInspect={updateSelectedChannel}
                    onRunPrimaryAction={handleNavigate}
                  />
                ))}
              </div>
            ) : (
              <div className="grid min-h-[280px] place-items-center px-5 py-10">
                <div className="max-w-[360px] text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                    No matches
                  </div>
                  <div className="mt-3 text-[18px] font-semibold tracking-[-0.04em] text-text">
                    No channels match this view.
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-text-muted">
                    Clear the search or reset the filter to return to the full matrix.
                  </p>
                  <div className="mt-5 flex justify-center">
                    <ChannelActionButton
                      quiet
                      showArrow={false}
                      onClick={() => {
                        setActiveFilter("all");
                        setQuery("");
                      }}
                    >
                      Reset view
                    </ChannelActionButton>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </PageCanvas>

      <ChannelDetailDrawer
        channel={selectedChannel}
        open={Boolean(selectedChannel)}
        onClose={() => updateSelectedChannel("")}
        onNavigate={handleNavigate}
      />
    </>
  );
}
