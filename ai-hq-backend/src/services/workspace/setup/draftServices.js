import { listSetupServices } from "../services.js";
import {
  arr,
  compactDraftObject,
  getOrCreateSetupDraftSession,
  mergeDraftState,
  obj,
  s,
} from "./draftShared.js";

async function defaultGetCurrentSetupReview(tenantId) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  return reviewHelper.getCurrentSetupReview(tenantId);
}

async function defaultPatchSetupReviewDraft(input) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  return reviewHelper.patchSetupReviewDraft(input);
}

function slugify(value = "") {
  const out = s(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

  return out || "service";
}

export function normalizeSetupServiceDraftInput(input = {}, fallbackId = "") {
  const body = obj(input);
  const title = s(body.title || body.name);
  if (!title) {
    throw new Error("Service title is required");
  }

  const key = s(body.key || body.serviceKey || body.service_key || slugify(title));

  return compactDraftObject({
    id: s(body.id || fallbackId || `draft_${key}`),
    key,
    serviceKey: key,
    title,
    description: s(body.description || body.summary),
    category: s(body.category || "general").toLowerCase() || "general",
    priceFrom:
      body.priceFrom ?? body.price_from ?? body.startingPrice ?? body.starting_price,
    currency: s(body.currency || "AZN").toUpperCase() || "AZN",
    pricingModel:
      s(body.pricingModel || body.pricing_model || "custom_quote").toLowerCase() ||
      "custom_quote",
    durationMinutes: body.durationMinutes ?? body.duration_minutes,
    isActive:
      typeof body.isActive === "boolean"
        ? body.isActive
        : typeof body.is_active === "boolean"
          ? body.is_active
          : true,
    sortOrder: Number(body.sortOrder ?? body.sort_order ?? 0) || 0,
    highlights: arr(body.highlights),
    metadataJson: mergeDraftState(obj(body.metadataJson), {
      stagedInSetupReview: true,
    }),
  });
}

function findDraftServiceIndex(items = [], idOrKey = "") {
  const needle = s(idOrKey).toLowerCase();
  if (!needle) return -1;

  return arr(items).findIndex((item) => {
    const id = s(item?.id).toLowerCase();
    const key = s(item?.key || item?.serviceKey || item?.service_key).toLowerCase();
    return id === needle || key === needle;
  });
}

export async function listSetupServicesFromDraftOrCanonical({
  db,
  actor,
  getCurrentSetupReview = defaultGetCurrentSetupReview,
}) {
  const current = await getCurrentSetupReview(actor.tenantId);
  const draftServices = arr(current?.draft?.services);

  if (current?.session?.id) {
    return {
      items: draftServices,
      services: draftServices,
      source: "setup_review_draft",
      staged: true,
      canonicalWriteDeferred: true,
    };
  }

  const data = await listSetupServices({
    db,
    tenantId: actor.tenantId,
    tenantKey: actor.tenantKey,
    role: actor.role,
    tenant: actor.tenant,
  });

  return {
    ...data,
    source: "canonical_read_only",
    staged: false,
    canonicalWriteDeferred: false,
  };
}

export async function stageSetupServiceMutation({
  db,
  actor,
  mode,
  serviceId = "",
  body = {},
  loadCurrentReviewPayload,
  getOrCreateSetupDraftSession: loadOrCreateSession = getOrCreateSetupDraftSession,
  patchSetupReviewDraft: patchDraft = defaultPatchSetupReviewDraft,
}) {
  const current = await loadOrCreateSession(actor);
  const draftServices = arr(current?.draft?.services);
  const index = findDraftServiceIndex(draftServices, serviceId);
  const nextServices = [...draftServices];

  if (mode === "create") {
    nextServices.push(normalizeSetupServiceDraftInput(body));
  } else if (mode === "update") {
    if (index < 0) throw new Error("service not found in setup review draft");
    nextServices[index] = normalizeSetupServiceDraftInput(
      mergeDraftState(nextServices[index], body),
      s(nextServices[index]?.id || serviceId)
    );
  } else if (mode === "delete") {
    if (index < 0) throw new Error("service not found in setup review draft");
    nextServices.splice(index, 1);
  } else {
    throw new Error("unsupported staged service mutation");
  }

  await patchDraft({
    sessionId: current.session.id,
    tenantId: actor.tenantId,
    patch: {
      services: nextServices,
      draftPayload: mergeDraftState(obj(current?.draft?.draftPayload), {
        stagedInputs: {
          services: {
            updatedAt: new Date().toISOString(),
            count: nextServices.length,
          },
        },
      }),
    },
    bumpVersion: true,
  });

  return loadCurrentReviewPayload({
    db,
    actor,
    eventLimit: 30,
  });
}

export const __test__ = {
  normalizeSetupServiceDraftInput,
};
