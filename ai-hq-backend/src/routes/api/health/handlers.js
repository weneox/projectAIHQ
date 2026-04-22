import { okJson } from "../../../utils/http.js";
import { buildApiHealthResponse } from "./builders.js";
import { getWebsiteLaneHealthStatus } from "../channelConnect/website.js";

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

  async function getWebsiteLane(req, res) {
    return okJson(
      res,
      await getWebsiteLaneHealthStatus({
        db,
        req,
      })
    );
  }

  return { getApiRoot, getWebsiteLane };
}
