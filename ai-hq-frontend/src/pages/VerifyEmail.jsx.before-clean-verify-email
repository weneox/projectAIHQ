import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Mail,
  RefreshCw,
} from "lucide-react";

import {
  resendVerificationEmail,
  verifyEmail,
} from "../api/auth.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import { InlineNotice } from "../components/ui/AppShellPrimitives.jsx";
import { clearAppSessionContext } from "../lib/appSession.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeCode(value = "") {
  return s(value).replace(/\D/g, "").slice(0, 6);
}

function getFriendlyVerifyError(error) {
  const code = s(error?.payload?.code || error?.code).toLowerCase();
  const message = s(
    error?.payload?.error ||
      error?.payload?.message ||
      error?.message
  );

  if (code === "verification_code_expired") {
    return {
      title: "Verification code expired",
      description: "Request a new verification code and try again.",
    };
  }

  if (code === "invalid_verification_code") {
    return {
      title: "Invalid verification code",
      description: "Enter the 6-digit code from your latest email.",
    };
  }

  if (code === "auth_required") {
    return {
      title: "Sign in again",
      description: "Sign in again, then enter the verification code.",
    };
  }

  if (code === "verification_token_expired") {
    return {
      title: "Verification link expired",
      description: "Request a new verification code and try again.",
    };
  }

  if (code === "invalid_verification_token" || code === "token_required") {
    return {
      title: "Invalid verification link",
      description: "Use the 6-digit verification code from your latest email.",
    };
  }

  if (code === "verification_resend_cooldown") {
    return {
      title: "Wait before resending",
      description: "A new code was sent recently. Check your inbox first.",
    };
  }

  if (code === "verification_resend_hourly_limited") {
    return {
      title: "Too many codes requested",
      description: "Try again later.",
    };
  }

  return {
    title: "Email verification failed",
    description: message || "We could not verify this email. Try again.",
  };
}

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = useMemo(
    () => s(searchParams.get("token")),
    [searchParams]
  );

  const sent = useMemo(
    () => ["1", "true", "yes"].includes(s(searchParams.get("sent")).toLowerCase()),
    [searchParams]
  );

  const [status, setStatus] = useState(token ? "verifying" : "code");
  const [verificationCode, setVerificationCode] = useState("");
  const [message, setMessage] = useState(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!token) {
        setStatus("code");
        setMessage({
          title: sent ? "Check your email" : "Verify your email",
          description: sent
            ? "We sent a 6-digit verification code to your email."
            : "Enter the 6-digit verification code from your latest email.",
        });
        return;
      }

      try {
        setStatus("verifying");
        setMessage(null);

        const result = await verifyEmail({ token });

        if (!alive) return;

        clearAppSessionContext();
        setStatus("verified");
        setMessage({
          title: result?.alreadyVerified
            ? "Email already verified"
            : "Email verified",
          description: result?.alreadyVerified
            ? "This email was already verified. You can continue to your workspace."
            : "Your email has been verified. You can continue to your workspace.",
        });
      } catch (error) {
        if (!alive) return;

        setStatus("failed");
        setMessage(getFriendlyVerifyError(error));
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [token, sent]);

  async function handleVerifyCode(event) {
    event?.preventDefault?.();

    const code = normalizeCode(verificationCode);
    if (code.length !== 6) {
      setMessage({
        title: "Enter the 6-digit code",
        description: "The verification code should contain exactly 6 digits.",
      });
      return;
    }

    try {
      setStatus("verifying");
      setMessage(null);

      const result = await verifyEmail({ code });

      clearAppSessionContext();

      setStatus("verified");
      setMessage({
        title: result?.alreadyVerified
          ? "Email already verified"
          : "Email verified",
        description: result?.alreadyVerified
          ? "This email was already verified. You can continue to your workspace."
          : "Your email has been verified. You can continue to your workspace.",
      });
    } catch (error) {
      setStatus("failed");
      setMessage(getFriendlyVerifyError(error));
    }
  }

  async function handleResend() {
    if (resending) return;

    try {
      setResending(true);
      setResendMessage(null);

      const result = await resendVerificationEmail();

      if (result?.alreadyVerified) {
        clearAppSessionContext();
        setStatus("verified");
        setResendMessage({
          tone: "success",
          title: "Already verified",
          description: "Your email is already verified.",
        });
        return;
      }

      if (result?.sent) {
        setResendMessage({
          tone: "success",
          title: "Verification code sent",
          description: "Check your inbox for a new 6-digit code.",
        });
        return;
      }

      setResendMessage({
        tone: "warning",
        title: "Verification code created",
        description:
          "Email delivery is not configured yet. Check RESEND_API_KEY and AUTH_EMAIL_FROM in production.",
      });
    } catch (error) {
      const friendly = getFriendlyVerifyError(error);
      setResendMessage({
        tone: "danger",
        title: friendly.title || "Could not resend code",
        description:
          friendly.description ||
          s(error?.payload?.error || error?.message) ||
          "Sign in again and try resending the verification code.",
      });
    } finally {
      setResending(false);
    }
  }

  const verified = status === "verified";
  const verifying = status === "verifying";
  const codeReady = normalizeCode(verificationCode).length === 6;

  return (
    <div className="min-h-screen bg-white text-text">
      <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center px-6 py-10">
        <Card padded="lg" className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] border border-line-soft bg-surface-muted">
            {verified ? (
              <CheckCircle2 className="h-7 w-7 text-success" strokeWidth={2.1} />
            ) : verifying ? (
              <RefreshCw className="h-7 w-7 animate-spin text-text-muted" strokeWidth={2.1} />
            ) : (
              <AlertCircle className="h-7 w-7 text-warning" strokeWidth={2.1} />
            )}
          </div>

          <h1 className="mt-6 font-display text-[38px] font-semibold leading-[0.98] tracking-[var(--tracking-tight-xl)] text-text">
            {verified
              ? "Email verified"
              : verifying
                ? "Verifying email"
                : "Check your email"}
          </h1>

          <p className="mx-auto mt-4 max-w-[420px] text-[15px] font-medium leading-6 text-text-muted">
            {message?.description ||
              "Enter the 6-digit verification code from your latest email."}
          </p>

          {!verified && !token ? (
            <form className="mx-auto mt-7 max-w-[340px] space-y-3" onSubmit={handleVerifyCode}>
              <input
                name="verificationCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verificationCode}
                onChange={(event) => setVerificationCode(normalizeCode(event.target.value))}
                placeholder="6-digit code"
                className="h-14 w-full rounded-[18px] border border-line bg-white px-5 text-center text-[24px] font-semibold tracking-[0.3em] text-text outline-none transition-colors duration-base ease-premium placeholder:text-[15px] placeholder:tracking-normal placeholder:text-text-subtle focus:border-brand"
              />

              <Button
                type="submit"
                size="hero"
                fullWidth
                disabled={!codeReady || verifying}
                loading={verifying}
                rightIcon={
                  !verifying ? <ArrowRight className="h-4 w-4" strokeWidth={2.2} /> : undefined
                }
              >
                Verify email
              </Button>
            </form>
          ) : null}

          {message && !verified && status === "failed" ? (
            <div className="mt-6 text-left">
              <InlineNotice
                tone="danger"
                title={message.title}
                description={message.description}
                compact
              />
            </div>
          ) : null}

          {resendMessage ? (
            <div className="mt-6 text-left">
              <InlineNotice
                tone={resendMessage.tone}
                title={resendMessage.title}
                description={resendMessage.description}
                compact
              />
            </div>
          ) : null}

          <div className="mt-8 space-y-3">
            {verified ? (
              <Button
                type="button"
                size="hero"
                fullWidth
                rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.2} />}
                onClick={() => navigate("/home", { replace: true })}
              >
                Continue to workspace
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="hero"
                fullWidth
                loading={resending}
                rightIcon={
                  !resending ? <Mail className="h-4 w-4" strokeWidth={2.2} /> : undefined
                }
                onClick={handleResend}
              >
                {resending ? "Sending..." : "Resend code"}
              </Button>
            )}

            <Link
              to="/login"
              className="inline-flex text-[14px] font-semibold text-text-muted underline underline-offset-[3px] transition-colors hover:text-text"
            >
              Back to sign in
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
