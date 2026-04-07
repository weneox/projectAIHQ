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

const SIDEBAR_WIDTH = 268;
const SIDEBAR_COLLAPSED_WIDTH = 76;
const MOBILE_DRAWER_WIDTH = 308;
const SHELL_TOPBAR_HEIGHT = 64;

function formatBadgeCount(count) {
  if (typeof count !== "number" || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function SidebarEdgeGlow() {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0)_100%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-[linear-gradient(180deg,rgba(15,23,42,0.02)_0%,rgba(15,23,42,0.08)_24%,rgba(15,23,42,0.08)_76%,rgba(15,23,42,0.02)_100%)]" />
    </>
  );
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
        "group flex h-12 items-center transition-all duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        collapsed
          ? "mx-auto w-12 justify-center rounded-[14px] border border-[rgba(15,23,42,0.08)] bg-white/[0.86] text-[rgba(15,23,42,0.62)] shadow-[0_16px_30px_-24px_rgba(15,23,42,0.22)]"
          : "w-full justify-between rounded-[12px] border border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,253,0.98)_100%)] px-3.5 text-[rgba(15,23,42,0.68)] shadow-[0_16px_30px_-24px_rgba(15,23,42,0.18)]"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className="h-[16px] w-[16px]" strokeWidth={1.9} />
        {!collapsed ? (
          <span className="text-[12px] font-semibold tracking-[-0.01em]">
            Collapse sidebar
          </span>
        ) : null}
      </div>

      {!collapsed ? (
        <span className="text-[11px] font-medium text-[rgba(15,23,42,0.38)] transition-colors duration-200 group-hover:text-[rgba(15,23,42,0.62)]">
          ⌥
        </span>
      ) : null}
    </button>
  );

  if (!collapsed) return button;

  return (
    <Tooltip title={label} placement="right" mouseEnterDelay={0.16}>
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
      className={cx(
        "inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-[rgba(15,23,42,0.08)]",
        "bg-white/[0.82] text-[rgba(15,23,42,0.62)] shadow-[0_14px_28px_-22px_rgba(15,23,42,0.22)]",
        "transition-all duration-300 hover:bg-white hover:text-[rgba(15,23,42,0.88)]"
      )}
    >
      <X className="h-[16px] w-[16px]" strokeWidth={1.9} />
    </button>
  );
}

function BrandMark() {
  return (
    <div
      className={cx(
        "relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px]",
        "border border-[rgba(38,76,165,0.14)]",
        "bg-[radial-gradient(120%_120%_at_0%_0%,rgba(88,118,255,0.18)_0%,rgba(88,118,255,0.05)_42%,rgba(255,255,255,0.96)_100%)]",
        "text-[rgba(27,66,169,0.96)] shadow-[0_18px_34px_-24px_rgba(38,76,165,0.42)]"
      )}
    >
      <div className="absolute inset-x-2 bottom-0 h-px bg-[linear-gradient(90deg,rgba(38,76,165,0)_0%,rgba(38,76,165,0.28)_50%,rgba(38,76,165,0)_100%)]" />
      <Building2 className="h-[18px] w-[18px]" strokeWidth={1.9} />
    </div>
  );
}

function BrandBlock({ collapsed = false, mobile = false, onNavigate, onClose }) {
  return (
    <div
      className={cx(
        "relative z-[1] border-b border-[rgba(15,23,42,0.06)]",
        collapsed && !mobile ? "px-2 py-4" : "px-5 py-5"
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
            "group min-w-0 transition-all duration-300",
            collapsed && !mobile
              ? "flex items-center justify-center"
              : "flex min-w-0 flex-1 items-center gap-3"
          )}
        >
          <BrandMark />

          {!collapsed || mobile ? (
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.96)]">
                AI HQ
              </div>
              <div className="mt-0.5 truncate text-[11px] font-medium text-[rgba(15,23,42,0.44)]">
                Operator workspace
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
        "overflow-hidden transition-all duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        collapsed
          ? "pointer-events-none max-h-0 opacity-0"
          : "max-h-10 opacity-100"
      )}
    >
      <div className="px-5 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-[rgba(15,23,42,0.34)]">
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
            "group relative flex items-center border-l-[3px] transition-all duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
            collapsed
              ? "mx-auto h-12 w-12 justify-center rounded-[12px] border-l-transparent"
              : "h-[52px] w-full gap-3 border-l-transparent pl-4 pr-5",
            isActive
              ? collapsed
                ? "bg-[linear-gradient(180deg,rgba(244,247,255,0.98)_0%,rgba(238,243,255,0.96)_100%)] text-[rgba(15,23,42,0.96)] shadow-[0_18px_32px_-26px_rgba(38,76,165,0.28)]"
                : "border-l-[rgba(64,118,255,0.96)] bg-[linear-gradient(90deg,rgba(242,246,255,0.96)_0%,rgba(242,246,255,0.68)_62%,rgba(242,246,255,0)_100%)] text-[rgba(15,23,42,0.96)]"
              : collapsed
                ? "text-[rgba(15,23,42,0.58)] hover:bg-[rgba(15,23,42,0.045)] hover:text-[rgba(15,23,42,0.9)]"
                : "text-[rgba(15,23,42,0.58)] hover:bg-[linear-gradient(90deg,rgba(15,23,42,0.035)_0%,rgba(15,23,42,0.02)_58%,rgba(15,23,42,0)_100%)] hover:text-[rgba(15,23,42,0.9)]"
          )}
        >
          {!collapsed && isActive ? (
            <span className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-[linear-gradient(90deg,rgba(242,246,255,0)_0%,rgba(242,246,255,0.78)_100%)]" />
          ) : null}

          <Icon
            className={cx(
              "relative z-[1] h-[18px] w-[18px] shrink-0 transition-colors duration-200",
              isActive
                ? "text-[rgba(38,76,165,0.98)]"
                : "text-[rgba(15,23,42,0.62)] group-hover:text-[rgba(15,23,42,0.9)]"
            )}
            strokeWidth={1.9}
          />

          {!collapsed ? (
            <div className="relative z-[1] min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold tracking-[-0.02em]">
                {item.label}
              </div>
            </div>
          ) : null}

          {!collapsed && badgeCount ? (
            <span
              className={cx(
                "relative z-[1] inline-flex min-w-[22px] items-center justify-center rounded-full px-2 py-[3px] text-[10px] font-semibold leading-none transition-colors duration-200",
                isActive
                  ? "bg-[rgba(38,76,165,0.1)] text-[rgba(38,76,165,0.92)]"
                  : "bg-[rgba(15,23,42,0.055)] text-[rgba(15,23,42,0.54)]"
              )}
            >
              {badgeCount}
            </span>
          ) : null}

          {collapsed && badgeCount ? (
            <span className="absolute right-[4px] top-[4px] inline-flex min-w-[17px] items-center justify-center rounded-full bg-[rgba(38,76,165,0.12)] px-1 text-[9px] font-semibold leading-4 text-[rgba(38,76,165,0.95)]">
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
    <div className="relative flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(252,253,255,0.985)_0%,rgba(247,249,252,0.985)_100%)]">
      <SidebarEdgeGlow />

      <BrandBlock
        collapsed={collapsed}
        mobile={mobile}
        onNavigate={onNavigate}
        onClose={onCloseMobile}
      />

      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto pt-5">
        <SidebarSection
          title="Operate"
          items={PRIMARY_SECTIONS}
          shellStats={shellStats}
          onNavigate={onNavigate}
          collapsed={collapsed}
        />

        <div
          className={cx(
            "mt-5 border-t border-[rgba(15,23,42,0.06)] pt-5",
            collapsed ? "mx-2" : "mx-5"
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
                "mt-5 border-t border-[rgba(15,23,42,0.06)] pt-5",
                collapsed ? "mx-2" : "mx-5"
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
            "mt-auto border-t border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(248,250,253,0)_0%,rgba(248,250,253,0.96)_28%,rgba(248,250,253,0.985)_100%)]",
            collapsed ? "px-2 py-3" : "px-5 py-4"
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
        className="fixed inset-y-0 left-0 z-[70] hidden overflow-hidden md:block"
        style={{
          width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
          transition:
            "width 460ms cubic-bezier(0.22,1,0.36,1), box-shadow 320ms ease",
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
            boxShadow: "0 22px 70px -28px rgba(15,23,42,0.3)",
          },
          mask: {
            backdropFilter: "blur(4px)",
            background: "rgba(15,23,42,0.24)",
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