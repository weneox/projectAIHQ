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
        "flex w-full items-center gap-3 rounded-[10px] border px-3 py-3 text-left transition",
        danger
          ? "border-[rgba(var(--color-danger),0.14)] bg-[rgba(var(--color-danger),0.04)] text-danger hover:bg-[rgba(var(--color-danger),0.08)]"
          : "border-transparent text-text hover:border-line hover:bg-surface-muted"
      )}
    >
      <div
        className={cx(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border",
          danger
            ? "border-[rgba(var(--color-danger),0.12)] bg-[rgba(var(--color-danger),0.08)] text-danger"
            : "border-line bg-surface text-text-muted"
        )}
      >
        <Icon className="h-[14px] w-[14px]" strokeWidth={1.9} />
      </div>

      <div className="min-w-0 flex-1">
        <div
          className={cx(
            "truncate text-[13px] font-semibold tracking-[-0.02em]",
            danger ? "text-danger" : "text-text"
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
    <div className="w-[296px] rounded-[14px] border border-line bg-surface p-2 shadow-[0_18px_48px_rgba(15,23,38,0.08)]">
      <div className="rounded-[12px] border border-line bg-surface-muted px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-brand text-[12px] font-semibold text-white">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-text">
              {displayName}
            </div>
            <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.14em] text-text-subtle">
              {roleLabel}
            </div>
          </div>

          {unread > 0 ? (
            <div className="rounded-[8px] border border-line bg-surface px-2 py-1 text-[10px] font-semibold text-text">
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
          sublabel="Open the full operator workspace"
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
        className="group flex h-10 items-center gap-3 rounded-[12px] border border-line bg-surface px-2.5 pr-3 transition hover:border-line-strong hover:bg-surface-muted"
        aria-label={displayName}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand text-[11px] font-semibold text-white">
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

        {unread > 0 ? (
          <div className="hidden rounded-[8px] border border-line bg-surface px-1.5 py-1 text-[10px] font-semibold text-text md:inline-flex">
            {unread > 99 ? "99+" : unread}
          </div>
        ) : null}

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
  const subtitle =
    activeContextItem?.label &&
    activeContextItem.label !== shellSection?.label
      ? activeContextItem.label
      : shellSection?.description;

  return (
    <>
      <header
        className="sticky top-0 z-[60] border-b border-line bg-[rgba(255,255,255,0.86)] backdrop-blur-[10px]"
        style={{ height: SHELL_TOPBAR_HEIGHT }}
      >
        <div className="mx-auto flex h-full max-w-shell-content items-center justify-between gap-4 px-4 md:px-5 xl:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onMenuClick}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-line bg-surface text-text-muted transition hover:border-line-strong hover:bg-surface-muted hover:text-text md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-[15px] w-[15px]" strokeWidth={2} />
            </button>

            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                {shellSection?.kicker || "Workspace"}
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <div className="truncate text-[15px] font-semibold tracking-[-0.03em] text-text">
                  {shellSection?.label || "AI HQ"}
                </div>
                {subtitle ? (
                  <div className="hidden truncate text-[12px] text-text-muted md:block">
                    {subtitle}
                  </div>
                ) : null}
              </div>
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
