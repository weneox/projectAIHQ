import { Bell, ChevronDown, Menu, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

const SHELL_CHROME_BG = "rgba(249,250,253,0.988)";
const SHELL_CHROME_SURFACE =
  "linear-gradient(180deg, rgba(255,255,255,0.985) 0%, rgba(249,250,253,0.99) 46%, rgba(245,247,251,0.988) 100%)";

const SOFT_EASE = "cubic-bezier(0.22,1,0.36,1)";

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

function HeaderChromeLayer() {
  return (
    <>
      <div
        className="absolute inset-0 backdrop-blur-xl"
        style={{ background: SHELL_CHROME_SURFACE }}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.18) 46%, rgba(226,232,240,0.22) 100%)",
        }}
      />

      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, rgba(15,23,42,0.025), rgba(15,23,42,0.086) 42%, rgba(15,23,42,0.038))",
        }}
      />

      <div
        className="pointer-events-none absolute bottom-px left-0 right-0 h-px opacity-75"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.86), rgba(255,255,255,0.38), rgba(255,255,255,0.72))",
        }}
      />
    </>
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
      className="group relative inline-flex h-8 items-center gap-2 overflow-hidden rounded-[12px] px-2.5 text-[12px] font-semibold tracking-[-0.02em] text-text-muted hover:text-text"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(246,248,252,0.44) 100%)",
        boxShadow:
          "inset 0 0 0 1px rgba(15,23,42,0.045), inset 0 1px 0 rgba(255,255,255,0.72)",
        transition: `color 190ms ${SOFT_EASE}, box-shadow 220ms ${SOFT_EASE}, background 220ms ${SOFT_EASE}`,
      }}
      aria-label="Open Ask AI"
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(241,245,251,0.62) 100%)",
          transition: `opacity 210ms ${SOFT_EASE}`,
        }}
      />
      <Sparkles className="relative z-[1] h-[17px] w-[17px]" strokeWidth={1.95} />
      <span className="relative z-[1]">Ask AI</span>
    </button>
  );
}

function WorkspaceControl({ notifications, workspaceMeta }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef(null);
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

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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
    <div
      className="w-[270px] overflow-hidden rounded-[18px] p-2.5"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.985) 0%, rgba(249,250,253,0.99) 52%, rgba(245,247,251,0.988) 100%)",
        border: "1px solid rgba(255,255,255,0.86)",
        boxShadow:
          "inset 0 0 0 1px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.92), 0 30px 82px -42px rgba(15,23,42,0.42)",
        backdropFilter: "blur(22px)",
      }}
    >
      <div className="px-2 py-2.5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px]"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(242,246,252,0.88) 100%)",
              boxShadow:
                "inset 0 0 0 1px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.95), 0 14px 28px -24px rgba(15,23,42,0.38)",
            }}
          >
            <WorkspaceGlyph className="h-7 w-7 opacity-[0.96]" />
          </div>

          <div className="min-w-0 flex-1">
            {workspaceResolving ? (
              <div className="h-3.5 w-28 rounded-full bg-[rgba(15,23,42,0.08)]" />
            ) : (
              <div className="truncate text-[14px] font-semibold tracking-[-0.025em] text-text">
                {displayName || "Workspace"}
              </div>
            )}

            {roleLabel ? (
              <div className="truncate pt-0.5 text-[11px] font-medium text-text-subtle">
                {roleLabel}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className="mx-2 my-1 h-px"
        style={{
          background:
            "linear-gradient(90deg, rgba(15,23,42,0), rgba(15,23,42,0.075), rgba(255,255,255,0.82), rgba(15,23,42,0))",
        }}
      />

      <button
        type="button"
        onClick={() => {
          setOpen(false);
          notifications?.setOpen?.(!notifications?.open);
        }}
        className="group relative mt-1 flex h-10 w-full items-center justify-between overflow-hidden rounded-[12px] px-3 text-left text-[13px] font-semibold text-text"
        style={{
          transition: `color 190ms ${SOFT_EASE}, background 220ms ${SOFT_EASE}`,
        }}
      >
        <span
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
          style={{
            background:
              "linear-gradient(90deg, rgba(15,23,42,0.034), rgba(15,23,42,0.014), rgba(15,23,42,0))",
            transition: `opacity 210ms ${SOFT_EASE}`,
          }}
        />
        <span className="relative z-[1]">Notifications</span>
        <span className="relative z-[1] text-[12px] font-semibold text-text-subtle">
          {notificationsLoading ? "…" : unread > 99 ? "99+" : unread}
        </span>
      </button>

      <button
        type="button"
        onClick={handleLogout}
        className="group relative mt-1 flex h-10 w-full items-center overflow-hidden rounded-[12px] px-3 text-left text-[13px] font-semibold text-danger"
        style={{
          transition: `background 220ms ${SOFT_EASE}`,
        }}
      >
        <span
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
          style={{
            background:
              "linear-gradient(90deg, rgba(220,38,38,0.08), rgba(220,38,38,0.035), rgba(220,38,38,0))",
            transition: `opacity 210ms ${SOFT_EASE}`,
          }}
        />
        <span className="relative z-[1]">
          {loggingOut ? "Signing out..." : "Sign out"}
        </span>
      </button>
    </div>
  );

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={displayName || "Workspace"}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="group relative flex h-9 items-center gap-2 overflow-hidden rounded-[14px] px-2.5 text-left text-text-muted hover:text-text"
        style={{
          background: open
            ? "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(243,247,253,0.9) 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(246,248,252,0.52) 100%)",
          boxShadow: open
            ? "inset 0 0 0 1px rgba(37,99,235,0.13), inset 0 1px 0 rgba(255,255,255,0.95), 0 14px 30px -24px rgba(37,99,235,0.38)"
            : "inset 0 0 0 1px rgba(15,23,42,0.052), inset 0 1px 0 rgba(255,255,255,0.84)",
          transition: `color 190ms ${SOFT_EASE}, background 240ms ${SOFT_EASE}, box-shadow 240ms ${SOFT_EASE}`,
        }}
      >
        <span
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(241,245,251,0.68) 100%)",
            transition: `opacity 210ms ${SOFT_EASE}`,
          }}
        />

        <div className="relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center">
          <WorkspaceGlyph className="h-[20px] w-[20px] opacity-[0.98]" />
        </div>

        <div className="relative z-[1] hidden min-w-0 text-left lg:block">
          {workspaceResolving ? (
            <div className="h-3 w-24 rounded-full bg-[rgba(15,23,42,0.08)]" />
          ) : (
            <div className="max-w-[210px] truncate text-[13px] font-semibold tracking-[-0.025em] text-text">
              {displayName || "Workspace"}
            </div>
          )}
        </div>

        <ChevronDown
          className={cx(
            "relative z-[1] h-[15px] w-[15px] text-text-subtle",
            open && "rotate-180"
          )}
          strokeWidth={2}
          style={{
            transition: `transform 260ms ${SOFT_EASE}, color 190ms ${SOFT_EASE}`,
          }}
        />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+9px)] z-[90]">
          {overlay}
        </div>
      ) : null}
    </div>
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
      className="group relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-[12px] text-text-muted hover:text-text"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(246,248,252,0.44) 100%)",
        boxShadow:
          "inset 0 0 0 1px rgba(15,23,42,0.045), inset 0 1px 0 rgba(255,255,255,0.72)",
        transition: `color 190ms ${SOFT_EASE}, box-shadow 220ms ${SOFT_EASE}`,
      }}
      aria-label="Open notifications"
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(241,245,251,0.62) 100%)",
          transition: `opacity 210ms ${SOFT_EASE}`,
        }}
      />
      <Bell className="relative z-[1] h-[18px] w-[18px]" strokeWidth={1.95} />
      {unread > 0 ? (
        <span className="absolute right-[7px] top-[7px] z-[2] h-[4px] w-[4px] rounded-full bg-brand" />
      ) : null}
    </button>
  );
}

export default function Header({ onMenuClick, notifications, workspaceMeta }) {
  return (
    <>
      <header
        className="sticky top-0 z-[60] overflow-hidden"
        style={{
          height: HEADER_HEIGHT,
          background: SHELL_CHROME_BG,
          boxShadow:
            "0 14px 34px -34px rgba(15,23,42,0.24), inset 0 -1px 0 rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.78)",
        }}
      >
        <HeaderChromeLayer />

        <div className="relative z-[2] mx-auto flex h-full max-w-shell-content items-center justify-between gap-3 px-4 md:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onMenuClick}
              className="group relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-[12px] text-text-muted hover:text-text md:hidden"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(246,248,252,0.44) 100%)",
                boxShadow:
                  "inset 0 0 0 1px rgba(15,23,42,0.045), inset 0 1px 0 rgba(255,255,255,0.72)",
                transition: `color 190ms ${SOFT_EASE}`,
              }}
              aria-label="Open navigation"
            >
              <span
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(241,245,251,0.62) 100%)",
                  transition: `opacity 210ms ${SOFT_EASE}`,
                }}
              />
              <Menu className="relative z-[1] h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          </div>

          <div className="flex items-center gap-2 md:gap-2.5">
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