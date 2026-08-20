---
id: PROC-rotate-the-stripe-webhook-secret
type: procedure
title: Rotate the Stripe webhook secret
status: active
severity: hard
always: true
scope:
  - src/billing/**
tags:
  - billing
  - security
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: d7a0fbd966731038
---

# Rotate the Stripe webhook secret

The signing secret reached a build log on 2026-08-19, so it is rotated once and this
item is then done. Stripe verifies every delivery against exactly one endpoint secret
at a time, so the window in which the deployed verifier and Stripe disagree is a
window of dropped webhooks: the middle step is the only one a redeploy cannot undo.

The verifier accepts either secret for as long as the second variable is set, which
is what makes the first and last steps safe to take on their own:

```
STRIPE_WEBHOOK_SECRET=whsec_live
STRIPE_WEBHOOK_SECRET_NEXT=whsec_next
```

The deploy script prints the plan below before it runs. It is prose, not a step
list, and it is here because a checkbox-shaped line in a fenced block inside the
body must stay exactly where it was written:

```
- [ ] deploy (printed by the script, not a step of this procedure)
- also not a step
1. and neither is this
```

## Steps
- [ ] Deploy STRIPE_WEBHOOK_SECRET_NEXT beside the live secret; accept both.
- [ ] Roll the endpoint secret in Stripe.
- [ ] Promote NEXT to STRIPE_WEBHOOK_SECRET, drop NEXT, deploy again.

## Observations
- [risk] Stripe verifies against one endpoint secret at a time, so the roll is the outage window
- [evidence] The leaked secret is in build 4471's log, which the CI provider retains for 90 days
- [rollback] Redeploying the previous release restores the old secret only before the roll

## Relations
- relates_to [[RULE-never-log-a-secret]]
- derived_from [[NOTE-webhook-secret-in-a-build-log]]
