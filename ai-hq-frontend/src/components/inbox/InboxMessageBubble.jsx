import { fmtRelative } from "../../lib/inbox-ui.js";

export default function InboxMessageBubble({ m }) {
  const inbound = m.direction === "inbound";
  const align = inbound ? "items-start" : "items-end";
  const bubble = inbound
    ? "border-white/10 bg-white/[0.04] text-white/84"
    : m.sender_type === "agent"
      ? "border-violet-400/18 bg-violet-400/[0.08] text-violet-50"
      : "border-cyan-400/18 bg-cyan-400/[0.07] text-cyan-50";

  const who =
    m.sender_type === "agent"
      ? "operator"
      : m.sender_type === "ai"
        ? "ai"
        : m.sender_type || m.direction || "message";

  return (
    <div className={`flex flex-col ${align}`}>
      <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-white/30">
        {who} · {fmtRelative(m.sent_at || m.created_at)}
      </div>
      <div
        className={`max-w-[92%] rounded-[20px] border px-4 py-3 text-sm leading-6 shadow-[0_10px_24px_rgba(0,0,0,0.15)] ${bubble}`}
      >
        {m.text || <span className="text-white/40">(empty message)</span>}
      </div>
    </div>
  );
}