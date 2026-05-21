import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBrowserRealtimeSessionPlan,
  buildLiveVoiceInstructions,
} from "../src/modules/voice/engine/browserRealtimeSession.js";

test("live voice instructions include clinic receptionist playbook", () => {
  const instructions = buildLiveVoiceInstructions({
    runtimeApplied: true,
    runtimeConfig: {
      companyName: "Demo Clinic",
      businessType: "clinic",
      defaultLanguage: "az",
      voiceProfile: {
        companyName: "Demo Clinic",
        defaultLanguage: "az",
      },
      actions: {
        appointment: { mode: "request_only" },
        handoff: { mode: "request_only" },
      },
    },
  });

  assert.match(instructions, /Clinic \/ dental \/ aesthetic receptionist playbook/);
  assert.match(instructions, /Do not give medical diagnosis/);
  assert.match(instructions, /collect service, preferred date\/time, name, and phone/);
  assert.match(instructions, /Voice action policy/);
});

test("browser realtime session exposes enabled voice action tools", () => {
  const plan = buildBrowserRealtimeSessionPlan({
    runtimeApplied: true,
    runtimeConfig: {
      companyName: "Demo Clinic",
      businessType: "clinic",
      actions: {
        appointment: { mode: "request_only" },
        handoff: { mode: "request_only" },
      },
    },
  });

  const tools = plan.clientSecretRequest.session.tools || [];
  assert.equal(plan.clientSecretRequest.session.tool_choice, "auto");
  assert.equal(
    tools.some((tool) => tool.name === "create_appointment_request"),
    true
  );
  assert.equal(
    tools.some((tool) => tool.name === "create_handoff_request"),
    true
  );
  assert.equal(
    tools.some((tool) => tool.name === "end_call"),
    true
  );
});
