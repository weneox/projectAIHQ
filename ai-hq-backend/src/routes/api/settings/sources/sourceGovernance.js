import { auditSafe } from "../utils.js";
import {
  b,
  bad,
  buildSourceSyncReviewState,
  n,
  normalizeSourcePayload,
  ok,
  pickUserId,
  s,
} from "./shared.js";

export function registerSettingsSourceGovernanceRoutes(router, context) {
  const {
    db,
    getSources,
    getKnowledge,
    requireSettingsWriteRole,
    resolveTenantOr400,
  } = context;

  router.get("/sources", async (req, res) => {
    try {
      const tenant = await resolveTenantOr400(req, res);
      if (!tenant) return;

      const sources = getSources();
      if (!sources) return bad(res, 503, "db disabled", { dbDisabled: true });

      const items = await sources.listSources({
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        sourceType: s(req.query?.sourceType || req.query?.source_type),
        status: s(req.query?.status),
        isEnabled:
          req.query?.isEnabled != null || req.query?.is_enabled != null
            ? b(req.query?.isEnabled ?? req.query?.is_enabled, true)
            : undefined,
        limit: n(req.query?.limit, 100),
        offset: n(req.query?.offset, 0),
      });

      return ok(res, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        items,
        count: items.length,
      });
    } catch (err) {
      return bad(res, 500, err.message || "failed to list sources");
    }
  });

  router.post("/sources", async (req, res) => {
    try {
      const role = requireSettingsWriteRole(req, res);
      if (!role) return;

      const tenant = await resolveTenantOr400(req, res);
      if (!tenant) return;

      const sources = getSources();
      const knowledge = getKnowledge();
      if (!sources || !knowledge) {
        return bad(res, 503, "db disabled", { dbDisabled: true });
      }

      const by = pickUserId(req);
      const payload = normalizeSourcePayload(req.body);
      if (!payload.sourceType) {
        return bad(res, 400, "sourceType is required");
      }

      const item = await sources.upsertSource({
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        ...payload,
        createdBy: by,
        updatedBy: by,
      });

      await knowledge.refreshChannelCapabilitiesFromSources({
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        approvedBy: by,
      });

      await auditSafe(db, req, tenant, "settings.source.created", "tenant_source", item?.id, {
        sourceType: s(item?.source_type),
        sourceKey: s(item?.source_key),
        displayName: s(item?.display_name),
        isPrimary: !!item?.is_primary,
        isEnabled: !!item?.is_enabled,
        syncStatus: s(item?.sync_status),
      });

      return ok(res, { item });
    } catch (err) {
      return bad(res, 500, err.message || "failed to create source");
    }
  });

  router.patch("/sources/:id", async (req, res) => {
    try {
      const role = requireSettingsWriteRole(req, res);
      if (!role) return;

      const tenant = await resolveTenantOr400(req, res);
      if (!tenant) return;

      const sources = getSources();
      const knowledge = getKnowledge();
      if (!sources || !knowledge) return bad(res, 503, "db disabled", { dbDisabled: true });

      const sourceId = s(req.params.id);
      if (!sourceId) return bad(res, 400, "source id is required");

      const current = await sources.getSourceById(sourceId);
      if (!current || current.tenant_id !== tenant.tenant_id) {
        return bad(res, 404, "source not found");
      }

      const by = pickUserId(req);
      const payload = normalizeSourcePayload(req.body);

      const item = await sources.updateSource(sourceId, {
        ...payload,
        displayName:
          req.body?.displayName != null || req.body?.display_name != null
            ? payload.displayName
            : current.display_name,
        status: req.body?.status != null ? payload.status : current.status,
        authStatus:
          req.body?.authStatus != null || req.body?.auth_status != null
            ? payload.authStatus
            : current.auth_status,
        syncStatus:
          req.body?.syncStatus != null || req.body?.sync_status != null
            ? payload.syncStatus
            : current.sync_status,
        connectionMode:
          req.body?.connectionMode != null || req.body?.connection_mode != null
            ? payload.connectionMode
            : current.connection_mode,
        accessScope:
          req.body?.accessScope != null || req.body?.access_scope != null
            ? payload.accessScope
            : current.access_scope,
        sourceUrl:
          req.body?.sourceUrl != null || req.body?.source_url != null
            ? payload.sourceUrl
            : current.source_url,
        externalAccountId:
          req.body?.externalAccountId != null || req.body?.external_account_id != null
            ? payload.externalAccountId
            : current.external_account_id,
        externalPageId:
          req.body?.externalPageId != null || req.body?.external_page_id != null
            ? payload.externalPageId
            : current.external_page_id,
        externalUsername:
          req.body?.externalUsername != null || req.body?.external_username != null
            ? payload.externalUsername
            : current.external_username,
        isEnabled:
          req.body?.isEnabled != null || req.body?.is_enabled != null
            ? payload.isEnabled
            : current.is_enabled,
        isPrimary:
          req.body?.isPrimary != null || req.body?.is_primary != null
            ? payload.isPrimary
            : current.is_primary,
        permissionsJson:
          req.body?.permissionsJson != null || req.body?.permissions != null
            ? payload.permissionsJson
            : current.permissions_json,
        settingsJson:
          req.body?.settingsJson != null || req.body?.settings != null
            ? payload.settingsJson
            : current.settings_json,
        metadataJson:
          req.body?.metadataJson != null || req.body?.metadata != null
            ? payload.metadataJson
            : current.metadata_json,
        updatedBy: by,
      });

      await knowledge.refreshChannelCapabilitiesFromSources({
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        approvedBy: by,
      });

      await auditSafe(db, req, tenant, "settings.source.updated", "tenant_source", item?.id, {
        sourceType: s(item?.source_type),
        sourceKey: s(item?.source_key),
        displayName: s(item?.display_name),
        isPrimary: !!item?.is_primary,
        isEnabled: !!item?.is_enabled,
        syncStatus: s(item?.sync_status),
        status: s(item?.status),
      });

      return ok(res, { item });
    } catch (err) {
      return bad(res, 500, err.message || "failed to update source");
    }
  });

  router.get("/sources/:id/sync-runs", async (req, res) => {
    try {
      const tenant = await resolveTenantOr400(req, res);
      if (!tenant) return;

      const sources = getSources();
      if (!sources) return bad(res, 503, "db disabled", { dbDisabled: true });

      const sourceId = s(req.params.id);
      if (!sourceId) return bad(res, 400, "source id is required");

      const source = await sources.getSourceById(sourceId);
      if (!source || source.tenant_id !== tenant.tenant_id) {
        return bad(res, 404, "source not found");
      }

      const items = await sources.listSyncRuns({
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        sourceId,
        status: s(req.query?.status),
        limit: n(req.query?.limit, 100),
        offset: n(req.query?.offset, 0),
      });

      return ok(res, { source, items, count: items.length });
    } catch (err) {
      return bad(res, 500, err.message || "failed to list sync runs");
    }
  });

  router.post("/sources/:id/sync", async (req, res) => {
    try {
      const role = requireSettingsWriteRole(req, res);
      if (!role) return;

      const tenant = await resolveTenantOr400(req, res);
      if (!tenant) return;

      const sources = getSources();
      if (!sources) return bad(res, 503, "db disabled", { dbDisabled: true });

      const sourceId = s(req.params.id);
      if (!sourceId) return bad(res, 400, "source id is required");

      const source = await sources.getSourceById(sourceId);
      if (!source || source.tenant_id !== tenant.tenant_id) {
        return bad(res, 404, "source not found");
      }

      const by = pickUserId(req);
      const runnerKey = s(req.body?.runnerKey || req.body?.runner_key || "settings.manual");
      const runType = s(req.body?.runType || req.body?.run_type || "sync");
      const triggerType = s(req.body?.triggerType || req.body?.trigger_type || "manual");

      req.log?.info("source_sync.enqueue.requested", {
        sourceId,
        runnerKey,
        runType,
        triggerType,
      });

      const started = await sources.beginSourceSync({
        sourceId,
        requestedBy: by,
        runnerKey,
        runType,
        triggerType,
        metadataJson: {
          workerTaskType: "tenant_source_sync",
          requestId: s(req.requestId),
          correlationId: s(req.correlationId),
        },
      });

      req.log?.info("source_sync.enqueued", {
        sourceId,
        runId: s(started.run?.id),
        tenantId: s(tenant.tenant_id),
        tenantKey: s(tenant.tenant_key),
      });

      const review = buildSourceSyncReviewState(started);

      await auditSafe(
        db,
        req,
        tenant,
        "settings.source.sync.requested",
        "tenant_source_sync_run",
        started.run?.id || sourceId,
        {
          sourceId,
          sourceType: s(started.source?.source_type || source.source_type),
          runId: s(started.run?.id),
          runType,
          triggerType,
          runnerKey,
          review,
        }
      );

      return res.status(202).json({
        ok: true,
        accepted: true,
        message: "sync accepted",
        status: "queued",
        source: started.source,
        run: started.run,
        review,
        poll: {
          sourceId,
          runsPath: `/api/sources/${sourceId}/sync-runs`,
        },
      });
    } catch (err) {
      req.log?.error("source_sync.enqueue.failed", err, {
        sourceId: s(req.params?.id),
      });
      return bad(res, 500, err.message || "failed to start sync");
    }
  });
}
