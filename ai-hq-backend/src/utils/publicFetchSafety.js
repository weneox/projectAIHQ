import dns from "node:dns/promises";
import net from "node:net";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function normalizeUrlInput(input = "") {
  const raw = s(input);
  if (!raw) return "";

  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;

  return `https://${raw.replace(/^\/+/, "")}`;
}

function buildDeniedResult(reasonCode, extra = {}) {
  return {
    ok: false,
    reasonCode: s(reasonCode || "unsafe_destination_denied"),
    ...extra,
  };
}

function parseIpv4Int(input = "") {
  const raw = s(input);
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(raw)) return null;

  const parts = raw.split(".").map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }

  return (
    ((parts[0] << 24) >>> 0) +
    ((parts[1] << 16) >>> 0) +
    ((parts[2] << 8) >>> 0) +
    (parts[3] >>> 0)
  ) >>> 0;
}

function ipv4InCidr(ip = "", base = "", prefix = 0) {
  const ipInt = parseIpv4Int(ip);
  const baseInt = parseIpv4Int(base);
  if (ipInt == null || baseInt == null) return false;

  const safePrefix = Math.max(0, Math.min(32, Number(prefix) || 0));
  if (safePrefix === 0) return true;

  const mask = safePrefix === 32 ? 0xffffffff : (~((1 << (32 - safePrefix)) - 1)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function isDeniedIpv4(ip = "") {
  const ranges = [
    ["0.0.0.0", 8, "unsafe_ip_current_network_denied"],
    ["10.0.0.0", 8, "unsafe_ip_private_denied"],
    ["100.64.0.0", 10, "unsafe_ip_cgnat_denied"],
    ["127.0.0.0", 8, "unsafe_ip_loopback_denied"],
    ["169.254.0.0", 16, "unsafe_ip_link_local_denied"],
    ["172.16.0.0", 12, "unsafe_ip_private_denied"],
    ["192.0.0.0", 24, "unsafe_ip_special_use_denied"],
    ["192.0.2.0", 24, "unsafe_ip_documentation_denied"],
    ["192.168.0.0", 16, "unsafe_ip_private_denied"],
    ["198.18.0.0", 15, "unsafe_ip_benchmark_denied"],
    ["198.51.100.0", 24, "unsafe_ip_documentation_denied"],
    ["203.0.113.0", 24, "unsafe_ip_documentation_denied"],
    ["224.0.0.0", 4, "unsafe_ip_multicast_denied"],
    ["240.0.0.0", 4, "unsafe_ip_reserved_denied"],
  ];

  for (const [base, prefix, reasonCode] of ranges) {
    if (ipv4InCidr(ip, base, prefix)) {
      return { denied: true, reasonCode };
    }
  }

  if (ip === "255.255.255.255") {
    return { denied: true, reasonCode: "unsafe_ip_broadcast_denied" };
  }

  return { denied: false, reasonCode: "" };
}

function normalizeIpv6(input = "") {
  return lower(s(input).replace(/^\[|\]$/g, ""));
}

function isDeniedIpv6(ip = "") {
  const raw = normalizeIpv6(ip);
  if (!raw) return { denied: true, reasonCode: "unsafe_ip_invalid_denied" };

  if (raw === "::" || raw === "::1") {
    return { denied: true, reasonCode: "unsafe_ip_loopback_denied" };
  }

  if (raw.startsWith("::ffff:")) {
    const mappedIpv4 = raw.slice("::ffff:".length);
    const mapped = isDeniedIpv4(mappedIpv4);
    if (mapped.denied) return mapped;
  }

  if (/^fe[89ab]/i.test(raw)) {
    return { denied: true, reasonCode: "unsafe_ip_link_local_denied" };
  }

  if (/^f[cd]/i.test(raw)) {
    return { denied: true, reasonCode: "unsafe_ip_unique_local_denied" };
  }

  if (/^fe[cdef]/i.test(raw)) {
    return { denied: true, reasonCode: "unsafe_ip_site_local_denied" };
  }

  if (raw.startsWith("2001:db8:")) {
    return { denied: true, reasonCode: "unsafe_ip_documentation_denied" };
  }

  return { denied: false, reasonCode: "" };
}

export function classifyIpAddressSafety(address = "") {
  const raw = s(address).replace(/^\[|\]$/g, "");
  const family = net.isIP(raw);

  if (family === 4) {
    const result = isDeniedIpv4(raw);
    return {
      denied: result.denied,
      reasonCode: result.reasonCode,
      family,
      address: raw,
    };
  }

  if (family === 6) {
    const result = isDeniedIpv6(raw);
    return {
      denied: result.denied,
      reasonCode: result.reasonCode,
      family,
      address: raw,
    };
  }

  return {
    denied: true,
    reasonCode: "unsafe_ip_invalid_denied",
    family: 0,
    address: raw,
  };
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
]);

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".home",
  ".lan",
  ".corp",
  ".test",
];

export function classifyHostnameSafety(hostname = "") {
  const raw = lower(s(hostname).replace(/\.$/, ""));
  if (!raw) {
    return buildDeniedResult("unsafe_hostname_missing_denied", {
      hostname: raw,
    });
  }

  if (BLOCKED_HOSTNAMES.has(raw)) {
    return buildDeniedResult("unsafe_hostname_localhost_denied", {
      hostname: raw,
    });
  }

  if (BLOCKED_HOST_SUFFIXES.some((suffix) => raw.endsWith(suffix))) {
    return buildDeniedResult("unsafe_hostname_internal_denied", {
      hostname: raw,
    });
  }

  if (!net.isIP(raw) && !raw.includes(".")) {
    return buildDeniedResult("unsafe_hostname_single_label_denied", {
      hostname: raw,
    });
  }

  return {
    ok: true,
    hostname: raw,
  };
}

async function defaultLookup(hostname) {
  return dns.lookup(hostname, {
    all: true,
    verbatim: true,
  });
}

function normalizeLookupResults(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      address: s(row?.address),
      family: Number(row?.family || net.isIP(s(row?.address))),
    }))
    .filter((row) => row.address && (row.family === 4 || row.family === 6));
}

export async function validatePublicFetchUrl(rawUrl = "", options = {}) {
  const baseUrl = s(options?.baseUrl);
  const dnsLookup = typeof options?.dnsLookup === "function"
    ? options.dnsLookup
    : defaultLookup;

  let parsed = null;
  let finalUrl = "";

  try {
    finalUrl = baseUrl
      ? new URL(normalizeUrlInput(rawUrl), normalizeUrlInput(baseUrl)).toString()
      : new URL(normalizeUrlInput(rawUrl)).toString();
    parsed = new URL(finalUrl);
  } catch {
    return buildDeniedResult("unsafe_url_malformed_denied", {
      url: s(rawUrl),
    });
  }

  const protocol = lower(parsed.protocol);
  if (!["http:", "https:"].includes(protocol)) {
    return buildDeniedResult("unsafe_scheme_denied", {
      url: finalUrl,
      protocol,
    });
  }

  if (s(parsed.username) || s(parsed.password)) {
    return buildDeniedResult("unsafe_url_credentials_denied", {
      url: finalUrl,
    });
  }

  const hostnameCheck = classifyHostnameSafety(parsed.hostname);
  if (!hostnameCheck.ok) {
    return {
      ...hostnameCheck,
      url: finalUrl,
      protocol,
    };
  }

  const hostname = hostnameCheck.hostname;
  const literalFamily = net.isIP(hostname);

  if (literalFamily) {
    const literalCheck = classifyIpAddressSafety(hostname);
    if (literalCheck.denied) {
      return buildDeniedResult(literalCheck.reasonCode, {
        url: finalUrl,
        hostname,
        addresses: [literalCheck.address],
      });
    }

    return {
      ok: true,
      url: finalUrl,
      protocol,
      hostname,
      addresses: [literalCheck.address],
      dnsResolved: false,
    };
  }

  let resolved = [];
  try {
    resolved = normalizeLookupResults(await dnsLookup(hostname));
  } catch (error) {
    return buildDeniedResult("unsafe_hostname_resolution_failed", {
      url: finalUrl,
      hostname,
      error: s(error?.message || error),
    });
  }

  if (!resolved.length) {
    return buildDeniedResult("unsafe_hostname_resolution_failed", {
      url: finalUrl,
      hostname,
    });
  }

  for (const row of resolved) {
    const check = classifyIpAddressSafety(row.address);
    if (check.denied) {
      return buildDeniedResult(check.reasonCode, {
        url: finalUrl,
        hostname,
        addresses: resolved.map((item) => item.address),
      });
    }
  }

  return {
    ok: true,
    url: finalUrl,
    protocol,
    hostname,
    addresses: resolved.map((item) => item.address),
    dnsResolved: true,
  };
}

export async function assertSafePublicFetchUrl(rawUrl = "", options = {}) {
  const checked = await validatePublicFetchUrl(rawUrl, options);
  if (checked.ok) return checked;

  const error = new Error(
    `Unsafe public fetch URL denied: ${checked.reasonCode || "unsafe_destination_denied"}`
  );
  error.code = "UNSAFE_PUBLIC_FETCH_URL_DENIED";
  error.reasonCode = checked.reasonCode || "unsafe_destination_denied";
  error.fetchSafety = checked;
  throw error;
}

export const __test__ = {
  classifyHostnameSafety,
  classifyIpAddressSafety,
  normalizeUrlInput,
};
