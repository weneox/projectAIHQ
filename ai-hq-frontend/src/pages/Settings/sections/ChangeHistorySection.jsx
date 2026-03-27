import React from "react";
import { useMemo, useState } from "react";
import { Clock3 } from "lucide-react";

import Badge from "../../../components/ui/Badge.jsx";
import Card from "../../../components/ui/Card.jsx";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import SettingsSurfaceBanner from "../../../components/settings/SettingsSurfaceBanner.jsx";
import { EmptyState, StatTile } from "./SectionPrimitives.jsx";
import { getControlPlanePermissions } from "../../../lib/controlPlanePermissions.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function formatTimestamp(value = "") {
  const text = s(value);
  if (!text) return "Unknown time";
  try {
    return new Date(text).toLocaleString();
  } catch {
    return text;
  }
}

function toneForOutcome(value = "") {
  const outcome = s(value).toLowerCase();
  if (outcome === "succeeded") return "success";
  if (outcome === "blocked") return "warn";
  if (outcome === "failed") return "danger";
  return "neutral";
}

export default function ChangeHistorySection({ history, surface, viewerRole = "" }) {
  const [areaFilter, setAreaFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const permissionState = getControlPlanePermissions({
    viewerRole: history?.viewerRole || viewerRole,
    permissions: history?.permissions,
  });

  const items = arr(history?.items);
  const filteredItems = useMemo(
    () =>
      items.filter((item) => (areaFilter ? s(item.area) === areaFilter : true)).filter((item) =>
        outcomeFilter ? s(item.outcome) === outcomeFilter : true
      ),
    [areaFilter, items, outcomeFilter]
  );
  const areaItems = arr(history?.summary?.areaItems);
  const outcomes = history?.summary?.outcomes || {};

  return (
    <SettingsSection
      eyebrow="Governance"
      title="Change History"
      subtitle="Review recent sensitive control-plane mutations with actor, outcome, and affected area context."
      tone="default"
    >
      <div className="space-y-6">
        <SettingsSurfaceBanner
          surface={surface}
          unavailableMessage="Control-plane change history is temporarily unavailable."
          refreshLabel="Refresh History"
        />

        {!permissionState.auditHistoryRead.allowed ? (
          <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/90 px-4 py-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            {permissionState.auditHistoryRead.message}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <StatTile label="Tracked Changes" value={history?.summary?.total ?? 0} hint="Recent sensitive mutations returned by the backend" tone="info" />
              <StatTile label="Succeeded" value={outcomes.succeeded ?? 0} hint="Completed without backend rejection" tone="success" />
              <StatTile label="Blocked" value={outcomes.blocked ?? 0} hint="Denied by permissions or guardrails" tone="warn" />
              <StatTile label="Failed" value={outcomes.failed ?? 0} hint="Accepted but did not complete successfully" tone="neutral" />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
              <Card variant="surface" padded="md" className="rounded-[24px]">
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={areaFilter}
                    onChange={(event) => setAreaFilter(event.target.value)}
                    className="h-11 rounded-[18px] border border-slate-200/80 bg-white/90 px-4 text-sm dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <option value="">All areas</option>
                    {arr(history?.filters?.availableAreas).map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={outcomeFilter}
                    onChange={(event) => setOutcomeFilter(event.target.value)}
                    className="h-11 rounded-[18px] border border-slate-200/80 bg-white/90 px-4 text-sm dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <option value="">All outcomes</option>
                    {arr(history?.filters?.availableOutcomes).map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                {!filteredItems.length ? (
                  <div className="mt-4">
                    <EmptyState
                      title="No matching change history"
                      subtitle="Sensitive control-plane events will appear here when the selected filters match recorded changes."
                    />
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {filteredItems.map((entry) => (
                      <div
                        key={entry.id || `${entry.action}-${entry.createdAt}`}
                        className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="info" variant="subtle" dot>
                            {entry.areaLabel}
                          </Badge>
                          <Badge tone={toneForOutcome(entry.outcome)} variant="subtle" dot>
                            {entry.outcome}
                          </Badge>
                          {entry.reasonCode ? (
                            <Badge tone="neutral" variant="subtle">
                              {entry.reasonCode}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-3 text-sm font-semibold text-slate-950 dark:text-white">
                          {entry.actionLabel}
                        </div>
                        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {entry.actor || "system"} · {formatTimestamp(entry.createdAt)} · Tenant {entry.tenantKey || "unknown"}
                        </div>
                        {arr(entry.details).length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {entry.details.map((detail) => (
                              <div
                                key={`${entry.id}-${detail.label}-${detail.value}`}
                                className="rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300"
                              >
                                {detail.label}: {detail.value}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card variant="surface" padded="md" className="rounded-[24px]">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                  <Clock3 className="h-4 w-4" />
                  Highest-volume areas
                </div>
                {!areaItems.length ? (
                  <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                    No sensitive control-plane history has been returned yet.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {areaItems.map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between rounded-[18px] border border-slate-200/80 px-4 py-3 dark:border-white/10"
                      >
                        <div className="text-sm text-slate-700 dark:text-slate-200">{item.label}</div>
                        <Badge tone="neutral" variant="subtle">
                          {item.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </SettingsSection>
  );
}
