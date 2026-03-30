import { deepFix } from "../../../utils/textFix.js";
import { sendCommentActionsViaMetaGateway } from "../../../services/metaGatewayClient.js";
import {
  s,
} from "./utils.js";

export async function forwardCommentReplyToMetaGateway({
  tenantKey,
  channel,
  comment,
  actions = [],
}) {
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
  const result = await sendCommentActionsViaMetaGateway(payload);
  return {
    ...result,
    json: deepFix(result?.json || {}),
  };
}
