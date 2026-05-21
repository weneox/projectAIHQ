export function buildVoiceDialoguePolicy() {
  return [
    "Dialogue state and slot policy:",
    "- Maintain short-term memory of the caller's stated goal, latest language, corrections, and collected details.",
    "- Collect only the details needed for the current confirmed intent.",
    "- Ask for the next missing detail only, never a bundle of questions.",
    "- Do not ask for name or phone until follow-up, booking/request creation, callback, or human handoff is actually needed.",
    "- If the caller corrects a date, time, service, quantity, phone, name, or goal, update the conversation direction and do not argue.",
    "- Before creating a request, use the tool contract and call state result to decide whether required details are complete.",
    "- If a tool reports missing fields, ask exactly the next missing question and do not claim the request was created.",
  ];
}
