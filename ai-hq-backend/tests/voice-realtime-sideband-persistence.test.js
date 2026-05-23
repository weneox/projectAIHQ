import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRealtimeSidebandToolResultTrace,
} from "../src/modules/voice/realtimeSidebandToolDispatcher.js";
import {
  normalizeRealtimeSidebandEvent,
} from "../src/modules/voice/realtimeSidebandEvents.js";
import {
  VOICE_REALTIME_SIDEBAND_PERSISTENCE_VERSION,
  buildRealtimeSidebandPersistedEventInput,
  buildRealtimeSidebandToolResultEventInput,
  hasPatchKeys,
  persistRealtimeSidebandTrace,
} from "../src/modules/voice/realtimeSidebandPersistence.js";

function target() {
  return {
    provider: "openai",
    transport: "webrtc",
    providerRealtimeCallId: "call_realtime_1",
  };
}

function call() {
  return {
    id: "voice-call-1",
  };
}

function scope() {
  return {
    tenantId: "tenant-1",
    tenantKey: "acme",
  };
}

test("builds persisted event input for normalized sideband transcript event", () => {
  const normalized = normalizeRealtimeSidebandEvent(
    {
      type: "conversation.item.input_audio_transcription.completed",
      transcript: "I need an appointment tomorrow.",
    },
    {
      target: target(),
    }
  );

  const input = buildRealtimeSidebandPersistedEventInput({
    normalized,
    call: call(),
    scope: scope(),
  });

  assert.equal(input.callId, "voice-call-1");
  assert.equal(input.tenantId, "tenant-1");
  assert.equal(input.tenantKey, "acme");
  assert.equal(input.eventType, "voice.sideband.transcript.final");
  assert.equal(input.actor, "caller");
  assert.equal(
    input.payload.sidebandPersistenceVersion,
    VOICE_REALTIME_SIDEBAND_PERSISTENCE_VERSION
  );
  assert.equal(input.payload.realtimeType, "conversation.item.input_audio_transcription.completed");
  assert.equal(input.payload.providerRealtimeCallId, "call_realtime_1");
  assert.equal(input.payload.transcript.text, "I need an appointment tomorrow.");
});

test("builds persisted event input for normalized sideband tool_call event", () => {
  const normalized = normalizeRealtimeSidebandEvent(
    {
      type: "response.function_call_arguments.done",
      call_id: "tool-call-1",
      name: "create_appointment_request",
      arguments: "{\"service\":\"Dental consultation\"}",
    },
    {
      target: target(),
    }
  );

  const input = buildRealtimeSidebandPersistedEventInput({
    normalized,
    call: call(),
    scope: scope(),
  });

  assert.equal(input.eventType, "voice.sideband.tool_call");
  assert.equal(input.actor, "assistant");
  assert.equal(input.payload.realtimeType, "response.function_call_arguments.done");
  assert.equal(input.payload.providerRealtimeCallId, "call_realtime_1");
  assert.equal(input.payload.toolCall.id, "tool-call-1");
  assert.equal(input.payload.toolCall.name, "create_appointment_request");
  assert.equal(input.payload.toolCall.arguments.service, "Dental consultation");
});

test("builds tool result persisted event input from dispatcher resultTrace", () => {
  const normalized = normalizeRealtimeSidebandEvent(
    {
      type: "response.function_call_arguments.done",
      call_id: "tool-call-2",
      name: "create_appointment_request",
      arguments: "{\"service\":\"Dental consultation\"}",
    },
    {
      target: target(),
    }
  );

  const resultTrace = buildRealtimeSidebandToolResultTrace({
    normalized,
    toolCall: normalized.toolCall,
    result: {
      status: "missing_required_fields",
      missingRequired: ["date"],
      nextMissing: {
        field: "date",
      },
      nextPromptHint: {
        field: "date",
        label: "date",
      },
      voiceState: {
        complete: false,
      },
    },
  });

  const input = buildRealtimeSidebandToolResultEventInput({
    resultTrace,
    call: call(),
    scope: scope(),
  });

  assert.equal(input.callId, "voice-call-1");
  assert.equal(input.eventType, "voice.sideband.tool_result");
  assert.equal(input.actor, "system");
  assert.equal(
    input.payload.sidebandPersistenceVersion,
    VOICE_REALTIME_SIDEBAND_PERSISTENCE_VERSION
  );
  assert.equal(input.payload.resultStatus, "missing_required_fields");
  assert.equal(input.payload.assistantInstruction, undefined);
  assert.equal(input.payload.nextQuestion, undefined);
  assert.deepEqual(input.payload.missingRequired, ["date"]);
  assert.equal(input.payload.nextMissing.field, "date");
  assert.equal(input.payload.nextPromptHint.field, "date");
  assert.equal(input.payload.voiceState.complete, false);
});

test("persist appends normalized event only when resultTrace absent", async () => {
  const appended = [];
  const normalized = normalizeRealtimeSidebandEvent(
    {
      type: "response.output_text.done",
      text: "What date works for you?",
    },
    {
      target: target(),
    }
  );

  const result = await persistRealtimeSidebandTrace({
    db: {},
    call: call(),
    scope: scope(),
    normalized,
    appendEvent: async (db, input) => {
      appended.push(input);
      return { id: `event-${appended.length}`, ...input };
    },
    updateCall: async () => {
      throw new Error("updateCall should not be called");
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, false);
  assert.equal(result.events.length, 1);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].eventType, "voice.sideband.transcript.final");
  assert.equal(result.callPatchApplied, false);
  assert.equal(result.updatedCall, null);
});

test("persist appends normalized event and tool result event when resultTrace present", async () => {
  const appended = [];
  const normalized = normalizeRealtimeSidebandEvent(
    {
      type: "response.function_call_arguments.done",
      call_id: "tool-call-3",
      name: "create_handoff_request",
      arguments: "{\"reason\":\"operator\"}",
    },
    {
      target: target(),
    }
  );
  const resultTrace = buildRealtimeSidebandToolResultTrace({
    normalized,
    toolCall: normalized.toolCall,
    result: {
      status: "request_recorded",
    },
  });

  const result = await persistRealtimeSidebandTrace({
    db: {},
    call: call(),
    scope: scope(),
    normalized,
    resultTrace,
    appendEvent: async (db, input) => {
      appended.push(input);
      return { id: `event-${appended.length}`, ...input };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(appended.length, 2);
  assert.equal(appended[0].eventType, "voice.sideband.tool_call");
  assert.equal(appended[1].eventType, "voice.sideband.tool_result");
  assert.equal(result.events.length, 2);
});

test("persist applies callPatch through injected updateCall when patch has keys", async () => {
  const updates = [];
  const updated = {
    id: "voice-call-1",
    summary: "Updated summary",
  };

  const result = await persistRealtimeSidebandTrace({
    db: {},
    call: call(),
    scope: scope(),
    callPatch: {
      summary: "Updated summary",
    },
    appendEvent: async () => {
      throw new Error("appendEvent should not be called");
    },
    updateCall: async (db, callId, patch) => {
      updates.push({ callId, patch });
      return updated;
    },
  });

  assert.equal(hasPatchKeys({ summary: "Updated summary" }), true);
  assert.equal(result.callPatchApplied, true);
  assert.equal(result.updatedCall, updated);
  assert.deepEqual(updates, [
    {
      callId: "voice-call-1",
      patch: {
        summary: "Updated summary",
      },
    },
  ]);
});

test("persist does not call updateCall when callPatch is empty", async () => {
  let updateCount = 0;

  const result = await persistRealtimeSidebandTrace({
    db: {},
    call: call(),
    scope: scope(),
    callPatch: {},
    appendEvent: async () => {
      throw new Error("appendEvent should not be called");
    },
    updateCall: async () => {
      updateCount += 1;
    },
  });

  assert.equal(hasPatchKeys({}), false);
  assert.equal(updateCount, 0);
  assert.equal(result.callPatchApplied, false);
  assert.equal(result.updatedCall, null);
});

test("returns skipped result when db missing", async () => {
  const result = await persistRealtimeSidebandTrace({
    db: null,
    call: call(),
  });

  assert.deepEqual(result, {
    ok: false,
    skipped: true,
    reasonCode: "db_unavailable",
  });
});

test("returns skipped result when call id missing", async () => {
  const result = await persistRealtimeSidebandTrace({
    db: {},
    call: {},
  });

  assert.deepEqual(result, {
    ok: false,
    skipped: true,
    reasonCode: "voice_call_id_missing",
  });
});

test("does not throw when scope tenant fields are empty", async () => {
  const appended = [];
  const normalized = normalizeRealtimeSidebandEvent(
    {
      type: "response.output_text.done",
      text: "Sure, I can help.",
    },
    {
      target: target(),
    }
  );

  const result = await persistRealtimeSidebandTrace({
    db: {},
    call: call(),
    scope: {},
    normalized,
    appendEvent: async (db, input) => {
      appended.push(input);
      return { id: "event-empty-scope", ...input };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].tenantId, "");
  assert.equal(appended[0].tenantKey, "");
});
