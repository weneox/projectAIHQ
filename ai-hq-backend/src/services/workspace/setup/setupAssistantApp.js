import {
  buildCanonicalBusinessProfileFromSetupAssistant,
  buildCanonicalContactsFromSetupAssistant,
  buildCanonicalReviewDraftPatchFromSetupAssistant,
  buildCanonicalServicesFromSetupAssistant,
} from "./setupAssistantApp/canonical.js";
import {
  buildAssistantCompatBusinessFacts,
  buildAssistantCompatConversationStatus,
  buildAssistantCompatFollowupQueue,
  buildAssistantCompatQuestion,
} from "./setupAssistantApp/compat.js";
import {
  loadCurrentSetupAssistantSession,
  readSetupAssistantView,
  startSetupAssistantSession,
  updateSetupAssistantDraft,
} from "./setupAssistantApp/flows.js";
import {
  buildSetupAssistantPatchFromOrchestrator,
  mergeSetupAssistantDraft,
  normalizeSetupAssistantDraftPatchBody,
  parseProfileAnswer,
  patchFromAnswer,
  resolveIntentOnlyPatch,
} from "./setupAssistantApp/patching.js";
import { getNextQuestion } from "./setupAssistantApp/questions.js";
import { buildSetupAssistantSeedFromReview } from "./setupAssistantApp/seed.js";
import {
  buildSetupAssistantAuthorityState,
  buildSetupAssistantSessionPayload,
  buildStoredSetupAssistantPayload,
} from "./setupAssistantApp/sessionPayload.js";
import { buildConfirmationBlockers } from "./setupAssistantApp/summary.js";

export {
  buildSetupAssistantSessionPayload,
  loadCurrentSetupAssistantSession,
  mergeSetupAssistantDraft,
  normalizeSetupAssistantDraftPatchBody,
  readSetupAssistantView,
  startSetupAssistantSession,
  updateSetupAssistantDraft,
};

export const __test__ = {
  buildSetupAssistantAuthorityState,
  buildCanonicalBusinessProfileFromSetupAssistant,
  buildCanonicalContactsFromSetupAssistant,
  buildCanonicalReviewDraftPatchFromSetupAssistant,
  buildCanonicalServicesFromSetupAssistant,
  buildConfirmationBlockers,
  buildSetupAssistantPatchFromOrchestrator,
  buildSetupAssistantSeedFromReview,
  buildSetupAssistantSessionPayload,
  buildStoredSetupAssistantPayload,
  buildAssistantCompatQuestion,
  buildAssistantCompatFollowupQueue,
  buildAssistantCompatBusinessFacts,
  buildAssistantCompatConversationStatus,
  getNextQuestion,
  mergeSetupAssistantDraft,
  normalizeSetupAssistantDraftPatchBody,
  patchFromAnswer,
  parseProfileAnswer,
  readSetupAssistantView,
  resolveIntentOnlyPatch,
};
