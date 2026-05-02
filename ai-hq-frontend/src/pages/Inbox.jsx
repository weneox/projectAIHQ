import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { getLaunchPosture } from "../api/launch.js";
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
  InlineNotice,
  LoadingSurface,
  SlidingDetailOverlay,
} from "../components/ui/AppShellPrimitives.jsx";
import Button from "../components/ui/Button.jsx";

const EMPTY_READINESS_STATE = {
  tenantKey: "",
  loading: true,
  error: "",
  posture: null,
  truth: {
    ready: false,
    status: "unavailable",
    reasonCode: "launch_posture_unavailable",
    message: "",
  },
  runtime: {
    ready: false,
    status: "unavailable",
    reasonCode: "launch_posture_unavailable",
    message: "",
  },
  overall: {
    status: "unavailable",
    _launchReady: false,
    title: "",
    message: "",
    primaryAction: { label: "Open channels", path: "/channels" },
  },
  channelSummary: {
    readyCount: 0,
    connectedCount: 0,
    deliveryReadyChannelIds: [],
    selectedChannelId: "",
  },
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

  return null;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function _isSetupTestInboxThread(thread = null) {
  const source = obj(thread);
  const meta = obj(source.meta);

  const channel = lower(
    source.channel ||
      source.channel_type ||
      source.provider ||
      source.source_type
  );

  const externalThreadId = lower(
    source.external_thread_id || source.externalThreadId
  );

  const customerName = lower(
    source.customer_name ||
      source.customerName ||
      source.display_name ||
      source.displayName
  );

  const metaSource = lower(meta.source || meta.testSource || meta.origin);
  const websiteChannel = ["website", "webchat", "web"].includes(channel);

  if (!websiteChannel) return false;

  return (
    externalThreadId.startsWith("website-test:") ||
    customerName.includes("website chat test visitor") ||
    metaSource === "website_chat_setup_test" ||
    metaSource === "website_chat_test"
  );
}


function normalizeNoticeAction(
  action = null,
  fallback = { label: "Open channels", path: "/channels" }
) {
  const source = obj(action);
  const target = obj(source.target);
  const label = s(source.label || fallback.label);
  const path = s(source.path || target.path || fallback.path);

  if (!label && !path) return null;

  return {
    label: label || fallback.label,
    path: path || fallback.path,
  };
}

function buildReadinessStateFromPosture({
  tenantKey = "",
  posture = null,
  error = "",
} = {}) {
  const payload = obj(posture);
  const unavailable = s(error);
  const channelSummary = obj(payload.channelSummary);

  return {
    tenantKey,
    loading: false,
    error: unavailable,
    posture: unavailable ? null : payload,
    truth: unavailable ? EMPTY_READINESS_STATE.truth : obj(payload.truth),
    runtime: unavailable ? EMPTY_READINESS_STATE.runtime : obj(payload.runtime),
    overall: unavailable
      ? {
          ...EMPTY_READINESS_STATE.overall,
          title: "Launch readiness unavailable",
          message:
            "Inbox cannot confirm launch readiness right now, so live replies stay guarded.",
        }
      : obj(payload.overall),
    channelSummary: {
      readyCount: unavailable ? 0 : n(channelSummary.readyCount),
      connectedCount: unavailable ? 0 : n(channelSummary.connectedCount),
      deliveryReadyChannelIds: unavailable
        ? []
        : arr(channelSummary.deliveryReadyChannelIds),
      selectedChannelId: unavailable ? "" : s(channelSummary.selectedChannelId),
    },
  };
}

async function loadInboxLaunchReadinessState(tenantKey = "") {
  try {
    const posture = await getLaunchPosture();

    return buildReadinessStateFromPosture({
      tenantKey,
      posture,
    });
  } catch (error) {
    return buildReadinessStateFromPosture({
      tenantKey,
      error:
        s(error?.message) || "Launch readiness could not be loaded.",
    });
  }
}

async function loadInboxTrustState(tenantKey = "") {
  try {
    return {
      tenantKey,
      loading: false,
      trustView: await getSettingsTrustView({ limit: 8 }),
    };
  } catch {
    return {
      tenantKey,
      loading: false,
      trustView: null,
    };
  }
}

function _buildLaunchReadinessNotice({
  readinessState = EMPTY_READINESS_STATE,
  hasDeliveryReadyLaunchChannel = false,
  truthReady = false,
  runtimeReady = false,
  _launchReady = false,
} = {}) {
  const overall = obj(readinessState.overall);
  const status = lower(overall.status);
  const action = normalizeNoticeAction(overall.primaryAction);
  const postureError = s(readinessState.error);

  if (postureError || status === "unavailable") {
    return {
      tone: "warning",
      title: "Launch readiness unavailable",
      description:
        postureError ||
        s(overall.message) ||
        "Inbox cannot confirm launch readiness right now, so live replies stay guarded.",
      action,
    };
  }

  if (_launchReady) return null;

  if (hasDeliveryReadyLaunchChannel && !truthReady) {
    return {
      tone: "warning",
      title: "Truth approval required",
      description:
        "A channel is live, but approved truth is not ready yet. Approve truth before trusting live AI replies.",
      action,
    };
  }

  if (hasDeliveryReadyLaunchChannel && !runtimeReady) {
    return {
      tone: "warning",
      title: "Runtime repair required",
      description:
        s(readinessState.runtime?.message) ||
        "A channel is live, but runtime is not ready yet. Repair runtime before trusting live AI replies.",
      action,
    };
  }

  return {
    tone: status === "degraded" ? "warning" : "info",
    title: s(overall.title) || "Launch setup required",
    description:
      s(overall.message) ||
      "Finish launch setup before relying on live inbox replies.",
    action,
  };
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
  const [detailThreadId, setDetailThreadId] = useState("");
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
  const [typingState, setTypingState] = useState({});

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


  useEffect(() => {
    if (!workspace.ready) return undefined;

    let alive = true;

    loadInboxLaunchReadinessState(workspace.tenantKey).then(
      (readinessState) => {
        if (!alive) return;
        setResolvedReadinessState(readinessState);
      }
    );

    return () => {
      alive = false;
    };
  }, [workspace.ready, workspace.tenantKey, refreshToken]);

  useEffect(() => {
    if (!workspace.ready) return undefined;

    let alive = true;

    loadInboxTrustState(workspace.tenantKey).then((trustState) => {
      if (!alive) return;
      setResolvedTrustState(trustState);
    });

    return () => {
      alive = false;
    };
  }, [workspace.ready, workspace.tenantKey]);

  useEffect(() => {
    if (!automationMutation.success) return undefined;

    const timer = window.setTimeout(() => {
      setAutomationMutation((prev) =>
        prev.success
          ? {
              ...prev,
              success: "",
            }
          : prev
      );
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [automationMutation.success]);

  const operatorName = workspace.ready
    ? (operatorState.tenantKey === workspace.tenantKey
        ? operatorState.name
        : "operator") || "operator"
    : "";

  const readinessState = useMemo(() => {
    if (!workspace.ready) {
      return {
        loading: false,
        error: "",
        posture: null,
        truth: EMPTY_READINESS_STATE.truth,
        runtime: EMPTY_READINESS_STATE.runtime,
        overall: EMPTY_READINESS_STATE.overall,
        channelSummary: EMPTY_READINESS_STATE.channelSummary,
      };
    }

    if (resolvedReadinessState.tenantKey !== workspace.tenantKey) {
      return {
        loading: true,
        error: "",
        posture: null,
        truth: EMPTY_READINESS_STATE.truth,
        runtime: EMPTY_READINESS_STATE.runtime,
        overall: EMPTY_READINESS_STATE.overall,
        channelSummary: EMPTY_READINESS_STATE.channelSummary,
      };
    }

    return {
      loading: resolvedReadinessState.loading === true,
      error: s(resolvedReadinessState.error),
      posture: resolvedReadinessState.posture,
      truth: resolvedReadinessState.truth,
      runtime: resolvedReadinessState.runtime,
      overall: resolvedReadinessState.overall,
      channelSummary: resolvedReadinessState.channelSummary,
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


  const loadOperationalState = useCallback(async () => {
    if (!workspace.ready) return;

    setResolvedReadinessState((prev) => ({
      ...prev,
      tenantKey: workspace.tenantKey,
      loading: true,
      error: "",
    }));

    setResolvedTrustState((prev) => ({
      ...prev,
      tenantKey: workspace.tenantKey,
      loading: true,
    }));

    const [readinessState, trustState] = await Promise.all([
      loadInboxLaunchReadinessState(workspace.tenantKey),
      loadInboxTrustState(workspace.tenantKey),
    ]);

    setResolvedReadinessState(readinessState);
    setResolvedTrustState(trustState);
  }, [workspace.ready, workspace.tenantKey]);

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
          ? "Inbox AI Autopilot enabled from inbox global control"
          : "Inbox AI Autopilot disabled from inbox global control",
        operatorNote: nextEnabled
          ? "Inbox automatic AI replies enabled globally"
          : "Inbox automatic AI replies disabled globally",
      });

      await loadOperationalState();

      setAutomationMutation({
        saving: false,
        error: "",
        success: "",
      });
    } catch (error) {
      setAutomationMutation({
        saving: false,
        error:
          s(error?.message) || "Failed to update inbox AI Autopilot.",
        success: "",
      });
    }
  }


  const {
    threads,
    setThreads,
    messages,
    messagesThreadId,
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
    syncSelected,
    loadThreadDetail,
    loadMessages,
    loadRelatedLead,
    markRead,
    assignThread,
    activateHandoff,
    releaseHandoff,
    setThreadStatus,
    sendOperatorReply,
  } = useInboxData({
    operatorName,
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
    syncSelected,
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
    syncSelected,
    loadThreadDetail,
    loadRelatedLead,
    setRelatedLead,
    setTypingState,
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

  const selectedThreadSyncKey = useMemo(() => {
    const thread = obj(selectedThread);
    const threadId = s(thread.id);
    if (!threadId) return "";

    return [
      threadId,
      s(thread.last_message_at || thread.lastMessageAt),
      s(thread.last_inbound_at || thread.lastInboundAt),
      s(thread.last_outbound_at || thread.lastOutboundAt),
      s(thread.updated_at || thread.updatedAt),
      String(n(thread.unread_count ?? thread.unreadCount, 0)),
    ].join("|");
  }, [selectedThread]);

  const lastSelectedThreadSyncKeyRef = useRef("");

  useEffect(() => {
    const threadId = s(selectedThread?.id);

    if (!threadId) {
      lastSelectedThreadSyncKeyRef.current = "";
      return;
    }

    if (!selectedThreadSyncKey) return;
    if (lastSelectedThreadSyncKeyRef.current === selectedThreadSyncKey) return;

    lastSelectedThreadSyncKeyRef.current = selectedThreadSyncKey;

    Promise.resolve(
      syncSelected(threadId, {
        force: true,
        reason: "selected_thread_version_changed",
      })
    ).catch(() => {
      // Best-effort detail sync. The visible inbox keeps its current state on failure.
    });
  }, [selectedThread?.id, selectedThreadSyncKey, syncSelected]);

  const detailOpen =
    Boolean(selectedThread?.id) && detailThreadId === selectedThread?.id;

  const selectedThreadId = s(selectedThread?.id);
  const messagesInSync =
    !selectedThreadId || s(messagesThreadId) === selectedThreadId;
  const visibleThreadMessages = messagesInSync ? messages : [];
  const hasVisibleMessages =
    Array.isArray(visibleThreadMessages) && visibleThreadMessages.length > 0;

  const detailPanelSurface = {
    ...detailSurface,
    loading:
      Boolean(selectedThreadId && !messagesInSync) ||
      Boolean(detailSurface.loading && !hasVisibleMessages),
  };

  const selectedThreadAiPaused = Boolean(selectedThread?.handoff_active);
  const selectedThreadAiEnabled =
    inboxAutomationControl.enabled === true && !selectedThreadAiPaused;
  const selectedThreadAiSaving = Boolean(
    actionState?.isActionPending?.("handoff") ||
      actionState?.isActionPending?.("release")
  );

  const handleToggleThreadAi = useCallback(
    async (nextEnabled) => {
      const threadId = s(selectedThread?.id);
      if (!threadId) return;

      if (nextEnabled) {
        await releaseHandoff(threadId, { silent: true });
        return;
      }

      await activateHandoff(threadId, { silent: true });
    },
    [activateHandoff, releaseHandoff, selectedThread?.id]
  );

  const threadAutomationControl = useMemo(
    () => ({
      enabled: selectedThreadAiEnabled,
      saving: selectedThreadAiSaving,
      disabled:
        !selectedThread?.id ||
        selectedThreadAiSaving ||
        inboxAutomationControl.enabled !== true,
      disabledReason:
        inboxAutomationControl.enabled !== true
          ? "Inbox AI Autopilot global olaraq sÃ¶ndÃ¼rÃ¼lÃ¼b."
          : selectedThreadAiEnabled
            ? "AI bu sÃ¶hbÉ™tdÉ™ cavab verÉ™ bilÉ™r."
            : "Operator rejimi. AI bu sÃ¶hbÉ™tdÉ™ cavab vermir.",
      statusLabel: selectedThreadAiEnabled ? "AI ON" : "AI OFF",
      scopeLabel: "Bu sÃ¶hbÉ™tdÉ™ AI",
    }),
    [
      inboxAutomationControl.enabled,
      selectedThread?.id,
      selectedThreadAiEnabled,
      selectedThreadAiSaving,
    ]
  );

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") setDetailThreadId("");
    }

    if (!detailOpen) return undefined;

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailOpen]);

  const hasDeliveryReadyLaunchChannel = useMemo(
    () =>
      n(readinessState.channelSummary?.readyCount) > 0 ||
      arr(readinessState.channelSummary?.deliveryReadyChannelIds).length > 0,
    [readinessState.channelSummary]
  );

  const truthReady = useMemo(
    () =>
      readinessState.truth?.ready === true &&
      lower(readinessState.truth?.status) === "ready",
    [readinessState.truth]
  );

  const runtimeReady = useMemo(
    () =>
      readinessState.runtime?.ready === true &&
      lower(readinessState.runtime?.status) === "ready",
    [readinessState.runtime]
  );

  const _launchReady =
    readinessState.overall?._launchReady === true &&
    truthReady &&
    runtimeReady &&
    hasDeliveryReadyLaunchChannel;
  const visibleLaunchReadinessNotice = null;
  const surfaceNotice = buildSurfaceNotice(surface);
  const inboxInitializing = !workspace.ready || readinessState.loading;

  if (inboxInitializing) {
    return (
      <div className="h-full min-h-0 w-full bg-white">
        <LoadingSurface title="Loading inbox" />
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-white">
      {surfaceNotice || visibleLaunchReadinessNotice ? (
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 px-4 pt-3">
          <div className="pointer-events-auto flex flex-col gap-2">
            {surfaceNotice ? (
              <InlineNotice
                tone={surfaceNotice.tone}
                title={surfaceNotice.title}
                description={surfaceNotice.description}
                compact
              />
            ) : null}

            {visibleLaunchReadinessNotice ? (
              <InlineNotice
                tone={visibleLaunchReadinessNotice.tone}
                title={visibleLaunchReadinessNotice.title}
                description={visibleLaunchReadinessNotice.description}
                action={
                  visibleLaunchReadinessNotice.action ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const path = s(visibleLaunchReadinessNotice.action?.path);
                        navigate(path.startsWith("/") ? path : "/channels");
                      }}
                    >
                      {visibleLaunchReadinessNotice.action.label}
                    </Button>
                  ) : null
                }
                compact
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid h-full min-h-0 grid-cols-[420px_minmax(0,1fr)] bg-white">
        <div className="min-h-0 overflow-hidden border-r border-line-soft bg-white">
          <InboxThreadListPanel
            threadList={threadList}
            selectedThreadId={selectedThread?.id || ""}
            searchQuery=""
            launchChannelConnected={hasDeliveryReadyLaunchChannel}
            automationControl={inboxAutomationControl}
            onToggleAutomation={handleToggleInboxAutonomy}
          />
        </div>

        <div className="min-h-0 overflow-hidden bg-white">
          <InboxDetailPanel
            selectedThread={selectedThread}
            messages={visibleThreadMessages}
            outboundAttempts={threadAttemptSurface.attempts}
            typingState={typingState}
            surface={detailPanelSurface}
            actionState={actionState}
            markRead={markRead}
            assignThread={assignThread}
            activateHandoff={activateHandoff}
            setThreadStatus={setThreadStatus}
            onOpenDetails={() => {
              if (selectedThread?.id) {
                setDetailThreadId(selectedThread.id);
              }
            }}
            automationControl={threadAutomationControl}
            onToggleAutomation={handleToggleThreadAi}
            launchChannelConnected={hasDeliveryReadyLaunchChannel}
            onOpenChannels={() => navigate("/channels")}
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
                aiReplyEnabled={inboxAutomationControl.enabled}
                threadAiEnabled={selectedThreadAiEnabled}
                threadAiPaused={selectedThreadAiPaused}
                threadAiSaving={selectedThreadAiSaving}
                onToggleThreadAi={handleToggleThreadAi}
              />
            }
          />
        </div>
      </div>

      {detailOpen ? (
        <SlidingDetailOverlay
          open={detailOpen}
          onClose={() => setDetailThreadId("")}
          absolute
          closeLabel="Close conversation details"
          panelWidthClassName="max-w-[96vw] w-[380px]"
          className="z-40"
          backdropClassName="bg-transparent"
          panelClassName="bg-white shadow-[0_24px_80px_-42px_rgba(15,23,42,0.28)]"
        >
          <InboxLeadPanel
            selectedThread={selectedThread}
            surface={leadSurface}
            relatedLead={relatedLead}
            operatorName={operatorName}
            tenantKey={workspace.tenantKey}
            wsState={wsState}
            onClose={() => setDetailThreadId("")}
          />
        </SlidingDetailOverlay>
      ) : null}
    </div>
  );
}




