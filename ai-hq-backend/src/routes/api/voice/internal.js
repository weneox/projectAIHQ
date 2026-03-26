import express from "express";
import {
  validateVoiceOperatorJoinRequest,
  validateVoiceSessionStateRequest,
  validateVoiceSessionUpsertRequest,
  validateVoiceTenantConfigRequest,
  validateVoiceTranscriptRequest,
} from "@aihq/shared-contracts/critical";
import { requireInternalToken } from "./internalAuth.js";
import {
  processVoiceOperatorJoin,
  processVoiceReportPing,
  processVoiceSessionState,
  processVoiceSessionUpsert,
  processVoiceTenantConfig,
  processVoiceTranscript,
} from "../../../services/voiceInternalRuntime.js";
import { s } from "./shared.js";

function writeResult(res, result) {
  if (!result?.ok) {
    return res.status(result?.statusCode || 500).json({
      ok: false,
      error: result?.error || "voice_internal_failed",
      ...(result?.tenantKey ? { tenantKey: result.tenantKey } : {}),
      ...(result?.toNumber ? { toNumber: result.toNumber } : {}),
      ...(result?.details ? { details: result.details } : {}),
    });
  }

  return res.status(result.statusCode || 200).json(result.payload || { ok: true });
}

export function voiceInternalRoutes({ db }) {
  const r = express.Router();

  r.post("/internal/voice/tenant-config", requireInternalToken, async (req, res) => {
    try {
      const checked = validateVoiceTenantConfigRequest(req.body || {});
      if (!checked.ok) {
        return res.status(400).json({ ok: false, error: checked.error });
      }

      return writeResult(
        res,
        await processVoiceTenantConfig({
          db,
          tenantKey: checked.value.tenantKey,
          toNumber: checked.value.toNumber,
        })
      );
    } catch (err) {
      console.error("[voiceInternal/tenant-config] error:", err);
      return res.status(500).json({ ok: false, error: "voice_tenant_config_failed" });
    }
  });

  r.post("/internal/voice/session/upsert", requireInternalToken, async (req, res) => {
    try {
      if (!db?.query) {
        return res.status(503).json({ ok: false, error: "db_unavailable" });
      }

      const checked = validateVoiceSessionUpsertRequest(req.body || {});
      if (!checked.ok) {
        return res.status(400).json({ ok: false, error: checked.error });
      }

      return writeResult(
        res,
        await processVoiceSessionUpsert({
          db,
          body: checked.value.body,
        })
      );
    } catch (err) {
      console.error("[voiceInternal/session/upsert] error:", err);
      return res.status(500).json({ ok: false, error: "voice_session_upsert_failed" });
    }
  });

  r.post("/internal/voice/session/transcript", requireInternalToken, async (req, res) => {
    try {
      if (!db?.query) {
        return res.status(503).json({ ok: false, error: "db_unavailable" });
      }

      const checked = validateVoiceTranscriptRequest(req.body || {});
      if (!checked.ok) {
        return res.status(400).json({ ok: false, error: checked.error });
      }

      return writeResult(
        res,
        await processVoiceTranscript({
          db,
          providerCallSid: checked.value.providerCallSid,
          text: checked.value.text,
          role: checked.value.role,
          ts: s(req.body?.ts || new Date().toISOString()),
        })
      );
    } catch (err) {
      console.error("[voiceInternal/session/transcript] error:", err);
      return res.status(500).json({ ok: false, error: "voice_transcript_append_failed" });
    }
  });

  r.post("/internal/voice/session/state", requireInternalToken, async (req, res) => {
    try {
      if (!db?.query) {
        return res.status(503).json({ ok: false, error: "db_unavailable" });
      }

      const checked = validateVoiceSessionStateRequest(req.body || {});
      if (!checked.ok) {
        return res.status(400).json({ ok: false, error: checked.error });
      }

      return writeResult(
        res,
        await processVoiceSessionState({
          db,
          providerCallSid: checked.value.providerCallSid,
          body: checked.value.body,
        })
      );
    } catch (err) {
      console.error("[voiceInternal/session/state] error:", err);
      return res.status(500).json({ ok: false, error: "voice_session_state_update_failed" });
    }
  });

  r.post("/internal/voice/session/operator-join", requireInternalToken, async (req, res) => {
    try {
      if (!db?.query) {
        return res.status(503).json({ ok: false, error: "db_unavailable" });
      }

      const checked = validateVoiceOperatorJoinRequest(req.body || {});
      if (!checked.ok) {
        return res.status(400).json({ ok: false, error: checked.error });
      }

      return writeResult(
        res,
        await processVoiceOperatorJoin({
          db,
          providerCallSid: checked.value.providerCallSid,
          body: checked.value.body,
        })
      );
    } catch (err) {
      console.error("[voiceInternal/session/operator-join] error:", err);
      return res.status(500).json({ ok: false, error: "voice_operator_join_update_failed" });
    }
  });

  r.post("/internal/voice/report", requireInternalToken, async (_req, res) => {
    try {
      return writeResult(res, await processVoiceReportPing());
    } catch (err) {
      console.error("[voiceInternal/report] error:", err);
      return res.status(500).json({ ok: false, error: "voice_report_failed" });
    }
  });

  return r;
}
