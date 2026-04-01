import express from "express";
import { requireOperatorSurfaceAccess } from "../../../utils/auth.js";
import { createLeadHandlers } from "./handlers.js";

export function leadsRoutes({ db, wsHub }) {
  const r = express.Router();

  const h = createLeadHandlers({ db, wsHub });

  r.post("/leads/ingest", h.ingestLead);
  r.get("/leads", requireOperatorSurfaceAccess, h.getLeads);
  r.get("/leads/by-thread/:threadId", requireOperatorSurfaceAccess, h.getLeadByInboxThreadId);
  r.get("/leads/:id", requireOperatorSurfaceAccess, h.getLeadById);
  r.get("/leads/:id/events", requireOperatorSurfaceAccess, h.getLeadEvents);
  r.post("/leads", h.createLead);
  r.post("/leads/:id", h.updateLead);
  r.post("/leads/:id/stage", h.updateLeadStageHandler);
  r.post("/leads/:id/status", h.updateLeadStatusHandler);
  r.post("/leads/:id/owner", h.updateLeadOwnerHandler);
  r.post("/leads/:id/followup", h.updateLeadFollowupHandler);
  r.post("/leads/:id/note", h.appendLeadNoteHandler);

  return r;
}
