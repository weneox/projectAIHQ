import { getSemanticDecisionJsonSchemaText } from "./schema.semantic.js";

export function buildSemanticUserPrompt({
  fullPrompt = "",
  latestMessageJson = '""',
  latestMessageWithoutCommandJson = '""',
  historySnippet = "(empty)",
  runtimeSnapshotJson = "{}",
  knowledgeJson = "[]",
  playbookJson = "{}",
  additionalContextJson = "{}",
}) {
  return `${fullPrompt}

SEMANTIC TASK

LATEST MESSAGE:
${latestMessageJson}

LATEST MESSAGE WITHOUT LEADING COMMAND:
${latestMessageWithoutCommandJson}

RECENT HISTORY:
${historySnippet}

TENANT RUNTIME TRUTH:
${runtimeSnapshotJson}

MATCHED KNOWLEDGE:
${knowledgeJson}

MATCHED PLAYBOOK:
${playbookJson}

ADDITIONAL CONTEXT:
${additionalContextJson}

INSTRUCTIONS:
1. First understand what the customer actually wants in this turn.
2. Treat greeting-only language as secondary if the turn also contains a business need.
3. Identify what is already known and what is still missing.
4. If the customer asked something concrete, answer it first.
5. Ask at most one next question, and only if it clearly moves the conversation forward.
6. If no next question is needed, recommendedNextQuestion must be empty.
7. If exact pricing or timing is unknown, say what it depends on instead of inventing it.
8. Do not default to generic “tell me what service you need” if the customer already gave the need.
9. Keep the final reply concise, natural, premium, and useful.

Return only JSON in this exact shape:
${getSemanticDecisionJsonSchemaText()}`;
}