import { okJson } from "../../../utils/http.js";
import { buildApiHealthResponse } from "./builders.js";

export function createHealthHandlers({ db }) {
  async function getApiRoot(req, res) {
    return okJson(
      res,
      await buildApiHealthResponse({
        db,
        startupOperationalReadiness: req?.app?.locals?.operationalReadinessStartup || null,
      })
    );
  }

  return { getApiRoot };
}
