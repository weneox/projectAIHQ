import express from "express";
import { requireTrustedBrowserOriginForCookieAuth } from "../../../utils/adminAuth.js";
import { adminSessionRoutes } from "./session.js";
import { adminLoginRoutes } from "./admin.js";
import { userSignupRoutes } from "./signup.js";
import { userLoginRoutes } from "./user.js";

export function adminAuthRoutes({ db, wsHub } = {}) {
  const r = express.Router();

  // This router is mounted at /api before the main API router.
  // Scope browser-origin CSRF checks only to real auth endpoints so
  // public provider webhooks under /api/* can fall through to their
  // own public handlers.
  r.use("/admin-auth", requireTrustedBrowserOriginForCookieAuth);
  r.use("/auth", requireTrustedBrowserOriginForCookieAuth);

  r.use(adminSessionRoutes({ db, wsHub }));
  r.use(adminLoginRoutes({ db, wsHub }));
  r.use(userSignupRoutes({ db, wsHub }));
  r.use(userLoginRoutes({ db, wsHub }));

  return r;
}