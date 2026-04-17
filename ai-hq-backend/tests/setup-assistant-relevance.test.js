import test from "node:test";
import assert from "node:assert/strict";

import {
  validateStepAnswer,
  buildApprovalBlockers,
  isDraftReadyForApproval,
  __test__ as relevanceTest,
} from "../src/services/workspace/setup/setupAssistantApp/relevance.js";

function createValidDraft() {
  return {
    businessProfile: {
      companyName: "Mand",
      description: "Xanım saç kəsimi, baxımı və gözəllik salonu işləri",
      websiteUrl: "https://mand.az",
    },
    services: [
      { title: "Saç kəsimi" },
      { title: "Saç boyama" },
      { title: "Baxım" },
    ],
    contacts: [
      {
        type: "phone",
        value: "+994 50 555 55 55",
        preferred: true,
      },
    ],
    hours: [
      {
        day: "monday",
        enabled: true,
        closed: false,
        openTime: "09:00",
        closeTime: "18:00",
      },
      {
        day: "tuesday",
        enabled: true,
        closed: false,
        openTime: "09:00",
        closeTime: "18:00",
      },
    ],
    pricingPosture: {
      pricingMode: "starting_from",
      publicSummary: "Qiymətlər 20 AZN-dən başlayır.",
      startingAt: 20,
      minPrice: 20,
      currency: "AZN",
    },
    handoffRules: {
      enabled: true,
      summary: "Müştəri operator istəyəndə və ya şikayət olduqda insana yönləndir.",
      triggers: ["operator request", "complaint"],
    },
  };
}

test("services validation rejects greeting-only answer", () => {
  const result = validateStepAnswer("services", "Salam", {});

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "rejected_services");
  assert.match(result.reason, /service/i);
});

test("services validation accepts meaningful Azerbaijani service list", () => {
  const result = validateStepAnswer(
    "services",
    "saç kəsimi, saç boyama, baxım",
    {}
  );

  assert.equal(result.accepted, true);
  assert.equal(result.reasonCode, "accepted_services");
  assert.deepEqual(result.extractedValues, [
    "saç kəsimi",
    "saç boyama",
    "baxım",
  ]);
});

test("contacts validation rejects meta chat text", () => {
  const result = validateStepAnswer("contacts", "Necəsən", {});

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "rejected_contacts");
});

test("contacts validation accepts phone and WhatsApp answer", () => {
  const result = validateStepAnswer(
    "contacts",
    "+994 50 555 55 55 WhatsApp",
    {}
  );

  assert.equal(result.accepted, true);
  assert.equal(result.reasonCode, "accepted_contacts");
  assert.ok(result.extractedValues.some((item) => /\+994|555/i.test(item)));
});

test("pricing validation rejects unrelated English small talk", () => {
  const result = validateStepAnswer("pricing", "How are you?", {});

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "rejected_pricing");
});

test("pricing validation accepts concrete pricing guidance", () => {
  const result = validateStepAnswer(
    "pricing",
    "Qiymətlər 20 AZN-dən başlayır, dəqiq qiymət xidmətə görə dəyişir.",
    {}
  );

  assert.equal(result.accepted, true);
  assert.equal(result.reasonCode, "accepted_pricing");
});

test("handoff validation rejects confusion phrase as a policy", () => {
  const result = validateStepAnswer("handoff", "Hey? I dont understand", {});

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "rejected_handoff");
});

test("handoff validation accepts real escalation rule", () => {
  const result = validateStepAnswer(
    "handoff",
    "Müştəri operator istəyəndə, şikayət olduqda və ya təcili hal varsa insana yönləndir.",
    {}
  );

  assert.equal(result.accepted, true);
  assert.equal(result.reasonCode, "accepted_handoff");
});

test("hours validation rejects plain greeting", () => {
  const result = validateStepAnswer("hours", "salam", {});

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "rejected_hours");
});

test("hours validation accepts Azerbaijani schedule text", () => {
  const result = validateStepAnswer(
    "hours",
    "həftə içi 09:00-18:00, şənbə 10:00-15:00",
    {}
  );

  assert.equal(result.accepted, true);
  assert.equal(result.reasonCode, "accepted_hours");
});

test("description validation rejects weak filler text", () => {
  const result = validateStepAnswer("description", "test", {});

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "rejected_description");
});

test("description validation accepts real business summary", () => {
  const result = validateStepAnswer(
    "description",
    "Xanımlar üçün saç kəsimi, baxım və gözəllik salonu xidmətləri göstəririk.",
    {}
  );

  assert.equal(result.accepted, true);
  assert.equal(result.reasonCode, "accepted_description");
});

test("company validation accepts business name with website", () => {
  const result = validateStepAnswer("company", "Mand mand.az", {});

  assert.equal(result.accepted, true);
  assert.equal(result.reasonCode, "accepted_company");
});

test("company validation rejects pure greeting", () => {
  const result = validateStepAnswer("company", "hello", {});

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "rejected_company");
});

test("approval blockers catch polluted nonsense draft fields", () => {
  const pollutedDraft = {
    businessProfile: {
      companyName: "Mand",
      description: "Xanım saç kəsimi baxımı və s, gözəllik salonu işləri",
    },
    services: [{ title: "Salam" }],
    contacts: [{ type: "primary", value: "Necəsən" }],
    hours: [
      {
        day: "monday",
        enabled: false,
        closed: true,
      },
    ],
    pricingPosture: {
      publicSummary: "How are you?",
    },
    handoffRules: {
      enabled: true,
      summary: "Hey? I dont understand",
    },
  };

  const blockers = buildApprovalBlockers(pollutedDraft);

  assert.ok(blockers.some((item) => item.step === "services"));
  assert.ok(blockers.some((item) => item.step === "contacts"));
  assert.ok(blockers.some((item) => item.step === "pricing"));
  assert.ok(blockers.some((item) => item.step === "handoff"));
});

test("draft is not ready for approval when nonsense values are present", () => {
  const pollutedDraft = {
    businessProfile: {
      companyName: "Mand",
      description: "Gözəllik salonu",
    },
    services: [{ title: "Salam" }],
    contacts: [{ type: "primary", value: "Necəsən" }],
    hours: [],
    pricingPosture: {
      publicSummary: "How are you?",
    },
    handoffRules: {
      summary: "Hey? I dont understand",
    },
  };

  assert.equal(isDraftReadyForApproval(pollutedDraft), false);
});

test("draft is ready for approval only when all sections are semantically valid", () => {
  const draft = createValidDraft();

  assert.equal(buildApprovalBlockers(draft).length, 0);
  assert.equal(isDraftReadyForApproval(draft), true);
});

test("helper detects pure greeting correctly", () => {
  assert.equal(relevanceTest.isPureGreeting("Salam"), true);
  assert.equal(relevanceTest.isPureGreeting("Hey"), true);
  assert.equal(relevanceTest.isPureGreeting("saç boyama"), false);
});

test("helper detects meta chat correctly", () => {
  assert.equal(relevanceTest.isMetaChat("How are you?"), true);
  assert.equal(relevanceTest.isMetaChat("Necəsən"), true);
  assert.equal(
    relevanceTest.isMetaChat("Qiymətlər 20 AZN-dən başlayır"),
    false
  );
});

test("helper parses meaningful services but drops greeting words", () => {
  const values = relevanceTest.parseMeaningfulServices(
    "Salam, saç kəsimi, baxım, hello"
  );

  assert.deepEqual(values, ["saç kəsimi", "baxım"]);
});

test("helper parses meaningful contacts only", () => {
  const values = relevanceTest.parseMeaningfulContacts(
    "Necəsən, +994 50 555 55 55, hello@mand.az, WhatsApp"
  );

  assert.ok(values.some((item) => /\+994/i.test(item)));
  assert.ok(values.some((item) => /hello@mand\.az/i.test(item)));
  assert.equal(values.some((item) => /^Necəsən$/i.test(item)), false);
});