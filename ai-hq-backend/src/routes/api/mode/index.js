import express from "express";
import { createModeHandlers } from "./handlers.js";

export function modeRoutes({ db, wsHub }) {
  const r = express.Router();
  const { getMode, postMode, getModeInternalTest } = createModeHandlers({ db, wsHub });

  r.get("/mode", getMode);
  r.post("/mode", postMode);
  r.get("/__mode_internal_test", getModeInternalTest);

  return r;
}