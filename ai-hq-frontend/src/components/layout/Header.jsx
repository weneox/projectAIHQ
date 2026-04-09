import { Dropdown } from "antd";
import { Bell, ChevronDown, Menu } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { logoutUser } from "../../api/auth.js";
import {
  clearAppSessionContext,
  getAppSessionContext,
} from "../../lib/appSession.js";
import { cx } from "../../lib/cx.js";
import CommandMenu from "./CommandMenu.jsx";
import NotificationsPanel from "./NotificationsPanel.jsx";
import { SHELL_TOPBAR_HEIGHT } from "./Sidebar.jsx";

function getInitials(value = "") {
  return String(value)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function WorkspaceControl({ notifications }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [session, setSession] = useState({
    actorName: "",
    workspaceName: "Workspace",
    role: "",
  });

  useEffect(() => {
    let alive = true;

    getAppSessionContext()
      .then((auth) => {
        if (!alive) return;

        setSession({
          actorName: String(auth?.actorName || "").trim(),
          workspaceName: String(
            auth?.bootstrap?.workspace?.companyName ||
              auth?.auth?.tenant?.company_name ||
              "Workspace"
          ).trim(),
          role: String(auth?.viewerRole || "").trim(),
        });
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  async function handleLogout() {
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

  const unread =
    typeof notifications?.unreadCount === "number"
      ? notifications.unreadCount
      : 0;

  const displayName = session.workspaceName || session.actorName || "Workspace";
  const roleLabel = session.role || "Operator";
  const initials = useMemo(() => getInitials(displayName) || "W", [displayName]);

  const overlay = (
    <div className="dropdown-panel-anim w-[240px] rounded-panel border border-line bg-surface p-2 shadow-panel-strong">
      <div className="px-2 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface-subtle text-[12px] font-semibold text-text">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-text">
              {displayName}
            </div>
            <div className="truncate text-[12px] text-text-muted">
              {roleLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-2 my-1 h-px bg-line-soft" />

      <button
        type="button"
        onClick={() => {
          setOpen(false);
          notifications?.setOpen?.(!notifications?.open);
        }}
        className="flex h-9 w-full items-center justify-between rounded-soft px-3 text-left text-[13px] text-text hover:bg-surface-subtle"
      >
        <span>Notifications</span>
        <span className="text-[12px] text-text-muted">
          {unread > 99 ? "99+" : unread}
        </span>
      </button>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-1 flex h-9 w-full items-center rounded-soft px-3 text-left text-[13px] text-danger hover:bg-danger-soft"
      >
        {loggingOut ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );

  return (
    <Dropdown
      trigger={["click"]}
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      dropdownRender={() => overlay}
    >
      <button
        type="button"
        aria-label={displayName}
        aria-expanded={open}
        className={cx(
          "flex h-9 items-center gap-2 rounded-soft border border-line bg-surface px-2.5 text-left hover:bg-surface-subtle",
          open && "bg-surface-subtle"
        )}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface-subtle text-[11px] font-semibold text-text">
          {initials}
        </div>

        <div className="hidden min-w-0 text-left lg:block">
          <div className="truncate text-[13px] font-medium text-text">
            {displayName}
          </div>
          <div className="truncate text-[12px] text-text-muted">
            {roleLabel}
          </div>
        </div>

        <ChevronDown
          className={cx(
            "h-[14px] w-[14px] text-text-subtle transition-transform",
            open && "rotate-180"
          )}
          strokeWidth={2}
        />
      </button>
    </Dropdown>
  );
}

function NotificationsButton({ notifications }) {
  const unread =
    typeof notifications?.unreadCount === "number"
      ? notifications.unreadCount
      : 0;

  return (
    <button
      type="button"
      onClick={() => notifications?.setOpen?.(!notifications?.open)}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-soft border border-line bg-surface text-text-muted hover:bg-surface-subtle hover:text-text"
      aria-label="Open notifications"
    >
      <Bell className="h-4 w-4" strokeWidth={1.9} />
      {unread > 0 ? (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand" />
      ) : null}
    </button>
  );
}

export default function Header({ onMenuClick, notifications }) {
  return (
    <>
      <header
        className="sticky top-0 z-[60] border-b border-line-soft bg-surface"
        style={{ height: SHELL_TOPBAR_HEIGHT }}
      >
        <div className="mx-auto flex h-full max-w-shell-content items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onMenuClick}
              className="inline-flex h-9 w-9 items-center justify-center rounded-soft border border-line bg-surface text-text-muted hover:bg-surface-subtle hover:text-text md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" strokeWidth={2} />
            </button>

            <div className="hidden md:block">
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                AI HQ
              </div>
              <div className="text-[13px] text-text-muted">
                Backend-facing shell
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CommandMenu />
            <NotificationsButton notifications={notifications} />
            <WorkspaceControl notifications={notifications} />
          </div>
        </div>
      </header>

      <NotificationsPanel
        open={notifications?.open}
        onClose={() => notifications?.setOpen?.(false)}
        notifications={notifications?.notifications}
        unreadCount={notifications?.unreadCount}
        loading={notifications?.loading}
        refreshing={notifications?.refreshing}
        error={notifications?.error}
        unavailable={notifications?.unavailable}
        savingId={notifications?.savingId}
        onRefresh={notifications?.refresh}
        onMarkRead={notifications?.markRead}
      />
    </>
  );
}
