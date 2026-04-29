import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

import {
  connectTelegramChannel,
  disconnectTelegramChannel,
  disconnectMetaChannel,
  getTelegramChannelStatus,
  getMetaChannelStatus,
  getMetaConnectUrl,
  selectMetaChannelCandidate,
} from "../../api/channelConnect.js";
import {
  buildWorkspaceScopedQueryKey,
  useWorkspaceTenantKey,
} from "../../hooks/useWorkspaceTenantKey.js";
import { emitLaunchSliceRefresh } from "../../lib/launchSliceRefresh.js";
import { cx } from "../../lib/cx.js";
import ChannelIcon from "./ChannelIcon.jsx";
import { getChannelStatusMeta } from "./channelCatalogModel.js";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import Card from "../ui/Card.jsx";
import { InlineNotice } from "../ui/AppShellPrimitives.jsx";
import WebsiteWidgetDetailDrawer from "./WebsiteWidgetDetailDrawer.jsx";

const BOTFATHER_URL = "https://t.me/BotFather";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function isInstagramChannel(channel = {}) {
  return s(channel?.id).toLowerCase() === "instagram";
}

function isTelegramChannel(channel = {}) {
  return s(channel?.id).toLowerCase() === "telegram";
}

function isWebsiteChannel(channel = {}) {
  return ["website", "webchat"].includes(s(channel?.id).toLowerCase());
}

function buildInstagramStateCopy(status = {}) {
  if (status?.pendingSelection?.required === true) {
    return {
      title: "Instagram account selection is required.",
      body:
        "Meta returned more than one eligible Instagram Business or Professional asset. Choose one account before this tenant becomes connected.",
    };
  }

  switch (s(status?.state)) {
    case "connected":
      return {
        title: "Instagram is connected.",
        body:
          "Inbound DMs can resolve against tenant runtime, and AI replies are allowed only while runtime stays ready.",
      };
    case "reconnect_required":
      return {
        title: "Instagram needs reconnect.",
        body:
          "The tenant record exists, but a critical identifier or delivery token is missing. Automation stays fail-closed until reconnect completes.",
      };
    case "deauthorized":
      return {
        title: "Meta deauthorized this connection.",
        body:
          "The previous tenant mapping is preserved for auditability, but live identifiers and token-backed delivery were revoked.",
      };
    case "disconnected":
      return {
        title: "Instagram was disconnected.",
        body: "No live runtime path remains until the account is reconnected.",
      };
    case "blocked":
      return {
        title: "Instagram connect is blocked.",
        body:
          "Self-serve onboarding is blocked by plan or configuration. The platform is not pretending otherwise.",
      };
    default:
      return {
        title: "Instagram is not connected yet.",
        body:
          "Start the DM-first connection flow to bind one Instagram Business or Professional account to this tenant.",
      };
  }
}

function buildTelegramStateCopy(status = {}) {
  switch (s(status?.state)) {
    case "connected":
      return {
        title: "Telegram is connected.",
        body:
          "Private text messages can enter the shared inbox/runtime flow, and outbound replies stay truthful to webhook and runtime readiness.",
      };
    case "connecting":
      return {
        title: "Telegram is finishing setup.",
        body:
          "The bot token was accepted, but webhook verification or runtime readiness still needs to settle.",
      };
    case "error":
      return {
        title: "Telegram needs repair.",
        body:
          "A tenant channel record exists, but bot auth, webhook verification, or runtime readiness is not healthy enough for live delivery.",
      };
    case "disconnected":
      return {
        title: "Telegram was disconnected.",
        body:
          "The stored bot token and webhook secrets were removed. No live Telegram delivery path remains until reconnect completes.",
      };
    case "blocked":
      return {
        title: "Telegram connect is blocked.",
        body:
          "Environment or product policy is preventing Telegram from being used safely for this tenant.",
      };
    default:
      return {
        title: "Telegram is not connected yet.",
        body:
          "Use an existing bot token or create a new bot in BotFather, then finish validation here.",
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

function badgeToneFromStatus(status) {
  const meta = getChannelStatusMeta(status);

  if (meta?.tone === "success") return "success";
  if (meta?.tone === "warning") return "warning";
  if (meta?.tone === "danger") return "danger";
  if (meta?.tone === "info") return "brand";
  return "neutral";
}

function dotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand" || tone === "info") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

function DrawerStatus({ status }) {
  const meta = getChannelStatusMeta(status);
  const tone = badgeToneFromStatus(status);

  return (
    <Badge tone={tone} size="sm">
      <span className={cx("h-1.5 w-1.5 rounded-full", dotClass(tone))} />
      {meta?.label || "Unknown"}
    </Badge>
  );
}

function SectionCard({ eyebrow, title, description, children, tone = "neutral" }) {
  return (
    <Card padded="md" tone={tone}>
      {eyebrow ? (
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
          {eyebrow}
        </div>
      ) : null}

      {title ? (
        <div className="mt-1 text-[18px] font-semibold leading-6 tracking-[var(--tracking-tight-lg)] text-text">
          {title}
        </div>
      ) : null}

      {description ? (
        <div className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
          {description}
        </div>
      ) : null}

      {children ? <div className={title || description || eyebrow ? "mt-4" : ""}>{children}</div> : null}
    </Card>
  );
}

function FeedbackBanner({ tone = "success", children }) {
  return (
    <InlineNotice
      tone={tone === "danger" ? "danger" : tone === "warning" ? "warning" : "success"}
      description={children}
      compact
    />
  );
}

function CapabilityBadge({ children }) {
  return (
    <Badge tone="neutral" size="sm">
      {children}
    </Badge>
  );
}

function ScopeBadge({ children, muted = false }) {
  return (
    <Badge tone={muted ? "neutral" : "brand"} size="sm">
      {children}
    </Badge>
  );
}

function RuntimeRow({ ready, label, description }) {
  const tone = ready ? "success" : "warning";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-line-soft py-4 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {ready ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" strokeWidth={2.1} />
          ) : (
            <ShieldAlert className="h-4 w-4 shrink-0 text-warning" strokeWidth={2.1} />
          )}

          <div className="truncate text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
            {label}
          </div>
        </div>

        {description ? (
          <div className="mt-1 pl-6 text-[13px] font-medium leading-6 text-text-muted">
            {description}
          </div>
        ) : null}
      </div>

      <Badge tone={tone} size="sm">
        <span className={cx("h-1.5 w-1.5 rounded-full", dotClass(tone))} />
        {ready ? "Ready" : "Blocked"}
      </Badge>
    </div>
  );
}

function DataRow({ label, value }) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-4 border-b border-line-soft py-3 last:border-b-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
        {label}
      </div>

      <div
        title={s(value)}
        className="min-w-0 break-words text-[13px] font-medium leading-6 text-text"
      >
        {s(value, "Not available")}
      </div>
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
    <SectionCard
      tone="warning"
      eyebrow="Account selection"
      title="Choose the Instagram account for this tenant."
      description="The tenant is not connected yet. Final binding only happens after one account is selected from the Meta callback results."
    >
      <div className="text-[12.5px] font-medium leading-6 text-text-muted">
        Selection session expires at {s(pendingSelection?.expiresAt, "Not available")}.
      </div>

      <div className="mt-4 space-y-3">
        {candidates.map((candidate) => {
          const candidateId = s(candidate?.id);
          const isSelecting = selectingCandidateId === candidateId;

          return (
            <Card key={candidateId} padded="sm" variant="subtle">
              <div className="flex flex-col gap-4">
                <div>
                  <div className="text-[15px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                    {s(candidate?.displayName, "Instagram")}
                  </div>

                  <div className="mt-3">
                    <DataRow label="Page" value={s(candidate?.pageName, "Not available")} />
                    <DataRow label="Handle" value={s(candidate?.igUsername, "Not available")} />
                    <DataRow label="Instagram user id" value={s(candidate?.igUserId, "Not available")} />
                  </div>
                </div>

                <Button
                  type="button"
                  fullWidth
                  size="sm"
                  loading={isLoading && isSelecting}
                  disabled={isLoading}
                  onClick={() => onSelect?.(candidate)}
                >
                  Select this account
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </SectionCard>
  );
}

function BlockerList({ items = [] }) {
  if (!items.length) return null;

  return (
    <SectionCard tone="warning" eyebrow="Blockers" title="Needs attention">
      <div className="space-y-3">
        {items.map((item, index) => (
          <Card
            key={`${s(item?.reasonCode) || "blocker"}-${index}`}
            padded="sm"
            tone="warning"
            variant="subtle"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                strokeWidth={2.1}
              />

              <div className="min-w-0">
                <div className="text-[13px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
                  {s(item?.title, "Runtime blocker")}
                </div>

                <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
                  {s(
                    item?.subtitle || item?.message || item?.description,
                    "Review this blocker before treating the channel as ready."
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </SectionCard>
  );
}

function TelegramActionGroup({
  connectDisabled = false,
  connectLoading = false,
  createDisabled = false,
  onConnect,
  onCreate,
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button
        type="button"
        size="sm"
        fullWidth
        loading={connectLoading}
        disabled={connectDisabled || connectLoading}
        onClick={onConnect}
      >
        {connectLoading ? "Connecting..." : "Connect with token"}
      </Button>

      <Button
        type="button"
        size="sm"
        fullWidth
        variant="secondary"
        disabled={createDisabled || connectLoading}
        onClick={onCreate}
        rightIcon={<ExternalLink className="h-3.5 w-3.5" strokeWidth={2.1} />}
      >
        Create in BotFather
      </Button>
    </div>
  );
}

function StandardChannelDetailDrawer({
  channel,
  open = false,
  onClose,
  onNavigate,
}) {
  const isInstagram = isInstagramChannel(channel);
  const isTelegram = isTelegramChannel(channel);
  const queryClient = useQueryClient();
  const workspace = useWorkspaceTenantKey({
    enabled: open && (isInstagram || isTelegram),
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectingCandidateId, setSelectingCandidateId] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramFeedback, setTelegramFeedback] = useState(null);

  const metaStatusQueryKey = buildWorkspaceScopedQueryKey(
    ["meta-channel-status"],
    workspace.tenantKey
  );
  const telegramStatusQueryKey = buildWorkspaceScopedQueryKey(
    ["telegram-channel-status"],
    workspace.tenantKey
  );

  const metaStatusQuery = useQuery({
    queryKey: metaStatusQueryKey,
    queryFn: getMetaChannelStatus,
    enabled: open && isInstagram && workspace.ready,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const telegramStatusQuery = useQuery({
    queryKey: telegramStatusQueryKey,
    queryFn: getTelegramChannelStatus,
    enabled: open && isTelegram && workspace.ready,
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
      await queryClient.invalidateQueries({ queryKey: metaStatusQueryKey });
      emitLaunchSliceRefresh({
        tenantKey: workspace.tenantKey,
        reason: "meta-disconnected",
      });
    },
  });

  const selectionMutation = useMutation({
    mutationFn: selectMetaChannelCandidate,
    async onSuccess() {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("meta_connected", "1");
      nextParams.delete("meta_selection");
      nextParams.delete("meta_error");
      nextParams.delete("meta_reason");
      nextParams.set("section", "channels");
      nextParams.set("channel", "instagram");
      setSearchParams(nextParams);

      await queryClient.invalidateQueries({ queryKey: metaStatusQueryKey });

      emitLaunchSliceRefresh({
        tenantKey: workspace.tenantKey,
        reason: "meta-selected",
      });

      setSelectingCandidateId("");
    },
    onError() {
      setSelectingCandidateId("");
    },
  });

  const telegramConnectMutation = useMutation({
    mutationFn: connectTelegramChannel,
    async onSuccess() {
      setTelegramFeedback({
        tone: "success",
        message:
          "Telegram connected successfully. The bot token was validated and the webhook state below reflects the latest backend truth.",
      });
      setTelegramBotToken("");

      await queryClient.invalidateQueries({ queryKey: telegramStatusQueryKey });

      emitLaunchSliceRefresh({
        tenantKey: workspace.tenantKey,
        reason: "telegram-connected",
      });
    },
  });

  const telegramDisconnectMutation = useMutation({
    mutationFn: disconnectTelegramChannel,
    async onSuccess() {
      setTelegramFeedback({
        tone: "warning",
        message:
          "Telegram was disconnected. The stored bot token and webhook secrets were removed for this tenant.",
      });
      setTelegramBotToken("");

      await queryClient.invalidateQueries({ queryKey: telegramStatusQueryKey });

      emitLaunchSliceRefresh({
        tenantKey: workspace.tenantKey,
        reason: "telegram-disconnected",
      });
    },
  });

  function clearFeedbackParams() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("meta_connected");
    nextParams.delete("meta_selection");
    nextParams.delete("meta_error");
    nextParams.delete("meta_reason");
    nextParams.delete("section");
    setSearchParams(nextParams);
    setTelegramFeedback(null);
  }

  function handleClose() {
    clearFeedbackParams();
    onClose?.();
  }

  function handleTelegramConnect() {
    const botToken = s(telegramBotToken);
    if (!botToken) return;

    setTelegramFeedback(null);
    telegramConnectMutation.mutate({ botToken });
  }

  function handleTelegramCreate() {
    if (typeof window !== "undefined") {
      window.open(BOTFATHER_URL, "_blank", "noopener,noreferrer");
    }

    setTelegramFeedback({
      tone: "warning",
      message:
        "BotFather opened. Create the bot there, copy the token, then paste it here and connect with token.",
    });
  }

  function handlePrimaryAction() {
    if (isTelegram) {
      if (s(telegramStatusQuery.data?.state) === "connected") {
        onNavigate?.("/inbox");
        return;
      }

      handleTelegramConnect();
      return;
    }

    if (!isInstagram) return;

    if (metaStatusQuery.data?.pendingSelection?.required === true) return;

    if (s(metaStatusQuery.data?.state) === "connected") {
      onNavigate?.("/inbox");
      return;
    }

    connectMutation.mutate();
  }

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

  const feedback = {
    connected: searchParams.get("meta_connected") === "1",
    selection: searchParams.get("meta_selection") === "1",
    error: s(searchParams.get("meta_error")),
    reason: s(searchParams.get("meta_reason")),
  };

  const metaActionError = s(
    connectMutation.error?.message ||
      selectionMutation.error?.message ||
      disconnectMutation.error?.message
  );
  const telegramActionError = s(
    telegramConnectMutation.error?.message ||
      telegramDisconnectMutation.error?.message ||
      telegramStatusQuery.error?.message
  );

  const effectiveStatus = isInstagram
    ? s(metaStatusQuery.data?.state || channel?.status || "ready")
    : isTelegram
      ? s(telegramStatusQuery.data?.state || channel?.status || "not_connected")
      : s(channel?.status || "phase2");

  const instagramCopy = buildInstagramStateCopy(metaStatusQuery.data || {});
  const telegramCopy = buildTelegramStateCopy(telegramStatusQuery.data || {});
  const blockers = isTelegram
    ? arr(telegramStatusQuery.data?.readiness?.blockers)
    : arr(metaStatusQuery.data?.readiness?.blockers);
  const reviewScopes = arr(metaStatusQuery.data?.review?.requestedScopes);
  const reviewExcludedScopes = arr(metaStatusQuery.data?.review?.excludedScopes);
  const pendingSelection = metaStatusQuery.data?.pendingSelection || null;
  const pendingSelectionRequired = pendingSelection?.required === true;
  const attentionItems = arr(metaStatusQuery.data?.attention?.items);
  const userToken = metaStatusQuery.data?.lifecycle?.userToken || {};
  const capabilities = arr(channel?.capabilities);

  const showReconnectButton =
    isInstagram &&
    s(metaStatusQuery.data?.state) === "connected" &&
    metaStatusQuery.data?.actions?.reconnectAvailable === true &&
    metaStatusQuery.data?.actions?.reconnectRecommended === true;

  const telegramRequiresTokenInput =
    s(telegramStatusQuery.data?.state) !== "connected";

  const telegramConnectAllowed =
    telegramStatusQuery.data?.actions?.connectAvailable !== false ||
    telegramStatusQuery.data?.actions?.reconnectAvailable === true;

  const activeStatusQuery = isInstagram
    ? metaStatusQuery
    : isTelegram
      ? telegramStatusQuery
      : null;

  const telegramBusy =
    telegramConnectMutation.isPending ||
    telegramDisconnectMutation.isPending ||
    telegramStatusQuery.isFetching;

  const primaryLabel = useMemo(() => {
    if (isTelegram) {
      if (s(telegramStatusQuery.data?.state) === "connected") return "Open inbox";
      if (s(telegramStatusQuery.data?.state) === "error") return "Reconnect Telegram";
      if (s(telegramStatusQuery.data?.state) === "disconnected") return "Reconnect Telegram";
      if (s(telegramStatusQuery.data?.state) === "connecting") return "Complete Telegram setup";
      return "Connect Telegram";
    }

    if (!isInstagram) return "Phase 2";
    if (pendingSelectionRequired) return "Choose account below";
    if (s(metaStatusQuery.data?.state) === "connected") return "Open inbox";
    if (s(metaStatusQuery.data?.state) === "reconnect_required") return "Reconnect Instagram";
    if (s(metaStatusQuery.data?.state) === "deauthorized") return "Reconnect Instagram";
    if (s(metaStatusQuery.data?.state) === "disconnected") return "Reconnect Instagram";
    return "Connect Instagram";
  }, [
    isInstagram,
    isTelegram,
    metaStatusQuery.data,
    pendingSelectionRequired,
    telegramStatusQuery.data,
  ]);

  const primaryDisabled =
    (isInstagram && pendingSelectionRequired) ||
    connectMutation.isPending ||
    telegramBusy ||
    (isTelegram &&
      telegramRequiresTokenInput &&
      (!s(telegramBotToken) || !telegramConnectAllowed));

  return (
    <aside
      aria-hidden={!open}
      className="flex h-full w-full flex-col border-l border-line-soft bg-surface shadow-panel"
    >
      <header className="shrink-0 border-b border-line-soft bg-surface px-6 py-5 shadow-[inset_0_-1px_0_rgba(15,23,42,0.025)]">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2">
          <div className="row-span-2 shrink-0 pt-0.5">
            <ChannelIcon channel={channel} size="lg" />
          </div>

          <div className="min-w-0 self-center">
            <div className="truncate text-[24px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
              {channel?.name}
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Close channel details"
            onClick={handleClose}
            className="row-span-2 !h-9 !w-9"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </Button>

          <div className="min-w-0 self-start">
            <DrawerStatus status={effectiveStatus} />
          </div>
        </div>
      </header>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto bg-surface-muted px-6 py-6">
        <div className="space-y-4">
          {feedback.connected ? (
            <FeedbackBanner>
              Instagram connected successfully. The tenant channel is now bound to the selected account.
            </FeedbackBanner>
          ) : null}

          {isTelegram && telegramFeedback?.message ? (
            <FeedbackBanner tone={telegramFeedback.tone}>
              {telegramFeedback.message}
            </FeedbackBanner>
          ) : null}

          {pendingSelectionRequired || (feedback.selection && metaStatusQuery.isLoading) ? (
            <FeedbackBanner tone="warning">
              Meta found more than one eligible Instagram Business or Professional asset. Choose the correct account below before this tenant becomes connected.
            </FeedbackBanner>
          ) : null}

          {feedback.error ? <FeedbackBanner tone="danger">{feedback.error}</FeedbackBanner> : null}
          {metaActionError ? <FeedbackBanner tone="danger">{metaActionError}</FeedbackBanner> : null}
          {isTelegram && telegramActionError ? (
            <FeedbackBanner tone="danger">{telegramActionError}</FeedbackBanner>
          ) : null}

          {attentionItems.map((item, index) => (
            <FeedbackBanner
              key={`${s(item?.reasonCode) || "attention"}-${index}`}
              tone="warning"
            >
              {s(item?.title, "Reconnect recommended")} {s(item?.subtitle)}
            </FeedbackBanner>
          ))}

          <SectionCard
            eyebrow="Summary"
            title={
              isInstagram
                ? instagramCopy.title
                : isTelegram
                  ? telegramCopy.title
                  : channel?.detailSummary
            }
            description={
              isInstagram
                ? instagramCopy.body
                : isTelegram
                  ? telegramCopy.body
                  : channel?.detailNote
            }
          >
            {capabilities.length ? (
              <div className="flex flex-wrap gap-2">
                {capabilities.map((capability) => (
                  <CapabilityBadge key={capability}>{capability}</CapabilityBadge>
                ))}
              </div>
            ) : null}
          </SectionCard>

          {isInstagram ? (
            <>
              <SectionCard eyebrow="Runtime" title="Live runtime checks">
                <RuntimeRow
                  ready={metaStatusQuery.data?.runtime?.webhookReady === true}
                  label="Webhook intake"
                  description="Inbound events for this tenant."
                />

                <RuntimeRow
                  ready={metaStatusQuery.data?.runtime?.deliveryReady === true}
                  label="AI reply delivery"
                  description="Outbound DM delivery path."
                />

                <div className="mt-4 text-[12.5px] font-medium leading-6 text-text-muted">
                  {metaStatusQuery.isLoading
                    ? "Loading tenant runtime state..."
                    : s(metaStatusQuery.data?.readiness?.message, "Runtime state unavailable.")}
                </div>
              </SectionCard>

              <SectionCard eyebrow="Connected account" title="Instagram account">
                <DataRow
                  label="Display"
                  value={s(metaStatusQuery.data?.account?.displayName, "Not connected")}
                />
                <DataRow
                  label="Instagram handle"
                  value={s(metaStatusQuery.data?.account?.username, "Not available")}
                />
                <DataRow
                  label="Instagram user id"
                  value={s(metaStatusQuery.data?.account?.igUserId, "Not available")}
                />
                <DataRow
                  label="Meta app user id"
                  value={s(metaStatusQuery.data?.account?.metaUserId, "Not available")}
                />
                <DataRow label="User token status" value={buildUserTokenStatusCopy(userToken)} />
                <DataRow
                  label="Token expires"
                  value={s(
                    userToken?.expiresAt ||
                      metaStatusQuery.data?.lifecycle?.userTokenExpiresAt,
                    "Not available"
                  )}
                />
              </SectionCard>

              <SectionCard
                eyebrow="Review-aligned permissions"
                title="Permission model"
                description={s(
                  metaStatusQuery.data?.review?.story,
                  "Businesses connect their own Instagram account and the platform manages inbound customer conversations."
                )}
              >
                {reviewScopes.length ? (
                  <div className="flex flex-wrap gap-2">
                    {reviewScopes.map((scope) => (
                      <ScopeBadge key={scope}>{scope}</ScopeBadge>
                    ))}
                  </div>
                ) : (
                  <div className="text-[13px] font-medium leading-6 text-text-muted">
                    No requested scopes were returned.
                  </div>
                )}

                {reviewExcludedScopes.length ? (
                  <>
                    <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                      Out of launch scope
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {reviewExcludedScopes.map((scope) => (
                        <ScopeBadge key={scope} muted>
                          {scope}
                        </ScopeBadge>
                      ))}
                    </div>
                  </>
                ) : null}
              </SectionCard>

              <PendingSelectionPanel
                pendingSelection={pendingSelection}
                isLoading={selectionMutation.isPending}
                selectingCandidateId={selectingCandidateId}
                onSelect={handleCandidateSelect}
              />

              <BlockerList items={blockers} />
            </>
          ) : isTelegram ? (
            <>
              {telegramRequiresTokenInput ? (
                <SectionCard
                  eyebrow="Connect"
                  title="Connect Telegram"
                  description="Use an existing bot token or create a new bot in BotFather. The backend validates the bot and verifies the tenant webhook before marking it live."
                >
                  <Input
                    value={telegramBotToken}
                    onChange={(event) => setTelegramBotToken(event.target.value)}
                    placeholder="123456:ABC-DEF1234ghIkl..."
                    type="password"
                    autoComplete="off"
                    appearance="quiet"
                    inputClassName="font-mono text-[13px]"
                    aria-label="Telegram bot token"
                  />

                  <div className="mt-3 text-[12.5px] font-medium leading-6 text-text-muted">
                    Telegram MVP is private text only. Group chats, media, read receipts, and unsupported control actions stay fail-closed.
                  </div>

                  <div className="mt-4">
                    <TelegramActionGroup
                      connectDisabled={!s(telegramBotToken) || !telegramConnectAllowed}
                      connectLoading={telegramConnectMutation.isPending}
                      createDisabled={false}
                      onConnect={handleTelegramConnect}
                      onCreate={handleTelegramCreate}
                    />
                  </div>
                </SectionCard>
              ) : null}

              <SectionCard eyebrow="Runtime" title="Live runtime checks">
                <RuntimeRow
                  ready={telegramStatusQuery.data?.account?.verified === true}
                  label="Bot authentication"
                  description="Stored tenant bot token still validates against Telegram."
                />
                <RuntimeRow
                  ready={telegramStatusQuery.data?.webhook?.verified === true}
                  label="Webhook intake"
                  description="Telegram is pointed at the tenant-bound webhook route with secret verification enabled."
                />
                <RuntimeRow
                  ready={telegramStatusQuery.data?.runtime?.deliveryReady === true}
                  label="AI reply delivery"
                  description="Outbound replies are allowed only when runtime and webhook state are ready."
                />

                <div className="mt-4 text-[12.5px] font-medium leading-6 text-text-muted">
                  {telegramStatusQuery.isLoading
                    ? "Loading Telegram runtime state..."
                    : s(
                        telegramStatusQuery.data?.readiness?.message,
                        "Telegram runtime state unavailable."
                      )}
                </div>
              </SectionCard>

              <SectionCard eyebrow="Bot account" title="Telegram bot">
                <DataRow
                  label="Bot username"
                  value={s(
                    telegramStatusQuery.data?.account?.username ||
                      telegramStatusQuery.data?.bot?.username,
                    "Not available"
                  )}
                />
                <DataRow
                  label="Bot id"
                  value={s(
                    telegramStatusQuery.data?.account?.botId ||
                      telegramStatusQuery.data?.bot?.id,
                    "Not available"
                  )}
                />
                <DataRow
                  label="Webhook"
                  value={s(
                    telegramStatusQuery.data?.webhook?.url ||
                      telegramStatusQuery.data?.webhookUrl,
                    "Not available"
                  )}
                />
                <DataRow
                  label="Last checked"
                  value={s(
                    telegramStatusQuery.data?.checkedAt ||
                      telegramStatusQuery.data?.updatedAt,
                    "Not available"
                  )}
                />
              </SectionCard>

              <BlockerList items={blockers} />
            </>
          ) : (
            <SectionCard
              eyebrow="Coming next"
              title={channel?.detailSummary || "Connector detail"}
              description={channel?.detailNote || "This channel is not active in the current launch lane."}
            />
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-line-soft bg-surface px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            fullWidth
            loading={connectMutation.isPending || telegramConnectMutation.isPending}
            disabled={primaryDisabled}
            onClick={handlePrimaryAction}
          >
            {primaryLabel}
          </Button>

          {isInstagram && s(metaStatusQuery.data?.state) === "connected" ? (
            <Button
              type="button"
              variant={showReconnectButton ? "primary" : "secondary"}
              loading={connectMutation.isPending}
              onClick={() => connectMutation.mutate()}
              leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
            >
              Reconnect
            </Button>
          ) : null}

          {isInstagram && s(metaStatusQuery.data?.state) === "connected" ? (
            <Button
              type="button"
              variant="secondary"
              loading={disconnectMutation.isPending}
              disabled={disconnectMutation.isPending}
              onClick={() => disconnectMutation.mutate()}
            >
              Disconnect
            </Button>
          ) : null}

          {isTelegram && s(telegramStatusQuery.data?.state) === "connected" ? (
            <Button
              type="button"
              variant="secondary"
              loading={telegramDisconnectMutation.isPending}
              disabled={telegramDisconnectMutation.isPending}
              onClick={() => telegramDisconnectMutation.mutate()}
            >
              Disconnect
            </Button>
          ) : null}

          {activeStatusQuery ? (
            <Button
              type="button"
              variant="secondary"
              disabled={activeStatusQuery.isFetching}
              onClick={() => activeStatusQuery.refetch()}
              leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
            >
              Refresh
            </Button>
          ) : null}
        </div>
      </footer>
    </aside>
  );
}

export default function ChannelDetailDrawer(props) {
  if (isWebsiteChannel(props.channel)) {
    return <WebsiteWidgetDetailDrawer {...props} />;
  }

  return <StandardChannelDetailDrawer {...props} />;
}