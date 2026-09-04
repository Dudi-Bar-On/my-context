---
id: TASK-dv-sub-and-the-spec-say-docs-renders-the-readme-and-no
type: task
title: dv.sub and the spec say Docs renders the README, and no endpoint serves it
status: superseded
severity: soft
always: false
summary: The documentation screen promises to show a document that nothing serves; it will instead say plainly which help topics it really does show.
summary_of: 18bb518983d71cad
acknowledged:
  - body_disagrees_with_meta@db3c6552a1212c03
scope: []
tags:
  - "plan:port"
  - "seq:5c"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: c8cda95525910d8b
valid_from: 2026-08-23
valid_until: 2026-09-03
checksum: d3c10531120e5f8c
state: done
plan: port
seq: 5c
---

# dv.sub and the spec say Docs renders the README, and no endpoint serves it

> Measured 2026-08-23 by the agent that built the Docs screen.
>
> `dv.sub` and the design spec both say this screen renders "the repository's own
> README, addressed by heading ordinal". No endpoint serves the README. It sits at
> the repo root, outside `src/ui/public/`, and the only markdown route is
> `/api/help/:topic` over exactly four topics — categories, scope, capture,
> workflow.
>
> The screen was built against the endpoint that exists and renders `scope`, the
> one Contents entry (dv.t4, ordinal 4) that names a reachable topic, so the two
> cards at least agree with each other.
>
> The second half of the same sentence is also unlanded: the deep link. `#/docs/4`
> is not a route the router parses, and the mockup draws no control on the Contents
> rows, so the ordinal is displayed and not addressable.
>
> Two ways out, and it is a ruling rather than a coding decision: serve the README
> through a route, or restate `dv.sub` to describe the help topics it actually
> renders.

RULED 2026-08-25. This task named two ways out and called the choice a ruling
rather than a coding decision. The owner took the second one:

  RESTATE dv.sub to describe the help topics the screen actually renders.

So the work here is a string and a Contents card, not a route. What changes:
dv.sub itself, and the Contents entries that name four sections this server
cannot serve -- the mockup lists ordinals 1, 2, 3, 4 and 7 and only dv.t4
(Scope) names a reachable topic.

THE DEEP LINK GOES WITH IT. "addressed by heading ordinal" is the same
sentence's other half and it has nowhere to land, so it comes out of the
restated string rather than being left as a promise with no route.

AND THE RULING IS EXPLICITLY FOR NOW. The owner ruled in the same breath that a
full application documentation gets built -- from the README, the app's own
docs and the app itself, in English and Hebrew -- and that this screen becomes
where a user finds every detail about the product. That is plan:walk seq:24,
and it is the thing that eventually replaces what this task settles.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: SUPERSEDED BY plan:walk seq:25 (the route) and plan:walk seq:24 (the content). Both are later, both reached the owner, and between them they carry everything here.

This task found it first, on 2026-08-23: the design of record and the spec both say Docs renders the repository s own README, no endpoint serves it, and the screen was built against /api/help/:topic instead. The walk found the same thing on 2026-08-25 from the other end and called docs the worst screen in the product -- its own sentence promises the README and nothing feeds it.

THE OWNER RULED IT 2026-08-25: the screen serves help topics AND SAYS SO -- for now -- with a full documentation programme behind it (walk seq:24), in English and Hebrew. The markdown route and its boundary are walk seq:25, which is BLOCKED on an open question about what the server may serve, because a markdown route is a path-traversal surface.

THE DEEP LINK HALF GOES WITH IT: #/docs/4 is not a route the router parses. It belongs to the same sitting, because a document viewer that cannot be linked to is half a feature.

## Relations
- superseded_by [[TASK-serve-markdown-documents-to-the-ui-behind-a-decided-boundary]]
