import { BASE_SERIES } from "./analytics-data.js";

export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function compact(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return `${value}`;
}

export function buildSeries(rangeKey, platform) {
  return BASE_SERIES[rangeKey].map((item, index) => ({
    ...item,
    value: Math.round(item.value * platform.multiplier + index * platform.drift),
  }));
}