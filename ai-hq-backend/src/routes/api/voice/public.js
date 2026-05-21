import express from "express";
import {
  requireOperatorSurfaceAccess,
  } from "../../../utils/auth.js";
import {
  createLogger,
  } from "../../../utils/logger.js";
import {
  recordRuntimeSignal,
  } from "../../../observability/runtimeSignals.js";
import {
  s,
  n,
  ok,
  fail,
  getActor,
  isLiveVoiceStatus,
  } from "./shared.js";
import {
  getTenantVoiceSettings,
  upsertTenantVoiceSettings,
  listVoiceCalls,
  getVoiceDailyUsage,
  listVoiceCallSessions,
  resolveTenantScope,
  } from "./repository.js";
import {
  requireTenantScope,
  normalizeSettingsInput,
  getScopedCallOrFail,
  getScopedSessionOrFail,
  auditSafe,
  } from "./utils.js";
import {
  getTenantBrainRuntime,
  } from "../../../services/businessBrain/getTenantBrainRuntime.js";
import {
  isMissingSchemaError,
  getSessionCallId,
  applyOperatorVoiceMutation,
  readVoiceCallDetails,
  readVoiceCallEvents,
  listVoiceCallSessionsForCall,
  toggleTenantVoiceSettings,
  resolveVoiceCallSessionForOperator,
  processVoiceTenantConfig,
  } from "../../../modules/voice/index.js";
import {
  createVoiceChannelConnection,
  buildVoiceSettingsInputWithChannels,
  confirmVoiceChannelVerification,
  listVoiceChannelsFromSettings,
  startVoiceChannelRoutingTest,
  startVoiceChannelVerification,
  } from "../../../modules/voice/channelConnection.js";
import {
  appendVoiceLabEvaluation,
  listVoiceLabEvaluationsFromSettings,
  } from "../../../modules/voice/labEvaluation.js";
import {
  getVoiceLabScenario,
  listVoiceLabScenarios,
  normalizeVoiceLabScenarioId,
} from "../../../modules/voice/labScenarios.js";
import {
  buildBrowserRealtimeSessionPlan,
  normalizeBrowserVoiceModel,
  normalizeBrowserVoiceName,
} from "../../../modules/voice/engine/browserRealtimeSession.js";

const fallbackLogger = createLogger({
  service: "ai-hq-backend",
  component: "voice-public-routes",
});

function getRouteLogger(req, route = "") {
  const base = req?.log || fallbackLogger;
  return base.child?.({
    component: "voice-public-routes",
    route: s(route),
    tenantKey: s(req?.auth?.tenantKey || req?.user?.tenantKey || ""),
    tenantId: s(req?.auth?.tenantId || req?.user?.tenantId || ""),
  }) || fallbackLogger;
}

function recordVoiceRouteFailure({
  route = "",
  reasonCode = "",
  err = null,
  req = null,
  status = 500,
  context = {},
} = {}) {
  recordRuntimeSignal({
    level: "error",
    category: "voice_public",
    code: s(route || "voice_route_failed"),
    reasonCode: s(reasonCode || "voice_route_failed"),
    message: s(err?.message || err || reasonCode || "voice route failed"),
    context: {
      route: s(route),
      status: Number(status || 0),
      tenantKey: s(req?.auth?.tenantKey || req?.user?.tenantKey || ""),
      tenantId: s(req?.auth?.tenantId || req?.user?.tenantId || ""),
      ...context,
    },
  });
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

async function getScopedCallForSessionOrFail({ db, scope, session, res }) {
  const callId = getSessionCallId(session);
  if (!callId) {
    fail(res, 404, "voice_call_not_found");
    return null;
  }

  return getScopedCallOrFail({ db, scope, callId, res });
}

async function loadVoiceSettingsForChannelApi(req, res, { db, dbDisabled }) {
  if (dbDisabled || !db) {
    fail(res, 503, "db_unavailable");
    return null;
  }

  const scope = await requireTenantScope(req, res, db);
  if (!scope) return null;

  const settings = await getTenantVoiceSettings(db, scope.tenantId);

  return {
    scope,
    settings: settings || {},
  };
}

async function persistVoiceChannelsForScope({ db, scope, settings, channels }) {
  const nextSettings = buildVoiceSettingsInputWithChannels(settings || {}, channels);
  const saved = await upsertTenantVoiceSettings(db, scope.tenantId, nextSettings);

  return {
    settings: saved,
    channels: listVoiceChannelsFromSettings(saved || nextSettings),
  };
}

async function handleVoiceChannelsList(req, res, { db, dbDisabled }) {
  const logger = getRouteLogger(req, "voice.channels.list");
  try {
    const loaded = await loadVoiceSettingsForChannelApi(req, res, { db, dbDisabled });
    if (!loaded) return;

    return ok(res, {
      channels: listVoiceChannelsFromSettings(loaded.settings),
      settings: loaded.settings,
    });
  } catch (err) {
    logger.error("voice.channels.list.failed", err);
    recordVoiceRouteFailure({
      route: "voice.channels.list",
      reasonCode: "voice_channels_list_failed",
      err,
      req,
    });
    return fail(res, 500, "voice_channels_list_failed");
  }
}

async function handleVoiceChannelsCreate(req, res, { db, dbDisabled, audit }) {
  const logger = getRouteLogger(req, "voice.channels.create");
  try {
    const loaded = await loadVoiceSettingsForChannelApi(req, res, { db, dbDisabled });
    if (!loaded) return;

    const created = createVoiceChannelConnection(loaded.settings, req.body || {});
    const persisted = await persistVoiceChannelsForScope({
      db,
      scope: loaded.scope,
      settings: loaded.settings,
      channels: created.channels,
    });

    await auditSafe(audit, {
      tenantId: loaded.scope.tenantId,
      tenantKey: loaded.scope.tenantKey,
      actor: getActor(req),
      action: "voice.channel.created",
      objectType: "tenant_voice_channel",
      objectId: created.channel.id,
      meta: {
        provider: created.channel.provider,
        externalNumber: created.channel.externalNumber,
        activationMode: created.channel.activationMode,
      },
    });

    return ok(res, {
      channel: created.channel,
      channels: persisted.channels,
      settings: persisted.settings,
    });
  } catch (err) {
    const code = s(err?.code || err?.message);
    if (code === "voice_channel_already_exists") {
      return fail(res, 409, "voice_channel_already_exists");
    }

    logger.error("voice.channels.create.failed", err);
    recordVoiceRouteFailure({
      route: "voice.channels.create",
      reasonCode: "voice_channel_create_failed",
      err,
      req,
    });
    return fail(res, 500, "voice_channel_create_failed");
  }
}

async function handleVoiceChannelMutation(req, res, { db, dbDisabled, audit, action }) {
  const logger = getRouteLogger(req, `voice.channels.${action}`);
  try {
    const loaded = await loadVoiceSettingsForChannelApi(req, res, { db, dbDisabled });
    if (!loaded) return;

    const channelId = s(req.params?.channelId);
    let result = null;

    if (action === "verify_start") {
      result = startVoiceChannelVerification(loaded.settings, channelId, req.body || {});
    } else if (action === "verify_confirm") {
      result = confirmVoiceChannelVerification(loaded.settings, channelId, req.body || {});
    } else if (action === "routing_test") {
      result = startVoiceChannelRoutingTest(loaded.settings, channelId, req.body || {});
    } else {
      return fail(res, 400, "voice_channel_action_unknown");
    }

    const persisted = await persistVoiceChannelsForScope({
      db,
      scope: loaded.scope,
      settings: loaded.settings,
      channels: result.channels,
    });

    await auditSafe(audit, {
      tenantId: loaded.scope.tenantId,
      tenantKey: loaded.scope.tenantKey,
      actor: getActor(req),
      action: `voice.channel.${action}`,
      objectType: "tenant_voice_channel",
      objectId: result.channel.id,
      meta: {
        provider: result.channel.provider,
        externalNumber: result.channel.externalNumber,
        connectionStatus: result.channel.connectionStatus,
        connectionNextAction: result.channel.connectionNextAction,
      },
    });

    return ok(res, {
      channel: result.channel,
      channels: persisted.channels,
      settings: persisted.settings,
      stub: true,
    });
  } catch (err) {
    const code = s(err?.code || err?.message);
    if (code === "voice_channel_not_found") {
      return fail(res, 404, "voice_channel_not_found");
    }
    if (code === "voice_channel_verification_not_confirmed") {
      return fail(res, 409, "voice_channel_verification_not_confirmed");
    }

    logger.error("voice.channels.mutation.failed", err);
    recordVoiceRouteFailure({
      route: `voice.channels.${action}`,
      reasonCode: "voice_channel_mutation_failed",
      err,
      req,
    });
    return fail(res, 500, "voice_channel_mutation_failed");
  }
}

async function handleVoiceLabScenariosList(req, res) {
  return ok(res, {
    scenarios: listVoiceLabScenarios(),
  });
}

async function handleVoiceLabEvaluationsList(req, res, { db, dbDisabled }) {
  const logger = getRouteLogger(req, "voice.lab.evaluations.list");
  try {
    if (dbDisabled || !db) {
      return fail(res, 503, "db_unavailable");
    }

    const scope = await requireTenantScope(req, res, db);
    if (!scope) return;

    const settings = await getTenantVoiceSettings(db, scope.tenantId);

    return ok(res, {
      evaluations: listVoiceLabEvaluationsFromSettings(settings || {}),
    });
  } catch (err) {
    logger.error("voice.lab.evaluations.list.failed", err);
    recordVoiceRouteFailure({
      route: "voice.lab.evaluations.list",
      reasonCode: "voice_lab_evaluations_list_failed",
      err,
      req,
    });
    return fail(res, 500, "voice_lab_evaluations_list_failed");
  }
}

async function handleVoiceLabEvaluationCreate(req, res, { db, dbDisabled, audit }) {
  const logger = getRouteLogger(req, "voice.lab.evaluations.create");
  try {
    if (dbDisabled || !db) {
      return fail(res, 503, "db_unavailable");
    }

    const scope = await requireTenantScope(req, res, db);
    if (!scope) return;

    const settings = (await getTenantVoiceSettings(db, scope.tenantId)) || {};
    const result = appendVoiceLabEvaluation(settings, req.body || {});
    const saved = await upsertTenantVoiceSettings(db, scope.tenantId, result.settingsInput);

    await auditSafe(audit, {
      tenantId: scope.tenantId,
      tenantKey: scope.tenantKey,
      actor: getActor(req),
      action: "voice.lab.evaluation.created",
      objectType: "voice_lab_evaluation",
      objectId: result.evaluation.id,
      meta: {
        scenarioId: result.evaluation.scenarioId,
        averageScore: result.evaluation.averageScore,
        readiness: result.evaluation.readiness,
      },
    });

    return ok(res, {
      evaluation: result.evaluation,
      evaluations: listVoiceLabEvaluationsFromSettings(saved || result.settingsInput),
    });
  } catch (err) {
    const code = s(err?.code || err?.message);
    if (code === "voice_lab_scenario_unknown") {
      return fail(res, 400, "voice_lab_scenario_unknown");
    }

    logger.error("voice.lab.evaluations.create.failed", err);
    recordVoiceRouteFailure({
      route: "voice.lab.evaluations.create",
      reasonCode: "voice_lab_evaluation_create_failed",
      err,
      req,
    });
    return fail(res, 500, "voice_lab_evaluation_create_failed");
  }
}

async function handleSettingsGet(req, res, { db, dbDisabled }) {
  const logger = getRouteLogger(req, "voice.settings.get");
  try {
    if (dbDisabled || !db) {
      return ok(res, {
        settings: null,
        dbDisabled: true,
      });
    }

    const scope = await requireTenantScope(req, res, db);
    if (!scope) return;

    const settings = await getTenantVoiceSettings(db, scope.tenantId);
    return ok(res, { settings });
  } catch (err) {
    logger.error("voice.settings.get.failed", err);
    recordVoiceRouteFailure({
      route: "voice.settings.get",
      reasonCode: "voice_settings_read_failed",
      err,
      req,
    });
    return fail(res, 500, "voice_settings_read_failed");
  }
}

async function handleSettingsPost(req, res, { db, dbDisabled, audit }) {
  const logger = getRouteLogger(req, "voice.settings.post");
  try {
    if (dbDisabled || !db) {
      return fail(res, 503, "db_unavailable");
    }

    const scope = await requireTenantScope(req, res, db);
    if (!scope) return;

    const actor = getActor(req);
    const input = normalizeSettingsInput(req.body || {});
    const settings = await upsertTenantVoiceSettings(db, scope.tenantId, input);

    await auditSafe(audit, {
      tenantId: scope.tenantId,
      tenantKey: scope.tenantKey,
      actor,
      action: "voice.settings.updated",
      objectType: "tenant_voice_settings",
      objectId: scope.tenantId,
      meta: {
        enabled: settings?.enabled ?? input.enabled,
        provider: settings?.provider ?? input.provider,
        mode: settings?.mode ?? input.mode,
      },
    });

    return ok(res, { settings });
  } catch (err) {
    logger.error("voice.settings.post.failed", err);
    recordVoiceRouteFailure({
      route: "voice.settings.post",
      reasonCode: "voice_settings_save_failed",
      err,
      req,
    });
    return fail(res, 500, "voice_settings_save_failed");
  }
}

const DEFAULT_VOICE_LAB_INSTRUCTIONS =
  "You are a professional receptionist voice assistant. Speak naturally, keep answers short, ask one question at a time, and help the caller clearly.";

function readVoiceLabConfigPayload(result = {}) {
  return obj(result?.payload || result?.config || result?.data || {});
}

function compactVoiceChannel(channel = {}) {
  const item = obj(channel);
  return {
    id: s(item.id || item.channelId || item.channel_id),
    provider: s(item.provider),
    label: s(item.label),
    externalNumber: s(item.externalNumber || item.external_number),
    routeKey: s(item.routeKey || item.route_key),
    ready: item.ready === true,
    reasonCode: s(item.reasonCode || item.reason_code),
  };
}

async function resolveVoiceLabRuntimeConfig(
  req,
  res,
  { db, dbDisabled = false, getRuntime = getTenantBrainRuntime, logger }
) {
  if (req.body?.useTenantRuntime === false) {
    return { ok: false, reasonCode: "browser_voice_manual_mode" };
  }

  if (dbDisabled || !db) {
    return { ok: false, reasonCode: "browser_voice_db_unavailable" };
  }

  const scope = await requireTenantScope(req, res, db);
  if (!scope) {
    return { ok: false, handled: true, reasonCode: "tenant_required" };
  }

  try {
    const result = await processVoiceTenantConfig({
      db,
      tenantKey: scope.tenantKey,
      toNumber: s(req.body?.toNumber || "browser_lab"),
      provider: "browser_lab",
      getRuntime,
    });

    if (result?.ok !== true) {
      const reasonCode = s(
        result?.error || result?.details?.reasonCode || "browser_voice_runtime_unavailable"
      );
      logger?.warn?.("voice.lab.runtime_unavailable", {
        reasonCode,
        statusCode: Number(result?.statusCode || 0),
      });
      return { ok: false, reasonCode };
    }

    return {
      ok: true,
      config: readVoiceLabConfigPayload(result),
    };
  } catch (err) {
    logger?.warn?.("voice.lab.runtime_resolution_failed", {
      error: s(err?.message || err),
    });
    return { ok: false, reasonCode: "browser_voice_runtime_resolution_failed" };
  }
}

function cleanVoiceLabText(value = "", max = 2400) {
  return s(value).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max);
}

function pickVoiceLabModel(value = "") {
  return normalizeBrowserVoiceModel(value);
}

function pickVoiceLabVoice(value = "") {
  return normalizeBrowserVoiceName(value);
}

async function handleBrowserVoiceSession(
  req,
  res,
  { db, dbDisabled = false, getRuntime = getTenantBrainRuntime } = {}
) {
  const logger = getRouteLogger(req, "voice.browser.session");
  try {
    const apiKey = s(process.env.OPENAI_API_KEY);
    if (!apiKey) {
      return fail(res, 503, "openai_api_key_missing");
    }

    if (typeof fetch !== "function") {
      return fail(res, 503, "fetch_unavailable");
    }

    let model = pickVoiceLabModel(req.body?.model);
    let voice = pickVoiceLabVoice(req.body?.voice);
    const scenarioId = normalizeVoiceLabScenarioId(req.body?.scenarioId || "restaurant_order");
    const scenario = getVoiceLabScenario(scenarioId);
    if (!scenario) {
      return fail(res, 400, "voice_lab_scenario_unknown");
    }

    const runtimeResolution = await resolveVoiceLabRuntimeConfig(req, res, {
      db,
      dbDisabled,
      getRuntime,
      logger,
    });
    if (runtimeResolution?.handled) return;

    const runtimeApplied = runtimeResolution?.ok === true;
    const runtimeConfig = runtimeApplied ? obj(runtimeResolution.config) : {};
    const runtimeRealtime = obj(runtimeConfig.realtime);

    if (!s(req.body?.model) && s(runtimeRealtime.model)) {
      model = pickVoiceLabModel(runtimeRealtime.model);
    }
    if (!s(req.body?.voice) && s(runtimeRealtime.voice)) {
      voice = pickVoiceLabVoice(runtimeRealtime.voice);
    }

    const baseInstructions =
      cleanVoiceLabText(req.body?.instructions) ||
      cleanVoiceLabText(runtimeRealtime.instructions) ||
      DEFAULT_VOICE_LAB_INSTRUCTIONS;

    const browserSessionPlan = buildBrowserRealtimeSessionPlan({
      requestedModel: model,
      requestedVoice: voice,
      baseInstructions,
      runtimeConfig,
      runtimeApplied,
    });

    model = browserSessionPlan.model;
    voice = browserSessionPlan.voice;

    const upstream = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(browserSessionPlan.clientSecretRequest),
    });

    const text = await upstream.text().catch(() => "");
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }

    if (!upstream.ok) {
      logger.warn("voice.browser.session.upstream_failed", {
        status: upstream.status,
        error: s(payload?.error?.message || payload?.error || payload?.raw).slice(0, 240),
      });
      return fail(res, upstream.status || 502, "browser_voice_session_failed", {
        status: upstream.status,
        message: s(payload?.error?.message || payload?.error || "OpenAI realtime session failed"),
      });
    }

    return ok(res, {
      model,
      voice,
      scenario,
      runtimeApplied,
      runtimeReasonCode: runtimeApplied ? "" : s(runtimeResolution?.reasonCode),
      activeVoiceChannel: runtimeApplied ? obj(runtimeConfig.activeVoiceChannel) : null,
      match: runtimeApplied ? obj(runtimeConfig.match) : null,
      session: payload,
      clientSecret:
        payload?.value ||
        payload?.client_secret?.value ||
        payload?.session?.client_secret?.value ||
        "",
      openingResponse: browserSessionPlan.openingResponse,
    });
  } catch (err) {
    logger.error("voice.browser.session.failed", err);
    recordVoiceRouteFailure({
      route: "voice.browser.session",
      reasonCode: "browser_voice_session_failed",
      err,
      req,
    });
    return fail(res, 500, "browser_voice_session_failed");
  }
}

export function voiceRoutes({
  db,
  dbDisabled = false,
  audit,
  wsHub = null,
  getRuntime = getTenantBrainRuntime,
} = {}) {
  const r = express.Router();

  r.get("/settings/voice", requireOperatorSurfaceAccess, (req, res) =>
    handleSettingsGet(req, res, { db, dbDisabled })
  );

  r.post("/settings/voice", requireOperatorSurfaceAccess, (req, res) =>
    handleSettingsPost(req, res, { db, dbDisabled, audit })
  );

  r.get("/voice/settings", requireOperatorSurfaceAccess, (req, res) =>
    handleSettingsGet(req, res, { db, dbDisabled })
  );

  r.post("/voice/settings", requireOperatorSurfaceAccess, (req, res) =>
    handleSettingsPost(req, res, { db, dbDisabled, audit })
  );

  r.get("/voice/channels", requireOperatorSurfaceAccess, (req, res) =>
    handleVoiceChannelsList(req, res, { db, dbDisabled })
  );

  r.post("/voice/channels", requireOperatorSurfaceAccess, (req, res) =>
    handleVoiceChannelsCreate(req, res, { db, dbDisabled, audit })
  );

  r.post("/voice/channels/:channelId/verify/start", requireOperatorSurfaceAccess, (req, res) =>
    handleVoiceChannelMutation(req, res, {
      db,
      dbDisabled,
      audit,
      action: "verify_start",
    })
  );

  r.post("/voice/channels/:channelId/verify/confirm", requireOperatorSurfaceAccess, (req, res) =>
    handleVoiceChannelMutation(req, res, {
      db,
      dbDisabled,
      audit,
      action: "verify_confirm",
    })
  );

  r.post("/voice/channels/:channelId/routing/test", requireOperatorSurfaceAccess, (req, res) =>
    handleVoiceChannelMutation(req, res, {
      db,
      dbDisabled,
      audit,
      action: "routing_test",
    })
  );

  r.get("/voice/lab/scenarios", requireOperatorSurfaceAccess, handleVoiceLabScenariosList);

  r.post("/voice/lab/session", requireOperatorSurfaceAccess, (req, res) =>
    handleBrowserVoiceSession(req, res, { db, dbDisabled, getRuntime })
  );

  r.get("/voice/lab/evaluations", requireOperatorSurfaceAccess, (req, res) =>
    handleVoiceLabEvaluationsList(req, res, { db, dbDisabled })
  );

  r.post("/voice/lab/evaluations", requireOperatorSurfaceAccess, (req, res) =>
    handleVoiceLabEvaluationCreate(req, res, { db, dbDisabled, audit })
  );

  r.post("/voice/toggle", requireOperatorSurfaceAccess, async (req, res) => {
    const logger = getRouteLogger(req, "voice.toggle");
    try {
      if (dbDisabled || !db) {
        return fail(res, 503, "db_unavailable");
      }

      const scope = await requireTenantScope(req, res, db);
      if (!scope) return;

      const actor = getActor(req);
      const { enabled, settings } = await toggleTenantVoiceSettings({
        db,
        tenantId: scope.tenantId,
        enabled: req.body?.enabled,
      });

      await auditSafe(audit, {
        tenantId: scope.tenantId,
        tenantKey: scope.tenantKey,
        actor,
        action: enabled ? "voice.enabled" : "voice.disabled",
        objectType: "tenant_voice_settings",
        objectId: scope.tenantId,
        meta: { enabled },
      });

      return ok(res, { settings });
    } catch (err) {
      logger.error("voice.toggle.failed", err);
      recordVoiceRouteFailure({
        route: "voice.toggle",
        reasonCode: "voice_toggle_failed",
        err,
        req,
      });
      return fail(res, 500, "voice_toggle_failed");
    }
  });

  r.get("/voice/overview", requireOperatorSurfaceAccess, async (req, res) => {
    const logger = getRouteLogger(req, "voice.overview");
    try {
      if (dbDisabled || !db) {
        return ok(res, {
          overview: {
            liveCalls: 0,
            totalCalls: 0,
            totalMinutes: 0,
            defaultLanguage: "en",
          },
          liveCalls: 0,
          totalCalls: 0,
          totalMinutes: 0,
          defaultLanguage: "en",
          dbDisabled: true,
        });
      }

      const scope = await requireTenantScope(req, res, db);
      if (!scope) return;

      const settings = await getTenantVoiceSettings(db, scope.tenantId);
      const calls = await listVoiceCalls(db, {
        tenantId: scope.tenantId,
        status: s(req.query?.status),
        limit: Math.max(1, Math.min(200, n(req.query?.limit, 100))),
      });

      const liveCalls = calls.filter((x) =>
        isLiveVoiceStatus(x?.status || x?.callStatus || x?.call_status)
      ).length;

      const totalCalls = calls.length;
      const totalSeconds = calls.reduce(
        (sum, x) =>
          sum + Number(x?.durationSec ?? x?.duration_sec ?? x?.duration ?? 0),
        0
      );
      const totalMinutes = Math.floor(totalSeconds / 60);
      const defaultLanguage = settings?.defaultLanguage || "en";

      return ok(res, {
        overview: {
          liveCalls,
          totalCalls,
          totalMinutes,
          defaultLanguage,
        },
        liveCalls,
        totalCalls,
        totalMinutes,
        defaultLanguage,
      });
    } catch (err) {
      if (isMissingSchemaError(err)) {
        return ok(res, {
          overview: {
            liveCalls: 0,
            totalCalls: 0,
            totalMinutes: 0,
            defaultLanguage: "en",
          },
          liveCalls: 0,
          totalCalls: 0,
          totalMinutes: 0,
          defaultLanguage: "en",
          degraded: true,
          reasonCode: "voice_schema_unavailable",
        });
      }

      logger.error("voice.overview.failed", err);
      recordVoiceRouteFailure({
        route: "voice.overview",
        reasonCode: "voice_overview_failed",
        err,
        req,
      });
      return fail(res, 500, "voice_overview_failed");
    }
  });

  r.get("/voice/calls", requireOperatorSurfaceAccess, async (req, res) => {
    const logger = getRouteLogger(req, "voice.calls.list");
    try {
      if (dbDisabled || !db) {
        return ok(res, {
          calls: [],
          dbDisabled: true,
        });
      }

      const scope = await requireTenantScope(req, res, db);
      if (!scope) return;

      const calls = await listVoiceCalls(db, {
        tenantId: scope.tenantId,
        status: s(req.query?.status),
        limit: Math.max(1, Math.min(200, n(req.query?.limit, 50))),
      });

      return ok(res, { calls });
    } catch (err) {
      if (isMissingSchemaError(err)) {
        return ok(res, {
          calls: [],
          degraded: true,
          reasonCode: "voice_schema_unavailable",
        });
      }

      logger.error("voice.calls.list.failed", err);
      recordVoiceRouteFailure({
        route: "voice.calls.list",
        reasonCode: "voice_calls_list_failed",
        err,
        req,
      });
      return fail(res, 500, "voice_calls_list_failed");
    }
  });

  r.get("/voice/calls/:id", requireOperatorSurfaceAccess, async (req, res) => {
    const logger = getRouteLogger(req, "voice.calls.get");
    try {
      if (dbDisabled || !db) {
        return fail(res, 503, "db_unavailable");
      }

      const scope = await requireTenantScope(req, res, db);
      if (!scope) return;

      const call = await getScopedCallOrFail({
        db,
        scope,
        callId: req.params?.id,
        res,
      });
      if (!call) return;

      return ok(res, await readVoiceCallDetails({ db, call }));
    } catch (err) {
      logger.error("voice.calls.get.failed", err, {
        callId: s(req.params?.id),
      });
      recordVoiceRouteFailure({
        route: "voice.calls.get",
        reasonCode: "voice_call_read_failed",
        err,
        req,
        context: {
          callId: s(req.params?.id),
        },
      });
      return fail(res, 500, "voice_call_read_failed");
    }
  });

  r.get("/voice/calls/:id/events", requireOperatorSurfaceAccess, async (req, res) => {
    const logger = getRouteLogger(req, "voice.calls.events");
    try {
      if (dbDisabled || !db) {
        return ok(res, {
          events: [],
          dbDisabled: true,
        });
      }

      const scope = await requireTenantScope(req, res, db);
      if (!scope) return;

      const call = await getScopedCallOrFail({
        db,
        scope,
        callId: req.params?.id,
        res,
      });
      if (!call) return;

      return ok(res, await readVoiceCallEvents({ db, call }));
    } catch (err) {
      logger.error("voice.calls.events.failed", err, {
        callId: s(req.params?.id),
      });
      recordVoiceRouteFailure({
        route: "voice.calls.events",
        reasonCode: "voice_call_events_failed",
        err,
        req,
        context: {
          callId: s(req.params?.id),
        },
      });
      return fail(res, 500, "voice_call_events_failed");
    }
  });

  r.get("/voice/calls/:id/sessions", requireOperatorSurfaceAccess, async (req, res) => {
    const logger = getRouteLogger(req, "voice.calls.sessions");
    try {
      if (dbDisabled || !db) {
        return ok(res, {
          sessions: [],
          dbDisabled: true,
        });
      }

      const scope = await requireTenantScope(req, res, db);
      if (!scope) return;

      const call = await getScopedCallOrFail({
        db,
        scope,
        callId: req.params?.id,
        res,
      });
      if (!call) return;

      const sessions = await listVoiceCallSessionsForCall({
        db,
        tenantId: scope.tenantId,
        call,
        status: req.query?.status,
        limit: req.query?.limit,
      });

      return ok(res, { sessions });
    } catch (err) {
      logger.error("voice.calls.sessions.failed", err, {
        callId: s(req.params?.id),
      });
      recordVoiceRouteFailure({
        route: "voice.calls.sessions",
        reasonCode: "voice_call_sessions_failed",
        err,
        req,
        context: {
          callId: s(req.params?.id),
        },
      });
      return fail(res, 500, "voice_call_sessions_failed");
    }
  });

  r.post("/voice/calls/:id/join", requireOperatorSurfaceAccess, async (req, res) => {
    const logger = getRouteLogger(req, "voice.calls.join");
    try {
      if (dbDisabled || !db) {
        return fail(res, 503, "db_unavailable");
      }

      const scope = await requireTenantScope(req, res, db);
      if (!scope) return;

      const actor = getActor(req);
      const callId = s(req.params?.id);
      const providedSessionId = s(req.body?.sessionId);
      const lookup = await resolveVoiceCallSessionForOperator({
        db,
        scope,
        callId,
        sessionId: providedSessionId,
      });
      if (!lookup.ok) {
        return fail(
          res,
          lookup.statusCode || 500,
          lookup.error || "voice_session_not_found"
        );
      }

      const { call, session } = lookup;

      const joinMode = s(req.body?.joinMode || req.body?.mode, "live").toLowerCase();
      const operatorName = s(req.body?.operatorName || actor);
      const operatorUserId =
        s(req.body?.operatorUserId) ||
        s(req.user?.id) ||
        s(req.user?.user_id) ||
        null;

      const normalizedJoinMode = ["live", "whisper", "monitor", "barge"].includes(joinMode)
        ? joinMode
        : "live";

      const timestamp = new Date().toISOString();
      const result = await applyOperatorVoiceMutation({
        db,
        wsHub,
        logger,
        scope,
        callId: call.id,
        sessionId: session.id,
        eventType: "operator_joined",
        rejectEventType: "operator_join_rejected",
        eventActor: "operator",
        sessionPatch: {
          status: normalizedJoinMode === "whisper" ? "agent_whisper" : "agent_live",
          operatorJoinRequested: true,
          operatorJoined: true,
          operatorJoinMode: normalizedJoinMode,
          operatorName,
          operatorUserId,
          operatorRequestedAt: timestamp,
          operatorJoinedAt: timestamp,
          whisperActive: normalizedJoinMode === "whisper",
          takeoverActive: normalizedJoinMode === "barge",
        },
        buildCallPatch: ({ call: currentCall, session: updatedSession }) => ({
          handoffRequested: true,
          handoffCompleted: true,
          handoffTarget:
            updatedSession.resolvedDepartment ||
            updatedSession.requestedDepartment ||
            currentCall.handoffTarget ||
            null,
          agentMode: normalizedJoinMode === "live" ? "human" : "hybrid",
        }),
        buildEventPayload: ({ call: nextCall, session: nextSession }) => ({
          operatorUserId: nextSession.operatorUserId,
          operatorName: nextSession.operatorName,
          operatorJoinMode: nextSession.operatorJoinMode,
          sessionStatus: nextSession.status,
          callStatus: nextCall.status,
          callId: nextCall.id,
        }),
        getRuntime,
      });

      if (!result?.ok) {
        return fail(res, result.statusCode || 500, result.error || "voice_join_failed", {
          details: result.details,
          mutationOutcome: s(result.mutationOutcome || "rejected"),
        });
      }

      await auditSafe(audit, {
        tenantId: scope.tenantId,
        tenantKey: scope.tenantKey,
        actor,
        action: "voice.session.joined_from_call_view",
        objectType: "voice_call_session",
        objectId: session.id,
        meta: {
          joinMode:
            result.payload?.session?.operatorJoinMode || normalizedJoinMode,
          callId,
          mutationOutcome: result.payload?.mutationOutcome || "applied",
        },
      });

      return ok(res, {
        session: result.payload?.session,
        mutationOutcome: result.payload?.mutationOutcome || "applied",
      });
    } catch (err) {
      logger.error("voice.calls.join.failed", err, {
        callId: s(req.params?.id),
        sessionId: s(req.body?.sessionId),
      });
      recordVoiceRouteFailure({
        route: "voice.calls.join",
        reasonCode: "voice_join_failed",
        err,
        req,
        context: {
          callId: s(req.params?.id),
          sessionId: s(req.body?.sessionId),
        },
      });
      return fail(res, 500, "voice_join_failed");
    }
  });

  r.post("/voice/calls/:id/end", requireOperatorSurfaceAccess, async (req, res) => {
    const logger = getRouteLogger(req, "voice.calls.end");
    try {
      if (dbDisabled || !db) {
        return fail(res, 503, "db_unavailable");
      }

      const scope = await requireTenantScope(req, res, db);
      if (!scope) return;

      const actor = getActor(req);
      const callId = s(req.params?.id);
      const providedSessionId = s(req.body?.sessionId);
      const lookup = await resolveVoiceCallSessionForOperator({
        db,
        scope,
        callId,
        sessionId: providedSessionId,
      });
      if (!lookup.ok) {
        return fail(
          res,
          lookup.statusCode || 500,
          lookup.error || "voice_session_not_found"
        );
      }

      const { call, session } = lookup;

      const timestamp = new Date().toISOString();
      const result = await applyOperatorVoiceMutation({
        db,
        wsHub,
        logger,
        scope,
        callId: call.id,
        sessionId: session.id,
        eventType: "session_completed",
        ignoredEventType: "session_end_ignored",
        eventActor: "operator",
        sessionPatch: {
          status: "completed",
          botActive: false,
          endedAt: timestamp,
        },
        buildCallPatch: () => ({
          status: "completed",
          endedAt: timestamp,
        }),
        buildEventPayload: ({ call: nextCall, session: nextSession }) => ({
          sessionStatus: nextSession.status,
          callStatus: nextCall.status,
          endedAt: nextSession.endedAt || nextCall.endedAt || timestamp,
          callId: nextCall.id,
          }),
          terminalBehavior: "ignore",
          getRuntime,
        });

      if (!result?.ok) {
        return fail(res, result.statusCode || 500, result.error || "voice_end_failed", {
          details: result.details,
          mutationOutcome: s(result.mutationOutcome || "rejected"),
        });
      }

      await auditSafe(audit, {
        tenantId: scope.tenantId,
        tenantKey: scope.tenantKey,
        actor,
        action: "voice.session.ended_from_call_view",
        objectType: "voice_call_session",
        objectId: session.id,
        meta: {
          callId,
          mutationOutcome: result.payload?.mutationOutcome || "applied",
        },
      });

      return ok(res, {
        session: result.payload?.session,
        mutationOutcome: result.payload?.mutationOutcome || "applied",
      });
    } catch (err) {
      logger.error("voice.calls.end.failed", err, {
        callId: s(req.params?.id),
        sessionId: s(req.body?.sessionId),
      });
      recordVoiceRouteFailure({
        route: "voice.calls.end",
        reasonCode: "voice_end_failed",
        err,
        req,
        context: {
          callId: s(req.params?.id),
          sessionId: s(req.body?.sessionId),
        },
      });
      return fail(res, 500, "voice_end_failed");
    }
  });

  r.get("/voice/usage", requireOperatorSurfaceAccess, async (req, res) => {
    const logger = getRouteLogger(req, "voice.usage");
    try {
      if (dbDisabled || !db) {
        return ok(res, {
          usage: [],
          dbDisabled: true,
        });
      }

      const scope = await requireTenantScope(req, res, db);
      if (!scope) return;

      const usage = await getVoiceDailyUsage(
        db,
        scope.tenantId,
        Math.max(1, Math.min(365, n(req.query?.limit, 30)))
      );

      return ok(res, { usage });
    } catch (err) {
      logger.error("voice.usage.failed", err);
      recordVoiceRouteFailure({
        route: "voice.usage",
        reasonCode: "voice_usage_read_failed",
        err,
        req,
      });
      return fail(res, 500, "voice_usage_read_failed");
    }
  });

  r.get("/voice/live", requireOperatorSurfaceAccess, async (req, res) => {
    const logger = getRouteLogger(req, "voice.live.list");
    try {
      if (dbDisabled || !db) {
        return ok(res, { sessions: [], dbDisabled: true });
      }

      const scope = await requireTenantScope(req, res, db);
      if (!scope) return;

      const sessions = await listVoiceCallSessions(db, {
        tenantId: scope.tenantId,
        status: s(req.query?.status),
        limit: Math.max(1, Math.min(200, n(req.query?.limit, 50))),
      });

      return ok(res, { sessions });
    } catch (err) {
      if (isMissingSchemaError(err)) {
        return ok(res, {
          sessions: [],
          degraded: true,
          reasonCode: "voice_schema_unavailable",
        });
      }

      logger.error("voice.live.list.failed", err);
      recordVoiceRouteFailure({
        route: "voice.live.list",
        reasonCode: "voice_live_list_failed",
        err,
        req,
      });
      return fail(res, 500, "voice_live_list_failed");
    }
  });

  r.get("/voice/live/:id", requireOperatorSurfaceAccess, async (req, res) => {
    const logger = getRouteLogger(req, "voice.live.get");
    try {
      if (dbDisabled || !db) {
        return fail(res, 503, "db_unavailable");
      }

      const scope = await requireTenantScope(req, res, db);
      if (!scope) return;

      const session = await getScopedSessionOrFail({
        db,
        scope,
        sessionId: req.params?.id,
        res,
      });
      if (!session) return;

      return ok(res, { session });
    } catch (err) {
      logger.error("voice.live.get.failed", err, {
        sessionId: s(req.params?.id),
      });
      recordVoiceRouteFailure({
        route: "voice.live.get",
        reasonCode: "voice_live_read_failed",
        err,
        req,
        context: {
          sessionId: s(req.params?.id),
        },
      });
      return fail(res, 500, "voice_live_read_failed");
    }
  });

  r.post("/voice/live/:id/request-handoff", requireOperatorSurfaceAccess, async (req, res) => {
    const logger = getRouteLogger(req, "voice.live.request_handoff");
    try {
      if (dbDisabled || !db) {
        return fail(res, 503, "db_unavailable");
      }

      const scope = await requireTenantScope(req, res, db);
      if (!scope) return;

      const actor = getActor(req);
      const session = await getScopedSessionOrFail({
        db,
        scope,
        sessionId: req.params?.id,
        res,
      });
      if (!session) return;
      const call = await getScopedCallForSessionOrFail({ db, scope, session, res });
      if (!call) return;

      const joinMode = s(req.body?.joinMode || req.body?.mode, "live").toLowerCase();
      const operatorName = s(req.body?.operatorName || actor);
      const operatorUserId =
        s(req.body?.operatorUserId) ||
        s(req.user?.id) ||
        s(req.user?.user_id) ||
        null;

      const normalizedJoinMode = ["live", "whisper", "monitor", "barge"].includes(joinMode)
        ? joinMode
        : "live";

      const timestamp = new Date().toISOString();
      const result = await applyOperatorVoiceMutation({
        db,
        wsHub,
        logger,
        scope,
        callId: call.id,
        sessionId: session.id,
        eventType: "operator_handoff_requested",
        rejectEventType: "operator_handoff_request_rejected",
        eventActor: "operator",
        sessionPatch: {
          status: "agent_ringing",
          operatorJoinRequested: true,
          operatorJoinMode: normalizedJoinMode,
          operatorName,
          operatorUserId,
          operatorRequestedAt: timestamp,
        },
        buildCallPatch: ({ call: currentCall, session: updatedSession }) => ({
          handoffRequested: true,
          handoffCompleted: false,
          handoffTarget:
            updatedSession.requestedDepartment ||
            updatedSession.resolvedDepartment ||
            currentCall.handoffTarget ||
            null,
        }),
        buildEventPayload: ({ call: nextCall, session: nextSession }) => ({
          operatorUserId: nextSession.operatorUserId,
          operatorName: nextSession.operatorName,
          operatorJoinMode: nextSession.operatorJoinMode,
          sessionStatus: nextSession.status,
          callStatus: nextCall.status,
          requestedDepartment:
            nextSession.requestedDepartment || nextSession.resolvedDepartment || null,
          }),
          getRuntime,
        });

      if (!result?.ok) {
        return fail(
          res,
          result.statusCode || 500,
          result.error || "voice_handoff_request_failed",
          {
            details: result.details,
            mutationOutcome: s(result.mutationOutcome || "rejected"),
          }
        );
      }

      await auditSafe(audit, {
        tenantId: scope.tenantId,
        tenantKey: scope.tenantKey,
        actor,
        action: "voice.session.handoff_requested",
        objectType: "voice_call_session",
        objectId: session.id,
        meta: {
          joinMode:
            result.payload?.session?.operatorJoinMode || normalizedJoinMode,
          requestedDepartment:
            result.payload?.session?.requestedDepartment || session.requestedDepartment,
          mutationOutcome: result.payload?.mutationOutcome || "applied",
        },
      });

      return ok(res, {
        session: result.payload?.session,
        mutationOutcome: result.payload?.mutationOutcome || "applied",
      });
    } catch (err) {
      logger.error("voice.live.request_handoff.failed", err, {
        sessionId: s(req.params?.id),
      });
      recordVoiceRouteFailure({
        route: "voice.live.request_handoff",
        reasonCode: "voice_handoff_request_failed",
        err,
        req,
        context: {
          sessionId: s(req.params?.id),
        },
      });
      return fail(res, 500, "voice_handoff_request_failed");
    }
  });

  r.post("/voice/live/:id/joined", requireOperatorSurfaceAccess, async (req, res) => {
    const logger = getRouteLogger(req, "voice.live.joined");
    try {
      if (dbDisabled || !db) {
        return fail(res, 503, "db_unavailable");
      }

      const scope = await requireTenantScope(req, res, db);
      if (!scope) return;

      const actor = getActor(req);
      const session = await getScopedSessionOrFail({
        db,
        scope,
        sessionId: req.params?.id,
        res,
      });
      if (!session) return;
      const call = await getScopedCallForSessionOrFail({ db, scope, session, res });
      if (!call) return;

      const mode = s(session.operatorJoinMode, "live");
      const timestamp = new Date().toISOString();
      const result = await applyOperatorVoiceMutation({
        db,
        wsHub,
        logger,
        scope,
        callId: call.id,
        sessionId: session.id,
        eventType: "operator_joined",
        rejectEventType: "operator_join_rejected",
        eventActor: "operator",
        sessionPatch: {
          status: mode === "whisper" ? "agent_whisper" : "agent_live",
          operatorJoined: true,
          whisperActive: mode === "whisper",
          operatorJoinRequested: true,
          operatorJoinedAt: timestamp,
        },
        buildCallPatch: ({ call: currentCall, session: updatedSession }) => ({
          handoffRequested: true,
          handoffCompleted: true,
          handoffTarget:
            updatedSession.resolvedDepartment ||
            updatedSession.requestedDepartment ||
            currentCall.handoffTarget ||
            null,
          agentMode: mode === "live" ? "human" : "hybrid",
        }),
        buildEventPayload: ({ call: nextCall, session: nextSession }) => ({
          operatorUserId: nextSession.operatorUserId,
          operatorName: nextSession.operatorName,
          operatorJoinMode: nextSession.operatorJoinMode,
          sessionStatus: nextSession.status,
          callStatus: nextCall.status,
          }),
          getRuntime,
        });

      if (!result?.ok) {
        return fail(
          res,
          result.statusCode || 500,
          result.error || "voice_operator_join_failed",
          {
            details: result.details,
            mutationOutcome: s(result.mutationOutcome || "rejected"),
          }
        );
      }

      await auditSafe(audit, {
        tenantId: scope.tenantId,
        tenantKey: scope.tenantKey,
        actor,
        action: "voice.session.operator_joined",
        objectType: "voice_call_session",
        objectId: session.id,
        meta: {
          joinMode: result.payload?.session?.operatorJoinMode || mode,
          mutationOutcome: result.payload?.mutationOutcome || "applied",
        },
      });

      return ok(res, {
        session: result.payload?.session,
        mutationOutcome: result.payload?.mutationOutcome || "applied",
      });
    } catch (err) {
      logger.error("voice.live.joined.failed", err, {
        sessionId: s(req.params?.id),
      });
      recordVoiceRouteFailure({
        route: "voice.live.joined",
        reasonCode: "voice_operator_join_failed",
        err,
        req,
        context: {
          sessionId: s(req.params?.id),
        },
      });
      return fail(res, 500, "voice_operator_join_failed");
    }
  });

  r.post("/voice/live/:id/takeover", requireOperatorSurfaceAccess, async (req, res) => {
    const logger = getRouteLogger(req, "voice.live.takeover");
    try {
      if (dbDisabled || !db) {
        return fail(res, 503, "db_unavailable");
      }

      const scope = await requireTenantScope(req, res, db);
      if (!scope) return;

      const actor = getActor(req);
      const session = await getScopedSessionOrFail({
        db,
        scope,
        sessionId: req.params?.id,
        res,
      });
      if (!session) return;
      const call = await getScopedCallForSessionOrFail({ db, scope, session, res });
      if (!call) return;

      const timestamp = new Date().toISOString();
      const result = await applyOperatorVoiceMutation({
        db,
        wsHub,
        logger,
        scope,
        callId: call.id,
        sessionId: session.id,
        eventType: "operator_takeover",
        rejectEventType: "operator_takeover_rejected",
        eventActor: "operator",
        sessionPatch: {
          status: "agent_live",
          operatorJoined: true,
          takeoverActive: true,
          whisperActive: false,
          botActive: false,
          operatorJoinedAt: timestamp,
        },
        buildCallPatch: ({ call: currentCall, session: updatedSession }) => ({
          handoffRequested: true,
          handoffCompleted: true,
          handoffTarget:
            updatedSession.resolvedDepartment ||
            updatedSession.requestedDepartment ||
            currentCall.handoffTarget ||
            null,
          agentMode: "human",
        }),
        buildEventPayload: ({ call: nextCall, session: nextSession }) => ({
          operatorUserId: nextSession.operatorUserId,
          operatorName: nextSession.operatorName,
          operatorJoinMode: nextSession.operatorJoinMode,
          sessionStatus: nextSession.status,
          callStatus: nextCall.status,
          takeoverActive: !!nextSession.takeoverActive,
        }),
        getRuntime,
      });

      if (!result?.ok) {
        return fail(res, result.statusCode || 500, result.error || "voice_takeover_failed", {
          details: result.details,
          mutationOutcome: s(result.mutationOutcome || "rejected"),
        });
      }

      await auditSafe(audit, {
        tenantId: scope.tenantId,
        tenantKey: scope.tenantKey,
        actor,
        action: "voice.session.takeover",
        objectType: "voice_call_session",
        objectId: session.id,
        meta: {
          mutationOutcome: result.payload?.mutationOutcome || "applied",
        },
      });

      return ok(res, {
        session: result.payload?.session,
        mutationOutcome: result.payload?.mutationOutcome || "applied",
      });
    } catch (err) {
      logger.error("voice.live.takeover.failed", err, {
        sessionId: s(req.params?.id),
      });
      recordVoiceRouteFailure({
        route: "voice.live.takeover",
        reasonCode: "voice_takeover_failed",
        err,
        req,
        context: {
          sessionId: s(req.params?.id),
        },
      });
      return fail(res, 500, "voice_takeover_failed");
    }
  });

  r.post("/voice/live/:id/end", requireOperatorSurfaceAccess, async (req, res) => {
    const logger = getRouteLogger(req, "voice.live.end");
    try {
      if (dbDisabled || !db) {
        return fail(res, 503, "db_unavailable");
      }

      const scope = await requireTenantScope(req, res, db);
      if (!scope) return;

      const actor = getActor(req);
      const session = await getScopedSessionOrFail({
        db,
        scope,
        sessionId: req.params?.id,
        res,
      });
      if (!session) return;
      const call = await getScopedCallForSessionOrFail({ db, scope, session, res });
      if (!call) return;

      const timestamp = new Date().toISOString();
      const result = await applyOperatorVoiceMutation({
        db,
        wsHub,
        logger,
        scope,
        callId: call.id,
        sessionId: session.id,
        eventType: "session_completed",
        ignoredEventType: "session_end_ignored",
        eventActor: "operator",
        sessionPatch: {
          status: "completed",
          botActive: false,
          endedAt: timestamp,
        },
        buildCallPatch: () => ({
          status: "completed",
          endedAt: timestamp,
        }),
        buildEventPayload: ({ call: nextCall, session: nextSession }) => ({
          sessionStatus: nextSession.status,
          callStatus: nextCall.status,
          endedAt: nextSession.endedAt || nextCall.endedAt || timestamp,
          callId: nextCall.id,
          }),
          terminalBehavior: "ignore",
          getRuntime,
        });

      if (!result?.ok) {
        return fail(res, result.statusCode || 500, result.error || "voice_end_failed", {
          details: result.details,
          mutationOutcome: s(result.mutationOutcome || "rejected"),
        });
      }

      await auditSafe(audit, {
        tenantId: scope.tenantId,
        tenantKey: scope.tenantKey,
        actor,
        action: "voice.session.ended",
        objectType: "voice_call_session",
        objectId: session.id,
        meta: {
          mutationOutcome: result.payload?.mutationOutcome || "applied",
        },
      });

      return ok(res, {
        session: result.payload?.session,
        mutationOutcome: result.payload?.mutationOutcome || "applied",
      });
    } catch (err) {
      logger.error("voice.live.end.failed", err, {
        sessionId: s(req.params?.id),
      });
      recordVoiceRouteFailure({
        route: "voice.live.end",
        reasonCode: "voice_end_failed",
        err,
        req,
        context: {
          sessionId: s(req.params?.id),
        },
      });
      return fail(res, 500, "voice_end_failed");
    }
  });

  r.post("/voice/test", requireOperatorSurfaceAccess, async (req, res) => {
    const logger = getRouteLogger(req, "voice.test");
    try {
      const scope = await resolveTenantScope(req, db);
      if (!scope?.tenantId) return fail(res, 400, "tenant_required");

      const actor = getActor(req);

      let settings = null;
      if (!dbDisabled && db) {
        settings = await getTenantVoiceSettings(db, scope.tenantId);
      }

      await auditSafe(audit, {
        tenantId: scope.tenantId,
        tenantKey: scope.tenantKey,
        actor,
        action: "voice.test.requested",
        objectType: "voice_test",
        objectId: scope.tenantId,
        meta: {
          hasSettings: !!settings,
          provider: settings?.provider || "twilio",
        },
      });

      return ok(res, {
        message: "voice_test_ready",
        settings,
      });
    } catch (err) {
      logger.error("voice.test.failed", err);
      recordVoiceRouteFailure({
        route: "voice.test",
        reasonCode: "voice_test_failed",
        err,
        req,
      });
      return fail(res, 500, "voice_test_failed");
    }
  });

  return r;
}
