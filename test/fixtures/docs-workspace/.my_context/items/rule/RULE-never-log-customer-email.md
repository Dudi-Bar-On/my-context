---
id: RULE-never-log-customer-email
type: rule
title: Never log customer email
status: active
severity: soft
always: false
scope:
  - src/**
tags:
  - privacy
  - logging
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-14
valid_until: null
checksum: 7a07f1bebaafecdc
---

# Never log customer email

Log the customer id instead. Access logs are shipped to a third-party aggregator
that our data-processing agreement does not cover, so an email address in a log
line leaves the boundary the checkout flow promises the customer.
