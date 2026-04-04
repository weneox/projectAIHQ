import { MailCheck, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button.jsx";
import {
  AuthFrame,
  AuthPanel,
  Surface,
} from "../../components/ui/AppShellPrimitives.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = s(location.state?.email);

  return (
    <AuthFrame
      aside={
        <Surface className="flex w-full flex-col justify-between rounded-[32px] border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(239,244,255,0.94))] p-8">
          <div>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-[18px] border border-line bg-brand-soft text-brand">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-subtle">
              Verification
            </div>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.05em] text-text">
              One last trust step before the workspace opens.
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-text-muted">
              Verify your email, then continue directly into the same product system used across onboarding, operations, and admin.
            </p>
          </div>
        </Surface>
      }
    >
      <AuthPanel className="max-w-[640px]">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-[20px] border border-line bg-brand-soft text-brand">
          <MailCheck className="h-6 w-6" />
        </div>

        <div className="mt-6 inline-flex items-center rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-subtle">
          Verify email
        </div>

        <h1 className="mt-4 text-[2.5rem] font-semibold tracking-[-0.055em] text-text">
          Check your inbox.
        </h1>

        <p className="mt-4 max-w-[40rem] text-[15px] leading-7 text-text-muted">
          {email
            ? `We sent a verification link to ${email}. Open that email, verify your account, then continue to sign in.`
            : "We sent you a verification email. Open that email, verify your account, then continue to sign in."}
        </p>

        <div className="mt-6 rounded-[22px] border border-line bg-surface-muted px-5 py-4 text-sm leading-6 text-text-muted">
          If you do not see the email, check spam first, then try signing up again with the correct address.
        </div>

        <div className="mt-8 flex flex-wrap gap-3 border-t border-line-soft pt-5">
          <Button size="hero" onClick={() => navigate("/login", { replace: true })}>
            Continue to sign in
          </Button>
          <Button
            size="hero"
            variant="secondary"
            onClick={() => navigate("/signup", { replace: true })}
          >
            Use a different email
          </Button>
        </div>
      </AuthPanel>
    </AuthFrame>
  );
}
