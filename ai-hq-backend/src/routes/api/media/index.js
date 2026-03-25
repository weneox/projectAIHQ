import express from "express";
import videoRouter from "./video.js";
import voiceRouter from "./voice.js";
import renderRouter from "./render.js";
import { imageMediaRoutes } from "./image.js";
import { uploadMediaRoutes } from "./upload.js";
import { carouselMediaRoutes } from "./carousel.js";

export function mediaRoutes({ db } = {}) {
  const r = express.Router();

  r.use("/media", imageMediaRoutes({ db }));
  r.use("/media", uploadMediaRoutes({ db }));
  r.use("/media", carouselMediaRoutes({ db }));

  r.use("/media", videoRouter);
  r.use("/media", voiceRouter);
  r.use("/media", renderRouter);

  return r;
}