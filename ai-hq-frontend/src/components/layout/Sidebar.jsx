import * as React from "react";
import { Badge, Button, Drawer } from "antd";
import { LogOut, PanelLeftClose } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { logoutUser } from "../../api/auth.js";
import { clearAppSessionContext } from "../../lib/appSession.js";
import { cx } from "../../lib/cx.js";
import {
  PRIMARY_SECTIONS,
  UTILITY_SECTIONS,
  getActiveShellSection,
} from "./shellNavigation.js";

const SIDEBAR_WIDTH = 304;
const SHELL_TOPBAR_HEIGHT = 76;

function formatBadgeCount(count) {
  if (typeof count !== "number" || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function NavItem({ item, shellStats = {}, compact = false, onNavigate }) {
  const Icon = item.icon;
  const badgeCount = formatBadgeCount(shellStats?.[item.badgeKey]);

  return (
    <NavLink to={item.to} onClick={onNavigate}>
      {({ isActive }) => (
        <div
          className={cx(
            "group flex items-start gap-3 rounded-[18px] border px-3.5 py-3 transition-all duration-200",
            isActive
              ? "border-brand/10 bg-brand-soft text-brand-strong shadow-panel"
              : "border-transparent bg-transparent text-text-muted hover:border-line-soft hover:bg-surface hover:text-text"
          )}
        >
          <div
            className={cx(
              "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border transition",
              isActive
                ? "border-brand/10 bg-surface text-brand"
                : "border-line-soft bg-surface-muted text-text-subtle group-hover:border-line group-hover:bg-surface"
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </div>

          {!compact ? (
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{item.label}</div>
                  <div className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-text-subtle">
                    {item.kicker}
                  </div>
                </div>
                {badgeCount ? (
                  <Badge
                    count={badgeCount}
                    className="[&_.ant-scroll-number]:!bg-brand [&_.ant-scroll-number]:!shadow-none"
                  />
                ) : null}
              </div>
              <div className="mt-2 text-xs leading-5 text-text-muted">
                {item.description}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </NavLink>
  );
}

function ActiveContextCard({ pathname }) {
  const section = getActiveShellSection(pathname);

  return (
    <div className="rounded-[20px] border border-line bg-surface p-4 shadow-panel">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-subtle">
        {section.kicker}
      </div>
      <div className="mt-2 font-display text-[1.35rem] font-semibold tracking-[-0.04em] text-text">
        {section.label}
      </div>
      <div className="mt-2 text-sm leading-6 text-text-muted">
        {section.description}
      </div>

      <div className="mt-4 space-y-2">
        {(section.contextGroups || []).slice(0, 2).map((group) => (
          <div key={group.title} className="rounded-[16px] border border-line-soft bg-surface-muted p-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-subtle">
              {group.title}
            </div>
            <div className="mt-2 space-y-1.5">
              {(group.items || []).slice(0, 3).map((item) => (
                <div key={item.label} className="text-sm text-text-muted">
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UtilityBar({ onNavigate }) {
  const [loggingOut, setLoggingOut] = React.useState(false);

  async function onLogout() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await logoutUser();
      clearAppSessionContext();
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("auth");
      localStorage.removeItem("authUser");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("auth");
      sessionStorage.removeItem("authUser");
      window.location.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      setLoggingOut(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-line-soft pt-4">
      {UTILITY_SECTIONS.map((item) => (
        <NavItem key={item.id} item={item} compact={false} onNavigate={onNavigate} />
      ))}

      <Button
        block
        size="large"
        icon={<LogOut className="h-4 w-4" />}
        className="!h-11 !justify-start !rounded-[16px] !border-line-soft !bg-transparent !px-4 !text-text-muted !shadow-none hover:!border-line hover:!bg-surface hover:!text-text"
        onClick={onLogout}
        disabled={loggingOut}
      >
        {loggingOut ? "Signing out..." : "Sign out"}
      </Button>
    </div>
  );
}

function SidebarContent({ pathname, shellStats, onNavigate }) {
  return (
    <div className="flex h-full flex-col gap-5 px-5 py-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,#1f3b68_0%,#101828_100%)] text-white shadow-panel">
          <PanelLeftClose className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-subtle">
            AI HQ
          </div>
          <div className="font-display text-[1.1rem] font-semibold tracking-[-0.04em] text-text">
            Operator Suite
          </div>
        </div>
      </div>

      <ActiveContextCard pathname={pathname} />

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-subtle">
          Primary
        </div>
        {PRIMARY_SECTIONS.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            shellStats={shellStats}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <UtilityBar onNavigate={onNavigate} />
    </div>
  );
}

export default function Sidebar({
  mobileOpen,
  setMobileOpen,
  shellStats = {},
}) {
  const { pathname } = useLocation();

  return (
    <>
      <aside
        className="fixed inset-y-0 left-0 z-[70] hidden border-r border-line-soft bg-canvas/80 backdrop-blur-xl md:block"
        style={{ width: SIDEBAR_WIDTH }}
      >
        <SidebarContent pathname={pathname} shellStats={shellStats} />
      </aside>

      <Drawer
        placement="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        width={Math.min(SIDEBAR_WIDTH, 320)}
        closeIcon={null}
        styles={{
          body: { padding: 0 },
          header: { display: "none" },
          content: { background: "rgb(var(--color-canvas))" },
        }}
      >
        <SidebarContent
          pathname={pathname}
          shellStats={shellStats}
          onNavigate={() => setMobileOpen(false)}
        />
      </Drawer>
    </>
  );
}

export { SIDEBAR_WIDTH, SHELL_TOPBAR_HEIGHT };
