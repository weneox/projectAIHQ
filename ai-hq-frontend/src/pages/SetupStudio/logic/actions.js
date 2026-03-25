import { createSetupStudioActionState } from "../hooks/setupStudioActionShared.js";
import { createSetupStudioLoaders } from "../hooks/useSetupStudioLoaders.js";
import { createSetupStudioScan } from "../hooks/useSetupStudioScan.js";
import { createSetupStudioFinalize } from "../hooks/useSetupStudioFinalize.js";
import { createSetupStudioKnowledgeActions } from "../hooks/useSetupStudioKnowledgeActions.js";
import { createSetupStudioFlow } from "../hooks/useSetupStudioFlow.js";

export function createSetupStudioActions(ctx) {
  const shared = createSetupStudioActionState(ctx);
  const loaders = createSetupStudioLoaders(ctx, shared);
  const scan = createSetupStudioScan(ctx, {
    ...shared,
    ...loaders,
  });
  const finalize = createSetupStudioFinalize(ctx, {
    ...shared,
    ...loaders,
  });
  const knowledge = createSetupStudioKnowledgeActions(ctx, {
    ...shared,
    ...loaders,
  });
  const flow = createSetupStudioFlow(ctx, {
    ...shared,
    ...loaders,
  });

  return {
    ...loaders,
    ...scan,
    ...finalize,
    ...knowledge,
    ...flow,
  };
}
