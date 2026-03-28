import express from "express";
import { createInternalTokenGuard } from "../../../utils/auth.js";
import { createHealthHandlers } from "./handlers.js";

export function healthRoutes({ db }) {
  const r = express.Router();
  const { getApiRoot } = createHealthHandlers({ db });
  const requireSidecarHealth = createInternalTokenGuard({
    allowedServices: ["meta-bot-backend", "twilio-voice-backend"],
    allowedAudiences: ["aihq-backend.health"],
  });

  r.get("/", getApiRoot);
  r.get("/health", requireSidecarHealth, getApiRoot);

  return r;
}
