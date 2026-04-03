import * as React from "react";
import { Badge, Button, Drawer } from "antd";
import { LogOut, Sparkles } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { logoutUser } from "../../api/auth.js";
import { clearAppSessionContext } from "../../lib/appSession.js";
import { cx } from "../../lib/cx.js";
import {
  PRIMARY_SECTIONS,
  SECONDARY_SECTIONS,
  UTILITY_SECTIONS,
} from "./shellNavigation.js";

const SIDEBAR_WIDTH = 280;
const SHELL_TOPBAR_HEIGHT = 76;

function formatBadgeCount(count) {
  if (typeof count !== "number" || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function NavItem({ item, shellStats = {}, onNavigate }) {
  const Icon = item.icon;
  const badgeCount = formatBadgeCount(shellStats?.[item.badgeKey]);

  return (
    <NavLink to={item.to} onClick={onNavigate}>
      {({ isActive }) => (
        <div
          className={cx(
            "group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-150",
            isActive
              ? "bg-brand-soft text-brand-strong"
              : "text-text-muted hover:bg-surface-muted hover:text-text"
          )}
        >
          <div
            className={cx(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-sm transition-colors duration-150",
              isActive
                ? "bg-surface text-brand"
                : "text-text-subtle group-hover:bg-surface group-hover:text-text"
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.9} />
          </div>

          <div className="min-w-0 flex flex-1 items-center justify-between gap-3">
            <div className="truncate text-sm font-medium">{item.label}</div>
            {badgeCount ? (
              <Badge
                count={badgeCount}
                className="[&_.ant-scroll-number]:!bg-brand [&_.ant-scroll-number]:!shadow-none"
              />
            ) : null}
          </div>
        </div>
      )}
    </NavLink>
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
    <div className="space-y-1 border-t border-line-soft pt-4">
      {UTILITY_SECTIONS.map((item) => (
        <NavItem key={item.id} item={item} onNavigate={onNavigate} />
      ))}

      <Button
        block
        size="large"
        icon={<LogOut className="h-4 w-4" />}
        className="!h-10 !justify-start !rounded-md !border-0 !bg-transparent !px-3 !text-text-muted !shadow-none hover:!bg-surface-muted hover:!text-text"
        onClick={onLogout}
        disabled={loggingOut}
      >
        {loggingOut ? "Signing out..." : "Sign out"}
      </Button>
    </div>
  );
}

function SidebarContent({ shellStats, onNavigate }) {
  return (
    <div className="flex h-full flex-col gap-5 px-4 py-4">
      <div className="flex items-center gap-3 px-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-brand-soft text-brand">
          <Sparkles className="h-4 w-4" strokeWidth={1.9} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text">AI HQ</div>
          <div className="text-xs text-text-muted">Launch slice</div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        <div className="space-y-1">
          <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
            Launch product
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

        <div className="space-y-1 border-t border-line-soft pt-4">
          <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
            Support and backoffice
          </div>
          {SECONDARY_SECTIONS.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              shellStats={shellStats}
              onNavigate={onNavigate}
            />
          ))}
        </div>
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
  useLocation();

  return (
    <>
      <aside
        className="fixed inset-y-0 left-0 z-[70] hidden border-r border-line-soft bg-canvas md:block"
        style={{ width: SIDEBAR_WIDTH }}
      >
        <SidebarContent shellStats={shellStats} />
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
          shellStats={shellStats}
          onNavigate={() => setMobileOpen(false)}
        />
      </Drawer>
    </>
  );
}

export { SIDEBAR_WIDTH, SHELL_TOPBAR_HEIGHT };
