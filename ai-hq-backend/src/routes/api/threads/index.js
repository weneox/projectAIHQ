import express from "express";
import { createThreadsHandlers } from "./handlers.js";

export function threadsRoutes({ db }) {
  const r = express.Router();
  const { getThreadMessages, postThreadMessage } = createThreadsHandlers({ db });

  r.get("/threads/:id/messages", getThreadMessages);
  r.post("/threads/:id/message", postThreadMessage);

  return r;
}