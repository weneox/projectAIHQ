import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  CircleAlert,
  GitBranch,
  Globe2,
  Inbox,
  Network,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

import { getLaunchPosture } from "../api/launch.js";
import { listLeads } from "../api/leads.js";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toneTextClass(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "brand" || tone === "info") return "text-brand";
  return "text-text-muted";
}

function toneDotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand" || tone === "info") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

function stageOf(lead = {}) {
  return lower(lead.stage || "new");
}

function statusOf(lead = {}) {
  return lower(lead.status || "open");
}

function channelTone(channel = {}) {
  if (channel.deliveryReady === true) return "success";
  if (channel.connected === true) return "warning";
  if (channel.available === false) return "danger";
  return "neutral";
}

function channelLabel(id = "") {
  const safe = lower(id);
  if (safe === "website") return "Website Chat";
  if (safe === "instagram") return "Instagram";
  if (safe === "telegram") return "Telegram";
  return titleize(safe || "Channel");
}

function channelIcon(id = "") {
  const safe = lower(id);
  if (safe === "website") return Globe2;
  if (safe === "instagram") return Network;
  if (safe === "telegram") return Bot;
  return Network;
}

function StatCard({ label, value, caption, icon: Icon, tone = "neutral" }) {
  return (
    <Card padded="sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
            {label}
          </div>
          <div className="mt-1 text-[30px] font-semibold leading-none tracking-[var(--tracking-tight-xl)] text-text">
            {value}
          </div>
          {caption ? (
            <div className="mt-2 text-[12.5px] font-medium leading-5 text-text-muted">
              {caption}
            </div>
          ) : null}
        </div>

        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] border border-line-soft bg-surface-subtle">
          <Icon className={cx("h-5 w-5", toneTextClass(tone))} strokeWidth={2.1} />
        </span>
      </div>
    </Card>
  );
}

function StatusPill({ tone = "neutral", children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-surface px-2.5 py-1 text-[12px] font-semibold">
      <span className={cx("h-1.5 w-1.5 rounded-full", toneDotClass(tone))} />
      <span className={toneTextClass(tone)}>{children}</span>
    </span>
  );
}

function BarRow({ label, value, total, tone = "brand" }) {
  const width = total > 0 ? Math.max(6, Math.round((value / total) * 100)) : 0;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="truncate text-[13px] font-semibold text-text">
          {label}
        </div>
        <div className="text-[12.5px] font-semibold text-text-muted">
          {value}
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-surface-subtle">
        <div
          className={cx(
            "h-full rounded-full transition-all duration-base ease-premium",
            tone === "success"
              ? "bg-success"
              : tone === "warning"
                ? "bg-warning"
                : tone === "danger"
                  ? "bg-danger"
                  : "bg-brand"
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function FlowNode({ icon: Icon, title, description, tone = "neutral", active = false }) {
  return (
    <div
      className={cx(
        "relative min-w-0 rounded-[22px] border px-4 py-4 shadow-[0_18px_48px_-42px_rgba(15,23,42,0.55)]",
        active
          ? "border-[rgba(var(--color-brand),0.35)] bg-brand-soft"
          : "border-line-soft bg-surface"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-line-soft bg-white">
          <Icon className={cx("h-5 w-5", toneTextClass(tone))} strokeWidth={2.1} />
        </span>

        <div className="min-w-0">
          <div className="text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
            {title}
          </div>
          <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="hidden items-center justify-center lg:flex">
      <ArrowRight className="h-5 w-5 text-text-subtle" strokeWidth={2.1} />
    </div>
  );
}

function OmnichannelFlow({ ready }) {
  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
              Flowchart
            </div>
            <div className="mt-1 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
              Omnichannel runtime flow
            </div>
          </div>

          <StatusPill tone={ready ? "success" : "warning"}>
            {ready ? "Launch ready" : "Guarded mode"}
          </StatusPill>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_36px_minmax(0,1fr)_36px_minmax(0,1fr)_36px_minmax(0,1fr)]">
        <FlowNode
          icon={Network}
          title="Customer channels"
          description="Website Chat, Instagram, and Telegram collect conversations."
          tone="brand"
          active
        />
        <FlowArrow />
        <FlowNode
          icon={Inbox}
          title="Shared Inbox"
          description="Operators see every conversation in one workspace."
          tone="success"
          active
        />
        <FlowArrow />
        <FlowNode
          icon={ShieldCheck}
          title="Business Info guard"
          description="AI only uses approved facts and runtime authority."
          tone={ready ? "success" : "warning"}
        />
        <FlowArrow />
        <FlowNode
          icon={Bot}
          title="Manual-first AI"
          description="Safe replies, handoff, and operator control before full automation."
          tone={ready ? "success" : "warning"}
        />
      </div>
    </Card>
  );
}

function SafetyFlow({ truthReady, runtimeReady, channelReady }) {
  const nodes = [
    {
      title: "Business Info",
      ready: truthReady,
      description: truthReady ? "Approved facts exist" : "Needs approval",
    },
    {
      title: "Runtime",
      ready: runtimeReady,
      description: runtimeReady ? "Authority available" : "Guarded",
    },
    {
      title: "Channel",
      ready: channelReady,
      description: channelReady ? "Delivery ready" : "Connect channel",
    },
  ];

  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-4 py-3.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
          AI safety pipeline
        </div>
        <div className="mt-1 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
          Reply authority checks
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {nodes.map((node, index) => (
          <div key={node.title} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[14px] border border-line-soft bg-surface">
              {node.ready ? (
                <CheckCircle2 className="h-4.5 w-4.5 text-success" strokeWidth={2.1} />
              ) : (
                <CircleAlert className="h-4.5 w-4.5 text-warning" strokeWidth={2.1} />
              )}
            </span>

            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-text">
                {index + 1}. {node.title}
              </div>
              <div className="text-[12.5px] font-medium text-text-muted">
                {node.description}
              </div>
            </div>

            <Badge tone={node.ready ? "success" : "warning"} size="sm">
              {node.ready ? "Ready" : "Pending"}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ChannelReadiness({ channels = {} }) {
  const entries = ["website", "instagram", "telegram"].map((id) => {
    const channel = obj(channels[id]);
    return {
      id,
      label: channelLabel(id),
      icon: channelIcon(id),
      status: s(channel.status || "not_connected"),
      connected: channel.connected === true,
      deliveryReady: channel.deliveryReady === true,
      tone: channelTone(channel),
    };
  });

  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-4 py-3.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
          Channels
        </div>
        <div className="mt-1 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
          Omnichannel readiness
        </div>
      </div>

      <div className="divide-y divide-line-soft">
        {entries.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.id} className="grid gap-3 px-4 py-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] border border-line-soft bg-surface-subtle">
                <Icon className={cx("h-5 w-5", toneTextClass(item.tone))} strokeWidth={2.1} />
              </span>

              <div className="min-w-0">
                <div className="text-[14.5px] font-semibold text-text">
                  {item.label}
                </div>
                <div className="mt-1 text-[12.5px] font-medium text-text-muted">
                  {item.deliveryReady
                    ? "Connected and delivery ready"
                    : item.connected
                      ? "Connected but blocked by readiness checks"
                      : "Not connected yet"}
                </div>
              </div>

              <Badge tone={item.tone} size="sm">
                {titleize(item.status)}
              </Badge>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function CustomerFunnel({ leads = [] }) {
  const total = leads.length;
  const buckets = [
    {
      id: "new",
      label: "New",
      value: leads.filter((lead) => ["", "new"].includes(stageOf(lead))).length,
      tone: "brand",
    },
    {
      id: "qualified",
      label: "Qualified",
      value: leads.filter((lead) => ["qualified", "proposal", "negotiation"].includes(stageOf(lead))).length,
      tone: "success",
    },
    {
      id: "won",
      label: "Won",
      value: leads.filter((lead) => ["won", "converted", "customer"].includes(stageOf(lead))).length,
      tone: "success",
    },
    {
      id: "lost",
      label: "Lost",
      value: leads.filter((lead) => ["lost", "closed_lost"].includes(stageOf(lead))).length,
      tone: "danger",
    },
  ];

  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-4 py-3.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
          Customers
        </div>
        <div className="mt-1 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
          Customer funnel
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {buckets.map((bucket) => (
          <BarRow
            key={bucket.id}
            label={bucket.label}
            value={bucket.value}
            total={total}
            tone={bucket.tone}
          />
        ))}

        {!total ? (
          <InlineNotice
            tone="info"
            compact
            description="Customer funnel will populate as leads are created from Inbox conversations."
          />
        ) : null}
      </div>
    </Card>
  );
}

export default function Reports() {
  const navigate = useNavigate();
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    error: "",
    posture: null,
    leads: [],
    leadsDegraded: false,
  });

  const load = useCallback(async ({ refreshing = false } = {}) => {
    setState((current) => ({
      ...current,
      loading: !refreshing,
      refreshing,
      error: "",
    }));

    try {
      const [posture, leadsPayload] = await Promise.all([
        getLaunchPosture(),
        listLeads({ limit: 200 }).catch((error) => ({
          ok: false,
          leads: [],
          degraded: true,
          error: s(error?.message),
        })),
      ]);

      setState({
        loading: false,
        refreshing: false,
        error: "",
        posture,
        leads: arr(leadsPayload?.leads),
        leadsDegraded: leadsPayload?.degraded === true,
      });
    } catch (error) {
      setState({
        loading: false,
        refreshing: false,
        error:
          s(error?.payload?.error || error?.payload?.message || error?.message) ||
          "Reports could not be loaded.",
        posture: null,
        leads: [],
        leadsDegraded: false,
      });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const metrics = useMemo(() => {
    const posture = obj(state.posture);
    const leads = arr(state.leads);
    const inbox = obj(posture.inbox);
    const channelSummary = obj(posture.channelSummary);
    const truthReady = posture.truth?.ready === true;
    const runtimeReady = posture.runtime?.ready === true;
    const channelReady = n(channelSummary.readyCount) > 0;
    const launchReady = posture.overall?.launchReady === true;

    return {
      launchReady,
      truthReady,
      runtimeReady,
      channelReady,
      readyChannels: n(channelSummary.readyCount),
      connectedChannels: n(channelSummary.connectedCount),
      leadsTotal: leads.length,
      openLeads: leads.filter((lead) => ["open", "new", "active"].includes(statusOf(lead))).length,
      inboxOpen: n(inbox.openCount),
      inboxUnread: n(inbox.unreadCount),
      handoff: n(inbox.handoffCount),
      pendingOutbound: n(inbox.pendingOutboundCount),
    };
  }, [state.posture, state.leads]);

  if (state.loading) {
    return (
      <PageCanvas className="max-w-[1280px] py-2">
        <LoadingSurface title="Loading reports" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="max-w-[1280px] space-y-4 py-2">
      {state.error ? (
        <InlineNotice
          tone="danger"
          title="Reports unavailable"
          description={state.error}
          compact
        />
      ) : null}

      {state.leadsDegraded ? (
        <InlineNotice
          tone="warning"
          title="Customer analytics degraded"
          description="Lead/customer schema is unavailable in this environment, so customer funnel data is empty."
          compact
        />
      ) : null}

      <Card padded={false} clip>
        <section className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
              <BarChart3 className="h-4 w-4" strokeWidth={2.1} />
              Reports
            </div>

            <h1 className="mt-3 max-w-[860px] font-display text-[34px] font-semibold leading-[1.02] tracking-[var(--tracking-tight-xl)] text-text md:text-[44px]">
              Omnichannel performance command center
            </h1>

            <p className="mt-3 max-w-[780px] text-[14.5px] font-medium leading-6 text-text-muted">
              Track customer channels, Inbox pressure, Business Info authority, and lead funnel health from one operational view.
            </p>
          </div>

          <div className="rounded-[22px] border border-line-soft bg-surface-subtle px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                  Launch posture
                </div>
                <div className="mt-2 text-[22px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                  {metrics.launchReady ? "Ready" : "Guarded"}
                </div>
              </div>

              {metrics.launchReady ? (
                <CheckCircle2 className="h-8 w-8 text-success" strokeWidth={2.1} />
              ) : (
                <CircleAlert className="h-8 w-8 text-warning" strokeWidth={2.1} />
              )}
            </div>

            <div className="mt-4">
              <Button
                type="button"
                fullWidth
                size="sm"
                loading={state.refreshing}
                onClick={() => load({ refreshing: true })}
                leftIcon={!state.refreshing ? <RefreshCw className="h-4 w-4" strokeWidth={2.1} /> : undefined}
              >
                Refresh reports
              </Button>
            </div>
          </div>
        </section>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ready channels"
          value={`${metrics.readyChannels}/${Math.max(3, metrics.connectedChannels || 3)}`}
          caption={`${metrics.connectedChannels} connected`}
          icon={Network}
          tone={metrics.channelReady ? "success" : "warning"}
        />
        <StatCard
          label="Customers"
          value={metrics.leadsTotal}
          caption={`${metrics.openLeads} open records`}
          icon={Users}
          tone="brand"
        />
        <StatCard
          label="Inbox pressure"
          value={metrics.inboxOpen + metrics.inboxUnread}
          caption={`${metrics.inboxUnread} unread · ${metrics.handoff} handoff`}
          icon={Inbox}
          tone={metrics.inboxOpen || metrics.inboxUnread ? "warning" : "success"}
        />
        <StatCard
          label="AI guard"
          value={metrics.truthReady && metrics.runtimeReady ? "Ready" : "Guarded"}
          caption={metrics.pendingOutbound ? `${metrics.pendingOutbound} outbound pending` : "Manual-first control"}
          icon={ShieldCheck}
          tone={metrics.truthReady && metrics.runtimeReady ? "success" : "warning"}
        />
      </div>

      <OmnichannelFlow ready={metrics.launchReady} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <ChannelReadiness channels={obj(state.posture?.channels)} />
          <CustomerFunnel leads={state.leads} />
        </div>

        <div className="space-y-4">
          <SafetyFlow
            truthReady={metrics.truthReady}
            runtimeReady={metrics.runtimeReady}
            channelReady={metrics.channelReady}
          />

          <Card padded={false} clip>
            <div className="border-b border-line-soft px-4 py-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                Next actions
              </div>
              <div className="mt-1 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                Operational shortcuts
              </div>
            </div>

            <div className="grid gap-2 px-4 py-4">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => navigate("/launch")}
                rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
              >
                Review Launch Checklist
              </Button>

              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => navigate("/channels")}
                rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
              >
                Open Customer Channels
              </Button>

              <Button
                type="button"
                fullWidth
                onClick={() => navigate("/inbox")}
                rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
              >
                Open Inbox
              </Button>
            </div>
          </Card>

          <Card padded="md">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-line-soft bg-brand-soft">
                <Sparkles className="h-5 w-5 text-brand" strokeWidth={2.1} />
              </span>

              <div>
                <div className="text-[15px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                  Executive summary
                </div>
                <div className="mt-1 text-[13.5px] font-medium leading-6 text-text-muted">
                  {metrics.launchReady
                    ? "Workspace is ready for controlled customer conversations across connected channels."
                    : "Workspace is still guarded. Finish Business Info, runtime, and at least one channel before relying on live AI replies."}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageCanvas>
  );
}
