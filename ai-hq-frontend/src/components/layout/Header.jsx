import { Dropdown } from "antd";
import { Bell, ChevronDown, Menu, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { logoutUser } from "../../api/auth.js";
import customerIcon from "../../assets/channels/customer.png";
import {
  clearAppSessionContext,
  getAppSessionContext,
} from "../../lib/appSession.js";
import { cx } from "../../lib/cx.js";
import NotificationsPanel from "./NotificationsPanel.jsx";

const GENERIC_WORKSPACE_NAMES = new Set([
  "workspace",
  "local workspace",
  "www",
  "app",
  "hq",
  "dashboard",
  "admin",
  "portal",
  "api",
  "web",
  "site",
]);

const HEADER_HEIGHT = 52;
const SHELL_CHROME_BG = "rgba(248,249,252,0.975)";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function normalizeWorkspaceName(value) {
  const text = s(value);
  if (!text) return "";

  if (GENERIC_WORKSPACE_NAMES.has(text.toLowerCase())) {
    return "";
  }

  return text;
}

function pickFirstText(...values) {
  for (const value of values) {
    const text = s(value);
    if (text) return text;
  }
  return "";
}

function pickFirstWorkspaceName(...values) {
  for (const value of values) {
    const text = normalizeWorkspaceName(value);
    if (text) return text;
  }
  return "";
}

function resolveSessionWorkspaceName(sessionContext = {}) {
  const bootstrap = obj(sessionContext.bootstrap);
  const auth = obj(sessionContext.auth);

  const bootstrapWorkspace = obj(bootstrap.workspace);
  const bootstrapTenant = obj(bootstrap.tenant || bootstrapWorkspace.tenant);

  const authWorkspace = obj(auth.workspace);
  const authTenant = obj(auth.tenant || authWorkspace.tenant);

  const membership = obj(auth.membership);

  return pickFirstWorkspaceName(
    bootstrapWorkspace.displayName,
    bootstrapWorkspace.display_name,
    bootstrapWorkspace.companyName,
    bootstrapWorkspace.company_name,
    bootstrapWorkspace.businessName,
    bootstrapWorkspace.business_name,
    bootstrapWorkspace.name,
    bootstrapWorkspace.workspaceName,
    bootstrapWorkspace.workspace_name,
    bootstrapWorkspace.tenantName,
    bootstrapWorkspace.tenant_name,

    bootstrapTenant.displayName,
    bootstrapTenant.display_name,
    bootstrapTenant.companyName,
    bootstrapTenant.company_name,
    bootstrapTenant.businessName,
    bootstrapTenant.business_name,
    bootstrapTenant.name,
    bootstrapTenant.workspaceName,
    bootstrapTenant.workspace_name,
    bootstrapTenant.tenantName,
    bootstrapTenant.tenant_name,

    bootstrap.workspaceName,
    bootstrap.workspace_name,
    bootstrap.companyName,
    bootstrap.company_name,
    bootstrap.businessName,
    bootstrap.business_name,
    bootstrap.tenantName,
    bootstrap.tenant_name,

    authWorkspace.displayName,
    authWorkspace.display_name,
    authWorkspace.companyName,
    authWorkspace.company_name,
    authWorkspace.businessName,
    authWorkspace.business_name,
    authWorkspace.name,
    authWorkspace.workspaceName,
    authWorkspace.workspace_name,
    authWorkspace.tenantName,
    authWorkspace.tenant_name,

    authTenant.displayName,
    authTenant.display_name,
    authTenant.companyName,
    authTenant.company_name,
    authTenant.businessName,
    authTenant.business_name,
    authTenant.name,
    authTenant.workspaceName,
    authTenant.workspace_name,
    authTenant.tenantName,
    authTenant.tenant_name,

    auth.workspaceName,
    auth.workspace_name,
    auth.companyName,
    auth.company_name,
    auth.businessName,
    auth.business_name,
    auth.tenantName,
    auth.tenant_name,

    membership.workspaceName,
    membership.workspace_name,
    membership.companyName,
    membership.company_name,
    membership.tenantName,
    membership.tenant_name
  );
}

function resolveSessionUserName(sessionContext = {}) {
  const bootstrap = obj(sessionContext.bootstrap);
  const auth = obj(sessionContext.auth);

  const authUser = obj(auth.user);
  const bootstrapViewer = obj(bootstrap.viewer);

  return pickFirstText(
    authUser.full_name,
    authUser.fullName,
    authUser.display_name,
    authUser.displayName,
    authUser.name,
    bootstrapViewer.full_name,
    bootstrapViewer.fullName,
    bootstrapViewer.display_name,
    bootstrapViewer.displayName,
    bootstrapViewer.name,
    sessionContext.actorName,
    authUser.user_email,
    auth.email
  );
}

function resolveSessionRole(sessionContext = {}) {
  const bootstrap = obj(sessionContext.bootstrap);
  const auth = obj(sessionContext.auth);
  const membership = obj(auth.membership);
  const authUser = obj(auth.user);
  const authWorkspace = obj(auth.workspace);

  return pickFirstText(
    sessionContext.viewerRole,
    bootstrap.viewerRole,
    bootstrap.role,
    membership.role,
    authWorkspace.role,
    authUser.role,
    auth.role
  );
}

function WorkspaceGlyph({ className = "" }) {
  return (
    <img
      src={customerIcon}
      alt=""
      className={cx("pointer-events-none select-none object-contain", className)}
      draggable="false"
    />
  );
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
      className="inline-flex h-8 items-center gap-2 px-1 text-[12px] font-semibold tracking-[-0.02em] text-text-muted transition-colors duration-base ease-premium hover:text-text"
      aria-label="Open Ask AI"
    >
      <Sparkles className="h-[15px] w-[15px]" strokeWidth={1.95} />
      <span>Ask AI</span>
    </button>
  );
}

function WorkspaceControl({ notifications, workspaceMeta }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [session, setSession] = useState({
    actorName: "",
    userName: "",
    workspaceName: "",
    role: "",
    resolved: false,
  });

  useEffect(() => {
    let alive = true;

    getAppSessionContext()
      .then((context) => {
        if (!alive) return;

        setSession({
          actorName: pickFirstText(context?.actorName),
          userName: resolveSessionUserName(context),
          workspaceName: resolveSessionWorkspaceName(context),
          role: resolveSessionRole(context),
          resolved: true,
        });
      })
      .catch(() => {
        if (!alive) return;
        setSession((prev) => ({
          ...prev,
          resolved: true,
        }));
      });

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

  const notificationsLoading =
    notifications?.loading === true || notifications?.refreshing === true;
  const unread =
    typeof notifications?.unreadCount === "number"
      ? notifications.unreadCount
      : 0;

  const displayName =
    pickFirstWorkspaceName(workspaceMeta?.workspaceName, session.workspaceName) ||
    pickFirstText(session.actorName, session.userName);

  const workspaceResolving = !displayName && !session.resolved;

  const roleLabel = pickFirstText(
    workspaceMeta?.userName,
    session.userName,
    session.role
  );

  const overlay = (
    <div className="dropdown-panel-anim w-[262px] rounded-[18px] border border-white/80 bg-white/97 p-2.5 shadow-[0_26px_70px_-36px_rgba(15,23,42,0.3)] backdrop-blur-xl">
      <div className="px-2 py-2.5">
        <div className="flex items-center gap-3">
          <WorkspaceGlyph className="h-9 w-9 shrink-0 opacity-[0.96]" />

          <div className="min-w-0 flex-1">
            {workspaceResolving ? (
              <div className="h-3.5 w-28 rounded-full bg-[rgba(15,23,42,0.08)]" />
            ) : (
              <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-text">
                {displayName || "Workspace"}
              </div>
            )}
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
        className="flex h-10 w-full items-center justify-between rounded-[12px] px-3 text-left text-[13px] font-medium text-text transition-colors hover:bg-black/[0.035]"
      >
        <span>Notifications</span>
        <span className="text-[12px] text-text-subtle">
          {notificationsLoading ? "…" : unread > 99 ? "99+" : unread}
        </span>
      </button>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-1 flex h-10 w-full items-center rounded-[12px] px-3 text-left text-[13px] font-medium text-danger transition-colors hover:bg-danger-soft"
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
        aria-label={displayName || "Workspace"}
        aria-expanded={open}
        className="flex h-8 items-center gap-2 px-1 text-left text-text-muted transition-colors duration-base ease-premium hover:text-text"
      >
        <WorkspaceGlyph className="h-[17px] w-[17px] shrink-0 opacity-[0.96]" />

        <div className="hidden min-w-0 text-left lg:block">
          {workspaceResolving ? (
            <div className="h-3 w-24 rounded-full bg-[rgba(15,23,42,0.08)]" />
          ) : (
            <div className="truncate text-[13px] font-semibold tracking-[-0.02em] text-text">
              {displayName || "Workspace"}
            </div>
          )}
        </div>

        <ChevronDown
          className={cx(
            "h-[13px] w-[13px] text-text-subtle transition-transform duration-base ease-premium",
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
      className="relative inline-flex h-8 w-8 items-center justify-center text-text-muted transition-colors duration-base ease-premium hover:text-text"
      aria-label="Open notifications"
    >
      <Bell className="h-[15px] w-[15px]" strokeWidth={1.95} />
      {unread > 0 ? (
        <span className="absolute right-[5px] top-[5px] h-[4px] w-[4px] rounded-full bg-brand" />
      ) : null}
    </button>
  );
}

export default function Header({ onMenuClick, notifications, workspaceMeta }) {
  return (
    <>
      <header
        className="sticky top-0 z-[60] backdrop-blur-xl"
        style={{
          height: HEADER_HEIGHT,
          background: SHELL_CHROME_BG,
          boxShadow: "0 10px 24px -24px rgba(15,23,42,0.14)",
        }}
      >
        <div className="mx-auto flex h-full max-w-shell-content items-center justify-between gap-3 px-4 md:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onMenuClick}
              className="inline-flex h-8 w-8 items-center justify-center text-text-muted transition-colors duration-base ease-premium hover:text-text md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-[15px] w-[15px]" strokeWidth={2} />
            </button>
          </div>

          <div className="flex items-center gap-2.5 md:gap-3">
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

export { HEADER_HEIGHT, SHELL_CHROME_BG };


