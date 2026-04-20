import { Dropdown } from "antd";
import { Bell, ChevronDown, Menu, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { logoutUser } from "../../api/auth.js";
import {
  clearAppSessionContext,
  getAppSessionContext,
} from "../../lib/appSession.js";
import { cx } from "../../lib/cx.js";
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

function AskAiButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent("aihq:open-assistant", {
            detail: { mode: "setup" },
          })
        );
      }}
      className="inline-flex h-9 items-center gap-2 rounded-[14px] border border-white/55 bg-white/70 px-3 text-[12px] font-semibold tracking-[-0.01em] text-text shadow-[0_12px_30px_-24px_rgba(15,23,42,0.5),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur transition-[border-color,background-color,color,box-shadow] duration-base ease-premium hover:border-white/75 hover:bg-white/92"
      aria-label="Open Ask AI"
    >
      <Sparkles className="h-[15px] w-[15px]" strokeWidth={1.95} />
      <span className="hidden sm:inline">Ask AI</span>
    </button>
  );
}

function WorkspaceControl({ notifications, workspaceMeta }) {
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

  const displayName =
    String(workspaceMeta?.workspaceName || "").trim() ||
    session.workspaceName ||
    session.actorName ||
    "Workspace";

  const roleLabel =
    String(workspaceMeta?.userName || "").trim() || session.role || "";

  const initials = useMemo(() => getInitials(displayName) || "W", [displayName]);

  const overlay = (
    <div className="dropdown-panel-anim w-[244px] rounded-[20px] border border-white/70 bg-white/92 p-2 shadow-[0_24px_64px_-32px_rgba(15,23,42,0.32),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl">
      <div className="px-2 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-line-soft bg-surface text-[12px] font-semibold text-text shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-text">
              {displayName}
            </div>
            {roleLabel ? (
              <div className="truncate pt-0.5 text-[11px] text-text-subtle">
                {roleLabel}
              </div>
            ) : null}
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
        className="flex h-10 w-full items-center justify-between rounded-[14px] px-3 text-left text-[13px] font-medium text-text transition-colors hover:bg-surface-subtle"
      >
        <span>Notifications</span>
        <span className="text-[12px] text-text-subtle">
          {unread > 99 ? "99+" : unread}
        </span>
      </button>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-1 flex h-10 w-full items-center rounded-[14px] px-3 text-left text-[13px] font-medium text-danger transition-colors hover:bg-danger-soft"
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
          "flex h-9 items-center gap-2 rounded-[14px] border border-transparent px-1.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition-[border-color,background-color,color,box-shadow] duration-base ease-premium",
          open
            ? "border-white/65 bg-white/72 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.45),inset_0_1px_0_rgba(255,255,255,0.78)]"
            : "hover:border-white/45 hover:bg-white/56"
        )}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-[12px] border border-white/55 bg-white/74 text-[11px] font-semibold text-text shadow-[0_10px_24px_-22px_rgba(15,23,42,0.5),inset_0_1px_0_rgba(255,255,255,0.82)]">
          {initials}
        </div>

        <div className="hidden min-w-0 text-left lg:block">
          <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-text">
            {displayName}
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
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-[14px] border border-transparent bg-transparent text-text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition-[border-color,background-color,color,box-shadow] duration-base ease-premium hover:border-white/45 hover:bg-white/56 hover:text-text"
      aria-label="Open notifications"
    >
      <Bell className="h-[15px] w-[15px]" strokeWidth={1.95} />
      {unread > 0 ? (
        <span className="absolute right-[7px] top-[7px] h-2 w-2 rounded-full bg-brand" />
      ) : null}
    </button>
  );
}

export default function Header({ onMenuClick, notifications, workspaceMeta }) {
  return (
    <>
      <header
        className="sticky top-0 z-[60]"
        style={{ height: SHELL_TOPBAR_HEIGHT }}
      >
        <div className="mx-auto flex h-full max-w-shell-content items-center justify-between gap-3 px-3.5 md:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onMenuClick}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[14px] border border-transparent bg-transparent text-text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition-[border-color,background-color,color,box-shadow] duration-base ease-premium hover:border-white/45 hover:bg-white/56 hover:text-text md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-[15px] w-[15px]" strokeWidth={2} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <AskAiButton />
            <NotificationsButton notifications={notifications} />
            <WorkspaceControl
              notifications={notifications}
              workspaceMeta={workspaceMeta}
            />
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
