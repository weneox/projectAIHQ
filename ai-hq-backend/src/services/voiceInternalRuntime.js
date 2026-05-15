import {
  buildVoiceConfigFromProjectedRuntime,
  upsertCallAndSession,
  appendVoiceEventStrict,
  emitVoiceMutationRealtime,
  runVoiceMutationTransaction,
  s,
  b,
  isObj,
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
  normalizedRuntimeTenantId,
  buildStableTenantScope,
  normalizeProjectedRuntimeForVoice,
  buildVoiceProjectedRuntime,
  loadTenantRowDirect,
  resolveVoiceTenantContext,
  processVoiceTenantConfig,
  appendVoiceConflictEvent,
  processVoiceSessionUpsert,
  processVoiceTranscript,
  processVoiceSessionState,
  processVoiceOperatorJoin,
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
import { buildOperationalChannels } from "./operationalChannels.js";
import { buildVoiceReplayPayload } from "./voiceReplayTrace.js";

export {
  processVoiceTenantConfig,
  processVoiceSessionUpsert,
  processVoiceTranscript,
  processVoiceSessionState,
  processVoiceOperatorJoin,
};

export async function processVoiceReportPing() {
  return buildVoiceInternalOkResult({
    ok: true,
    accepted: true,
  });
}
