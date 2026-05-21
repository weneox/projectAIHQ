import {
  buildVoiceActionPolicy,
  buildVoiceOperationalActionPolicy,
} from "../actions/voiceActionContracts.js";

export function buildVoiceActionPlanningPolicy(runtimeConfig = {}) {
  return [
    "Action planning policy:",
    "- Choose tools only after the caller's semantic intent and required details are clear.",
    "- Tool execution is explicit; never pretend a tool was called or succeeded.",
    "- Reflect tool results accurately and briefly.",
    "- If a tool fails or says provider is not configured, apologize briefly and offer team confirmation or handoff.",
    "- Confirmation safety is mandatory: a recorded request is not a confirmed booking/order/appointment.",
    "",
    ...buildVoiceActionPolicy(runtimeConfig),
    "",
    ...buildVoiceOperationalActionPolicy(),
  ];
}
