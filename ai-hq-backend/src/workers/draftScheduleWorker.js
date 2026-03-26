import { createLogger } from "../utils/logger.js";
import {
  markWorkerStarted,
  markWorkerStopped,
  recordRuntimeSignal,
  touchWorkerHeartbeat,
} from "../observability/runtimeSignals.js";

// src/workers/draftScheduleWorker.js
//
// FINAL v2.0 — tenant-aware scheduler with new publish_policy structure
//
// ✅ Reads publish_policy.schedule.enabled
// ✅ Reads publish_policy.schedule.time ("HH:mm")
// ✅ Reads publish_policy.schedule.timezone
// ✅ Reads publish_policy.automation.enabled / mode
// ✅ Backward compatible with old draftSchedule.hour/minute
// ✅ Triggers n8n only when tenant is due
// ✅ Prevents duplicate same-minute firing per tenant
// ✅ Sends manual/full_auto mode in payload

function clean(x) {
  return String(x || "").trim();
}

function lower(x) {
  return clean(x).toLowerCase();
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function bool(v, fallback = false) {
  if (typeof v === "boolean") return v;
  return fallback;
}

function clampHour(v, fallback = 10) {
  const n = num(v, fallback);
  return Math.max(0, Math.min(23, n));
}

function clampMinute(v, fallback = 0) {
  const n = num(v, fallback);
  return Math.max(0, Math.min(59, n));
}

function pad2(v) {
  return String(Number(v || 0)).padStart(2, "0");
}

function normalizeTimeString(input, fallback = "10:00") {
  const raw = clean(input);
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(raw);
  if (!m) return fallback;

  const hh = clampHour(m[1], 10);
  const mm = clampMinute(m[2], 0);
  return `${pad2(hh)}:${pad2(mm)}`;
}

function parseTimeString(input, fallbackHour = 10, fallbackMinute = 0) {
  const safe = normalizeTimeString(input, `${pad2(fallbackHour)}:${pad2(fallbackMinute)}`);
  const [hh, mm] = safe.split(":");
  return {
    time: safe,
    hour: clampHour(hh, fallbackHour),
    minute: clampMinute(mm, fallbackMinute),
  };
}

function normalizeAutomationMode(v, fallback = "manual") {
  const x = lower(v || fallback);
  if (x === "full_auto") return "full_auto";
  return "manual";
}

function getWorkerConfig() {
  return {
    enabled: String(process.env.DRAFT_SCHEDULE_WORKER_ENABLED || "1") !== "0",
    intervalMs: Math.max(15_000, Number(process.env.DRAFT_SCHEDULE_WORKER_INTERVAL_MS || 60_000)),
    webhookUrl: clean(process.env.N8N_WEBHOOK_SCHEDULE_DRAFT_URL),
    webhookToken: clean(process.env.N8N_WEBHOOK_TOKEN || ""),
    defaultTimezone: clean(process.env.DEFAULT_TIMEZONE || "Asia/Baku"),
    defaultHour: clampHour(process.env.DAILY_PUBLISH_HOUR_LOCAL, 10),
    defaultMinute: clampMinute(process.env.DAILY_PUBLISH_MINUTE_LOCAL, 0),
  };
}

function getLocalClockParts(timeZone) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = fmt.formatToParts(new Date());
  const map = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  return {
    dateKey: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour || 0),
    minute: Number(map.minute || 0),
  };
}

function normalizeSchedule(row, cfg) {
  const publishPolicy = isObject(row?.publish_policy) ? row.publish_policy : {};

  const legacyDraftSchedule = isObject(publishPolicy?.draftSchedule)
    ? publishPolicy.draftSchedule
    : {};

  const rawSchedule = isObject(publishPolicy?.schedule)
    ? publishPolicy.schedule
    : {};

  const rawAutomation = isObject(publishPolicy?.automation)
    ? publishPolicy.automation
    : {};

  const legacyHour = clampHour(legacyDraftSchedule.hour, cfg.defaultHour);
  const legacyMinute = clampMinute(legacyDraftSchedule.minute, cfg.defaultMinute);

  const parsed = parseTimeString(
    rawSchedule.time,
    legacyHour,
    legacyMinute
  );

  const enabled =
    typeof rawSchedule.enabled === "boolean"
      ? rawSchedule.enabled
      : bool(legacyDraftSchedule.enabled, false);

  const timezone =
    clean(rawSchedule.timezone) ||
    clean(legacyDraftSchedule.timezone) ||
    clean(row?.timezone) ||
    cfg.defaultTimezone;

  const format = lower(legacyDraftSchedule.format || "image") || "image";

  const automationEnabled =
    typeof rawAutomation.enabled === "boolean"
      ? rawAutomation.enabled
      : normalizeAutomationMode(rawAutomation.mode, "manual") === "full_auto";

  const automationMode = normalizeAutomationMode(
    rawAutomation.mode,
    automationEnabled ? "full_auto" : "manual"
  );

  return {
    enabled,
    timezone,
    time: parsed.time,
    hour: parsed.hour,
    minute: parsed.minute,
    format,
    automation: {
      enabled: automationEnabled,
      mode: automationMode,
    },
  };
}

async function listTenantSchedules(db) {
  const q = await db.query(`
    select
      t.id,
      t.tenant_key,
      t.company_name,
      t.timezone,
      tap.publish_policy
    from tenants t
    left join tenant_ai_policies tap on tap.tenant_id = t.id
    where t.active = true
      and coalesce(lower(t.status), 'active') = 'active'
    order by t.created_at asc
  `);

  return Array.isArray(q?.rows) ? q.rows : [];
}

async function triggerN8n({ webhookUrl, webhookToken, payload }) {
  if (!webhookUrl) {
    throw new Error("N8N_WEBHOOK_SCHEDULE_DRAFT_URL is missing");
  }

  const r = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(webhookToken ? { "x-webhook-token": webhookToken } : {}),
    },
    body: JSON.stringify(payload),
  });

  const text = await r.text().catch(() => "");
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!r.ok) {
    throw new Error(json?.error || json?.message || json?.raw || `Webhook failed (${r.status})`);
  }

  return json;
}

export function createDraftScheduleWorker({ db }) {
  const cfg = getWorkerConfig();
  const logger = createLogger({
    service: "ai-hq-backend",
    component: "draft-schedule-worker",
  });
  let timer = null;
  let running = false;
  let startedAt = null;
  let lastHeartbeatAt = null;
  let lastCompletedAt = null;
  let lastOutcome = "";

  // dedupe key => tenantKey:YYYY-MM-DD:HH:MM:mode
  const lastRunByTenant = new Map();

  function getState() {
    return {
      enabled: cfg.enabled,
      intervalMs: cfg.intervalMs,
      running,
      stopped: !timer,
      startedAt,
      lastHeartbeatAt,
      lastCompletedAt,
      lastOutcome,
    };
  }

  async function tick() {
    if (!cfg.enabled) return;
    if (!db) return;
    if (running) return;

    running = true;
    lastHeartbeatAt = new Date().toISOString();
    touchWorkerHeartbeat("draft-schedule-worker", getState());

    try {
      const rows = await listTenantSchedules(db);

      for (const row of rows) {
        const schedule = normalizeSchedule(row, cfg);
        if (!schedule.enabled) continue;

        let local;
        try {
          local = getLocalClockParts(schedule.timezone);
        } catch {
          local = getLocalClockParts(cfg.defaultTimezone);
        }

        if (local.hour !== schedule.hour || local.minute !== schedule.minute) {
          continue;
        }

        const mode = schedule.automation?.mode || "manual";
        const dedupeKey = `${row.tenant_key}:${local.dateKey}:${pad2(local.hour)}:${pad2(
          local.minute
        )}:${mode}`;

        if (lastRunByTenant.get(row.tenant_key) === dedupeKey) {
          continue;
        }

        await triggerN8n({
          webhookUrl: cfg.webhookUrl,
          webhookToken: cfg.webhookToken,
          payload: {
            event: "tenant.draft.schedule.trigger",
            triggerType: "scheduled_content",
            automationMode: mode,
            autoPublish: mode === "full_auto",
            tenantId: row.id,
            tenantKey: row.tenant_key,
            companyName: row.company_name || "",
            timezone: schedule.timezone,
            format: schedule.format,
            scheduledTime: schedule.time,
            scheduledHour: schedule.hour,
            scheduledMinute: schedule.minute,
            dateKey: local.dateKey,
          },
        });

        lastRunByTenant.set(row.tenant_key, dedupeKey);
        lastCompletedAt = new Date().toISOString();
        lastOutcome = "triggered";
        lastHeartbeatAt = lastCompletedAt;
        touchWorkerHeartbeat("draft-schedule-worker", getState());
        logger.info("draft_schedule.worker.triggered", {
          tenantKey: clean(row.tenant_key),
          automationMode: mode,
          scheduledTime: schedule.time,
          timezone: schedule.timezone,
        });
      }

      if (lastRunByTenant.size > 5000) {
        const entries = Array.from(lastRunByTenant.entries()).slice(-1000);
        lastRunByTenant.clear();
        for (const [k, v] of entries) lastRunByTenant.set(k, v);
      }
    } catch (err) {
      lastOutcome = "tick_failed";
      logger.error("draft_schedule.worker.tick_failed", err, {
        error: String(err?.message || err),
      });
      recordRuntimeSignal({
        level: "error",
        category: "worker",
        code: "draft_schedule_tick_failed",
        reasonCode: "tick_failed",
        message: clean(err?.message || err),
      });
    } finally {
      running = false;
      lastHeartbeatAt = new Date().toISOString();
      touchWorkerHeartbeat("draft-schedule-worker", getState());
    }
  }

  return {
    start() {
      if (!cfg.enabled) {
        logger.info("draft_schedule.worker.disabled");
        return;
      }
      if (timer) return;

      startedAt = new Date().toISOString();
      lastHeartbeatAt = startedAt;
      markWorkerStarted("draft-schedule-worker", getState());
      logger.info("draft_schedule.worker.started", {
        intervalMs: cfg.intervalMs,
      });

      tick();
      timer = setInterval(tick, cfg.intervalMs);
    },

    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      markWorkerStopped("draft-schedule-worker", getState());
      logger.info("draft_schedule.worker.stopped");
    },

    getState,
  };
}
