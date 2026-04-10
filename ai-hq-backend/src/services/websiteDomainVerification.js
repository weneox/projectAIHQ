import crypto from "crypto";
import dns from "node:dns/promises";
import net from "node:net";
import { domainToASCII } from "node:url";

import { classifyHostnameSafety } from "../utils/publicFetchSafety.js";

export const WEBSITE_DOMAIN_VERIFICATION_CHANNEL = "webchat";
export const WEBSITE_DOMAIN_VERIFICATION_SCOPE = "website_widget";
export const WEBSITE_DOMAIN_VERIFICATION_METHOD = "dns_txt";
export const WEBSITE_DOMAIN_VERIFICATION_RECORD_LABEL = "_aihq-webchat";
export const WEBSITE_DOMAIN_VERIFICATION_VALUE_PREFIX =
  "aihq-webchat-verification=";

const DNS_PENDING_CODES = new Set(["ENODATA", "ENOTFOUND", "ENOENT", "NXDOMAIN"]);
const DOMAIN_LABEL_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function normalizeInputToHostname(raw = "") {
  const input = s(raw);
  if (!input) return "";

  if (input.startsWith("*.")) {
    return input;
  }

  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(input)) {
      return s(new URL(input).hostname);
    }

    if (input.startsWith("//")) {
      return s(new URL(`https:${input}`).hostname);
    }

    if (/[/?#]/.test(input) || input.includes(":")) {
      return s(new URL(`https://${input.replace(/^\/+/, "")}`).hostname);
    }

    return s(input);
  } catch {
    return "";
  }
}

export function normalizeWebsiteVerificationDomain(raw = "") {
  const hostname = normalizeInputToHostname(raw);
  if (!hostname) {
    return {
      ok: false,
      reasonCode: "website_domain_invalid",
      detail: "Enter a valid domain or website URL before starting verification.",
    };
  }

  if (hostname.startsWith("*.")) {
    return {
      ok: false,
      reasonCode: "website_domain_wildcard_unsupported",
      detail: "Wildcard domains are not supported for DNS TXT ownership verification.",
    };
  }

  const ascii = lower(domainToASCII(hostname) || hostname).replace(/\.+$/, "");
  const normalized = ascii.replace(/^www\./, "");

  if (!normalized) {
    return {
      ok: false,
      reasonCode: "website_domain_invalid",
      detail: "Enter a valid domain or website URL before starting verification.",
    };
  }

  if (net.isIP(normalized)) {
    return {
      ok: false,
      reasonCode: "website_domain_ip_unsupported",
      detail: "IP addresses are not valid targets for DNS TXT ownership verification.",
    };
  }

  const hostnameSafety = classifyHostnameSafety(normalized);
  if (!hostnameSafety?.ok) {
    return {
      ok: false,
      reasonCode: hostnameSafety?.reasonCode || "website_domain_invalid",
      detail: "Only public website domains can be verified for Website Chat.",
    };
  }

  if (!DOMAIN_LABEL_PATTERN.test(normalized)) {
    return {
      ok: false,
      reasonCode: "website_domain_invalid",
      detail: "Enter a valid public domain name before starting verification.",
    };
  }

  return {
    ok: true,
    domain: normalized,
  };
}

export function buildWebsiteDomainVerificationChallenge(domain = "") {
  const normalizedDomain = lower(domain);
  const challengeToken = crypto.randomBytes(24).toString("base64url");
  const challengeDnsName = `${WEBSITE_DOMAIN_VERIFICATION_RECORD_LABEL}.${normalizedDomain}`;
  const challengeDnsValue = `${WEBSITE_DOMAIN_VERIFICATION_VALUE_PREFIX}${challengeToken}`;

  return {
    domain: normalizedDomain,
    normalized_domain: normalizedDomain,
    verification_method: WEBSITE_DOMAIN_VERIFICATION_METHOD,
    challenge_token: challengeToken,
    challenge_dns_name: challengeDnsName,
    challenge_dns_value: challengeDnsValue,
  };
}

function flattenTxtRows(rows = []) {
  return unique(
    arr(rows)
      .map((entry) =>
        Array.isArray(entry) ? entry.map((part) => s(part)).join("") : s(entry)
      )
      .map((entry) => entry.replace(/^"+|"+$/g, "").trim())
      .filter(Boolean)
  ).slice(0, 20);
}

export async function evaluateWebsiteDomainVerification(
  record = {},
  { resolveTxtFn } = {}
) {
  const checkedAt = new Date().toISOString();
  const challengeDnsName = lower(record.challenge_dns_name);
  const challengeDnsValue = s(record.challenge_dns_value);
  const resolveTxt =
    typeof resolveTxtFn === "function" ? resolveTxtFn : dns.resolveTxt.bind(dns);

  if (!challengeDnsName || !challengeDnsValue) {
    return {
      ...record,
      status: "failed",
      last_checked_at: checkedAt,
      status_reason_code: "website_domain_challenge_missing",
      status_message:
        "A DNS TXT challenge has not been issued yet for this domain.",
      last_seen_values: [],
    };
  }

  try {
    const rows = await resolveTxt(challengeDnsName);
    const values = flattenTxtRows(rows);

    if (values.includes(challengeDnsValue)) {
      return {
        ...record,
        status: "verified",
        last_checked_at: checkedAt,
        verified_at: checkedAt,
        status_reason_code: "dns_txt_verified",
        status_message: "DNS TXT ownership was verified successfully.",
        last_seen_values: values,
      };
    }

    if (!values.length) {
      return {
        ...record,
        status: "pending",
        last_checked_at: checkedAt,
        status_reason_code: "dns_txt_record_not_found",
        status_message:
          "No TXT record was found yet for the verification hostname.",
        last_seen_values: [],
      };
    }

    return {
      ...record,
      status: "failed",
      last_checked_at: checkedAt,
      status_reason_code: "dns_txt_mismatch",
      status_message:
        "TXT records were found, but none matched the expected verification value.",
      last_seen_values: values,
    };
  } catch (error) {
    const code = upper(error?.code);

    if (DNS_PENDING_CODES.has(code)) {
      return {
        ...record,
        status: "pending",
        last_checked_at: checkedAt,
        status_reason_code: "dns_txt_record_not_found",
        status_message:
          "The verification TXT record was not visible yet. DNS propagation may still be in progress.",
        last_seen_values: [],
      };
    }

    return {
      ...record,
      status: "failed",
      last_checked_at: checkedAt,
      status_reason_code: "dns_txt_lookup_failed",
      status_message: s(error?.message || "DNS TXT lookup failed."),
      last_seen_values: [],
    };
  }
}

function upper(value, fallback = "") {
  return s(value, fallback).toUpperCase();
}

export function buildWebsiteDomainVerificationPayload(
  record = null,
  { candidateDomain = "", candidateDomains = [], enforcementActive = false } = {}
) {
  const normalizedCandidate = lower(candidateDomain);
  const safeRecord = record && typeof record === "object" ? record : null;
  const safeState = lower(safeRecord?.status || "unverified");
  const domain = lower(safeRecord?.normalized_domain || safeRecord?.domain || normalizedCandidate);
  const challenge =
    safeRecord?.challenge_dns_name && safeRecord?.challenge_dns_value
      ? {
          type: "TXT",
          name: safeRecord.challenge_dns_name,
          value: safeRecord.challenge_dns_value,
        }
      : null;

  let reasonCode = lower(safeRecord?.status_reason_code);
  let message = s(safeRecord?.status_message);

  if (!message) {
    if (!domain) {
      reasonCode = reasonCode || "website_domain_missing";
      message =
        "Add a public website domain before starting Website Chat ownership verification.";
    } else if (safeState === "verified") {
      reasonCode = reasonCode || "dns_txt_verified";
      message = "DNS TXT ownership has been verified for this domain.";
    } else if (safeState === "pending") {
      reasonCode = reasonCode || "dns_txt_pending";
      message =
        "Publish the TXT record for this domain, then run verification again after DNS propagation.";
    } else if (safeState === "failed") {
      reasonCode = reasonCode || "dns_txt_failed";
      message =
        "The last DNS TXT verification check did not confirm ownership for this domain.";
    } else {
      reasonCode = reasonCode || "website_domain_verification_missing";
      message =
        "Create a DNS TXT challenge for this domain before future production install enforcement is enabled.";
    }
  }

  return {
    requiredForProductionInstall: true,
    enforcementActive: enforcementActive === true,
    state:
      safeState === "pending" ||
      safeState === "verified" ||
      safeState === "failed"
        ? safeState
        : "unverified",
    verified: safeState === "verified",
    method:
      lower(safeRecord?.verification_method, WEBSITE_DOMAIN_VERIFICATION_METHOD) ||
      WEBSITE_DOMAIN_VERIFICATION_METHOD,
    domain,
    candidateDomain: normalizedCandidate,
    candidateDomains: unique(candidateDomains.map((item) => lower(item))),
    challengeVersion: Math.max(0, Number(safeRecord?.challenge_version || 0)),
    challenge,
    lastCheckedAt: safeRecord?.last_checked_at || null,
    verifiedAt: safeRecord?.verified_at || null,
    reasonCode,
    message,
    lastSeenValues: arr(safeRecord?.last_seen_values)
      .map((item) => s(item))
      .filter(Boolean)
      .slice(0, 20),
    readiness: {
      productionInstall: safeState === "verified" ? "ready" : "verification_required",
      productionInstallReady: safeState === "verified",
      enforcementActive: enforcementActive === true,
      message,
    },
  };
}

export const __test__ = {
  buildWebsiteDomainVerificationChallenge,
  buildWebsiteDomainVerificationPayload,
  evaluateWebsiteDomainVerification,
  normalizeWebsiteVerificationDomain,
};
