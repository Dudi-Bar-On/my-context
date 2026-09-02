---
id: TASK-no-browser-reachable-endpoint-serves-audit-kinds-so-the
type: task
title: no browser-reachable endpoint serves AUDIT_KINDS, so the watch filter row collapses to All on a stale projection
status: active
severity: soft
always: false
summary: The activity filter learns its options by accident, so when data is stale it quietly offers fewer choices than the page is showing.
summary_of: a275123a04b7606d
scope: []
tags:
  - "plan:ui3"
  - "seq:11x"
  - "state:todo"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: e853de2e87cc61c9
valid_from: 2026-08-22
valid_until: null
checksum: f33738c113eabc4b
plan: ui3
seq: 11x
state: todo
---

# no browser-reachable endpoint serves AUDIT_KINDS, so the watch filter row collapses to All on a stale projection

> The mockup's watch card says its filter row is "one kind button per member of AUDIT_KINDS, DERIVED and never drawn", and gives the reason: the hand-copied list already went stale once — `access` and `progress` landed in `core/audit.ts` after the card was drawn and nothing came back to redraw them.
>
> `screens/watch.js` obeys that, but the only derivation the browser has is a SIDE EFFECT: `/api/watch/volume` fills every bucket's `byKind` with every member at zero, so the key order of one bucket is the enum. That vanishes exactly when it is least affordable — a projection that is behind, diverged or damaged makes the endpoint a 503, and an absent one answers with NO buckets — and the filter row is then left offering `All` alone while the live stream fills the table with six kinds of record. Screenshot of that state: `my-context/reports/2026-08-22-ui3-11-watch/watch-real-stale-projection-1568x779.png`.
>
> The screen's fallback is to learn kinds from the records it receives, which is a derivation from DATA and strictly weaker: it can only name kinds that happen to have occurred.
>
> What it needs: one read route that serves the vocabulary unconditionally — `AUDIT_KINDS` (and probably `AUDIT_OPS`, which `screens/ask.js` needs for the same reason) on `/api/meta`, or as a `kinds` field on `/api/watch/volume` that is present in every outcome including the refusal. Taken from the one declaration in `core/audit.ts`, never respelled.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and plan:walk seq:28 will make it LOOK fixed without fixing it. That is the reason to write this down now rather than discover it later.

The symptom this task photographs -- the filter row collapsed to All alone while the live stream fills the table with six kinds -- happens when /api/watch/volume 503s on a behind projection. walk seq:28 keeps the projection current, so the 503 mostly stops happening, so the side-effect derivation mostly works. THE DESIGN DEFECT IS UNTOUCHED: the browser still learns its vocabulary from the KEY ORDER OF ONE BUCKET of a response that exists for another purpose. It fails on the absent projection (200, no buckets), on a diverged one, and on a damaged one -- and it fails silently, by offering fewer buttons rather than by refusing.

SO THE PRIORITY DROPS AND THE TASK DOES NOT. What it needs is unchanged: one read route serving AUDIT_KINDS (and AUDIT_OPS, which screens/ask.js needs for the same reason) unconditionally, in every outcome including the refusal, taken from the one declaration in core/audit.ts and never respelled.

DISPATCH IT WITH walk seq:28. Same file, same read path, and whoever is there will otherwise leave believing the screen is fixed.
