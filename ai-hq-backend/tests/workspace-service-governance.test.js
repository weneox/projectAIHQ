import test from "node:test";
import assert from "node:assert/strict";

import { approveKnowledgeCandidate } from "../src/services/workspace/candidates.js";

test("service candidate approval stages maintenance review instead of mutating live services", async () => {
  const calls = {
    updateCandidate: null,
    createApproval: null,
    stageServiceCandidate: null,
  };

  const candidate = {
    id: "candidate-1",
    tenant_id: "tenant-1",
    tenant_key: "alpha",
    category: "service",
    title: "Brand Strategy",
    value_text: "Positioning and identity design.",
    value_json: {
      pricingModel: "custom_quote",
    },
  };

  const result = await approveKnowledgeCandidate(
    {
      db: {},
      tenantId: "tenant-1",
      tenantKey: "alpha",
      role: "owner",
      tenant: null,
      candidateId: "candidate-1",
      reviewedBy: "reviewer@example.com",
    },
    {
      knowledgeHelper: {
        async resolveTenantIdentity() {
          return {
            tenant_id: "tenant-1",
            tenant_key: "alpha",
          };
        },
        async getCandidateById() {
          return candidate;
        },
        async updateCandidate(id, patch) {
          calls.updateCandidate = { id, patch };
          return {
            ...candidate,
            ...patch,
          };
        },
        async createApproval(input) {
          calls.createApproval = input;
          return {
            id: "approval-1",
            ...input,
          };
        },
      },
      async stageApprovedServiceCandidateInMaintenanceSession(input) {
        calls.stageServiceCandidate = input;
        return {
          publishStatus: "review_required",
          reviewRequired: true,
          maintenanceSession: {
            id: "session-1",
            mode: "refresh",
            status: "ready",
            currentStep: "maintenance_review",
          },
          maintenanceDraft: {
            version: 5,
            services: [{ key: "brand-strategy", title: "Brand Strategy" }],
          },
        };
      },
      async buildSetupStatus() {
        return {
          status: "review_required",
        };
      },
    }
  );

  assert.equal(calls.stageServiceCandidate?.candidate?.id, "candidate-1");
  assert.equal(calls.updateCandidate?.id, "candidate-1");
  assert.equal(calls.updateCandidate?.patch?.status, "approved");
  assert.equal(calls.createApproval?.metadataJson?.destinationTable, "tenant_setup_review_drafts");
  assert.equal(calls.createApproval?.metadataJson?.publishStatus, "review_required");
  assert.equal(result.publishStatus, "review_required");
  assert.equal(result.reviewRequired, true);
  assert.equal(result.destination?.action, "stage_service_maintenance_review");
  assert.equal(result.destination?.table, "tenant_setup_review_drafts");
  assert.equal(result.destination?.reviewSessionId, "session-1");
  assert.equal(result.destination?.draftVersion, 5);
  assert.equal(result.maintenanceSession?.id, "session-1");
  assert.equal(result.maintenanceDraft?.version, 5);
});
