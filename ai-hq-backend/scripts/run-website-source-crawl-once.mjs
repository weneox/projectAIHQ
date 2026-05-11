import crypto from "node:crypto";
import pg from "pg";

import { createTenantKnowledgeHelpers } from "../src/db/helpers/tenantKnowledge.js";
import { assertSafePublicFetchUrl } from "../src/utils/publicFetchSafety.js";

const { Pool } = pg;

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeUrl(raw = "", base = "") {
  const value = s(raw);
  if (!value) return "";

  try {
    return base ? new URL(value, base).toString() : new URL(value).toString();
  } catch {
    try {
      const withoutLeadingSlashes = value.replace(/^\/+/, "");
      return new URL(`https://${withoutLeadingSlashes}`).toString();
    } catch {
      return "";
    }
  }
}

function hostMatches(expected = "", candidate = "") {
  const left = lower(expected).replace(/^www\./, "");
  const right = lower(candidate).replace(/^www\./, "");

  return Boolean(left && right && (right === left || right.endsWith(`.${left}`)));
}

function sameAllowedDomain(url = "", allowedDomains = []) {
  try {
    const host = new URL(url).hostname;
    return arr(allowedDomains).some((domain) => hostMatches(domain, host));
  } catch {
    return false;
  }
}

function unique(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function stripHtml(html = "") {
  return s(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function pageTitle(html = "", fallback = "Website page") {
  const match = s(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripHtml(match?.[1] || fallback).slice(0, 180) || fallback;
}

function buildCandidate({ run, pageUrl, title, text }) {
  const safeTitle = s(title, "Website page");
  const safeText = s(text).slice(0, 6000);

  return {
    tenantId: run.tenant_id,
    tenantKey: run.tenant_key,
    sourceId: run.source_id,
    sourceRunId: run.id,
    candidateGroup: "website_crawl",
    category: "business_info",
    itemKey: `website_page:${pageUrl}`,
    title: safeTitle,
    valueText: safeText,
    valueJson: {
      pageUrl,
      title: safeTitle,
      excerpt: safeText.slice(0, 900),
    },
    normalizedText: safeText.toLowerCase(),
    normalizedJson: {
      pageUrl,
      title: safeTitle.toLowerCase(),
    },
    confidence: 0.72,
    confidenceLabel: "medium",
    status: "needs_review",
    reviewReason: "Website crawl extracted this page. Review before publishing to Business Info runtime.",
    sourceEvidenceJson: [
      {
        type: "website_page",
        url: pageUrl,
        title: safeTitle,
      },
    ],
    extractionMethod: "website_crawler",
    extractionModel: "aihq_website_crawl_once_v1",
  };
}

async function claimNextRun(db, workerId) {
  await db.query("begin");

  try {
    const result = await db.query(
      `
      with candidate as (
        select
          r.*,
          s.source_url,
          s.display_name as source_display_name,
          s.settings_json as source_settings_json,
          s.metadata_json as source_metadata_json
        from tenant_source_sync_runs r
        join tenant_sources s
          on s.id = r.source_id
        where r.status = 'queued'
          and r.run_type = 'crawl'
          and s.source_type = 'website'
          and s.is_enabled = true
        order by r.created_at asc
        for update skip locked
        limit 1
      )
      update tenant_source_sync_runs r
      set
        status = 'running',
        started_at = coalesce(r.started_at, now()),
        last_attempt_at = now(),
        attempt_count = coalesce(r.attempt_count, 0) + 1,
        lease_token = $1,
        lease_expires_at = now() + interval '10 minutes',
        claimed_by = $2,
        updated_at = now()
      from candidate c
      where r.id = c.id
      returning
        r.*,
        c.source_url,
        c.source_display_name,
        c.source_settings_json,
        c.source_metadata_json
      `,
      [crypto.randomUUID(), workerId]
    );

    await db.query("commit");
    return result.rows?.[0] || null;
  } catch (error) {
    await db.query("rollback").catch(() => {});
    throw error;
  }
}

function crawlTargets(run = {}) {
  const settings = parseJson(run.source_settings_json);
  const crawler = obj(settings.crawler);
  const seedUrl = normalizeUrl(crawler.seedUrl || run.source_url);
  const allowedDomains = unique([
    ...arr(crawler.allowedDomains),
    seedUrl ? new URL(seedUrl).hostname : "",
  ]);

  const preferredPaths = arr(crawler.preferredPaths, ["/"]).slice(0, 12);
  const maxPages = Math.max(1, Math.min(40, Number(crawler.maxPages || 12)));

  const urls = unique(
    [seedUrl, ...preferredPaths.map((path) => normalizeUrl(path, seedUrl))]
      .filter(Boolean)
      .filter((url) => sameAllowedDomain(url, allowedDomains))
  ).slice(0, maxPages);

  return {
    seedUrl,
    allowedDomains,
    urls,
  };
}

async function fetchPage(url) {
  const safe = await assertSafePublicFetchUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(safe.url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "accept": "text/html,application/xhtml+xml",
        "user-agent": "AIHQWebsiteCrawler/1.0 (+https://aihq.local)",
      },
    });

    const contentType = s(response.headers.get("content-type")).toLowerCase();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (contentType && !contentType.includes("text/html")) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    const html = await response.text();
    return {
      ok: true,
      url: response.url || safe.url,
      title: pageTitle(html, safe.url),
      text: stripHtml(html).slice(0, 12000),
      contentType,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function finishRun(db, run, patch = {}) {
  const status = s(patch.status, "success");
  const finishedAt = new Date().toISOString();

  await db.query(
    `
    update tenant_source_sync_runs
    set
      status = $2,
      finished_at = $3,
      duration_ms = greatest(0, floor(extract(epoch from ($3::timestamptz - coalesce(started_at, created_at))) * 1000)::int),
      pages_scanned = $4,
      records_scanned = $5,
      candidates_created = $6,
      warnings_count = $7,
      errors_count = $8,
      error_code = $9,
      error_message = $10,
      extraction_summary_json = $11::jsonb,
      result_summary_json = $12::jsonb,
      logs_json = $13::jsonb,
      lease_token = '',
      lease_expires_at = null,
      updated_at = now()
    where id = $1
    `,
    [
      run.id,
      status,
      finishedAt,
      Number(patch.pagesScanned || 0),
      Number(patch.recordsScanned || 0),
      Number(patch.candidatesCreated || 0),
      Number(patch.warningsCount || 0),
      Number(patch.errorsCount || 0),
      s(patch.errorCode),
      s(patch.errorMessage),
      JSON.stringify(obj(patch.extractionSummaryJson)),
      JSON.stringify(obj(patch.resultSummaryJson)),
      JSON.stringify(arr(patch.logsJson)),
    ]
  );

  await db.query(
    `
    update tenant_sources
    set
      sync_status = $2,
      last_sync_finished_at = $3,
      last_successful_sync_at = case when $2 in ('success','partial') then $3 else last_successful_sync_at end,
      last_error_at = case when $2 = 'error' then $3 else null end,
      last_error_code = case when $2 = 'error' then $4 else '' end,
      last_error_message = case when $2 = 'error' then $5 else '' end,
      updated_at = now()
    where id = $1
    `,
    [
      run.source_id,
      status === "failed" ? "error" : status,
      finishedAt,
      s(patch.errorCode),
      s(patch.errorMessage),
    ]
  );
}

async function processRun(db, run) {
  const knowledge = createTenantKnowledgeHelpers({ db });
  const targets = crawlTargets(run);
  const logs = [];
  const candidates = [];

  if (!targets.urls.length) {
    throw new Error("No safe crawl targets were resolved for this website source.");
  }

  for (const url of targets.urls) {
    try {
      const page = await fetchPage(url);

      if (page.text.length < 80) {
        logs.push({ level: "warn", url, message: "Page text was too short; skipped." });
        continue;
      }

      candidates.push(
        buildCandidate({
          run,
          pageUrl: page.url,
          title: page.title,
          text: page.text,
        })
      );

      logs.push({ level: "info", url: page.url, title: page.title, characters: page.text.length });
    } catch (error) {
      logs.push({ level: "warn", url, message: s(error?.message || error) });
    }
  }

  const created = await knowledge.createCandidatesBulk(candidates);
  const status = created.length > 0 ? (created.length === targets.urls.length ? "success" : "partial") : "failed";

  await finishRun(db, run, {
    status,
    pagesScanned: targets.urls.length,
    recordsScanned: candidates.length,
    candidatesCreated: created.length,
    warningsCount: logs.filter((item) => item.level === "warn").length,
    errorsCount: status === "failed" ? 1 : 0,
    errorCode: status === "failed" ? "website_crawl_no_candidates" : "",
    errorMessage: status === "failed" ? "Website crawl finished without creating review candidates." : "",
    extractionSummaryJson: {
      seedUrl: targets.seedUrl,
      allowedDomains: targets.allowedDomains,
      targetCount: targets.urls.length,
    },
    resultSummaryJson: {
      candidateCount: created.length,
      status,
    },
    logsJson: logs,
  });

  return {
    status,
    targetCount: targets.urls.length,
    candidateCount: created.length,
  };
}

async function main() {
  const databaseUrl = s(process.env.DATABASE_URL);
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const workerId = s(process.env.WORKER_ID, `website-crawl-once:${process.pid}`);
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });

  try {
    const run = await claimNextRun(pool, workerId);

    if (!run) {
      console.log(JSON.stringify({ ok: true, processed: false, reasonCode: "no_queued_website_crawl_run" }));
      return;
    }

    try {
      const result = await processRun(pool, run);
      console.log(JSON.stringify({ ok: true, processed: true, runId: run.id, ...result }));
    } catch (error) {
      await finishRun(pool, run, {
        status: "failed",
        errorsCount: 1,
        errorCode: "website_crawl_failed",
        errorMessage: s(error?.message || error),
        logsJson: [{ level: "error", message: s(error?.message || error) }],
      });

      throw error;
    }
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: s(error?.message || error),
  }));
  process.exitCode = 1;
});
