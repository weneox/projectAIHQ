import { Empty, Result, Skeleton, Spin } from "antd";
import { cx } from "../../lib/cx.js";

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
        "flex flex-col gap-6 border-b border-line-soft pb-6 md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div className="max-w-[760px]">
        {eyebrow ? (
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-text-subtle">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="font-display text-4xl font-semibold tracking-[-0.05em] text-text md:text-[2.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-[680px] text-[15px] leading-7 text-text-muted">
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
    <div className={cx("flex flex-col gap-4 md:flex-row md:items-start md:justify-between", className)}>
      <div className="max-w-[720px]">
        {eyebrow ? (
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-text-subtle">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="font-display text-[1.75rem] font-semibold tracking-[-0.045em] text-text">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-[15px] leading-7 text-text-muted">{description}</p>
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
      ? "p-6 md:p-8"
      : padded === "sm"
      ? "p-4"
      : padded === false
      ? "p-0"
      : "p-5 md:p-6";

  return (
    <div
      className={cx(
        "rounded-panel border shadow-panel",
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

export function LoadingSurface({ title = "Loading", description, className }) {
  return (
    <Surface className={className}>
      <div className="flex items-center gap-3">
        <Spin size="small" />
        <div>
          <div className="text-sm font-semibold text-text">{title}</div>
          {description ? (
            <div className="text-sm text-text-muted">{description}</div>
          ) : null}
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <Skeleton active paragraph={{ rows: 3 }} title={false} />
      </div>
    </Surface>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}) {
  return (
    <Surface className={className} subdued>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div className="space-y-1">
            <div className="text-sm font-semibold text-text">{title}</div>
            {description ? (
              <div className="text-sm text-text-muted">{description}</div>
            ) : null}
          </div>
        }
      >
        {action}
      </Empty>
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
      <Result
        status="warning"
        title={title}
        subTitle={description}
        extra={action ? [action] : undefined}
      />
    </Surface>
  );
}
