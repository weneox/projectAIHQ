function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function TinyLabel({ children, className = "" }) {
  return (
    <div
      className={cx(
        "inline-flex items-center gap-2 rounded-full bg-white/78 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TinyChip({
  children,
  tone = "default",
  className = "",
}) {
  const toneClass =
    tone === "warn"
      ? "bg-amber-50 text-amber-800"
      : tone === "success"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-white/76 text-slate-600";

  return (
    <div
      className={cx(
        "inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-medium",
        toneClass,
        className
      )}
    >
      {children}
    </div>
  );
}

export function GhostButton({
  children,
  icon: Icon,
  onClick,
  active = false,
  disabled = false,
  className = "",
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition",
        active
          ? "bg-slate-950 text-white shadow-[0_16px_34px_-22px_rgba(15,23,42,.65)] hover:bg-slate-800"
          : "bg-white/82 text-slate-700 hover:bg-white hover:text-slate-950",
        disabled ? "cursor-not-allowed opacity-50" : "",
        className
      )}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      <span>{children}</span>
    </button>
  );
}

export function MetricCard({
  label,
  value,
  detail = "",
  className = "",
}) {
  return (
    <div className={cx("min-w-0", className)}>
      <div className="text-[30px] font-semibold tracking-[-0.05em] text-slate-950 sm:text-[34px]">
        {value}
      </div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </div>
      {detail ? (
        <div className="mt-2 text-sm leading-6 text-slate-500">{detail}</div>
      ) : null}
    </div>
  );
}

export function StageSection({
  children,
  className = "",
  border = true,
}) {
  return (
    <section
      className={cx(
        border ? "border-t border-slate-200/80 pt-6 first:border-t-0 first:pt-0" : "",
        className
      )}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  label,
  title,
  body = "",
  action = null,
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {label ? (
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            {label}
          </div>
        ) : null}
        {title ? (
          <div className="mt-1 text-[22px] font-semibold tracking-[-0.04em] text-slate-950">
            {title}
          </div>
        ) : null}
        {body ? (
          <div className="mt-2 max-w-[720px] text-sm leading-6 text-slate-500">
            {body}
          </div>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export default {
  TinyLabel,
  TinyChip,
  GhostButton,
  MetricCard,
  StageSection,
  SectionHeading,
};
