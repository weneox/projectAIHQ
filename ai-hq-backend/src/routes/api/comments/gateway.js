import { deepFix } from "../../../utils/textFix.js";
import { validateMetaCommentActionRequest, validateMetaCommentActionResponse } from "@aihq/shared-contracts/critical";
import {
  getMetaGatewayBaseUrl,
  getMetaGatewayInternalToken,
  s,
  safeReadJson,
} from "./utils.js";

export async function forwardCommentReplyToMetaGateway({
  tenantKey,
  channel,
  comment,
  actions = [],
}) {
  const base = getMetaGatewayBaseUrl();

  if (!base) {
    return {
      ok: false,
      status: 0,
      error: "META_GATEWAY_BASE_URL missing",
      skipped: true,
    };
  }

  const token = getMetaGatewayInternalToken();

  const payload = {
    tenantKey: s(tenantKey || ""),
    actions: Array.isArray(actions) ? actions : [],
    context: {
      tenantKey: s(tenantKey || ""),
      channel: s(channel || comment?.channel || "instagram").toLowerCase() || "instagram",
      commentId: s(comment?.external_comment_id || ""),
      externalCommentId: s(comment?.external_comment_id || ""),
      externalPostId: s(comment?.external_post_id || ""),
      recipientId: s(comment?.external_user_id || ""),
      userId: s(comment?.external_user_id || ""),
    },
  };

  const checked = validateMetaCommentActionRequest(payload);
  if (!checked.ok) {
    return {
      ok: false,
      status: 0,
      error: checked.error,
      skipped: true,
    };
  }

  try {
    const res = await fetch(`${base}/internal/comment-actions/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        ...(token ? { "x-internal-token": token } : {}),
      },
      body: JSON.stringify(checked.value.body),
    });

    const json = await safeReadJson(res);
    const responseChecked = validateMetaCommentActionResponse(json || { ok: false });

    return {
      ok: Boolean(res.ok && responseChecked.ok && json?.ok !== false),
      status: res.status,
      json: deepFix(json || {}),
      error: res.ok
        ? responseChecked.ok
          ? null
          : responseChecked.error
        : json?.error || json?.message || "meta gateway failed",
      skipped: false,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: String(e?.message || e),
      skipped: false,
    };
  }
}
