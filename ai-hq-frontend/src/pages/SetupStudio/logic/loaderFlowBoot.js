import {
  arr,
  extractItems,
  isPendingKnowledge,
  obj,
} from "../lib/setupStudioHelpers.js";
import { normalizeBootMeta, pickSetupProfile } from "../state/shared.js";

export function buildSetupStudioBootSnapshot({
  boot = {},
  knowledgePayload = {},
  servicesPayload = {},
}) {
  const workspace = obj(boot?.workspace);
  const setup = obj(boot?.setup);
  const profile = pickSetupProfile(setup, workspace);

  const rawKnowledge = extractItems(knowledgePayload);
  const pendingKnowledge = rawKnowledge.filter(isPendingKnowledge);
  const serviceItems = extractItems(servicesPayload);
  const meta = normalizeBootMeta(boot, pendingKnowledge, serviceItems);

  return {
    boot,
    workspace,
    setup,
    profile,
    pendingKnowledge,
    serviceItems,
    meta,
    rawKnowledge: arr(rawKnowledge),
  };
}

export function buildSetupStudioLoaderErrorResult(message = "") {
  return {
    boot: {},
    workspace: {},
    setup: {},
    profile: {},
    pendingKnowledge: [],
    serviceItems: [],
    meta: {},
    currentReview: {},
    error: message,
  };
}
