import express from "express";
import { createRenderHandlers } from "./handlers.js";

export function renderRoutes() {
  const r = express.Router();
  const { postRenderSlides } = createRenderHandlers();

  r.post("/render/slides", postRenderSlides);

  return r;
}