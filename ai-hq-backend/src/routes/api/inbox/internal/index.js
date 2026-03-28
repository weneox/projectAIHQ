import express from "express";
import { createInternalTokenGuard } from "../../../../utils/auth.js";
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
  const requireMetaInboxIngest = createInternalTokenGuard({
    allowedServices: ["meta-bot-backend"],
    allowedAudiences: ["aihq-backend.inbox.ingest"],
  });
  const requireMetaInboxOutbound = createInternalTokenGuard({
    allowedServices: ["meta-bot-backend"],
    allowedAudiences: ["aihq-backend.inbox.outbound"],
  });

  router.post(
    "/inbox/ingest",
    requireMetaInboxIngest,
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
    requireMetaInboxOutbound,
    createInboxOutboundHandler({ db, wsHub })
  );

  return router;
}
