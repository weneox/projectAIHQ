import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Globe2,
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
  workspace: Sparkles,
};

const STEP_ICONS = {
  channel: Link2,
  setup: Bot,
  truth: ShieldCheck,
  runtime: Sparkles,
  live: MessageSquareText,
};

function text(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function sentence(value, fallback = "") {
  const v = text(value, fallback);
  if (!v) return "";
  const first = v.split(/(?<=[.!?])\s+/)[0] || v;
  return first.length > 120 ? `${first.slice(0, 117).trim()}...` : first;
}

function includesAny(value = "", parts = []) {
  const normalized = text(value).toLowerCase();
  return parts.some((part) => normalized.includes(String(part).toLowerCase()));
}

function resolveHomeScene(home) {
  const launch = text(home.launchChannel?.statusLabel).toLowerCase();
  const setup = text(home.setupFlow?.statusLabel).toLowerCase();
  const truth = text(home.truthRuntime?.statusLabel).toLowerCase();

  if (
    !home.launchChannel?.connected ||
    includesAny(launch, ["waiting", "connect", "blocked", "unavailable", "pending"])
  ) {
    return {
      eyebrow: "Launch",
      title: "Launch pending",
      description: "Connect the first live channel before AI conversations go live.",
    };
  }

  if (includesAny(setup, ["waiting", "draft", "review", "pending", "needs"])) {
    return {
      eyebrow: "Setup",
      title: "Review the draft",
      description: "Check the imported business draft before trusting runtime behavior.",
    };
  }

  if (includesAny(truth, ["approval", "waiting", "repair", "unavailable"])) {
    return {
      eyebrow: "Truth",
      title: "Approve business truth",
      description: "Truth and runtime still need approval before the workspace is trusted.",
    };
  }

  return {
    eyebrow: "Workspace",
    title: "Workspace ready",
    description: "The launch path is aligned and ready for live operating work.",
  };
}

function buildCoverageText(home) {
  const servicesCount = Number(home?.setupFlow?.servicesCount || 0);
  const contactsCount = Number(home?.setupFlow?.contactsCount || 0);
  const hoursCount = Number(home?.setupFlow?.hoursCount || 0);

  return `${servicesCount} services · ${contactsCount} contacts · ${hoursCount} hours`;
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

function MetaRow({ label, value }) {
  return (
    <div className="min-w-0 border-l border-[rgba(15,23,42,0.08)] pl-4 first:border-l-0 first:pl-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
        {label}
      </div>
      <div className="mt-2 truncate text-[14px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.94)]">
        {value}
      </div>
    </div>
  );
}

function SupportAction({ item, onNavigate }) {
  const Icon = SUPPORT_ICONS[item.id] || Sparkles;

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.action)}
      className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.68)] transition-colors duration-200 hover:text-[rgba(15,23,42,0.96)]"
    >
      <Icon className="h-[14px] w-[14px]" strokeWidth={1.9} />
      <span>{item.title}</span>
    </button>
  );
}

function SurfaceLink({ item, active = false, onNavigate }) {
  const Icon = ENTRY_ICONS[item.id] || Sparkles;

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.action)}
      className={[
        "group flex w-full items-start gap-3 border-b border-[rgba(15,23,42,0.06)] py-4 text-left transition-colors duration-200 last:border-b-0",
        active ? "bg-[rgba(31,77,168,0.02)]" : "hover:bg-[rgba(15,23,42,0.02)]",
      ].join(" ")}
    >
      <div className="flex shrink-0 pt-0.5 text-[rgba(15,23,42,0.66)]">
        <Icon className="h-[16px] w-[16px]" strokeWidth={1.9} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-4">
          <div className="truncate text-[15px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.95)]">
            {text(item.title, "Open")}
          </div>

          <div className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
            {text(item.status, item.action?.label || "Open")}
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between gap-4">
          <div className="truncate text-[13px] text-[rgba(15,23,42,0.58)]">
            {text(item.summary, item.action?.label || "Open")}
          </div>

          <ArrowRight
            className="h-[15px] w-[15px] shrink-0 text-[rgba(15,23,42,0.24)] transition-transform duration-200 group-hover:translate-x-[2px] group-hover:text-[rgba(31,77,168,0.92)]"
            strokeWidth={2}
          />
        </div>
      </div>
    </button>
  );
}

function CheckRow({ step, onNavigate }) {
  const Icon = STEP_ICONS[step.id] || Sparkles;

  return (
    <div className="grid gap-3 border-b border-[rgba(15,23,42,0.06)] py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <div className="pt-0.5 text-[rgba(15,23,42,0.62)]">
            <Icon className="h-[15px] w-[15px]" strokeWidth={1.9} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.95)]">
              {text(step.label, "Step")}
            </div>
            <div className="mt-1 text-[13px] leading-6 text-[rgba(15,23,42,0.58)]">
              {sentence(step.summary, "Still needs attention.")}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 md:justify-end">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
          {text(step.statusLabel, "Pending")}
        </div>

        {step.action?.path ? (
          <button
            type="button"
            onClick={() => onNavigate(step.action)}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.72)] transition-colors duration-200 hover:text-[rgba(31,77,168,0.92)]"
          >
            <span>{step.action.label}</span>
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function AvailabilityRow({ note, onRetry, isFetching }) {
  if (!note) return null;

  return (
    <div className="flex flex-col gap-3 border-b border-[rgba(15,23,42,0.06)] pb-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="text-[12px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.9)]">
          {text(note.title, "Limited context")}
        </div>
        <div className="mt-1 text-[13px] leading-6 text-[rgba(15,23,42,0.58)]">
          {sentence(note.description)}
        </div>
      </div>

      <div className="shrink-0">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onRetry?.()}
          isLoading={isFetching}
        >
          Retry
        </Button>
      </div>
    </div>
  );
}

function HomeScene({
  home,
  featuredEntryPoints,
  supportItems,
  assistantOpen,
  onNavigate,
}) {
  const highlightedPath = home.currentStatus.action?.path;
  const percent = Number(home.goldenPath?.percent || 0);
  const launchLabel = text(home.launchChannel?.channelLabel, "Launch channel");
  const scene = resolveHomeScene(home);

  return (
    <section className="space-y-8">
      <AvailabilityRow
        note={home.availabilityNote}
        onRetry={home.refetch}
        isFetching={home.isFetching}
      />

      <section className="grid gap-8 border-b border-[rgba(15,23,42,0.06)] pb-8 xl:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)] xl:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
            <span className="text-brand">{scene.eyebrow}</span>
            {assistantOpen ? (
              <>
                <span className="h-1 w-1 rounded-full bg-[rgba(15,23,42,0.16)]" />
                <span>Setup assistant open</span>
              </>
            ) : null}
          </div>

          <div className="mt-3 max-w-[16ch] text-[2rem] font-semibold leading-[0.98] tracking-[-0.06em] text-[rgba(15,23,42,0.98)] md:text-[2.65rem]">
            {scene.title}
          </div>

          <div className="mt-3 max-w-[42rem] text-[15px] leading-7 text-[rgba(15,23,42,0.58)]">
            {scene.description}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {home.currentStatus?.action?.path ? (
              <Button
                size="hero"
                onClick={() => onNavigate(home.currentStatus.action)}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                {home.currentStatus.action.label}
              </Button>
            ) : null}

            {home.currentStatus?.secondaryAction?.path ? (
              <Button
                size="hero"
                variant="secondary"
                onClick={() => onNavigate(home.currentStatus.secondaryAction)}
              >
                {home.currentStatus.secondaryAction.label}
              </Button>
            ) : null}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <MetaRow
              label={launchLabel}
              value={text(home.launchChannel?.statusLabel, "—")}
            />
            <MetaRow
              label="Setup"
              value={text(home.setupFlow?.statusLabel, "—")}
            />
            <MetaRow
              label="Truth + runtime"
              value={text(home.truthRuntime?.statusLabel, "—")}
            />
          </div>
        </div>

        <div className="min-w-0 border-l-0 border-t border-[rgba(15,23,42,0.06)] pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
            Surfaces
          </div>

          <div className="mt-2">
            {featuredEntryPoints.slice(0, 3).map((item) => (
              <SurfaceLink
                key={item.id}
                item={item}
                active={highlightedPath === item.action?.path}
                onNavigate={onNavigate}
              />
            ))}
          </div>

          {supportItems.length ? (
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3">
              {supportItems.map((item) => (
                <SupportAction
                  key={item.id}
                  item={item}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:items-start">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
                Setup
              </div>
              <div className="mt-2 text-[1.55rem] font-semibold leading-[1] tracking-[-0.05em] text-[rgba(15,23,42,0.98)]">
                {text(home.setupFlow?.title, "Review the business draft")}
              </div>
              <div className="mt-3 max-w-[42rem] text-[14px] leading-6 text-[rgba(15,23,42,0.58)]">
                {sentence(
                  home.setupFlow?.summary,
                  "Use the reviewed business draft before trusting live automation."
                )}
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
                Readiness
              </div>
              <div className="mt-2 text-[28px] font-semibold tracking-[-0.05em] text-[rgba(15,23,42,0.98)]">
                {percent}%
              </div>
            </div>
          </div>

          <div className="mt-5 h-[6px] overflow-hidden rounded-full bg-[rgba(15,23,42,0.08)]">
            <div
              className="h-full rounded-full bg-[rgb(var(--color-brand))] transition-[width] duration-300 ease-premium"
              style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
            />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <MetaRow
              label="Website"
              value={text(
                home.setupFlow?.draft?.businessProfile?.websiteUrl,
                home.setupFlow?.websiteUrl || "Awaiting website"
              )}
            />
            <MetaRow
              label="Company"
              value={text(
                home.setupFlow?.draft?.businessProfile?.companyName,
                "Awaiting company"
              )}
            />
            <MetaRow
              label="Coverage"
              value={buildCoverageText(home)}
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {home.setupFlow?.action?.path ? (
              <Button
                type="button"
                size="hero"
                onClick={() => onNavigate(home.setupFlow.action)}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                {home.setupFlow.action.label}
              </Button>
            ) : null}

            {home.setupFlow?.secondaryAction?.path ? (
              <Button
                type="button"
                size="hero"
                variant="secondary"
                onClick={() => onNavigate(home.setupFlow.secondaryAction)}
              >
                {home.setupFlow.secondaryAction.label}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 border-l-0 border-t border-[rgba(15,23,42,0.06)] pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
            Checks
          </div>

          <div className="mt-2">
            {(home.goldenPath?.steps || []).map((step) => (
              <CheckRow key={step.id} step={step} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

function ProductHomeLoadingSurface() {
  return (
    <PageCanvas className="px-0 py-0">
      <LoadingSurface title="Loading home" />
    </PageCanvas>
  );
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

  const assistantOpen = searchParams.get("assistant") === "setup";

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
    <PageCanvas className="px-0 py-0">
      <HomeScene
        home={home}
        featuredEntryPoints={featuredEntryPoints}
        supportItems={supportItems}
        assistantOpen={assistantOpen}
        onNavigate={navigateFromAction}
      />
    </PageCanvas>
  );
}