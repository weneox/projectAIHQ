import express from "express";
import {
  dbListTenantChannels,
  dbUpsertTenantChannel,
} from "../../../db/helpers/settings.js";
import {
  getTenantVoiceSettings,
  upsertTenantVoiceSettings,
} from "../../../db/helpers/voice.js";
import { dbListTenantSecrets } from "../../../db/helpers/tenantSecrets.js";
import { dbGetTenantByKey } from "../../../db/helpers/tenants.js";
import { buildOperationalChannels } from "../../../services/operationalChannels.js";
import {
  buildOperationalRepairGuidance,
  buildReadinessSurface,
} from "../../../services/operationalReadiness.js";
import {
  ok,
  bad,
  requireDb,
  requireTenant,
  requireOperationalManager,
  requireOwnerOrAdminMutation,
  serverErr,
  safeJsonObj,
  cleanLower,
  isInternalServiceRequest,
  getUserRole,
  auditSafe,
} from "./utils.js";
import {
  buildOperationalChannelSaveInput,
  buildVoiceOperationalSaveInput,
} from "./builders.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function buildDataGovernancePosture() {
  return {
    retention: {
      items: [
        {
          key: "runtime_incidents",
          label: "Runtime incident trail",
          status: "bounded",
          classification: "operator_incident_history",
          retainDays: 14,
          maxRows: 5000,
          pruneIntervalHours: 6,
          automatedPrune: true,
          message:
            "Recent runtime incidents are pruned automatically from the repo-managed trail.",
        },
        {
          key: "audit_log",
          label: "Control-plane audit history",
          status: "unbounded_in_repo",
          classification: "governance_mutation_history",
          automatedPrune: false,
          message:
            "No repo-enforced retention window is currently defined for audit_log rows.",
        },
        {
          key: "interaction_history",
          label: "Inbox, comments, and voice interaction records",
          status: "unbounded_in_repo",
          classification: "customer_and_operator_interaction_history",
          automatedPrune: false,
          message:
            "No repo-enforced retention TTL is currently defined for conversation, comment, or voice-linked history in this workspace.",
        },
        {
          key: "truth_history",
          label: "Truth, review, and synthesis history",
          status: "unbounded_in_repo",
          classification: "governed_business_truth_history",
          automatedPrune: false,
          message:
            "Approved truth versions, review sessions, and synthesis snapshots remain durable until database retention is managed outside this repo.",
        },
      ],
    },
    backupRestore: {
      status: "runbook_only",
      selfServeRestore: false,
      automatedBackupOrRestoreVerification: false,
      message:
        "This repo does not create backups or provide self-serve restore. Recovery depends on provider-managed backups or snapshots captured outside the app and the documented rollback runbooks.",
      runbooks: [
        "docs/runbooks/schema-migration-safety.md",
        "docs/runbooks/production-rollback.md",
      ],
    },
  };
}

function pickPrimaryMetaChannel(channels = []) {
  const metaChannels = arr(channels).filter((item) =>
    ["instagram", "facebook", "messenger"].includes(
      lower(item?.channel_type || item?.channelType)
    )
  );

  return (
    metaChannels.find(
      (item) =>
        item?.is_primary === true &&
        ["connected", "active"].includes(lower(item?.status))
    ) ||
    metaChannels.find((item) =>
      ["connected", "active"].includes(lower(item?.status))
    ) ||
    metaChannels[0] ||
    {
      id: "",
      channel_type: "instagram",
      provider: "meta",
      display_name: "",
      external_account_id: "",
      external_page_id: "",
      external_user_id: "",
      external_username: "",
      status: "disconnected",
      is_primary: true,
      secrets_ref: "meta",
      health: {},
      config: {},
      last_sync_at: null,
      created_at: null,
      updated_at: null,
    }
  );
}

function buildVoiceMissingFields(voiceSettings = {}, voiceOperational = {}) {
  const missing = [];

  if (!s(voiceSettings?.tenantId)) {
    missing.push("tenant_voice_settings");
  }
  if (!s(voiceSettings?.twilioPhoneNumber)) {
    missing.push("twilio_phone_number");
  }
  if (!s(voiceSettings?.operatorPhone) && voiceSettings?.operatorEnabled !== false) {
    missing.push("operator_phone");
  }
  if (!s(obj(voiceSettings?.twilioConfig).callerId)) {
    missing.push("twilio_config.callerId");
  }
  if (!s(obj(voiceSettings?.meta).realtimeModel)) {
    missing.push("meta.realtimeModel");
  }
  if (!s(obj(voiceSettings?.meta).realtimeVoice)) {
    missing.push("meta.realtimeVoice");
  }
  if (voiceOperational?.available !== true || voiceOperational?.ready !== true) {
    missing.push(`reason:${s(voiceOperational?.reasonCode || "voice_settings_missing")}`);
  }

  return Array.from(new Set(missing));
}

function buildMetaMissingFields(channel = {}, secretKeys = [], metaOperational = {}) {
  const missing = [];
  const keys = new Set(arr(secretKeys).map((item) => lower(item)));

  if (!s(channel?.id)) {
    missing.push("tenant_channels");
  }
  if (!s(channel?.external_page_id) && !s(channel?.external_user_id)) {
    missing.push("external_page_id_or_external_user_id");
  }
  if (!keys.has("page_access_token")) {
    missing.push("page_access_token");
  }
  if (metaOperational?.available !== true || metaOperational?.ready !== true) {
    missing.push(
      `reason:${s(metaOperational?.reasonCode || "channel_identifiers_missing")}`
    );
  }

  return Array.from(new Set(missing));
}

function buildOperationalSettingsPayload({
  tenant = null,
  voiceSettings = null,
  channels = [],
  operationalChannels = {},
  metaSecretRows = [],
  viewerRole = "member",
} = {}) {
  const ownerAdminAllowed = ["internal", "owner", "admin"].includes(lower(viewerRole));
  const voiceOperational = obj(operationalChannels.voice);
  const metaOperational = obj(operationalChannels.meta);
  const primaryMetaChannel = pickPrimaryMetaChannel(channels);
  const voiceMissingFields = buildVoiceMissingFields(voiceSettings || {}, voiceOperational);
  const metaSecretKeys = arr(metaSecretRows)
    .filter((row) => row?.is_active !== false)
    .map((row) => lower(row?.secret_key))
    .filter(Boolean);
  const metaRequiredSecretKeys = ["page_access_token"];
  const metaOptionalSecretKeys = ["app_secret"];
  const metaMissingFields = buildMetaMissingFields(
    primaryMetaChannel,
    metaSecretKeys,
    metaOperational
  );
  const voiceRepair = buildOperationalRepairGuidance({
    reasonCode: s(voiceOperational?.reasonCode),
    viewerRole,
    missingFields: voiceMissingFields,
    title: "Voice operational blocker",
    subtitle:
      "Production voice traffic stays fail-closed until persisted tenant voice settings are complete.",
    target: {
      panel: "voice",
      field: voiceMissingFields.includes("twilio_phone_number")
        ? "twilioPhoneNumber"
        : voiceMissingFields.includes("operator_phone")
        ? "operatorPhone"
        : "enabled",
      section: "operational",
    },
  });
  const metaRepair = buildOperationalRepairGuidance({
    reasonCode: s(metaOperational?.reasonCode),
    viewerRole,
    missingFields: metaMissingFields,
    title: "Meta operational blocker",
    subtitle:
      "Meta delivery stays fail-closed until the connected channel, identifiers, and required secret coverage are aligned.",
    target: {
      panel: "meta",
      field: metaMissingFields.includes("tenant_channels")
        ? "connect"
        : metaMissingFields.includes("page_access_token")
        ? "providerSecrets"
        : "externalPageId",
      section: metaMissingFields.includes("page_access_token")
        ? "security"
        : "operational",
    },
  });

  return {
    tenant: {
      tenantId: s(tenant?.id),
      tenantKey: lower(tenant?.tenant_key),
      companyName: s(tenant?.company_name),
    },
    voice: {
      settings: voiceSettings || null,
      operational: voiceOperational,
      missingFields: voiceMissingFields,
      repair: voiceRepair,
    },
    channels: {
      items: arr(channels),
      meta: {
        channel: primaryMetaChannel,
        operational: metaOperational,
        missingFields: metaMissingFields,
        repair: metaRepair,
        providerSecrets: {
          provider: lower(primaryMetaChannel?.provider || "meta"),
          secretsRef: s(primaryMetaChannel?.secrets_ref || "meta"),
          requiredSecretKeys: metaRequiredSecretKeys,
          optionalSecretKeys: metaOptionalSecretKeys,
          presentSecretKeys: metaSecretKeys,
          missingSecretKeys: metaRequiredSecretKeys.filter(
            (item) => !metaSecretKeys.includes(item)
          ),
          ready: metaRequiredSecretKeys.every((item) => metaSecretKeys.includes(item)),
        },
      },
    },
    operationalChannels,
    capabilities: {
      canManageOperationalSettings: ownerAdminAllowed,
      canManageProviderSecrets: ownerAdminAllowed,
      operationalSettingsWrite: {
        allowed: ownerAdminAllowed,
        requiredRoles: ["owner", "admin"],
        message: "Only owner/admin can manage operational voice and channel settings.",
      },
      providerSecretsMutation: {
        allowed: ownerAdminAllowed,
        requiredRoles: ["owner", "admin"],
        message: "Only owner/admin can manage provider secrets.",
      },
    },
    readiness: buildReadinessSurface({
      status:
        voiceRepair.blocked || metaRepair.blocked
          ? "blocked"
          : "ready",
      message:
        voiceRepair.blocked || metaRepair.blocked
          ? "Production traffic is blocked until operational dependencies are repaired."
          : "Operational dependencies are ready for production traffic.",
      blockers: [voiceRepair, metaRepair].filter((item) => item.blocked),
    }),
    dataGovernance: buildDataGovernancePosture(),
  };
}

export function operationalSettingsRoutes({ db }) {
  const router = express.Router();

  router.get("/settings/operational", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const voiceSettings = await getTenantVoiceSettings(db, tenant.id);
      const channels = await dbListTenantChannels(db, tenant.id);
      const matchedChannel = pickPrimaryMetaChannel(channels);
      const viewerRole = isInternalServiceRequest(req) ? "internal" : getUserRole(req);
      const operationalChannels = await buildOperationalChannels({
        db,
        tenantId: tenant.id,
        tenantRow: tenant,
        voiceSettings,
        matchedChannel,
      });
      const metaSecretRows = await dbListTenantSecrets(
        db,
        tenant.id,
        lower(matchedChannel?.provider || "meta")
      );

      return ok(res, {
        ...buildOperationalSettingsPayload({
          tenant,
          voiceSettings,
          channels,
          operationalChannels,
          metaSecretRows,
          viewerRole,
        }),
        viewerRole,
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to load operational settings");
    }
  });

  router.post("/settings/operational/voice", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const role = await requireOwnerOrAdminMutation(req, res, {
        db,
        tenant,
        message: "Only owner/admin can manage operational settings",
        auditAction: "settings.operational.voice.updated",
        objectType: "tenant_voice_settings",
        objectId: tenant.id,
        targetArea: "operational_voice",
      });
      if (!role) return;

      const body = safeJsonObj(req.body, {});
      const saveInput = buildVoiceOperationalSaveInput(body);
      if (!s(saveInput.twilioPhoneNumber) && saveInput.enabled === true) {
        await auditSafe(
          db,
          req,
          tenant,
          "settings.operational.voice.updated",
          "tenant_voice_settings",
          tenant.id,
          {
            outcome: "blocked",
            reasonCode: "twilio_phone_number_required",
            targetArea: "operational_voice",
            enabled: true,
            provider: s(saveInput.provider || "twilio"),
          }
        );
        return bad(res, "twilio_phone_number_required", {
          field: "twilioPhoneNumber",
        });
      }

      const voiceSettings = await upsertTenantVoiceSettings(
        db,
        tenant.id,
        saveInput
      );
      const channels = await dbListTenantChannels(db, tenant.id);
      const matchedChannel = pickPrimaryMetaChannel(channels);
      const operationalChannels = await buildOperationalChannels({
        db,
        tenantId: tenant.id,
        tenantRow: tenant,
        voiceSettings,
        matchedChannel,
      });
      const metaSecretRows = await dbListTenantSecrets(
        db,
        tenant.id,
        lower(matchedChannel?.provider || "meta")
      );

      await auditSafe(
        db,
        req,
        tenant,
        "settings.operational.voice.updated",
        "tenant_voice_settings",
        tenant.id,
        {
          outcome: "succeeded",
          targetArea: "operational_voice",
          enabled: voiceSettings?.enabled === true,
          provider: s(voiceSettings?.provider || "twilio"),
        }
      );

      return ok(res, {
        ...buildOperationalSettingsPayload({
          tenant,
          voiceSettings,
          channels,
          operationalChannels,
          metaSecretRows,
          viewerRole: role,
        }),
        viewerRole: role,
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to save voice operational settings");
    }
  });

  router.post("/settings/operational/channels/:type", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const channelType = cleanLower(req.params.type);
      if (!channelType) {
        return bad(res, "channel_type_required");
      }

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const role = await requireOwnerOrAdminMutation(req, res, {
        db,
        tenant,
        message: "Only owner/admin can manage operational settings",
        auditAction: "settings.operational.channel.updated",
        objectType: "tenant_channel",
        objectId: channelType,
        targetArea: "operational_channel",
        auditMeta: {
          channelType,
        },
      });
      if (!role) return;

      const body = safeJsonObj(req.body, {});
      const saveInput = buildOperationalChannelSaveInput(body, role);

      if (
        ["instagram", "facebook", "messenger"].includes(channelType) &&
        !s(saveInput.external_page_id) &&
        !s(saveInput.external_user_id)
      ) {
        await auditSafe(
          db,
          req,
          tenant,
          "settings.operational.channel.updated",
          "tenant_channel",
          channelType,
          {
            outcome: "blocked",
            reasonCode: "channel_identifiers_required",
            targetArea: "operational_channel",
            channelType,
            provider: saveInput.provider,
          }
        );
        return bad(res, "channel_identifiers_required", {
          fields: ["external_page_id", "external_user_id"],
        });
      }

      await dbUpsertTenantChannel(db, tenant.id, channelType, saveInput);

      const voiceSettings = await getTenantVoiceSettings(db, tenant.id);
      const channels = await dbListTenantChannels(db, tenant.id);
      const matchedChannel = pickPrimaryMetaChannel(channels);
      const operationalChannels = await buildOperationalChannels({
        db,
        tenantId: tenant.id,
        tenantRow: tenant,
        voiceSettings,
        matchedChannel,
      });
      const metaSecretRows = await dbListTenantSecrets(
        db,
        tenant.id,
        lower(matchedChannel?.provider || "meta")
      );

      await auditSafe(
        db,
        req,
        tenant,
        "settings.operational.channel.updated",
        "tenant_channel",
        channelType,
        {
          outcome: "succeeded",
          targetArea: "operational_channel",
          channelType,
          provider: saveInput.provider,
          status: saveInput.status,
        }
      );

      return ok(res, {
        ...buildOperationalSettingsPayload({
          tenant,
          voiceSettings,
          channels,
          operationalChannels,
          metaSecretRows,
          viewerRole: role,
        }),
        viewerRole: role,
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to save operational channel");
    }
  });

  return router;
}
