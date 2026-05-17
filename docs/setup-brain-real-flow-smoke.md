# AIHQ Setup Brain Real Flow Smoke

Goal:
Verify the real setup brain flow.

Flow:
website/source evidence
-> OpenAI setup brain
-> business-only acceptedPatch
-> hidden synthesis
-> review-ready draft
-> finalize
-> approved truth/runtime projection
-> public widget answers from approved truth only

This smoke proves setup is not keyword fallback, not behavior-policy driven, and not hallucinating from empty evidence.

Required automated checks before merging setup brain / website setup changes:

    npm run test:aihq:setup-brain
    npm --prefix "./ai-hq-backend" run test:integration:db:ops
    npm --prefix "./ai-hq-backend" run test:integration:db:website
    npm --prefix "./ai-hq-backend" run test:public-webchat
    npm --prefix "./ai-hq-backend" run lint
    npm --prefix "./ai-hq-frontend" run lint
    npm --prefix "./ai-hq-frontend" run build
    npm run test:frontend:stable:ci

Manual smoke:

1. Website source

Create or verify a website source for a tenant.

Expected:
- website source exists
- source type is website
- source has a primary URL
- source evidence is available before setup brain extraction

2. Setup assistant message

Open the setup assistant and send:

    Use the website source and prepare the setup.

Expected backend assistant response:
- provider = openai_business_brain
- usedFallback = false
- readyForApproval = true when required business facts are complete
- acceptedPatch contains business-only fields
- draft contains business name, description, services, contacts, pricing posture, handoff, website URL when present in evidence

Must not contain:
- assistantBehaviorDraft
- pricingBehavior
- locationBehavior
- bookingBehavior
- contactBehavior
- handoffBehavior
- greetingStyle
- afterHoursBehavior
- local_reasoning

3. Empty source guard

Send this when no source/evidence exists:

    Use the website source.

Expected:
- OpenAI is not called
- provider is setup_source_evidence_missing
- draft is not mutated
- no hallucinated business facts are created

4. Manual brief path

Send a full manual business brief without a website:

    No website yet. Business name is Manual Dental. We are a dental clinic in Baku. Services are cleaning and implants. WhatsApp +994551112233. Monday-Friday 09:00-18:00. Pricing depends on the case.

Expected:
- OpenAI setup brain is called
- source evidence can be empty
- business facts are extracted from latest user message
- draft becomes review-ready if required fields are complete

5. Conflict path

If website evidence says one business name, but owner corrects it:

    Correction: the business name is Corrected Dental Studio, not Old Website Clinic.

Expected:
- latest user correction wins
- acceptedPatch uses corrected value
- source evidence is not blindly trusted over owner correction

6. Review and finalize

Approve/finalize the review.

Expected:
- approved truth version is created
- runtime projection is business-only
- finalized payload has no behavior-policy leftovers
- public widget uses approved truth only

7. Public widget check

Ask the public widget about known approved business facts.

Expected:
- answers come from approved truth
- source badge/evidence is present when available
- unknown facts fall back safely
- no unapproved setup draft leaks into public replies

Regression rule:

If any legacy behavior token appears in setup source, treat it as a regression:

- assistantBehaviorDraft
- pricingBehavior
- locationBehavior
- bookingBehavior
- contactBehavior
- handoffBehavior
- greetingStyle
- afterHoursBehavior
- local_reasoning
- parseServicesNote
- detectPricingMode
- buildSourceSignals
- setupAssistantAuthorityView
- buildSetupAssistantBrainState
- buildSetupAssistantFirstPrompt

The setup brain must remain:
- OpenAI-brain driven
- source-grounded
- business-only
- approval-gated
- fail-closed
