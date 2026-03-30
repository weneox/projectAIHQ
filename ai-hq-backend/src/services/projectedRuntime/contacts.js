import { arr, lower, s } from "./shared.js";

export function pickPrimaryContact(contacts = [], channel = "") {
  const safeChannel = lower(channel);
  const list = arr(contacts);

  return (
    list.find(
      (item) => lower(item?.channel) === safeChannel && item?.isPrimary === true
    ) ||
    list.find((item) => lower(item?.channel) === safeChannel) ||
    null
  );
}

export function toServiceSummary(service = {}) {
  return {
    serviceKey: s(service.serviceKey || service.service_key || ""),
    title: s(service.title || service.name || ""),
    summary: s(
      service.description || service.summaryText || service.summary || ""
    ),
  };
}
