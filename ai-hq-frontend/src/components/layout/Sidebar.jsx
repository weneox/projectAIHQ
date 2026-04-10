import * as React from "react";
import { Drawer } from "antd";
import { NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cx } from "../../lib/cx.js";
import {
  PRIMARY_SECTIONS,
  SECONDARY_SECTIONS,
  UTILITY_SECTIONS,
} from "./shellNavigation.js";

const SIDEBAR_WIDTH = 272;
const SIDEBAR_COLLAPSED_WIDTH = 84;
const MOBILE_DRAWER_WIDTH = 304;
const SHELL_TOPBAR_HEIGHT = 60;

const NAV_STACK = [
  ...PRIMARY_SECTIONS.map((item) => ({ type: "item", item })),
  { type: "divider", id: "divider-primary-secondary" },
  ...SECONDARY_SECTIONS.map((item) => ({ type: "item", item })),
  ...(UTILITY_SECTIONS.length
    ? [{ type: "divider", id: "divider-secondary-utility" }]
    : []),
  ...UTILITY_SECTIONS.map((item) => ({ type: "item", item })),
];

function formatBadgeCount(count) {
  if (typeof count !== "number" || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function BrandMark({ compact = false }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "relative shrink-0",
        compact ? "h-6 w-6" : "h-7 w-7"
      )}
    >
      <span className="absolute bottom-[2px] left-[1px] h-[2px] w-[18px] rounded-full bg-[linear-gradient(90deg,rgba(15,23,42,0.92),rgba(46,96,255,0.9))]" />
      <span className="absolute left-[3px] top-[1px] h-[21px] w-[2px] rounded-full bg-[rgba(15,23,42,0.96)]" />
      <span className="absolute left-[10px] top-[5px] h-[17px] w-[2px] rounded-full bg-[rgba(46,96,255,0.98)]" />
      <span className="absolute left-[17px] top-[0px] h-[22px] w-[2px] rounded-full bg-[rgba(15,23,42,0.54)]" />
    </span>
  );
}

function SidebarBrand({
  collapsed = false,
  mobile = false,
  onNavigate,
  onClose,
}) {
  return (
    <div
      className={cx(
        "relative flex h-[60px] items-center",
        collapsed && !mobile ? "justify-center px-2" : "justify-between px-4"
      )}
    >
      <NavLink
        to="/home"
        onClick={onNavigate}
        aria-label="AI HQ Home"
        className={cx(
          "min-w-0 text-text",
          collapsed && !mobile
            ? "flex h-11 w-11 items-center justify-center"
            : "flex min-w-0 flex-1 items-center gap-3"
        )}
      >
        <BrandMark compact={collapsed && !mobile} />

        <div
          className={cx(
            "min-w-0 overflow-hidden transition-[max-width,opacity,transform] duration-slow ease-premium",
            collapsed && !mobile
              ? "max-w-0 translate-x-1 opacity-0"
              : "max-w-[160px] translate-x-0 opacity-100"
          )}
        >
          <div className="truncate text-[15px] font-semibold tracking-[-0.04em] text-text">
            AI HQ
          </div>
          <div className="mt-[1px] truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-text-subtle/70">
            Workspace OS
          </div>
        </div>
      </NavLink>

      {mobile ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="inline-flex h-9 w-9 items-center justify-center text-text-muted transition-[color,opacity,transform] duration-base ease-premium hover:text-text"
        >
          <X className="h-4 w-4" strokeWidth={1.9} />
        </button>
      ) : null}
    </div>
  );
}

function SidebarItem({
  item,
  shellStats = {},
  onNavigate,
  collapsed = false,
}) {
  const Icon = item.icon;
  const badgeCount = formatBadgeCount(shellStats?.[item.badgeKey]);
  const linkLabel = badgeCount ? `${item.label} ${badgeCount}` : item.label;

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-label={linkLabel}
      end={item.to === "/home"}
    >
      {({ isActive }) => (
        <div
          className={cx(
            "group relative mx-2 flex items-center overflow-hidden transition-[transform,opacity] duration-base ease-premium",
            collapsed ? "h-11 justify-center px-0" : "h-11 gap-3 px-4"
          )}
        >
          <span
            className={cx(
              "pointer-events-none absolute inset-y-[4px] rounded-[13px] transition-[opacity,background-color,box-shadow,transform] duration-base ease-premium",
              collapsed ? "inset-x-[4px]" : "left-0 right-0",
              isActive
                ? "bg-[linear-gradient(90deg,rgba(46,96,255,0.14),rgba(46,96,255,0.045))] opacity-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_22px_-18px_rgba(46,96,255,0.58)]"
                : "bg-[linear-gradient(90deg,rgba(255,255,255,0.92),rgba(255,255,255,0.52))] opacity-0 group-hover:opacity-100"
            )}
          />

          {!collapsed ? (
            <span
              className={cx(
                "absolute left-0 top-1/2 h-[18px] w-[2px] -translate-y-1/2 rounded-full transition-[opacity,transform,background-color] duration-base ease-premium",
                isActive ? "bg-brand opacity-100" : "opacity-0"
              )}
            />
          ) : null}

          <Icon
            className={cx(
              "relative z-[1] h-[17px] w-[17px] shrink-0 transition-[color,transform] duration-base ease-premium",
              isActive
                ? "text-brand"
                : "text-text-subtle group-hover:text-text"
            )}
            strokeWidth={1.9}
          />

          <div
            className={cx(
              "relative z-[1] min-w-0 overflow-hidden transition-[max-width,opacity,transform] duration-slow ease-premium",
              collapsed
                ? "max-w-0 translate-x-1 opacity-0"
                : "max-w-[180px] translate-x-0 opacity-100"
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cx(
                  "min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.02em] transition-colors duration-base ease-premium",
                  isActive ? "text-text" : "text-text-muted group-hover:text-text"
                )}
              >
                {item.label}
              </span>

              {badgeCount ? (
                <span className="shrink-0 text-[11px] font-medium text-text-subtle">
                  {badgeCount}
                </span>
              ) : null}
            </div>
          </div>

          {collapsed && badgeCount ? (
            <span className="absolute right-[8px] top-[7px] text-[10px] font-medium text-text-subtle">
              {badgeCount}
            </span>
          ) : null}
        </div>
      )}
    </NavLink>
  );
}

function SidebarDivider({ collapsed = false }) {
  return (
    <div
      className={cx(
        "px-3 py-2 transition-opacity duration-base ease-premium",
        collapsed ? "opacity-0" : "opacity-100"
      )}
    >
      <div className="h-px bg-[rgba(15,23,42,0.06)]" />
    </div>
  );
}

function CollapseControl({ collapsed = false, onToggle }) {
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={cx(
        "inline-flex items-center text-text-muted transition-[color,opacity] duration-base ease-premium hover:text-text",
        collapsed ? "h-10 w-10 justify-center" : "h-10 gap-2 px-2"
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.9} />
      <span
        className={cx(
          "overflow-hidden text-[12px] font-medium tracking-[-0.01em] transition-[max-width,opacity,transform] duration-slow ease-premium",
          collapsed
            ? "max-w-0 translate-x-1 opacity-0"
            : "max-w-[120px] translate-x-0 opacity-100"
        )}
      >
        Collapse
      </span>
    </button>
  );
}

function SidebarContent({
  shellStats,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
  mobile = false,
  onCloseMobile,
}) {
  return (
    <div className="relative flex h-full flex-col">
      <SidebarBrand
        collapsed={collapsed}
        mobile={mobile}
        onNavigate={onNavigate}
        onClose={onCloseMobile}
      />

      <div className="sidebar-scroll flex-1 overflow-y-auto py-3">
        <div className="space-y-[2px]">
          {NAV_STACK.map((entry) => {
            if (entry.type === "divider") {
              return <SidebarDivider key={entry.id} collapsed={collapsed} />;
            }

            return (
              <SidebarItem
                key={entry.item.id}
                item={entry.item}
                shellStats={shellStats}
                onNavigate={onNavigate}
                collapsed={collapsed}
              />
            );
          })}
        </div>
      </div>

      {!mobile ? (
        <div className={cx("px-4 pb-3", collapsed && "flex justify-center px-2")}>
          <div className={cx(!collapsed && "border-t border-[rgba(15,23,42,0.06)] pt-2")}>
            <CollapseControl
              collapsed={collapsed}
              onToggle={onToggleCollapse}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Sidebar({
  mobileOpen,
  setMobileOpen,
  shellStats = {},
  collapsed = false,
  setCollapsed,
}) {
  return (
    <>
      <aside
        className="fixed inset-y-0 left-0 z-[70] hidden overflow-hidden transition-[width] duration-slow ease-premium md:block"
        style={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
      >
        <div className="relative h-full">
          <div className="absolute inset-0 bg-[rgb(255,255,255)]" />
          <div className="absolute inset-0 shadow-[inset_-1px_0_0_rgba(15,23,42,0.06)]" />
          <div className="absolute left-[-18px] top-[-10px] h-[130px] w-[130px] rounded-full bg-[radial-gradient(circle,rgba(46,96,255,0.10)_0%,rgba(46,96,255,0.034)_46%,rgba(46,96,255,0)_76%)] blur-2xl" />

          <SidebarContent
            shellStats={shellStats}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed?.((value) => !value)}
          />
        </div>
      </aside>

      <Drawer
        placement="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        width={MOBILE_DRAWER_WIDTH}
        closeIcon={null}
        styles={{
          body: {
            padding: 0,
            background: "rgb(255,255,255)",
          },
          header: { display: "none" },
          content: {
            background: "rgb(255,255,255)",
            boxShadow: "inset -1px 0 0 rgba(15,23,42,0.06)",
          },
          mask: {
            background: "rgba(15,23,42,0.24)",
            backdropFilter: "blur(3px)",
          },
        }}
      >
        <SidebarContent
          shellStats={shellStats}
          mobile
          collapsed={false}
          onNavigate={() => setMobileOpen(false)}
          onToggleCollapse={() => setMobileOpen(false)}
          onCloseMobile={() => setMobileOpen(false)}
        />
      </Drawer>
    </>
  );
}

export {
  SIDEBAR_WIDTH,
  SIDEBAR_COLLAPSED_WIDTH,
  SHELL_TOPBAR_HEIGHT,
};