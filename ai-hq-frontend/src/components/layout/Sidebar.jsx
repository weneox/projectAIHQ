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

const SIDEBAR_WIDTH = 226;
const SIDEBAR_COLLAPSED_WIDTH = 66;
const MOBILE_DRAWER_WIDTH = 286;
const SHELL_TOPBAR_HEIGHT = 64;

function formatBadgeCount(count) {
  if (typeof count !== "number" || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function SidebarFooterToggle({ collapsed = false, onToggle }) {
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";

  const button = (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      className={cx(
        "group flex h-9 items-center text-[rgba(15,23,42,0.62)] transition-colors duration-200 hover:text-[rgba(15,23,42,0.92)]",
        collapsed
          ? "mx-auto w-9 justify-center"
          : "w-full justify-between px-1.5"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-[15px] w-[15px]" strokeWidth={1.9} />
        {!collapsed ? (
          <span className="text-[12px] font-semibold tracking-[-0.01em]">
            Collapse
          </span>
        ) : null}
      </div>

      {!collapsed ? (
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgba(15,23,42,0.34)]">
          ⌥
        </span>
      ) : null}
    </button>
  );

  if (!collapsed) return button;

  return (
    <Tooltip title={label} placement="right" mouseEnterDelay={0.12}>
      {button}
    </Tooltip>
  );
}

function MobileCloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close navigation"
      className="inline-flex h-9 w-9 items-center justify-center text-[rgba(15,23,42,0.62)] transition-colors duration-200 hover:text-[rgba(15,23,42,0.92)]"
    >
      <X className="h-[16px] w-[16px]" strokeWidth={1.9} />
    </button>
  );
}

function BrandBlock({ collapsed = false, mobile = false, onNavigate, onClose }) {
  return (
    <div
      className={cx(
        "border-b border-[rgba(15,23,42,0.06)]",
        collapsed && !mobile ? "px-2 py-4" : "px-4 py-4"
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
            "min-w-0 transition-opacity duration-200",
            collapsed && !mobile
              ? "flex items-center justify-center"
              : "flex min-w-0 flex-1 items-center gap-3"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center text-[rgba(31,77,168,0.96)]">
            <Building2 className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </div>

          {!collapsed || mobile ? (
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.96)]">
                AI HQ
              </div>
              <div className="mt-0.5 truncate text-[11px] font-medium text-[rgba(15,23,42,0.44)]">
                Workspace
              </div>
            </div>
          ) : null}
        </NavLink>

        {mobile ? <MobileCloseButton onClick={onClose} /> : null}
      </div>
    </div>
  );
}

function SectionHeading({ title, collapsed = false }) {
  return (
    <div
      className={cx(
        "overflow-hidden transition-all duration-200 ease-premium",
        collapsed
          ? "pointer-events-none max-h-0 opacity-0"
          : "max-h-8 opacity-100"
      )}
    >
      <div className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
        {title}
      </div>
    </div>
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
            "group relative flex items-center transition-colors duration-200",
            collapsed
              ? "mx-auto h-10 w-10 justify-center"
              : "h-[40px] w-full gap-3 px-4",
            isActive
              ? "text-[rgba(15,23,42,0.96)]"
              : "text-[rgba(15,23,42,0.58)] hover:text-[rgba(15,23,42,0.92)]"
          )}
        >
          {isActive ? (
            <span
              className={cx(
                "absolute bg-[rgb(var(--color-brand))]",
                collapsed
                  ? "left-1/2 top-[6px] h-[3px] w-4 -translate-x-1/2 rounded-full"
                  : "left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full"
              )}
            />
          ) : null}

          <Icon
            className={cx(
              "h-[17px] w-[17px] shrink-0",
              isActive
                ? "text-[rgba(31,77,168,0.98)]"
                : "text-[rgba(15,23,42,0.62)] group-hover:text-[rgba(15,23,42,0.9)]"
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
                "inline-flex min-w-[18px] items-center justify-center px-1.5 text-[10px] font-semibold leading-none",
                isActive
                  ? "text-[rgba(31,77,168,0.96)]"
                  : "text-[rgba(15,23,42,0.46)]"
              )}
            >
              {badgeCount}
            </span>
          ) : null}

          {collapsed && badgeCount ? (
            <span className="absolute right-[2px] top-[1px] inline-flex min-w-[15px] items-center justify-center px-1 text-[9px] font-semibold leading-4 text-[rgba(31,77,168,0.96)]">
              {badgeCount}
            </span>
          ) : null}
        </div>
      )}
    </NavLink>
  );

  if (!collapsed) return content;

  return (
    <Tooltip title={item.label} placement="right" mouseEnterDelay={0.12}>
      {content}
    </Tooltip>
  );
}

function SidebarSection({
  title,
  items,
  shellStats,
  onNavigate,
  collapsed = false,
}) {
  if (!Array.isArray(items) || !items.length) return null;

  return (
    <section>
      <SectionHeading title={title} collapsed={collapsed} />
      <div className={cx(collapsed ? "space-y-2 px-2" : "space-y-1")}>
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
    </section>
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
  const utilityItems = Array.isArray(UTILITY_SECTIONS) ? UTILITY_SECTIONS : [];

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-white">
      <BrandBlock
        collapsed={collapsed}
        mobile={mobile}
        onNavigate={onNavigate}
        onClose={onCloseMobile}
      />

      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto pt-4">
        <SidebarSection
          title="Operate"
          items={PRIMARY_SECTIONS}
          shellStats={shellStats}
          onNavigate={onNavigate}
          collapsed={collapsed}
        />

        <div
          className={cx(
            "mt-4 border-t border-[rgba(15,23,42,0.06)] pt-4",
            collapsed ? "mx-2" : "mx-4"
          )}
        />

        <SidebarSection
          title="Control"
          items={SECONDARY_SECTIONS}
          shellStats={shellStats}
          onNavigate={onNavigate}
          collapsed={collapsed}
        />

        {utilityItems.length ? (
          <>
            <div
              className={cx(
                "mt-4 border-t border-[rgba(15,23,42,0.06)] pt-4",
                collapsed ? "mx-2" : "mx-4"
              )}
            />
            <SidebarSection
              title="Utility"
              items={utilityItems}
              shellStats={shellStats}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
          </>
        ) : null}
      </div>

      {!mobile ? (
        <div
          className={cx(
            "mt-auto border-t border-[rgba(15,23,42,0.06)] bg-white",
            collapsed ? "px-2 py-3" : "px-4 py-4"
          )}
        >
          <SidebarFooterToggle
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
        className="fixed inset-y-0 left-0 z-[70] hidden overflow-hidden border-r border-[rgba(15,23,42,0.06)] bg-white md:block"
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