import { apiGet, apiPost } from "./client.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  if (params.recipient) {
    query.set("recipient", s(params.recipient));
  }

  if (params.unreadOnly) {
    query.set("unread", "1");
  }

  if (params.limit != null && s(params.limit)) {
    query.set("limit", s(params.limit));
  }

  const text = query.toString();
  return text ? `?${text}` : "";
}

function normalizeNotification(value = {}) {
  const item = obj(value);
  const payload = obj(item.payload);
  const readAt = s(item.read_at || item.readAt);

  return {
    id: s(item.id),
    recipient: s(item.recipient),
    type: s(item.type || "info").toLowerCase(),
    title: s(item.title || "Notification"),
    body: s(item.body),
    payload,
    readAt,
    createdAt: s(item.created_at || item.createdAt),
    unread: !readAt,
  };
}

export async function listNotifications(params = {}) {
  const payload = await apiGet(`/api/notifications${buildQuery(params)}`);
  return {
    ok: payload?.ok !== false,
    recipient: s(payload?.recipient),
    unreadOnly: payload?.unreadOnly === true,
    dbDisabled: payload?.dbDisabled === true,
    notifications: arr(payload?.notifications).map(normalizeNotification),
  };
}

export async function markNotificationRead(notificationId) {
  const id = s(notificationId);
  if (!id) {
    throw new Error("notification id is required");
  }

  const payload = await apiPost(`/api/notifications/${encodeURIComponent(id)}/read`, {});
  return {
    ok: payload?.ok !== false,
    dbDisabled: payload?.dbDisabled === true,
    notification: normalizeNotification(payload?.notification),
  };
}

export const __test__ = {
  normalizeNotification,
};
