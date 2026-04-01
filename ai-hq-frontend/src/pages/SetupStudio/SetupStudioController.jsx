import { useNavigate } from "react-router-dom";

import SetupStudioScene from "./SetupStudioScene.jsx";
import { discoveryModeLabel } from "./SetupStudioDerivedState.js";
import { useSetupStudioControllerEffects } from "./hooks/useSetupStudioControllerEffects.js";
import { useSetupStudioControllerState } from "./hooks/useSetupStudioControllerState.js";
import { useSetupStudioViewModel } from "./hooks/useSetupStudioViewModel.js";
import { pickKnowledgeCandidateId } from "./logic/helpers.js";
import { createSetupStudioActionAdapters } from "./logic/actionAdapters.js";
import { createSetupStudioActions } from "./logic/actions.js";
import { buildSetupStudioSceneContract } from "./logic/sceneContract.js";

export default function SetupStudioController() {
  const navigate = useNavigate();

  const state = useSetupStudioControllerState();
  const viewModel = useSetupStudioViewModel(state);

  const actions = createSetupStudioActions({
    navigate,
    ...state,
    ...viewModel,
    pickKnowledgeCandidateId,
  });

  const adapters = createSetupStudioActionAdapters(
    {
      navigate,
      discoveryForm: state.discoveryForm,
      freshEntryMode: state.freshEntryMode,
      activeSourceScope: state.activeSourceScope,
      setShowRefine: state.setShowRefine,
      setShowKnowledge: state.setShowKnowledge,
    },
    actions
  );

  const scene = buildSetupStudioSceneContract({
    state,
    viewModel,
    actions,
    adapters,
  });

  useSetupStudioControllerEffects({
    actions,
    autoRevealRef: state.autoRevealRef,
    freshEntryMode: state.freshEntryMode,
    meta: state.meta,
    knowledgeCandidates: state.knowledgeCandidates,
    discoveryState: state.discoveryState,
    hasVisibleResults: viewModel.hasVisibleResults,
    autoRevealKey: viewModel.autoRevealKey,
    activeReviewAligned: viewModel.activeReviewAligned,
    visibleKnowledgeItems: viewModel.visibleKnowledgeItems,
    visibleServiceItems: viewModel.visibleServiceItems,
    discoveryProfileRows: viewModel.discoveryProfileRows,
    setShowKnowledge: state.setShowKnowledge,
    setShowRefine: state.setShowRefine,
    barrierOnlyAutoReveal: viewModel.barrierOnlyAutoReveal,
  });

  return (
    <SetupStudioScene
      {...scene}
      discoveryModeLabel={discoveryModeLabel}
    />
  );
}