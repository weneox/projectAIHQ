import { useEffect, useState } from "react";
import { ShieldCheck, LogOut, Activity } from "lucide-react";
import { getAdminAuthMe, logoutAdminAuth } from "../../api/adminAuth.js";

function Chip({ children, tone = "neutral" }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
      : tone === "info"
      ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-200"
      : "border-white/10 bg-white/[0.03] text-slate-300";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

export default function AdminTopbar() {
  const [status, setStatus] = useState("checking");
  const [exp, setExp] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    getAdminAuthMe()
      .then((j) => {
        if (!alive) return;
        setStatus(j?.authenticated ? "authenticated" : "guest");
        setExp(j?.session?.exp || null);
      })
      .catch(() => {
        if (!alive) return;
        setStatus("error");
      });

    return () => {
      alive = false;
    };
  }, []);

  async function onLogout() {
    setBusy(true);
    try {
      await logoutAdminAuth();
      window.location.href = "/admin/login";
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(4,8,16,0.94),rgba(3,7,14,0.90))] px-4 py-4 shadow-[0_20px_80px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl md:px-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-cyan-300" />
            <span>Admin Control Surface</span>
          </div>

          <div className="mt-2 text-lg font-semibold text-white">
            Platform administration area
          </div>

          <div className="mt-1 text-sm text-slate-400">
            Tenants, team access, provider secrets və təhlükəsizlik nəzarəti
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={status === "authenticated" ? "success" : "neutral"}>
            <Activity className="mr-1.5 h-3.5 w-3.5" />
            {status === "checking"
              ? "Session checking"
              : status === "authenticated"
              ? "Session active"
              : status === "guest"
              ? "Not authenticated"
              : "Status unknown"}
          </Chip>

          {exp ? (
            <Chip tone="info">
              Expires: {new Date(exp * 1000).toLocaleString()}
            </Chip>
          ) : null}

          <button
            type="button"
            onClick={onLogout}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {busy ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </div>
  );
}