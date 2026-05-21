import {
  buildVoiceBusinessPlaybook,
  buildVoiceBusinessScopeGuard,
} from "../businessPlaybooks.js";

export function buildVoiceGroundingPolicy(context = {}, { runtimeApplied = false } = {}) {
  return [
    "Grounding policy:",
    runtimeApplied
      ? "- Approved tenant voice runtime is active and is the source of truth."
      : "- Fallback runtime is active. Be extra careful and do not invent business facts.",
    "- Use approved tenant runtime, approved business context, and approved tool results as truth.",
    "- Do not invent prices, menus, rooms, availability, doctors, staff, delivery time, order status, address, schedule, policies, or confirmations.",
    "- If an approved fact is missing, say naturally that the team must confirm it.",
    "- Never claim a booking, order, appointment, reservation, callback, or handoff is completed unless a tool/system result confirms that exact outcome.",
    "",
    ...buildVoiceBusinessPlaybook(context),
    "",
    ...buildVoiceBusinessScopeGuard(),
  ];
}
