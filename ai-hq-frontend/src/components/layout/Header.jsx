import { Dropdown } from "antd";
import {
  Bell,
  ChevronDown,
  LayoutGrid,
  LogOut,
  Menu,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

function HeaderMenuRow({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex h-10 w-full items-center gap-3 rounded-[8px] px-3 text-left transition-colors duration-200",
        danger
          ? "text-danger hover:bg-[rgba(var(--color-danger),0.06)]"
          : "text-[rgba(15,23,42,0.82)] hover:bg-[rgba(15,23,42,0.045)]"
      )}
    >
      <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.9} />
      <span className="truncate text-[13px] font-semibold tracking-[-0.02em]">
        {label}
      </span>
    </button>
  );
}

function WorkspaceControl({ notifications }) {
  const navigate = useNavigate();
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

  function closeThen(fn) {
    setOpen(false);
    fn?.();
  }

  const unread =
    typeof notifications?.unreadCount === "number"
      ? notifications.unreadCount
      : 0;

  const displayName = session.workspaceName || session.actorName || "Workspace";
  const roleLabel = session.role || "Operator";
  const initials = useMemo(() => getInitials(displayName) || "W", [displayName]);

  const overlay = (
    <div className="dropdown-panel-anim w-[260px] rounded-[12px] border border-[rgba(15,23,42,0.08)] bg-white p-2 shadow-[0_24px_48px_-30px_rgba(15,23,42,0.18)]">
      <div className="px-2.5 pb-2 pt-1.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-brand))] text-[11px] font-semibold text-white">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.95)]">
              {displayName}
            </div>
            <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgba(15,23,42,0.42)]">
              {roleLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-2 my-1 h-px bg-[rgba(15,23,42,0.07)]" />

      <div className="px-1 py-1">
        <HeaderMenuRow
          icon={Bell}
          label={
            unread > 0
              ? `Notifications (${unread > 99 ? "99+" : unread})`
              : "Notifications"
          }
          onClick={() =>
            closeThen(() => notifications?.setOpen?.(!notifications?.open))
          }
        />

        <HeaderMenuRow
          icon={LayoutGrid}
          label="Workspace"
          onClick={() => closeThen(() => navigate("/workspace"))}
        />
      </div>

      <div className="mx-2 my-1 h-px bg-[rgba(15,23,42,0.07)]" />

      <div className="px-1 pb-1 pt-1">
        <HeaderMenuRow
          icon={LogOut}
          label={loggingOut ? "Signing out..." : "Sign out"}
          onClick={handleLogout}
          danger
        />
      </div>
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
          "group flex h-10 items-center gap-3 rounded-[8px] px-2.5 py-2 text-left transition-colors duration-200",
          open ? "bg-[rgba(15,23,42,0.05)]" : "hover:bg-[rgba(15,23,42,0.045)]"
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-brand))] text-[11px] font-semibold text-white">
          {initials}
        </div>

        <div className="hidden min-w-0 text-left lg:block">
          <div className="truncate text-[13px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.94)]">
            {displayName}
          </div>
          <div className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-[rgba(15,23,42,0.42)]">
            {roleLabel}
          </div>
        </div>

        <ChevronDown
          className={cx(
            "h-[13px] w-[13px] text-[rgba(15,23,42,0.42)] transition-transform duration-200",
            open ? "rotate-180" : ""
          )}
          strokeWidth={2}
        />
      </button>
    </Dropdown>
  );
}

export default function Header({
  onMenuClick,
  notifications,
}) {
  return (
    <>
      <header
        className="sticky top-0 z-[60] border-b border-[rgba(15,23,42,0.06)] bg-white"
        style={{ height: SHELL_TOPBAR_HEIGHT }}
      >
        <div className="mx-auto flex h-full max-w-shell-content items-center justify-between gap-5 px-4 md:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onMenuClick}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] text-[rgba(15,23,42,0.56)] transition-colors duration-200 hover:bg-[rgba(15,23,42,0.05)] hover:text-[rgba(15,23,42,0.9)] md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-[16px] w-[16px]" strokeWidth={2} />
            </button>

            <div className="hidden md:block text-[12px] font-semibold uppercase tracking-[0.14em] text-[rgba(15,23,42,0.34)]">
              AI HQ
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CommandMenu />
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