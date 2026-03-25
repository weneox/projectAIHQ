import express from "express";
import { requireOperatorSurfaceAccess } from "../../../utils/auth.js";
import {
  ingestCommentHandler,
  listCommentsHandler,
  getCommentHandler,
  reviewCommentHandler,
  replyCommentHandler,
  ignoreCommentHandler,
} from "./handlers.js";

export function commentsRoutes({ db, wsHub }) {
  const r = express.Router();

  r.post("/comments/ingest", ingestCommentHandler({ db, wsHub }));
  r.get("/comments", requireOperatorSurfaceAccess, listCommentsHandler({ db }));
  r.get("/comments/:id", requireOperatorSurfaceAccess, getCommentHandler({ db }));
  r.post("/comments/:id/review", reviewCommentHandler({ db, wsHub }));
  r.post("/comments/:id/reply", replyCommentHandler({ db, wsHub }));
  r.post("/comments/:id/ignore", ignoreCommentHandler({ db, wsHub }));

  return r;
}
