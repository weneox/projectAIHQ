import { s } from "./bridge/shared.js";

export function detectDefaultLang(tenantConfig = null) {
  return s(
    tenantConfig?.voiceProfile?.defaultLanguage || tenantConfig?.defaultLanguage,
    "en"
  ).toLowerCase();
}

export function buildTransferUnavailablePrefix(lang) {
  const L = s(lang, "en").toLowerCase();

  if (L === "ru") return "Не удалось перевести звонок на оператора.";
  if (L === "tr") return "Operatöre yönlendirme mümkün olmadı.";
  if (L === "en") return "Operator transfer is not available right now.";
  if (L === "es") return "La transferencia al operador no está disponible en este momento.";
  if (L === "de") return "Die Weiterleitung zum Operator ist im Moment nicht verfügbar.";
  if (L === "fr") return "Le transfert vers un opérateur n’est pas disponible pour le moment.";
  return "Operatora yönləndirmə hazırda mümkün olmadı.";
}

export function buildConferenceName(tenantKey, callSid) {
  return `${s(tenantKey || "default")}:${s(callSid || "call")}`;
}

export function safeDebugValue(value) {
  if (typeof value === "string") return s(value);
  try {
    return s(JSON.stringify(value));
  } catch {
    return s(value);
  }
}

export function normalizeBridgeTenantConfigResult(result = null) {
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

export function deriveTwilioCloseOutcome({
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

export function buildInboundLifecycleMetadata() {
  return {
    direction: "inbound",
    sessionDirection: "inbound",
  };
}

export function buildLiveLifecycleSummary(stage = "") {
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

export function buildTerminalDisposition({
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

  if (event.startsWith("openai_") || reason.startsWith("openai_")) {
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

export function buildTerminalTranscriptDisposition(disposition = {}) {
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
