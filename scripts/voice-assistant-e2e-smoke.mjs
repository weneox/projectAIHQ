import { chromium } from "playwright";

const BASE_URL = s(process.env.AIHQ_E2E_BASE_URL || "https://hq.weneox.com").replace(
  /\/+$/,
  ""
);
const TARGET_URL = `${BASE_URL}/voice-assistant`;
const ORIGIN = BASE_URL;

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function safeStatus(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

async function readSafeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fillLogin(page, email, password) {
  const emailInput = page
    .locator('input[type="email"], input[name="email"], input[autocomplete="email"]')
    .first();
  const passwordInput = page
    .locator('input[type="password"], input[name="password"], input[autocomplete="current-password"]')
    .first();

  await emailInput.waitFor({ state: "visible", timeout: 15000 });
  await emailInput.fill(email);
  await passwordInput.fill(password);

  const submit = page
    .getByRole("button", { name: /sign in|log in|login|continue/i })
    .first();
  await Promise.all([
    page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}),
    submit.click(),
  ]);
}

async function createTestAccount(page) {
  const timestamp = Date.now();
  const email = `aihq.voice.e2e+${timestamp}@gmail.com`;
  const password = `AihqVoice${timestamp}!9`;

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  const createOne = page.getByRole("button", { name: "Create one" }).first();
  await createOne.waitFor({ state: "visible", timeout: 15000 });
  await createOne.click();

  await page.getByRole("textbox", { name: "Full name" }).fill("AIHQ Voice E2E");
  await page
    .getByRole("textbox", { name: "Workspace name" })
    .fill(`Voice E2E ${timestamp}`);
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);

  const signupResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/auth/signup"),
    { timeout: 30000 }
  );
  await Promise.all([
    page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}),
    page.getByRole("button", { name: "Create workspace" }).click(),
  ]);
  const signupResponse = await signupResponsePromise.catch(() => null);
  if (signupResponse) {
    console.log(`signup status ${signupResponse.status()}`);
  } else {
    console.log("signup status missing");
  }

  const returnToWorkspace = page
    .getByRole("button", { name: "Return to workspace" })
    .first();
  const localizedReturnToWorkspace = page
    .locator("button")
    .filter({ hasText: /workspace|iş masası|müştəri mərkəzi|qayıt|return/i })
    .first();
  if (await returnToWorkspace.isVisible({ timeout: 8000 }).catch(() => false)) {
    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}),
      returnToWorkspace.click(),
    ]);
  } else if (
    await localizedReturnToWorkspace.isVisible({ timeout: 3000 }).catch(() => false)
  ) {
    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}),
      localizedReturnToWorkspace.click(),
    ]);
  }

  return { method: "self_signup" };
}

async function ensureLoggedIn(page, email, password) {
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const loginVisible = await page
    .locator('input[type="password"], input[name="password"]')
    .first()
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (loginVisible || page.url().includes("/login")) {
    if (email && password) {
      await fillLogin(page, email, password);
    } else {
      await createTestAccount(page);
    }
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
  }
}

async function clickStartCall(page) {
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

  const startButton = page.locator("button").filter({ hasText: /start call/i }).first();
  try {
    await startButton.waitFor({ state: "visible", timeout: 30000 });
  } catch (error) {
    const text = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
    console.log(`voice page url ${page.url()}`);
    console.log(
      `voice page text ${s(text)
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
        .slice(0, 600)}`
    );
    throw error;
  }
  await startButton.click();
}

function summarize({ session, openaiCall, realtimeLink }) {
  const sessionBody = session?.body || {};
  const realtimeLinkBody = realtimeLink?.body || {};
  return {
    sessionStatus: safeStatus(session?.status),
    sessionError: s(sessionBody.error || sessionBody.code),
    browserCallIdPresent: !!s(sessionBody.browserCallId || sessionBody.callId),
    openaiCallsStatus: safeStatus(openaiCall?.status),
    locationPresent: /\/v1\/realtime\/calls\/rtc_[A-Za-z0-9_-]+/.test(
      s(openaiCall?.location)
    ),
    realtimeLinkStatus: safeStatus(realtimeLink?.status),
    sidebandLifecycleState: s(realtimeLinkBody.sidebandLifecycle?.state),
    sidebandRunnerStatus: s(realtimeLinkBody.sidebandRunner?.status),
    sidebandRunnerReasonCode: s(realtimeLinkBody.sidebandRunner?.reasonCode),
  };
}

function printSummary(summary) {
  console.log(`session status ${summary.sessionStatus ?? ""}`);
  console.log(`session error ${summary.sessionError}`);
  console.log(`browserCallId present ${summary.browserCallIdPresent}`);
  console.log(`OpenAI calls status ${summary.openaiCallsStatus ?? ""}`);
  console.log(`location present ${summary.locationPresent}`);
  console.log(`realtime-link status ${summary.realtimeLinkStatus ?? ""}`);
  console.log(`sidebandLifecycle.state ${summary.sidebandLifecycleState}`);
  console.log(
    `sidebandRunner.status/reasonCode ${summary.sidebandRunnerStatus}/${summary.sidebandRunnerReasonCode}`
  );
}

async function main() {
  const email = s(process.env.AIHQ_E2E_EMAIL);
  const password = s(process.env.AIHQ_E2E_PASSWORD);

  const observed = {
    session: null,
    openaiCall: null,
    realtimeLink: null,
  };

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });

  try {
    const context = await browser.newContext({
      permissions: ["microphone"],
    });
    await context.grantPermissions(["microphone"], { origin: ORIGIN });

    const page = await context.newPage();
    page.on("response", async (response) => {
      const url = response.url();

      if (url.includes("/api/voice/browser/session")) {
        observed.session = {
          status: response.status(),
          body: await readSafeJson(response),
        };
      }

      if (url === "https://api.openai.com/v1/realtime/calls") {
        observed.openaiCall = {
          status: response.status(),
          location: s(response.headers().location),
        };
      }

      if (/\/api\/voice\/browser\/calls\/[^/]+\/realtime-link/.test(url)) {
        observed.realtimeLink = {
          status: response.status(),
          body: await readSafeJson(response),
        };
      }
    });

    await ensureLoggedIn(page, email, password);
    await clickStartCall(page);
    await page
      .waitForResponse(
        (response) =>
          /\/api\/voice\/browser\/calls\/[^/]+\/realtime-link/.test(response.url()),
        { timeout: 75000 }
      )
      .catch(() => {});

    const summary = summarize(observed);
    printSummary(summary);

    if (
      summary.sessionStatus !== 200 ||
      !summary.browserCallIdPresent ||
      summary.openaiCallsStatus !== 201 ||
      !summary.locationPresent ||
      summary.realtimeLinkStatus !== 200 ||
      !summary.sidebandLifecycleState ||
      !summary.sidebandRunnerStatus
    ) {
      throw new Error("voice assistant realtime-link smoke failed");
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(s(error?.message || error));
  process.exitCode = 1;
});
