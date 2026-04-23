import { useMemo, useState } from "react";
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

function resolveSenderLabel(message, inbound) {
  if (inbound) return "Customer";
  if (message?.sender_type === "agent") return "You";
  if (message?.sender_type === "ai") return "AI";
  return "Reply";
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

function resolveBubbleTone(message, inbound) {
  if (inbound) {
    return {
      metaTone: "text-[rgba(71,85,105,0.92)]",
      bubble:
        "border-[rgba(15,23,42,0.08)] bg-white text-[rgba(15,23,42,0.96)] shadow-[0_14px_32px_-26px_rgba(15,23,42,0.12)]",
    };
  }

  if (message?.sender_type === "agent") {
    return {
      metaTone: "text-[rgba(100,116,139,0.94)]",
      bubble:
        "border-[rgba(15,23,42,0.06)] bg-[rgba(246,248,250,0.98)] text-[rgba(15,23,42,0.96)] shadow-[0_14px_30px_-24px_rgba(15,23,42,0.10)]",
    };
  }

  return {
    metaTone: "text-[rgba(100,116,139,0.94)]",
    bubble:
      "border-[rgba(148,163,184,0.18)] bg-[rgba(248,250,252,0.98)] text-[rgba(15,23,42,0.96)] shadow-[0_14px_30px_-24px_rgba(15,23,42,0.10)]",
  };
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
        "mt-1 flex w-full",
        align === "end" ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <div className="w-fit max-w-[84%] sm:max-w-[78%] xl:max-w-[70%]">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-2 rounded-[11px] border border-[rgba(15,23,42,0.08)] bg-white px-3 py-1.5 text-[11px] font-medium text-[rgba(71,85,105,0.92)] transition-colors hover:bg-[rgba(248,250,252,0.96)] hover:text-[rgba(15,23,42,0.88)]"
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
    <div className="mt-[18px] flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[rgba(15,23,42,0.06)] bg-[rgba(248,250,252,0.96)] text-[11px] font-semibold text-[rgba(51,65,85,0.9)] shadow-[0_10px_22px_-18px_rgba(15,23,42,0.16)]">
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

export default function InboxMessageBubble({
  m,
  thread = null,
  attemptsByCorrelation: _attemptsByCorrelation,
  enableInspect = false,
}) {
  const [inspectOpen, setInspectOpen] = useState(false);

  const inbound = m?.direction === "inbound";
  const label = resolveSenderLabel(m, inbound);
  const displayName = resolveDisplayName(m, inbound, thread);
  const tone = resolveBubbleTone(m, inbound);
  const showInspect = shouldAllowInspect(m, enableInspect);
  const sentAt = fmtRelative(m?.sent_at || m?.created_at);
  const text = s(m?.text);
  const inboundAvatarUrl = useMemo(
    () => (inbound ? resolveAvatarUrl(m, thread) : ""),
    [inbound, m, thread]
  );

  if (inbound) {
    return (
      <div className="flex items-start gap-3">
        <InboundAvatar title={displayName} avatarUrl={inboundAvatarUrl} />

        <div className="min-w-0 flex flex-col items-start gap-1.5">
          <div
            className={[
              "flex items-center gap-2 px-1 text-[11px]",
              tone.metaTone,
            ].join(" ")}
          >
            <span className="font-medium">{displayName || label}</span>
            {sentAt ? (
              <>
                <span className="text-[rgba(203,213,225,0.96)]">•</span>
                <span className="text-[rgba(148,163,184,0.96)]">{sentAt}</span>
              </>
            ) : null}
          </div>

          <div
            className={[
              "w-fit max-w-[82%] sm:max-w-[74%] xl:max-w-[66%] rounded-[16px] border px-4 py-3 text-[14.5px] leading-7",
              tone.bubble,
            ].join(" ")}
          >
            {text ? (
              <div className="whitespace-pre-wrap break-words">{text}</div>
            ) : (
              <span className="text-[rgba(148,163,184,0.96)]">
                (empty message)
              </span>
            )}
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
    );
  }

  return (
    <div className="flex justify-end">
      <div className="min-w-0 flex flex-col items-end gap-1.5">
        <div
          className={[
            "flex items-center gap-2 px-1 text-[11px]",
            tone.metaTone,
          ].join(" ")}
        >
          <span className="font-medium">{label}</span>
          {sentAt ? (
            <>
              <span className="text-[rgba(203,213,225,0.96)]">•</span>
              <span className="text-[rgba(148,163,184,0.96)]">{sentAt}</span>
            </>
          ) : null}
        </div>

        <div
          className={[
            "w-fit max-w-[82%] sm:max-w-[74%] xl:max-w-[66%] rounded-[16px] border px-4 py-3 text-[14.5px] leading-7",
            tone.bubble,
          ].join(" ")}
        >
          {text ? (
            <div className="whitespace-pre-wrap break-words">{text}</div>
          ) : (
            <span className="text-[rgba(148,163,184,0.96)]">
              (empty message)
            </span>
          )}
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