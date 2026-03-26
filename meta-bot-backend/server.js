import "dotenv/config";
import express from "express";

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

const app = express();
const bootReadiness = await checkAihqOperationalBootReadiness({
  fetchFn: globalThis.fetch?.bind(globalThis),
  baseUrl: AIHQ_BASE_URL,
  internalToken: AIHQ_INTERNAL_TOKEN,
  appEnv: APP_ENV,
  requireOnBoot: REQUIRE_OPERATIONAL_READINESS_ON_BOOT,
  throwOnBlocked: false,
});

app.disable("x-powered-by");

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

app.get("/health", (_req, res) => {
  const statusCode = bootReadiness.intentionallyUnavailable ? 503 : 200;
  return res.status(statusCode).json({
    ok: !bootReadiness.intentionallyUnavailable,
    service: "meta-bot-backend",
    readiness: {
      status: bootReadiness.status,
      reasonCode: bootReadiness.reasonCode,
      blockerReasonCodes: bootReadiness.blockerReasonCodes,
      intentionallyUnavailable: bootReadiness.intentionallyUnavailable,
      dependency: bootReadiness.dependency,
      aihq: bootReadiness.aihq,
      localDecision: bootReadiness.localDecision,
    },
    bootReadiness,
  });
});

app.use((req, res, next) => {
  if (!bootReadiness.intentionallyUnavailable || req.path === "/health") {
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
    console.error("[meta-bot] unhandled error", {
      message: String(err?.message || err),
    });
  } catch {}

  if (res.headersSent) return next(err);

  return res.status(500).json({
    ok: false,
    error: "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log("[meta-bot] listening on", PORT);
  console.log("[meta-bot] HEALTH:", "/health");
  console.log("[meta-bot] PRIVACY:", "/privacy");
  console.log("[meta-bot] TERMS:", "/terms");
  console.log("[meta-bot] WEBHOOK:", "/webhook");
  console.log("[meta-bot] INTERNAL OUTBOUND:", "/internal/outbound/send");
});
