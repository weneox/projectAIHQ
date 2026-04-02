import { MailCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function ActionButton({ children, tone = "primary", ...props }) {
  const className =
    tone === "primary"
      ? "inline-flex h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-medium text-white transition hover:bg-slate-800"
      : "inline-flex h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950";

  return (
    <button type="button" {...props} className={className}>
      {children}
    </button>
  );
}

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = s(location.state?.email);

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-6 py-10 text-slate-950">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[720px] items-center justify-center">
          <div className="w-full border-t border-slate-200 px-1 py-8 sm:py-10">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-900">
            <MailCheck className="h-7 w-7" />
          </div>

          <div className="mt-6 text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Verify email
          </div>

          <h1 className="mt-3 text-[36px] font-semibold tracking-[-0.05em] text-slate-950 sm:text-[44px]">
            Check your inbox
          </h1>

          <p className="mt-4 max-w-[38rem] text-[16px] leading-8 text-slate-600">
            {email
              ? `We sent a verification link to ${email}. Open that email, verify your account, then sign in to continue to setup.`
              : "We sent you a verification email. Open that email, verify your account, then sign in to continue to setup."}
          </p>

            <div className="mt-6 border-l-2 border-slate-200 pl-4 text-sm leading-7 text-slate-600">
              If you do not see the email, check your spam folder or try signing up again with the correct address.
            </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <ActionButton onClick={() => navigate("/login", { replace: true })}>
              Continue to sign in
            </ActionButton>
            <ActionButton
              tone="secondary"
              onClick={() => navigate("/signup", { replace: true })}
            >
              Use a different email
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
