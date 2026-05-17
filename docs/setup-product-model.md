# AIHQ Setup Product Model

## Core decision

AIHQ setup is not a website setup flow.
AIHQ setup is not a form wizard.
AIHQ setup is not a chat-only questionnaire.

AIHQ setup is the Business Truth preparation system.

Its job is to prepare, review, approve, and publish the business facts that AIHQ is allowed to use when answering customers.

## Mental model

Setup has two separate layers:

1. Business Truth Setup
2. Assistant Behaviour / Style

These must not be mixed.

Business Truth decides what the assistant is allowed to say.
Assistant Behaviour decides how the assistant says it.

Truth controls facts.
Behaviour controls tone and delivery.

## Business Truth Setup

Business Truth Setup is required before AI can answer real customers.

Required business truth areas:

- business name
- business description
- services
- contacts
- working hours or availability posture
- pricing posture
- human handoff rules
- supported languages
- sources / evidence
- approval state

The assistant must not publicly answer from unapproved draft data.

Approved truth is the runtime source of authority.

## Assistant Behaviour

Assistant Behaviour is optional.

It must not block setup completion.

Default behaviour must exist even if the user never configures it.

Default behaviour:

- tone: professional
- answer length: concise
- emoji: off
- greeting: polite, not repetitive
- language: follow customer language when possible
- handoff: offer human help for complaints, exact quotes, risk, and unclear cases

Optional behaviour customization may include:

- warmer tone
- more premium tone
- more direct tone
- shorter or longer answers
- emoji on/off
- local friendly style
- sales-oriented style
- corporate style

Assistant Behaviour must never mutate Business Truth.

Bad:
- Changing services because user selected a warmer tone.
- Creating pricing facts from a behaviour setting.
- Treating greeting style as setup truth.

Good:
- Truth says implants exist.
- Behaviour says answer concisely.
- Runtime answer says: "Yes, implants are available. Exact pricing requires consultation."

## Correct setup architecture

### A. Input Layer

Setup can accept business information from:

- website source
- manual brief
- uploaded document
- pasted text
- setup chat answers
- existing approved truth
- channel metadata

Website is only one input method.
It is not the setup model.

### B. Extraction Layer

The extraction layer uses the OpenAI setup brain.

Rules:

- no keyword fallback
- no fake local reasoning
- no behaviour-policy extraction
- extract business-only facts
- use source evidence when available
- latest user correction wins over conflicting source evidence
- empty source instructions must not hallucinate facts
- manual business briefs can work without source evidence

### C. Draft Layer

The extracted result becomes a hidden structured draft.

Draft sections:

- Profile
- Services
- Contacts
- Hours
- Pricing
- Handoff
- Languages
- Sources

The draft can be incomplete.
Incomplete draft is not runtime truth.

### D. Review Room

The main setup experience should be a review room, not a wizard.

The user should see:

- extracted facts
- missing facts
- source evidence
- conflicts
- confidence / risk notes
- edit controls
- approve controls

The chat is only an input method.
The review room is the main product experience.

### E. Missing and Conflict Handling

If facts are missing, ask only for missing facts.

If facts conflict:

- show the conflict
- prefer latest explicit owner correction
- keep source evidence visible
- do not silently overwrite approved truth

Examples:

Website says: Old Clinic.
Owner says: Correction, name is New Clinic.
Expected: New Clinic wins, conflict is traceable.

### F. Approval Layer

Approval turns reviewed draft into approved truth.

Only approved truth can power:

- public widget replies
- inbox AI replies
- voice assistant answers
- automations
- customer-facing runtime decisions

### G. Runtime Layer

Runtime answer composition must use:

approved truth + optional assistant behaviour style

Runtime must not use:

- unapproved setup draft
- raw source evidence directly
- behaviour settings as facts
- keyword-inferred business facts

## Setup lifecycle states

Recommended states:

- not_started
- collecting_inputs
- extracting
- draft_ready
- missing_required_facts
- conflict_needs_review
- ready_for_approval
- approved_live
- stale_needs_review

## Product rule

Setup should feel like:

"Give me what you have. I will prepare the business brain. You review and approve."

It should not feel like:

"Fill this long form before using the product."

## Final target

The ideal AIHQ setup flow:

1. User enters setup.
2. User provides website, brief, file, or pasted information.
3. AI extracts business-only facts.
4. AI prepares a hidden structured draft.
5. User reviews the draft in sections.
6. User fixes missing/conflicting facts.
7. User approves.
8. Approved truth becomes live runtime authority.
9. Assistant behaviour can optionally style the answers, but never change the facts.

## Non-negotiable rules

- Business Truth setup is required for public AI answers.
- Assistant Behaviour is optional.
- Behaviour never mutates truth.
- Draft is not runtime authority.
- Approved truth is runtime authority.
- Website is an input, not the setup model.
- Setup chat is an input, not the main experience.
- Review Room is the main setup experience.
- OpenAI setup brain extracts business facts.
- Runtime answers are approved truth plus style.
