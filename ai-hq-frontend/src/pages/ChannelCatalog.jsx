import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ChannelDetailDrawer from "../components/channels/ChannelDetailDrawer.jsx";
import ChannelOverviewCard from "../components/channels/ChannelOverviewCard.jsx";
import {
  CHANNELS,
  CHANNEL_FILTERS,
  countChannels,
  findChannelById,
  matchesChannelFilter,
  matchesChannelSearch,
  pickHeroChannel,
} from "../components/channels/channelCatalogModel.js";
import { EmptyState, PageCanvas } from "../components/ui/AppShellPrimitives.jsx";
import { ChannelActionButton } from "../components/channels/ChannelPrimitives.jsx";

function buildFilterSummary(filteredCount, totalCount) {
  if (filteredCount === totalCount) {
    return `${totalCount} lanes shown`;
  }

  return `${filteredCount} of ${totalCount} lanes shown`;
}

function ViewSelect({ value, options, onChange }) {
  return (
    <label className="relative inline-flex min-w-[180px] items-center">
      <select
        aria-label="Filter channels"
        value={value}
        onChange={onChange}
        className="h-10 w-full appearance-none rounded-full border border-line/80 bg-white/80 pl-4 pr-10 text-sm font-medium text-text outline-none transition hover:border-line focus:border-brand"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-text-subtle" />
    </label>
  );
}

function SearchField({ value, onChange, onClear }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-full border border-line/80 bg-white/80 px-4 transition hover:border-line focus-within:border-brand">
      <Search className="h-4 w-4 shrink-0 text-text-subtle" />
      <input
        aria-label="Search channels"
        value={value}
        onChange={onChange}
        placeholder="Search channels"
        className="h-10 w-full border-0 bg-transparent p-0 text-sm text-text outline-none placeholder:text-text-subtle"
      />
      {value ? (
        <button
          type="button"
          onClick={onClear}
          className="text-sm font-medium text-text-muted transition hover:text-text"
        >
          Clear
        </button>
      ) : null}
    </div>
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

  const liveCount = countChannels("connected");
  const limitedCount = countChannels("limited");
  const setupCount = countChannels("attention");
  const contextCount = countChannels("context");

  const filterCounts = useMemo(
    () =>
      CHANNEL_FILTERS.map((filter) => ({
        ...filter,
        count: countChannels(filter.id),
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
      <PageCanvas className="px-4 py-6 md:px-6 md:py-8">
        <div className="space-y-6">
          <header className="flex flex-col gap-4 border-b border-line-soft pb-5 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-subtle">
                Control surface
              </div>
              <h1 className="mt-2 font-display text-[2rem] font-semibold tracking-[-0.055em] text-text md:text-[2.35rem]">
                Channels
              </h1>
              <p className="mt-2 text-[15px] leading-7 text-text-muted">
                Live, limited, and setup lanes.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-text-muted">
                <span>{CHANNELS.length} lanes</span>
                <span className="h-1 w-1 rounded-full bg-text-subtle" />
                <span>{liveCount} live</span>
                <span className="h-1 w-1 rounded-full bg-text-subtle" />
                <span>{limitedCount} limited</span>
                <span className="h-1 w-1 rounded-full bg-text-subtle" />
                <span>{setupCount} setup</span>
                <span className="h-1 w-1 rounded-full bg-text-subtle" />
                <span>{contextCount} context</span>
              </div>
            </div>

            <ChannelActionButton
              onClick={() => navigate(heroChannel.primaryAction.path)}
              aria-label="Open live inbox"
              className="self-start md:self-auto"
            >
              Open inbox
            </ChannelActionButton>
          </header>

          <div className="flex flex-col gap-3 rounded-[28px] border border-line/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(248,250,252,0.84))] px-4 py-4 shadow-[0_22px_46px_-38px_rgba(15,23,42,0.35)] md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-subtle">
                View
              </div>
              <ViewSelect
                value={activeFilter}
                options={filterCounts}
                onChange={(event) => setActiveFilter(event.target.value)}
              />
              <div className="text-sm text-text-muted">
                {buildFilterSummary(filteredChannels.length, CHANNELS.length)}
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 md:w-auto md:min-w-[280px]">
              <SearchField
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onClear={() => setQuery("")}
              />
            </div>
          </div>

          {selectedChannel ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
              <span>Detail open.</span>
              <span className="h-1 w-1 rounded-full bg-text-subtle" />
              <button
                type="button"
                onClick={() => updateSelectedChannel("")}
                className="font-medium text-text transition hover:text-brand"
              >
                {selectedChannel.name} open
              </button>
            </div>
          ) : null}

          {filteredChannels.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
            <EmptyState
              title="No channels match this view"
              description="Adjust the view or clear search to return to the full channel overview."
              action={
                query ? (
                  <ChannelActionButton quiet onClick={() => setQuery("")}>
                    Clear search
                  </ChannelActionButton>
                ) : null
              }
            />
          )}
        </div>
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
