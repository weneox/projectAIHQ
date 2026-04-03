import { motion, useReducedMotion } from "framer-motion";
import { cx } from "../../lib/cx.js";

export default function AskAIPresence({
  compact = false,
  pulse = true,
  active = false,
  className = "",
}) {
  const reduceMotion = useReducedMotion();
  const sizeClass = compact ? "h-[66px] w-[66px]" : "h-[76px] w-[76px]";

  return (
    <div
      className={cx(
        "relative isolate overflow-hidden rounded-[28px]",
        sizeClass,
        className
      )}
    >
      <motion.div
        className="absolute inset-[-18%] rounded-[34px] bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.34),rgba(59,130,246,0.16)_40%,rgba(59,130,246,0.03)_66%,transparent_74%)] blur-xl"
        animate={
          reduceMotion || !pulse
            ? { opacity: active ? 0.9 : 0.72, scale: 1 }
            : {
                opacity: active ? [0.68, 1, 0.68] : [0.42, 0.7, 0.42],
                scale: active ? [1, 1.08, 1] : [1, 1.04, 1],
              }
        }
        transition={{
          duration: 2.8,
          repeat: reduceMotion || !pulse ? 0 : Infinity,
          ease: "easeInOut",
        }}
      />

      <div className="absolute inset-0 rounded-[28px] border border-white/82 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(243,247,255,0.95)_38%,rgba(231,238,248,0.98))] shadow-[0_18px_42px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.95)]" />

      <div className="absolute inset-[1px] rounded-[27px] bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(255,255,255,0.08)_24%,rgba(255,255,255,0.02)_52%,rgba(255,255,255,0.46)_78%,rgba(255,255,255,0.10))]" />

      <div className="absolute inset-[8px] rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,255,0.98),rgba(236,242,250,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_8px_22px_rgba(51,65,85,0.10)]" />

      <div className="absolute inset-[14px] rounded-[18px] bg-[radial-gradient(circle_at_50%_34%,rgba(255,255,255,0.24),rgba(7,16,37,0.12)_18%,rgba(10,20,44,0.84)_42%,rgba(6,11,25,0.98)_68%)] shadow-[inset_0_0_24px_rgba(125,180,255,0.12),0_0_0_1px_rgba(139,189,255,0.10)]" />

      <motion.div
        className="absolute inset-[15px] rounded-[17px]"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(176,226,255,0.98) 0%, rgba(96,163,255,0.94) 26%, rgba(37,86,214,0.66) 45%, rgba(8,18,40,0.12) 72%, transparent 78%)",
          filter: "drop-shadow(0 0 18px rgba(76,145,255,0.36))",
        }}
        animate={
          reduceMotion
            ? { opacity: active ? 1 : 0.92 }
            : {
                opacity: active ? [0.86, 1, 0.86] : [0.74, 0.92, 0.74],
                scale: active ? [1, 1.04, 1] : [1, 1.02, 1],
              }
        }
        transition={{
          duration: 2.4,
          repeat: reduceMotion ? 0 : Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute left-1/2 top-1/2 h-[56%] w-[56%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12"
        animate={
          reduceMotion
            ? {}
            : active
              ? { rotate: 360, scale: [1, 1.08, 1] }
              : { rotate: 360 }
        }
        transition={{
          duration: active ? 4.6 : 8.4,
          repeat: reduceMotion ? 0 : Infinity,
          ease: "linear",
        }}
      />

      <motion.div
        className="absolute left-1/2 top-[39%] z-20 flex -translate-x-1/2 items-center gap-[7px]"
        animate={
          reduceMotion
            ? {}
            : active
              ? { y: [0, -1.4, 0], opacity: [0.8, 1, 0.8] }
              : { opacity: [0.65, 0.9, 0.65] }
        }
        transition={{
          duration: 2,
          repeat: reduceMotion ? 0 : Infinity,
          ease: "easeInOut",
        }}
      >
        <div className="h-[7px] w-[16px] rounded-full bg-[linear-gradient(180deg,rgba(223,247,255,1),rgba(142,219,255,0.96)_52%,rgba(76,146,255,0.92))] shadow-[0_0_12px_rgba(130,205,255,0.72),0_0_24px_rgba(86,145,255,0.24)]" />
        <div className="h-[7px] w-[16px] rounded-full bg-[linear-gradient(180deg,rgba(223,247,255,1),rgba(142,219,255,0.96)_52%,rgba(76,146,255,0.92))] shadow-[0_0_12px_rgba(130,205,255,0.72),0_0_24px_rgba(86,145,255,0.24)]" />
      </motion.div>

      <motion.div
        className="absolute left-1/2 top-[58%] z-20 h-[3px] w-[28px] -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,rgba(112,188,255,0.06),rgba(194,236,255,0.95),rgba(112,188,255,0.06))]"
        animate={
          reduceMotion
            ? { opacity: active ? 0.95 : 0.7 }
            : {
                width: active ? [28, 34, 28] : [28, 30, 28],
                opacity: active ? [0.72, 1, 0.72] : [0.48, 0.75, 0.48],
              }
        }
        transition={{
          duration: 1.8,
          repeat: reduceMotion ? 0 : Infinity,
          ease: "easeInOut",
        }}
      />

      {[0, 1, 2, 3, 4, 5].map((index) => {
        const angle = (index / 6) * Math.PI * 2;
        const radius = compact ? 18 : 20;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        return (
          <motion.div
            key={index}
            className="absolute left-1/2 top-1/2 h-[3px] w-[3px] rounded-full bg-sky-200/90 shadow-[0_0_10px_rgba(148,208,255,0.72)]"
            initial={{ x, y, opacity: 0.2, scale: 0.8 }}
            animate={
              reduceMotion
                ? { x, y, opacity: active ? 0.5 : 0.24, scale: 1 }
                : {
                    x: [x, x * 1.06, x],
                    y: [y, y * 1.06, y],
                    opacity: active ? [0.2, 0.85, 0.2] : [0.1, 0.45, 0.1],
                    scale: active ? [0.8, 1.2, 0.8] : [0.7, 1.02, 0.7],
                  }
            }
            transition={{
              duration: 2.2 + index * 0.12,
              repeat: reduceMotion ? 0 : Infinity,
              ease: "easeInOut",
              delay: index * 0.07,
            }}
          />
        );
      })}

      <div className="pointer-events-none absolute inset-[10px] rounded-[22px] border border-white/38" />
    </div>
  );
}