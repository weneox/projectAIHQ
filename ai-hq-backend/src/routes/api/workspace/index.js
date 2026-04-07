// src/routes/api/workspace/index.js
// FINAL v1.1 — workspace route group

import express from "express";
import { workspaceAppRoutes } from "./app.js";
import { workspaceSetupRoutes } from "./setup.js";
import { workspaceKnowledgeRoutes } from "./knowledge.js";

export function workspaceRoutes({ db, wsHub, audit, dbDisabled = false }) {
  const r = express.Router();

  r.use("/", workspaceAppRoutes({ db, wsHub, audit, dbDisabled }));
  r.use("/", workspaceSetupRoutes({ db, wsHub, audit, dbDisabled }));
  r.use("/", workspaceKnowledgeRoutes({ db, wsHub, audit, dbDisabled }));

  return r;
}
