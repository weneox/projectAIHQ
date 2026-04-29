import { apiGet } from "./client.js";

export async function getLaunchPosture(options = {}) {
  return apiGet("/api/launch/posture", options);
}
