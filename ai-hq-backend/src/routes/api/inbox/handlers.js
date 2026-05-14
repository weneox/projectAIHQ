// src/routes/api/inbox/handlers.js
// operator inbox handlers - cleaned message visibility + safe thread previews

import express from "express";
import { registerInboxOutboundOperatorRoutes } from "./operator/outboundRoutes.js";
import { registerInboxThreadReadOperatorRoutes } from "./operator/threadReadRoutes.js";
import { registerInboxThreadMessageWriteOperatorRoutes } from "./operator/threadMessageWriteRoutes.js";
import { registerInboxThreadStateOperatorRoutes } from "./operator/threadStateRoutes.js";

export function inboxHandlers({ db, wsHub }) {
  const r = express.Router();

  registerInboxOutboundOperatorRoutes(r, { db, wsHub });
  registerInboxThreadReadOperatorRoutes(r, { db, wsHub });
  registerInboxThreadMessageWriteOperatorRoutes(r, { db, wsHub });
  registerInboxThreadStateOperatorRoutes(r, { db, wsHub });

  return r;
}
