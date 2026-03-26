import express from "express";

import { requireOperatorSurfaceAccess } from "../../../utils/auth.js";
import { clamp, isDbReady, serviceUnavailableJson } from "../../../utils/http.js";
import { listRecentRuntimeIncidents } from "../../../services/runtimeIncidentTrail.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function getIncidentRetentionPolicy() {
  return {
    retainDays: 14,
    maxRows: 5000,
    pruneIntervalHours: 6,
  };
}

export function incidentsRoutes({ db }) {
  const router = express.Router();

  router.get("/incidents", requireOperatorSurfaceAccess, async (req, res) => {
    if (!isDbReady(db)) {
      return serviceUnavailableJson(
        res,
        "database unavailable; durable incident history requires persistent storage"
      );
    }

    try {
      const incidents = await listRecentRuntimeIncidents({
        db,
        limit: clamp(req.query.limit ?? 50, 1, 100),
        service: s(req.query.service),
        severity: s(req.query.severity),
        reasonCode: s(req.query.reasonCode),
        sinceHours: clamp(req.query.sinceHours ?? 24, 0, 24 * 30),
      });

      return res.status(200).json({
        ok: true,
        incidents,
        filters: {
          service: s(req.query.service) || "",
          severity: s(req.query.severity) || "",
          reasonCode: s(req.query.reasonCode) || "",
          sinceHours: clamp(req.query.sinceHours ?? 24, 0, 24 * 30),
          limit: clamp(req.query.limit ?? 50, 1, 100),
        },
        retentionPolicy: getIncidentRetentionPolicy(),
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: "runtime_incidents_list_failed",
        reason: String(error?.message || error || "runtime_incidents_list_failed"),
      });
    }
  });

  return router;
}

export const __test__ = {
  getIncidentRetentionPolicy,
};
