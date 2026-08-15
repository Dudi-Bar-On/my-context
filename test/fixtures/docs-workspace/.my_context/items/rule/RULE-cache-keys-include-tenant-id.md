---
id: RULE-cache-keys-include-tenant-id
type: rule
title: Cache keys include tenant ID
status: draft
severity: hard
always: false
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
checksum: 65ac38087fbcf09a
---

# Cache keys include tenant ID

Two storefronts share one Redis cluster and price the same ISBN differently. A key
built from the ISBN alone serves one storefront the other one’s price. Every key is
prefixed with the tenant id.
