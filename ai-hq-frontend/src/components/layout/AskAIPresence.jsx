import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";
import { cx } from "../../lib/cx.js";

const idleTransition = {
  duration: 6.2,
  repeat: Infinity,
  ease: "easeInOut",
};

export default function AskAIPresence({
  compact = false,
  className = "",
  pulse = true,
  active = false,
}) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const coreId = `${uid}-core`;
  const rimId = `${uid}-rim`;
  const lensId = `${uid}-lens`;
  const highlightId = `${uid}-highlight`;

  const sizeClass = compact ? "h-[64px] w-[64px]" : "h-[72px] w-[72px]";

  return (
    <div className={cx("relative isolate select-none", sizeClass, className)}>
      <motion.div
        aria-hidden="true"
        className="absolute inset-[-16%] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.26)_0%,rgba(37,99,235,0.16)_34%,rgba(37,99,235,0.08)_52%,transparent_72%)] blur-xl"
        animate={
          reduceMotion || !pulse
            ? undefined
            : {
                opacity: [0.44, 0.72, 0.48],
                scale: [0.92, 1.04, 0.92],
              }
        }
        transition={reduceMotion || !pulse ? undefined : idleTransition}
      />

      <motion.div
        aria-hidden="true"
        className="absolute inset-0 rounded-full border border-white/14 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.34),rgba(255,255,255,0.10)_20%,transparent_36%),radial-gradient(circle_at_74%_78%,rgba(96,165,250,0.18),transparent_34%),linear-gradient(180deg,#2f59ff_0%,#1c3bcf_52%,#0d1f5e_100%)] shadow-[0_20px_48px_rgba(29,78,216,0.28),inset_0_1px_0_rgba(255,255,255,0.24),inset_0_-16px_24px_rgba(4,10,30,0.34)]"
        animate={
          reduceMotion
            ? undefined
            : active
              ? { scale: [1, 1.04, 1], rotate: [0, -2, 0] }
              : { scale: [1, 1.018, 1], rotate: [0, 1.2, 0] }
        }
        transition={reduceMotion ? undefined : idleTransition}
      />

      <svg
        viewBox="0 0 100 100"
        className="relative z-[1] h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={coreId} cx="50%" cy="46%" r="44%">
            <stop offset="0%" stopColor="#9ec5ff" stopOpacity="0.92" />
            <stop offset="28%" stopColor="#4d7bff" stopOpacity="0.96" />
            <stop offset="68%" stopColor="#1f45db" stopOpacity="0.94" />
            <stop offset="100%" stopColor="#10235a" stopOpacity="1" />
          </radialGradient>

          <linearGradient id={rimId} x1="22" y1="18" x2="78" y2="82">
            <stop offset="0%" stopColor="rgba(255,255,255,0.44)" />
            <stop offset="38%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
          </linearGradient>

          <linearGradient id={lensId} x1="28" y1="48" x2="72" y2="58">
            <stop offset="0%" stopColor="rgba(6,14,44,0.92)" />
            <stop offset="44%" stopColor="rgba(17,34,92,0.98)" />
            <stop offset="100%" stopColor="rgba(48,93,255,0.72)" />
          </linearGradient>

          <radialGradient id={highlightId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        <circle cx="50" cy="50" r="31" fill={`url(#${coreId})`} opacity="0.3" />
        <circle
          cx="50"
          cy="50"
          r="31"
          fill="none"
          stroke={`url(#${rimId})`}
          strokeWidth="1.15"
          opacity="0.85"
        />

        <motion.circle
          cx="50"
          cy="50"
          r="20.5"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
          animate={
            reduceMotion
              ? undefined
              : { opacity: [0.28, 0.44, 0.28], scale: [1, 1.03, 1] }
          }
          transition={reduceMotion ? undefined : idleTransition}
        />

        <ellipse
          cx="50"
          cy="56"
          rx="21.5"
          ry="14.8"
          fill={`url(#${lensId})`}
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1"
        />

        <motion.ellipse
          cx="50"
          cy="56"
          rx="10.2"
          ry="7.2"
          fill="rgba(8,18,54,0.82)"
          stroke="rgba(148,197,255,0.24)"
          strokeWidth="0.9"
          animate={
            reduceMotion
              ? undefined
              : {
                  rx: [10.2, 11.1, 10.2],
                  ry: [7.2, 7.7, 7.2],
                }
          }
          transition={reduceMotion ? undefined : idleTransition}
        />

        <motion.circle
          cx="50"
          cy="56"
          r="3.1"
          fill={`url(#${highlightId})`}
          animate={
            reduceMotion
              ? undefined
              : { opacity: [0.72, 1, 0.76], scale: [0.94, 1.06, 0.94] }
          }
          transition={reduceMotion ? undefined : idleTransition}
        />

        <path
          d="M34.5 39.2c4.2-4.2 9.4-6.4 15.5-6.4s11.3 2.2 15.5 6.4"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeLinecap="round"
          strokeWidth="1.2"
        />

        <motion.g
          animate={reduceMotion ? undefined : { rotate: [0, 360] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 16, repeat: Infinity, ease: "linear" }
          }
          style={{ originX: "50%", originY: "50%" }}
        >
          <circle cx="76.5" cy="36.5" r="1.8" fill="rgba(255,255,255,0.92)" />
          <circle cx="76.5" cy="36.5" r="4.8" fill="rgba(255,255,255,0.08)" />
        </motion.g>

        <motion.path
          d="M29 67.8c5.6 4.6 12.6 7 21 7 8.4 0 15.4-2.4 21-7"
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeLinecap="round"
          strokeWidth="1"
          animate={
            reduceMotion
              ? undefined
              : {
                  opacity: [0.16, 0.32, 0.16],
                  y: [0, 0.4, 0],
                }
          }
          transition={reduceMotion ? undefined : idleTransition}
        />
      </svg>
    </div>
  );
}