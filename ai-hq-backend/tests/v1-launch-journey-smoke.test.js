import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { cfg } from "../src/config.js";
import { apiRouter } from "../src/routes/api/index.js";
import { userLoginRoutes } from "../src/routes/api/adminAuth/user.js";
import { adminSessionRoutes } from "../src/routes/api/adminAuth/session.js";
import { workspaceRoutes } from "../src/routes/api/workspace/index.js";
import { channelConnectRoutes } from "../src/routes/api/channelConnect/index.js";
import { websiteWidgetRoutes } from "../src/routes/api/websiteWidget/index.js";
import { inboxHandlers } from "../src/routes/api/inbox/handlers.js";
import { buildApiHealthResponse } from "../src/routes/api/health/builders.js";
import { hashUserPassword } from "../src/utils/adminAuth.js";
import { resetInMemoryRateLimitsForTest } from "../src/utils/rateLimit.js";
import { validateLaunchEvidence } from "../../scripts/check-launch-evidence.mjs";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const IDENTITY_ID = "22222222-2222-4222-8222-222222222222";
const MEMBERSHIP_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";
const THREAD_ID = "55555555-5555-4555-8555-555555555555";
const TENANT_KEY = "acme";
const EMAIL = "owner@acme.test";
const PASSWORD = "secret-pass";

function normalizeSql(input) {
  return String(input?.text || input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseJson(value, fallback) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(String(value ?? ""));
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function createMockRes(onFinish) {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    cookies: [],
    cookiesCleared: [],
    finished: false,
    req: null,
    setHeader(key, value) {
      this.headers[String(key).toLowerCase()] = value;
      return this;
    },
    getHeader(key) {
      return this.headers[String(key).toLowerCase()];
    },
    header(key, value) {
      return this.setHeader(key, value);
    },
    set(key, value) {
      return this.setHeader(key, value);
    },
    type(value) {
      return this.setHeader("content-type", value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    cookie(name, value, options = {}) {
      this.cookies.push({ name, value, options });
      return this;
    },
    clearCookie(name, options = {}) {
      this.cookiesCleared.push({ name, options });
      return this;
    },
    redirect(url) {
      this.statusCode = this.statusCode >= 300 && this.statusCode < 400 ? this.statusCode : 302;
      this.headers.location = url;
      this.finished = true;
      onFinish?.();
      return this;
    },
    json(payload) {
      this.body = payload;
      this.finished = true;
      onFinish?.();
      return this;
    },
    send(payload) {
      this.body = payload;
      this.finished = true;
      onFinish?.();
      return this;
    },
    end(payload = null) {
      if (payload !== null) this.body = payload;
      this.finished = true;
      onFinish?.();
      return this;
    },
  };
}

async function invokeRouter(router, method, path, req = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const headers = Object.fromEntries(
      Object.entries(req.headers || {}).map(([key, value]) => [
        String(key).toLowerCase(),
        value,
      ])
    );
    const fullReq = {
      method: String(method || "GET").toUpperCase(),
      path,
      originalUrl: path,
      url: path,
      headers,
      query: {},
      body: {},
      params: {},
      protocol: "https",
      secure: true,
      ip: "203.0.113.10",
      socket: { remoteAddress: "203.0.113.10" },
      app: { locals: {} },
      get(name) {
        return this.headers[String(name || "").toLowerCase()] || "";
      },
      ...req,
      headers,
    };
    const res = createMockRes(() => {
      if (settled) return;
      settled = true;
      resolve({ req: fullReq, res });
    });
    res.req = fullReq;

    try {
      router.handle(fullReq, res, (err) => {
        if (settled) return;
        settled = true;
        if (err) {
          reject(err);
          return;
        }
        resolve({ req: fullReq, res });
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function withV1ProductionConfig(run) {
  const previous = {
    appEnv: cfg.app.env,
    v1SurfaceEnabled: cfg.launch.v1SurfaceEnabled,
    userSessionSecret: cfg.auth.userSessionSecret,
    productionRateLimitStrategy: cfg.rateLimit.productionStrategy,
    rateLimitProvider: cfg.rateLimit.provider,
    rateLimitExternalEvidenceUrl: cfg.rateLimit.externalEvidenceUrl,
  };

  try {
    cfg.app.env = "production";
    cfg.launch.v1SurfaceEnabled = true;
    cfg.auth.userSessionSecret =
      previous.userSessionSecret || "test-user-session-secret";
    cfg.rateLimit.productionStrategy = "memory";
    cfg.rateLimit.provider = "";
    cfg.rateLimit.externalEvidenceUrl = "";
    resetInMemoryRateLimitsForTest();
    return await run();
  } finally {
    cfg.app.env = previous.appEnv;
    cfg.launch.v1SurfaceEnabled = previous.v1SurfaceEnabled;
    cfg.auth.userSessionSecret = previous.userSessionSecret;
    cfg.rateLimit.productionStrategy = previous.productionRateLimitStrategy;
    cfg.rateLimit.provider = previous.rateLimitProvider;
    cfg.rateLimit.externalEvidenceUrl = previous.rateLimitExternalEvidenceUrl;
    resetInMemoryRateLimitsForTest();
  }
}

class FakeAuthDb {
  constructor() {
    this.tenants = new Map();
    this.identities = new Map();
    this.memberships = new Map();
    this.users = new Map();
    this.authSessions = new Map();
    this.loginAttempts = new Map();
  }

  seedLaunchUser() {
    this.tenants.set(TENANT_ID, {
      id: TENANT_ID,
      tenant_key: TENANT_KEY,
      company_name: "Acme Clinic",
      active: true,
      status: "active",
      plan_key: "starter",
      billing_status: "unconfigured",
    });
    this.identities.set(IDENTITY_ID, {
      id: IDENTITY_ID,
      primary_email: EMAIL,
      normalized_email: EMAIL,
      password_hash: hashUserPassword(PASSWORD),
      auth_provider: "local",
      email_verified: true,
      status: "active",
      meta: {},
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    this.memberships.set(MEMBERSHIP_ID, {
      id: MEMBERSHIP_ID,
      identity_id: IDENTITY_ID,
      tenant_id: TENANT_ID,
      role: "owner",
      status: "active",
      permissions: {},
      meta: {},
    });
    this.users.set(USER_ID, {
      id: USER_ID,
      tenant_id: TENANT_ID,
      tenant_key: TENANT_KEY,
      user_email: EMAIL,
      full_name: "Launch Owner",
      role: "owner",
      status: "active",
      session_version: 1,
      auth_provider: "local",
      email_verified: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
  }

  _loginAttemptKey(actorType, scopeKey, ip) {
    return `${actorType}|${scopeKey}|${ip}`;
  }

  async query(input, maybeValues = []) {
    const text = normalizeSql(input);
    const values = Array.isArray(input?.values) ? input.values : maybeValues;

    if (["begin", "commit", "rollback"].includes(text)) {
      return { rowCount: 0, rows: [] };
    }

    if (text.includes("from auth_identities") && text.includes("normalized_email = $1")) {
      const email = String(values[0] || "").toLowerCase();
      const identity =
        Array.from(this.identities.values()).find(
          (row) => String(row.normalized_email).toLowerCase() === email
        ) || null;
      return {
        rowCount: identity ? 1 : 0,
        rows: identity ? [{ ...identity }] : [],
      };
    }

    if (text.includes("from auth_identity_memberships m") && text.includes("join tenants t")) {
      const identityId = String(values[0] || "");
      const tenantKey = String(values[1] || "").toLowerCase();
      const rows = Array.from(this.memberships.values())
        .filter(
          (membership) =>
            String(membership.identity_id) === identityId &&
            String(membership.status).toLowerCase() === "active"
        )
        .map((membership) => {
          const tenant = this.tenants.get(String(membership.tenant_id)) || {};
          return {
            ...membership,
            tenant_key: tenant.tenant_key || "",
            company_name: tenant.company_name || "",
          };
        })
        .filter(
          (membership) =>
            !tenantKey || String(membership.tenant_key).toLowerCase() === tenantKey
        );
      return { rowCount: rows.length, rows };
    }

    if (text.includes("from tenant_users tu") && text.includes("where tu.tenant_id = $1")) {
      const tenantId = String(values[0] || "");
      const email = String(values[1] || "").toLowerCase();
      const user =
        Array.from(this.users.values()).find(
          (row) =>
            String(row.tenant_id) === tenantId &&
            String(row.user_email).toLowerCase() === email
        ) || null;
      if (!user) return { rowCount: 0, rows: [] };
      const tenant = this.tenants.get(String(user.tenant_id)) || {};
      return {
        rowCount: 1,
        rows: [{ ...user, tenant_key: tenant.tenant_key, company_name: tenant.company_name }],
      };
    }

    if (text.startsWith("insert into auth_identity_sessions")) {
      const row = {
        id: `session-${this.authSessions.size + 1}`,
        identity_id: values[0],
        active_tenant_id: values[1],
        active_membership_id: values[2],
        session_token_hash: values[3],
        session_version: values[4],
        ip: values[5],
        user_agent: values[6],
        expires_at: values[7],
        revoked_at: null,
        created_at: nowIso(),
        last_seen_at: nowIso(),
      };
      this.authSessions.set(String(row.session_token_hash), row);
      return { rowCount: 1, rows: [] };
    }

    if (text.includes("from auth_identity_sessions s") && text.includes("join auth_identities i")) {
      const row = this.authSessions.get(String(values[0] || "")) || null;
      if (!row || row.revoked_at) return { rowCount: 0, rows: [] };

      const identity = this.identities.get(String(row.identity_id));
      const membership = this.memberships.get(String(row.active_membership_id));
      const tenant = this.tenants.get(String(row.active_tenant_id));
      const user =
        Array.from(this.users.values()).find(
          (entry) =>
            String(entry.tenant_id) === String(row.active_tenant_id) &&
            String(entry.user_email).toLowerCase() ===
              String(identity?.normalized_email || identity?.primary_email || "").toLowerCase()
        ) || null;

      if (!identity || !membership || !tenant || !user) {
        return { rowCount: 0, rows: [] };
      }

      return {
        rowCount: 1,
        rows: [
          {
            ...row,
            tenant_id: row.active_tenant_id,
            membership_id: membership.id,
            user_id: user.id,
            tenant_user_id: user.id,
            user_email: identity.primary_email,
            full_name: user.full_name,
            role: membership.role,
            user_status: user.status,
            tenant_key: tenant.tenant_key,
            company_name: tenant.company_name,
            plan_key: tenant.plan_key,
            tenant_status: tenant.status,
            tenant_active: tenant.active,
            billing_status: tenant.billing_status,
          },
        ],
      };
    }

    if (text.startsWith("update tenant_users") || text.startsWith("update auth_identities")) {
      return { rowCount: 1, rows: [] };
    }

    if (text.startsWith("update auth_identity_sessions") && text.includes("set last_seen_at = now()")) {
      return { rowCount: 1, rows: [] };
    }

    if (text.startsWith("select attempt_count")) {
      const row = this.loginAttempts.get(this._loginAttemptKey(values[0], values[1], values[2]));
      return { rowCount: row ? 1 : 0, rows: row ? [{ ...row }] : [] };
    }

    if (text.startsWith("insert into auth_login_attempts")) {
      const key = this._loginAttemptKey(values[0], values[1], values[2]);
      this.loginAttempts.set(key, {
        actor_type: values[0],
        scope_key: values[1],
        ip: values[2],
        attempt_count: 1,
        first_attempt_at: nowIso(),
        blocked_until: null,
      });
      return { rowCount: 1, rows: [] };
    }

    if (text.startsWith("delete from auth_login_attempts")) {
      this.loginAttempts.delete(this._loginAttemptKey(values[0], values[1], values[2]));
      return { rowCount: 1, rows: [] };
    }

    throw new Error(`Unhandled fake auth query: ${text}`);
  }
}

class FakeInboxDb {
  constructor() {
    this.threads = new Map();
    this.messages = new Map();
    this.attempts = new Map();
    this.auditRows = [];
  }

  connect() {
    return {
      query: (input, values) => this.query(input, values),
      release() {},
    };
  }

  _threadRow(row) {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      tenant_key: row.tenant_key,
      channel: row.channel,
      external_thread_id: row.external_thread_id,
      external_user_id: row.external_user_id,
      external_username: row.external_username,
      customer_name: row.customer_name,
      status: row.status,
      last_message_at: row.last_message_at,
      last_inbound_at: row.last_inbound_at,
      last_outbound_at: row.last_outbound_at,
      unread_count: row.unread_count,
      assigned_to: row.assigned_to,
      labels: row.labels,
      meta: row.meta,
      handoff_active: row.handoff_active,
      handoff_reason: row.handoff_reason,
      handoff_priority: row.handoff_priority,
      handoff_at: row.handoff_at,
      handoff_by: row.handoff_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      avatar_url: "",
    };
  }

  _findThread(threadId, tenantKeyOrId = "") {
    const thread = this.threads.get(String(threadId || "")) || null;
    if (!thread) return null;
    const scope = String(tenantKeyOrId || "").toLowerCase();
    if (
      scope &&
      String(thread.tenant_key).toLowerCase() !== scope &&
      String(thread.tenant_id).toLowerCase() !== scope
    ) {
      return null;
    }
    return thread;
  }

  async query(input, maybeValues = []) {
    const text = normalizeSql(input);
    const values = Array.isArray(input?.values) ? input.values : maybeValues;

    if (["begin", "commit", "rollback"].includes(text)) {
      return { rowCount: 0, rows: [] };
    }

    if (text.startsWith("insert into inbox_threads")) {
      const row = {
        id: THREAD_ID,
        tenant_id: values[0],
        tenant_key: values[1],
        channel: values[2],
        external_thread_id: values[3] || null,
        external_user_id: values[4] || null,
        external_username: values[5] || "",
        customer_name: values[6] || "",
        status: values[7] || "open",
        assigned_to: values[8] || "",
        labels: parseJson(values[9], []),
        meta: parseJson(values[10], {}),
        last_message_at: nowIso(),
        last_inbound_at: null,
        last_outbound_at: null,
        unread_count: 0,
        handoff_active: false,
        handoff_reason: "",
        handoff_priority: "normal",
        handoff_at: null,
        handoff_by: "",
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      this.threads.set(row.id, row);
      return { rowCount: 1, rows: [this._threadRow(row)] };
    }

    if (text.includes("from inbox_threads t")) {
      const thread = this._findThread(values[0], values[1] || values[2]);
      return {
        rowCount: thread ? 1 : 0,
        rows: thread ? [this._threadRow(thread)] : [],
      };
    }

    if (text.startsWith("insert into inbox_messages")) {
      const outbound = text.includes("'outbound'");
      const row = outbound
        ? {
            id: `66666666-6666-4666-8666-${String(this.messages.size + 1).padStart(12, "0")}`,
            thread_id: values[0],
            tenant_id: values[1],
            tenant_key: values[2],
            direction: "outbound",
            sender_type: values[3],
            external_message_id: values[4] || "",
            message_type: values[5],
            text: values[6],
            attachments: parseJson(values[7], []),
            sent_at: values[8] || nowIso(),
            meta: parseJson(values[9], {}),
            created_at: nowIso(),
          }
        : {
            id: `66666666-6666-4666-8666-${String(this.messages.size + 1).padStart(12, "0")}`,
            thread_id: values[0],
            tenant_id: values[1],
            tenant_key: values[2],
            direction: values[3],
            sender_type: values[4],
            external_message_id: values[5] || "",
            message_type: values[6],
            text: values[7],
            attachments: parseJson(values[8], []),
            meta: parseJson(values[9], {}),
            sent_at: nowIso(),
            created_at: nowIso(),
          };
      this.messages.set(row.id, row);
      return { rowCount: 1, rows: [{ ...row }] };
    }

    if (text.startsWith("update inbox_threads")) {
      const threadId = values[0];
      const thread = this.threads.get(String(threadId || ""));
      if (thread) {
        thread.last_message_at = nowIso();
        thread.updated_at = nowIso();
        if (text.includes("last_inbound_at")) {
          const direction = String(values[1] || "");
          if (direction === "inbound") {
            thread.last_inbound_at = nowIso();
            thread.unread_count += 1;
          }
        }
        if (text.includes("last_outbound_at")) {
          thread.last_outbound_at = nowIso();
        }
      }
      return { rowCount: thread ? 1 : 0, rows: thread ? [this._threadRow(thread)] : [] };
    }

    if (text.startsWith("insert into inbox_outbound_attempts")) {
      const row = {
        id: `77777777-7777-4777-8777-${String(this.attempts.size + 1).padStart(12, "0")}`,
        message_id: values[0],
        thread_id: values[1],
        tenant_id: values[2],
        tenant_key: values[3],
        channel: values[4],
        provider: values[5],
        recipient_id: values[6],
        payload: parseJson(values[7], {}),
        provider_response: {},
        status: values[8],
        max_attempts: values[9],
        next_retry_at: values[10],
        idempotency_key: values[11],
        attempt_count: 0,
        queued_at: nowIso(),
        first_attempt_at: null,
        last_attempt_at: null,
        sent_at: values[8] === "sent" ? nowIso() : null,
        reservation_token: null,
        reserved_until: null,
        last_error: null,
        last_error_code: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      this.attempts.set(row.id, row);
      return { rowCount: 1, rows: [{ ...row }] };
    }

    if (text.startsWith("insert into audit_log")) {
      this.auditRows.push({ values });
      return { rowCount: 1, rows: [{ id: `audit-${this.auditRows.length}` }] };
    }

    throw new Error(`Unhandled fake inbox query: ${text}`);
  }
}

function createAuthReq(overrides = {}) {
  const auth = {
    userId: USER_ID,
    identityId: IDENTITY_ID,
    membershipId: MEMBERSHIP_ID,
    tenantId: TENANT_ID,
    tenantKey: TENANT_KEY,
    planKey: "starter",
    tenantStatus: "active",
    tenantActive: true,
    billingStatus: "unconfigured",
    email: EMAIL,
    fullName: "Launch Owner",
    role: "owner",
    sessionVersion: 1,
    _serverControlled: true,
  };
  return {
    auth,
    user: {
      id: USER_ID,
      identityId: IDENTITY_ID,
      membershipId: MEMBERSHIP_ID,
      tenantId: TENANT_ID,
      tenantKey: TENANT_KEY,
      tenant_id: TENANT_ID,
      tenant_key: TENANT_KEY,
      email: EMAIL,
      fullName: "Launch Owner",
      full_name: "Launch Owner",
      role: "owner",
    },
    tenantId: TENANT_ID,
    tenantKey: TENANT_KEY,
    tenant: {
      id: TENANT_ID,
      tenant_id: TENANT_ID,
      tenant_key: TENANT_KEY,
      plan_key: "starter",
      status: "active",
      active: true,
    },
    app: { locals: {} },
    headers: {
      host: "app.example.test",
      origin: "https://app.example.test",
    },
    ...overrides,
  };
}

function createLaunchWorkspaceState() {
  return {
    tenantId: TENANT_ID,
    tenantKey: TENANT_KEY,
    companyName: "Acme Clinic",
    membershipId: MEMBERSHIP_ID,
    role: "owner",
    setupCompleted: false,
    setupRequired: true,
    workspaceReady: false,
    activeSetupSessionId: "setup-session-1",
    routeHint: "/home?assistant=setup",
    destination: { kind: "setup", path: "/home?assistant=setup" },
    readinessLabel: "setup_required",
    missingSteps: ["business_truth", "website_widget"],
    primaryMissingStep: "business_truth",
  };
}

function readLaunchEvidenceFixture() {
  return JSON.parse(
    readFileSync(new URL("../../docs/launch/production-launch-evidence.json", import.meta.url), "utf8")
  );
}

after(() => {
  resetInMemoryRateLimitsForTest();
});

test("v1 launch journey smoke covers auth, setup, truth, widget, inbox reply, health, and frozen surfaces without provider secrets", async () => {
  await withV1ProductionConfig(async () => {
    const authDb = new FakeAuthDb();
    authDb.seedLaunchUser();
    const resolveWorkspaceState = async () => createLaunchWorkspaceState();

    const login = await invokeRouter(
      userLoginRoutes({ db: authDb, resolveWorkspaceState }),
      "post",
      "/auth/login",
      {
        body: { email: EMAIL, password: PASSWORD },
        headers: { host: "app.example.test" },
      }
    );

    assert.equal(login.res.statusCode, 200);
    assert.equal(login.res.body?.authenticated, true);
    assert.equal(login.res.body?.user?.tenantKey, TENANT_KEY);
    assert.equal(login.res.body?.destination?.path, "/home?assistant=setup");
    const sessionCookie = login.res.cookies.find((cookie) => cookie.name === "aihq_user");
    assert.ok(sessionCookie?.value);

    const session = await invokeRouter(
      adminSessionRoutes({ db: authDb, wsHub: null, resolveWorkspaceState }),
      "get",
      "/auth/me",
      {
        headers: {
          cookie: `aihq_user=${sessionCookie.value}`,
          host: "app.example.test",
        },
      }
    );
    assert.equal(session.res.statusCode, 200);
    assert.equal(session.res.body?.authenticated, true);
    assert.equal(session.res.body?.workspace?.routeHint, "/home?assistant=setup");

    const workspace = workspaceRoutes({
      db: null,
      wsHub: { broadcast() {} },
      audit: null,
      dbDisabled: true,
    });
    const setupAssistant = await invokeRouter(
      workspace,
      "get",
      "/setup/assistant/__build",
      createAuthReq()
    );
    assert.equal(setupAssistant.res.statusCode, 200);
    assert.equal(setupAssistant.res.body?.feature, "setup_assistant");

    const truth = await invokeRouter(workspace, "get", "/setup/truth/current", createAuthReq());
    assert.notEqual(truth.res.body?.code, "surface_frozen");
    assert.notEqual(truth.res.statusCode, 404);
    assert.ok(
      truth.res.body?.ok === true || truth.res.body?.error === "SetupTruthLoadFailed",
      "Business Truth/readiness route must be mounted and fail explicitly when the fake DB cannot load truth"
    );

    const channelStatus = await invokeRouter(
      channelConnectRoutes({ db: null }),
      "get",
      "/channels/webchat/status",
      createAuthReq()
    );
    assert.notEqual(channelStatus.res.body?.code, "surface_frozen");
    assert.notEqual(channelStatus.res.statusCode, 404);

    const publicWidget = await invokeRouter(
      websiteWidgetRoutes({ db: null, wsHub: null }),
      "post",
      "/public/widget/message",
      {
        body: {
          sessionToken: "test-session-token",
          text: "Hello from launch smoke",
          visitor: { name: "Smoke Visitor" },
        },
        headers: {
          host: "www.example.test",
          origin: "https://www.example.test",
          referer: "https://www.example.test/contact",
        },
      }
    );
    assert.ok(publicWidget.res.statusCode >= 400);
    assert.equal(publicWidget.res.body?.dbDisabled, true);
    assert.notEqual(publicWidget.res.body?.code, "surface_frozen");

    const inboxDb = new FakeInboxDb();
    const inbox = inboxHandlers({ db: inboxDb, wsHub: { broadcast() {} } });
    const createdThread = await invokeRouter(
      inbox,
      "post",
      "/inbox/threads",
      createAuthReq({
        body: {
          channel: "website",
          externalThreadId: "website-session-1",
          externalUserId: "visitor-1",
          externalUsername: "visitor-1",
          customerName: "Smoke Visitor",
          meta: { source: "website_widget", launchSmoke: true },
        },
      })
    );
    assert.equal(createdThread.res.statusCode, 200);
    assert.equal(createdThread.res.body?.ok, true);
    assert.equal(createdThread.res.body?.thread?.channel, "website");
    assert.equal(createdThread.res.body?.thread?.meta?.source, "website_widget");

    const inbound = await invokeRouter(
      inbox,
      "post",
      `/inbox/threads/${THREAD_ID}/messages`,
      createAuthReq({
        body: {
          direction: "inbound",
          senderType: "customer",
          externalMessageId: "website-inbound-1",
          messageType: "text",
          text: "I need pricing.",
          meta: { source: "website_widget", launchSmoke: true },
        },
      })
    );
    assert.equal(inbound.res.statusCode, 200);
    assert.equal(inbound.res.body?.ok, true);
    assert.equal(inbound.res.body?.message?.direction, "inbound");
    assert.equal(inbound.res.body?.message?.meta?.source, "website_widget");

    const manualReply = await invokeRouter(
      inbox,
      "post",
      `/inbox/threads/${THREAD_ID}/messages`,
      createAuthReq({
        body: {
          direction: "outbound",
          senderType: "operator",
          externalMessageId: "website-outbound-1",
          messageType: "text",
          text: "Thanks, an operator is reviewing this now.",
          meta: { provider: "website_widget", launchSmoke: true },
        },
      })
    );
    assert.equal(manualReply.res.statusCode, 200);
    assert.equal(manualReply.res.body?.ok, true);
    assert.equal(manualReply.res.body?.message?.direction, "outbound");
    assert.equal(manualReply.res.body?.message?.sender_type, "operator");

    const health = await buildApiHealthResponse({ db: null });
    assert.equal(health.service, "ai-hq-backend");
    assert.equal(health.env, "production");
    assert.equal(health.observability?.safeForPublicHealth, true);
    assert.equal(health.rateLimit?.safeForPublicHealth, true);
    assert.equal(health.rateLimit?.memoryModeIsLaunchReady, false);
    assert.equal(health.rateLimit?.launchReadyByConfig, false);

    const fullApi = apiRouter({
      db: null,
      wsHub: { broadcast() {} },
      audit: null,
      dbDisabled: true,
    });
    const frozenRoutes = [
      ["get", "/leads"],
      ["get", "/comments"],
      ["post", "/chat"],
      ["get", "/proposals"],
      ["get", "/executions"],
      ["get", "/incidents"],
      ["get", "/channels/telegram/status"],
      ["get", "/push/vapid"],
    ];

    for (const [method, path] of frozenRoutes) {
      const result = await invokeRouter(fullApi, method, path);
      assert.equal(result.res.statusCode, 404, path);
      assert.equal(result.res.body?.code, "surface_frozen", path);
    }
  });
});

test("P1-003 launch evidence is required and stays blocked until staging or production journey proof exists", () => {
  const evidence = readLaunchEvidenceFixture();
  const item = evidence.items.find((entry) => entry.id === "P1-003");

  assert.equal(item?.status, "BLOCKED");
  assert.equal(item?.blocksLimitedLaunch, true);
  assert.equal(item?.blocksPaidLaunch, true);
  assert.equal(item?.blocksPublicLaunch, true);
  assert.match(item?.evidence || "", /v1-launch-journey-smoke\.test\.js/);
  assert.match(item?.evidence || "", /v1-launch-journey-smoke\.md/);
  assert.match(item?.reasonMissing || "", /staging\/production/i);

  for (const target of ["limited", "paid", "public"]) {
    const result = validateLaunchEvidence(evidence, { target });
    assert.equal(result.ok, false, target);
    assert.ok(
      result.errors.some((error) => error.includes("P1-003") && error.includes(`blocks ${target} launch`)),
      `P1-003 must block ${target} launch while real launch journey evidence is missing`
    );
  }
});
