import { useMemo } from "react";

function useWidgetStyles() {
  return useMemo(
    () => `
      @keyframes liveWidgetFloat {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-2px); }
      }

      @keyframes liveWidgetPulse {
        0%, 100% { opacity: 0.82; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.04); }
      }

      @keyframes liveWidgetSweep {
        0% { opacity: 0; transform: translateX(-18px); }
        18% { opacity: 0.16; }
        50% { opacity: 0.24; transform: translateX(0px); }
        82% { opacity: 0.14; }
        100% { opacity: 0; transform: translateX(18px); }
      }

      @keyframes liveWidgetTyping1 {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.42; }
        40% { transform: translateY(-2px); opacity: 1; }
      }

      @keyframes liveWidgetTyping2 {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.42; }
        48% { transform: translateY(-2px); opacity: 1; }
      }

      @keyframes liveWidgetTyping3 {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.42; }
        56% { transform: translateY(-2px); opacity: 1; }
      }

      @keyframes liveWidgetBadge {
        0%, 100% { transform: scale(1); opacity: 0.94; }
        50% { transform: scale(1.08); opacity: 1; }
      }

      .live-widget-wrap {
        position: fixed;
        z-index: 90;
      }

      .live-widget-btn {
        position: relative;
        width: 58px;
        height: 58px;
        border: 0;
        padding: 0;
        background: transparent;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        animation: liveWidgetFloat 4.8s ease-in-out infinite;
        transition: transform 180ms ease;
      }

      .live-widget-btn:hover {
        transform: translateY(-1px) scale(1.025);
      }

      .live-widget-btn:active {
        transform: scale(0.975);
      }

      .live-widget-shadow {
        position: absolute;
        left: 50%;
        bottom: -3px;
        width: 42px;
        height: 12px;
        transform: translateX(-50%);
        border-radius: 999px;
        background: radial-gradient(
          ellipse at center,
          rgba(15, 23, 42, 0.18) 0%,
          rgba(15, 23, 42, 0.08) 46%,
          rgba(15, 23, 42, 0) 80%
        );
        filter: blur(5px);
        pointer-events: none;
      }

      .live-widget-shell {
        position: absolute;
        inset: 0;
        overflow: hidden;
        border-radius: 18px;
        background:
          radial-gradient(circle at 28% 20%, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.08) 18%, transparent 40%),
          linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,247,252,0.98) 100%);
        border: 1px solid rgba(205, 214, 229, 0.98);
        box-shadow:
          0 16px 32px rgba(15, 23, 42, 0.12),
          0 6px 12px rgba(15, 23, 42, 0.07),
          inset 0 1px 0 rgba(255,255,255,0.92);
        transition:
          transform 180ms ease,
          box-shadow 180ms ease,
          border-color 180ms ease;
      }

      .live-widget-btn:hover .live-widget-shell {
        border-color: rgba(179, 191, 212, 1);
        box-shadow:
          0 18px 36px rgba(15, 23, 42, 0.14),
          0 8px 14px rgba(15, 23, 42, 0.08),
          inset 0 1px 0 rgba(255,255,255,0.95);
      }

      .live-widget-rim {
        position: absolute;
        inset: 4px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.72);
        opacity: 0.58;
        pointer-events: none;
      }

      .live-widget-shine {
        position: absolute;
        top: 8px;
        left: 10px;
        width: 16px;
        height: 8px;
        border-radius: 999px;
        background: linear-gradient(
          180deg,
          rgba(255,255,255,0.92) 0%,
          rgba(255,255,255,0.18) 100%
        );
        transform: rotate(-18deg);
        pointer-events: none;
      }

      .live-widget-aura {
        position: absolute;
        inset: 8px;
        border-radius: 14px;
        background: radial-gradient(
          circle at 50% 58%,
          rgba(61, 109, 242, 0.10) 0%,
          rgba(61, 109, 242, 0.04) 42%,
          rgba(61, 109, 242, 0) 74%
        );
        animation: liveWidgetPulse 3.6s ease-in-out infinite;
        pointer-events: none;
      }

      .live-widget-chat {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 28px;
        height: 20px;
        transform: translate(-50%, -50%);
      }

      .live-widget-chat-bubble {
        position: absolute;
        inset: 0;
        border-radius: 10px;
        background: linear-gradient(180deg, #4f7cf5 0%, #3157d5 100%);
        box-shadow:
          0 8px 16px rgba(49, 87, 213, 0.22),
          inset 0 1px 0 rgba(255,255,255,0.24);
      }

      .live-widget-chat-tail {
        position: absolute;
        left: 3px;
        bottom: -2px;
        width: 8px;
        height: 8px;
        background: #3157d5;
        clip-path: polygon(0 0, 100% 0, 0 100%);
        filter: drop-shadow(0 2px 3px rgba(49, 87, 213, 0.16));
      }

      .live-widget-chat-sweep {
        position: absolute;
        top: 3px;
        bottom: 3px;
        left: 7px;
        width: 7px;
        border-radius: 999px;
        background: linear-gradient(
          180deg,
          rgba(255,255,255,0) 0%,
          rgba(255,255,255,0.42) 45%,
          rgba(255,255,255,0) 100%
        );
        transform: rotate(-14deg);
        animation: liveWidgetSweep 4.4s ease-in-out infinite;
        pointer-events: none;
      }

      .live-widget-dots {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }

      .live-widget-dot {
        width: 4px;
        height: 4px;
        border-radius: 999px;
        background: #ffffff;
      }

      .live-widget-dot:nth-child(1) { animation: liveWidgetTyping1 1.5s ease-in-out infinite; }
      .live-widget-dot:nth-child(2) { animation: liveWidgetTyping2 1.5s ease-in-out infinite; }
      .live-widget-dot:nth-child(3) { animation: liveWidgetTyping3 1.5s ease-in-out infinite; }

      .live-widget-status {
        position: absolute;
        top: 5px;
        right: 5px;
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #3f6df2;
        border: 2px solid #ffffff;
        box-shadow:
          0 0 0 1px rgba(191, 219, 254, 0.72),
          0 0 10px rgba(63,109,242,0.14);
        animation: liveWidgetBadge 2.8s ease-in-out infinite;
      }

      @media (max-width: 768px) {
        .live-widget-btn {
          width: 54px;
          height: 54px;
        }

        .live-widget-chat {
          width: 26px;
          height: 18px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .live-widget-btn,
        .live-widget-aura,
        .live-widget-chat-sweep,
        .live-widget-dot,
        .live-widget-status {
          animation: none !important;
        }
      }
    `,
    []
  );
}

function LivingSupportGlyph() {
  return (
    <span className="live-widget-chat" aria-hidden="true">
      <span className="live-widget-chat-bubble" />
      <span className="live-widget-chat-tail" />
      <span className="live-widget-chat-sweep" />
      <span className="live-widget-dots">
        <span className="live-widget-dot" />
        <span className="live-widget-dot" />
        <span className="live-widget-dot" />
      </span>
    </span>
  );
}

export default function FloatingAiWidget({
  onClick,
  bottomClassName = "bottom-5 md:bottom-6",
  rightClassName = "right-4 md:right-6",
}) {
  const styles = useWidgetStyles();

  return (
    <>
      <style>{styles}</style>

      <div className={`live-widget-wrap ${bottomClassName} ${rightClassName}`}>
        <button
          type="button"
          onClick={onClick}
          aria-label="Open support chat"
          className="live-widget-btn"
        >
          <span className="live-widget-shadow" />
          <span className="live-widget-shell">
            <span className="live-widget-rim" />
            <span className="live-widget-shine" />
            <span className="live-widget-aura" />
            <LivingSupportGlyph />
          </span>
          <span className="live-widget-status" />
        </button>
      </div>
    </>
  );
}