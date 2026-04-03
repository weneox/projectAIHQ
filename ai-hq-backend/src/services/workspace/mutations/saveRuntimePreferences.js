// src/services/workspace/mutations/saveRuntimePreferences.js
// saveRuntimePreferences extracted from src/services/workspace/mutations.js

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
  normalizeRuntimePreferencesInput,
  buildSavedRuntimePayload,
  buildCanonicalProfileInput,
  buildCanonicalCapabilitiesInput,
} from "./normalize.js";

export async function saveRuntimePreferences({
  db,
  tenantId,
  tenantKey,
  role = "",
  tenant = null,
  body = {},
}) {
  if (!tenantId && !tenantKey) {
    throw new Error("saveRuntimePreferences: tenant scope is required");
  }

  const blocked = new Error(
    "Direct runtime preference writes are no longer allowed here because they can mutate governed business truth. Use setup review staging for governed changes and operational settings routes for direct runtime controls."
  );
  blocked.code = "GOVERNED_RUNTIME_PREFERENCES_WRITE_BLOCKED";
  blocked.statusCode = 409;
  throw blocked;

  const { normalized, provided, providedKeys } =
    normalizeRuntimePreferencesInput(body);

  if (!providedKeys.length) {
    throw new Error("No runtime preference fields were provided");
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

  const currentAiPolicies = await firstScopedRow(db, "tenant_ai_policies", {
    tenantId: scope.id,
    tenantKey: scope.tenantKey,
  });

  const currentTenantProfileRow = await firstScopedRow(db, "tenant_profiles", {
    tenantId: scope.id,
    tenantKey: scope.tenantKey,
  });

  const existingLanguages = arr(currentCapabilities?.supported_languages).length
    ? arr(currentCapabilities.supported_languages)
    : arr(currentProfile?.supported_languages).length
      ? arr(currentProfile.supported_languages)
      : scope.enabledLanguages;

  const effectiveLanguages =
    provided.languages && normalized.languages.length
      ? normalized.languages
      : existingLanguages.length
        ? existingLanguages
        : [normalized.defaultLanguage || scope.defaultLanguage || "az"];

  const effectivePrimaryLanguage =
    normalized.defaultLanguage ||
    effectiveLanguages[0] ||
    s(
      currentCapabilities?.primary_language ||
        currentProfile?.main_language ||
        scope.defaultLanguage ||
        "az"
    );

  const writes = [];

  const tenantPatch = {};
  if (provided.defaultLanguage) {
    tenantPatch.default_language = effectivePrimaryLanguage;
  }
  if (provided.languages) {
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

  if (provided.languages || provided.defaultLanguage) {
    mergedExtraContext.languages = effectiveLanguages;
  }

  const profilePatch = {};
  if (provided.tone) {
    profilePatch.tone_of_voice = normalized.tone || "professional";
  }
  if (Object.keys(mergedExtraContext).length) {
    profilePatch.extra_context = jsonb(mergedExtraContext);
  }

  const profileWrite = await upsertByTenantId({
    db,
    tableName: "tenant_profiles",
    tenantId: scope.id,
    insertPatch: {},
    updatePatch: profilePatch,
  });
  if (profileWrite) writes.push(profileWrite);

  const nextInboxPolicyBase = obj(currentAiPolicies?.inbox_policy);
  const nextCommentPolicyBase = obj(currentAiPolicies?.comment_policy);

  let nextInboxPolicy = null;
  let nextCommentPolicy = null;
  let nextContentPolicy = null;
  let nextPublishPolicy = null;
  let nextRiskRules = null;
  let nextEscalationRules = null;
  let nextLeadScoringRules = null;

  if (provided.policies) {
    const policies = obj(normalized.policies);

    if (policies.inboxPolicy || policies.inbox_policy) {
      nextInboxPolicy = {
        ...nextInboxPolicyBase,
        ...obj(policies.inboxPolicy ?? policies.inbox_policy),
      };
    }

    if (policies.commentPolicy || policies.comment_policy) {
      nextCommentPolicy = {
        ...nextCommentPolicyBase,
        ...obj(policies.commentPolicy ?? policies.comment_policy),
      };
    }

    if (policies.contentPolicy || policies.content_policy) {
      nextContentPolicy = obj(
        policies.contentPolicy ?? policies.content_policy
      );
    }

    if (policies.publishPolicy || policies.publish_policy) {
      nextPublishPolicy = obj(
        policies.publishPolicy ?? policies.publish_policy
      );
    }

    if (policies.riskRules || policies.risk_rules) {
      nextRiskRules = obj(policies.riskRules ?? policies.risk_rules);
    }

    if (policies.escalationRules || policies.escalation_rules) {
      nextEscalationRules = obj(
        policies.escalationRules ?? policies.escalation_rules
      );
    }

    if (policies.leadScoringRules || policies.lead_scoring_rules) {
      nextLeadScoringRules = obj(
        policies.leadScoringRules ?? policies.lead_scoring_rules
      );
    }
  }

  if (provided.inboxApprovalMode) {
    nextInboxPolicy = {
      ...(nextInboxPolicy || nextInboxPolicyBase),
      approvalMode: normalized.inboxApprovalMode,
    };
  }

  if (provided.commentApprovalMode) {
    nextCommentPolicy = {
      ...(nextCommentPolicy || nextCommentPolicyBase),
      approvalMode: normalized.commentApprovalMode,
    };
  }

  const aiPoliciesPatch = {};

  if (provided.autoReplyEnabled) {
    aiPoliciesPatch.auto_reply_enabled = normalized.autoReplyEnabled;
  }

  if (provided.humanApprovalRequired) {
    aiPoliciesPatch.approval_required_content =
      normalized.humanApprovalRequired;
    aiPoliciesPatch.approval_required_publish =
      normalized.humanApprovalRequired;
  }

  if (nextInboxPolicy) {
    aiPoliciesPatch.inbox_policy = jsonb(nextInboxPolicy);
  }

  if (nextCommentPolicy) {
    aiPoliciesPatch.comment_policy = jsonb(nextCommentPolicy);
  }

  if (nextContentPolicy) {
    aiPoliciesPatch.content_policy = jsonb(nextContentPolicy);
  }

  if (nextPublishPolicy) {
    aiPoliciesPatch.publish_policy = jsonb(nextPublishPolicy);
  }

  if (nextRiskRules) {
    aiPoliciesPatch.risk_rules = jsonb(nextRiskRules);
  }

  if (nextEscalationRules) {
    aiPoliciesPatch.escalation_rules = jsonb(nextEscalationRules);
  }

  if (nextLeadScoringRules) {
    aiPoliciesPatch.lead_scoring_rules = jsonb(nextLeadScoringRules);
  }

  const aiPoliciesWrite = await upsertByTenantId({
    db,
    tableName: "tenant_ai_policies",
    tenantId: scope.id,
    insertPatch: {},
    updatePatch: aiPoliciesPatch,
  });
  if (aiPoliciesWrite) writes.push(aiPoliciesWrite);

  const canonicalProfile = await knowledge.upsertBusinessProfile(
    buildCanonicalProfileInput({
      scope,
      currentProfile,
      normalized: {
        timezone: s(currentProfile?.profile_json?.timezone || scope.timezone),
        tone: normalized.tone,
      },
      provided: {
        companyName: false,
        description: false,
        timezone: false,
        languages: provided.defaultLanguage || provided.languages,
        tone: provided.tone,
      },
      effectiveLanguages,
      effectivePrimaryLanguage,
    })
  );

  writes.push({
    table: "tenant_business_profile",
    action: currentProfile?.id ? "update" : "insert",
    changedFields: [
      ...(provided.defaultLanguage || provided.languages
        ? ["mainLanguage", "supportedLanguages"]
        : []),
      ...(provided.tone ? ["toneProfile"] : []),
    ],
    canonical: true,
    rowId: s(canonicalProfile?.id),
  });

  const canonicalCapabilities = await knowledge.upsertBusinessCapabilities(
    buildCanonicalCapabilitiesInput({
      scope,
      currentCapabilities,
      overrides: {
        primaryLanguage:
          provided.defaultLanguage || provided.languages
            ? effectivePrimaryLanguage
            : undefined,
        supportedLanguages:
          provided.languages || provided.defaultLanguage
            ? effectiveLanguages
            : undefined,
        supportsMultilanguage:
          provided.languages || provided.defaultLanguage
            ? effectiveLanguages.length > 1
            : undefined,
        replyStyle: provided.replyStyle ? normalized.replyStyle : undefined,
        replyLength: provided.replyLength ? normalized.replyLength : undefined,
        emojiLevel: provided.emojiLevel ? normalized.emojiLevel : undefined,
        ctaStyle: provided.ctaStyle ? normalized.ctaStyle : undefined,
      },
      approvedBy: "workspace_setup",
    })
  );

  writes.push({
    table: "tenant_business_capabilities",
    action: currentCapabilities?.id ? "update" : "insert",
    changedFields: [
      ...(provided.defaultLanguage || provided.languages
        ? ["primaryLanguage", "supportedLanguages"]
        : []),
      ...(provided.replyStyle ? ["replyStyle"] : []),
      ...(provided.replyLength ? ["replyLength"] : []),
      ...(provided.emojiLevel ? ["emojiLevel"] : []),
      ...(provided.ctaStyle ? ["ctaStyle"] : []),
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
    saved: buildSavedRuntimePayload(normalized, {
      defaultLanguage: effectivePrimaryLanguage,
      enabledLanguages: effectiveLanguages,
    }),
    writes,
    setup,
  };
}
