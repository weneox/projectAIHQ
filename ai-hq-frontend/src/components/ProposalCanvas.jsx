import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  CircleDot,
  CheckCircle2,
  Send,
  XCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Sparkles,
} from "lucide-react";
import ProposalCard from "./proposals/ProposalCard.jsx";
import ProposalExpanded from "./proposals/ProposalExpanded.jsx";
import {
  captionFrom,
  rawStatusOf,
  stageLabel,
  stageOf,
  titleFrom,
} from "../features/proposals/proposal.selectors.js";

const STATUS_META = {
  draft: { label: "Queue", icon: CircleDot },
  approved: { label: "Approved", icon: CheckCircle2 },
  published: { label: "Published", icon: Send },
  rejected: { label: "Rejected", icon: XCircle },
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function wsLabel(state) {
  if (state === "connected") return "Live";
  if (state === "connecting") return "Connecting";
  if (state === "reconnecting") return "Reconnecting";
  if (state === "off") return "Polling";
  if (state === "error") return "Error";
  return "Offline";
}

function stageTone(status) {
  if (status === "approved") {
    return {
      dot: "bg-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.42)]",
      soft: "bg-emerald-400/[0.08] text-emerald-100/90",
    };
  }

  if (status === "published") {
    return {
      dot: "bg-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.42)]",
      soft: "bg-amber-400/[0.08] text-amber-100/90",
    };
  }

  if (status === "rejected") {
    return {
      dot: "bg-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.42)]",
      soft: "bg-rose-400/[0.08] text-rose-100/90",
    };
  }

  return {
    dot: "bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.42)]",
    soft: "bg-cyan-400/[0.08] text-cyan-100/90",
  };
}

function featuredSplit(items) {
  if (!items.length) {
    return {
      featured: null,
      secondary: [],
      rest: [],
    };
  }

  return {
    featured: items[0] || null,
    secondary: items.slice(1, 3),
    rest: items.slice(3),
  };
}

function countQueueStates(items = []) {
  return items.reduce(
    (acc, item) => {
      const status = rawStatusOf(item);
      if (status === "pending") acc.pending += 1;
      else if (status === "in_progress" || status === "drafting") acc.inProgress += 1;
      else acc.draft += 1;
      return acc;
    },
    { draft: 0, inProgress: 0, pending: 0 }
  );
}

function MetricStripCard({ label, value, status }) {
  const tone = stageTone(status);

  return (
    <div className="rounded-[24px] bg-white/[0.025] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
          {label}
        </span>
      </div>

      <div className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.06em] text-white">
        {value}
      </div>
    </div>
  );
}

export default function ProposalCanvas({
  proposals = [],
  stats,
  status,
  setStatus,
  search,
  setSearch,
  onApprove,
  onReject,
  onPublish,
  onAnalyze,
  onRequestChanges,
  onRefresh,
  toast,
  wsStatus,
  busy = false,
}) {
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    const byStatus = proposals.filter((p) => stageOf(p) === status);

    return byStatus.filter((p) => {
      const t = String(titleFrom(p) || "").toLowerCase();
      const c = String(captionFrom(p) || "").toLowerCase();
      const id = String(p?.id || "").toLowerCase();
      const agent = String(
        p?.agent_key || p?.agentKey || p?.agent || ""
      ).toLowerCase();

      return !q || t.includes(q) || c.includes(q) || id.includes(q) || agent.includes(q);
    });
  }, [proposals, status, search]);

  useEffect(() => {
    if (!selected?.id) return;
    const fresh = proposals.find((p) => String(p?.id) === String(selected?.id));
    if (fresh) setSelected(fresh);
  }, [proposals, selected?.id]);

  const wsState = wsStatus?.state || "disconnected";
  const WsIcon = wsState === "connected" ? Wifi : WifiOff;
  const currentCount =
    status === "draft"
      ? stats?.draft ?? 0
      : status === "approved"
      ? stats?.approved ?? 0
      : status === "published"
      ? stats?.published ?? 0
      : stats?.rejected ?? 0;

  const counts = {
    draft: stats?.draft ?? 0,
    approved: stats?.approved ?? 0,
    published: stats?.published ?? 0,
    rejected: stats?.rejected ?? 0,
  };

  const tabs = [
    { key: "draft", label: "Queue", count: counts.draft },
    { key: "approved", label: "Approved", count: counts.approved },
    { key: "published", label: "Published", count: counts.published },
    { key: "rejected", label: "Rejected", count: counts.rejected },
  ];

  const split = featuredSplit(filtered);
  const queueBreakdown = useMemo(() => countQueueStates(filtered), [filtered]);

  return (
    <div className="relative space-y-6">
      <section className="relative overflow-hidden rounded-[34px] bg-[linear-gradient(180deg,rgba(5,10,20,0.94),rgba(3,8,16,0.88))] px-5 py-5 shadow-[0_26px_100px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-2xl md:px-7 md:py-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_0%_0%,rgba(34,211,238,0.05),transparent_32%),radial-gradient(760px_circle_at_100%_0%,rgba(59,130,246,0.05),transparent_28%)]" />

        <div className="relative flex flex-col gap-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_430px] xl:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/42">
                  Executive Proposal Surface
                </span>

                <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.045] px-3 py-1.5 text-[11px] font-medium text-white/68 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/90 shadow-[0_0_10px_rgba(34,211,238,0.75)]" />
                  Single-surface review
                </div>
              </div>

              <h2 className="mt-4 text-[38px] font-semibold leading-[0.94] tracking-[-0.075em] text-white md:text-[56px]">
                Proposals
              </h2>

              <p className="mt-4 max-w-[860px] text-[14px] leading-7 text-white/52 md:text-[15px]">
                Review queue state, approvals, and publish outcomes without
                collapsing backend execution truth into a cleaner story.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-white/52">
                <span>Draft → Approve → Publish</span>
                <span>Acceptance is not terminal success</span>
                <span>Raw backend status stays visible</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <MetricStripCard
                label="Queue"
                value={counts.draft}
                status="draft"
              />
              <MetricStripCard
                label="Approved"
                value={counts.approved}
                status="approved"
              />
              <MetricStripCard
                label="Published"
                value={counts.published}
                status="published"
              />
            </div>
          </div>

          <div className="rounded-[28px] bg-white/[0.02] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] md:p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {tabs.map((tab) => {
                  const active = status === tab.key;
                  const tone = stageTone(tab.key);

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setStatus(tab.key)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium transition-all duration-200",
                        active
                          ? "bg-white/[0.08] text-white shadow-[0_10px_30px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.04)]"
                          : "text-white/46 hover:bg-white/[0.04] hover:text-white/82"
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          active ? tone.dot : "bg-white/20"
                        )}
                      />
                      <span>{tab.label}</span>
                      <span
                        className={cn(
                          "text-[12px]",
                          active ? "text-white/62" : "text-white/28"
                        )}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[580px] xl:flex-row xl:items-center xl:justify-end">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex h-11 items-center gap-2 rounded-full bg-white/[0.04] px-4 text-[12px] text-white/66 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <span className={cn("h-2 w-2 rounded-full", stageTone(status).dot)} />
                    <span className="font-medium">{currentCount}</span>
                    <span className="text-white/42">{STATUS_META[status]?.label}</span>
                  </div>

                  <div className="inline-flex h-11 items-center gap-2 rounded-full bg-white/[0.04] px-4 text-[12px] text-white/58 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <WsIcon className="h-4 w-4" />
                    <span>{wsLabel(wsState)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={onRefresh}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.04] text-white/56 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:bg-white/[0.065] hover:text-white"
                    aria-label="Refresh proposals"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>

                <label className="group relative block w-full xl:w-[360px]">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/26 transition group-focus-within:text-white/52" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search proposals, agent, caption, campaign…"
                    className="h-12 w-full rounded-full bg-white/[0.045] pl-11 pr-4 text-[14px] text-white placeholder:text-white/24 outline-none transition focus:bg-white/[0.06]"
                  />
                </label>
              </div>
            </div>

            {toast ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-2 text-[12px] text-white/64 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <Sparkles className="h-3.5 w-3.5 text-white/42" />
                <span>{toast}</span>
              </div>
            ) : null}

            {status === "draft" ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-white/60">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <span className="text-white/36">Draft</span>
                  <span className="font-medium text-white/78">{queueBreakdown.draft}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <span className="text-white/36">{stageLabel({ status: "in_progress" })}</span>
                  <span className="font-medium text-white/78">{queueBreakdown.inProgress}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <span className="text-white/36">{stageLabel({ status: "pending" })}</span>
                  <span className="font-medium text-white/78">{queueBreakdown.pending}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <AnimatePresence mode="wait">
        {selected ? (
          <motion.div
            key={`expanded-${selected?.id}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            <ProposalExpanded
              item={selected}
              onClose={() => setSelected(null)}
              onApprove={onApprove}
              onReject={onReject}
              onPublish={onPublish}
              onAnalyze={onAnalyze}
              onRequestChanges={onRequestChanges}
              busy={busy}
            />

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filtered
                .filter((p) => String(p?.id) !== String(selected?.id))
                .slice(0, 3)
                .map((item) => (
                  <ProposalCard
                    key={item?.id}
                    item={item}
                    isDimmed
                    onOpen={setSelected}
                  />
                ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            {filtered.length === 0 ? (
              <div className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(180deg,rgba(7,12,22,0.78),rgba(5,9,18,0.62))] p-8 text-center shadow-[0_22px_70px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-2xl">
                <div className="text-[18px] font-semibold tracking-[-0.03em] text-white">
                  No items
                </div>
                <div className="mt-2 text-[13px] leading-6 text-white/42">
                  Bu filter üçün uyğun proposal tapılmadı.
                </div>
              </div>
            ) : (
              <>
                {split.featured ? (
                  <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_420px]">
                    <ProposalCard
                      item={split.featured}
                      onOpen={setSelected}
                      featured
                    />

                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
                      {split.secondary.map((item) => (
                        <ProposalCard
                          key={item?.id}
                          item={item}
                          onOpen={setSelected}
                          compact
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {split.rest.length ? (
                  <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                    {split.rest.map((item) => (
                      <ProposalCard
                        key={item?.id}
                        item={item}
                        onOpen={setSelected}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
