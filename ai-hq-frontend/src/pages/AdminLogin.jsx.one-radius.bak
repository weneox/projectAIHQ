import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import {
  AuthFrame,
  AuthPanel,
  InlineNotice,
  Surface,
} from "../components/ui/AppShellPrimitives.jsx";
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

  async function onSubmit(event) {
    event.preventDefault();
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
    } catch (submitError) {
      setError(String(submitError?.message || submitError || "Login failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      aside={
        <Surface className="flex w-full flex-col justify-between rounded-[32px] border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(239,244,255,0.92))] p-8">
          <div>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-[18px] border border-line bg-brand-soft text-brand">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-subtle">
              Admin access
            </div>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.05em] text-text">
              Secure the control plane without drifting into a different product.
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-text-muted">
              Tenant setup, team access, and provider credentials now live inside the same premium light system as the main product.
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-[24px] border border-line bg-surface px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-subtle">
                Scope
              </div>
              <div className="mt-2 text-sm leading-6 text-text-muted">
                Workspaces, team lifecycle, and provider secret management.
              </div>
            </div>
          </div>
        </Surface>
      }
    >
      <AuthPanel className="max-w-[560px]">
        <div className="space-y-1">
          <div className="inline-flex items-center rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-subtle">
            Admin sign in
          </div>
          <div className="mt-3 text-[2.25rem] font-semibold tracking-[-0.05em] text-text">
            Access administration.
          </div>
          <div className="mt-2 text-[15px] leading-7 text-text-muted">
            Enter the admin passcode to continue into the control plane.
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-text-subtle">
              Passcode
            </label>
            <Input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter admin passcode"
              leftIcon={<LockKeyhole className="h-4 w-4" />}
              appearance="product"
            />
          </div>

          {error ? (
            <InlineNotice tone="danger" title="Access failed" description={error} />
          ) : null}

          <div className="flex justify-end border-t border-line-soft pt-5">
            <Button type="submit" size="hero" disabled={busy || !passcode.trim()}>
              {busy ? "Checking..." : "Enter Admin Panel"}
            </Button>
          </div>
        </form>
      </AuthPanel>
    </AuthFrame>
  );
}
