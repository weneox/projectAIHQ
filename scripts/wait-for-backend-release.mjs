import path from "node:path";
import { pathToFileURL } from "node:url";

import { buildInternalServiceHeaders } from "./launch-posture-verifier.mjs";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeBaseUrl(value = "") {
  return s(value).replace(/\/+$/, "");
}

export function normalizeSha(value = "") {
  return s(value).replace(/[^a-f0-9]/gi, "").toLowerCase();
}

export function releaseShaMatches(candidate = "", expected = "") {
  const actual = normalizeSha(candidate);
  const wanted = normalizeSha(expected);

  if (!actual || !wanted) return false;
  if (actual === wanted) return true;

  const minLength = Math.min(actual.length, wanted.length);
  if (minLength < 7) return false;

  return actual.startsWith(wanted) || wanted.startsWith(actual);
}

export function buildBackendBuildcheckUrls(baseUrl = "") {
  const root = normalizeBaseUrl(baseUrl);
  return root ? [`${root}/api/__buildcheck`, `${root}/__buildcheck`] : [];
}

export function extractBuildShaCandidates(response = {}) {
  const json = response.json || {};
  const build = json.build || {};
  const headers = response.headers || {};

  return [
    build.fullSha,
    build.releaseSha,
    build.commitSha,
    build.gitSha,
    build.sha,
    json.fullSha,
    json.releaseSha,
    json.sha,
    headers["x-aihq-build-sha"],
    headers["X-AIHQ-Build-Sha"],
  ]
    .map((value) => normalizeSha(value))
    .filter(Boolean);
}

export function resolveScopedBackendInternalToken(env = process.env) {
  return s(
    env.AIHQ_INTERNAL_TOKEN_META_BOT ||
      env.AIHQ_INTERNAL_META_BOT_TOKEN ||
      env.AIHQ_PROD_INTERNAL_TOKEN_META_BOT
  );
}

export function buildBackendReleaseWaitHeaders({ internalToken = "" } = {}) {
  return buildInternalServiceHeaders({
    internalToken,
    audience: "aihq-backend.diagnostics",
    internalService: "meta-bot-backend",
    acceptJson: true,
  });
}

async function readJson(response) {
  const text = await response.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 1200) };
  }
}

async function fetchJson(url, headers = {}, timeoutMs = 5000, fetchImpl = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    const json = await readJson(response);
    return {
      ok: response.ok,
      status: response.status,
      json,
      headers: Object.fromEntries(response.headers.entries()),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      json: null,
      headers: {},
      error:
        error?.name === "AbortError"
          ? "request_timeout"
          : s(error?.message || error || "request_failed"),
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildMissingConfigResult({
  baseUrl = "",
  expectedSha = "",
  internalToken = "",
} = {}) {
  const missing = [];
  if (!s(baseUrl)) missing.push("AIHQ_BASE_URL");
  if (!normalizeSha(expectedSha)) missing.push("AIHQ_EXPECTED_RELEASE_SHA");
  if (!s(internalToken)) missing.push("AIHQ_INTERNAL_TOKEN_META_BOT");

  return missing.length
    ? {
        ok: false,
        reasonCode: "missing_required_env",
        missing,
        expectedSha: normalizeSha(expectedSha),
        message:
          "AIHQ_BASE_URL, AIHQ_EXPECTED_RELEASE_SHA, and AIHQ_INTERNAL_TOKEN_META_BOT are required before waiting for backend release identity.",
      }
    : null;
}

function formatWaitResult(result = {}) {
  return JSON.stringify({
    expectedSha: result.expectedSha || "",
    deployedSha: result.deployedSha || "",
    candidateShas: result.candidateShas || [],
    url: result.url || "",
    attempt: result.attempt || 0,
    attempts: result.attempts || 0,
    status: result.status || 0,
    reasonCode: result.reasonCode || "",
    error: result.error || "",
  });
}

function printLine(prefix, message, details = "") {
  const suffix = details ? ` ${details}` : "";
  console.log(`${prefix} ${message}${suffix}`);
}

export async function waitForBackendRelease({
  baseUrl = "",
  expectedSha = "",
  internalToken = "",
  attempts = 30,
  delayMs = 20_000,
  timeoutMs = 5000,
  fetchImpl = fetch,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  onAttempt = null,
} = {}) {
  const expected = normalizeSha(expectedSha);
  const configFailure = buildMissingConfigResult({
    baseUrl,
    expectedSha: expected,
    internalToken,
  });
  if (configFailure) return configFailure;

  const urls = buildBackendBuildcheckUrls(baseUrl);
  const headers = buildBackendReleaseWaitHeaders({ internalToken });
  const maxAttempts = Math.max(1, n(attempts, 30));
  const waitMs = Math.max(0, n(delayMs, 20_000));
  const requestTimeoutMs = Math.max(1000, n(timeoutMs, 5000));
  let last = {
    ok: false,
    reasonCode: "release_sha_mismatch",
    expectedSha: expected,
    deployedSha: "",
    candidateShas: [],
    url: urls[0] || "",
    attempt: 0,
    attempts: maxAttempts,
    status: 0,
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    for (const url of urls) {
      const response = await fetchJson(
        url,
        headers,
        requestTimeoutMs,
        fetchImpl
      );
      const candidateShas = extractBuildShaCandidates(response);
      const matched = candidateShas.find((candidate) =>
        releaseShaMatches(candidate, expected)
      );

      last = {
        ok: Boolean(response.ok && matched),
        reasonCode: response.ok
          ? matched
            ? ""
            : "release_sha_mismatch"
          : "buildcheck_unavailable",
        expectedSha: expected,
        deployedSha: candidateShas[0] || "",
        candidateShas,
        url,
        attempt,
        attempts: maxAttempts,
        status: response.status || 0,
        error: s(response.error),
      };

      if (typeof onAttempt === "function") {
        onAttempt(last);
      }

      if (last.ok) return last;
    }

    if (attempt < maxAttempts) {
      await sleepImpl(waitMs);
    }
  }

  return last;
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.AIHQ_BASE_URL);
  const expectedSha = normalizeSha(process.env.AIHQ_EXPECTED_RELEASE_SHA);
  const internalToken = resolveScopedBackendInternalToken();
  const attempts = Math.max(1, n(process.env.BACKEND_RELEASE_WAIT_ATTEMPTS, 30));
  const delayMs = Math.max(0, n(process.env.BACKEND_RELEASE_WAIT_DELAY_MS, 20_000));
  const timeoutMs = Math.max(1000, n(process.env.BACKEND_RELEASE_WAIT_TIMEOUT_MS, 5000));

  printLine(
    "#",
    "Waiting for AIHQ backend release identity",
    JSON.stringify({
      expectedSha,
      attempts,
      delayMs,
      timeoutMs,
      scopedInternalTokenConfigured: Boolean(internalToken),
    })
  );

  const result = await waitForBackendRelease({
    baseUrl,
    expectedSha,
    internalToken,
    attempts,
    delayMs,
    timeoutMs,
    onAttempt: (attemptResult) => {
      const prefix = attemptResult.ok ? "OK" : "WAIT";
      printLine(prefix, "aihq_backend_release_identity", formatWaitResult(attemptResult));
    },
  });

  if (!result.ok) {
    printLine("FAIL", "aihq_backend_release_identity", formatWaitResult(result));
    process.exit(1);
  }

  printLine("OK", "aihq_backend_release_ready", formatWaitResult(result));
}

function isDirectRun(metaUrl = "") {
  return (
    Boolean(process.argv[1]) &&
    pathToFileURL(path.resolve(process.argv[1])).href === metaUrl
  );
}

if (isDirectRun(import.meta.url)) {
  main().catch((error) => {
    printLine(
      "FAIL",
      "wait_for_backend_release",
      JSON.stringify({ error: s(error?.message || error) })
    );
    process.exit(1);
  });
}
