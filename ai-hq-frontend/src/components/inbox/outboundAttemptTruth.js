function s(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return s(value).toLowerCase();
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value ?? null);
}

function collectCorrelationKeys(value, path = "") {
  const keys = [];
  const seen = new Set();

  const push = (candidate) => {
    const normalized = s(candidate);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    keys.push(normalized);
  };

  const visit = (node, nextPath = "") => {
    if (node == null) return;

    if (
      typeof node === "string" ||
      typeof node === "number" ||
      typeof node === "boolean"
    ) {
      const valueKey = s(node);
      if (nextPath) push(`${nextPath}:${valueKey}`);
      push(valueKey);
      return;
    }

    if (Array.isArray(node)) {
      push(stableSerialize(node));
      node.forEach((item, index) => {
        visit(item, nextPath ? `${nextPath}[${index}]` : `[${index}]`);
      });
      return;
    }

    if (isRecord(node)) {
      push(stableSerialize(node));
      Object.keys(node)
        .sort()
        .forEach((key) => {
          visit(node[key], nextPath ? `${nextPath}.${key}` : key);
        });
    }
  };

  visit(value, path);
  return keys;
}

function getCorrelationLookupKeys(value) {
  return collectCorrelationKeys(value);
}

function toTimestamp(value) {
  if (!value) return 0;
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? stamp : 0;
}

function getMessageTimestamp(message = {}) {
  return toTimestamp(
    message?.sent_at ||
      message?.sentAt ||
      message?.updated_at ||
      message?.updatedAt ||
      message?.created_at ||
      message?.createdAt
  );
}

function getAttemptTimestamp(attempt = {}) {
  return toTimestamp(
    attempt?.updated_at ||
      attempt?.updatedAt ||
      attempt?.sent_at ||
      attempt?.sentAt ||
      attempt?.created_at ||
      attempt?.createdAt
  );
}

function getMessageMeta(message = {}) {
  return isRecord(message?.meta) ? message.meta : {};
}

function getDeliveryMeta(message = {}) {
  const meta = getMessageMeta(message);
  return isRecord(meta?.delivery) ? meta.delivery : {};
}

function getProviderResponse(message = {}, attempt = {}) {
  const meta = getMessageMeta(message);
  const delivery = getDeliveryMeta(message);

  return (
    attempt?.provider_response ||
    attempt?.providerResponse ||
    meta?.providerResponse ||
    meta?.provider_response ||
    delivery?.providerResponse ||
    delivery?.provider_response ||
    {}
  );
}

function findProviderMessageIdDeep(value, depth = 0) {
  if (depth > 6 || value == null) return "";

  if (typeof value === "string" || typeof value === "number") {
    return "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProviderMessageIdDeep(item, depth + 1);
      if (found) return found;
    }
    return "";
  }

  if (!isRecord(value)) return "";

  const direct = s(
    value.message_id ||
      value.messageId ||
      value.provider_message_id ||
      value.providerMessageId ||
      value.mid ||
      value.id
  );

  if (direct) return direct;

  const preferredKeys = [
    "response",
    "result",
    "json",
    "data",
    "message",
    "messages",
    "entry",
    "events",
    "payload",
  ];

  for (const key of preferredKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const found = findProviderMessageIdDeep(value[key], depth + 1);
    if (found) return found;
  }

  for (const key of Object.keys(value)) {
    if (preferredKeys.includes(key)) continue;
    const found = findProviderMessageIdDeep(value[key], depth + 1);
    if (found) return found;
  }

  return "";
}

function getProviderMessageId(message = {}, attempt = {}) {
  const meta = getMessageMeta(message);
  const delivery = getDeliveryMeta(message);
  const response = getProviderResponse(message, attempt);

  return s(
    attempt?.provider_message_id ||
      attempt?.providerMessageId ||
      message?.external_message_id ||
      message?.externalMessageId ||
      delivery?.providerMessageId ||
      delivery?.provider_message_id ||
      meta?.providerMessageId ||
      meta?.provider_message_id ||
      findProviderMessageIdDeep(response)
  );
}

function getDeliveryStatus(message = {}) {
  const meta = getMessageMeta(message);
  const delivery = getDeliveryMeta(message);

  return lower(
    delivery?.status ||
      meta?.deliveryStatus ||
      meta?.delivery_status ||
      ""
  );
}

function getDeliveryFailureText(message = {}) {
  const meta = getMessageMeta(message);
  const delivery = getDeliveryMeta(message);

  return s(
    delivery?.error ||
      delivery?.lastError ||
      delivery?.last_error ||
      meta?.deliveryError ||
      meta?.delivery_error ||
      ""
  );
}

function getMessageDeliveryTruth(message = {}, attempt = {}) {
  const deliveryStatus = getDeliveryStatus(message);
  const providerMessageId = getProviderMessageId(message, attempt);
  const delivery = getDeliveryMeta(message);

  if (
    deliveryStatus === "sent" ||
    deliveryStatus === "accepted" ||
    deliveryStatus === "delivered"
  ) {
    if (providerMessageId) {
      return {
        kind: "message_delivery_confirmed",
        label: "Sent",
        detail:
          "Instagram/Meta accepted this outbound message. This does not mean the customer has read it.",
        status: "sent",
        providerMessageId,
        attempt,
      };
    }

    return {
      kind: "message_delivery_unconfirmed",
      label: "Delivery unconfirmed",
      detail:
        "The message delivery state says sent, but provider message id is missing. Treat as unconfirmed until provider proof is available.",
      status: "unconfirmed",
      providerMessageId: "",
      attempt,
    };
  }

  if (
    deliveryStatus === "failed" ||
    deliveryStatus === "dead" ||
    deliveryStatus === "error"
  ) {
    return {
      kind: "message_delivery_failed",
      label: "Not delivered",
      detail:
        getDeliveryFailureText(message) ||
        "Provider delivery failed or stopped before confirmation.",
      status: deliveryStatus === "dead" ? "dead" : "failed",
      providerMessageId: "",
      attempt,
    };
  }

  if (deliveryStatus === "pending" || delivery?.pending === true) {
    return {
      kind: "message_delivery_pending",
      label: "Sending",
      detail: "Outbound message is queued or waiting for provider confirmation.",
      status: "sending",
      providerMessageId: "",
      attempt,
    };
  }

  return null;
}

export function getMessageAttemptCorrelation(message = {}) {
  return (
    getCorrelationLookupKeys(
      message?.outbound_attempt_correlation ?? message?.outboundAttemptCorrelation
    )[0] || ""
  );
}

export function getAttemptMessageCorrelation(attempt = {}) {
  return (
    getCorrelationLookupKeys(
      attempt?.message_correlation ?? attempt?.messageCorrelation
    )[0] || ""
  );
}

function isPreferredAttempt(candidate, current) {
  const candidateStatusRank = attemptStatusRank(candidate?.status);
  const currentStatusRank = attemptStatusRank(current?.status);

  if (candidateStatusRank !== currentStatusRank) {
    return candidateStatusRank > currentStatusRank;
  }

  const candidateCount = Number(candidate?.attempt_count || candidate?.attemptCount || 0);
  const currentCount = Number(current?.attempt_count || current?.attemptCount || 0);
  if (candidateCount !== currentCount) {
    return candidateCount > currentCount;
  }

  const candidateUpdatedAt = toTimestamp(
    candidate?.updated_at || candidate?.updatedAt || candidate?.created_at || candidate?.createdAt
  );
  const currentUpdatedAt = toTimestamp(
    current?.updated_at || current?.updatedAt || current?.created_at || current?.createdAt
  );
  if (candidateUpdatedAt !== currentUpdatedAt) {
    return candidateUpdatedAt > currentUpdatedAt;
  }

  return s(candidate?.id) > s(current?.id);
}

function attemptStatusRank(status = "") {
  const value = lower(status);

  return {
    dead: 10,
    failed: 9,
    sent: 8,
    retrying: 7,
    sending: 6,
    queued: 5,
  }[value] || 0;
}

export function indexAttemptsByMessageCorrelation(attempts = []) {
  const index = new Map();

  for (const attempt of Array.isArray(attempts) ? attempts : []) {
    const correlations = getCorrelationLookupKeys(
      attempt?.message_correlation ?? attempt?.messageCorrelation
    );
    if (!correlations.length) continue;

    correlations.forEach((correlation) => {
      const current = index.get(correlation);
      if (!current || isPreferredAttempt(attempt, current)) {
        index.set(correlation, attempt);
      }
    });
  }

  return index;
}

export function describeAttemptState(item = {}, message = {}) {
  const status = lower(item?.status);
  const attemptCount = Number(item?.attempt_count || item?.attemptCount || 0);
  const maxAttempts = Number(item?.max_attempts || item?.maxAttempts || 0);
  const providerMessageId = getProviderMessageId(message, item);

  if (status === "queued") {
    return {
      label: "Waiting for delivery",
      detail: "Accepted into the outbound queue. Provider delivery has not completed yet.",
    };
  }

  if (status === "sending") {
    return {
      label: "Sending",
      detail: "An outbound attempt is actively trying to hand off to the provider.",
    };
  }

  if (status === "sent") {
    if (!providerMessageId) {
      return {
        label: "Delivery unconfirmed",
        detail:
          "The attempt is marked sent, but provider message id is missing. Do not assume the customer saw this reply.",
      };
    }

    return {
      label: "Sent",
      detail:
        attemptCount > 0
          ? `Instagram/Meta accepted this message on attempt ${attemptCount}${maxAttempts > 0 ? ` of ${maxAttempts}` : ""}.`
          : "Instagram/Meta accepted this message.",
    };
  }

  if (status === "failed") {
    return {
      label: "Not delivered",
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
      label: "Not delivered",
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
  const value = lower(status);

  return {
    queued: "border-stone-200 bg-stone-100 text-stone-700",
    sending: "border-blue-200 bg-blue-50 text-blue-700",
    sent: "border-emerald-200 bg-emerald-50 text-emerald-700",
    failed: "border-amber-200 bg-amber-50 text-amber-700",
    retrying: "border-violet-200 bg-violet-50 text-violet-700",
    dead: "border-rose-200 bg-rose-50 text-rose-700",
    unconfirmed: "border-amber-200 bg-amber-50 text-amber-800",
  }[value] || "border-stone-200 bg-stone-100 text-stone-700";
}

export function getMessageOutboundTruth(message = {}, attemptsByCorrelation) {
  const direction = lower(message?.direction);
  if (direction !== "outbound") return null;

  const correlations = getCorrelationLookupKeys(
    message?.outbound_attempt_correlation ?? message?.outboundAttemptCorrelation
  );

  const attempt =
    correlations
      .map((correlation) => attemptsByCorrelation?.get?.(correlation) || null)
      .find(Boolean) || null;

  const messageDeliveryTruth = getMessageDeliveryTruth(message, attempt);

  if (
    messageDeliveryTruth &&
    (
      messageDeliveryTruth.status === "sent" ||
      messageDeliveryTruth.status === "failed" ||
      messageDeliveryTruth.status === "dead" ||
      messageDeliveryTruth.status === "unconfirmed"
    )
  ) {
    return messageDeliveryTruth;
  }

  if (!correlations.length) {
    return (
      messageDeliveryTruth || {
        kind: "missing_correlation",
        label: "Delivery unverified",
        detail:
          "This outbound message does not expose the backend correlation needed to bind delivery lineage.",
        status: "unconfirmed",
        attempt: null,
      }
    );
  }

  if (!attempt) {
    return (
      messageDeliveryTruth || {
        kind: "awaiting_attempt",
        label: "Waiting for delivery",
        detail:
          "The message has an authoritative correlation, but no outbound attempt record is attached yet.",
        status: "sending",
        attempt: null,
      }
    );
  }

  const providerMessageId = getProviderMessageId(message, attempt);
  const attemptStatus = lower(attempt?.status);

  if (attemptStatus === "sent" && providerMessageId) {
    return {
      kind: "attempt_provider_confirmed",
      label: "Sent",
      detail:
        "Instagram/Meta accepted this outbound message. This does not mean the customer has read it.",
      status: "sent",
      attempt,
      providerMessageId,
    };
  }

  if (attemptStatus === "sent" && !providerMessageId) {
    return {
      kind: "provider_unconfirmed",
      label: "Delivery unconfirmed",
      detail:
        "The backend has an outbound attempt marked sent, but the provider message id is missing.",
      status: "unconfirmed",
      attempt,
      providerMessageId: "",
    };
  }

  const messageTimestamp = getMessageTimestamp(message);
  const attemptTimestamp = getAttemptTimestamp(attempt);

  if (
    messageTimestamp > 0 &&
    attemptTimestamp > 0 &&
    attemptTimestamp < messageTimestamp &&
    messageDeliveryTruth
  ) {
    return messageDeliveryTruth;
  }

  const state = describeAttemptState(attempt, message);

  return {
    kind: "attempt_bound",
    label: state.label,
    detail: state.detail,
    status: attemptStatus || "unconfirmed",
    attempt,
    providerMessageId,
  };
}
