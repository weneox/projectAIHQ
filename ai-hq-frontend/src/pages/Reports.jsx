import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  CheckCircle2,
  Flame,
  MessageSquare,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

import { listLeads } from "../api/leads.js";
import { getOutboundSummary, listInboxThreads } from "../api/inbox.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import AppStatCard from "../components/ui/AppStatCard.jsx";
import AppStatusText from "../components/ui/AppStatusText.jsx";
import AppTag from "../components/ui/AppTag.jsx";
import {
  AppTableCard,
  AppTableCell,
  AppTableHeaderCell,
  AppTableHeaderRow,
  AppTableRow,
  AppTableText,
  AppTableToolbar,
} from "../components/ui/AppTable.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
  PageHeader,
} from "../components/ui/AppShellPrimitives.jsx";

const TREND_DAYS = 8;

const SOURCE_TABLE_GRID_STYLE = {
  gridTemplateColumns: "minmax(220px,1fr) 130px 130px 150px 130px",
};

const SOURCE_TABLE_MIN_WIDTH = "min-w-[760px] w-full";

const STAGE_ORDER = ["new", "qualified", "proposal", "won", "lost"];
const PRIORITY_ORDER = ["urgent", "high", "medium", "low"];

const CHART_COLORS = [
  "rgb(var(--color-brand))",
  "rgb(var(--color-success))",
  "rgb(var(--color-warning))",
  "rgb(var(--color-danger))",
  "rgb(var(--color-text-soft))",
];

const LOCAL_LEADS = [
  {
    id: "report_lead_01",
    full_name: "Aylin Carter",
    source: "website",
    stage: "qualified",
    status: "open",
    priority: "high",
    value: 4200,
    created_at: daysAgo(7),
    updated_at: daysAgo(1),
  },
  {
    id: "report_lead_02",
    full_name: "Marcus Hale",
    source: "instagram",
    stage: "proposal",
    status: "open",
    priority: "urgent",
    value: 7800,
    created_at: daysAgo(5),
    updated_at: daysAgo(0),
  },
  {
    id: "report_lead_03",
    full_name: "Selin Ward",
    source: "telegram",
    stage: "won",
    status: "converted",
    priority: "medium",
    value: 12500,
    created_at: daysAgo(4),
    updated_at: daysAgo(2),
  },
  {
    id: "report_lead_04",
    full_name: "Noah Rivers",
    source: "website",
    stage: "new",
    status: "open",
    priority: "medium",
    value: 1900,
    created_at: daysAgo(2),
    updated_at: daysAgo(2),
  },
  {
    id: "report_lead_05",
    full_name: "Maya Stone",
    source: "facebook",
    stage: "qualified",
    status: "open",
    priority: "high",
    value: 5600,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
  },
  {
    id: "report_lead_06",
    full_name: "Theo Knight",
    source: "email",
    stage: "lost",
    status: "closed",
    priority: "low",
    value: 2400,
    created_at: daysAgo(6),
    updated_at: daysAgo(3),
  },
];

const LOCAL_THREADS = [
  {
    id: "thread_01",
    status: "open",
    unread_count: 2,
    channel: "instagram",
    created_at: daysAgo(1),
    updated_at: daysAgo(0),
  },
  {
    id: "thread_02",
    status: "open",
    unread_count: 1,
    channel: "website",
    created_at: daysAgo(2),
    updated_at: daysAgo(1),
  },
  {
    id: "thread_03",
    status: "resolved",
    unread_count: 0,
    channel: "telegram",
    created_at: daysAgo(4),
    updated_at: daysAgo(2),
  },
];

function daysAgo(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() - Number(days || 0));
  return date.toISOString();
}

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function titleize(value = "") {
  return s(value || "unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isLocalDesignMode() {
  const host =
    typeof window !== "undefined" ? lower(window.location.hostname) : "";

  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    Boolean(import.meta.env?.DEV)
  );
}

function normalizeList(payload, keys = []) {
  if (Array.isArray(payload)) return payload;

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }

  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;

  return [];
}

function withLocalLeads(leads = []) {
  const base = arr(leads);
  if (!isLocalDesignMode()) return base;
  if (base.length >= 4) return base;
  return [...base, ...LOCAL_LEADS];
}

function withLocalThreads(threads = []) {
  const base = arr(threads);
  if (!isLocalDesignMode()) return base;
  if (base.length >= 2) return base;
  return [...base, ...LOCAL_THREADS];
}

function leadSource(lead = {}) {
  return lower(
    lead.source ||
      lead.channel ||
      lead.channel_type ||
      lead.provider ||
      lead.source_type ||
      "direct"
  );
}

function leadStage(lead = {}) {
  return lower(lead.stage || lead.pipeline_stage || "new");
}

function leadStatus(lead = {}) {
  return lower(lead.status || "open");
}

function leadPriority(lead = {}) {
  return lower(lead.priority || lead.urgency || "medium");
}

function leadValue(lead = {}) {
  return n(lead.value || lead.estimated_value || lead.deal_value || lead.amount || 0);
}

function leadCreatedRaw(lead = {}) {
  return s(lead.created_at || lead.createdAt || lead.updated_at || lead.updatedAt);
}

function threadStatus(thread = {}) {
  return lower(thread.status || thread.state || "open");
}

function threadUnread(thread = {}) {
  return n(thread.unread_count || thread.unreadCount || thread.unread || 0);
}

function dateKey(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatMoney(value = 0) {
  const amount = n(value);
  if (!amount) return "—";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value = 0) {
  const safe = n(value);
  return `${Math.round(safe)}%`;
}

function stageTone(stage = "") {
  const safe = lower(stage);

  if (["won", "converted", "customer"].includes(safe)) return "success";
  if (["proposal", "negotiation", "demo requested"].includes(safe)) return "brand";
  if (["qualified", "discovery"].includes(safe)) return "info";
  if (["lost", "closed_lost"].includes(safe)) return "danger";
  return "neutral";
}

function createTrendData(leads = []) {
  const days = Array.from({ length: TREND_DAYS }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (TREND_DAYS - 1 - index));

    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      leads: 0,
      won: 0,
      value: 0,
    };
  });

  const map = new Map(days.map((item) => [item.key, item]));

  for (const lead of leads) {
    const key = dateKey(leadCreatedRaw(lead));
    const item = map.get(key);

    if (!item) continue;

    item.leads += 1;
    item.value += leadValue(lead);

    if (["won", "converted"].includes(leadStage(lead))) {
      item.won += 1;
    }
  }

  return days;
}

function createStageData(leads = []) {
  const counts = new Map();

  for (const lead of leads) {
    const stage = leadStage(lead);
    counts.set(stage, (counts.get(stage) || 0) + 1);
  }

  return STAGE_ORDER.map((stage) => ({
    stage: titleize(stage),
    value: counts.get(stage) || 0,
    tone: stageTone(stage),
  }));
}

function createPriorityData(leads = []) {
  const counts = new Map();

  for (const lead of leads) {
    const priority = leadPriority(lead);
    counts.set(priority, (counts.get(priority) || 0) + 1);
  }

  return PRIORITY_ORDER.map((priority) => ({
    name: titleize(priority),
    value: counts.get(priority) || 0,
  })).filter((item) => item.value > 0);
}

function createSourceData(leads = []) {
  const map = new Map();

  for (const lead of leads) {
    const source = leadSource(lead);
    const current = map.get(source) || {
      source,
      label: titleize(source),
      leads: 0,
      won: 0,
      value: 0,
    };

    current.leads += 1;
    current.value += leadValue(lead);

    if (["won", "converted"].includes(leadStage(lead))) {
      current.won += 1;
    }

    map.set(source, current);
  }

  return [...map.values()]
    .map((item) => ({
      ...item,
      conversion: item.leads ? Math.round((item.won / item.leads) * 100) : 0,
    }))
    .sort((a, b) => b.leads - a.leads || b.value - a.value);
}

function createThreadData(threads = []) {
  const open = threads.filter((thread) => threadStatus(thread) === "open").length;
  const resolved = threads.filter((thread) =>
    ["resolved", "closed", "done"].includes(threadStatus(thread))
  ).length;
  const unread = threads.reduce((sum, thread) => sum + threadUnread(thread), 0);

  return [
    { name: "Open", value: open },
    { name: "Resolved", value: resolved },
    { name: "Unread", value: unread },
  ].filter((item) => item.value > 0);
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="border border-line bg-white px-3 py-2 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.55)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
        {label}
      </div>

      {payload.map((item) => (
        <div
          key={`${item.dataKey}-${item.name}`}
          className="mt-1 flex items-center gap-2 text-[12.5px] font-semibold text-text"
        >
          <span className="h-1.5 w-1.5 bg-brand" />
          <span>{item.name || item.dataKey}</span>
          <span className="text-text-muted">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, description, children }) {
  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-5 py-4">
        <div className="text-[15px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
          {title}
        </div>
        {description ? (
          <div className="mt-1 text-[12.5px] font-medium text-text-muted">
            {description}
          </div>
        ) : null}
      </div>

      <div className="h-[260px] px-4 pb-4 pt-5">{children}</div>
    </Card>
  );
}

function SourceTable({ sources = [] }) {
  return (
    <AppTableCard>
      <AppTableToolbar
        title="Source quality"
        description="Lead volume, converted opportunities, and estimated pipeline by source."
      />

      <div className="overflow-x-auto">
        <div className={SOURCE_TABLE_MIN_WIDTH}>
          <AppTableHeaderRow
            minWidthClass="w-full"
            gridStyle={SOURCE_TABLE_GRID_STYLE}
          >
            <AppTableHeaderCell>Source</AppTableHeaderCell>
            <AppTableHeaderCell>Leads</AppTableHeaderCell>
            <AppTableHeaderCell>Won</AppTableHeaderCell>
            <AppTableHeaderCell>Pipeline</AppTableHeaderCell>
            <AppTableHeaderCell>Conversion</AppTableHeaderCell>
          </AppTableHeaderRow>

          {sources.map((source) => (
            <AppTableRow
              key={source.source}
              minWidthClass={SOURCE_TABLE_MIN_WIDTH}
              gridStyle={SOURCE_TABLE_GRID_STYLE}
            >
              <AppTableCell>
                <AppTag>{source.label}</AppTag>
              </AppTableCell>

              <AppTableCell>
                <AppTableText>{source.leads}</AppTableText>
              </AppTableCell>

              <AppTableCell>
                <AppStatusText tone={source.won ? "success" : "neutral"}>
                  {source.won}
                </AppStatusText>
              </AppTableCell>

              <AppTableCell>
                <AppTableText>{formatMoney(source.value)}</AppTableText>
              </AppTableCell>

              <AppTableCell>
                <AppTableText muted>{formatPercent(source.conversion)}</AppTableText>
              </AppTableCell>
            </AppTableRow>
          ))}
        </div>
      </div>
    </AppTableCard>
  );
}

export default function Reports() {
  const [leads, setLeads] = useState([]);
  const [threads, setThreads] = useState([]);
  const [outboundSummary, setOutboundSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadReports = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [leadResult, threadResult, outboundResult] = await Promise.allSettled([
        listLeads({ limit: 300 }),
        listInboxThreads({ limit: 300 }),
        getOutboundSummary({ limit: 300 }),
      ]);

      const nextLeads =
        leadResult.status === "fulfilled"
          ? withLocalLeads(normalizeList(leadResult.value, ["leads"]))
          : withLocalLeads([]);

      const nextThreads =
        threadResult.status === "fulfilled"
          ? withLocalThreads(normalizeList(threadResult.value, ["threads"]))
          : withLocalThreads([]);

      setLeads(nextLeads);
      setThreads(nextThreads);

      if (outboundResult.status === "fulfilled") {
        setOutboundSummary(outboundResult.value || null);
      } else {
        setOutboundSummary(null);
      }

      const failures = [leadResult, threadResult, outboundResult].filter(
        (item) => item.status === "rejected"
      );

      if (failures.length) {
        setError("Some report data could not be loaded. Local preview data is being used where needed.");
      }
    } catch (err) {
      setError(err?.message || "Unable to load reports.");
      setLeads(withLocalLeads([]));
      setThreads(withLocalThreads([]));
      setOutboundSummary(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const metrics = useMemo(() => {
    const totalLeads = leads.length;
    const openLeads = leads.filter((lead) =>
      ["open", "active", "waiting"].includes(leadStatus(lead))
    ).length;
    const wonLeads = leads.filter((lead) =>
      ["won", "converted"].includes(leadStage(lead))
    ).length;
    const pipelineValue = leads.reduce((sum, lead) => sum + leadValue(lead), 0);
    const conversionRate = totalLeads ? (wonLeads / totalLeads) * 100 : 0;

    return {
      totalLeads,
      openLeads,
      wonLeads,
      pipelineValue,
      conversionRate,
    };
  }, [leads]);

  const trendData = useMemo(() => createTrendData(leads), [leads]);
  const stageData = useMemo(() => createStageData(leads), [leads]);
  const priorityData = useMemo(() => createPriorityData(leads), [leads]);
  const sourceData = useMemo(() => createSourceData(leads), [leads]);
  const threadData = useMemo(() => createThreadData(threads), [threads]);

  if (loading) {
    return (
      <PageCanvas>
        <LoadingSurface
          title="Loading reports"
          description="Preparing performance, pipeline, and channel analytics."
          rows={5}
        />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas>
      <PageHeader
        title="Performance reports"
        description="Analyze lead growth, conversion quality, pipeline value, and inbox workload from one reporting surface."
        actions={
          <Button
            type="button"
            variant="secondary"
            size="md"
            loading={refreshing}
            onClick={() => loadReports({ silent: true })}
            leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
          >
            Refresh
          </Button>
        }
      />

      {error ? (
        <InlineNotice
          tone="warning"
          title="Partial report data"
          description={error}
          compact
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AppStatCard icon={Users} label="Total leads" value={metrics.totalLeads} />
        <AppStatCard icon={Target} label="Open pipeline" value={metrics.openLeads} />
        <AppStatCard
          icon={CheckCircle2}
          label="Conversion rate"
          value={formatPercent(metrics.conversionRate)}
        />
        <AppStatCard
          icon={TrendingUp}
          label="Pipeline value"
          value={formatMoney(metrics.pipelineValue)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <ChartCard
          title="Lead inflow"
          description={`New opportunities created across the last ${TREND_DAYS} days.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="leadReportFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="rgb(var(--color-brand))"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor="rgb(var(--color-brand))"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="rgb(var(--color-line-soft))" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "rgb(var(--color-text-subtle))" }}
              />
              <YAxis hide allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="leads"
                name="Leads"
                stroke="rgb(var(--color-brand))"
                strokeWidth={2}
                fill="url(#leadReportFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Stage distribution"
          description="Current pipeline shape by sales stage."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stageData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgb(var(--color-line-soft))" vertical={false} />
              <XAxis
                dataKey="stage"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "rgb(var(--color-text-subtle))" }}
              />
              <YAxis hide allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                dataKey="value"
                name="Leads"
                radius={[6, 6, 0, 0]}
                fill="rgb(var(--color-brand))"
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Source mix" description="Lead count by acquisition source.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sourceData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgb(var(--color-line-soft))" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "rgb(var(--color-text-subtle))" }}
              />
              <YAxis hide allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                dataKey="leads"
                name="Leads"
                radius={[6, 6, 0, 0]}
                fill="rgb(var(--color-brand))"
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Priority load" description="Urgency distribution across active leads.">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<ChartTooltip />} />
              <Pie
                data={priorityData}
                dataKey="value"
                nameKey="name"
                innerRadius={54}
                outerRadius={86}
                paddingAngle={3}
              >
                {priorityData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Inbox workload" description="Open, resolved, and unread thread load.">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<ChartTooltip />} />
              <Pie
                data={threadData}
                dataKey="value"
                nameKey="name"
                innerRadius={54}
                outerRadius={86}
                paddingAngle={3}
              >
                {threadData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SourceTable sources={sourceData} />

        <Card padded={false} clip>
          <div className="border-b border-line-soft px-5 py-4">
            <div className="text-[15px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              Operational snapshot
            </div>
            <div className="mt-1 text-[12.5px] font-medium text-text-muted">
              High-level signals from pipeline and inbox activity.
            </div>
          </div>

          <div className="space-y-3 px-5 py-5">
            <div className="flex items-center justify-between gap-4 border-b border-line-soft pb-3">
              <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
                Won leads
              </span>
              <AppStatusText tone="success">{metrics.wonLeads}</AppStatusText>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-line-soft pb-3">
              <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
                Open threads
              </span>
              <AppStatusText tone="brand">
                {threads.filter((thread) => threadStatus(thread) === "open").length}
              </AppStatusText>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-line-soft pb-3">
              <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
                Unread messages
              </span>
              <AppStatusText tone="warning">
                {threads.reduce((sum, thread) => sum + threadUnread(thread), 0)}
              </AppStatusText>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
                Outbound health
              </span>
              <AppTag>
                {outboundSummary ? "Available" : "Not configured"}
              </AppTag>
            </div>
          </div>
        </Card>
      </div>
    </PageCanvas>
  );
}