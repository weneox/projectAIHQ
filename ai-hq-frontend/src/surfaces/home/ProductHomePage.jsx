import {
  ArrowRight,
  ChevronRight,
  Globe2,
  MessageSquareText,
  Link2,
  Loader2,
  Settings2,
  Sparkles,
  Waypoints,
  Waves,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Input, { Textarea } from "../../components/ui/Input.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
  Surface,
} from "../../components/ui/AppShellPrimitives.jsx";
import { saveBusinessProfile } from "../../api/setup.js";
import { clearAppBootstrapContext } from "../../lib/appSession.js";
import useProductHome from "../../view-models/useProductHome.js";

const LIVE_ICONS = {
  inbox: MessageSquareText,
  comments: Waypoints,
  voice: Waves,
};

const LIVE_POSITIONS = [
  "md:left-[10%] md:top-[14%]",
  "md:right-[12%] md:top-[20%]",
  "md:left-[22%] md:bottom-[14%]",
];

function compactText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function InlineAction({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm font-medium text-text-muted transition duration-fast hover:text-text"
    >
      <span>{label}</span>
      <ChevronRight className="h-4 w-4" />
    </button>
  );
}

function AvailabilityNotice({ note, onRetry, isFetching }) {
  if (!note) return null;

  return (
    <InlineNotice
      tone="warning"
      title={note.title || "Limited signal"}
      description={note.description}
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
    />
  );
}

function SceneNode({ item, index, onNavigate }) {
  const Icon = LIVE_ICONS[item.id] || Sparkles;

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.action)}
      className={[
        "group relative flex items-center gap-3 rounded-[22px] border border-line/80 bg-surface/90 px-4 py-3 text-left shadow-xs backdrop-blur-sm transition duration-base ease-premium hover:border-brand/30 hover:bg-surface",
        "md:absolute md:w-[220px]",
        LIVE_POSITIONS[index] || "",
      ].join(" ")}
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-muted text-text">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text">{item.title}</span>
        <span className="mt-0.5 block truncate text-xs text-text-muted">{item.status}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-text-subtle transition group-hover:text-text" />
    </button>
  );
}

function SignalScene({ items, onNavigate }) {
  const liveItems = items.slice(0, 3);

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-line bg-[radial-gradient(circle_at_top,rgba(var(--color-brand-soft),0.85),transparent_36%),linear-gradient(180deg,rgba(var(--color-surface),0.98),rgba(var(--color-surface-muted),0.98))] px-5 py-5 md:min-h-[430px] md:px-6 md:py-6">
      <div className="absolute inset-0">
        <div className="absolute left-[18%] top-[12%] h-28 w-28 rounded-full bg-brand-soft/60 blur-3xl" />
        <div className="absolute bottom-[10%] right-[10%] h-36 w-36 rounded-full bg-info-soft/70 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 hidden h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-line-soft md:block" />
        <div className="absolute left-1/2 top-1/2 hidden h-[170px] w-[170px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-line-soft/70 md:block" />
        <div className="absolute left-[28%] top-[34%] hidden h-px w-[28%] rotate-[14deg] bg-gradient-to-r from-transparent via-line-soft to-transparent md:block" />
        <div className="absolute left-[44%] top-[39%] hidden h-px w-[24%] -rotate-[18deg] bg-gradient-to-r from-transparent via-line-soft to-transparent md:block" />
        <div className="absolute left-[34%] top-[58%] hidden h-px w-[21%] -rotate-[42deg] bg-gradient-to-r from-transparent via-line-soft to-transparent md:block" />
      </div>

      <div className="relative">
        <div className="mx-auto mb-5 flex h-28 w-28 flex-col items-center justify-center rounded-full border border-line bg-surface/95 text-center shadow-xs md:absolute md:left-1/2 md:top-1/2 md:mb-0 md:h-36 md:w-36 md:-translate-x-1/2 md:-translate-y-1/2">
          <span className="mb-2 inline-flex h-3 w-3 animate-pulse rounded-full bg-brand" />
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-subtle">
            Live
          </span>
          <span className="mt-1 text-sm font-semibold text-text md:text-base">AI HQ</span>
        </div>

        <div className="grid gap-3 md:block">
          {liveItems.map((item, index) => (
            <SceneNode
              key={item.id}
              item={item}
              index={index}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroStage({ home, liveItems, onNavigate }) {
  const setupSignal = home.heroStats?.find((item) => item.id === "setup") || null;
  const memorySignal = home.heroStats?.find((item) => item.id === "memory") || null;

  return (
    <section className="relative overflow-hidden rounded-[34px] border border-line bg-[linear-gradient(180deg,rgba(var(--color-surface),0.98),rgba(var(--color-surface-muted),0.96))] px-5 py-6 md:px-7 md:py-7">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/35 to-transparent" />
      <div className="absolute left-[-4rem] top-[-5rem] h-44 w-44 rounded-full bg-brand-soft/45 blur-3xl" />
      <div className="absolute right-[-3rem] top-[2rem] h-36 w-36 rounded-full bg-info-soft/60 blur-3xl" />

      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_460px] xl:items-center">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            <span className="font-medium text-text">AI HQ</span>
            <span className="text-text-subtle">/</span>
            <span>{home.companyName || "Operator home"}</span>
          </div>

          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-pill border border-line-soft bg-surface/80 px-3 py-1.5 text-[12px] font-medium text-text-muted backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              <span>Welcome back, {home.actorName}</span>
            </div>

            <h1 className="max-w-[10ch] font-display text-[2.9rem] font-semibold leading-[0.92] tracking-[-0.06em] text-text md:text-[4.35rem]">
              Live work starts here.
            </h1>

            <p className="max-w-[34rem] text-[15px] leading-7 text-text-muted">
              Inbox, comments, and voice stay in one operator lane. Everything else supports the lane.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
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

          <div className="flex flex-wrap items-start gap-5 border-t border-line-soft pt-5">
            <div className="min-w-[180px]">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-text-subtle">
                Start here
              </div>
              <div className="mt-2 text-sm font-semibold text-text">
                {home.currentStatus.title}
              </div>
              <div className="mt-1 text-sm leading-6 text-text-muted">
                {home.currentStatus.summary}
              </div>
            </div>

            {setupSignal ? (
              <div className="min-w-[150px]">
                <div className="text-[11px] uppercase tracking-[0.16em] text-text-subtle">
                  Setup
                </div>
                <div className="mt-2 text-sm font-medium text-text">{setupSignal.status}</div>
                <div className="mt-1 text-sm text-text-muted">{setupSignal.summary}</div>
              </div>
            ) : null}

            {memorySignal ? (
              <div className="min-w-[150px]">
                <div className="text-[11px] uppercase tracking-[0.16em] text-text-subtle">
                  Truth
                </div>
                <div className="mt-2 text-sm font-medium text-text">{memorySignal.status}</div>
                <div className="mt-1 text-sm text-text-muted">{memorySignal.summary}</div>
              </div>
            ) : null}
          </div>
        </div>

        <SignalScene items={liveItems} onNavigate={onNavigate} />
      </div>
    </section>
  );
}

function LiveLane({ items, onNavigate }) {
  const liveItems = items.slice(0, 3);

  return (
    <section className="overflow-hidden rounded-[28px] border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4 md:px-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-subtle">Live lane</div>
          <div className="mt-1 text-lg font-semibold tracking-[-0.03em] text-text">
            Inbox, comments, voice
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-pill bg-surface-muted px-3 py-1.5 text-[12px] font-medium text-text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
          <span>One operating front</span>
        </div>
      </div>

      <div className="grid divide-y divide-line-soft md:grid-cols-[1.18fr_1fr_1fr] md:divide-x md:divide-y-0">
        {liveItems.map((item, index) => {
          const Icon = LIVE_ICONS[item.id] || Sparkles;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.action)}
              className={[
                "group relative min-h-[220px] px-5 py-5 text-left transition duration-base ease-premium hover:bg-surface-muted/70 md:px-6",
                index === 0
                  ? "bg-[linear-gradient(135deg,rgba(var(--color-brand-soft),0.55),transparent_52%)]"
                  : "",
              ].join(" ")}
            >
              {index === 0 ? (
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/45 to-transparent" />
              ) : null}

              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-muted text-text">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <Badge tone={index === 0 ? "info" : "neutral"} variant="subtle">
                    {item.status}
                  </Badge>
                </div>

                <div className="mt-6">
                  <div className="text-[1.35rem] font-semibold tracking-[-0.04em] text-text">
                    {item.title}
                  </div>
                  <div className="mt-3 max-w-[28ch] text-sm leading-6 text-text-muted">
                    {compactText(item.detail, item.summary)}
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  <div className="inline-flex items-center gap-1 text-sm font-medium text-text-muted transition group-hover:text-text">
                    <span>{item.action.label}</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SupportStrip({ items, onNavigate }) {
  if (!items.length) return null;

  return (
    <section className="border-t border-line-soft pt-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-subtle">Support</div>
          <div className="mt-1 text-sm text-text-muted">
            Setup, truth, workspace stay nearby.
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.action)}
              className="group inline-flex items-center gap-3 rounded-pill border border-line-soft bg-surface px-3.5 py-2.5 text-left transition duration-fast hover:border-line hover:bg-surface-muted"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-text-muted">
                {item.id === "setup" ? (
                  <Settings2 className="h-4 w-4" />
                ) : item.id === "truth" ? (
                  <Sparkles className="h-4 w-4" />
                ) : (
                  <MessageSquareText className="h-4 w-4" />
                )}
              </span>
              <span>
                <span className="block text-sm font-medium text-text">{item.title}</span>
                <span className="block text-xs text-text-muted">{item.status}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-text-subtle transition group-hover:text-text" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductHomeLoadingSurface() {
  return (
    <PageCanvas className="px-4 py-5 md:px-6 md:py-7 xl:px-0">
      <LoadingSurface
        title="Loading home"
        description="Preparing your next path."
      />
    </PageCanvas>
  );
}

function SetupAssistantCard({ home, onNavigate }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState(() =>
    searchParams.get("assistant") === "setup" ? "website" : ""
  );
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const visible = !home.setupState?.isComplete || searchParams.get("assistant") === "setup";
  if (!visible) return null;

  async function handleSave() {
    if (saving) return;

    const payload = {
      companyName: home.companyName || "",
      websiteUrl: compactText(website),
      description: compactText(description),
    };

    if (!payload.websiteUrl && !payload.description) {
      setError("Add a website or a short business description.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await saveBusinessProfile(payload);
      clearAppBootstrapContext();
      await home.refetch?.();
      setMessage("Saved to workspace foundation.");
      const next = new URLSearchParams(searchParams);
      next.delete("assistant");
      setSearchParams(next, { replace: true });
    } catch (saveError) {
      setError(
        compactText(
          saveError?.message,
          "We could not save those business details right now."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-line bg-[linear-gradient(180deg,rgba(var(--color-surface),0.98),rgba(var(--color-surface-muted),0.98))]">
      <div className="flex flex-col gap-4 border-b border-line-soft px-5 py-5 md:px-6 md:py-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[700px]">
          <div className="inline-flex items-center gap-2 rounded-pill border border-line-soft bg-surface px-3 py-1.5 text-[12px] font-medium text-text-muted">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            <span>AI setup assistant</span>
          </div>
          <div className="mt-4 text-[1.55rem] font-semibold tracking-[-0.04em] text-text">
            Want AI to gather the basics?
          </div>
          <div className="mt-2 text-sm leading-6 text-text-muted">
            Add a website, drop in one short business description, or open source connections when you want deeper setup.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={mode === "website" ? "primary" : "secondary"} size="sm" onClick={() => setMode("website")}>
            Website
          </Button>
          <Button type="button" variant={mode === "description" ? "primary" : "secondary"} size="sm" onClick={() => setMode("description")}>
            Description
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onNavigate({ path: "/channels" })}
            leftIcon={<Link2 className="h-4 w-4" />}
          >
            Connect sources
          </Button>
        </div>
      </div>

      <div className="grid gap-5 px-5 py-5 md:px-6 md:py-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-4">
          {mode === "website" ? (
            <div className="space-y-3">
              <div className="text-sm font-medium text-text">Website</div>
              <Input
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="yourbusiness.com"
                leftIcon={<Globe2 className="h-4 w-4" />}
                appearance="product"
              />
            </div>
          ) : null}

          {mode === "description" ? (
            <div className="space-y-3">
              <div className="text-sm font-medium text-text">Business description</div>
              <Textarea
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Premium dental clinic in Baku focused on implants, whitening, and family care."
                appearance="product"
              />
            </div>
          ) : null}

          {!mode ? (
            <div className="rounded-[22px] border border-dashed border-line px-4 py-4 text-sm leading-6 text-text-muted">
              Choose one path and keep it short. Setup stays optional and lightweight.
            </div>
          ) : null}

          {message ? (
            <InlineNotice tone="success" title="Saved" description={message} compact />
          ) : null}

          {error ? (
            <InlineNotice tone="danger" title="Unable to save" description={error} compact />
          ) : null}
        </div>

        <div className="flex flex-col justify-between gap-4">
          <Surface subdued padded="sm" className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.16em] text-text-subtle">Current posture</div>
            <div className="text-sm font-medium text-text">{home.setupState?.status === "completed" ? "Complete" : "Optional setup available"}</div>
            <div className="text-sm leading-6 text-text-muted">
              {home.setupState?.summary || "The workspace can run now. Add business context only when useful."}
            </div>
          </Surface>

          <Button
            type="button"
            size="hero"
            disabled={saving || (!compactText(website) && !compactText(description))}
            onClick={handleSave}
            rightIcon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          >
            {saving ? "Saving..." : "Save basics"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function buildSupportItems(home, secondaryEntryPoints) {
  const setupSignal = home.heroStats?.find((item) => item.id === "setup");
  const truthSignal = home.heroStats?.find((item) => item.id === "memory");
  const workspaceSignal =
    secondaryEntryPoints.find((item) => item.id === "workspace") ||
    home.entryPoints?.find((item) => item.id === "workspace");

  return [
    setupSignal
      ? {
          id: "setup",
          title: "Setup",
          status: setupSignal.status,
          action: setupSignal.action,
        }
      : { id: "setup", title: "Setup", status: "Support", action: { label: "Open setup assistant", path: "/home?assistant=setup" } },
    truthSignal
      ? {
          id: "truth",
          title: "Truth",
          status: truthSignal.status,
          action: truthSignal.action,
        }
      : { id: "truth", title: "Truth", status: "Support", action: { label: "Open truth", path: "/truth" } },
    workspaceSignal
      ? {
          id: "workspace",
          title: "Workspace",
          status: workspaceSignal.status,
          action: workspaceSignal.action,
        }
      : {
          id: "workspace",
          title: "Workspace",
          status: "Support",
          action: { label: "Open workspace", path: "/workspace" },
        },
  ].filter((item) => item.action?.path);
}

export default function ProductHomePage() {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
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

  function navigateFromAction(action = null) {
    if (!action?.path) return;
    navigate(action.path);
  }

  if (home.loading) {
    return <ProductHomeLoadingSurface />;
  }

  return (
    <PageCanvas className="space-y-5 px-4 py-5 md:px-6 md:py-7 xl:px-0">
      <AvailabilityNotice
        note={home.availabilityNote}
        onRetry={home.refetch}
        isFetching={home.isFetching}
      />

      <HeroStage
        home={home}
        liveItems={featuredEntryPoints}
        onNavigate={navigateFromAction}
      />

      <SetupAssistantCard
        home={home}
        onNavigate={(action) => {
          if (!action?.path) return;
          if (action.path === "/home?assistant=setup") {
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set("assistant", "setup");
              return next;
            });
            return;
          }
          navigateFromAction(action);
        }}
      />

      <LiveLane items={featuredEntryPoints} onNavigate={navigateFromAction} />

      <SupportStrip items={supportItems} onNavigate={navigateFromAction} />
    </PageCanvas>
  );
}
