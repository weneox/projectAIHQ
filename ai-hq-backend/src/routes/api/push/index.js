import express from "express";
import { createPushHandlers } from "./handlers.js";

export function pushRoutes({ db, wsHub }) {
  const r = express.Router();
  const {
    getPushVapid,
    getPushSubscribe,
    postPushSubscribe,
    postPushTest,
  } = createPushHandlers({ db, wsHub });

  r.get("/push/vapid", getPushVapid);
  r.get("/push/subscribe", getPushSubscribe);
  r.post("/push/subscribe", postPushSubscribe);
  r.post("/push/test", postPushTest);

  return r;
}