import test from "node:test";
import assert from "node:assert/strict";

import {
  META_DM_LAUNCH_SCOPES,
  buildInstagramLifecycleChannelPayload,
  listInstagramPageCandidates,
} from "../src/routes/api/channelConnect/meta.js";

test("dm-first launch scopes drop business-management assumptions", () => {
  assert.deepEqual(META_DM_LAUNCH_SCOPES, [
    "pages_show_list",
    "pages_manage_metadata",
    "instagram_basic",
    "instagram_manage_messages",
  ]);
  assert.equal(META_DM_LAUNCH_SCOPES.includes("business_management"), false);
});

test("instagram lifecycle patch preserves reconnect metadata while clearing live runtime identifiers", () => {
  const patch = buildInstagramLifecycleChannelPayload({
    channel: {
      display_name: "Instagram @acme",
      external_page_id: "page-1",
      external_user_id: "ig-1",
      external_username: "acme",
      is_primary: true,
      config: {
        meta_user_id: "meta-user-1",
        meta_user_name: "Acme Owner",
      },
      health: {
        last_oauth_exchange_at: "2026-04-05T10:00:00.000Z",
        user_token_expires_at: "2026-05-05T10:00:00.000Z",
      },
    },
    transition: "deauthorized",
    reasonCode: "meta_app_deauthorized",
    occurredAt: "2026-04-05T11:00:00.000Z",
  });

  assert.equal(patch.status, "error");
  assert.equal(patch.external_page_id, null);
  assert.equal(patch.external_user_id, null);
  assert.equal(patch.config.meta_user_id, "meta-user-1");
  assert.equal(patch.config.last_known_page_id, "page-1");
  assert.equal(patch.config.last_known_ig_user_id, "ig-1");
  assert.equal(patch.health.connection_state, "deauthorized");
  assert.equal(patch.health.manual_reconnect_required, true);
  assert.equal(patch.health.deauthorized_at, "2026-04-05T11:00:00.000Z");
});

test("instagram candidate listing only returns pages with both page and Instagram identities", () => {
  const candidates = listInstagramPageCandidates([
    {
      id: "page-1",
      name: "Acme",
      access_token: "page-token-1",
      instagram_business_account: {
        id: "ig-1",
        username: "acme",
      },
    },
    {
      id: "page-2",
      name: "Missing token",
      instagram_business_account: {
        id: "ig-2",
        username: "broken",
      },
    },
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].pageId, "page-1");
  assert.equal(candidates[0].igUserId, "ig-1");
});
