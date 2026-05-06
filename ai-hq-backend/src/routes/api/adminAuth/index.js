import express from "express";
import { requireTrustedBrowserOriginForCookieAuth } from "../../../utils/adminAuth.js";
import { adminSessionRoutes } from "./session.js";
import { adminLoginRoutes } from "./admin.js";
import { userSignupRoutes } from "./signup.js";
import { userLoginRoutes } from "./user.js";
import { emailVerificationRoutes } from "./emailVerification.js";
import {
  createRateLimitMiddleware,
  requireAuthEndpointRateLimit,
  requireSignupRateLimit,
} from "../../../utils/rateLimit.js";

const requireEmailVerificationRateLimit = createRateLimitMiddleware({
  policyName: "email_verification",
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
});

export function adminAuthRoutes({ db, wsHub } = {}) {
  const r = express.Router();

  r.use("/admin-auth", requireTrustedBrowserOriginForCookieAuth);
  r.use("/auth", requireTrustedBrowserOriginForCookieAuth);
  r.use("/admin-auth/login", requireAuthEndpointRateLimit);
  r.use("/auth/login", requireAuthEndpointRateLimit);
  r.use("/auth/select-workspace", requireAuthEndpointRateLimit);
  r.use("/auth/signup", requireSignupRateLimit);
  r.use("/auth/verify-email", requireEmailVerificationRateLimit);
  r.use("/auth/resend-verification", requireEmailVerificationRateLimit);

  r.use(adminSessionRoutes({ db, wsHub }));
  r.use(adminLoginRoutes({ db, wsHub }));
  r.use(userSignupRoutes({ db, wsHub }));
  r.use(emailVerificationRoutes({ db, wsHub }));
  r.use(userLoginRoutes({ db, wsHub }));

  return r;
}
