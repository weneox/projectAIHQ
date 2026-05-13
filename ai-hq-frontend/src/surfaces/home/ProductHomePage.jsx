import { useNavigate } from "react-router-dom";

import wavingIcon from "../../assets/channels/waving.png";
import Button from "../../components/ui/Button.jsx";
import { LoadingSurface, PageCanvas } from "../../components/ui/AppShellPrimitives.jsx";
import { normalizeNavigationAction, s } from "../../lib/appUi.js";
import useProductHome from "../../view-models/useProductHome.js";

const asArray = (value, fallback = []) => (Array.isArray(value) ? value : fallback);

const asNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const lower = (value, fallback = "") => s(value, fallback).toLowerCase();

const unreadCount = (home) => asNumber(home?.inboxState?.counts?.unreadCount);
const openConversationCount = (home) =>
  Math.max(0, asNumber(home?.inboxState?.counts?.openCount));
const handoffCount = (home) => asNumber(home?.inboxState?.counts?.handoffCount);
const pendingOutboundCount = (home) =>
  asNumber(
    home?.inboxState?.counts?.pendingOutboundCount ??
      home?.inboxState?.counts?.outboundPending
  );
const failedOutboundCount = (home) =>
  asNumber(home?.inboxState?.counts?.failedOutboundCount);
const retryingOutboundCount = (home) =>
  asNumber(home?.inboxState?.counts?.retryingOutboundCount);

const waitingCount = (home) =>
  unreadCount(home) +
  handoffCount(home) +
  pendingOutboundCount(home) +
  failedOutboundCount(home) +
  retryingOutboundCount(home);

const providerStates = (home) => asArray(home?.launchChannel?.providerStates);
const inboxUnavailable = (home) => lower(home?.inboxState?.status) === "unavailable";
const businessInfoReady = (home) => home?.truthRuntime?.truthReady === true;
const assistantReady = (home) => home?.truthRuntime?.ready === true;

function readyChannelCount(home) {
  const states = providerStates(home);

  if (states.length) {
    return states.filter(
      (item) => item?.connected === true && item?.deliveryReady === true
    ).length;
  }

  const channel = home?.launchChannel || {};
  if (asNumber(channel.readyCount) > 0) return asNumber(channel.readyCount);
  return channel.connected === true && channel.deliveryReady === true ? 1 : 0;
}

function connectedChannelCount(home) {
  const states = providerStates(home);

  return states.length
    ? states.filter((item) => item?.connected === true).length
    : asNumber(home?.launchChannel?.connectedCount);
}

const channelReady = (home) => readyChannelCount(home) > 0;

const workspaceReady = (home) =>
  businessInfoReady(home) &&
  assistantReady(home) &&
  channelReady(home) &&
  !inboxUnavailable(home);

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

function channelRows(home) {
  const states = providerStates(home);

  if (!states.length) {
    return ["website", "instagram", "telegram"].map((provider) => ({
      id: provider,
      provider,
      label: providerLabel(provider),
      state: "Qoşulmayıb",
      path: providerPath(provider),
    }));
  }

  return states.map((item) => {
    const provider = lower(item?.provider || item?.id);
    const ready = item?.connected === true && item?.deliveryReady === true;
    const connected = item?.connected === true;

    return {
      id: provider || item?.id || item?.channelLabel || "channel",
      provider,
      label: item?.channelLabel || providerLabel(provider),
      state: ready ? "Canlı" : connected ? "Yoxlanır" : "Qoşulmayıb",
      path: providerPath(provider),
    };
  });
}

function assistantAction(home) {
  const fallback = { label: "Məlumatları aç", path: "/home?assistant=setup" };
  const next = normalizeNavigationAction(home?.assistant?.primaryAction);

  if (!next?.path) return fallback;

  return {
    label: fallback.label,
    path: next.path,
  };
}

function homeState(home) {
  const waiting = waitingCount(home);

  if (waiting > 0) {
    return {
      tone: "İş var",
      title: "Müştəri cavab gözləyir",
      description:
        "Gələnlər qutusunda diqqət istəyən söhbətlər var. Əvvəl onları bağlayın.",
      primary: { label: "Gələnləri aç", path: "/inbox" },
      secondary: { label: "Kanallar", path: "/channels" },
    };
  }

  if (!businessInfoReady(home)) {
    return {
      tone: "Başlamaq üçün",
      title: "Biznes məlumatlarını tamamlayın",
      description:
        "Köməkçi məhsulunuzu, xidmətlərinizi, iş saatınızı və cavab qaydalarınızı bilmədən müştəriyə etibarlı cavab verə bilməz.",
      primary: assistantAction(home),
      secondary: { label: "Kanallara bax", path: "/channels" },
    };
  }

  if (!channelReady(home)) {
    return {
      tone: "Növbəti addım",
      title: "İlk mesaj kanalını qoşun",
      description:
        "Veb sayt, Instagram və ya Telegram qoşulandan sonra müştəri mesajları bu mərkəzdə toplanacaq.",
      primary: { label: "Kanal qoş", path: "/channels" },
      secondary: { label: "Məlumatlar", path: "/truth" },
    };
  }

  if (inboxUnavailable(home)) {
    return {
      tone: "Yoxlama lazımdır",
      title: "Mesaj axınını yoxlayın",
      description:
        "Məlumat və kanal hazır görünür, amma gələn mesaj axını aktiv deyil.",
      primary: { label: "Gələnləri yoxla", path: "/inbox" },
      secondary: { label: "Kanallar", path: "/channels" },
    };
  }

  return {
    tone: "Hazırdır",
    title: "Mərkəz işlək vəziyyətdədir",
    description:
      "Yeni mesaj gəldikdə burada görünəcək. Hazırda diqqət istəyən iş yoxdur.",
    primary: { label: "Gələnləri aç", path: "/inbox" },
    secondary: { label: "Kanallar", path: "/channels" },
  };
}

function steps(home) {
  return [
    {
      id: "truth",
      title: "Biznes məlumatları",
      body: "Məhsul, xidmət, qiymət, iş saatı və cavab qaydaları.",
      state: businessInfoReady(home) ? "Hazırdır" : "Tamamlanmalıdır",
      active: !businessInfoReady(home),
      path: assistantAction(home).path,
    },
    {
      id: "channels",
      title: "Mesaj kanalı",
      body: "Müştərilərdən gələn mesajların qəbul ediləcəyi mənbə.",
      state: channelReady(home)
        ? connectedChannelCount(home) > 1
          ? "Kanallar canlıdır"
          : "Kanal canlıdır"
        : "Sonrakı addım",
      active: businessInfoReady(home) && !channelReady(home),
      path: "/channels",
    },
    {
      id: "inbox",
      title: "Gələnlər qutusu",
      body: "Oxunmamış, açıq və operatora ötürülən söhbətlər.",
      state: inboxUnavailable(home) ? "Yoxlanmalıdır" : "Açıqdır",
      active: businessInfoReady(home) && channelReady(home) && inboxUnavailable(home),
      path: "/inbox",
    },
  ];
}

function productStatus(home) {
  if (waitingCount(home) > 0) return "Cavab gözləyir";
  if (!businessInfoReady(home)) return "Məlumat açılmalıdır";
  if (!channelReady(home)) return "Kanal qoşulmayıb";
  if (inboxUnavailable(home)) return "Mesaj axını yoxlanmalıdır";
  return "Mərkəz hazırdır";
}

function activityText(home) {
  const waiting = waitingCount(home);

  if (waiting > 0) return `${waiting} söhbət diqqət istəyir`;
  if (workspaceReady(home)) return "Bu gün təcili iş yoxdur";

  return "İşə salma tamamlanmayıb";
}

function ProductHomeLoadingSurface() {
  return (
    <PageCanvas>
      <LoadingSurface title="Ana səhifə açılır" />
    </PageCanvas>
  );
}

function PageTitle({ home }) {
  return (
    <header className="flex flex-col gap-4 border-b border-line-soft pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-[28px] font-semibold leading-tight tracking-[var(--tracking-tight-lg)] text-text">
          <img
            src={wavingIcon}
            alt=""
            aria-hidden="true"
            className="h-8 w-8 shrink-0 object-contain"
          />
          <span>Müştəri mərkəzi</span>
        </h1>

        <p className="mt-2 max-w-[620px] text-[13.5px] font-medium leading-6 text-text-muted">
          Müştəri mesajları, cavab məlumatları və kanallar üçün sakit iş masası.
        </p>
      </div>

      <div className="rounded-[10px] border border-line-soft bg-white px-3.5 py-2.5 text-[12.5px] font-semibold text-text-muted">
        {productStatus(home)}
      </div>
    </header>
  );
}

function PrimaryFocus({ state, onPrimary, onSecondary }) {
  return (
    <section className="rounded-[14px] border border-line-soft bg-white px-5 py-5 md:px-6 md:py-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-text-muted">{state.tone}</p>

          <h2 className="mt-2 max-w-[680px] text-[25px] font-semibold leading-tight tracking-[var(--tracking-tight-lg)] text-text md:text-[30px]">
            {state.title}
          </h2>

          <p className="mt-3 max-w-[660px] text-[13.5px] font-medium leading-6 text-text-muted">
            {state.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 lg:justify-end">
          <Button type="button" size="md" onClick={onPrimary}>
            {state.primary.label}
          </Button>

          <Button type="button" variant="secondary" size="md" onClick={onSecondary}>
            {state.secondary.label}
          </Button>
        </div>
      </div>
    </section>
  );
}

function StepCard({ item, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-[12px] border bg-white px-4 py-4 text-left transition-colors",
        item.active ? "border-text" : "border-line-soft hover:border-line",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-[15px] font-semibold leading-5 text-text">
          {item.title}
        </h3>

        <span className="shrink-0 text-[12px] font-semibold text-text-muted">
          {item.state}
        </span>
      </div>

      <p className="mt-3 max-w-[320px] text-[12.5px] font-medium leading-5 text-text-muted">
        {item.body}
      </p>
    </button>
  );
}

function SetupSection({ items, onNavigate }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-[19px] font-semibold text-text">İş sırası</h2>

        <span className="text-[12.5px] font-medium text-text-subtle">
          Məlumat → Kanal → Gələnlər
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <StepCard
            key={item.id}
            item={item}
            onClick={() => onNavigate(item.path)}
          />
        ))}
      </div>
    </section>
  );
}

function SummaryCell({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-medium text-text-subtle">{label}</p>
      <p className="mt-1.5 truncate text-[15px] font-semibold text-text">
        {value}
      </p>
    </div>
  );
}

function QuietSummary({ home }) {
  const channels = channelReady(home)
    ? connectedChannelCount(home) > 1
      ? "Kanallar qoşulub"
      : "Kanal qoşulub"
    : "Kanal gözləyir";

  const assistant = assistantReady(home)
    ? "Köməkçi aktivdir"
    : businessInfoReady(home)
      ? "Köməkçi hazırlanır"
      : "Məlumat gözləyir";

  return (
    <section className="rounded-[14px] border border-line-soft bg-white px-5 py-4">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCell label="Bu gün" value={activityText(home)} />
        <SummaryCell label="Kanallar" value={channels} />
        <SummaryCell label="Köməkçi" value={assistant} />
      </div>
    </section>
  );
}

function InboxPanel({ home, onNavigate }) {
  const waiting = waitingCount(home);

  return (
    <section className="rounded-[14px] border border-line-soft bg-white px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[19px] font-semibold text-text">
            {waiting > 0 ? "Diqqət istəyən söhbətlər" : "Gələnlər sakitdir"}
          </h2>

          <p className="mt-2 max-w-[520px] text-[13px] font-medium leading-6 text-text-muted">
            {waiting > 0
              ? "Müştəri mesajlarını bağlamaq üçün gələnlər qutusuna keçin."
              : "Yeni mesaj gələndə və ya söhbət operatora ötürüləndə burada görünəcək."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("/inbox")}
          className="text-[13px] font-semibold text-brand hover:text-text"
        >
          Aç
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[
          ["Oxunmamış", unreadCount(home)],
          ["Açıq", openConversationCount(home)],
          ["Təhvil", handoffCount(home)],
          ["Gözləyir", waiting],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[10px] bg-surface-muted px-3.5 py-3">
            <p className="text-[22px] font-semibold leading-none text-text">
              {value}
            </p>
            <p className="mt-2 text-[11.5px] font-medium text-text-subtle">
              {label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChannelsPanel({ home, onNavigate }) {
  const rows = channelRows(home).slice(0, 3);

  return (
    <section className="rounded-[14px] border border-line-soft bg-white px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[19px] font-semibold text-text">Mesaj mənbələri</h2>

          <p className="mt-2 text-[13px] font-medium leading-6 text-text-muted">
            Müştərilərin yazdığı kanallar burada idarə olunur.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("/channels")}
          className="text-[13px] font-semibold text-brand hover:text-text"
        >
          Hamısı
        </button>
      </div>

      <div className="mt-5 divide-y divide-line-soft rounded-[10px] border border-line-soft">
        {rows.map((channel) => (
          <button
            key={channel.id}
            type="button"
            onClick={() => onNavigate(channel.path)}
            className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-left hover:bg-surface-muted"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-semibold text-text">
                {channel.label}
              </span>

              <span className="mt-0.5 block truncate text-[12px] font-medium text-text-subtle">
                {channel.provider ? providerLabel(channel.provider) : "Mesaj kanalı"}
              </span>
            </span>

            <span className="text-[12.5px] font-semibold text-text-muted">
              {channel.state}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function ProductHomePage() {
  const navigate = useNavigate();
  const home = useProductHome();

  if (home.loading) return <ProductHomeLoadingSurface />;

  const go = (path) => path && navigate(path);
  const current = homeState(home);
  const items = steps(home);

  const showOperations =
    workspaceReady(home) ||
    waitingCount(home) > 0 ||
    connectedChannelCount(home) > 0;

  return (
    <PageCanvas className="mx-auto max-w-[1160px] space-y-6 px-2 pb-10 pt-3">
      <PageTitle home={home} />

      <PrimaryFocus
        state={current}
        onPrimary={() => go(current.primary.path)}
        onSecondary={() => go(current.secondary.path)}
      />

      <SetupSection items={items} onNavigate={go} />

      <QuietSummary home={home} />

      {showOperations ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <InboxPanel home={home} onNavigate={go} />
          <ChannelsPanel home={home} onNavigate={go} />
        </div>
      ) : null}
    </PageCanvas>
  );
}
