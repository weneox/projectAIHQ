import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, KeyRound, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { resendVerificationEmail, verifyEmail } from "../api/auth.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import AppIcon from "../components/ui/AppIcon.jsx";
import AppStatusText from "../components/ui/AppStatusText.jsx";
import { clearAppSessionContext } from "../lib/appSession.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function onlyDigits(value = "") {
  return s(value).replace(/\D+/g, "").slice(0, 6);
}

function statusTone(status = "") {
  if (status === "verified") return "success";
  if (status === "error") return "danger";
  if (status === "checking") return "brand";
  return "warning";
}

function statusLabel(status = "") {
  if (status === "verified") return "Verified";
  if (status === "error") return "Needs attention";
  if (status === "checking") return "Checking";
  return "Verification required";
}

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tokenFromUrl = s(searchParams.get("token"));
  const codeFromUrl = onlyDigits(searchParams.get("code"));

  const [code, setCode] = useState(codeFromUrl);
  const [status, setStatus] = useState(tokenFromUrl ? "checking" : "idle");
  const [message, setMessage] = useState(
    tokenFromUrl
      ? "Checking verification link..."
      : "Enter the 6-digit code from your inbox."
  );
  const [submitting, setSubmitting] = useState(Boolean(tokenFromUrl));
  const [resending, setResending] = useState(false);

  const codeReady = useMemo(() => onlyDigits(code).length === 6, [code]);

  useEffect(() => {
    let alive = true;

    async function runTokenVerification() {
      if (!tokenFromUrl) return;

      setSubmitting(true);
      setStatus("checking");
      setMessage("Checking verification link...");

      try {
        const result = await verifyEmail({ token: tokenFromUrl });

        if (!alive) return;

        clearAppSessionContext();

        if (result?.verified || result?.ok !== false) {
          setStatus("verified");
          setMessage("Email verified. You can continue to your workspace.");
          return;
        }

        setStatus("error");
        setMessage(result?.error || "Verification link could not be confirmed.");
      } catch (err) {
        if (!alive) return;

        setStatus("error");
        setMessage(
          err?.payload?.error ||
            err?.message ||
            "Verification link could not be confirmed."
        );
      } finally {
        if (alive) setSubmitting(false);
      }
    }

    runTokenVerification();

    return () => {
      alive = false;
    };
  }, [tokenFromUrl]);

  async function handleSubmit(event) {
    event.preventDefault();

    const nextCode = onlyDigits(code);
    if (nextCode.length !== 6 || submitting) return;

    setSubmitting(true);
    setStatus("checking");
    setMessage("Checking verification code...");

    try {
      const result = await verifyEmail({ code: nextCode });

      clearAppSessionContext();

      if (result?.verified || result?.ok !== false) {
        setStatus("verified");
        setMessage("Email verified. You can continue to your workspace.");
        return;
      }

      setStatus("error");
      setMessage(result?.error || "Verification code could not be confirmed.");
    } catch (err) {
      setStatus("error");
      setMessage(
        err?.payload?.error ||
          err?.message ||
          "Verification code could not be confirmed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resending) return;

    setResending(true);
    setStatus("checking");
    setMessage("Sending a new verification code...");

    try {
      const result = await resendVerificationEmail();

      if (result?.alreadyVerified) {
        clearAppSessionContext();
        setStatus("verified");
        setMessage("Email already verified. You can continue to your workspace.");
        return;
      }

      if (result?.sent || result?.ok !== false) {
        setStatus("idle");
        setMessage("Verification code sent. Check your inbox.");
        return;
      }

      setStatus("error");
      setMessage(result?.error || "Could not send a new verification code.");
    } catch (err) {
      const retryAfter = err?.payload?.retryAfterSeconds;

      setStatus("error");
      setMessage(
        retryAfter
          ? `Wait ${retryAfter} seconds before requesting another code.`
          : err?.payload?.error ||
              err?.message ||
              "Could not send a new verification code."
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen bg-white px-6 py-8 text-text">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-[960px] flex-col justify-center">
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <AppIcon icon={ShieldCheck} size="lg" tone="text" strokeWidth={2.05} />

              <h1 className="mt-5 text-[28px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
                Verify your email
              </h1>

              <p className="mt-3 text-[13.5px] font-medium leading-6 text-text-muted">
                Confirm email ownership before sensitive workspace actions become
                available.
              </p>
            </div>

            <Card padded={false} clip>
              <div className="px-5 py-5">
                <div className="flex items-center gap-3">
                  <AppIcon icon={KeyRound} size="md" tone="text" strokeWidth={2.05} />
                  <div className="text-[13px] font-semibold text-text">
                    Security gate
                  </div>
                </div>

                <div className="mt-3 text-[13px] font-medium leading-6 text-text-muted">
                  Verification protects workspace settings, team access, and
                  customer-impacting actions.
                </div>
              </div>
            </Card>
          </div>

          <Card padded={false} clip>
            <div className="border-b border-line-soft px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[17px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                    Email verification
                  </div>
                  <div className="mt-1 text-[12.5px] font-medium text-text-muted">
                    Use the code sent to your email address.
                  </div>
                </div>

                <AppStatusText tone={statusTone(status)}>
                  {statusLabel(status)}
                </AppStatusText>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-5">
              <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
                Verification code
              </div>

              <div className="mt-2">
                <Input
                  value={code}
                  onChange={(event) => setCode(onlyDigits(event.target.value))}
                  placeholder="000000"
                  appearance="large"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  disabled={status === "verified" || submitting}
                  invalid={status === "error"}
                  leftIcon={<Mail className="h-4 w-4" strokeWidth={2.1} />}
                />
              </div>

              <div className="mt-3 min-h-6 text-[13px] font-medium leading-6 text-text-muted">
                {message}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                {status === "verified" ? (
                  <Button
                    type="button"
                    size="md"
                    onClick={() => navigate("/", { replace: true })}
                    rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.15} />}
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="md"
                    loading={submitting}
                    disabled={!codeReady || submitting}
                    leftIcon={<CheckCircle2 className="h-4 w-4" strokeWidth={2.1} />}
                  >
                    Verify email
                  </Button>
                )}

                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  loading={resending}
                  disabled={submitting || resending || status === "verified"}
                  onClick={handleResend}
                  leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
                >
                  Resend code
                </Button>
              </div>
            </form>

            <div className="border-t border-line-soft px-5 py-4">
              <button
                type="button"
                onClick={() => navigate("/", { replace: true })}
                className="text-[12.5px] font-semibold text-text-muted transition-colors hover:text-text"
              >
                Return to workspace
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}