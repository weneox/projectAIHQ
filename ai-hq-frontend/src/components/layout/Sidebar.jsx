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

const SIDEBAR_WIDTH = 76;
const EXPANDED_SIDEBAR_WIDTH = 228;
const SHELL_TOPBAR_HEIGHT = 60;

const NAV_GROUPS = [
  { id: "operate", label: "Operate", items: PRIMARY_SECTIONS },
  {
    id: "support",
    label: "Support",
    items: [...SECONDARY_SECTIONS, ...UTILITY_SECTIONS],
  },
];

function formatBadgeCount(count) {
  if (typeof count !== "number" || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function SectionLabel({ expanded, children }) {
  if (!expanded) return null;

  return (
    <div className="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
      {children}
    </div>
  );
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
            "relative transition-all duration-200 ease-premium",
            expanded
              ? "flex h-11 w-full items-center gap-3 rounded-[13px] px-3"
              : "flex h-11 w-11 items-center justify-center rounded-[13px]",
            isActive
              ? "bg-[rgba(var(--color-brand),0.09)] text-brand"
              : "text-text-muted hover:bg-surface-muted hover:text-text"
          )}
        >
          <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={1.9} />

          {expanded ? (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold tracking-[-0.02em]">
                  {item.label}
                </div>
                <div className="truncate text-[10px] uppercase tracking-[0.14em] text-text-subtle">
                  {item.kicker}
                </div>
              </div>

              {badgeCount ? (
                <div className="min-w-[20px] rounded-[8px] bg-surface px-1.5 py-1 text-center text-[10px] font-semibold leading-none text-text">
                  {badgeCount}
                </div>
              ) : null}
            </>
          ) : badgeCount ? (
            <div className="absolute -right-1 -top-1 min-w-[18px] rounded-[7px] bg-brand px-1.5 py-1 text-center text-[9px] font-semibold leading-none text-white">
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
        "flex items-center text-text transition",
        expanded
          ? "w-full gap-3 rounded-[14px] px-3 py-3 hover:bg-surface-muted"
          : "rounded-[14px] p-2 hover:bg-surface-muted"
      )}
      aria-label="AI HQ Home"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-brand text-white">
        <Building2 className="h-4.5 w-4.5" strokeWidth={1.9} />
      </div>

      {expanded ? (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold tracking-[-0.02em] text-text">
            AI HQ
          </div>
          <div className="truncate text-[10px] uppercase tracking-[0.14em] text-text-subtle">
            Operating system
          </div>
        </div>
      ) : null}
    </NavLink>
  );
}

function ExpandToggle({ expanded, onToggle }) {
  const button = (
    <button
      type="button"
      onClick={onToggle}
      className={cx(
        "flex items-center text-text-muted transition hover:bg-surface-muted hover:text-text",
        expanded
          ? "h-11 w-full gap-3 rounded-[13px] px-3"
          : "h-11 w-11 justify-center rounded-[13px]"
      )}
      aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
    >
      {expanded ? (
        <>
          <PanelLeftClose className="h-4 w-4 shrink-0" strokeWidth={1.9} />
          <span className="truncate text-[13px] font-semibold tracking-[-0.02em]">
            Collapse
          </span>
        </>
      ) : (
        <PanelLeftOpen className="h-4 w-4" strokeWidth={1.9} />
      )}
    </button>
  );

  if (expanded) return button;

  return (
    <Tooltip title="Expand" placement="right">
      {button}
    </Tooltip>
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
        "flex h-full flex-col px-3 py-4",
        expanded ? "items-stretch" : "items-center"
      )}
    >
      <BrandMark expanded={expanded} />

      <div
        className={cx(
          "mt-4 flex flex-1 flex-col",
          expanded ? "items-stretch" : "items-center"
        )}
      >
        {NAV_GROUPS.map((group) => (
          <div
            key={group.id}
            className={cx(
              "w-full",
              group.id === "support" ? "mt-4 border-t border-line-soft pt-2" : ""
            )}
          >
            <SectionLabel expanded={expanded}>{group.label}</SectionLabel>

            <div
              className={cx(
                "flex flex-col gap-1",
                expanded ? "items-stretch" : "items-center"
              )}
            >
              {group.items.map((item) => (
                <NavRailItem
                  key={item.id}
                  item={item}
                  shellStats={shellStats}
                  onNavigate={onNavigate}
                  expanded={expanded}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        className={cx(
          "mt-4 border-t border-line-soft pt-3",
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
        className="fixed inset-y-0 left-0 z-[70] hidden border-r border-line bg-[#fbfcfe] transition-[width] duration-200 md:block"
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
          body: {
            padding: 0,
            background: "rgb(var(--color-surface))",
          },
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