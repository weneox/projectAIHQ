import { getSemanticDecisionJsonSchemaText } from "./schema.semantic.js";

export function buildSemanticRepairUserPrompt({
  latestMessageJson = '""',
  latestMessageWithoutCommandJson = '""',
  historySnippet = "(empty)",
  runtimeSnapshotJson = "{}",
  rawModelOutputJson = '""',
  fallbackReferenceJson = "{}",
}) {
  return `Repair the previous malformed semantic result.

LATEST MESSAGE:
${latestMessageJson}

LATEST MESSAGE WITHOUT LEADING COMMAND:
${latestMessageWithoutCommandJson}

RECENT HISTORY:
${historySnippet}

TENANT RUNTIME TRUTH:
${runtimeSnapshotJson}

RAW MODEL OUTPUT TO REPAIR:
${rawModelOutputJson}

SAFE FALLBACK REFERENCE:
${fallbackReferenceJson}

Return only JSON in this exact shape:
${getSemanticDecisionJsonSchemaText()}`;
}