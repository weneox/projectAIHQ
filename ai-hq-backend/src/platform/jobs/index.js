/**
 * Platform Jobs boundary.
 *
 * Wraps the existing tenant-scoped jobs helper without introducing a second job system.
 *
 * Current source of truth:
 * - jobs
 * - db/helpers/jobs.js
 */

export {
  dbGetJobById,
  dbGetLatestJobByProposalAndType,
  dbCreateJob,
  dbUpdateJob,
} from "../../db/helpers/jobs.js";

export async function getJobById(db, id, options = {}) {
  return dbGetJobById(db, id, options);
}

export async function getLatestJobByProposalAndType(db, proposalId, type, options = {}) {
  return dbGetLatestJobByProposalAndType(db, proposalId, type, options);
}

export async function createJob(db, input = {}) {
  return dbCreateJob(db, input);
}

export async function updateJob(db, id, patch = {}) {
  return dbUpdateJob(db, id, patch);
}
