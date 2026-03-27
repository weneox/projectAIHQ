import {
  createSourceSyncOrchestratorContext,
  createSourceSyncStageState,
} from "./context.js";
import { runExtractionStage } from "./extractStage.js";
import { runProcessingStage } from "./processingStage.js";
import {
  runFinalizeSourceSyncStage,
  runUnsupportedSourceSyncStage,
} from "./finalizeStage.js";
import { runFailureSourceSyncStage } from "./failureStage.js";

async function runSourceSync(input) {
  const context = createSourceSyncOrchestratorContext(input);
  const state = createSourceSyncStageState(context.sourceType);

  context.logger.info("source_sync.orchestrator.started", {
    sourceUrl: context.sourceUrl,
    requestedBy: context.deps.s(context.requestedBy),
  });

  if (!["website", "google_maps", "instagram"].includes(context.sourceType)) {
    return runUnsupportedSourceSyncStage(context, state);
  }

  try {
    await runExtractionStage(context, state);
    const processingMetrics = await runProcessingStage(context, state);
    return await runFinalizeSourceSyncStage(context, state, processingMetrics);
  } catch (err) {
    return runFailureSourceSyncStage(context, state, err);
  }
}

export { runSourceSync };
export const __test__ = {
  createSourceSyncOrchestratorContext,
  createSourceSyncStageState,
  runExtractionStage,
  runProcessingStage,
  runFinalizeSourceSyncStage,
  runUnsupportedSourceSyncStage,
  runFailureSourceSyncStage,
};
