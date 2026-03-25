import archiver from "archiver";
import { requireInternalToken } from "../../../utils/auth.js";
import { requireAdminSession, hashUserPassword } from "../../../utils/adminAuth.js";

import {
  dbExportTenantBundle,
  dbExportTenantCsvBundle,
} from "../../../db/helpers/tenantExport.js";

import {
  auditSafe,
  bad,
  cleanLower,
  cleanNullableString,
  cleanString,
  asBool,
  asJsonObj,
  ensureDb,
  getActor,
  isLikelyEmail,
  isReservedTenantKey,
  ok,
  serverErr,
  slugTenantKey,
  validTenantKey,
} from "./utils.js";

import {
  buildAiPolicyInput,
  buildOwnerInput,
  buildProfileInput,
  buildTenantCoreInput,
  buildTenantUserInput,
  pickChannels,
  pickDefaultAgents,
} from "./builders.js";

import {
  dbCreateTenantUser,
  dbDeleteTenantUser,
  dbGetTenantByKey,
  dbGetTenantDetail,
  dbGetTenantUserByEmail,
  dbGetTenantUserById,
  dbGetWorkspaceSettings,
  dbListTenantUsers,
  dbListTenants,
  dbPatchTenantByKey,
  dbResolveTenantChannel,
  dbSetTenantUserStatus,
  dbUpdateTenantUser,
  dbUpsertTenantAgent,
  dbUpsertTenantAiPolicy,
  dbUpsertTenantChannel,
  dbUpsertTenantCore,
  dbUpsertTenantProfile,
} from "./repository.js";

export function createTenantsHandlers({ db }) {
  const requireAdmin = requireAdminSession;

  async function resolveChannel(req, res) {
    try {
      if (!ensureDb(res, db)) return;

      const channel = cleanLower(req.query.channel || "");
      const recipientId = cleanNullableString(req.query.recipientId);
      const pageId = cleanNullableString(req.query.pageId);
      const igUserId = cleanNullableString(req.query.igUserId);

      if (!channel) return bad(res, "channel is required");
      if (!recipientId && !pageId && !igUserId) {
        return bad(res, "recipientId or pageId or igUserId is required");
      }

      const match = await dbResolveTenantChannel(db, {
        channel,
        recipientId,
        pageId,
        igUserId,
      });

      if (!match?.tenant_id) {
        return res.status(404).json({
          ok: false,
          error: "Tenant channel not found",
          channel,
          recipientId: recipientId || null,
          pageId: pageId || null,
          igUserId: igUserId || null,
        });
      }

      return ok(res, {
        tenantKey: match.tenant_key,
        tenantId: match.tenant_id,
        resolvedChannel: match.channel_type,
        tenant: {
          id: match.tenant_id,
          tenant_key: match.tenant_key,
          company_name: match.company_name,
          legal_name: match.legal_name,
          industry_key: match.industry_key,
          country_code: match.country_code,
          timezone: match.timezone,
          default_language: match.default_language,
          enabled_languages: match.enabled_languages,
          market_region: match.market_region,
          plan_key: match.plan_key,
          status: match.tenant_status,
          active: match.tenant_active,
        },
        channelConfig: {
          id: match.id,
          tenant_id: match.tenant_id,
          channel_type: match.channel_type,
          provider: match.provider,
          display_name: match.display_name,
          external_account_id: match.external_account_id,
          external_page_id: match.external_page_id,
          external_user_id: match.external_user_id,
          external_username: match.external_username,
          status: match.status,
          is_primary: match.is_primary,
          config: match.config,
          secrets_ref: match.secrets_ref,
          health: match.health,
          last_sync_at: match.last_sync_at,
          created_at: match.created_at,
          updated_at: match.updated_at,
        },
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to resolve tenant channel");
    }
  }

  async function listTenants(req, res) {
    try {
      if (!ensureDb(res, db)) return;

      const status = cleanLower(req.query.status || "");
      const activeOnly = String(req.query.activeOnly || "").trim() === "1";

      const tenants = await dbListTenants(db, { status, activeOnly });
      return ok(res, { tenants });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to list tenants");
    }
  }

  async function getTenant(req, res) {
    try {
      if (!ensureDb(res, db)) return;

      const tenantKey = slugTenantKey(req.params.key);
      if (!tenantKey) return bad(res, "tenant key is required");

      const settings = await dbGetTenantDetail(db, tenantKey);
      if (!settings?.tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      return ok(res, settings);
    } catch (err) {
      return serverErr(res, err?.message || "Failed to load tenant");
    }
  }

  async function listTenantUsers(req, res) {
    try {
      if (!ensureDb(res, db)) return;

      const tenantKey = slugTenantKey(req.params.key);
      if (!tenantKey) return bad(res, "tenant key is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const users = await dbListTenantUsers(db, tenant.id);
      return ok(res, { tenant, users });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to load tenant users");
    }
  }

  async function getTenantUser(req, res) {
    try {
      if (!ensureDb(res, db)) return;

      const tenantKey = slugTenantKey(req.params.key);
      if (!tenantKey) return bad(res, "tenant key is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const user = await dbGetTenantUserById(db, tenant.id, req.params.id);
      if (!user?.id) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      return ok(res, { tenant, user });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to load tenant user");
    }
  }

  async function createTenantUser(req, res) {
    try {
      if (!ensureDb(res, db)) return;

      const actor = getActor(req);
      const tenantKey = slugTenantKey(req.params.key);
      if (!tenantKey) return bad(res, "tenant key is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const input = buildTenantUserInput(req.body);
      if (!input.user_email) {
        return bad(res, "user_email is required");
      }
      if (!isLikelyEmail(input.user_email)) {
        return bad(res, "user_email is invalid");
      }

      const existing = await dbGetTenantUserByEmail(db, tenant.id, input.user_email);
      if (existing?.id) {
        return bad(res, "User already exists for this tenant", {
          userId: existing.id,
        });
      }

      const user = await dbCreateTenantUser(db, tenant.id, input);

      await auditSafe(db, actor, "tenant.user.created", "tenant_user", user?.id, {
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
        user_email: input.user_email,
        role: input.role,
        status: input.status,
      });

      return ok(res, { tenant, user });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to create tenant user");
    }
  }

  async function updateTenantUser(req, res) {
    try {
      if (!ensureDb(res, db)) return;

      const actor = getActor(req);
      const tenantKey = slugTenantKey(req.params.key);
      if (!tenantKey) return bad(res, "tenant key is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const current = await dbGetTenantUserById(db, tenant.id, req.params.id);
      if (!current?.id) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      const patchInput = buildTenantUserInput({
        ...current,
        ...asJsonObj(req.body, {}),
      });

      const user = await dbUpdateTenantUser(db, tenant.id, req.params.id, patchInput);

      await auditSafe(db, actor, "tenant.user.updated", "tenant_user", user?.id, {
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
        user_email: user?.user_email,
        role: user?.role,
        status: user?.status,
      });

      return ok(res, { tenant, user });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to update tenant user");
    }
  }

  async function updateTenantUserStatus(req, res) {
    try {
      if (!ensureDb(res, db)) return;

      const actor = getActor(req);
      const tenantKey = slugTenantKey(req.params.key);
      if (!tenantKey) return bad(res, "tenant key is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const status = cleanLower(req.body?.status || "");
      if (!status) return bad(res, "status is required");

      const user = await dbSetTenantUserStatus(db, tenant.id, req.params.id, status);
      if (!user?.id) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      await auditSafe(db, actor, "tenant.user.status.updated", "tenant_user", user.id, {
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
        status: user.status,
      });

      return ok(res, { tenant, user });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to update tenant user status");
    }
  }

  async function updateTenantUserPassword(req, res) {
    try {
      if (!ensureDb(res, db)) return;

      const actor = getActor(req);
      const tenantKey = slugTenantKey(req.params.key);
      if (!tenantKey) return bad(res, "tenant key is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const current = await dbGetTenantUserById(db, tenant.id, req.params.id);
      if (!current?.id) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      const password = cleanString(req.body?.password || "");
      if (!password) return bad(res, "password is required");

      const user = await dbUpdateTenantUser(db, tenant.id, req.params.id, {
        ...current,
        password_hash: hashUserPassword(password),
        auth_provider: "local",
        email_verified: true,
      });

      await auditSafe(db, actor, "tenant.user.password.updated", "tenant_user", user?.id, {
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
        user_email: user?.user_email,
      });

      return ok(res, {
        tenant,
        user,
        passwordUpdated: true,
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to update tenant user password");
    }
  }

  async function deleteTenantUser(req, res) {
    try {
      if (!ensureDb(res, db)) return;

      const actor = getActor(req);
      const tenantKey = slugTenantKey(req.params.key);
      if (!tenantKey) return bad(res, "tenant key is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const current = await dbGetTenantUserById(db, tenant.id, req.params.id);
      if (!current?.id) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      const deleted = await dbDeleteTenantUser(db, tenant.id, req.params.id);
      if (!deleted) {
        return bad(res, "Delete failed");
      }

      await auditSafe(db, actor, "tenant.user.deleted", "tenant_user", current.id, {
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
        user_email: current.user_email,
      });

      return ok(res, {
        tenant,
        deleted: true,
        id: current.id,
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to delete tenant user");
    }
  }

  async function exportTenantJson(req, res) {
    try {
      if (!ensureDb(res, db)) return;

      const tenantKey = slugTenantKey(req.params.key);
      if (!tenantKey) return bad(res, "tenant key is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      const bundle = await dbExportTenantBundle(db, tenantKey);

      await auditSafe(
        db,
        req,
        tenant || { id: bundle?.tenantId || null, tenant_key: tenantKey },
        "tenant.export.json",
        "tenant",
        bundle?.tenantId || tenant?.id || tenantKey,
        {
          exportType: "json",
          tenantKey,
        }
      );

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="' + tenantKey + '-export.json"'
      );

      return res.status(200).json({
        ok: true,
        exportType: "json",
        export: bundle,
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to export tenant");
    }
  }

  async function exportTenantCsv(req, res) {
    try {
      if (!ensureDb(res, db)) return;

      const tenantKey = slugTenantKey(req.params.key);
      if (!tenantKey) return bad(res, "tenant key is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      const csvBundle = await dbExportTenantCsvBundle(db, tenantKey);

      await auditSafe(
        db,
        req,
        tenant || { id: csvBundle?.tenantId || null, tenant_key: tenantKey },
        "tenant.export.csv",
        "tenant",
        csvBundle?.tenantId || tenant?.id || tenantKey,
        {
          exportType: "csv_bundle",
          tenantKey,
          fileCount: Object.keys(csvBundle?.files || {}).length,
        }
      );

      return res.status(200).json({
        ok: true,
        exportType: "csv_bundle",
        tenantKey,
        exportedAt: csvBundle.exportedAt,
        files: csvBundle.files,
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to export tenant csv");
    }
  }

  async function exportTenantZip(req, res) {
    try {
      if (!ensureDb(res, db)) return;

      const tenantKey = slugTenantKey(req.params.key);
      if (!tenantKey) return bad(res, "tenant key is required");

      const tenant = await dbGetTenantByKey(db, tenantKey);
      const jsonBundle = await dbExportTenantBundle(db, tenantKey);
      const csvBundle = await dbExportTenantCsvBundle(db, tenantKey);

      await auditSafe(
        db,
        req,
        tenant || { id: jsonBundle?.tenantId || null, tenant_key: tenantKey },
        "tenant.export.zip",
        "tenant",
        jsonBundle?.tenantId || tenant?.id || tenantKey,
        {
          exportType: "zip",
          tenantKey,
          csvFileCount: Object.keys(csvBundle?.files || {}).length,
        }
      );

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="' + tenantKey + '-export.zip"'
      );

      const archive = archiver("zip", { zlib: { level: 9 } });

      archive.on("error", (err) => {
        if (!res.headersSent) {
          res.status(500).json({
            ok: false,
            error: err?.message || "ZIP archive failed",
          });
        } else {
          res.destroy(err);
        }
      });

      archive.pipe(res);

      archive.append(JSON.stringify(jsonBundle, null, 2), {
        name: tenantKey + "/export.json",
      });

      for (const [filename, content] of Object.entries(csvBundle.files || {})) {
        archive.append(content || "", {
          name: tenantKey + "/csv/" + filename,
        });
      }

      await archive.finalize();
    } catch (err) {
      return serverErr(res, err?.message || "Failed to export tenant zip");
    }
  }
  async function createTenant(req, res) {
    try {
      if (!ensureDb(res, db)) return;

      const body = asJsonObj(req.body, {});
      const actor = getActor(req);

      const tenantCoreInput = buildTenantCoreInput(body);

      if (!tenantCoreInput.tenant_key) {
        return bad(res, "tenant.tenant_key is required");
      }

      if (!validTenantKey(tenantCoreInput.tenant_key)) {
        return bad(
          res,
          "tenant_key must use only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen"
        );
      }

      if (isReservedTenantKey(tenantCoreInput.tenant_key)) {
        return bad(res, "tenant_key is reserved");
      }

      if (!tenantCoreInput.company_name) {
        return bad(res, "tenant.company_name is required");
      }

      const ownerInput = buildOwnerInput(body, tenantCoreInput);
      if (!ownerInput.user_email) {
        return bad(res, "owner.user_email is required");
      }

      if (!isLikelyEmail(ownerInput.user_email)) {
        return bad(res, "owner.user_email is invalid");
      }

      const existing = await dbGetTenantByKey(db, tenantCoreInput.tenant_key);
      if (existing?.id) {
        return bad(res, "Tenant already exists", {
          tenantKey: existing.tenant_key,
          tenantId: existing.id,
        });
      }

      const tenantCore = await dbUpsertTenantCore(
        db,
        tenantCoreInput.tenant_key,
        tenantCoreInput
      );

      if (!tenantCore?.id) {
        return serverErr(res, "Tenant create failed");
      }

      const profileInput = buildProfileInput(body, tenantCoreInput);
      const aiPolicyInput = buildAiPolicyInput(body);

      await dbUpsertTenantProfile(db, tenantCore.id, profileInput);
      await dbUpsertTenantAiPolicy(db, tenantCore.id, aiPolicyInput);

      const alreadyOwner = await dbGetTenantUserByEmail(
        db,
        tenantCore.id,
        ownerInput.user_email
      );

      if (!alreadyOwner?.id) {
        await dbCreateTenantUser(db, tenantCore.id, ownerInput);
      }

      const agents = pickDefaultAgents(body);
      for (const agent of agents) {
        const agentKey = cleanLower(agent.agent_key || agent.key || "");
        if (!agentKey) continue;

        await dbUpsertTenantAgent(db, tenantCore.id, agentKey, {
          display_name: cleanString(
            agent.display_name || agent.displayName || agentKey
          ),
          role_summary: cleanString(
            agent.role_summary || agent.roleSummary || ""
          ),
          enabled: asBool(agent.enabled, true),
          model: cleanNullableString(agent.model || "gpt-5"),
          temperature: agent.temperature,
          prompt_overrides: asJsonObj(
            agent.prompt_overrides || agent.promptOverrides,
            {}
          ),
          tool_access: asJsonObj(agent.tool_access || agent.toolAccess, {}),
          limits: asJsonObj(agent.limits, {}),
        });
      }

      const channels = pickChannels(body);
      for (const channel of channels) {
        const channelType = cleanLower(
          channel.channel_type || channel.channelType || ""
        );
        if (!channelType) continue;

        await dbUpsertTenantChannel(db, tenantCore.id, channelType, {
          provider: cleanLower(channel.provider || "meta"),
          display_name: cleanString(
            channel.display_name || channel.displayName || ""
          ),
          external_account_id: cleanNullableString(
            channel.external_account_id || channel.externalAccountId
          ),
          external_page_id: cleanNullableString(
            channel.external_page_id || channel.externalPageId
          ),
          external_user_id: cleanNullableString(
            channel.external_user_id || channel.externalUserId
          ),
          external_username: cleanNullableString(
            channel.external_username || channel.externalUsername
          ),
          status: cleanLower(channel.status || "disconnected"),
          is_primary: asBool(channel.is_primary, false),
          config: asJsonObj(channel.config, {}),
          secrets_ref: cleanNullableString(
            channel.secrets_ref || channel.secretsRef
          ),
          health: asJsonObj(channel.health, {}),
          last_sync_at: cleanNullableString(
            channel.last_sync_at || channel.lastSyncAt
          ),
        });
      }

      await auditSafe(db, actor, "tenant.created", "tenant", tenantCore.id, {
        tenantId: tenantCore.id,
        tenantKey: tenantCore.tenant_key,
        companyName: tenantCore.company_name,
        ownerEmail: ownerInput.user_email,
      });

      const settings = await dbGetWorkspaceSettings(db, tenantCore.tenant_key);

      return ok(res, {
        tenant: settings?.tenant || tenantCore,
        profile: settings?.profile || null,
        aiPolicy: settings?.aiPolicy || null,
        channels: settings?.channels || [],
        agents: settings?.agents || [],
        users: settings?.users || [],
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to create tenant");
    }
  }


  async function patchTenant(req, res) {
    try {
      if (!ensureDb(res, db)) return;

      const actor = getActor(req);

      const tenantKey = slugTenantKey(req.params.key);
      if (!tenantKey) return bad(res, "tenant key is required");

      const current = await dbGetTenantByKey(db, tenantKey);
      if (!current?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const body = asJsonObj(req.body, {});
      const tenantPatch = asJsonObj(body.tenant, body);

      const updated = await dbPatchTenantByKey(db, tenantKey, tenantPatch);
      if (!updated?.id) {
        return serverErr(res, "Tenant update failed");
      }

      if (body.profile && typeof body.profile === "object") {
        await dbUpsertTenantProfile(db, updated.id, buildProfileInput(body, updated));
      }

      if (body.aiPolicy && typeof body.aiPolicy === "object") {
        await dbUpsertTenantAiPolicy(db, updated.id, buildAiPolicyInput(body));
      }

      if (Array.isArray(body.channels)) {
        for (const channel of body.channels) {
          const channelType = cleanLower(
            channel.channel_type || channel.channelType || ""
          );
          if (!channelType) continue;

          await dbUpsertTenantChannel(db, updated.id, channelType, {
            provider: cleanLower(channel.provider || "meta"),
            display_name: cleanString(
              channel.display_name || channel.displayName || ""
            ),
            external_account_id: cleanNullableString(
              channel.external_account_id || channel.externalAccountId
            ),
            external_page_id: cleanNullableString(
              channel.external_page_id || channel.externalPageId
            ),
            external_user_id: cleanNullableString(
              channel.external_user_id || channel.externalUserId
            ),
            external_username: cleanNullableString(
              channel.external_username || channel.externalUsername
            ),
            status: cleanLower(channel.status || "disconnected"),
            is_primary: asBool(channel.is_primary, false),
            config: asJsonObj(channel.config, {}),
            secrets_ref: cleanNullableString(
              channel.secrets_ref || channel.secretsRef
            ),
            health: asJsonObj(channel.health, {}),
            last_sync_at: cleanNullableString(
              channel.last_sync_at || channel.lastSyncAt
            ),
          });
        }
      }

      if (Array.isArray(body.agents)) {
        for (const agent of body.agents) {
          const agentKey = cleanLower(agent.agent_key || agent.key || "");
          if (!agentKey) continue;

          await dbUpsertTenantAgent(db, updated.id, agentKey, {
            display_name: cleanString(
              agent.display_name || agent.displayName || agentKey
            ),
            role_summary: cleanString(
              agent.role_summary || agent.roleSummary || ""
            ),
            enabled: asBool(agent.enabled, true),
            model: cleanNullableString(agent.model || "gpt-5"),
            temperature: agent.temperature,
            prompt_overrides: asJsonObj(
              agent.prompt_overrides || agent.promptOverrides,
              {}
            ),
            tool_access: asJsonObj(agent.tool_access || agent.toolAccess, {}),
            limits: asJsonObj(agent.limits, {}),
          });
        }
      }

      await auditSafe(db, actor, "tenant.updated", "tenant", updated.id, {
        tenantId: updated.id,
        tenantKey: updated.tenant_key,
      });

      const settings = await dbGetWorkspaceSettings(db, updated.tenant_key);
      return ok(res, settings || { tenant: updated });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to update tenant");
    }
  }

  return {
    requireAdmin,
    requireInternal: requireInternalToken,
    resolveChannel,
    listTenants,
    getTenant,
    listTenantUsers,
    getTenantUser,
    createTenantUser,
    updateTenantUser,
    updateTenantUserStatus,
    updateTenantUserPassword,
    deleteTenantUser,
    exportTenantJson,
    exportTenantCsv,
    exportTenantZip,
    createTenant,
    patchTenant,
  };
}
