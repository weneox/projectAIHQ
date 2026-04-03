import { cx } from "../../lib/cx.js";
import {
  PageHeader as ShellPageHeader,
  Section as ShellSection,
  Surface,
} from "./AppShellPrimitives.jsx";

export function PageHeader(props) {
  return <ShellPageHeader {...props} />;
}

export function PageSection({ children, className = "", divider = true }) {
  return (
    <ShellSection className={cx(divider ? "border-t border-line-soft pt-6" : "", className)}>
      {children}
    </ShellSection>
  );
}

export function SurfaceBlock({ children, className = "", tone = "default" }) {
  return (
    <Surface
      className={cx(
        tone === "info" && "border-brand/15 bg-brand-soft/40",
        tone === "warn" && "border-warning/20 bg-warning/10",
        tone === "success" && "border-success/20 bg-success/10",
        className
      )}
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
    <SurfaceBlock
      tone={tone}
      className={cx("rounded-[20px] p-4", className)}
    >
      {title ? <div className="text-sm font-semibold text-text">{title}</div> : null}
      {body ? <div className="mt-1 text-sm leading-6 text-text-muted">{body}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </SurfaceBlock>
  );
}
