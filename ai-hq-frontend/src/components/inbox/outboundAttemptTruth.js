function s(value) {
  return String(value ?? "").trim();
}

function toTimestamp(value) {
  if (!value) return 0;
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? stamp : 0;
}

function getMessageTimestamp(message = {}) {
  return toTimestamp(
    message?.sent_at ||
      message?.updated_at ||
      message?.created_at
  );
}

function getAttemptTimestamp(attempt = {}) {
  return toTimestamp(
    attempt?.updated_at ||
      attempt?.created_at
  );
}

export function getMessageAttemptCorrelation(message = {}) {
  return s(
    message?.outbound_attempt_correlation ?? message?.outboundAttemptCorrelation
  );
}

export function getAttemptMessageCorrelation(attempt = {}) {
  return s(attempt?.message_correlation ?? attempt?.messageCorrelation);
}

function isPreferredAttempt(candidate, current) {
  const candidateCount = Number(candidate?.attempt_count || 0);
  const currentCount = Number(current?.attempt_count || 0);
  if (candidateCount !== currentCount) {
    return candidateCount > currentCount;
  }

  const candidateUpdatedAt = toTimestamp(
    candidate?.updated_at || candidate?.created_at
  );
  const currentUpdatedAt = toTimestamp(current?.updated_at || current?.created_at);
  if (candidateUpdatedAt !== currentUpdatedAt) {
    return candidateUpdatedAt > currentUpdatedAt;
  }

  return s(candidate?.id) > s(current?.id);
}

export function indexAttemptsByMessageCorrelation(attempts = []) {
  const index = new Map();

  for (const attempt of Array.isArray(attempts) ? attempts : []) {
    const correlation = getAttemptMessageCorrelation(attempt);
    if (!correlation) continue;
    const current = index.get(correlation);
    if (!current || isPreferredAttempt(attempt, current)) {
      index.set(correlation, attempt);
    }
  }

  return index;
}

export function describeAttemptState(item = {}) {
  const status = s(item?.status).toLowerCase();
  const attemptCount = Number(item?.attempt_count || 0);
  const maxAttempts = Number(item?.max_attempts || 0);

  if (status === "queued") {
    return {
      label: "Queued locally",
      detail: "Accepted into the outbound queue. Provider delivery has not completed yet.",
    };
  }

  if (status === "sending") {
    return {
      label: "Send in progress",
      detail: "An outbound attempt is actively trying to hand off to the provider.",
    };
  }

  if (status === "sent") {
    return {
      label: "Sent",
      detail:
        attemptCount > 0
          ? `Delivery succeeded on attempt ${attemptCount}${maxAttempts > 0 ? ` of ${maxAttempts}` : ""}.`
          : "Delivery succeeded.",
    };
  }

  if (status === "failed") {
    return {
      label: "Failed",
      detail:
        attemptCount > 0
          ? `Most recent delivery attempt failed${maxAttempts > 0 ? ` on attempt ${attemptCount} of ${maxAttempts}.` : "."}`
          : "Most recent delivery attempt failed.",
    };
  }

  if (status === "retrying") {
    return {
      label: "Retrying",
      detail:
        attemptCount > 0
          ? `Retry lineage is active after attempt ${attemptCount}${maxAttempts > 0 ? ` of ${maxAttempts}` : ""}.`
          : "Retry lineage is active for this outbound delivery.",
    };
  }

  if (status === "dead") {
    return {
      label: "Dead",
      detail:
        maxAttempts > 0
          ? `Automatic delivery stopped after ${attemptCount || maxAttempts} of ${maxAttempts} attempts.`
          : "Automatic delivery stopped. Operator cleanup is required.",
    };
  }

  return {
    label: status || "Unknown",
    detail: "The backend reported an outbound attempt state the UI does not recognize yet.",
  };
}

export function getAttemptStatusTone(status) {
  const value = s(status).toLowerCase();

  return {
    queued: "border-stone-200 bg-stone-100 text-stone-700",
    sending: "border-blue-200 bg-blue-50 text-blue-700",
    sent: "border-emerald-200 bg-emerald-50 text-emerald-700",
    failed: "border-amber-200 bg-amber-50 text-amber-700",
    retrying: "border-violet-200 bg-violet-50 text-violet-700",
    dead: "border-rose-200 bg-rose-50 text-rose-700",
  }[value] || "border-stone-200 bg-stone-100 text-stone-700";
}

export function getMessageOutboundTruth(message = {}, attemptsByCorrelation) {
  const correlation = getMessageAttemptCorrelation(message);
  const direction = s(message?.direction).toLowerCase();
  if (direction !== "outbound") return null;

  if (!correlation) {
    return {
      kind: "missing_correlation",
      label: "Authoritative link missing",
      detail: "This outbound message does not expose the backend correlation needed to bind delivery lineage.",
      status: "",
      attempt: null,
    };
  }

  const attempt = attemptsByCorrelation?.get?.(correlation) || null;
  if (!attempt) {
    return {
      kind: "awaiting_attempt",
      label: "Waiting for attempt truth",
      detail: "The message has an authoritative correlation, but no outbound attempt record is attached yet.",
      status: "",
      attempt: null,
    };
  }

  const messageTimestamp = getMessageTimestamp(message);
  const attemptTimestamp = getAttemptTimestamp(attempt);
  if (messageTimestamp > 0 && attemptTimestamp > 0 && attemptTimestamp < messageTimestamp) {
    return {
      kind: "stale_attempt",
      label: "Attempt truth may be stale",
      detail: "A correlated outbound attempt exists, but its latest recorded state predates this message record. Inspect thread lineage before treating this status as current.",
      status: s(attempt?.status).toLowerCase(),
      attempt,
    };
  }

  const state = describeAttemptState(attempt);
  return {
    kind: "attempt_bound",
    label: state.label,
    detail: state.detail,
    status: s(attempt?.status).toLowerCase(),
    attempt,
  };
}
