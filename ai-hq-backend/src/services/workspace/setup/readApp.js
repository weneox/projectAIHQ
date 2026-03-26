import { buildSetupStatus } from "../setup.js";
import { loadCurrentReviewPayload } from "./reviewFlow.js";

async function defaultLoadSetupTruthPayload(args, deps) {
  const truthPayloads = await import("./truthPayloads.js");
  return truthPayloads.loadSetupTruthPayload(args, deps);
}

async function defaultLoadSetupTruthVersionPayload(args, deps) {
  const truthPayloads = await import("./truthPayloads.js");
  return truthPayloads.loadSetupTruthVersionPayload(args, deps);
}

export async function loadSetupTruthPayloadWithStatus(
  { db, actor },
  deps = {}
) {
  const loader = deps.loadSetupTruthPayload || defaultLoadSetupTruthPayload;
  return loader(
    { db, actor },
    {
      ...deps,
      setupBuilder: deps.setupBuilder || buildSetupStatus,
    }
  );
}

export async function loadSetupTruthVersionPayloadWithStatus(
  { db, actor, versionId = "", compareToVersionId = "" },
  deps = {}
) {
  const loader =
    deps.loadSetupTruthVersionPayload || defaultLoadSetupTruthVersionPayload;
  return loader(
    { db, actor, versionId, compareToVersionId },
    {
      ...deps,
      setupBuilder: deps.setupBuilder || buildSetupStatus,
    }
  );
}

export async function loadSetupTruthCurrentResponse(
  { db, actor },
  deps = {}
) {
  const loadTruth = deps.loadSetupTruthPayload || loadSetupTruthPayloadWithStatus;

  try {
    const data = await loadTruth({ db, actor });
    return {
      status: 200,
      body: {
        ok: true,
        ...data,
      },
    };
  } catch (err) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "SetupTruthLoadFailed",
        reason: String(err?.message || "failed to load setup truth"),
      },
    };
  }
}

export async function loadCurrentSetupReviewResponse(
  { db, actor, eventLimit = 30 },
  deps = {}
) {
  const loadReview = deps.loadCurrentReviewPayload || loadCurrentReviewPayload;

  try {
    const data = await loadReview({ db, actor, eventLimit });
    return {
      status: 200,
      body: {
        ok: true,
        ...data,
      },
    };
  } catch (err) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "SetupReviewCurrentLoadFailed",
        reason: String(err?.message || "failed to load current setup review"),
      },
    };
  }
}

export async function loadSetupTruthVersionResponse(
  { db, actor, versionId = "", compareToVersionId = "" },
  deps = {}
) {
  const loadVersion =
    deps.loadSetupTruthVersionPayload || loadSetupTruthVersionPayloadWithStatus;

  try {
    const data = await loadVersion({
      db,
      actor,
      versionId,
      compareToVersionId,
    });

    if (!data.truthVersion?.id) {
      return {
        status: 404,
        body: {
          ok: false,
          error: "SetupTruthVersionNotFound",
          reason: "truth version not found",
        },
      };
    }

    return {
      status: 200,
      body: {
        ok: true,
        ...data,
      },
    };
  } catch (err) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "SetupTruthVersionLoadFailed",
        reason: String(err?.message || "failed to load setup truth version"),
      },
    };
  }
}

export async function loadSetupReviewDraftResponse(
  { db, actor },
  deps = {}
) {
  const loadReview = deps.loadCurrentReviewPayload || loadCurrentReviewPayload;
  const arr = deps.arr || ((value) => (Array.isArray(value) ? value : []));

  try {
    const data = await loadReview({
      db,
      actor,
      eventLimit: 30,
    });

    return {
      status: 200,
      body: {
        ok: true,
        draft: data.review?.draft || null,
        session: data.review?.session || null,
        sources: arr(data.review?.sources),
        events: arr(data.review?.events),
        setup: data.setup,
      },
    };
  } catch (err) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "SetupReviewDraftLoadFailed",
        reason: String(err?.message || "failed to load setup review draft"),
      },
    };
  }
}
