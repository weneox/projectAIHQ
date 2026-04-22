import express from "express";
import { createInternalTokenGuard } from "../../../utils/auth.js";
import { createHealthHandlers } from "./handlers.js";

export function healthRoutes({ db }) {
  const r = express.Router();
  const { getApiRoot, getWebsiteLane } = createHealthHandlers({ db });
  const requireSidecarHealth = createInternalTokenGuard({
    allowedServices: ["meta-bot-backend", "twilio-voice-backend"],
    allowedAudiences: ["aihq-backend.health"],
  });
  const requireWebsiteLaneHealth = createInternalTokenGuard({
    allowedAudiences: [
      "aihq-backend.health",
      "aihq-backend.health.website-lane",
    ],
  });

  r.get("/", getApiRoot);
  r.get("/health", requireSidecarHealth, getApiRoot);
  r.get("/health/website-lane", requireWebsiteLaneHealth, getWebsiteLane);

  return r;
}
