import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import {
  getMetaChannelStatus,
  getTelegramChannelStatus,
  getWebsiteWidgetStatus,
} from "../api/channelConnect.js";
import { getSettingsTrustView } from "../api/trust.js";
import InboxComposer from "../components/inbox/InboxComposer.jsx";
import { useInboxComposerSurface } from "../components/inbox/hooks/useInboxComposerSurface.js";
import { useInboxThreadListSurface } from "../components/inbox/hooks/useInboxThreadListSurface.js";
import InboxDetailPanel from "../components/inbox/InboxDetailPanel.jsx";
import InboxLeadPanel from "../components/inbox/InboxLeadPanel.jsx";
import InboxThreadListPanel from "../components/inbox/InboxThreadListPanel.jsx";
import { useThreadOutboundAttemptsSurface } from "../components/inbox/hooks/useThreadOutboundAttemptsSurface.js";
import SurfaceBanner from "../components/feedback/SurfaceBanner.jsx";
import { useInboxData } from "../hooks/useInboxData.js";
import { useInboxRealtime } from "../hooks/useInboxRealtime.js";
import { getAppSessionContext } from "../lib/appSession.js";
import {
  buildChannelTruthLaunchReadiness,
  buildMetaLaunchChannelState,
  buildTelegramLaunchChannelState,
  buildWebsiteLaunchChannelState,
  buildTruthOperationalState,
} from "../lib/readinessViewModel.js";
import Button from "../components/ui/Button.jsx";
import {
  SlidingDetailOverlay,
  StatusBanner,
} from "../components/ui/AppShellPrimitives.jsx";
import { s, toneFromReadiness } from "../lib/appUi.js";

function shouldRenderSurfaceBanner(surface) {
  return Boolean(
    surface?.saveSuccess ||
      surface?.saveError ||
      surface?.unavailable ||
      (!surface?.unavailable && surface?.error)
  );
}

export default function Inbox() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [wsState, setWsState] = useState("idle");
  const [tenantKey, setTenantKey] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [readinessState, setReadinessState] = useState({
    loading: true,
    trust: null,
    meta: null,
    telegram: null,
    website: null,
  });

  const requestedThreadId = String(
    location.state?.selectedThreadId || searchParams.get("threadId") || ""
  ).trim();

  useEffect(() => {
    let alive = true;

    getAppSessionContext()
      .then((next) => {
        if (!alive) return;
        setTenantKey(String(next?.tenantKey || "").trim().toLowerCase());
        setOperatorName(
          (prev) => prev || String(next?.actorName || "operator").trim()
        );
      })
      .catch(() => {
        if (!alive) return;
        setOperatorName((prev) => prev || "operator");
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    Promise.allSettled([
      getSettingsTrustView({ limit: 4 }),
      getMetaChannelStatus(),
      getTelegramChannelStatus(),
      getWebsiteWidgetStatus(),
    ])
      .then((results) => {
        if (!alive) return;
        setReadinessState({
          loading: false,
          trust:
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
      })
      .catch(() => {
        if (!alive) return;
        setReadinessState({
          loading: false,
          trust: buildTruthOperationalState(null),
          meta: buildMetaLaunchChannelState({}),
          telegram: buildTelegramLaunchChannelState({}),
          website: buildWebsiteLaunchChannelState({}),
        });
      });

    return () => {
      alive = false;
    };
  }, []);

  const {
    threads,
    setThreads,
    messages,
    setMessages,
    selectedThread,
    setSelectedThread,
    relatedLead,
    setRelatedLead,
    dbDisabled,
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
  } = useInboxData({ operatorName, navigate });

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

  const inboxReadiness = useMemo(
    () =>
      buildChannelTruthLaunchReadiness({
        channels: [
          readinessState.meta,
          readinessState.telegram,
          readinessState.website,
        ],
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
            "No launch channel is currently connected. Connect website chat, Meta, or Telegram before trusting live inbox automation.",
          noChannelDetail:
            "The inbox can still be inspected, but live launch posture is blocked until a launch channel is attached.",
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
          readyStatusLabel: selectedThread?.id ? "Live and ready" : "Launch ready",
          readyTitle: selectedThread?.id
            ? "Inbox launch posture is healthy and a live thread is selected."
            : "Inbox launch posture is healthy.",
          readySummary: selectedThread?.id
            ? "Channels, approved truth, and runtime are aligned for the selected thread."
            : "Channels, approved truth, and runtime are aligned for live inbox operations.",
          readyDetail:
            "The current inbox lane is not blocked by channel, truth, or runtime posture.",
        },
      }),
    [
      readinessState.meta,
      readinessState.telegram,
      readinessState.website,
      readinessState.truth,
      surface,
      selectedThread,
    ]
  );

  const showTopBanner = shouldRenderSurfaceBanner(surface);

  return (
    <section
      aria-labelledby="inbox-surface-title"
      aria-describedby="inbox-surface-description"
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-transparent"
    >
      <header className="sr-only">
        <h1 id="inbox-surface-title">Operator messaging workspace</h1>
        <p id="inbox-surface-description">
          Thread-first triage on the left and the live conversation on the
          right, with details opening as an overlay drawer.
        </p>
        <p>{dbDisabled ? "Fallback mode" : "Live mode"}</p>
      </header>

      {showTopBanner ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center px-4 pt-4">
          <div className="pointer-events-auto w-full max-w-[920px]">
            <SurfaceBanner
              surface={surface}
              unavailableMessage="Inbox operations are temporarily unavailable."
              refreshLabel="Refresh inbox"
            />
          </div>
        </div>
      ) : null}

      <div className="relative flex-1 min-h-0 overflow-hidden rounded-panel border border-line-soft bg-surface">
        <div className="border-b border-line-soft bg-surface-muted px-4 py-4">
          <StatusBanner
            tone={toneFromReadiness(inboxReadiness)}
            label={s(inboxReadiness.statusLabel, "Unknown")}
            title={s(inboxReadiness.title, "Inbox readiness")}
            description={s(inboxReadiness.summary)}
            detail={s(inboxReadiness.detail)}
            action={
              inboxReadiness.action?.path ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (s(inboxReadiness.action?.path)) {
                      navigate(inboxReadiness.action.path);
                    }
                  }}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  {inboxReadiness.action.label}
                </Button>
              ) : null
            }
          />
        </div>

        <div className="relative grid h-[calc(100%-101px)] min-h-0 overflow-hidden grid-cols-[320px_minmax(0,1fr)] bg-surface">
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
                tenantKey={tenantKey}
                wsState={wsState}
                onClose={() => setDetailOpen(false)}
              />
            </SlidingDetailOverlay>
          ) : null}
        </div>
      </div>
    </section>
  );
}
