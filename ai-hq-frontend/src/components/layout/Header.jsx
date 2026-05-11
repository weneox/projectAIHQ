import { Bell, ChevronDown, Crown, Menu, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { logoutUser } from "../../api/auth.js";
import {
  clearAppSessionContext,
  getAppSessionContext,
} from "../../lib/appSession.js";
import { cx } from "../../lib/cx.js";
import NotificationsPanel from "./NotificationsPanel.jsx";
import { getActiveShellSection } from "./shellNavigation.js";

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

const SHELL_CHROME_BG = "rgba(226,232,240,0.995)";
const SHELL_CHROME_SURFACE =
  "linear-gradient(180deg, rgba(235,240,246,0.995) 0%, rgba(226,232,240,0.995) 48%, rgba(218,226,235,0.995) 100%)";

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
    <Crown
      className={cx("pointer-events-none select-none text-[#2F3947]", className)}
      strokeWidth={1.95}
    />
  );
}

function HeaderChromeLayer() {
  return (
    <>
      <div className="absolute inset-0" style={{ background: SHELL_CHROME_SURFACE }} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0.18)_46%,rgba(226,232,240,0.22)_100%)] opacity-50" />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-[linear-gradient(90deg,rgba(15,23,42,0.025),rgba(15,23,42,0.086)_42%,rgba(15,23,42,0.038))]" />
      <div className="pointer-events-none absolute bottom-px left-0 right-0 h-px bg-[linear-gradient(90deg,rgba(255,255,255,0.86),rgba(255,255,255,0.38),rgba(255,255,255,0.72))] opacity-75" />
    </>
  );
}

function ShellIconButton({
  children,
  onClick,
  ariaLabel,
  active = false,
  className = "",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cx(
        "group relative inline-flex h-8 w-8 items-center justify-center rounded-[10px]",
        "text-text-muted transition-[color,background-color] duration-base ease-premium hover:text-text",
        active ? "bg-[rgba(15,23,42,0.06)] text-text" : "bg-transparent hover:bg-[rgba(15,23,42,0.04)]",
        className
      )}
    >
      <span className="relative z-[1]">{children}</span>
    </button>
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
      className={cx(
        "group relative inline-flex h-8 items-center gap-2 rounded-[10px] px-2",
        "bg-transparent text-[12px] font-semibold tracking-[var(--tracking-tight-md)] text-text-muted",
        "transition-[color,background-color] duration-base ease-premium hover:bg-[rgba(15,23,42,0.04)] hover:text-text"
      )}
      aria-label="Köməkçini aç"
    >
      <Sparkles className="h-[17px] w-[17px]" strokeWidth={1.95} />
      <span>Köməkçi</span>
    </button>
  );
}

function HeaderPageTitle({ pathname = "" }) {
  const section = getActiveShellSection(pathname);
  if (!section?.label) return null;

  const Icon = section.icon;

  return (
    <div className="hidden min-w-0 items-center gap-2.5 md:flex">
      {Icon ? (
        <Icon className="h-5 w-5 shrink-0 text-[#2F3947]" strokeWidth={2.05} />
      ) : null}

      <div className="truncate py-[2px] text-[20px] font-semibold leading-[1.25] tracking-normal text-[#2F3947]">
        {section.label}
      </div>
    </div>
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
    typeof notifications?.unreadCount === "number" ? notifications.unreadCount : 0;

  const displayName =
    pickFirstWorkspaceName(workspaceMeta?.workspaceName, session.workspaceName) ||
    pickFirstText(session.actorName, session.userName);

  const workspaceResolving = !displayName && !session.resolved;

  const roleLabel = pickFirstText(
    workspaceMeta?.userName,
    session.userName,
    session.role
  );

  return (
    <div ref={menuRef} className="relative z-[520]">
      <button
        type="button"
        aria-label={displayName || "Hesab"}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cx(
          "group relative flex h-8 items-center gap-1.5 rounded-[10px] px-1.5",
          "bg-transparent text-text-muted transition-[color,background-color] duration-base ease-premium hover:bg-[rgba(15,23,42,0.04)] hover:text-text",
          open && "bg-[rgba(15,23,42,0.06)] text-text"
        )}
      >
        <span className="relative z-[1] flex h-5 w-5 shrink-0 items-center justify-center">
          <WorkspaceGlyph className="h-[17px] w-[17px]" />
        </span>

        <ChevronDown
          className={cx(
            "relative z-[1] h-[15px] w-[15px] text-text-subtle transition-transform duration-slow ease-premium",
            open && "rotate-180"
          )}
          strokeWidth={2}
        />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+9px)] z-[700] w-[270px] overflow-hidden rounded-[18px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.985)_0%,rgba(249,250,253,0.99)_52%,rgba(245,247,251,0.988)_100%)] p-2.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.055),inset_0_1px_0_rgba(255,255,255,0.92),0_30px_82px_-42px_rgba(15,23,42,0.42)]">
          <div className="px-2 py-2.5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-start justify-center pt-0.5">
                <WorkspaceGlyph className="h-7 w-7 text-text opacity-[0.96]" />
              </div>

              <div className="min-w-0 flex-1">
                {workspaceResolving ? (
                  <div className="h-3.5 w-28 rounded-full bg-[rgba(15,23,42,0.08)]" />
                ) : (
                  <div className="truncate text-[14px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                    {displayName || "Hesab"}
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

          <div className="mx-2 my-1 h-px bg-[linear-gradient(90deg,rgba(15,23,42,0),rgba(15,23,42,0.075),rgba(255,255,255,0.82),rgba(15,23,42,0))]" />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              notifications?.setOpen?.(!notifications?.open);
            }}
            className="group relative mt-1 flex h-10 w-full items-center justify-between overflow-hidden rounded-[12px] px-3 text-left text-[13px] font-semibold text-text transition-colors duration-base ease-premium"
          >
            <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-base ease-premium group-hover:opacity-100 bg-[linear-gradient(90deg,rgba(15,23,42,0.034),rgba(15,23,42,0.014),rgba(15,23,42,0))]" />
            <span className="relative z-[1]">Bildirişlər</span>
            <span className="relative z-[1] text-[12px] font-semibold text-text-subtle">
              {notificationsLoading ? "…" : unread > 99 ? "99+" : unread}
            </span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="group relative mt-1 flex h-10 w-full items-center overflow-hidden rounded-[12px] px-3 text-left text-[13px] font-semibold text-danger transition-colors duration-base ease-premium"
          >
            <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-base ease-premium group-hover:opacity-100 bg-[linear-gradient(90deg,rgba(220,38,38,0.08),rgba(220,38,38,0.035),rgba(220,38,38,0))]" />
            <span className="relative z-[1]">
              {loggingOut ? "Çıxılır..." : "Çıxış"}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NotificationsButton({ notifications }) {
  const unread =
    typeof notifications?.unreadCount === "number" ? notifications.unreadCount : 0;

  return (
    <ShellIconButton
      onClick={() => notifications?.setOpen?.(!notifications?.open)}
      ariaLabel="Bildirişləri aç"
      active={notifications?.open}
    >
      <Bell className="h-[18px] w-[18px]" strokeWidth={1.95} />
      {unread > 0 ? (
        <span className="absolute right-[7px] top-[7px] z-[2] h-[4px] w-[4px] rounded-full bg-brand" />
      ) : null}
    </ShellIconButton>
  );
}

export default function Header({ onMenuClick, notifications, workspaceMeta }) {
  const location = useLocation();

  return (
    <>
      <header
        className="sticky top-0 z-[260] overflow-visible"
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
            <ShellIconButton
              onClick={onMenuClick}
              ariaLabel="Naviqasiyanı aç"
              className="md:hidden"
            >
              <Menu className="h-[18px] w-[18px]" strokeWidth={2} />
            </ShellIconButton>

            <HeaderPageTitle pathname={location.pathname} />
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



