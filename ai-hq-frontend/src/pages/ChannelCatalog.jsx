import { useMemo, useState } from "react";
import { Search } from "lucide-react";
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
import Input from "../components/ui/Input.jsx";
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
        "inline-flex h-11 items-center gap-3 rounded-[15px] border px-4 text-[11px] font-semibold uppercase tracking-[0.14em] transition duration-fast ease-premium",
        active
          ? "border-brand bg-brand text-white shadow-[0_14px_28px_-18px_rgba(37,99,235,0.45)]"
          : "border-line bg-surface text-text-subtle hover:border-line-strong hover:bg-surface-muted hover:text-text"
      )}
    >
      <span>{label}</span>
      <span
        className={cx(
          "inline-flex min-w-[20px] items-center justify-center text-[13px] font-semibold tracking-[-0.03em]",
          active ? "text-white" : "text-text"
        )}
      >
        {count}
      </span>
    </button>
  );
}

export default function ChannelCatalog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeFilter, setActiveFilter] = useState("all");
  const [query, setQuery] = useState("");

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

  const isFiltered = activeFilter !== "all" || String(query).trim().length > 0;
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
    setQuery("");
  }

  function handleNavigate(path) {
    navigate(path);
  }

  return (
    <PageCanvas className="px-3 py-3 md:px-4 md:py-4">
      <div className="space-y-4">
        <section className="rounded-[26px] border border-line bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] px-4 py-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)] md:px-5 md:py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
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

            <div className="flex w-full items-center justify-end gap-3 xl:max-w-[460px]">
              <div className="hidden text-[13px] text-text-muted xl:block">
                {resultsLabel}
              </div>

              {isFiltered ? (
                <ChannelActionButton quiet showArrow={false} onClick={handleResetView}>
                  Reset
                </ChannelActionButton>
              ) : null}

              <div className="w-full xl:max-w-[340px]">
                <Input
                  aria-label="Search connectors"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search connector or use case"
                  leftIcon={<Search className="h-4 w-4" />}
                  appearance="quiet"
                  className="!rounded-[16px]"
                  inputClassName="!text-[13px]"
                />
              </div>
            </div>
          </div>
        </section>

        {filteredChannels.length ? (
          <section className="relative min-h-[440px]">
            <div
              className={cx(
                "grid gap-4 md:grid-cols-2 xl:grid-cols-3 transition duration-fast ease-premium",
                selectedChannel && "scale-[0.995] opacity-[0.54]"
              )}
            >
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

            {selectedChannel ? (
              <div className="absolute inset-0 z-30">
                <button
                  type="button"
                  aria-label="Close connector details"
                  className="absolute inset-0 rounded-[32px] bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.16)_52%,rgba(255,255,255,0.02)_100%)]"
                  onClick={() => updateSelectedChannel("")}
                />

                <div className="absolute inset-y-0 right-0 flex w-full justify-end p-2 md:p-3">
                  <div className="w-full max-w-[492px]">
                    <ChannelDetailDrawer
                      channel={selectedChannel}
                      open={Boolean(selectedChannel)}
                      onClose={() => updateSelectedChannel("")}
                      onNavigate={handleNavigate}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <div className="grid min-h-[320px] place-items-center rounded-[26px] border border-dashed border-line bg-surface px-5 py-10">
            <div className="max-w-[360px] text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                No matches
              </div>

              <div className="mt-3 text-[22px] font-semibold tracking-[-0.05em] text-text">
                No connectors matched this search.
              </div>

              <p className="mt-3 text-[13px] leading-6 text-text-muted">
                Clear the search or change the filter to bring the full catalog back.
              </p>

              <div className="mt-5 flex justify-center">
                <ChannelActionButton quiet showArrow={false} onClick={handleResetView}>
                  Reset view
                </ChannelActionButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageCanvas>
  );
}