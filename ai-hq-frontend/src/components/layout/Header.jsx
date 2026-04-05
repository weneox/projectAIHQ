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

function HeaderMenuRow({
  icon: Icon,
  label,
  sublabel,
  onClick,
  danger = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left transition",
        danger
          ? "text-danger hover:bg-[rgba(var(--color-danger),0.06)]"
          : "text-text hover:bg-surface-muted"
      )}
    >
      <div
        className={cx(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]",
          danger
            ? "bg-[rgba(var(--color-danger),0.08)] text-danger"
            : "bg-[rgba(15,23,42,0.04)] text-text-subtle"
        )}
      >
        <Icon className="h-[14px] w-[14px]" strokeWidth={1.9} />
      </div>

      <div className="min-w-0 flex-1">
        <div
          className={cx(
            "truncate text-[13px] tracking-[-0.02em]",
            danger ? "font-semibold text-danger" : "font-medium text-text"
          )}
        >
          {label}
        </div>

        {sublabel ? (
          <div className="mt-0.5 truncate text-[11px] text-text-subtle">
            {sublabel}
          </div>
        ) : null}
      </div>
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
    <div className="w-[296px] rounded-[18px] border border-line-soft bg-surface p-2 shadow-[0_30px_60px_-36px_rgba(15,23,42,0.22)]">
      <div className="rounded-[15px] bg-surface-subtle px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-brand text-[12px] font-semibold text-white">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-text">
              {displayName}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-text-subtle">
              {roleLabel}
            </div>
          </div>

          {unread > 0 ? (
            <div className="rounded-[9px] bg-surface px-2 py-1 text-[10px] font-semibold text-text">
              {unread > 99 ? "99+" : unread}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-2 space-y-1">
        <HeaderMenuRow
          icon={Bell}
          label="Notifications"
          sublabel={
            unread > 0
              ? `${unread > 99 ? "99+" : unread} unread updates`
              : "No unread notifications"
          }
          onClick={() =>
            closeThen(() => notifications?.setOpen?.(!notifications?.open))
          }
        />

        <HeaderMenuRow
          icon={LayoutGrid}
          label="Workspace"
          sublabel="Open the operator workspace"
          onClick={() => closeThen(() => navigate("/workspace"))}
        />
      </div>

      <div className="mt-2 border-t border-line-soft pt-2">
        <HeaderMenuRow
          icon={LogOut}
          label={loggingOut ? "Signing out..." : "Sign out"}
          sublabel="Leave this workspace"
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
        className="group flex h-11 items-center gap-2 rounded-[14px] border border-line-soft bg-surface px-2.5 pr-3 transition hover:bg-surface-muted"
        aria-label={displayName}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-brand text-[11px] font-semibold text-white">
          {initials}
        </div>

        <div className="hidden min-w-0 md:block">
          <div className="truncate text-[12px] font-semibold tracking-[-0.02em] text-text">
            {displayName}
          </div>
          <div className="truncate text-[10px] uppercase tracking-[0.14em] text-text-subtle">
            {roleLabel}
          </div>
        </div>

        <ChevronDown
          className={cx(
            "h-[13px] w-[13px] text-text-subtle transition-transform duration-200",
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
  shellSection,
  activeContextItem,
}) {
  const title = activeContextItem?.label || shellSection?.label || "AI HQ";
  const subtitle =
    activeContextItem?.label &&
    activeContextItem.label !== shellSection?.label
      ? shellSection?.label
      : shellSection?.description;

  return (
    <>
      <header
        className="sticky top-0 z-[60] border-b border-line-soft bg-surface"
        style={{ height: SHELL_TOPBAR_HEIGHT }}
      >
        <div className="mx-auto flex h-full max-w-shell-content items-center justify-between gap-4 px-5 md:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onMenuClick}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-line-soft bg-surface text-text-muted transition hover:bg-surface-muted hover:text-text md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-[15px] w-[15px]" strokeWidth={2} />
            </button>

            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold tracking-[-0.03em] text-text">
                {title}
              </div>

              {subtitle ? (
                <div className="mt-0.5 hidden truncate text-[12px] text-text-subtle md:block">
                  {subtitle}
                </div>
              ) : null}
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