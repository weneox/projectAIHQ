import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import { getAdminAuthMe, loginAdminAuth } from "../api/adminAuth.js";

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let alive = true;

    getAdminAuthMe()
      .then((j) => {
        if (!alive) return;
        setAuthed(!!j?.authenticated?.admin);
      })
      .catch(() => {
        if (!alive) return;
        setAuthed(false);
      })
      .finally(() => {
        if (!alive) return;
        setChecked(true);
      });

    return () => {
      alive = false;
    };
  }, []);

  if (checked && authed) {
    const next = location.state?.from?.pathname || "/admin/tenants";
    return <Navigate to={next} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      await loginAdminAuth(passcode);

      const me = await getAdminAuthMe();
      if (!me?.authenticated?.admin) {
        throw new Error("Admin session was not established");
      }

      const next = location.state?.from?.pathname || "/admin/tenants";
      navigate(next, { replace: true });
    } catch (e2) {
      setError(String(e2?.message || e2 || "Login failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#02050c] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <Card className="p-6">
          <div className="space-y-1">
            <div className="text-xl font-semibold text-slate-900 dark:text-white">
              Admin Login
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Admin panelə giriş üçün passcode daxil et.
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Passcode
              </label>
              <Input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter admin passcode"
              />
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={busy || !passcode.trim()}>
                {busy ? "Checking..." : "Enter Admin Panel"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}