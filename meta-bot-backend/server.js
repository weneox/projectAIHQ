import "./env.js";
import express from "express";
import {
  createStructuredLogger,
  requestContextMiddleware,
} from "@aihq/shared-contracts/logger";

import {
  AIHQ_BASE_URL,
  AIHQ_INTERNAL_TOKEN,
  APP_ENV,
  PORT,
  REQUIRE_OPERATIONAL_READINESS_ON_BOOT,
} from "./src/config.js";
import { registerPublicPages } from "./src/routes/publicPages.js";
import { registerWebhookRoutes } from "./src/routes/webhook.js";
import { internalOutboundRoutes } from "./src/routes/internal.outbound.js";
import { checkAihqOperationalBootReadiness } from "./src/services/bootReadiness.js";
import {
  createHealthHandler,
  createRuntimeSignalsHandler,
} from "./src/services/healthRoute.js";
import { createAihqRuntimeIncidentClient } from "./src/services/aihqRuntimeIncidentClient.js";
import { configureRuntimeSignalPersistence } from "./src/services/runtimeReliability.js";

const app = express();
const logger = createStructuredLogger({
  service: "meta-bot-backend",
  env: APP_ENV,
});
const bootReadiness = await checkAihqOperationalBootReadiness({
  fetchFn: globalThis.fetch?.bind(globalThis),
  baseUrl: AIHQ_BASE_URL,
  internalToken: AIHQ_INTERNAL_TOKEN,
  appEnv: APP_ENV,
  requireOnBoot: REQUIRE_OPERATIONAL_READINESS_ON_BOOT,
  throwOnBlocked: false,
});
const runtimeIncidentClient = createAihqRuntimeIncidentClient();

configureRuntimeSignalPersistence((incident) =>
  runtimeIncidentClient.recordIncident({
    ...incident,
    service: "meta-bot-backend",
  })
);

logger.info("meta.boot_readiness.checked", {
  status: bootReadiness.status,
  reasonCode: bootReadiness.reasonCode,
  blockerReasonCodes: bootReadiness.blockerReasonCodes,
  blockersTotal: Number(bootReadiness.blockersTotal || 0),
  enforced: bootReadiness.enforced === true,
  intentionallyUnavailable: bootReadiness.intentionallyUnavailable === true,
});

app.disable("x-powered-by");
app.use(requestContextMiddleware({ logger }));

app.use(
  express.json({
    limit: "2mb",
    verify(req, _res, buf) {
      req.rawBody = Buffer.from(buf);
    },
  })
);

app.get("/", (_req, res) => {
  return res.status(200).send("Meta Bot Backend is working");
});

app.get(
  "/health",
  createHealthHandler({
    service: "meta-bot-backend",
    bootReadiness,
  })
);

app.get(
  "/runtime-signals",
  createRuntimeSignalsHandler({
    service: "meta-bot-backend",
    bootReadiness,
  })
);

app.use((req, res, next) => {
  if (
    !bootReadiness.intentionallyUnavailable ||
    req.path === "/health" ||
    req.path === "/runtime-signals"
  ) {
    return next();
  }

  return res.status(503).json({
    ok: false,
    error: "service_intentionally_unavailable",
    service: "meta-bot-backend",
    bootReadiness,
  });
});

registerPublicPages(app);
registerWebhookRoutes(app);
app.use(internalOutboundRoutes());

app.use((_req, res) => {
  return res.status(404).json({
    ok: false,
    error: "Not found",
  });
});

app.use((err, _req, res, next) => {
  try {
    (_req?.log || logger).error("meta.http.unhandled_error", err);
  } catch {}

  if (res.headersSent) return next(err);

  return res.status(500).json({
    ok: false,
    error: "Internal server error",
  });
});

app.listen(PORT, () => {
  logger.info("meta.app.started", {
    port: Number(PORT || 0),
    healthPath: "/health",
    runtimeSignalsPath: "/runtime-signals",
    webhookPath: "/webhook",
    internalOutboundPath: "/internal/outbound/send",
    intentionallyUnavailable: bootReadiness.intentionallyUnavailable === true,
    durableIncidentTrailEnabled: runtimeIncidentClient.canUse(),
  });
});
