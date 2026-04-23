import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

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
  if (message?.sender_type === "ai") return "AI";
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
    <div className="mt-[22px] flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#334155] shadow-[0_8px_18px_-14px_rgba(15,23,42,0.22)]">
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
    ? "rounded-[20px] rounded-bl-[9px] border border-[#E5EAF1] bg-white text-[#0F172A]"
    : "rounded-[20px] rounded-br-[9px] border border-[#D8E1EB] bg-[#EEF2F6] text-[#0F172A]";

  const tailOuterClass = incoming
    ? "absolute -left-[8px] bottom-[8px] h-[18px] w-[18px] rounded-bl-[14px] border-b border-l border-[#E5EAF1] bg-white"
    : "absolute -right-[8px] bottom-[8px] h-[18px] w-[18px] rounded-br-[14px] border-b border-r border-[#D8E1EB] bg-[#EEF2F6]";

  const tailCutClass = incoming
    ? "absolute -left-[12px] bottom-[7px] h-[22px] w-[12px] rounded-br-[14px] bg-[var(--inbox-surface,#F8FAFC)]"
    : "absolute -right-[12px] bottom-[7px] h-[22px] w-[12px] rounded-bl-[14px] bg-[var(--inbox-surface,#F8FAFC)]";

  return (
    <div className={incoming ? "flex justify-start" : "flex justify-end"}>
      <div className="relative inline-block max-w-full align-top">
        <span aria-hidden="true" className={tailOuterClass} />
        <span aria-hidden="true" className={tailCutClass} />

        <div
          className={[
            "relative z-[1] inline-block max-w-full px-4 py-3 text-[15px] leading-[1.62] shadow-[0_16px_28px_-24px_rgba(15,23,42,0.18)]",
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
        <div className="flex w-full items-start gap-3 pr-[14%] md:pr-[18%] lg:pr-[22%] xl:pr-[26%]">
          <InboundAvatar title={displayName} avatarUrl={avatarUrl} />

          <div className="min-w-0 flex-1">
            <MessageMeta name={displayName} sentAt={sentAt} align="start" />

            <div className="mt-1 max-w-[min(760px,74%)]">
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

  const outgoingLabel = m?.sender_type === "agent" ? "You" : "AI";

  return (
    <div className="flex w-full justify-end">
      <div className="w-full pl-[24%] md:pl-[29%] lg:pl-[34%] xl:pl-[39%]">
        <MessageMeta name={outgoingLabel} sentAt={sentAt} align="end" />

        <div className="mt-1 ml-auto max-w-[min(660px,100%)]">
          <BubbleShell side="right">
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
            align="end"
          />
        ) : null}
      </div>
    </div>
  );
}