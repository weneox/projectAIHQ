import express from "express";
import {
  requireOperatorSurfaceAccess,
  requireTenantPermission,
} from "../../../utils/auth.js";
import {
  listProposalsHandler,
  proposalDecisionHandler,
  requestChangesHandler,
  publishProposalHandler,
} from "./handlers.js";

export function proposalsRoutes({ db, wsHub }) {
  const r = express.Router();
  const requireProposalWrite = (req, res, next) =>
    requireTenantPermission(req, res, next, {
      resource: "proposals",
      action: "write",
    });
  const requireProposalDecision = (req, res, next) =>
    requireTenantPermission(req, res, next, {
      resource: "proposals",
      action: "decide",
    });
  const requireProposalPublish = (req, res, next) =>
    requireTenantPermission(req, res, next, {
      resource: "proposals",
      action: "publish",
    });

  r.get("/proposals", requireOperatorSurfaceAccess, (req, res) =>
    listProposalsHandler(req, res, { db, wsHub })
  );

  r.post("/proposals/:id/decision", requireProposalDecision, (req, res) =>
    proposalDecisionHandler(req, res, { db, wsHub })
  );

  r.post("/proposals/:id/request-changes", requireProposalWrite, (req, res) =>
    requestChangesHandler(req, res, { db, wsHub })
  );

  r.post("/proposals/:id/publish", requireProposalPublish, (req, res) =>
    publishProposalHandler(req, res, { db, wsHub })
  );

  return r;
}
