async function loadTwilioModule() {
  try {
    return await import("twilio");
  } catch {
    return await import("../../../node_modules/twilio/index.js");
  }
}

const twilioModule = await loadTwilioModule();

export const twilio =
  twilioModule?.default ||
  twilioModule?.Twilio ||
  twilioModule;

export default twilio;
