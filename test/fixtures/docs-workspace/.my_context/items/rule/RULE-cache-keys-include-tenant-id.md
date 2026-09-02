---
id: RULE-cache-keys-include-tenant-id
type: rule
title: Cache keys include tenant ID
status: draft
severity: hard
always: false
summary: Cached data must be labelled with the customer it belongs to, so one customer can never be shown another customer data.
summary_of: 4e5e0a3aacbf0814
scope:
  - src/cache/**
tags:
  - cache
  - multitenancy
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-14
valid_until: null
checksum: b99528c96c9bd701
---

# Cache keys include tenant ID

Two storefronts share one Redis cluster and price the same ISBN differently. A key
built from the ISBN alone serves one storefront the other one’s price. Every key is
prefixed with the tenant id.
