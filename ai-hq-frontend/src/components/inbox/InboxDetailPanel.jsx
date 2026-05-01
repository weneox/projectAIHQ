import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowRight, PlugZap } from "lucide-react";

import SurfaceBanner from "../feedback/SurfaceBanner.jsx";
import InboxMessageBubble from "./InboxMessageBubble.jsx";
import InboxDetailHeaderCompact from "./InboxDetailHeaderCompact.jsx";
import { indexAttemptsByMessageCorrelation } from "./outboundAttemptTruth.js";

const INITIAL_MESSAGE_WINDOW = 48;
const MESSAGE_WINDOW_STEP = 32;
const REVEAL_OLDER_THRESHOLD_PX = 220;
const STICK_TO_BOTTOM_THRESHOLD_PX = 120;

const MemoInboxMessageBubble = memo(InboxMessageBubble);

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function looksLikeNumericIdentity(value = "") {
  const safe = s(value);
  if (!safe) return false;
  return /^\d{5,}$/.test(safe);
}

function isPlaceholderDisplayName(value = "") {
  const safe = lower(value);
  if (!safe) return true;

  return [
    "customer",
    "conversation",
    "instagram user",
    "telegram user",
    "facebook user",
    "whatsapp user",
    "website user",
    "web user",
    "user",
    "unknown",
  ].includes(safe);
}

function normalizeUsername(value = "") {
  const safe = s(value).replace(/^@+/, "");
  if (!safe) return "";
  if (looksLikeNumericIdentity(safe)) return "";
  return safe;
}

function resolveConversationTitle(thread) {
  const displayName = s(thread?.display_name || thread?.displayName);
  const customerName = s(thread?.customer_name);
  const externalUsername = normalizeUsername(thread?.external_username);
  const externalUserId = s(thread?.external_user_id);
  const externalThreadId = s(thread?.external_thread_id);
  const channel = lower(
    thread?.channel ||
      thread?.channel_type ||
      thread?.provider ||
      thread?.source_type
  );

  if (displayName && !isPlaceholderDisplayName(displayName)) return displayName;
  if (customerName && !looksLikeNumericIdentity(customerName)) return customerName;
  if (externalUsername) return externalUsername;

  if (channel === "instagram" && externalUserId) return "Instagram User";
  if (channel === "telegram" && externalUserId) return "Telegram User";

  if (externalUserId && !looksLikeNumericIdentity(externalUserId)) {
    return externalUserId;
  }

  if (externalThreadId && !looksLikeNumericIdentity(externalThreadId)) {
    return externalThreadId;
  }

  if (externalUserId) return "Customer";
  return "Conversation";
}

function resolveChannelLabel(thread) {
  const raw =
    s(thread?.channel_label) ||
    s(thread?.channel_type) ||
    s(thread?.provider) ||
    s(thread?.source_type) ||
    s(thread?.channel);

  if (!raw) return "";

  const normalized = raw.toLowerCase();

  if (normalized === "webchat") return "Web Chat";
  if (normalized === "web") return "Website";
  if (normalized === "whatsapp") return "WhatsApp";
  if (normalized === "telegram") return "Telegram";
  if (normalized === "instagram") return "Instagram";
  if (normalized === "facebook") return "Facebook";
  if (normalized === "email") return "Email";

  return raw
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCustomerSince(value = "") {
  const safe = s(value);
  if (!safe) return "";

  const date = new Date(safe);
  if (Number.isNaN(date.getTime())) return "";

  return `Customer since ${date.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  })}`;
}

function formatConversationMeta(thread) {
  const items = [];

  const channel = resolveChannelLabel(thread);
  const customerSince = formatCustomerSince(thread?.created_at);
  const status =
    s(thread?.status_label) ||
    s(thread?.status) ||
    (thread?.handoff_active ? "handoff active" : "");

  if (customerSince) items.push(customerSince);

  if (
    status &&
    !["open", "conversation"].includes(String(status).toLowerCase())
  ) {
    items.push(
      status
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    );
  }

  if (channel) items.push(channel);

  return items;
}

function resolveOriginalMessageType(message = {}) {
  const meta = obj(message?.meta);
  return lower(meta?.originalMessageType || meta?.original_message_type || "");
}

function isControlLikeMessageType(value = "") {
  return [
    "system",
    "typing",
    "typing_on",
    "typing_off",
    "typing-on",
    "typing-off",
    "typingon",
    "typingoff",
    "typing_start",
    "typing_stop",
    "typing-start",
    "typing-stop",
    "mark_seen",
    "mark-seen",
    "markseen",
    "seen",
    "read",
    "delivery",
    "reaction",
    "echo",
  ].includes(lower(value));
}

function isRenderableConversationMessage(message = {}) {
  if (!message || typeof message !== "object") return false;

  const storageType = lower(message?.message_type);
  const originalType = resolveOriginalMessageType(message);
  const senderType = lower(message?.sender_type);
  const source = lower(message?.meta?.source);

  if (isControlLikeMessageType(storageType)) return false;
  if (isControlLikeMessageType(originalType)) return false;
  if (["system", "decision"].includes(senderType)) return false;

  if (
    ["decision", "decision_engine", "decision-event", "system"].includes(source)
  ) {
    return false;
  }

  return Boolean(s(message?.text));
}

function ConnectChannelEmptyState({ onOpenChannels }) {
  return (
    <div className="flex h-full min-h-[420px] items-center justify-center px-8 py-10">
      <div className="flex max-w-[560px] flex-col items-center text-center">
        <div className="relative mb-7">
          <div className="absolute inset-0 bg-[rgba(148,163,184,0.08)] blur-3xl" />
          <PlugZap
            className="relative h-24 w-24 text-[rgba(100,116,139,0.52)]"
            strokeWidth={1.55}
          />
        </div>

        <div className="text-[28px] font-semibold tracking-[-0.02em] text-[#0F172A]">
          Connect a channel to activate the inbox
        </div>

        <div className="mt-3 max-w-[440px] text-[15px] leading-8 text-[#64748B]">
          Your live inbox will appear here once Website chat, Meta, Telegram,
          or another launch channel is connected.
        </div>

        <button
          type="button"
          onClick={onOpenChannels}
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-[14px] bg-[#2563EB] px-5 text-[14px] font-semibold text-white shadow-[0_22px_45px_-24px_rgba(37,99,235,0.62)] transition-colors hover:bg-[#1D5FD0]"
        >
          <span>Open channels</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyComposerDock() {
  return (
    <div className="w-full px-4 pb-4 md:px-5 md:pb-6">
      <div className="w-full rounded-[30px] border border-[#E7ECF3] bg-white px-5 py-4 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.16)]">
        <div className="flex items-end gap-4">
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#B8C2D1]"
            >
              +
            </button>
            <button
              type="button"
              disabled
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#B8C2D1]"
            >
              ☺
            </button>
            <button
              type="button"
              disabled
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#B8C2D1]"
            >
              ⎋
            </button>
          </div>

          <textarea
            disabled
            rows={1}
            placeholder="Write a reply..."
            className="min-h-[30px] flex-1 resize-none bg-transparent px-0 py-2 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none disabled:cursor-not-allowed"
          />

          <button
            type="button"
            disabled
            className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] border border-[#E6ECF5] bg-[#EEF3FA] text-[#A0AEC0]"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}

function FloatingComposerSlot({ children }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
      <div className="bg-[linear-gradient(180deg,rgba(248,250,252,0)_0%,rgba(248,250,252,0.68)_28%,rgba(248,250,252,0.94)_68%,rgba(248,250,252,0.985)_100%)] pt-3">
        <div className="pointer-events-auto">{children}</div>
      </div>
    </div>
  );
}

function TypingIndicatorBubble({ side = "left" }) {
  const incoming = side === "left";
  const dotColor = incoming ? "#8A9AAF" : "rgba(255,255,255,0.94)";

  return (
    <div
      className={[
        "flex w-full px-3 py-[5px] sm:px-5",
        incoming ? "justify-start" : "justify-end",
      ].join(" ")}
      aria-live="polite"
    >
      <style>
        {`
          @keyframes inboxTypingDotWave {
            0%, 72%, 100% {
              transform: translateY(0);
              opacity: 0.38;
            }
            34% {
              transform: translateY(-4px);
              opacity: 1;
            }
          }
        `}
      </style>

      <div
        className={[
          "inline-flex h-[36px] min-w-[66px] items-center justify-center gap-[5px] rounded-[18px] px-[14px]",
          incoming
            ? "rounded-bl-[8px] bg-white shadow-[0_16px_36px_-25px_rgba(15,23,42,0.28),0_8px_18px_-16px_rgba(15,23,42,0.18),inset_0_0_0_1px_rgba(15,23,42,0.035)]"
            : "rounded-br-[8px] bg-[linear-gradient(180deg,#4EAAFF_0%,#2F95EF_55%,#1D84E4_100%)] shadow-[0_16px_34px_-22px_rgba(37,99,235,0.48),inset_0_1px_0_rgba(255,255,255,0.34)]",
        ].join(" ")}
        aria-label={incoming ? "Customer is typing" : "Business is typing"}
      >
        {[0, 1, 2].map((item) => (
          <span
            key={item}
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              display: "block",
              background: dotColor,
              animation: "inboxTypingDotWave 1.16s ease-in-out infinite",
              animationDelay: `${item * 0.14}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyConversationState() {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center px-8 py-10">
      <div className="w-full max-w-[520px] rounded-[28px] border border-[#E6EAF0] bg-white px-8 py-10 text-center shadow-[0_30px_70px_-52px_rgba(15,23,42,0.18)]">
        <div className="text-[18px] font-semibold text-[#0F172A]">
          Select a conversation
        </div>
        <div className="mt-2 text-[14px] leading-7 text-[#64748B]">
          Choose a conversation from the left to review the messages and send a
          reply.
        </div>
      </div>
    </div>
  );
}

function ConversationLoadingState() {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-10">
      <style>
        {`
          @keyframes inbox-detail-loading-sweep {
            0% {
              transform: translateX(-165%);
              opacity: 0;
            }
            12% {
              opacity: 0.5;
            }
            48% {
              transform: translateX(0%);
              opacity: 1;
            }
            88% {
              opacity: 0.55;
            }
            100% {
              transform: translateX(165%);
              opacity: 0;
            }
          }

          @keyframes inbox-detail-loading-track-breathe {
            0%, 100% {
              opacity: 0.72;
            }
            50% {
              opacity: 1;
            }
          }
        `}
      </style>

      <div
        className="relative h-10 w-[220px]"
        role="status"
        aria-label="Loading conversation"
      >
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[#DCE6F2]" />

        <div
          className="absolute left-1/2 top-1/2 h-[2px] w-[94px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,rgba(37,99,235,0)_0%,rgba(37,99,235,0.18)_18%,rgba(37,99,235,0.98)_50%,rgba(37,99,235,0.18)_82%,rgba(37,99,235,0)_100%)] shadow-[0_0_18px_rgba(37,99,235,0.18)]"
          style={{
            animation:
              "inbox-detail-loading-sweep 1.8s cubic-bezier(0.22,1,0.36,1) infinite, inbox-detail-loading-track-breathe 1.8s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

function InboxDetailPanel({
  selectedThread,
  messages,
  outboundAttempts,
  surface,
  actionState,
  markRead,
  assignThread,
  activateHandoff,
  setThreadStatus,
  onOpenDetails,
  automationControl,
  onToggleAutomation,
  composer = null,
  launchChannelConnected = true,
  onOpenChannels = null,
}) {
  const hasThread = Boolean(selectedThread?.id);
  const canShowConversationSurface = launchChannelConnected || hasThread;
  const unreadCount = Number(selectedThread?.unread_count ?? 0);
  const handoffActive = Boolean(selectedThread?.handoff_active);
  const currentThreadId = s(selectedThread?.id);

  const scrollViewportRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const lastThreadIdRef = useRef("");
  const lastWindowThreadIdRef = useRef("");
  const pendingPrependScrollRef = useRef(null);
  const scrollRafRef = useRef(0);

  const [messageWindowLimit, setMessageWindowLimit] = useState(
    INITIAL_MESSAGE_WINDOW
  );

  const visibleMessages = useMemo(
    () =>
      Array.isArray(messages)
        ? messages.filter((message) => isRenderableConversationMessage(message))
        : [],
    [messages]
  );

  useEffect(() => {
    if (lastWindowThreadIdRef.current === currentThreadId) return;

    lastWindowThreadIdRef.current = currentThreadId;
    pendingPrependScrollRef.current = null;
    shouldStickToBottomRef.current = true;
    setMessageWindowLimit(INITIAL_MESSAGE_WINDOW);
  }, [currentThreadId]);

  const renderedMessages = useMemo(() => {
    if (visibleMessages.length <= messageWindowLimit) return visibleMessages;
    return visibleMessages.slice(visibleMessages.length - messageWindowLimit);
  }, [messageWindowLimit, visibleMessages]);

  const hiddenOlderMessageCount = Math.max(
    0,
    visibleMessages.length - renderedMessages.length
  );

  const canRevealOlderMessages = hiddenOlderMessageCount > 0;

  const revealOlderMessages = useCallback(() => {
    if (!canRevealOlderMessages) return;

    const viewport = scrollViewportRef.current;

    pendingPrependScrollRef.current = viewport
      ? {
          scrollHeight: viewport.scrollHeight,
          scrollTop: viewport.scrollTop,
        }
      : null;

    setMessageWindowLimit((current) =>
      Math.min(visibleMessages.length, current + MESSAGE_WINDOW_STEP)
    );
  }, [canRevealOlderMessages, visibleMessages.length]);

  useLayoutEffect(() => {
    const pending = pendingPrependScrollRef.current;
    if (!pending) return;

    const viewport = scrollViewportRef.current;
    pendingPrependScrollRef.current = null;

    if (!viewport) return;

    const nextScrollHeight = viewport.scrollHeight;
    const delta = Math.max(0, nextScrollHeight - pending.scrollHeight);

    viewport.scrollTop = pending.scrollTop + delta;
  }, [renderedMessages.length]);

  useEffect(() => {
    if (!hasThread) {
      shouldStickToBottomRef.current = true;
      lastThreadIdRef.current = "";
      return;
    }

    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const threadChanged = lastThreadIdRef.current !== currentThreadId;

    if (threadChanged || shouldStickToBottomRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
    }

    lastThreadIdRef.current = currentThreadId;
  }, [currentThreadId, visibleMessages.length, hasThread]);

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return undefined;

    function readScrollState() {
      scrollRafRef.current = 0;

      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

      shouldStickToBottomRef.current =
        distanceFromBottom <= STICK_TO_BOTTOM_THRESHOLD_PX;

      if (
        viewport.scrollTop <= REVEAL_OLDER_THRESHOLD_PX &&
        canRevealOlderMessages
      ) {
        revealOlderMessages();
      }
    }

    function handleScroll() {
      if (scrollRafRef.current) return;
      scrollRafRef.current = window.requestAnimationFrame(readScrollState);
    }

    readScrollState();
    viewport.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      viewport.removeEventListener("scroll", handleScroll);

      if (scrollRafRef.current) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = 0;
      }
    };
  }, [canRevealOlderMessages, currentThreadId, revealOlderMessages]);

  const attemptsByCorrelation = useMemo(
    () => indexAttemptsByMessageCorrelation(outboundAttempts),
    [outboundAttempts]
  );

  const disabledMap = {
    read: Boolean(actionState?.isActionPending?.("read")),
    assign: Boolean(actionState?.isActionPending?.("assign")),
    handoff: Boolean(actionState?.isActionPending?.("handoff")),
    handoffLocked: handoffActive,
    resolved: Boolean(actionState?.isActionPending?.("resolved")),
    closed: Boolean(actionState?.isActionPending?.("closed")),
  };

  const canMarkRead = hasThread && unreadCount > 0;

  const showSurfaceBanner =
    hasThread &&
    (surface?.unavailable ||
      surface?.availability === "unavailable" ||
      surface?.error ||
      surface?.saveError ||
      surface?.saveSuccess);

  const conversationTitle = resolveConversationTitle(selectedThread);
  const conversationMetaItems = formatConversationMeta(selectedThread);
  const customerTypingActive = false;
  const businessTypingActive = false;

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)]">
      <InboxDetailHeaderCompact
        launchChannelConnected={launchChannelConnected}
        hasThread={hasThread}
        title={conversationTitle}
        metaItems={conversationMetaItems}
        unreadCount={unreadCount}
        automationControl={automationControl}
        onToggleAutomation={onToggleAutomation}
        onOpenDetails={onOpenDetails}
        onRefresh={surface?.refresh}
        onCloseThread={() => {
          if (selectedThread?.id) {
            setThreadStatus(selectedThread.id, "closed");
          }
        }}
        onMarkRead={() => {
          if (selectedThread?.id) {
            markRead(selectedThread.id);
          }
        }}
        canMarkRead={canMarkRead}
        onAssign={() => {
          if (selectedThread?.id) {
            assignThread(selectedThread.id);
          }
        }}
        onHandoff={() => {
          if (selectedThread?.id) {
            activateHandoff(selectedThread.id);
          }
        }}
        onResolve={() => {
          if (selectedThread?.id) {
            setThreadStatus(selectedThread.id, "resolved");
          }
        }}
        disabledMap={disabledMap}
      />

      <div className="relative min-h-0 flex-1">
        {!canShowConversationSurface ? (
          <ConnectChannelEmptyState onOpenChannels={onOpenChannels} />
        ) : (
          <>
            <div
              ref={scrollViewportRef}
              className="h-full overflow-y-auto pb-[92px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="min-h-full">
                {surface?.loading ? (
                  <ConversationLoadingState />
                ) : !hasThread ? (
                  <EmptyConversationState />
                ) : (
                  <div
                    className="flex min-h-full w-full flex-col py-6 pl-0 pr-4 sm:pl-1 sm:pr-5 md:pl-1 md:pr-6 lg:pl-2 lg:pr-7 xl:pl-2 xl:pr-8"
                    style={{ "--inbox-surface": "#F8FAFC" }}
                  >
                    {showSurfaceBanner ? (
                      <div className="mb-4 w-full">
                        <SurfaceBanner
                          surface={surface}
                          unavailableMessage="Conversation detail is temporarily unavailable."
                          refreshLabel="Refresh conversation"
                        />
                      </div>
                    ) : null}

                    {!visibleMessages.length ? (
                      <div className="flex min-h-[320px] items-center justify-center">
                        <div className="w-full max-w-[520px] rounded-[26px] border border-[#E6EAF0] bg-white px-8 py-10 text-center shadow-[0_30px_70px_-52px_rgba(15,23,42,0.16)]">
                          <div className="text-[18px] font-semibold text-[#0F172A]">
                            No messages yet
                          </div>
                          <div className="mt-2 text-[14px] leading-7 text-[#64748B]">
                            This conversation has no visible message history yet.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-auto w-full space-y-6">
                        {renderedMessages.map((message) => (
                          <MemoInboxMessageBubble
                            key={message.id}
                            m={message}
                            thread={selectedThread}
                            attemptsByCorrelation={attemptsByCorrelation}
                            enableInspect={false}
                          />
                        ))}

                        {customerTypingActive ? (
                          <TypingIndicatorBubble side="left" />
                        ) : null}

                        {businessTypingActive ? (
                          <TypingIndicatorBubble side="right" />
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <FloatingComposerSlot>
              {hasThread && composer ? (
                <div className="w-full px-4 pb-4 md:px-5 md:pb-6 [&>*]:mx-0 [&>*]:w-full [&>*]:max-w-none">
                  {composer}
                </div>
              ) : (
                <EmptyComposerDock />
              )}
            </FloatingComposerSlot>
          </>
        )}
      </div>
    </section>
  );
}

export default memo(InboxDetailPanel);