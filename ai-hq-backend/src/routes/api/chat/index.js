import express from "express";
import { createChatHandlers } from "./handlers.js";

export function chatRoutes({ db, wsHub }) {
  const r = express.Router();
  const { postChat } = createChatHandlers({ db, wsHub });

  r.post("/chat", postChat);

  return r;
}