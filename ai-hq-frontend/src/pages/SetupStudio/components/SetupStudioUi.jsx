import Badge from "../../../components/ui/Badge.jsx";
import Button from "../../../components/ui/Button.jsx";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function TinyLabel({ children, className = "" }) {
  return (
    <Badge variant="pill" size="sm" className={cx("gap-1.5 !text-[10px] uppercase tracking-[0.2em] text-slate-500", className)}>
      {children}
    </Badge>
  );
}

export function TinyChip({
  children,
  tone = "default",
  className = "",
}) {
  const toneClass =
    tone === "warn"
      ? "warn"
      : tone === "success"
        ? "success"
        : tone === "info"
          ? "info"
          : "neutral";

  return (
    <Badge variant="pill" tone={toneClass} className={className}>
      {children}
    </Badge>
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
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled}
      variant={active ? "brand" : "surface"}
      size="pill"
      className={className}
      leftIcon={Icon ? <Icon className="h-4 w-4 shrink-0" /> : undefined}
    >
      {children}
    </Button>
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
