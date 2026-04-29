import express from "express";

import { buildLaunchPosture } from "../../../services/launch/posture.js";
import { okJson } from "../../../utils/http.js";

export function launchRoutes({ db }) {
  const r = express.Router();

  r.get("/launch/posture", async (req, res) => {
    try {
      const payload = await buildLaunchPosture({ db, req });
      return okJson(res, payload);
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: "LaunchPostureFailed",
        reason: String(err?.message || "failed to load launch posture"),
      });
    }
  });

  return r;
}
