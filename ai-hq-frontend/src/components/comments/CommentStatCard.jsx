import { cx } from "../../lib/cx.js";

const TONE_MAP = {
  neutral: {
    container:
      "border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,253,0.998)_100%)]",
    icon:
      "border-line bg-surface-subtle text-text-muted",
  },
  cyan: {
    container:
      "border-[rgba(14,116,144,0.12)] bg-[linear-gradient(180deg,rgba(236,253,255,0.96)_0%,rgba(255,255,255,0.995)_100%)]",
    icon:
      "border-[rgba(14,116,144,0.12)] bg-[#ecfdff] text-[#0e7490]",
  },
  emerald: {
    container:
      "border-[rgba(21,128,61,0.12)] bg-[linear-gradient(180deg,rgba(240,253,244,0.96)_0%,rgba(255,255,255,0.995)_100%)]",
    icon:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  amber: {
    container:
      "border-[rgba(180,83,9,0.12)] bg-[linear-gradient(180deg,rgba(255,251,235,0.96)_0%,rgba(255,255,255,0.995)_100%)]",
    icon:
      "border-amber-200 bg-amber-50 text-amber-700",
  },
};

export default function CommentStatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}) {
  const palette = TONE_MAP[tone] || TONE_MAP.neutral;

  return (
    <div className={cx("rounded-[16px] border px-4 py-3.5", palette.container)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            {label}
          </div>
          <div className="mt-2 text-[1.55rem] font-semibold leading-none tracking-[-0.05em] text-text">
            {value}
          </div>
        </div>

        <span
          className={cx(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border",
            palette.icon
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}