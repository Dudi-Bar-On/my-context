---
id: DEC-use-stripe-for-payments
type: decision
title: Use Stripe for payments
status: active
severity: soft
always: false
scope: []
tags:
  - payments
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-14
valid_until: null
checksum: a0c1cbba4cc370ed
---

# Use Stripe for payments

Stripe holds the card details, so the API never stores a card number and our PCI
obligation stays at SAQ A. Adyen was the alternative: cheaper per transaction at the
volume we project, and a quarter of integration work we did not have.
