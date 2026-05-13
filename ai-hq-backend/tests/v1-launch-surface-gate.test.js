import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import { getFeatureFlags } from "../src/config/features.js";
import { apiRouter } from "../src/routes/api/index.js";

function createMockRes(onFinish) {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    cookiesCleared: [],
    finished: false,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    clearCookie(name, options = {}) {
      this.cookiesCleared.push({ name, options });
      return this;
    },
    json(payload) {
      this.body = payload;
      this.finished = true;
      onFinish?.();
      return this;
    },
  };
}

async function invokeRouter(router, method, path, req = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve({ req: fullReq, res });
    };
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
      query: req.query || {},
      body: req.body || {},
      protocol: req.protocol || "https",
      app: req.app || { locals: {} },
      get(name) {
        return this.headers[String(name || "").toLowerCase()];
      },
      ...req,
    };
    const res = createMockRes(finish);

    try {
      router.handle(fullReq, res, (err) => {
        if (settled) return;
        if (err) {
          settled = true;
          reject(err);
          return;
        }
        settled = true;
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
    adminPanelEnabled: cfg.auth.adminPanelEnabled,
    telegramEnabled: cfg.telegram.enabled,
    pushEnabled: cfg.push.enabled,
    draftScheduleWorkerEnabled: cfg.workers.draftScheduleWorkerEnabled,
    mediaJobWorkerEnabled: cfg.workers.mediaJobWorkerEnabled,
    openaiApiKey: cfg.ai.openaiApiKey,
    runwayApiKey: cfg.media.runwayApiKey,
    elevenlabsApiKey: cfg.media.elevenlabsApiKey,
    n8nWebhookUrl: cfg.n8n.webhookUrl,
    n8nWebhookPublishUrl: cfg.n8n.webhookPublishUrl,
    n8nScheduleDraftUrl: cfg.n8n.scheduleDraftUrl,
    cronSecret: cfg.security.cronSecret,
    telegramWebhookBaseUrl: cfg.telegram.webhookBaseUrl,
    vapidPublicKey: cfg.push.vapidPublicKey,
    vapidPrivateKey: cfg.push.vapidPrivateKey,
  };

  try {
    cfg.app.env = "production";
    cfg.launch.v1SurfaceEnabled = true;
    cfg.auth.adminPanelEnabled = true;
    cfg.telegram.enabled = true;
    cfg.push.enabled = true;
    cfg.workers.draftScheduleWorkerEnabled = true;
    cfg.workers.mediaJobWorkerEnabled = true;
    cfg.ai.openaiApiKey = "test-openai-key";
    cfg.media.runwayApiKey = "test-runway-key";
    cfg.media.elevenlabsApiKey = "test-elevenlabs-key";
    cfg.n8n.webhookUrl = "https://n8n.example.test/webhook";
    cfg.n8n.webhookPublishUrl = "https://n8n.example.test/publish";
    cfg.n8n.scheduleDraftUrl = "https://n8n.example.test/schedule";
    cfg.security.cronSecret = "cron-secret";
    cfg.telegram.webhookBaseUrl = "https://api.example.test";
    cfg.push.vapidPublicKey = "test-vapid-public";
    cfg.push.vapidPrivateKey = "test-vapid-private";

    return await run();
  } finally {
    cfg.app.env = previous.appEnv;
    cfg.launch.v1SurfaceEnabled = previous.v1SurfaceEnabled;
    cfg.auth.adminPanelEnabled = previous.adminPanelEnabled;
    cfg.telegram.enabled = previous.telegramEnabled;
    cfg.push.enabled = previous.pushEnabled;
    cfg.workers.draftScheduleWorkerEnabled =
      previous.draftScheduleWorkerEnabled;
    cfg.workers.mediaJobWorkerEnabled = previous.mediaJobWorkerEnabled;
    cfg.ai.openaiApiKey = previous.openaiApiKey;
    cfg.media.runwayApiKey = previous.runwayApiKey;
    cfg.media.elevenlabsApiKey = previous.elevenlabsApiKey;
    cfg.n8n.webhookUrl = previous.n8nWebhookUrl;
    cfg.n8n.webhookPublishUrl = previous.n8nWebhookPublishUrl;
    cfg.n8n.scheduleDraftUrl = previous.n8nScheduleDraftUrl;
    cfg.security.cronSecret = previous.cronSecret;
    cfg.telegram.webhookBaseUrl = previous.telegramWebhookBaseUrl;
    cfg.push.vapidPublicKey = previous.vapidPublicKey;
    cfg.push.vapidPrivateKey = previous.vapidPrivateKey;
  }
}

test("v1 production feature flags freeze non-launch optional surfaces", async () => {
  await withV1ProductionConfig(async () => {
    const flags = getFeatureFlags();

    assert.equal(flags.core.auth, true);
    assert.equal(flags.core.settings, true);
    assert.equal(flags.core.mode, true);
    assert.equal(flags.inbox.inbox, true);
    assert.equal(flags.channels.websiteWidget, true);
    assert.equal(flags.sources.websiteImport, true);
    assert.equal(flags.sources.canonicalTruth, true);
    assert.equal(flags.sources.runtimeProjection, true);

    assert.equal(flags.core.adminPanel, false);
    assert.equal(flags.core.agents, false);
    assert.equal(flags.core.team, true);
    assert.equal(flags.core.notifications, false);
    assert.equal(flags.inbox.leads, true);
    assert.equal(flags.inbox.comments, false);
    assert.equal(flags.channels.telegram, false);
    assert.equal(flags.channels.push, false);
    assert.equal(flags.channels.voice, false);
    assert.equal(flags.content.content, false);
    assert.equal(flags.content.analyze, false);
    assert.equal(flags.content.debate, false);
    assert.equal(flags.content.propose, false);
    assert.equal(flags.content.publish, false);
    assert.equal(flags.media.render, false);
    assert.equal(flags.media.imageGeneration, false);
    assert.equal(flags.media.videoGeneration, false);
    assert.equal(flags.media.tts, false);
    assert.equal(flags.media.mediaWorker, false);
    assert.equal(flags.workflows.n8n, false);
    assert.equal(flags.workflows.cron, false);
    assert.equal(flags.workflows.internalCallbacks, false);
    assert.equal(flags.workflows.executions, false);
    assert.equal(flags.ops.incidents, false);
  });
});

test("v1 production router returns frozen 404 for non-launch backend surfaces", async () => {
  await withV1ProductionConfig(async () => {
    const router = apiRouter({
      db: null,
      wsHub: { broadcast() {} },
      audit: null,
      dbDisabled: true,
    });

    const frozenRoutes = [
      ["get", "/comments"],
      ["post", "/comments/ingest"],
      ["get", "/voice/overview"],
      ["post", "/internal/voice/report"],
      ["get", "/proposals"],
      ["get", "/executions"],
      ["post", "/internal/executions/voice-sync"],
      ["post", "/internal/runtime-signals/incidents"],
      ["get", "/incidents"],
      ["post", "/chat"],
      ["post", "/debate"],
      ["get", "/notifications"],
      ["get", "/agents"],
      ["get", "/settings/agents"],
      ["get", "/channels/telegram/status"],
      ["post", "/settings/operational/channels/telegram"],
      ["get", "/settings/secrets"],
      ["get", "/push/vapid"],
      ["get", "/media"],
      ["post", "/render/slides"],
      ["get", "/threads/thread-1/messages"],
      ["get", "/content"],
    ];

    for (const [method, path] of frozenRoutes) {
      const result = await invokeRouter(router, method, path);
      assert.equal(result.res.statusCode, 404, path);
      assert.equal(result.res.body?.code, "surface_frozen", path);
    }
  });
});

test("v1 production router keeps launch surfaces mounted", async () => {
  await withV1ProductionConfig(async () => {
    const router = apiRouter({
      db: null,
      wsHub: { broadcast() {} },
      audit: null,
      dbDisabled: true,
    });

    const root = await invokeRouter(router, "get", "/");
    const inbox = await invokeRouter(router, "get", "/inbox");
    const webchat = await invokeRouter(router, "get", "/channels/webchat/status");
    const meta = await invokeRouter(router, "get", "/channels/meta/status");
    const setup = await invokeRouter(router, "get", "/setup/truth/current");
    const leads = await invokeRouter(router, "get", "/leads");
    const team = await invokeRouter(router, "get", "/team");

    assert.equal(root.res.statusCode, 200);
    assert.notEqual(inbox.res.body?.code, "surface_frozen");
    assert.notEqual(webchat.res.body?.code, "surface_frozen");
    assert.notEqual(meta.res.body?.code, "surface_frozen");
    assert.notEqual(setup.res.body?.code, "surface_frozen");
    assert.notEqual(leads.res.body?.code, "surface_frozen");
    assert.notEqual(team.res.body?.code, "surface_frozen");
  });
});
