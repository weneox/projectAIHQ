import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Globe2,
  LayoutGrid,
  Link2,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Waypoints,
  Waves,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../../components/ui/AppShellPrimitives.jsx";
import useProductHome from "../../view-models/useProductHome.js";

const ENTRY_ICONS = {
  inbox: MessageSquareText,
  comments: Waypoints,
  voice: Waves,
};

const SUPPORT_ICONS = {
  channels: Link2,
  truth: ShieldCheck,
  workspace: LayoutGrid,
};

function compactText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function resolveToneMeta(value = "") {
  const text = String(value || "").toLowerCase();

  if (
    text.includes("attention") ||
    text.includes("pending") ||
    text.includes("review") ||
    text.includes("blocked") ||
    text.includes("waiting")
  ) {
    return {
      text: "text-[rgba(154,89,30,0.92)]",
      surface:
        "border-[rgba(var(--color-warning),0.14)] bg-[rgba(var(--color-warning),0.04)]",
      icon:
        "border-[rgba(var(--color-warning),0.14)] bg-[rgba(var(--color-warning),0.05)] text-warning",
    };
  }

  if (
    text.includes("ready") ||
    text.includes("active") ||
    text.includes("stable") ||
    text.includes("connected")
  ) {
    return {
      text: "text-[rgba(38,76,165,0.95)]",
      surface:
        "border-[rgba(var(--color-brand),0.14)] bg-[rgba(var(--color-brand),0.04)]",
      icon:
        "border-[rgba(var(--color-brand),0.14)] bg-[rgba(var(--color-brand),0.05)] text-brand",
    };
  }

  if (text.includes("unavailable") || text.includes("error")) {
    return {
      text: "text-[rgba(170,43,52,0.92)]",
      surface:
        "border-[rgba(var(--color-danger),0.14)] bg-[rgba(var(--color-danger),0.04)]",
      icon:
        "border-[rgba(var(--color-danger),0.14)] bg-[rgba(var(--color-danger),0.05)] text-danger",
    };
  }

  return {
    text: "text-[rgba(15,23,42,0.56)]",
    surface: "border-line-soft bg-surface",
    icon: "border-line-soft bg-surface-subtle text-text",
  };
}

function AvailabilityNotice({ note, onRetry, isFetching }) {
  if (!note) return null;

  return (
    <InlineNotice
      tone="warning"
      title={compactText(note.title, "Limited live context")}
      description={compactText(note.description)}
      action={
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onRetry?.()}
          isLoading={isFetching}
        >
          Retry
        </Button>
      }
      compact
    />
  );
}

function HeroStat({ item, onNavigate }) {
  return (
    <button
      type="button"
      onClick={() => item?.action && onNavigate(item.action)}
      className="group flex min-h-[94px] flex-col justify-between rounded-[16px] border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,251,253,0.995)_100%)] px-4 py-3.5 text-left transition duration-200 hover:border-[rgba(15,23,42,0.1)] hover:shadow-[0_18px_34px_-28px_rgba(15,23,42,0.18)]"
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgba(15,23,42,0.42)]">
        {item.label}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="truncate text-[15px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.94)]">
          {compactText(item.status, item.summary)}
        </div>

        {item?.action?.path ? (
          <ArrowRight
            className="h-[15px] w-[15px] shrink-0 text-[rgba(15,23,42,0.3)] transition duration-200 group-hover:translate-x-[2px] group-hover:text-[rgba(38,76,165,0.95)]"
            strokeWidth={2}
          />
        ) : null}
      </div>
    </button>
  );
}

function SignalLedger({ items, onNavigate }) {
  if (!items?.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.slice(0, 3).map((item) => (
        <HeroStat key={item.id} item={item} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function EntryCard({ item, highlighted = false, onNavigate }) {
  const Icon = ENTRY_ICONS[item.id] || Sparkles;
  const tone = resolveToneMeta(item.status);

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.action)}
      className={[
        "group flex min-h-[176px] flex-col justify-between rounded-[18px] border px-4 py-4 text-left transition duration-200",
        "bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,251,253,0.995)_100%)]",
        highlighted
          ? "border-[rgba(var(--color-brand),0.16)] shadow-[0_18px_36px_-30px_rgba(38,76,165,0.22)]"
          : "border-[rgba(15,23,42,0.07)] hover:border-[rgba(15,23,42,0.1)] hover:shadow-[0_18px_36px_-30px_rgba(15,23,42,0.16)]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={[
            "flex h-10 w-10 items-center justify-center rounded-[12px] border",
            highlighted ? tone.icon : "border-line-soft bg-surface-subtle text-text",
          ].join(" ")}
        >
          <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
        </div>

        <div
          className={[
            "text-right text-[10px] font-semibold uppercase tracking-[0.12em]",
            tone.text,
          ].join(" ")}
        >
          {item.status}
        </div>
      </div>

      <div className="pt-6">
        <div className="text-[20px] font-semibold tracking-[-0.045em] text-[rgba(15,23,42,0.95)]">
          {item.title}
        </div>
      </div>

      <div className="flex items-center justify-between pt-6">
        <div className="text-[12px] font-semibold tracking-[-0.01em] text-[rgba(15,23,42,0.56)]">
          {item.action?.label || "Open"}
        </div>

        <ArrowRight
          className="h-[16px] w-[16px] text-[rgba(15,23,42,0.3)] transition duration-200 group-hover:translate-x-[2px] group-hover:text-[rgba(38,76,165,0.95)]"
          strokeWidth={2}
        />
      </div>
    </button>
  );
}

function SupportRail({ items, onNavigate }) {
  if (!items?.length) return null;

  return (
    <div className="rounded-[18px] border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,251,253,0.995)_100%)]">
      <div className="border-b border-[rgba(15,23,42,0.06)] px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(15,23,42,0.42)]">
          Support
        </div>
      </div>

      <div className="p-2">
        {items.map((item, index) => {
          const Icon = SUPPORT_ICONS[item.id] || Sparkles;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.action)}
              className={[
                "group flex h-12 w-full items-center gap-3 rounded-[14px] px-3 text-left transition duration-200 hover:bg-[rgba(15,23,42,0.045)]",
                index > 0 ? "mt-1" : "",
              ].join(" ")}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-line-soft bg-surface-subtle text-text">
                <Icon className="h-[14px] w-[14px]" strokeWidth={1.9} />
              </div>

              <div className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.92)]">
                {item.title}
              </div>

              <ArrowRight
                className="h-[15px] w-[15px] shrink-0 text-[rgba(15,23,42,0.28)] transition duration-200 group-hover:translate-x-[2px] group-hover:text-[rgba(38,76,165,0.95)]"
                strokeWidth={2}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HeroSection({ home, items, supportItems, onNavigate }) {
  const highlightedPath = home.currentStatus.action?.path;

  return (
    <section className="overflow-hidden rounded-[24px] border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,253,0.998)_100%)] shadow-[0_26px_60px_-44px_rgba(15,23,42,0.18)]">
      <div className="grid xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="relative overflow-hidden border-b border-[rgba(15,23,42,0.06)] px-5 py-5 md:px-7 md:py-7 xl:border-b-0 xl:border-r">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_circle_at_10%_0%,rgba(38,76,165,0.07),transparent_55%)]" />

          <div className="relative">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(15,23,42,0.42)]">
              <span className="text-brand">AI HQ</span>
              <span className="h-1 w-1 rounded-full bg-[rgba(15,23,42,0.16)]" />
              <span>{home.companyName || "Home"}</span>
            </div>

            <div className="mt-6">
              <h1 className="max-w-[9ch] font-display text-[2.85rem] font-semibold leading-[0.9] tracking-[-0.072em] text-[rgba(15,23,42,0.98)] md:text-[4rem]">
                Live work starts here.
              </h1>

              <div className="mt-4 max-w-[34rem] text-[15px] font-medium leading-7 text-[rgba(15,23,42,0.64)]">
                {compactText(home.currentStatus.title, "Choose the next live surface.")}
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              {home.currentStatus.action?.path ? (
                <Button
                  size="hero"
                  onClick={() => onNavigate(home.currentStatus.action)}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  {home.currentStatus.action.label}
                </Button>
              ) : null}

              {home.currentStatus.secondaryAction?.path ? (
                <Button
                  size="hero"
                  variant="secondary"
                  onClick={() => onNavigate(home.currentStatus.secondaryAction)}
                >
                  {home.currentStatus.secondaryAction.label}
                </Button>
              ) : null}
            </div>

            <div className="mt-7">
              <SignalLedger items={home.heroStats} onNavigate={onNavigate} />
            </div>
          </div>
        </div>

        <div className="px-5 py-5 md:px-7 md:py-7">
          <div className="mb-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(15,23,42,0.42)]">
              Work lanes
            </div>
            <div className="mt-1 text-[15px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.92)]">
              Core surfaces
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((item) => (
              <EntryCard
                key={item.id}
                item={item}
                highlighted={highlightedPath === item.action?.path}
                onNavigate={onNavigate}
              />
            ))}

            <SupportRail items={supportItems} onNavigate={onNavigate} />
          </div>
        </div>
      </div>
    </section>
  );
}

function SnapshotTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-[16px] border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,251,253,0.995)_100%)] px-4 py-3.5">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgba(15,23,42,0.42)]">
        <Icon className="h-[14px] w-[14px] text-brand" strokeWidth={1.9} />
        <span>{label}</span>
      </div>

      <div className="mt-3 truncate text-[14px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.94)]">
        {value}
      </div>
    </div>
  );
}

function SetupSection({ home, assistantOpen, onNavigate }) {
  const draft = home.onboardingState?.draft || {};
  const profile = draft.businessProfile || {};
  const servicesCount = home.onboardingState?.servicesCount || 0;
  const contactsCount = home.onboardingState?.contactsCount || 0;
  const hoursCount = home.onboardingState?.hoursCount || 0;

  return (
    <section className="overflow-hidden rounded-[24px] border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,253,0.998)_100%)] shadow-[0_24px_54px_-42px_rgba(15,23,42,0.16)]">
      <div className="grid gap-4 px-5 py-5 md:px-7 md:py-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] xl:items-center">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(15,23,42,0.42)]">
            <Sparkles className="h-[14px] w-[14px] text-brand" strokeWidth={1.9} />
            <span>{assistantOpen ? "Assistant open" : "Setup snapshot"}</span>
          </div>

          <div className="mt-3 text-[28px] font-semibold tracking-[-0.055em] text-[rgba(15,23,42,0.96)]">
            {compactText(home.onboardingState?.title, "Setup in progress")}
          </div>

          <div className="mt-2 max-w-[44rem] text-[14px] font-medium leading-6 text-[rgba(15,23,42,0.62)]">
            {compactText(home.onboardingState?.summary, "Connect sources and continue the draft.")}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {home.onboardingState?.action?.path ? (
              <Button
                type="button"
                size="hero"
                onClick={() => onNavigate(home.onboardingState.action)}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                {home.onboardingState.action.label}
              </Button>
            ) : null}

            {home.onboardingState?.secondaryAction?.path ? (
              <Button
                type="button"
                size="hero"
                variant="secondary"
                onClick={() => onNavigate(home.onboardingState.secondaryAction)}
              >
                {home.onboardingState.secondaryAction.label}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <SnapshotTile
            label="Website"
            value={compactText(
              profile.websiteUrl,
              home.onboardingState?.websiteUrl || "Awaiting website"
            )}
            icon={Globe2}
          />

          <SnapshotTile
            label="Company"
            value={compactText(profile.companyName, "Awaiting company")}
            icon={Bot}
          />

          <SnapshotTile
            label="Coverage"
            value={`${servicesCount} services · ${contactsCount} contacts · ${hoursCount} hours`}
            icon={CheckCircle2}
          />
        </div>
      </div>
    </section>
  );
}

function ProductHomeLoadingSurface() {
  return (
    <PageCanvas className="px-4 py-4 md:px-5 md:py-5 xl:px-0">
      <LoadingSurface title="Loading home" />
    </PageCanvas>
  );
}

function buildSupportItems(home, secondaryEntryPoints) {
  const channels = home.entryPoints?.find((item) => item.id === "channels");
  const truth = home.entryPoints?.find((item) => item.id === "truth");
  const workspace =
    secondaryEntryPoints.find((item) => item.id === "workspace") ||
    home.entryPoints?.find((item) => item.id === "workspace");

  return [channels, truth, workspace]
    .filter((item) => item?.action?.path)
    .map((item) => ({
      id: item.id,
      title: item.title,
      action: item.action,
    }));
}

export default function ProductHomePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const home = useProductHome();

  const featuredEntryPoints = useMemo(
    () => home.entryPointGroups?.featured || home.entryPoints?.slice(0, 3) || [],
    [home.entryPointGroups, home.entryPoints]
  );

  const secondaryEntryPoints = useMemo(
    () => home.entryPointGroups?.secondary || home.entryPoints?.slice(3) || [],
    [home.entryPointGroups, home.entryPoints]
  );

  const supportItems = useMemo(
    () => buildSupportItems(home, secondaryEntryPoints),
    [home, secondaryEntryPoints]
  );

  const assistantOpen = ["setup", "onboarding"].includes(
    searchParams.get("assistant")
  );

  function navigateFromAction(action = null) {
    if (!action?.path) return;

    if (action.path === "/home?assistant=setup") {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("assistant", "setup");
        return next;
      });
      return;
    }

    navigate(action.path);
  }

  if (home.loading) {
    return <ProductHomeLoadingSurface />;
  }

  return (
    <PageCanvas className="space-y-4 px-4 py-4 md:px-5 md:py-5 xl:px-0">
      <AvailabilityNotice
        note={home.availabilityNote}
        onRetry={home.refetch}
        isFetching={home.isFetching}
      />

      <HeroSection
        home={home}
        items={featuredEntryPoints.slice(0, 3)}
        supportItems={supportItems}
        onNavigate={navigateFromAction}
      />

      <SetupSection
        home={home}
        assistantOpen={assistantOpen}
        onNavigate={navigateFromAction}
      />
    </PageCanvas>
  );
}