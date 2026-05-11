import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Globe2,
  Inbox,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import telegramIcon from "../../assets/channels/telegram.svg";
import instagramIcon from "../../assets/channels/instagram.svg";
import websiteIcon from "../../assets/channels/web.svg";

import Button from "../../components/ui/Button.jsx";
import {
  LoadingSurface,
  PageCanvas,
} from "../../components/ui/AppShellPrimitives.jsx";
import { cx } from "../../lib/cx.js";
import { normalizeNavigationAction, s } from "../../lib/appUi.js";
import useProductHome from "../../view-models/useProductHome.js";

const CHANNEL_ICON_BY_PROVIDER = {
  website: websiteIcon,
  webchat: websiteIcon,
  instagram: instagramIcon,
  meta: instagramIcon,
  telegram: telegramIcon,
};

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

function unreadCount(home) {
  return n(home?.inboxState?.counts?.unreadCount);
}

function openConversationCount(home) {
  return Math.max(0, n(home?.inboxState?.counts?.openCount));
}

function handoffCount(home) {
  return n(home?.inboxState?.counts?.handoffCount);
}

function pendingOutboundCount(home) {
  return n(
    home?.inboxState?.counts?.pendingOutboundCount ??
      home?.inboxState?.counts?.outboundPending
  );
}

function failedOutboundCount(home) {
  return n(home?.inboxState?.counts?.failedOutboundCount);
}

function retryingOutboundCount(home) {
  return n(home?.inboxState?.counts?.retryingOutboundCount);
}

function waitingCount(home) {
  return (
    unreadCount(home) +
    handoffCount(home) +
    pendingOutboundCount(home) +
    failedOutboundCount(home) +
    retryingOutboundCount(home)
  );
}

function providerStates(home) {
  return arr(home?.launchChannel?.providerStates);
}

function availableChannelCount(home) {
  const states = providerStates(home);
  if (states.length) {
    return states.filter((item) => item?.available !== false).length;
  }

  return 3;
}

function readyChannelCount(home) {
  const states = providerStates(home);

  if (states.length) {
    return states.filter(
      (item) => item?.connected === true && item?.deliveryReady === true
    ).length;
  }

  const channel = home?.launchChannel || {};
  if (n(channel.readyCount) > 0) return n(channel.readyCount);
  if (channel.connected === true && channel.deliveryReady === true) return 1;

  return 0;
}

function connectedChannelCount(home) {
  const states = providerStates(home);

  if (states.length) {
    return states.filter((item) => item?.connected === true).length;
  }

  return n(home?.launchChannel?.connectedCount);
}

function businessInfoReady(home) {
  return home?.truthRuntime?.truthReady === true;
}

function assistantReady(home) {
  return home?.truthRuntime?.ready === true;
}

function channelReady(home) {
  return readyChannelCount(home) > 0;
}

function inboxUnavailable(home) {
  return lower(home?.inboxState?.status) === "unavailable";
}

function workspaceReady(home) {
  return businessInfoReady(home) && assistantReady(home) && channelReady(home);
}

function providerLabel(provider = "") {
  switch (lower(provider)) {
    case "website":
    case "webchat":
      return "Veb sayt";
    case "instagram":
    case "meta":
      return "Instagram";
    case "telegram":
      return "Telegram";
    default:
      return "Kanal";
  }
}

function providerPath(provider = "") {
  switch (lower(provider)) {
    case "website":
    case "webchat":
      return "/channels?channel=website";
    case "instagram":
    case "meta":
      return "/channels?channel=instagram";
    case "telegram":
      return "/channels?channel=telegram";
    default:
      return "/channels";
  }
}

function providerIcon(provider = "") {
  return CHANNEL_ICON_BY_PROVIDER[lower(provider)] || websiteIcon;
}

function normalizeChannels(home) {
  const states = providerStates(home);

  if (states.length) {
    return states.map((item) => {
      const provider = lower(item?.provider || item?.id);
      const ready = item?.connected === true && item?.deliveryReady === true;
      const connected = item?.connected === true;

      return {
        id: provider || item?.id || item?.channelLabel || "channel",
        provider,
        label: item?.channelLabel || providerLabel(provider),
        status: ready ? "Canlı" : connected ? "Yoxlanır" : "Bağlı",
        tone: ready ? "success" : connected ? "warning" : "neutral",
        path: providerPath(provider),
      };
    });
  }

  return ["website", "instagram", "telegram"].map((provider) => ({
    id: provider,
    provider,
    label: providerLabel(provider),
    status: "Bağlı",
    tone: "neutral",
    path: providerPath(provider),
  }));
}

function toneTextClass(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "brand") return "text-brand";
  return "text-text-muted";
}

function toneDotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

function actionWithLabel(action, label, fallbackPath) {
  const next = normalizeNavigationAction(action) || {};
  return {
    label,
    path: next.path || fallbackPath,
  };
}

function buildHero(home) {
  const waiting = waitingCount(home);

  if (waiting > 0) {
    return {
      tone: "warning",
      status: "Cavab gözləyir",
      detail: "Gələnlər qutusunu açın və növbəni təmizləyin.",
      primary: { label: "Gələnləri aç", path: "/inbox" },
      secondary: { label: "Kanallar", path: "/channels" },
    };
  }

  if (!businessInfoReady(home)) {
    return {
      tone: "warning",
      status: "Məlumat lazımdır",
      detail: "Köməkçinin istifadə edəcəyi əsas məlumatları təsdiqləyin.",
      primary: actionWithLabel(
        home?.assistant?.primaryAction,
        "Məlumatları tamamla",
        "/home?assistant=setup"
      ),
      secondary: { label: "Kanallar", path: "/channels" },
    };
  }

  if (!channelReady(home)) {
    return {
      tone: "warning",
      status: "Kanal qoşulmayıb",
      detail: "Veb sayt, Instagram və ya Telegram mesajlarını bir yerə gətirin.",
      primary: { label: "Kanal qoş", path: "/channels" },
      secondary: { label: "Məlumatlar", path: "/truth" },
    };
  }

  if (inboxUnavailable(home)) {
    return {
      tone: "danger",
      status: "Gələnlər yoxlanmalıdır",
      detail: "Hazırlıq tamamdır, amma mesaj axını indi görünmür.",
      primary: { label: "Gələnləri yoxla", path: "/inbox" },
      secondary: { label: "Kanallar", path: "/channels" },
    };
  }

  return {
    tone: "success",
    status: "Hər şey sakitdir",
    detail: "Təcili müştəri işi yoxdur.",
    primary: { label: "Gələnləri aç", path: "/inbox" },
    secondary: { label: "Kanallar", path: "/channels" },
  };
}

function StatusText({ tone = "neutral", children }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
      <span className={cx("h-1.5 w-1.5 rounded-full", toneDotClass(tone))} />
      <span className={toneTextClass(tone)}>{children}</span>
    </span>
  );
}

function ChannelLogo({ provider }) {
  return (
    <img
      src={providerIcon(provider)}
      alt=""
      aria-hidden="true"
      draggable="false"
      className="h-6 w-6 shrink-0 object-contain"
    />
  );
}

function HeroMetric({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="text-[30px] font-semibold leading-none text-text">
        {value}
      </div>
      <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
        {label}
      </div>
    </div>
  );
}

function HeroSection({ hero, home, onAction }) {
  return (
    <section className="border-b border-line-soft pb-8 pt-2">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div className="min-w-0">
          <StatusText tone={hero.tone}>{hero.status}</StatusText>

          <h1 className="mt-5 max-w-[760px] font-display text-[40px] font-semibold leading-[1.02] tracking-[var(--tracking-tight-xl)] text-text md:text-[56px]">
            Müştəri mesajları bir yerdə.
          </h1>

          <p className="mt-5 max-w-[620px] text-[15px] font-medium leading-7 text-text-muted">
            Söhbətlər, kanallar və gündəlik müştəri işi eyni sakit ekranda.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button type="button" size="md" onClick={() => onAction(hero.primary)}>
              {hero.primary.label}
              <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2.1} />
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => onAction(hero.secondary)}
            >
              {hero.secondary.label}
            </Button>
          </div>
        </div>

        <div className="border border-line-soft bg-surface-muted p-5">
          <p className="text-[13.5px] font-medium leading-6 text-text-muted">
            {hero.detail}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <HeroMetric label="Gözləyir" value={waitingCount(home)} />
            <HeroMetric
              label="Canlı kanal"
              value={`${readyChannelCount(home)}/${availableChannelCount(home)}`}
            />
            <HeroMetric
              label="Köməkçi"
              value={workspaceReady(home) ? "Aktiv" : "Qorunur"}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricButton({ icon: Icon, label, value, note, tone = "neutral", onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group grid min-h-[126px] grid-rows-[auto_1fr] border border-line-soft bg-white p-4 text-left transition-[border-color,background-color] duration-base ease-premium hover:border-line hover:bg-surface-muted"
    >
      <div className="flex items-start justify-between gap-4">
        <Icon className={cx("h-5 w-5", toneTextClass(tone))} strokeWidth={2.05} />
        <span className={cx("mt-1 h-1.5 w-1.5 rounded-full", toneDotClass(tone))} />
      </div>

      <div className="mt-auto">
        <div className="text-[13px] font-semibold text-text-muted">{label}</div>
        <div className="mt-2 text-[30px] font-semibold leading-none text-text">
          {value}
        </div>
        <div className="mt-2 text-[12.5px] font-medium leading-5 text-text-muted">
          {note}
        </div>
      </div>
    </button>
  );
}

function MetricsRow({ home, onNavigate }) {
  const unread = unreadCount(home);
  const liveChannels = readyChannelCount(home);
  const totalChannels = availableChannelCount(home);
  const ready = workspaceReady(home);

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <MetricButton
        icon={MessageCircle}
        label="Söhbətlər"
        value={openConversationCount(home)}
        note={unread > 0 ? `${unread} oxunmamış` : "Növbə təmiz"}
        tone={unread > 0 ? "warning" : "success"}
        onClick={() => onNavigate("/inbox")}
      />

      <MetricButton
        icon={Globe2}
        label="Kanallar"
        value={`${liveChannels}/${totalChannels}`}
        note={`${connectedChannelCount(home)} qoşulub`}
        tone={liveChannels > 0 ? "success" : "warning"}
        onClick={() => onNavigate("/channels")}
      />

      <MetricButton
        icon={ShieldCheck}
        label="Məlumat"
        value={businessInfoReady(home) ? "Hazır" : "Yoxla"}
        note={businessInfoReady(home) ? "Təsdiqlənib" : "Tamamlanmalıdır"}
        tone={businessInfoReady(home) ? "success" : "warning"}
        onClick={() => onNavigate("/truth")}
      />

      <MetricButton
        icon={Bot}
        label="Köməkçi"
        value={ready ? "Aktiv" : "Qorunur"}
        note={ready ? "Cavablar hazırdır" : "Hazırlıq gedir"}
        tone={ready ? "success" : "warning"}
        onClick={() => onNavigate(ready ? "/inbox" : "/truth")}
      />
    </section>
  );
}

function SetupProgressSection({ home, onNavigate }) {
  const steps = [
    {
      id: "business-info",
      label: "Məlumat",
      description: "Əsas məlumat təsdiqlənib.",
      ready: businessInfoReady(home),
      readyLabel: "Hazır",
      blockedLabel: "Yoxla",
      path: "/truth",
      icon: ShieldCheck,
    },
    {
      id: "assistant",
      label: "Köməkçi",
      description: "Cavablar nəzarətdədir.",
      ready: assistantReady(home),
      readyLabel: "Aktiv",
      blockedLabel: "Qorunur",
      path: "/truth",
      icon: Bot,
    },
    {
      id: "channels",
      label: "Kanallar",
      description: "Ən azı bir kanal canlıdır.",
      ready: channelReady(home),
      readyLabel: `${readyChannelCount(home)}/${availableChannelCount(home)} canlı`,
      blockedLabel: `${connectedChannelCount(home)} qoşulub`,
      path: "/channels",
      icon: Globe2,
    },
    {
      id: "inbox",
      label: "Gələnlər",
      description: "Mesajlar qəbul olunur.",
      ready: !inboxUnavailable(home),
      readyLabel: "Açıq",
      blockedLabel: "Yoxla",
      path: "/inbox",
      icon: Inbox,
    },
  ];

  const completed = steps.filter((step) => step.ready).length;
  const ready = completed === steps.length;

  return (
    <section className="space-y-4 border-y border-line-soft py-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <StatusText tone={ready ? "success" : "warning"}>
            {ready ? "Hazırdır" : "Tamamlanır"}
          </StatusText>
          <h2 className="mt-3 text-[26px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
            Başlama siyahısı
          </h2>
        </div>

        <div className="text-[28px] font-semibold leading-none text-text">
          {completed}/{steps.length}
        </div>
      </div>

      <div className="grid gap-px overflow-hidden border border-line-soft bg-line-soft md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => {
          const Icon = step.icon;
          const tone = step.ready ? "success" : "warning";

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onNavigate(step.path)}
              className="grid min-h-[142px] bg-white p-4 text-left transition-colors duration-base ease-premium hover:bg-surface-muted"
            >
              <div className="flex items-start justify-between gap-3">
                <Icon className={cx("h-5 w-5", toneTextClass(tone))} strokeWidth={2.05} />
                <span className={cx("h-1.5 w-1.5 rounded-full", toneDotClass(tone))} />
              </div>

              <div className="mt-auto">
                <div className="text-[14px] font-semibold text-text">{step.label}</div>
                <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
                  {step.description}
                </div>
                <div className={cx("mt-3 text-[12.5px] font-semibold", toneTextClass(tone))}>
                  {step.ready ? step.readyLabel : step.blockedLabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function WorkPanel({ home, onNavigate }) {
  const waiting = waitingCount(home);
  const ready = workspaceReady(home);

  return (
    <section className="grid min-h-[300px] border border-line-soft bg-white">
      <div className="flex flex-col justify-between gap-8 p-5">
        <div className="flex items-start justify-between gap-5">
          <div>
            <h2 className="text-[25px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
              {waiting > 0 ? "Cavab gözləyir" : ready ? "Növbə boşdur" : "Hazırlığı bitirin"}
            </h2>

            <p className="mt-3 max-w-[560px] text-[13.5px] font-medium leading-6 text-text-muted">
              {waiting > 0
                ? "Müştəri mesajları diqqət istəyir."
                : ready
                  ? "Təcili iş yoxdur."
                  : "Məlumatları tamamlayın və bir kanal qoşun."}
            </p>
          </div>

          {waiting > 0 ? (
            <Inbox className="h-6 w-6 text-warning" strokeWidth={2.1} />
          ) : ready ? (
            <CheckCircle2 className="h-6 w-6 text-success" strokeWidth={2.1} />
          ) : (
            <Inbox className="h-6 w-6 text-brand" strokeWidth={2.1} />
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Button type="button" fullWidth onClick={() => onNavigate("/inbox")}>
            Gələnlər
          </Button>

          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={() => onNavigate("/channels")}
          >
            Kanallar
          </Button>

          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={() => onNavigate("/truth")}
          >
            Məlumatlar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 border-t border-line-soft bg-surface-muted">
        {[
          ["Oxunmamış", unreadCount(home)],
          ["Açıq", openConversationCount(home)],
          ["Təhvil", handoffCount(home)],
          ["Gözləyir", waiting],
        ].map(([label, value]) => (
          <div key={label} className="border-r border-line-soft px-4 py-4 last:border-r-0">
            <div className="text-[22px] font-semibold leading-none text-text">
              {value}
            </div>
            <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
              {label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChannelsPanel({ channels, onNavigate }) {
  return (
    <section className="border border-line-soft bg-white">
      <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
        <div>
          <h2 className="text-[19px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            Kanallar
          </h2>
          <p className="mt-1 text-[12.5px] font-medium text-text-muted">
            Canlı mesaj mənbələri.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("/channels")}
          className="text-[12.5px] font-semibold text-brand"
        >
          Aç
        </button>
      </div>

      <div className="divide-y divide-line-soft">
        {channels.slice(0, 4).map((channel) => (
          <button
            key={channel.id}
            type="button"
            onClick={() => onNavigate(channel.path)}
            className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-subtle"
          >
            <ChannelLogo provider={channel.provider} />

            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold text-text">
                {channel.label}
              </div>

              <div className={cx("mt-1 text-[12.5px] font-semibold", toneTextClass(channel.tone))}>
                {channel.status}
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-text-subtle" strokeWidth={2.1} />
          </button>
        ))}
      </div>
    </section>
  );
}

function BusinessPanel({ home, onNavigate }) {
  const rows = [
    {
      label: "Məlumatlar",
      value: businessInfoReady(home) ? "Hazır" : "Yoxla",
      tone: businessInfoReady(home) ? "success" : "warning",
      path: "/truth",
    },
    {
      label: "Baza",
      value: "Açıq",
      tone: "neutral",
      path: "/knowledge",
    },
    {
      label: "Köməkçi",
      value: assistantReady(home) ? "Aktiv" : "Qorunur",
      tone: assistantReady(home) ? "success" : "warning",
      path: "/truth",
    },
  ];

  return (
    <section className="border border-line-soft bg-white">
      <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
        <div>
          <h2 className="text-[19px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            Cavab əsası
          </h2>
          <p className="mt-1 text-[12.5px] font-medium text-text-muted">
            Köməkçinin istifadə etdiyi məlumat.
          </p>
        </div>

        <ShieldCheck className="h-5 w-5 text-text-subtle" strokeWidth={2.1} />
      </div>

      <div className="divide-y divide-line-soft">
        {rows.map((row) => (
          <button
            key={row.label}
            type="button"
            onClick={() => onNavigate(row.path)}
            className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-subtle"
          >
            <span className="truncate text-[14px] font-semibold text-text">
              {row.label}
            </span>

            <span className={cx("text-[12.5px] font-semibold", toneTextClass(row.tone))}>
              {row.value}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProductHomeLoadingSurface() {
  return (
    <PageCanvas>
      <LoadingSurface title="Ana səhifə açılır" />
    </PageCanvas>
  );
}

export default function ProductHomePage() {
  const navigate = useNavigate();
  const home = useProductHome();

  function go(path) {
    if (path) navigate(path);
  }

  function goFromAction(action = null) {
    const next = normalizeNavigationAction(action);
    if (next?.path) navigate(next.path);
  }

  if (home.loading) return <ProductHomeLoadingSurface />;

  const hero = buildHero(home);
  const channels = normalizeChannels(home);

  return (
    <PageCanvas className="space-y-6 pt-2">
      <HeroSection hero={hero} home={home} onAction={goFromAction} />

      <MetricsRow home={home} onNavigate={go} />

      <SetupProgressSection home={home} onNavigate={go} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <WorkPanel home={home} onNavigate={go} />
        <ChannelsPanel channels={channels} onNavigate={go} />
      </div>

      <BusinessPanel home={home} onNavigate={go} />
    </PageCanvas>
  );
}
