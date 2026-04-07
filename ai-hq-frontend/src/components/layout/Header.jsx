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

function resolveHeaderMeta({ shellSection, activeContextItem }) {
  const title = activeContextItem?.label || shellSection?.label || "AI HQ";
  const subtitle =
    activeContextItem?.label &&
    activeContextItem.label !== shellSection?.label
      ? shellSection?.label
      : shellSection?.description;

  if (title === "Home") {
    return {
      title: "Home",
      subtitle: "Operator overview and active surfaces",
    };
  }

  return {
    title,
    subtitle: subtitle || "",
  };
}

function HeaderMenuRow({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group flex h-11 w-full items-center gap-3 rounded-[14px] px-3 text-left transition duration-200",
        danger
          ? "hover:bg-[rgba(var(--color-danger),0.05)]"
          : "hover:bg-[rgba(15,23,42,0.045)]"
      )}
    >
      <Icon
        className={cx(
          "h-[15px] w-[15px] shrink-0 transition-colors duration-200",
          danger
            ? "text-danger"
            : "text-[rgba(15,23,42,0.46)] group-hover:text-[rgba(15,23,42,0.72)]"
        )}
        strokeWidth={1.9}
      />

      <div
        className={cx(
          "truncate text-[13px] font-semibold tracking-[-0.02em]",
          danger ? "text-danger" : "text-[rgba(15,23,42,0.92)]"
        )}
      >
        {label}
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
    <div className="dropdown-panel-anim relative w-[286px] overflow-hidden rounded-[20px] border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.985)_0%,rgba(248,250,253,0.995)_100%)] p-2 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.28)] backdrop-blur-xl">
      <div className="px-3 pb-2.5 pt-2">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#2c5ee7_0%,#467dff_55%,#8fb0ff_100%)] text-[12px] font-semibold text-white shadow-[0_14px_30px_-20px_rgba(44,94,231,0.62)]">
            <span className="relative z-[1]">{initials}</span>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.34),transparent_48%)]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.95)]">
              {displayName}
            </div>
            <div className="mt-0.5 truncate text-[11px] font-medium tracking-[0.08em] uppercase text-[rgba(15,23,42,0.48)]">
              {roleLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-3 h-px bg-[rgba(15,23,42,0.07)]" />

      <div className="px-1.5 py-1.5">
        <HeaderMenuRow
          icon={Bell}
          label={unread > 0 ? `Notifications (${unread > 99 ? "99+" : unread})` : "Notifications"}
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

      <div className="mx-3 h-px bg-[rgba(15,23,42,0.07)]" />

      <div className="px-1.5 pb-1 pt-1.5">
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
          "group flex h-11 items-center gap-3 rounded-[16px] px-3 py-2 text-left transition duration-200",
          "hover:bg-[rgba(15,23,42,0.045)]",
          open ? "bg-[rgba(15,23,42,0.05)]" : ""
        )}
      >
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#2c5ee7_0%,#467dff_55%,#8fb0ff_100%)] text-[11px] font-semibold text-white shadow-[0_14px_30px_-20px_rgba(44,94,231,0.68)]">
          <span className="relative z-[1]">{initials}</span>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.34),transparent_48%)]" />
        </div>

        <div className="hidden min-w-0 text-left lg:block">
          <div className="truncate text-[13px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.94)]">
            {displayName}
          </div>
          <div className="truncate text-[10px] font-medium tracking-[0.08em] uppercase text-[rgba(15,23,42,0.48)]">
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
  shellSection,
  activeContextItem,
}) {
  const headerMeta = resolveHeaderMeta({ shellSection, activeContextItem });

  return (
    <>
      <header
        className="sticky top-0 z-[60] border-b border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(249,251,255,0.97)_0%,rgba(244,247,252,0.94)_100%)] backdrop-blur-xl"
        style={{ height: SHELL_TOPBAR_HEIGHT }}
      >
        <div className="mx-auto flex h-full max-w-shell-content items-center justify-between gap-5 px-5 md:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onMenuClick}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] text-[rgba(15,23,42,0.54)] transition duration-200 hover:bg-[rgba(15,23,42,0.05)] hover:text-[rgba(15,23,42,0.9)] md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-[16px] w-[16px]" strokeWidth={2} />
            </button>

            <div className="min-w-0">
              <div className="truncate text-[18px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.96)]">
                {headerMeta.title}
              </div>

              {headerMeta.subtitle ? (
                <div className="mt-1 truncate text-[13px] font-medium leading-[1.45] text-[rgba(15,23,42,0.56)]">
                  {headerMeta.subtitle}
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