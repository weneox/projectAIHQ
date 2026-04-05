import * as React from "react";
import { Drawer, Tooltip } from "antd";
import { NavLink } from "react-router-dom";
import { Building2 } from "lucide-react";
import { cx } from "../../lib/cx.js";
import {
  PRIMARY_SECTIONS,
  SECONDARY_SECTIONS,
  UTILITY_SECTIONS,
} from "./shellNavigation.js";

const SIDEBAR_WIDTH = 226;
const MOBILE_DRAWER_WIDTH = 286;
const SHELL_TOPBAR_HEIGHT = 64;

function formatBadgeCount(count) {
  if (typeof count !== "number" || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function BrandBlock({ onNavigate }) {
  return (
    <NavLink
      to="/home"
      onClick={onNavigate}
      className="block rounded-[14px] px-2 py-2 transition hover:bg-surface-subtle"
      aria-label="AI HQ Home"
    >
      <div className="flex items-center gap-3">
        <Building2
          className="h-[18px] w-[18px] shrink-0 text-brand"
          strokeWidth={1.9}
        />

        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold tracking-[-0.03em] text-text">
            AI HQ
          </div>
          <div className="mt-0.5 truncate text-[11px] text-text-subtle">
            Operator workspace
          </div>
        </div>
      </div>
    </NavLink>
  );
}

function NavDivider() {
  return <div className="my-4 border-t border-line-soft" />;
}

function NavItem({ item, shellStats = {}, onNavigate }) {
  const Icon = item.icon;
  const badgeCount = formatBadgeCount(shellStats?.[item.badgeKey]);

  const content = (
    <NavLink to={item.to} onClick={onNavigate}>
      {({ isActive }) => (
        <div
          className={cx(
            "group flex h-11 items-center gap-3 rounded-[14px] px-3 transition-all duration-200 ease-premium",
            isActive
              ? "bg-brand text-white shadow-[0_18px_34px_-24px_rgba(var(--color-brand),0.72)]"
              : "text-text-muted hover:bg-surface-muted hover:text-text"
          )}
        >
          <Icon
            className="h-[18px] w-[18px] shrink-0"
            strokeWidth={1.9}
          />

          <div className="min-w-0 flex-1">
            <div
              className={cx(
                "truncate text-[13.5px] tracking-[-0.02em]",
                isActive ? "font-semibold text-white" : "font-medium"
              )}
            >
              {item.label}
            </div>
          </div>

          {badgeCount ? (
            <div
              className={cx(
                "min-w-[18px] text-right text-[11px] font-semibold leading-none",
                isActive ? "text-white/88" : "text-text-subtle"
              )}
            >
              {badgeCount}
            </div>
          ) : null}
        </div>
      )}
    </NavLink>
  );

  return (
    <Tooltip title={item.label} placement="right" mouseEnterDelay={0.35}>
      {content}
    </Tooltip>
  );
}

function SidebarSection({ items, shellStats, onNavigate }) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <NavItem
          key={item.id}
          item={item}
          shellStats={shellStats}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

function SidebarContent({ shellStats, onNavigate }) {
  const utilityItems = Array.isArray(UTILITY_SECTIONS) ? UTILITY_SECTIONS : [];

  return (
    <div className="flex h-full flex-col bg-surface px-4 py-4">
      <BrandBlock onNavigate={onNavigate} />

      <div className="mt-5 flex-1 overflow-y-auto pr-1">
        <SidebarSection
          items={PRIMARY_SECTIONS}
          shellStats={shellStats}
          onNavigate={onNavigate}
        />

        <NavDivider />

        <SidebarSection
          items={SECONDARY_SECTIONS}
          shellStats={shellStats}
          onNavigate={onNavigate}
        />

        {utilityItems.length ? (
          <>
            <NavDivider />
            <SidebarSection
              items={utilityItems}
              shellStats={shellStats}
              onNavigate={onNavigate}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function Sidebar({
  mobileOpen,
  setMobileOpen,
  shellStats = {},
}) {
  return (
    <>
      <aside
        className="fixed inset-y-0 left-0 z-[70] hidden border-r border-line-soft bg-surface md:block"
        style={{ width: SIDEBAR_WIDTH }}
      >
        <SidebarContent shellStats={shellStats} />
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
            borderRight: "1px solid rgb(var(--color-line-soft, var(--color-line)))",
          },
        }}
      >
        <SidebarContent
          shellStats={shellStats}
          onNavigate={() => setMobileOpen(false)}
        />
      </Drawer>
    </>
  );
}

export { SIDEBAR_WIDTH, SHELL_TOPBAR_HEIGHT };