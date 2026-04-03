import { Skeleton, Spin } from "antd";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  LockKeyhole,
} from "lucide-react";
import { cx } from "../../lib/cx.js";

const noticeToneMap = {
  info: {
    container: "border-line bg-surface text-text",
    icon: "bg-info-soft text-info",
  },
  success: {
    container: "border-success/25 bg-success-soft/70 text-text",
    icon: "bg-success-soft text-success",
  },
  warning: {
    container: "border-warning/30 bg-warning-soft/70 text-text",
    icon: "bg-warning-soft text-warning",
  },
  danger: {
    container: "border-danger/25 bg-danger-soft/70 text-text",
    icon: "bg-danger-soft text-danger",
  },
};

function toneConfig(tone = "info") {
  return noticeToneMap[tone] || noticeToneMap.info;
}

function toneIcon(tone = "info") {
  if (tone === "success") return CheckCircle2;
  if (tone === "warning" || tone === "danger") return AlertTriangle;
  return Info;
}

function skeletonWidths(rows) {
  return Array.from({ length: rows }, (_, index) =>
    index === rows - 1 ? "72%" : "100%"
  );
}

export function PageCanvas({ className, children }) {
  return (
    <div className={cx("mx-auto w-full max-w-[1480px]", className)}>{children}</div>
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
        "flex flex-col gap-5 border-b border-line-soft pb-5 md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div className="max-w-[760px]">
        {eyebrow ? (
          <div className="mb-2 text-sm font-medium text-text-muted">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-text md:text-[2.35rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-[680px] text-[15px] leading-6 text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
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
    <div className={cx("flex flex-col gap-3 md:flex-row md:items-start md:justify-between", className)}>
      <div className="max-w-[720px]">
        {eyebrow ? (
          <div className="mb-1.5 text-sm font-medium text-text-muted">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="font-display text-[1.45rem] font-semibold tracking-[-0.03em] text-text">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-[15px] leading-6 text-text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function Surface({
  className,
  children,
  padded = "md",
  subdued = false,
}) {
  const paddingClass =
    padded === "lg"
      ? "p-6"
      : padded === "sm"
      ? "p-4"
      : padded === false
      ? "p-0"
      : "p-5";

  return (
    <div
      className={cx(
        "rounded-panel border",
        subdued
          ? "border-line-soft bg-surface-muted"
          : "border-line bg-surface",
        paddingClass,
        className
      )}
    >
      {children}
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
      className={cx(
        "animate-pulse rounded-md bg-surface-subtle transition-colors duration-base",
        className
      )}
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
  const config = toneConfig(tone);
  const Icon = IconOverride || toneIcon(tone);

  return (
    <div
      className={cx(
        "rounded-panel border px-4 py-3",
        config.container,
        compact && "px-3 py-2.5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cx(
            "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            compact && "h-7 w-7",
            config.icon
          )}
        >
          <Icon className={cx("h-4 w-4", compact && "h-3.5 w-3.5")} />
        </span>
        <div className="min-w-0 flex-1">
          {title ? (
            <div className="text-sm font-semibold leading-5 text-text">{title}</div>
          ) : null}
          {description ? (
            <div
              className={cx(
                "text-sm leading-6 text-text-muted",
                title ? "mt-1" : "leading-5"
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
    <Surface className={className} subdued>
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-subtle text-text-subtle">
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
          paragraph={{ rows, width: skeletonWidths(rows) }}
          title={false}
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
      {(title || description || eyebrow || actions) ? (
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
    <Surface className={cx("text-center", className)} subdued>
      <div className="mx-auto flex max-w-[420px] flex-col items-center gap-3 py-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-subtle text-text-subtle">
          <Info className="h-4 w-4" />
        </span>
        <div>
          <div className="text-sm font-semibold text-text">{title}</div>
          {description ? (
            <div className="mt-1 text-sm leading-6 text-text-muted">{description}</div>
          ) : null}
        </div>
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
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
