import { apiGet } from "../../api/client.js";

export async function fetchLatestDraft(apiBase, proposalId) {
  if (!apiBase || !proposalId) return null;

  const url = `${String(apiBase).replace(/\/+$/, "")}/api/content?proposalId=${encodeURIComponent(
    String(proposalId)
  )}`;

  const j = await apiGet(url).catch(() => null);
  if (!j) return null;

  const item =
    j?.content ||
    j?.item ||
    j?.draft ||
    (Array.isArray(j?.items) ? j.items[0] : null) ||
    (Array.isArray(j?.contentItems) ? j.contentItems[0] : null) ||
    null;

  return item || null;
}
