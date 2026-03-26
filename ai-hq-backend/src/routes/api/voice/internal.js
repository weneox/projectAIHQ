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
    const logger = req.log?.child?.({
      component: "voice-internal-routes",
      route: "tenant-config",
    });
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
      logger?.error("voice.internal.tenant_config.failed", err);
      return res.status(500).json({ ok: false, error: "voice_tenant_config_failed" });
    }
  });

  r.post("/internal/voice/session/upsert", requireInternalToken, async (req, res) => {
    const logger = req.log?.child?.({
      component: "voice-internal-routes",
      route: "session-upsert",
    });
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
      logger?.error("voice.internal.session_upsert.failed", err);
      return res.status(500).json({ ok: false, error: "voice_session_upsert_failed" });
    }
  });

  r.post("/internal/voice/session/transcript", requireInternalToken, async (req, res) => {
    const logger = req.log?.child?.({
      component: "voice-internal-routes",
      route: "session-transcript",
    });
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
      logger?.error("voice.internal.session_transcript.failed", err);
      return res.status(500).json({ ok: false, error: "voice_transcript_append_failed" });
    }
  });

  r.post("/internal/voice/session/state", requireInternalToken, async (req, res) => {
    const logger = req.log?.child?.({
      component: "voice-internal-routes",
      route: "session-state",
    });
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
      logger?.error("voice.internal.session_state.failed", err);
      return res.status(500).json({ ok: false, error: "voice_session_state_update_failed" });
    }
  });

  r.post("/internal/voice/session/operator-join", requireInternalToken, async (req, res) => {
    const logger = req.log?.child?.({
      component: "voice-internal-routes",
      route: "operator-join",
    });
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
      logger?.error("voice.internal.operator_join.failed", err);
      return res.status(500).json({ ok: false, error: "voice_operator_join_update_failed" });
    }
  });

  r.post("/internal/voice/report", requireInternalToken, async (req, res) => {
    const logger = req.log?.child?.({
      component: "voice-internal-routes",
      route: "report",
    });
    try {
      return writeResult(res, await processVoiceReportPing());
    } catch (err) {
      logger?.error("voice.internal.report.failed", err);
      return res.status(500).json({ ok: false, error: "voice_report_failed" });
    }
  });

  return r;
}
