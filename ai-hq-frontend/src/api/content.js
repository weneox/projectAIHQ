// src/api/content.js
import { apiGet } from "./client.js";

export async function getContentByProposalId(proposalId) {
  if (!proposalId) return null;

  const j = await apiGet(
    `/api/content?proposalId=${encodeURIComponent(proposalId)}`
  );

  return j?.content || null;
}
