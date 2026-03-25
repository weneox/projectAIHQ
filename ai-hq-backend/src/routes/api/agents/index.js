import express from "express";
import { getAgents } from "./handlers.js";

export function agentsRoutes() {
  const r = express.Router();

  r.get("/agents", getAgents);

  return r;
}