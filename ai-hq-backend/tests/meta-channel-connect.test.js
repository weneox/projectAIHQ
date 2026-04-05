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
const tenantSecretsModule = await import("../src/db/helpers/tenantSecrets.js");

const {
  META_CONNECT_DIAGNOSTIC_SECRET_KEY,
  META_DM_LAUNCH_SCOPES,
  buildMetaOAuthUrl,
  buildInstagramLifecycleChannelPayload,
  completeMetaSelection,
  disconnectMeta,
  getMetaStatus,
  handleMetaCallback,
  listInstagramPageCandidates,
} = metaModule;
const { signState } = utilsModule;
const { dbGetTenantProviderSecrets, dbUpsertTenantSecret } = tenantSecretsModule;

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

async function seedMetaPageAccessToken(
  db,
  { tenantId = "tenant-1", token = "page-token", actor = "test" } = {}
) {
  await dbUpsertTenantSecret(
    db,
    tenantId,
    "meta",
    "page_access_token",
    token,
    actor
  );
}

async function readMetaSecrets(db, tenantId = "tenant-1") {
  return dbGetTenantProviderSecrets(db, tenantId, "meta");
}

function buildGrantedPermissionPayload(
  scopes = META_DM_LAUNCH_SCOPES,
  { overrides = {} } = {}
) {
  return {
    data: scopes.map((scope) => ({
      permission: scope,
      status: overrides[scope] || "granted",
    })),
  };
}

function buildDebugTokenPayload({
  scopes = META_DM_LAUNCH_SCOPES,
  userId = "meta-user-1",
  granularScopes = [],
} = {}) {
  return {
    data: {
      is_valid: true,
      app_id: "meta-app-id",
      user_id: userId,
      scopes,
      granular_scopes: granularScopes,
    },
  };
}

function createFakeReqLogger(sharedEntries = [], context = {}) {
  function push(level, event, payload = {}) {
    sharedEntries.push({
      level,
      event,
      context,
      payload,
    });
  }

  return {
    entries: sharedEntries,
    child(nextContext = {}) {
      return createFakeReqLogger(sharedEntries, {
        ...context,
        ...nextContext,
      });
    },
    debug(event, payload) {
      push("debug", event, payload);
    },
    info(event, payload) {
      push("info", event, payload);
    },
    warn(event, payload) {
      push("warn", event, payload);
    },
    error(event, payload) {
      push("error", event, payload);
    },
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

function buildPageEnrichmentLookup(pages = []) {
  const pageMap = new Map(
    pages.map((page) => [String(page?.id || "").trim(), page])
  );

  return async (pageId) =>
    pageMap.get(String(pageId || "").trim()) || { id: pageId };
}

function buildDeauthorizedChannel({
  pageId = "page-old",
  igUserId = "ig-old",
  username = "acme.old",
  displayName = "Instagram @acme.old",
} = {}) {
  return {
    id: "channel-1",
    tenant_id: "tenant-1",
    channel_type: "instagram",
    provider: "meta",
    display_name: displayName,
    external_account_id: "",
    external_page_id: "",
    external_user_id: "",
    external_username: "",
    status: "error",
    is_primary: true,
    config: {
      requested_scopes: META_DM_LAUNCH_SCOPES,
      granted_scopes: META_DM_LAUNCH_SCOPES,
      meta_user_id: "meta-user-1",
      meta_user_name: "Acme Owner",
      last_connected_page_name: "Acme Old",
      last_connected_username: username,
      last_known_page_id: pageId,
      last_known_ig_user_id: igUserId,
      disconnect_reason: "meta_app_deauthorized",
    },
    secrets_ref: null,
    health: {
      connection_state: "deauthorized",
      auth_status: "revoked",
      disconnect_reason: "meta_app_deauthorized",
      deauthorized_at: "2026-04-05T10:00:00.000Z",
      manual_reconnect_required: true,
    },
    last_sync_at: null,
    created_at: "2026-04-05T00:00:00.000Z",
    updated_at: "2026-04-05T00:00:00.000Z",
  };
}

async function invokeMetaCallbackWithPages(
  db,
  {
    code = "meta-code-1",
    actor = "owner@acme.test",
    userAccessToken = "user-token-1",
    metaUserProfile = {
      id: "meta-user-1",
      name: "Acme Owner",
    },
    pages = [],
    assignedPages = [],
    getMetaPermissionsForUserTokenFn = async () =>
      buildGrantedPermissionPayload(META_DM_LAUNCH_SCOPES),
    debugMetaUserTokenFn = async () =>
      buildDebugTokenPayload({
        scopes: META_DM_LAUNCH_SCOPES,
        userId: metaUserProfile?.id || "meta-user-1",
      }),
    getMetaPageInstagramContextForUserTokenFn = buildPageEnrichmentLookup(pages),
    getMetaPageInstagramContextForPageTokenFn = async (
      pageId,
      pageAccessToken
    ) => getMetaPageInstagramContextForUserTokenFn(pageId, pageAccessToken),
    getAssignedPagesForUserTokenFn = async () => assignedPages,
    getMetaPageAccessContextForUserTokenFn,
    reqLog,
    syncInstagramSourceLayerFn = async ({ selected = {} } = {}) => ({
      source: {
        id: "source-1",
        source_key: `instagram:${selected.igUserId || "ig-1"}`,
      },
      capabilityGovernance: {
        publishStatus: "ready",
        reviewRequired: false,
        maintenanceSession: { id: "session-1" },
        blockedReason: "",
      },
    }),
  } = {}
) {
  return handleMetaCallback({
    db,
    req: {
      query: {
        code,
        state: signState({
          tenantKey: "acme",
          actor,
          exp: Date.now() + 60_000,
        }),
      },
      log: reqLog || undefined,
    },
    exchangeCodeForUserTokenFn: async () => ({
      access_token: userAccessToken,
      token_type: "bearer",
      expires_in: 3600,
    }),
    getMetaUserProfileFn: async () => metaUserProfile,
    getMetaPermissionsForUserTokenFn,
    debugMetaUserTokenFn,
    getPagesForUserTokenFn: async () => pages,
    getAssignedPagesForUserTokenFn,
    getMetaPageInstagramContextForUserTokenFn,
    getMetaPageInstagramContextForPageTokenFn,
    getMetaPageAccessContextForUserTokenFn,
    syncInstagramSourceLayerFn,
  });
}

async function seedPendingSelection(db) {
  const pages = [
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
  ];

  return invokeMetaCallbackWithPages(db, {
    pages,
    getMetaPageInstagramContextForUserTokenFn: buildPageEnrichmentLookup(pages),
  });
}

async function invokeSingleAccountCallback(
  db,
  {
    pageId = "page-1",
    pageName = "Acme Primary",
    pageAccessToken = "page-token-1",
    igUserId = "ig-1",
    igUsername = "acme.primary",
    getMetaPageInstagramContextForUserTokenFn,
    getMetaPageInstagramContextForPageTokenFn,
    getMetaPageAccessContextForUserTokenFn,
  } = {}
) {
  const page = {
    id: pageId,
    name: pageName,
    instagram_business_account: {
      id: igUserId,
      username: igUsername,
    },
  };
  if (pageAccessToken != null) {
    page.access_token = pageAccessToken;
  }

  return invokeMetaCallbackWithPages(db, {
    code: "meta-code-single",
    userAccessToken: "user-token-single",
    pages: [page],
    getMetaPageInstagramContextForUserTokenFn:
      getMetaPageInstagramContextForUserTokenFn ||
      buildPageEnrichmentLookup([page]),
    getMetaPageInstagramContextForPageTokenFn:
      getMetaPageInstagramContextForPageTokenFn ||
      (async (pageId, pageAccessToken) =>
        (
          getMetaPageInstagramContextForUserTokenFn ||
          buildPageEnrichmentLookup([page])
        )(pageId, pageAccessToken)),
    getMetaPageAccessContextForUserTokenFn,
  });
}

async function readMetaStatus(
  db,
  {
    verifyMetaChannelAccessFn = async () => ({
      ok: true,
      revoked: false,
    }),
    ...overrides
  } = {}
) {
  return getMetaStatus({
    db,
    req: {
      auth: buildAuth(),
    },
    verifyMetaChannelAccessFn,
    ...overrides,
  });
}

test("dm-first launch scopes drop business-management assumptions", () => {
  assert.deepEqual(META_DM_LAUNCH_SCOPES, [
    "pages_show_list",
    "instagram_basic",
    "instagram_manage_messages",
  ]);
  assert.equal(META_DM_LAUNCH_SCOPES.includes("business_management"), false);
});

test("oauth connect url requests only the live DM-first Meta scopes", async () => {
  const db = new FakeChannelConnectDb();

  const url = await buildMetaOAuthUrl({
    db,
    req: {
      auth: buildAuth(),
    },
  });

  const parsed = new URL(url);
  assert.equal(
    parsed.searchParams.get("scope"),
    META_DM_LAUNCH_SCOPES.join(",")
  );
});

test("starting a new reconnect clears stale pending selection and diagnostics first", async () => {
  const db = new FakeChannelConnectDb();
  await seedPendingSelection(db);
  await dbUpsertTenantSecret(
    db,
    "tenant-1",
    "meta",
    META_CONNECT_DIAGNOSTIC_SECRET_KEY,
    JSON.stringify({
      diagnosticId: "diag-1",
      reasonCode: "meta_pages_not_returned",
      message: "stale diagnostic",
      createdAt: "2026-04-05T00:00:00.000Z",
      expiresAt: "2026-04-05T00:15:00.000Z",
    }),
    "test"
  );

  await buildMetaOAuthUrl({
    db,
    req: {
      auth: buildAuth(),
    },
  });

  const secrets = await readMetaSecrets(db);
  assert.equal(secrets.connect_selection_pending, undefined);
  assert.equal(secrets.connect_diagnostic_pending, undefined);
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

test("instagram candidate listing only requires page and Instagram identities", () => {
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
      name: "Deferred token",
      instagram_business_account: {
        id: "ig-2",
        username: "acme.two",
      },
    },
    {
      id: "page-3",
      name: "No Instagram",
    },
  ]);

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].pageId, "page-1");
  assert.equal(candidates[0].igUserId, "ig-1");
  assert.equal(candidates[1].pageId, "page-2");
  assert.equal(candidates[1].igUserId, "ig-2");
  assert.equal(candidates[1].pageAccessToken, "");
});

test("candidate discovery supports instagram_accounts collection fallback", () => {
  const candidates = listInstagramPageCandidates([
    {
      id: "page-1",
      name: "Acme",
      instagram_accounts: {
        data: [{ id: "ig-1", username: "acme" }],
      },
    },
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].pageId, "page-1");
  assert.equal(candidates[0].igUserId, "ig-1");
  assert.equal(candidates[0].igUsername, "acme");
});

test("callback discovers a single Instagram candidate after second-step page enrichment", async () => {
  const db = new FakeChannelConnectDb();

  const callbackResult = await invokeMetaCallbackWithPages(db, {
    code: "meta-code-enriched-single",
    userAccessToken: "user-token-enriched-single",
    pages: [
      {
        id: "page-1",
        name: "Acme Primary",
        access_token: "page-token-1",
      },
    ],
    getMetaPageInstagramContextForUserTokenFn: async (pageId, userAccessToken) => {
      assert.equal(pageId, "page-1");
      assert.equal(userAccessToken, "user-token-enriched-single");
      return {
        id: "page-1",
        name: "Acme Primary",
        access_token: "page-token-1",
        instagram_business_account: {
          id: "ig-1",
          username: "acme.primary",
        },
      };
    },
  });

  assert.equal(callbackResult.type, "success");
  assert.equal(callbackResult.payload?.pageId, "page-1");
  assert.equal(callbackResult.payload?.igUserId, "ig-1");

  const status = await readMetaStatus(db);
  assert.equal(status.connected, true);
  assert.equal(status.account.pageId, "page-1");
  assert.equal(status.account.igUserId, "ig-1");
});

test("callback uses page-token enrichment when raw /me/accounts lacks instagram linkage", async () => {
  const db = new FakeChannelConnectDb();

  const callbackResult = await invokeMetaCallbackWithPages(db, {
    code: "meta-code-page-token-fallback",
    userAccessToken: "user-token-page-token-fallback",
    pages: [
      {
        id: "page-1",
        name: "Acme Primary",
        access_token: "page-token-1",
      },
    ],
    getMetaPageInstagramContextForUserTokenFn: async () => ({
      id: "page-1",
      name: "Acme Primary",
    }),
    getMetaPageInstagramContextForPageTokenFn: async (pageId, pageAccessToken) => {
      assert.equal(pageId, "page-1");
      assert.equal(pageAccessToken, "page-token-1");
      return {
        id: "page-1",
        name: "Acme Primary",
        access_token: "page-token-1",
        connected_instagram_account: {
          id: "ig-1",
          username: "acme.primary",
        },
      };
    },
  });

  assert.equal(callbackResult.type, "success");
  assert.equal(callbackResult.payload?.pageId, "page-1");
  assert.equal(callbackResult.payload?.igUserId, "ig-1");
});

test("callback keeps the selection flow when multiple pages need second-step enrichment", async () => {
  const db = new FakeChannelConnectDb();

  const callbackResult = await invokeMetaCallbackWithPages(db, {
    code: "meta-code-enriched-multi",
    userAccessToken: "user-token-enriched-multi",
    pages: [
      {
        id: "page-1",
        name: "Acme One",
      },
      {
        id: "page-2",
        name: "Acme Two",
        access_token: "page-token-2",
      },
    ],
    getMetaPageInstagramContextForUserTokenFn: async (pageId, userAccessToken) => {
      assert.equal(userAccessToken, "user-token-enriched-multi");
      if (pageId === "page-1") {
        return {
          id: "page-1",
          name: "Acme One",
          instagram_business_account: {
            id: "ig-1",
            username: "acme.one",
          },
        };
      }

      return {
        id: "page-2",
        name: "Acme Two",
        access_token: "page-token-2",
        connected_instagram_account: {
          id: "ig-2",
          username: "acme.two",
        },
      };
    },
  });

  assert.equal(callbackResult.type, "selection_required");

  const status = await readMetaStatus(db);
  assert.equal(status.pendingSelection?.required, true);
  assert.equal(status.pendingSelection?.candidateCount, 2);
  assert.equal(status.actions.selectionAvailable, true);
});

test("callback still fails truthfully when no Instagram linkage exists after enrichment", async () => {
  const db = new FakeChannelConnectDb();

  await assert.rejects(
    () =>
      invokeMetaCallbackWithPages(db, {
        code: "meta-code-no-candidate",
        userAccessToken: "user-token-no-candidate",
        pages: [
          {
            id: "page-1",
            name: "Acme Primary",
            access_token: "page-token-1",
          },
        ],
        getMetaPageInstagramContextForUserTokenFn: async (pageId, userAccessToken) => {
          assert.equal(pageId, "page-1");
          assert.equal(userAccessToken, "user-token-no-candidate");
          return {
            id: "page-1",
            name: "Acme Primary",
            access_token: "page-token-1",
          };
        },
        getMetaPageInstagramContextForPageTokenFn: async () => ({
          id: "page-1",
          name: "Acme Primary",
          access_token: "page-token-1",
        }),
      }),
    (error) => {
      assert.equal(
        error?.message,
        "Facebook Pages were returned, but no linked Instagram Business account could be found"
      );
      return true;
    }
  );

  const status = await readMetaStatus(db);
  assert.equal(status.state, "not_connected");
  assert.equal(status.reasonCode, "meta_no_instagram_business_account");
  assert.equal(
    status.lastConnectFailure?.reasonCode,
    "meta_no_instagram_business_account"
  );
});

test("callback falls back to assigned pages when /me/accounts is empty after reconnect", async () => {
  const db = new FakeChannelConnectDb();

  const callbackResult = await invokeMetaCallbackWithPages(db, {
    pages: [],
    assignedPages: [
      {
        id: "page-7",
        name: "Assigned Acme",
        access_token: "assigned-page-token",
        instagram_business_account: {
          id: "ig-7",
          username: "assigned.acme",
        },
      },
    ],
  });

  assert.equal(callbackResult.type, "success");
  assert.equal(callbackResult.payload?.pageId, "page-7");
  assert.equal(callbackResult.payload?.igUserId, "ig-7");

  const status = await readMetaStatus(db);
  assert.equal(status.state, "connected");
  assert.equal(status.account.pageId, "page-7");
  assert.equal(status.account.igUserId, "ig-7");
});

test("callback records a precise reconnect diagnostic when Meta grants no page assets after deauthorize", async () => {
  const db = new FakeChannelConnectDb();
  db.channel = buildDeauthorizedChannel();

  await assert.rejects(
    () =>
      invokeMetaCallbackWithPages(db, {
        userAccessToken: "user-token-empty-pages",
        pages: [],
        debugMetaUserTokenFn: async () =>
          buildDebugTokenPayload({
            scopes: META_DM_LAUNCH_SCOPES,
            userId: "meta-user-1",
            granularScopes: [
              {
                scope: "pages_show_list",
                target_ids: [],
              },
            ],
          }),
      }),
    (error) => {
      assert.equal(error?.reasonCode, "meta_pages_not_returned");
      assert.match(
        error?.message || "",
        /zero selected Facebook Pages|page discovery returned nothing/i
      );
      return true;
    }
  );

  const status = await readMetaStatus(db);
  assert.equal(status.state, "deauthorized");
  assert.equal(status.reasonCode, "meta_app_deauthorized");
  assert.equal(status.lastConnectFailure?.reasonCode, "meta_pages_not_returned");
  assert.match(
    status.readiness?.message || "",
    /latest Instagram connect attempt failed/i
  );
  assert.ok(
    status.readiness?.blockers?.some(
      (item) => item.reasonCode === "meta_pages_not_returned"
    )
  );
});

test("callback fails closed when Meta omits a required granted permission", async () => {
  const db = new FakeChannelConnectDb();

  await assert.rejects(
    () =>
      invokeMetaCallbackWithPages(db, {
        pages: [
          {
            id: "page-1",
            name: "Acme Primary",
            access_token: "page-token-1",
            instagram_business_account: {
              id: "ig-1",
              username: "acme.primary",
            },
          },
        ],
        getMetaPermissionsForUserTokenFn: async () =>
          buildGrantedPermissionPayload(META_DM_LAUNCH_SCOPES, {
            overrides: {
              instagram_manage_messages: "declined",
            },
          }),
        debugMetaUserTokenFn: async () =>
          buildDebugTokenPayload({
            scopes: ["pages_show_list", "instagram_basic"],
            userId: "meta-user-1",
          }),
      }),
    (error) => {
      assert.equal(error?.reasonCode, "meta_missing_granted_permissions");
      assert.match(error?.message || "", /instagram_manage_messages/);
      return true;
    }
  );

  const status = await readMetaStatus(db);
  assert.equal(status.state, "not_connected");
  assert.equal(status.reasonCode, "meta_missing_granted_permissions");
  assert.deepEqual(status.lastConnectFailure?.missingGrantedScopes, [
    "instagram_manage_messages",
  ]);
});

test("single-account callback still connects when /me/accounts already includes Instagram linkage", async () => {
  const db = new FakeChannelConnectDb();

  const callbackResult = await invokeSingleAccountCallback(db);

  assert.equal(callbackResult.type, "success");
  assert.match(callbackResult.redirectUrl || "", /meta_connected=1/);
  assert.equal(callbackResult.payload?.connected, true);
  assert.equal(callbackResult.payload?.pageId, "page-1");
  assert.equal(callbackResult.payload?.igUserId, "ig-1");
  assert.equal(callbackResult.payload?.sourceId, "source-1");
  assert.equal(db.channel?.status, "connected");

  const connectedAudits = db.auditEntries.filter(
    (entry) => entry.action === "settings.channel.meta.connected"
  );
  assert.equal(connectedAudits.length, 1);
  assert.equal(
    db.secretRows.has("tenant-1:meta:connect_selection_pending"),
    false
  );

  const status = await readMetaStatus(db);

  assert.equal(status.connected, true);
  assert.equal(status.state, "connected");
  assert.equal(status.pendingSelection, null);
  assert.equal(status.account.pageId, "page-1");
  assert.equal(status.account.igUserId, "ig-1");
  assert.equal(status.runtime.hasPageAccessToken, true);
  assert.equal(status.runtime.hasOperationalIds, true);
});

test("reconnect cleanly rebinds a stale deauthorized channel to the newly selected page and instagram account", async () => {
  const db = new FakeChannelConnectDb();
  db.channel = buildDeauthorizedChannel({
    pageId: "page-old",
    igUserId: "ig-old",
    username: "acme.old",
  });
  await seedMetaPageAccessToken(db, {
    token: "page-token-old",
  });

  const callbackResult = await invokeSingleAccountCallback(db, {
    pageId: "page-new",
    pageName: "Acme Rebound",
    pageAccessToken: "page-token-new",
    igUserId: "ig-new",
    igUsername: "acme.rebound",
  });

  assert.equal(callbackResult.type, "success");
  assert.equal(db.channel?.status, "connected");
  assert.equal(db.channel?.external_page_id, "page-new");
  assert.equal(db.channel?.external_user_id, "ig-new");
  assert.equal(db.channel?.external_username, "acme.rebound");

  const secrets = await readMetaSecrets(db);
  assert.equal(secrets.page_access_token, "page-token-new");
  assert.equal(secrets[META_CONNECT_DIAGNOSTIC_SECRET_KEY], undefined);

  const status = await readMetaStatus(db);
  assert.equal(status.state, "connected");
  assert.equal(status.account.pageId, "page-new");
  assert.equal(status.account.igUserId, "ig-new");
  assert.equal(status.lastConnectFailure, null);
});

test("single-account callback resolves a missing page access token after candidate discovery", async () => {
  const db = new FakeChannelConnectDb();

  const callbackResult = await invokeSingleAccountCallback(db, {
    pageAccessToken: null,
    getMetaPageAccessContextForUserTokenFn: async (pageId, userAccessToken) => {
      assert.equal(pageId, "page-1");
      assert.equal(userAccessToken, "user-token-single");
      return {
        id: "page-1",
        name: "Acme Primary",
        access_token: "page-token-fetched",
      };
    },
  });

  assert.equal(callbackResult.type, "success");
  assert.equal(callbackResult.payload?.pageId, "page-1");
  assert.equal(callbackResult.payload?.igUserId, "ig-1");

  const status = await readMetaStatus(db);
  assert.equal(status.connected, true);
  assert.equal(status.runtime.hasPageAccessToken, true);
});

test("multi-account callback persists a pending selection and keeps tenant status honest", async () => {
  const db = new FakeChannelConnectDb();

  const callbackResult = await seedPendingSelection(db);
  assert.equal(callbackResult.type, "selection_required");
  assert.match(callbackResult.redirectUrl || "", /meta_selection=1/);
  assert.equal(db.channel, null);

  const status = await readMetaStatus(db);

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

  const statusBefore = await readMetaStatus(db);

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

  const statusAfter = await readMetaStatus(db);

  assert.equal(statusAfter.state, "connected");
  assert.equal(statusAfter.pendingSelection, null);
  assert.equal(statusAfter.account.pageId, "page-2");
  assert.equal(statusAfter.account.igUserId, "ig-2");
  assert.equal(statusAfter.lifecycle.tokenType, "bearer");
  assert.match(statusAfter.lifecycle.userTokenExpiresAt || "", /^2026-|^20\d\d-/);
});

test("pending selection can resolve a deferred page access token when the operator completes the chooser", async () => {
  const db = new FakeChannelConnectDb();
  const pages = [
    {
      id: "page-1",
      name: "Acme One",
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
  ];

  await invokeMetaCallbackWithPages(db, {
    code: "meta-code-multi",
    userAccessToken: "user-token-multi",
    pages,
    getMetaPageInstagramContextForUserTokenFn: buildPageEnrichmentLookup(pages),
  });

  const statusBefore = await readMetaStatus(db);
  const result = await completeMetaSelection({
    db,
    req: {
      auth: buildAuth(),
      body: {
        selectionToken: statusBefore.pendingSelection?.selectionToken,
        candidateId: "page-1",
      },
    },
    getMetaPageAccessContextForUserTokenFn: async (pageId, userAccessToken) => {
      assert.equal(pageId, "page-1");
      assert.equal(userAccessToken, "user-token-multi");
      return {
        id: "page-1",
        name: "Acme One",
        access_token: "page-token-fetched",
      };
    },
    syncInstagramSourceLayerFn: async ({ selected }) => ({
      source: {
        id: "source-1",
        source_key: `instagram:${selected.igUserId}`,
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
  assert.equal(result.pageId, "page-1");

  const statusAfter = await readMetaStatus(db);
  assert.equal(statusAfter.connected, true);
  assert.equal(statusAfter.runtime.hasPageAccessToken, true);
});

test("expired pending selection is cleaned up instead of lingering as a pseudo-connected state", async () => {
  const db = new FakeChannelConnectDb();
  const realDateNow = Date.now;

  try {
    Date.now = () => Date.parse("2026-04-05T00:00:00.000Z");
    await seedPendingSelection(db);

    Date.now = () => Date.parse("2026-04-05T00:20:00.000Z");

    const status = await readMetaStatus(db);

    assert.equal(status.state, "not_connected");
    assert.equal(status.pendingSelection, null);
    assert.equal(db.secretRows.size, 0);
  } finally {
    Date.now = realDateNow;
  }
});

test("connected rows do not override reconnect-required lifecycle truth", async () => {
  const db = new FakeChannelConnectDb();
  db.channel = {
    id: "channel-1",
    tenant_id: "tenant-1",
    channel_type: "instagram",
    provider: "meta",
    display_name: "Instagram @acme",
    external_account_id: "",
    external_page_id: "page-1",
    external_user_id: "ig-1",
    external_username: "acme",
    status: "connected",
    is_primary: true,
    config: {
      requested_scopes: META_DM_LAUNCH_SCOPES,
      granted_scopes: META_DM_LAUNCH_SCOPES,
      disconnect_reason: "channel_reconnect_required",
    },
    secrets_ref: "meta",
    health: {
      connection_state: "reconnect_required",
      auth_status: "reconnect_required",
      manual_reconnect_required: true,
      disconnect_reason: "channel_reconnect_required",
    },
    last_sync_at: null,
    created_at: "2026-04-05T00:00:00.000Z",
    updated_at: "2026-04-05T00:00:00.000Z",
  };
  await seedMetaPageAccessToken(db);

  const status = await readMetaStatus(db);

  assert.equal(status.connected, false);
  assert.equal(status.state, "reconnect_required");
  assert.equal(status.reasonCode, "channel_reconnect_required");
});

test("status refresh deauthorizes a previously connected channel when Meta rejects the stored token", async () => {
  const db = new FakeChannelConnectDb();
  db.channel = {
    id: "channel-1",
    tenant_id: "tenant-1",
    channel_type: "instagram",
    provider: "meta",
    display_name: "Instagram @acme",
    external_account_id: "",
    external_page_id: "page-1",
    external_user_id: "ig-1",
    external_username: "acme",
    status: "connected",
    is_primary: true,
    config: {
      requested_scopes: META_DM_LAUNCH_SCOPES,
      granted_scopes: META_DM_LAUNCH_SCOPES,
      meta_user_id: "meta-user-1",
      meta_user_name: "Acme Owner",
      last_connected_page_name: "Acme",
      last_connected_username: "acme",
      last_known_page_id: "page-1",
      last_known_ig_user_id: "ig-1",
    },
    secrets_ref: "meta",
    health: {
      connection_state: "connected",
      auth_status: "authorized",
      token_type: "bearer",
    },
    last_sync_at: "2026-04-05T03:00:00.000Z",
    created_at: "2026-04-05T00:00:00.000Z",
    updated_at: "2026-04-05T00:00:00.000Z",
  };
  await seedMetaPageAccessToken(db);

  const status = await readMetaStatus(db, {
    verifyMetaChannelAccessFn: async () => ({
      ok: false,
      revoked: true,
      reasonCode: "meta_app_deauthorized",
      metaError: {
        status: 401,
        code: 190,
        subcode: 0,
        type: "OAuthException",
        message: "Error validating access token",
      },
    }),
  });

  assert.equal(status.connected, false);
  assert.equal(status.state, "deauthorized");
  assert.equal(status.reasonCode, "meta_app_deauthorized");
  assert.equal(status.lifecycle.authStatus, "revoked");
  assert.equal(status.lifecycle.disconnectReason, "meta_app_deauthorized");
  assert.match(status.lifecycle.deauthorizedAt || "", /^2026-|^20\d\d-/);
  assert.equal(status.runtime.hasPageAccessToken, false);
  assert.equal(status.actions.reconnectAvailable, true);

  assert.equal(db.channel?.status, "error");
  assert.equal(db.channel?.external_page_id, null);
  assert.equal(db.channel?.external_user_id, null);
  assert.equal(db.channel?.health?.connection_state, "deauthorized");
  assert.equal(db.channel?.health?.auth_status, "revoked");
  assert.equal(db.channel?.health?.manual_reconnect_required, true);
  assert.equal(
    db.channel?.health?.disconnect_reason,
    "meta_app_deauthorized"
  );
  assert.match(db.channel?.health?.deauthorized_at || "", /^2026-|^20\d\d-/);
  assert.equal(db.secretRows.has("tenant-1:meta:page_access_token"), false);

  const auditEntry = db.auditEntries.find(
    (entry) => entry.action === "settings.channel.meta.deauthorized"
  );
  assert.ok(auditEntry);
  assert.equal(auditEntry?.meta?.reasonCode, "meta_app_deauthorized");
});

test("missing page token keeps a seemingly connected channel fail-closed", async () => {
  const db = new FakeChannelConnectDb();
  db.channel = {
    id: "channel-1",
    tenant_id: "tenant-1",
    channel_type: "instagram",
    provider: "meta",
    display_name: "Instagram @acme",
    external_account_id: "",
    external_page_id: "page-1",
    external_user_id: "ig-1",
    external_username: "acme",
    status: "connected",
    is_primary: true,
    config: {
      requested_scopes: META_DM_LAUNCH_SCOPES,
      granted_scopes: META_DM_LAUNCH_SCOPES,
      last_connected_page_name: "Acme",
      last_connected_username: "acme",
    },
    secrets_ref: "meta",
    health: {
      connection_state: "connected",
      auth_status: "authorized",
    },
    last_sync_at: "2026-04-05T03:00:00.000Z",
    created_at: "2026-04-05T00:00:00.000Z",
    updated_at: "2026-04-05T00:00:00.000Z",
  };

  const status = await readMetaStatus(db);

  assert.equal(status.connected, false);
  assert.equal(status.state, "reconnect_required");
  assert.equal(status.reasonCode, "provider_secret_missing");
  assert.equal(status.runtime.deliveryReady, false);
  assert.equal(status.runtime.hasPageAccessToken, false);
});

test("single-account callback fails with a precise error when the page asset exists but no page token can be obtained", async () => {
  const db = new FakeChannelConnectDb();

  await assert.rejects(
    () =>
      invokeSingleAccountCallback(db, {
        pageAccessToken: null,
        getMetaPageAccessContextForUserTokenFn: async () => ({
          id: "page-1",
          name: "Acme Primary",
        }),
      }),
    (error) => {
      assert.equal(
        error?.message,
        "Instagram/Page asset found, but page access token could not be obtained"
      );
      return true;
    }
  );
});

test("connect diagnostics and logs stay redacted even when reconnect fails", async () => {
  const db = new FakeChannelConnectDb();
  const logEntries = [];
  const reqLog = createFakeReqLogger(logEntries);

  await assert.rejects(
    () =>
      invokeMetaCallbackWithPages(db, {
        userAccessToken: "user-token-secret-value",
        pages: [
          {
            id: "page-1",
            name: "Acme Primary",
            access_token: "page-token-secret-value",
            instagram_business_account: {
              id: "ig-1",
              username: "acme.primary",
            },
          },
        ],
        getMetaPermissionsForUserTokenFn: async () =>
          buildGrantedPermissionPayload(META_DM_LAUNCH_SCOPES, {
            overrides: {
              instagram_manage_messages: "declined",
            },
          }),
        debugMetaUserTokenFn: async () =>
          buildDebugTokenPayload({
            scopes: ["pages_show_list", "instagram_basic"],
            userId: "meta-user-1",
          }),
        reqLog,
      }),
    (error) => {
      assert.equal(error?.reasonCode, "meta_missing_granted_permissions");
      return true;
    }
  );

  const serializedLogs = JSON.stringify(logEntries);
  assert.equal(serializedLogs.includes("user-token-secret-value"), false);
  assert.equal(serializedLogs.includes("page-token-secret-value"), false);

  const secrets = await readMetaSecrets(db);
  const diagnostic = JSON.parse(
    secrets[META_CONNECT_DIAGNOSTIC_SECRET_KEY] || "{}"
  );
  assert.equal(diagnostic.userAccessToken, undefined);
  assert.equal(diagnostic.pageAccessToken, undefined);
  assert.equal(diagnostic.reasonCode, "meta_missing_granted_permissions");
});

test("connected status stays truthful while expired user tokens trigger reconnect guidance", async () => {
  const db = new FakeChannelConnectDb();
  const realDateNow = Date.now;

  db.channel = {
    id: "channel-1",
    tenant_id: "tenant-1",
    channel_type: "instagram",
    provider: "meta",
    display_name: "Instagram @acme",
    external_account_id: "",
    external_page_id: "page-1",
    external_user_id: "ig-1",
    external_username: "acme",
    status: "connected",
    is_primary: true,
    config: {
      requested_scopes: META_DM_LAUNCH_SCOPES,
      granted_scopes: META_DM_LAUNCH_SCOPES,
      last_connected_page_name: "Acme",
      last_connected_username: "acme",
    },
    secrets_ref: "meta",
    health: {
      connection_state: "connected",
      auth_status: "authorized",
      user_token_expires_at: "2026-04-05T04:00:00.000Z",
    },
    last_sync_at: "2026-04-05T03:00:00.000Z",
    created_at: "2026-04-05T00:00:00.000Z",
    updated_at: "2026-04-05T00:00:00.000Z",
  };
  await seedMetaPageAccessToken(db);

  try {
    Date.now = () => Date.parse("2026-04-05T04:10:00.000Z");

    const status = await readMetaStatus(db);

    assert.equal(status.connected, true);
    assert.equal(status.state, "connected");
    assert.equal(status.lifecycle.userToken.status, "expired");
    assert.equal(status.attention.reconnectRecommended, true);
    assert.equal(status.actions.reconnectRecommended, true);
    assert.equal(status.attention.items[0]?.reasonCode, "user_token_expired");
  } finally {
    Date.now = realDateNow;
  }
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

  const statusAfter = await readMetaStatus(db);

  assert.equal(statusAfter.state, "not_connected");
  assert.equal(statusAfter.pendingSelection, null);
});

test("disconnect clears a failed reconnect diagnostic without fabricating a disconnected channel row", async () => {
  const db = new FakeChannelConnectDb();

  await assert.rejects(
    () =>
      invokeMetaCallbackWithPages(db, {
        pages: [],
        debugMetaUserTokenFn: async () =>
          buildDebugTokenPayload({
            scopes: META_DM_LAUNCH_SCOPES,
            userId: "meta-user-1",
            granularScopes: [
              {
                scope: "pages_show_list",
                target_ids: [],
              },
            ],
          }),
      }),
    (error) => {
      assert.equal(error?.reasonCode, "meta_pages_not_returned");
      return true;
    }
  );

  const result = await disconnectMeta({
    db,
    req: {
      auth: buildAuth(),
    },
  });

  assert.equal(result.clearedConnectDiagnostic, true);
  assert.equal(db.channel, null);

  const statusAfter = await readMetaStatus(db);
  assert.equal(statusAfter.state, "not_connected");
  assert.equal(statusAfter.lastConnectFailure, null);
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

  const statusAfter = await readMetaStatus(db);

  assert.equal(statusAfter.state, "deauthorized");
  assert.equal(statusAfter.pendingSelection, null);
});
