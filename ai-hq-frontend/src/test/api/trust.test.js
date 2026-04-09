import { describe, expect, it } from "vitest";

import { __test__ } from "../../api/trust.js";

describe("trust api normalization", () => {
it("normalizeTrustViewResponse produces a stable trust view-model", () => {
  const normalized = __test__.normalizeTrustViewResponse({
    tenantId: "tenant-1",
    tenantKey: "acme",
    viewerRole: "admin",
    permissions: {
      auditHistoryRead: {
        allowed: true,
      },
    },
    summary: {
      readiness: {
        status: "blocked",
        blockers: [
          {
            blocked: true,
            category: "runtime",
            dependencyType: "runtime_projection",
            reasonCode: "projection_missing",
            title: "Runtime projection blocker",
            nextAction: {
              id: "open_setup_route",
              kind: "route",
              label: "Open runtime setup",
              requiredRole: "operator",
              allowed: true,
              target: {
                path: "/truth",
              },
            },
          },
        ],
      },
      sources: {
        total: 2,
        connected: 1,
        enabled: 2,
      },
      runtimeProjection: {
        id: "projection-1",
        status: "ready",
        stale: false,
        health: {
          status: "healthy",
          primaryReasonCode: "",
          autonomousAllowed: true,
          autonomousOperation: "continue",
          affectedSurfaces: ["inbox", "voice"],
          lastKnownGood: {
            runtimeProjectionId: "projection-1",
            diagnosticOnly: true,
            usableAsAuthority: false,
          },
          repairActions: [{ id: "refresh_projection", action: "refresh_projection" }],
        },
        repair: {
          canRepair: true,
          action: {
            id: "rebuild_runtime_projection",
            kind: "api",
            label: "Rebuild runtime projection",
            target: {
              path: "/api/settings/trust/runtime-projection/repair",
              method: "POST",
            },
          },
          latestRun: {
            id: "repair-1",
            status: "success",
          },
        },
        readiness: {
          status: "ready",
          blockers: [],
        },
      },
      truth: {
        latestVersionId: "truth-v1",
        approvedAt: "2026-03-25T10:00:00.000Z",
        approvalPolicy: {
          strictestOutcome: "review_required",
          requiredRole: "operator",
          reasonCodes: ["review_required"],
          affectedSurfaces: ["inbox", "voice"],
          risk: {
            level: "medium",
            operational: true,
          },
        },
        sourceSummary: {
          governance: {
            disposition: "quarantined",
            quarantine: true,
            quarantinedClaimCount: 2,
          },
          finalizeImpact: {
            canonicalAreas: ["profile"],
            runtimeAreas: ["voice"],
            affectedSurfaces: ["voice", "inbox"],
          },
        },
        readiness: {
          status: "ready",
          blockers: [],
        },
      },
      setupReview: {
        active: false,
        readiness: {
          status: "ready",
          blockers: [],
        },
      },
      reviewQueue: {
        pending: 1,
        conflicts: 0,
      },
      policyPosture: {
        truthPublicationPosture: "review_required",
        executionPosture: "handoff_required",
        reviewRequired: true,
        handoffRequired: true,
        requiredRole: "operator",
        requiredAction: "Complete protected review",
        reasons: ["truth:review_required", "runtime:healthy"],
        affectedSurfaces: ["inbox", "comments", "voice"],
        explanation: "Sensitive execution paths require human handoff before the channel can continue autonomously.",
      },
      channelAutonomy: {
        items: [
          {
            surface: "inbox",
            channelType: "inbox",
            autonomyStatus: "handoff_required",
            policyOutcome: "handoff_required",
            explanation: "Inbox autonomy requires a human handoff before sensitive actions can continue.",
            why: ["truth:review_required", "runtime:healthy"],
            reviewRequired: true,
            handoffRequired: true,
            reasonCodes: ["review_required"],
            requiredRole: "operator",
            requiredAction: "Complete protected review",
          },
          {
            surface: "meta",
            channelType: "meta",
            autonomyStatus: "unknown",
            policyOutcome: "unknown",
            explanation: "Telemetry unavailable.",
          },
        ],
      },
      policyControls: {
        viewerRole: "admin",
        cannotLoosenAutonomy: true,
        tenantDefault: {
          scopeType: "tenant_default",
          surface: "tenant",
          controlMode: "human_review_required",
          policyReason: "manual review",
          changedBy: "admin@aihq.test",
          availableModes: [
            {
              mode: "autonomy_enabled",
              label: "Autonomy Enabled",
              requiredRole: "admin",
              allowed: false,
              unavailableReason: "Truth or runtime safety posture currently forbids loosening autonomy.",
            },
          ],
        },
        items: [
          {
            scopeType: "channel",
            surface: "voice",
            controlMode: "operator_only_mode",
            changedBy: "admin@aihq.test",
            isOverride: true,
            availableModes: [],
          },
        ],
      },
      decisionAudit: {
        availableFilters: [
          { key: "all", label: "All events", count: 2 },
          { key: "restricted", label: "Restricted outcomes", count: 1 },
        ],
        items: [
          {
            id: "decision-1",
            eventType: "blocked_action_outcome",
            eventLabel: "Blocked Action Outcome",
            group: "restricted",
            groupLabel: "Restricted outcomes",
            timestamp: "2026-03-26T10:00:00.000Z",
            source: "inbox.ingest",
            actor: "system",
            surface: "inbox",
            channelType: "instagram",
            policyOutcome: "blocked_until_repair",
            policyOutcomeLabel: "Blocked Until Repair",
            reasonCodes: ["projection_stale"],
            truthVersionId: "truth-v1",
            runtimeProjectionId: "projection-1",
            affectedSurfaces: ["inbox"],
            healthState: {
              status: "stale",
            },
            runtimeHealthPosture: {
              label: "runtime health",
              primary: "stale",
              primaryLabel: "Stale",
              detail: "Projection Stale",
            },
            executionPosture: {
              outcome: "blocked_until_repair",
            },
            executionPostureSummary: {
              label: "execution",
              primary: "blocked_until_repair",
              primaryLabel: "Blocked Until Repair",
            },
            decisionContextSnapshot: {
              actor: "system",
              objectVersion: "truth-v1",
              projectionStatus: "stale",
              controlScope: "channel",
              eventCategory: "restricted",
              channelSurface: "inbox",
              channelType: "instagram",
              summary: "Truth truth-v1 · Projection projection-1 · Runtime Stale",
            },
            remediation: {
              blocked: true,
              repairRequired: true,
              headline:
                "Repair strict runtime authority before autonomous execution can resume.",
              repair:
                "Check projection health, repair status, and rebuild runtime authority from approved truth.",
              nextActionLabel: "Repair runtime",
              requiredRole: "operator",
              actions: [
                {
                  id: "open_truth_version",
                  actionType: "open_truth_version",
                  kind: "route",
                  label: "Open truth version",
                  allowed: true,
                  target: {
                    path: "/truth?versionId=truth-v1&focus=history&eventId=decision-1",
                  },
                },
                {
                  id: "open_repair_flow",
                  actionType: "open_repair_flow",
                  kind: "route",
                  label: "Open repair controls",
                  allowed: true,
                  target: {
                    path: "/truth?trustFocus=repair_hub&historyFilter=runtime&runtimeProjectionId=projection-1&eventId=decision-1",
                  },
                },
              ],
            },
            links: {
              truthVersionId: "truth-v1",
              runtimeProjectionId: "projection-1",
              surface: "inbox",
              channelType: "instagram",
              controlScope: "channel",
              eventCategory: "restricted",
            },
            recommendedNextAction: {
              label: "Repair runtime",
            },
          },
        ],
      },
    },
    recentRuns: [
      {
        id: "run-1",
        sourceDisplayName: "Main Website",
        status: "completed",
      },
    ],
    audit: [
      {
        id: "audit-1",
        action: "settings.source.sync.requested",
        actor: "owner@example.com",
      },
    ],
  });

  expect(normalized.tenantKey).toBe("acme");
  expect(normalized.viewerRole).toBe("admin");
  expect(normalized.permissions.auditHistoryRead.allowed).toBe(true);
  expect(normalized.summary.readiness.blocked).toBe(true);
  expect(normalized.summary.readiness.blockedItems[0].reasonCode).toBe("projection_missing");
  expect(normalized.summary.sources.total).toBe(2);
  expect(normalized.summary.runtimeProjection.authority?.source).toBe(
    "approved_runtime_projection"
  );
  expect(normalized.summary.runtimeProjection.authority?.availableForApprovedRuntime).toBe(true);
  expect(normalized.summary.runtimeProjection.health.autonomousAllowed).toBe(true);
  expect(normalized.summary.runtimeProjection.health.affectedSurfaces).toEqual(["inbox", "voice"]);
  expect(normalized.summary.truth.approvalPolicy.strictestOutcome).toBe("review_required");
  expect(normalized.summary.truth.governance.quarantinedClaimCount).toBe(2);
  expect(normalized.summary.truth.finalizeImpact.runtimeAreas).toEqual(["voice"]);
  expect(normalized.summary.policyPosture.executionPosture).toBe("handoff_required");
  expect(normalized.summary.channelAutonomy.items[0].surface).toBe("inbox");
  expect(normalized.summary.channelAutonomy.items[1].policyOutcome).toBe("unknown");
  expect(normalized.summary.policyControls.viewerRole).toBe("admin");
  expect(normalized.summary.policyControls.tenantDefault.controlMode).toBe("human_review_required");
  expect(normalized.summary.policyControls.items[0].surface).toBe("voice");
  expect(normalized.summary.decisionAudit.availableFilters[0].key).toBe("all");
  expect(normalized.summary.decisionAudit.items[0].group).toBe("restricted");
  expect(normalized.summary.decisionAudit.items[0].eventLabel).toBe("Blocked Action Outcome");
  expect(normalized.summary.decisionAudit.items[0].policyOutcomeLabel).toBe("Blocked Until Repair");
  expect(normalized.summary.decisionAudit.items[0].runtimeHealthPosture.primary).toBe("stale");
  expect(normalized.summary.decisionAudit.items[0].decisionContextSnapshot.controlScope).toBe("channel");
  expect(normalized.summary.decisionAudit.items[0].remediation.repairRequired).toBe(true);
  expect(normalized.summary.decisionAudit.items[0].remediation.actions[0].actionType).toBe(
    "open_truth_version"
  );
  expect(normalized.summary.decisionAudit.items[0].remediation.actions[1].target.path).toMatch(
    /trustFocus=repair_hub/i
  );
  expect(normalized.summary.decisionAudit.items[0].remediationActions[0].actionType).toBe(
    "open_truth_version"
  );
  expect(normalized.summary.decisionAudit.items[0].links.runtimeProjectionId).toBe("projection-1");
  expect(normalized.summary.decisionAudit.items[0].recommendedNextAction.label).toBe(
    "Repair runtime"
  );
  expect(normalized.summary.runtimeProjection.repair.action?.id).toBe(
    "rebuild_runtime_projection"
  );
  expect(normalized.recentRuns[0].sourceDisplayName).toBe("Main Website");
  expect(normalized.audit[0].action).toBe("settings.source.sync.requested");
});

it("normalizeTrustViewResponse keeps unknown policy posture stable when payloads are sparse", () => {
  const normalized = __test__.normalizeTrustViewResponse({
    summary: {
      truth: {},
      runtimeProjection: {},
      reviewQueue: {},
      readiness: {
        status: "ready",
        blockers: [],
      },
    },
  });

  expect(normalized.summary.truth.approvalPolicy.strictestOutcome).toBe("unknown");
  expect(normalized.summary.policyPosture.executionPosture).toBe("unknown");
  expect(normalized.summary.channelAutonomy.items).toEqual([]);
  expect(normalized.summary.policyControls.items).toEqual([]);
  expect(normalized.summary.decisionAudit.items).toEqual([]);
  expect(normalized.summary.runtimeProjection.authority).toBeNull();
});

it("normalizeTrustViewResponse keeps sparse event drilldown payloads safe", () => {
  const normalized = __test__.normalizeTrustViewResponse({
    summary: {
      decisionAudit: {
        items: [
          {
            id: "decision-sparse",
            eventType: "runtime_health_transition",
            surface: "tenant",
          },
        ],
      },
    },
  });

  expect(normalized.summary.decisionAudit.items[0].eventLabel).toBe("Unknown event");
  expect(normalized.summary.decisionAudit.items[0].runtimeHealthPosture.primaryLabel).toBe(
    "Unknown runtime health"
  );
  expect(normalized.summary.decisionAudit.items[0].remediation.headline).toMatch(
    /no operator action/i
  );
  expect(normalized.summary.decisionAudit.items[0].links.surface).toBe("tenant");
  expect(normalized.summary.decisionAudit.items[0].remediation.actions).toEqual([]);
});
});
