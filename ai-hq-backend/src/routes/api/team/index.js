import express from "express";
import { createTeamHandlers } from "./handlers.js";

export function teamRoutes({ db }) {
  const router = express.Router();
  const {
    getTeam,
    getTeamUser,
    postTeamUser,
    patchTeamUser,
    postTeamUserStatus,
    postTeamUserPassword,
    deleteTeamUser,
  } = createTeamHandlers({ db });

  router.get("/team", getTeam);
  router.get("/team/:id", getTeamUser);
  router.post("/team", postTeamUser);
  router.patch("/team/:id", patchTeamUser);
  router.post("/team/:id/status", postTeamUserStatus);
  router.post("/team/:id/password", postTeamUserPassword);
  router.delete("/team/:id", deleteTeamUser);

  return router;
}