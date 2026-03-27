// ai-hq-backend/src/routes/api/incidents/index.js

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

function writeJsonAndFinish(res, next, statusCode, payload) {
  res.status(statusCode).json(payload);
  if (typeof next === "function") next();
  return res;
}

export function incidentsRoutes({ db }) {
  const router = express.Router();

  router.get(
    "/incidents",
    requireOperatorSurfaceAccess,
    async (req, res, next) => {
      if (!isDbReady(db)) {
        return writeJsonAndFinish(
          serviceUnavailableJson(
            res,
            "database unavailable; durable incident history requires persistent storage"
          ),
          next,
          res.statusCode || 503,
          res.body || {
            ok: false,
            error:
              "database unavailable; durable incident history requires persistent storage",
          }
        );
      }

      try {
        const limit = clamp(req.query.limit ?? 50, 1, 100);
        const service = s(req.query.service);
        const severity = s(req.query.severity);
        const reasonCode = s(req.query.reasonCode);
        const sinceHours = clamp(req.query.sinceHours ?? 24, 0, 24 * 30);

        const incidents = await listRecentRuntimeIncidents({
          db,
          limit,
          service,
          severity,
          reasonCode,
          sinceHours,
        });

        return writeJsonAndFinish(res, next, 200, {
          ok: true,
          incidents,
          filters: {
            service: service || "",
            severity: severity || "",
            reasonCode: reasonCode || "",
            sinceHours,
            limit,
          },
          retentionPolicy: getIncidentRetentionPolicy(),
        });
      } catch (error) {
        return writeJsonAndFinish(res, next, 500, {
          ok: false,
          error: "runtime_incidents_list_failed",
          reason: String(error?.message || error || "runtime_incidents_list_failed"),
        });
      }
    }
  );

  return router;
}

export const __test__ = {
  getIncidentRetentionPolicy,
};