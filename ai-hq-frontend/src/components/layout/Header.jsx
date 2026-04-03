import { Avatar, Badge, Button, Dropdown } from "antd";
import {
  Bell,
  ChevronDown,
  LayoutGrid,
  LogOut,
  Menu,
  Radar,
  Settings2,
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
  trailing = null,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition",
        danger
          ? "text-danger hover:bg-danger-soft"
          : "text-text hover:bg-surface-muted"
      )}
    >
      <div
        className={cx(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] border",
          danger
            ? "border-danger/10 bg-danger-soft text-danger"
            : "border-line bg-surface text-text-muted"
        )}
      >
        <Icon className="h-[14px] w-[14px]" strokeWidth={1.95} />
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

      {trailing ? <div className="shrink-0">{trailing}</div> : null}
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
    <div className="w-[280px] rounded-[18px] border border-line bg-surface p-2 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
      <div className="rounded-[14px] bg-surface-muted px-3 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="!flex !h-9 !w-9 !items-center !justify-center !bg-brand !text-white">
            {initials}
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-text">
              {displayName}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-text-subtle">
              {roleLabel}
            </div>
          </div>

          {unread > 0 ? (
            <div className="rounded-full bg-brand-soft px-2 py-1 text-[10px] font-semibold text-brand">
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
          sublabel="Open operator workspace"
          onClick={() => closeThen(() => navigate("/workspace"))}
        />

        <HeaderMenuRow
          icon={Settings2}
          label="Settings"
          sublabel="Manage workspace settings"
          onClick={() => closeThen(() => navigate("/settings"))}
        />

        <HeaderMenuRow
          icon={Radar}
          label="Expert"
          sublabel="Open expert tools"
          onClick={() => closeThen(() => navigate("/expert"))}
        />
      </div>

      <div className="my-2 h-px bg-line-soft" />

      <HeaderMenuRow
        icon={LogOut}
        label={loggingOut ? "Signing out..." : "Sign out"}
        sublabel="Leave this workspace"
        onClick={handleLogout}
        danger
      />
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
        className="group flex h-8 items-center gap-1 rounded-full px-0.5 transition hover:bg-surface-muted"
        aria-label="Open workspace menu"
      >
        <Badge
          dot={unread > 0}
          offset={[-2, 3]}
          className="[&_.ant-badge-dot]:!bg-brand"
        >
          <Avatar className="!flex !h-8 !w-8 !items-center !justify-center !bg-brand !text-[11px] !text-white">
            {initials}
          </Avatar>
        </Badge>

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

export default function Header({ onMenuClick, notifications }) {
  return (
    <>
      <header
        className="sticky top-0 z-[60] border-b border-line bg-surface"
        style={{ height: SHELL_TOPBAR_HEIGHT }}
      >
        <div className="mx-auto flex h-full max-w-shell-content items-center justify-between gap-2 px-2.5 md:px-3 xl:px-4">
          <div className="flex min-w-[28px] items-center">
            <Button
              type="text"
              size="large"
              onClick={onMenuClick}
              className="!flex !h-8 !w-8 !items-center !justify-center !rounded-[11px] !border !border-line !bg-surface !p-0 !text-text-muted !shadow-none hover:!border-line-strong hover:!bg-surface-muted hover:!text-text md:!hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-[15px] w-[15px]" strokeWidth={2} />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <div className="[&>*]:scale-[0.82] [&>*]:origin-right">
              <CommandMenu />
            </div>
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