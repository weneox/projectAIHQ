const MIN_PASSWORD_LENGTH = 12;

const COMMON_PASSWORD_PATTERNS = [
  "password",
  "passw0rd",
  "qwerty",
  "asdfgh",
  "zxcvbn",
  "letmein",
  "welcome",
  "admin",
  "changeme",
  "iloveyou",
  "123456",
  "234567",
  "345678",
  "456789",
  "abcdef",
];

export const PASSWORD_REQUIREMENT_CODES = [
  "minimum_length",
  "lowercase_required",
  "uppercase_required",
  "number_required",
  "symbol_required",
  "must_not_contain_email",
  "must_not_contain_company",
  "must_not_contain_full_name",
  "common_pattern",
];

export const PASSWORD_RULES = [
  {
    id: "minimum_length",
    label: "At least 12 characters",
    failureCodes: ["minimum_length"],
  },
  {
    id: "uppercase_required",
    label: "Uppercase letter",
    failureCodes: ["uppercase_required"],
  },
  {
    id: "lowercase_required",
    label: "Lowercase letter",
    failureCodes: ["lowercase_required"],
  },
  {
    id: "number_required",
    label: "Number",
    failureCodes: ["number_required"],
  },
  {
    id: "symbol_required",
    label: "Special character",
    failureCodes: ["symbol_required"],
  },
  {
    id: "not_similar_to_identity",
    label: "Not too similar to name, workspace, or email",
    failureCodes: [
      "must_not_contain_email",
      "must_not_contain_company",
      "must_not_contain_full_name",
    ],
  },
  {
    id: "not_common_pattern",
    label: "Not an obvious weak or common pattern",
    failureCodes: ["common_pattern"],
  },
];

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function compactComparable(value) {
  return s(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function identityFragments(value) {
  const raw = s(value).toLowerCase();
  const compact = compactComparable(raw);
  const parts = raw
    .split(/[^a-z0-9]+/i)
    .map(compactComparable)
    .filter((part) => part.length >= 4);

  return unique([compact.length >= 4 ? compact : "", ...parts]);
}

function containsAny(value, fragments = []) {
  const compact = compactComparable(value);
  return fragments.some((fragment) => fragment && compact.includes(fragment));
}

function hasCommonPattern(password) {
  const lowerValue = s(password).toLowerCase();
  const compact = compactComparable(lowerValue);

  if (!compact) return true;
  if (/(.)\1{5,}/.test(compact)) return true;
  if (/^(?:[a-z])?\d{6,}[!@#$%^&*()_\-+=.[\]{};:'",.<>/?\\|`~]*$/i.test(s(password))) {
    return true;
  }

  return COMMON_PASSWORD_PATTERNS.some((pattern) => compact.includes(pattern));
}

export function getPasswordRuleResults(
  password,
  { email = "", companyName = "", fullName = "" } = {}
) {
  const value = String(password || "");
  const failures = [];

  if (value.length < MIN_PASSWORD_LENGTH) failures.push("minimum_length");
  if (!/[a-z]/.test(value)) failures.push("lowercase_required");
  if (!/[A-Z]/.test(value)) failures.push("uppercase_required");
  if (!/[0-9]/.test(value)) failures.push("number_required");
  if (!/[^A-Za-z0-9]/.test(value)) failures.push("symbol_required");

  const emailLocal = s(email).split("@")[0] || "";
  if (containsAny(value, identityFragments(emailLocal))) {
    failures.push("must_not_contain_email");
  }
  if (containsAny(value, identityFragments(companyName))) {
    failures.push("must_not_contain_company");
  }
  if (containsAny(value, identityFragments(fullName))) {
    failures.push("must_not_contain_full_name");
  }
  if (hasCommonPattern(value)) failures.push("common_pattern");

  const failureSet = new Set(failures);
  const rules = PASSWORD_RULES.map((rule) => ({
    ...rule,
    passed: !rule.failureCodes.some((code) => failureSet.has(code)),
  }));
  const passedCount = rules.filter((rule) => rule.passed).length;
  const strengthLevel = failures.length === 0 ? 4 : Math.min(3, Math.floor(passedCount / 2));
  const strengthLabel =
    strengthLevel >= 4
      ? "Strong"
      : strengthLevel === 3
        ? "Good"
        : strengthLevel === 2
          ? "Fair"
          : "Weak";

  return {
    ok: failures.length === 0,
    failures,
    rules,
    passedCount,
    totalCount: rules.length,
    strengthLevel,
    strengthLabel,
  };
}

export function validateStrongUserPassword(password, context = {}) {
  const result = getPasswordRuleResults(password, context);
  return {
    ok: result.ok,
    failures: result.failures,
  };
}
