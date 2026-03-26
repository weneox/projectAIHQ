function buildSharedReadiness(bootReadiness = {}) {
  return {
    status: String(bootReadiness.status || "").trim().toLowerCase(),
    reasonCode: String(bootReadiness.reasonCode || "").trim(),
    blockerReasonCodes: Array.isArray(bootReadiness.blockerReasonCodes)
      ? bootReadiness.blockerReasonCodes
      : [],
    intentionallyUnavailable: bootReadiness.intentionallyUnavailable === true,
    dependency: bootReadiness.dependency || {},
    aihq: bootReadiness.aihq || {},
    localDecision: bootReadiness.localDecision || {},
  };
}

export function buildHealthResponse({
  service = "meta-bot-backend",
  bootReadiness = {},
} = {}) {
  const readiness = buildSharedReadiness(bootReadiness);
  const unavailable = readiness.intentionallyUnavailable;

  return {
    statusCode: unavailable ? 503 : 200,
    body: {
      ok: !unavailable,
      service,
      readiness,
      bootReadiness,
    },
  };
}

export function createHealthHandler(options = {}) {
  return (_req, res) => {
    const response = buildHealthResponse(options);
    return res.status(response.statusCode).json(response.body);
  };
}
