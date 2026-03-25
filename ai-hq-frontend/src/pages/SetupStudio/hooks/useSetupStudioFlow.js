import { arr, obj, s } from "../lib/setupStudioHelpers.js";
import { applyUiHintsFromMeta } from "../state/shared.js";

export function createSetupStudioFlow(ctx, helpers) {
  const {
    navigate,
    freshEntryMode,
    activeSourceScope,
    setError,
    setShowKnowledge,
    setShowRefine,
  } = ctx;

  const { loadData } = helpers;

  async function onOpenWorkspace() {
    try {
      setError("");

      const snapshot = await loadData({
        silent: true,
        preserveBusinessForm: true,
        hydrateReview: !freshEntryMode,
        activeSourceType: activeSourceScope.sourceType,
        activeSourceUrl: activeSourceScope.sourceUrl,
      });

      const nextMeta = obj(snapshot?.meta);

      if (nextMeta.setupCompleted) {
        navigate(s(nextMeta.nextRoute || "/"), { replace: true });
        return;
      }

      if (!freshEntryMode) {
        applyUiHintsFromMeta({
          nextMeta,
          pendingKnowledge: arr(snapshot?.pendingKnowledge),
          setShowKnowledge,
          setShowRefine,
        });
      }

      navigate("/setup/studio", { replace: true });
    } catch (e) {
      setError(
        String(e?.message || e || "Workspace status could not be checked.")
      );
    }
  }

  return { onOpenWorkspace };
}
