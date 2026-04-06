import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
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
import { cx } from "../../lib/cx.js";
import ChannelIcon from "./ChannelIcon.jsx";
import { ChannelActionButton } from "./ChannelPrimitives.jsx";
import { getChannelStatusMeta } from "./channelCatalogModel.js";
import Input from "../ui/Input.jsx";

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
          "Inbound DMs can resolve against the tenant runtime, and AI replies are allowed only while the runtime stays ready.",
      };
    case "reconnect_required":
      return {
        title: "Instagram needs reconnect before automation can resume.",
        body:
          "The tenant record exists, but a critical identifier or delivery token is missing, so the system stays fail-closed until reconnect completes.",
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

function buildTelegramStateCopy(status = {}) {
  switch (s(status?.state)) {
    case "connected":
      return {
        title: "Telegram is connected for this tenant.",
        body:
          "Private text messages can enter the shared inbox/runtime flow, and outbound AI replies stay truthful to webhook and runtime readiness.",
      };
    case "connecting":
      return {
        title: "Telegram is finishing connection setup.",
        body:
          "The bot token has been accepted, but webhook verification or runtime readiness still needs to settle before the channel is treated as fully live.",
      };
    case "error":
      return {
        title: "Telegram needs repair before live delivery can resume.",
        body:
          "A tenant channel record exists, but bot auth, webhook verification, or runtime readiness is not healthy enough to treat this connector as fully operational.",
      };
    case "disconnected":
      return {
        title: "Telegram was intentionally disconnected.",
        body:
          "The stored bot token and webhook secrets were removed, so no live Telegram delivery path remains until reconnect completes.",
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
          "Paste a BotFather bot token to validate the bot, store tenant secrets, and register the tenant-bound webhook before Telegram is treated as live.",
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

function DrawerStatus({ status }) {
  const meta = getChannelStatusMeta(status);

  const toneClass =
    meta?.tone === "success" || meta?.tone === "info"
      ? "text-[#264ca5]"
      : meta?.tone === "warning"
        ? "text-[#9a591e]"
        : "text-[#667085]";

  return (
    <div className={cx("inline-flex items-center gap-2 text-[13px] font-semibold", toneClass)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span>{meta?.label || "Unknown"}</span>
    </div>
  );
}

function SectionBlock({ eyebrow, title, description, children, last = false }) {
  return (
    <section className={cx(!last && "border-b border-[#e8edf3] pb-7", last && "pb-0")}>
      {eyebrow ? (
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#667085]">
          {eyebrow}
        </div>
      ) : null}

      {title ? (
        <div className="mt-3 text-[18px] font-semibold tracking-[-0.04em] text-[#101828]">
          {title}
        </div>
      ) : null}

      {description ? (
        <p className="mt-3 max-w-[640px] text-[14px] leading-8 text-[#5f6c80]">
          {description}
        </p>
      ) : null}

      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

function FeedbackBanner({ tone = "success", children }) {
  return (
    <div
      className={cx(
        "rounded-[10px] border px-4 py-3 text-[13px] leading-6",
        tone === "danger"
          ? "border-[rgba(var(--color-danger),0.18)] bg-[rgba(var(--color-danger),0.05)] text-danger"
          : tone === "warning"
            ? "border-[rgba(var(--color-warning),0.18)] bg-[rgba(var(--color-warning),0.05)] text-warning"
            : "border-[rgba(var(--color-success),0.18)] bg-[rgba(var(--color-success),0.05)] text-success"
      )}
    >
      {children}
    </div>
  );
}

function CapabilityPill({ children }) {
  return (
    <span className="inline-flex items-center rounded-[8px] border border-[#e4eaf1] bg-[#fafbfd] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#667085]">
      {children}
    </span>
  );
}

function RuntimeRow({ ready, label, description }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-[#eef2f6] py-4 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {ready ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          ) : (
            <ShieldAlert className="h-4 w-4 shrink-0 text-warning" />
          )}

          <div className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[#101828]">
            {label}
          </div>
        </div>

        {description ? (
          <div className="mt-1 pl-6 text-[13px] leading-6 text-[#667085]">
            {description}
          </div>
        ) : null}
      </div>

      <div
        className={cx(
          "rounded-[8px] border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
          ready
            ? "border-[rgba(var(--color-success),0.18)] bg-[rgba(var(--color-success),0.05)] text-success"
            : "border-[rgba(var(--color-warning),0.18)] bg-[rgba(var(--color-warning),0.05)] text-warning"
        )}
      >
        {ready ? "Ready" : "Blocked"}
      </div>
    </div>
  );
}

function DataRow({ label, value }) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-4 border-b border-[#eef2f6] py-3 last:border-b-0">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#667085]">
        {label}
      </div>

      <div className="min-w-0 text-[13px] font-medium leading-6 text-[#101828]">
        {value || "Not available"}
      </div>
    </div>
  );
}

function ScopePill({ children, muted = false }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-[8px] border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em]",
        muted
          ? "border-[#e5eaf1] bg-[#f8fafc] text-[#667085]"
          : "border-[rgba(var(--color-brand),0.14)] bg-[rgba(var(--color-brand),0.05)] text-[#264ca5]"
      )}
    >
      {children}
    </span>
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
    <SectionBlock
      eyebrow="Account selection"
      title="Choose which Instagram Business account belongs to this tenant."
      description="The tenant is still not connected. Final binding only happens after you choose one account from the Meta callback results."
    >
      <div className="text-[12px] leading-6 text-[#667085]">
        Selection session expires at: {s(pendingSelection?.expiresAt, "Not available")}
      </div>

      <div className="mt-4 space-y-3">
        {candidates.map((candidate) => {
          const isSelecting = selectingCandidateId === s(candidate?.id);

          return (
            <div
              key={s(candidate?.id)}
              className="rounded-[10px] border border-[#e6ebf2] bg-[#fbfcfe] px-4 py-4"
            >
              <div className="text-[16px] font-semibold tracking-[-0.03em] text-[#101828]">
                {s(candidate?.displayName, "Instagram")}
              </div>

              <div className="mt-3">
                <DataRow label="Page" value={s(candidate?.pageName, "Not available")} />
                <DataRow label="Handle" value={s(candidate?.igUsername, "Not available")} />
                <DataRow
                  label="Instagram user id"
                  value={s(candidate?.igUserId, "Not available")}
                />
              </div>

              <div className="mt-4">
                <ChannelActionButton
                  fullWidth
                  showArrow={false}
                  onClick={() => onSelect?.(candidate)}
                  isLoading={isLoading && isSelecting}
                  disabled={isLoading}
                  ariaLabel={`Select ${s(candidate?.displayName, "Instagram")}`}
                  className="!h-[38px] !rounded-[9px] !text-[10px]"
                >
                  Select this account
                </ChannelActionButton>
              </div>
            </div>
          );
        })}
      </div>
    </SectionBlock>
  );
}

function BlockerList({ items = [] }) {
  if (!items.length) return null;

  return (
    <SectionBlock eyebrow="Blockers" last>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={`${s(item?.reasonCode) || "blocker"}-${index}`}
            className="rounded-[10px] border border-[rgba(var(--color-warning),0.18)] bg-[rgba(var(--color-warning),0.05)] px-4 py-3"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[#101828]">
                  {s(item?.title, "Runtime blocker")}
                </div>
                <div className="mt-1 text-[12px] leading-6 text-[#667085]">
                  {s(item?.subtitle || item?.message || item?.description)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionBlock>
  );
}

export default function ChannelDetailDrawer({
  channel,
  open = false,
  onClose,
  onNavigate,
}) {
  const isInstagram = isInstagramChannel(channel);
  const isTelegram = isTelegramChannel(channel);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectingCandidateId, setSelectingCandidateId] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramFeedback, setTelegramFeedback] = useState(null);

  const metaStatusQuery = useQuery({
    queryKey: ["meta-channel-status"],
    queryFn: getMetaChannelStatus,
    enabled: open && isInstagram,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const telegramStatusQuery = useQuery({
    queryKey: ["telegram-channel-status"],
    queryFn: getTelegramChannelStatus,
    enabled: open && isTelegram,
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
      nextParams.delete("meta_reason");
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

  const telegramConnectMutation = useMutation({
    mutationFn: connectTelegramChannel,
    async onSuccess() {
      setTelegramFeedback({
        tone: "success",
        message:
          "Telegram connected successfully. The bot token was validated and the tenant webhook state below reflects the latest backend truth.",
      });
      setTelegramBotToken("");
      await queryClient.invalidateQueries({ queryKey: ["telegram-channel-status"] });
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
      await queryClient.invalidateQueries({ queryKey: ["telegram-channel-status"] });
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

  function handlePrimaryAction() {
    if (isTelegram) {
      if (s(telegramStatusQuery.data?.state) === "connected") {
        onNavigate?.("/inbox");
        return;
      }

      const botToken = s(telegramBotToken);
      if (!botToken) return;

      setTelegramFeedback(null);
      telegramConnectMutation.mutate({
        botToken,
      });
      return;
    }

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
      className="flex h-full w-full flex-col border-l border-[#dbe3ec] bg-white shadow-[-18px_0_40px_-26px_rgba(15,23,42,0.16)]"
    >
      <div className="border-b border-[#e8edf3] px-7 py-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1">
          <div className="row-span-2 shrink-0 pt-0.5">
            <ChannelIcon channel={channel} size="lg" />
          </div>

          <div className="min-w-0 self-center">
            <div className="truncate text-[30px] font-semibold leading-none tracking-[-0.06em] text-[#101828]">
              {channel?.name}
            </div>
          </div>

          <button
            type="button"
            aria-label="Close channel details"
            onClick={handleClose}
            className="row-span-2 inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-[#dbe3ec] bg-white text-[#667085] transition duration-fast ease-premium hover:border-[#c8d2df] hover:text-[#101828]"
          >
            <X className="h-4.5 w-4.5" strokeWidth={2.35} />
          </button>

          <div className="min-w-0 self-start pt-1">
            <DrawerStatus status={effectiveStatus} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-7 py-6">
        <div className="space-y-7">
          {feedback.connected ? (
            <FeedbackBanner>
              Instagram connected successfully. The tenant channel is now bound to the selected account and the status below reflects the live runtime state.
            </FeedbackBanner>
          ) : null}

          {isTelegram && telegramFeedback?.message ? (
            <FeedbackBanner tone={telegramFeedback.tone}>{telegramFeedback.message}</FeedbackBanner>
          ) : null}

          {(pendingSelectionRequired || (feedback.selection && metaStatusQuery.isLoading)) ? (
            <FeedbackBanner tone="warning">
              Meta found more than one eligible Instagram Business or Professional asset. Choose
              the correct account below before this tenant becomes connected.
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
              <span className="font-semibold">{s(item?.title, "Reconnect recommended")}</span>{" "}
              {s(item?.subtitle)}
            </FeedbackBanner>
          ))}

          <SectionBlock
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
                  <CapabilityPill key={capability}>{capability}</CapabilityPill>
                ))}
              </div>
            ) : null}
          </SectionBlock>

          {isInstagram ? (
            <>
              <SectionBlock eyebrow="Runtime">
                <div className="space-y-0">
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
                </div>

                <div className="mt-4 text-[12px] leading-6 text-[#667085]">
                  {metaStatusQuery.isLoading
                    ? "Loading tenant runtime state..."
                    : s(
                        metaStatusQuery.data?.readiness?.message,
                        "Runtime state unavailable."
                      )}
                </div>
              </SectionBlock>

              <SectionBlock eyebrow="Connected account">
                <div className="space-y-0">
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
                  <DataRow
                    label="User token status"
                    value={buildUserTokenStatusCopy(userToken)}
                  />
                  <DataRow
                    label="Token expires"
                    value={s(
                      userToken?.expiresAt ||
                        metaStatusQuery.data?.lifecycle?.userTokenExpiresAt,
                      "Not available"
                    )}
                  />
                </div>
              </SectionBlock>

              <SectionBlock
                eyebrow="Review-aligned permission model"
                description={s(
                  metaStatusQuery.data?.review?.story,
                  "Businesses connect their own Instagram account and the platform manages inbound customer conversations."
                )}
              >
                <div className="flex flex-wrap gap-2">
                  {reviewScopes.map((scope) => (
                    <ScopePill key={scope}>{scope}</ScopePill>
                  ))}
                </div>

                {reviewExcludedScopes.length ? (
                  <>
                    <div className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#667085]">
                      Explicitly out of launch scope
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {reviewExcludedScopes.map((scope) => (
                        <ScopePill key={scope} muted>
                          {scope}
                        </ScopePill>
                      ))}
                    </div>
                  </>
                ) : null}
              </SectionBlock>

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
                <SectionBlock
                  eyebrow="Connect"
                  title="Validate the bot token before this tenant is marked live."
                  description="Paste the BotFather token for the tenant bot. The backend validates the token with Telegram and only marks the connection live after webhook registration is verified."
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

                  <div className="mt-3 text-[12px] leading-6 text-[#667085]">
                    Telegram MVP is private text only. Group chats, media, read receipts, and
                    unsupported control actions stay fail-closed instead of pretending they are
                    available.
                  </div>
                </SectionBlock>
              ) : null}

              <SectionBlock eyebrow="Runtime">
                <div className="space-y-0">
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
                    description="Inbound Telegram chat can reuse the shared inbox runtime and outbound reply path."
                  />
                </div>

                <div className="mt-4 text-[12px] leading-6 text-[#667085]">
                  {telegramStatusQuery.isLoading
                    ? "Loading Telegram runtime state..."
                    : s(
                        telegramStatusQuery.data?.readiness?.message,
                        "Telegram runtime state unavailable."
                      )}
                </div>
              </SectionBlock>

              <SectionBlock eyebrow="Connected bot">
                <div className="space-y-0">
                  <DataRow
                    label="Display"
                    value={s(telegramStatusQuery.data?.account?.displayName, "Not connected")}
                  />
                  <DataRow
                    label="Username"
                    value={
                      s(telegramStatusQuery.data?.account?.botUsername)
                        ? `@${s(telegramStatusQuery.data?.account?.botUsername)}`
                        : "Not available"
                    }
                  />
                  <DataRow
                    label="Bot user id"
                    value={s(telegramStatusQuery.data?.account?.botUserId, "Not available")}
                  />
                  <DataRow
                    label="Token"
                    value={s(telegramStatusQuery.data?.account?.botTokenMasked, "Not stored")}
                  />
                  <DataRow
                    label="Connected at"
                    value={s(telegramStatusQuery.data?.lifecycle?.connectedAt, "Not available")}
                  />
                  <DataRow
                    label="Last verified"
                    value={s(telegramStatusQuery.data?.lifecycle?.lastVerifiedAt, "Not available")}
                  />
                </div>
              </SectionBlock>

              <SectionBlock eyebrow="Webhook">
                <div className="space-y-0">
                  <DataRow
                    label="Expected URL"
                    value={s(telegramStatusQuery.data?.webhook?.expectedUrl, "Not available")}
                  />
                  <DataRow
                    label="Actual URL"
                    value={s(telegramStatusQuery.data?.webhook?.actualUrl, "Not available")}
                  />
                  <DataRow
                    label="Secret header"
                    value={
                      telegramStatusQuery.data?.webhook?.secretHeaderConfigured === true
                        ? "Configured"
                        : "Missing"
                    }
                  />
                  <DataRow
                    label="Pending updates"
                    value={String(telegramStatusQuery.data?.webhook?.pendingUpdateCount ?? 0)}
                  />
                  <DataRow
                    label="Last error"
                    value={s(telegramStatusQuery.data?.webhook?.lastErrorMessage, "None")}
                  />
                </div>
              </SectionBlock>

              <BlockerList items={blockers} />
            </>
          ) : (
            <SectionBlock
              eyebrow="Availability"
              description="This connector is intentionally marked as phase 2. It stays visible as roadmap context, but it is not part of the DM-first launch path and does not expose a self-serve connect flow."
              last
            />
          )}
        </div>
      </div>

      <div className="border-t border-[#e8edf3] bg-white px-7 py-4">
        <div className="space-y-3">
          <ChannelActionButton
            fullWidth
            onClick={handlePrimaryAction}
            isLoading={
              isTelegram
                ? telegramConnectMutation.isPending ||
                  telegramDisconnectMutation.isPending ||
                  telegramStatusQuery.isFetching
                : connectMutation.isPending ||
                  selectionMutation.isPending ||
                  metaStatusQuery.isFetching
            }
            disabled={
              (!isInstagram && !isTelegram) ||
              (isInstagram &&
                (connectMutation.isPending ||
                  selectionMutation.isPending ||
                  pendingSelectionRequired ||
                  (s(metaStatusQuery.data?.state) !== "connected" &&
                    metaStatusQuery.data?.actions?.connectAvailable === false))) ||
              (isTelegram &&
                (telegramConnectMutation.isPending ||
                  telegramDisconnectMutation.isPending ||
                  (telegramRequiresTokenInput &&
                    (!telegramConnectAllowed || !s(telegramBotToken)))))
            }
            className="!h-[40px] !rounded-[10px] !text-[10px]"
          >
            {primaryLabel}
          </ChannelActionButton>

          <div className="grid grid-cols-2 gap-3">
            {isInstagram ? (
              <ChannelActionButton
                quiet
                fullWidth
                showArrow={false}
                onClick={() => disconnectMutation.mutate()}
                isLoading={disconnectMutation.isPending}
                disabled={!metaStatusQuery.data?.actions?.disconnectAvailable}
                className="!h-[38px] !rounded-[10px] !text-[10px]"
              >
                {pendingSelectionRequired ? "Cancel selection" : "Disconnect"}
              </ChannelActionButton>
            ) : isTelegram ? (
              <ChannelActionButton
                quiet
                fullWidth
                showArrow={false}
                onClick={() => telegramDisconnectMutation.mutate()}
                isLoading={telegramDisconnectMutation.isPending}
                disabled={!telegramStatusQuery.data?.actions?.disconnectAvailable}
                className="!h-[38px] !rounded-[10px] !text-[10px]"
              >
                Disconnect
              </ChannelActionButton>
            ) : (
              <div />
            )}

            <ChannelActionButton
              quiet
              fullWidth
              showArrow={false}
              onClick={() => activeStatusQuery?.refetch?.()}
              disabled={!isInstagram && !isTelegram}
              isLoading={activeStatusQuery?.isFetching}
              leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.2} />}
              className="!h-[38px] !rounded-[10px] !text-[10px]"
            >
              Refresh
            </ChannelActionButton>
          </div>

          {showReconnectButton ? (
            <ChannelActionButton
              quiet
              fullWidth
              showArrow={false}
              onClick={() => connectMutation.mutate()}
              isLoading={connectMutation.isPending}
              disabled={connectMutation.isPending || selectionMutation.isPending}
              leftIcon={<ChevronRight className="h-4 w-4" strokeWidth={2.25} />}
              className="!h-[38px] !rounded-[10px] !text-[10px]"
            >
              Reconnect
            </ChannelActionButton>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
