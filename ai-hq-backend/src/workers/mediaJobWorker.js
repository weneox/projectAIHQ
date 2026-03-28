import { cfg } from "../config.js";
import { deepFix } from "../utils/textFix.js";
import { pollMediaJob } from "../services/media/mediaExecutionRunner.js";
import { createLogger } from "../utils/logger.js";
import {
  markWorkerStarted,
  markWorkerStopped,
  recordRuntimeSignal,
  touchWorkerHeartbeat,
} from "../observability/runtimeSignals.js";

function clean(x) {
  return String(x || "").trim();
}

export function createMediaJobWorker({ db }) {
  const logger = createLogger({
    service: "ai-hq-backend",
    component: "media-job-worker",
  });
  let timer = null;
  let running = false;
  let startedAt = null;
  let lastHeartbeatAt = null;
  let lastCompletedAt = null;
  let lastOutcome = "";

  function getState() {
    return {
      enabled: Boolean(cfg?.workers?.mediaJobWorkerEnabled),
      intervalMs: Number(cfg?.workers?.mediaJobWorkerIntervalMs || 15000),
      batchSize: Number(cfg?.workers?.mediaJobWorkerBatchSize || 10),
      running,
      stopped: !timer,
      startedAt,
      lastHeartbeatAt,
      lastCompletedAt,
      lastOutcome,
    };
  }

  async function tick() {
    if (running || !db) return;
    running = true;
    lastHeartbeatAt = new Date().toISOString();
    touchWorkerHeartbeat("media-job-worker", getState());

    try {
      const q = await db.query(
        `select id, tenant_id, tenant_key, proposal_id, type, status, input, output, error, created_at, started_at, finished_at
         from jobs
         where status = 'running'
           and type in ('video.generate','assembly.render')
         order by created_at asc
         limit $1`,
        [Number(cfg?.workers?.mediaJobWorkerBatchSize || 10)]
      );

      for (const row of q.rows || []) {
        try {
          row.input = deepFix(row.input || {});
          row.output = deepFix(row.output || {});
          await pollMediaJob({ db, job: row });
          lastCompletedAt = new Date().toISOString();
          lastOutcome = "processed";
          lastHeartbeatAt = lastCompletedAt;
          touchWorkerHeartbeat("media-job-worker", getState());
        } catch (e) {
          lastCompletedAt = new Date().toISOString();
          lastOutcome = "poll_failed";
          lastHeartbeatAt = lastCompletedAt;
          touchWorkerHeartbeat("media-job-worker", getState());
          logger.error("media.worker.poll_failed", e, {
            jobId: String(row.id || ""),
          });
          recordRuntimeSignal({
            level: "error",
            category: "worker",
            code: "media_poll_failed",
            reasonCode: "poll_failed",
            message: clean(e?.message || e),
            context: {
              jobId: String(row.id || ""),
            },
          });
        }
      }
    } catch (e) {
      lastOutcome = "tick_failed";
      logger.error("media.worker.tick_failed", e, {
        error: clean(e?.message || e),
      });
      recordRuntimeSignal({
        level: "error",
        category: "worker",
        code: "media_tick_failed",
        reasonCode: "tick_failed",
        message: clean(e?.message || e),
      });
    } finally {
      running = false;
      lastHeartbeatAt = new Date().toISOString();
      touchWorkerHeartbeat("media-job-worker", getState());
    }
  }

  return {
    start() {
      if (!cfg?.workers?.mediaJobWorkerEnabled || timer) return;
      startedAt = new Date().toISOString();
      lastHeartbeatAt = startedAt;
      timer = setInterval(
        tick,
        Number(cfg?.workers?.mediaJobWorkerIntervalMs || 15000)
      );
      timer.unref?.();
      tick().catch(() => {});
      markWorkerStarted("media-job-worker", getState());
      logger.info("media.worker.started", {
        intervalMs: Number(cfg?.workers?.mediaJobWorkerIntervalMs || 15000),
        batchSize: Number(cfg?.workers?.mediaJobWorkerBatchSize || 10),
      });
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      markWorkerStopped("media-job-worker", getState());
      logger.info("media.worker.stopped");
    },

    getState,
  };
}
