import express from "express";
import { requireOperatorSurfaceAccess } from "../../../utils/auth.js";
import { requireExecutionCallbackRateLimit } from "../../../utils/rateLimit.js";
import { requireInternalToken } from "../../../utils/auth.js";
import {
  enqueueVoiceSyncExecutionRequest,
  recordRuntimeIncidentRequest,
  getDurableExecutionById,
  getDurableExecutionSummary,
  listExecutions,
  listDurableExecutions,
  retryDurableExecution,
  getExecutionById,
  executionCallback,
} from "./handlers.js";

export function executionsRoutes({ db, wsHub }) {
  const r = express.Router();

  r.post("/internal/executions/voice-sync", requireInternalToken, (req, res) => {
    return enqueueVoiceSyncExecutionRequest(req, res, { db, wsHub });
  });

  r.post("/internal/runtime-signals/incidents", requireInternalToken, (req, res) => {
    return recordRuntimeIncidentRequest(req, res, { db, wsHub });
  });

  r.get("/executions", requireOperatorSurfaceAccess, (req, res) => {
    return listExecutions(req, res, { db, wsHub });
  });

  r.get("/executions/durable", requireOperatorSurfaceAccess, (req, res) => {
    return listDurableExecutions(req, res, { db, wsHub });
  });

  r.get("/executions/durable/summary", requireOperatorSurfaceAccess, (req, res) => {
    return getDurableExecutionSummary(req, res, { db, wsHub });
  });

  r.get("/executions/durable/:id", requireOperatorSurfaceAccess, (req, res) => {
    return getDurableExecutionById(req, res, { db, wsHub });
  });

  r.post("/executions/durable/:id/retry", requireOperatorSurfaceAccess, (req, res) => {
    return retryDurableExecution(req, res, { db, wsHub });
  });

  r.get("/executions/:id", requireOperatorSurfaceAccess, (req, res) => {
    return getExecutionById(req, res, { db, wsHub });
  });

  r.post("/executions/callback", requireExecutionCallbackRateLimit, (req, res) => {
    return executionCallback(req, res, { db, wsHub });
  });

  return r;
}
