import test from "node:test";
import assert from "node:assert/strict";

process.env.TENANT_SECRET_MASTER_KEY =
  process.env.TENANT_SECRET_MASTER_KEY || "b".repeat(64);
process.env.TELEGRAM_ENABLED = process.env.TELEGRAM_ENABLED || "1";
process.env.TELEGRAM_API_BASE_URL =
  process.env.TELEGRAM_API_BASE_URL || "https://api.telegram.test";
process.env.TELEGRAM_WEBHOOK_BASE_URL =
  process.env.TELEGRAM_WEBHOOK_BASE_URL || "https://backend.example.test";

const configModule = await import("../src/config.js");
const telegramModule = await import("../src/routes/api/channelConnect/telegram.js");
const publicModule = await import("../src/routes/api/channelConnect/public.js");
const tenantSecretsModule = await import("../src/db/helpers/tenantSecrets.js");
const deliveryModule = await import("../src/services/channelDelivery.js");
const durableModule = await import("../src/services/durableExecutionService.js");

const { cfg } = configModule;
const {
  TELEGRAM_BOT_TOKEN_SECRET_KEY,
  TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY,
  TELEGRAM_WEBHOOK_SECRET_TOKEN_SECRET_KEY,
  buildTelegramWebhookUrl,
  connectTelegram,
  disconnectTelegram,
  getTelegramStatus,
} = telegramModule;
const {
  createTelegramWebhookHandler,
  __test__: telegramPublicTest,
} = publicModule;
const { dbGetTenantProviderSecrets, dbUpsertTenantSecret } = tenantSecretsModule;
const { deliverChannelOutbound } = deliveryModule;
const { buildChannelOutboundExecutionInput } = durableModule;

cfg.security.tenantSecretMasterKey =
  cfg.security.tenantSecretMasterKey || process.env.TENANT_SECRET_MASTER_KEY;
cfg.telegram.enabled = true;
cfg.telegram.apiBaseUrl = process.env.TELEGRAM_API_BASE_URL;
cfg.telegram.webhookBaseUrl = process.env.TELEGRAM_WEBHOOK_BASE_URL;
cfg.telegram.connectTimeoutMs = 5_000;
cfg.telegram.statusTimeoutMs = 5_000;
cfg.telegram.sendTimeoutMs = 5_000;

function normalizeSql(sql = "") {
  return String(sql || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function parseJsonLike(value, fallback = {}) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  return value && typeof value === "object" ? clone(value) : fallback;
}

function createResponse(status = 200, json = {}) {
  return new Response(JSON.stringify(json), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function createTelegramFetchMock(handlers = {}) {
  const calls = [];
  const queues = Object.fromEntries(
    Object.entries(handlers).map(([method, entries]) => [
      method,
      Array.isArray(entries) ? [...entries] : [entries],
    ])
  );

  return {
    calls,
    fetch: async (url, init = {}) => {
      const parsed = new URL(url);
      const method = parsed.pathname.split("/").filter(Boolean).at(-1) || "";
      const requestBody = parseJsonLike(init.body, null);

      calls.push({
        method,
        url,
        body: requestBody,
      });

      const queue = queues[method];
      if (!queue?.length) {
        throw new Error(`Unexpected Telegram API call: ${method}`);
      }

      const next = queue.shift();
      if (typeof next === "function") {
        const result = await next({
          method,
          url,
          body: requestBody,
          init,
        });

        return createResponse(result?.status || 200, result?.json || {});
      }

      return createResponse(next?.status || 200, next?.json || {});
    },
  };
}

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function buildAuthedReq({
  tenantKey = "acme",
  email = "owner@acme.test",
  body = {},
  params = {},
  headers = {},
  url = "/api/channels/telegram/connect",
} = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      String(key).toLowerCase(),
      value,
    ])
  );

  return {
    auth: {
      tenantKey,
      email,
      userId: "user-1",
    },
    body,
    params,
    headers: normalizedHeaders,
    originalUrl: url,
    url,
    path: url,
    get(name) {
      return this.headers[String(name || "").toLowerCase()];
    },
  };
}

class FakeTelegramChannelDb {
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
      inbox_policy: {},
    };
    this.channel = null;
    this.auditEntries = [];
    this.secretRows = new Map();
  }

  _secretKey(tenantId, provider, secretKey) {
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

  _nowIso() {
    return "2026-04-06T00:00:00.000Z";
  }

  _insertChannel(values = []) {
    return {
      id: this.channel?.id || "channel-telegram-1",
      tenant_id: values[0],
      channel_type: values[1],
      provider: values[2],
      display_name: values[3],
      external_account_id: values[4],
      external_page_id: values[5],
      external_user_id: values[6],
      external_username: values[7],
      status: values[8],
      is_primary: Boolean(values[9]),
      config: parseJsonLike(values[10], {}),
      secrets_ref: values[11],
      health: parseJsonLike(values[12], {}),
      last_sync_at: values[13],
      created_at: this.channel?.created_at || this._nowIso(),
      updated_at: this._nowIso(),
    };
  }

  _updateChannel(values = []) {
    return {
      id: values[0],
      tenant_id: this.channel?.tenant_id || this.tenant.id,
      channel_type: this.channel?.channel_type || "telegram",
      provider: values[1],
      display_name: values[2],
      external_account_id: values[3],
      external_page_id: values[4],
      external_user_id: values[5],
      external_username: values[6],
      status: values[7],
      is_primary: Boolean(values[8]),
      config: parseJsonLike(values[9], {}),
      secrets_ref: values[10],
      health: parseJsonLike(values[11], {}),
      last_sync_at: values[12],
      created_at: this.channel?.created_at || this._nowIso(),
      updated_at: this._nowIso(),
    };
  }

  seedChannel(channel = {}) {
    this.channel = {
      id: "channel-telegram-1",
      tenant_id: this.tenant.id,
      channel_type: "telegram",
      provider: "telegram",
      display_name: "Telegram",
      external_account_id: null,
      external_page_id: null,
      external_user_id: null,
      external_username: null,
      status: "disconnected",
      is_primary: true,
      config: {},
      secrets_ref: "telegram",
      health: {},
      last_sync_at: null,
      created_at: this._nowIso(),
      updated_at: this._nowIso(),
      ...clone(channel),
    };
  }

  async query(text, values = []) {
    const sql = normalizeSql(text);

    if (
      sql.includes("from tenants") &&
      (sql.includes("where lower(tenant_key) = $1") ||
        sql.includes("where tenant_key = $1::text"))
    ) {
      const requestedKey = String(values[0] || "").trim().toLowerCase();
      return {
        rows:
          requestedKey === String(this.tenant.tenant_key || "").toLowerCase()
            ? [clone(this.tenant)]
            : [],
      };
    }

    if (
      sql.includes("select * from tenant_channels") &&
      sql.includes("channel_type = 'telegram'")
    ) {
      return { rows: this.channel ? [clone(this.channel)] : [] };
    }

    if (
      sql.includes("select id from tenant_channels") &&
      sql.includes("channel_type = $2")
    ) {
      return {
        rows:
          this.channel &&
          String(this.channel.tenant_id || "") === String(values[0] || "") &&
          String(this.channel.channel_type || "").toLowerCase() ===
            String(values[1] || "").toLowerCase()
            ? [{ id: this.channel.id }]
            : [],
      };
    }

    if (sql.startsWith("update tenant_channels")) {
      this.channel = this._updateChannel(values);
      return { rows: [clone(this.channel)] };
    }

    if (sql.startsWith("insert into tenant_channels")) {
      this.channel = this._insertChannel(values);
      return { rows: [clone(this.channel)] };
    }

    if (
      sql.startsWith("select") &&
      sql.includes("from tenant_secrets") &&
      sql.includes("where tenant_id = $1") &&
      sql.includes("provider = $2")
    ) {
      return {
        rows: this._listSecretRows(values[0], String(values[1] || "").toLowerCase()).map(
          (row) => clone(row)
        ),
      };
    }

    if (sql.startsWith("insert into tenant_secrets")) {
      const now = this._nowIso();
      const [tenantId, provider, secretKey, enc, iv, tag, actor] = values;
      const mapKey = this._secretKey(tenantId, provider, secretKey);
      const existing = this.secretRows.get(mapKey);
      const row = {
        id: existing?.id || `secret-${provider}-${secretKey}`,
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
      return { rows: [clone(row)] };
    }

    if (sql.startsWith("delete from tenant_secrets")) {
      const tenantId = String(values[0] || "");
      const provider = String(values[1] || "").toLowerCase();
      const secretKey = String(values[2] || "").toLowerCase();
      let deleted = 0;

      for (const [mapKey, row] of this.secretRows.entries()) {
        if (
          row.tenant_id === tenantId &&
          String(row.provider || "").toLowerCase() === provider &&
          String(row.secret_key || "").toLowerCase() === secretKey
        ) {
          this.secretRows.delete(mapKey);
          deleted += 1;
        }
      }

      return {
        rows: [],
        rowCount: deleted,
      };
    }

    if (sql.includes("insert into audit_log")) {
      this.auditEntries.push({
        tenant_id: values[0],
        tenant_key: values[1],
        actor: values[2],
        action: values[3],
        object_type: values[4],
        object_id: values[5],
        meta: clone(values[6]),
      });
      return { rows: [] };
    }

    throw new Error(`Unhandled SQL in FakeTelegramChannelDb: ${sql}`);
  }
}

test("telegram connect validates the bot token, stores secrets, and verifies the webhook truthfully", async () => {
  const db = new FakeTelegramChannelDb();
  const previousFetch = global.fetch;
  const fetchMock = createTelegramFetchMock({
    getMe: [
      {
        json: {
          ok: true,
          result: {
            id: "7001",
            is_bot: true,
            username: "acmebot",
            first_name: "Acme Bot",
            can_join_groups: false,
          },
        },
      },
    ],
    setWebhook: [
      ({ body }) => {
        assert.match(String(body?.url || ""), /\/channels\/telegram\/webhook\/acme\//);
        assert.equal(Array.isArray(body?.allowed_updates), true);
        assert.deepEqual(body?.allowed_updates, ["message"]);
        assert.equal(typeof body?.secret_token, "string");
        assert.equal(body?.secret_token.length > 10, true);

        return {
          json: {
            ok: true,
            result: true,
          },
        };
      },
    ],
    getWebhookInfo: [
      ({ body }) => {
        assert.equal(body && typeof body, "object");
        const expectedUrl = fetchMock.calls.find((call) => call.method === "setWebhook")?.body?.url;
        return {
          json: {
            ok: true,
            result: {
              url: expectedUrl,
              pending_update_count: 0,
            },
          },
        };
      },
    ],
  });

  global.fetch = fetchMock.fetch;

  try {
    const payload = await connectTelegram({
      db,
      req: buildAuthedReq({
        body: {
          botToken: "123456:telegram-valid-token",
        },
      }),
    });

    const secrets = await dbGetTenantProviderSecrets(db, db.tenant.id, "telegram");

    assert.equal(payload.connected, true);
    assert.equal(payload.state, "connected");
    assert.equal(payload.account.botUsername, "acmebot");
    assert.equal(payload.webhook.verified, true);
    assert.equal(payload.channel?.provider, "telegram");
    assert.equal(payload.readiness?.status, "blocked");
    assert.equal(
      payload.readiness?.blockers?.some(
        (item) => item?.reasonCode === "runtime_authority_unavailable"
      ),
      true
    );
    assert.equal(
      typeof secrets?.[TELEGRAM_BOT_TOKEN_SECRET_KEY],
      "string"
    );
    assert.equal(
      typeof secrets?.[TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY],
      "string"
    );
    assert.equal(
      typeof secrets?.[TELEGRAM_WEBHOOK_SECRET_TOKEN_SECRET_KEY],
      "string"
    );
    assert.equal(db.channel?.status, "connected");
    assert.equal(db.channel?.external_username, "acmebot");
    assert.equal(
      db.auditEntries.some(
        (entry) => entry.action === "settings.channel.telegram.connected"
      ),
      true
    );
  } finally {
    global.fetch = previousFetch;
  }
});

test("telegram connect fails closed on an invalid bot token and records reconnect-required truth", async () => {
  const db = new FakeTelegramChannelDb();
  const previousFetch = global.fetch;
  const fetchMock = createTelegramFetchMock({
    getMe: [
      {
        status: 401,
        json: {
          ok: false,
          error_code: 401,
          description: "Unauthorized",
        },
      },
    ],
  });

  global.fetch = fetchMock.fetch;

  try {
    await assert.rejects(
      () =>
        connectTelegram({
          db,
          req: buildAuthedReq({
            body: {
              botToken: "123456:telegram-invalid-token",
            },
          }),
        }),
      (error) => {
        assert.equal(error?.status, 409);
        assert.equal(error?.reasonCode, "telegram_bot_token_invalid");
        return true;
      }
    );

    assert.equal(db.secretRows.size, 0);
    assert.equal(db.channel?.status, "error");
    assert.equal(
      db.channel?.health?.last_connect_failure?.reasonCode,
      "telegram_bot_token_invalid"
    );
    assert.equal(
      db.auditEntries.some(
        (entry) => entry.action === "settings.channel.telegram.connect_failed"
      ),
      true
    );
  } finally {
    global.fetch = previousFetch;
  }
});

test("telegram status stays fail-closed when the stored webhook no longer matches the tenant route", async () => {
  const db = new FakeTelegramChannelDb();
  const previousFetch = global.fetch;
  const connectFetchCalls = [];

  const connectFetchMock = createTelegramFetchMock({
    getMe: [
      {
        json: {
          ok: true,
          result: {
            id: "7002",
            is_bot: true,
            username: "statusbot",
            first_name: "Status Bot",
          },
        },
      },
    ],
    setWebhook: [
      ({ body }) => {
        connectFetchCalls.push({
          method: "setWebhook",
          body,
        });

        return {
          json: {
            ok: true,
            result: true,
          },
        };
      },
    ],
    getWebhookInfo: [
      () => ({
        json: {
          ok: true,
          result: {
            url: connectFetchCalls.at(-1)?.body?.url || "",
            pending_update_count: 0,
          },
        },
      }),
    ],
  });

  global.fetch = connectFetchMock.fetch;

  try {
    await connectTelegram({
      db,
      req: buildAuthedReq({
        body: {
          botToken: "123456:telegram-status-token",
        },
      }),
    });

    const storedSecrets = await dbGetTenantProviderSecrets(db, db.tenant.id, "telegram");
    const expectedWebhookUrl = buildTelegramWebhookUrl({
      tenantKey: db.tenant.tenant_key,
      routeToken: storedSecrets[TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY],
    });

    const statusFetchMock = createTelegramFetchMock({
      getMe: [
        {
          json: {
            ok: true,
            result: {
              id: "7002",
              is_bot: true,
              username: "statusbot",
              first_name: "Status Bot",
            },
          },
        },
      ],
      getWebhookInfo: [
        {
          json: {
            ok: true,
            result: {
              url: `${expectedWebhookUrl}-drift`,
              pending_update_count: 2,
            },
          },
        },
      ],
    });

    global.fetch = statusFetchMock.fetch;

    const payload = await getTelegramStatus({
      db,
      req: buildAuthedReq({
        url: "/api/channels/telegram/status",
      }),
    });

    assert.equal(payload.connected, false);
    assert.equal(payload.state, "error");
    assert.equal(payload.webhook.verified, false);
    assert.equal(payload.webhook.reasonCode, "telegram_webhook_mismatch");
    assert.equal(payload.actions.reconnectAvailable, true);
    assert.equal(
      payload.readiness.blockers.some(
        (item) => item?.reasonCode === "telegram_webhook_mismatch"
      ),
      true
    );
  } finally {
    global.fetch = previousFetch;
  }
});

test("telegram disconnect removes tenant secrets, deletes the webhook, and preserves bot identity truthfully", async () => {
  const db = new FakeTelegramChannelDb();
  const previousFetch = global.fetch;
  const connectFetchCalls = [];

  const connectFetchMock = createTelegramFetchMock({
    getMe: [
      {
        json: {
          ok: true,
          result: {
            id: "7003",
            is_bot: true,
            username: "disconnectbot",
            first_name: "Disconnect Bot",
          },
        },
      },
    ],
    setWebhook: [
      ({ body }) => {
        connectFetchCalls.push({
          method: "setWebhook",
          body,
        });

        return {
          json: {
            ok: true,
            result: true,
          },
        };
      },
    ],
    getWebhookInfo: [
      () => ({
        json: {
          ok: true,
          result: {
            url: connectFetchCalls.at(-1)?.body?.url || "",
            pending_update_count: 0,
          },
        },
      }),
    ],
  });

  global.fetch = connectFetchMock.fetch;

  try {
    await connectTelegram({
      db,
      req: buildAuthedReq({
        body: {
          botToken: "123456:telegram-disconnect-token",
        },
      }),
    });

    const disconnectFetchMock = createTelegramFetchMock({
      deleteWebhook: [
        {
          json: {
            ok: true,
            result: true,
          },
        },
      ],
    });

    global.fetch = disconnectFetchMock.fetch;

    const payload = await disconnectTelegram({
      db,
      req: buildAuthedReq({
        url: "/api/channels/telegram/disconnect",
      }),
    });

    const secrets = await dbGetTenantProviderSecrets(db, db.tenant.id, "telegram");

    assert.equal(payload.disconnected, true);
    assert.equal(payload.remoteWebhookRemoved, true);
    assert.equal(payload.status?.state, "disconnected");
    assert.equal(payload.status?.actions?.disconnectAvailable, true);
    assert.equal(payload.preservedBotIdentity?.botUsername, "disconnectbot");
    assert.deepEqual(secrets, {});
    assert.equal(db.channel?.status, "disconnected");
    assert.equal(db.channel?.config?.disconnect_reason, "user_disconnect");
    assert.equal(
      db.auditEntries.some(
        (entry) => entry.action === "settings.channel.telegram.disconnected"
      ),
      true
    );
  } finally {
    global.fetch = previousFetch;
  }
});

test("telegram webhook normalization keeps chat identity authoritative and builds the internal ingest payload correctly", () => {
  const normalized = telegramPublicTest.normalizeTelegramWebhookUpdate(
    {
      update_id: 4001,
      message: {
        message_id: 44,
        date: 1712350000,
        text: "Need help with pricing",
        chat: {
          id: "chat-101",
          type: "private",
        },
        from: {
          id: "user-202",
          username: "acme_customer",
          first_name: "Acme",
          last_name: "Customer",
        },
      },
    },
    "acme"
  );

  assert.equal(normalized.supported, true);
  assert.equal(normalized.input.tenantKey, "acme");
  assert.equal(normalized.input.externalThreadId, "chat-101");
  assert.equal(normalized.input.externalUserId, "user-202");
  assert.notEqual(
    normalized.input.externalThreadId,
    normalized.input.externalUserId
  );
  assert.equal(normalized.input.externalMessageId, "telegram:chat-101:44");
  assert.equal(normalized.input.customerName, "Acme Customer");
  assert.equal(normalized.input.meta?.source, "telegram");

  const internalReq = telegramPublicTest.buildInternalIngestRequest(
    buildAuthedReq({
      url: "/api/channels/telegram/webhook/acme/token-1",
    }),
    "acme",
    normalized.input
  );

  assert.equal(internalReq.headers["x-tenant-key"], "acme");
  assert.equal(internalReq.headers["x-channel-provider"], "telegram");
  assert.equal(internalReq.body.channel, "telegram");
  assert.equal(internalReq.body.source, "telegram");
  assert.equal(internalReq.body.externalThreadId, "chat-101");
});

test("telegram webhook handler fails closed on route/header secret mismatch and safely ignores unsupported updates", async () => {
  const db = new FakeTelegramChannelDb();
  const actor = "owner@acme.test";

  db.seedChannel({
    external_user_id: "7004",
    external_username: "webhookbot",
    status: "connected",
  });

  await dbUpsertTenantSecret(
    db,
    db.tenant.id,
    "telegram",
    TELEGRAM_BOT_TOKEN_SECRET_KEY,
    "123456:webhook-token",
    actor
  );
  await dbUpsertTenantSecret(
    db,
    db.tenant.id,
    "telegram",
    TELEGRAM_WEBHOOK_ROUTE_TOKEN_SECRET_KEY,
    "route-secret-1",
    actor
  );
  await dbUpsertTenantSecret(
    db,
    db.tenant.id,
    "telegram",
    TELEGRAM_WEBHOOK_SECRET_TOKEN_SECRET_KEY,
    "header-secret-1",
    actor
  );

  const handler = createTelegramWebhookHandler({ db });

  const wrongRouteRes = createMockRes();
  await handler(
    buildAuthedReq({
      url: "/api/channels/telegram/webhook/acme/wrong-route",
      params: {
        tenantKey: "acme",
        routeToken: "wrong-route",
      },
      headers: {
        "x-telegram-bot-api-secret-token": "header-secret-1",
      },
      body: {},
    }),
    wrongRouteRes
  );

  assert.equal(wrongRouteRes.statusCode, 404);
  assert.equal(wrongRouteRes.body?.ok, false);

  const wrongHeaderRes = createMockRes();
  await handler(
    buildAuthedReq({
      url: "/api/channels/telegram/webhook/acme/route-secret-1",
      params: {
        tenantKey: "acme",
        routeToken: "route-secret-1",
      },
      headers: {
        "x-telegram-bot-api-secret-token": "wrong-header",
      },
      body: {},
    }),
    wrongHeaderRes
  );

  assert.equal(wrongHeaderRes.statusCode, 403);
  assert.equal(wrongHeaderRes.body?.reasonCode, "telegram_webhook_secret_invalid");

  const ignoredRes = createMockRes();
  await handler(
    buildAuthedReq({
      url: "/api/channels/telegram/webhook/acme/route-secret-1",
      params: {
        tenantKey: "acme",
        routeToken: "route-secret-1",
      },
      headers: {
        "x-telegram-bot-api-secret-token": "header-secret-1",
      },
      body: {
        update_id: 9001,
        message: {
          message_id: 77,
          text: "hello from a group",
          chat: {
            id: "chat-group-1",
            type: "group",
          },
          from: {
            id: "user-group-1",
          },
        },
      },
    }),
    ignoredRes
  );

  assert.equal(ignoredRes.statusCode, 200);
  assert.equal(ignoredRes.body?.ok, true);
  assert.equal(ignoredRes.body?.ignored, true);
  assert.equal(ignoredRes.body?.reasonCode, "unsupported_chat_type");
});

test("telegram outbound delivery uses the telegram provider path and durable execution input stays provider-aware", async () => {
  const db = new FakeTelegramChannelDb();
  const previousFetch = global.fetch;

  db.seedChannel({
    display_name: "Telegram @replybot",
    external_user_id: "7005",
    external_username: "replybot",
    status: "connected",
  });

  await dbUpsertTenantSecret(
    db,
    db.tenant.id,
    "telegram",
    TELEGRAM_BOT_TOKEN_SECRET_KEY,
    "123456:delivery-token",
    "owner@acme.test"
  );

  const fetchMock = createTelegramFetchMock({
    sendMessage: [
      ({ body }) => {
        assert.equal(body?.chat_id, "chat-303");
        assert.equal(body?.text, "AI reply from Telegram");

        return {
          json: {
            ok: true,
            result: {
              message_id: 8080,
            },
          },
        };
      },
    ],
  });

  global.fetch = fetchMock.fetch;

  try {
    const execution = buildChannelOutboundExecutionInput({
      tenantId: db.tenant.id,
      tenantKey: db.tenant.tenant_key,
      channel: "telegram",
      provider: "telegram",
      threadId: "thread-1",
      messageId: "message-1",
      payload: {
        text: "AI reply from Telegram",
      },
      safeMetadata: {},
      correlationIds: {},
    });

    assert.equal(execution.provider, "telegram");
    assert.equal(execution.actionType, "telegram.outbound.send");

    const delivery = await deliverChannelOutbound({
      db,
      execution: {
        tenant_id: db.tenant.id,
      },
      payload: {
        text: "AI reply from Telegram",
      },
      thread: {
        channel: "telegram",
        tenant_id: db.tenant.id,
        external_thread_id: "chat-303",
      },
      message: {
        tenant_id: db.tenant.id,
        text: "AI reply from Telegram",
      },
    });

    assert.equal(delivery.ok, true);
    assert.equal(delivery.providerMessageId, "8080");

    const unsupported = await deliverChannelOutbound({
      db,
      execution: {
        tenant_id: db.tenant.id,
      },
      payload: {
        messageType: "typing_off",
      },
      thread: {
        channel: "telegram",
        tenant_id: db.tenant.id,
        external_thread_id: "chat-303",
      },
      message: {
        tenant_id: db.tenant.id,
      },
    });

    assert.equal(unsupported.ok, false);
    assert.equal(unsupported.reasonCode, "telegram_action_unsupported");
  } finally {
    global.fetch = previousFetch;
  }
});
