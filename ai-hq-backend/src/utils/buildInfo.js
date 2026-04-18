import crypto from "crypto";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function pickFirst(...values) {
  for (const value of values) {
    const safe = s(value);
    if (safe) return safe;
  }
  return "";
}

function normalizeSha(value = "") {
  return s(value).replace(/[^a-f0-9]/gi, "").toLowerCase();
}

const rawCommitSha = pickFirst(
  process.env.RAILWAY_GIT_COMMIT_SHA,
  process.env.SOURCE_VERSION,
  process.env.GITHUB_SHA,
  process.env.RENDER_GIT_COMMIT,
  process.env.VERCEL_GIT_COMMIT_SHA
);

const fullSha = normalizeSha(rawCommitSha);
const shortSha = fullSha.slice(0, 12);
const version = pickFirst(
  process.env.APP_VERSION,
  process.env.npm_package_version,
  "0.0.0"
);
const bootId = crypto.randomBytes(6).toString("hex");
const startedAt = new Date().toISOString();

export const buildInfo = {
  version,
  fullSha,
  shortSha,
  bootId,
  startedAt,
  marker: shortSha ? `build:${shortSha}` : "build:unknown",
  summary: [version, shortSha || "unknown", bootId].filter(Boolean).join(" / "),
};

export function buildResponseMeta(extra = {}) {
  return {
    build: {
      version: buildInfo.version,
      sha: buildInfo.shortSha || null,
      fullSha: buildInfo.fullSha || null,
      bootId: buildInfo.bootId,
      startedAt: buildInfo.startedAt,
      marker: buildInfo.marker,
      ...extra,
    },
  };
}

export function attachBuildHeaders(res) {
  if (!res?.setHeader) return;

  res.setHeader("x-aihq-build-version", buildInfo.version);
  res.setHeader("x-aihq-build-sha", buildInfo.shortSha || "unknown");
  res.setHeader("x-aihq-build-boot-id", buildInfo.bootId);
  res.setHeader("x-aihq-build-marker", buildInfo.marker);
}

export function withBuildMeta(body = {}, extra = {}) {
  return {
    ...(body && typeof body === "object" ? body : {}),
    ...buildResponseMeta(extra),
  };
}