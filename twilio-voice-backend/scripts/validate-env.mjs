import "dotenv/config";

import { assertConfigValid } from "../src/config/validate.js";

try {
  assertConfigValid(console);
} catch (error) {
  console.error("[validate:env] twilio-voice-backend failed");
  console.error(String(error?.message || error));
  process.exit(1);
}
