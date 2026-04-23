import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";

import { fmtRelative } from "../../lib/inbox-ui.js";
import { normalizeReplayTrace } from "../../lib/replayTrace.js";
import InboxReplayTraceCard from "./InboxReplayTraceCard.jsx";

function s(value) {
  return String(value ?? "").trim();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function initialsFromName(value = "") {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "C";

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function resolveDisplayName(message, inbound, thread) {
  const meta = obj(message?.meta);

  if (inbound) {
    return (
      s(
        message?.sender_name ||
          meta?.senderName ||
          meta?.sender_name ||
          thread?.display_name ||
          thread?.displayName ||
          thread?.customer_name
      ) || "Customer"
    );
  }

  if (message?.sender_type === "agent") return "You";
  if (message?.sender_type === "ai") return "AI HQ";
  return "Reply";
}

function resolveAvatarUrl(message, thread) {
  const meta = obj(message?.meta);

  return s(
    message?.avatar_url ||
      message?.sender_avatar_url ||
      meta?.avatarUrl ||
      meta?.avatar_url ||
      meta?.profilePicture ||
      meta?.profile_picture ||
      thread?.avatar_url ||
      thread?.avatarUrl
  );
}

function shouldAllowInspect(message, enableInspect) {
  if (!enableInspect) return false;
  const replayTrace = normalizeReplayTrace(message);
  return Boolean(
    replayTrace?.hasTrace &&
      (message?.sender_type === "ai" || message?.direction === "outbound")
  );
}

function InboundAvatar({ title, avatarUrl }) {
  const initials = initialsFromName(title);

  return (
    <div className="mt-[22px] flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#334155] shadow-[0_8px_18px_-14px_rgba(15,23,42,0.18)]">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        initials
      )}
    </div>
  );
}

function AIBadge() {
  return (
    <div className="ml-3 mt-[22px] flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8E4FF] bg-[#F5F8FF] text-[#4F7CFF] shadow-[0_8px_18px_-14px_rgba(79,124,255,0.24)]">
      <Sparkles className="h-4 w-4" />
    </div>
  );
}

function MessageMeta({ name, sentAt, align = "start" }) {
  return (
    <div
      className={[
        "flex items-center gap-2 px-0.5 text-[12px] leading-5",
        align === "end" ? "justify-end text-right" : "justify-start text-left",
      ].join(" ")}
    >
      <span className="font-medium text-[#64748B]">{name}</span>
      {sentAt ? (
        <>
          <span className="text-[#CBD5E1]">•</span>
          <span className="text-[#94A3B8]">{sentAt}</span>
        </>
      ) : null}
    </div>
  );
}

function BubbleShell({ side = "left", children }) {
  const incoming = side === "left";

  const bodyClass = incoming
    ? "rounded-[22px] rounded-bl-[10px] border border-[#E7E0D5] bg-[#FFF8EE] text-[#0F172A]"
    : "rounded-[22px] rounded-br-[10px] border border-[#D7E3FF] bg-[#EAF2FF] text-[#0F172A]";

  const outerTailClass = incoming
    ? "absolute -left-[9px] bottom-[8px] h-[20px] w-[20px] rounded-bl-[15px] border-b border-l border-[#E7E0D5] bg-[#FFF8EE]"
    : "absolute -right-[9px] bottom-[8px] h-[20px] w-[20px] rounded-br-[15px] border-b border-r border-[#D7E3FF] bg-[#EAF2FF]";

  const cutTailClass = incoming
    ? "absolute -left-[14px] bottom-[7px] h-[24px] w-[14px] rounded-br-[15px] bg-[var(--inbox-surface,#F8FAFC)]"
    : "absolute -right-[14px] bottom-[7px] h-[24px] w-[14px] rounded-bl-[15px] bg-[var(--inbox-surface,#F8FAFC)]";

  return (
    <div className={incoming ? "flex justify-start" : "flex justify-end"}>
      <div className="relative inline-block max-w-full align-top">
        <span aria-hidden="true" className={outerTailClass} />
        <span aria-hidden="true" className={cutTailClass} />

        <div
          className={[
            "relative z-[1] inline-block max-w-full px-4 py-3.5 text-[15px] leading-[1.6] shadow-[0_18px_30px_-26px_rgba(15,23,42,0.14)]",
            bodyClass,
          ].join(" ")}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function InspectBlock({ open, onToggle, traceSource, align = "start" }) {
  return (
    <div
      className={[
        "mt-2 flex w-full",
        align === "end" ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <div className="max-w-[62%]">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-2 rounded-[10px] border border-[#E4E7EC] bg-white px-3 py-1.5 text-[11px] font-medium text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
        >
          {open ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          {open ? "Hide trace" : "Inspect trace"}
        </button>

        {open ? (
          <div className="mt-2">
            <InboxReplayTraceCard
              traceSource={traceSource}
              compact
              title="Message trace"
              subtitle="Replay metadata attached to this action."
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function InboxMessageBubble({
  m,
  thread = null,
  attemptsByCorrelation: _attemptsByCorrelation,
  enableInspect = false,
}) {
  const [inspectOpen, setInspectOpen] = useState(false);

  const inbound = m?.direction === "inbound";
  const sentAt = fmtRelative(m?.sent_at || m?.created_at);
  const text = s(m?.text);
  const displayName = resolveDisplayName(m, inbound, thread);
  const avatarUrl = inbound ? resolveAvatarUrl(m, thread) : "";
  const showInspect = shouldAllowInspect(m, enableInspect);

  if (inbound) {
    return (
      <div className="flex w-full justify-start">
        <div className="flex w-full items-start gap-3 pr-[10%] md:pr-[14%] lg:pr-[18%] xl:pr-[22%]">
          <InboundAvatar title={displayName} avatarUrl={avatarUrl} />

          <div className="min-w-0 flex-1">
            <MessageMeta name={displayName} sentAt={sentAt} align="start" />

            <div className="mt-1 max-w-[min(780px,78%)]">
              <BubbleShell side="left">
                {text ? (
                  <div className="whitespace-pre-wrap break-words">{text}</div>
                ) : (
                  <span className="text-[#94A3B8]">(empty message)</span>
                )}
              </BubbleShell>
            </div>

            {showInspect ? (
              <InspectBlock
                open={inspectOpen}
                onToggle={() => setInspectOpen((current) => !current)}
                traceSource={m}
                align="start"
              />
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const outgoingLabel = m?.sender_type === "agent" ? "You" : "AI HQ";
  const showAIBadge = m?.sender_type === "ai" || m?.sender_type !== "agent";

  return (
    <div className="flex w-full justify-end">
      <div className="w-full pl-[28%] md:pl-[32%] lg:pl-[37%] xl:pl-[42%]">
        <MessageMeta name={outgoingLabel} sentAt={sentAt} align="end" />

        <div className="mt-1 flex justify-end">
          <div className="ml-auto flex max-w-[min(620px,100%)] items-start justify-end">
            <BubbleShell side="right">
              {text ? (
                <div className="whitespace-pre-wrap break-words">{text}</div>
              ) : (
                <span className="text-[#94A3B8]">(empty message)</span>
              )}
            </BubbleShell>

            {showAIBadge ? <AIBadge /> : null}
          </div>
        </div>

        {showInspect ? (
          <InspectBlock
            open={inspectOpen}
            onToggle={() => setInspectOpen((current) => !current)}
            traceSource={m}
            align="end"
          />
        ) : null}
      </div>
    </div>
  );
}