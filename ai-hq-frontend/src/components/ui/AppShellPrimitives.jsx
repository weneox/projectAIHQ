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
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-text md:text-[2.5rem]">
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
    <div className={cx("flex flex-col gap-3 md:flex-row md:items-start md:justify-between", className)}>
      <div className="max-w-[720px]">
        {eyebrow ? (
          <div className="mb-1.5 text-sm font-medium text-text-muted">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="font-display text-[1.5rem] font-semibold tracking-[-0.03em] text-text">
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
