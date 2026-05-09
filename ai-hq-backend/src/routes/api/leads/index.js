import express from "express";
import { requireOperatorSurfaceAccess } from "../../../utils/auth.js";
import { createLeadHandlers } from "./handlers.js";

export function leadsRoutes({ db, wsHub }) {
  const r = express.Router();

  const h = createLeadHandlers({ db, wsHub });

  r.get("/customers", requireOperatorSurfaceAccess, h.getCustomers);
  r.get("/leads", requireOperatorSurfaceAccess, h.getLeads);
  r.get("/leads/by-thread/:threadId", requireOperatorSurfaceAccess, h.getLeadByInboxThreadId);
  r.get("/leads/:id", requireOperatorSurfaceAccess, h.getLeadById);
  r.get("/leads/:id/events", requireOperatorSurfaceAccess, h.getLeadEvents);
  r.post("/leads", requireOperatorSurfaceAccess, h.createLead);
  r.post("/leads/:id", requireOperatorSurfaceAccess, h.updateLead);
  r.post("/leads/:id/stage", requireOperatorSurfaceAccess, h.updateLeadStageHandler);
  r.post("/leads/:id/status", requireOperatorSurfaceAccess, h.updateLeadStatusHandler);
  r.post("/leads/:id/owner", requireOperatorSurfaceAccess, h.updateLeadOwnerHandler);
  r.post("/leads/:id/followup", requireOperatorSurfaceAccess, h.updateLeadFollowupHandler);
  r.post("/leads/:id/note", requireOperatorSurfaceAccess, h.appendLeadNoteHandler);

  return r;
}

export function leadsInternalRoutes({ db, wsHub }) {
  const r = express.Router();
  const h = createLeadHandlers({ db, wsHub });
  r.post("/leads/ingest", h.ingestLead);
  return r;
}
