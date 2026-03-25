import express from "express";
import { requireTenantPermission } from "../../../utils/auth.js";
import { createNotificationHandlers } from "./handlers.js";

export function notificationsRoutes({ db, wsHub }) {
  const r = express.Router();
  const requireNotificationOperator = (req, res, next) =>
    requireTenantPermission(req, res, next, {
      allowedRoles: ["owner", "admin"],
    });
  const { getNotifications, postNotificationRead } = createNotificationHandlers({
    db,
    wsHub,
  });

  r.get("/notifications", requireNotificationOperator, getNotifications);
  r.post("/notifications/:id/read", requireNotificationOperator, postNotificationRead);

  return r;
}
