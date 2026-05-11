import {
  ArrowRight, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  CircleAlert,
  Clock3,
  Database,
  Inbox,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getReportsOverview } from "../api/reports.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import AppSegmentedControl from "../components/ui/AppSegmentedControl.jsx";
import AppStatusText from "../components/ui/AppStatusText.jsx";
import AppTag from "../components/ui/AppTag.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
  PageHeader,
} from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

const PERIODS = [
  { id: "24h", label: "24h" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function titleize(value = "") {
  return s(value || "unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatNumber(value = 0) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(n(value));
}

function formatPercent(value = 0) {
  return `${Math.round(n(value))}%`;
}

function formatDateLabel(value = "") {
  const raw = s(value);
  if (!raw) return "—";

  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function rangeLabel(range = "7d") {
  const match = PERIODS.find((item) => item.id === range);
  return match?.label || "7 days";
}

function summarizeReport(payload = {}) {
  const summary = obj(payload.summary);
  const messagesIn = n(summary.messagesIn);
  const messagesOut = n(summary.messagesOut);
  const leads = n(summary.leads);
  const aiReplies = n(summary.aiReplies);
  const openThreads = n(summary.openThreads);
  const unreadMessages = n(summary.unreadMessages);

  const conversion =
    messagesIn > 0 ? Math.round((leads / Math.max(messagesIn, 1)) * 100) : 0;
  const automationShare =
    messagesOut > 0 ? Math.round((aiReplies / Math.max(messagesOut, 1)) * 100) : 0;

  return {
    ...summary,
    messagesIn,
    messagesOut,
    leads,
    aiReplies,
    openThreads,
    unreadMessages,
    conversion,
    automationShare,
  };
}

function normalizeSeries(payload = {}) {
  return arr(payload.timeseries).map((row) => ({
    date: s(row.date),
    label: formatDateLabel(row.date),
    apiCalls: n(row.apiCalls),
    aiUnits: n(row.aiUnits),
    messagesIn: n(row.messagesIn),
    messagesOut: n(row.messagesOut),
    aiReplies: n(row.aiReplies),
    webhookEvents: n(row.webhookEvents),
    leads: n(row.leads),
  }));
}

function normalizeChannels(payload = {}) {
  return arr(payload.channels)
    .map((row) => {
      const messagesIn = n(row.messagesIn);
      const messagesOut = n(row.messagesOut);
      const aiReplies = n(row.aiReplies);
      const total = messagesIn + messagesOut;

      return {
        id: lower(row.channel || "unknown"),
        label: titleize(row.channel || "unknown"),
        messagesIn,
        messagesOut,
        aiReplies,
        total,
        automationShare:
          messagesOut > 0 ? Math.round((aiReplies / Math.max(messagesOut, 1)) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

function normalizeLeadStages(payload = {}) {
  return arr(payload.leadStages)
    .map((row) => ({
      id: lower(row.stage || "new"),
      label: titleize(row.stage || "new"),
      count: n(row.count),
    }))
    .sort((a, b) => b.count - a.count);
}

function hasActivity(summary = {}) {
  return (
    n(summary.messagesIn) > 0 ||
    n(summary.messagesOut) > 0 ||
    n(summary.aiReplies) > 0 ||
    n(summary.leads) > 0 ||
    n(summary.openThreads) > 0 ||
    n(summary.unreadMessages) > 0
  );
}

function MetricCard({ icon: Icon, label, value, helper, tone = "neutral" }) {
  return (
    <div className="min-h-[132px] border-b border-line-soft px-5 py-4 md:border-r xl:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            {label}
          </div>
          <div className="mt-2 text-[27px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
            {value}
          </div>
        </div>

        <div
          className={cx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border",
            tone === "success"
              ? "border-success/20 bg-success/5 text-success"
              : tone === "warning"
                ? "border-warning/20 bg-warning/5 text-warning"
                : tone === "brand"
                  ? "border-brand/20 bg-brand/5 text-brand"
                  : "border-line-soft bg-surface-subtle text-text-muted"
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2.05} />
        </div>
      </div>

      <div className="mt-3 text-[12.5px] font-medium leading-5 text-text-muted">
        {helper}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.55)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
        {label}
      </div>

      {payload.map((item) => (
        <div
          key={`${item.dataKey}-${item.name}`}
          className="mt-1 flex items-center gap-2 text-[12.5px] font-semibold text-text"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          <span>{item.name || item.dataKey}</span>
          <span className="text-text-muted">{formatNumber(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyAnalyticsState({ range, onOpenChannels, onOpenInbox }) {
  return (
    <div className="flex min-h-[340px] items-center justify-center px-6 py-12 text-center">
      <div className="max-w-[560px]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md border border-line-soft bg-surface-subtle text-text-muted">
          <Database className="h-6 w-6" strokeWidth={1.9} />
        </div>

        <h2 className="mt-5 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
          No report activity yet
        </h2>

        <p className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
          The backend returned real empty data for the selected {rangeLabel(range)} range.
          Connect Website Chat, Instagram, or Telegram and send a test conversation to start filling this dashboard.
        </p>

        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={onOpenChannels}
            rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
          >
            Connect launch channel
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={onOpenInbox}
          >
            Open inbox
          </Button>
        </div>

        <div className="mt-5 rounded-md border border-line-soft bg-surface-subtle px-4 py-3 text-left">
          <div className="text-[13px] font-semibold text-text">
            What creates report data?
          </div>
          <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
            Website, Instagram, or Telegram messages, outbound replies, AI replies, leads, webhooks, and usage records.
          </div>
        </div>
      </div>
    </div>
  );
}
function ChannelRow({ channel, maxTotal }) {
  const width = maxTotal ? Math.max(5, Math.round((channel.total / maxTotal) * 100)) : 0;

  return (
    <div className="grid gap-4 border-b border-line-soft px-5 py-4 last:border-b-0 xl:grid-cols-[minmax(240px,1fr)_minmax(260px,0.8fr)_120px] xl:items-center">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-subtle text-text">
          <MessageSquare className="h-5 w-5" strokeWidth={2.05} />
        </div>

        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-text">
            {channel.label}
          </div>
          <div className="mt-0.5 text-[12.5px] font-medium text-text-muted">
            {formatNumber(channel.messagesIn)} in · {formatNumber(channel.messagesOut)} out · {formatNumber(channel.aiReplies)} AI
          </div>
        </div>
      </div>

      <div className="h-2 rounded-full bg-surface-subtle">
        <div className="h-full rounded-full bg-brand" style={{ width: `${width}%` }} />
      </div>

      <div className="xl:text-right">
        <AppStatusText tone={channel.automationShare > 0 ? "brand" : "neutral"}>
          {formatPercent(channel.automationShare)} AI share
        </AppStatusText>
      </div>
    </div>
  );
}

function LeadStageRow({ stage, maxCount }) {
  const width = maxCount ? Math.max(5, Math.round((stage.count / maxCount) * 100)) : 0;

  return (
    <div className="grid gap-3 border-b border-line-soft px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.7fr)_80px] md:items-center">
      <div className="text-[13.5px] font-semibold text-text">{stage.label}</div>

      <div className="h-2 rounded-full bg-surface-subtle">
        <div className="h-full rounded-full bg-success" style={{ width: `${width}%` }} />
      </div>

      <div className="md:text-right text-[13px] font-semibold text-text-muted">
        {formatNumber(stage.count)}
      </div>
    </div>
  );
}

function InsightRow({ icon: Icon = Sparkles, title, description, tone = "brand" }) {
  return (
    <div className="flex gap-3 border-b border-line-soft px-5 py-4 last:border-b-0">
      <Icon
        className={cx(
          "mt-0.5 h-[18px] w-[18px] shrink-0",
          tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-brand"
        )}
        strokeWidth={2.05}
      />
      <div>
        <div className="text-[13.5px] font-semibold text-text">{title}</div>
        <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
          {description}
        </div>
      </div>
    </div>
  );
}

function buildInsights({ summary, channels, degraded }) {
  const insights = [];

  if (degraded.length) {
    insights.push({
      icon: CircleAlert,
      tone: "warning",
      title: "Some report slices are degraded",
      description: `${degraded.length} backend slice(s) could not be read. The dashboard is still showing the available real data.`,
    });
  }

  if (summary.unreadMessages > 0) {
    insights.push({
      icon: Inbox,
      tone: "warning",
      title: "Unread pressure exists",
      description: `${formatNumber(summary.unreadMessages)} unread message(s) are visible in the current inbox state.`,
    });
  }

  if (summary.leads > 0 && summary.messagesIn > 0) {
    insights.push({
      icon: Target,
      tone: "success",
      title: "Lead conversion signal",
      description: `${formatPercent(summary.conversion)} of inbound message volume became lead activity in this range.`,
    });
  }

  const topChannel = channels[0];
  if (topChannel) {
    insights.push({
      icon: MessageSquare,
      tone: "brand",
      title: "Strongest channel",
      description: `${topChannel.label} has the highest message volume in the selected range.`,
    });
  }

  if (!insights.length) {
    insights.push({
      icon: Database,
      tone: "brand",
      title: "Waiting for operational data",
      description: "No fake insight is shown. Reports will become useful after real inbox, lead, and usage records exist.",
    });
  }

  return insights;
}

function ReportsSurface({ payload, range, onOpenChannels, onOpenInbox }) {
  const summary = useMemo(() => summarizeReport(payload), [payload]);
  const series = useMemo(() => normalizeSeries(payload), [payload]);
  const channels = useMemo(() => normalizeChannels(payload), [payload]);
  const leadStages = useMemo(() => normalizeLeadStages(payload), [payload]);
  const degraded = arr(payload?.degraded);
  const active = hasActivity(summary);
  const maxChannelTotal = Math.max(...channels.map((channel) => channel.total), 1);
  const maxLeadStage = Math.max(...leadStages.map((stage) => stage.count), 1);
  const insights = buildInsights({ summary, channels, degraded });

  return (
    <Card padded={false} clip className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-line-soft px-5 py-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-subtle text-text">
            <BarChart3 className="h-6 w-6" strokeWidth={2.05} />
          </div>

          <div className="min-w-0">
            <div className="text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
              Real performance overview
            </div>
            <div className="mt-1 max-w-[760px] text-[13.5px] font-medium leading-6 text-text-muted">
              Backend-backed reporting from inbox messages, tenant usage, leads, channel breakdown, and current inbox state.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <AppTag tone={active ? "success" : "neutral"} dot>
            {active ? "Live data" : "No activity"}
          </AppTag>
          <AppTag tone={degraded.length ? "warning" : "success"} dot>
            {degraded.length ? "Partial" : "Complete"}
          </AppTag>
        </div>
      </div>

      {degraded.length ? (
        <div className="border-b border-line-soft px-5 py-4">
          <InlineNotice
            tone="warning"
            title="Some report slices are degraded"
            description={degraded.join(", ")}
            compact
          />
        </div>
      ) : null}

      <div className="grid bg-white md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          icon={MessageSquare}
          label="Messages in"
          value={formatNumber(summary.messagesIn)}
          helper="Inbound customer messages."
          tone="brand"
        />
        <MetricCard
          icon={Send}
          label="Messages out"
          value={formatNumber(summary.messagesOut)}
          helper="Outbound replies sent."
        />
        <MetricCard
          icon={Sparkles}
          label="AI replies"
          value={formatNumber(summary.aiReplies)}
          helper={`${formatPercent(summary.automationShare)} of outbound volume.`}
          tone="brand"
        />
        <MetricCard
          icon={Target}
          label="Leads"
          value={formatNumber(summary.leads)}
          helper={`${formatPercent(summary.conversion)} inbound-to-lead signal.`}
          tone="success"
        />
        <MetricCard
          icon={Inbox}
          label="Open threads"
          value={formatNumber(summary.openThreads)}
          helper={`${formatNumber(summary.unreadMessages)} unread message(s).`}
          tone={summary.unreadMessages > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          icon={Activity}
          label="Usage"
          value={formatNumber(summary.apiCalls)}
          helper={`${formatNumber(summary.aiUnits)} AI units · ${formatNumber(summary.webhookEvents)} webhooks.`}
        />
      </div>

      {!active ? (
        <EmptyAnalyticsState
          range={range}
          onOpenChannels={onOpenChannels}
          onOpenInbox={onOpenInbox}
        />
      ) : (
        <>
          <div className="border-t border-line-soft px-5 py-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                  Activity trend
                </div>
                <div className="mt-1 text-[12.5px] font-medium text-text-muted">
                  Real daily activity for inbound messages, outbound messages, and leads.
                </div>
              </div>

              <AppTag tone="neutral">{rangeLabel(range)}</AppTag>
            </div>

            <div className="mt-4 h-[330px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="reportMessagesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgb(var(--color-brand))" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="rgb(var(--color-brand))" stopOpacity={0.02} />
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
                    dataKey="messagesIn"
                    name="Inbound"
                    stroke="rgb(var(--color-brand))"
                    strokeWidth={2}
                    fill="url(#reportMessagesFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="messagesOut"
                    name="Outbound"
                    stroke="rgb(var(--color-warning))"
                    strokeWidth={2}
                    fill="transparent"
                  />
                  <Area
                    type="monotone"
                    dataKey="leads"
                    name="Leads"
                    stroke="rgb(var(--color-success))"
                    strokeWidth={2}
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid border-t border-line-soft xl:grid-cols-[minmax(0,1fr)_390px]">
            <section className="xl:border-r xl:border-line-soft">
              <div className="border-b border-line-soft px-5 py-4">
                <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                  Channel breakdown
                </div>
                <div className="mt-1 text-[12.5px] font-medium text-text-muted">
                  Message volume and AI participation by channel.
                </div>
              </div>

              {channels.length ? (
                channels.map((channel) => (
                  <ChannelRow
                    key={channel.id}
                    channel={channel}
                    maxTotal={maxChannelTotal}
                  />
                ))
              ) : (
                <div className="px-5 py-5 text-[13px] font-medium text-text-muted">
                  No channel breakdown is available for this range.
                </div>
              )}
            </section>

            <section>
              <div className="border-b border-line-soft px-5 py-4">
                <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                  Operator insights
                </div>
                <div className="mt-1 text-[12.5px] font-medium text-text-muted">
                  Derived from real backend reporting, not demo copy.
                </div>
              </div>

              {insights.map((insight) => (
                <InsightRow
                  key={insight.title}
                  icon={insight.icon}
                  tone={insight.tone}
                  title={insight.title}
                  description={insight.description}
                />
              ))}
            </section>
          </div>

          <div className="grid border-t border-line-soft xl:grid-cols-[minmax(0,1fr)_390px]">
            <section className="xl:border-r xl:border-line-soft">
              <div className="border-b border-line-soft px-5 py-4">
                <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                  Lead stages
                </div>
                <div className="mt-1 text-[12.5px] font-medium text-text-muted">
                  Real lead-stage distribution for the selected range.
                </div>
              </div>

              {leadStages.length ? (
                leadStages.map((stage) => (
                  <LeadStageRow key={stage.id} stage={stage} maxCount={maxLeadStage} />
                ))
              ) : (
                <div className="px-5 py-5 text-[13px] font-medium text-text-muted">
                  No lead stage data is available yet.
                </div>
              )}
            </section>

            <section>
              <div className="border-b border-line-soft px-5 py-4">
                <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                  Current inbox state
                </div>
                <div className="mt-1 text-[12.5px] font-medium text-text-muted">
                  Real current counters from backend.
                </div>
              </div>

              <div className="grid gap-3 px-5 py-5">
                <div className="rounded-md border border-line-soft bg-surface-subtle p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                    Open threads
                  </div>
                  <div className="mt-2 text-[22px] font-semibold text-text">
                    {formatNumber(summary.openThreads)}
                  </div>
                </div>

                <div className="rounded-md border border-line-soft bg-surface-subtle p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                    Unread messages
                  </div>
                  <div className="mt-2 text-[22px] font-semibold text-text">
                    {formatNumber(summary.unreadMessages)}
                  </div>
                </div>

                <div className="rounded-md border border-line-soft bg-surface-subtle p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                    Handoffs
                  </div>
                  <div className="mt-2 text-[22px] font-semibold text-text">
                    {formatNumber(summary.handoffs)}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </Card>
  );
}

export default function Reports() {
  const navigate = useNavigate();
  const [range, setRange] = useState("7d");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const nextPayload = await getReportsOverview({ range });
      setPayload(nextPayload || null);
    } catch (err) {
      setPayload(null);
      setError(
        s(err?.payload?.error || err?.payload?.message || err?.message) ||
          "Reports could not be loaded."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <PageCanvas>
        <LoadingSurface
          title="Loading reports"
          description="Reading real report slices from backend."
          rows={5}
        />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas>
      <PageHeader
        title="Reports"
        description="Backend-backed performance reporting for conversations, leads, channels, and usage."
        actions={
          <Button
            type="button"
            variant="secondary"
            size="md"
            loading={refreshing}
            onClick={() => load({ silent: true })}
            leftIcon={
              !refreshing ? (
                <RefreshCw className="h-4 w-4" strokeWidth={2.1} />
              ) : undefined
            }
          >
            Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-text-muted">
          <Clock3 className="h-4 w-4" strokeWidth={2.05} />
          Selected range
        </div>

        <AppSegmentedControl value={range} options={PERIODS} onChange={setRange} />
      </div>

      {error ? (
        <InlineNotice tone="danger" title="Reports unavailable" description={error} />
      ) : null}

      {payload ? (
        <ReportsSurface
          payload={payload}
          range={range}
          onOpenChannels={() => navigate("/channels")}
          onOpenInbox={() => navigate("/inbox")}
        />
      ) : !error ? (
        <InlineNotice
          tone="warning"
          title="No report payload"
          description="The API request completed but did not return a usable report payload."
        />
      ) : null}
    </PageCanvas>
  );
}
