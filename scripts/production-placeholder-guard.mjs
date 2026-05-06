function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function bool(value, fallback = false) {
  const normalized = s(value).toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function printLine(prefix, message, details = "") {
  const suffix = details ? ` ${details}` : "";
  console.log(`${prefix} ${message}${suffix}`);
}

const REQUIRED_ENV = [
  { name: "AIHQ_PROD_BASE_URL", type: "https_url" },
  { name: "AIHQ_PROD_INTERNAL_TOKEN_META_BOT", type: "secret", minLength: 16 },
  { name: "AIHQ_FRONTEND_PROD_URL", type: "https_url" },
  { name: "META_BOT_PROD_BASE_URL", type: "https_url" },
  { name: "TWILIO_VOICE_PROD_BASE_URL", type: "https_url" },
];

const RAILWAY_DEPLOY_HOOK_ENV = [
  { name: "RAILWAY_AIHQ_BACKEND_DEPLOY_HOOK", type: "https_url" },
  { name: "RAILWAY_META_BOT_BACKEND_DEPLOY_HOOK", type: "https_url" },
  { name: "RAILWAY_TWILIO_VOICE_BACKEND_DEPLOY_HOOK", type: "https_url" },
];
const CLOUDFLARE_DEPLOY_HOOK_ENV = [
  { name: "CLOUDFLARE_PAGES_DEPLOY_HOOK", type: "https_url" },
];

const REQUIRED_FLAGS = [
  "POSTDEPLOY_STRICT_SIDECARS",
  "PROD_SPINE_STRICT_SIDECARS",
  "AIHQ_FRONTEND_PROD_SMOKE_REQUIRE_RELEASE_SHA",
  "PROD_SPINE_REQUIRE_BACKEND_RELEASE_SHA",
];

function isNeoxDeployEnabled() {
  return s(process.env.ENABLE_NEOX_FRONTEND_PROD_DEPLOY) === "1";
}

function areRailwayDeployHooksEnabled() {
  return s(process.env.ENABLE_RAILWAY_DEPLOY_HOOKS) === "1";
}
function areCloudflareDeployHooksEnabled() {
  return s(process.env.ENABLE_CLOUDFLARE_DEPLOY_HOOKS) === "1";
}

function isPlaceholderValue(value = "") {
  const raw = s(value);
  const lower = raw.toLowerCase();

  if (!raw) return true;
  return (
    lower.includes("replace_with") ||
    lower.includes("placeholder") ||
    lower.includes("changeme") ||
    lower.includes("example.com") ||
    lower.includes("example.test") ||
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes("::1") ||
    lower.startsWith("ci-") ||
    lower.startsWith("local-") ||
    lower.startsWith("test-") ||
    lower.startsWith("mock-") ||
    lower.startsWith("dummy-") ||
    lower.startsWith("fake-") ||
    lower === "default" ||
    lower === "secret" ||
    lower === "token" ||
    lower === "password"
  );
}

function validateHttpsUrl(name, value) {
  if (isPlaceholderValue(value)) {
    return {
      name,
      ok: false,
      reasonCode: "missing_or_placeholder",
    };
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const invalidHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".test") ||
      hostname === "example.com" ||
      hostname.endsWith(".example.com");

    if (url.protocol !== "https:" || invalidHost) {
      return {
        name,
        ok: false,
        reasonCode: "not_production_https_url",
      };
    }

    return {
      name,
      ok: true,
    };
  } catch {
    return {
      name,
      ok: false,
      reasonCode: "invalid_url",
    };
  }
}

function validateSecret(name, value, minLength = 16) {
  const raw = s(value);

  if (isPlaceholderValue(raw)) {
    return {
      name,
      ok: false,
      reasonCode: "missing_or_placeholder",
    };
  }

  if (raw.length < minLength) {
    return {
      name,
      ok: false,
      reasonCode: "too_short",
    };
  }

  return {
    name,
    ok: true,
  };
}

function validateRequiredEnvItem(item) {
  const value = s(process.env[item.name]);

  if (item.type === "https_url") {
    return validateHttpsUrl(item.name, value);
  }

  return validateSecret(item.name, value, item.minLength || 16);
}

function validateReleaseSha() {
  const value = s(process.env.AIHQ_EXPECTED_RELEASE_SHA);

  if (!value) {
    return {
      name: "AIHQ_EXPECTED_RELEASE_SHA",
      ok: false,
      reasonCode: "missing_expected_release_sha",
    };
  }

  if (!/^[a-f0-9]{7,40}$/i.test(value)) {
    return {
      name: "AIHQ_EXPECTED_RELEASE_SHA",
      ok: false,
      reasonCode: "invalid_sha",
    };
  }

  return {
    name: "AIHQ_EXPECTED_RELEASE_SHA",
    ok: true,
  };
}

function validateStrictFlags() {
  return REQUIRED_FLAGS.map((name) => ({
    name,
    ok: bool(process.env[name], false) === true,
    reasonCode: bool(process.env[name], false) === true ? "" : "strict_flag_not_enabled",
  }));
}

function main() {
  const requiredEnv = [
    ...REQUIRED_ENV,
    ...(areRailwayDeployHooksEnabled() ? RAILWAY_DEPLOY_HOOK_ENV : []),
    ...(areCloudflareDeployHooksEnabled() ? CLOUDFLARE_DEPLOY_HOOK_ENV : []),
    ...(areCloudflareDeployHooksEnabled() && isNeoxDeployEnabled()
      ? [{ name: "CLOUDFLARE_NEOX_FRONTEND_DEPLOY_HOOK", type: "https_url" }]
      : []),
  ];
  const results = [
    ...requiredEnv.map(validateRequiredEnvItem),
    validateReleaseSha(),
    ...validateStrictFlags(),
  ];
  const failures = results.filter((result) => !result.ok);

  for (const failure of failures) {
    printLine(
      "FAIL",
      failure.name,
      JSON.stringify({ reasonCode: failure.reasonCode })
    );
  }

  if (failures.length) {
    printLine(
      "FAIL",
      "production_placeholder_guard",
      JSON.stringify({ failures: failures.length })
    );
    process.exit(1);
  }

  printLine(
    "OK",
    "production_placeholder_guard",
    JSON.stringify({ checked: results.length })
  );
}

main();

