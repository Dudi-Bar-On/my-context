---
id: STD-api-errors-use-problem-json
type: standard
title: API errors use Problem JSON
status: active
severity: soft
always: false
summary: Every error the service returns uses one shared shape, so a caller can read a failure without special-casing each endpoint.
summary_of: e3bfc7ab2adf39b0
scope:
  - src/api/**
tags:
  - api
  - errors
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-14
valid_until: null
checksum: 64e45904da7e2d1c
---

# API errors use Problem JSON

Every 4xx and 5xx response carries `application/problem+json` with `type`, `title`,
`status` and `detail`, as defined by RFC 9457. One error shape means the storefront
needs one error renderer rather than one per endpoint.
