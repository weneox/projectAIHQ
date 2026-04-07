import * as React from "react";
import { Drawer, Tooltip } from "antd";
import { NavLink } from "react-router-dom";
import {
  Building2,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cx } from "../../lib/cx.js";
import {
  PRIMARY_SECTIONS,
  SECONDARY_SECTIONS,
  UTILITY_SECTIONS,
} from "./shellNavigation.js";

const SIDEBAR_WIDTH = 236;
const SIDEBAR_COLLAPSED_WIDTH = 88;
const MOBILE_DRAWER_WIDTH = 296;
const SHELL_TOPBAR_HEIGHT = 64;

function formatBadgeCount(count) {
  if (typeof count !== "number" || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function RailToggle({ collapsed = false, onToggle }) {
  const Icon = collapsed ? ChevronsRight : ChevronsLeft;

  return (
    <Tooltip
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      placement="right"
      mouseEnterDelay={0.18}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cx(
          "group inline-flex h-10 w-10 items-center justify-center rounded-[14px] border transition duration-200",
          "border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,253,0.995)_100%)]",
          "text-[rgba(15,23,42,0.54)] hover:border-[rgba(15,23,42,0.1)] hover:text-[rgba(15,23,42,0.92)] hover:shadow-[0_14px_28px_-22px_rgba(15,23,42,0.16)]"
        )}
      >
        <Icon className="h-[16px] w-[16px]" strokeWidth={2} />
      </button>
    </Tooltip>
  );
}

function BrandBlock({ collapsed = false, onNavigate, onToggleCollapse }) {
  return (
    <div
      className={cx(
        "flex items-center",
        collapsed ? "justify-center gap-2" : "justify-between gap-3"
      )}
    >
      <NavLink
        to="/home"
        onClick={onNavigate}
        className={cx(
          "group transition",
          collapsed
            ? "flex h-11 w-11 items-center justify-center rounded-[16px] hover:bg-[rgba(15,23,42,0.04)]"
            : "block min-w-0 flex-1 rounded-[16px] px-2.5 py-2.5 hover:bg-[rgba(15,23,42,0.04)]"
        )}
        aria-label="AI HQ Home"
      >
        {collapsed ? (
          <div className="relative flex h-11 w-11 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,rgba(38,76,165,0.12),rgba(38,76,165,0.03))] text-brand shadow-[0_16px_30px_-24px_rgba(38,76,165,0.5)]">
            <Building2 className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,rgba(38,76,165,0.12),rgba(38,76,165,0.03))] text-brand shadow-[0_16px_30px_-24px_rgba(38,76,165,0.5)]">
              <Building2 className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </div>

            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.96)]">
                AI HQ
              </div>
              <div className="mt-0.5 truncate text-[11px] font-medium text-[rgba(15,23,42,0.48)]">
                Operator workspace
              </div>
            </div>
          </div>
        )}
      </NavLink>

      <div className={cx(collapsed ? "shrink-0" : "shrink-0")}>
        <RailToggle collapsed={collapsed} onToggle={onToggleCollapse} />
      </div>
    </div>
  );
}

function NavDivider({ collapsed = false }) {
  return (
    <div
      className={cx(
        "my-4 border-t border-[rgba(15,23,42,0.06)]",
        collapsed ? "mx-2" : ""
      )}
    />
  );
}

function NavItem({ item, shellStats = {}, onNavigate, collapsed = false }) {
  const Icon = item.icon;
  const badgeCount = formatBadgeCount(shellStats?.[item.badgeKey]);

  const content = (
    <NavLink to={item.to} onClick={onNavigate}>
      {({ isActive }) => (
        <div
          className={cx(
            "group relative flex h-11 items-center rounded-[16px] transition-all duration-200 ease-premium",
            collapsed ? "justify-center px-0" : "gap-3 px-3.5",
            isActive
              ? "bg-[linear-gradient(135deg,rgba(38,76,165,0.98),rgba(64,118,255,0.95))] text-white shadow-[0_18px_34px_-24px_rgba(38,76,165,0.58)]"
              : "text-[rgba(15,23,42,0.58)] hover:bg-[rgba(15,23,42,0.045)] hover:text-[rgba(15,23,42,0.94)]"
          )}
        >
          {!collapsed && isActive ? (
            <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-white/88" />
          ) : null}

          <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />

          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <div
                className={cx(
                  "truncate text-[13.5px] tracking-[-0.02em]",
                  isActive ? "font-semibold text-white" : "font-semibold"
                )}
              >
                {item.label}
              </div>
            </div>
          ) : null}

          {badgeCount ? (
            collapsed ? (
              <span
                className={cx(
                  "absolute right-2 top-1.5 inline-flex min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-[rgba(38,76,165,0.12)] text-brand"
                )}
              >
                {badgeCount}
              </span>
            ) : (
              <span
                className={cx(
                  "min-w-[18px] text-right text-[11px] font-semibold leading-none",
                  isActive ? "text-white/90" : "text-[rgba(15,23,42,0.44)]"
                )}
              >
                {badgeCount}
              </span>
            )
          ) : null}
        </div>
      )}
    </NavLink>
  );

  if (!collapsed) return content;

  return (
    <Tooltip title={item.label} placement="right" mouseEnterDelay={0.14}>
      {content}
    </Tooltip>
  );
}

function SidebarSection({
  items,
  shellStats,
  onNavigate,
  collapsed = false,
}) {
  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <NavItem
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

function DesktopFooter({ collapsed = false, onToggleCollapse }) {
  return (
    <div className="pt-3">
      {collapsed ? (
        <div className="flex justify-center">
          <RailToggle collapsed={collapsed} onToggle={onToggleCollapse} />
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggleCollapse}
          className={cx(
            "group flex h-11 w-full items-center gap-3 rounded-[16px] px-3.5 transition duration-200",
            "border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,253,0.995)_100%)]",
            "text-[rgba(15,23,42,0.68)] hover:border-[rgba(15,23,42,0.1)] hover:text-[rgba(15,23,42,0.94)] hover:shadow-[0_14px_28px_-22px_rgba(15,23,42,0.16)]"
          )}
        >
          <ChevronsLeft className="h-[16px] w-[16px]" strokeWidth={2} />
          <span className="text-[12px] font-semibold tracking-[-0.01em]">
            Collapse sidebar
          </span>
        </button>
      )}
    </div>
  );
}

function SidebarContent({
  shellStats,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
  mobile = false,
}) {
  const utilityItems = Array.isArray(UTILITY_SECTIONS) ? UTILITY_SECTIONS : [];

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,253,0.998)_100%)] px-4 py-4">
      <BrandBlock
        collapsed={collapsed}
        onNavigate={onNavigate}
        onToggleCollapse={onToggleCollapse}
      />

      <div className="sidebar-scroll mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        <SidebarSection
          items={PRIMARY_SECTIONS}
          shellStats={shellStats}
          onNavigate={onNavigate}
          collapsed={collapsed}
        />

        <NavDivider collapsed={collapsed} />

        <SidebarSection
          items={SECONDARY_SECTIONS}
          shellStats={shellStats}
          onNavigate={onNavigate}
          collapsed={collapsed}
        />

        {utilityItems.length ? (
          <>
            <NavDivider collapsed={collapsed} />
            <SidebarSection
              items={utilityItems}
              shellStats={shellStats}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
          </>
        ) : null}
      </div>

      {!mobile ? (
        <div className="mt-3 border-t border-[rgba(15,23,42,0.06)] pt-3">
          <DesktopFooter
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
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
        className="fixed inset-y-0 left-0 z-[70] hidden border-r border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,253,0.998)_100%)] md:block"
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
            borderRight: "1px solid rgba(15,23,42,0.06)",
          },
        }}
      >
        <SidebarContent
          shellStats={shellStats}
          mobile
          collapsed={false}
          onNavigate={() => setMobileOpen(false)}
          onToggleCollapse={() => {}}
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