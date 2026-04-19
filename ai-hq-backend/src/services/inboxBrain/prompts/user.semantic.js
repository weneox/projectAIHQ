export function buildSemanticUserPrompt({
  latestMessageJson = "\"\"",
  latestMessageWithoutCommandJson = "\"\"",
  historySnippet = "(empty)",
  runtimeSnapshotJson = "{}",
  knowledgeJson = "[]",
  playbookJson = "{}",
  additionalContextJson = "{}",
}) {
  return `CUSTOMER TURN
${latestMessageJson}

CUSTOMER TURN WITHOUT LEADING COMMAND
${latestMessageWithoutCommandJson}

RECENT HISTORY
${historySnippet}

TENANT RUNTIME TRUTH
${runtimeSnapshotJson}

MATCHED KNOWLEDGE
${knowledgeJson}

MATCHED PLAYBOOK
${playbookJson}

ADDITIONAL CONTEXT
${additionalContextJson}

DECISION RULES
1. Understand what the customer actually wants in this turn.
2. If the customer already gave the core need, do not ask for the same thing again in generic terms.
3. If something concrete was asked, answer it first.
4. Ask at most one next question, and only if it is truly useful.
5. If no next question is needed, recommendedNextQuestion must be empty.
6. Keep the reply natural, warm, concise, and commercially useful.
7. Prefer clarity over filler.
8. If exact pricing or timing is unknown, explain what it depends on instead of inventing it.`;
}