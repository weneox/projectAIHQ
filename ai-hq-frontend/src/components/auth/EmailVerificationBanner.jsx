import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Mail, X } from "lucide-react";

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

export default function EmailVerificationBanner({
  statsMessage = "",
  onStatsDismiss = null,
} = {}) {
  const navigate = useNavigate();
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

  const emailVisible =
    state.loading !== true && state.visible === true && dismissed !== true;
  const statsVisible = Boolean(s(statsMessage));
  const bannerVisible = emailVisible || statsVisible;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    window.dispatchEvent(
      new CustomEvent("aihq:top-banner-visibility", {
        detail: { visible: bannerVisible },
      })
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent("aihq:top-banner-visibility", {
          detail: { visible: false },
        })
      );
    };
  }, [bannerVisible]);

  const title = emailVisible
    ? "Verify your email to secure this workspace"
    : "Workspace stats unavailable";

  const description = emailVisible
    ? notice?.message ||
      `We sent a 6-digit verification code${state.email ? ` to ${state.email}` : ""}. Some sensitive actions stay limited until verification is complete.`
    : s(statsMessage);

  const Icon = notice?.tone === "success" ? CheckCircle2 : AlertCircle;

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
          message: "Verification code sent. Check your inbox.",
        });
        return;
      }

      setNotice({
        tone: "warning",
        message:
          "Verification code was created, but email delivery is not configured yet.",
      });
    } catch (error) {
      const retryAfter = error?.payload?.retryAfterSeconds;
      setNotice({
        tone: "danger",
        message: retryAfter
          ? `Wait ${retryAfter} seconds before requesting another code.`
          : s(error?.payload?.error || error?.message) ||
            "Could not resend verification code.",
      });
    } finally {
      setSending(false);
    }
  }

  function handleDismiss() {
    if (emailVisible) setDismissed(true);
    if (statsVisible && typeof onStatsDismiss === "function") {
      onStatsDismiss();
    }
  }

  const statsInline = useMemo(() => {
    if (!emailVisible || !statsVisible) return "";
    return `Workspace stats: ${s(statsMessage)}`;
  }, [emailVisible, statsMessage, statsVisible]);

  if (!bannerVisible) {
    return null;
  }

  return (
    <div className="fixed left-0 right-0 top-0 z-[121] border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-950 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.45)] md:left-[var(--shell-sidebar-w)]">
      <div className="mx-auto flex max-w-shell-content flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-amber-100 text-amber-700">
            <Icon className="h-4 w-4" strokeWidth={2.2} />
          </span>

          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-5 tracking-[var(--tracking-tight-sm)]">
              {title}
              {statsInline ? (
                <span className="ml-2 font-medium text-amber-900/70">
                  · {statsInline}
                </span>
              ) : null}
            </div>

            <div className="truncate text-[12.5px] font-medium leading-5 text-amber-900/80">
              {description}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 pl-10 sm:pl-0">
          {emailVisible ? (
            <>
              <button
                type="button"
                onClick={() => navigate("/verify-email?sent=1")}
                className="inline-flex h-8 items-center rounded-[10px] bg-amber-950 px-3 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Verify now
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={sending}
                className="inline-flex h-8 items-center gap-2 rounded-[10px] border border-amber-300 bg-amber-100 px-3 text-[12px] font-semibold text-amber-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Mail className="h-3.5 w-3.5" strokeWidth={2.2} />
                {sending ? "Sending..." : "Resend code"}
              </button>
            </>
          ) : null}

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            title="Dismiss"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-amber-950/70 transition-colors hover:bg-amber-100 hover:text-amber-950"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}
