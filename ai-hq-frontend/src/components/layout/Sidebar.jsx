import * as React from "react";
import { Drawer } from "antd";
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

const SIDEBAR_WIDTH = 248;
const SIDEBAR_COLLAPSED_WIDTH = 72;
const MOBILE_DRAWER_WIDTH = 288;
const SHELL_TOPBAR_HEIGHT = 56;

function formatBadgeCount(count) {
  if (typeof count !== "number" || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function SectionTitle({ children, collapsed = false }) {
  if (collapsed) return null;

  return (
    <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle first:pt-0">
      {children}
    </div>
  );
}

function Brand({ collapsed = false, mobile = false, onNavigate, onClose }) {
  return (
    <div
      className={cx(
        "border-b border-line-soft px-3 py-3",
        collapsed && !mobile && "px-2"
      )}
    >
      <div
        className={cx(
          "flex items-center",
          collapsed && !mobile ? "justify-center" : "justify-between gap-2"
        )}
      >
        <NavLink
          to="/home"
          onClick={onNavigate}
          aria-label="AI HQ Home"
          className={cx(
            "min-w-0 text-text",
            collapsed && !mobile
              ? "flex h-10 w-10 items-center justify-center rounded-soft border border-line bg-surface"
              : "flex min-w-0 flex-1 items-center gap-3"
          )}
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-soft border border-line bg-surface-subtle">
            <Building2 className="h-4 w-4" strokeWidth={1.9} />
          </span>

          {!collapsed || mobile ? (
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">
                AI HQ
              </span>
              <span className="block truncate text-[12px] text-text-muted">
                Product shell
              </span>
            </span>
          ) : null}
        </NavLink>

        {mobile ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="inline-flex h-9 w-9 items-center justify-center rounded-soft border border-line bg-surface text-text-muted hover:bg-surface-subtle hover:text-text"
          >
            <X className="h-4 w-4" strokeWidth={1.9} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function NavRow({ item, shellStats = {}, onNavigate, collapsed = false }) {
  const Icon = item.icon;
  const badgeCount = formatBadgeCount(shellStats?.[item.badgeKey]);
  const linkLabel = badgeCount ? `${item.label} ${badgeCount}` : item.label;

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-label={linkLabel}
    >
      {({ isActive }) => (
        <div
          className={cx(
            "relative flex items-center gap-3 rounded-soft border px-3 text-[13px] transition-colors",
            collapsed ? "mx-auto h-10 w-10 justify-center px-0" : "h-10",
            isActive
              ? "border-line-strong bg-surface-subtle text-text"
              : "border-transparent text-text-muted hover:border-line-soft hover:bg-surface-subtle hover:text-text"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.9} />

          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1 truncate font-medium">
                {item.label}
              </span>
              {badgeCount ? (
                <span className="shrink-0 text-[12px] text-text-subtle">
                  {badgeCount}
                </span>
              ) : null}
            </>
          ) : badgeCount ? (
            <span className="absolute right-1 top-1 text-[10px] text-text-subtle">
              {badgeCount}
            </span>
          ) : null}
        </div>
      )}
    </NavLink>
  );
}

function NavGroup({
  title,
  items,
  shellStats,
  onNavigate,
  collapsed = false,
}) {
  if (!items.length) return null;

  return (
    <div className="space-y-1">
      <SectionTitle collapsed={collapsed}>{title}</SectionTitle>
      {items.map((item) => (
        <NavRow
          key={item.id}
          item={item}
          shellStats={shellStats}
          onNavigate={onNavigate}
          collapsed={collapsed}
        />
      ))}
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
        "inline-flex items-center justify-center rounded-soft border border-line bg-surface text-text-muted hover:bg-surface-subtle hover:text-text",
        collapsed ? "h-9 w-9" : "h-9 w-full gap-2"
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.9} />
      {!collapsed ? <span className="text-[13px] font-medium">Collapse</span> : null}
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
    <div className="flex h-full flex-col bg-surface">
      <Brand
        collapsed={collapsed}
        mobile={mobile}
        onNavigate={onNavigate}
        onClose={onCloseMobile}
      />

      <div className="sidebar-scroll flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-4">
          <NavGroup
            title="Primary"
            items={PRIMARY_SECTIONS}
            shellStats={shellStats}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />

          <NavGroup
            title="Product"
            items={SECONDARY_SECTIONS}
            shellStats={shellStats}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />

          <NavGroup
            title="Other"
            items={UTILITY_SECTIONS}
            shellStats={shellStats}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
        </div>
      </div>

      {!mobile ? (
        <div
          className={cx(
            "border-t border-line-soft p-2",
            collapsed && "flex justify-center"
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
        className="fixed inset-y-0 left-0 z-[70] hidden overflow-hidden border-r border-line-soft bg-surface md:block"
        style={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
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
          },
          mask: {
            background: "rgba(17,24,39,0.2)",
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
