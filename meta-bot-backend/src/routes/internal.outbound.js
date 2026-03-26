import express from "express";
import crypto from "crypto";
import { executeMetaActions } from "../services/actionExecutor.js";
import { AIHQ_INTERNAL_TOKEN } from "../config.js";
import {
  validateMetaCommentActionRequest,
  validateMetaInternalOutboundRequest,
} from "@aihq/shared-contracts/critical";

function s(v) {
  return String(v ?? "").trim();
}

function lower(v) {
  return s(v).toLowerCase();
}

function isObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function requireInternalToken(req) {
  const token = s(req.headers["x-internal-token"]);
  const expected = s(AIHQ_INTERNAL_TOKEN);
  if (!token || !expected) return false;

  const providedBuffer = Buffer.from(token, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  return (
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

function pickTenantKey(req) {
  return (
    lower(
      req.body?.tenantKey ||
        req.body?.tenant_key ||
        req.body?.meta?.tenantKey ||
        req.body?.meta?.tenant_key ||
        req.headers["x-tenant-key"] ||
        ""
    ) || "default"
  );
}

function pickTenantId(req) {
  return s(
    req.body?.tenantId ||
      req.body?.tenant_id ||
      req.body?.meta?.tenantId ||
      req.body?.meta?.tenant_id ||
      ""
  );
}

function normalizeActions(v) {
  return Array.isArray(v) ? v : [];
}

function normalizeContext(req, tenantKey, tenantId) {
  const body = isObject(req.body) ? req.body : {};
  const context = isObject(body.context) ? body.context : {};
  const meta = isObject(context.meta) ? context.meta : {};

  return {
    tenantKey,
    tenantId: tenantId || null,
    channel: lower(context.channel || body.channel || "instagram") || "instagram",
    threadId: s(context.threadId || context.thread_id || body.threadId || body.thread_id || ""),
    recipientId: s(
      context.recipientId || context.recipient_id || body.recipientId || body.recipient_id || ""
    ),
    userId: s(context.userId || context.user_id || body.userId || body.user_id || ""),
    commentId: s(context.commentId || context.comment_id || ""),
    externalCommentId: s(context.externalCommentId || context.external_comment_id || ""),
    externalPostId: s(context.externalPostId || context.external_post_id || ""),
    meta: {
      ...meta,
      tenantKey,
      tenantId: tenantId || null,
    },
  };
}

export function internalOutboundRoutes() {
  const r = express.Router();

  r.post("/internal/outbound/send", async (req, res) => {
    if (!requireInternalToken(req)) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
      });
    }

    const checked = validateMetaInternalOutboundRequest(req.body || {});
    if (!checked.ok) {
      return res.status(400).json({
        ok: false,
        error: checked.error,
      });
    }

    const tenantKey = checked.value.tenantKey || pickTenantKey(req);
    const tenantId = checked.value.tenantId || pickTenantId(req);
    const channel = checked.value.channel;
    const threadId = checked.value.threadId;
    const recipientId = checked.value.recipientId;
    const text = checked.value.text;
    const senderType = checked.value.senderType;
    const messageType = checked.value.messageType;
    const attachments = checked.value.attachments;
    const meta = checked.value.meta;

    try {
      req.log?.info("meta.internal_outbound.send.requested", {
        tenantKey,
        tenantId,
        channel,
        threadId,
        recipientId,
      });
      const actionMeta = {
        ...meta,
        tenantKey,
        tenantId: tenantId || null,
        threadId,
        senderType,
        messageType,
        skipOutboundAck: true,
        internalOutbound: true,
        alreadyTrackedInAiHq: true,
      };

      const context = {
        tenantKey,
        tenantId: tenantId || null,
        channel,
        threadId,
        recipientId,
        userId: recipientId,
        meta: {
          ...meta,
          tenantKey,
          tenantId: tenantId || null,
          threadId,
          senderType,
          messageType,
          skipOutboundAck: true,
          internalOutbound: true,
          alreadyTrackedInAiHq: true,
        },
      };

      const exec = await executeMetaActions(
        [
          {
            type: "send_message",
            channel,
            recipientId,
            text,
            attachments,
            meta: actionMeta,
          },
        ],
        context
      );

      const result = Array.isArray(exec?.results) ? exec.results[0] || null : null;

      return res.status(exec?.ok ? 200 : 502).json({
        ok: Boolean(exec?.ok),
        tenantKey,
        tenantId: tenantId || null,
        channel,
        result,
      });
    } catch (e) {
      req.log?.error("meta.internal_outbound.send.failed", e, {
        tenantKey,
        tenantId,
        channel,
      });
      return res.status(500).json({
        ok: false,
        error: String(e?.message || e),
      });
    }
  });

  r.post("/internal/comment-actions/execute", async (req, res) => {
    if (!requireInternalToken(req)) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
      });
    }

    const checked = validateMetaCommentActionRequest(req.body || {});
    if (!checked.ok) {
      return res.status(400).json({
        ok: false,
        error: checked.error,
      });
    }

    const tenantKey = checked.value.tenantKey || pickTenantKey(req);
    const tenantId = checked.value.tenantId || pickTenantId(req);
    const actions = normalizeActions(checked.value.actions);
    const context = normalizeContext(req, tenantKey, tenantId);

    try {
      req.log?.info("meta.internal_comment_actions.requested", {
        tenantKey,
        tenantId,
        actionCount: actions.length,
      });
      const exec = await executeMetaActions(actions, context);

      return res.status(exec?.ok ? 200 : 502).json({
        ok: Boolean(exec?.ok),
        tenantKey,
        tenantId: tenantId || null,
        context,
        results: Array.isArray(exec?.results) ? exec.results : [],
      });
    } catch (e) {
      req.log?.error("meta.internal_comment_actions.failed", e, {
        tenantKey,
        tenantId,
        actionCount: actions.length,
      });
      return res.status(500).json({
        ok: false,
        error: String(e?.message || e),
      });
    }
  });

  return r;
}
