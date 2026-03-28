import express from "express";
import { requireInternalToken } from "../../../../utils/auth.js";
import { getTenantBrainRuntime } from "../../../../services/businessBrain/getTenantBrainRuntime.js";
import { createInboxIngestHandler } from "./ingest.js";
import { createInboxOutboundHandler } from "./outbound.js";

export function inboxInternalRoutes({
  db,
  wsHub,
  getRuntime = getTenantBrainRuntime,
  buildActions,
  persistLead,
  applyHandoff,
} = {}) {
  const router = express.Router();

  router.post(
    "/inbox/ingest",
    requireInternalToken,
    createInboxIngestHandler({
      db,
      wsHub,
      getRuntime,
      buildActions,
      persistLead,
      applyHandoff,
    })
  );

  router.post(
    "/inbox/outbound",
    requireInternalToken,
    createInboxOutboundHandler({ db, wsHub })
  );

  return router;
}
