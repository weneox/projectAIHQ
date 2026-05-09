import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Globe2,
  Inbox,
  MessageSquare,
  RefreshCw,
  Rocket,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import wavingIcon from "../../assets/channels/waving.png";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import AppStatusText from "../../components/ui/AppStatusText.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
  PageHeader,
} from "../../components/ui/AppShellPrimitives.jsx";
import useProductHome from "../../view-models/useProductHome.js";
import { cx } from "../../lib/cx.js";

const ACCENTS = {
  blue: {
    icon: "text-brand",
    line: "bg-brand",
    tint: "hover:bg-[rgba(var(--color-brand),0.04)]",
    dot: "bg-brand",
    text: "text-brand",
  },
  violet: {
    icon: "text-violet-600",
    line: "bg-violet-500",
    tint: "hover:bg-violet-50/55",
    dot: "bg-violet-500",
    text: "text-violet-700",
  },
  emerald: {
    icon: "text-emerald-600",
    line: "bg-emerald-500",
    tint: "hover:bg-emerald-50/55",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
  },
  amber: {
    icon: "text-amber-600",
    line: "bg-amber-500",
    tint: "hover:bg-amber-50/55",
    dot: "bg-amber-500",
    text: "text-amber-700",
  },
  slate: {
    icon: "text-slate-700",
    line: "bg-slate-400",
    tint: "hover:bg-slate-50",
    dot: "bg-slate-400",
    text: "text-slate-700",
  },
  orange: {
    icon: "text-orange-600",
    line: "bg-orange-500",
    tint: "hover:bg-orange-50/55",
    dot: "bg-orange-500",
    text: "text-orange-700",
  },
};

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
      // Ignore local preview keys.
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

function toneDot(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

function toneText(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "brand") return "text-brand";
  return "text-text-muted";
}

function optionalItems(home = {}) {
  return [
    {
      id: "inbox",
      icon: Inbox,
      accent: ACCENTS.blue,
      title: "Inbox",
      description:
        unreadCount(home) > 0
          ? `${unreadCount(home)} unread message${
              unreadCount(home) === 1 ? "" : "s"
            } waiting.`
          : "Review conversations when needed.",
      status: unreadCount(home) > 0 ? "review" : "optional",
      label: unreadCount(home) > 0 ? "Needs attention" : "Optional",
      path: "/inbox",
      action: "Open inbox",
    },
    {
      id: "channels",
      icon: Globe2,
      accent: ACCENTS.violet,
      title: "Channels",
      description:
        readyChannelCount(home) > 0
          ? `${readyChannelCount(home)} ready channel${
              readyChannelCount(home) === 1 ? "" : "s"
            }.`
          : "Connect website, Instagram, Telegram, or WhatsApp.",
      status: readyChannelCount(home) > 0 ? "ready" : "optional",
      label: readyChannelCount(home) > 0 ? "Ready" : "Optional",
      path: "/channels",
      action: "Open channels",
    },
    {
      id: "business-info",
      icon: ShieldCheck,
      accent: ACCENTS.emerald,
      title: "Business info",
      description:
        truthReady(home) && runtimeReady(home)
          ? "Approved information is available."
          : "Review facts the assistant can use.",
      status: truthReady(home) && runtimeReady(home) ? "ready" : "optional",
      label: truthReady(home) && runtimeReady(home) ? "Ready" : "Optional",
      path: "/truth",
      action: "Open info",
    },
    {
      id: "knowledge",
      icon: BookOpen,
      accent: ACCENTS.amber,
      title: "Knowledge",
      description: "Add FAQs, documents, policies, and notes.",
      status: "optional",
      label: "Optional",
      path: "/knowledge",
      action: "Open library",
    },
  ];
}

function quickShortcuts() {
  return [
    {
      icon: MessageSquare,
      accent: ACCENTS.blue,
      title: "Customers",
      description: "Records and context.",
      path: "/customers",
    },
    {
      icon: Sparkles,
      accent: ACCENTS.violet,
      title: "Reports",
      description: "Performance overview.",
      path: "/reports",
    },
    {
      icon: Settings2,
      accent: ACCENTS.slate,
      title: "Settings",
      description: "Workspace behavior.",
      path: "/settings",
    },
    {
      icon: Rocket,
      accent: ACCENTS.orange,
      title: "Launch",
      description: "Release checklist.",
      path: "/launch",
    },
  ];
}

function HeaderTitle({ name }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <span>Hello, {name}</span>
      <img
        src={wavingIcon}
        alt=""
        draggable="false"
        className="mt-[1px] h-[29px] w-[29px] shrink-0 object-contain"
      />
    </span>
  );
}

function StatusLabel({ tone = "neutral", children }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 text-[12.5px] font-semibold tracking-[var(--tracking-tight-sm)]",
        toneText(tone)
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", toneDot(tone))} />
      {children}
    </span>
  );
}

function AccentIcon({ icon: Icon, accent, size = "lg" }) {
  return (
    <Icon
      className={cx(
        "shrink-0",
        size === "xl" ? "h-[34px] w-[34px]" : "h-[30px] w-[30px]",
        accent.icon
      )}
      strokeWidth={1.85}
    />
  );
}

function SummaryItem({ label, value, tone = "neutral" }) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-4 border-b border-line-soft px-4 py-3 last:border-b-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {label}
      </div>

      <AppStatusText tone={tone}>{value}</AppStatusText>
    </div>
  );
}

function WorkspaceSummary({ home }) {
  const live = workspaceLive(home);
  const channelReady = readyChannelCount(home);
  const channelConnected = Math.max(connectedChannelCount(home), channelReady);
  const inboxStatus = inboxUnavailable(home)
    ? "Unavailable"
    : unreadCount(home) > 0
      ? "Review"
      : "Calm";

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="border-b border-line-soft px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-[3px] rounded-full bg-brand" />
          <div>
            <div className="text-[15px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              Workspace state
            </div>
            <div className="mt-0.5 text-[12.5px] font-medium text-text-muted">
              Current operational snapshot.
            </div>
          </div>
        </div>
      </div>

      <SummaryItem
        label="Status"
        value={live ? "Live" : "Setup mode"}
        tone={live ? "success" : "warning"}
      />
      <SummaryItem
        label="Inbox"
        value={inboxStatus}
        tone={
          unreadCount(home) > 0
            ? "warning"
            : inboxUnavailable(home)
              ? "danger"
              : "success"
        }
      />
      <SummaryItem
        label="Channels"
        value={`${channelReady}/${Math.max(channelConnected, 1)} ready`}
        tone={channelReady > 0 ? "success" : "neutral"}
      />
      <SummaryItem
        label="Open conversations"
        value={openCount(home)}
        tone={openCount(home) > 0 ? "brand" : "neutral"}
      />
    </Card>
  );
}

function OptionalActionRow({ item, onNavigate }) {
  const tone = statusTone(item.status);

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.path)}
      className={cx(
        "group relative grid w-full gap-4 border-b border-line-soft px-4 py-3.5 text-left transition-colors duration-base ease-premium last:border-b-0 md:grid-cols-[minmax(0,1fr)_112px] md:items-center",
        item.accent.tint
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full opacity-80",
          item.accent.line
        )}
      />

      <div className="flex min-w-0 items-center gap-4 pl-1.5">
        <AccentIcon icon={item.icon} accent={item.accent} size="xl" />

        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <div className="truncate text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
              {item.title}
            </div>

            <StatusLabel tone={tone}>{item.label}</StatusLabel>
          </div>

          <div className="mt-1 truncate text-[12.5px] font-medium text-text-muted">
            {item.description}
          </div>
        </div>
      </div>

      <div
        className={cx(
          "flex items-center justify-start gap-1.5 text-[13px] font-semibold md:justify-end",
          item.accent.text
        )}
      >
        <span>{item.action}</span>
        <ArrowRight
          className="h-3.5 w-3.5 transition-transform duration-base ease-premium group-hover:translate-x-0.5"
          strokeWidth={2.15}
        />
      </div>
    </button>
  );
}

function QuickShortcut({ icon: Icon, accent, title, description, path, onNavigate }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(path)}
      className={cx(
        "group relative flex items-center justify-between gap-3 rounded-md border border-line-soft bg-white px-4 py-3.5 text-left transition-[background-color,border-color] duration-base ease-premium hover:border-line",
        accent.tint
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full opacity-75",
          accent.line
        )}
      />

      <div className="flex min-w-0 items-center gap-4 pl-1.5">
        <AccentIcon icon={Icon} accent={accent} />

        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
            {title}
          </div>
          <div className="mt-0.5 truncate text-[12px] font-medium text-text-muted">
            {description}
          </div>
        </div>
      </div>

      <ArrowRight
        className={cx(
          "h-4 w-4 shrink-0 transition-transform duration-base ease-premium group-hover:translate-x-0.5",
          accent.text
        )}
        strokeWidth={2.1}
      />
    </button>
  );
}

function SectionTitle({ title, description, accent = ACCENTS.blue }) {
  return (
    <div className="border-b border-line-soft px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className={cx("mt-1 h-7 w-[3px] rounded-full", accent.line)} />
        <div className="min-w-0">
          <div className="text-[15px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
            {title}
          </div>
          {description ? (
            <div className="mt-0.5 text-[12.5px] font-medium text-text-muted">
              {description}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ProductHomePage() {
  const navigate = useNavigate();
  const home = useProductHome();

  const loading = home?.loading === true || home?.isLoading === true;
  const name = greetingName(home);

  const items = useMemo(() => optionalItems(home), [home]);
  const shortcuts = useMemo(() => quickShortcuts(), []);

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

      <PageHeader
        title={<HeaderTitle name={name} />}
        description="Your workspace cockpit for messages, channels, business info, and reports."
        actions={
          <>
            <Button
              type="button"
              onClick={() => go("/inbox")}
              rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
            >
              Open inbox
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => go("/reports")}
            >
              View reports
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => window.location.reload()}
              leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
            >
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Card padded={false} clip className="overflow-hidden">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="min-w-0 border-b border-line-soft xl:border-b-0 xl:border-r">
              <SectionTitle
                title="Next steps"
                description="Only open what you need right now."
                accent={ACCENTS.blue}
              />

              {items.map((item) => (
                <OptionalActionRow key={item.id} item={item} onNavigate={go} />
              ))}
            </section>

            <section className="min-w-0 bg-surface-subtle">
              <SectionTitle
                title="Quick access"
                description="Main surfaces in one place."
                accent={ACCENTS.violet}
              />

              <div className="grid gap-2.5 p-3.5">
                {shortcuts.map((shortcut) => (
                  <QuickShortcut
                    key={shortcut.path}
                    icon={shortcut.icon}
                    accent={shortcut.accent}
                    title={shortcut.title}
                    description={shortcut.description}
                    path={shortcut.path}
                    onNavigate={go}
                  />
                ))}
              </div>
            </section>
          </div>
        </Card>

        <WorkspaceSummary home={home} />
      </div>
    </PageCanvas>
  );
}