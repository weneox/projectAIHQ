import express from "express";

import { dbListAuditEntries } from "../../../db/helpers/audit.js";
import { dbGetTenantByKey } from "../../../db/helpers/tenants.js";
import {
  ok,
  serverErr,
  requireDb,
  requireTenant,
  requireAuditHistoryReader,
  isInternalServiceRequest,
  getUserRole,
} from "./utils.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

const AUDITED_ACTIONS = [
  "settings.workspace.updated",
  "settings.secret.updated",
  "settings.secret.deleted",
  "settings.operational.voice.updated",
  "settings.operational.channel.updated",
  "settings.trust.runtime_projection.repair",
  "settings.trust.runtime_projection.repaired",
  "setup.review.updated",
  "setup.review.discarded",
  "setup.review.finalized",
  "truth.version.created",
];

const AREA_METADATA = {
  workspace: { label: "Workspace" },
  truth: { label: "Truth" },
  trust: { label: "Trust" },
  secrets: { label: "Provider Secrets" },
  operational: { label: "Operational" },
  setup: { label: "Setup Review" },
};

const ACTION_METADATA = {
  "settings.workspace.updated": {
    area: "workspace",
    label: "Workspace settings updated",
  },
  "settings.secret.updated": {
    area: "secrets",
    label: "Provider secret saved",
  },
  "settings.secret.deleted": {
    area: "secrets",
    label: "Provider secret deleted",
  },
  "settings.operational.voice.updated": {
    area: "operational",
    label: "Voice settings updated",
  },
  "settings.operational.channel.updated": {
    area: "operational",
    label: "Channel settings updated",
  },
  "settings.trust.runtime_projection.repair": {
    area: "trust",
    label: "Runtime repair requested",
  },
  "settings.trust.runtime_projection.repaired": {
    area: "trust",
    label: "Runtime repair completed",
  },
  "setup.review.updated": {
    area: "setup",
    label: "Setup review draft updated",
  },
  "setup.review.discarded": {
    area: "setup",
    label: "Setup review discarded",
  },
  "setup.review.finalized": {
    area: "setup",
    label: "Setup review finalized",
  },
  "truth.version.created": {
    area: "truth",
    label: "Truth version created",
  },
};

function safePreviewDetails(entry = {}) {
  const meta = obj(entry.meta);
  const pairs = [
    ["Provider", s(meta.provider)],
    ["Secret key", s(meta.secretKey)],
    ["Channel", s(meta.channelType)],
    ["Status", s(meta.status)],
    ["Trigger", s(meta.triggerType)],
    ["Reason", s(meta.reason)],
    ["Reason code", s(meta.reasonCode)],
    ["Truth version", s(meta.truthVersionId)],
    ["Review session", s(meta.reviewSessionId)],
    ["Runtime projection", s(meta.runtimeProjectionId)],
  ];

  return pairs
    .filter(([, value]) => value)
    .map(([label, value]) => ({ label, value }))
    .slice(0, 5);
}

function buildAuditHistoryEntry(entry = {}) {
  const action = lower(entry.action);
  const metaSource = obj(entry.meta);
  const meta = ACTION_METADATA[action] || {
    area: lower(metaSource.targetArea || metaSource.target_area || "workspace"),
    label: s(action || "Control-plane change"),
  };
  const area = meta.area in AREA_METADATA ? meta.area : "workspace";
  const outcome = lower(metaSource.outcome || "succeeded");

  return {
    id: s(entry.id),
    action,
    actionLabel: meta.label,
    area,
    areaLabel: AREA_METADATA[area]?.label || "Control Plane",
    actor: s(entry.actor || "system"),
    tenantKey: s(entry.tenantKey || entry.tenant_key),
    objectType: s(entry.objectType || entry.object_type),
    objectId: s(entry.objectId || entry.object_id),
    outcome,
    reasonCode: s(metaSource.reasonCode || metaSource.reason_code),
    createdAt: s(entry.createdAt || entry.created_at),
    details: safePreviewDetails(entry),
  };
}

function summarizeAuditHistory(items = []) {
  const summary = {
    total: items.length,
    outcomes: {
      succeeded: 0,
      blocked: 0,
      failed: 0,
    },
    areas: {},
  };

  items.forEach((item) => {
    const area = lower(item.area || "workspace");
    const outcome = lower(item.outcome || "succeeded");
    if (!summary.areas[area]) {
      summary.areas[area] = {
        key: area,
        label: AREA_METADATA[area]?.label || "Control Plane",
        count: 0,
      };
    }
    summary.areas[area].count += 1;
    if (Object.prototype.hasOwnProperty.call(summary.outcomes, outcome)) {
      summary.outcomes[outcome] += 1;
    }
  });

  summary.areaItems = Object.values(summary.areas).sort((a, b) => b.count - a.count);
  delete summary.areas;
  return summary;
}

export function auditHistorySettingsRoutes({ db }) {
  const router = express.Router();

  router.get("/settings/audit-history", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const viewerRole = requireAuditHistoryReader(req, res);
      if (!viewerRole) return;

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const requestedArea = lower(req.query?.area || "");
      const requestedOutcome = lower(req.query?.outcome || "");
      const limit = Math.max(1, Math.min(100, n(req.query?.limit, 30)));

      const rawEntries = await dbListAuditEntries(db, {
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
        actions: AUDITED_ACTIONS,
        limit: Math.max(limit, 60),
        offset: 0,
      });

      const filtered = rawEntries
        .map((entry) => buildAuditHistoryEntry(entry))
        .filter((entry) => (requestedArea ? entry.area === requestedArea : true))
        .filter((entry) => (requestedOutcome ? entry.outcome === requestedOutcome : true))
        .slice(0, limit);

      return ok(res, {
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
        viewerRole: isInternalServiceRequest(req) ? "internal" : getUserRole(req),
        permissions: {
          auditHistoryRead: {
            allowed: true,
            requiredRoles: ["owner", "admin", "analyst"],
            message: "",
          },
        },
        filters: {
          area: requestedArea,
          outcome: requestedOutcome,
          limit,
          availableAreas: Object.entries(AREA_METADATA).map(([key, value]) => ({
            key,
            label: value.label,
          })),
          availableOutcomes: [
            { key: "succeeded", label: "Succeeded" },
            { key: "blocked", label: "Blocked" },
            { key: "failed", label: "Failed" },
          ],
        },
        summary: summarizeAuditHistory(filtered),
        items: filtered,
      });
    } catch (error) {
      return serverErr(res, error?.message || "Failed to load audit history");
    }
  });

  return router;
}
