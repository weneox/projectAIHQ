import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildVoiceActionToolDefinitions,
  normalizeVoiceActionRuntime,
} from "../src/modules/voice/actions/voiceActionContracts.js";
import {
  getVoiceActionToolRequiredFields,
} from "../src/modules/voice/callState.js";
import {
  buildVoiceConfigFromProjectedRuntime,
} from "../src/modules/voice/config.js";

const contractsPath = new URL("../src/modules/voice/actions/voiceActionContracts.js", import.meta.url);
const configPath = new URL("../src/modules/voice/config.js", import.meta.url);

test("voice actions are explicit runtime config, not keyword business inference", async () => {
  const source = [
    await readFile(contractsPath, "utf8"),
    await readFile(configPath, "utf8"),
  ].join("\n");

  const forbiddenPatterns = [
    ["pizza", /(^|[^a-z0-9_])pizza([^a-z0-9_]|$)/i],
    ["burger", /(^|[^a-z0-9_])burger([^a-z0-9_]|$)/i],
    ["restoran", /(^|[^a-z0-9_])restoran([^a-z0-9_]|$)/i],
    ["otel", /(^|[^a-z0-9_])otel([^a-z0-9_]|$)/i],
    ["mehmanxana", /(^|[^a-z0-9_])mehmanxana([^a-z0-9_]|$)/i],
    ["klinika", /(^|[^a-z0-9_])klinika([^a-z0-9_]|$)/i],
    ["stomatolog", /(^|[^a-z0-9_])stomatolog([^a-z0-9_]|$)/i],
    ["bərbər", /(^|[^a-z0-9_])bərbər([^a-z0-9_]|$)/i],
    ["berber", /(^|[^a-z0-9_])berber([^a-z0-9_]|$)/i],
    ["mağaza", /(^|[^a-z0-9_])mağaza([^a-z0-9_]|$)/i],
    ["magaza", /(^|[^a-z0-9_])magaza([^a-z0-9_]|$)/i],
    ["inferBusinessFamily", /inferBusinessFamily/],
    ["intentNeedles", /intentNeedles/],
    ["includesAny", /includesAny/],
  ];

  for (const [label, pattern] of forbiddenPatterns) {
    assert.equal(
      pattern.test(source),
      false,
      `voice action config must not infer business type from keyword: ${label}`
    );
  }
});

test("voice action runtime reads only explicit action modes", () => {
  const disabled = normalizeVoiceActionRuntime({
    businessType: "restaurant",
  });

  assert.equal(disabled.businessFamily, "restaurant");
  assert.equal(disabled.orderingMode, "disabled");
  assert.equal(disabled.reservationMode, "disabled");
  assert.equal(disabled.appointmentMode, "disabled");
  assert.equal(disabled.availabilityMode, "disabled");
  assert.equal(disabled.handoffMode, "request_only");

  const enabled = normalizeVoiceActionRuntime({
    businessType: "restaurant",
    actions: {
      ordering: { mode: "request_only" },
      reservation: { mode: "live" },
      availability: { mode: "live" },
      appointment: { mode: "disabled" },
      handoff: { mode: "request_only" },
    },
  });

  assert.equal(enabled.orderingMode, "request_only");
  assert.equal(enabled.reservationMode, "live");
  assert.equal(enabled.availabilityMode, "live");
  assert.equal(enabled.appointmentMode, "disabled");

  const toolNames = buildVoiceActionToolDefinitions(enabled).map((tool) => tool.name);

  assert.deepEqual(toolNames, [
    "check_availability",
    "create_reservation_request",
    "create_order_request",
    "create_handoff_request",
    "end_call",
  ]);
});

test("voice action tool schemas read centralized required fields", () => {
  const tools = buildVoiceActionToolDefinitions({
    availabilityMode: "live",
    reservationMode: "request_only",
    orderingMode: "request_only",
    appointmentMode: "request_only",
    handoffMode: "request_only",
  });

  for (const tool of tools) {
    assert.deepEqual(
      tool.parameters.required,
      getVoiceActionToolRequiredFields(tool.name),
      `${tool.name} required fields should stay owned by call state`
    );
  }
});

test("projected voice config exposes explicit action runtime payload", () => {
  const payload = buildVoiceConfigFromProjectedRuntime(
    {
      authority: { tenantKey: "acme", tenantId: "tenant-1" },
      tenant: {
        tenantKey: "acme",
        tenantId: "tenant-1",
        companyName: "Acme",
        businessType: "restaurant",
        mainLanguage: "az",
      },
      channels: {
        voice: {
          profile: {
            businessType: "restaurant",
          },
        },
      },
      operational: {
        voice: {
          ready: true,
          actions: {
            ordering: { mode: "request_only" },
            reservation: { mode: "request_only" },
            availability: { mode: "disabled" },
            appointment: { mode: "disabled" },
            handoff: { mode: "request_only" },
          },
          realtime: {},
          channels: [
            {
              id: "browser_lab",
              provider: "browser_lab",
              ready: true,
              externalNumber: "browser_lab",
            },
          ],
        },
      },
      behavior: {},
    },
    {
      tenantKey: "acme",
      toNumber: "browser_lab",
      provider: "browser_lab",
    }
  );

  assert.equal(payload.businessType, "restaurant");
  assert.equal(payload.actions.businessType, "restaurant");
  assert.equal(payload.actions.orderingMode, "request_only");
  assert.equal(payload.actions.reservationMode, "request_only");
  assert.equal(payload.actions.availabilityMode, "disabled");
});
