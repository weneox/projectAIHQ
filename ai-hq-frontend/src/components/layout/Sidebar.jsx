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

const SIDEBAR_WIDTH = 190;
const SIDEBAR_COLLAPSED_WIDTH = 58;
const MOBILE_DRAWER_WIDTH = 268;
const SHELL_CHROME_BG = "rgba(248,249,252,0.975)";
const NAV_ITEMS = [...PRIMARY_SECTIONS, ...SECONDARY_SECTIONS, ...UTILITY_SECTIONS];

function formatBadgeCount(count) {
  if (typeof count !== "number" || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function SidebarImageIcon({
  src,
  collapsed = false,
  isActive = false,
}) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable="false"
      className={cx(
        "select-none object-contain transition-all duration-base ease-premium",
        collapsed ? "h-[19px] w-[19px]" : "h-[18px] w-[18px]",
        isActive ? "opacity-100" : "opacity-[0.86] group-hover:opacity-100"
      )}
    />
  );
}

function SidebarItem({ item, shellStats = {}, onNavigate, collapsed = false }) {
  const badgeCount = formatBadgeCount(shellStats?.[item.badgeKey]);
  const linkLabel = badgeCount ? `${item.label} ${badgeCount}` : item.label;
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-label={linkLabel}
      end={item.to === "/home"}
      className="block"
    >
      {({ isActive }) => (
        <div
          className={cx(
            "group relative flex items-center transition-all duration-base ease-premium",
            collapsed ? "h-11 justify-center" : "h-10 gap-3 px-4"
          )}
        >
          <span
            className={cx(
              "absolute left-0 top-1/2 h-[14px] w-[2px] -translate-y-1/2 rounded-full bg-brand transition-opacity duration-base ease-premium",
              isActive ? "opacity-100" : "opacity-0"
            )}
          />

          {item.iconType === "image" && item.iconSrc ? (
            <SidebarImageIcon
              src={item.iconSrc}
              collapsed={collapsed}
              isActive={isActive}
            />
          ) : Icon ? (
            <Icon
              className={cx(
                "relative z-[1] shrink-0 transition-colors duration-base ease-premium",
                collapsed ? "h-[19px] w-[19px]" : "h-[18px] w-[18px]",
                isActive ? "text-brand" : "text-text-subtle group-hover:text-text"
              )}
              strokeWidth={1.95}
            />
          ) : null}

          <div
            className={cx(
              "relative z-[1] min-w-0 overflow-hidden transition-all duration-slow ease-premium",
              collapsed ? "max-w-0 translate-x-1 opacity-0" : "max-w-[138px] opacity-100"
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cx(
                  "min-w-0 flex-1 truncate text-[12px] font-medium tracking-[-0.02em] transition-colors duration-base ease-premium",
                  isActive ? "text-text" : "text-text-muted group-hover:text-text"
                )}
              >
                {item.label}
              </span>

              {badgeCount ? (
                <span className="shrink-0 text-[10px] font-medium text-text-subtle">
                  {badgeCount}
                </span>
              ) : null}
            </div>
          </div>

          {collapsed && badgeCount ? (
            <span className="absolute right-[6px] top-[6px] text-[9px] font-medium text-text-subtle">
              {badgeCount}
            </span>
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
        "inline-flex items-center text-text-subtle transition-colors duration-base ease-premium hover:text-text",
        collapsed ? "h-8 w-8 justify-center" : "h-8 gap-2 px-1"
      )}
    >
      <Icon className="h-[14px] w-[14px]" strokeWidth={1.95} />
      <span
        className={cx(
          "overflow-hidden text-[11px] font-medium tracking-[-0.01em] transition-all duration-slow ease-premium",
          collapsed ? "max-w-0 opacity-0" : "max-w-[108px] opacity-100"
        )}
      >
        Collapse
      </span>
    </button>
  );
}

function SidebarBrandSpace({ collapsed = false }) {
  return <div className={cx("shrink-0", collapsed ? "h-[76px]" : "h-[92px]")} />;
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
            className="inline-flex h-8 w-8 items-center justify-center text-text-muted transition-colors duration-base ease-premium hover:text-text"
          >
            <X className="h-[15px] w-[15px]" strokeWidth={1.95} />
          </button>
        </div>
      ) : (
        <SidebarBrandSpace collapsed={collapsed} />
      )}

      <div className="sidebar-scroll flex-1 overflow-y-auto px-2 pb-4 pt-0">
        <div className="space-y-1.5">
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
        <div className={cx("px-3 pb-4 pt-2", collapsed && "flex justify-center px-2")}>
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
        className="fixed left-0 z-[55] hidden overflow-hidden transition-[width,top,height] duration-slow ease-premium md:block"
        style={{
          top: `${topOffset}px`,
          height: `calc(100vh - ${topOffset}px)`,
          width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
          background: SHELL_CHROME_BG,
          boxShadow:
            "inset -1px 0 0 rgba(15,23,42,0.045), 12px 0 24px -28px rgba(15,23,42,0.12)",
        }}
      >
        <div className="relative h-full">
          <div
            className="absolute inset-0 backdrop-blur-xl"
            style={{ background: SHELL_CHROME_BG }}
          />
          <div className="absolute right-0 top-0 h-full w-px bg-[rgba(15,23,42,0.028)]" />

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
            background: SHELL_CHROME_BG,
            backdropFilter: "blur(20px)",
          },
          header: { display: "none" },
          content: {
            background: SHELL_CHROME_BG,
          },
          mask: {
            background: "rgba(15,23,42,0.18)",
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
  SHELL_CHROME_BG,
};