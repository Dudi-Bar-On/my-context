---
id: DEC-use-stripe-for-payments
type: decision
title: Use Stripe for payments
status: active
severity: soft
always: false
summary: Payments are handled by an outside payment company, so this project never holds a card number itself.
summary_of: 059e2a7b499e2b84
scope: []
tags:
  - payments
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-14
valid_until: null
checksum: 288f5545ca9e03d3
---

# Use Stripe for payments

Stripe holds the card details, so the API never stores a card number and our PCI
obligation stays at SAQ A. Adyen was the alternative: cheaper per transaction at the
volume we project, and a quarter of integration work we did not have.
