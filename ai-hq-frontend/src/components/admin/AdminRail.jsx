import { NavLink } from "react-router-dom";
import {
  Building2,
  Users,
  Shield,
  Sparkles,
  LogOut,
} from "lucide-react";
import { logoutAdminAuth } from "../../api/adminAuth.js";
import { cx } from "../../lib/cx.js";

function RailItem({ to, icon: Icon, label }) {
  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <div
          className={cx(
            "group relative flex items-center gap-3 overflow-hidden rounded-[24px] px-3 py-3 transition-all duration-300",
            isActive
              ? "bg-[linear-gradient(180deg,rgba(18,24,42,0.96),rgba(10,14,28,0.98))] text-white shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
              : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
          )}
        >
          {isActive ? (
            <>
              <div className="absolute inset-y-3 left-0 w-[3px] rounded-full bg-cyan-400" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140px_circle_at_0%_50%,rgba(34,211,238,0.14),transparent_55%)]" />
            </>
          ) : null}

          <div
            className={cx(
              "relative z-[1] flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] transition-all duration-300",
              isActive
                ? "bg-white/[0.08] text-cyan-300"
                : "bg-white/[0.03] text-slate-500 group-hover:bg-white/[0.06] group-hover:text-slate-200"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>

          <div className="relative z-[1] min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{label}</div>
          </div>
        </div>
      )}
    </NavLink>
  );
}

export default function AdminRail() {
  async function onLogout() {
    try {
      await logoutAdminAuth();
      window.location.href = "/admin/login";
    } catch (e) {
      alert(String(e?.message || e));
    }
  }

  return (
    <aside className="hidden xl:flex xl:w-[122px] xl:shrink-0 xl:justify-center">
      <div className="sticky top-6 flex h-[calc(100vh-48px)] w-[96px] flex-col items-center justify-between rounded-[34px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(10,14,24,0.88),rgba(5,8,16,0.96))] px-3 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
        <div className="flex w-full flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[24px] bg-[linear-gradient(180deg,rgba(18,24,42,0.96),rgba(10,14,28,0.98))] text-cyan-300 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
            <Sparkles className="h-5 w-5" />
          </div>

          <div className="h-px w-10 bg-white/[0.08]" />

          <div className="flex w-full flex-col gap-2">
            <RailItem to="/admin/tenants" icon={Building2} label="Spaces" />
            <RailItem to="/admin/team" icon={Users} label="Access" />
            <RailItem to="/admin/secrets" icon={Shield} label="Security" />
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="group flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/[0.03] text-slate-500 transition-all duration-200 hover:bg-rose-500/10 hover:text-rose-300"
          title="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </aside>
  );
}