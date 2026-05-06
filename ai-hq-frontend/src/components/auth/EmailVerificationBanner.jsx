import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Mail } from "lucide-react";

import { resendVerificationEmail } from "../../api/auth.js";
import {
  getAppAuthContext,
  clearAppAuthContext,
} from "../../lib/appSession.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function isEmailVerified(auth) {
  return (
    auth?.user?.emailVerified === true ||
    auth?.user?.email_verified === true ||
    auth?.identity?.emailVerified === true ||
    auth?.identity?.email_verified === true
  );
}

function userEmail(auth) {
  return s(
    auth?.user?.email ||
      auth?.identity?.email ||
      auth?.raw?.user?.email ||
      ""
  );
}

export default function EmailVerificationBanner() {
  const [state, setState] = useState({
    loading: true,
    visible: false,
    email: "",
  });
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const auth = await getAppAuthContext({ force: true });
        if (!alive) return;

        const authenticated = auth?.authenticated === true;
        const verified = isEmailVerified(auth);

        setState({
          loading: false,
          visible: authenticated && !verified,
          email: userEmail(auth),
        });
      } catch {
        if (!alive) return;
        setState({
          loading: false,
          visible: false,
          email: "",
        });
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  async function handleResend() {
    if (sending) return;

    try {
      setSending(true);
      setNotice(null);

      const result = await resendVerificationEmail();

      if (result?.alreadyVerified) {
        clearAppAuthContext();
        setState((current) => ({
          ...current,
          visible: false,
        }));
        setNotice({
          tone: "success",
          message: "Email already verified.",
        });
        return;
      }

      if (result?.sent) {
        setNotice({
          tone: "success",
          message: "Verification email sent. Check your inbox.",
        });
        return;
      }

      setNotice({
        tone: "warning",
        message:
          "Verification link was created, but email delivery is not configured yet.",
      });
    } catch (error) {
      setNotice({
        tone: "danger",
        message:
          s(error?.payload?.error || error?.message) ||
          "Could not resend verification email.",
      });
    } finally {
      setSending(false);
    }
  }

  if (state.loading || !state.visible || dismissed) {
    return null;
  }

  return (
    <div className="fixed left-0 right-0 top-[42px] z-[121] border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-950 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.45)] md:left-[var(--shell-sidebar-w)]">
      <div className="mx-auto flex max-w-shell-content flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-amber-100 text-amber-700">
            {notice?.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} />
            ) : (
              <AlertCircle className="h-4 w-4" strokeWidth={2.2} />
            )}
          </span>

          <div className="min-w-0">
            <div className="text-[13px] font-semibold leading-5 tracking-[var(--tracking-tight-sm)]">
              Verify your email to secure this workspace
            </div>

            <div className="text-[12.5px] font-medium leading-5 text-amber-900/80">
              {notice?.message ||
                `We sent a verification link${state.email ? ` to ${state.email}` : ""}. Some sensitive actions stay limited until verification is complete.`}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 pl-10 sm:pl-0">
          <button
            type="button"
            onClick={handleResend}
            disabled={sending}
            className="inline-flex h-8 items-center gap-2 rounded-[10px] bg-amber-950 px-3 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={2.2} />
            {sending ? "Sending..." : "Resend"}
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="inline-flex h-8 items-center rounded-[10px] px-2 text-[12px] font-semibold text-amber-950/70 transition-colors hover:bg-amber-100 hover:text-amber-950"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
