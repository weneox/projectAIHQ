import { okJson, clamp, isUuid } from "../../../../utils/http.js";
import { getAuthTenantKey } from "../../../../utils/auth.js";
import { resolveTenantKeyFromReq } from "../../../../tenancy/index.js";
import { fixText } from "../../../../utils/textFix.js";
import { s } from "../utils.js";
import { getCommentById, listComments } from "../repository.js";
import { ensureCommentsDb } from "./shared.js";

function isMissingSchemaError(error) {
  const code = s(error?.code).toUpperCase();
  const message = s(error?.message).toLowerCase();

  if (code === "42P01" || code === "42703") {
    return true;
  }

  return (
    message.includes("does not exist") ||
    message.includes("undefined column") ||
    message.includes("undefined table")
  );
}

export function listCommentsHandler({ db, list = listComments }) {
  return async function listCommentsRoute(req, res) {
    const tenantKey = resolveTenantKeyFromReq(req);
    const channel = fixText(s(req.query?.channel || "")).toLowerCase();
    const category = fixText(s(req.query?.category || "")).toLowerCase();
    const q = fixText(s(req.query?.q || ""));
    const limit = clamp(Number(req.query?.limit ?? 50), 1, 200);

    try {
      if (!tenantKey) {
        return okJson(res, {
          ok: false,
          error: "missing authenticated tenant context",
        });
      }

      if (!ensureCommentsDb(res, db, { disabledOk: true, tenantKey })) {
        return;
      }

      const comments = await list(db, {
        tenantKey,
        channel,
        category,
        q,
        limit,
      });

      return okJson(res, {
        ok: true,
        tenantKey,
        count: comments.length,
        comments,
      });
    } catch (e) {
      if (isMissingSchemaError(e)) {
        return okJson(res, {
          ok: true,
          tenantKey,
          count: 0,
          comments: [],
          degraded: true,
          reasonCode: "comments_schema_unavailable",
        });
      }

      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  };
}

export function getCommentHandler({ db, getComment = getCommentById }) {
  return async function getCommentRoute(req, res) {
    const id = s(req.params.id || "");
    const tenantKey = getAuthTenantKey(req);
    if (!id) return okJson(res, { ok: false, error: "comment id required" });
    if (!isUuid(id)) {
      return okJson(res, { ok: false, error: "comment id must be uuid" });
    }

    try {
      if (!ensureCommentsDb(res, db)) {
        return;
      }

      const comment = await getComment(db, id);
      if (comment && tenantKey && s(comment.tenant_key) !== tenantKey) {
        return okJson(res, { ok: false, error: "comment not found" });
      }

      return okJson(res, {
        ok: true,
        found: !!comment,
        comment,
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  };
}
