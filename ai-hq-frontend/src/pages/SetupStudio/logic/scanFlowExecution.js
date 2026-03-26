import {
  analyzeSetupIntake,
  getCurrentSetupReview,
  importBundleForSetup,
  importSourceForSetup,
} from "../../../api/setup.js";

export async function executeSetupStudioScanPlan(plan) {
  let importResult = null;
  let analyzeResult = null;
  let reviewPayload = {};

  if (plan.hasImportableSource) {
    const importPayload = {
      sourceType: plan.sourceType,
      url: plan.sourceUrl,
      sourceUrl: plan.sourceUrl,
      note: plan.request.note,
      businessNote: plan.request.note,
      manualText: plan.analyzePayload.manualText,
      answers: plan.analyzePayload.answers,
      sources: plan.requestedSources,
      primarySource: plan.requestedPrimarySource,
    };

    if (plan.shouldUseBundledImport) {
      importResult = await importBundleForSetup(importPayload);
      reviewPayload = await getCurrentSetupReview({ eventLimit: 30 });
    } else {
      importResult = await importSourceForSetup(importPayload);
    }
  }

  if (!plan.shouldUseBundledImport) {
    analyzeResult = await analyzeSetupIntake(plan.analyzePayload);
    reviewPayload = analyzeResult?.review || importResult?.review || {};
  }

  return {
    importResult,
    analyzeResult,
    reviewPayload,
  };
}
