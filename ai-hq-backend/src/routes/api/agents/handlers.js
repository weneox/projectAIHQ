import { okJson } from "../../../utils/http.js";
import { listAgents } from "../../../kernel/agentKernel.js";

export function getAgents(_req, res) {
  return okJson(res, {
    ok: true,
    agents: listAgents(),
  });
}