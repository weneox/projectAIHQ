import { createElement } from "react";
import { Skeleton, Spin } from "antd";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  LockKeyhole,
} from "lucide-react";
import { cx } from "../../lib/cx.js";
import Card from "./Card.jsx";

const NOTICE_TONES = {
  info: {
    container: "border-[rgba(var(--color-brand),0.14)] bg-brand-soft",
    icon: "text-brand",
  },
  success: {
    container: "border-[rgba(var(--color-success),0.14)] bg-success-soft",
    icon: "text-success",
  },
  warning: {
    container: "border-[rgba(var(--color-warning),0.16)] bg-warning-soft",
    icon: "text-warning",
  },
  danger: {
    container: "border-[rgba(var(--color-danger),0.14)] bg-danger-soft",
    icon: "text-danger",
  },
};

function resolveNoticeTone(tone = "info") {
  return NOTICE_TONES[tone] || NOTICE_TONES.info;
}

function resolveNoticeIcon(tone = "info") {
  if (tone === "success") return CheckCircle2;
  if (tone === "warning" || tone === "danger") return AlertTriangle;
  return Info;
}

function skeletonWidths(rows) {
  return Array.from({ length: rows }, (_, index) =>
    index === rows - 1 ? "70%" : "100%"
  );
}

function paddedClass(padded) {
  if (padded === false) return "p-0";
  if (padded === "sm") return "p-4";
  if (padded === "lg") return "p-6";
  if (padded === "xl") return "p-7";
  return "p-5";
}

function surfaceToneClass({ tone = "default", subdued = false }) {
  if (subdued || tone === "muted") {
    return "border-line-soft bg-surface-muted";
  }

  if (tone === "subtle") {
    return "border-line-soft bg-surface-subtle";
  }

  if (tone === "brand-soft") {
    return "border-[rgba(var(--color-brand),0.14)] bg-brand-soft";
  }

  return "border-line-soft bg-surface";
}

function metricToneClass(tone = "neutral") {
  if (tone === "brand" || tone === "accent" || tone === "info") {
    return "border-[rgba(var(--color-brand),0.14)] bg-brand-soft";
  }

  if (tone === "warning") {
    return "border-[rgba(var(--color-warning),0.16)] bg-warning-soft";
  }

  if (tone === "danger") {
    return "border-[rgba(var(--color-danger),0.14)] bg-danger-soft";
  }

  if (tone === "success") {
    return "border-[rgba(var(--color-success),0.14)] bg-success-soft";
  }

  return "border-line-soft bg-surface";
}

function bannerToneClass(tone = "info") {
  if (tone === "success") {
    return "border-[rgba(var(--color-success),0.14)] bg-success-soft text-success";
  }

  if (tone === "warning") {
    return "border-[rgba(var(--color-warning),0.16)] bg-warning-soft text-warning";
  }

  if (tone === "danger") {
    return "border-[rgba(var(--color-danger),0.14)] bg-danger-soft text-danger";
  }

  return "border-[rgba(var(--color-brand),0.14)] bg-brand-soft text-brand";
}

export function PageCanvas({ className, children }) {
  return (
    <div
      className={cx(
        "mx-auto w-full max-w-shell-content space-y-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}) {
  return (
    <div
      className={cx(
        "flex flex-col gap-4 border-b border-line-soft pb-4 md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div className="max-w-[860px]">
        {eyebrow ? (
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            {eyebrow}
          </div>
        ) : null}

        <h1 className="text-[1.8rem] font-semibold leading-[1.04] tracking-[-0.04em] text-text md:text-[2.05rem]">
          {title}
        </h1>

        {description ? (
          <p className="mt-2.5 text-[14px] leading-6 text-text-muted">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}) {
  return (
    <div
      className={cx(
        "flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div className="max-w-[760px]">
        {eyebrow ? (
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            {eyebrow}
          </div>
        ) : null}

        <h2 className="text-[1.15rem] font-semibold leading-tight tracking-[-0.03em] text-text md:text-[1.28rem]">
          {title}
        </h2>

        {description ? (
          <p className="mt-1.5 text-[13px] leading-6 text-text-muted">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function Surface({
  className,
  children,
  padded = "md",
  subdued = false,
  tone = "default",
  shadow = "none",
}) {
  return (
    <div
      className={cx(
        "rounded-panel border transition-[border-color,background-color,box-shadow] duration-base ease-premium",
        surfaceToneClass({ tone, subdued }),
        paddedClass(padded),
        shadow === "sm" && "shadow-panel",
        shadow === "md" && "shadow-panel-strong",
        shadow === "none" && "shadow-[0_1px_0_rgba(255,255,255,0.92)_inset]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}) {
  return (
    <Card
      className={cx("px-4 py-4", metricToneClass(tone), className)}
      padded={false}
    >
      {label ? (
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
          {label}
        </div>
      ) : null}

      <div className="mt-2 text-[1.3rem] font-semibold leading-tight tracking-[-0.04em] text-text">
        {value}
      </div>

      {hint ? (
        <div className="mt-1.5 text-[12px] leading-5 text-text-muted">
          {hint}
        </div>
      ) : null}
    </Card>
  );
}

export function MetricGrid({
  className,
  children,
  columns = 4,
}) {
  const columnsClass =
    columns === 2
      ? "md:grid-cols-2"
      : columns === 3
        ? "md:grid-cols-3"
        : "md:grid-cols-2 xl:grid-cols-4";

  return <div className={cx("grid gap-4", columnsClass, className)}>{children}</div>;
}

export function StatusBanner({
  tone = "info",
  label,
  title,
  description,
  detail,
  action,
  className,
}) {
  return (
    <div
      className={cx(
        "rounded-panel border px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.84)_inset]",
        bannerToneClass(tone),
        className
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          {label ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em]">
              {label}
            </div>
          ) : null}

          {title ? (
            <div
              className={cx(
                "font-semibold tracking-[-0.02em] text-text",
                label ? "mt-2 text-[15px]" : "text-[15px]"
              )}
            >
              {title}
            </div>
          ) : null}

          {description ? (
            <div
              className={cx(
                "text-[13px] leading-6 text-text-muted",
                title ? "mt-1" : "mt-0"
              )}
            >
              {description}
            </div>
          ) : null}

          {detail ? (
            <div className="mt-1 text-[12px] leading-5 text-text-subtle">
              {detail}
            </div>
          ) : null}
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function PropertyList({
  className,
  children,
  tone = "default",
}) {
  return (
    <Surface
      className={className}
      padded={false}
      tone={tone === "muted" ? "muted" : "default"}
    >
      {children}
    </Surface>
  );
}

export function PropertyRow({
  label,
  value,
  trailing,
  className,
  labelWidth = "150px",
  valueClassName,
  align = "left",
}) {
  return (
    <div
      className={cx(
        "grid gap-4 border-b border-line-soft px-4 py-3.5 last:border-b-0",
        className
      )}
      style={{
        gridTemplateColumns: trailing
          ? `${labelWidth} minmax(0,1fr) auto`
          : `${labelWidth} minmax(0,1fr)`,
      }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
        {label}
      </div>

      <div
        className={cx(
          "min-w-0 text-[13px] leading-6 text-text",
          align === "right" && "text-right",
          valueClassName
        )}
      >
        {value || "Not available"}
      </div>

      {trailing ? <div className="shrink-0 pt-[2px]">{trailing}</div> : null}
    </div>
  );
}

export function FieldGroup({
  label,
  description,
  children,
  className,
}) {
  return (
    <div className={cx("space-y-2", className)}>
      {label ? (
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
          {label}
        </div>
      ) : null}

      {description ? (
        <div className="text-[12px] leading-5 text-text-muted">
          {description}
        </div>
      ) : null}

      {children}
    </div>
  );
}

export function InlineNotice({
  tone = "info",
  title,
  description,
  action,
  className,
  compact = false,
  icon: IconOverride,
}) {
  const palette = resolveNoticeTone(tone);
  const iconElement = createElement(
    IconOverride || resolveNoticeIcon(tone),
    { className: compact ? "h-4 w-4" : "h-[16px] w-[16px]" }
  );

  return (
    <div
      className={cx(
        "rounded-soft border shadow-[0_1px_0_rgba(255,255,255,0.84)_inset]",
        palette.container,
        compact ? "px-3.5 py-3" : "px-4 py-3.5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cx(
            "mt-0.5 inline-flex shrink-0 items-center justify-center",
            compact ? "h-4 w-4" : "h-[16px] w-[16px]",
            palette.icon
          )}
        >
          {iconElement}
        </span>

        <div className="min-w-0 flex-1">
          {title ? (
            <div className="text-[14px] font-semibold tracking-[-0.01em] text-text">
              {title}
            </div>
          ) : null}

          {description ? (
            <div
              className={cx(
                "text-[13px] text-text-muted",
                title ? "mt-1 leading-6" : "leading-5"
              )}
            >
              {description}
            </div>
          ) : null}
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function StateSkeletonBlock({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cx("animate-pulse rounded-soft bg-surface-subtle", className)}
    />
  );
}

export function SectionLoading({
  title = "Loading",
  description,
  rows = 3,
  className,
  compact = false,
}) {
  return (
    <Surface className={className} tone="muted">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-soft border border-line bg-surface text-text-subtle">
          <Spin size="small" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-text">{title}</div>
          {description ? (
            <div className="text-[13px] leading-6 text-text-muted">
              {description}
            </div>
          ) : null}
        </div>
      </div>

      <div className={cx("mt-4 space-y-3", compact && "mt-3 space-y-2.5")}>
        <Skeleton
          active
          title={false}
          paragraph={{ rows, width: skeletonWidths(rows) }}
        />
      </div>
    </Surface>
  );
}

export function LoadingSurface(props) {
  return <SectionLoading {...props} />;
}

export function Section({
  title,
  description,
  eyebrow,
  actions,
  className,
  children,
}) {
  return (
    <section className={cx("space-y-3.5", className)}>
      {title || description || eyebrow || actions ? (
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          actions={actions}
        />
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}) {
  return (
    <Surface className={cx("text-center", className)} tone="muted">
      <div className="mx-auto flex max-w-[420px] flex-col items-center gap-3 py-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-text-subtle">
          <Info className="h-4 w-4" />
        </span>

        <div>
          <div className="text-[14px] font-semibold tracking-[-0.01em] text-text">
            {title}
          </div>
          {description ? (
            <div className="mt-1 text-[13px] leading-6 text-text-muted">
              {description}
            </div>
          ) : null}
        </div>

        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </Surface>
  );
}

export function CompactState({
  title,
  description,
  action,
  className,
}) {
  return (
    <Surface className={className} padded="sm" tone="muted">
      <div className="space-y-1.5">
        <div className="text-[14px] font-medium tracking-[-0.01em] text-text">
          {title}
        </div>
        {description ? (
          <div className="text-[13px] leading-5 text-text-muted">
            {description}
          </div>
        ) : null}
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </Surface>
  );
}

export function AuthFrame({ className, children, aside }) {
  return (
    <div className={cx("min-h-screen bg-canvas px-4 py-6 md:px-6", className)}>
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1120px] gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex items-center">{children}</div>
        {aside ? <div className="hidden xl:flex xl:items-stretch">{aside}</div> : null}
      </div>
    </div>
  );
}

export function AuthPanel({ className, children, padded = "xl" }) {
  return (
    <Surface padded={padded} className={cx("w-full", className)} shadow="sm">
      {children}
    </Surface>
  );
}

export function UnavailableState({
  title = "Unavailable",
  description,
  action,
  className,
}) {
  return (
    <Surface className={className}>
      <InlineNotice
        tone="warning"
        title={title}
        description={description}
        action={action}
      />
    </Surface>
  );
}

export function RestrictedState({
  title = "Access restricted",
  description,
  action,
  className,
}) {
  return (
    <Surface className={className}>
      <InlineNotice
        tone="warning"
        title={title}
        description={description}
        action={action}
        icon={LockKeyhole}
      />
    </Surface>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
  className,
}) {
  return (
    <Surface className={className}>
      <InlineNotice
        tone="danger"
        title={title}
        description={description}
        action={action}
      />
    </Surface>
  );
}

export function SaveFeedback({
  success,
  error,
  message,
  successTitle = "Saved",
  errorTitle = "Unable to save",
  infoTitle = "Update",
  className,
}) {
  if (error) {
    return (
      <InlineNotice
        tone="danger"
        title={errorTitle}
        description={error}
        className={className}
        compact
      />
    );
  }

  if (success) {
    return (
      <InlineNotice
        tone="success"
        title={successTitle}
        description={success}
        className={className}
        compact
      />
    );
  }

  if (message) {
    return (
      <InlineNotice
        tone="info"
        title={infoTitle}
        description={message}
        className={className}
        compact
      />
    );
  }

  return null;
}

export function SlidingDetailOverlay({
  open = false,
  onClose,
  children,
  className,
  panelClassName,
  backdropClassName = "bg-overlay/60",
  panelWidthClassName = "max-w-[620px]",
  absolute = false,
  closeLabel = "Close details",
}) {
  if (!open) return null;

  return (
    <div
      className={cx(
        absolute ? "absolute inset-0" : "fixed inset-0",
        "z-[120] overflow-hidden",
        className
      )}
    >
      <button
        type="button"
        aria-label={closeLabel}
        onClick={() => onClose?.()}
        className={cx(
          "absolute inset-0 transition-opacity duration-base ease-premium opacity-100",
          backdropClassName
        )}
      />

      <div className="absolute inset-y-0 right-0 flex w-full justify-end">
        <div
          className={cx(
            "h-full w-full transform-gpu translate-x-0 transition-transform duration-base ease-premium",
            "animate-[shellFadeIn_var(--motion-fast)_var(--motion-premium)_both]",
            panelWidthClassName,
            panelClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}