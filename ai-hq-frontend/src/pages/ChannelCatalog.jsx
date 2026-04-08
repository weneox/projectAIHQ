import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Link2,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
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

function compactText(value, fallback = "") {
  return s(value, fallback);
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

function StatusMiniCard({ label, status, summary, tone = "neutral", icon: Icon }) {
  const toneStyles =
    tone === "ready"
      ? {
          border: "border-[rgba(22,101,52,0.10)]",
          bg: "bg-[rgba(236,253,245,0.72)]",
          icon: "text-[rgba(22,101,52,0.92)]",
          status: "text-[rgba(22,101,52,0.82)]",
        }
      : tone === "attention"
        ? {
            border: "border-[rgba(180,83,9,0.10)]",
            bg: "bg-[rgba(255,251,235,0.78)]",
            icon: "text-[rgba(180,83,9,0.92)]",
            status: "text-[rgba(146,64,14,0.82)]",
          }
        : {
            border: "border-[rgba(15,23,42,0.06)]",
            bg: "bg-white/[0.76]",
            icon: "text-[rgba(15,23,42,0.48)]",
            status: "text-[rgba(15,23,42,0.42)]",
          };

  return (
    <div
      className={cx(
        "border px-4 py-4 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.16)]",
        toneStyles.border,
        toneStyles.bg
      )}
      style={{ borderRadius: 16 }}
    >
      <div className="flex items-start gap-3">
        <div
          className={cx(
            "flex h-10 w-10 shrink-0 items-center justify-center border border-white/70 bg-white/[0.82]",
            toneStyles.icon
          )}
          style={{ borderRadius: 12 }}
        >
          <Icon className="h-[16px] w-[16px]" strokeWidth={1.9} />
        </div>

        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.32)]">
            {label}
          </div>

          <div className="mt-1 text-[14px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.95)]">
            {status}
          </div>

          <div className={cx("mt-1 text-[12px] leading-5", toneStyles.status)}>
            {compactSentence(summary)}
          </div>
        </div>
      </div>
    </div>
  );
}

function LaunchHero({ readiness, meta, telegram, truth, onNavigate }) {
  const palette =
    readiness.status === "ready"
      ? {
          border: "border-[rgba(22,101,52,0.10)]",
          bg: "bg-[linear-gradient(180deg,rgba(250,255,252,0.98),rgba(246,252,248,0.98))]",
          icon: CheckCircle2,
          iconColor: "text-[rgba(22,101,52,0.92)]",
          eyebrow: "text-[rgba(22,101,52,0.84)]",
        }
      : readiness.status === "attention"
        ? {
            border: "border-[rgba(180,83,9,0.10)]",
            bg: "bg-[linear-gradient(180deg,rgba(255,253,247,0.98),rgba(255,249,238,0.98))]",
            icon: Wrench,
            iconColor: "text-[rgba(180,83,9,0.92)]",
            eyebrow: "text-[rgba(146,64,14,0.82)]",
          }
        : {
            border: "border-[rgba(185,28,28,0.08)]",
            bg: "bg-[linear-gradient(180deg,rgba(255,251,251,0.98),rgba(255,247,247,0.98))]",
            icon: Link2,
            iconColor: "text-[rgba(185,28,28,0.9)]",
            eyebrow: "text-[rgba(153,27,27,0.82)]",
          };

  const Icon = palette.icon;

  const metaTone =
    meta?.status === "ready"
      ? "ready"
      : meta?.status === "attention"
        ? "attention"
        : "neutral";
  const telegramTone =
    telegram?.status === "ready"
      ? "ready"
      : telegram?.status === "attention"
        ? "attention"
        : "neutral";
  const truthTone =
    truth?.status === "ready"
      ? "ready"
      : truth?.status === "attention" || truth?.status === "blocked"
        ? "attention"
        : "neutral";

  return (
    <section
      className={cx(
        "relative overflow-hidden border shadow-[0_24px_54px_-42px_rgba(15,23,42,0.16)]",
        palette.border,
        palette.bg
      )}
      style={{ borderRadius: 22 }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(620px_circle_at_10%_0%,rgba(38,76,165,0.05),transparent_52%)]" />

      <div className="relative px-5 py-5 md:px-7 md:py-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)] xl:gap-8">
          <div className="min-w-0">
            <div className={cx("flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]", palette.eyebrow)}>
              <Icon className={cx("h-[13px] w-[13px]", palette.iconColor)} strokeWidth={1.95} />
              <span>{compactText(readiness.statusLabel, "Launch posture")}</span>
            </div>

            <div className="mt-4 text-[2rem] font-semibold leading-[0.94] tracking-[-0.065em] text-[rgba(15,23,42,0.98)] md:text-[2.9rem]">
              {compactText(readiness.title, "Launch channels")}
            </div>

            <div className="mt-3 max-w-[40rem] text-[14px] leading-7 text-[rgba(15,23,42,0.58)]">
              {compactSentence(
                readiness.summary,
                "Connect the right channel and keep launch posture healthy."
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {readiness.action?.path ? (
                <Button
                  size="hero"
                  onClick={() => onNavigate(readiness.action.path)}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  {readiness.action.label}
                </Button>
              ) : null}

              <Button
                type="button"
                size="hero"
                variant="secondary"
                onClick={() => onNavigate("/truth")}
              >
                Open truth
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
            <StatusMiniCard
              label="Instagram"
              status={compactText(meta?.statusLabel, "Unknown")}
              summary={compactText(meta?.summary, "Instagram posture unavailable.")}
              tone={metaTone}
              icon={Sparkles}
            />
            <StatusMiniCard
              label="Telegram"
              status={compactText(telegram?.statusLabel, "Unknown")}
              summary={compactText(telegram?.summary, "Telegram posture unavailable.")}
              tone={telegramTone}
              icon={Link2}
            />
            <StatusMiniCard
              label="Truth + runtime"
              status={compactText(truth?.statusLabel, "Unknown")}
              summary={compactText(truth?.summary, "Truth posture unavailable.")}
              tone={truthTone}
              icon={ShieldCheck}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, meta, actionLabel, onAction }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(15,23,42,0.32)]">
          {eyebrow}
        </div>
        <div className="mt-2 text-[24px] font-semibold tracking-[-0.055em] text-[rgba(15,23,42,0.96)]">
          {title}
        </div>
        {meta ? (
          <div className="mt-2 text-[13px] leading-6 text-[rgba(15,23,42,0.52)]">
            {meta}
          </div>
        ) : null}
      </div>

      {actionLabel ? (
        <div className="shrink-0">
          <ChannelActionButton quiet showArrow={false} onClick={onAction}>
            {actionLabel}
          </ChannelActionButton>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ onReset }) {
  return (
    <div className="grid min-h-[220px] place-items-center border border-dashed border-[#dbe3ec] bg-white/[0.76] px-5 py-10 shadow-[0_12px_30px_-28px_rgba(15,23,42,0.12)]" style={{ borderRadius: 18 }}>
      <div className="max-w-[360px] text-center">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
          No matches
        </div>

        <div className="mt-2 text-[22px] font-semibold tracking-[-0.05em] text-[rgba(15,23,42,0.96)]">
          No connector matched this view.
        </div>

        <div className="mt-3 text-[14px] leading-6 text-[rgba(15,23,42,0.54)]">
          Reset the catalog and bring the full launch surface back.
        </div>

        <div className="mt-5 flex justify-center">
          <Button type="button" size="sm" variant="secondary" onClick={onReset}>
            Reset view
          </Button>
        </div>
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
      <PageCanvas className="px-4 py-4 md:px-5 md:py-5 xl:px-0">
        <div className="space-y-6">
          <LaunchHero
            readiness={launchReadiness}
            meta={readinessState.meta}
            telegram={readinessState.telegram}
            truth={readinessState.truth}
            onNavigate={handleNavigate}
          />

          {s(readinessState.error) ? (
            <div
              className="border border-[rgba(185,28,28,0.10)] bg-[rgba(255,247,247,0.9)] px-4 py-3 text-[13px] leading-6 text-[rgba(153,27,27,0.88)]"
              style={{ borderRadius: 14 }}
            >
              {readinessState.error}
            </div>
          ) : null}

          <section
            className="border border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(253,254,255,0.98),rgba(248,250,252,0.98))] px-5 py-5 shadow-[0_18px_44px_-36px_rgba(15,23,42,0.14)]"
            style={{ borderRadius: 20 }}
          >
            <div className="flex flex-col gap-4 border-b border-[rgba(15,23,42,0.06)] pb-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(15,23,42,0.32)]">
                  Catalog
                </div>

                <div className="mt-2 text-[24px] font-semibold tracking-[-0.055em] text-[rgba(15,23,42,0.96)]">
                  Connect what matters now.
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[rgba(15,23,42,0.34)]">
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

            <div className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-3">
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

            <div className="mt-6 space-y-8">
              {filteredChannels.length ? (
                <>
                  {primaryChannels.length ? (
                    <section>
                      <SectionHeader
                        eyebrow="Ready now"
                        title="Launch connectors"
                        meta="These are the channels that belong in the current launch lane."
                      />

                      <div className="mt-4">
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
                      </div>
                    </section>
                  ) : null}

                  {secondaryChannels.length ? (
                    <section className="border-t border-[rgba(15,23,42,0.06)] pt-8">
                      <SectionHeader
                        eyebrow="Later"
                        title="Not in the launch lane yet"
                        meta="Keep these visible, but do not let them distort the launch story."
                      />

                      <div className="mt-4">
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
                      </div>
                    </section>
                  ) : null}
                </>
              ) : (
                <EmptyState onReset={handleResetView} />
              )}
            </div>
          </section>
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