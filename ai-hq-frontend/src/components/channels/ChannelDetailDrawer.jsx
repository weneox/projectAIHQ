import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  disconnectMetaChannel,
  getMetaChannelStatus,
  getMetaConnectUrl,
  selectMetaChannelCandidate,
} from "../../api/channelConnect.js";
import { cx } from "../../lib/cx.js";
import ChannelIcon from "./ChannelIcon.jsx";
import {
  ChannelActionButton,
  ChannelCapabilityLine,
  ChannelStatus,
} from "./ChannelPrimitives.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function isInstagramChannel(channel = {}) {
  return s(channel?.id).toLowerCase() === "instagram";
}

function buildInstagramStateCopy(status = {}) {
  if (status?.pendingSelection?.required === true) {
    return {
      title: "Instagram account selection is required before this tenant can connect.",
      body:
        "Meta returned more than one eligible Instagram Business or Professional asset. The tenant stays unbound until one account is explicitly selected below.",
    };
  }

  switch (s(status?.state)) {
    case "connected":
      return {
        title: "Instagram is connected for this tenant.",
        body:
          "Inbound DMs can resolve against the tenant runtime, and AI replies are allowed only when the runtime stays ready.",
      };
    case "reconnect_required":
      return {
        title: "Instagram needs reconnect before automation can resume.",
        body:
          "The tenant record exists, but a critical identifier or page access token is missing, so the system stays fail-closed.",
      };
    case "deauthorized":
      return {
        title: "Meta deauthorized this tenant connection.",
        body:
          "The previous tenant mapping was preserved for auditability, but live identifiers and token-backed delivery were revoked.",
      };
    case "disconnected":
      return {
        title: "Instagram was intentionally disconnected.",
        body:
          "No live runtime path remains until the tenant reconnects the account.",
      };
    case "blocked":
      return {
        title: "Instagram connect is blocked.",
        body:
          "Self-serve onboarding is blocked by plan or configuration, and the platform is not pretending otherwise.",
      };
    default:
      return {
        title: "Instagram is not connected yet.",
        body:
          "Start the DM-first connection flow to bind one Instagram Business or Professional account to this tenant.",
      };
  }
}

function buildUserTokenStatusCopy(userToken = {}) {
  switch (s(userToken?.status)) {
    case "expired":
      return "Expired";
    case "expiring_soon":
      return "Expires soon";
    case "valid":
      return "Valid";
    default:
      return "Unknown";
  }
}

function RuntimePill({ ready, label }) {
  return (
    <div
      className={cx(
        "rounded-[16px] border px-3 py-3",
        ready
          ? "border-[rgba(var(--color-success),0.22)] bg-[rgba(var(--color-success),0.08)]"
          : "border-[rgba(var(--color-warning),0.22)] bg-[rgba(var(--color-warning),0.08)]"
      )}
    >
      <div className="flex items-center gap-2 text-[12px] font-semibold text-text">
        {ready ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-warning" />
        )}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-[12px] leading-6 text-text-muted">
        {ready ? "Ready" : "Blocked"}
      </div>
    </div>
  );
}

function FeedbackBanner({ tone = "success", children }) {
  return (
    <div
      className={cx(
        "rounded-[18px] border px-4 py-3 text-[13px] leading-6",
        tone === "danger"
          ? "border-[rgba(var(--color-danger),0.2)] bg-[rgba(var(--color-danger),0.08)] text-danger"
          : tone === "warning"
          ? "border-[rgba(var(--color-warning),0.22)] bg-[rgba(var(--color-warning),0.08)] text-warning"
          : "border-[rgba(var(--color-success),0.22)] bg-[rgba(var(--color-success),0.08)] text-success"
      )}
    >
      {children}
    </div>
  );
}

function BlockerList({ items = [] }) {
  if (!items.length) return null;

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={`${s(item?.reasonCode) || "blocker"}-${index}`}
          className="rounded-[18px] border border-[rgba(var(--color-warning),0.18)] bg-[rgba(var(--color-warning),0.08)] px-4 py-3"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-text">
                {s(item?.title, "Runtime blocker")}
              </div>
              <div className="mt-1 text-[12px] leading-6 text-text-muted">
                {s(item?.subtitle || item?.message || item?.description)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PendingSelectionPanel({
  pendingSelection = null,
  isLoading = false,
  selectingCandidateId = "",
  onSelect,
}) {
  const candidates = arr(pendingSelection?.candidates);
  if (pendingSelection?.required !== true || !candidates.length) return null;

  return (
    <section className="rounded-[22px] border border-line bg-surface px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
        Account selection
      </div>
      <div className="mt-3 text-[18px] font-semibold tracking-[-0.04em] text-text">
        Choose which Instagram Business account belongs to this tenant.
      </div>
      <p className="mt-3 text-[13px] leading-7 text-text-muted">
        The tenant is still not connected. Final binding only happens after you choose one
        account from the Meta callback results.
      </p>
      <div className="mt-3 text-[12px] leading-6 text-text-muted">
        Selection session expires at: {s(pendingSelection?.expiresAt, "Not available")}
      </div>
      <div className="mt-4 space-y-3">
        {candidates.map((candidate) => {
          const isSelecting = selectingCandidateId === s(candidate?.id);

          return (
            <div
              key={s(candidate?.id)}
              className="rounded-[18px] border border-line bg-white px-4 py-4"
            >
              <div className="text-[15px] font-semibold text-text">
                {s(candidate?.displayName, "Instagram")}
              </div>
              <div className="mt-2 space-y-1 text-[12px] leading-6 text-text-muted">
                <div>
                  <span className="font-semibold text-text">Page:</span>{" "}
                  {s(candidate?.pageName, "Not available")}
                </div>
                <div>
                  <span className="font-semibold text-text">Instagram handle:</span>{" "}
                  {s(candidate?.igUsername, "Not available")}
                </div>
                <div>
                  <span className="font-semibold text-text">Instagram user id:</span>{" "}
                  {s(candidate?.igUserId, "Not available")}
                </div>
              </div>
              <div className="mt-4">
                <ChannelActionButton
                  fullWidth
                  showArrow={false}
                  onClick={() => onSelect?.(candidate)}
                  isLoading={isLoading && isSelecting}
                  disabled={isLoading}
                  ariaLabel={`Select ${s(candidate?.displayName, "Instagram")}`}
                >
                  Select this account
                </ChannelActionButton>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function ChannelDetailDrawer({
  channel,
  open = false,
  onClose,
  onNavigate,
}) {
  const isInstagram = isInstagramChannel(channel);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectingCandidateId, setSelectingCandidateId] = useState("");

  const metaStatusQuery = useQuery({
    queryKey: ["meta-channel-status"],
    queryFn: getMetaChannelStatus,
    enabled: open && isInstagram,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const connectMutation = useMutation({
    mutationFn: getMetaConnectUrl,
    onSuccess(payload) {
      const url = s(payload?.url);
      if (url && typeof window !== "undefined" && window.location) {
        window.location.assign(url);
      }
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectMetaChannel,
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: ["meta-channel-status"] });
    },
  });

  const selectionMutation = useMutation({
    mutationFn: selectMetaChannelCandidate,
    async onSuccess() {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("meta_connected", "1");
      nextParams.delete("meta_selection");
      nextParams.delete("meta_error");
      nextParams.set("section", "channels");
      nextParams.set("channel", "instagram");
      setSearchParams(nextParams);
      await queryClient.invalidateQueries({ queryKey: ["meta-channel-status"] });
      setSelectingCandidateId("");
    },
    onError() {
      setSelectingCandidateId("");
    },
  });

  function clearFeedbackParams() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("meta_connected");
    nextParams.delete("meta_selection");
    nextParams.delete("meta_error");
    nextParams.delete("section");
    setSearchParams(nextParams);
  }

  function handleClose() {
    clearFeedbackParams();
    onClose?.();
  }

  function handlePrimaryAction() {
    if (!isInstagram) return;

    if (metaStatusQuery.data?.pendingSelection?.required === true) {
      return;
    }

    if (s(metaStatusQuery.data?.state) === "connected") {
      onNavigate?.("/inbox");
      return;
    }

    connectMutation.mutate();
  }

  const feedback = {
    connected: searchParams.get("meta_connected") === "1",
    selection: searchParams.get("meta_selection") === "1",
    error: s(searchParams.get("meta_error")),
  };
  const actionError = s(
    connectMutation.error?.message ||
      selectionMutation.error?.message ||
      disconnectMutation.error?.message
  );

  const effectiveStatus = isInstagram
    ? s(metaStatusQuery.data?.state || channel?.status || "ready")
    : s(channel?.status || "phase2");

  const instagramCopy = buildInstagramStateCopy(metaStatusQuery.data || {});
  const blockers = arr(metaStatusQuery.data?.readiness?.blockers);
  const reviewScopes = arr(metaStatusQuery.data?.review?.requestedScopes);
  const reviewExcludedScopes = arr(metaStatusQuery.data?.review?.excludedScopes);
  const pendingSelection = metaStatusQuery.data?.pendingSelection || null;
  const pendingSelectionRequired = pendingSelection?.required === true;
  const attentionItems = arr(metaStatusQuery.data?.attention?.items);
  const userToken = metaStatusQuery.data?.lifecycle?.userToken || {};
  const showReconnectButton =
    isInstagram &&
    s(metaStatusQuery.data?.state) === "connected" &&
    metaStatusQuery.data?.actions?.reconnectAvailable === true &&
    metaStatusQuery.data?.actions?.reconnectRecommended === true;

  const primaryLabel = useMemo(() => {
    if (!isInstagram) return "Phase 2";
    if (pendingSelectionRequired) return "Choose account below";
    if (s(metaStatusQuery.data?.state) === "connected") return "Open inbox";
    if (s(metaStatusQuery.data?.state) === "reconnect_required") return "Reconnect Instagram";
    if (s(metaStatusQuery.data?.state) === "deauthorized") return "Reconnect Instagram";
    if (s(metaStatusQuery.data?.state) === "disconnected") return "Reconnect Instagram";
    return "Connect Instagram";
  }, [isInstagram, metaStatusQuery.data, pendingSelectionRequired]);

  function handleCandidateSelect(candidate) {
    const selectionToken = s(pendingSelection?.selectionToken);
    const candidateId = s(candidate?.id);
    if (!selectionToken || !candidateId) return;

    setSelectingCandidateId(candidateId);
    selectionMutation.mutate({
      selectionToken,
      candidateId,
    });
  }

  return (
    <aside
      aria-hidden={!open}
      className={cx(
        "flex h-full flex-col overflow-hidden rounded-[30px] border border-line bg-white shadow-[0_28px_64px_-38px_rgba(15,23,42,0.28)] transition duration-fast ease-premium",
        open ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line-soft px-5 py-4">
        <div className="flex min-w-0 items-center gap-4">
          <ChannelIcon channel={channel} size="lg" />
          <div className="min-w-0">
            <div className="truncate text-[20px] font-semibold tracking-[-0.05em] text-text">
              {channel?.name}
            </div>
            <div className="mt-2">
              <ChannelStatus status={effectiveStatus} />
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Close channel details"
          onClick={handleClose}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-line bg-surface text-text-muted transition duration-fast ease-premium hover:border-line-strong hover:bg-surface-muted hover:text-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {feedback.connected ? (
          <FeedbackBanner>
            Instagram connected successfully. The tenant channel is now bound to the selected account and the status below reflects the live runtime state.
          </FeedbackBanner>
        ) : null}

        {(pendingSelectionRequired ||
          (feedback.selection && metaStatusQuery.isLoading)) ? (
          <FeedbackBanner tone="warning">
            Meta found more than one eligible Instagram Business or Professional asset. Choose
            the correct account below before this tenant becomes connected.
          </FeedbackBanner>
        ) : null}

        {feedback.error ? (
          <FeedbackBanner tone="danger">{feedback.error}</FeedbackBanner>
        ) : null}

        {actionError ? (
          <FeedbackBanner tone="danger">{actionError}</FeedbackBanner>
        ) : null}

        {attentionItems.map((item, index) => (
          <FeedbackBanner
            key={`${s(item?.reasonCode) || "attention"}-${index}`}
            tone="warning"
          >
            <span className="font-semibold">{s(item?.title, "Reconnect recommended")}</span>{" "}
            {s(item?.subtitle)}
          </FeedbackBanner>
        ))}

        <section className="rounded-[22px] border border-line bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
            Summary
          </div>
          <div className="mt-3 text-[20px] font-semibold tracking-[-0.05em] text-text">
            {isInstagram ? instagramCopy.title : channel?.detailSummary}
          </div>
          <p className="mt-3 text-[13px] leading-7 text-text-muted">
            {isInstagram ? instagramCopy.body : channel?.detailNote}
          </p>
          <div className="mt-4">
            <ChannelCapabilityLine capabilities={channel?.capabilities || []} />
          </div>
        </section>

        {isInstagram ? (
          <>
            <section className="rounded-[22px] border border-line bg-surface px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                Runtime
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <RuntimePill
                  ready={metaStatusQuery.data?.runtime?.webhookReady === true}
                  label="Webhook intake"
                />
                <RuntimePill
                  ready={metaStatusQuery.data?.runtime?.deliveryReady === true}
                  label="AI reply delivery"
                />
              </div>
              <div className="mt-4 text-[12px] leading-6 text-text-muted">
                {metaStatusQuery.isLoading
                  ? "Loading tenant runtime state..."
                  : s(
                      metaStatusQuery.data?.readiness?.message,
                      "Runtime state unavailable."
                    )}
              </div>
            </section>

            <section className="rounded-[22px] border border-line bg-surface px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                Connected account
              </div>
              <div className="mt-4 space-y-3 text-[13px] leading-6 text-text-muted">
                <div>
                  <span className="font-semibold text-text">Display:</span>{" "}
                  {s(metaStatusQuery.data?.account?.displayName, "Not connected")}
                </div>
                <div>
                  <span className="font-semibold text-text">Instagram handle:</span>{" "}
                  {s(metaStatusQuery.data?.account?.username, "Not available")}
                </div>
                <div>
                  <span className="font-semibold text-text">Instagram user id:</span>{" "}
                  {s(metaStatusQuery.data?.account?.igUserId, "Not available")}
                </div>
                <div>
                  <span className="font-semibold text-text">Meta app user id:</span>{" "}
                  {s(metaStatusQuery.data?.account?.metaUserId, "Not available")}
                </div>
                <div>
                  <span className="font-semibold text-text">User token status:</span>{" "}
                  {buildUserTokenStatusCopy(userToken)}
                </div>
                <div>
                  <span className="font-semibold text-text">User token expires at:</span>{" "}
                  {s(
                    userToken?.expiresAt ||
                      metaStatusQuery.data?.lifecycle?.userTokenExpiresAt,
                    "Not available"
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[22px] border border-line bg-surface px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                Review-aligned permission model
              </div>
              <div className="mt-3 text-[13px] leading-7 text-text-muted">
                {s(
                  metaStatusQuery.data?.review?.story,
                  "Businesses connect their own Instagram account and the platform manages inbound customer conversations."
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {reviewScopes.map((scope) => (
                  <span
                    key={scope}
                    className="rounded-full border border-line bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle"
                  >
                    {scope}
                  </span>
                ))}
              </div>
              {reviewExcludedScopes.length ? (
                <>
                  <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                    Explicitly out of launch scope
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {reviewExcludedScopes.map((scope) => (
                      <span
                        key={scope}
                        className="rounded-full border border-line bg-[rgba(148,163,184,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
            </section>

            <PendingSelectionPanel
              pendingSelection={pendingSelection}
              isLoading={selectionMutation.isPending}
              selectingCandidateId={selectingCandidateId}
              onSelect={handleCandidateSelect}
            />

            <BlockerList items={blockers} />
          </>
        ) : (
          <section className="rounded-[22px] border border-line bg-surface px-4 py-4 text-[13px] leading-7 text-text-muted">
            This connector is intentionally marked as phase 2. It stays visible as roadmap context, but it is not part of the DM-first launch path and does not expose a self-serve connect flow.
          </section>
        )}
      </div>

      <div className="border-t border-line-soft px-5 py-4">
        <div className="flex flex-col gap-3">
          <ChannelActionButton
            fullWidth
            onClick={handlePrimaryAction}
            isLoading={
              connectMutation.isPending ||
              selectionMutation.isPending ||
              metaStatusQuery.isFetching
            }
            disabled={
              !isInstagram ||
              connectMutation.isPending ||
              selectionMutation.isPending ||
              pendingSelectionRequired ||
              (s(metaStatusQuery.data?.state) !== "connected" &&
                metaStatusQuery.data?.actions?.connectAvailable === false)
            }
          >
            {primaryLabel}
          </ChannelActionButton>

          <div className="flex gap-3">
            {showReconnectButton ? (
              <ChannelActionButton
                quiet
                fullWidth
                showArrow={false}
                onClick={() => connectMutation.mutate()}
                isLoading={connectMutation.isPending}
                disabled={connectMutation.isPending || selectionMutation.isPending}
              >
                Reconnect
              </ChannelActionButton>
            ) : null}

            {isInstagram ? (
              <ChannelActionButton
                quiet
                fullWidth
                showArrow={false}
                onClick={() => disconnectMutation.mutate()}
                isLoading={disconnectMutation.isPending}
                disabled={!metaStatusQuery.data?.actions?.disconnectAvailable}
              >
                {pendingSelectionRequired ? "Cancel selection" : "Disconnect"}
              </ChannelActionButton>
            ) : null}

            <ChannelActionButton
              quiet
              fullWidth
              showArrow={false}
              onClick={() => metaStatusQuery.refetch?.()}
              disabled={!isInstagram}
              isLoading={metaStatusQuery.isFetching}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </ChannelActionButton>
          </div>
        </div>
      </div>
    </aside>
  );
}
