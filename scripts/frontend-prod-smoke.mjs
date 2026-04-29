function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function bool(value, fallback = false) {
  const normalized = s(value).toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickFirst(...values) {
  for (const value of values) {
    const text = s(value);
    if (text) return text;
  }
  return "";
}

function normalizeSha(value = "") {
  return s(value).replace(/[^a-f0-9]/gi, "").toLowerCase();
}

function normalizeBaseUrl(value = "") {
  const raw = s(value).replace(/\/+$/, "");

  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.href.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function buildRouteUrl(baseUrl, routePath) {
  return new URL(routePath, `${baseUrl}/`).href;
}

function buildMetaUrl(baseUrl) {
  const url = new URL("/build-meta.json", `${baseUrl}/`);
  url.searchParams.set("smoke", String(Date.now()));
  return url.href;
}

function printLine(prefix, message, details = "") {
  const suffix = details ? ` ${details}` : "";
  console.log(`${prefix} ${message}${suffix}`);
}

function redactUrl(value = "") {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/(token|secret|session|cookie|code|state)/i.test(key)) {
        url.searchParams.set(key, "[redacted]");
      }
    }
    return url.href;
  } catch {
    return s(value).slice(0, 300);
  }
}

const ROUTES = [
  { path: "/", auth: "optional" },
  { path: "/login", auth: "guest" },
  { path: "/home", auth: "protected" },
  { path: "/channels", auth: "protected" },
  { path: "/inbox", auth: "protected" },
  { path: "/truth", auth: "protected" },
];

const COOKIE_ATTRIBUTE_NAMES = new Set([
  "domain",
  "expires",
  "httponly",
  "max-age",
  "path",
  "samesite",
  "secure",
]);

const PLACEHOLDER_PATTERNS = [
  { label: "vite_env_name", pattern: /\bVITE_[A-Z0-9_]+\b/i },
  { label: "import_meta_env", pattern: /import\.meta\.env/i },
  { label: "replace_placeholder", pattern: /REPLACE_WITH/i },
  { label: "api_example_placeholder", pattern: /\bapi\.example\.com\b/i },
  { label: "undefined_api_base", pattern: /undefined\/api/i },
];

const BOOT_FAILURE_PATTERNS = [
  {
    label: "dynamic_import_failed",
    pattern:
      /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk \d+ failed|ChunkLoadError/i,
  },
  {
    label: "app_session_unavailable",
    pattern:
      /Workspace unavailable|Operator surface unavailable|Authentication is temporarily unavailable|We could not verify your session right now/i,
  },
  {
    label: "api_html_response",
    pattern: /API returned HTML instead of JSON|Check VITE_API_BASE/i,
  },
];

function buildSessionCookies(baseUrl) {
  const explicitCookie = s(
    process.env.AIHQ_FRONTEND_SMOKE_USER_SESSION_COOKIE ||
      process.env.AIHQ_USER_SESSION_COOKIE ||
      process.env.AIHQ_PROD_USER_SESSION_COOKIE ||
      process.env.AIHQ_SMOKE_USER_SESSION_COOKIE
  );
  const explicitToken = s(
    process.env.AIHQ_FRONTEND_SMOKE_USER_SESSION_TOKEN ||
      process.env.AIHQ_USER_SESSION_TOKEN ||
      process.env.AIHQ_PROD_USER_SESSION_TOKEN ||
      process.env.AIHQ_SMOKE_USER_SESSION_TOKEN
  );

  const pairs = [];

  if (explicitCookie) {
    const cookieHeader = explicitCookie.replace(/^cookie:\s*/i, "");

    for (const part of cookieHeader.split(";")) {
      const raw = s(part);
      if (!raw || !raw.includes("=")) continue;

      const index = raw.indexOf("=");
      const name = raw.slice(0, index).trim();
      const value = raw.slice(index + 1).trim();

      if (!name || COOKIE_ATTRIBUTE_NAMES.has(name.toLowerCase())) continue;

      pairs.push({ name, value });
    }
  } else if (explicitToken) {
    pairs.push({ name: "aihq_user", value: explicitToken });
  }

  if (!pairs.length) return [];

  const url = new URL(baseUrl);

  return pairs.map((pair) => ({
    url: url.origin,
    name: pair.name,
    value: pair.value,
    path: "/",
    secure: url.protocol === "https:",
    httpOnly: true,
    sameSite: "Lax",
  }));
}

function isIgnoredConsoleError(item = {}) {
  const text = s(item.text).toLowerCase();
  const locationUrl = s(item.location?.url).toLowerCase();
  const combined = `${text} ${locationUrl}`;

  if (combined.includes("favicon")) return true;
  if (combined.includes("manifest.webmanifest")) return true;
  if (
    (combined.includes("/api/auth/me") ||
      combined.includes("/api/app/bootstrap")) &&
    /\b(401|403)\b/.test(combined)
  ) {
    return true;
  }

  return false;
}

function isAuthBoundary(info = {}) {
  const text = s(info.visibleText).toLowerCase();
  let pathname = "";

  try {
    pathname = new URL(info.finalUrl).pathname;
  } catch {
    pathname = "";
  }

  return (
    pathname === "/login" ||
    text.includes("sign in") ||
    text.includes("create workspace") ||
    text.includes("operator access required") ||
    text.includes("restricted surface")
  );
}

function inspectTextForPatternHits(text = "", patterns = []) {
  const hits = [];

  for (const item of patterns) {
    const match = s(text).match(item.pattern);
    if (match) {
      hits.push({
        label: item.label,
        match: s(match[0]).slice(0, 120),
      });
    }
  }

  return hits;
}

async function collectPageInfo(page) {
  return page.evaluate(() => {
    const root = document.querySelector("#root");
    const visibleText = String(document.body?.innerText || "").trim();
    const rootText = String(root?.innerText || "").trim();
    const htmlText = String(document.documentElement?.innerHTML || "");
    const appShellPresent = Boolean(
      document.querySelector("main, nav, header, form, [data-testid], .app-shell")
    );
    const interactiveCount = document.querySelectorAll(
      "a, button, input, textarea, select, [role='button'], [role='link']"
    ).length;

    return {
      title: String(document.title || "").trim(),
      finalUrl: window.location.href,
      rootPresent: Boolean(root),
      rootChildCount: root?.childElementCount || 0,
      visibleText,
      visibleTextLength: visibleText.length,
      rootTextLength: rootText.length,
      htmlText: htmlText.slice(0, 8000),
      appShellPresent,
      interactiveCount,
    };
  });
}

function summarizeFailureList(items = [], limit = 5) {
  return items.slice(0, limit);
}

function resolveExpectedReleaseSha() {
  return normalizeSha(
    pickFirst(
      process.env.AIHQ_EXPECTED_RELEASE_SHA,
      process.env.EXPECTED_RELEASE_SHA,
      process.env.AIHQ_RELEASE_SHA,
      process.env.RELEASE_SHA,
      process.env.GITHUB_SHA
    )
  );
}

function releaseShaMatches(candidate = "", expected = "") {
  const actual = normalizeSha(candidate);
  const wanted = normalizeSha(expected);

  if (!actual || !wanted) return false;
  if (actual === wanted) return true;

  const minLength = Math.min(actual.length, wanted.length);
  if (minLength < 7) return false;

  return actual.startsWith(wanted) || wanted.startsWith(actual);
}

function extractBuildMetaShaCandidates(meta = {}) {
  return [
    meta.fullSha,
    meta.releaseSha,
    meta.commitSha,
    meta.gitSha,
    meta.sha,
    meta.build?.fullSha,
    meta.build?.releaseSha,
    meta.build?.sha,
  ]
    .map((value) => normalizeSha(value))
    .filter(Boolean);
}

async function fetchJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "cache-control": "no-cache",
      },
      signal: controller.signal,
    });
    const text = await response.text().catch(() => "");
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text.slice(0, 500) };
    }

    return {
      ok: response.ok,
      status: response.status,
      json,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      json: null,
      error:
        error?.name === "AbortError"
          ? "request_timeout"
          : s(error?.message || error || "request_failed"),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function verifyFrontendBuildIdentity(baseUrl, config) {
  const expectedSha = normalizeSha(config.expectedReleaseSha);
  const url = buildMetaUrl(baseUrl);

  if (!expectedSha) {
    return {
      ok: !config.requireReleaseSha,
      skipped: !config.requireReleaseSha,
      summary: {
        url: redactUrl(url),
        expectedShaConfigured: false,
        requireReleaseSha: config.requireReleaseSha,
        reasonCode: config.requireReleaseSha
          ? "missing_expected_release_sha"
          : "expected_release_sha_not_configured",
      },
      failures: config.requireReleaseSha
        ? [
            "AIHQ_EXPECTED_RELEASE_SHA is required when AIHQ_FRONTEND_PROD_SMOKE_REQUIRE_RELEASE_SHA=1.",
          ]
        : [],
    };
  }

  const response = await fetchJson(url, config.timeoutMs);
  const meta = response.json || {};
  const candidates = extractBuildMetaShaCandidates(meta);
  const matched = candidates.some((candidate) =>
    releaseShaMatches(candidate, expectedSha)
  );
  const summary = {
    url: redactUrl(url),
    status: response.status,
    service: s(meta.service),
    marker: s(meta.marker || meta.build?.marker),
    deployedSha: candidates[0] || "",
    expectedSha,
    candidateShas: candidates,
  };

  if (!response.ok) {
    return {
      ok: false,
      summary,
      failures: [
        `frontend build metadata returned HTTP ${response.status || 0}`,
        s(response.error),
      ].filter(Boolean),
    };
  }

  if (!matched) {
    return {
      ok: false,
      summary,
      failures: [
        "deployed frontend build metadata does not match expected release SHA",
      ],
    };
  }

  return {
    ok: true,
    summary,
  };
}

async function verifyRoute(context, baseUrl, route, config) {
  const page = await context.newPage();
  const url = buildRouteUrl(baseUrl, route.path);
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  const fatalResponses = [];
  const placeholderRequests = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    consoleErrors.push({
      text: message.text(),
      location: message.location(),
    });
  });

  page.on("pageerror", (error) => {
    pageErrors.push(s(error?.message || error));
  });

  page.on("request", (request) => {
    const requestUrl = request.url();
    const hit = PLACEHOLDER_PATTERNS.find((item) => item.pattern.test(requestUrl));
    if (hit) {
      placeholderRequests.push({
        label: hit.label,
        url: redactUrl(requestUrl),
        resourceType: request.resourceType(),
      });
    }
  });

  page.on("requestfailed", (request) => {
    const resourceType = request.resourceType();
    if (["image", "media", "font"].includes(resourceType)) return;

    requestFailures.push({
      url: redactUrl(request.url()),
      resourceType,
      failure: request.failure()?.errorText || "request_failed",
    });
  });

  page.on("response", (response) => {
    const request = response.request();
    const status = response.status();
    const responseUrl = response.url();
    const resourceType = request.resourceType();
    const contentType = s(response.headers()["content-type"]).toLowerCase();
    const isAuthMe = /\/api\/auth\/me(?:\?|$)/.test(responseUrl);
    const isAppBootstrap = /\/api\/app\/bootstrap(?:\?|$)/.test(responseUrl);

    if (status >= 500) {
      fatalResponses.push({
        status,
        url: redactUrl(responseUrl),
        resourceType,
      });
      return;
    }

    if (
      status >= 400 &&
      ["document", "script", "stylesheet"].includes(resourceType)
    ) {
      fatalResponses.push({
        status,
        url: redactUrl(responseUrl),
        resourceType,
      });
      return;
    }

    if ((isAuthMe || isAppBootstrap) && ![200, 401, 403].includes(status)) {
      fatalResponses.push({
        status,
        url: redactUrl(responseUrl),
        resourceType,
      });
      return;
    }

    if (
      (isAuthMe || isAppBootstrap) &&
      status === 200 &&
      contentType &&
      !contentType.includes("application/json")
    ) {
      fatalResponses.push({
        status,
        url: redactUrl(responseUrl),
        resourceType,
        contentType,
        reason: "api_response_not_json",
      });
    }
  });

  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: config.timeoutMs,
    });

    await page.waitForLoadState("load", { timeout: 5000 }).catch(() => {});
    await page
      .waitForFunction(
        () => {
          const root = document.querySelector("#root");
          const bodyText = String(document.body?.innerText || "").trim();
          const rootText = String(root?.innerText || "").trim();
          const interactiveCount = document.querySelectorAll(
            "a, button, input, textarea, select, [role='button'], [role='link']"
          ).length;

          return rootText.length >= 8 || bodyText.length >= 8 || interactiveCount > 0;
        },
        null,
        { timeout: config.timeoutMs }
      )
      .catch(() => {});

    await page.waitForTimeout(config.settleMs);

    const info = await collectPageInfo(page);
    const failures = [];
    const status = response?.status() || 0;

    if (!response) {
      failures.push("no document response was returned");
    } else if (status < 200 || status >= 400) {
      failures.push(`document returned HTTP ${status}`);
    }

    if (!info.rootPresent) {
      failures.push("#root is missing");
    }

    if (info.visibleTextLength < 8 && info.interactiveCount === 0) {
      failures.push("page rendered blank or near-blank content");
    }

    if (!info.title && !info.appShellPresent) {
      failures.push("document title is empty and no app shell marker rendered");
    }

    const visibleAndHtml = `${info.visibleText}\n${info.htmlText}`;
    const placeholderHits = inspectTextForPatternHits(
      visibleAndHtml,
      PLACEHOLDER_PATTERNS
    );
    const bootFailureHits = inspectTextForPatternHits(
      visibleAndHtml,
      BOOT_FAILURE_PATTERNS
    );
    const fatalConsoleErrors = consoleErrors.filter(
      (item) => !isIgnoredConsoleError(item)
    );

    if (placeholderHits.length) {
      failures.push(`placeholder/env leak detected: ${JSON.stringify(placeholderHits)}`);
    }

    if (bootFailureHits.length) {
      failures.push(`boot failure text detected: ${JSON.stringify(bootFailureHits)}`);
    }

    if (placeholderRequests.length) {
      failures.push(
        `placeholder request detected: ${JSON.stringify(placeholderRequests)}`
      );
    }

    if (fatalResponses.length) {
      failures.push(
        `fatal HTTP responses: ${JSON.stringify(summarizeFailureList(fatalResponses))}`
      );
    }

    if (requestFailures.length) {
      failures.push(
        `request failures: ${JSON.stringify(summarizeFailureList(requestFailures))}`
      );
    }

    if (pageErrors.length) {
      failures.push(
        `uncaught page errors: ${JSON.stringify(summarizeFailureList(pageErrors))}`
      );
    }

    if (fatalConsoleErrors.length) {
      failures.push(
        `browser console errors: ${JSON.stringify(
          summarizeFailureList(fatalConsoleErrors)
        )}`
      );
    }

    const consoleBootFailures = fatalConsoleErrors
      .map((item) => item.text)
      .filter((text) =>
        BOOT_FAILURE_PATTERNS.some((pattern) => pattern.pattern.test(text))
      );

    if (consoleBootFailures.length) {
      failures.push(
        `browser boot failure console errors: ${JSON.stringify(
          summarizeFailureList(consoleBootFailures)
        )}`
      );
    }

    if (!config.hasSession && route.auth === "protected" && !isAuthBoundary(info)) {
      failures.push(
        "protected route did not render a login/auth boundary without a smoke session"
      );
    }

    const summary = {
      path: route.path,
      requestedUrl: redactUrl(url),
      finalUrl: redactUrl(info.finalUrl),
      status,
      title: info.title,
      visibleTextLength: info.visibleTextLength,
      interactiveCount: info.interactiveCount,
      authBoundary: isAuthBoundary(info),
    };

    if (failures.length) {
      return {
        ok: false,
        summary,
        failures,
      };
    }

    return {
      ok: true,
      summary,
    };
  } catch (error) {
    return {
      ok: false,
      summary: {
        path: route.path,
        requestedUrl: redactUrl(url),
        finalUrl: redactUrl(page.url()),
        status: 0,
      },
      failures: [s(error?.message || error || "route_smoke_failed")],
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function runAttempt({ chromium, baseUrl, config }) {
  const buildIdentity = await verifyFrontendBuildIdentity(baseUrl, config);
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      ignoreHTTPSErrors: false,
    });
    const cookies = buildSessionCookies(baseUrl);
    const hasSession = cookies.length > 0;

    if (hasSession) {
      await context.addCookies(cookies);
    }

    const routeConfig = {
      ...config,
      hasSession,
    };
    const results = [];

    for (const route of ROUTES) {
      results.push(await verifyRoute(context, baseUrl, route, routeConfig));
    }

    await context.close().catch(() => {});

    return {
      ok: buildIdentity.ok && results.every((result) => result.ok),
      hasSession,
      buildIdentity,
      results,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

function renderAttemptResult(attempt, result) {
  printLine(
    "#",
    "Frontend production smoke attempt",
    JSON.stringify({ attempt, hasSession: result.hasSession })
  );

  const buildPrefix = result.buildIdentity?.ok
    ? result.buildIdentity.skipped
      ? "WARN"
      : "OK"
    : "FAIL";
  printLine(
    buildPrefix,
    "frontend_build_identity",
    JSON.stringify(result.buildIdentity?.summary || {})
  );

  if (!result.buildIdentity?.ok) {
    for (const failure of result.buildIdentity?.failures || []) {
      printLine("!", "frontend_build_identity", failure);
    }
  }

  for (const route of result.results) {
    const prefix = route.ok ? "OK" : "FAIL";
    printLine(prefix, route.summary.path, JSON.stringify(route.summary));

    if (!route.ok) {
      for (const failure of route.failures || []) {
        printLine("!", route.summary.path, failure);
      }
    }
  }
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.AIHQ_FRONTEND_PROD_URL);
  const timeoutMs = Math.max(
    5000,
    n(process.env.AIHQ_FRONTEND_PROD_SMOKE_TIMEOUT_MS, 25000)
  );
  const settleMs = Math.max(
    250,
    n(process.env.AIHQ_FRONTEND_PROD_SMOKE_SETTLE_MS, 750)
  );
  const attempts = Math.max(
    1,
    n(process.env.AIHQ_FRONTEND_PROD_SMOKE_ATTEMPTS, 1)
  );
  const delayMs = Math.max(
    0,
    n(process.env.AIHQ_FRONTEND_PROD_SMOKE_DELAY_MS, 10000)
  );
  const expectedReleaseSha = resolveExpectedReleaseSha();
  const requireReleaseSha = bool(
    process.env.AIHQ_FRONTEND_PROD_SMOKE_REQUIRE_RELEASE_SHA,
    false
  );

  if (!baseUrl) {
    printLine(
      "FAIL",
      "frontend_prod_smoke",
      "AIHQ_FRONTEND_PROD_URL is required and must be an http(s) URL."
    );
    process.exit(1);
  }

  const { chromium } = await import("playwright");
  const config = {
    timeoutMs,
    settleMs,
    expectedReleaseSha,
    requireReleaseSha,
  };

  printLine(
    "#",
    "Frontend production smoke mode",
    JSON.stringify({
      baseUrl: redactUrl(baseUrl),
      attempts,
      delayMs,
      timeoutMs,
      settleMs,
      expectedReleaseShaConfigured: Boolean(expectedReleaseSha),
      requireReleaseSha,
      routes: ROUTES.map((route) => route.path),
    })
  );

  let lastResult = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastResult = await runAttempt({ chromium, baseUrl, config });
    renderAttemptResult(attempt, lastResult);

    if (lastResult.ok) {
      printLine("OK", "Frontend production smoke passed");
      process.exit(0);
    }

    if (attempt < attempts) {
      printLine(
        "!",
        "Frontend production smoke retry scheduled",
        JSON.stringify({ nextAttemptInMs: delayMs })
      );
      await sleep(delayMs);
    }
  }

  const failedRoutes = (lastResult?.results || [])
    .filter((result) => !result.ok)
    .map((result) => result.summary.path);

  printLine(
    "FAIL",
    "Frontend production smoke failed",
    JSON.stringify({ failedRoutes })
  );
  process.exit(1);
}

main().catch((error) => {
  printLine("FAIL", "frontend_prod_smoke", s(error?.message || error));
  process.exit(1);
});
