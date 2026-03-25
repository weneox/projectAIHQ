import express from "express";
import { okJson } from "../../../utils/http.js";
import { cloudinaryUploadFromUrl } from "../../../services/media/cloudinaryUpload.js";
import { arr, clean, getAuthTenantKey, isObject } from "./utils.js";

export function uploadMediaRoutes({ db } = {}) {
  const r = express.Router();

  r.post("/upload", async (req, res) => {
    try {
      const tenantKey = getAuthTenantKey(req);

      const sourceUrl = clean(req.body?.sourceUrl || req.body?.url || "");
      const folder = clean(req.body?.folder || "");
      const publicId = clean(req.body?.publicId || req.body?.public_id || "");
      const resourceType = clean(req.body?.resourceType || "image") || "image";
      const tags = arr(req.body?.tags).map(clean).filter(Boolean);
      const context = isObject(req.body?.context) ? req.body.context : {};

      if (!sourceUrl) {
        return okJson(res, { ok: false, error: "sourceUrl required" });
      }

      const out = await cloudinaryUploadFromUrl({
        sourceUrl,
        db,
        tenantKey,
        folder,
        publicId,
        resourceType,
        tags,
        context,
      });

      return okJson(res, {
        ok: true,
        tenantKey: tenantKey || null,
        provider: out.provider,
        source: out.source,
        resourceType: out.resourceType,
        folder: out.folder,
        publicId: out.publicId,
        version: out.version,
        width: out.width,
        height: out.height,
        bytes: out.bytes,
        format: out.format,
        url: out.url,
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "upload_failed",
        details: {
          message: String(e?.message || e),
        },
      });
    }
  });

  return r;
}