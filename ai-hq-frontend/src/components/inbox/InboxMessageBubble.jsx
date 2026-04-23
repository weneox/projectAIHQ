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

function InspectBlock({ open, onToggle, traceSource, align = "start" }) {
  return (
    <div
      className={[
        "mt-2 flex w-full",
        align === "end" ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <div className="w-fit max-w-[min(72%,640px)]">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-2 rounded-[10px] border border-[rgba(15,23,42,0.08)] bg-white px-3 py-1.5 text-[11px] font-medium text-[rgba(71,85,105,0.9)] transition-colors hover:bg-[rgba(248,250,252,0.98)] hover:text-[rgba(15,23,42,0.88)]"
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

function InboundAvatar({ title, avatarUrl }) {
  const initials = initialsFromName(title);

  return (
    <div className="mt-[22px] flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[rgba(15,23,42,0.08)] bg-[#F8FAFC] text-[11px] font-semibold text-[rgba(51,65,85,0.9)]">
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

function MetaRow({ name, sentAt, align = "start" }) {
  return (
    <div
      className={[
        "flex items-center gap-2 px-1 text-[12px]",
        align === "end" ? "justify-end text-right" : "justify-start text-left",
      ].join(" ")}
    >
      <span className="font-medium text-[rgba(71,85,105,0.96)]">{name}</span>
      {sentAt ? (
        <>
          <span className="text-[rgba(203,213,225,1)]">•</span>
          <span className="text-[rgba(148,163,184,0.98)]">{sentAt}</span>
        </>
      ) : null}
    </div>
  );
}

function Bubble({ children, tone = "inbound" }) {
  const toneClass =
    tone === "outbound"
      ? "border-[rgba(15,23,42,0.08)] bg-[#F4F6F8] text-[rgba(15,23,42,0.96)]"
      : "border-[rgba(15,23,42,0.08)] bg-white text-[rgba(15,23,42,0.96)]";

  return (
    <div
      className={[
        "w-fit max-w-[min(72%,640px)] rounded-[14px] border px-4 py-3 text-[15px] leading-7 shadow-none",
        toneClass,
      ].join(" ")}
    >
      {children}
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
        <div className="flex max-w-full items-start gap-3">
          <InboundAvatar title={displayName} avatarUrl={avatarUrl} />

          <div className="min-w-0 max-w-full">
            <MetaRow name={displayName} sentAt={sentAt} align="start" />

            <div className="mt-1">
              <Bubble tone="inbound">
                {text ? (
                  <div className="whitespace-pre-wrap break-words">{text}</div>
                ) : (
                  <span className="text-[rgba(148,163,184,0.98)]">
                    (empty message)
                  </span>
                )}
              </Bubble>
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

  return (
    <div className="flex w-full justify-end">
      <div className="min-w-0 max-w-full">
        <MetaRow name="AI" sentAt={sentAt} align="end" />

        <div className="mt-1 flex justify-end">
          <Bubble tone="outbound">
            {text ? (
              <div className="whitespace-pre-wrap break-words">{text}</div>
            ) : (
              <span className="text-[rgba(148,163,184,0.98)]">
                (empty message)
              </span>
            )}
          </Bubble>
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