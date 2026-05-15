import {
  buildVoiceConfigFromProjectedRuntime,
  upsertCallAndSession,
  findTenantByKeyOrPhone,
  appendVoiceEventStrict,
  emitVoiceMutationRealtime,
  runVoiceMutationTransaction,
  s,
  b,
  isObj,
  normalizePhone,
  normalizeTranscriptItem,
  buildVoiceInternalErrorResult,
  buildVoiceInternalOkResult,
  buildVoiceInternalPayloadResult,
  obj,
  arr,
  firstNonEmpty,
  pickBoolean,
  pickArray,
  lower,
  buildTranscriptFingerprint,
  isDuplicateTranscriptFrame,
  buildTranscriptLine,
  isTerminalSessionStatus,
  buildSessionStateConflict,
  buildProjectionContact,
  buildServiceProjectionEntry,
  buildVoiceAuthorityDetails,
  normalizeRuntimeTenantRow,
  normalizedRuntimeTenantKey,
  normalizedRuntimeTenantId,
  buildStableTenantScope,
  normalizeProjectedRuntimeForVoice,
} from "../modules/voice/internal/index.js";

import {
  getVoiceCallByProviderSid,
  updateVoiceCall,
  getVoiceCallSessionByProviderCallSid,
  updateVoiceCallSession,
} from "../db/helpers/voice.js";

import {
  getTenantBrainRuntime,
  isRuntimeAuthorityError,
} from "./businessBrain/getTenantBrainRuntime.js";
import { createRuntimeAuthorityError } from "./businessBrain/runtimeAuthority.js";
import { buildOperationalChannels } from "./operationalChannels.js";
import { buildProjectedTenantRuntime } from "./projectedTenantRuntime.js";
import { buildVoiceReplayPayload } from "./voiceReplayTrace.js";

async function appendVoiceConflictEvent({
  db,
  providerCallSid,
  eventType,
  payload,
  mutationOutcome = "rejected",
  getRuntime = getTenantBrainRuntime,
}) {
  const call = await getVoiceCallByProviderSid(db, providerCallSid);
  if (!call?.id) return;

  const session = await getVoiceCallSessionByProviderCallSid(db, providerCallSid);
  const event = await appendVoiceEventStrict(db, {
    callId: call.id,
    tenantId: call.tenantId,
    tenantKey: call.tenantKey,
    eventType,
    actor: "voice_backend",
    payload: await buildVoiceReplayPayload({
      db,
      tenantId: call.tenantId || session?.tenantId,
      tenantKey: call.tenantKey || session?.tenantKey,
      eventType,
      getRuntime,
      payload: {
        ...obj(payload),
        mutationOutcome: s(mutationOutcome || "rejected"),
      },
    }),
  });
  return {
    call,
    session,
    event,
    mutationOutcome,
  };
}

function buildVoiceProjectedRuntime({
  runtime = null,
  tenant = null,
  operationalChannels = {},
  tenantKey = "",
  toNumber = "",
} = {}) {
  try {
    return buildProjectedTenantRuntime({
      runtime,
      tenantRow: tenant,
      operationalChannels,
    });
  } catch (primaryError) {
    if (isRuntimeAuthorityError(primaryError)) {
      throw primaryError;
    }

    const authority = obj(runtime?.authority);
    const approvedAuthorityAvailable =
      authority.available === true &&
      s(authority.source) === "approved_runtime_projection";

    if (!approvedAuthorityAvailable) {
      throw primaryError;
    }

    throw createRuntimeAuthorityError({
      mode: "strict",
      tenantId: firstNonEmpty(
        authority.tenantId,
        tenant?.id,
        tenant?.tenant_id
      ),
      tenantKey: firstNonEmpty(
        authority.tenantKey,
        tenant?.tenant_key,
        tenantKey
      ),
      runtimeProjection: obj(
        runtime?.raw?.projection ||
          runtime?.raw?.runtimeProjection ||
          runtime?.raw?.currentProjection
      ),
      reasonCode: "runtime_projection_invalid",
      reason: "runtime_projection_invalid",
      message:
        "Approved runtime authority is unavailable because the approved runtime projection could not be materialized for voice execution.",
    });
  }
}

async function loadTenantRowDirect(db, { tenantId = "", tenantKey = "" } = {}) {
  if (!db?.query) return null;

  const resolvedTenantId = s(tenantId);
  const resolvedTenantKey = s(tenantKey);

  if (resolvedTenantId) {
    const byId = await db.query(
      `
        select
          t.id,
          t.tenant_key,
          t.company_name,
          t.legal_name,
          t.industry_key,
          t.country_code,
          t.timezone,
          t.default_language,
          t.enabled_languages,
          t.market_region,
          t.plan_key,
          t.status as tenant_status,
          t.active as tenant_active
        from tenants t
        where t.id = $1
        limit 1
      `,
      [resolvedTenantId]
    );

    if (byId?.rows?.[0]) {
      return byId.rows[0];
    }
  }

  if (resolvedTenantKey) {
    const byKey = await db.query(
      `
        select
          t.id,
          t.tenant_key,
          t.company_name,
          t.legal_name,
          t.industry_key,
          t.country_code,
          t.timezone,
          t.default_language,
          t.enabled_languages,
          t.market_region,
          t.plan_key,
          t.status as tenant_status,
          t.active as tenant_active
        from tenants t
        where lower(t.tenant_key) = lower($1)
        limit 1
      `,
      [resolvedTenantKey]
    );

    if (byKey?.rows?.[0]) {
      return byKey.rows[0];
    }
  }

  return null;
}

function needsTenantHydration(tenant = null) {
  const value = obj(tenant);
  return !s(value.id || value.tenant_id) || !s(value.tenant_key || value.tenantKey);
}

async function hydrateTenantRowIfNeeded({
  db,
  tenant = null,
  runtime = null,
  tenantKey = "",
  toNumber = "",
} = {}) {
  const normalized = buildStableTenantScope({
    tenant,
    runtime,
    tenantKey,
    toNumber,
  });

  if (!needsTenantHydration(normalized)) {
    return normalized;
  }

  const lookupTenantId = firstNonEmpty(
    normalized.id,
    normalized.tenant_id,
    normalizedRuntimeTenantId(runtime)
  );

  const lookupTenantKey = firstNonEmpty(
    normalized.tenant_key,
    normalized.tenantKey,
    normalizedRuntimeTenantKey(runtime),
    tenantKey
  );

  let resolvedTenant = await loadTenantRowDirect(db, {
    tenantId: lookupTenantId,
    tenantKey: lookupTenantKey,
  });

  if (!resolvedTenant && (lookupTenantKey || s(toNumber))) {
    resolvedTenant = await findTenantByKeyOrPhone(db, {
      tenantKey: lookupTenantKey,
      toNumber: s(toNumber),
      normalizePhone,
    });
  }

  if (!resolvedTenant) {
    return normalized;
  }

  return buildStableTenantScope({
    tenant: resolvedTenant,
    runtime,
    tenantKey: lookupTenantKey,
    toNumber,
  });
}

async function resolveVoiceTenantContext({
  db,
  tenantKey,
  toNumber,
  getRuntime = getTenantBrainRuntime,
}) {
  const normalizedTenantKey = s(tenantKey);
  const normalizedToNumber = s(toNumber);

  let tenant = null;
  let runtime = null;
  let runtimeAuthorityError = null;

  if (normalizedTenantKey) {
    try {
      runtime = await getRuntime({
        db,
        tenantKey: normalizedTenantKey,
        authorityMode: "strict",
      });
    } catch (error) {
      if (isRuntimeAuthorityError(error)) {
        runtimeAuthorityError = error;
      } else {
        throw error;
      }
    }
  }

  const runtimeTenantKey = normalizedRuntimeTenantKey(runtime);
  const shouldResolveTenantFromDb =
    !tenant ||
    needsTenantHydration(
      buildStableTenantScope({
        tenant,
        runtime,
        tenantKey: normalizedTenantKey,
        toNumber: normalizedToNumber,
      })
    );

  if (shouldResolveTenantFromDb) {
    const resolvedTenant = await findTenantByKeyOrPhone(db, {
      tenantKey: firstNonEmpty(normalizedTenantKey, runtimeTenantKey),
      toNumber: normalizedToNumber,
      normalizePhone,
    });

    if (resolvedTenant) {
      tenant = resolvedTenant;
    }
  }

  if (!runtime && tenant) {
    try {
      runtime = await getRuntime({
        db,
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
        authorityMode: "strict",
      });
      runtimeAuthorityError = null;
    } catch (error) {
      if (isRuntimeAuthorityError(error)) {
        runtimeAuthorityError = error;
      } else {
        throw error;
      }
    }
  }

  const normalizedTenant = await hydrateTenantRowIfNeeded({
    db,
    tenant,
    runtime,
    tenantKey: normalizedTenantKey,
    toNumber: normalizedToNumber,
  });

  return {
    tenant: normalizedTenant,
    runtime,
    runtimeAuthorityError,
  };
}

export async function processVoiceTenantConfig({
  db,
  tenantKey,
  toNumber,
  getRuntime = getTenantBrainRuntime,
}) {
  const context = await resolveVoiceTenantContext({
    db,
    tenantKey,
    toNumber,
    getRuntime,
  });

  const runtime = context.runtime;
  const runtimeAuthorityError = context.runtimeAuthorityError;

  const tenant = buildStableTenantScope({
    tenant: context.tenant,
    runtime,
    tenantKey,
    toNumber,
  });

  const resolvedTenantKey = s(
    tenant?.tenant_key || tenant?.tenantKey || tenantKey
  );
  const resolvedTenantId = firstNonEmpty(
    tenant?.id,
    tenant?.tenant_id,
    normalizedRuntimeTenantId(runtime)
  );

  if (!resolvedTenantId && !resolvedTenantKey) {
    return {
      ok: false,
      statusCode: 404,
      error: "tenant_not_found",
      tenantKey,
      toNumber,
    };
  }

  if (!runtime) {
    if (runtimeAuthorityError && isRuntimeAuthorityError(runtimeAuthorityError)) {
      return {
        ok: false,
        statusCode: Number(runtimeAuthorityError?.statusCode || 409),
        error: "runtime_authority_unavailable",
        tenantKey: resolvedTenantKey,
        toNumber,
        details: buildVoiceAuthorityDetails(runtimeAuthorityError, runtime),
      };
    }

    return {
      ok: false,
      statusCode: 409,
      error: "runtime_authority_unavailable",
      tenantKey: resolvedTenantKey,
      toNumber,
      details: buildVoiceAuthorityDetails(null, runtime),
    };
  }

  const stableTenant = {
    ...tenant,
    id: resolvedTenantId,
    tenant_id: resolvedTenantId,
    tenant_key: resolvedTenantKey,
    tenantKey: resolvedTenantKey,
  };

  const operationalChannels = await buildOperationalChannels({
    db,
    tenantId: resolvedTenantId,
    tenantRow: stableTenant,
  });

  let projectedRuntime = null;
  try {
    projectedRuntime = buildVoiceProjectedRuntime({
      runtime,
      tenant: stableTenant,
      operationalChannels,
      tenantKey: resolvedTenantKey,
      toNumber,
    });
  } catch (error) {
    if (isRuntimeAuthorityError(error)) {
      return {
        ok: false,
        statusCode: Number(error?.statusCode || 409),
        error: "runtime_authority_unavailable",
        tenantKey: resolvedTenantKey,
        toNumber,
        details: buildVoiceAuthorityDetails(error, runtime),
      };
    }
    throw error;
  }

  const stableProjectedRuntime = normalizeProjectedRuntimeForVoice(
    projectedRuntime,
    stableTenant
  );

  if (operationalChannels?.voice?.ready !== true) {
    return {
      ok: false,
      statusCode: 409,
      error: "voice_operational_unavailable",
      tenantKey: resolvedTenantKey,
      toNumber,
      details: {
        unavailable: true,
        strict: true,
        authority: obj(stableProjectedRuntime?.authority || runtime?.authority),
        tenant: stableTenant,
        operationalChannels,
        reasonCode: s(
          operationalChannels?.voice?.reasonCode || "voice_settings_missing"
        ),
        reason_code: s(
          operationalChannels?.voice?.reasonCode || "voice_settings_missing"
        ),
      },
    };
  }

  const builtPayload = obj(
    buildVoiceConfigFromProjectedRuntime(stableProjectedRuntime, {
      tenantKey: resolvedTenantKey,
      toNumber,
    })
  );

  const payload = {
    ...builtPayload,
    tenantKey: s(builtPayload.tenantKey || resolvedTenantKey),
    tenantId: firstNonEmpty(builtPayload.tenantId, resolvedTenantId),
    toNumber: s(builtPayload.toNumber || toNumber),
    tenant: stableTenant,
    projectedRuntime: obj(builtPayload.projectedRuntime).authority
      ? normalizeProjectedRuntimeForVoice(
          builtPayload.projectedRuntime,
          stableTenant
        )
      : stableProjectedRuntime,
    operationalChannels,
    authority: {
      ...obj(
        builtPayload.authority ||
          stableProjectedRuntime?.authority ||
          runtime?.authority
      ),
      strict: true,
      unavailable: false,
      tenantId: resolvedTenantId,
      tenant_id: resolvedTenantId,
      tenantKey: resolvedTenantKey,
      tenant_key: resolvedTenantKey,
    },
  };

  return buildVoiceInternalOkResult(payload);
}

export async function processVoiceSessionUpsert({
  db,
  wsHub = null,
  logger = null,
  body,
  getRuntime = getTenantBrainRuntime,
}) {
  const committed = await runVoiceMutationTransaction(db, async (tx) => {
    const { call, session, appliedGuards = [] } = await upsertCallAndSession(tx, body);
    const event = await appendVoiceEventStrict(tx, {
      callId: call.id,
      tenantId: call.tenantId,
      tenantKey: call.tenantKey,
      eventType: "session_upserted",
      actor: "voice_backend",
      payload: await buildVoiceReplayPayload({
        db: tx,
        tenantId: call.tenantId || session.tenantId,
        tenantKey: call.tenantKey || session.tenantKey,
        eventType: "session_upserted",
        getRuntime,
        payload: {
          callStatus: call.status,
          sessionStatus: session.status,
          conferenceName: session.conferenceName,
          appliedGuards,
          mutationOutcome: "applied",
        },
      }),
    });

    return { call, session, event, appliedGuards };
  });

  emitVoiceMutationRealtime({
    wsHub,
    logger,
    call: committed.call,
    session: committed.session,
    event: committed.event,
    mutationOutcome: "applied",
  });

  return buildVoiceInternalOkResult({
    ok: true,
    call: committed.call,
    session: committed.session,
    event: committed.event,
    appliedGuards: committed.appliedGuards,
  });
}

export async function processVoiceTranscript({
  db,
  wsHub = null,
  logger = null,
  providerCallSid,
  text,
  role,
  ts,
  getRuntime = getTenantBrainRuntime,
}) {
  const committed = await runVoiceMutationTransaction(db, async (tx) => {
    const session = await getVoiceCallSessionByProviderCallSid(
      tx,
      providerCallSid
    );
    if (!session) {
      return buildVoiceInternalErrorResult({
        statusCode: 404,
        error: "voice_session_not_found",
      });
    }

    const transcriptLive = Array.isArray(session.transcriptLive)
      ? [...session.transcriptLive]
      : [];

    const nextItem = normalizeTranscriptItem({ ts, role, text });
    if (isDuplicateTranscriptFrame(transcriptLive, nextItem)) {
      const call = await getVoiceCallByProviderSid(tx, providerCallSid);
      const event = call?.id
        ? await appendVoiceEventStrict(tx, {
            callId: call.id,
            tenantId: call.tenantId,
            tenantKey: call.tenantKey,
            eventType: "transcript_ignored",
            actor: "voice_backend",
            payload: await buildVoiceReplayPayload({
              db: tx,
              tenantId: call.tenantId || session.tenantId,
              tenantKey: call.tenantKey || session.tenantKey,
              eventType: "transcript_ignored",
              getRuntime,
              payload: {
                reasonCode: "duplicate_transcript_frame",
                role: nextItem.role,
                text: nextItem.text,
                ts: nextItem.ts,
                mutationOutcome: "ignored",
              },
            }),
          })
        : null;

      return buildVoiceInternalOkResult(
        {
          ok: true,
          call,
          session,
          event,
          appliedGuards: ["duplicate_transcript_ignored"],
        },
        {
          __voiceRealtime: {
            call,
            session,
            event,
            mutationOutcome: "ignored",
          },
        }
      );
    }

    transcriptLive.push(nextItem);
    while (transcriptLive.length > 100) transcriptLive.shift();

    const updatedSession = await updateVoiceCallSession(tx, session.id, {
      transcriptLive,
    });

    const call = await getVoiceCallByProviderSid(tx, providerCallSid);
    let updatedCall = call;
    let event = null;

    if (call) {
      const prev = s(call.transcript);
      const nextLine = buildTranscriptLine(role, text);
      const nextTranscript =
        prev.split("\n").at(-1) === nextLine ? prev : prev ? `${prev}\n${nextLine}` : nextLine;

      updatedCall = await updateVoiceCall(tx, call.id, {
        transcript: nextTranscript.slice(-30000),
      });

      event = await appendVoiceEventStrict(tx, {
        callId: call.id,
        tenantId: call.tenantId,
        tenantKey: call.tenantKey,
        eventType: "transcript_appended",
        actor: "voice_backend",
        payload: await buildVoiceReplayPayload({
          db: tx,
          tenantId: call.tenantId || updatedSession.tenantId,
          tenantKey: call.tenantKey || updatedSession.tenantKey,
          eventType: "transcript_appended",
          getRuntime,
          payload: {
            role,
            text,
            ts,
            mutationOutcome: "applied",
          },
        }),
      });
    }

    return buildVoiceInternalOkResult(
      {
        ok: true,
        call: updatedCall,
        session: updatedSession,
        event,
      },
      {
        __voiceRealtime: {
          call: updatedCall,
          session: updatedSession,
          event,
          mutationOutcome: "applied",
        },
      }
    );
  });

  if (!committed?.ok) {
    return committed;
  }

  emitVoiceMutationRealtime({
    wsHub,
    logger,
    ...obj(committed.__voiceRealtime),
  });

  return buildVoiceInternalPayloadResult(committed);
}

export async function processVoiceSessionState({
  db,
  wsHub = null,
  logger = null,
  providerCallSid,
  body = {},
  getRuntime = getTenantBrainRuntime,
}) {
  const committed = await runVoiceMutationTransaction(db, async (tx) => {
    const session = await getVoiceCallSessionByProviderCallSid(
      tx,
      providerCallSid
    );
    if (!session) {
      return buildVoiceInternalErrorResult({
        statusCode: 404,
        error: "voice_session_not_found",
      });
    }

    const requestedStatus = s(body?.status);
    if (isTerminalSessionStatus(session.status)) {
      const normalizedRequestedStatus = lower(requestedStatus);
      if (normalizedRequestedStatus && normalizedRequestedStatus !== lower(session.status)) {
      const conflict = buildSessionStateConflict({
        currentStatus: session.status,
        requestedStatus,
        eventType: body?.eventType,
      });

      const realtime = await appendVoiceConflictEvent({
        db: tx,
        providerCallSid,
        eventType: "session_state_rejected",
        payload: conflict.details,
        mutationOutcome: "rejected",
        getRuntime,
      });

      return {
        ...conflict,
        __voiceRealtime: realtime || null,
      };
    }
  }

    const patch = {
      status: s(requestedStatus || session.status),
      requestedDepartment:
        s(body?.requestedDepartment || session.requestedDepartment) || null,
      resolvedDepartment:
        s(body?.resolvedDepartment || session.resolvedDepartment) || null,
      operatorUserId:
        s(body?.operatorUserId || session.operatorUserId) || null,
      operatorName: s(body?.operatorName || session.operatorName) || null,
      operatorJoinMode: s(
        body?.operatorJoinMode || session.operatorJoinMode || "live"
      ),
      botActive: b(body?.botActive, session.botActive),
      operatorJoinRequested: b(
        body?.operatorJoinRequested,
        session.operatorJoinRequested
      ),
      operatorJoined: b(body?.operatorJoined, session.operatorJoined),
      whisperActive: b(body?.whisperActive, session.whisperActive),
      takeoverActive: b(body?.takeoverActive, session.takeoverActive),
      summary: s(body?.summary || session.summary),
      endedAt: body?.endedAt || session.endedAt || null,
    };

    if (isTerminalSessionStatus(patch.status)) {
      patch.botActive = false;
      patch.endedAt = patch.endedAt || new Date().toISOString();
    }

    if (body?.operatorRequestedAt) {
      patch.operatorRequestedAt = body.operatorRequestedAt;
    }
    if (body?.operatorJoinedAt) {
      patch.operatorJoinedAt = body.operatorJoinedAt;
    }
    if (isObj(body?.leadPayload)) {
      patch.leadPayload = body.leadPayload;
    }
    if (isObj(body?.meta)) {
      patch.meta = body.meta;
    }

    const updatedSession = await updateVoiceCallSession(tx, session.id, patch);

    const call = await getVoiceCallByProviderSid(tx, providerCallSid);
    let updatedCall = call;
    let event = null;

    if (call) {
      updatedCall = await updateVoiceCall(tx, call.id, {
        status:
          patch.status === "completed"
            ? "completed"
            : patch.status === "failed"
              ? "failed"
              : call.status,
        handoffRequested: patch.operatorJoinRequested,
        handoffCompleted: patch.operatorJoined || patch.takeoverActive,
        handoffTarget: patch.resolvedDepartment || call.handoffTarget || null,
        summary: patch.summary || call.summary,
        endedAt: patch.endedAt || call.endedAt || null,
        meta: isObj(body?.callMeta) ? body.callMeta : call.meta,
      });

      event = await appendVoiceEventStrict(tx, {
        callId: call.id,
        tenantId: call.tenantId,
        tenantKey: call.tenantKey,
        eventType: s(body?.eventType || "session_state_updated"),
        actor: "voice_backend",
        payload: await buildVoiceReplayPayload({
          db: tx,
          tenantId: call.tenantId || updatedSession.tenantId,
          tenantKey: call.tenantKey || updatedSession.tenantKey,
          eventType: s(body?.eventType || "session_state_updated"),
          getRuntime,
          payload: {
            sessionStatus: updatedSession.status,
            callStatus: updatedCall?.status,
            requestedDepartment: updatedSession.requestedDepartment,
            resolvedDepartment: updatedSession.resolvedDepartment,
            operatorJoinRequested: updatedSession.operatorJoinRequested,
            operatorJoined: updatedSession.operatorJoined,
            whisperActive: updatedSession.whisperActive,
            takeoverActive: updatedSession.takeoverActive,
            mutationOutcome: "applied",
          },
        }),
      });
    }

    return buildVoiceInternalOkResult(
      {
        ok: true,
        call: updatedCall,
        session: updatedSession,
        event,
        appliedGuards: [],
      },
      {
        __voiceRealtime: {
          call: updatedCall,
          session: updatedSession,
          event,
          mutationOutcome: "applied",
        },
      }
    );
  });

  if (!committed?.ok) {
    if (committed?.__voiceRealtime) {
      emitVoiceMutationRealtime({
        wsHub,
        logger,
        ...obj(committed.__voiceRealtime),
      });
    }
    return committed;
  }

  emitVoiceMutationRealtime({
    wsHub,
    logger,
    ...obj(committed.__voiceRealtime),
  });

  return buildVoiceInternalPayloadResult(committed);
}

export async function processVoiceOperatorJoin({
  db,
  wsHub = null,
  logger = null,
  providerCallSid,
  body = {},
  getRuntime = getTenantBrainRuntime,
}) {
  const committed = await runVoiceMutationTransaction(db, async (tx) => {
    const session = await getVoiceCallSessionByProviderCallSid(
      tx,
      providerCallSid
    );
    if (!session) {
      return buildVoiceInternalErrorResult({
        statusCode: 404,
        error: "voice_session_not_found",
      });
    }

    if (isTerminalSessionStatus(session.status)) {
      const conflict = buildSessionStateConflict({
        currentStatus: session.status,
        requestedStatus: "agent_live",
        eventType: "operator_joined",
      });

      const realtime = await appendVoiceConflictEvent({
        db: tx,
        providerCallSid,
        eventType: "operator_join_rejected",
        payload: {
          ...conflict.details,
          joinMode: lower(body?.operatorJoinMode || body?.joinMode || "live"),
        },
        mutationOutcome: "rejected",
        getRuntime,
      });

      return {
        ...conflict,
        __voiceRealtime: realtime || null,
      };
    }

    const joinMode = s(
      body?.operatorJoinMode || body?.joinMode || "live"
    ).toLowerCase();

    const updatedSession = await updateVoiceCallSession(tx, session.id, {
      status: joinMode === "whisper" ? "agent_whisper" : "agent_live",
      operatorUserId: s(body?.operatorUserId || session.operatorUserId) || null,
      operatorName: s(body?.operatorName || session.operatorName) || null,
      operatorJoinMode: joinMode,
      operatorJoinRequested: true,
      operatorJoined: true,
      whisperActive: joinMode === "whisper",
      takeoverActive:
        joinMode === "live" ? b(body?.takeoverActive, false) : false,
      botActive: b(body?.botActive, joinMode !== "live" ? true : false),
      operatorJoinedAt: body?.operatorJoinedAt || new Date().toISOString(),
    });

    const call = await getVoiceCallByProviderSid(tx, providerCallSid);
    let updatedCall = call;
    let event = null;

    if (call) {
      updatedCall = await updateVoiceCall(tx, call.id, {
        handoffRequested: true,
        handoffCompleted: true,
        handoffTarget:
          updatedSession.resolvedDepartment ||
          updatedSession.requestedDepartment ||
          call.handoffTarget ||
          null,
        agentMode: joinMode === "live" ? "human" : "hybrid",
      });

      event = await appendVoiceEventStrict(tx, {
        callId: call.id,
        tenantId: call.tenantId,
        tenantKey: call.tenantKey,
        eventType: "operator_joined",
        actor: "operator",
        payload: await buildVoiceReplayPayload({
          db: tx,
          tenantId: call.tenantId || updatedSession.tenantId,
          tenantKey: call.tenantKey || updatedSession.tenantKey,
          eventType: "operator_joined",
          getRuntime,
          payload: {
            operatorUserId: updatedSession.operatorUserId,
            operatorName: updatedSession.operatorName,
            operatorJoinMode: updatedSession.operatorJoinMode,
            takeoverActive: updatedSession.takeoverActive,
            sessionStatus: updatedSession.status,
            callStatus: updatedCall?.status,
            mutationOutcome: "applied",
          },
        }),
      });
    }

    return buildVoiceInternalOkResult(
      {
        ok: true,
        call: updatedCall,
        session: updatedSession,
        event,
      },
      {
        __voiceRealtime: {
          call: updatedCall,
          session: updatedSession,
          event,
          mutationOutcome: "applied",
        },
      }
    );
  });

  if (!committed?.ok) {
    if (committed?.__voiceRealtime) {
      emitVoiceMutationRealtime({
        wsHub,
        logger,
        ...obj(committed.__voiceRealtime),
      });
    }
    return committed;
  }

  emitVoiceMutationRealtime({
    wsHub,
    logger,
    ...obj(committed.__voiceRealtime),
  });

  return buildVoiceInternalPayloadResult(committed);
}

export async function processVoiceReportPing() {
  return buildVoiceInternalOkResult({
    ok: true,
    accepted: true,
  });
}
