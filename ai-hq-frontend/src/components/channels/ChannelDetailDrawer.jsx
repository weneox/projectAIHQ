import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ExternalLink,
  Inbox,
  KeyRound,
  RefreshCw,
  Send,
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
import Card from "../ui/Card.jsx";
import { InlineNotice } from "../ui/AppShellPrimitives.jsx";
import WebsiteWidgetDetailDrawer from "./WebsiteWidgetDetailDrawer.jsx";

const BOTFATHER_URL = "https://t.me/BotFather";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function lower(value = "") {
  return s(value).toLowerCase();
}

function isInstagramChannel(channel = {}) {
  return lower(channel?.id) === "instagram";
}

function isTelegramChannel(channel = {}) {
  return lower(channel?.id) === "telegram";
}

function isWebsiteChannel(channel = {}) {
  return ["website", "webchat"].includes(lower(channel?.id));
}

function channelStateLabel(state = "", fallback = "Not connected") {
  switch (lower(state)) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting";
    case "reconnect_required":
      return "Reconnect";
    case "deauthorized":
    case "disconnected":
      return "Disconnected";
    case "blocked":
      return "Blocked";
    case "error":
      return "Needs repair";
    default:
      return fallback;
  }
}

function stateTone(state = "") {
  switch (lower(state)) {
    case "connected":
      return "success";
    case "connecting":
    case "reconnect_required":
      return "warning";
    case "deauthorized":
    case "disconnected":
    case "blocked":
    case "error":
      return "danger";
    default:
      return "neutral";
  }
}

function toneTextClass(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "brand") return "text-brand";
  return "text-text-muted";
}

function toneDotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

function connectionReady(status = {}) {
  return lower(status?.state) === "connected";
}

function deliveryReady(status = {}) {
  if (status?.runtime?.deliveryReady === true) return true;
  if (status?.runtime?.webhookReady === true) return true;
  if (status?.readiness?.ready === true) return true;
  if (status?.readiness?.ok === true) return true;
  return connectionReady(status);
}

function accountName(status = {}, fallback = "") {
  const account = obj(status?.account);
  return (
    s(account.displayName) ||
    s(account.username) ||
    s(account.handle) ||
    s(account.botUsername) ||
    s(account.name) ||
    fallback
  );
}

function accountSubtitle(status = {}, fallback = "") {
  const account = obj(status?.account);
  const username =
    s(account.username) ||
    s(account.handle) ||
    s(account.botUsername) ||
    s(account.botName);

  if (username) return username.startsWith("@") ? username : `@${username}`;
  return fallback;
}

function statusMessage({ channel, status }) {
  if (isInstagramChannel(channel)) {
    if (connectionReady(status)) {
      return "Messages are connected to Inbox.";
    }

    if (status?.pendingSelection?.required === true) {
      return "Choose the account you want to connect.";
    }

    return "Connect Instagram to receive messages in Inbox.";
  }

  if (isTelegramChannel(channel)) {
    if (connectionReady(status)) {
      return "Telegram messages are connected to Inbox.";
    }

    if (lower(status?.state) === "connecting") {
      return "Telegram setup is almost complete.";
    }

    return "Add your bot key to connect Telegram.";
  }

  return s(channel?.detailSummary || channel?.description);
}

function PrimaryStatus({ label, state }) {
  const tone = stateTone(state);

  return (
    <div className="flex items-center gap-2 text-[13px] font-semibold">
      <span className={cx("h-1.5 w-1.5 shrink-0", toneDotClass(tone))} />
      <span className={toneTextClass(tone)}>{label}</span>
    </div>
  );
}

function DetailMetric({ label, value, tone = "neutral" }) {
  return (
    <div className="border-r border-line-soft px-4 py-4 last:border-r-0">
      <div className={cx("text-[14px] font-semibold", toneTextClass(tone))}>
        {value}
      </div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {label}
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
      {children}
    </div>
  );
}

function SmallLinkButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand transition-colors hover:text-brand-strong"
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.1} />
    </button>
  );
}

function PendingInstagramSelection({
  pendingSelection,
  isLoading = false,
  selectingCandidateId = "",
  onSelect,
}) {
  const candidates = arr(pendingSelection?.candidates);

  if (pendingSelection?.required !== true || !candidates.length) return null;

  return (
    <Card padded="md">
      <h3 className="text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
        Choose account
      </h3>

      <p className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
        Select the Instagram account that should receive messages in this workspace.
      </p>

      <div className="mt-5 space-y-2">
        {candidates.map((candidate) => {
          const candidateId = s(candidate?.id);
          const display = s(
            candidate?.displayName ||
              candidate?.igUsername ||
              candidate?.pageName,
            "Instagram account"
          );
          const handle = s(candidate?.igUsername);

          return (
            <button
              key={candidateId}
              type="button"
              disabled={isLoading}
              onClick={() => onSelect?.(candidate)}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border border-line-soft bg-white px-4 py-3 text-left transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-text">
                  {display}
                </span>
                {handle ? (
                  <span className="mt-1 block truncate text-[12.5px] font-medium text-text-muted">
                    @{handle}
                  </span>
                ) : null}
              </span>

              <span className="text-[12.5px] font-semibold text-brand">
                {isLoading && selectingCandidateId === candidateId
                  ? "Selecting"
                  : "Select"}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function TelegramConnectBox({
  value,
  disabled = false,
  loading = false,
  onChange,
  onConnect,
  onCreate,
}) {
  return (
    <Card padded="md">
      <h3 className="text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
        Connect Telegram
      </h3>

      <p className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
        Paste the bot key from BotFather to receive Telegram messages in Inbox.
      </p>

      <div className="mt-5">
        <FieldLabel>Bot key</FieldLabel>
        <Input
          appearance="product"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder="Paste bot key"
          leftIcon={<KeyRound className="h-4 w-4" strokeWidth={2.1} />}
          disabled={disabled || loading}
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Button
          type="button"
          fullWidth
          loading={loading}
          disabled={disabled || loading || !s(value)}
          onClick={onConnect}
        >
          Connect
        </Button>

        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={onCreate}
        >
          BotFather
        </Button>
      </div>
    </Card>
  );
}

function StatusCard({ channel, status, loading, onRefresh }) {
  const state = s(status?.state || channel?.status || "not_connected");
  const connected = connectionReady(status);
  const messagesReady = deliveryReady(status);
  const displayName = accountName(status, connected ? channel?.name : "");
  const subtitle = accountSubtitle(status, "");

  return (
    <Card padded="md">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <PrimaryStatus label={channelStateLabel(state)} state={state} />

          <h2 className="mt-4 truncate text-[26px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
            {connected ? `${channel?.name} is connected` : `Connect ${channel?.name}`}
          </h2>

          <p className="mt-2 max-w-[620px] text-[13.5px] font-medium leading-6 text-text-muted">
            {statusMessage({ channel, status })}
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={loading}
          onClick={onRefresh}
          leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
        >
          Refresh
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-3 border border-line-soft bg-surface-muted">
        <DetailMetric
          label="Messages"
          value={messagesReady ? "Active" : "Off"}
          tone={messagesReady ? "success" : "warning"}
        />
        <DetailMetric
          label="Replies"
          value={connected ? "Enabled" : "Off"}
          tone={connected ? "success" : "warning"}
        />
        <DetailMetric
          label="Account"
          value={displayName || "Not set"}
          tone={connected ? "success" : "neutral"}
        />
      </div>

      {subtitle ? (
        <div className="mt-3 text-[12.5px] font-medium text-text-muted">
          {subtitle}
        </div>
      ) : null}
    </Card>
  );
}

function ActionPanel({
  connected = false,
  pendingSelection = false,
  primaryLabel,
  primaryDisabled = false,
  primaryLoading = false,
  disconnectLoading = false,
  disconnectAvailable = false,
  onPrimary,
  onInbox,
  onDisconnect,
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      <Button
        type="button"
        fullWidth
        loading={primaryLoading}
        disabled={primaryDisabled}
        onClick={onPrimary}
        leftIcon={
          connected ? (
            <Inbox className="h-4 w-4" strokeWidth={2.1} />
          ) : (
            <Send className="h-4 w-4" strokeWidth={2.1} />
          )
        }
      >
        {primaryLabel}
      </Button>

      {connected ? (
        <Button
          type="button"
          variant="secondary"
          onClick={onInbox}
          leftIcon={<Inbox className="h-4 w-4" strokeWidth={2.1} />}
        >
          Inbox
        </Button>
      ) : null}

      {disconnectAvailable && !pendingSelection ? (
        <Button
          type="button"
          variant="secondary"
          loading={disconnectLoading}
          disabled={disconnectLoading}
          onClick={onDisconnect}
        >
          Disconnect
        </Button>
      ) : null}
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
        message: "Telegram connected.",
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
        message: "Telegram disconnected.",
      });
      setTelegramBotToken("");

      await queryClient.invalidateQueries({ queryKey: telegramStatusQueryKey });

      emitLaunchSliceRefresh({
        tenantKey: workspace.tenantKey,
        reason: "telegram-disconnected",
      });
    },
  });

  const activeStatusQuery = isInstagram
    ? metaStatusQuery
    : isTelegram
      ? telegramStatusQuery
      : null;

  const activeStatus = isInstagram
    ? obj(metaStatusQuery.data)
    : isTelegram
      ? obj(telegramStatusQuery.data)
      : obj(channel);

  const pendingSelection = activeStatus?.pendingSelection || null;
  const pendingSelectionRequired = pendingSelection?.required === true;
  const connected = connectionReady(activeStatus);

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

  const hasConnectedFeedback = searchParams.get("meta_connected") === "1";
  const hasSelectionFeedback = searchParams.get("meta_selection") === "1";
  const metaError = s(searchParams.get("meta_error"));

  const telegramBusy =
    telegramConnectMutation.isPending ||
    telegramDisconnectMutation.isPending ||
    telegramStatusQuery.isFetching;

  const primaryLoading =
    connectMutation.isPending ||
    selectionMutation.isPending ||
    telegramConnectMutation.isPending;

  const disconnectLoading =
    disconnectMutation.isPending || telegramDisconnectMutation.isPending;

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

  function handleRefresh() {
    activeStatusQuery?.refetch?.();
  }

  function handleInbox() {
    onNavigate?.("/inbox");
  }

  function handleDisconnect() {
    if (isInstagram) {
      disconnectMutation.mutate();
      return;
    }

    if (isTelegram) {
      telegramDisconnectMutation.mutate();
    }
  }

  function handleTelegramCreate() {
    if (typeof window !== "undefined") {
      window.open(BOTFATHER_URL, "_blank", "noopener,noreferrer");
    }
  }

  function handleTelegramConnect() {
    const botToken = s(telegramBotToken);
    if (!botToken) return;

    setTelegramFeedback(null);
    telegramConnectMutation.mutate({ botToken });
  }

  function handlePrimaryAction() {
    if (connected) {
      handleInbox();
      return;
    }

    if (isTelegram) {
      handleTelegramConnect();
      return;
    }

    if (isInstagram && !pendingSelectionRequired) {
      connectMutation.mutate();
    }
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

  const disconnectAvailable =
    connected &&
    ((isInstagram && activeStatus?.actions?.disconnectAvailable !== false) ||
      (isTelegram && activeStatus?.actions?.disconnectAvailable !== false));

  const telegramRequiresInput = isTelegram && !connected;

  const primaryLabel = connected
    ? "Open inbox"
    : isTelegram
      ? "Connect Telegram"
      : pendingSelectionRequired
        ? "Choose account"
        : "Connect Instagram";

  const primaryDisabled =
    pendingSelectionRequired ||
    primaryLoading ||
    telegramBusy ||
    (telegramRequiresInput && !s(telegramBotToken));

  return (
    <aside
      aria-hidden={!open}
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface"
    >
      <header className="shrink-0 border-b border-line-soft bg-surface px-7 py-5">
        <div className="flex items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center">
              <ChannelIcon channel={channel} size="lg" />
            </div>

            <div className="min-w-0">
              <div className="truncate text-[24px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
                {channel?.name}
              </div>

              <div className="mt-1 text-[13px] font-semibold text-text-muted">
                {channelStateLabel(activeStatus?.state || channel?.status)}
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close channel details"
            onClick={handleClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-line-soft bg-surface text-text-muted transition-colors hover:bg-surface-subtle hover:text-text"
          >
            <X className="h-4.5 w-4.5" strokeWidth={2.25} />
          </button>
        </div>
      </header>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto bg-surface-muted px-7 py-6">
        <div className="mx-auto max-w-[860px] space-y-4">
          {hasConnectedFeedback ? (
            <InlineNotice
              tone="success"
              compact
              description="Instagram connected."
            />
          ) : null}

          {hasSelectionFeedback ? (
            <InlineNotice
              tone="warning"
              compact
              description="Choose the Instagram account you want to connect."
            />
          ) : null}

          {metaError ? (
            <InlineNotice tone="danger" compact description={metaError} />
          ) : null}

          {metaActionError ? (
            <InlineNotice tone="danger" compact description={metaActionError} />
          ) : null}

          {telegramFeedback?.message ? (
            <InlineNotice
              tone={telegramFeedback.tone}
              compact
              description={telegramFeedback.message}
            />
          ) : null}

          {telegramActionError ? (
            <InlineNotice
              tone="danger"
              compact
              description={telegramActionError}
            />
          ) : null}

          <StatusCard
            channel={channel}
            status={activeStatus}
            loading={activeStatusQuery?.isFetching === true}
            onRefresh={handleRefresh}
          />

          {pendingSelectionRequired ? (
            <PendingInstagramSelection
              pendingSelection={pendingSelection}
              isLoading={selectionMutation.isPending}
              selectingCandidateId={selectingCandidateId}
              onSelect={handleCandidateSelect}
            />
          ) : null}

          {telegramRequiresInput ? (
            <TelegramConnectBox
              value={telegramBotToken}
              loading={telegramConnectMutation.isPending}
              disabled={telegramBusy}
              onChange={setTelegramBotToken}
              onConnect={handleTelegramConnect}
              onCreate={handleTelegramCreate}
            />
          ) : null}

          <Card padded="md">
            <div className="flex items-start justify-between gap-5">
              <div>
                <h3 className="text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                  Inbox flow
                </h3>

                <p className="mt-2 max-w-[560px] text-[13.5px] font-medium leading-6 text-text-muted">
                  Customer messages from this channel are handled from the shared inbox.
                </p>
              </div>

              <CheckCircle2
                className={cx(
                  "h-5 w-5",
                  connected ? "text-success" : "text-text-subtle"
                )}
                strokeWidth={2.1}
              />
            </div>

            {isTelegram && !connected ? (
              <div className="mt-4">
                <SmallLinkButton onClick={handleTelegramCreate}>
                  Open BotFather
                </SmallLinkButton>
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      <footer className="shrink-0 border-t border-line-soft bg-white px-7 py-4">
        <div className="mx-auto max-w-[860px]">
          <ActionPanel
            connected={connected}
            pendingSelection={pendingSelectionRequired}
            primaryLabel={primaryLabel}
            primaryDisabled={primaryDisabled}
            primaryLoading={primaryLoading}
            disconnectLoading={disconnectLoading}
            disconnectAvailable={disconnectAvailable}
            onPrimary={handlePrimaryAction}
            onInbox={handleInbox}
            onDisconnect={handleDisconnect}
          />
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