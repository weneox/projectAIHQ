import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Inbox,
  MessageSquare,
  RefreshCw,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import AppIcon from "../../components/ui/AppIcon.jsx";
import AppStatCard from "../../components/ui/AppStatCard.jsx";
import AppStatusText from "../../components/ui/AppStatusText.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
  PageHeader,
} from "../../components/ui/AppShellPrimitives.jsx";
import useProductHome from "../../view-models/useProductHome.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function providerStates(home = {}) {
  return arr(home?.launchChannel?.providerStates);
}

function unreadCount(home = {}) {
  return n(home?.inboxState?.counts?.unreadCount);
}

function openCount(home = {}) {
  return n(home?.inboxState?.counts?.openCount);
}

function handoffCount(home = {}) {
  return n(home?.inboxState?.counts?.handoffCount);
}

function pendingOutboundCount(home = {}) {
  return n(
    home?.inboxState?.counts?.pendingOutboundCount ??
      home?.inboxState?.counts?.outboundPending
  );
}

function failedOutboundCount(home = {}) {
  return n(home?.inboxState?.counts?.failedOutboundCount);
}

function retryingOutboundCount(home = {}) {
  return n(home?.inboxState?.counts?.retryingOutboundCount);
}

function outboundAttention(home = {}) {
  return (
    pendingOutboundCount(home) +
    failedOutboundCount(home) +
    retryingOutboundCount(home)
  );
}

function truthReady(home = {}) {
  return home?.truthRuntime?.truthReady === true;
}

function runtimeReady(home = {}) {
  return home?.truthRuntime?.ready === true;
}

function readyChannelCount(home = {}) {
  const states = providerStates(home);

  if (states.length) {
    return states.filter(
      (item) => item?.connected === true && item?.deliveryReady === true
    ).length;
  }

  return n(home?.launchChannel?.readyCount);
}

function connectedChannelCount(home = {}) {
  const states = providerStates(home);

  if (states.length) {
    return states.filter((item) => item?.connected === true).length;
  }

  return n(home?.launchChannel?.connectedCount);
}

function inboxUnavailable(home = {}) {
  return lower(home?.inboxState?.status) === "unavailable";
}

function workspaceLive(home = {}) {
  return (
    truthReady(home) &&
    runtimeReady(home) &&
    readyChannelCount(home) > 0 &&
    !inboxUnavailable(home)
  );
}

function healthTone(value = "") {
  const safe = lower(value);

  if (safe === "ready" || safe === "live" || safe === "verified") return "success";
  if (safe === "review" || safe === "attention") return "warning";
  if (safe === "blocked" || safe === "unavailable") return "danger";

  return "neutral";
}

function buildReadiness(home = {}) {
  const checks = [
    {
      id: "truth",
      label: "Business truth",
      description: "Approved facts and workspace profile.",
      ready: truthReady(home),
      route: "/truth",
    },
    {
      id: "runtime",
      label: "AI runtime",
      description: "Assistant runtime and safe response mode.",
      ready: runtimeReady(home),
      route: "/truth",
    },
    {
      id: "channels",
      label: "Customer channel",
      description: "At least one route is ready for customers.",
      ready: readyChannelCount(home) > 0,
      route: "/channels",
    },
    {
      id: "inbox",
      label: "Inbox health",
      description: "Inbox can be checked for customer work.",
      ready: !inboxUnavailable(home),
      route: "/inbox",
    },
  ];

  const ready = checks.filter((item) => item.ready).length;

  return {
    checks,
    ready,
    total: checks.length,
    percent: checks.length ? Math.round((ready / checks.length) * 100) : 0,
  };
}

function buildNextAction(home = {}) {
  if (unreadCount(home) > 0) {
    return {
      tone: "warning",
      icon: MessageSquare,
      title: "Customer messages need attention",
      description: "Open the inbox and handle unread conversations before moving on.",
      action: "Open inbox",
      route: "/inbox",
    };
  }

  if (outboundAttention(home) > 0) {
    return {
      tone: "warning",
      icon: ShieldAlert,
      title: "Outbound replies need review",
      description: "Some outbound work is waiting for safe delivery review.",
      action: "Review inbox",
      route: "/inbox",
    };
  }

  if (!truthReady(home)) {
    return {
      tone: "brand",
      icon: Database,
      title: "Prepare the business truth",
      description: "Approve the facts the assistant can use with customers.",
      action: "Open truth",
      route: "/truth",
    };
  }

  if (!runtimeReady(home)) {
    return {
      tone: "brand",
      icon: ShieldCheck,
      title: "Review the AI runtime",
      description: "Confirm runtime state before real customer usage.",
      action: "Review runtime",
      route: "/truth",
    };
  }

  if (readyChannelCount(home) <= 0) {
    return {
      tone: "brand",
      icon: MessageSquare,
      title: "Connect one customer channel",
      description: "Choose the first customer lane for inbound conversations.",
      action: "Open channels",
      route: "/channels",
    };
  }

  if (inboxUnavailable(home)) {
    return {
      tone: "danger",
      icon: ShieldAlert,
      title: "Inbox is unavailable",
      description: "Customer activity cannot be checked right now.",
      action: "Open inbox",
      route: "/inbox",
    };
  }

  return {
    tone: "success",
    icon: CheckCircle2,
    title: "Workspace is calm",
    description: "No customer queue or release blocker is visible right now.",
    action: "Open inbox",
    route: "/inbox",
  };
}

function ReadinessCard({ readiness }) {
  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-5 py-4">
        <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
          Readiness
        </div>
        <div className="mt-1 text-[12.5px] font-medium text-text-muted">
          Core systems required before the workspace is considered live.
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="flex items-end justify-between gap-5">
          <div>
            <div className="text-[32px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
              {readiness.percent}%
            </div>
            <div className="mt-1 text-[12.5px] font-semibold text-text-muted">
              {readiness.ready} of {readiness.total} checks ready
            </div>
          </div>

          <AppStatusText tone={readiness.percent === 100 ? "success" : "warning"}>
            {readiness.percent === 100 ? "Ready" : "In progress"}
          </AppStatusText>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-md bg-surface-subtle">
          <div
            className="h-full rounded-md bg-brand transition-[width] duration-300 ease-premium"
            style={{ width: `${readiness.percent}%` }}
          />
        </div>

        <div className="mt-5 space-y-3">
          {readiness.checks.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 border-b border-line-soft pb-3 last:border-b-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-text">
                  {item.label}
                </div>
                <div className="mt-0.5 truncate text-[12px] font-medium text-text-muted">
                  {item.description}
                </div>
              </div>

              <AppStatusText tone={item.ready ? "success" : "warning"}>
                {item.ready ? "Ready" : "Review"}
              </AppStatusText>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function QueueCard({ home }) {
  const rows = [
    {
      label: "Unread",
      value: unreadCount(home),
      tone: unreadCount(home) > 0 ? "warning" : "success",
    },
    {
      label: "Open",
      value: openCount(home),
      tone: openCount(home) > 0 ? "brand" : "neutral",
    },
    {
      label: "Handoff",
      value: handoffCount(home),
      tone: handoffCount(home) > 0 ? "warning" : "neutral",
    },
    {
      label: "Reply review",
      value: outboundAttention(home),
      tone: outboundAttention(home) > 0 ? "warning" : "success",
    },
  ];

  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-5 py-4">
        <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
          Customer queue
        </div>
        <div className="mt-1 text-[12.5px] font-medium text-text-muted">
          Live inbox and delivery workload.
        </div>
      </div>

      <div className="space-y-3 px-5 py-5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 border-b border-line-soft pb-3 last:border-b-0 last:pb-0"
          >
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
              {row.label}
            </span>

            <AppStatusText tone={row.tone}>{row.value}</AppStatusText>
          </div>
        ))}
      </div>
    </Card>
  );
}

function NextAction({ action, onNavigate }) {
  const Icon = action.icon;

  return (
    <Card padded={false} clip>
      <div className="px-5 py-5">
        <div className="flex items-start gap-4">
          <AppIcon
            icon={Icon}
            size="lg"
            tone={action.tone === "danger" ? "danger" : "text"}
            strokeWidth={2.05}
            className="shrink-0"
          />

          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              {action.title}
            </div>

            <div className="mt-1 text-[13px] font-medium leading-5 text-text-muted">
              {action.description}
            </div>

            <div className="mt-5">
              <Button
                type="button"
                size="md"
                onClick={() => onNavigate(action.route)}
                rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.15} />}
              >
                {action.action}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function ProductHomePage() {
  const navigate = useNavigate();
  const home = useProductHome();

  const loading = home?.loading === true || home?.isLoading === true;
  const readiness = useMemo(() => buildReadiness(home), [home]);
  const nextAction = useMemo(() => buildNextAction(home), [home]);

  function handleNavigate(path = "") {
    const target = s(path);
    if (!target) return;
    navigate(target);
  }

  if (loading) {
    return (
      <PageCanvas>
        <LoadingSurface
          title="Loading workspace"
          description="Checking inbox, channels, truth runtime, and launch posture."
          rows={5}
        />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas>
      <PageHeader
        title="Workspace home"
        description="Start from the operational state of inbox, channels, assistant readiness, and launch posture."
        actions={
          <Button
            type="button"
            variant="secondary"
            size="md"
            leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
            onClick={() => window.location.reload()}
          >
            Refresh
          </Button>
        }
      />

      {home?.availabilityNote ? (
        <InlineNotice
          tone="warning"
          title={home.availabilityNote.title}
          description={home.availabilityNote.description}
          compact
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AppStatCard icon={Inbox} label="Unread messages" value={unreadCount(home)} />
        <AppStatCard icon={MessageSquare} label="Open threads" value={openCount(home)} />
        <AppStatCard
          icon={Sparkles}
          label="Ready channels"
          value={`${readyChannelCount(home)}/${Math.max(connectedChannelCount(home), 1)}`}
        />
        <AppStatCard
          icon={Rocket}
          label="Workspace state"
          value={workspaceLive(home) ? "Live" : "Setup"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <ReadinessCard readiness={readiness} />
          <NextAction action={nextAction} onNavigate={handleNavigate} />
        </div>

        <QueueCard home={home} />
      </div>
    </PageCanvas>
  );
}