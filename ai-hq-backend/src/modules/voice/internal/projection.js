import { s } from "../shared.js";
import { firstNonEmpty, obj } from "./primitives.js";

export function buildProjectionContact(channel = "", value = "", extra = {}) {
  const normalizedValue = s(value);
  if (!normalizedValue) return null;

  return {
    channel: s(channel),
    value: normalizedValue,
    isPrimary: typeof extra.isPrimary === "boolean" ? extra.isPrimary : true,
    ...extra,
  };
}

export function buildServiceProjectionEntry(item, index = 0) {
  if (typeof item === "string") {
    const title = s(item);
    if (!title) return null;

    return {
      serviceKey: "service_" + (index + 1),
      title,
      description: "",
      enabled: true,
    };
  }

  const value = obj(item);
  const title = firstNonEmpty(value.title, value.name, value.label);
  const description = firstNonEmpty(value.description, value.summary);
  const serviceKey = firstNonEmpty(
    value.serviceKey,
    value.service_key,
    value.key,
    title ? title.toLowerCase().replace(/[^a-z0-9]+/gi, "_") : "",
    "service_" + (index + 1)
  );

  if (!title && !description) return null;

  return {
    serviceKey,
    title,
    description,
    category: firstNonEmpty(value.category, value.type),
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
  };
}
