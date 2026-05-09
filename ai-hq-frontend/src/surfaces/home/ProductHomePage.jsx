import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Globe2,
  Inbox,
  MessageSquare,
  RefreshCw,
  Rocket,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import AppTag from "../../components/ui/AppTag.jsx";
import AppStatusText from "../../components/ui/AppStatusText.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../../components/ui/AppShellPrimitives.jsx";
import useProductHome from "../../view-models/useProductHome.js";
import { cx } from "../../lib/cx.js";

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

function truthReady(home = {}) {
  return home?.truthRuntime?.truthReady === true;
}

function runtimeReady(home = {}) {
  return home?.truthRuntime?.ready === true;
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

function firstName(value = "") {
  const text = s(value);
  if (!text) return "";
  return text.split(/\s+/)[0] || "";
}

function readPossibleLocalName() {
  if (typeof window === "undefined") return "";

  const keys = [
    "user",
    "profile",
    "appUser",
    "aihq:user",
    "aihq:profile",
    "aihq.auth",
    "app_auth_context",
  ];

  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const name = s(
        parsed?.name ||
          parsed?.fullName ||
          parsed?.full_name ||
          parsed?.user?.name ||
          parsed?.user?.fullName ||
          parsed?.profile?.name
      );

      if (name) return name;
    } catch {
      // ignore local preview keys
    }
  }

  return "";
}

function greetingName(home = {}) {
  return (
    firstName(
      home?.user?.name ||
        home?.user?.fullName ||
        home?.profile?.name ||
        home?.operator?.name ||
        home?.workspace?.ownerName ||
        readPossibleLocalName()
    ) || "Emil"
  );
}

function statusTone(status = "") {
  const safe = lower(status);

  if (safe === "ready" || safe === "live" || safe === "connected") {
    return "success";
  }

  if (safe === "review" || safe === "setup" || safe === "optional") {
    return "warning";
  }

  if (safe === "blocked" || safe === "unavailable") {
    return "danger";
  }

  return "neutral";
}

function optionalItems(home = {}) {
  return [
    {
      id: "inbox",
      icon: Inbox,
      title: "Check inbox",
      description:
        unreadCount(home) > 0
          ? `${unreadCount(home)} unread message${unreadCount(home) === 1 ? "" : "s"} waiting.`
          : "Open conversations when you want to review customer activity.",
      status: unreadCount(home) > 0 ? "review" : "optional",
      label: unreadCount(home) > 0 ? "Needs attention" : "Optional",
      path: "/inbox",
      action: "Open inbox",
    },
    {
      id: "channels",
      icon: Globe2,
      title: "Connect channels",
      description:
        readyChannelCount(home) > 0
          ? `${readyChannelCount(home)} channel${readyChannelCount(home) === 1 ? "" : "s"} ready for messages.`
          : "Connect Website Chat, Instagram, Telegram, or WhatsApp when needed.",
      status: readyChannelCount(home) > 0 ? "ready" : "optional",
      label: readyChannelCount(home) > 0 ? "Ready" : "Optional",
      path: "/channels",
      action: "Open channels",
    },
    {
      id: "business-info",
      icon: ShieldCheck,
      title: "Review business info",
      description:
        truthReady(home) && runtimeReady(home)
          ? "Business information is available for assistant answers."
          : "Keep approved business details here when you want the assistant to answer safely.",
      status: truthReady(home) && runtimeReady(home) ? "ready" : "optional",
      label: truthReady(home) && runtimeReady(home) ? "Ready" : "Optional",
      path: "/truth",
      action: "Open info",
    },
    {
      id: "knowledge",
      icon: BookOpen,
      title: "Add knowledge",
      description:
        "Add documents, FAQs, policies, and notes when the assistant needs more context.",
      status: "optional",
      label: "Optional",
      path: "/knowledge",
      action: "Open library",
    },
  ];
}

function QuickShortcut({ icon: Icon, title, description, path, onNavigate }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(path)}
      className="group rounded-md border border-line-soft bg-white p-4 text-left transition-[background-color,border-color,box-shadow] duration-base ease-premium hover:border-line hover:bg-surface-subtle hover:shadow-[0_14px_30px_-28px_rgba(15,23,42,0.45)]"
    >
      <div className="flex items-start gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-subtle text-text">
          <Icon className="h-5 w-5" strokeWidth={2.05} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-text">{title}</div>
          <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
            {description}
          </div>
        </div>

        <ArrowRight
          className="mt-1 h-4 w-4 shrink-0 text-text-subtle transition-transform duration-base ease-premium group-hover:translate-x-0.5 group-hover:text-brand"
          strokeWidth={2.1}
        />
      </div>
    </button>
  );
}

function OptionalActionRow({ item, onNavigate }) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.path)}
      className="grid w-full gap-4 border-b border-line-soft px-5 py-4 text-left transition-colors duration-base ease-premium last:border-b-0 hover:bg-surface-subtle md:grid-cols-[minmax(0,1fr)_132px] md:items-center"
    >
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line-soft bg-white text-text">
          <Icon className="h-5.5 w-5.5" strokeWidth={2.05} />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[14px] font-semibold text-text">{item.title}</div>
            <AppTag tone={statusTone(item.status)} dot>
              {item.label}
            </AppTag>
          </div>

          <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
            {item.description}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-start gap-2 md:justify-end">
        <span className="text-[13px] font-semibold text-brand">{item.action}</span>
        <ArrowRight className="h-4 w-4 text-brand" strokeWidth={2.1} />
      </div>
    </button>
  );
}

function WorkspaceSummary({ home }) {
  const live = workspaceLive(home);
  const channelReady = readyChannelCount(home);
  const channelConnected = Math.max(connectedChannelCount(home), channelReady);
  const inboxStatus = inboxUnavailable(home)
    ? "Unavailable"
    : unreadCount(home) > 0
      ? "Needs attention"
      : "Calm";

  const rows = [
    {
      label: "Workspace state",
      value: live ? "Live" : "Setup mode",
      tone: live ? "success" : "warning",
    },
    {
      label: "Inbox",
      value: inboxStatus,
      tone: unreadCount(home) > 0 ? "warning" : inboxUnavailable(home) ? "danger" : "success",
    },
    {
      label: "Channels",
      value: `${channelReady}/${Math.max(channelConnected, 1)} ready`,
      tone: channelReady > 0 ? "success" : "neutral",
    },
    {
      label: "Open conversations",
      value: openCount(home),
      tone: openCount(home) > 0 ? "brand" : "neutral",
    },
  ];

  return (
    <div className="grid divide-y divide-line-soft rounded-md border border-line-soft bg-white">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between gap-4 px-4 py-3.5"
        >
          <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
            {row.label}
          </span>

          <AppStatusText tone={row.tone}>{row.value}</AppStatusText>
        </div>
      ))}
    </div>
  );
}

export default function ProductHomePage() {
  const navigate = useNavigate();
  const home = useProductHome();

  const loading = home?.loading === true || home?.isLoading === true;
  const name = greetingName(home);

  const items = useMemo(() => optionalItems(home), [home]);

  function go(path = "") {
    const target = s(path);
    if (!target) return;
    navigate(target);
  }

  if (loading) {
    return (
      <PageCanvas>
        <LoadingSurface
          title="Loading workspace"
          description="Checking inbox, channels, business info, and workspace state."
          rows={5}
        />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas>
      {home?.availabilityNote ? (
        <InlineNotice
          tone="warning"
          title={home.availabilityNote.title}
          description={home.availabilityNote.description}
          compact
        />
      ) : null}

      <Card padded={false} clip className="overflow-hidden">
        <div className="grid gap-6 border-b border-line-soft px-6 py-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <AppTag tone={workspaceLive(home) ? "success" : "neutral"} dot>
                {workspaceLive(home) ? "Workspace live" : "Workspace ready when you are"}
              </AppTag>

              <AppTag tone="neutral">Home</AppTag>
            </div>

            <h1 className="mt-4 text-[34px] font-semibold tracking-[var(--tracking-tight-xl)] text-text md:text-[40px]">
              Hello, {name}
            </h1>

            <p className="mt-2 max-w-[760px] text-[14px] font-medium leading-7 text-text-muted">
              This is your workspace cockpit. Nothing here is mandatory — use the
              shortcuts below only when you need to check messages, connect a channel,
              review business info, or look at reports.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                size="md"
                onClick={() => go("/inbox")}
                rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
              >
                Open inbox
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => go("/reports")}
              >
                View reports
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => window.location.reload()}
                leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
              >
                Refresh
              </Button>
            </div>
          </div>

          <WorkspaceSummary home={home} />
        </div>

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="border-b border-line-soft xl:border-b-0 xl:border-r">
            <div className="border-b border-line-soft px-5 py-4">
              <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                Optional next steps
              </div>
              <div className="mt-1 text-[12.5px] font-medium text-text-muted">
                Small actions you can open whenever they are useful.
              </div>
            </div>

            {items.map((item) => (
              <OptionalActionRow key={item.id} item={item} onNavigate={go} />
            ))}
          </section>

          <section className="bg-surface-subtle">
            <div className="border-b border-line-soft px-5 py-4">
              <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                Quick access
              </div>
              <div className="mt-1 text-[12.5px] font-medium text-text-muted">
                Jump to the surfaces you use most.
              </div>
            </div>

            <div className="grid gap-3 p-4">
              <QuickShortcut
                icon={MessageSquare}
                title="Customers"
                description="Review customer records and context."
                path="/customers"
                onNavigate={go}
              />
              <QuickShortcut
                icon={Sparkles}
                title="Reports"
                description="See performance and team workload."
                path="/reports"
                onNavigate={go}
              />
              <QuickShortcut
                icon={Settings2}
                title="Settings"
                description="Change workspace behavior."
                path="/settings"
                onNavigate={go}
              />
              <QuickShortcut
                icon={Rocket}
                title="Launch guide"
                description="Optional launch preparation path."
                path="/launch"
                onNavigate={go}
              />
            </div>
          </section>
        </div>
      </Card>
    </PageCanvas>
  );
}