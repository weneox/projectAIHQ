import express from "express";
import { requireInternalToken } from "../../../utils/auth.js";
import { createHealthHandlers } from "./handlers.js";

export function healthRoutes({ db }) {
  const r = express.Router();
  const { getApiRoot } = createHealthHandlers({ db });

  r.get("/", getApiRoot);
  r.get("/health", requireInternalToken, getApiRoot);

  return r;
}
