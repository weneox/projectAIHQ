import { useState } from "react";
import { motion } from "framer-motion";
import {
  BellRing,
  CheckCircle2,
  Clock3,
  LogOut,
  Radio,
  Sparkles,
} from "lucide-react";
import { logoutUser } from "../../api/auth.js";
import NotificationsPanel from "./NotificationsPanel.jsx";

const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatStatValue(value, suffix) {
  return value == null ? `${suffix} unavailable` : `${value} ${suffix}`;
}

function StatusPill({
  live = true,
  pending = null,
  scheduled = null,
  unavailable = false,
}) {
  return (
    <div
      className={cn(
        "relative hidden min-w-0 items-center gap-3 overflow-hidden rounded-full px-3 py-2.5 lg:flex",
        "border border-[#e7dece] bg-[#fffdf8]/92",
        "shadow-[0_10px_30px_rgba(120,102,73,0.10),inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-xl"
      )}
    >
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#ebe2d4] bg-white/90">
        <span
          className={cn(
            "absolute h-4 w-4 rounded-full blur-md",
            live ? "bg-emerald-300/35" : "bg-stone-300/45"
          )}
        />
        <Radio
          className={cn(
            "relative z-10 h-3.5 w-3.5",
            live ? "text-emerald-500" : "text-stone-400"
          )}
          strokeWidth={2}
        />
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[12px] text-stone-700">
          <span className="font-medium text-stone-800">
            {unavailable
              ? "Shared stats unavailable"
              : live
                ? "Workflow pulse active"
                : "Workflow pulse paused"}
          </span>
          <span className="h-1 w-1 rounded-full bg-stone-300" />
          <span className="text-stone-500">
            {unavailable
              ? "retry on refresh or navigation"
              : live
                ? "review lane synced"
                : "awaiting reconnect"}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2 text-[11px] text-stone-500">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3 w-3" strokeWidth={1.9} />
            {formatStatValue(pending, "open leads")}
          </span>

          <span className="h-1 w-1 rounded-full bg-stone-300" />

          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3" strokeWidth={1.9} />
            {formatStatValue(scheduled, "open threads")}
          </span>
        </div>
      </div>
    </div>
  );
}

function NotificationButton({
  unread = null,
  unavailable = false,
  active = false,
  onClick,
}) {
  const hasUnread = typeof unread === "number" && unread > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={unavailable ? "Notifications unavailable" : "Open notifications"}
      className={cn(
        "group relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full",
        "border border-[#e7dece] bg-[#fffdf8]/92",
        "shadow-[0_10px_30px_rgba(120,102,73,0.10),inset_0_1px_0_rgba(255,255,255,0.78)]",
        "backdrop-blur-xl transition-all duration-300",
        "hover:-translate-y-[1px] hover:border-[#d9c9ae] hover:bg-white",
        active ? "border-[#d9c9ae] bg-white" : ""
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(222,196,152,0.18),transparent_34%),radial-gradient(circle_at_72%_78%,rgba(255,255,255,0.35),transparent_42%)] opacity-80 transition duration-300 group-hover:opacity-100" />

      <div className="pointer-events-none absolute inset-[1px] rounded-full border border-white/60" />

      <BellRing
        className="relative z-10 h-[18px] w-[18px] text-stone-600 transition duration-300 group-hover:scale-[1.05] group-hover:text-stone-900"
        strokeWidth={1.9}
      />

      {unavailable ? (
        <span className="absolute right-[8px] top-[8px] z-20 h-[9px] w-[9px] rounded-full border border-amber-200/40 bg-amber-300/80 shadow-[0_0_12px_rgba(252,211,77,0.45)]" />
      ) : null}

      {hasUnread ? (
        <>
          <span className="absolute right-[7px] top-[7px] z-20 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full border border-[#ead9bc] bg-[#e9d3ab] px-1 text-[10px] font-bold leading-none text-stone-900 shadow-[0_0_14px_rgba(217,188,132,0.55)]">
            {unread > 99 ? "99+" : unread}
          </span>
          <span className="absolute right-[7px] top-[7px] z-10 h-4 w-4 animate-ping rounded-full bg-[#e9d3ab]/45" />
        </>
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
    } catch (e) {
      console.error("Logout failed:", e);
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      aria-label="Logout"
      className={cn(
        "group relative flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full px-4",
        "border border-[#e7dece] bg-[#fffdf8]/92",
        "shadow-[0_10px_30px_rgba(120,102,73,0.10),inset_0_1px_0_rgba(255,255,255,0.78)]",
        "backdrop-blur-xl transition-all duration-300",
        "hover:-translate-y-[1px] hover:border-[#dcc8c2] hover:bg-white",
        "disabled:pointer-events-none disabled:opacity-60"
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.42),transparent_34%),radial-gradient(circle_at_72%_78%,rgba(215,135,135,0.12),transparent_38%)] opacity-80 transition duration-300 group-hover:opacity-100" />

      <div className="pointer-events-none absolute inset-[1px] rounded-full border border-white/60" />

      <LogOut
        className="relative z-10 h-[16px] w-[16px] text-stone-600 transition duration-300 group-hover:text-stone-900"
        strokeWidth={1.9}
      />
      <span className="relative z-10 hidden text-[13px] font-medium text-stone-700 sm:inline">
        {loading ? "Logging out..." : "Logout"}
      </span>
    </button>
  );
}

export default function Header({ shellStats = {}, notifications }) {
  const unavailable = shellStats?.availability === "unavailable";
  const live = !unavailable;
  const pending =
    typeof shellStats?.leadsOpen === "number" ? shellStats.leadsOpen : null;
  const scheduled =
    typeof shellStats?.inboxOpen === "number" ? shellStats.inboxOpen : null;
  const unread =
    typeof notifications?.unreadCount === "number"
      ? notifications.unreadCount
      : null;

  return (
    <>
      <header className="sticky top-0 z-40">
        <motion.div
          {...fade}
          className={cn(
            "relative overflow-hidden rounded-[30px]",
            "border border-[#e8ddcd]",
            "bg-[linear-gradient(180deg,rgba(255,252,246,0.96),rgba(251,247,239,0.96))]",
            "shadow-[0_18px_50px_rgba(120,102,73,0.10),inset_0_1px_0_rgba(255,255,255,0.82)]",
            "backdrop-blur-2xl"
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(720px_circle_at_0%_0%,rgba(223,200,166,0.22),transparent_34%),radial-gradient(540px_circle_at_100%_0%,rgba(240,232,216,0.60),transparent_36%),linear-gradient(90deg,transparent,rgba(255,255,255,0.28),transparent)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d8c9b3] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-[radial-gradient(260px_circle_at_100%_50%,rgba(227,206,171,0.18),transparent_60%)]" />

          <div className="relative flex min-h-[88px] items-center justify-between gap-3 px-4 py-4 md:px-5 lg:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.34em] text-stone-500">
                <Sparkles className="h-3.5 w-3.5 text-amber-600/70" strokeWidth={1.8} />
                <span>İdarə Mərkəzi</span>
              </div>

              <div className="mt-2 flex min-w-0 items-center gap-2">
                <p className="truncate text-[13px] text-stone-500 md:text-[14px]">
                  Yazışmalar, yayım və dərin idarə bir məhsulda
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <StatusPill
                live={live}
                pending={pending}
                scheduled={scheduled}
                unavailable={unavailable}
              />
              <NotificationButton
                unread={unread}
                unavailable={notifications?.unavailable}
                active={notifications?.open}
                onClick={() => notifications?.setOpen?.(!notifications?.open)}
              />
              <LogoutButton />
            </div>
          </div>
        </motion.div>
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
