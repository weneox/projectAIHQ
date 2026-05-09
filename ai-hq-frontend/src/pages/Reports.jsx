import { useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Globe2,
  Instagram,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  Users,
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

import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import AppTag from "../components/ui/AppTag.jsx";
import AppStatusText from "../components/ui/AppStatusText.jsx";
import AppSegmentedControl from "../components/ui/AppSegmentedControl.jsx";
import AppMetricCell from "../components/ui/AppMetricCell.jsx";
import { PageCanvas, PageHeader } from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

const VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "team", label: "Team" },
];

const PERIODS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
];

const REPORTS = {
  today: {
    label: "Today",
    metrics: {
      conversations: 28,
      aiReplies: 19,
      leads: 6,
      customers: 2,
      conversion: 33,
      avgResponse: "1m 42s",
    },
    trend: [
      { label: "09:00", conversations: 3, leads: 0 },
      { label: "11:00", conversations: 5, leads: 1 },
      { label: "13:00", conversations: 4, leads: 1 },
      { label: "15:00", conversations: 7, leads: 2 },
      { label: "17:00", conversations: 6, leads: 1 },
      { label: "19:00", conversations: 3, leads: 1 },
    ],
    channels: [
      { id: "website", name: "Website Chat", icon: Globe2, conversations: 11, leads: 3, conversion: 27 },
      { id: "instagram", name: "Instagram", icon: Instagram, conversations: 8, leads: 2, conversion: 25 },
      { id: "telegram", name: "Telegram", icon: Send, conversations: 5, leads: 1, conversion: 20 },
      { id: "email", name: "Email", icon: Mail, conversations: 4, leads: 0, conversion: 0 },
    ],
    insights: [
      "Website Chat created the strongest lead activity today.",
      "Instagram produced fewer conversations but stronger buying intent.",
      "Email is active, but has not generated a lead today.",
    ],
    team: {
      metrics: {
        members: 4,
        handled: 28,
        resolved: 18,
        leads: 6,
        avgResponse: "2m 04s",
        balance: 82,
      },
      members: [
        { id: "emil", name: "Emil Bagirov", role: "Owner", conversations: 10, leads: 3, resolved: 7, avgResponse: "1m 38s", quality: 94, workload: 86 },
        { id: "ai", name: "AI Operator", role: "Automation", conversations: 9, leads: 2, resolved: 6, avgResponse: "0m 42s", quality: 91, workload: 78 },
        { id: "support", name: "Support Agent", role: "Operator", conversations: 6, leads: 1, resolved: 4, avgResponse: "3m 12s", quality: 84, workload: 58 },
        { id: "ops", name: "Ops Assistant", role: "Operator", conversations: 3, leads: 0, resolved: 1, avgResponse: "4m 10s", quality: 76, workload: 32 },
      ],
      insights: [
        "AI Operator is reducing first-response pressure today.",
        "Emil owns the highest-intent lead conversations.",
        "Support workload is healthy, but response time can improve.",
      ],
    },
  },
  "7d": {
    label: "Last 7 days",
    metrics: {
      conversations: 184,
      aiReplies: 132,
      leads: 31,
      customers: 8,
      conversion: 26,
      avgResponse: "2m 08s",
    },
    trend: [
      { label: "Mon", conversations: 21, leads: 3 },
      { label: "Tue", conversations: 26, leads: 4 },
      { label: "Wed", conversations: 18, leads: 2 },
      { label: "Thu", conversations: 33, leads: 6 },
      { label: "Fri", conversations: 37, leads: 7 },
      { label: "Sat", conversations: 22, leads: 4 },
      { label: "Sun", conversations: 27, leads: 5 },
    ],
    channels: [
      { id: "website", name: "Website Chat", icon: Globe2, conversations: 72, leads: 14, conversion: 19 },
      { id: "instagram", name: "Instagram", icon: Instagram, conversations: 54, leads: 10, conversion: 18 },
      { id: "telegram", name: "Telegram", icon: Send, conversations: 33, leads: 5, conversion: 15 },
      { id: "email", name: "Email", icon: Mail, conversations: 25, leads: 2, conversion: 8 },
    ],
    insights: [
      "Website Chat is the main source of new opportunities this week.",
      "Lead volume increased near the end of the week.",
      "Telegram is useful, but needs better qualification prompts.",
    ],
    team: {
      metrics: {
        members: 4,
        handled: 184,
        resolved: 126,
        leads: 31,
        avgResponse: "2m 18s",
        balance: 78,
      },
      members: [
        { id: "emil", name: "Emil Bagirov", role: "Owner", conversations: 62, leads: 13, resolved: 41, avgResponse: "1m 58s", quality: 93, workload: 92 },
        { id: "ai", name: "AI Operator", role: "Automation", conversations: 54, leads: 8, resolved: 43, avgResponse: "0m 49s", quality: 90, workload: 84 },
        { id: "support", name: "Support Agent", role: "Operator", conversations: 43, leads: 7, resolved: 29, avgResponse: "3m 06s", quality: 86, workload: 67 },
        { id: "ops", name: "Ops Assistant", role: "Operator", conversations: 25, leads: 3, resolved: 13, avgResponse: "4m 02s", quality: 80, workload: 44 },
      ],
      insights: [
        "Emil is carrying the highest-value lead workload.",
        "AI Operator is handling first-line volume effectively.",
        "Ops Assistant has available capacity for more low-risk conversations.",
      ],
    },
  },
  "30d": {
    label: "Last 30 days",
    metrics: {
      conversations: 746,
      aiReplies: 528,
      leads: 126,
      customers: 29,
      conversion: 23,
      avgResponse: "2m 21s",
    },
    trend: [
      { label: "Week 1", conversations: 144, leads: 22 },
      { label: "Week 2", conversations: 178, leads: 29 },
      { label: "Week 3", conversations: 196, leads: 34 },
      { label: "Week 4", conversations: 228, leads: 41 },
    ],
    channels: [
      { id: "website", name: "Website Chat", icon: Globe2, conversations: 298, leads: 54, conversion: 18 },
      { id: "instagram", name: "Instagram", icon: Instagram, conversations: 221, leads: 38, conversion: 17 },
      { id: "telegram", name: "Telegram", icon: Send, conversations: 132, leads: 22, conversion: 17 },
      { id: "email", name: "Email", icon: Mail, conversations: 95, leads: 12, conversion: 13 },
    ],
    insights: [
      "Conversation volume is growing steadily across the month.",
      "Website Chat and Instagram should remain the main acquisition focus.",
      "Email follow-up can improve conversion if paired with faster response rules.",
    ],
    team: {
      metrics: {
        members: 4,
        handled: 746,
        resolved: 514,
        leads: 126,
        avgResponse: "2m 32s",
        balance: 74,
      },
      members: [
        { id: "emil", name: "Emil Bagirov", role: "Owner", conversations: 258, leads: 52, resolved: 176, avgResponse: "2m 04s", quality: 92, workload: 94 },
        { id: "ai", name: "AI Operator", role: "Automation", conversations: 221, leads: 33, resolved: 171, avgResponse: "0m 56s", quality: 89, workload: 86 },
        { id: "support", name: "Support Agent", role: "Operator", conversations: 164, leads: 27, resolved: 113, avgResponse: "3m 28s", quality: 85, workload: 68 },
        { id: "ops", name: "Ops Assistant", role: "Operator", conversations: 103, leads: 14, resolved: 54, avgResponse: "4m 16s", quality: 79, workload: 51 },
      ],
      insights: [
        "Owner workload is high; some qualified follow-up should be delegated.",
        "Automation is handling a strong share of first-line conversations.",
        "Team balance is acceptable, but support capacity can be used better.",
      ],
    },
  },
};

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function formatNumber(value = 0) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(n(value));
}

function initials(value = "") {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "U";

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function MetricCell({ icon: Icon, label, value, helper, tone = "neutral" }) {
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
            tone === "brand"
              ? "border-brand/20 bg-brand/5 text-brand"
              : tone === "success"
                ? "border-success/20 bg-success/5 text-success"
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
          <span className="text-text-muted">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function ChannelRow({ channel, maxConversations }) {
  const Icon = channel.icon || MessageSquare;
  const width = maxConversations
    ? Math.max(6, Math.round((channel.conversations / maxConversations) * 100))
    : 0;

  return (
    <div className="grid gap-4 border-b border-line-soft px-5 py-4 last:border-b-0 xl:grid-cols-[minmax(240px,1fr)_minmax(260px,0.8fr)_110px] xl:items-center">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-subtle text-text">
          <Icon className="h-5 w-5" strokeWidth={2.05} />
        </div>

        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-text">
            {channel.name}
          </div>
          <div className="mt-0.5 text-[12.5px] font-medium text-text-muted">
            {formatNumber(channel.conversations)} conversations ·{" "}
            {formatNumber(channel.leads)} leads
          </div>
        </div>
      </div>

      <div className="h-2 rounded-full bg-surface-subtle">
        <div className="h-full rounded-full bg-brand" style={{ width: `${width}%` }} />
      </div>

      <div className="xl:text-right">
        <AppStatusText tone={channel.conversion >= 18 ? "success" : "neutral"}>
          {channel.conversion}% conversion
        </AppStatusText>
      </div>
    </div>
  );
}

function InsightRow({ children }) {
  return (
    <div className="flex gap-3 border-b border-line-soft px-5 py-4 last:border-b-0">
      <Sparkles className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand" strokeWidth={2.05} />
      <div className="text-[13.5px] font-medium leading-6 text-text">
        {children}
      </div>
    </div>
  );
}

function TeamMemberRow({ member, maxWorkload }) {
  const workloadWidth = maxWorkload
    ? Math.max(8, Math.round((member.conversations / maxWorkload) * 100))
    : 0;

  return (
    <div className="grid gap-4 border-b border-line-soft px-5 py-4 last:border-b-0 xl:grid-cols-[minmax(260px,1fr)_110px_90px_110px_minmax(220px,0.75fr)_120px] xl:items-center">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-subtle text-[13px] font-semibold text-brand">
          {initials(member.name)}
        </div>

        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-text">
            {member.name}
          </div>
          <div className="mt-0.5 text-[12.5px] font-medium text-text-muted">
            {member.role}
          </div>
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
          Conversations
        </div>
        <div className="mt-1 text-[13.5px] font-semibold text-text">
          {formatNumber(member.conversations)}
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
          Leads
        </div>
        <div className="mt-1 text-[13.5px] font-semibold text-text">
          {formatNumber(member.leads)}
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
          Response
        </div>
        <div className="mt-1 text-[13.5px] font-semibold text-text">
          {member.avgResponse}
        </div>
      </div>

      <div className="h-2 rounded-full bg-surface-subtle">
        <div className="h-full rounded-full bg-brand" style={{ width: `${workloadWidth}%` }} />
      </div>

      <div className="xl:text-right">
        <AppStatusText tone={member.quality >= 88 ? "success" : member.quality >= 80 ? "brand" : "warning"}>
          {member.quality}% quality
        </AppStatusText>
      </div>
    </div>
  );
}

function OverviewReport({ report }) {
  const bestChannel = [...report.channels].sort((a, b) => b.leads - a.leads)[0];
  const maxConversations = Math.max(
    ...report.channels.map((channel) => channel.conversations),
    1
  );

  return (
    <>
      <div className="grid bg-white md:grid-cols-2 xl:grid-cols-6">
        <AppMetricCell icon={MessageSquare} label="Conversations" value={formatNumber(report.metrics.conversations)} helper="Inbound customer conversations." tone="brand" />
        <AppMetricCell icon={Sparkles} label="AI replies" value={formatNumber(report.metrics.aiReplies)} helper="Replies handled by automation." />
        <AppMetricCell icon={Target} label="Leads" value={formatNumber(report.metrics.leads)} helper="Qualified opportunities." tone="success" />
        <AppMetricCell icon={Users} label="Customers" value={formatNumber(report.metrics.customers)} helper="Converted records." tone="success" />
        <AppMetricCell icon={TrendingUp} label="Conversion" value={`${report.metrics.conversion}%`} helper="Lead to customer signal." tone="success" />
        <AppMetricCell icon={Clock3} label="Avg response" value={report.metrics.avgResponse} helper="Average response time." />
      </div>

      <div className="border-t border-line-soft px-5 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              Conversation to lead trend
            </div>
            <div className="mt-1 text-[12.5px] font-medium text-text-muted">
              Activity across conversations and qualified leads.
            </div>
          </div>

          <AppTag tone="neutral">
            <CalendarDays className="mr-1 h-3.5 w-3.5" strokeWidth={2.1} />
            {report.label}
          </AppTag>
        </div>

        <div className="mt-4 h-[330px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={report.trend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="reportConversationFill" x1="0" y1="0" x2="0" y2="1">
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
              <Area type="monotone" dataKey="conversations" name="Conversations" stroke="rgb(var(--color-brand))" strokeWidth={2} fill="url(#reportConversationFill)" />
              <Area type="monotone" dataKey="leads" name="Leads" stroke="rgb(var(--color-success))" strokeWidth={2} fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid border-t border-line-soft xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="xl:border-r xl:border-line-soft">
          <div className="border-b border-line-soft px-5 py-4">
            <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              Channel performance
            </div>
            <div className="mt-1 text-[12.5px] font-medium text-text-muted">
              Which channels bring conversations and qualified leads.
            </div>
          </div>

          {report.channels.map((channel) => (
            <ChannelRow key={channel.id} channel={channel} maxConversations={maxConversations} />
          ))}
        </section>

        <section>
          <div className="border-b border-line-soft px-5 py-4">
            <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              Insights
            </div>
            <div className="mt-1 text-[12.5px] font-medium text-text-muted">
              Small signals for the next operational action.
            </div>
          </div>

          {report.insights.map((insight) => (
            <InsightRow key={insight}>{insight}</InsightRow>
          ))}

          <div className="px-5 py-5">
            <div className="rounded-md border border-line-soft bg-surface-subtle p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[13.5px] font-semibold text-text">
                    Best source
                  </div>
                  <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
                    {bestChannel?.name || "—"} is currently creating the most qualified lead activity.
                  </div>
                </div>

                <ArrowUpRight className="h-5 w-5 shrink-0 text-brand" strokeWidth={2.1} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function TeamReport({ report }) {
  const team = report.team;
  const maxWorkload = Math.max(
    ...team.members.map((member) => member.conversations),
    1
  );
  const topMember = [...team.members].sort((a, b) => b.leads - a.leads)[0];

  return (
    <>
      <div className="grid bg-white md:grid-cols-2 xl:grid-cols-6">
        <AppMetricCell icon={UserRound} label="Members" value={formatNumber(team.metrics.members)} helper="Active team members." />
        <AppMetricCell icon={MessageSquare} label="Handled" value={formatNumber(team.metrics.handled)} helper="Assigned conversations." tone="brand" />
        <AppMetricCell icon={CheckCircle2} label="Resolved" value={formatNumber(team.metrics.resolved)} helper="Completed conversations." tone="success" />
        <AppMetricCell icon={Target} label="Leads" value={formatNumber(team.metrics.leads)} helper="Leads created by team." tone="success" />
        <AppMetricCell icon={Clock3} label="Avg response" value={team.metrics.avgResponse} helper="Team response average." />
        <AppMetricCell icon={Bot} label="Balance" value={`${team.metrics.balance}%`} helper="Workload distribution." tone="success" />
      </div>

      <div className="border-t border-line-soft">
        <div className="border-b border-line-soft px-5 py-4">
          <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
            Team workload map
          </div>
          <div className="mt-1 text-[12.5px] font-medium text-text-muted">
            Operational view of conversations, leads, response speed, and workload balance.
          </div>
        </div>

        {team.members.map((member) => (
          <TeamMemberRow
            key={member.id}
            member={member}
            maxWorkload={maxWorkload}
          />
        ))}
      </div>

      <div className="grid border-t border-line-soft xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="xl:border-r xl:border-line-soft">
          <div className="border-b border-line-soft px-5 py-4">
            <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              Workload balance
            </div>
            <div className="mt-1 text-[12.5px] font-medium text-text-muted">
              Use this to redistribute conversations before one person becomes overloaded.
            </div>
          </div>

          <div className="grid gap-3 px-5 py-5 md:grid-cols-3">
            <div className="rounded-md border border-line-soft bg-surface-subtle p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                Top lead owner
              </div>
              <div className="mt-2 text-[16px] font-semibold text-text">
                {topMember?.name || "—"}
              </div>
              <div className="mt-1 text-[12.5px] font-medium text-text-muted">
                {topMember?.leads || 0} leads
              </div>
            </div>

            <div className="rounded-md border border-line-soft bg-surface-subtle p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                Fastest response
              </div>
              <div className="mt-2 text-[16px] font-semibold text-text">
                AI Operator
              </div>
              <div className="mt-1 text-[12.5px] font-medium text-text-muted">
                Automation assisted
              </div>
            </div>

            <div className="rounded-md border border-line-soft bg-surface-subtle p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                Team health
              </div>
              <div className="mt-2 text-[16px] font-semibold text-text">
                Healthy
              </div>
              <div className="mt-1 text-[12.5px] font-medium text-text-muted">
                No critical overload
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="border-b border-line-soft px-5 py-4">
            <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              Team insights
            </div>
            <div className="mt-1 text-[12.5px] font-medium text-text-muted">
              Workload notes without turning the page into employee surveillance.
            </div>
          </div>

          {team.insights.map((insight) => (
            <InsightRow key={insight}>{insight}</InsightRow>
          ))}
        </section>
      </div>
    </>
  );
}

export default function Reports() {
  const [view, setView] = useState("overview");
  const [period, setPeriod] = useState("7d");
  const [refreshing, setRefreshing] = useState(false);

  const report = REPORTS[period] || REPORTS["7d"];

  function refreshReport() {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 650);
  }

  return (
    <PageCanvas>
      <PageHeader
        title="Reports"
        description="A clean performance view for conversations, channels, and team workload."
        actions={
          <Button
            type="button"
            variant="secondary"
            size="md"
            loading={refreshing}
            onClick={refreshReport}
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

      <Card padded={false} clip className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-line-soft px-5 py-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-subtle text-text">
              <BarChart3 className="h-6 w-6" strokeWidth={2.05} />
            </div>

            <div className="min-w-0">
              <div className="text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                Performance overview
              </div>
              <div className="mt-1 max-w-[760px] text-[13.5px] font-medium leading-6 text-text-muted">
                One reporting surface for business performance and operational workload.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <AppSegmentedControl value={view} options={VIEWS} onChange={setView} />
            <AppSegmentedControl value={period} options={PERIODS} onChange={setPeriod} />
          </div>
        </div>

        {view === "team" ? (
          <TeamReport report={report} />
        ) : (
          <OverviewReport report={report} />
        )}
      </Card>
    </PageCanvas>
  );
}



