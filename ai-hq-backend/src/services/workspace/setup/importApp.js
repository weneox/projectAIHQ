import {
  buildImportArgs,
  buildImportResponse,
  enrichImportDataWithReview,
} from "./importFlow.js";

export async function executeSetupImport(
  {
    db,
    actor,
    body = {},
    requestId = "",
    log = null,
    logLabel = "",
    logContext = {},
    executeImport,
    executeArgs = {},
    response = {},
    responseBody = null,
  },
  deps = {}
) {
  const makeImportArgs = deps.buildImportArgs || buildImportArgs;
  const enrichWithReview =
    deps.enrichImportDataWithReview || enrichImportDataWithReview;
  const makeImportResponse = deps.buildImportResponse || buildImportResponse;

  log?.info?.(logLabel, logContext);

  const data = await executeImport({
    db,
    ...executeArgs,
    ...makeImportArgs({ actor, body, requestId }),
  });

  const enriched = await enrichWithReview({
    actor,
    data,
  });

  const result = makeImportResponse({
    data: enriched,
    successMessage: response.successMessage,
    acceptedMessage: response.acceptedMessage,
    partialMessage: response.partialMessage,
    errorCode: response.errorCode,
    errorMessage: response.errorMessage,
  });

  return {
    status: result.status,
    body:
      typeof responseBody === "function"
        ? responseBody(result.body)
        : result.body,
  };
}