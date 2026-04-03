import express from "express";
import { requireOperatorSurfaceAccess } from "../../../utils/auth.js";
import { createLogger } from "../../../utils/logger.js";
import { recordRuntimeSignal } from "../../../observability/runtimeSignals.js";
import {
  s,
  n,
  b,
  ok,
  fail,
  getActor,
  isLiveVoiceStatus,
  sameTenant,
} from "./shared.js";
import {
  getTenantVoiceSettings,
  upsertTenantVoiceSettings,
  listVoiceCalls,
  listVoiceCallEvents,
  getVoiceDailyUsage,
  listVoiceCallSessions,
  getVoiceCallById,
  getVoiceCallSessionById,
  updateVoiceCall,
  updateVoiceCallSession,
  resolveTenantScope,
} from "./repository.js";
import {
  requireTenantScope,
  normalizeSettingsInput,
  getScopedCallOrFail,
  getScopedSessionOrFail,
  findSessionByCallId,
  auditSafe,
  runVoiceMutationTransaction,
  appendVoiceEventStrict,
  emitVoiceMutationRealtime,
} from "./utils.js";

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

function isMissingSchemaError(error) {
  const code = s(error?.code).toUpperCase();
  const message = s(error?.message).toLowerCase();

  if (code === "42P01" || code === "42703") {
    return true;
  }

  return (
    message.includes("does not exist") ||
    message.includes("undefined column") ||
    message.includes("undefined table")
  );
}

const TERMINAL_SESSION_STATUSES = new Set(["completed", "failed"]);

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function isTerminalSessionStatus(status = "") {
  return TERMINAL_SESSION_STATUSES.has(lower(status));
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function getSessionCallId(session = {}) {
  return s(
    session?.voiceCallId ||
      session?.voice_call_id ||
      session?.callId ||
      session?.call_id
  );
}

function sessionMatchesCall(session = {}, callId = "") {
  return s(getSessionCallId(session)) === s(callId);
}

async function getScopedCallForSessionOrFail({ db, scope, session, res }) {
  const callId = getSessionCallId(session);
  if (!callId) {
    fail(res, 404, "voice_call_not_found");
    return null;
  }

  return getScopedCallOrFail({ db, scope, callId, res });
}

function buildSessionStateConflict({
  currentStatus = "",
  requestedStatus = "",
  eventType = "",
} = {}) {
  const current = lower(currentStatus);
  const requested = lower(requestedStatus);

  return {
    ok: false,
    statusCode: 409,
    error: "voice_session_state_conflict",
    mutationOutcome: "rejected",
    details: {
      reasonCode:
        requested && requested !== current
          ? "terminal_state_regression"
          : "terminal_state_conflict",
      currentStatus: current,
      requestedStatus: requested,
      eventType: s(eventType),
    },
  };
}

async function applyOperatorVoiceMutation({
  db,
  wsHub = null,
  logger = null,
  scope,
  callId = "",
  sessionId = "",
  eventType = "",
  rejectEventType = "",
  ignoredEventType = "",
  eventActor = "operator",
  sessionPatch = {},
  buildCallPatch = null,
  buildEventPayload = null,
  terminalBehavior = "reject",
} = {}) {
  const committed = await runVoiceMutationTransaction(db, async (tx) => {
    const currentSession = await getVoiceCallSessionById(tx, sessionId);
    if (!currentSession?.id) {
      return {
        ok: false,
        statusCode: 404,
        error: "voice_session_not_found",
      };
    }

    if (!sameTenant(currentSession.tenantId ?? currentSession.tenant_id, scope?.tenantId)) {
      return {
        ok: false,
        statusCode: 403,
        error: "forbidden",
      };
    }

    const resolvedCallId = s(callId || getSessionCallId(currentSession));
    const currentCall = resolvedCallId ? await getVoiceCallById(tx, resolvedCallId) : null;
    if (!currentCall?.id) {
      return {
        ok: false,
        statusCode: 404,
        error: "voice_call_not_found",
      };
    }

    if (!sameTenant(currentCall.tenantId ?? currentCall.tenant_id, scope?.tenantId)) {
      return {
        ok: false,
        statusCode: 403,
        error: "forbidden",
      };
    }

    const requestedStatus = s(sessionPatch?.status || currentSession.status);
    if (isTerminalSessionStatus(currentSession.status)) {
      if (
        terminalBehavior === "ignore" &&
        lower(requestedStatus) === lower(currentSession.status)
      ) {
        const event = await appendVoiceEventStrict(tx, {
          callId: currentCall.id,
          tenantId: currentCall.tenantId,
          tenantKey: currentCall.tenantKey,
          eventType: s(ignoredEventType || `${eventType}_ignored`),
          actor: eventActor,
          payload: {
            ...obj(
              typeof buildEventPayload === "function"
                ? buildEventPayload({
                    call: currentCall,
                    session: currentSession,
                    previousCall: currentCall,
                    previousSession: currentSession,
                  })
                : buildEventPayload
            ),
            reasonCode: "already_terminal",
            currentStatus: lower(currentSession.status),
            requestedStatus: lower(requestedStatus),
            mutationOutcome: "ignored",
          },
        });

        return {
          ok: true,
          statusCode: 200,
          payload: {
            call: currentCall,
            session: currentSession,
            mutationOutcome: "ignored",
          },
          __voiceRealtime: {
            call: currentCall,
            session: currentSession,
            event,
            mutationOutcome: "ignored",
          },
        };
      }

      const conflict = buildSessionStateConflict({
        currentStatus: currentSession.status,
        requestedStatus,
        eventType,
      });
      const event = await appendVoiceEventStrict(tx, {
        callId: currentCall.id,
        tenantId: currentCall.tenantId,
        tenantKey: currentCall.tenantKey,
        eventType: s(rejectEventType || `${eventType}_rejected`),
        actor: eventActor,
        payload: {
          ...obj(
            typeof buildEventPayload === "function"
              ? buildEventPayload({
                  call: currentCall,
                  session: currentSession,
                  previousCall: currentCall,
                  previousSession: currentSession,
                })
              : buildEventPayload
          ),
          ...conflict.details,
          mutationOutcome: "rejected",
        },
      });

      return {
        ...conflict,
        __voiceRealtime: {
          call: currentCall,
          session: currentSession,
          event,
          mutationOutcome: "rejected",
        },
      };
    }

    const updatedSession = await updateVoiceCallSession(tx, currentSession.id, sessionPatch);
    const callPatch =
      typeof buildCallPatch === "function"
        ? buildCallPatch({
            call: currentCall,
            session: updatedSession,
            previousSession: currentSession,
          })
        : buildCallPatch;
    const updatedCall = callPatch
      ? await updateVoiceCall(tx, currentCall.id, callPatch)
      : currentCall;
    const eventPayload =
      typeof buildEventPayload === "function"
        ? buildEventPayload({
            call: updatedCall,
            session: updatedSession,
            previousCall: currentCall,
            previousSession: currentSession,
          })
        : buildEventPayload;
    const event = await appendVoiceEventStrict(tx, {
      callId: currentCall.id,
      tenantId: currentCall.tenantId,
      tenantKey: currentCall.tenantKey,
      eventType,
      actor: eventActor,
      payload: {
        ...obj(eventPayload),
        mutationOutcome: "applied",
      },
    });

    return {
      ok: true,
      statusCode: 200,
      payload: {
        call: updatedCall,
        session: updatedSession,
        mutationOutcome: "applied",
      },
      __voiceRealtime: {
        call: updatedCall,
        session: updatedSession,
        event,
        mutationOutcome: "applied",
      },
    };
  });

  if (committed?.__voiceRealtime) {
    emitVoiceMutationRealtime({
      wsHub,
      logger,
      ...obj(committed.__voiceRealtime),
    });
  }

  return committed;
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

export function voiceRoutes({ db, dbDisabled = false, audit, wsHub = null } = {}) {
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

  r.post("/voice/toggle", requireOperatorSurfaceAccess, async (req, res) => {
    const logger = getRouteLogger(req, "voice.toggle");
    try {
      if (dbDisabled || !db) {
        return fail(res, 503, "db_unavailable");
      }

      const scope = await requireTenantScope(req, res, db);
      if (!scope) return;

      const actor = getActor(req);
      const current = await getTenantVoiceSettings(db, scope.tenantId);
      const enabled = b(req.body?.enabled, !current?.enabled);

      const settings = await upsertTenantVoiceSettings(db, scope.tenantId, {
        ...(current || {}),
        enabled,
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

      const events = await listVoiceCallEvents(db, call.id);
      return ok(res, { call, events });
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

      const events = await listVoiceCallEvents(db, call.id);
      return ok(res, { events });
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

      const allSessions = await listVoiceCallSessions(db, {
        tenantId: scope.tenantId,
        status: s(req.query?.status),
        limit: Math.max(1, Math.min(200, n(req.query?.limit, 100))),
      });

      const callId = s(call.id);
      const sessions = allSessions.filter((x) => {
        return (
          s(x?.callId) === callId ||
          s(x?.call_id) === callId ||
          s(x?.voiceCallId) === callId ||
          s(x?.voice_call_id) === callId
        );
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

      const call = await getScopedCallOrFail({ db, scope, callId, res });
      if (!call) return;

      let session = null;

      if (providedSessionId) {
        session = await getScopedSessionOrFail({
          db,
          scope,
          sessionId: providedSessionId,
          res,
        });
      } else {
        session = await findSessionByCallId(db, scope.tenantId, callId);
        if (!session) return fail(res, 404, "voice_session_not_found");
      }

      if (!session) return;
      if (!sessionMatchesCall(session, call.id)) {
        return fail(res, 404, "voice_session_not_found");
      }

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

      const call = await getScopedCallOrFail({ db, scope, callId, res });
      if (!call) return;

      let session = null;

      if (providedSessionId) {
        session = await getScopedSessionOrFail({
          db,
          scope,
          sessionId: providedSessionId,
          res,
        });
      } else {
        session = await findSessionByCallId(db, scope.tenantId, callId);
        if (!session) return fail(res, 404, "voice_session_not_found");
      }

      if (!session) return;
      if (!sessionMatchesCall(session, call.id)) {
        return fail(res, 404, "voice_session_not_found");
      }

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
