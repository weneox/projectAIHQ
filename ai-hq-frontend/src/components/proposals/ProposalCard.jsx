import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import {
  captionFrom,
  formatFrom,
  rawStatusOf,
  relTime,
  stageOf,
  stageLabel,
  stageTone,
  tagsFrom,
  titleFrom,
  clip,
} from "../../features/proposals/proposal.selectors.js";
import { ToneBadge, SurfacePill } from "./proposal-ui.jsx";
import { cn } from "./proposal-utils.js";

function accentByStage(stage) {
  if (stage === "approved") {
    return {
      glow:
        "bg-[radial-gradient(320px_circle_at_0%_0%,rgba(16,185,129,0.14),transparent_34%),radial-gradient(240px_circle_at_100%_0%,rgba(20,184,166,0.09),transparent_38%)]",
      orb: "bg-emerald-300",
      orbGlow: "shadow-[0_0_16px_rgba(16,185,129,0.34)]",
      rail: "bg-emerald-300/72",
      border: "group-hover:border-emerald-300/18",
    };
  }

  if (stage === "published") {
    return {
      glow:
        "bg-[radial-gradient(320px_circle_at_0%_0%,rgba(245,158,11,0.15),transparent_34%),radial-gradient(240px_circle_at_100%_0%,rgba(251,191,36,0.09),transparent_38%)]",
      orb: "bg-amber-300",
      orbGlow: "shadow-[0_0_16px_rgba(245,158,11,0.34)]",
      rail: "bg-amber-300/76",
      border: "group-hover:border-amber-300/18",
    };
  }

  if (stage === "rejected") {
    return {
      glow:
        "bg-[radial-gradient(320px_circle_at_0%_0%,rgba(244,63,94,0.12),transparent_34%),radial-gradient(240px_circle_at_100%_0%,rgba(251,113,133,0.08),transparent_38%)]",
      orb: "bg-rose-300",
      orbGlow: "shadow-[0_0_16px_rgba(244,63,94,0.30)]",
      rail: "bg-rose-300/72",
      border: "group-hover:border-rose-300/18",
    };
  }

  return {
    glow:
      "bg-[radial-gradient(320px_circle_at_0%_0%,rgba(34,211,238,0.12),transparent_34%),radial-gradient(240px_circle_at_100%_0%,rgba(99,102,241,0.09),transparent_38%)]",
    orb: "bg-cyan-300",
    orbGlow: "shadow-[0_0_16px_rgba(34,211,238,0.34)]",
    rail: "bg-cyan-300/72",
    border: "group-hover:border-cyan-300/18",
  };
}

function typeChipLabel(format) {
  if (!format) return "Content";
  return format;
}

export default function ProposalCard({
  item,
  isDimmed = false,
  onOpen,
  featured = false,
  compact = false,
}) {
  const title = titleFrom(item);
  const caption = captionFrom(item);
  const allTags = tagsFrom(item);
  const visibleTags = compact ? allTags.slice(0, 1) : allTags.slice(0, 1);
  const extraTagCount = Math.max(0, allTags.length - visibleTags.length);
  const format = formatFrom(item);
  const rawStatus = rawStatusOf(item);
  const stage = stageOf(item);
  const exactStatus = stageLabel(item);

  const when = relTime(
    item?.updated_at ||
      item?.updatedAt ||
      item?.created_at ||
      item?.createdAt
  );

  const metaParts = [format, when].filter(Boolean).slice(0, 2);
  const accent = accentByStage(stage);

  const handleClick = () => {
    if (typeof onOpen === "function") onOpen(item);
  };

  const sizeClasses = featured
    ? {
        shell: "rounded-[34px]",
        ring: "rounded-[34px]",
        pad: "px-6 pb-6 pt-5 md:px-7 md:pb-7 md:pt-6",
        arrow: "h-11 w-11",
        title: "text-[25px] md:text-[31px] leading-[0.98] tracking-[-0.06em]",
        copy: "mt-4 text-[14px] leading-7 text-white/44 max-w-[86%] line-clamp-3",
        topGap: "mt-6",
        metaGap: "mt-5",
        footGap: "mt-6",
        rail: "h-[5px] w-14",
        shadow:
          "shadow-[0_24px_58px_rgba(0,0,0,0.26),0_10px_24px_rgba(0,0,0,0.18)] hover:shadow-[0_32px_74px_rgba(0,0,0,0.30),0_16px_34px_rgba(0,0,0,0.22)]",
      }
    : compact
      ? {
          shell: "rounded-[28px]",
          ring: "rounded-[28px]",
          pad: "px-5 pb-5 pt-4",
          arrow: "h-10 w-10",
          title: "text-[17px] md:text-[18px] leading-[1.04] tracking-[-0.05em]",
          copy: "mt-3 text-[12.5px] leading-6 text-white/40 max-w-[88%] line-clamp-2",
          topGap: "mt-4",
          metaGap: "mt-4",
          footGap: "mt-4",
          rail: "h-[4px] w-8",
          shadow:
            "shadow-[0_14px_32px_rgba(0,0,0,0.22),0_2px_8px_rgba(0,0,0,0.16)] hover:shadow-[0_22px_46px_rgba(0,0,0,0.28),0_8px_18px_rgba(0,0,0,0.18)]",
        }
      : {
          shell: "rounded-[28px]",
          ring: "rounded-[28px]",
          pad: "px-5 pb-5 pt-4",
          arrow: "h-10 w-10",
          title: "text-[16px] md:text-[17px] leading-[1.08] tracking-[-0.048em]",
          copy: "mt-3 text-[12.5px] leading-6 text-white/40 max-w-[88%] line-clamp-2",
          topGap: "mt-4",
          metaGap: "mt-4",
          footGap: "mt-4",
          rail: "h-[4px] w-8",
          shadow:
            "shadow-[0_14px_32px_rgba(0,0,0,0.22),0_2px_8px_rgba(0,0,0,0.16)] hover:shadow-[0_22px_46px_rgba(0,0,0,0.28),0_8px_18px_rgba(0,0,0,0.18)]",
        };

  return (
    <motion.button
      type="button"
      layoutId={`proposal-card-${item?.id ?? "unknown"}`}
      onClick={handleClick}
      className={cn(
        "group relative overflow-hidden border p-0 text-left",
        "transform-gpu will-change-transform",
        "transition-[border-color,opacity,filter,box-shadow,transform] duration-200 ease-out",
        sizeClasses.shell,
        "border-white/[0.05]",
        "bg-[linear-gradient(180deg,rgba(5,10,20,0.95),rgba(4,8,16,0.92))]",
        sizeClasses.shadow,
        accent.border,
        isDimmed ? "scale-[0.992] opacity-35 blur-[0.5px]" : ""
      )}
      whileHover={{ y: featured ? -5 : -4, scale: featured ? 1.006 : 1.004 }}
      whileTap={{ scale: 0.997 }}
      transition={{
        type: "tween",
        duration: 0.2,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-85",
          accent.glow
        )}
      />

      <div
        className={cn(
          "pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.022]",
          sizeClasses.ring
        )}
      />

      <div className={cn("relative flex h-full flex-col", sizeClasses.pad)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "mt-[1px] h-2.5 w-2.5 shrink-0 rounded-full",
                  accent.orb,
                  accent.orbGlow
                )}
              />

              <div className="flex flex-wrap items-center gap-2">
                <ToneBadge tone={stageTone(stage, rawStatus)}>
                  {stage === "draft" ? "Queue" : stage}
                </ToneBadge>

                {exactStatus ? (
                  <ToneBadge tone={stageTone(stage, rawStatus)}>
                    {exactStatus}
                  </ToneBadge>
                ) : null}

                <SurfacePill className="text-white/58">
                  {typeChipLabel(format)}
                </SurfacePill>
              </div>
            </div>
          </div>

          <div className="shrink-0">
            <div
              className={cn(
                "flex items-center justify-center rounded-full border border-white/[0.05] bg-white/[0.02] text-white/34 transition-all duration-200 ease-out group-hover:border-white/[0.08] group-hover:bg-white/[0.035] group-hover:text-white/70",
                sizeClasses.arrow
              )}
            >
              <ChevronRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-[1px]" />
            </div>
          </div>
        </div>

        <div className={sizeClasses.topGap}>
          {featured ? (
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.20em] text-white/30">
              Spotlight proposal
            </div>
          ) : null}

          <h3 className={cn("max-w-[90%] font-semibold text-white", sizeClasses.title)}>
            {title}
          </h3>

          <p
            className={cn(
              "transition-colors duration-200 group-hover:text-white/52",
              sizeClasses.copy
            )}
          >
            {clip(caption, featured ? 180 : compact ? 98 : 105) ||
              "Draft content preview not available."}
          </p>
        </div>

        <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/30", sizeClasses.metaGap)}>
          {metaParts.map((part, idx) => (
            <span
              key={`${part}-${idx}`}
              className="inline-flex items-center gap-2"
            >
              {idx > 0 ? <span className="text-white/14">•</span> : null}
              <span className={idx === 0 ? "text-white/46" : ""}>{part}</span>
            </span>
          ))}
        </div>

        <div className={cn("flex items-center justify-between gap-3", sizeClasses.footGap)}>
          <div className="flex flex-wrap gap-2">
            {visibleTags.length ? (
              <>
                {visibleTags.map((tag) => (
                  <SurfacePill key={tag}>{tag}</SurfacePill>
                ))}

                {extraTagCount > 0 ? (
                  <SurfacePill className="text-white/30">
                    +{extraTagCount}
                  </SurfacePill>
                ) : null}
              </>
            ) : (
              <SurfacePill className="text-white/24">No tags</SurfacePill>
            )}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <span
              className={cn(
                "rounded-full opacity-70",
                sizeClasses.rail,
                accent.rail
              )}
            />
          </div>
        </div>
      </div>
    </motion.button>
  );
}
