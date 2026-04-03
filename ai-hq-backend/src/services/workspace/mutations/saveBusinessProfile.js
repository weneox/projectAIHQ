// src/services/workspace/mutations/saveBusinessProfile.js
// saveBusinessProfile extracted from src/services/workspace/mutations.js

import { arr, obj, s } from "../shared.js";
import { buildSetupStatus } from "../setup.js";
import { createTenantKnowledgeHelpers } from "../../../db/helpers/tenantKnowledge.js";
import { jsonb } from "./shared.js";
import {
  resolveTenantScope,
  updateRowById,
  upsertByTenantId,
  firstScopedRow,
} from "./scope.js";
import {
  normalizeBusinessProfileInput,
  buildSavedBusinessPayload,
  buildCanonicalProfileInput,
  buildCanonicalCapabilitiesInput,
} from "./normalize.js";

export async function saveBusinessProfile({
  db,
  tenantId,
  tenantKey,
  role = "",
  tenant = null,
  body = {},
}) {
  if (!tenantId && !tenantKey) {
    throw new Error("saveBusinessProfile: tenant scope is required");
  }

  const blocked = new Error(
    "Direct business profile writes are no longer allowed here. Stage governed business/profile changes through /api/setup/business-profile and publish them through setup review."
  );
  blocked.code = "GOVERNED_BUSINESS_PROFILE_WRITE_BLOCKED";
  blocked.statusCode = 409;
  throw blocked;

  const { normalized, provided, providedKeys } = normalizeBusinessProfileInput(body);

  if (!providedKeys.length) {
    throw new Error("No business profile fields were provided");
  }

  const knowledge = createTenantKnowledgeHelpers({ db });

  const scope = await resolveTenantScope({
    db,
    tenantId,
    tenantKey,
    tenant,
  });

  const currentProfile = await knowledge.getBusinessProfile({
    tenantId: scope.id,
    tenantKey: scope.tenantKey,
  });

  const currentCapabilities = await knowledge.getBusinessCapabilities({
    tenantId: scope.id,
    tenantKey: scope.tenantKey,
  });

  const currentTenantProfileRow = await firstScopedRow(db, "tenant_profiles", {
    tenantId: scope.id,
    tenantKey: scope.tenantKey,
  });

  const existingProfileLanguages = arr(currentProfile?.supported_languages);
  const effectiveLanguages =
    provided.languages && normalized.languages.length
      ? normalized.languages
      : existingProfileLanguages.length
        ? existingProfileLanguages
        : scope.enabledLanguages.length
          ? scope.enabledLanguages
          : [scope.defaultLanguage || "az"];

  const effectivePrimaryLanguage =
    effectiveLanguages[0] ||
    s(currentProfile?.main_language || scope.defaultLanguage || "az");

  const writes = [];

  const tenantPatch = {};
  if (provided.companyName) tenantPatch.company_name = normalized.companyName;
  if (provided.timezone) tenantPatch.timezone = normalized.timezone;
  if (provided.languages) {
    tenantPatch.default_language = effectivePrimaryLanguage;
    tenantPatch.enabled_languages = effectiveLanguages;
  }

  const tenantWrite = await updateRowById({
    db,
    tableName: "tenants",
    idColumn: "id",
    idValue: scope.id,
    patch: tenantPatch,
  });
  if (tenantWrite) writes.push(tenantWrite);

  const mergedExtraContext = {
    ...obj(currentTenantProfileRow?.extra_context),
  };

  if (provided.timezone) mergedExtraContext.timezone = normalized.timezone;
  if (provided.languages) mergedExtraContext.languages = effectiveLanguages;

  const tenantProfilesPatch = {};
  if (provided.companyName) tenantProfilesPatch.brand_name = normalized.companyName;
  if (provided.description) tenantProfilesPatch.brand_summary = normalized.description;
  if (provided.tone) tenantProfilesPatch.tone_of_voice = normalized.tone;
  if (Object.keys(mergedExtraContext).length) {
    tenantProfilesPatch.extra_context = jsonb(mergedExtraContext);
  }

  const tenantProfilesWrite = await upsertByTenantId({
    db,
    tableName: "tenant_profiles",
    tenantId: scope.id,
    insertPatch: {},
    updatePatch: tenantProfilesPatch,
  });
  if (tenantProfilesWrite) writes.push(tenantProfilesWrite);

  const canonicalProfile = await knowledge.upsertBusinessProfile(
    buildCanonicalProfileInput({
      scope,
      currentProfile,
      normalized,
      provided,
      effectiveLanguages,
      effectivePrimaryLanguage,
    })
  );

  writes.push({
    table: "tenant_business_profile",
    action: currentProfile?.id ? "update" : "insert",
    changedFields: providedKeys,
    canonical: true,
    rowId: s(canonicalProfile?.id),
  });

  const canonicalCapabilities = await knowledge.upsertBusinessCapabilities(
    buildCanonicalCapabilitiesInput({
      scope,
      currentCapabilities,
      overrides: {
        primaryLanguage: provided.languages ? effectivePrimaryLanguage : undefined,
        supportedLanguages: provided.languages ? effectiveLanguages : undefined,
        supportsMultilanguage: provided.languages ? effectiveLanguages.length > 1 : undefined,
      },
      approvedBy: "workspace_setup",
    })
  );

  writes.push({
    table: "tenant_business_capabilities",
    action: currentCapabilities?.id ? "update" : "insert",
    changedFields: [
      ...(provided.languages ? ["primaryLanguage", "supportedLanguages"] : []),
    ],
    canonical: true,
    rowId: s(canonicalCapabilities?.id),
  });

  const setup = await buildSetupStatus({
    db,
    tenantId: scope.id,
    tenantKey: scope.tenantKey,
    role,
    tenant,
  });

  return {
    saved: buildSavedBusinessPayload(normalized, {
      companyName: s(canonicalProfile?.company_name || scope.companyName),
      timezone:
        normalized.timezone ||
        s(currentProfile?.profile_json?.timezone || scope.timezone),
      enabledLanguages: effectiveLanguages,
    }),
    writes,
    setup,
  };
}
