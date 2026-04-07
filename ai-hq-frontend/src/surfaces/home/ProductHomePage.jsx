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
};

function compactText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function compactSentence(value, fallback = "") {
  const text = compactText(value, fallback);
  if (!text) return "";

  const firstSentence = text.split(/(?<=[.!?])\s+/)[0] || text;
  return firstSentence.length > 140
    ? `${firstSentence.slice(0, 137).trim()}...`
    : firstSentence;
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

function SceneNotice({ note, onRetry, isFetching }) {
  if (!note) return null;

  return (
    <div className="border-b border-[rgba(15,23,42,0.07)] px-5 py-4 md:px-7">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.92)]">
            {compactText(note.title, "Limited live context")}
          </div>
          <div className="mt-1 text-[13px] leading-6 text-[rgba(15,23,42,0.56)]">
            {compactSentence(note.description)}
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
    </div>
  );
}

function SceneStat({ label, value }) {
  return (
    <div className="min-w-0 border-l border-[rgba(15,23,42,0.08)] pl-4 first:border-l-0 first:pl-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(15,23,42,0.34)]">
        {label}
      </div>
      <div className="mt-2 truncate text-[14px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.94)]">
        {value}
      </div>
    </div>
  );
}

function LaneRow({ item, active = false, onNavigate }) {
  const Icon = ENTRY_ICONS[item.id] || Sparkles;

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.action)}
      className={[
        "group flex w-full items-center gap-4 border-b border-[rgba(15,23,42,0.06)] px-0 py-4 text-left transition-colors duration-200 last:border-b-0",
        active
          ? "bg-[linear-gradient(90deg,rgba(242,246,255,0.92)_0%,rgba(242,246,255,0)_100%)]"
          : "hover:bg-[linear-gradient(90deg,rgba(15,23,42,0.025)_0%,rgba(15,23,42,0)_100%)]",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-10 w-10 shrink-0 items-center justify-center border text-[rgba(15,23,42,0.72)]",
          active
            ? "border-[rgba(38,76,165,0.14)] bg-[rgba(242,246,255,0.96)] text-[rgba(38,76,165,0.96)]"
            : "border-[rgba(15,23,42,0.08)] bg-white/[0.82]",
        ].join(" ")}
        style={{ borderRadius: 12 }}
      >
        <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-4">
          <div className="truncate text-[16px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.95)]">
            {compactText(item.title, "Open")}
          </div>

          <div
            className={[
              "shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em]",
              active
                ? "text-[rgba(38,76,165,0.9)]"
                : "text-[rgba(15,23,42,0.38)]",
            ].join(" ")}
          >
            {compactText(item.status, item.action?.label || "Open")}
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between gap-4">
          <div className="truncate text-[13px] text-[rgba(15,23,42,0.54)]">
            {compactText(item.action?.label, "Open surface")}
          </div>

          <ArrowRight
            className="h-[15px] w-[15px] shrink-0 text-[rgba(15,23,42,0.26)] transition-transform duration-200 group-hover:translate-x-[2px] group-hover:text-[rgba(38,76,165,0.95)]"
            strokeWidth={2}
          />
        </div>
      </div>
    </button>
  );
}

function SupportLink({ item, onNavigate }) {
  const Icon = SUPPORT_ICONS[item.id] || Sparkles;

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.action)}
      className="group inline-flex items-center gap-2 border border-[rgba(15,23,42,0.08)] bg-white/[0.76] px-3 py-2 text-[13px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.72)] transition-colors duration-200 hover:border-[rgba(15,23,42,0.12)] hover:bg-white hover:text-[rgba(15,23,42,0.94)]"
      style={{ borderRadius: 12 }}
    >
      <Icon className="h-[14px] w-[14px]" strokeWidth={1.9} />
      <span>{item.title}</span>
    </button>
  );
}

function SetupFact({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0 border-l border-[rgba(15,23,42,0.08)] pl-4 first:border-l-0 first:pl-0">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
        <Icon className="h-[13px] w-[13px] text-brand" strokeWidth={1.9} />
        <span>{label}</span>
      </div>

      <div className="mt-2 truncate text-[14px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.94)]">
        {value}
      </div>
    </div>
  );
}

function UnifiedHomeScene({
  home,
  featuredEntryPoints,
  supportItems,
  assistantOpen,
  onNavigate,
}) {
  const profile = home.setupFlow?.draft?.businessProfile || {};
  const highlightedPath = home.currentStatus.action?.path;

  return (
    <section
      className="relative overflow-hidden border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(253,254,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] shadow-[0_24px_54px_-42px_rgba(15,23,42,0.16)]"
      style={{ borderRadius: 22 }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_circle_at_12%_0%,rgba(38,76,165,0.06),transparent_52%)]" />

      <SceneNotice
        note={home.availabilityNote}
        onRetry={home.refetch}
        isFetching={home.isFetching}
      />

      <div className="relative px-5 py-5 md:px-7 md:py-7">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(15,23,42,0.34)]">
              <span className="text-brand">AI HQ</span>
              <span className="h-1 w-1 rounded-full bg-[rgba(15,23,42,0.16)]" />
              <span>{compactText(home.companyName, "Workspace")}</span>
            </div>

            <h1 className="mt-5 max-w-[11ch] text-[3.05rem] font-semibold leading-[0.9] tracking-[-0.075em] text-[rgba(15,23,42,0.98)] md:text-[4.5rem]">
              Operate live from one surface.
            </h1>

            <div className="mt-4 max-w-[42rem] text-[15px] font-medium leading-7 text-[rgba(15,23,42,0.6)]">
              {compactSentence(
                home.currentStatus?.title,
                "Pick the next channel, continue setup, or open the live queue."
              )}
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
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
              {(home.heroStats || []).slice(0, 3).map((item) => (
                <SceneStat
                  key={item.id || item.label}
                  label={compactText(item.label, "Status")}
                  value={compactText(item.status, item.summary || "—")}
                />
              ))}
            </div>
          </div>

          <div className="min-w-0 xl:pl-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(15,23,42,0.34)]">
              Core lanes
            </div>

            <div className="mt-3 border-y border-[rgba(15,23,42,0.07)]">
              {featuredEntryPoints.slice(0, 3).map((item) => (
                <LaneRow
                  key={item.id}
                  item={item}
                  active={highlightedPath === item.action?.path}
                  onNavigate={onNavigate}
                />
              ))}
            </div>

            {supportItems.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {supportItems.map((item) => (
                  <SupportLink
                    key={item.id}
                    item={item}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-8 border-t border-[rgba(15,23,42,0.07)] pt-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(15,23,42,0.34)]">
                <Sparkles className="h-[13px] w-[13px] text-brand" strokeWidth={1.9} />
                <span>{assistantOpen ? "Assistant active" : "Setup"}</span>
              </div>

              <div className="mt-3 text-[26px] font-semibold tracking-[-0.055em] text-[rgba(15,23,42,0.96)]">
                {compactText(
                  home.setupFlow?.title,
                  "Complete your operating draft"
                )}
              </div>

              <div className="mt-2 max-w-[48rem] text-[14px] leading-6 text-[rgba(15,23,42,0.58)]">
                {compactSentence(
                  home.setupFlow?.summary,
                  "Connect sources and finish the operating draft before launch."
                )}
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <SetupFact
                  icon={Globe2}
                  label="Website"
                  value={compactText(
                    profile.websiteUrl,
                    home.setupFlow?.websiteUrl || "Awaiting website"
                  )}
                />
                <SetupFact
                  icon={Bot}
                  label="Company"
                  value={compactText(profile.companyName, "Awaiting company")}
                />
                <SetupFact
                  icon={CheckCircle2}
                  label="Coverage"
                  value={buildCoverageText(home)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 xl:justify-end">
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
    <PageCanvas className="px-4 py-4 md:px-5 md:py-5 xl:px-0">
      <UnifiedHomeScene
        home={home}
        featuredEntryPoints={featuredEntryPoints}
        supportItems={supportItems}
        assistantOpen={assistantOpen}
        onNavigate={navigateFromAction}
      />
    </PageCanvas>
  );
}
