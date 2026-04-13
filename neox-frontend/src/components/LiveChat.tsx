// src/components/LiveChat.tsx
import React, { useMemo } from "react";

type Role = "agent" | "customer";
export type LiveChatMsg = { id: string; role: Role; text: string; time?: string };

type Item =
  | { kind: "msg"; id: string; role: Role; text: string; time?: string }
  | { kind: "typing"; id: string; role: Role };

type Status = {
  text?: string; // default: "ACTIVE"
  dotColor?: string; // default green
  iconSrc?: string; // optional logo
  iconAlt?: string;
};

const LIVECHAT_CSS = `
/* =========================
   L I V E  C H A T — premium natural (scoped)
   Prefix: lcx-
   ========================= */

.lcx{
  --line: rgba(255,255,255,.10);
  --ink: rgba(255,255,255,.92);

  width:100%;
  border-radius: 22px;
  border: 1px solid var(--line);

  /* ✅ single panel only (no nested block look) */
  background:
    radial-gradient(1200px 600px at 12% 8%, rgba(47,184,255,.10), transparent 55%),
    radial-gradient(900px 540px at 88% 12%, rgba(42,125,255,.10), transparent 55%),
    rgba(0,0,0,.22);

  overflow:hidden;
  position:relative;
  isolation:isolate;
  box-shadow:
    0 34px 90px rgba(0,0,0,.72),
    inset 0 1px 0 rgba(255,255,255,.06);
}

.lcx:before{
  content:"";
  position:absolute;
  inset:0;
  background: linear-gradient(180deg, rgba(255,255,255,.06), transparent 42%, rgba(0,0,0,.22));
  pointer-events:none;
  z-index:0;
}

/* ✅ subtle edge vignette (still single panel) */
.lcx:after{
  content:"";
  position:absolute;
  inset:-1px;
  border-radius: 22px;
  pointer-events:none;
  z-index:1;
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.05),
    inset 0 -18px 60px rgba(0,0,0,.35);
}

.lcxHead{
  position:relative;
  z-index:2;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding: 12px 14px;
  border-bottom:1px solid rgba(255,255,255,.08);
}

.lcxTitle{
  display:flex;
  align-items:center;
  gap:10px;
  min-width:0;
}

.lcxLiveDot{
  width:10px;height:10px;border-radius:999px;
  background: rgba(66,255,190,.95);
  box-shadow: 0 0 0 3px rgba(66,255,190,.14);
  flex:0 0 auto;
}

.lcxTitleText{
  font-size:12px;
  letter-spacing:.16em;
  text-transform:uppercase;
  color: rgba(255,255,255,.72);
  white-space:nowrap;
}

.lcxStatus{
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding: 8px 10px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.03);
  color: rgba(255,255,255,.78);
  font-size:12px;
  white-space:nowrap;
}

.lcxStatusDot{
  width:8px;height:8px;border-radius:999px;
  flex:0 0 auto;
  box-shadow: 0 0 0 3px rgba(66,255,190,.14);
}

.lcxStatusIcon{
  width:18px;height:18px;
  border-radius:6px;
  display:block;
  object-fit:contain;
  flex:0 0 auto;
  filter: drop-shadow(0 8px 14px rgba(0,0,0,.55));
}

.lcxFrame{
  position:relative;
  z-index:2;
  padding: 12px;
}

/* ✅ NO "block inside block": remove border/background on inner container */
.lcxScroll{
  height: 320px;
  border-radius: 18px;
  border: 0;
  background: transparent;
  overflow: hidden;
  padding: 2px 2px;
  position: relative;
}

/* ✅ just a soft, non-rectangular wash inside */
.lcxScroll:before{
  content:"";
  position:absolute;
  inset:0;
  border-radius: 18px;
  pointer-events:none;
  background:
    radial-gradient(700px 380px at 20% 18%, rgba(255,255,255,.05), transparent 55%),
    radial-gradient(520px 360px at 85% 70%, rgba(47,184,255,.06), transparent 60%),
    linear-gradient(180deg, rgba(0,0,0,.10), rgba(0,0,0,.18));
  z-index:0;
  opacity:.9;
}

/* messages stack */
.lcxStack{
  position:relative;
  z-index:1;
  padding: 10px 10px;
  height:100%;
  display:flex;
  flex-direction:column;
  justify-content:flex-end; /* keep bottom aligned */
  gap: 10px;
}

.lcxMsg{
  display:flex;
  flex-direction:column;
  gap:6px;
  margin: 0;
}

.lcxMeta{
  display:flex;
  align-items:baseline;
  justify-content:space-between;
  gap:10px;
  font-size:11px;
  color: rgba(255,255,255,.58);
  letter-spacing:.08em;
  text-transform:uppercase;
}

.lcxWho{
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.lcxTime{
  opacity:.8;
  flex:0 0 auto;
}

.lcxBubble{
  width: fit-content;
  max-width: min(92%, 520px);
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
  color: var(--ink);
  line-height:1.35;
  font-size: 14px;
  overflow-wrap: anywhere;

  min-height: 40px;
  display:flex;
  align-items:center;
}

.lcxMsg.isAgent{ align-items:flex-end; }
.lcxMsg.isAgent .lcxMeta{ justify-content:flex-end; }
.lcxMsg.isAgent .lcxBubble{
  background: linear-gradient(180deg, rgba(47,184,255,.14), rgba(42,125,255,.08));
  border-color: rgba(47,184,255,.24);
}

.lcxMsg.isCustomer{ align-items:flex-start; }

.lcxTyping{
  display:inline-flex;
  align-items:center;
  gap:6px;
  opacity:.9;
}

.lcxDots{
  display:inline-flex;
  gap:5px;
  align-items:center;
}

.lcxDots i{
  width:6px;height:6px;border-radius:999px;
  background: rgba(255,255,255,.70);
  opacity:.55;
  animation: lcxDot 1.05s ease-in-out infinite;
}
.lcxDots i:nth-child(2){ animation-delay:.14s; }
.lcxDots i:nth-child(3){ animation-delay:.28s; }

@keyframes lcxDot{
  0%,100%{ transform: translateY(0); opacity:.45; }
  50%{ transform: translateY(-3px); opacity:.95; }
}

.lcxFoot{
  position:relative;
  z-index:2;
  padding: 12px 14px 14px;
  border-top:1px solid rgba(255,255,255,.08);
  display:flex;
  flex-wrap:wrap;
  gap:8px;
}

.lcxPill{
  display:inline-flex;
  align-items:center;
  padding: 8px 10px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.03);
  color: rgba(255,255,255,.78);
  font-size: 12px;
  line-height:1;
  white-space:nowrap;
}

@media (max-width: 520px){
  .lcxScroll{ height: 280px; }
  .lcxStack{ padding: 8px 8px; }
  .lcxBubble{ max-width: 94%; }
}
`;

export default function LiveChat({
  messages,
  typing,
  typingText,
  visibleSlots = 4,
  title = "LIVE / CUSTOMER CHAT",
  status,
}: {
  messages: LiveChatMsg[];
  typing: Role | null;
  typingText?: string;
  visibleSlots?: number;
  title?: string;
  status?: Status;
}) {
  const items = useMemo<Item[]>(() => {
    const base: Item[] = messages.map((m) => ({
      kind: "msg",
      id: m.id,
      role: m.role,
      text: m.text,
      time: m.time,
    }));

    // ✅ typing is always LAST, and message list stays only committed messages
    if (typing) base.push({ kind: "typing", id: `typing-${typing}`, role: typing });

    return base.slice(-visibleSlots);
  }, [messages, typing, visibleSlots]);

  const whoLabel = (r: Role) => (r === "customer" ? "MÜŞTƏRİ" : "NEOX AGENT");

  const dotColor = status?.dotColor ?? "rgba(66,255,190,.95)";
  const statusText = status?.text ?? "ACTIVE";

  return (
    <section className="lcx" aria-label="Live chat demo">
      <style>{LIVECHAT_CSS}</style>

      <div className="lcxHead">
        <div className="lcxTitle">
          <span className="lcxLiveDot" aria-hidden="true" />
          <div className="lcxTitleText">{title}</div>
        </div>

        <div className="lcxStatus" aria-label="status">
          <span className="lcxStatusDot" style={{ background: dotColor }} />
          {status?.iconSrc ? (
            <img className="lcxStatusIcon" src={status.iconSrc} alt={status.iconAlt ?? "platform"} />
          ) : null}
          {statusText}
        </div>
      </div>

      <div className="lcxFrame">
        <div className="lcxScroll" role="log" aria-label="Chat messages">
          <div className="lcxStack">
            {items.map((it) => {
              if (it.kind === "typing") {
                const isCustomer = it.role === "customer";
                return (
                  <div key={it.id} className={`lcxMsg ${isCustomer ? "isCustomer" : "isAgent"}`}>
                    <div className="lcxMeta">
                      <span className="lcxWho">{whoLabel(it.role)}</span>
                      <span className="lcxTime">
                        <span className="lcxTyping">
                          typing…{" "}
                          <span className="lcxDots" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                          </span>
                        </span>
                      </span>
                    </div>

                    {/* ✅ typing bubble contains ONLY the live text (no duplicate message) */}
                    <div className="lcxBubble" aria-label="Typing indicator">
                      {typingText && typingText.trim().length ? typingText : "…"}
                    </div>
                  </div>
                );
              }

              const isCustomer = it.role === "customer";
              return (
                <div key={it.id} className={`lcxMsg ${isCustomer ? "isCustomer" : "isAgent"}`}>
                  <div className="lcxMeta">
                    <span className="lcxWho">{whoLabel(it.role)}</span>
                    <span className="lcxTime">{it.time ?? ""}</span>
                  </div>
                  <div className="lcxBubble">{it.text}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="lcxFoot" aria-hidden="true">
        <span className="lcxPill">intent: detect</span>
        <span className="lcxPill">route: auto</span>
        <span className="lcxPill">audit: on</span>
        <span className="lcxPill">latency: low</span>
      </div>
    </section>
  );
}
