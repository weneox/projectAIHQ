function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniq(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function hasProtocol(value = "") {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s(value));
}

function normalizeHost(hostname = "") {
  return lower(hostname).replace(/^www\./, "");
}

function includesAny(haystack = "", needles = []) {
  const text = lower(haystack);
  return needles.some((needle) => text.includes(lower(needle)));
}

function headerValue(headers = {}, name = "") {
  const target = lower(name);
  for (const [key, value] of Object.entries(obj(headers))) {
    if (lower(key) === target) return s(value);
  }
  return "";
}

export function normalizeWebsiteInstallUrl(raw = "", { allowLocalhost = false } = {}) {
  const input = s(raw);

  if (!input) {
    return {
      ok: false,
      error: "website_url_required",
      message: "Add the website URL first.",
    };
  }

  const candidate = hasProtocol(input) ? input : `https://${input}`;

  let parsed = null;
  try {
    parsed = new URL(candidate);
  } catch {
    return {
      ok: false,
      error: "website_url_invalid",
      input,
      message: "Enter a valid website URL.",
    };
  }

  const protocol = lower(parsed.protocol.replace(":", ""));
  const hostname = normalizeHost(parsed.hostname);
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost");

  if (!["http", "https"].includes(protocol)) {
    return {
      ok: false,
      error: "website_url_protocol_unsupported",
      input,
      message: "Website chat supports http and https websites only.",
    };
  }

  if (isLocalhost && !allowLocalhost) {
    return {
      ok: false,
      error: "website_url_localhost_not_allowed",
      input,
      message: "Use a public website URL for live website chat setup.",
    };
  }

  return {
    ok: true,
    input,
    href: parsed.href,
    origin: `${parsed.protocol}//${parsed.host}`.toLowerCase(),
    hostname,
    host: lower(parsed.host),
    protocol,
    https: protocol === "https",
    localhost: isLocalhost,
  };
}

const PLATFORM_RULES = [
  {
    id: "wordpress",
    label: "WordPress",
    confidence: "high",
    needles: ["wp-content", "wp-includes", "wp-json", "wordpress"],
  },
  {
    id: "shopify",
    label: "Shopify",
    confidence: "high",
    needles: ["cdn.shopify.com", "shopify.theme", "myshopify.com", "shopify"],
  },
  {
    id: "wix",
    label: "Wix",
    confidence: "high",
    needles: ["wixstatic.com", "wix.com", "x-wix"],
  },
  {
    id: "webflow",
    label: "Webflow",
    confidence: "high",
    needles: ["webflow.js", "data-wf-page", "webflow.io", "webflow"],
  },
  {
    id: "squarespace",
    label: "Squarespace",
    confidence: "high",
    needles: ["squarespace.com", "static1.squarespace.com", "squarespace"],
  },
  {
    id: "framer",
    label: "Framer",
    confidence: "medium",
    needles: ["framerusercontent.com", "framer.website", "data-framer"],
  },
  {
    id: "tilda",
    label: "Tilda",
    confidence: "high",
    needles: ["tilda.cc", "tildacdn.com", "t-rec"],
  },
];

function detectGoogleTagManager(haystack = "") {
  return includesAny(haystack, ["googletagmanager.com/gtm.js", "gtm-", "google tag manager"]);
}

function detectCloudflare(headers = {}, haystack = "") {
  return Boolean(
    headerValue(headers, "cf-ray") ||
      headerValue(headers, "cf-cache-status") ||
      lower(headerValue(headers, "server")).includes("cloudflare") ||
      includesAny(haystack, ["cloudflare"])
  );
}

export function detectWebsiteInstallEnvironment({
  websiteUrl = "",
  html = "",
  headers = {},
  hints = [],
} = {}) {
  const normalizedUrl = normalizeWebsiteInstallUrl(websiteUrl, {
    allowLocalhost: true,
  });
  const hintText = uniq(hints).join(" ");
  const haystack = [
    normalizedUrl.ok ? normalizedUrl.href : websiteUrl,
    html,
    JSON.stringify(obj(headers)),
    hintText,
  ].join("\n");

  const technologies = [];
  const signals = [];

  for (const rule of PLATFORM_RULES) {
    if (includesAny(haystack, rule.needles)) {
      technologies.push({
        id: rule.id,
        label: rule.label,
        confidence: rule.confidence,
      });
      signals.push(`${rule.id}_signal`);
    }
  }

  if (detectGoogleTagManager(haystack)) {
    technologies.push({
      id: "google_tag_manager",
      label: "Google Tag Manager",
      confidence: "medium",
    });
    signals.push("google_tag_manager_signal");
  }

  if (detectCloudflare(headers, haystack)) {
    technologies.push({
      id: "cloudflare",
      label: "Cloudflare",
      confidence: "medium",
      type: "infrastructure",
    });
    signals.push("cloudflare_signal");
  }

  const primary =
    technologies.find((item) => item.type !== "infrastructure" && item.id !== "google_tag_manager") ||
    null;

  return {
    website: normalizedUrl,
    primaryPlatform: primary
      ? {
          id: primary.id,
          label: primary.label,
          confidence: primary.confidence,
        }
      : {
          id: "custom_or_unknown",
          label: "Custom or unknown website",
          confidence: technologies.length ? "medium" : "unknown",
        },
    technologies,
    signals,
    hasGoogleTagManager: technologies.some((item) => item.id === "google_tag_manager"),
    hasCloudflare: technologies.some((item) => item.id === "cloudflare"),
  };
}

const SECURITY_BASELINE = [
  {
    id: "domain_or_origin_allowlist",
    label: "Domain/origin allowlist",
    required: true,
    reason: "The widget must only run on approved websites.",
  },
  {
    id: "bootstrap_session_tokens",
    label: "Bootstrap and session tokens",
    required: true,
    reason: "Public visitors should not receive tenant secrets.",
  },
  {
    id: "rate_limit",
    label: "Public endpoint rate limit",
    required: true,
    reason: "Public chat endpoints must resist abuse.",
  },
  {
    id: "truth_runtime_gate",
    label: "Truth/runtime gate",
    required: true,
    reason: "AI replies must stay grounded and fail closed.",
  },
  {
    id: "manual_first_launch",
    label: "Manual-first launch",
    required: true,
    reason: "New website installs should be tested before autonomous replies.",
  },
];

const INSTALL_METHODS = {
  wordpress_plugin: {
    id: "wordpress_plugin",
    label: "WordPress plugin",
    category: "no_code_platform",
    noCode: true,
    requiresCodeAccess: false,
    requiresDeveloper: false,
    requiresCmsAdmin: true,
    requiresDnsAccess: false,
    userEffort: "low",
    securityLevel: "high",
    summary: "Install the AIHQ WordPress plugin and connect the site without editing theme code.",
    primaryAction: "Install WordPress plugin",
  },
  shopify_app: {
    id: "shopify_app",
    label: "Shopify app embed",
    category: "no_code_platform",
    noCode: true,
    requiresCodeAccess: false,
    requiresDeveloper: false,
    requiresCmsAdmin: true,
    requiresDnsAccess: false,
    userEffort: "low",
    securityLevel: "high",
    summary: "Use a Shopify app/embed flow instead of asking the user to edit theme code.",
    primaryAction: "Connect Shopify",
  },
  platform_admin_embed: {
    id: "platform_admin_embed",
    label: "Platform admin embed",
    category: "guided_platform",
    noCode: true,
    requiresCodeAccess: false,
    requiresDeveloper: false,
    requiresCmsAdmin: true,
    requiresDnsAccess: false,
    userEffort: "medium",
    securityLevel: "high",
    summary: "Use the website builder admin panel to add AIHQ chat through an embed/custom-code area.",
    primaryAction: "Open platform guide",
  },
  google_tag_manager: {
    id: "google_tag_manager",
    label: "Google Tag Manager template",
    category: "tag_manager",
    noCode: true,
    requiresCodeAccess: false,
    requiresDeveloper: false,
    requiresCmsAdmin: false,
    requiresDnsAccess: false,
    requiresTagManagerAccess: true,
    userEffort: "low",
    securityLevel: "high",
    summary: "Publish the widget through a controlled Google Tag Manager template.",
    primaryAction: "Connect Google Tag Manager",
  },
  cloudflare_auto_injection: {
    id: "cloudflare_auto_injection",
    label: "Cloudflare automatic install",
    category: "edge_injection",
    noCode: true,
    requiresCodeAccess: false,
    requiresDeveloper: false,
    requiresCmsAdmin: false,
    requiresDnsAccess: true,
    requiresCloudflareAccess: true,
    userEffort: "low",
    securityLevel: "high",
    summary: "Inject the widget safely at the edge for selected domains and paths.",
    primaryAction: "Connect Cloudflare",
  },
  developer_invite: {
    id: "developer_invite",
    label: "Send install invite to developer",
    category: "delegated_install",
    noCode: true,
    requiresCodeAccess: false,
    requiresDeveloper: true,
    requiresCmsAdmin: false,
    requiresDnsAccess: false,
    userEffort: "low",
    securityLevel: "high",
    summary: "Send a safe install request to the person who manages the website.",
    primaryAction: "Invite developer",
  },
  managed_support: {
    id: "managed_support",
    label: "Managed install support",
    category: "assisted_install",
    noCode: true,
    requiresCodeAccess: false,
    requiresDeveloper: false,
    requiresCmsAdmin: false,
    requiresDnsAccess: false,
    userEffort: "low",
    securityLevel: "high",
    summary: "Let support guide the install when the user does not know how the site is managed.",
    primaryAction: "Request install help",
  },
  manual_snippet: {
    id: "manual_snippet",
    label: "Manual script snippet",
    category: "developer_fallback",
    noCode: false,
    requiresCodeAccess: true,
    requiresDeveloper: true,
    requiresCmsAdmin: false,
    requiresDnsAccess: false,
    userEffort: "high",
    securityLevel: "medium",
    summary: "Fallback for technical users or developers. This should not be the default user path.",
    primaryAction: "Copy developer snippet",
  },
};

function cloneMethod(id, extra = {}) {
  return {
    ...INSTALL_METHODS[id],
    ...extra,
  };
}

function platformMethodId(platformId = "") {
  switch (platformId) {
    case "wordpress":
      return "wordpress_plugin";
    case "shopify":
      return "shopify_app";
    case "wix":
    case "webflow":
    case "squarespace":
    case "framer":
    case "tilda":
      return "platform_admin_embed";
    default:
      return "";
  }
}

function accessBoolean(access = {}, ...keys) {
  return keys.some((key) => access[key] === true);
}

function buildAccessState(access = {}, developer = {}) {
  return {
    cmsAdmin: accessBoolean(access, "cmsAdmin", "websiteAdmin", "platformAdmin"),
    tagManager: accessBoolean(access, "tagManager", "googleTagManager", "gtm"),
    cloudflare: accessBoolean(access, "cloudflare", "cloudflareAdmin"),
    dns: accessBoolean(access, "dns", "domainDns", "domainAdmin"),
    developer:
      accessBoolean(access, "developer", "freelancer") ||
      Boolean(s(developer.email || developer.developerEmail)),
    unknown:
      !Object.keys(obj(access)).length &&
      !s(developer.email || developer.developerEmail),
  };
}

function scoreMethod(method = {}, { access = {}, detected = {} } = {}) {
  let score = 0;

  if (method.noCode) score += 50;
  if (method.securityLevel === "high") score += 30;
  if (method.userEffort === "low") score += 30;
  if (method.userEffort === "medium") score += 10;
  if (method.requiresCodeAccess) score -= 80;
  if (method.requiresDeveloper) score -= 20;

  if (method.requiresCmsAdmin && access.cmsAdmin) score += 30;
  if (method.requiresTagManagerAccess && access.tagManager) score += 35;
  if (method.requiresCloudflareAccess && access.cloudflare) score += 35;
  if (method.requiresDnsAccess && access.dns) score += 20;
  if (method.requiresDeveloper && access.developer) score += 35;

  if (method.id === platformMethodId(detected.primaryPlatform?.id)) score += 40;
  if (method.id === "google_tag_manager" && detected.hasGoogleTagManager) score += 25;
  if (method.id === "cloudflare_auto_injection" && detected.hasCloudflare) score += 25;
  if (method.id === "managed_support" && access.unknown) score += 15;
  if (method.id === "manual_snippet") score -= 60;

  return score;
}

function buildCandidateMethods(detected = {}, accessState = {}) {
  const candidates = [];

  const platformId = detected.primaryPlatform?.id;
  const platformMethod = platformMethodId(platformId);

  if (platformMethod) {
    candidates.push(
      cloneMethod(platformMethod, {
        recommendedFor: platformId,
      })
    );
  }

  if (detected.hasGoogleTagManager || accessState.tagManager) {
    candidates.push(cloneMethod("google_tag_manager"));
  }

  if (detected.hasCloudflare || accessState.cloudflare || accessState.dns) {
    candidates.push(cloneMethod("cloudflare_auto_injection"));
  }

  candidates.push(cloneMethod("developer_invite"));
  candidates.push(cloneMethod("managed_support"));
  candidates.push(cloneMethod("manual_snippet"));

  const seen = new Set();
  return candidates.filter((method) => {
    if (!method?.id || seen.has(method.id)) return false;
    seen.add(method.id);
    return true;
  });
}

function resolveSetupStatus({ website = {}, recommended = null } = {}) {
  if (!website.ok) return "needs_website_url";
  if (!recommended) return "needs_install_path";
  if (recommended.id === "managed_support") return "needs_install_help";
  if (recommended.id === "developer_invite") return "needs_developer_invite";
  return "installable";
}

export function buildWebsiteChatInstallPlan({
  websiteUrl = "",
  html = "",
  headers = {},
  hints = [],
  access = {},
  developer = {},
} = {}) {
  const detected = detectWebsiteInstallEnvironment({
    websiteUrl,
    html,
    headers,
    hints,
  });
  const accessState = buildAccessState(access, developer);
  const candidates = buildCandidateMethods(detected, accessState)
    .map((method) => ({
      ...method,
      score: scoreMethod(method, {
        access: accessState,
        detected,
      }),
    }))
    .sort((a, b) => b.score - a.score);

  const recommended = candidates[0] || null;
  const fallbackMethods = candidates.slice(1, 5);

  const status = resolveSetupStatus({
    website: detected.website,
    recommended,
  });

  const nextAction =
    status === "needs_website_url"
      ? {
          id: "add_website_url",
          label: "Add website URL",
          message: detected.website.message,
        }
      : recommended
        ? {
            id: recommended.id,
            label: recommended.primaryAction,
            message: recommended.summary,
          }
        : {
            id: "choose_install_path",
            label: "Choose install path",
            message: "Choose how this website is managed before installing chat.",
          };

  return {
    ok: detected.website.ok === true && Boolean(recommended),
    status,
    website: detected.website,
    detected,
    access: accessState,
    recommendedMethod: recommended,
    fallbackMethods,
    allMethods: candidates,
    securityRequirements: SECURITY_BASELINE,
    snippetIsFallbackOnly: true,
    nextAction,
  };
}

export const __test__ = {
  scoreMethod,
};
