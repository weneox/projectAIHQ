import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBackendBuildcheckUrls,
  buildBackendReleaseWaitHeaders,
  releaseShaMatches,
  resolveScopedBackendInternalToken,
  waitForBackendRelease,
} from "../../scripts/wait-for-backend-release.mjs";

function mockResponse({ ok = true, status = 200, body = {}, headers = {} } = {}) {
  return {
    ok,
    status,
    async text() {
      return JSON.stringify(body);
    },
    headers: {
      entries() {
        return Object.entries(headers);
      },
    },
  };
}

function createFetchSequence(responses = []) {
  const calls = [];
  let index = 0;

  return {
    calls,
    async fetch(url, options = {}) {
      calls.push({ url, options });
      const response = responses[Math.min(index, responses.length - 1)];
      index += 1;
      return response;
    },
  };
}

test("backend release wait checks both buildcheck endpoints with scoped headers", async () => {
  assert.deepEqual(buildBackendBuildcheckUrls("https://api.example.test/"), [
    "https://api.example.test/api/__buildcheck",
    "https://api.example.test/__buildcheck",
  ]);
  assert.deepEqual(
    buildBackendReleaseWaitHeaders({
      internalToken: "mock-meta-scoped-internal-token",
    }),
    {
      accept: "application/json",
      "x-internal-token": "mock-meta-scoped-internal-token",
      "x-internal-audience": "aihq-backend.diagnostics",
      "x-internal-service": "meta-bot-backend",
    }
  );
});

test("backend release wait polls until expected SHA appears", async () => {
  const expectedSha = "abcdef1234567890abcdef1234567890abcdef12";
  const previousSha = "1111111111111111111111111111111111111111";
  const fetchSequence = createFetchSequence([
    mockResponse({ body: { build: { releaseSha: previousSha } } }),
    mockResponse({ body: { build: { releaseSha: previousSha } } }),
    mockResponse({ body: { build: { releaseSha: expectedSha } } }),
  ]);
  const sleeps = [];

  const result = await waitForBackendRelease({
    baseUrl: "https://api.example.test",
    expectedSha,
    internalToken: "mock-meta-scoped-internal-token",
    attempts: 2,
    delayMs: 20,
    timeoutMs: 1000,
    fetchImpl: fetchSequence.fetch,
    sleepImpl: async (ms) => {
      sleeps.push(ms);
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.expectedSha, expectedSha);
  assert.equal(result.deployedSha, expectedSha);
  assert.equal(result.attempt, 2);
  assert.deepEqual(sleeps, [20]);
  assert.deepEqual(
    fetchSequence.calls.map((call) => call.url),
    [
      "https://api.example.test/api/__buildcheck",
      "https://api.example.test/__buildcheck",
      "https://api.example.test/api/__buildcheck",
    ]
  );
  assert.equal(
    fetchSequence.calls[0].options.headers["x-internal-token"],
    "mock-meta-scoped-internal-token"
  );
  assert.equal(
    fetchSequence.calls[0].options.headers["x-internal-service"],
    "meta-bot-backend"
  );
});

test("backend release wait fails closed with mismatch diagnostics", async () => {
  const expectedSha = "abcdef1234567890abcdef1234567890abcdef12";
  const previousSha = "2222222222222222222222222222222222222222";
  const fetchSequence = createFetchSequence([
    mockResponse({
      body: { build: { releaseSha: previousSha } },
      headers: { "x-aihq-build-sha": previousSha.slice(0, 12) },
    }),
  ]);

  const result = await waitForBackendRelease({
    baseUrl: "https://api.example.test",
    expectedSha,
    internalToken: "mock-meta-scoped-internal-token",
    attempts: 1,
    delayMs: 0,
    timeoutMs: 1000,
    fetchImpl: fetchSequence.fetch,
    sleepImpl: async () => {},
  });

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "release_sha_mismatch");
  assert.equal(result.expectedSha, expectedSha);
  assert.equal(result.deployedSha, previousSha);
  assert.ok(result.candidateShas.includes(previousSha));
  assert.equal(result.url, "https://api.example.test/__buildcheck");
  assert.equal(result.attempt, 1);
  assert.equal(result.attempts, 1);
});

test("backend release wait requires scoped Meta service token", async () => {
  assert.equal(
    resolveScopedBackendInternalToken({
      AIHQ_INTERNAL_TOKEN: "mock-global-internal-token",
    }),
    ""
  );
  assert.equal(
    resolveScopedBackendInternalToken({
      AIHQ_INTERNAL_TOKEN: "mock-global-internal-token",
      AIHQ_INTERNAL_TOKEN_META_BOT: "mock-meta-scoped-internal-token",
    }),
    "mock-meta-scoped-internal-token"
  );

  const result = await waitForBackendRelease({
    baseUrl: "https://api.example.test",
    expectedSha: "abcdef1234567890abcdef1234567890abcdef12",
    internalToken: "",
    fetchImpl: async () => mockResponse(),
    sleepImpl: async () => {},
  });

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "missing_required_env");
  assert.deepEqual(result.missing, ["AIHQ_INTERNAL_TOKEN_META_BOT"]);
});

test("backend release wait accepts safe short/long SHA comparisons", () => {
  assert.equal(releaseShaMatches("abcdef123456", "abcdef1234567890"), true);
  assert.equal(releaseShaMatches("abcdef1234567890", "abcdef1"), true);
  assert.equal(releaseShaMatches("abcdef", "abcdef1234567890"), false);
  assert.equal(releaseShaMatches("1111111234567890", "abcdef1234567890"), false);
});
