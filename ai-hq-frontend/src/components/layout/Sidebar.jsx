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

const SHELL_CHROME_BG = "rgba(226,232,240,0.995)";
const SHELL_CHROME_SURFACE =
  "linear-gradient(180deg, rgba(235,240,246,0.995) 0%, rgba(226,232,240,0.995) 48%, rgba(218,226,235,0.995) 100%)";

const SIDEBAR_EDGE_SHADOW =
  "inset -1px 0 0 rgba(15,23,42,0.082), inset -2px 0 0 rgba(255,255,255,0.74), 14px 0 34px -32px rgba(15,23,42,0.32)";

const NAV_ITEMS = [
  ...PRIMARY_SECTIONS,
  ...SECONDARY_SECTIONS,
  ...UTILITY_SECTIONS,
];

function formatBadgeCount(count) {
  if (typeof count !== "number" || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function SidebarImageIcon({ src, isActive = false }) {
  return (
    <span className="relative z-[2] flex h-6 w-6 shrink-0 items-center justify-center">
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable="false"
        className={cx(
          "block h-[21px] w-[21px] select-none object-contain transition-[opacity,filter] duration-base ease-premium",
          isActive ? "opacity-100 saturate-100" : "opacity-[0.84] saturate-[0.96] group-hover:opacity-100"
        )}
      />
    </span>
  );
}

function SidebarVectorIcon({ Icon, isActive = false }) {
  if (!Icon) return null;

  return (
    <span className="relative z-[2] flex h-6 w-6 shrink-0 items-center justify-center">
      <Icon
        className={cx(
          "block h-[21px] w-[21px] shrink-0 transition-[color,transform,filter] duration-slow ease-premium group-hover:scale-[1.065] group-hover:drop-shadow-[0_8px_12px_rgba(46,96,255,0.24)]",
          isActive ? "text-brand" : "text-text-subtle group-hover:text-text"
        )}
        strokeWidth={1.95}
      />
    </span>
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
          className="group relative grid h-10 items-center overflow-hidden px-[17px] transition-[color,opacity] duration-base ease-premium"
          style={{
            gridTemplateColumns: collapsed ? "24px 0px" : "24px minmax(0,1fr)",
            columnGap: collapsed ? "0px" : "12px",
            transition:
              "grid-template-columns var(--motion-slower) var(--motion-premium), column-gap var(--motion-slower) var(--motion-premium), color var(--motion-base) var(--motion-premium), opacity var(--motion-base) var(--motion-premium)",
          }}
        >
          <span
            className={cx(
              "pointer-events-none absolute inset-y-[5px] left-0 w-[2.5px] rounded-md bg-brand",
              "transition-[opacity,transform] duration-slow ease-premium",
              isActive ? "opacity-100 translate-x-0 scale-y-100" : "opacity-0 -translate-x-0.5 scale-y-75"
            )}
            style={{
              boxShadow:
                "0 0 0 1px rgba(59,130,246,0.06), 0 9px 18px -9px rgba(37,99,235,0.62)",
            }}
          />

          <span
            className={cx(
              "pointer-events-none absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,rgba(37,99,235,0.048)_0%,rgba(37,99,235,0.022)_34%,rgba(37,99,235,0)_78%)] transition-opacity duration-slow ease-premium",
              isActive ? "opacity-[0.58]" : "opacity-0"
            )}
          />

          <span className="pointer-events-none absolute inset-y-0 left-0 w-full opacity-0 transition-opacity duration-base ease-premium group-hover:opacity-100 bg-[linear-gradient(90deg,rgba(15,23,42,0.026)_0%,rgba(15,23,42,0.012)_34%,rgba(15,23,42,0)_76%)]" />
          <SidebarVectorIcon Icon={Icon} isActive={isActive} />

          <div
            className={cx(
              "relative z-[2] min-w-0 overflow-hidden transition-[opacity,transform] duration-slow ease-premium",
              collapsed ? "translate-x-[-2px] opacity-0" : "translate-x-0 opacity-100"
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cx(
                  "min-w-0 flex-1 truncate text-[12px] font-semibold tracking-[var(--tracking-tight-lg)] transition-colors duration-base ease-premium",
                  isActive ? "text-text" : "text-text-muted group-hover:text-text"
                )}
              >
                {item.label}
              </span>

              {badgeCount ? (
                <span
                  className={cx(
                    "shrink-0 text-[10px] font-semibold transition-colors duration-base ease-premium",
                    isActive ? "text-brand" : "text-text-subtle"
                  )}
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
        "group relative inline-flex h-9 items-center text-text-subtle transition-colors duration-base ease-premium hover:text-text",
        collapsed ? "w-9 justify-center" : "gap-2 px-1"
      )}
    >
      <Icon className="relative z-[1] h-[17px] w-[17px]" strokeWidth={1.95} />

      <span
        className={cx(
          "relative z-[1] overflow-hidden text-[11px] font-semibold tracking-[var(--tracking-tight-sm)] transition-[max-width,opacity] duration-slow ease-premium",
          collapsed ? "max-w-0 opacity-0" : "max-w-[108px] opacity-100"
        )}
      >
        Collapse
      </span>
    </button>
  );
}

function SidebarBrandSpace() {
  return <div className="h-[64px] shrink-0" />;
}

function SidebarChromeLayer() {
  return (
    <>
      <div className="absolute inset-0" style={{ background: SHELL_CHROME_SURFACE }} />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0.18)_46%,rgba(226,232,240,0.22)_100%)] opacity-50" />

      <div className="pointer-events-none absolute left-0 top-0 h-full w-px bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(226,232,240,0.36),rgba(255,255,255,0.82))] opacity-70" />

      <div className="pointer-events-none absolute right-0 top-0 h-full w-px bg-[linear-gradient(180deg,rgba(15,23,42,0.032),rgba(15,23,42,0.092)_42%,rgba(15,23,42,0.04))]" />

      <div className="pointer-events-none absolute right-px top-0 h-full w-px bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(255,255,255,0.36),rgba(255,255,255,0.7))] opacity-75" />
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
            className="inline-flex h-9 w-9 items-center justify-center text-text-muted transition-colors duration-base ease-premium hover:text-text"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={1.95} />
          </button>
        </div>
      ) : (
        <SidebarBrandSpace />
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
              "pointer-events-none absolute top-0 h-px bg-[linear-gradient(90deg,rgba(15,23,42,0),rgba(15,23,42,0.064),rgba(255,255,255,0.76),rgba(15,23,42,0))]",
              collapsed ? "left-3 right-3" : "left-4 right-4"
            )}
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
          transition:
            "width var(--motion-slower) var(--motion-premium), top var(--motion-slow) var(--motion-premium), height var(--motion-slow) var(--motion-premium)",
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
          },
          header: { display: "none" },
          content: {
            background: SHELL_CHROME_BG,
            boxShadow:
              "22px 0 70px -42px rgba(15,23,42,0.42), inset -1px 0 0 rgba(15,23,42,0.08)",
          },
          mask: {
            background: "rgba(15,23,42,0.2)",
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


