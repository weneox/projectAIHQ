import { Avatar, Badge, Button } from "antd";
import { Bell, Menu } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAppSessionContext } from "../../lib/appSession.js";
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

function NotificationButton({ notifications }) {
  const unread =
    typeof notifications?.unreadCount === "number"
      ? notifications.unreadCount
      : 0;

  return (
    <Badge
      count={unread > 99 ? "99+" : unread}
      size="small"
      offset={[-4, 6]}
      className="[&_.ant-scroll-number]:!bg-brand [&_.ant-scroll-number]:!shadow-none"
    >
      <Button
        type="text"
        size="large"
        aria-label="Open notifications"
        className={cx(
          "!flex !h-10 !w-10 !items-center !justify-center !rounded-md !border !border-line !bg-surface !p-0 !text-text-muted !shadow-none",
          notifications?.open
            ? "!border-line-strong !bg-surface-muted !text-text"
            : "hover:!border-line-strong hover:!bg-surface-muted hover:!text-text"
        )}
        onClick={() => notifications?.setOpen?.(!notifications?.open)}
      >
        <Bell className="h-4 w-4" strokeWidth={1.9} />
      </Button>
    </Badge>
  );
}

function WorkspaceIdentity() {
  const navigate = useNavigate();
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
      .catch(() => {
        if (!alive) return;
      });

    return () => {
      alive = false;
    };
  }, []);

  const displayName = session.actorName || session.workspaceName || "Workspace";
  const initials = useMemo(() => getInitials(displayName) || "W", [displayName]);

  return (
    <button
      type="button"
      onClick={() => navigate("/settings")}
      className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 text-left transition hover:border-line-strong hover:bg-surface-muted"
      aria-label="Open account settings"
    >
      <Avatar className="!bg-brand !text-white">{initials}</Avatar>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-text">{displayName}</div>
        <div className="truncate text-xs text-text-muted">
          {session.role ? session.role.replace(/_/g, " ") : session.workspaceName}
        </div>
      </div>
    </button>
  );
}

export default function Header({
  onMenuClick,
  notifications,
  shellSection,
  activeContextItem,
}) {
  const headerKicker =
    shellSection?.id === "home"
      ? "Product home"
      : activeContextItem?.label || shellSection?.kicker || "Workspace";
  const headerTitle =
    shellSection?.id === "home" ? "Overview" : shellSection?.label || "Workspace";

  return (
    <>
      <header
        className="sticky top-0 z-[60] border-b border-line-soft bg-canvas"
        style={{ height: SHELL_TOPBAR_HEIGHT }}
      >
        <div className="mx-auto flex h-full max-w-shell-content items-center justify-between gap-4 px-4 md:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="text"
              size="large"
              onClick={onMenuClick}
              className="!flex !h-10 !w-10 !items-center !justify-center !rounded-md !border !border-line !bg-surface !p-0 !text-text-muted !shadow-none hover:!border-line-strong hover:!bg-surface-muted hover:!text-text md:!hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" strokeWidth={1.9} />
            </Button>

            <div className="min-w-0">
              <div className="text-sm text-text-muted">
                {headerKicker}
              </div>
              <div className="truncate font-display text-[1.75rem] font-semibold tracking-[-0.03em] text-text">
                {headerTitle}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CommandMenu />
            <NotificationButton notifications={notifications} />
            <WorkspaceIdentity />
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
