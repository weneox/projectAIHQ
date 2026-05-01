
const DEFAULT_TIMEOUT_MS = 8000;

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeBaseUrl(value = "") {
  return s(value).replace(/\/+$/, "");
}

function withTimeout(ms = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

async function fetchJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const timeout = withTimeout(timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: timeout.signal,
    });

    const text = await res.text();
    let body = null;

    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = {
        raw: text.slice(0, 500),
      };
    }

    return {
      ok: res.ok,
      status: res.status,
      body,
    };
  } finally {
    timeout.cancel();
  }
}

function printResult(label, result) {
  const status = result.ok ? "OK" : "FAIL";
  console.log(`[${status}] ${label}`);
  console.log(`  status: ${result.status}`);

  if (result.reason) {
    console.log(`  reason: ${result.reason}`);
  }

  if (result.details) {
    console.log(`  details: ${JSON.stringify(result.details)}`);
  }
}

function assertRootHealth(response) {
  const body = response.body || {};

  if (response.status !== 200) {
    return {
      ok: false,
      status: response.status,
      reason: "health_endpoint_non_200",
      details: body,
    };
  }

  const status = s(body.status || body.readiness?.status || "");
  const reasonCodes = Array.isArray(body.reasonCodes) ? body.reasonCodes : [];

  if (body.ok === true && status === "ready") {
    return {
      ok: true,
      status: response.status,
      details: {
        service: body.service || "ai-hq-backend",
        status,
      },
    };
  }

  return {
    ok: false,
    status: response.status,
    reason: "backend_not_ready",
    details: {
      ok: body.ok,
      status,
      unavailable: body.unavailable,
      degraded: body.degraded,
      reasonCodes,
      summary: body.summary || null,
    },
  };
}

function assertBuildCheck(response) {
  const body = response.body || {};

  if (response.status !== 200 || body.ok !== true) {
    return {
      ok: false,
      status: response.status,
      reason: "buildcheck_failed",
      details: body,
    };
  }

  return {
    ok: true,
    status: response.status,
    details: {
      service: body.service || "",
      marker: body.marker || "",
      env: body.env || "",
    },
  };
}

function assertFrontend(response) {
  if (response.status < 200 || response.status >= 400) {
    return {
      ok: false,
      status: response.status,
      reason: "frontend_unreachable",
    };
  }

  return {
    ok: true,
    status: response.status,
  };
}

async function main() {
  const backendUrl = normalizeBaseUrl(
    process.env.AIHQ_BACKEND_URL || process.env.BACKEND_URL
  );
  const frontendUrl = normalizeBaseUrl(
    process.env.AIHQ_FRONTEND_URL || process.env.FRONTEND_URL
  );
  const neoxUrl = normalizeBaseUrl(process.env.NEOX_FRONTEND_URL || "");

  if (!backendUrl) {
    console.error("Missing AIHQ_BACKEND_URL.");
    process.exit(2);
  }

  const checks = [];

  checks.push({
    label: "AIHQ backend /health",
    run: async () => assertRootHealth(await fetchJson(`${backendUrl}/health`)),
  });

  checks.push({
    label: "AIHQ backend /api/__buildcheck",
    run: async () =>
      assertBuildCheck(await fetchJson(`${backendUrl}/api/__buildcheck`)),
  });

  if (frontendUrl) {
    checks.push({
      label: "AIHQ frontend",
      run: async () => {
        const timeout = withTimeout(DEFAULT_TIMEOUT_MS);
        try {
          const res = await fetch(frontendUrl, {
            method: "GET",
            signal: timeout.signal,
          });
          return assertFrontend({ status: res.status });
        } finally {
          timeout.cancel();
        }
      },
    });
  }

  if (neoxUrl) {
    checks.push({
      label: "Neox frontend",
      run: async () => {
        const timeout = withTimeout(DEFAULT_TIMEOUT_MS);
        try {
          const res = await fetch(neoxUrl, {
            method: "GET",
            signal: timeout.signal,
          });
          return assertFrontend({ status: res.status });
        } finally {
          timeout.cancel();
        }
      },
    });
  }

  let failed = 0;

  for (const check of checks) {
    try {
      const result = await check.run();
      printResult(check.label, result);
      if (!result.ok) failed += 1;
    } catch (error) {
      failed += 1;
      printResult(check.label, {
        ok: false,
        status: 0,
        reason: "request_failed",
        details: {
          message: s(error?.message || error),
        },
      });
    }
  }

  if (failed > 0) {
    console.error(`Production smoke failed: ${failed} check(s) failed.`);
    process.exit(1);
  }

  console.log("Production smoke passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
