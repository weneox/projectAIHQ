const WAIT = (ms) => new Promise((r) => setTimeout(r, ms));

export const MOCK_EXECUTIONS = [
  {
    id: "ex_4f79dca18e6b2a10",
    type: "content.publish",
    status: "running",
    created_at: "2026-03-08T11:12:00.000Z",
    finished_at: "",
    proposal_id: "prop_0019",
    error: "",
    input: {
      proposal_id: "prop_0019",
      platform: "instagram",
      asset_count: 4,
      mode: "publish",
      account: "@neoxmedia",
    },
    output: {
      stage: "publishing",
      progress: 72,
      current_step: "dispatching assets",
      worker: "runtime-eu-03",
    },
  },
  {
    id: "ex_97ad1b4f8300a77c",
    type: "content.generate",
    status: "queued",
    created_at: "2026-03-08T11:24:00.000Z",
    finished_at: "",
    proposal_id: "prop_0021",
    error: "",
    input: {
      proposal_id: "prop_0021",
      platform: "tiktok",
      style: "luxury",
      variants: 3,
    },
    output: {
      queue: "creative-high",
      priority: "elevated",
      eta: "2m",
    },
  },
  {
    id: "ex_ada11128bf88231f",
    type: "asset.render",
    status: "completed",
    created_at: "2026-03-08T10:42:00.000Z",
    finished_at: "2026-03-08T10:49:12.000Z",
    proposal_id: "prop_0017",
    error: "",
    input: {
      proposal_id: "prop_0017",
      format: "story",
      platform: "instagram",
      aspect_ratio: "9:16",
    },
    output: {
      assets: 6,
      package_id: "pkg_1902",
      duration_sec: 432,
      result: "ready",
    },
  },
  {
    id: "ex_998e5af89aa7f001",
    type: "campaign.sync",
    status: "failed",
    created_at: "2026-03-08T09:50:00.000Z",
    finished_at: "2026-03-08T09:54:26.000Z",
    proposal_id: "prop_0014",
    error: "Upstream provider rejected account scope",
    input: {
      proposal_id: "prop_0014",
      provider: "meta",
      account_id: "act_20104",
    },
    output: {
      code: "SCOPE_DENIED",
      retriable: false,
      provider_trace: "mt_882001",
    },
  },
  {
    id: "ex_713b7df1ab24031c",
    type: "content.publish",
    status: "completed",
    created_at: "2026-03-08T08:16:00.000Z",
    finished_at: "2026-03-08T08:19:44.000Z",
    proposal_id: "prop_0008",
    error: "",
    input: {
      proposal_id: "prop_0008",
      platform: "linkedin",
      asset_count: 2,
    },
    output: {
      published: true,
      remote_ids: ["ln_8821", "ln_8822"],
      result: "delivered",
    },
  },
  {
    id: "ex_62ff88b1d4bb110c",
    type: "asset.render",
    status: "running",
    created_at: "2026-03-08T11:06:00.000Z",
    finished_at: "",
    proposal_id: "prop_0018",
    error: "",
    input: {
      proposal_id: "prop_0018",
      format: "carousel",
      scene_count: 7,
      engine: "vision-v2",
    },
    output: {
      stage: "compositing",
      progress: 44,
      node: "render-gpu-02",
    },
  },
  {
    id: "ex_11da9912a1ff4402",
    type: "content.generate",
    status: "completed",
    created_at: "2026-03-08T07:12:00.000Z",
    finished_at: "2026-03-08T07:18:55.000Z",
    proposal_id: "prop_0006",
    error: "",
    input: {
      proposal_id: "prop_0006",
      channels: ["instagram", "facebook"],
      language: "az",
    },
    output: {
      drafts: 5,
      headline_variants: 12,
      result: "generated",
    },
  },
];

export async function listExecutionSkeleton() {
  await WAIT(280);
  return [...MOCK_EXECUTIONS].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function getExecutionSkeleton(id) {
  await WAIT(220);
  return MOCK_EXECUTIONS.find((x) => String(x.id) === String(id)) || null;
}