import express from "express";
import { clamp, okJson } from "../../../utils/http.js";
import { fixText } from "../../../utils/textFix.js";
import { togetherGenerateImage } from "../../../services/togetherImage.js";
import {
  clean,
  getAuthTenantKey,
  normalizeAspectRatio,
  normalizeVisualPreset,
  pickDimsFromAspectRatio,
  positiveNum,
} from "./utils.js";

export function imageMediaRoutes({ db } = {}) {
  const r = express.Router();

  r.post("/image", async (req, res) => {
    const prompt = fixText(clean(req.body?.prompt));
    const topic = fixText(clean(req.body?.topic));
    const visualPreset = normalizeVisualPreset(req.body?.visualPreset);
    const n = clamp(req.body?.n ?? 1, 1, 4);

    const aspectRatio = normalizeAspectRatio(req.body?.aspectRatio || "1:1");
    const dims = pickDimsFromAspectRatio(aspectRatio);

    const width = positiveNum(req.body?.width, dims.width);
    const height = positiveNum(req.body?.height, dims.height);

    const tenantKey = getAuthTenantKey(req);

    if (!prompt) {
      return okJson(res, { ok: false, error: "prompt required" });
    }

    try {
      const out = await togetherGenerateImage({
        prompt,
        topic,
        visualPreset,
        n,
        width,
        height,
        aspectRatio,
        db,
        tenantKey,
      });

      return okJson(res, {
        ok: true,
        url: out.url,
        urls: out.urls || [out.url],
        model: out.usedModel,
        aspectRatio,
        width,
        height,
        tenantKey: tenantKey || null,
        visualPreset: out?.meta?.visualPreset || visualPreset || null,
        topicFamily: out?.meta?.topicFamily || null,
        debug: {
          usedPrompt: out.usedPrompt,
          usedNegativePrompt: out.usedNegativePrompt,
          meta: out.meta || null,
        },
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "image_generation_failed",
        details: {
          message: String(e?.message || e),
        },
      });
    }
  });

  return r;
}