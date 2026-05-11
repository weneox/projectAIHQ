import Card from "./Card.jsx";
import { cx } from "../../lib/cx.js";

export function AppWorkspaceSplit({
  children,
  className = "",
  minHeightClass = "min-h-[690px]",
  columnsClassName = "xl:grid-cols-[minmax(0,1fr)_390px]",
}) {
  return (
    <Card padded={false} className={cx("overflow-visible", className)}>
      <div
        className={cx(
          "grid items-stretch",
          minHeightClass,
          columnsClassName
        )}
      >
        {children}
      </div>
    </Card>
  );
}

export function AppWorkspaceMain({ children, className = "" }) {
  return <div className={cx("min-w-0", className)}>{children}</div>;
}