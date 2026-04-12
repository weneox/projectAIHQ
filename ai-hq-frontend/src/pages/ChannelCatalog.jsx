import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ChevronRight,
  Globe2,
  Sparkles,
  Zap,
} from "lucide-react";

import {
  getMetaChannelStatus,
  getTelegramChannelStatus,
  getWebsiteWidgetStatus,
} from "../api/channelConnect.js";
import { getSettingsTrustView } from "../api/trust.js";
import ChannelDetailDrawer from "../components/channels/ChannelDetailDrawer.jsx";
import ChannelIcon from "../components/channels/ChannelIcon.jsx";
import useWorkspaceTenantKey from "../hooks/useWorkspaceTenantKey.js";
import {
  CHANNELS,
  findChannelById,
} from "../components/channels/channelCatalogModel.js";
import Button from "../components/ui/Button.jsx";
import Badge from "../components/ui/Badge.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
  SlidingDetailOverlay,
  Surface,
} from "../components/ui/AppShellPrimitives.jsx";
import { compactSentence, s } from "../lib/appUi.js";
import {
  buildMetaLaunchChannelState,
  buildTelegramLaunchChannelState,
  buildWebsiteLaunchChannelState,
  buildTruthOperationalState,
} from "../lib/readinessViewModel.js";
import { useLaunchSliceRefreshToken } from "../lib/launchSliceRefresh.js";

const EMPTY_READINESS_STATE = {
  tenantKey: "",
  requestKey: "",
  loading: true,
  error: "",
  meta: null,
  telegram: null,
  website: null,
  truth: null,
};

const CONNECTOR_COPY = {
  website: {
    label: "Website",
    title: "Widget + trusted origin",
    summary: "Public website conversations.",
    tone:
      "border-[rgba(15,23,42,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))]",
    accent: "bg-slate-900",
    glow: "from-slate-100/80 via-white to-white",
    Icon: Globe2,
  },
  instagram: {
    label: "Instagram",
    title: "DM automation",
    summary: "Business account conversations.",
    tone:
      "border-[rgba(236,72,153,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,251,0.98))]",
    accent:
      "bg-[linear-gradient(135deg,#f58529_0%,#dd2a7b_45%,#8134af_75%,#515bd4_100%)]",
    glow: "from-pink-100/70 via-white to-white",
    Icon: Sparkles,
  },
  telegram: {
    label: "Telegram",
    title: "Bot conversations",
    summary: "Private chat intake.",
    tone:
      "border-[rgba(14,165,233,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,249,255,0.98))]",
    accent: "bg-sky-500",
    glow: "from-sky-100/70 via-white to-white",
    Icon: Zap,
  },
};

function resolveLaunchChannels() {
  return CHANNELS.filter((channel) =>
    ["website", "instagram", "telegram"].includes(channel.id)
  );
}

function buildRuntimeMeta(channel, readinessState) {
  if (channel.id === "instagram") return readinessState.meta;
  if (channel.id === "telegram") return readinessState.telegram;
  if (channel.id === "website") return readinessState.website;
  return null;
}

function normalizeStatus(runtime = null) {
  const raw = s(runtime?.statusLabel);
  const lower = raw.toLowerCase();

  if (runtime?.connected === true) {
    return {
      label: raw || "Ready",
      tone: "success",
      connected: true,
      blocked: false,
    };
  }

  if (!raw || lower === "unknown") {
    return {
      label: "Connect",
      tone: "warning",
      connected: false,
      blocked: false,
    };
  }

  if (
    lower.includes("blocked") ||
    lower.includes("reconnect") ||
    lower.includes("repair") ||
    lower.includes("required")
  ) {
    return {
      label: raw,
      tone: "danger",
      connected: false,
      blocked: true,
    };
  }

  if (lower.includes("connecting") || lower.includes("pending")) {
    return {
      label: raw,
      tone: "warning",
      connected: false,
      blocked: false,
    };
  }

  return {
    label: raw,
    tone: "neutral",
    connected: false,
    blocked: false,
  };
}

function resolveTruthReady(truth = null) {
  return s(truth?.status).toLowerCase() === "ready";
}

function resolveTopAction({ hasConnectedLaunchChannel, truth }) {
  if (hasConnectedLaunchChannel && resolveTruthReady(truth)) {
    return {
      label: "Open inbox",
      target: "inbox",
    };
  }

  if (hasConnectedLaunchChannel && !resolveTruthReady(truth)) {
    return {
      label: "Open truth",
      target: "truth",
    };
  }

  return {
    label: "Choose channel",
    target: "none",
  };
}

function resolveChannelPrimaryAction(channel, runtime) {
  const status = normalizeStatus(runtime);

  if (status.connected) {
    return {
      label: "Open inbox",
      mode: "inbox",
    };
  }

  if (status.blocked) {
    return {
      label: "Fix",
      mode: "details",
    };
  }

  return {
    label: "Connect",
    mode: "details",
  };
}

function CompactHeader({
  title,
  subtitle,
  truth = null,
  topAction,
  onPrimaryAction,
}) {
  const truthReady = resolveTruthReady(truth);

  return (
    <section className="flex flex-col gap-4 border-b border-line-soft pb-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2">
          <Badge tone={truthReady ? "success" : "warning"}>
            {truthReady ? "Launch ready" : "Approval required"}
          </Badge>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            Channels
          </span>
        </div>

        <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-text md:text-[32px]">
          {title}
        </h1>

        <p className="mt-1 text-[14px] leading-6 text-text-muted">{subtitle}</p>
      </div>

      {topAction?.target !== "none" ? (
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={onPrimaryAction}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            {topAction.label}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function StageStrip({ connectedCount = 0, truth = null }) {
  const truthReady = resolveTruthReady(truth);

  return (
    <section className="grid gap-3 md:grid-cols-3">
      <div className="rounded-[18px] border border-[rgba(15,23,42,0.08)] bg-white px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
          Channels
        </div>
        <div className="mt-1 text-[15px] font-semibold text-text">3 live surfaces</div>
      </div>

      <div className="rounded-[18px] border border-[rgba(15,23,42,0.08)] bg-white px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
          Live now
        </div>
        <div className="mt-1 text-[15px] font-semibold text-text">
          {connectedCount > 0 ? `${connectedCount} connected` : "Nothing connected"}
        </div>
      </div>

      <div className="rounded-[18px] border border-[rgba(15,23,42,0.08)] bg-white px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
          Truth
        </div>
        <div className="mt-1 text-[15px] font-semibold text-text">
          {truthReady ? "Approved" : "Needs approval"}
        </div>
      </div>
    </section>
  );
}

function LaunchCard({ channel, runtime, onInspect, onRunPrimaryAction }) {
  const copy = CONNECTOR_COPY[channel.id] || CONNECTOR_COPY.website;
  const status = normalizeStatus(runtime);
  const action = resolveChannelPrimaryAction(channel, runtime);
  const statusSummary = compactSentence(
    runtime?.summary || copy.summary,
    copy.summary
  );
  const AccentIcon = copy.Icon;

  return (
    <article
      className={`group relative overflow-hidden rounded-[24px] border p-4 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.22)] ${copy.tone}`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${copy.glow}`}
      />

      <div className="relative z-[1] flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-[16px] border border-white/70 bg-white shadow-[0_10px_18px_-14px_rgba(15,23,42,0.35)]">
              <ChannelIcon channel={channel} size="md" />
              <span
                className={`absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-white shadow-sm ${copy.accent}`}
              >
                <AccentIcon className="h-3 w-3" />
              </span>
            </div>

            <div className="min-w-0">
              <div className="truncate text-[18px] font-semibold tracking-[-0.02em] text-text">
                {channel.name}
              </div>
              <div className="mt-0.5 text-[12px] font-medium text-text-subtle">
                {copy.label}
              </div>
            </div>
          </div>

          <Badge tone={status.tone}>{status.label}</Badge>
        </div>

        <div className="mt-5">
          <div className="text-[15px] font-semibold text-text">{copy.title}</div>
          <div className="mt-2 text-[13px] leading-6 text-text-muted">
            {statusSummary}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onInspect?.(channel.id)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-text-subtle transition hover:text-text"
          >
            Details
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <Button
            type="button"
            size="sm"
            onClick={() => onRunPrimaryAction?.(channel, action)}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            {action.label}
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function ChannelCatalog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspace = useWorkspaceTenantKey();
  const refreshToken = useLaunchSliceRefreshToken(
    workspace.tenantKey,
    workspace.ready
  );

  const [readinessState, setReadinessState] = useState(EMPTY_READINESS_STATE);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [closingChannel, setClosingChannel] = useState(null);
  const closeTimerRef = useRef(null);

  const selectedChannelId = searchParams.get("channel") || "";
  const selectedChannel = useMemo(
    () => findChannelById(selectedChannelId),
    [selectedChannelId]
  );
  const drawerChannel = selectedChannel || closingChannel;

  const currentReadinessRequestKey = useMemo(() => {
    if (!workspace.ready) return "";
    return `${s(workspace.tenantKey)}:${String(refreshToken ?? "")}`;
  }, [refreshToken, workspace.ready, workspace.tenantKey]);

  useEffect(() => {
    if (!workspace.ready) return undefined;

    let alive = true;
    const tenantKey = workspace.tenantKey;
    const requestKey = currentReadinessRequestKey;

    Promise.allSettled([
      getMetaChannelStatus(),
      getTelegramChannelStatus(),
      getWebsiteWidgetStatus(),
      getSettingsTrustView({ limit: 4 }),
    ])
      .then((results) => {
        if (!alive) return;

        const meta =
          results[0].status === "fulfilled"
            ? buildMetaLaunchChannelState(results[0].value)
            : buildMetaLaunchChannelState({});
        const telegram =
          results[1].status === "fulfilled"
            ? buildTelegramLaunchChannelState(results[1].value)
            : buildTelegramLaunchChannelState({});
        const website =
          results[2].status === "fulfilled"
            ? buildWebsiteLaunchChannelState(results[2].value)
            : buildWebsiteLaunchChannelState({});
        const truth =
          results[3].status === "fulfilled"
            ? buildTruthOperationalState(results[3].value)
            : buildTruthOperationalState(null);

        setReadinessState({
          tenantKey,
          requestKey,
          loading: false,
          error: "",
          meta,
          telegram,
          website,
          truth,
        });
      })
      .catch((error) => {
        if (!alive) return;

        setReadinessState({
          tenantKey,
          requestKey,
          loading: false,
          error: s(
            error?.message || error || "Channel readiness could not be loaded."
          ),
          meta: buildMetaLaunchChannelState({}),
          telegram: buildTelegramLaunchChannelState({}),
          website: buildWebsiteLaunchChannelState({}),
          truth: buildTruthOperationalState(null),
        });
      });

    return () => {
      alive = false;
    };
  }, [currentReadinessRequestKey, workspace.ready, workspace.tenantKey]);

  const effectiveReadinessState = useMemo(() => {
    if (!workspace.ready) {
      return {
        ...EMPTY_READINESS_STATE,
        loading: false,
      };
    }

    if (readinessState.tenantKey !== workspace.tenantKey) {
      return {
        ...EMPTY_READINESS_STATE,
        tenantKey: workspace.tenantKey,
        requestKey: currentReadinessRequestKey,
        loading: true,
      };
    }

    if (readinessState.requestKey !== currentReadinessRequestKey) {
      return {
        ...readinessState,
        requestKey: currentReadinessRequestKey,
        loading: true,
        error: "",
      };
    }

    return readinessState;
  }, [
    currentReadinessRequestKey,
    readinessState,
    workspace.ready,
    workspace.tenantKey,
  ]);

  useEffect(() => {
    if (!selectedChannel) return undefined;
    const raf = window.requestAnimationFrame(() => {
      setDrawerOpen(true);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [selectedChannel]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const launchChannels = useMemo(() => resolveLaunchChannels(), []);

  const connectedCount = useMemo(() => {
    const items = [
      effectiveReadinessState.website,
      effectiveReadinessState.meta,
      effectiveReadinessState.telegram,
    ];

    return items.reduce(
      (sum, item) => (item?.connected === true ? sum + 1 : sum),
      0
    );
  }, [
    effectiveReadinessState.website,
    effectiveReadinessState.meta,
    effectiveReadinessState.telegram,
  ]);

  const hasConnectedLaunchChannel = connectedCount > 0;
  const topAction = resolveTopAction({
    hasConnectedLaunchChannel,
    truth: effectiveReadinessState.truth,
  });

  function updateSelectedChannel(channelId = "") {
    const nextParams = new URLSearchParams(searchParams);

    if (channelId) {
      nextParams.set("channel", channelId);
    } else {
      nextParams.delete("channel");
    }

    setSearchParams(nextParams);
  }

  function handleTopAction() {
    if (topAction.target === "inbox") {
      navigate("/inbox");
      return;
    }

    if (topAction.target === "truth") {
      navigate("/truth");
    }
  }

  function handlePrimaryAction(channel, action) {
    if (!channel?.id) return;

    if (action?.mode === "inbox") {
      navigate("/inbox");
      return;
    }

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setClosingChannel(null);
    updateSelectedChannel(channel.id);
  }

  function handleDrawerClose() {
    if (!drawerChannel) {
      updateSelectedChannel("");
      return;
    }

    setClosingChannel(drawerChannel);
    setDrawerOpen(false);

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      setClosingChannel(null);
      updateSelectedChannel("");
      closeTimerRef.current = null;
    }, 320);
  }

  if (!workspace.ready && effectiveReadinessState.loading) {
    return (
      <PageCanvas className="max-w-[1280px] py-2">
        <LoadingSurface title="Loading channels" />
      </PageCanvas>
    );
  }

  return (
    <>
      <PageCanvas className="max-w-[1280px] space-y-5 py-2">
        {s(effectiveReadinessState.error) ? (
          <InlineNotice
            tone="danger"
            title="Channel readiness unavailable"
            description={effectiveReadinessState.error}
            compact
          />
        ) : null}

        <CompactHeader
          title="Choose a launch channel"
          subtitle="Connect one surface. Go live fast."
          truth={effectiveReadinessState.truth}
          topAction={topAction}
          onPrimaryAction={handleTopAction}
        />

        <StageStrip
          connectedCount={connectedCount}
          truth={effectiveReadinessState.truth}
        />

        {hasConnectedLaunchChannel &&
        !resolveTruthReady(effectiveReadinessState.truth) ? (
          <InlineNotice
            tone="warning"
            title="Channel is live. Truth still needs approval."
            description="Open truth before trusting autonomous replies."
            compact
          />
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Live surfaces
            </div>
            <div className="text-[12px] text-text-subtle">
              {launchChannels.length} available
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {launchChannels.map((channel) => (
              <LaunchCard
                key={channel.id}
                channel={channel}
                runtime={buildRuntimeMeta(channel, effectiveReadinessState)}
                onInspect={updateSelectedChannel}
                onRunPrimaryAction={handlePrimaryAction}
              />
            ))}
          </div>
        </section>

        <Surface padded="md" className="rounded-[22px]" tone="muted">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                Fast path
              </div>
              <div className="mt-1 text-[14px] font-semibold text-text">
                Connect → approve truth → open inbox
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => navigate("/truth")}
              >
                Open truth
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => navigate("/inbox")}
                rightIcon={<ArrowRight className="h-4 w-4" />}
                disabled={!hasConnectedLaunchChannel}
              >
                Open inbox
              </Button>
            </div>
          </div>
        </Surface>
      </PageCanvas>

      {drawerChannel ? (
        <SlidingDetailOverlay
          open={drawerOpen}
          onClose={handleDrawerClose}
          closeLabel="Close connector details"
        >
          <ChannelDetailDrawer
            channel={drawerChannel}
            open={drawerOpen}
            onClose={handleDrawerClose}
            onNavigate={navigate}
          />
        </SlidingDetailOverlay>
      ) : null}
    </>
  );
}