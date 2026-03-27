import { pathToFileURL } from "node:url";

function applyEnv(entries = {}) {
  for (const [key, value] of Object.entries(entries)) {
    process.env[key] = String(value);
  }
}

async function importFresh(pathname) {
  const url =
    pathname instanceof URL ? new URL(pathname.href) : pathToFileURL(pathname);
  url.searchParams.set("ts", String(Date.now()));
  url.searchParams.set("rand", Math.random().toString(36).slice(2));
  return import(url.href);
}

const root = new URL("../", import.meta.url);

const sidecarBaseEnv = {
  APP_ENV: "test",
  PORT: "0",
  PUBLIC_BASE_URL: "https://api.example.com",
  AIHQ_BASE_URL: "https://aihq.example.com",
  AIHQ_INTERNAL_TOKEN: "ci-internal-token",
  REQUIRE_OPERATIONAL_READINESS_ON_BOOT: "0",
  STARTUP_SMOKE: "1",
};

applyEnv({
  APP_ENV: "test",
  DATABASE_URL: "postgresql://ci_user:ci_password@127.0.0.1:5432/aihq_ci",
  ADMIN_SESSION_SECRET: "ci-admin-session-secret",
  USER_SESSION_SECRET: "ci-user-session-secret",
  AIHQ_INTERNAL_TOKEN: "ci-internal-token",
  DEBUG_API_TOKEN: "ci-debug-token",
  OPENAI_MAX_OUTPUT_TOKENS: "1024",
  VAPID_PUBLIC_KEY: "BElCiExamplePublicKey1234567890abcdefghijklmnop",
  VAPID_PRIVATE_KEY: "ci-vapid-private-key",
});
const loader = await importFresh(new URL("../scripts/workspace-module-loader.mjs", import.meta.url));
if (loader.getWorkspaceModuleLoaderStatus().mode !== "module.register") {
  throw new Error("workspace_loader_registration_mode_invalid");
}
await importFresh(new URL("../ai-hq-backend/scripts/validate-env.mjs", import.meta.url));

applyEnv({
  ...sidecarBaseEnv,
  VERIFY_TOKEN: "ci-meta-verify-token",
  META_APP_SECRET: "ci-meta-app-secret",
  CONTACT_EMAIL: "platform@example.com",
});
await importFresh(new URL("../meta-bot-backend/scripts/validate-env.mjs", import.meta.url));
await importFresh(new URL("../meta-bot-backend/server.js", import.meta.url));

applyEnv({
  ...sidecarBaseEnv,
  CORS_ORIGIN: "https://app.example.com",
  OPENAI_API_KEY: "ci-openai-key",
  TWILIO_ACCOUNT_SID: "TWILIO_ACCOUNT_SID_PLACEHOLDER",
  TWILIO_API_KEY: "TWILIO_API_KEY_PLACEHOLDER",
  TWILIO_API_SECRET: "TWILIO_API_SECRET_PLACEHOLDER",
  TWILIO_TWIML_APP_SID: "TWILIO_TWIML_APP_SID_PLACEHOLDER",
  TWILIO_AUTH_TOKEN: "TWILIO_AUTH_TOKEN_PLACEHOLDER",
  TWILIO_CALLER_ID: "TWILIO_CALLER_ID_PLACEHOLDER",
});
await importFresh(new URL("../twilio-voice-backend/scripts/validate-env.mjs", import.meta.url));
await importFresh(new URL("../twilio-voice-backend/server.js", import.meta.url));

console.log("[workspace-startup-compat] OK", {
  root: root.pathname,
});
