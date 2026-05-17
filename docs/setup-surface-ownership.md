# AIHQ Setup Surface Ownership

## Goal

Prevent setup from becoming a pile of old wizard, behavior, source-only, duplicated backend, and duplicated frontend flows.

## Canonical setup model

Setup is Business Truth preparation.

Canonical chain:

1. Backend extraction brain
2. Backend stored business draft
3. Backend review-room payload
4. Frontend review-room adapter
5. Frontend review-room surface
6. Approval into approved truth
7. Runtime consumers use approved truth only

## Ownership rules

Every setup file must be one of:

- canonical
- compatibility wrapper
- test fixture
- deleted

## Canonical backend areas

Allowed backend ownership:

- OpenAI setup brain / orchestrator
- business-only parser and patching helpers
- setupAssistantApp flow and session payload
- review-room payload contract
- projection/finalize into approved truth
- setup brain / projection / payload tests

## Canonical frontend areas

Allowed frontend ownership:

- setupReviewRoom frontend adapter
- SetupReviewRoomPreview / future review-room surface
- Truth/setup page integration
- smoke and contract tests

## Forbidden direction

Do not add:

- second setup wizard
- second setup assistant UI model
- behavior-as-truth setup
- website-only setup as main model
- frontend logic that re-interprets raw backend setup state differently from reviewRoom payload

## Required audit command

Run:

    node .\scripts\audit-setup-surfaces.mjs

Then classify each result before adding more setup UI.

## Final target

- one backend truth preparation pipeline
- one backend review-room payload contract
- one frontend adapter
- one frontend review-room experience
- optional assistant style separated from truth
- approved truth as only runtime authority


## CI guard

After active legacy setup surfaces are cleaned up, run:

    npm run audit:setup-surfaces:strict

This must stay green. If it fails, a new active setup surface is using legacy behavior/truth fields and must be either:

- removed
- moved to an allowed guard/test fixture
- converted to the canonical review-room / approved-truth model
