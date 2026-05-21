const fs = require("fs");

const file = "ai-hq-backend/src/routes/api/voice/public.js";
let code = fs.readFileSync(file, "utf8");

if (!code.includes('import { randomUUID } from "crypto";')) {
  code = code.replace(
    `import express from "express";`,
    `import { randomUUID } from "crypto";
import express from "express";`
  );
}

if (!code.includes("  createVoiceCall,")) {
  code = code.replace(
    `  appendVoiceCallEvent,
  updateVoiceCall,`,
    `  appendVoiceCallEvent,
  createVoiceCall,
  updateVoiceCall,`
  );
}

code = code.replace(
  `      return { ok: false, reasonCode };
    }

    return {
      ok: true,
      config: readBrowserVoiceConfigPayload(result),
    };`,
  `      return { ok: false, reasonCode, scope };
    }

    return {
      ok: true,
      scope,
      config: readBrowserVoiceConfigPayload(result),
    };`
);

code = code.replace(
  `    return { ok: false, reasonCode: "browser_voice_runtime_resolution_failed" };
  }
}`,
  `    return { ok: false, scope, reasonCode: "browser_voice_runtime_resolution_failed" };
  }
}`
);

if (!code.includes("async function createBrowserVoiceCallRecord")) {
  const marker = `function pickBrowserVoiceName(value = "") {
  return normalizeBrowserVoiceName(value);
}

async function handleBrowserVoiceSession`;

  const helper = `function pickBrowserVoiceName(value = "") {
  return normalizeBrowserVoiceName(value);
}

async function createBrowserVoiceCallRecord({
  db,
  scope = null,
  req = null,
  model = "",
  voice = "",
  runtimeApplied = false,
  runtimeReasonCode = "",
  runtimeConfig = {},
} = {}) {
  if (!db?.query || !scope?.tenantId) return null;

  const providerCallSid = \`browser:\${randomUUID()}\`;
  const language = s(
    runtimeConfig?.defaultLanguage ||
      runtimeConfig?.voiceProfile?.defaultLanguage ||
      req?.body?.language ||
      "az"
  );

  const call = await createVoiceCall(db, {
    tenantId: scope.tenantId,
    tenantKey: scope.tenantKey,
    provider: "browser",
    providerCallSid,
    providerStreamSid: "",
    direction: "inbound",
    status: "in_progress",
    fromNumber: s(req?.body?.fromNumber || "browser_lab"),
    toNumber: s(req?.body?.toNumber || "browser"),
    callerName: s(req?.body?.callerName || "Browser test caller"),
    startedAt: new Date().toISOString(),
    answeredAt: new Date().toISOString(),
    language,
    agentMode: "assistant",
    outcome: "in_progress",
    intent: "browser_voice_test",
    summary: "Browser voice test session started.",
    metrics: {},
    extraction: {},
    meta: {
      source: "browser_voice_session",
      surface: "voice_lab",
      model: s(model),
      voice: s(voice),
      runtimeApplied: runtimeApplied === true,
      runtimeReasonCode: s(runtimeReasonCode),
    },
  });

  if (call?.id) {
    await appendVoiceCallEvent(db, {
      callId: call.id,
      tenantId: scope.tenantId,
      tenantKey: scope.tenantKey,
      eventType: "browser_voice.session_started",
      actor: "system",
      payload: {
        providerCallSid,
        model: s(model),
        voice: s(voice),
        runtimeApplied: runtimeApplied === true,
        runtimeReasonCode: s(runtimeReasonCode),
      },
    });
  }

  return call;
}

async function handleBrowserVoiceSession`;

  code = code.replace(marker, helper);
}

const upstreamOkMarker = `    if (!upstream.ok) {
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
      model,`;

if (code.includes(upstreamOkMarker) && !code.includes("const voiceCall = await createBrowserVoiceCallRecord")) {
  code = code.replace(
    upstreamOkMarker,
    `    if (!upstream.ok) {
      logger.warn("voice.browser.session.upstream_failed", {
        status: upstream.status,
        error: s(payload?.error?.message || payload?.error || payload?.raw).slice(0, 240),
      });
      return fail(res, upstream.status || 502, "browser_voice_session_failed", {
        status: upstream.status,
        message: s(payload?.error?.message || payload?.error || "OpenAI realtime session failed"),
      });
    }

    const voiceCall = await createBrowserVoiceCallRecord({
      db,
      scope: runtimeResolution?.scope,
      req,
      model,
      voice,
      runtimeApplied,
      runtimeReasonCode: runtimeApplied ? "" : s(runtimeResolution?.reasonCode),
      runtimeConfig,
    });

    return ok(res, {
      model,`
  );
}

if (!code.includes("callId: s(voiceCall?.id),")) {
  code = code.replace(
    `      openingResponse: browserSessionPlan.openingResponse,
    });`,
    `      openingResponse: browserSessionPlan.openingResponse,
      callId: s(voiceCall?.id),
      voiceCall: voiceCall
        ? {
            id: s(voiceCall.id),
            callId: s(voiceCall.id),
            provider: s(voiceCall.provider),
            providerCallSid: s(voiceCall.providerCallSid),
            status: s(voiceCall.status),
            outcome: s(voiceCall.outcome),
          }
        : null,
    });`
  );
}

fs.writeFileSync(file, code);

console.log("browser voice call record patch applied");
