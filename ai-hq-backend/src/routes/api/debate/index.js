import express from "express";
import { createDebateHandlers } from "./handlers.js";

export function debateRoutes({ db, wsHub }) {
  const r = express.Router();
  const { postDebate } = createDebateHandlers({ db, wsHub });

  r.post("/debate", postDebate);

  return r;
}