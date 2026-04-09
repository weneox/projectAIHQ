import { createSystemSignal, obj, s } from "../contracts/index.js";

function pickSetupMeta(bootstrap = {}, setup = {}) {
  const workspace = obj(bootstrap?.workspace);
  const bootstrapSetup = obj(bootstrap?.setup);
  const progress = obj(bootstrapSetup?.progress || workspace?.progress || workspace);
  const setupRoot = obj(setup?.setup || setup);
  const setupProgress = obj(
    setupRoot?.progress || setupRoot?.workspace || setupRoot
  );

  return {
    setupCompleted: !!(
      progress?.setupCompleted ??
      setupProgress?.setupCompleted ??
      workspace?.setupCompleted ??
      false
    ),
    nextStudioStage: s(
      progress?.nextStudioStage ||
        setupProgress?.nextStudioStage ||
        workspace?.nextStudioStage
    ),
    readinessLabel: s(
      progress?.readinessLabel ||
        setupProgress?.readinessLabel ||
        workspace?.readinessLabel
    ),
    primaryMissingStep: s(
      progress?.primaryMissingStep ||
        setupProgress?.primaryMissingStep ||
        workspace?.primaryMissingStep
    ),
    companyName: s(
      setupRoot?.tenantProfile?.companyName ||
        setupRoot?.businessProfile?.companyName ||
        workspace?.tenantProfile?.companyName ||
        workspace?.businessProfile?.companyName
    ),
  };
}

export function buildSetupSystemSignals({
  bootstrap = null,
  setup = null,
} = {}) {
  const meta = pickSetupMeta(bootstrap || {}, setup || {});

  if (meta.setupCompleted) {
    return [
      createSystemSignal({
        id: "setup-complete",
        kind: "outcome",
        relatedCapability: "setup_intake",
        sourceSubsystem: "setup_intake",
        statusCode: "ready",
        priority: "low",
        confidence: 0.92,
        target: {
          kind: "setup",
          allowed: true,
        },
        context: {
          title: "Setup is complete",
          subjectName: meta.companyName || "Workspace setup",
          statusLabel: "ready",
          summary: meta.companyName
            ? `${meta.companyName} already has a completed setup state.`
            : "The workspace setup flow is already complete.",
          reasonSummary:
            "Core business details and required operating information have already been captured.",
          impactSummary:
            "Workspace guidance can focus on operating changes instead of initial intake.",
        },
      }),
    ];
  }

  return [
    createSystemSignal({
      id: "setup-start",
      kind: "recommended_action",
      relatedCapability: "setup_intake",
      sourceSubsystem: "setup_intake",
      statusCode: meta.nextStudioStage || "pending",
      priority: "high",
      confidence: 0.84,
      requiresHuman: true,
      canAutoFix: false,
      target: {
        kind: "setup",
        allowed: true,
      },
      context: {
        title: "Finish setup intake",
        subjectName: meta.companyName || "Workspace setup",
        statusLabel: meta.nextStudioStage || "pending",
        summary: meta.primaryMissingStep
          ? `The workspace is still missing ${meta.primaryMissingStep.replace(/[_-]+/g, " ")}.`
          : "The workspace is not fully configured yet.",
        reasonSummary: meta.readinessLabel
          ? `Current setup posture is ${meta.readinessLabel}.`
          : "The product still needs core business input before it can operate confidently.",
        impactSummary:
          "Some responses, capabilities, or downstream automations may remain conservative until setup is complete.",
      },
    }),
  ];
}
