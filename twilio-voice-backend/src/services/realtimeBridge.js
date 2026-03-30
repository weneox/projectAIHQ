import WebSocket from "ws";
import { createStructuredLogger } from "@aihq/shared-contracts/logger";
import {
  safeJsonParse,
  rtTemp,
  buildStrictInstructions,
  createRealtimeCore,
  callerLikelyAZ,
  buildContactReply,
  getGreeting,
  detectLang,
} from "./realtimeBridge.core.js";
import { getTenantVoiceConfig } from "./tenantConfig.js";
import { createAihqVoiceClient } from "./aihqVoiceClient.js";
import { cfg } from "../config.js";
import { s, sendTwilioMedia, getBridgeEnv } from "./bridge/shared.js";
import { incrementRuntimeMetric, recordRuntimeSignal } from "./runtimeObservability.js";

const logger = createStructuredLogger({
  service: "twilio-voice-backend",
  component: "realtime-bridge",
});

function detectDefaultLang(tenantConfig = null) {
  return s(
    tenantConfig?.voiceProfile?.defaultLanguage || tenantConfig?.defaultLanguage,
    "en"
  ).toLowerCase();
}

function buildTransferUnavailablePrefix(lang) {
  const L = s(lang, "en").toLowerCase();

  if (L === "ru") return "Не удалось перевести звонок на оператора.";
  if (L === "tr") return "Operatöre yönlendirme mümkün olmadı.";
  if (L === "en") return "Operator transfer is not available right now.";
  if (L === "es") return "La transferencia al operador no está disponible en este momento.";
  if (L === "de") return "Die Weiterleitung zum Operator ist im Moment nicht verfügbar.";
  if (L === "fr") return "Le transfert vers un opérateur n’est pas disponible pour le moment.";
  return "Operatora yönləndirmə hazırda mümkün olmadı.";
}

function buildConferenceName(tenantKey, callSid) {
  return `${s(tenantKey || "default")}:${s(callSid || "call")}`;
}

function safeDebugValue(value) {
  if (typeof value === "string") return s(value);
  try {
    return s(JSON.stringify(value));
  } catch {
    return s(value);
  }
}

function normalizeBridgeTenantConfigResult(result = null) {
  const config = result?.ok === true ? result?.config || null : null;
  const authority = config?.authority || result?.authority || null;

  if (!config || !s(config?.tenantKey) || authority?.available !== true) {
    return {
      ok: false,
      status: Number(result?.status || 503),
      error: s(result?.error || authority?.reasonCode || "tenant_config_unavailable"),
      authority,
    };
  }

  return {
    ok: true,
    config,
  };
}

function deriveTwilioCloseOutcome({
  stopReceived = false,
  localHangupRequested = false,
  transferHandoffCompleted = false,
} = {}) {
  if (transferHandoffCompleted) {
    return {
      ok: true,
      status: "completed",
      reasonCode: "transfer_handoff_completed",
      expected: true,
      eventType: "call_handoff_completed",
    };
  }

  if (localHangupRequested) {
    return {
      ok: true,
      status: "completed",
      reasonCode: "local_hangup_requested",
      expected: true,
      eventType: "call_completed_local_hangup",
    };
  }

  if (stopReceived) {
    return {
      ok: true,
      status: "completed",
      reasonCode: "twilio_stop_received",
      expected: true,
      eventType: "caller_hangup_completed",
    };
  }

  return {
    ok: false,
    status: "failed",
    reasonCode: "twilio_ws_closed_unexpected",
    expected: false,
    eventType: "twilio_ws_closed_unexpected",
  };
}

function buildInboundLifecycleMetadata() {
  return {
    direction: "inbound",
    sessionDirection: "inbound",
  };
}

function buildLiveLifecycleSummary(stage = "") {
  if (stage === "webhook_accepted") {
    return "Inbound call webhook accepted; waiting for Twilio media stream.";
  }
  if (stage === "media_stream_active") {
    return "Twilio media stream active; realtime session not ready yet.";
  }
  if (stage === "realtime_session_ready") {
    return "Realtime session ready; conversation established.";
  }
  return "";
}

function buildTerminalDisposition({
  eventType,
  status,
  reasonCode = "",
  localHangupRequested = false,
  transferHandoffCompleted = false,
  requestedDepartment = "",
  resolvedDepartment = "",
} = {}) {
  const event = s(eventType).toLowerCase();
  const terminalStatus = s(status, "failed").toLowerCase();
  const reason = s(reasonCode || eventType).toLowerCase();
  const handoffTarget = s(resolvedDepartment || requestedDepartment);

  if (
    transferHandoffCompleted ||
    event === "call_handoff_completed" ||
    reason === "transfer_handoff_completed"
  ) {
    return {
      terminalOutcomeClass: "transfer_handoff_completed",
      callOutcome: "handoff_completed",
      handoffRequested: true,
      handoffCompleted: true,
      handoffTarget,
      summary: handoffTarget
        ? `Call handed off to transfer flow for ${handoffTarget}.`
        : "Call handed off to transfer flow.",
    };
  }

  if (
    localHangupRequested ||
    event === "call_completed_local_hangup" ||
    reason === "local_hangup_requested"
  ) {
    return {
      terminalOutcomeClass: "local_forced_completion",
      callOutcome: "unknown",
      handoffRequested: false,
      handoffCompleted: false,
      handoffTarget,
      summary: "Call intentionally ended by the local runtime after a completion cue.",
    };
  }

  if (
    event.startsWith("openai_") ||
    reason.startsWith("openai_")
  ) {
    return {
      terminalOutcomeClass: "upstream_realtime_failure",
      callOutcome: "failed",
      handoffRequested: false,
      handoffCompleted: false,
      handoffTarget,
      summary: "Call failed because the realtime upstream session ended and recovery did not succeed.",
    };
  }

  if (
    event === "caller_hangup_completed" ||
    reason === "twilio_stop_received" ||
    event === "twilio_ws_closed"
  ) {
    return {
      terminalOutcomeClass: "caller_hangup",
      callOutcome: "unknown",
      handoffRequested: false,
      handoffCompleted: false,
      handoffTarget,
      summary: "Call ended normally after caller or Twilio hangup.",
    };
  }

  if (terminalStatus === "failed") {
    return {
      terminalOutcomeClass: "transport_failure",
      callOutcome: "failed",
      handoffRequested: false,
      handoffCompleted: false,
      handoffTarget,
      summary: "Call failed because the media bridge ended unexpectedly.",
    };
  }

  return {
    terminalOutcomeClass: "completed",
    callOutcome: "unknown",
    handoffRequested: false,
    handoffCompleted: false,
    handoffTarget,
    summary: "Call completed.",
  };
}

function buildTerminalTranscriptDisposition(disposition = {}) {
  const outcomeClass = s(disposition?.terminalOutcomeClass).toLowerCase();
  const handoffTarget = s(disposition?.handoffTarget);

  if (
    outcomeClass === "transport_failure" ||
    outcomeClass === "upstream_realtime_failure"
  ) {
    return {
      shouldPersist: true,
      role: "system",
      truthClass: "partial_failure",
      text:
        "System note: call ended abnormally before bot resolution. Earlier transcript is partial and should not be treated as a completed bot conversation.",
    };
  }

  if (outcomeClass === "transfer_handoff_completed") {
    return {
      shouldPersist: true,
      role: "system",
      truthClass: "pre_handoff_partial",
      text: handoffTarget
        ? `System note: bot conversation ended with operator handoff to ${handoffTarget}. Earlier transcript covers only the pre-handoff portion.`
        : "System note: bot conversation ended with operator handoff. Earlier transcript covers only the pre-handoff portion.",
    };
  }

  return {
    shouldPersist: false,
    role: "system",
    truthClass: "terminal_aligned",
    text: "",
  };
}

export function attachRealtimeBridge({
  wss,
  OPENAI_API_KEY,
  DEBUG_REALTIME,
  PUBLIC_BASE_URL,
  reporters,
  twilioClient,
  REALTIME_MODEL,
  REALTIME_VOICE,
  RECONNECT_MAX,
  WebSocketImpl = WebSocket,
  resolveTenantConfig = getTenantVoiceConfig,
  voiceClient = null,
}) {
  const {
    RESPONSE_MODALITIES,
    MIN_TRANSCRIPT_CHARS,
    MIN_SPEECH_CHUNKS,
    ASSISTANT_COOLDOWN_MS,
    MISHEARD_COOLDOWN_MS,
    ECHO_GUARD_MS,
    AUDIO_BUFFER_MAX,
    SILENCE_MS,
    GREETING_PROTECT_MS,
    WATCHDOG_MS,
    RESPOND_AFTER_STOP_DELAY_MS,
    VAD_SILENCE_MS,
    VAD_PREFIX_MS,
  } = getBridgeEnv();

  const aihqVoiceClient =
    voiceClient ||
    createAihqVoiceClient({
      fetchFn: globalThis.fetch,
      baseUrl: cfg.AIHQ_BASE_URL,
      internalToken: cfg.AIHQ_INTERNAL_TOKEN,
      timeoutMs: 8000,
      debug: !!DEBUG_REALTIME,
    });

  function dlog(...args) {
    if (!DEBUG_REALTIME) return;
    logger.info("voice.bridge.debug", {
      debug: true,
      args: args.map((item) => safeDebugValue(item)).slice(0, 8),
    });
  }

  wss.on("connection", (twilioWs, req) => {
    logger.info("voice.bridge.twilio.connected", {
      url: req?.url || null,
      ua: req?.headers?.["user-agent"] || null,
      xfwd: req?.headers?.["x-forwarded-for"] || null,
    });

    let streamSid = null;
    let callSid = null;
    let fromNumber = null;
    let toNumber = null;
    let tenantKey = null;
    let tenantConfig = null;

    let openaiWs = null;
    let openaiSessionReady = false;

    const audioQueue = [];

    let pendingResponse = false;
    let pendingSince = 0;

    let assistantSpeaking = false;
    let lastAssistantAudioAt = 0;

    let sawSpeechStart = false;
    let inboundChunkCount = 0;
    let lastInboundAt = 0;

    let lastFinalTranscript = "";
    let lastLang = "en";

    let greeted = false;
    let greetingInProgress = false;
    let greetingStartedAt = 0;

    let hangupAfterDone = false;
    let forceHangupTimer = null;
    let reconnectTimer = null;
    let localHangupRequested = false;
    let stopReceived = false;
    let transferHandoffCompleted = false;
    let finalizationPromise = null;
    let finalDisposition = null;

    let reconnectAttempts = 0;
    let mediaStreamActive = false;
    let conversationEstablished = false;

    let metricResponses = 0;
    let metricCancels = 0;
    let metricInboundChunks = 0;
    let metricStartedAt = Date.now();

    let watchdog = null;
    let silenceTimer = null;

    let turnId = 0;
    let respondedTurnId = -1;

    function buildAihqRequestContext() {
      const correlationId =
        s(callSid) ||
        s(streamSid) ||
        s(tenantKey) ||
        "voice-bridge";

      return {
        requestId: correlationId,
        correlationId,
      };
    }

    function durationSec() {
      const durMs = Date.now() - metricStartedAt;
      return Math.max(0, Math.round(durMs / 1000));
    }

    function canSendToOpenAI() {
      return !!(openaiWs && openaiWs.readyState === WebSocket.OPEN && openaiSessionReady);
    }

    function setPending(on) {
      pendingResponse = on;
      pendingSince = on ? Date.now() : 0;
    }

    function flushAudioQueueToOpenAI(limit = 80) {
      if (!canSendToOpenAI()) return;
      if (!audioQueue.length) return;

      let n = 0;
      while (audioQueue.length && n < limit) {
        const payload = audioQueue.shift();
        if (!payload) continue;

        try {
          openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: payload }));
        } catch {}

        n += 1;
      }
    }

    function closeOpenAI() {
      try {
        if (openaiWs && openaiWs.readyState === WebSocket.OPEN) openaiWs.close();
      } catch {}
    }

    function clearTimers() {
      try {
        if (watchdog) clearInterval(watchdog);
      } catch {}
      try {
        if (silenceTimer) clearInterval(silenceTimer);
      } catch {}

      watchdog = null;
      silenceTimer = null;

      try {
        if (forceHangupTimer) clearTimeout(forceHangupTimer);
      } catch {}

      forceHangupTimer = null;

      try {
        if (reconnectTimer) clearTimeout(reconnectTimer);
      } catch {}

      reconnectTimer = null;
    }

    function closeBoth() {
      clearTimers();
      closeOpenAI();

      try {
        twilioWs.close();
      } catch {}
    }

    async function hangupNowFn() {
      if (!twilioClient || !callSid) return;
      localHangupRequested = true;

      try {
        await twilioClient.calls(callSid).update({ status: "completed" });
      } catch (e) {
        logger.warn("voice.bridge.hangup_failed", {
          callSid,
          streamSid,
          tenantKey,
          error: e?.message || e,
        });
      }
    }

    function scheduleForceHangup(ms = 6500) {
      try {
        if (forceHangupTimer) clearTimeout(forceHangupTimer);
      } catch {}

      forceHangupTimer = setTimeout(() => {
        localHangupRequested = true;
        hangupNowFn().finally(() => closeBoth());
      }, ms);

      try {
        forceHangupTimer.unref?.();
      } catch {}
    }

    async function syncSessionUpsert(extra = {}) {
      try {
        if (!aihqVoiceClient.canUse()) return;

        await aihqVoiceClient.upsertSession({
          tenantKey,
          provider: "twilio",
          providerCallSid: callSid,
          providerStreamSid: streamSid,
          conferenceName: buildConferenceName(tenantKey, callSid),
          fromNumber,
          toNumber,
          customerNumber: fromNumber,
          customerName: "",
          language: lastLang || detectDefaultLang(tenantConfig),
          agentMode: "assistant",
          direction: buildInboundLifecycleMetadata().direction,
          callStatus: "in_progress",
          sessionDirection: buildInboundLifecycleMetadata().sessionDirection,
          sessionStatus: "bot_active",
          botActive: true,
          operatorJoinRequested: false,
          operatorJoined: false,
          whisperActive: false,
          takeoverActive: false,
          requestedDepartment:
            s(core?.state?.requestedDepartment) || null,
          resolvedDepartment:
            s(core?.state?.resolvedDepartment) || null,
          leadPayload: core?.state?.confirmedContact || {},
          metrics: {
            responses: metricResponses,
            cancels: metricCancels,
            inboundChunks: metricInboundChunks,
          },
          startedAt: new Date().toISOString(),
          ...extra,
        }, buildAihqRequestContext());
      } catch (e) {
        dlog("syncSessionUpsert failed", e?.message || e);
      }
    }

    async function syncTranscript(role, text) {
      try {
        if (!aihqVoiceClient.canUse()) return;
        if (!callSid || !text) return;

        await aihqVoiceClient.appendTranscript({
          providerCallSid: callSid,
          role: s(role, "customer"),
          text: s(text),
          ts: new Date().toISOString(),
        }, buildAihqRequestContext());
      } catch (e) {
        dlog("syncTranscript failed", e?.message || e);
      }
    }

    async function syncState(eventType, extra = {}) {
      try {
        if (!aihqVoiceClient.canUse()) return;
        if (!callSid) return;

        await aihqVoiceClient.updateSessionState({
          providerCallSid: callSid,
          eventType: s(eventType, "session_state_updated"),
          status: s(extra.status),
          requestedDepartment:
            s(extra.requestedDepartment || core?.state?.requestedDepartment) || null,
          resolvedDepartment:
            s(extra.resolvedDepartment || core?.state?.resolvedDepartment) || null,
          operatorUserId:
            s(extra.operatorUserId || core?.state?.operatorUserId) || null,
          operatorName:
            s(extra.operatorName || core?.state?.operatorName) || null,
          operatorJoinMode:
            s(extra.operatorJoinMode || core?.state?.operatorJoinMode || "live"),
          botActive:
            typeof extra.botActive === "boolean"
              ? extra.botActive
              : !(extra.status === "bot_silent" || extra.status === "completed"),
          operatorJoinRequested:
            typeof extra.operatorJoinRequested === "boolean"
              ? extra.operatorJoinRequested
              : !!core?.state?.awaitingTransferConfirm,
          operatorJoined:
            typeof extra.operatorJoined === "boolean"
              ? extra.operatorJoined
              : !!core?.state?.transferArmed,
          whisperActive: !!extra.whisperActive,
          takeoverActive: !!extra.takeoverActive,
          summary: s(extra.summary),
          leadPayload: core?.state?.confirmedContact || {},
          meta: isFinite(metricResponses)
            ? {
                responses: metricResponses,
                cancels: metricCancels,
                inboundChunks: metricInboundChunks,
                durationSec: durationSec(),
                reconnectAttempt: Number(extra.reconnectAttempt || 0) || 0,
                reconnectMax: Number(extra.reconnectMax || 0) || 0,
                reconnectDelayMs: Number(extra.reconnectDelayMs || 0) || 0,
              }
            : {},
          endedAt: extra.endedAt || null,
        }, buildAihqRequestContext());
      } catch (e) {
        dlog("syncState failed", e?.message || e);
      }
    }

    async function syncOperatorJoin(extra = {}) {
      try {
        if (!aihqVoiceClient.canUse()) return;
        if (!callSid) return;

        await aihqVoiceClient.markOperatorJoin({
          providerCallSid: callSid,
          operatorUserId: s(extra.operatorUserId || core?.state?.operatorUserId) || null,
          operatorName: s(extra.operatorName || core?.state?.operatorName) || null,
          operatorJoinMode: s(extra.operatorJoinMode || "live"),
          takeoverActive: !!extra.takeoverActive,
          botActive:
            typeof extra.botActive === "boolean" ? extra.botActive : false,
          operatorJoinedAt: new Date().toISOString(),
        }, buildAihqRequestContext());
      } catch (e) {
        dlog("syncOperatorJoin failed", e?.message || e);
      }
    }

    async function syncLiveLifecycleStage(stage = "") {
      const liveStage = s(stage);
      if (!liveStage || !callSid) return;

      if (liveStage === "media_stream_active" && mediaStreamActive) return;
      if (liveStage === "realtime_session_ready" && conversationEstablished) return;

      const sessionStatus =
        liveStage === "realtime_session_ready" ? "bot_active" : "bot_silent";
      const botActive = liveStage === "realtime_session_ready";

      if (liveStage === "media_stream_active") {
        mediaStreamActive = true;
      }

      if (liveStage === "realtime_session_ready") {
        mediaStreamActive = true;
        conversationEstablished = true;
      }

      await syncSessionUpsert({
        language: lastLang,
        callStatus: liveStage === "webhook_accepted" ? "queued" : "in_progress",
        sessionStatus,
        botActive,
        operatorJoinRequested: false,
        operatorJoined: false,
        whisperActive: false,
        takeoverActive: false,
        sessionMeta: {
          lifecycleStage: liveStage,
        },
      });

      await syncState(
        liveStage === "media_stream_active"
          ? "twilio_media_stream_started"
          : liveStage === "realtime_session_ready"
            ? "openai_session_ready"
            : "webhook_accepted",
        {
          status: sessionStatus,
          botActive,
          summary: buildLiveLifecycleSummary(liveStage),
        }
      );
    }

    async function finalizeCall({
      eventType,
      status,
      reasonCode = "",
      reportStatus = status,
      error = "",
      hangupCall = false,
      closeTwilio = true,
      closeRealtime = true,
    } = {}) {
      if (finalizationPromise) return finalizationPromise;

      const endedAt = new Date().toISOString();
      finalDisposition = {
        eventType: s(eventType, "call_finalized"),
        status: s(status, "failed"),
        reasonCode: s(reasonCode),
        reportStatus: s(reportStatus || status),
        endedAt,
      };

      const terminalDisposition = buildTerminalDisposition({
        eventType: finalDisposition.eventType,
        status: finalDisposition.status,
        reasonCode: finalDisposition.reasonCode,
        localHangupRequested,
        transferHandoffCompleted,
        requestedDepartment: s(core?.state?.requestedDepartment),
        resolvedDepartment: s(core?.state?.resolvedDepartment),
      });
      finalDisposition = {
        ...finalDisposition,
        ...terminalDisposition,
      };

      if (finalDisposition.status === "failed") {
        recordRuntimeSignal({
          level: "warn",
          category: "realtime_bridge",
          code: finalDisposition.eventType,
          reasonCode: finalDisposition.reasonCode || finalDisposition.eventType,
          status: 500,
          callSid,
          tenantKey,
          error: s(error).slice(0, 240),
        });
      }

      finalizationPromise = (async () => {
        clearTimers();
        setPending(false);
        assistantSpeaking = false;
        markGreetingEnd();
        const transcriptDisposition =
          buildTerminalTranscriptDisposition(finalDisposition);

        if (transcriptDisposition.shouldPersist) {
          await syncTranscript(
            transcriptDisposition.role,
            transcriptDisposition.text
          );
        }

        await syncSessionUpsert({
          callStatus: finalDisposition.status,
          sessionStatus: finalDisposition.status,
          botActive: false,
          operatorJoinRequested: finalDisposition.handoffRequested,
          operatorJoined: finalDisposition.handoffCompleted,
          whisperActive: false,
          takeoverActive: false,
          handoffRequested: finalDisposition.handoffRequested,
          handoffCompleted: finalDisposition.handoffCompleted,
          handoffTarget: finalDisposition.handoffTarget || null,
          outcome: finalDisposition.callOutcome,
          summary: finalDisposition.summary,
          endedAt,
          meta: {
            terminalOutcomeClass: finalDisposition.terminalOutcomeClass,
            terminalEventType: finalDisposition.eventType,
            terminalReasonCode:
              finalDisposition.reasonCode || finalDisposition.eventType,
            transcriptTruthClass: transcriptDisposition.truthClass,
          },
          sessionMeta: {
            lifecycleStage: "call_ended",
            terminalOutcomeClass: finalDisposition.terminalOutcomeClass,
            terminalEventType: finalDisposition.eventType,
            terminalReasonCode:
              finalDisposition.reasonCode || finalDisposition.eventType,
            transcriptTruthClass: transcriptDisposition.truthClass,
          },
        });

        await syncState(finalDisposition.eventType, {
          status: finalDisposition.status,
          botActive: false,
          operatorJoinRequested: finalDisposition.handoffRequested,
          operatorJoined: finalDisposition.handoffCompleted,
          resolvedDepartment: finalDisposition.handoffTarget || null,
          summary: finalDisposition.summary,
          callMeta: {
            terminalOutcomeClass: finalDisposition.terminalOutcomeClass,
            terminalOutcome: finalDisposition.callOutcome,
            terminalEventType: finalDisposition.eventType,
            terminalReasonCode:
              finalDisposition.reasonCode || finalDisposition.eventType,
            handoffRequested: finalDisposition.handoffRequested,
            handoffCompleted: finalDisposition.handoffCompleted,
            handoffTarget: finalDisposition.handoffTarget || null,
            transcriptTruthClass: transcriptDisposition.truthClass,
          },
          endedAt,
        });

        await reporters?.sendReports?.(
          core.getReportCtx(durationSec, { metricResponses, metricCancels }),
          { status: finalDisposition.reportStatus }
        );

        if (hangupCall) {
          await hangupNowFn();
        }

        if (closeRealtime) closeOpenAI();

        if (closeTwilio) {
          try {
            if (twilioWs.readyState === WebSocket.OPEN) twilioWs.close();
          } catch {}
        }
      })().finally(() => {
        clearTimers();
      });

      return finalizationPromise;
    }

    async function recordReconnectLifecycle({
      eventType,
      reasonCode,
      attempt = 0,
      maxAttempts = 0,
      delayMs = 0,
      recovered = false,
      error = "",
    } = {}) {
      const safeAttempt = Math.max(0, Number(attempt || 0));
      const safeMaxAttempts = Math.max(0, Number(maxAttempts || 0));
      const safeDelayMs = Math.max(0, Number(delayMs || 0));
      const summary = recovered
        ? `Realtime upstream recovered on attempt ${safeAttempt}.`
        : `Realtime upstream disconnected; reconnect attempt ${safeAttempt} of ${safeMaxAttempts} scheduled in ${safeDelayMs}ms.`;

      if (recovered) {
        incrementRuntimeMetric("voice_openai_reconnect_recoveries_total");
      } else {
        incrementRuntimeMetric("voice_openai_reconnect_attempts_total");
      }

      recordRuntimeSignal({
        level: recovered ? "info" : "warn",
        category: "realtime_bridge",
        code: s(eventType),
        reasonCode: s(reasonCode),
        status: recovered ? 200 : 503,
        callSid,
        tenantKey,
        error: s(error).slice(0, 240),
      });

      await syncState(eventType, {
        status: recovered ? "bot_active" : "bot_silent",
        summary,
        botActive: recovered,
        reconnectAttempt: safeAttempt,
        reconnectMax: safeMaxAttempts,
        reconnectDelayMs: safeDelayMs,
      });
    }

    async function redirectToTransfer() {
      if (!twilioClient || !callSid) return false;

      const base = String(PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
      if (!base.startsWith("http")) return false;

      const department = encodeURIComponent(
        s(core?.state?.resolvedDepartment || core?.state?.requestedDepartment || "")
      );
      const lang = encodeURIComponent(
        s(core?.state?.lastLang || lastLang || detectDefaultLang(tenantConfig))
      );

      const url = `${base}/twilio/transfer?department=${department}&lang=${lang}`;

      try {
        await twilioClient.calls(callSid).update({
          url,
          method: "POST",
        });

        transferHandoffCompleted = true;

        await syncState("transfer_redirected", {
          status: "agent_ringing",
          requestedDepartment: s(core?.state?.requestedDepartment),
          resolvedDepartment: s(core?.state?.resolvedDepartment),
          operatorJoinRequested: true,
          operatorJoined: false,
          botActive: true,
        });

        return true;
      } catch (e) {
        logger.warn("voice.bridge.transfer_redirect_failed", {
          callSid,
          streamSid,
          tenantKey,
          error: e?.message || e,
        });
        return false;
      }
    }

    function currentGreeting() {
      const langForGreeting = detectDefaultLang(tenantConfig);
      return getGreeting(langForGreeting, tenantConfig);
    }

    function currentInstructions() {
      const extra = s(tenantConfig?.realtime?.instructions);
      const businessContext = s(tenantConfig?.businessContext);

      let base = buildStrictInstructions(tenantConfig);

      if (businessContext) {
        base += `\nTenant business context: ${businessContext}`;
      }

      if (extra) {
        base += `\nTenant extra instructions:\n${extra}`;
      }

      return base;
    }

    function sendResponse(instructions, { temperature = 0.6, maxTokens = 140 } = {}) {
      if (!canSendToOpenAI()) return false;
      if (pendingResponse) return false;

      setPending(true);
      metricResponses += 1;

      try {
        openaiWs.send(
          JSON.stringify({
            type: "response.create",
            response: {
              modalities: RESPONSE_MODALITIES,
              temperature: rtTemp(temperature),
              max_output_tokens: maxTokens,
              instructions,
            },
          })
        );
        return true;
      } catch {
        setPending(false);
        return false;
      }
    }

    const core = createRealtimeCore({
      sendResponse,
      scheduleForceHangup,
      hangupNow: hangupNowFn,
      redirectToTransfer,
      reporters,
      tenantConfig,
      MIN_TRANSCRIPT_CHARS,
      MIN_SPEECH_CHUNKS,
      ASSISTANT_COOLDOWN_MS,
      MISHEARD_COOLDOWN_MS,
      GREETING_PROTECT_MS,
    });

    function greetingProtected() {
      const now = Date.now();
      if (greetingInProgress && now - greetingStartedAt < GREETING_PROTECT_MS) return true;

      try {
        if (core?.isGreetingProtectedNow?.()) return true;
      } catch {}

      return false;
    }

    function cancelAssistantIfSpeakingDelayed() {
      if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) return;
      if (!assistantSpeaking && !pendingResponse) return;

      const startAt = Date.now();

      setTimeout(() => {
        if (greetingProtected()) return;
        if (inboundChunkCount < 4 && Date.now() - startAt < 350) return;

        try {
          openaiWs.send(JSON.stringify({ type: "response.cancel" }));
          metricCancels += 1;
        } catch {}

        assistantSpeaking = false;
        setPending(false);
      }, 220);
    }

    function markGreetingStart() {
      greetingInProgress = true;
      greetingStartedAt = Date.now();

      try {
        core?.markGreetingStarted?.(lastLang || detectDefaultLang(tenantConfig));
      } catch {}
    }

    function markGreetingEnd() {
      greetingInProgress = false;

      try {
        core?.markGreetingFinished?.();
      } catch {}
    }

    function maybeSendGreeting() {
      if (greeted) return;
      if (!streamSid) return;
      if (!canSendToOpenAI()) return;
      if (pendingResponse) return;

      greeted = true;
      markGreetingStart();
      setPending(true);
      metricResponses += 1;

      const greeting = currentGreeting();
      const greetingLang = detectDefaultLang(tenantConfig);

      try {
        openaiWs.send(
          JSON.stringify({
            type: "response.create",
            response: {
              modalities: RESPONSE_MODALITIES,
              temperature: rtTemp(0.62),
              max_output_tokens: 240,
              instructions:
                `Say EXACTLY this full sentence in ${greetingLang}, smoothly, without stopping mid-sentence: "${greeting}" ` +
                `Then STOP completely and wait for the user. Do not add anything else.`,
            },
          })
        );
      } catch {
        setPending(false);
        markGreetingEnd();
        return;
      }

      const t = setTimeout(() => {
        if (greetingInProgress && Date.now() - greetingStartedAt > GREETING_PROTECT_MS + 1200) {
          markGreetingEnd();
          setPending(false);
        }
      }, GREETING_PROTECT_MS + 1600);

      try {
        t.unref?.();
      } catch {}
    }

    function canRespondThisTurn() {
      if (!sawSpeechStart) return false;
      if (respondedTurnId === turnId) return false;
      if (!greeted) return false;
      if (pendingResponse) return false;
      return true;
    }

    function respondOnceFromLatestTranscript() {
      if (!canRespondThisTurn()) return;

      const t = String(lastFinalTranscript || "").trim();
      respondedTurnId = turnId;
      flushAudioQueueToOpenAI();

      if (t) {
        setTimeout(() => {
          try {
            core.respondFromTranscript(t, {
              getDurationSec: durationSec,
              metrics: { metricResponses, metricCancels },
            });
          } catch {}
        }, RESPOND_AFTER_STOP_DELAY_MS);
      } else {
        core.state.inboundChunkCount = inboundChunkCount;
        try {
          core.maybeMisheard(lastLang || detectDefaultLang(tenantConfig));
        } catch {}
      }

      sawSpeechStart = false;
      inboundChunkCount = 0;
    }

    watchdog = setInterval(() => {
      if (!pendingResponse) return;

      if (Date.now() - pendingSince > WATCHDOG_MS) {
        dlog("watchdog reset pending");
        setPending(false);
        assistantSpeaking = false;

        if (greetingInProgress && Date.now() - greetingStartedAt > GREETING_PROTECT_MS + 1600) {
          markGreetingEnd();
        }
      }
    }, 1000);

    silenceTimer = setInterval(() => {
      if (!canSendToOpenAI()) return;
      if (!greeted) return;
      if (!sawSpeechStart) return;
      if (pendingResponse) return;

      const now = Date.now();
      if (!lastInboundAt) return;

      const silentFor = now - lastInboundAt;
      if (silentFor < SILENCE_MS) return;

      respondOnceFromLatestTranscript();
    }, 250);

    function openOpenAI() {
      reconnectAttempts += 1;
      openaiSessionReady = false;

      const model = s(tenantConfig?.realtime?.model) || REALTIME_MODEL;
      const voice = s(tenantConfig?.realtime?.voice) || REALTIME_VOICE;

      logger.info("voice.bridge.openai.connecting", {
        attempt: reconnectAttempts,
        model,
        voice,
        tenantKey,
        callSid,
      });

      openaiWs = new WebSocketImpl(
        `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "OpenAI-Beta": "realtime=v1",
          },
        }
      );

      openaiWs.on("open", () => {
        logger.info("voice.bridge.openai.connected", { callSid, streamSid, tenantKey });

        try {
          openaiWs.send(
            JSON.stringify({
              type: "session.update",
              session: {
                voice,
                instructions: currentInstructions(),
                input_audio_format: "g711_ulaw",
                output_audio_format: "g711_ulaw",
                turn_detection: {
                  type: "server_vad",
                  silence_duration_ms: VAD_SILENCE_MS,
                  prefix_padding_ms: VAD_PREFIX_MS,
                },
                input_audio_transcription: { model: "gpt-4o-mini-transcribe" },
              },
            })
          );
        } catch (e) {
          logger.warn("voice.bridge.openai.session_update_failed", {
            callSid,
            streamSid,
            tenantKey,
            error: e?.message || e,
          });
        }
      });

      openaiWs.on("message", async (buf) => {
        const msg = safeJsonParse(buf.toString("utf8")) || null;
        if (!msg || typeof msg !== "object") return;

        if (msg.type === "session.created" || msg.type === "session.updated") {
          logger.info("voice.bridge.openai.session_ready", {
            type: msg.type,
            callSid,
            streamSid,
            tenantKey,
          });

          openaiSessionReady = true;
          setPending(false);
          assistantSpeaking = false;
          await syncLiveLifecycleStage("realtime_session_ready");
          if (reconnectAttempts > 1) {
            await recordReconnectLifecycle({
              eventType: "openai_reconnected",
              reasonCode: "openai_reconnect_recovered",
              attempt: reconnectAttempts,
              maxAttempts: RECONNECT_MAX,
              recovered: true,
            });
          }
          flushAudioQueueToOpenAI();
          setTimeout(() => maybeSendGreeting(), 220);
          return;
        }

        if (msg.type === "error") {
          const errorMessage = msg?.error?.message || JSON.stringify(msg?.error || msg);
          logger.warn("voice.bridge.openai.error_event", {
            callSid,
            streamSid,
            tenantKey,
            error: errorMessage,
          });
          setPending(false);
          assistantSpeaking = false;
          markGreetingEnd();
          if (!openaiSessionReady) {
            await finalizeCall({
              eventType: "openai_session_error",
              status: "failed",
              reasonCode: "openai_session_error",
              error: errorMessage,
              closeTwilio: true,
              closeRealtime: false,
            });
          }
          return;
        }

        if (msg.type === "input_audio_buffer.speech_started") {
          turnId += 1;
          respondedTurnId = -1;

          sawSpeechStart = true;
          inboundChunkCount = 0;
          lastFinalTranscript = "";

          if (!greetingProtected()) {
            cancelAssistantIfSpeakingDelayed();
          }

          return;
        }

        if (msg.type === "input_audio_buffer.speech_stopped") {
          if (!sawSpeechStart) return;
          respondOnceFromLatestTranscript();
          return;
        }

        const typ = String(msg.type || "");
        const isTranscript =
          typ === "input_audio_transcription.completed" ||
          typ === "input_audio_transcription.final" ||
          typ.endsWith(".input_audio_transcription.completed") ||
          typ.endsWith(".input_audio_transcription.final");

        if (isTranscript) {
          const text = String(msg.transcript || msg.text || "").trim();

          if (text) {
            lastFinalTranscript = text;
            core.pushTranscript(text);
            lastLang = core.state.lastLang || detectLang(text) || detectDefaultLang(tenantConfig);
            dlog("transcript", text);
            syncTranscript("customer", text).catch(() => {});
          }

          return;
        }

        if (
          (msg.type === "response.audio.delta" && msg.delta) ||
          (msg.type === "response.output_audio.delta" && msg.delta)
        ) {
          assistantSpeaking = true;
          lastAssistantAudioAt = Date.now();
          core.state.lastAssistantAudioAt = lastAssistantAudioAt;
          sendTwilioMedia(twilioWs, streamSid, msg.delta);
          return;
        }

        if (msg.type === "response.done") {
          setPending(false);
          assistantSpeaking = false;

          if (greetingInProgress) markGreetingEnd();

          if (hangupAfterDone || core.state.hangupAfterDone) {
            hangupAfterDone = false;
            core.state.hangupAfterDone = false;

            try {
              if (forceHangupTimer) clearTimeout(forceHangupTimer);
            } catch {}

            forceHangupTimer = null;
            localHangupRequested = true;

            await finalizeCall({
              eventType: "call_completed_local_hangup",
              status: "completed",
              reasonCode: "local_hangup_requested",
              hangupCall: true,
              closeTwilio: true,
              closeRealtime: true,
            });
            return;
          }

          if (core.state.transferArmed) {
            core.state.transferArmed = false;

            const joinMode = s(core?.state?.operatorJoinMode || "live").toLowerCase();
            await syncState("operator_join_requested", {
              status: "agent_ringing",
              operatorJoinRequested: true,
              operatorJoined: false,
              operatorJoinMode: joinMode,
              requestedDepartment: s(core?.state?.requestedDepartment),
              resolvedDepartment: s(core?.state?.resolvedDepartment),
              botActive: true,
            });

            const ok = await redirectToTransfer();

            if (!ok) {
              const isAzCaller = callerLikelyAZ(fromNumber);
              const contact = buildContactReply(
                core.state.lastLang || detectDefaultLang(tenantConfig),
                isAzCaller,
                tenantConfig
              );
              const prefix = buildTransferUnavailablePrefix(
                core.state.lastLang || detectDefaultLang(tenantConfig)
              );

              sendResponse(
                `Say this in user's language as ONE sentence: "${prefix} ${contact}" Then stop.`,
                { temperature: 0.6, maxTokens: 120 }
              );

              await syncState("transfer_redirect_failed", {
                status: "bot_active",
                operatorJoinRequested: false,
                operatorJoined: false,
                botActive: true,
              });
            } else {
              await syncOperatorJoin({
                operatorJoinMode: joinMode,
                botActive: joinMode !== "live",
                takeoverActive: joinMode === "live",
              });
            }
          }
        }
      });

      openaiWs.on("close", async (code, reasonBuf) => {
        const reason =
          Buffer.isBuffer(reasonBuf) ? reasonBuf.toString("utf8") : String(reasonBuf || "");

        logger.warn("voice.bridge.openai.closed", {
          code,
          reason,
          callSid,
          streamSid,
          reconnectAttempts,
          tenantKey,
        });

        openaiSessionReady = false;
        setPending(false);
        assistantSpeaking = false;
        markGreetingEnd();

        const twilioAlive = twilioWs && twilioWs.readyState === WebSocket.OPEN;

        if (finalizationPromise) return;

        if (twilioAlive && reconnectAttempts <= RECONNECT_MAX) {
          const wait = 700 * reconnectAttempts;
          await recordReconnectLifecycle({
            eventType: "openai_reconnect_scheduled",
            reasonCode: "openai_ws_closed_retrying",
            attempt: reconnectAttempts,
            maxAttempts: RECONNECT_MAX,
            delayMs: wait,
            error: reason,
          });

          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            try {
              openOpenAI();
            } catch {
              closeBoth();
            }
          }, wait);

          try {
            reconnectTimer.unref?.();
          } catch {}

          return;
        }

        await finalizeCall({
          eventType:
            reconnectAttempts > RECONNECT_MAX ? "openai_reconnect_exhausted" : "openai_ws_closed",
          status: "failed",
          reasonCode:
            reconnectAttempts > RECONNECT_MAX ? "openai_reconnect_exhausted" : "openai_ws_closed",
          error: reason,
          closeTwilio: twilioAlive,
          closeRealtime: false,
        });
      });

      openaiWs.on("error", (e) => {
        openaiSessionReady = false;
        setPending(false);
        assistantSpeaking = false;
        markGreetingEnd();
        logger.warn("voice.bridge.openai.socket_error", {
          callSid,
          streamSid,
          tenantKey,
          error: e?.message || e,
        });
      });
    }

    twilioWs.on("message", async (buf) => {
      const msg = safeJsonParse(buf.toString("utf8"));
      if (!msg) return;

      if (msg.event === "start") {
        streamSid = msg.start?.streamSid || msg.streamSid || null;
        callSid = msg.start?.callSid || null;
        fromNumber = msg.start?.customParameters?.From || msg.start?.from || null;
        toNumber = msg.start?.customParameters?.To || null;
        tenantKey = msg.start?.customParameters?.TenantKey || null;

        logger.info("voice.bridge.twilio.start", {
          streamSid,
          callSid,
          from: fromNumber,
          to: toNumber,
          tenantKey,
        });

        const tenantConfigResult = await resolveTenantConfig({
          tenant: {
            tenantKey,
            toNumber,
            matchedBy: tenantKey ? "tenantKey" : "toNumber",
          },
          logger,
        });

        setPending(false);
        assistantSpeaking = false;
        lastAssistantAudioAt = 0;

        inboundChunkCount = 0;
        metricInboundChunks = 0;
        metricResponses = 0;
        metricCancels = 0;
        metricStartedAt = Date.now();

        audioQueue.length = 0;

        greeted = false;
        greetingInProgress = false;
        greetingStartedAt = 0;
        hangupAfterDone = false;
        localHangupRequested = false;
        stopReceived = false;
        transferHandoffCompleted = false;
        finalizationPromise = null;
        finalDisposition = null;

        lastFinalTranscript = "";
        lastLang = "en";
        sawSpeechStart = false;
        lastInboundAt = 0;

        turnId = 0;
        respondedTurnId = -1;
        reconnectAttempts = 0;
        mediaStreamActive = false;
        conversationEstablished = false;

        const tenantResolution = normalizeBridgeTenantConfigResult(tenantConfigResult);
        if (!tenantResolution.ok) {
          logger.warn("voice.bridge.tenant_config_unavailable", {
            callSid,
            streamSid,
            tenantKey,
            toNumber,
            error: tenantResolution.error,
            authority: tenantResolution.authority || null,
          });

          await finalizeCall({
            eventType: "call_failed_tenant_config_unavailable",
            status: "failed",
            reasonCode: tenantResolution.error,
            error: tenantResolution.error,
            closeTwilio: true,
            closeRealtime: false,
          });
          return;
        }

        tenantConfig = tenantResolution.config;
        core.setTenantConfig(tenantConfig);
        lastLang = detectDefaultLang(tenantConfig);

        core.resetForNewCall({ callSid, fromNumber, tenantConfig });

        await syncLiveLifecycleStage("media_stream_active");

        if (!OPENAI_API_KEY) {
          logger.error("voice.bridge.openai.misconfigured", null, {
            callSid,
            streamSid,
            tenantKey,
          });

          await finalizeCall({
            eventType: "call_failed_missing_openai",
            status: "failed",
            reasonCode: "openai_auth_not_configured",
            closeTwilio: true,
            closeRealtime: false,
          });
          return;
        }

        openOpenAI();
        return;
      }

      if (msg.event === "media") {
        const payload = msg.media?.payload;
        if (!payload) return;

        const track = String(msg.media?.track || "").toLowerCase();
        if (track && track !== "inbound") return;

        lastInboundAt = Date.now();

        if (assistantSpeaking && Date.now() - lastAssistantAudioAt < ECHO_GUARD_MS) return;

        inboundChunkCount += 1;
        metricInboundChunks += 1;
        core.state.inboundChunkCount = inboundChunkCount;

        audioQueue.push(payload);
        while (audioQueue.length > AUDIO_BUFFER_MAX) audioQueue.shift();

        if (canSendToOpenAI()) flushAudioQueueToOpenAI();
        return;
      }

      if (msg.event === "stop") {
        logger.info("voice.bridge.twilio.stop", { callSid, streamSid, tenantKey });
        stopReceived = true;
        const stopOutcome = deriveTwilioCloseOutcome({
          stopReceived: true,
          localHangupRequested,
          transferHandoffCompleted,
        });
        await finalizeCall({
          eventType: stopOutcome.eventType,
          status: stopOutcome.status,
          reasonCode: stopOutcome.reasonCode,
          closeTwilio: true,
          closeRealtime: true,
        });
      }
    });

    twilioWs.on("close", async (code, reasonBuf) => {
      const reason =
        Buffer.isBuffer(reasonBuf) ? reasonBuf.toString("utf8") : String(reasonBuf || "");

      logger.info("voice.bridge.twilio.closed", {
        code,
        reason,
        callSid,
        streamSid,
        tenantKey,
      });

      if (finalizationPromise) {
        await finalizationPromise;
        closeOpenAI();
        clearTimers();
        return;
      }

      const closeOutcome = deriveTwilioCloseOutcome({
        stopReceived,
        localHangupRequested,
        transferHandoffCompleted,
      });

      await finalizeCall({
        eventType: closeOutcome.eventType,
        status: closeOutcome.status,
        reasonCode: closeOutcome.reasonCode,
        error: reason,
        closeTwilio: false,
        closeRealtime: true,
      });
    });

    twilioWs.on("error", async (e) => {
      logger.warn("voice.bridge.twilio.socket_error", {
        callSid,
        streamSid,
        tenantKey,
        error: e?.message || e,
      });

      await finalizeCall({
        eventType: "twilio_ws_error",
        status: "failed",
        reasonCode: "twilio_ws_error",
        error: e?.message || e,
        closeTwilio: false,
        closeRealtime: true,
      });
    });
  });
}

export const __test__ = {
  buildTerminalDisposition,
  buildTerminalTranscriptDisposition,
  normalizeBridgeTenantConfigResult,
  deriveTwilioCloseOutcome,
};
