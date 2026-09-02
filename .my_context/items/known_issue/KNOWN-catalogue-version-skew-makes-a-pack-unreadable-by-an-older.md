---
id: KNOWN-catalogue-version-skew-makes-a-pack-unreadable-by-an-older
type: known_issue
title: catalogue version skew makes a pack unreadable by an older build
status: active
severity: soft
always: false
summary: A bundle written by a newer version is refused outright by an older one, and the message it gives says nothing about why.
summary_of: 0db3a0ee2ee0d767
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
checksum: af993fa65ce98e7d
---

# catalogue version skew makes a pack unreadable by an older build

projectPackConfig decides built-in versus custom from the EXPORTING build's catalogue. A category this build ships and an older one does not — procedure, todo, note — is written as built-in, so the older receiver refuses it as an unknown name with no tier.

There is no fix inside the pack config projection: emitting tier for a name the receiver DOES have is the F2 retiering attack, which the export design refuses outright.

Export tasks 9 and 10 should recognise the shape and say so, rather than reporting a generic config failure.

## Observations
- [note] reported by an implementing agent; reports/2026-08-21-FINDINGS.md entry 20
