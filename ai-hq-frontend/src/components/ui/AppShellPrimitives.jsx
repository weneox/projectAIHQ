import { createElement } from "react";
import { Skeleton, Spin } from "antd";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  LockKeyhole,
} from "lucide-react";
import { cx } from "../../lib/cx.js";

const NOTICE_TONES = {
  info: {
    container:
      "border-[rgba(var(--color-brand),0.08)] bg-[rgba(var(--color-brand),0.035)]",
    icon: "text-brand",
  },
  success: {
    container:
      "border-[rgba(var(--color-success),0.10)] bg-[rgba(var(--color-success),0.045)]",
    icon: "text-success",
  },
  warning: {
    container:
      "border-[rgba(var(--color-warning),0.10)] bg-[rgba(var(--color-warning),0.045)]",
    icon: "text-warning",
  },
  danger: {
    container:
      "border-[rgba(var(--color-danger),0.10)] bg-[rgba(var(--color-danger),0.045)]",
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
    index === rows - 1 ? "72%" : "100%"
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
    return "border-[rgba(15,23,42,0.06)] bg-[rgba(250,251,253,0.96)]";
  }
  if (tone === "subtle") {
    return "border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.95)]";
  }
  if (tone === "brand-soft") {
    return "border-[rgba(var(--color-brand),0.08)] bg-[rgba(var(--color-brand),0.03)]";
  }
  return "border-[rgba(15,23,42,0.07)] bg-white";
}

export function PageCanvas({ className, children }) {
  return (
    <div
      className={cx(
        "mx-auto w-full max-w-shell-content",
        "space-y-4 md:space-y-5",
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
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div className="max-w-[860px]">
        {eyebrow ? (
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(15,23,42,0.42)]">
            {eyebrow}
          </div>
        ) : null}

        <h1 className="font-display text-[1.6rem] font-semibold leading-[0.98] tracking-[-0.05em] text-[rgba(15,23,42,0.96)] md:text-[1.9rem]">
          {title}
        </h1>

        {description ? (
          <p className="mt-2 max-w-[760px] text-[14px] font-medium leading-6 text-[rgba(15,23,42,0.62)]">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">
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
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(15,23,42,0.42)]">
            {eyebrow}
          </div>
        ) : null}

        <h2 className="font-display text-[1.12rem] font-semibold leading-[1] tracking-[-0.04em] text-[rgba(15,23,42,0.96)] md:text-[1.22rem]">
          {title}
        </h2>

        {description ? (
          <p className="mt-2 text-[13px] font-medium leading-6 text-[rgba(15,23,42,0.6)]">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">
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
        "rounded-[10px] border",
        surfaceToneClass({ tone, subdued }),
        paddedClass(padded),
        shadow === "sm" && "shadow-[0_12px_28px_-24px_rgba(15,23,42,0.14)]",
        shadow === "md" && "shadow-[0_18px_40px_-28px_rgba(15,23,42,0.16)]",
        shadow === "none" && "shadow-none",
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
  className,
  tone = "default",
}) {
  const toneClass =
    tone === "brand"
      ? "border-[rgba(var(--color-brand),0.10)] bg-[rgba(var(--color-brand),0.03)]"
      : tone === "success"
        ? "border-[rgba(var(--color-success),0.10)] bg-[rgba(var(--color-success),0.03)]"
        : tone === "warning"
          ? "border-[rgba(var(--color-warning),0.10)] bg-[rgba(var(--color-warning),0.03)]"
          : "border-[rgba(15,23,42,0.07)] bg-white";

  return (
    <div className={cx("rounded-[10px] border px-4 py-3.5", toneClass, className)}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgba(15,23,42,0.42)]">
        {label}
      </div>
      <div className="mt-2 text-[1.22rem] font-semibold tracking-[-0.05em] text-[rgba(15,23,42,0.95)]">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[12px] font-medium leading-5 text-[rgba(15,23,42,0.58)]">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function ToolbarRow({ className, children }) {
  return (
    <div
      className={cx(
        "flex flex-col gap-3 border-b border-[rgba(15,23,42,0.06)] pb-4 md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      {children}
    </div>
  );
}

export function StateSkeletonBlock({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cx("animate-pulse rounded-[8px] bg-surface-subtle", className)}
    />
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
        "border",
        palette.container,
        compact ? "rounded-[8px] px-4 py-3" : "rounded-[10px] px-4 py-3.5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cx(
            "mt-[1px] inline-flex shrink-0 items-center justify-center",
            compact ? "h-4 w-4" : "h-[16px] w-[16px]",
            palette.icon
          )}
        >
          {iconElement}
        </span>

        <div className="min-w-0 flex-1">
          {title ? (
            <div className="text-[14px] font-semibold leading-5 tracking-[-0.02em] text-[rgba(15,23,42,0.95)]">
              {title}
            </div>
          ) : null}

          {description ? (
            <div
              className={cx(
                "text-[13px] font-medium text-[rgba(15,23,42,0.64)]",
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
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[rgba(15,23,42,0.06)] bg-white text-text-subtle">
          <Spin size="small" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-[rgba(15,23,42,0.94)]">
            {title}
          </div>
          {description ? (
            <div className="text-[13px] font-medium leading-6 text-[rgba(15,23,42,0.6)]">
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
        <span className="inline-flex h-9 w-9 items-center justify-center text-text-subtle">
          <Info className="h-4 w-4" />
        </span>

        <div>
          <div className="text-[14px] font-semibold text-[rgba(15,23,42,0.94)]">
            {title}
          </div>
          {description ? (
            <div className="mt-1 text-[13px] font-medium leading-6 text-[rgba(15,23,42,0.58)]">
              {description}
            </div>
          ) : null}
        </div>

        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </Surface>
  );
}

export function AuthFrame({ className, children, aside }) {
  return (
    <div className={cx("min-h-screen bg-canvas px-4 py-6 md:px-6 md:py-8", className)}>
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1240px] gap-6 xl:grid-cols-[minmax(0,1.05fr)_360px]">
        <div className="flex items-center">{children}</div>
        {aside ? <div className="hidden xl:flex xl:items-stretch">{aside}</div> : null}
      </div>
    </div>
  );
}

export function AuthPanel({ className, children, padded = "xl" }) {
  return (
    <Surface
      padded={padded}
      shadow="md"
      className={cx("w-full rounded-[14px]", className)}
    >
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