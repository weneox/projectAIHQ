import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import http from "http";
import twilio from "twilio";
import * as ws from "ws";
import {
  createStructuredLogger,
  requestContextMiddleware,
} from "@aihq/shared-contracts/logger";

import { cfg } from "./src/config.js";
import { twilioRouter } from "./src/routes/twilio.js";
import { attachRealtimeBridge } from "./src/services/realtimeBridge.js";
import { createReporters } from "./src/services/reporting.js";
import { checkAihqOperationalBootReadiness } from "./src/services/bootReadiness.js";
import {
  createHealthHandler,
  createRuntimeSignalsHandler,
} from "./src/services/healthRoute.js";
import { createAihqRuntimeIncidentClient } from "./src/services/aihqRuntimeIncidentClient.js";
import { configureRuntimeSignalPersistence } from "./src/services/runtimeObservability.js";

function normalizeOriginList(value = "") {
  return String(value || "")
    .split(",")
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

const allowedOrigins = Array.from(
  new Set(normalizeOriginList(cfg.CORS_ORIGIN || cfg.PUBLIC_BASE_URL))
);

const app = express();
const server = http.createServer(app);
const logger = createStructuredLogger({
  service: "twilio-voice-backend",
  env: cfg.APP_ENV,
});
const WebSocketServer =
  ws.WebSocketServer || ws.Server || ws.default?.WebSocketServer || ws.default?.Server;
const startupSmoke = ["1", "true", "yes"].includes(
  String(process.env.STARTUP_SMOKE || "").trim().toLowerCase()
);

if (typeof WebSocketServer !== "function") {
  throw new TypeError("WebSocketServer constructor unavailable");
}

if (cfg.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.use(requestContextMiddleware({ logger }));

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

if (cfg.ENABLE_HSTS) {
  app.use(
    helmet.hsts({
      maxAge: 15552000,
      includeSubDomains: true,
      preload: true,
    })
  );
}

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.urlencoded({ extended: false, limit: "2mb" }));
app.use(express.json({ limit: "6mb", strict: true }));

app.use("/", twilioRouter());

function getTwilioClient() {
  if (!cfg.TWILIO_ACCOUNT_SID || !cfg.TWILIO_API_KEY || !cfg.TWILIO_API_SECRET) return null;
  return twilio(cfg.TWILIO_API_KEY, cfg.TWILIO_API_SECRET, {
    accountSid: cfg.TWILIO_ACCOUNT_SID,
  });
}

async function getFetch() {
  if (globalThis.fetch) return globalThis.fetch.bind(globalThis);
  const mod = await import("undici");
  return mod.fetch;
}

const fetchFn = await getFetch();
const bootReadiness = await checkAihqOperationalBootReadiness({
  fetchFn,
  baseUrl: cfg.AIHQ_BASE_URL,
  internalToken: cfg.AIHQ_INTERNAL_TOKEN,
  appEnv: cfg.APP_ENV,
  requireOnBoot: cfg.REQUIRE_OPERATIONAL_READINESS_ON_BOOT,
  throwOnBlocked: false,
});
const runtimeIncidentClient = createAihqRuntimeIncidentClient({
  fetchFn,
});

configureRuntimeSignalPersistence((incident) =>
  runtimeIncidentClient.recordIncident({
    ...incident,
    service: "twilio-voice-backend",
  })
);

logger.info("voice.boot_readiness.checked", {
  status: bootReadiness.status,
  reasonCode: bootReadiness.reasonCode,
  blockerReasonCodes: bootReadiness.blockerReasonCodes,
  blockersTotal: Number(bootReadiness.blockersTotal || 0),
  enforced: bootReadiness.enforced === true,
  intentionallyUnavailable: bootReadiness.intentionallyUnavailable === true,
});

app.get(
  "/health",
  createHealthHandler({
    service: "twilio-voice-backend",
    bootReadiness,
  })
);

app.get(
  "/runtime-signals",
  createRuntimeSignalsHandler({
    service: "twilio-voice-backend",
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
    service: "twilio-voice-backend",
    bootReadiness,
  });
});

if (!startupSmoke) {
  const wss = new WebSocketServer({
    server,
    path: "/twilio/stream",
  });

  const reporters = createReporters({
    fetchFn,
    redis: null,
    PUBLIC_BASE_URL: cfg.PUBLIC_BASE_URL,
    OPENAI_API_KEY: cfg.OPENAI_API_KEY,
    OPENAI_MODEL: "gpt-4.1-mini",
  });

  attachRealtimeBridge({
    wss,
    OPENAI_API_KEY: cfg.OPENAI_API_KEY,
    DEBUG_REALTIME: cfg.DEBUG_REALTIME,
    PUBLIC_BASE_URL: cfg.PUBLIC_BASE_URL,
    reporters,
    twilioClient: getTwilioClient(),
    REALTIME_MODEL: cfg.OPENAI_REALTIME_MODEL,
    REALTIME_VOICE: cfg.OPENAI_REALTIME_VOICE,
    RECONNECT_MAX: cfg.OPENAI_REALTIME_RECONNECT_MAX,
  });
}

app.use((err, req, res, next) => {
  try {
    (req?.log || logger).error("voice.http.unhandled_error", err, {
      path: String(req?.originalUrl || req?.url || "").trim(),
      method: String(req?.method || "").trim(),
    });
  } catch {}

  if (res.headersSent) return next(err);

  return res.status(500).json({
    ok: false,
    error: "internal_server_error",
  });
});

if (startupSmoke) {
  logger.info("voice.app.startup_smoke.ok", {
    healthPath: "/health",
    runtimeSignalsPath: "/runtime-signals",
    streamPath: "/twilio/stream",
    intentionallyUnavailable: bootReadiness.intentionallyUnavailable === true,
  });
} else {
  server.listen(cfg.PORT, "0.0.0.0", () => {
    logger.info("voice.app.started", {
      port: Number(cfg.PORT || 0),
      healthPath: "/health",
      runtimeSignalsPath: "/runtime-signals",
      streamPath: "/twilio/stream",
      intentionallyUnavailable: bootReadiness.intentionallyUnavailable === true,
      durableIncidentTrailEnabled: runtimeIncidentClient.canUse(),
    });
  });
}
