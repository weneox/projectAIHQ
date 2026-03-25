import express from "express";
import { cfg } from "../../../config.js";
import { okJson } from "../../../utils/http.js";
import { cloudinaryUploadFromUrl } from "../../../services/media/cloudinaryUpload.js";
import { renderSlidesToPng } from "../../../render/renderSlides.js";
import {
  buildCarouselPaths,
  clean,
  getAuthTenantKey,
  isObject,
  lower,
  normalizeAspectRatio,
  normalizeSlidesInput,
} from "./utils.js";

export function carouselMediaRoutes({ db } = {}) {
  const r = express.Router();

  r.post("/carousel/render", async (req, res) => {
    try {
      const tenantKey = getAuthTenantKey(req);
      const aspectRatio = normalizeAspectRatio(req.body?.aspectRatio || "1:1");
      const upload = req.body?.upload !== false;

      const fallback = {
        aspectRatio,
        brandName: clean(req.body?.brandName || req.body?.logoText || "BRAND"),
        logoText: clean(req.body?.logoText || req.body?.brandName || "BRAND"),
        badge: clean(req.body?.badge || "BRAND"),
        cta: clean(req.body?.cta || ""),
        align: clean(req.body?.align || "left"),
        theme: clean(req.body?.theme || "premium_dark"),
        language: lower(req.body?.language || "az") || "az",
        renderHints: isObject(req.body?.renderHints) ? req.body.renderHints : {},
      };

      const slides = normalizeSlidesInput(req.body?.slides, fallback);

      if (!slides.length) {
        return okJson(res, { ok: false, error: "slides[] required" });
      }

      const { renderDir } = buildCarouselPaths(tenantKey);

      const publicBaseUrl = clean(cfg.urls.publicBaseUrl || "");
      if (!publicBaseUrl) {
        return okJson(res, {
          ok: false,
          error: "PUBLIC_BASE_URL missing",
        });
      }

      const assetsLocal = await renderSlidesToPng({
        slides,
        outDir: renderDir,
        publicBaseUrl,
      });

      let uploaded = [];
      if (upload) {
        const folder =
          clean(req.body?.folder || "") ||
          [tenantKey || "public", "carousel"].filter(Boolean).join("/");

        for (let i = 0; i < assetsLocal.length; i++) {
          const asset = assetsLocal[i];

          const up = await cloudinaryUploadFromUrl({
            sourceUrl: asset.url,
            db,
            tenantKey,
            folder,
            publicId: clean(req.body?.publicIdPrefix || "")
              ? `${clean(req.body?.publicIdPrefix)}_${i + 1}`
              : "",
            resourceType: "image",
            tags: ["carousel", tenantKey || "public"],
            context: {
              tenantKey: tenantKey || "",
              slide: String(i + 1),
            },
          });

          uploaded.push({
            index: i,
            localUrl: asset.url,
            localPath: asset.localPath,
            width: asset.width,
            height: asset.height,
            provider: up.provider,
            source: up.source,
            url: up.url,
            publicId: up.publicId,
            version: up.version,
            format: up.format,
            bytes: up.bytes,
          });
        }
      }

      return okJson(res, {
        ok: true,
        tenantKey: tenantKey || null,
        aspectRatio,
        slidesCount: slides.length,
        assetsLocal,
        uploaded,
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "carousel_render_failed",
        details: {
          message: String(e?.message || e),
        },
      });
    }
  });

  return r;
}