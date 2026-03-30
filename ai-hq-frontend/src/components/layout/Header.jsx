import { useState } from "react";
import { BellRing, LogOut, Menu } from "lucide-react";
import { logoutUser } from "../../api/auth.js";
import NotificationsPanel from "./NotificationsPanel.jsx";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function CompactStat({ label, value, status = "default" }) {
  return (
    <div className="min-w-[92px]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-[13px] font-medium",
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
        "relative flex h-10 w-10 items-center justify-center rounded-xl border transition-colors duration-200",
        notifications?.open
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
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

function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    if (loading) return;
    setLoading(true);

    try {
      await logoutUser();

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
      className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors duration-200 hover:border-slate-300 hover:text-slate-950 disabled:opacity-60"
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
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f3f5f7]/90 backdrop-blur-md">
        <div className="flex min-h-[76px] items-center justify-between gap-4 px-4 md:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onMenuClick}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {shellSection?.kicker || "Workspace"}
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <h1 className="truncate text-[22px] font-semibold tracking-[-0.04em] text-slate-950">
                  {activeContextItem?.label || shellSection?.label || "AI HQ"}
                </h1>
                {shellSection?.label && activeContextItem?.label ? (
                  <span className="hidden text-[13px] text-slate-400 sm:inline">/</span>
                ) : null}
                {shellSection?.label && activeContextItem?.label ? (
                  <span className="hidden truncate text-[13px] text-slate-500 sm:inline">
                    {shellSection.label}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-6 xl:flex">
            <CompactStat
              label="Realtime"
              value={statsUnavailable ? "Unavailable" : realtimeState}
              status={statsUnavailable ? "warning" : realtimeState === "off" ? "muted" : "default"}
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
