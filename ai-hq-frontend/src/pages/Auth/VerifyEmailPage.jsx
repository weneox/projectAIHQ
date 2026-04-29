import { ArrowRight, MailCheck, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import { InlineNotice } from "../../components/ui/AppShellPrimitives.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = s(location.state?.email);

  return (
    <div className="auth-page min-h-screen bg-white text-text">
      <main className="mx-auto flex min-h-screen w-full max-w-[760px] flex-col justify-center px-6 py-10">
        <section className="w-full">
          <div className="flex justify-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] border border-[rgba(var(--color-brand),0.18)] bg-brand-soft text-brand shadow-[var(--shadow-inset-top)]">
              <MailCheck className="h-6 w-6" strokeWidth={2.05} />
            </span>
          </div>

          <div className="mt-6 flex justify-center">
            <Badge tone="brand" size="sm">
              Verify email
            </Badge>
          </div>

          <h1 className="mt-4 text-center font-display text-[46px] font-semibold leading-[0.95] tracking-[var(--tracking-tight-xl)] text-text md:text-[54px]">
            Check your inbox.
          </h1>

          <p className="mx-auto mt-5 max-w-[560px] text-center text-[15px] font-medium leading-7 text-text-muted">
            {email
              ? `We sent a verification link to ${email}. Open that email, verify your account, then continue to sign in.`
              : "We sent you a verification email. Open that email, verify your account, then continue to sign in."}
          </p>

          <div className="mx-auto mt-7 max-w-[560px]">
            <Card padded="sm" tone="brand">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-[rgba(var(--color-brand),0.16)] bg-brand-soft text-brand shadow-[var(--shadow-inset-top)]">
                  <ShieldCheck className="h-4 w-4" strokeWidth={2.05} />
                </span>

                <div className="min-w-0">
                  <div className="text-[14px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                    One last trust step
                  </div>

                  <div className="mt-1 text-[13px] font-medium leading-6 text-text-muted">
                    If you do not see the email, check spam first, then try signing up again with the correct address.
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {!email ? (
            <div className="mx-auto mt-4 max-w-[560px]">
              <InlineNotice
                tone="info"
                description="No email address was passed to this page, but you can still continue to sign in after verification."
                compact
              />
            </div>
          ) : null}

          <div className="mx-auto mt-8 flex max-w-[560px] flex-col gap-3 border-t border-line-soft pt-5 sm:flex-row">
            <Button
              type="button"
              size="hero"
              fullWidth
              onClick={() => navigate("/login", { replace: true })}
              rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.2} />}
            >
              Continue to sign in
            </Button>

            <Button
              type="button"
              size="hero"
              variant="secondary"
              fullWidth
              onClick={() => navigate("/signup", { replace: true })}
            >
              Use a different email
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}