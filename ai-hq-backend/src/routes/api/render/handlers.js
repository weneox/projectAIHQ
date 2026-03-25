import crypto from "crypto";
import fs from "fs";
import path from "path";

import { cfg } from "../../../config.js";
import { okJson } from "../../../utils/http.js";
import { baseUrl } from "../../../utils/url.js";
import { renderSlidesToPng } from "../../../render/renderSlides.js";
import { resolveRenderTenantKey } from "./utils.js";
import {
  pickSlides,
  pickFormat,
  pickAspectRatio,
  normalizeSlides,
} from "./normalize.js";

export function createRenderHandlers() {
  async function postRenderSlides(req, res) {
    const tenantKey = resolveRenderTenantKey(
      req.body,
      cfg.tenant.defaultTenantKey
    );

    const rawSlides = pickSlides(req.body);

    if (!rawSlides.length) {
      return okJson(res, {
        ok: false,
        error: "slides[] required",
      });
    }

    try {
      const base = baseUrl();
      if (!base) {
        return okJson(res, {
          ok: false,
          error: "PUBLIC_BASE_URL required for assets URLs",
        });
      }

      const format = pickFormat(req.body);
      const aspectRatio = pickAspectRatio(req.body, format);
      const slides = normalizeSlides(rawSlides, req.body);

      const renderId = crypto.randomUUID();
      const outDir = path.resolve(
        process.cwd(),
        "uploads",
        "renders",
        tenantKey,
        renderId
      );

      fs.mkdirSync(outDir, { recursive: true });

      const assets = await renderSlidesToPng({
        slides,
        outDir,
        publicBaseUrl: base,
      });

      return okJson(res, {
        ok: true,
        tenantKey,
        renderId,
        format,
        aspectRatio,
        count: assets.length,
        assets,
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Render failed",
        details: {
          message: String(e?.message || e),
        },
      });
    }
  }

  return { postRenderSlides };
}