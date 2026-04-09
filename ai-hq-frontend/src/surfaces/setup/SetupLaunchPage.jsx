import { ArrowLeft, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import FloatingAiWidget from "../../components/layout/FloatingAiWidget.jsx";
import Button from "../../components/ui/Button.jsx";
import {
  LoadingSurface,
  PageCanvas,
} from "../../components/ui/AppShellPrimitives.jsx";
import useProductHome from "../../view-models/useProductHome.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function sentence(value, fallback = "") {
  const text = s(value, fallback);
  if (!text) return "";
  const first = text.split(/(?<=[.!?])\s+/)[0] || text;
  return first.length > 180 ? `${first.slice(0, 177).trim()}...` : first;
}

function normalizeAction(action = null, fallback = null) {
  const primary = action && typeof action === "object" ? action : {};
  const secondary = fallback && typeof fallback === "object" ? fallback : {};
  const path = s(
    primary.path || primary.target?.path || secondary.path || secondary.target?.path
  );
  const label = s(primary.label || secondary.label);

  if (!path && !label) return null;

  return {
    label: label || "Open",
    path: path || "/home",
  };
}

function buildSetupScene(home) {
  const hasDraft = home?.setupFlow?.hasDraft === true;
  const connected = home?.launchChannel?.connected === true;
  const launchPhase = s(home?.launchPhase);

  if (!connected) {
    return {
      eyebrow: "Setup draft",
      title: hasDraft
        ? "Keep shaping the draft while the launch channel is still being connected."
        : "Start the setup draft before the launch channel goes live.",
      description:
        "Everything here stays draft-only. Nothing in setup auto-publishes governed truth or runtime.",
    };
  }

  if (launchPhase === "approve_truth_runtime") {
    return {
      eyebrow: "Setup draft",
      title: hasDraft
        ? "The draft is ready to support review."
        : "Capture the setup draft before review.",
      description:
        home?.truthRuntime?.truthReady === true
          ? "You can keep editing draft setup here, but live behavior still depends on governed truth and runtime repair."
          : "Use setup to tighten the draft, then approve truth and runtime separately before launch.",
    };
  }

  if (home?.launchReady) {
    return {
      eyebrow: "Setup draft",
      title: hasDraft
        ? "Refine the setup draft without touching live truth."
        : "Setup stays available for later changes.",
      description:
        "Approved truth remains governed. Draft edits here do not publish automatically into the live runtime.",
    };
  }

  return {
    eyebrow: "Setup draft",
    title: hasDraft ? "Continue the setup draft." : "Create the setup draft.",
    description:
      "Capture only the business details that should later move through governed truth review and strict runtime activation.",
  };
}

function QuietNotice({ note, onRetry, isFetching }) {
  if (!note) return null;

  return (
    <div className="rounded-[18px] border border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.84)] px-4 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.92)]">
            {s(note.title, "Limited context")}
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
    </div>
  );
}

function MetaStat({ label, value }) {
  return (
    <div className="rounded-[18px] border border-[rgba(15,23,42,0.07)] bg-white/84 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
        {label}
      </div>
      <div className="mt-2 text-[14px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.94)]">
        {value}
      </div>
    </div>
  );
}

export default function SetupLaunchPage() {
  const navigate = useNavigate();
  const home = useProductHome();

  function navigateFromAction(action = null) {
    const nextAction = normalizeAction(action);
    if (!nextAction?.path) return;
    navigate(nextAction.path);
  }

  if (home.loading) {
    return (
      <PageCanvas className="px-0 py-0">
        <LoadingSurface title="Loading setup" />
      </PageCanvas>
    );
  }

  const scene = buildSetupScene(home);
  const contextualAction =
    !home.launchChannel?.connected
      ? normalizeAction(home.launchChannel?.action, {
          label: "Open channels",
          path: "/channels",
        })
      : home.launchPhase === "approve_truth_runtime"
        ? normalizeAction(home.truthRuntime?.action, {
            label: "Open truth",
            path: "/truth",
          })
        : home.launchReady
          ? { label: "Open inbox", path: "/inbox" }
          : null;

  return (
    <PageCanvas className="px-0 py-0">
      <div className="space-y-6">
        <QuietNotice
          note={home.availabilityNote}
          onRetry={home.refetch}
          isFetching={home.isFetching}
        />

        <section className="overflow-hidden rounded-[32px] border border-[rgba(15,23,42,0.08)] bg-white">
          <div className="border-b border-[rgba(15,23,42,0.06)] bg-[radial-gradient(circle_at_top_left,rgba(68,116,245,0.08),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,250,252,0.98))] px-5 py-6 md:px-7 md:py-7">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
              <span className="text-[rgba(31,77,168,0.92)]">{scene.eyebrow}</span>
              <span className="h-1 w-1 rounded-full bg-[rgba(15,23,42,0.16)]" />
              <span>{s(home.launchPhaseLabel, "Launch step")}</span>
            </div>

            <div className="mt-4 max-w-[18ch] text-[2.15rem] font-semibold leading-[0.94] tracking-[-0.065em] text-[rgba(15,23,42,0.98)] md:text-[3rem]">
              {scene.title}
            </div>

            <div className="mt-4 max-w-[46rem] text-[15px] leading-7 text-[rgba(15,23,42,0.6)]">
              {scene.description}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                type="button"
                size="hero"
                variant="secondary"
                onClick={() => navigate("/home")}
                leftIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Back to launch home
              </Button>

              {contextualAction?.path ? (
                <Button
                  type="button"
                  size="hero"
                  onClick={() => navigateFromAction(contextualAction)}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  {contextualAction.label}
                </Button>
              ) : null}
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-3">
              <MetaStat
                label={s(home.launchChannel?.channelLabel, "Launch channel")}
                value={s(home.launchChannel?.statusLabel, "Unavailable")}
              />
              <MetaStat
                label="Setup draft"
                value={s(home.setupFlow?.statusLabel, "Unavailable")}
              />
              <MetaStat
                label="Truth + runtime"
                value={s(home.truthRuntime?.statusLabel, "Unavailable")}
              />
            </div>
          </div>

          <div className="min-h-[760px] bg-[rgba(250,251,255,0.76)] p-4 md:p-5">
            <FloatingAiWidget
              presentation="page"
              assistant={home.assistant}
              onNavigate={navigateFromAction}
            />
          </div>
        </section>
      </div>
    </PageCanvas>
  );
}
