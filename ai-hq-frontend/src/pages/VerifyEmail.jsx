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

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function getFriendlyVerifyError(error) {
  const code = s(error?.payload?.code || error?.code).toLowerCase();
  const message = s(
    error?.payload?.error ||
      error?.payload?.message ||
      error?.message
  );

  if (code === "verification_token_expired") {
    return {
      title: "Verification link expired",
      description: "Request a new verification email from your workspace.",
    };
  }

  if (code === "invalid_verification_token") {
    return {
      title: "Invalid verification link",
      description: "This verification link is invalid or has already expired.",
    };
  }

  if (code === "token_required") {
    return {
      title: "Verification token missing",
      description: "Open the verification link from your email.",
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

  const [status, setStatus] = useState(token ? "verifying" : "missing");
  const [message, setMessage] = useState(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!token) {
        setStatus("missing");
        setMessage({
          title: "Verification token missing",
          description: "Open the verification link from your email.",
        });
        return;
      }

      try {
        setStatus("verifying");
        setMessage(null);

        const result = await verifyEmail(token);

        if (!alive) return;

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
  }, [token]);

  async function handleResend() {
    if (resending) return;

    try {
      setResending(true);
      setResendMessage(null);

      const result = await resendVerificationEmail();

      if (result?.alreadyVerified) {
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
          title: "Verification email sent",
          description: "Check your inbox for a new verification link.",
        });
        return;
      }

      setResendMessage({
        tone: "warning",
        title: "Verification link created",
        description:
          "Email delivery is not configured yet. Configure RESEND_API_KEY and AUTH_EMAIL_FROM in production.",
      });
    } catch (error) {
      setResendMessage({
        tone: "danger",
        title: "Could not resend email",
        description:
          s(error?.payload?.error || error?.message) ||
          "Sign in again and try resending the verification email.",
      });
    } finally {
      setResending(false);
    }
  }

  const verified = status === "verified";
  const verifying = status === "verifying";

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
              <AlertCircle className="h-7 w-7 text-danger" strokeWidth={2.1} />
            )}
          </div>

          <h1 className="mt-6 font-display text-[38px] font-semibold leading-[0.98] tracking-[var(--tracking-tight-xl)] text-text">
            {verified
              ? "Email verified"
              : verifying
                ? "Verifying email"
                : "Verify your email"}
          </h1>

          <p className="mx-auto mt-4 max-w-[420px] text-[15px] font-medium leading-6 text-text-muted">
            {message?.description ||
              "We are checking your verification link."}
          </p>

          {message && !verified ? (
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
                size="hero"
                fullWidth
                loading={resending}
                rightIcon={
                  !resending ? <Mail className="h-4 w-4" strokeWidth={2.2} /> : undefined
                }
                onClick={handleResend}
              >
                {resending ? "Sending..." : "Resend verification email"}
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
