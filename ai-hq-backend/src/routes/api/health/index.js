import express from "express";
import { createHealthHandlers } from "./handlers.js";

export function healthRoutes({ db }) {
  const r = express.Router();
  const { getApiRoot } = createHealthHandlers({ db });

  r.get("/", getApiRoot);

  return r;
}