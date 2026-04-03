import * as React from "react";
import { Drawer, Tooltip } from "antd";
import { NavLink } from "react-router-dom";
import {
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cx } from "../../lib/cx.js";
import {
  PRIMARY_SECTIONS,
  SECONDARY_SECTIONS,
  UTILITY_SECTIONS,
} from "./shellNavigation.js";

const SIDEBAR_WIDTH = 52;
const EXPANDED_SIDEBAR_WIDTH = 220;
const SHELL_TOPBAR_HEIGHT = 52;

const RAIL_ITEMS = [
  ...PRIMARY_SECTIONS,
  ...SECONDARY_SECTIONS,
  ...UTILITY_SECTIONS,
];

function formatBadgeCount(count) {
  if (typeof count !== "number" || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function NavRailItem({
  item,
  shellStats = {},
  onNavigate,
  expanded = false,
}) {
  const Icon = item.icon;
  const badgeCount = formatBadgeCount(shellStats?.[item.badgeKey]);

  const content = (
    <NavLink to={item.to} onClick={onNavigate}>
      {({ isActive }) => (
        <div
          className={cx(
            "relative flex items-center transition-all duration-200",
            expanded
              ? "h-10 w-full gap-3 rounded-[14px] px-3"
              : "h-9 w-9 justify-center rounded-[12px]",
            isActive
              ? "bg-brand-soft text-brand shadow-[inset_0_0_0_1px_rgba(37,99,235,0.08)]"
              : "text-text-muted hover:bg-surface-muted hover:text-text"
          )}
        >
          {isActive ? (
            <span
              className={cx(
                "absolute top-1/2 -translate-y-1/2 rounded-r-full bg-brand",
                expanded ? "left-0 h-5 w-[2px]" : "left-0 h-4 w-[2px]"
              )}
            />
          ) : null}

          <Icon
            className={cx("shrink-0", expanded ? "h-4 w-4" : "h-4 w-4")}
            strokeWidth={1.95}
          />

          {expanded ? (
            <>
              <div className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.02em]">
                {item.label}
              </div>

              {badgeCount ? (
                <div className="min-w-[18px] rounded-full bg-brand px-1.5 py-[3px] text-center text-[9px] font-semibold leading-none text-white shadow-sm">
                  {badgeCount}
                </div>
              ) : null}
            </>
          ) : badgeCount ? (
            <div className="absolute -right-1 -top-1 min-w-[15px] rounded-full bg-brand px-1 py-[2px] text-center text-[8px] font-semibold leading-none text-white shadow-sm">
              {badgeCount}
            </div>
          ) : null}
        </div>
      )}
    </NavLink>
  );

  if (expanded) return content;

  return (
    <Tooltip title={item.label} placement="right">
      {content}
    </Tooltip>
  );
}

function BrandMark({ expanded = false }) {
  return (
    <NavLink
      to="/home"
      className={cx(
        "flex items-center rounded-[14px] transition hover:bg-surface-muted",
        expanded
          ? "w-full gap-3 px-2 py-1.5"
          : "justify-center p-1"
      )}
      aria-label="AI HQ Home"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-line bg-surface-muted shadow-sm">
        <Building2 className="h-4 w-4 text-brand" strokeWidth={1.95} />
      </div>

      {expanded ? (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold tracking-[-0.02em] text-text">
            AI HQ
          </div>
          <div className="truncate text-[11px] text-text-subtle">
            Operator shell
          </div>
        </div>
      ) : null}
    </NavLink>
  );
}

function ExpandToggle({ expanded, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cx(
        "flex items-center text-text-muted transition hover:bg-surface-muted hover:text-text",
        expanded
          ? "h-10 w-full gap-3 rounded-[14px] px-3"
          : "h-9 w-9 justify-center rounded-[12px]"
      )}
      aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
    >
      {expanded ? (
        <>
          <PanelLeftClose className="h-4 w-4 shrink-0" strokeWidth={1.95} />
          <span className="truncate text-[13px] font-medium tracking-[-0.02em]">
            Collapse
          </span>
        </>
      ) : (
        <Tooltip title="Expand" placement="right">
          <div className="flex h-full w-full items-center justify-center">
            <PanelLeftOpen className="h-4 w-4" strokeWidth={1.95} />
          </div>
        </Tooltip>
      )}
    </button>
  );
}

function SidebarContent({
  shellStats,
  onNavigate,
  expanded = false,
  onToggleExpanded,
}) {
  return (
    <div
      className={cx(
        "flex h-full flex-col px-1.5 py-2",
        expanded ? "items-stretch" : "items-center"
      )}
    >
      <BrandMark expanded={expanded} />

      <div
        className={cx(
          "mt-2 flex flex-1 flex-col gap-1",
          expanded ? "items-stretch" : "items-center"
        )}
      >
        {RAIL_ITEMS.map((item) => (
          <NavRailItem
            key={item.id}
            item={item}
            shellStats={shellStats}
            onNavigate={onNavigate}
            expanded={expanded}
          />
        ))}
      </div>

      <div
        className={cx(
          "mt-2 border-t border-line-soft pt-2",
          expanded ? "w-full" : "w-auto"
        )}
      >
        <ExpandToggle expanded={expanded} onToggle={onToggleExpanded} />
      </div>
    </div>
  );
}

export default function Sidebar({
  mobileOpen,
  setMobileOpen,
  shellStats = {},
}) {
  const [expanded, setExpanded] = React.useState(false);
  const sidebarWidth = expanded ? EXPANDED_SIDEBAR_WIDTH : SIDEBAR_WIDTH;

  return (
    <>
      <aside
        className="fixed inset-y-0 left-0 z-[70] hidden border-r border-line bg-surface transition-[width] duration-200 md:block"
        style={{ width: sidebarWidth }}
      >
        <SidebarContent
          shellStats={shellStats}
          expanded={expanded}
          onToggleExpanded={() => setExpanded((value) => !value)}
        />
      </aside>

      <Drawer
        placement="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        width={sidebarWidth}
        closeIcon={null}
        styles={{
          body: { padding: 0 },
          header: { display: "none" },
          content: {
            background: "rgb(var(--color-surface))",
            borderRight: "1px solid rgb(var(--color-line))",
          },
        }}
      >
        <SidebarContent
          shellStats={shellStats}
          expanded={expanded}
          onToggleExpanded={() => setExpanded((value) => !value)}
          onNavigate={() => setMobileOpen(false)}
        />
      </Drawer>
    </>
  );
}

export { SIDEBAR_WIDTH, SHELL_TOPBAR_HEIGHT };