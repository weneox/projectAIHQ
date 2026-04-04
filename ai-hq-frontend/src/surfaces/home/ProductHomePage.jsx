import {
  ArrowRight,
  Globe2,
  LayoutGrid,
  Link2,
  Loader2,
  MessageSquareText,
  Settings2,
  Sparkles,
  Waypoints,
  Waves,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Input, { Textarea } from "../../components/ui/Input.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../../components/ui/AppShellPrimitives.jsx";
import { saveBusinessProfile } from "../../api/setup.js";
import { clearAppBootstrapContext } from "../../lib/appSession.js";
import useProductHome from "../../view-models/useProductHome.js";

const ENTRY_ICONS = {
  inbox: MessageSquareText,
  comments: Waypoints,
  voice: Waves,
};

const SUPPORT_ICONS = {
  setup: Settings2,
  truth: Sparkles,
  workspace: LayoutGrid,
};

function compactText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function resolveTone(value = "") {
  const text = String(value || "").toLowerCase();

  if (
    text.includes("attention") ||
    text.includes("pending") ||
    text.includes("review") ||
    text.includes("progress")
  ) {
    return "warning";
  }

  if (
    text.includes("ready") ||
    text.includes("active") ||
    text.includes("stable") ||
    text.includes("complete") ||
    text.includes("start")
  ) {
    return "info";
  }

  if (text.includes("unavailable") || text.includes("error")) {
    return "danger";
  }

  return "neutral";
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
      compact
    />
  );
}

function SignalLedger({ items, onNavigate }) {
  if (!items?.length) return null;

  return (
    <div className="overflow-hidden rounded-[14px] border border-line">
      <div className="grid md:grid-cols-3">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.action)}
            className={[
              "flex min-h-[112px] flex-col justify-between bg-surface px-4 py-4 text-left transition duration-base ease-premium hover:bg-surface-muted",
              index < items.length - 1
                ? "border-b border-line-soft md:border-b-0 md:border-r"
                : "",
            ].join(" ")}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
              {item.label}
            </div>

            <div className="mt-4">
              <div className="text-[15px] font-semibold tracking-[-0.03em] text-text">
                {item.status}
              </div>
              <div className="mt-1 truncate text-[12px] text-text-muted">
                {item.summary}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function EntryCard({ item, highlighted = false, onNavigate }) {
  const Icon = ENTRY_ICONS[item.id] || Sparkles;

  return (
    <div
      className={[
        "flex h-full min-h-[240px] flex-col bg-surface",
        highlighted ? "bg-[rgba(var(--color-brand),0.04)]" : "",
      ].join(" ")}
    >
      <div className="flex flex-1 flex-col px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div
            className={[
              "flex h-10 w-10 items-center justify-center rounded-[10px] border",
              highlighted
                ? "border-[rgba(var(--color-brand),0.16)] bg-surface text-brand"
                : "border-line bg-surface-muted text-text",
            ].join(" ")}
          >
            <Icon className="h-4.5 w-4.5" strokeWidth={1.9} />
          </div>

          <Badge tone={resolveTone(item.status)} variant="subtle">
            {item.status}
          </Badge>
        </div>

        <div className="mt-8">
          <div className="text-[18px] font-semibold tracking-[-0.04em] text-text">
            {item.title}
          </div>
          <div className="mt-2 text-[13px] leading-6 text-text-muted">
            {compactText(item.detail, item.summary)}
          </div>
        </div>
      </div>

      <div className="border-t border-line-soft p-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          fullWidth
          onClick={() => onNavigate(item.action)}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          {item.action.label}
        </Button>
      </div>
    </div>
  );
}

function SupportCard({ items, onNavigate }) {
  return (
    <div className="flex h-full min-h-[240px] flex-col bg-surface">
      <div className="flex-1 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
              Support layer
            </div>
            <div className="mt-2 text-[18px] font-semibold tracking-[-0.04em] text-text">
              Setup, truth, workspace
            </div>
          </div>

          <Badge variant="outline">Nearby</Badge>
        </div>

        <div className="mt-5 overflow-hidden rounded-[12px] border border-line">
          {items.map((item, index) => {
            const Icon = SUPPORT_ICONS[item.id] || Sparkles;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.action)}
                className={[
                  "flex w-full items-center gap-3 bg-surface px-4 py-3 text-left transition duration-fast hover:bg-surface-muted",
                  index < items.length - 1 ? "border-b border-line-soft" : "",
                ].join(" ")}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-line bg-surface-muted text-text-muted">
                  <Icon className="h-4 w-4" strokeWidth={1.9} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold tracking-[-0.02em] text-text">
                    {item.title}
                  </div>
                  <div className="truncate text-[11px] text-text-subtle">
                    {item.status}
                  </div>
                </div>

                <ArrowRight className="h-4 w-4 text-text-subtle" strokeWidth={1.9} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HeroSection({ home, items, supportItems, onNavigate }) {
  const highlightedPath = home.currentStatus.action?.path;

  return (
    <section className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-panel">
      <div className="grid xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <div className="border-b border-line-soft px-5 py-5 md:px-7 md:py-7 xl:border-b-0 xl:border-r">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
            <span className="text-brand">AI HQ</span>
            <span className="h-1 w-1 rounded-full bg-line-strong" />
            <span>{home.companyName || "Operator home"}</span>
          </div>

          <div className="mt-6">
            <h1 className="max-w-[10ch] font-display text-[2.8rem] font-semibold leading-[0.92] tracking-[-0.065em] text-text md:text-[4rem]">
              Live work starts here.
            </h1>
            <div className="mt-4 max-w-[34rem] text-[15px] leading-7 text-text-muted">
              {home.currentStatus.title}
            </div>
            <div className="mt-2 max-w-[34rem] text-[13px] leading-6 text-text-subtle">
              {home.currentStatus.summary}
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

          <div className="mt-8">
            <SignalLedger items={home.heroStats} onNavigate={onNavigate} />
          </div>
        </div>

        <div className="bg-surface-muted/40">
          <div className="border-b border-line-soft px-5 py-4 md:px-7">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
              Operating lanes
            </div>
            <div className="mt-1 text-[14px] font-semibold tracking-[-0.02em] text-text">
              Three live surfaces, one support layer
            </div>
          </div>

          <div className="grid bg-line-soft sm:grid-cols-2 sm:gap-px">
            {items.map((item) => (
              <EntryCard
                key={item.id}
                item={item}
                highlighted={highlightedPath === item.action?.path}
                onNavigate={onNavigate}
              />
            ))}
            <SupportCard items={supportItems} onNavigate={onNavigate} />
          </div>
        </div>
      </div>
    </section>
  );
}

function SetupAssistantSection({
  home,
  supportItems,
  assistantOpen,
  searchParams,
  setSearchParams,
  onNavigate,
}) {
  const [mode, setMode] = useState(() => (assistantOpen ? "website" : ""));
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (assistantOpen && !mode) {
      setMode("website");
    }
  }, [assistantOpen, mode]);

  const visible = !home.setupState?.isComplete || assistantOpen;
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
    <section className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-panel">
      <div className="grid xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="px-5 py-5 md:px-7 md:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-[540px]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                Setup assistant
              </div>
              <div className="mt-2 text-[1.8rem] font-semibold tracking-[-0.055em] text-text">
                Add the minimum business context.
              </div>
              <div className="mt-2 text-[14px] leading-6 text-text-muted">
                A website or one short description is enough.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "website" ? "primary" : "secondary"}
                onClick={() => setMode("website")}
              >
                Website
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "description" ? "primary" : "secondary"}
                onClick={() => setMode("description")}
              >
                Description
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onNavigate({ path: "/channels" })}
                leftIcon={<Link2 className="h-4 w-4" />}
              >
                Connect sources
              </Button>
            </div>
          </div>

          <div className="mt-8 max-w-[720px]">
            {mode === "website" ? (
              <div className="space-y-3">
                <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                  Website
                </div>
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
                <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                  Business description
                </div>
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
              <div className="flex min-h-[140px] items-center justify-center rounded-[14px] border border-dashed border-line bg-surface-muted px-5 text-center text-[13px] leading-6 text-text-muted">
                Choose one path and keep it short.
              </div>
            ) : null}

            {message ? (
              <InlineNotice
                tone="success"
                title="Saved"
                description={message}
                compact
                className="mt-4"
              />
            ) : null}

            {error ? (
              <InlineNotice
                tone="danger"
                title="Unable to save"
                description={error}
                compact
                className="mt-4"
              />
            ) : null}
          </div>

          <div className="mt-6 flex flex-col gap-4 border-t border-line-soft pt-4 md:flex-row md:items-center md:justify-between">
            <div className="text-[13px] text-text-muted">
              {home.setupState?.summary ||
                "The workspace can run now. Add business context only when useful."}
            </div>

            <Button
              type="button"
              size="hero"
              disabled={saving || (!compactText(website) && !compactText(description))}
              onClick={handleSave}
              rightIcon={
                saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )
              }
            >
              {saving ? "Saving..." : "Save basics"}
            </Button>
          </div>
        </div>

        <div className="border-t border-line-soft bg-surface-muted px-5 py-5 md:px-7 md:py-7 xl:border-l xl:border-t-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
            Current posture
          </div>
          <div className="mt-2 text-[18px] font-semibold tracking-[-0.04em] text-text">
            {home.setupState?.status === "completed"
              ? "Foundation is in place"
              : "Foundation is still optional"}
          </div>
          <div className="mt-2 text-[13px] leading-6 text-text-muted">
            {home.setupState?.summary ||
              "The workspace can run now. Add context only when it improves the operating path."}
          </div>

          <div className="mt-6 overflow-hidden rounded-[12px] border border-line bg-surface">
            {supportItems.map((item, index) => {
              const Icon = SUPPORT_ICONS[item.id] || Sparkles;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.action)}
                  className={[
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition duration-fast hover:bg-surface-muted",
                    index < supportItems.length - 1 ? "border-b border-line-soft" : "",
                  ].join(" ")}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-line bg-surface-muted text-text-muted">
                    <Icon className="h-4 w-4" strokeWidth={1.9} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold tracking-[-0.02em] text-text">
                      {item.title}
                    </div>
                    <div className="truncate text-[11px] text-text-subtle">
                      {item.status}
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-text-subtle" strokeWidth={1.9} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductHomeLoadingSurface() {
  return (
    <PageCanvas className="px-4 py-4 md:px-5 md:py-5 xl:px-0">
      <LoadingSurface
        title="Loading home"
        description="Preparing your next path."
      />
    </PageCanvas>
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
      : {
          id: "setup",
          title: "Setup",
          status: "Support",
          action: { label: "Open setup assistant", path: "/home?assistant=setup" },
        },
    truthSignal
      ? {
          id: "truth",
          title: "Truth",
          status: truthSignal.status,
          action: truthSignal.action,
        }
      : {
          id: "truth",
          title: "Truth",
          status: "Support",
          action: { label: "Open truth", path: "/truth" },
        },
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

      <SetupAssistantSection
        home={home}
        supportItems={supportItems}
        assistantOpen={assistantOpen}
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        onNavigate={navigateFromAction}
      />
    </PageCanvas>
  );
}
