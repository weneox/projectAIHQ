import test from "node:test";
import assert from "node:assert/strict";

import { getContainerRuntimeParity } from "../../scripts/verification-status.mjs";

test("container runtime parity reports supported repo Docker assets honestly", () => {
  const parity = getContainerRuntimeParity();

  const backend = parity.find((item) => item.name === "ai-hq-backend");
  const meta = parity.find((item) => item.name === "meta-bot-backend");
  const twilio = parity.find((item) => item.name === "twilio-voice-backend");

  assert.ok(backend);
  assert.equal(backend.status, "ready");
  assert.match(
    backend.detail,
    /docker build -f ai-hq-backend\/Dockerfile \. -> docker run --rm -p 8080:8080 ai-hq-backend \(build from repo root\)/
  );

  assert.ok(meta);
  assert.equal(meta.status, "ready");
  assert.match(
    meta.detail,
    /docker build -f meta-bot-backend\/Dockerfile \. -> docker run --rm -p 8080:8080 meta-bot-backend \(build from repo root\)/
  );

  assert.ok(twilio);
  assert.equal(twilio.status, "ready");
  assert.match(
    twilio.detail,
    /docker build -f twilio-voice-backend\/Dockerfile \. -> docker run --rm -p 8080:8080 twilio-voice-backend \(build from repo root\)/
  );
});
