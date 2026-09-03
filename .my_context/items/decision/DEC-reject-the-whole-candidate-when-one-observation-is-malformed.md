---
id: DEC-reject-the-whole-candidate-when-one-observation-is-malformed
type: decision
title: Reject the whole candidate when one observation is malformed
status: active
severity: soft
always: false
summary: A proposed entry with one bad part is refused whole rather than saved short, because a short one becomes a different thing nobody can match up later.
summary_of: 7abb0b4ceaecc5c4
scope: []
tags:
  - ingest
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 61fab920ce030d4d
---

# Reject the whole candidate when one observation is malformed

Observations are folded into the content hash, and that hash is the dedupe key. An item created with two of three observations has a different identity, not a lossy version of the asserted one, and that rewrite is frozen: later re-captures either dedupe against the wrong item or mint a duplicate.

## Observations
- [tradeoff] Nineteen of twenty candidates still land, and the failure names the exact field and the corrected value
