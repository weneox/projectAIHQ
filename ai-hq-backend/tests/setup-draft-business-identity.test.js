import test from "node:test";
import assert from "node:assert/strict";

import {
  listSetupContactsFromDraftOrCanonical,
  listSetupLocationsFromDraftOrCanonical,
  stageContactMutationInMaintenanceSession,
  stageLocationMutationInMaintenanceSession,
} from "../src/services/workspace/setup/draftBusinessIdentity.js";

test("contact mutation stages into maintenance review instead of mutating live contacts", async () => {
  const captured = {
    sessionInput: null,
    patchInput: null,
    sessionPatch: null,
  };

  const staged = await stageContactMutationInMaintenanceSession({
    db: {},
    actor: {
      tenantId: "tenant-1",
      tenantKey: "alpha",
    },
    mode: "upsert",
    body: {
      contact_key: "main-phone",
      channel: "phone",
      label: "Main line",
      value: "+15550001111",
      is_primary: true,
    },
    async getCurrentSetupReview() {
      return {
        session: null,
        draft: null,
      };
    },
    async getOrCreateActiveSetupReviewSession(input) {
      captured.sessionInput = input;
      return {
        id: "session-contact-1",
        mode: "refresh",
        status: "draft",
        currentStep: "maintenance_review",
        metadata: {},
      };
    },
    async patchSetupReviewDraft(input) {
      captured.patchInput = input;
      return {
        version: 4,
        contacts: input.patch.contacts,
        sourceSummary: input.patch.sourceSummary,
      };
    },
    async updateSetupReviewSession(sessionId, patch) {
      captured.sessionPatch = { sessionId, patch };
      return {
        id: sessionId,
        ...patch,
      };
    },
    truthVersionHelper: {
      async getLatestVersion() {
        return {
          id: "truth-version-4",
          contacts_snapshot_json: [],
        };
      },
    },
  });

  assert.equal(captured.sessionInput?.mode, "refresh");
  assert.equal(captured.patchInput?.patch?.contacts?.length, 1);
  assert.equal(captured.patchInput?.patch?.contacts?.[0]?.contactKey, "main-phone");
  assert.equal(
    captured.patchInput?.patch?.sourceSummary?.maintenance?.sourceCurrentTruthVersionId,
    "truth-version-4"
  );
  assert.equal(captured.sessionPatch?.patch?.currentStep, "maintenance_review");
  assert.equal(staged.publishStatus, "review_required");
  assert.equal(staged.reviewRequired, true);
  assert.equal(staged.liveMutationDeferred, true);
  assert.equal(staged.runtimeProjectionRefreshed, false);
});

test("location mutation stages into maintenance review instead of mutating live locations", async () => {
  const captured = {
    patchInput: null,
  };

  const staged = await stageLocationMutationInMaintenanceSession({
    db: {},
    actor: {
      tenantId: "tenant-1",
      tenantKey: "alpha",
    },
    mode: "upsert",
    body: {
      location_key: "hq",
      title: "Head Office",
      city: "Baku",
      address_line: "1 Governance Ave",
    },
    async getCurrentSetupReview() {
      return {
        session: {
          id: "session-location-1",
          mode: "refresh",
          status: "draft",
        },
        draft: {
          locations: [],
          sourceSummary: {},
          draftPayload: {},
        },
      };
    },
    async patchSetupReviewDraft(input) {
      captured.patchInput = input;
      return {
        version: 2,
        locations: input.patch.locations,
        sourceSummary: input.patch.sourceSummary,
      };
    },
    async updateSetupReviewSession(sessionId, patch) {
      return {
        id: sessionId,
        ...patch,
      };
    },
    truthVersionHelper: {
      async getLatestVersion() {
        return {
          id: "truth-version-7",
          locations_snapshot_json: [],
        };
      },
    },
  });

  assert.equal(captured.patchInput?.patch?.locations?.length, 1);
  assert.equal(captured.patchInput?.patch?.locations?.[0]?.locationKey, "hq");
  assert.equal(staged.publishStatus, "review_required");
  assert.equal(staged.maintenanceSession?.id, "session-location-1");
});

test("contact/location reads prefer staged maintenance draft over canonical rows", async () => {
  const contacts = await listSetupContactsFromDraftOrCanonical({
    db: {},
    actor: {
      tenantId: "tenant-1",
    },
    async getCurrentSetupReview() {
      return {
        session: { id: "session-1" },
        draft: {
          contacts: [{ id: "contact-1", contactKey: "main-phone" }],
        },
      };
    },
  });

  const locations = await listSetupLocationsFromDraftOrCanonical({
    db: {},
    actor: {
      tenantId: "tenant-1",
    },
    async getCurrentSetupReview() {
      return {
        session: { id: "session-1" },
        draft: {
          locations: [{ id: "location-1", locationKey: "hq" }],
        },
      };
    },
  });

  assert.equal(contacts.staged, true);
  assert.equal(contacts.contacts[0].contactKey, "main-phone");
  assert.equal(locations.staged, true);
  assert.equal(locations.locations[0].locationKey, "hq");
});
