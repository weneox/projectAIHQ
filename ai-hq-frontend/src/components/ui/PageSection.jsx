import { cx } from "../../lib/cx.js";

export function PageHeader({
  eyebrow = "",
  title,
  body = "",
  align = "left",
  className = "",
}) {
  const centered = String(align ?? "").trim().toLowerCase() === "center";

  return (
    <div className={cx("border-b product-divider pb-8", centered ? "text-center" : "", className)}>
      <div className={cx(centered ? "mx-auto max-w-[740px]" : "max-w-[760px]")}>
        {eyebrow ? <div className="product-kicker mb-4">{eyebrow}</div> : null}
        <h2 className="text-[30px] font-semibold leading-[1.04] tracking-[-0.055em] text-slate-950 sm:text-[38px] lg:text-[44px]">
          {title}
        </h2>
        {body ? (
          <p className="mt-3 max-w-[720px] text-[15px] leading-7 text-slate-600">
            {body}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function PageSection({
  children,
  className = "",
  divider = true,
}) {
  return (
    <section className={cx(divider ? "product-section" : "", className)}>
      {children}
    </section>
  );
}

export function SurfaceBlock({
  children,
  className = "",
  tone = "default",
}) {
  const toneClass =
    tone === "info"
      ? "border-sky-200/80 bg-sky-50/55"
      : tone === "warn"
      ? "border-amber-200/80 bg-amber-50/60"
      : tone === "success"
      ? "border-emerald-200/80 bg-emerald-50/55"
      : "border-slate-200/80 bg-white/68";

  return (
    <div
      className={cx(
        "product-surface rounded-[28px] p-5 sm:p-6",
        toneClass,
        className
      )}
    >
      {children}
    </div>
  );
}

export function InlineCallout({
  title,
  body = "",
  tone = "default",
  action = null,
  className = "",
}) {
  const toneClass =
    tone === "info"
      ? "product-callout-info"
      : tone === "warn"
      ? "product-callout-warn"
      : tone === "danger"
      ? "product-callout-danger"
      : "";

  return (
    <div className={cx("product-callout", toneClass, className)}>
      {title ? (
        <div className="text-sm font-semibold tracking-[-0.02em] text-slate-950">
          {title}
        </div>
      ) : null}
      {body ? (
        <div className="mt-1 text-sm leading-6 text-slate-600">{body}</div>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
