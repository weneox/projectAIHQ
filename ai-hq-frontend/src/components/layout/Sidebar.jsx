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

const SIDEBAR_WIDTH = 236;
const SIDEBAR_COLLAPSED_WIDTH = 74;
const MOBILE_DRAWER_WIDTH = 280;
const SHELL_TOPBAR_HEIGHT = 56;
const NAV_ITEMS = [...PRIMARY_SECTIONS, ...SECONDARY_SECTIONS, ...UTILITY_SECTIONS];

function formatBadgeCount(count) {
  if (typeof count !== "number" || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function SidebarItem({ item, shellStats = {}, onNavigate, collapsed = false }) {
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
            "group relative mx-2 flex items-center overflow-hidden transition-all duration-base ease-premium",
            collapsed ? "h-12 justify-center" : "h-12 gap-3 px-3.5"
          )}
        >
          <span
            className={cx(
              "pointer-events-none absolute inset-y-[4px] rounded-[14px] border transition-all duration-base ease-premium",
              collapsed ? "inset-x-[4px]" : "left-0 right-0",
              isActive
                ? "border-white/70 bg-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_16px_26px_-22px_rgba(46,96,255,0.72)]"
                : "border-transparent bg-white/46 opacity-0 group-hover:border-white/55 group-hover:opacity-100"
            )}
          />

          {!collapsed ? (
            <span
              className={cx(
                "absolute left-0 top-1/2 h-[18px] w-[2px] -translate-y-1/2 rounded-full bg-brand transition-opacity duration-base ease-premium",
                isActive ? "opacity-100" : "opacity-0"
              )}
            />
          ) : null}

          <Icon
            className={cx(
              "relative z-[1] shrink-0 transition-all duration-base ease-premium",
              collapsed ? "h-[19px] w-[19px]" : "h-[18px] w-[18px]",
              isActive ? "text-brand" : "text-text-subtle group-hover:text-text"
            )}
            strokeWidth={1.95}
          />

          <div
            className={cx(
              "relative z-[1] min-w-0 overflow-hidden transition-all duration-slow ease-premium",
              collapsed ? "max-w-0 translate-x-1 opacity-0" : "max-w-[160px] opacity-100"
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={cx(
                  "min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.02em] transition-colors duration-base ease-premium",
                  isActive ? "text-text" : "text-text-muted group-hover:text-text"
                )}
              >
                {item.label}
              </span>
              {badgeCount ? (
                <span className="shrink-0 text-[11px] font-medium text-text-subtle">{badgeCount}</span>
              ) : null}
            </div>
          </div>

          {collapsed && badgeCount ? (
            <span className="absolute right-[8px] top-[7px] text-[10px] font-medium text-text-subtle">{badgeCount}</span>
          ) : null}
        </div>
      )}
    </NavLink>
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
        "inline-flex items-center rounded-[14px] border border-white/50 bg-white/56 text-text-muted shadow-[0_10px_30px_-26px_rgba(15,23,42,0.6),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur transition-all duration-base ease-premium hover:border-white/70 hover:bg-white/78 hover:text-text",
        collapsed ? "h-10 w-10 justify-center" : "h-10 gap-2 px-3"
      )}
    >
      <Icon className="h-[15px] w-[15px]" strokeWidth={1.95} />
      <span
        className={cx(
          "overflow-hidden text-[12px] font-medium tracking-[-0.01em] transition-all duration-slow ease-premium",
          collapsed ? "max-w-0 opacity-0" : "max-w-[120px] opacity-100"
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
      {mobile ? (
        <div className="flex items-center justify-end px-3 pb-2 pt-3">
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/50 bg-white/58 text-text-muted shadow-[0_10px_30px_-26px_rgba(15,23,42,0.6),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur transition-all duration-base ease-premium hover:border-white/70 hover:bg-white/78 hover:text-text"
          >
            <X className="h-[16px] w-[16px]" strokeWidth={1.95} />
          </button>
        </div>
      ) : (
        <div className="h-3" />
      )}

      <div className="sidebar-scroll flex-1 overflow-y-auto px-1 pb-3 pt-1">
        <div className="space-y-[3px]">
          {NAV_ITEMS.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              shellStats={shellStats}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
          ))}
        </div>
      </div>

      {!mobile ? (
        <div className={cx("px-3 pb-3 pt-2", collapsed && "flex justify-center px-2")}>
          <CollapseControl collapsed={collapsed} onToggle={onToggleCollapse} />
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
  topOffset = 0,
}) {
  return (
    <>
      <aside
        className="fixed left-0 z-[70] hidden overflow-hidden transition-[width,top,height] duration-slow ease-premium md:block"
        style={{
          top: `${topOffset}px`,
          height: `calc(100vh - ${topOffset}px)`,
          width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        }}
      >
        <div className="relative h-full">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(244,246,248,0.96),rgba(238,241,245,0.92))] backdrop-blur-xl" />
          <div className="absolute inset-0 shadow-[inset_-1px_0_0_rgba(15,23,42,0.055)]" />
          <div className="absolute left-[-38px] top-[-18px] h-[170px] w-[170px] rounded-full bg-[radial-gradient(circle,rgba(46,96,255,0.085)_0%,rgba(46,96,255,0.028)_46%,rgba(46,96,255,0)_74%)] blur-3xl" />

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
            background: "linear-gradient(180deg,rgba(244,246,248,0.98),rgba(238,241,245,0.96))",
            backdropFilter: "blur(20px)",
          },
          header: { display: "none" },
          content: {
            background: "linear-gradient(180deg,rgba(244,246,248,0.98),rgba(238,241,245,0.96))",
            boxShadow: "inset -1px 0 0 rgba(15,23,42,0.055)",
          },
          mask: {
            background: "rgba(15,23,42,0.22)",
            backdropFilter: "blur(4px)",
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