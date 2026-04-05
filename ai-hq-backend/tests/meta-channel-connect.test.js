import test from "node:test";
import assert from "node:assert/strict";

process.env.TENANT_SECRET_MASTER_KEY =
  process.env.TENANT_SECRET_MASTER_KEY || "a".repeat(64);
process.env.META_APP_ID = process.env.META_APP_ID || "meta-app-id";
process.env.META_APP_SECRET = process.env.META_APP_SECRET || "meta-app-secret";
process.env.META_REDIRECT_URI =
  process.env.META_REDIRECT_URI || "https://app.test/api/channels/meta/callback";
process.env.CHANNELS_RETURN_URL =
  process.env.CHANNELS_RETURN_URL || "https://app.test/channels";

const metaModule = await import("../src/routes/api/channelConnect/meta.js");
const utilsModule = await import("../src/routes/api/channelConnect/utils.js");

const {
  META_DM_LAUNCH_SCOPES,
  buildInstagramLifecycleChannelPayload,
  completeMetaSelection,
  disconnectMeta,
  getMetaStatus,
  handleMetaCallback,
  listInstagramPageCandidates,
} = metaModule;
const { signState } = utilsModule;

function buildAuth() {
  return {
    userId: "user-1",
    identityId: "identity-1",
    membershipId: "membership-1",
    email: "owner@acme.test",
    tenantId: "tenant-1",
    tenantKey: "acme",
    role: "owner",
  };
}

class FakeChannelConnectDb {
  constructor() {
    this.tenant = {
      id: "tenant-1",
      tenant_key: "acme",
      company_name: "Acme",
      legal_name: "Acme LLC",
      industry_key: "generic_business",
      country_code: "AZ",
      timezone: "Asia/Baku",
      default_language: "az",
      enabled_languages: ["az"],
      market_region: "AZ",
      plan_key: "growth",
      status: "active",
      active: true,
    };
    this.channel = null;
    this.auditEntries = [];
    this.secretRows = new Map();
  }

  _secretMapKey(tenantId, provider, secretKey) {
    return [tenantId, provider, secretKey].join(":");
  }

  _listSecretRows(tenantId, provider) {
    return [...this.secretRows.values()]
      .filter(
        (row) =>
          row.tenant_id === tenantId &&
          row.provider === provider &&
          row.is_active === true
      )
      .sort((a, b) => String(a.secret_key).localeCompare(String(b.secret_key)));
  }

  _insertChannelFromValues(values = []) {
    return {
      id: "channel-1",
      tenant_id: values[0],
      channel_type: values[1],
      provider: values[2],
      display_name: values[3],
      external_account_id: values[4],
      external_page_id: values[5],
      external_user_id: values[6],
      external_username: values[7],
      status: values[8],
      is_primary: values[9],
      config: JSON.parse(values[10] || "{}"),
      secrets_ref: values[11],
      health: JSON.parse(values[12] || "{}"),
      last_sync_at: values[13],
      created_at: this.channel?.created_at || "2026-04-05T00:00:00.000Z",
      updated_at: "2026-04-05T00:00:00.000Z",
    };
  }

  _updateChannelFromValues(values = [], existingId = "") {
    return {
      id: existingId || this.channel?.id || "channel-1",
      tenant_id: this.channel?.tenant_id || this.tenant.id,
      channel_type: "instagram",
      provider: values[1],
      display_name: values[2],
      external_account_id: values[3],
      external_page_id: values[4],
      external_user_id: values[5],
      external_username: values[6],
      status: values[7],
      is_primary: values[8],
      config: JSON.parse(values[9] || "{}"),
      secrets_ref: values[10],
      health: JSON.parse(values[11] || "{}"),
      last_sync_at: values[12],
      created_at: this.channel?.created_at || "2026-04-05T00:00:00.000Z",
      updated_at: "2026-04-05T00:00:00.000Z",
    };
  }

  async query(text, values = []) {
    const sql = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();

    if (sql.includes("from tenants") && sql.includes("where lower(tenant_key)")) {
      return { rows: [this.tenant] };
    }

    if (
      sql.includes("select * from tenant_channels") &&
      sql.includes("channel_type = 'instagram'")
    ) {
      return { rows: this.channel ? [this.channel] : [] };
    }

    if (
      sql.includes("select id from tenant_channels") &&
      sql.includes("channel_type = $2")
    ) {
      return { rows: this.channel ? [{ id: this.channel.id }] : [] };
    }

    if (sql.startsWith("update tenant_channels")) {
      this.channel = this._updateChannelFromValues(values, values[0]);
      return { rows: [this.channel] };
    }

    if (sql.startsWith("insert into tenant_channels")) {
      this.channel = this._insertChannelFromValues(values);
      return { rows: [this.channel] };
    }

    if (sql.startsWith("insert into tenant_secrets")) {
      const now = "2026-04-05T00:00:00.000Z";
      const [tenantId, provider, secretKey, enc, iv, tag, actor] = values;
      const mapKey = this._secretMapKey(tenantId, provider, secretKey);
      const existing = this.secretRows.get(mapKey);
      const row = {
        id: existing?.id || `secret-${secretKey}`,
        tenant_id: tenantId,
        provider,
        secret_key: secretKey,
        secret_value_enc: enc,
        secret_value_iv: iv,
        secret_value_tag: tag,
        version: Number(existing?.version || 0) + 1,
        is_active: true,
        created_by: existing?.created_by || actor,
        updated_by: actor,
        created_at: existing?.created_at || now,
        updated_at: now,
      };
      this.secretRows.set(mapKey, row);
      return { rows: [row] };
    }

    if (sql.startsWith("delete from tenant_secrets")) {
      const tenantId = String(values[0] || "").trim();
      const provider = String(values[1] || "").trim().toLowerCase();
      const secretKey = String(values[2] || "").trim().toLowerCase();
      let deleted = 0;

      for (const [mapKey, row] of this.secretRows.entries()) {
        if (
          row.tenant_id === tenantId &&
          String(row.provider || "").trim().toLowerCase() === provider &&
          String(row.secret_key || "").trim().toLowerCase() === secretKey
        ) {
          this.secretRows.delete(mapKey);
          deleted += 1;
        }
      }

      return { rowCount: deleted, rows: [] };
    }

    if (
      sql.startsWith("select") &&
      sql.includes("from tenant_secrets") &&
      sql.includes("where tenant_id = $1") &&
      sql.includes("provider = $2")
    ) {
      return {
        rows: this._listSecretRows(values[0], values[1]),
      };
    }

    if (sql.includes("insert into audit_log")) {
      this.auditEntries.push({
        action: values[3],
        objectType: values[4],
        objectId: values[5],
        meta: values[6],
      });
      return { rows: [] };
    }

    throw new Error(`Unhandled query: ${sql}`);
  }
}

async function seedPendingSelection(db) {
  return handleMetaCallback({
    db,
    req: {
      query: {
        code: "meta-code-1",
        state: signState({
          tenantKey: "acme",
          actor: "owner@acme.test",
          exp: Date.now() + 60_000,
        }),
      },
    },
    exchangeCodeForUserTokenFn: async () => ({
      access_token: "user-token-1",
      token_type: "bearer",
      expires_in: 3600,
    }),
    getMetaUserProfileFn: async () => ({
      id: "meta-user-1",
      name: "Acme Owner",
    }),
    getPagesForUserTokenFn: async () => [
      {
        id: "page-1",
        name: "Acme One",
        access_token: "page-token-1",
        instagram_business_account: {
          id: "ig-1",
          username: "acme.one",
        },
      },
      {
        id: "page-2",
        name: "Acme Two",
        access_token: "page-token-2",
        instagram_business_account: {
          id: "ig-2",
          username: "acme.two",
        },
      },
    ],
  });
}

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

test("multi-account callback persists a pending selection and keeps tenant status honest", async () => {
  const db = new FakeChannelConnectDb();

  const callbackResult = await seedPendingSelection(db);
  assert.equal(callbackResult.type, "selection_required");
  assert.match(callbackResult.redirectUrl || "", /meta_selection=1/);
  assert.equal(db.channel, null);

  const status = await getMetaStatus({
    db,
    req: {
      auth: buildAuth(),
    },
  });

  assert.equal(status.state, "not_connected");
  assert.equal(status.connected, false);
  assert.equal(status.pendingSelection?.required, true);
  assert.equal(status.pendingSelection?.candidateCount, 2);
  assert.equal(status.actions.selectionAvailable, true);
  assert.equal(status.actions.connectAvailable, false);
  assert.equal(status.account.pageId, null);
  assert.equal(status.runtime.hasPageAccessToken, false);
});

test("explicit account selection finalizes binding and clears the pending chooser state", async () => {
  const db = new FakeChannelConnectDb();
  await seedPendingSelection(db);

  const statusBefore = await getMetaStatus({
    db,
    req: {
      auth: buildAuth(),
    },
  });

  const result = await completeMetaSelection({
    db,
    req: {
      auth: buildAuth(),
      body: {
        selectionToken: statusBefore.pendingSelection?.selectionToken,
        candidateId: "page-2",
      },
    },
    syncInstagramSourceLayerFn: async () => ({
      source: {
        id: "source-2",
        source_key: "instagram:ig-2",
      },
      capabilityGovernance: {
        publishStatus: "ready",
        reviewRequired: false,
        maintenanceSession: { id: "session-1" },
        blockedReason: "",
      },
    }),
  });

  assert.equal(result.connected, true);
  assert.equal(result.pageId, "page-2");
  assert.equal(result.igUserId, "ig-2");

  const statusAfter = await getMetaStatus({
    db,
    req: {
      auth: buildAuth(),
    },
  });

  assert.equal(statusAfter.state, "connected");
  assert.equal(statusAfter.pendingSelection, null);
  assert.equal(statusAfter.account.pageId, "page-2");
  assert.equal(statusAfter.account.igUserId, "ig-2");
  assert.equal(statusAfter.lifecycle.tokenType, "bearer");
  assert.match(statusAfter.lifecycle.userTokenExpiresAt || "", /^2026-|^20\d\d-/);
});

test("disconnect clears a pending chooser session without fabricating a disconnected channel row", async () => {
  const db = new FakeChannelConnectDb();
  await seedPendingSelection(db);

  const result = await disconnectMeta({
    db,
    req: {
      auth: buildAuth(),
    },
  });

  assert.equal(result.clearedPendingSelection, true);
  assert.equal(db.channel, null);

  const statusAfter = await getMetaStatus({
    db,
    req: {
      auth: buildAuth(),
    },
  });

  assert.equal(statusAfter.state, "not_connected");
  assert.equal(statusAfter.pendingSelection, null);
});

test("canceling a pending chooser preserves an existing reconnect-required channel state", async () => {
  const db = new FakeChannelConnectDb();
  db.channel = {
    id: "channel-1",
    tenant_id: "tenant-1",
    channel_type: "instagram",
    provider: "meta",
    display_name: "Instagram @acme",
    external_account_id: "",
    external_page_id: "",
    external_user_id: "",
    external_username: "",
    status: "error",
    is_primary: true,
    config: {
      disconnect_reason: "meta_app_deauthorized",
    },
    secrets_ref: null,
    health: {
      connection_state: "deauthorized",
      disconnect_reason: "meta_app_deauthorized",
      deauthorized_at: "2026-04-05T10:00:00.000Z",
    },
    last_sync_at: null,
    created_at: "2026-04-05T00:00:00.000Z",
    updated_at: "2026-04-05T00:00:00.000Z",
  };

  await seedPendingSelection(db);

  const result = await disconnectMeta({
    db,
    req: {
      auth: buildAuth(),
    },
  });

  assert.equal(result.clearedPendingSelection, true);
  assert.equal(result.preservedState, "error");
  assert.equal(db.channel?.status, "error");
  assert.equal(db.channel?.health?.connection_state, "deauthorized");

  const statusAfter = await getMetaStatus({
    db,
    req: {
      auth: buildAuth(),
    },
  });

  assert.equal(statusAfter.state, "deauthorized");
  assert.equal(statusAfter.pendingSelection, null);
});
