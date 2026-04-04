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
    container: "border-line bg-surface text-text",
    icon: "bg-[rgba(var(--color-brand),0.08)] text-brand",
  },
  success: {
    container:
      "border-[rgba(var(--color-success),0.16)] bg-[rgba(var(--color-success),0.06)] text-text",
    icon: "bg-[rgba(var(--color-success),0.1)] text-success",
  },
  warning: {
    container:
      "border-[rgba(var(--color-warning),0.16)] bg-[rgba(var(--color-warning),0.06)] text-text",
    icon: "bg-[rgba(var(--color-warning),0.1)] text-warning",
  },
  danger: {
    container:
      "border-[rgba(var(--color-danger),0.16)] bg-[rgba(var(--color-danger),0.06)] text-text",
    icon: "bg-[rgba(var(--color-danger),0.1)] text-danger",
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
    return "border-line bg-surface-muted";
  }
  if (tone === "subtle") {
    return "border-line-soft bg-surface-subtle";
  }
  if (tone === "brand-soft") {
    return "border-[rgba(var(--color-brand),0.16)] bg-[rgba(var(--color-brand),0.06)]";
  }
  return "border-line bg-surface";
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
        "flex flex-col gap-5 rounded-[18px] border border-line bg-surface px-5 py-5 md:flex-row md:items-end md:justify-between md:px-6 md:py-6",
        className
      )}
    >
      <div className="max-w-[820px]">
        {eyebrow ? (
          <div className="mb-3 inline-flex items-center rounded-[8px] border border-line bg-surface-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
            {eyebrow}
          </div>
        ) : null}

        <h1 className="font-display text-[1.95rem] font-semibold leading-[0.95] tracking-[-0.055em] text-text md:text-[2.6rem]">
          {title}
        </h1>

        {description ? (
          <p className="mt-3 max-w-[720px] text-[14px] leading-7 text-text-muted">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
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
        "flex flex-col gap-3 md:flex-row md:items-start md:justify-between",
        className
      )}
    >
      <div className="max-w-[760px]">
        {eyebrow ? (
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
            {eyebrow}
          </div>
        ) : null}

        <h2 className="font-display text-[1.35rem] font-semibold leading-[0.98] tracking-[-0.05em] text-text md:text-[1.5rem]">
          {title}
        </h2>

        {description ? (
          <p className="mt-2 text-[14px] leading-7 text-text-muted">{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
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
        "rounded-[16px] border",
        surfaceToneClass({ tone, subdued }),
        paddedClass(padded),
        shadow === "sm" && "shadow-panel",
        shadow === "md" && "shadow-panel-strong",
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
      ? "border-[rgba(var(--color-brand),0.16)] bg-[rgba(var(--color-brand),0.06)]"
      : tone === "success"
        ? "border-[rgba(var(--color-success),0.18)] bg-[rgba(var(--color-success),0.06)]"
        : tone === "warning"
          ? "border-[rgba(var(--color-warning),0.18)] bg-[rgba(var(--color-warning),0.06)]"
          : "border-line bg-surface";

  return (
    <div className={cx("rounded-[14px] border px-4 py-4", toneClass, className)}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
        {label}
      </div>
      <div className="mt-2 text-[1.55rem] font-semibold tracking-[-0.05em] text-text">
        {value}
      </div>
      {hint ? <div className="mt-1 text-sm leading-6 text-text-muted">{hint}</div> : null}
    </div>
  );
}

export function ToolbarRow({ className, children }) {
  return (
    <div
      className={cx(
        "flex flex-col gap-3 border-b border-line-soft pb-4 md:flex-row md:items-center md:justify-between",
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
      className={cx("animate-pulse rounded-[12px] bg-surface-subtle", className)}
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
  const Icon = IconOverride || resolveNoticeIcon(tone);

  return (
    <div
      className={cx(
        "rounded-[14px] border",
        palette.container,
        compact ? "px-3.5 py-3" : "px-4 py-3.5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cx(
            "inline-flex shrink-0 items-center justify-center rounded-[9px]",
            compact ? "mt-0.5 h-7 w-7" : "mt-0.5 h-8 w-8",
            palette.icon
          )}
        >
          <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </span>

        <div className="min-w-0 flex-1">
          {title ? (
            <div className="text-sm font-semibold leading-5 text-text">{title}</div>
          ) : null}

          {description ? (
            <div
              className={cx(
                "text-sm text-text-muted",
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
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] bg-surface text-text-subtle">
          <Spin size="small" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-text">{title}</div>
          {description ? (
            <div className="text-sm leading-6 text-text-muted">{description}</div>
          ) : null}
        </div>
      </div>

      <div className={cx("mt-5 space-y-3", compact && "mt-4 space-y-2.5")}>
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
    <section className={cx("space-y-4", className)}>
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
      <div className="mx-auto flex max-w-[460px] flex-col items-center gap-3 py-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-surface text-text-subtle">
          <Info className="h-4 w-4" />
        </span>

        <div>
          <div className="text-sm font-semibold text-text">{title}</div>
          {description ? (
            <div className="mt-1 text-sm leading-6 text-text-muted">
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
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(880px_circle_at_50%_-12%,rgba(36,72,154,0.06),transparent_42%),linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,244,248,1))]" />
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
      className={cx("w-full rounded-[18px] bg-surface", className)}
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
