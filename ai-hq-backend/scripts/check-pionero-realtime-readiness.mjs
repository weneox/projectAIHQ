#!/usr/bin/env node

import {
  evaluatePioneroRealtimeReadinessGuard,
} from "../src/modules/voice/pionero/pioneroRealtimeReadinessGuard.js";

const VERSION = "pionero_realtime_readiness_check.v1";

function s(value = "", fallback = "") {
  return String(value ?? "").trim() || fallback;
}

function truthy(value = "") {
  return ["1", "true", "yes", "on"].includes(s(value).toLowerCase());
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? Math.floor(next) : fallback;
}

function safeJsonParse(value = "") {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function readStatusFromUrl(url = "") {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      ...(process.env.PIONERO_REALTIME_STATUS_BEARER_TOKEN
        ? {
            authorization: `Bearer ${process.env.PIONERO_REALTIME_STATUS_BEARER_TOKEN}`,
          }
        : {}),
    },
  });

  const body = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      statusCode: response.status,
      body,
      reasonCode: "pionero_realtime_status_fetch_failed",
    };
  }

  return {
    ok: true,
    statusCode: response.status,
    body,
  };
}

function unwrapStatusPayload(payload = {}) {
  if (payload.realtimeReadiness && payload.status) {
    return payload;
  }

  if (payload.data && typeof payload.data === "object") {
    return payload.data;
  }

  if (payload.result && typeof payload.result === "object") {
    return payload.result;
  }

  return payload;
}

async function main() {
  const required = truthy(process.env.PIONERO_REALTIME_READINESS_REQUIRED);
  const statusJson = s(process.env.PIONERO_REALTIME_STATUS_JSON);
  const statusUrl = s(process.env.PIONERO_REALTIME_STATUS_URL);
  const allowPendingFirstAudio = truthy(
    process.env.PIONERO_REALTIME_ALLOW_PENDING_FIRST_AUDIO
  );
  const maxFirstAudioLatencyMs = n(
    process.env.PIONERO_REALTIME_MAX_FIRST_AUDIO_LATENCY_MS,
    1200
  );

  let source = "";
  let payload = null;

  if (statusJson) {
    source = "env_json";
    payload = safeJsonParse(statusJson);

    if (!payload) {
      const result = {
        version: VERSION,
        ok: false,
        required,
        source,
        reasonCode: "pionero_realtime_status_json_invalid",
      };
      console.log(JSON.stringify(result, null, 2));
      process.exit(1);
    }
  } else if (statusUrl) {
    source = "status_url";
    const fetched = await readStatusFromUrl(statusUrl);

    if (fetched.ok !== true) {
      const result = {
        version: VERSION,
        ok: false,
        required,
        source,
        statusCode: fetched.statusCode,
        reasonCode: fetched.reasonCode,
      };
      console.log(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    payload = fetched.body;
  } else {
    source = "skipped";
    const result = {
      version: VERSION,
      ok: required ? false : true,
      required,
      source,
      reasonCode: required
        ? "pionero_realtime_status_source_missing"
        : "pionero_realtime_readiness_not_required",
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  const status = unwrapStatusPayload(payload);
  const readiness = status.realtimeReadiness || evaluatePioneroRealtimeReadinessGuard(
    status,
    {
      allowPendingFirstAudio,
      maxFirstAudioLatencyMs,
    }
  );

  const result = {
    version: VERSION,
    ok: readiness.ok === true,
    required,
    source,
    roomName: s(status.roomName || readiness.roomName),
    mode: s(status.mode || readiness.mode),
    provider: s(status.provider || readiness.provider),
    readiness,
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.log(JSON.stringify({
    version: VERSION,
    ok: false,
    reasonCode: "pionero_realtime_readiness_check_failed",
    errorMessage: s(err?.message || err, "readiness check failed"),
  }, null, 2));
  process.exit(1);
});
