import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import {
  getMetaChannelStatus,
  getTelegramChannelStatus,
  getWebsiteWidgetStatus,
} from "../api/channelConnect.js";
import {
  getSettingsTrustView,
  saveSettingsTrustPolicyControl,
} from "../api/trust.js";
import InboxComposer from "../components/inbox/InboxComposer.jsx";
import { useInboxComposerSurface } from "../components/inbox/hooks/useInboxComposerSurface.js";
import { useInboxThreadListSurface } from "../components/inbox/hooks/useInboxThreadListSurface.js";
import InboxDetailPanel from "../components/inbox/InboxDetailPanel.jsx";
import InboxLeadPanel from "../components/inbox/InboxLeadPanel.jsx";
import InboxThreadListPanel from "../components/inbox/InboxThreadListPanel.jsx";
import { useThreadOutboundAttemptsSurface } from "../components/inbox/hooks/useThreadOutboundAttemptsSurface.js";
import { useInboxData } from "../hooks/useInboxData.js";
import { useInboxRealtime } from "../hooks/useInboxRealtime.js";
import useWorkspaceTenantKey from "../hooks/useWorkspaceTenantKey.js";
import { getAppSessionContext } from "../lib/appSession.js";
import { s } from "../lib/appUi.js";
import { useLaunchSliceRefreshToken } from "../lib/launchSliceRefresh.js";
import {
  buildChannelTruthLaunchReadiness,
  buildMetaLaunchChannelState,
  buildTelegramLaunchChannelState,
  buildWebsiteLaunchChannelState,
  buildTruthOperationalState,
} from "../lib/readinessViewModel.js";
import Button from "../components/ui/Button.jsx";
import {
  InlineNotice,
  PageCanvas,
  SlidingDetailOverlay,
  Surface,
} from "../components/ui/AppShellPrimitives.jsx";

const EMPTY_READINESS_STATE = {
  tenantKey: "",
  truth: null,
  meta: null,
  telegram: null,
  website: null,
};

const EMPTY_TRUST_STATE = {
  tenantKey: "",
  loading: false,
  trustView: null,
};

function buildSurfaceNotice(surface = {}) {
  if (surface?.unavailable) {
    return {
      tone: "danger",
      title: "Inbox unavailable",
      description: "Inbox operations are temporarily unavailable.",
    };
  }

  if (s(surface?.saveError || surface?.error)) {
    return {
      tone: "danger",
      title: "Inbox issue",
      description: s(surface?.saveError || surface?.error),
    };
  }

  if (s(surface?.saveSuccess)) {
    return {
      tone: "success",
      title: "Updated",
      description: s(surface.saveSuccess),
    };
  }

  return null;
}

function resolveInboxPolicyControl(trustView = null) {
  const controls = trustView?.summary?.policyControls || {};
  const tenantDefault = controls?.tenantDefault || null;
  const scopedItems = Array.isArray(controls?.items) ? controls.items : [];
  const inboxControl =
    scopedItems.find((item) => s(item?.surface).toLowerCase() === "inbox") ||
    tenantDefault ||
    null;

  const availableModes = Array.isArray(inboxControl?.availableModes)
    ? inboxControl.availableModes
    : [];

  const controlMode = s(
    inboxControl?.controlMode || "autonomy_enabled"
  ).toLowerCase();

  const enableRule = availableModes.find(
    (item) => s(item?.mode).toLowerCase() === "autonomy_enabled"
  );
  const disableRule = availableModes.find(
    (item) => s(item?.mode).toLowerCase() === "operator_only_mode"
  );

  const labelMap = {
    autonomy_enabled: "Autonomy enabled",
    operator_only_mode: "Operator only",
    human_review_required: "Human review",
    handoff_preferred: "Handoff preferred",
    handoff_required: "Handoff required",
    blocked_until_repair: "Blocked until repair",
    emergency_stop: "Emergency stop",
  };

  return {
    controlMode,
    enabled: controlMode === "autonomy_enabled",
    changedAt: s(inboxControl?.changedAt),
    changedBy: s(inboxControl?.changedBy),
    policyReason: s(inboxControl?.policyReason),
    operatorNote: s(inboxControl?.operatorNote),
    statusLabel:
      labelMap[controlMode] ||
      controlMode
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
    canEnable: enableRule ? enableRule.allowed === true : true,
    canDisable: disableRule ? disableRule.allowed === true : true,
    enableUnavailableReason: s(enableRule?.unavailableReason),
    disableUnavailableReason: s(disableRule?.unavailableReason),
  };
}

function buildInboxAutomationControl({
  workspaceReady = false,
  trustLoading = false,
  trustView = null,
  mutation = {},
}) {
  const resolved = resolveInboxPolicyControl(trustView);
  const enabled = resolved.enabled;
  const saving = mutation?.saving === true;

  const targetCanApply = enabled ? resolved.canDisable : resolved.canEnable;
  const unavailableReason = enabled
    ? resolved.disableUnavailableReason
    : resolved.enableUnavailableReason;

  return {
    loading: !workspaceReady || trustLoading,
    saving,
    enabled,
    controlMode: resolved.controlMode,
    statusLabel: resolved.statusLabel,
    disabled:
      !workspaceReady || trustLoading || saving || targetCanApply === false,
    disabledReason: unavailableReason,
    saveError: s(mutation?.error),
    saveSuccess: s(mutation?.success),
    changedAt: resolved.changedAt,
    changedBy: resolved.changedBy,
    policyReason: resolved.policyReason,
  };
}

function LaunchChannelPrompt({ inboxReadiness, onOpenChannels }) {
  return (
    <div className="border-b border-line-soft bg-[rgba(255,248,238,0.92)] px-5 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-text">
            Connect a launch channel first.
          </div>
          <div className="mt-1 text-[13px] leading-6 text-text-muted">
            {s(
              inboxReadiness?.summary,
              "Connect Website chat, Meta, Telegram, or another launch channel to activate the live inbox."
            )}
          </div>
        </div>

        <div className="shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenChannels}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Open channels
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Inbox() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspace = useWorkspaceTenantKey();
  const refreshToken = useLaunchSliceRefreshToken(
    workspace.tenantKey,
    workspace.ready
  );

  const [wsState, setWsState] = useState("idle");
  const [detailOpen, setDetailOpen] = useState(false);
  const [operatorState, setOperatorState] = useState({
    tenantKey: "",
    name: "",
  });
  const [resolvedReadinessState, setResolvedReadinessState] =
    useState(EMPTY_READINESS_STATE);
  const [resolvedTrustState, setResolvedTrustState] =
    useState(EMPTY_TRUST_STATE);
  const [automationMutation, setAutomationMutation] = useState({
    saving: false,
    error: "",
    success: "",
  });

  const requestedThreadId = String(
    location.state?.selectedThreadId || searchParams.get("threadId") || ""
  ).trim();

  useEffect(() => {
    if (!workspace.ready) return undefined;

    let alive = true;

    getAppSessionContext()
      .then((next) => {
        if (!alive) return;
        setOperatorState({
          tenantKey: workspace.tenantKey,
          name: String(next?.actorName || "operator").trim() || "operator",
        });
      })
      .catch(() => {
        if (!alive) return;
        setOperatorState({
          tenantKey: workspace.tenantKey,
          name: "operator",
        });
      });

    return () => {
      alive = false;
    };
  }, [refreshToken, workspace.ready, workspace.tenantKey]);

  const loadOperationalState = useCallback(async () => {
    if (!workspace.ready) return;

    setResolvedTrustState((prev) => ({
      ...prev,
      tenantKey: workspace.tenantKey,
      loading: true,
    }));

    const results = await Promise.allSettled([
      getSettingsTrustView({ limit: 8 }),
      getMetaChannelStatus(),
      getTelegramChannelStatus(),
      getWebsiteWidgetStatus(),
    ]);

    setResolvedReadinessState({
      tenantKey: workspace.tenantKey,
      truth:
        results[0].status === "fulfilled"
          ? buildTruthOperationalState(results[0].value)
          : buildTruthOperationalState(null),
      meta:
        results[1].status === "fulfilled"
          ? buildMetaLaunchChannelState(results[1].value)
          : buildMetaLaunchChannelState({}),
      telegram:
        results[2].status === "fulfilled"
          ? buildTelegramLaunchChannelState(results[2].value)
          : buildTelegramLaunchChannelState({}),
      website:
        results[3].status === "fulfilled"
          ? buildWebsiteLaunchChannelState(results[3].value)
          : buildWebsiteLaunchChannelState({}),
    });

    setResolvedTrustState({
      tenantKey: workspace.tenantKey,
      loading: false,
      trustView: results[0].status === "fulfilled" ? results[0].value : null,
    });
  }, [workspace.ready, workspace.tenantKey]);

  useEffect(() => {
    if (!workspace.ready) return undefined;

    let alive = true;

    Promise.allSettled([
      getSettingsTrustView({ limit: 8 }),
      getMetaChannelStatus(),
      getTelegramChannelStatus(),
      getWebsiteWidgetStatus(),
    ])
      .then((results) => {
        if (!alive) return;

        setResolvedReadinessState({
          tenantKey: workspace.tenantKey,
          truth:
            results[0].status === "fulfilled"
              ? buildTruthOperationalState(results[0].value)
              : buildTruthOperationalState(null),
          meta:
            results[1].status === "fulfilled"
              ? buildMetaLaunchChannelState(results[1].value)
              : buildMetaLaunchChannelState({}),
          telegram:
            results[2].status === "fulfilled"
              ? buildTelegramLaunchChannelState(results[2].value)
              : buildTelegramLaunchChannelState({}),
          website:
            results[3].status === "fulfilled"
              ? buildWebsiteLaunchChannelState(results[3].value)
              : buildWebsiteLaunchChannelState({}),
        });

        setResolvedTrustState({
          tenantKey: workspace.tenantKey,
          loading: false,
          trustView: results[0].status === "fulfilled" ? results[0].value : null,
        });
      })
      .catch(() => {
        if (!alive) return;

        setResolvedReadinessState({
          tenantKey: workspace.tenantKey,
          truth: buildTruthOperationalState(null),
          meta: buildMetaLaunchChannelState({}),
          telegram: buildTelegramLaunchChannelState({}),
          website: buildWebsiteLaunchChannelState({}),
        });

        setResolvedTrustState({
          tenantKey: workspace.tenantKey,
          loading: false,
          trustView: null,
        });
      });

    return () => {
      alive = false;
    };
  }, [workspace.ready, workspace.tenantKey, refreshToken]);

  const operatorName = workspace.ready
    ? (operatorState.tenantKey === workspace.tenantKey
        ? operatorState.name
        : "operator") || "operator"
    : "";

  const readinessState = useMemo(() => {
    if (!workspace.ready) {
      return {
        loading: false,
        truth: null,
        meta: null,
        telegram: null,
        website: null,
      };
    }

    if (resolvedReadinessState.tenantKey !== workspace.tenantKey) {
      return {
        loading: true,
        truth: null,
        meta: null,
        telegram: null,
        website: null,
      };
    }

    return {
      loading: false,
      truth: resolvedReadinessState.truth,
      meta: resolvedReadinessState.meta,
      telegram: resolvedReadinessState.telegram,
      website: resolvedReadinessState.website,
    };
  }, [workspace.ready, workspace.tenantKey, resolvedReadinessState]);

  const trustView = useMemo(() => {
    if (!workspace.ready) return null;
    if (resolvedTrustState.tenantKey !== workspace.tenantKey) return null;
    return resolvedTrustState.trustView;
  }, [workspace.ready, workspace.tenantKey, resolvedTrustState]);

  const inboxAutomationControl = useMemo(
    () =>
      buildInboxAutomationControl({
        workspaceReady: workspace.ready,
        trustLoading:
          resolvedTrustState.loading &&
          resolvedTrustState.tenantKey === workspace.tenantKey,
        trustView,
        mutation: automationMutation,
      }),
    [
      workspace.ready,
      workspace.tenantKey,
      resolvedTrustState.loading,
      resolvedTrustState.tenantKey,
      trustView,
      automationMutation,
    ]
  );

  async function handleToggleInboxAutonomy(nextEnabled) {
    if (!workspace.ready) return;
    if (automationMutation.saving) return;

    setAutomationMutation({
      saving: true,
      error: "",
      success: "",
    });

    try {
      await saveSettingsTrustPolicyControl({
        surface: "inbox",
        controlMode: nextEnabled ? "autonomy_enabled" : "operator_only_mode",
        policyReason: nextEnabled
          ? "Inbox OpenAI autonomy enabled from inbox workspace"
          : "Inbox OpenAI autonomy disabled from inbox workspace",
        operatorNote: nextEnabled
          ? "Inbox automatic OpenAI replies enabled"
          : "Inbox automatic OpenAI replies disabled",
      });

      await loadOperationalState();

      setAutomationMutation({
        saving: false,
        error: "",
        success: nextEnabled
          ? "Inbox automatic replies are enabled."
          : "Inbox automatic replies are disabled.",
      });
    } catch (error) {
      setAutomationMutation({
        saving: false,
        error:
          s(error?.message) || "Failed to update inbox automation control.",
        success: "",
      });
    }
  }

  const {
    threads,
    setThreads,
    messages,
    setMessages,
    selectedThread,
    setSelectedThread,
    relatedLead,
    setRelatedLead,
    surface,
    detailSurface,
    leadSurface,
    actionState,
    loadThreads,
    loadThreadDetail,
    loadMessages,
    loadRelatedLead,
    markRead,
    assignThread,
    activateHandoff,
    releaseHandoff,
    setThreadStatus,
    sendOperatorReply,
    openLeadDetail,
  } = useInboxData({
    operatorName,
    navigate,
    tenantKey: workspace.tenantKey,
    requireTenantScope: true,
  });

  const threadList = useInboxThreadListSurface({
    requestedThreadId,
    threads,
    selectedThread,
    setSelectedThread,
    surface,
    loadThreads,
    loadThreadDetail,
    loadMessages,
    loadRelatedLead,
  });

  const {
    replyText,
    setReplyText,
    composerSurface,
    handleSend,
    handleRelease,
  } = useInboxComposerSurface({
    selectedThread,
    actionState,
    surface,
    sendOperatorReply,
    releaseHandoff,
  });

  const threadAttemptSurface = useThreadOutboundAttemptsSurface({
    threadId: selectedThread?.id || "",
    actor: operatorName || "operator",
  });

  useInboxRealtime({
    selectedThread,
    setWsState,
    setThreads,
    setSelectedThread,
    setMessages,
    loadThreads,
    loadThreadDetail,
    loadRelatedLead,
    setRelatedLead,
  });

  useEffect(() => {
    if (!requestedThreadId) return;
    setSearchParams(
      (prev) => {
        if (prev.get("threadId") === requestedThreadId) return prev;
        const next = new URLSearchParams(prev);
        next.set("threadId", requestedThreadId);
        return next;
      },
      { replace: true }
    );
  }, [requestedThreadId, setSearchParams]);

  useEffect(() => {
    if (selectedThread?.id) {
      loadMessages(selectedThread.id);
      loadRelatedLead(selectedThread.id);
    }
  }, [selectedThread?.id, loadMessages, loadRelatedLead]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") setDetailOpen(false);
    }

    if (!detailOpen) return undefined;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailOpen]);

  const launchChannels = useMemo(
    () => [readinessState.meta, readinessState.telegram, readinessState.website],
    [readinessState.meta, readinessState.telegram, readinessState.website]
  );

  const hasConnectedLaunchChannel = useMemo(
    () => launchChannels.some((item) => item?.connected === true),
    [launchChannels]
  );

  const inboxReadiness = useMemo(
    () =>
      buildChannelTruthLaunchReadiness({
        channels: launchChannels,
        truthState: readinessState.truth,
        surface,
        copy: {
          channelsPath: "/channels",
          truthPath: "/truth",
          unavailableTitle: "Inbox launch posture is unavailable.",
          unavailableSummary:
            "The inbox surface cannot confirm launch posture right now.",
          unavailableDetail:
            "This surface stays intentionally cautious when live inbox data is unavailable.",
          noChannelSummary:
            "Connect Website chat, Meta, Telegram, or another launch channel to activate the live inbox.",
          noChannelDetail:
            "The inbox stays available as a workspace, but live automation should not be trusted before a launch channel is attached.",
          deliveryBlockedSummary:
            "A channel is connected, but delivery is still blocked.",
          deliveryBlockedDetail:
            "The inbox can remain visible, but delivery posture is not healthy enough for launch.",
          truthBlockedApprovalTitle:
            "Inbox is connected, but approved truth still needs approval.",
          truthBlockedRuntimeTitle:
            "Inbox is connected, but runtime still needs repair.",
          truthBlockedDetail:
            "Connected channels alone are not enough. Approved truth and healthy runtime must also be aligned.",
          readyStatusLabel: "Healthy",
          readyTitle: "Inbox launch posture is healthy.",
          readySummary:
            "Channels, approved truth, and runtime are aligned for live inbox operations.",
          readyDetail:
            "The current inbox lane is not blocked by channel, truth, or runtime posture.",
        },
      }),
    [launchChannels, readinessState.truth, surface]
  );

  const surfaceNotice = buildSurfaceNotice(surface);

  return (
    <PageCanvas className="space-y-3 h-full">
      {surfaceNotice ? (
        <InlineNotice
          tone={surfaceNotice.tone}
          title={surfaceNotice.title}
          description={surfaceNotice.description}
          compact
        />
      ) : null}

      <Surface
        padded={false}
        className="overflow-hidden rounded-[22px] h-[calc(100vh-132px)] min-h-[560px]"
      >
        <div className="flex h-full min-h-0 flex-col">
          {!hasConnectedLaunchChannel ? (
            <LaunchChannelPrompt
              inboxReadiness={inboxReadiness}
              onOpenChannels={() => navigate("/channels")}
            />
          ) : null}

          <div className="grid min-h-0 flex-1 overflow-hidden grid-cols-[320px_minmax(0,1fr)] bg-surface">
            <div className="min-h-0 overflow-hidden border-r border-line-soft bg-surface">
              <InboxThreadListPanel
                threadList={threadList}
                selectedThreadId={selectedThread?.id || ""}
                searchQuery=""
              />
            </div>

            <div className="min-h-0 overflow-hidden bg-surface">
              <InboxDetailPanel
                selectedThread={selectedThread}
                messages={messages}
                outboundAttempts={threadAttemptSurface.attempts}
                surface={detailSurface}
                actionState={actionState}
                markRead={markRead}
                assignThread={assignThread}
                activateHandoff={activateHandoff}
                setThreadStatus={setThreadStatus}
                onOpenDetails={() => setDetailOpen(true)}
                automationControl={inboxAutomationControl}
                onToggleAutomation={handleToggleInboxAutonomy}
                composer={
                  <InboxComposer
                    embedded
                    selectedThread={selectedThread}
                    surface={composerSurface}
                    actionState={actionState}
                    replyText={replyText}
                    setReplyText={setReplyText}
                    onSend={handleSend}
                    onReleaseHandoff={handleRelease}
                  />
                }
              />
            </div>

            {detailOpen ? (
              <SlidingDetailOverlay
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                absolute
                closeLabel="Close conversation details"
                panelWidthClassName="max-w-[92vw] w-[360px]"
                className="z-30"
              >
                <InboxLeadPanel
                  selectedThread={selectedThread}
                  surface={leadSurface}
                  relatedLead={relatedLead}
                  openLeadDetail={openLeadDetail}
                  operatorName={operatorName}
                  tenantKey={workspace.tenantKey}
                  wsState={wsState}
                  onClose={() => setDetailOpen(false)}
                />
              </SlidingDetailOverlay>
            ) : null}
          </div>
        </div>
      </Surface>
    </PageCanvas>
  );
}