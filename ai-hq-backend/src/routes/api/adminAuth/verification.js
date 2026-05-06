import express from "express";

import {
  resendEmailVerificationCode,
  verifyEmailCode,
} from "../../../services/auth/emailVerificationCodes.js";
import { getIp, lower, s, setNoStore } from "./utils.js";

function errorMessage(code = "") {
  switch (s(code)) {
    case "verification_code_expired":
      return "That verification code expired. Request a new code to continue.";
    case "verification_code_invalid":
      return "That verification code is not correct. Check the six digits and try again.";
    case "verification_rate_limited":
      return "Too many attempts. Try again in a few minutes.";
    case "verification_resend_cooldown":
      return "A new code was sent recently. Try again when the cooldown ends.";
    case "verification_resend_rate_limited":
      return "Too many resend attempts. Try again in a few minutes.";
    default:
      return "Verification could not be completed. Try again.";
  }
}

export function userEmailVerificationRoutes({
  db,
  verifyCode = verifyEmailCode,
  resendCode = resendEmailVerificationCode,
} = {}) {
  const r = express.Router();

  r.post("/auth/verify-email-code", async (req, res) => {
    setNoStore(res);
    const email = lower(req.body?.email);
    const code = s(req.body?.code).replace(/\D/g, "");

    if (!email || !code) {
      return res.status(400).json({
        ok: false,
        error: "Enter your email and 6-digit verification code.",
        code: "verification_code_required",
      });
    }

    const result = await verifyCode(db, {
      email,
      code,
      ip: getIp(req),
      requestId: req.requestId,
    });

    if (!result.ok) {
      if (result.retryAfterSeconds) {
        res.setHeader("Retry-After", String(result.retryAfterSeconds));
      }
      return res.status(result.status || 400).json({
        ok: false,
        error: errorMessage(result.code),
        code: result.code,
        retryAfterSeconds: result.retryAfterSeconds || undefined,
      });
    }

    return res.status(200).json({
      ok: true,
      verified: true,
      email,
      message: "Email verified.",
    });
  });

  r.post("/auth/resend-verification-code", async (req, res) => {
    setNoStore(res);
    const email = lower(req.body?.email);
    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "Enter the email address you used to sign up.",
        code: "email_required",
      });
    }

    const result = await resendCode(db, {
      email,
      ip: getIp(req),
      requestId: req.requestId,
    });

    if (!result.ok) {
      if (result.retryAfterSeconds) {
        res.setHeader("Retry-After", String(result.retryAfterSeconds));
      }
      return res.status(result.status || 400).json({
        ok: false,
        error: errorMessage(result.code),
        code: result.code,
        retryAfterSeconds: result.retryAfterSeconds || undefined,
        cooldownSeconds: result.cooldownSeconds || undefined,
      });
    }

    return res.status(200).json({
      ok: true,
      email,
      codeSent: result.emailSent === true,
      expiresAt: result.expiresAt || null,
      expiresInSeconds: result.expiresInSeconds || 600,
      cooldownSeconds: result.cooldownSeconds || 60,
      resendCooldownSeconds: result.cooldownSeconds || 60,
    });
  });

  return r;
}
