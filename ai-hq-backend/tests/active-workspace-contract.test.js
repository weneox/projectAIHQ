import test from "node:test";
import assert from "node:assert/strict";

import {
  buildActiveWorkspaceContract,
  buildWorkspaceAccessSummary,
} from "../src/services/workspace/activeWorkspace.js";
import { buildAppBootstrap } from "../src/services/workspace/bootstrap.js";

test("canonical active workspace contract is stable for ready workspaces", () => {
  const workspace = buildActiveWorkspaceContract({
    readiness: {
      setupCompleted: true,
      readinessScore: 100,
      readinessLabel: "ready",
      missingSteps: [],
      primaryMissingStep: "",
      nextSetupRoute: "",
      nextStudioStage: "",
      tenantProfile: {
        companyName: "Acme HQ",
      },
      checks: {
        businessProfile: true,
      },
    },
    tenant: {
      id: "tenant-1",
      tenant_key: "acme",
    },
    membershipId: "membership-1",
    role: "owner",
  });

  assert.deepEqual(workspace, {
    tenantId: "tenant-1",
    tenantKey: "acme",
    companyName: "Acme HQ",
    membershipId: "membership-1",
    role: "owner",
    setupCompleted: true,
    setupRequired: false,
    workspaceReady: true,
    routeHint: "/workspace",
    destination: {
      kind: "workspace",
      path: "/workspace",
    },
    activeSetupSessionId: "",
    readinessScore: 100,
    readinessLabel: "ready",
    missingSteps: [],
    primaryMissingStep: "",
    nextRoute: "/workspace",
    nextSetupRoute: "",
    nextStudioStage: "",
    checks: {
      businessProfile: true,
    },
  });
});

test("canonical active workspace contract is stable for incomplete workspaces", () => {
  const workspace = buildActiveWorkspaceContract({
    readiness: {
      setupCompleted: false,
      readinessScore: 46,
      readinessLabel: "in_progress",
      missingSteps: ["knowledge", "services"],
      primaryMissingStep: "knowledge",
      nextSetupRoute: "/home?assistant=setup",
      nextStudioStage: "knowledge",
      tenantProfile: {
        companyName: "Globex",
      },
      checks: {
        businessProfile: true,
        knowledge: false,
      },
    },
    tenant: {
      id: "tenant-2",
      tenant_key: "globex",
    },
    membershipId: "membership-2",
    role: "member",
    activeSetupSessionId: "setup-session-2",
  });

  assert.equal(workspace.setupCompleted, false);
  assert.equal(workspace.setupRequired, true);
  assert.equal(workspace.workspaceReady, false);
  assert.equal(workspace.routeHint, "/home?assistant=setup");
  assert.deepEqual(workspace.destination, {
    kind: "setup",
    path: "/home?assistant=setup",
  });
  assert.equal(workspace.activeSetupSessionId, "setup-session-2");
  assert.deepEqual(workspace.missingSteps, ["knowledge", "services"]);
  assert.equal(workspace.primaryMissingStep, "knowledge");
});

test("workspace access summaries preserve canonical contract semantics", () => {
  const summary = buildWorkspaceAccessSummary({
    workspace: {
      tenantId: "tenant-1",
      tenantKey: "acme",
      companyName: "Acme HQ",
      membershipId: "membership-1",
      role: "owner",
      setupCompleted: false,
      setupRequired: true,
      workspaceReady: false,
      routeHint: "/home?assistant=setup",
      destination: {
        kind: "setup",
        path: "/home?assistant=setup",
      },
      readinessScore: 62,
      readinessLabel: "almost_ready",
      activeSetupSessionId: "setup-session-1",
    },
    active: true,
    switchToken: "switch-token-1",
  });

  assert.equal(summary.switchToken, "switch-token-1");
  assert.equal(summary.setupCompleted, false);
  assert.equal(summary.setupRequired, true);
  assert.equal(summary.workspaceReady, false);
  assert.equal(summary.routeHint, "/home?assistant=setup");
  assert.equal(summary.activeSetupSessionId, "setup-session-1");
  assert.equal(summary.active, true);
});

test("bootstrap reuses the canonical active workspace contract", async () => {
  const workspace = {
    tenantId: "tenant-1",
    tenantKey: "acme",
    companyName: "Acme HQ",
    membershipId: "membership-1",
    role: "owner",
    setupCompleted: false,
    setupRequired: true,
    workspaceReady: false,
    routeHint: "/home?assistant=setup",
    destination: {
      kind: "setup",
      path: "/home?assistant=setup",
    },
    activeSetupSessionId: "setup-session-1",
    readinessScore: 52,
    readinessLabel: "in_progress",
    missingSteps: ["knowledge"],
    primaryMissingStep: "knowledge",
    nextRoute: "/home?assistant=setup",
    nextSetupRoute: "/home?assistant=setup",
    nextStudioStage: "knowledge",
    checks: {
      knowledge: false,
    },
  };

  const readiness = {
    checks: workspace.checks,
    runtime: {
      ready: false,
    },
    tenantProfile: {
      companyName: "Acme HQ",
    },
    sources: {},
    knowledge: {},
    catalog: {},
  };

  const bootstrap = await buildAppBootstrap({
    db: null,
    user: {
      id: "user-1",
      email: "owner@acme.test",
      full_name: "Owner",
      role: "owner",
    },
    tenant: {
      id: "tenant-1",
      tenant_key: "acme",
      company_name: "Acme HQ",
    },
    resolveWorkspaceState: async () => ({ workspace, readiness }),
    loadOperationalCounts: async () => ({
      pendingInbox: 0,
      pendingComments: 0,
      newLeads: 0,
      knowledgeCandidates: 0,
    }),
  });

  assert.equal(bootstrap.workspace.setupRequired, true);
  assert.equal(bootstrap.workspace.workspaceReady, false);
  assert.equal(bootstrap.workspace.routeHint, "/home?assistant=setup");
  assert.equal(bootstrap.workspace.destination.path, "/home?assistant=setup");
  assert.equal(bootstrap.navigation.initialRoute, "/home?assistant=setup");
  assert.equal(bootstrap.navigation.setupRoute, "/home?assistant=setup");
});
