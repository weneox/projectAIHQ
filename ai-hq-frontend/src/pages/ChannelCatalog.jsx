import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { EmptyState, PageCanvas } from "../components/ui/AppShellPrimitives.jsx";
import { ChannelActionButton } from "../components/channels/ChannelPrimitives.jsx";

function buildResultsLabel({ filteredCount, totalCount, activeFilter, query }) {
  if (!query && activeFilter === "all") return null;
  if (!filteredCount) return "No matching lanes";
  if (filteredCount === totalCount) return `${totalCount} shown`;
  return `${filteredCount} shown`;
}

function ViewSelect({ value, options, onChange }) {
  return (
    <label className="relative inline-flex min-w-[190px] items-center">
      <select
        aria-label="Filter channels"
        value={value}
        onChange={onChange}
        className="h-10 w-full appearance-none rounded-[8px] border border-black/[0.08] bg-white px-4 pr-10 text-[14px] font-semibold tracking-[-0.015em] text-text outline-none shadow-[0_8px_18px_-18px_rgba(15,23,42,0.18)] transition hover:border-black/[0.14] focus:border-[#2558e8] focus:shadow-[0_0_0_4px_rgba(37,88,232,0.1)]"
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

function SearchField({ value, onChange }) {
  return (
    <div className="flex h-10 w-full items-center gap-3 rounded-[8px] border border-black/[0.08] bg-white px-4 shadow-[0_8px_18px_-18px_rgba(15,23,42,0.18)] transition hover:border-black/[0.14] focus-within:border-[#2558e8] focus-within:shadow-[0_0_0_4px_rgba(37,88,232,0.1)]">
      <Search className="h-4 w-4 shrink-0 text-text-subtle" />
      <input
        aria-label="Search channels"
        value={value}
        onChange={onChange}
        placeholder="Search channels"
        className="w-full border-0 bg-transparent p-0 text-[14px] text-text outline-none placeholder:text-text-subtle"
      />
    </div>
  );
}

function TinyKicker({ children }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-subtle">
      {children}
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

  const resultsLabel = buildResultsLabel({
    filteredCount: filteredChannels.length,
    totalCount: CHANNELS.length,
    activeFilter,
    query,
  });

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
        <div className="space-y-3">
          <section className="relative overflow-hidden rounded-[10px] border border-black/[0.08] bg-white shadow-[0_18px_42px_-34px_rgba(15,23,42,0.2)]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(37,88,232,0.22),rgba(37,88,232,0.08),transparent)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_circle_at_0%_0%,rgba(37,88,232,0.04),transparent_42%)]"
            />

            <div className="relative px-4 pb-4 pt-4 md:px-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0 max-w-[820px]">
                  <TinyKicker>Control surface</TinyKicker>

                  <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:gap-3">
                    <h1 className="font-display text-[2.15rem] font-semibold leading-[0.92] tracking-[-0.08em] text-text md:text-[2.7rem]">
                      Channels
                    </h1>

                    <p className="pb-1 text-[15px] leading-7 tracking-[-0.015em] text-text-muted">
                      Unified lane control across live, limited, and context-only paths.
                    </p>
                  </div>
                </div>

                <ChannelActionButton
                  tone="brand"
                  onClick={() => navigate(heroChannel.primaryAction.path)}
                  ariaLabel="Open live inbox"
                  className="self-start !h-10 !rounded-[8px] !px-5 !text-[14px] md:self-auto"
                >
                  Open inbox
                </ChannelActionButton>
              </div>
            </div>

            <div className="relative border-t border-black/[0.06] px-4 py-3 md:px-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-3">
                  <ViewSelect
                    value={activeFilter}
                    options={filterCounts}
                    onChange={(event) => setActiveFilter(event.target.value)}
                  />
                  {resultsLabel ? (
                    <div className="text-[13px] font-medium text-text-muted">
                      {resultsLabel}
                    </div>
                  ) : null}
                </div>

                <div className="w-full xl:w-[300px]">
                  <SearchField
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          {filteredChannels.length ? (
            <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
              description="Adjust the filter or search to return to the full channel overview."
              action={
                <ChannelActionButton quiet onClick={() => setQuery("")}>
                  Clear search
                </ChannelActionButton>
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