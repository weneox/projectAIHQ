import { ArrowLeft, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import FloatingAiWidget from "../../components/layout/FloatingAiWidget.jsx";
import Button from "../../components/ui/Button.jsx";
import {
  InlineNotice,
  LoadingSurface,
  MetricCard,
  PageCanvas,
  PageHeader,
  Surface,
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

function AvailabilityNotice({ note, onRetry, isFetching }) {
  if (!note) return null;

  return (
    <InlineNotice
      title={s(note.title, "Limited context")}
      description={sentence(note.description)}
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
      <PageCanvas>
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
    <PageCanvas>
      <AvailabilityNotice
        note={home.availabilityNote}
        onRetry={home.refetch}
        isFetching={home.isFetching}
      />

      <PageHeader
        eyebrow={scene.eyebrow}
        title={scene.title}
        description={scene.description}
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/home")}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Back to launch home
            </Button>

            {contextualAction?.path ? (
              <Button
                type="button"
                onClick={() => navigateFromAction(contextualAction)}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                {contextualAction.label}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label={s(home.launchChannel?.channelLabel, "Launch channel")}
          value={s(home.launchChannel?.statusLabel, "Unavailable")}
          hint={sentence(
            home.launchChannel?.summary,
            "Channel posture unavailable."
          )}
        />
        <MetricCard
          label="Setup draft"
          value={s(home.setupFlow?.statusLabel, "Unavailable")}
          hint={sentence(
            home.setupFlow?.summary,
            "Draft posture unavailable."
          )}
        />
        <MetricCard
          label="Truth + runtime"
          value={s(home.truthRuntime?.statusLabel, "Unavailable")}
          hint={sentence(
            home.truthRuntime?.summary,
            "Truth and runtime posture unavailable."
          )}
        />
      </div>

      <Surface padded={false} className="overflow-hidden">
        <div className="border-b border-line-soft px-4 py-3 text-[13px] text-text-muted">
          Setup stays draft-only. Use this surface to shape business details, then review truth and runtime separately.
        </div>

        <div className="min-h-[760px] bg-surface p-4">
          <FloatingAiWidget
            presentation="page"
            assistant={home.assistant}
            onNavigate={navigateFromAction}
          />
        </div>
      </Surface>
    </PageCanvas>
  );
}
