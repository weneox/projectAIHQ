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

const SHELL_CHROME_BG = "rgba(249,250,253,0.988)";
const SHELL_CHROME_SURFACE =
  "linear-gradient(180deg, rgba(255,255,255,0.985) 0%, rgba(249,250,253,0.99) 46%, rgba(245,247,251,0.988) 100%)";

const SIDEBAR_EDGE_SHADOW =
  "inset -1px 0 0 rgba(15,23,42,0.082), inset -2px 0 0 rgba(255,255,255,0.74), 14px 0 34px -32px rgba(15,23,42,0.32)";

const NAV_ITEMS = [
  ...PRIMARY_SECTIONS,
  ...SECONDARY_SECTIONS,
  ...UTILITY_SECTIONS,
];

const SOFT_EASE = "cubic-bezier(0.22,1,0.36,1)";

function formatBadgeCount(count) {
  if (typeof count !== "number" || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function SidebarImageIcon({ src, collapsed = false, isActive = false }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable="false"
      className={cx(
        "relative z-[2] select-none object-contain",
        collapsed ? "h-[22px] w-[22px]" : "h-[21px] w-[21px]",
        isActive ? "opacity-100" : "opacity-[0.84] group-hover:opacity-100"
      )}
      style={{
        filter: isActive ? "saturate(1.04)" : "saturate(0.96)",
        transition: `opacity 190ms ${SOFT_EASE}, filter 220ms ${SOFT_EASE}`,
      }}
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
            "group relative flex items-center overflow-hidden",
            collapsed ? "h-11 justify-center" : "h-10 gap-3 px-4"
          )}
          style={{
            transition: `color 190ms ${SOFT_EASE}, opacity 190ms ${SOFT_EASE}`,
          }}
        >
          <span
            className="pointer-events-none absolute inset-y-[5px] left-0 w-[2.5px] rounded-r-full bg-brand"
            style={{
              opacity: isActive ? 1 : 0,
              transform: isActive
                ? "translateX(0) scaleY(1)"
                : "translateX(-2px) scaleY(0.7)",
              boxShadow:
                "0 0 0 1px rgba(59,130,246,0.06), 0 9px 18px -9px rgba(37,99,235,0.62)",
              transition: `opacity 230ms ${SOFT_EASE}, transform 300ms ${SOFT_EASE}`,
            }}
          />

          <span
            className="pointer-events-none absolute inset-y-0 left-0 w-full"
            style={{
              opacity: isActive ? 0.58 : 0,
              background:
                "linear-gradient(90deg, rgba(37,99,235,0.048) 0%, rgba(37,99,235,0.022) 34%, rgba(37,99,235,0) 78%)",
              transition: `opacity 280ms ${SOFT_EASE}`,
            }}
          />

          <span
            className="pointer-events-none absolute inset-y-0 left-0 w-full opacity-0 group-hover:opacity-100"
            style={{
              background:
                "linear-gradient(90deg, rgba(15,23,42,0.026) 0%, rgba(15,23,42,0.012) 34%, rgba(15,23,42,0) 76%)",
              transition: `opacity 230ms ${SOFT_EASE}`,
            }}
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
                "relative z-[2] shrink-0",
                collapsed ? "h-[22px] w-[22px]" : "h-[21px] w-[21px]",
                isActive ? "text-brand" : "text-text-subtle group-hover:text-text"
              )}
              strokeWidth={1.95}
              style={{
                transition: `color 190ms ${SOFT_EASE}, opacity 190ms ${SOFT_EASE}`,
              }}
            />
          ) : null}

          <div
            className={cx(
              "relative z-[2] min-w-0 overflow-hidden",
              collapsed
                ? "max-w-0 translate-x-1 opacity-0"
                : "max-w-[138px] opacity-100"
            )}
            style={{
              transition: `max-width 360ms ${SOFT_EASE}, opacity 230ms ${SOFT_EASE}, transform 360ms ${SOFT_EASE}`,
            }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cx(
                  "min-w-0 flex-1 truncate text-[12px] font-semibold tracking-[-0.025em]",
                  isActive ? "text-text" : "text-text-muted group-hover:text-text"
                )}
                style={{
                  transition: `color 190ms ${SOFT_EASE}`,
                }}
              >
                {item.label}
              </span>

              {badgeCount ? (
                <span
                  className={cx(
                    "shrink-0 text-[10px] font-semibold",
                    isActive ? "text-brand" : "text-text-subtle"
                  )}
                  style={{
                    transition: `color 190ms ${SOFT_EASE}`,
                  }}
                >
                  {badgeCount}
                </span>
              ) : null}
            </div>
          </div>

          {collapsed && badgeCount ? (
            <span
              className={cx(
                "absolute right-[6px] top-[6px] z-[3] text-[9px] font-semibold",
                isActive ? "text-brand" : "text-text-subtle"
              )}
            >
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
        "group relative inline-flex items-center text-text-subtle hover:text-text",
        collapsed ? "h-9 w-9 justify-center" : "h-9 gap-2 px-1"
      )}
      style={{
        transition: `color 190ms ${SOFT_EASE}, opacity 190ms ${SOFT_EASE}`,
      }}
    >
      <Icon className="relative z-[1] h-[17px] w-[17px]" strokeWidth={1.95} />

      <span
        className={cx(
          "relative z-[1] overflow-hidden text-[11px] font-semibold tracking-[-0.015em]",
          collapsed ? "max-w-0 opacity-0" : "max-w-[108px] opacity-100"
        )}
        style={{
          transition: `max-width 340ms ${SOFT_EASE}, opacity 230ms ${SOFT_EASE}`,
        }}
      >
        Collapse
      </span>
    </button>
  );
}

function SidebarBrandSpace({ collapsed = false }) {
  return <div className={cx("shrink-0", collapsed ? "h-[76px]" : "h-[92px]")} />;
}

function SidebarChromeLayer() {
  return (
    <>
      <div
        className="absolute inset-0 backdrop-blur-xl"
        style={{ background: SHELL_CHROME_SURFACE }}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.18) 46%, rgba(226,232,240,0.22) 100%)",
        }}
      />

      <div
        className="pointer-events-none absolute left-0 top-0 h-full w-px opacity-70"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(226,232,240,0.36), rgba(255,255,255,0.82))",
        }}
      />

      <div
        className="pointer-events-none absolute right-0 top-0 h-full w-px"
        style={{
          background:
            "linear-gradient(180deg, rgba(15,23,42,0.032), rgba(15,23,42,0.092) 42%, rgba(15,23,42,0.04))",
        }}
      />

      <div
        className="pointer-events-none absolute right-px top-0 h-full w-px opacity-75"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.84), rgba(255,255,255,0.36), rgba(255,255,255,0.7))",
        }}
      />
    </>
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
    <div className="relative z-[2] flex h-full flex-col">
      {mobile ? (
        <div className="flex items-center justify-end px-3 pb-2 pt-3">
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="inline-flex h-9 w-9 items-center justify-center text-text-muted hover:text-text"
            style={{
              transition: `color 190ms ${SOFT_EASE}`,
            }}
          >
            <X className="h-[18px] w-[18px]" strokeWidth={1.95} />
          </button>
        </div>
      ) : (
        <SidebarBrandSpace collapsed={collapsed} />
      )}

      <div className="sidebar-scroll flex-1 overflow-y-auto px-0 pb-4 pt-0">
        <div className="space-y-1">
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
        <div
          className={cx(
            "relative px-4 pb-4 pt-3",
            collapsed && "flex justify-center px-2"
          )}
        >
          <div
            className={cx(
              "pointer-events-none absolute top-0 h-px",
              collapsed ? "left-3 right-3" : "left-4 right-4"
            )}
            style={{
              background:
                "linear-gradient(90deg, rgba(15,23,42,0), rgba(15,23,42,0.064), rgba(255,255,255,0.76), rgba(15,23,42,0))",
            }}
          />

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
        className="fixed left-0 z-[55] hidden overflow-hidden md:block"
        style={{
          top: `${topOffset}px`,
          height: `calc(100vh - ${topOffset}px)`,
          width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
          background: SHELL_CHROME_BG,
          boxShadow: SIDEBAR_EDGE_SHADOW,
          transition: `width 380ms ${SOFT_EASE}, top 270ms ${SOFT_EASE}, height 270ms ${SOFT_EASE}`,
        }}
      >
        <div className="relative h-full">
          <SidebarChromeLayer />

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
            backdropFilter: "blur(22px)",
          },
          header: { display: "none" },
          content: {
            background: SHELL_CHROME_BG,
            boxShadow:
              "22px 0 70px -42px rgba(15,23,42,0.42), inset -1px 0 0 rgba(15,23,42,0.08)",
          },
          mask: {
            background: "rgba(15,23,42,0.2)",
            backdropFilter: "blur(5px)",
          },
        }}
      >
        <div className="relative h-full overflow-hidden">
          <SidebarChromeLayer />

          <SidebarContent
            shellStats={shellStats}
            mobile
            collapsed={false}
            onNavigate={() => setMobileOpen(false)}
            onToggleCollapse={() => setMobileOpen(false)}
            onCloseMobile={() => setMobileOpen(false)}
          />
        </div>
      </Drawer>
    </>
  );
}

export {
  SIDEBAR_WIDTH,
  SIDEBAR_COLLAPSED_WIDTH,
  SHELL_CHROME_BG,
};