---
id: KNOWN-the-demo-corpus-has-no-relations-at-all-so-the-graph-screen
type: known_issue
title: the demo corpus has no relations at all, so the graph screen cannot be judged
status: active
severity: hard
always: false
summary: The sample data holds no connections between entries, so the screen that draws those connections has never actually been seen working.
summary_of: 029e77a78217560c
scope: []
tags:
  - v2
  - ui
  - fixture
  - "screen:graph"
  - tree-parity
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 3d905a462154e0c0
---

# the demo corpus has no relations at all, so the graph screen cannot be judged

MEASURED 2026-08-25, walking graph in plan:port seq:98.

NOT ONE ITEM in `.demo-corpus` carries a relation. `scripts/demo-corpus.ts` never creates one -- it names no link, no relation and no rel type anywhere.

THE CONSEQUENCE ON SCREEN: the mockup draws an ego graph of seven nodes and five labelled edges -- `derived_from`, `constrains`, `relates_to`, `refines`. The app draws ONE node, the focus, and a legend. Eleven of graph s twelve tree-parity findings are that, and every one of them is AMBIGUOUS rather than STRUCTURAL: `path.bearing.edge`, `path.dangling.edge`, `rect.node`, `rect.node.superseded`, `rect.missing.node`, `text.rel` are all in the screen s vocabulary, so the code CAN build them. It has nothing to build them from.

THE SCREEN IS THEREFORE UNJUDGED, not judged and passed. Whether the layered layout is deterministic, whether the 60-node cap draws its "+N more", whether an edge to a missing target renders as dangling -- none of it has been seen. The one node that renders proves only that the screen boots.

THE SAME CAUSE, SMALLER, ON TWO MORE SCREENS: `gaps` and `injected` each have exactly ONE finding and it is the same one -- `ABSENT tr`, rows the corpus does not have. Three screens whose entire divergence list is the fixture.
