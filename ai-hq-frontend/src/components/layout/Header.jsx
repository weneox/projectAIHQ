import { useEffect, useState } from "react";
import { BellRing, Building2, Check, ChevronDown, LogOut, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { logoutUser, switchWorkspaceUser } from "../../api/auth.js";
import { clearAppSessionContext, getAppAuthContext } from "../../lib/appSession.js";
import NotificationsPanel from "./NotificationsPanel.jsx";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function CompactStat({ label, value, status = "default" }) {
  return (
    <div className="min-w-[94px]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400/90">
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 text-[13px] font-medium",
          status === "warning"
            ? "text-amber-700"
            : status === "muted"
              ? "text-slate-500"
              : "text-slate-900"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function NotificationButton({ notifications }) {
  const unread =
    typeof notifications?.unreadCount === "number" ? notifications.unreadCount : 0;
  const hasUnread = unread > 0;

  return (
    <button
      type="button"
      onClick={() => notifications?.setOpen?.(!notifications?.open)}
      aria-label="Open notifications"
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-200",
        notifications?.open
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-white/80 bg-white/70 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_-18px_rgba(15,23,42,0.18)] hover:border-slate-300 hover:text-slate-950"
      )}
    >
      <BellRing className="h-4 w-4" strokeWidth={1.9} />
      {hasUnread ? (
        <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-slate-950 px-1 text-[10px] font-semibold leading-none text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </button>
  );
}

function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switchingToken, setSwitchingToken] = useState("");
  const [state, setState] = useState({
    current: null,
    workspaces: [],
    error: "",
  });

  useEffect(() => {
    let alive = true;

    getAppAuthContext()
      .then((auth) => {
        if (!alive) return;
        setState({
          current: auth?.workspace || null,
          workspaces: Array.isArray(auth?.workspaces) ? auth.workspaces : [],
          error: "",
        });
      })
      .catch((error) => {
        if (!alive) return;
        setState((prev) => ({
          ...prev,
          error:
            typeof error?.message === "string" && error.message.trim()
              ? error.message.trim()
              : "Workspace list unavailable.",
        }));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const workspaces = Array.isArray(state.workspaces) ? state.workspaces : [];
  const current = state.current || workspaces.find((item) => item?.active) || null;
  const showSwitcher = workspaces.length > 1;

  if (!showSwitcher) {
    return current?.companyName ? (
      <div className="hidden rounded-full border border-white/80 bg-white/72 px-3.5 py-2 text-[13px] font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_-18px_rgba(15,23,42,0.18)] lg:flex lg:items-center lg:gap-2">
        <Building2 className="h-4 w-4 text-slate-500" />
        <span>{current.companyName}</span>
      </div>
    ) : null;
  }

  async function onSwitch(workspace) {
    const token = String(workspace?.switchToken || "").trim();
    if (!token || token === switchingToken) return;

    setSwitchingToken(token);
    try {
      const response = await switchWorkspaceUser({ switchToken: token });
      clearAppSessionContext();
      setOpen(false);
      navigate(
        response?.destination?.path || response?.workspace?.routeHint || "/workspace",
        { replace: true }
      );
    } finally {
      setSwitchingToken("");
    }
  }

  return (
    <div className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 items-center gap-2 rounded-full border border-white/80 bg-white/72 px-3.5 text-[13px] font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_-18px_rgba(15,23,42,0.18)] transition-colors duration-200 hover:border-slate-300 hover:text-slate-950"
      >
        <Building2 className="h-4 w-4 text-slate-500" />
        <span>{current?.companyName || "Workspaces"}</span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-40 w-[320px] rounded-[22px] border border-white/80 bg-[rgba(255,255,255,.94)] p-3 shadow-[0_28px_64px_-32px_rgba(15,23,42,.32)] backdrop-blur-xl">
          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Switch workspace
          </div>
          {state.error ? (
            <div className="px-2 pb-2 text-sm text-amber-700">{state.error}</div>
          ) : null}
          {loading ? (
            <div className="px-2 pb-2 text-sm text-slate-500">Loading workspaces...</div>
          ) : (
            <div className="space-y-2">
              {workspaces.map((workspace) => {
                const active = !!workspace?.active;
                const switching = switchingToken && switchingToken === workspace?.switchToken;

                return (
                  <button
                    key={workspace?.membershipId || workspace?.tenantKey}
                    type="button"
                    disabled={active || switching}
                    onClick={() => onSwitch(workspace)}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 rounded-[18px] border px-3 py-3 text-left transition",
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-black/8 bg-[#fbfaf7] text-slate-800 hover:border-black/16",
                      switching ? "opacity-70" : ""
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-6">
                        {workspace?.companyName || workspace?.tenantKey}
                      </div>
                      <div
                        className={cn(
                          "text-[12px] leading-6",
                          active ? "text-white/72" : "text-slate-500"
                        )}
                      >
                        {workspace?.tenantKey} / {workspace?.role || "member"}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "shrink-0 text-right text-[11px] font-semibold uppercase tracking-[0.18em]",
                        active ? "text-white/72" : "text-slate-400"
                      )}
                    >
                      {active ? (
                        <span className="inline-flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" />
                          Current
                        </span>
                      ) : switching ? (
                        "Switching"
                      ) : workspace?.setupRequired ? (
                        "Setup required"
                      ) : (
                        "Ready"
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    if (loading) return;
    setLoading(true);

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
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      aria-label="Logout"
      className="flex h-10 items-center gap-2 rounded-full border border-white/80 bg-white/72 px-3.5 text-[13px] font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_-18px_rgba(15,23,42,0.18)] transition-colors duration-200 hover:border-slate-300 hover:text-slate-950 disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" strokeWidth={1.9} />
      <span className="hidden lg:inline">{loading ? "Logging out..." : "Logout"}</span>
    </button>
  );
}

export default function Header({
  onMenuClick,
  shellStats = {},
  notifications,
  shellSection,
  activeContextItem,
}) {
  const statsUnavailable = shellStats?.availability === "unavailable";
  const realtimeState = String(shellStats?.wsState || "idle");
  const inboxOpen =
    typeof shellStats?.inboxOpen === "number" ? shellStats.inboxOpen : null;
  const leadsOpen =
    typeof shellStats?.leadsOpen === "number" ? shellStats.leadsOpen : null;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/60 bg-[rgba(242,244,245,0.76)] backdrop-blur-xl">
        <div className="flex min-h-[78px] items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onMenuClick}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/72 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_-18px_rgba(15,23,42,0.18)] md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                {shellSection?.kicker || "Workspace"}
              </div>
              <div className="mt-1.5 flex min-w-0 items-center gap-2">
                <h1 className="truncate text-[22px] font-semibold tracking-[-0.045em] text-slate-950">
                  {activeContextItem?.label || shellSection?.label || "AI HQ"}
                </h1>
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-3 rounded-full border border-white/70 bg-white/58 px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_40px_-28px_rgba(15,23,42,0.18)] xl:flex">
            <CompactStat
              label="Realtime"
              value={statsUnavailable ? "Unavailable" : realtimeState}
              status={
                statsUnavailable
                  ? "warning"
                  : realtimeState === "off"
                    ? "muted"
                    : "default"
              }
            />
            <CompactStat
              label="Open threads"
              value={inboxOpen == null ? "Unavailable" : String(inboxOpen)}
              status={inboxOpen == null ? "warning" : "default"}
            />
            <CompactStat
              label="Open leads"
              value={leadsOpen == null ? "Unavailable" : String(leadsOpen)}
              status={leadsOpen == null ? "warning" : "default"}
            />
          </div>

          <div className="flex items-center gap-2">
            <WorkspaceSwitcher />
            <NotificationButton notifications={notifications} />
            <LogoutButton />
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
