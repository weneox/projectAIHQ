import express from "express";
import { requireTenantPermission } from "../../../utils/auth.js";
import {
  getContentHandler,
  feedbackHandler,
  approveHandler,
  analyzeHandler,
  publishHandler,
} from "./handlers.js";

export function contentRoutes({ db, wsHub }) {
  const r = express.Router();
  const requireContentWrite = (req, res, next) =>
    requireTenantPermission(req, res, next, {
      resource: "content",
      action: "write",
    });
  const requireContentApprove = (req, res, next) =>
    requireTenantPermission(req, res, next, {
      resource: "content",
      action: "approve",
    });
  const requireContentPublish = (req, res, next) =>
    requireTenantPermission(req, res, next, {
      resource: "content",
      action: "publish",
    });

  r.get("/content", (req, res) => getContentHandler(req, res, { db, wsHub }));
  r.post("/content/:id/feedback", requireContentWrite, (req, res) =>
    feedbackHandler(req, res, { db, wsHub })
  );
  r.post("/content/:id/approve", requireContentApprove, (req, res) =>
    approveHandler(req, res, { db, wsHub })
  );
  r.post("/content/:id/analyze", requireContentWrite, (req, res) =>
    analyzeHandler(req, res, { db, wsHub })
  );
  r.post("/content/:id/publish", requireContentPublish, (req, res) =>
    publishHandler(req, res, { db, wsHub })
  );

  return r;
}
