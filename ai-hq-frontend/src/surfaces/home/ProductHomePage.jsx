import {
  ArrowRight,
  BookMarked,
  Cable,
  ChevronRight,
  MessageSquareText,
  Settings2,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import {
  LoadingSurface,
  PageCanvas,
  Surface,
} from "../../components/ui/AppShellPrimitives.jsx";
import useProductHome from "../../view-models/useProductHome.js";

function InlineAction({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm font-medium text-text hover:text-brand"
    >
      <span>{label}</span>
      <ChevronRight className="h-4 w-4" />
    </button>
  );
}

function AvailabilityNotice({ note, onRetry, isFetching }) {
  if (!note) return null;

  return (
    <Surface subdued padded="sm" className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge tone="warn" variant="subtle">
              Limited signal
            </Badge>
            <div className="text-sm font-medium text-text">{note.title}</div>
          </div>
          <div className="max-w-[840px] text-sm leading-5 text-text-muted">
            {note.description}
          </div>
        </div>

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
    </Surface>
  );
}

function Hero({ home, onNavigate }) {
  const spotlight = home.supportingStatus.filter(
    (item) => item.action?.path !== home.currentStatus.action?.path
  );
  const supportingSignal = spotlight[0] || null;

  return (
    <section className="rounded-[20px] border border-line bg-surface px-5 py-5 md:px-6 md:py-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.85fr)]">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-surface-muted px-3 py-1.5 text-sm font-medium text-text-muted">
            <Sparkles className="h-4 w-4 text-brand" />
            <span>Product home · {home.companyName}</span>
          </div>

          <div className="space-y-3">
            <h1 className="max-w-[760px] font-display text-[2.85rem] font-semibold leading-[0.93] tracking-[-0.055em] text-text md:text-[3.6rem]">
              Run social inbox, auto-comment, and voice receptionist from one operator product.
            </h1>
            <p className="max-w-[720px] text-[16px] leading-7 text-text-muted">
              The current launch slice is intentionally narrower than the repo. Start from inbox, comments, or voice, then move into setup and internal control surfaces only when the work actually needs them.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="hero"
              onClick={() => onNavigate(home.currentStatus.action)}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              {home.currentStatus.action?.label || "Open workspace"}
            </Button>
            <Button
              size="hero"
              variant="secondary"
              onClick={() => onNavigate(home.currentStatus.secondaryAction)}
            >
              {home.currentStatus.secondaryAction?.label || "Open workspace"}
            </Button>
          </div>

          <div className="grid gap-4 border-t border-line-soft pt-4 md:grid-cols-3">
            {home.heroStats.map((item) => (
              <div key={item.id} className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium text-text">{item.label}</div>
                  <Badge tone="neutral" variant="subtle">
                    {item.status}
                  </Badge>
                </div>
                <div className="text-sm leading-5 text-text-muted">{item.summary}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col rounded-[16px] border border-line-soft bg-surface-muted px-4 py-4">
          <div className="space-y-1.5 pb-4">
            <div className="text-sm font-medium text-text-muted">Current state</div>
            <div className="text-[1.45rem] font-semibold tracking-[-0.03em] text-text">
              {home.currentStatus.title}
            </div>
            <div className="text-sm leading-6 text-text-muted">
              {home.currentStatus.summary}
            </div>
          </div>

          <div className="border-t border-line-soft pt-4">
            <div className="flex flex-wrap gap-2.5">
              {home.currentStatus.action?.path ? (
                <Button
                  size="sm"
                  onClick={() => onNavigate(home.currentStatus.action)}
                >
                  {home.currentStatus.action.label}
                </Button>
              ) : null}
              {home.currentStatus.secondaryAction?.path ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onNavigate(home.currentStatus.secondaryAction)}
                >
                  {home.currentStatus.secondaryAction.label}
                </Button>
              ) : null}
            </div>
          </div>

          {supportingSignal ? (
            <div className="border-t border-line-soft pt-4">
              <div className="text-sm font-medium text-text-muted">Supporting signal</div>
              <div className="mt-2 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium text-text">{supportingSignal.label}</div>
                  <Badge tone="neutral" variant="subtle">
                    {supportingSignal.status}
                  </Badge>
                </div>
                <div className="text-sm leading-5 text-text-muted">{supportingSignal.summary}</div>
                {supportingSignal.action?.path ? (
                  <InlineAction
                    label={supportingSignal.action.label}
                    onClick={() => onNavigate(supportingSignal.action)}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function OperatingModel({ onNavigate }) {
  const steps = [
    {
      id: "inbox",
      title: "Run the active queue first",
      description: "Start with the real work surface: inbox for messaging, comments for moderation, and voice for live receptionist sessions.",
      action: { label: "Open inbox", path: "/inbox" },
      icon: MessageSquareText,
    },
    {
      id: "comments",
      title: "Keep comment moderation moving",
      description: "Use the comment queue as a first-class operator surface instead of burying it under generic workspace navigation.",
      action: { label: "Open comments", path: "/comments" },
      icon: Waypoints,
    },
    {
      id: "voice",
      title: "Stay ready for live calls",
      description: "Move into voice when the receptionist loop needs operator awareness, handoff, or direct intervention.",
      action: { label: "Open voice", path: "/voice" },
      icon: Cable,
    },
    {
      id: "sources",
      title: "Use setup as support",
      description: "Bring business context, source material, and setup inputs in behind the launch loops instead of presenting setup as the product itself.",
      action: { label: "Open setup", path: "/setup" },
      icon: Settings2,
    },
    {
      id: "memory",
      title: "Approve business memory",
      description: "Review and confirm the business facts that support inbox, comments, and voice behavior.",
      action: { label: "Review business changes", path: "/truth" },
      icon: BookMarked,
    },
    {
      id: "operators",
      title: "Keep support surfaces in their place",
      description: "Workspace, launch scope, truth, and settings stay available for control and review, but they are no longer the first thing the product asks operators to open.",
      action: { label: "Open workspace", path: "/workspace" },
      icon: Cable,
    },
  ];

  return (
    <section className="space-y-4">
      <div className="max-w-[760px]">
        <div className="mb-1.5 text-sm font-medium text-text-muted">Operating model</div>
        <h2 className="font-display text-[1.95rem] font-semibold tracking-[-0.03em] text-text">
          One focused launch product with internal support behind it.
        </h2>
        <p className="mt-2 text-[15px] leading-7 text-text-muted">
            The product is tighter than the codebase. The operating path should begin with inbox, comments, and voice, while setup, memory, and review stay as supporting infrastructure.
        </p>
      </div>

      <div className="rounded-[18px] border border-line-soft bg-surface-muted px-4 py-4 md:px-5">
        <div className="space-y-0">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={index === 0 ? "" : "border-t border-line-soft pt-4"}
              >
                <div className="grid gap-3 md:grid-cols-[56px_minmax(0,1fr)_auto] md:items-start">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md border border-line bg-surface text-text">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-1.5 pb-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-sm font-medium text-text-muted">0{index + 1}</div>
                      <div className="text-[1.05rem] font-semibold text-text">{step.title}</div>
                    </div>
                    <div className="max-w-[760px] text-sm leading-6 text-text-muted">
                      {step.description}
                    </div>
                  </div>
                  <div className="pb-4">
                    <InlineAction
                      label={step.action.label}
                      onClick={() => onNavigate(step.action)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CoreSurfaces({ featured, secondary, onNavigate }) {
  return (
    <section className="space-y-4">
      <div className="max-w-[760px]">
        <div className="mb-1.5 text-sm font-medium text-text-muted">Entry paths</div>
        <h2 className="font-display text-[1.95rem] font-semibold tracking-[-0.03em] text-text">
          Enter the surface that matches the next real piece of work.
        </h2>
        <p className="mt-2 text-[15px] leading-7 text-text-muted">
          The real launch loops stay primary. Internal and future-facing surfaces stay available without becoming the headline.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="space-y-3">
          {featured.map((item) => (
            <Surface key={item.id} padded="md" className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[1.05rem] font-semibold text-text">{item.title}</div>
                    <Badge tone="neutral" variant="subtle">
                      {item.status}
                    </Badge>
                  </div>
                  <div className="text-sm leading-5 text-text">{item.summary}</div>
                  <div className="max-w-[760px] text-sm leading-6 text-text-muted">
                    {item.detail}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onNavigate(item.action)}
                >
                  {item.action.label}
                </Button>
              </div>
            </Surface>
          ))}
        </div>

        <div className="rounded-[18px] border border-line-soft bg-surface-muted px-4 py-4">
          <div className="space-y-1.5">
            <div className="text-sm font-medium text-text-muted">Additional paths</div>
            <div className="text-[1.2rem] font-semibold tracking-[-0.03em] text-text">
              Keep internal surfaces close without turning them into fake product breadth.
            </div>
          </div>

          <div className="mt-4 space-y-0">
            {secondary.map((item, index) => (
              <div
                key={item.id}
                className={index === 0 ? "py-0" : "border-t border-line-soft pt-4"}
              >
                <div className="space-y-1.5 pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium text-text">{item.title}</div>
                    <Badge tone="neutral" variant="subtle">
                      {item.status}
                    </Badge>
                  </div>
                  <div className="text-sm leading-5 text-text-muted">{item.detail}</div>
                  <InlineAction
                    label={item.action.label}
                    onClick={() => onNavigate(item.action)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyItMatters({ items }) {
  return (
    <section className="space-y-4">
      <div className="max-w-[760px]">
        <div className="mb-1.5 text-sm font-medium text-text-muted">Why it matters</div>
        <h2 className="font-display text-[1.95rem] font-semibold tracking-[-0.03em] text-text">
          The product gets stronger when the launch slice is credible, not when the copy gets broader.
        </h2>
      </div>

      <div className="grid gap-x-8 gap-y-0 md:grid-cols-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={index < 2 ? "border-t border-line-soft pt-4" : "border-t border-line-soft pt-4"}
          >
            <div className="pb-4">
              <div className="text-[1.02rem] font-semibold text-text">{item.title}</div>
              <div className="mt-1.5 max-w-[34rem] text-sm leading-6 text-text-muted">
                {item.summary}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalPathways({ actions, onNavigate }) {
  return (
    <section className="rounded-[18px] border border-line-soft bg-surface-muted px-4 py-4 md:px-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-[720px]">
          <div className="text-sm font-medium text-text-muted">Next path</div>
          <div className="mt-1 text-[1.2rem] font-semibold tracking-[-0.03em] text-text">
            Pick the surface where the next real decision is waiting.
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {actions.map((action, index) => (
            <Button
              key={action.path}
              variant={index === 0 ? "primary" : "secondary"}
              onClick={() => onNavigate(action)}
            >
              {action.label}
            </Button>
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
        title="Loading product home"
        description="Preparing your business overview and next actions."
      />
    </PageCanvas>
  );
}

export default function ProductHomePage() {
  const navigate = useNavigate();
  const home = useProductHome();

  const featuredEntryPoints = useMemo(
    () => home.entryPointGroups?.featured || home.entryPoints?.slice(0, 3) || [],
    [home.entryPointGroups, home.entryPoints]
  );
  const secondaryEntryPoints = useMemo(
    () => home.entryPointGroups?.secondary || home.entryPoints?.slice(3) || [],
    [home.entryPointGroups, home.entryPoints]
  );

  function navigateFromAction(action = null) {
    if (!action?.path) return;
    navigate(action.path);
  }

  if (home.loading) {
    return <ProductHomeLoadingSurface />;
  }

  return (
    <PageCanvas className="space-y-8 px-4 py-5 md:px-6 md:py-7 xl:px-0">
      <div className="space-y-1.5">
        <div className="text-sm font-medium text-text-muted">Welcome back, {home.actorName} · Product home</div>
        <div className="max-w-[760px] text-[15px] leading-7 text-text-muted">
          Start from the real operator loop, then move deeper only when the next decision actually requires a support surface.
        </div>
      </div>

      <AvailabilityNotice
        note={home.availabilityNote}
        onRetry={home.refetch}
        isFetching={home.isFetching}
      />

      <Hero home={home} onNavigate={navigateFromAction} />

      <OperatingModel onNavigate={navigateFromAction} />

      <CoreSurfaces
        featured={featuredEntryPoints}
        secondary={secondaryEntryPoints}
        onNavigate={navigateFromAction}
      />

      <WhyItMatters items={home.benefits} />

      <FinalPathways actions={home.finalActions} onNavigate={navigateFromAction} />
    </PageCanvas>
  );
}
