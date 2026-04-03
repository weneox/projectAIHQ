import { cx } from "../../lib/cx.js";
import {
  PageHeader as ShellPageHeader,
  Section as ShellSection,
  Surface,
} from "./AppShellPrimitives.jsx";

function normalizeTone(tone = "default") {
  const value = String(tone || "default").toLowerCase();
  if (value === "warn") return "warning";
  if (value === "error") return "danger";
  return value;
}

function toneClass(tone = "default") {
  switch (normalizeTone(tone)) {
    case "info":
      return "border-line bg-brand-soft";
    case "success":
      return "border-line bg-success-soft";
    case "warning":
      return "border-line bg-warning-soft";
    case "danger":
      return "border-line bg-danger-soft";
    default:
      return "";
  }
}

export function PageHeader(props) {
  return <ShellPageHeader {...props} />;
}

export function PageSection({
  children,
  className = "",
  divider = true,
}) {
  return (
    <ShellSection
      className={cx(divider ? "border-t border-line-soft pt-6" : "", className)}
    >
      {children}
    </ShellSection>
  );
}

export function SurfaceBlock({
  children,
  className = "",
  tone = "default",
  padded = "md",
  shadow = "none",
}) {
  return (
    <Surface
      padded={padded}
      shadow={shadow}
      className={cx(toneClass(tone), className)}
    >
      {children}
    </Surface>
  );
}

export function InlineCallout({
  title,
  body = "",
  tone = "default",
  action = null,
  className = "",
}) {
  return (
    <SurfaceBlock tone={tone} className={cx("rounded-[20px] p-4", className)}>
      {title ? <div className="text-sm font-semibold text-text">{title}</div> : null}
      {body ? <div className="mt-1 text-sm leading-6 text-text-muted">{body}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </SurfaceBlock>
  );
}