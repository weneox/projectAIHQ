import * as React from "react";
import { Drawer, Tooltip } from "antd";
import { NavLink } from "react-router-dom";
import {
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { cx } from "../../lib/cx.js";
import {
  PRIMARY_SECTIONS,
  SECONDARY_SECTIONS,
  UTILITY_SECTIONS,
} from "./shellNavigation.js";

const SIDEBAR_WIDTH = 276;
const SIDEBAR_COLLAPSED_WIDTH = 76;
const MOBILE_DRAWER_WIDTH = 292;
const SHELL_TOPBAR_HEIGHT = 64;

function formatBadgeCount(count) {
  if (typeof count !== "number" || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function MobileCloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close navigation"
      className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-[rgba(15,23,42,0.54)] transition-colors duration-200 hover:bg-surface-subtle hover:text-[rgba(15,23,42,0.92)]"
    >
      <X className="h-[16px] w-[16px]" strokeWidth={1.9} />
    </button>
  );
}

function CollapseControl({ collapsed = false, onToggle }) {
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";

  const node = (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      className={cx(
        "flex h-10 items-center text-[rgba(15,23,42,0.58)] transition-colors duration-200 hover:text-[rgba(15,23,42,0.92)]",
        collapsed
          ? "mx-auto w-10 justify-center rounded-[10px] hover:bg-surface-subtle"
          : "w-full justify-between rounded-[10px] px-3 hover:bg-surface-subtle"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className="h-[15px] w-[15px]" strokeWidth={1.9} />
        {!collapsed ? (
          <span className="text-[13px] font-semibold tracking-[-0.02em]">
            Collapse
          </span>
        ) : null}
      </div>
    </button>
  );

  if (!collapsed) return node;

  return (
    <Tooltip title={label} placement="right" mouseEnterDelay={0.12}>
      {node}
    </Tooltip>
  );
}

function Brand({ collapsed = false, mobile = false, onNavigate, onClose }) {
  return (
    <div
      className={cx(
        "border-b border-line-soft",
        collapsed && !mobile ? "px-0 py-5" : "px-5 py-5"
      )}
    >
      <div
        className={cx(
          "flex items-center",
          collapsed && !mobile ? "justify-center" : "justify-between gap-3"
        )}
      >
        <NavLink
          to="/home"
          onClick={onNavigate}
          aria-label="AI HQ Home"
          className={cx(
            "min-w-0 text-[rgba(15,23,42,0.98)]",
            collapsed && !mobile
              ? "flex items-center justify-center"
              : "flex min-w-0 flex-1 items-center gap-3"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(31,77,168,0.14)] bg-[rgba(31,77,168,0.05)] text-[rgb(var(--color-brand))]">
            <Building2 className="h-[17px] w-[17px]" strokeWidth={1.95} />
          </div>

          {!collapsed || mobile ? (
            <div className="min-w-0">
              <div className="truncate text-[17px] font-semibold tracking-[-0.045em]">
                AI HQ
              </div>
            </div>
          ) : null}
        </NavLink>

        {mobile ? <MobileCloseButton onClick={onClose} /> : null}
      </div>
    </div>
  );
}

function NavRow({ item, shellStats = {}, onNavigate, collapsed = false }) {
  const Icon = item.icon;
  const badgeCount = formatBadgeCount(shellStats?.[item.badgeKey]);

  const row = (
    <NavLink to={item.to} onClick={onNavigate}>
      {({ isActive }) => (
        <div
          className={cx(
            "group relative flex items-center transition-colors duration-200",
            collapsed
              ? "mx-auto h-11 w-11 justify-center rounded-[10px]"
              : "h-[46px] w-full gap-3 px-4",
            isActive
              ? "bg-[rgba(31,77,168,0.08)] text-[rgba(15,23,42,0.98)]"
              : "text-[rgba(15,23,42,0.68)] hover:bg-surface-subtle hover:text-[rgba(15,23,42,0.94)]"
          )}
        >
          {isActive ? (
            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[rgb(var(--color-brand))]" />
          ) : null}

          <Icon
            className={cx(
              "h-[17px] w-[17px] shrink-0",
              isActive
                ? "text-[rgb(var(--color-brand))]"
                : "text-[rgba(15,23,42,0.54)] group-hover:text-[rgba(15,23,42,0.92)]"
            )}
            strokeWidth={1.9}
          />

          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold tracking-[-0.02em]">
                {item.label}
              </div>
            </div>
          ) : null}

          {!collapsed && badgeCount ? (
            <span
              className={cx(
                "inline-flex min-w-[18px] items-center justify-center text-[10px] font-semibold leading-5",
                isActive
                  ? "text-[rgb(var(--color-brand))]"
                  : "text-[rgba(15,23,42,0.42)]"
              )}
            >
              {badgeCount}
            </span>
          ) : null}

          {collapsed && badgeCount ? (
            <span className="absolute right-[4px] top-[4px] inline-flex min-w-[16px] items-center justify-center text-[9px] font-semibold leading-4 text-[rgb(var(--color-brand))]">
              {badgeCount}
            </span>
          ) : null}
        </div>
      )}
    </NavLink>
  );

  if (!collapsed) return row;

  return (
    <Tooltip title={item.label} placement="right" mouseEnterDelay={0.12}>
      {row}
    </Tooltip>
  );
}

function Spacer({ collapsed = false }) {
  return <div className={cx("h-4", collapsed ? "mx-4" : "mx-5")} />;
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
    <div className="relative flex h-full flex-col overflow-hidden bg-white">
      <Brand
        collapsed={collapsed}
        mobile={mobile}
        onNavigate={onNavigate}
        onClose={onCloseMobile}
      />

      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {PRIMARY_SECTIONS.map((item) => (
            <NavRow
              key={item.id}
              item={item}
              shellStats={shellStats}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
          ))}
        </div>

        {SECONDARY_SECTIONS.length ? <Spacer collapsed={collapsed} /> : null}

        <div className="space-y-1">
          {SECONDARY_SECTIONS.map((item) => (
            <NavRow
              key={item.id}
              item={item}
              shellStats={shellStats}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
          ))}
        </div>

        {UTILITY_SECTIONS.length ? <Spacer collapsed={collapsed} /> : null}

        <div className="space-y-1">
          {UTILITY_SECTIONS.map((item) => (
            <NavRow
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
            "mt-auto border-t border-line-soft bg-white",
            collapsed ? "px-2.5 py-3" : "px-3 py-3"
          )}
        >
          <CollapseControl
            collapsed={collapsed}
            onToggle={onToggleCollapse}
          />
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
        className="fixed inset-y-0 left-0 z-[70] hidden overflow-hidden border-r border-line-soft bg-white md:block"
        style={{
          width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
          transition: "width 180ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <SidebarContent
          shellStats={shellStats}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed?.((value) => !value)}
        />
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
            background: "rgb(var(--color-surface))",
          },
          header: { display: "none" },
          content: {
            background: "rgb(var(--color-surface))",
            borderRight: "1px solid rgba(15,23,42,0.06)",
            boxShadow: "0 24px 48px -30px rgba(15,23,42,0.18)",
          },
          mask: {
            background: "rgba(15,23,42,0.22)",
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