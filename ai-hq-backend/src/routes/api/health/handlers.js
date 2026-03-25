import { okJson } from "../../../utils/http.js";
import { buildHealthResponse } from "./builders.js";

export function createHealthHandlers({ db }) {
  async function getApiRoot(_req, res) {
    return okJson(res, buildHealthResponse({ db }));
  }

  return { getApiRoot };
}