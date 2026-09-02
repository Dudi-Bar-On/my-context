---
id: KNOWN-a-pack-cannot-ship-the-frontmatter-fields-its-own-category
type: known_issue
title: a pack cannot ship the frontmatter fields its own category declares
status: active
severity: soft
always: false
summary: A bundle sharing a custom kind of entry leaves out the extra fields that kind defines, so the receiving project rejects the entries it carries.
summary_of: 9830956c20bf3b15
scope: []
tags:
  - v2
  - export
  - packs
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: b55a1ca8384e4e88
---

# a pack cannot ship the frontmatter fields its own category declares

Neither projection writes extraFields, so a pack shipping a custom category ships it WITHOUT the fields that category declares — and createItem then refuses the pack's own items on arrival through unknownExtraFieldError. That is most of what a custom category is for.

Whether a pack may carry extraFields is recorded as an open question the owner has not ruled on. This makes it concrete, and it wants a ruling before export task 12 lands.

## Observations
- [note] reported by an implementing agent; reports/2026-08-21-FINDINGS.md entry 21
