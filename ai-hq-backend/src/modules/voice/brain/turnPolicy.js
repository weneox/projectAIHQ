export function buildVoiceTurnPolicy() {
  return [
    "Turn and noise policy:",
    "- Treat this as a live phone conversation with interruptions, corrections, silence, and noisy audio.",
    "- If speech is unclear, partial, or likely background noise, ask one short repeat or clarification question.",
    "- Do not start a booking, order, appointment, handoff, or end-call flow from uncertain fragments.",
    "- If the caller interrupts or corrects you, acknowledge briefly and follow the caller's corrected direction.",
    "- Do not talk over the caller. If interrupted, stop the current path and listen.",
    "- Ask one question at a time and wait for the caller's answer.",
  ];
}
