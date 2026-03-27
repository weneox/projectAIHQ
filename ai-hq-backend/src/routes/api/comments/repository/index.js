export { getTenantByKey, resolveTenantScopeForLead } from "./authority.js";
export {
  getCommentById,
  getExistingCommentByExternalId,
  insertComment,
  updateCommentState,
  listComments,
} from "./comments.js";
export {
  findExistingLeadByComment,
  insertLeadFromComment,
} from "./leads.js";
