# Paid Launch Gate

The product is not paid-launch-ready until pricing, payment or manual invoice
terms, quota limits, cancellation/refund policy, and support ownership are
defined and approved. Billing disabled in code does not make the product safe
to sell.

## Launch modes

### Unpaid controlled pilot

Allowed only when all technical P0 launch evidence for `limited` passes.

Required:

- Named pilot customers only.
- No public paid marketing.
- No invoice, card collection, or payment promise.
- Written pilot scope and support owner.
- Backup/restore evidence attached before real customer data is accepted.
- Clear statement that usage may be stopped while production readiness gaps are
  closed.

### Paid pilot

Blocked until all of these are approved:

- Price, billing period, and included usage.
- Manual invoice process or payment provider flow.
- Contract or order form owner.
- Quota and usage-limit behavior.
- Over-limit handling.
- Cancellation terms.
- Refund terms.
- Support response expectation.
- Data export and offboarding path.
- Tax/accounting owner.

### Public paid SaaS

Blocked until paid pilot requirements are complete and these additional items
are approved:

- Self-serve or sales-assisted checkout path.
- Public pricing page or approved sales deck.
- Terms of service and privacy policy.
- Abuse/rate-limit policy.
- Billing failure and downgrade behavior.
- Customer support process and escalation owner.
- Launch analytics for signup, activation, conversion, retention, churn, and
  support load.

## Evidence rule

`docs/launch/production-launch-evidence.json` must keep `P0-005` as `BLOCKED`
until the approved paid launch evidence link is attached. Do not mark the item
`READY` because a price exists in a chat, spreadsheet, or private note. Link the
approved source of truth.
