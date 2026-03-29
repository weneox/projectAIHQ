import test from "node:test";
import assert from "node:assert/strict";

import { __test__ as knowledgeGovernanceTest } from "../src/routes/api/settings/sources/knowledgeGovernance.js";

test("approved summary knowledge no longer promotes into operational business facts", async () => {
  const promoted = await knowledgeGovernanceTest.maybePromoteApprovedKnowledgeToOperationalFact(
    {
      async query() {
        throw new Error("should not write");
      },
    },
    {
      tenant_id: "tenant-1",
      tenant_key: "alpha",
    },
    {
      candidate: {
        id: "candidate-summary-1",
        category: "summary",
        item_key: "company_summary",
        title: "Company Summary",
        value_text: "Trusted operator console for business truth.",
        value_json: {
          summary: "Trusted operator console for business truth.",
        },
      },
      knowledge: null,
      projection: {},
    }
  );

  assert.equal(promoted, null);
});

test("approved FAQ knowledge promotes only into runtime retrieval facts with an explicit surface marker", async () => {
  let insertParams = null;

  const promoted = await knowledgeGovernanceTest.maybePromoteApprovedKnowledgeToOperationalFact(
    {
      async query(text, params = []) {
        if (String(text).toLowerCase().includes("insert into tenant_business_facts")) {
          insertParams = params;
          return {
            rows: [
              {
                id: "fact-1",
                tenant_id: "tenant-1",
                fact_key: "faq_how_to_book",
                fact_group: "general",
                title: "How to book",
                value_text: "How to book - Send your preferred day and we will confirm.",
                value_json: {
                  question: "How to book",
                  answer: "Send your preferred day and we will confirm.",
                },
                language: "en",
                channel_scope: [],
                usecase_scope: [],
                priority: 100,
                enabled: true,
                source_type: "manual",
                source_ref: "knowledge-1",
                meta: {
                  factSurface: "runtime_retrieval",
                },
              },
            ],
          };
        }
        return { rows: [] };
      },
    },
    {
      tenant_id: "tenant-1",
      tenant_key: "alpha",
    },
    {
      candidate: {
        id: "candidate-faq-1",
        category: "faq",
        item_key: "how_to_book",
        title: "How to book",
        value_text: "Send your preferred day and we will confirm.",
        value_json: {
          question: "How to book",
          answer: "Send your preferred day and we will confirm.",
        },
      },
      knowledge: {
        id: "knowledge-1",
        category: "faq",
        item_key: "how_to_book",
        title: "How to book",
        value_text: "Send your preferred day and we will confirm.",
        value_json: {
          question: "How to book",
          answer: "Send your preferred day and we will confirm.",
        },
      },
      projection: {},
    }
  );

  assert.ok(insertParams, "expected runtime retrieval fact insert");
  assert.equal(promoted?.id, "fact-1");
  assert.match(String(insertParams[13]), /runtime_retrieval/);
});
