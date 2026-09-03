---
id: DEC-all-nineteen-relation-types-ship-and-an-inverse-pair-is-two
type: decision
title: All nineteen relation types ship, and an inverse pair is two views of one edge rather than a duplicate
status: active
severity: soft
always: false
summary: All nineteen relation names ship, because a relation and its opposite are the same link read from either end and a reader may want either.
summary_of: 75ce81a8976eabd6
scope: []
tags:
  - relations
  - v2
  - vocabulary
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-03
valid_until: null
checksum: 7b53ba7dd6ec8c77
---

# All nineteen relation types ship, and an inverse pair is two views of one edge rather than a duplicate

Owner ruling, 2026-09-04. Asked whether inverse pairs should be stored or derived, he answered: "do it, currently there are also some pairs, we could look at the active one or the passive side of a relation".

WHAT IS RULED

The six orphan relation types join the vocabulary: `produced`, `discovered_by`, `unblocks`, `enforces`, `enforced_by`, `answers`. With the twelve already there and `superseded_by`, that is the nineteen the owner asked for on 2026-08-31.

THE QUESTION THAT HAD NEVER BEEN PUT TO HIM, AND HIS ANSWER

`enforces`/`enforced_by` and `produced`/`discovered_by` are INVERSE PAIRS, and this project had already ruled that inverses are DERIVED rather than stored. The two rulings appeared to collide, and the collision was never surfaced - the owner ruled "all nineteen" without being told that two of them were inverses of two others.

His answer resolves it rather than overriding it: a relation has an ACTIVE and a PASSIVE side, and a reader may want either. `RULE-never-weaken-byte-identity enforces INV-markdown-is-the-source-of-truth` and `INV-markdown-is-the-source-of-truth enforced_by RULE-never-weaken-byte-identity` are not two facts. They are one edge read from each end, and both readings are worth offering.

WHY THIS IS NOT THE DUPLICATE THE EARLIER RULING REFUSED

The earlier ruling was about STORAGE - writing both directions as two independent rows that can disagree the moment one is edited alone. That objection stands and is why `superseded_by` is still not writable through `link_items`: excluding it IS the write gate that stops it being forged, and `supersede` writes both directions together so they cannot drift.

Offering a name for the passive side is a different act from storing an unmanaged second row. Whether the passive side is stored or computed at read time is an implementation question this ruling does not settle - what it settles is that the READER may ask from either end.

WHAT IT UNBLOCKS

The eight relation edges the 2026-09-04 merge could not write, and the relation-type filter on the Relations screen. That filter is already built and already derives its options from the vocabulary served on the endpoint - `src/ui/public/screens/graph.js` records it: "A ninth member of that array appears here with no change to this file, to styles.css or to either string table." So the filters need no UI work at all.
