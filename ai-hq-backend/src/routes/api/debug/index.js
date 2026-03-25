import express from "express";
import { createDebugHandlers } from "./handlers.js";

export function debugRoutes() {
  const r = express.Router();
  const { postDebugOpenAI } = createDebugHandlers();

  r.post("/debug/openai", postDebugOpenAI);

  return r;
}