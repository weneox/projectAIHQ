import {
  getTenantVoiceSettings,
  listVoiceCalls,
} from "../../db/helpers/voice.js";
import { isLiveVoiceStatus, n, s } from "./shared.js";

export function buildEmptyVoiceOverview(extra = {}) {
  return {
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
    ...extra,
  };
}

export async function readVoiceOverview({
  db,
  tenantId,
  status = "",
  limit = 100,
} = {}) {
  const settings = await getTenantVoiceSettings(db, tenantId);
  const calls = await listVoiceCalls(db, {
    tenantId,
    status: s(status),
    limit: Math.max(1, Math.min(200, n(limit, 100))),
  });

  const liveCalls = calls.filter((x) =>
    isLiveVoiceStatus(x?.status || x?.callStatus || x?.call_status)
  ).length;

  const totalCalls = calls.length;
  const totalSeconds = calls.reduce(
    (sum, x) => sum + Number(x?.durationSec ?? x?.duration_sec ?? x?.duration ?? 0),
    0
  );
  const totalMinutes = Math.floor(totalSeconds / 60);
  const defaultLanguage = settings?.defaultLanguage || "en";

  return {
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
  };
}

export async function listTenantVoiceCalls({
  db,
  tenantId,
  status = "",
  limit = 50,
} = {}) {
  return listVoiceCalls(db, {
    tenantId,
    status: s(status),
    limit: Math.max(1, Math.min(200, n(limit, 50))),
  });
}
