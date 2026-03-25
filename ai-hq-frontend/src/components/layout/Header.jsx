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
        "border border-white/[0.08] bg-white/[0.03]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl"
      )}
    >
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04]">
        <span
          className={cn(
            "absolute h-4 w-4 rounded-full blur-md",
            live ? "bg-emerald-300/30" : "bg-white/10"
          )}
        />
        <Radio
          className={cn(
            "relative z-10 h-3.5 w-3.5",
            live ? "text-emerald-300" : "text-white/35"
          )}
          strokeWidth={2}
        />
      </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] text-white/86">
            <span className="font-medium">
              {unavailable
                ? "Shared stats unavailable"
                : live
                  ? "Workflow pulse active"
                  : "Workflow pulse paused"}
            </span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span className="text-white/42">
              {unavailable
                ? "retry on refresh or navigation"
                : live
                  ? "review lane synced"
                  : "awaiting reconnect"}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2 text-[11px] text-white/40">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3 w-3" strokeWidth={1.9} />
              {formatStatValue(pending, "open leads")}
            </span>

          <span className="h-1 w-1 rounded-full bg-white/15" />

            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" strokeWidth={1.9} />
              {formatStatValue(scheduled, "open threads")}
            </span>
          </div>
        </div>
    </div>
  );
}

function NotificationButton({ unread = null, unavailable = false }) {
  const hasUnread = typeof unread === "number" && unread > 0;

  return (
    <button
      type="button"
      aria-label={unavailable ? "Notifications unavailable" : "Open notifications"}
      className={cn(
        "group relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full",
        "border border-white/[0.09] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]",
        "shadow-[0_12px_40px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.06)]",
        "backdrop-blur-xl transition-all duration-300",
        "hover:-translate-y-[1px] hover:border-cyan-300/20 hover:bg-white/[0.06]"
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(125,211,252,0.16),transparent_34%),radial-gradient(circle_at_72%_78%,rgba(255,255,255,0.06),transparent_38%)] opacity-80 transition duration-300 group-hover:opacity-100" />

      <div className="pointer-events-none absolute inset-[1px] rounded-full border border-white/[0.04]" />

      <BellRing
        className="relative z-10 h-[18px] w-[18px] text-white/78 transition duration-300 group-hover:scale-[1.05] group-hover:text-white"
        strokeWidth={1.9}
      />

      {unavailable ? (
        <span className="absolute right-[8px] top-[8px] z-20 h-[9px] w-[9px] rounded-full border border-amber-200/20 bg-amber-300/80 shadow-[0_0_12px_rgba(252,211,77,0.45)]" />
      ) : null}

      {hasUnread ? (
        <>
          <span className="absolute right-[7px] top-[7px] z-20 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-300 px-1 text-[10px] font-bold leading-none text-slate-900 shadow-[0_0_14px_rgba(103,232,249,0.95)]">
            {unread > 99 ? "99+" : unread}
          </span>
          <span className="absolute right-[7px] top-[7px] z-10 h-4 w-4 animate-ping rounded-full bg-cyan-300/35" />
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
        "border border-white/[0.09] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]",
        "shadow-[0_12px_40px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.06)]",
        "backdrop-blur-xl transition-all duration-300",
        "hover:-translate-y-[1px] hover:border-rose-300/20 hover:bg-white/[0.06]",
        "disabled:pointer-events-none disabled:opacity-60"
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.07),transparent_34%),radial-gradient(circle_at_72%_78%,rgba(251,113,133,0.10),transparent_38%)] opacity-80 transition duration-300 group-hover:opacity-100" />

      <div className="pointer-events-none absolute inset-[1px] rounded-full border border-white/[0.04]" />

      <LogOut
        className="relative z-10 h-[16px] w-[16px] text-white/78 transition duration-300 group-hover:text-white"
        strokeWidth={1.9}
      />
      <span className="relative z-10 hidden text-[13px] font-medium text-white/82 sm:inline">
        {loading ? "Logging out..." : "Logout"}
      </span>
    </button>
  );
}

export default function Header({ shellStats = {} }) {
  const unavailable = shellStats?.availability === "unavailable";
  const live = !unavailable;
  const pending =
    typeof shellStats?.leadsOpen === "number" ? shellStats.leadsOpen : null;
  const scheduled =
    typeof shellStats?.inboxOpen === "number" ? shellStats.inboxOpen : null;
  const unread =
    typeof shellStats?.notificationsUnread === "number"
      ? shellStats.notificationsUnread
      : null;

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 md:px-5 md:pt-4">
      <motion.div
        {...fade}
        className={cn(
          "relative overflow-hidden rounded-[28px]",
          "border border-white/[0.07]",
          "bg-[linear-gradient(180deg,rgba(4,8,16,0.94),rgba(3,7,14,0.90))]",
          "shadow-[0_20px_80px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.04)]",
          "backdrop-blur-2xl"
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(720px_circle_at_0%_0%,rgba(34,211,238,0.06),transparent_34%),radial-gradient(540px_circle_at_100%_0%,rgba(59,130,246,0.06),transparent_30%),linear-gradient(90deg,transparent,rgba(255,255,255,0.02),transparent)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-[radial-gradient(260px_circle_at_100%_50%,rgba(34,211,238,0.08),transparent_60%)]" />

        <div className="relative flex min-h-[84px] items-center justify-between gap-3 px-4 py-3 md:px-5 lg:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.34em] text-white/78">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300/80" strokeWidth={1.8} />
              <span>Executive Workspace</span>
            </div>

            <div className="mt-1.5 flex min-w-0 items-center gap-2">
              <p className="truncate text-[13px] text-white/42 md:text-[14px]">
                Review, approval, and release flow in one surface
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
            <NotificationButton unread={unread} unavailable={unavailable} />
            <LogoutButton />
          </div>
        </div>
      </motion.div>
    </header>
  );
}
