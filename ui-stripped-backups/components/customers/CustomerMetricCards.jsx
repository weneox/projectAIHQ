import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function leadStage(lead = {}) {
  return lower(lead.stage || "new");
}

function leadThreadId(lead = {}) {
  return s(lead.inbox_thread_id || lead.inboxThreadId || lead.thread_id);
}

function SparkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  const first = payload[0] || {};
  const point = first.payload || {};
  const value = Number(point.value || first.value || 0);

  return (
    <div className="rounded-md border border-[#DDE8F3] bg-white/95 px-3 py-2 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.55)] backdrop-blur">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A96A8]">
        {point.label || label}
      </div>
      <div className="mt-1 text-[14px] font-semibold tracking-[-0.03em] text-[#0F172A]">
        {value}
      </div>
    </div>
  );
}

export default function CustomerMetricCards({ metrics, leads }) {
  const safe = metrics || {};
  const allLeads = Array.isArray(leads) ? leads : [];

  function readLeadDate(lead) {
    const raw =
      lead?.createdAt ||
      lead?.created_at ||
      lead?.firstSeenAt ||
      lead?.first_seen_at ||
      lead?.lastSeenAt ||
      lead?.last_seen_at ||
      lead?.updatedAt ||
      lead?.updated_at ||
      lead?.date ||
      lead?.timestamp;

    const parsed = raw ? new Date(raw) : new Date();

    return Number.isFinite(parsed.getTime()) ? parsed : new Date();
  }

  function dayLabel(date) {
    return date.toLocaleDateString("en", {
      month: "short",
      day: "numeric",
    });
  }

  function buildSeries(predicate) {
    const days = [];
    const end = new Date();

    for (let index = 6; index >= 0; index -= 1) {
      const date = new Date(end);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - index);

      days.push({
        label: dayLabel(date),
        date,
      });
    }

    return days.map((day) => {
      const value = allLeads.filter((lead) => {
        const leadDate = readLeadDate(lead);
        leadDate.setHours(0, 0, 0, 0);

        return leadDate <= day.date && predicate(lead);
      }).length;

      return {
        label: day.label,
        value,
        visualValue: value + 0.08,
      };
    });
  }

  function trendCopy(series) {
    const first = Number(series?.[0]?.value || 0);
    const last = Number(series?.[series.length - 1]?.value || 0);
    const diff = last - first;

    if (diff > 0) return "+" + diff + " this week";
    if (diff < 0) return String(diff) + " this week";

    return "steady 7d";
  }

  const customersSeries = buildSeries(() => true);
  const qualifiedSeries = buildSeries((lead) => leadStage(lead) === "qualified");
  const demoSeries = buildSeries((lead) => leadStage(lead).includes("demo"));
  const threadsSeries = buildSeries((lead) => Boolean(leadThreadId(lead)));

  const items = [
    {
      key: "customers",
      label: "Customers",
      value: safe.total ?? 0,
      detail: String(safe.visible ?? 0) + " visible now",
      hint: trendCopy(customersSeries),
      badge: "Live base",
      series: customersSeries,
    },
    {
      key: "qualified",
      label: "Qualified",
      value: safe.qualified ?? 0,
      detail: "sales-ready leads",
      hint: trendCopy(qualifiedSeries),
      badge: "Pipeline",
      series: qualifiedSeries,
    },
    {
      key: "demo",
      label: "Demo intent",
      value: safe.demoRequested ?? 0,
      detail: "requested demo",
      hint: trendCopy(demoSeries),
      badge: "Intent",
      series: demoSeries,
    },
    {
      key: "threads",
      label: "Threads",
      value: safe.withThreads ?? 0,
      detail: String(safe.conversationRate ?? 0) + "% conversation linked",
      hint: trendCopy(threadsSeries),
      badge: "Coverage",
      series: threadsSeries,
    },
  ];

  return (
    <div className="border-b border-[#E3EAF2] bg-[linear-gradient(180deg,#FFFFFF_0%,#FBFDFF_100%)] px-6 py-3">
      <div className="grid gap-2.5 md:grid-cols-2 2xl:grid-cols-4">
        {items.map((item) => {
          const gradientId = "customer-spark-" + item.key;
          const maxValue = Math.max(
            1,
            ...item.series.map((point) => Number(point.visualValue || 0))
          );
          const domainMax = Math.max(2, maxValue + 0.72);

          return (
            <div
              key={item.key}
              className="group relative overflow-hidden rounded-[17px] border border-[#E3EAF2] bg-white px-4 pt-3 shadow-[0_12px_30px_-30px_rgba(15,23,42,0.38)] transition-[border-color,box-shadow,transform] duration-base ease-premium hover:-translate-y-px hover:border-[#BFD8E7] hover:shadow-[0_22px_48px_-34px_rgba(15,23,42,0.54)]"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(20,184,166,0.62),transparent)] opacity-0 transition-opacity duration-base ease-premium group-hover:opacity-100" />
              <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-md bg-[#14B8A6]/[0.045] blur-2xl" />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A96A8]">
                    {item.label}
                  </div>

                  <div className="mt-2 flex items-end gap-2">
                    <div className="text-[24px] font-semibold leading-none tracking-[-0.055em] text-[#0F172A]">
                      {item.value}
                    </div>

                    <div className="pb-0.5 text-[11px] font-semibold text-[#0F766E]">
                      {item.hint}
                    </div>
                  </div>
                </div>

                <span className="rounded-md border border-[#CDEFE9] bg-[#F0FDFA] px-2.5 py-1 text-[10.5px] font-semibold text-[#0F766E] shadow-[0_1px_2px_rgba(20,184,166,0.08)]">
                  {item.badge}
                </span>
              </div>

              <div className="mt-2 truncate text-[12px] font-medium text-[#66768A]">
                {item.detail}
              </div>

              <div className="-mx-2 mt-2 h-[74px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={item.series}
                    margin={{ top: 6, right: 8, bottom: 10, left: 8 }}
                  >
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.34} />
                        <stop offset="58%" stopColor="#14B8A6" stopOpacity={0.08} />
                        <stop offset="100%" stopColor="#14B8A6" stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    <YAxis hide domain={[0, domainMax]} />

                    <Tooltip
                      cursor={{
                        stroke: "#14B8A6",
                        strokeOpacity: 0.24,
                        strokeWidth: 1,
                      }}
                      content={<SparkTooltip />}
                    />

                    <Area
                      type="monotone"
                      dataKey="visualValue"
                      stroke="#14B8A6"
                      strokeWidth={2.25}
                      fill={"url(#" + gradientId + ")"}
                      dot={false}
                      activeDot={{
                        r: 4,
                        strokeWidth: 2,
                        stroke: "#FFFFFF",
                        fill: "#14B8A6",
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
