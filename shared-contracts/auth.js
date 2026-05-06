const MIN_PASSWORD_LENGTH = 8;

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
  "letter_required",
  "number_required",
  "must_not_equal_email",
  "common_pattern",
];

export const PASSWORD_RULES = [
  {
    id: "minimum_length",
    label: "At least 8 characters",
    failureCodes: ["minimum_length"],
  },
  {
    id: "letter_required",
    label: "Letter",
    failureCodes: ["letter_required"],
  },
  {
    id: "number_required",
    label: "Number",
    failureCodes: ["number_required"],
  },
  {
    id: "not_email",
    label: "Not your email address",
    failureCodes: ["must_not_equal_email"],
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
  { email = "" } = {}
) {
  const value = String(password || "");
  const failures = [];

  if (value.length < MIN_PASSWORD_LENGTH) failures.push("minimum_length");
  if (!/[a-z]/i.test(value)) failures.push("letter_required");
  if (!/[0-9]/.test(value)) failures.push("number_required");

  const normalizedEmail = s(email).toLowerCase();
  if (normalizedEmail && s(value).toLowerCase() === normalizedEmail) {
    failures.push("must_not_equal_email");
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
