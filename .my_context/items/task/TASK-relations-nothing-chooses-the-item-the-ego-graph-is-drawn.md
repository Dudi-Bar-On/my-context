---
id: TASK-relations-nothing-chooses-the-item-the-ego-graph-is-drawn
type: task
title: "Relations: nothing chooses the item the ego graph is drawn around"
status: active
severity: soft
always: false
summary: The relationships diagram always draws whichever item happens to come first, because there is no way to choose which one to look at.
summary_of: f4c837162511573c
scope: []
tags:
  - v2
  - ui
  - mockup
  - tree-parity
  - "plan:walk"
  - "seq:87"
  - "state:done"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: bd7fa12f4a9f139d
plan: walk
seq: "87"
state: done
priority: "2"
progress: "0"
source: "plan:walk seq:27, measured against src/ui/public/screens/graph.js on 2026-08-29"
last_change: "2026-08-29T00:00:00Z"
needs: port/94, walk/44
---

# Relations: nothing chooses the item the ego graph is drawn around

WHAT THE SCREEN IS, so it can be built without opening the mockup. `nav.ev` - **Relations**, `<section data-p="graph">`. An EGO GRAPH of one item and its neighbours at radius 1, never a hairball. Three columns laid out BY DIRECTION - what points at the focus, the focus, what the focus points at - because `gr.note` makes direction the layout: "the column decides which way the relation points, so nothing has to be simulated". `layoutGraph` places every node by its SIGNED depth from the focus. Nodes carry IDS AND NEVER TITLES, which is what keeps bidi-sensitive text out of every SVG in the product, and the chart mirrors by PROJECTION rather than by transform so glyphs stay upright. Every stroke is a CLASS - `.edge.bearing` / `.edge.ref` / `.edge.dangling`, `.node.focus` / `.missing` / `.superseded` / `.more` - because `forced-colors` cannot restate an SVG `stroke` attribute. Both facts an edge carries, `type` and `loadBearing`, are the SERVER's: a browser `.js` module cannot import a core `.ts` module, and re-listing the relation vocabulary in the client is the copied-rule defect this plan exists to prevent.

WHAT IT STILL OWES, AND IT IS ONE THING: NOTHING CHOOSES THE FOCUS. The screen fetches `/api/items` and takes element zero -
(`src/ui/public/screens/graph.js` · `/api/graph?focus=${encodeURIComponent(items.items[0].id)}&radius=${RADIUS}` · ~132)
- so it can only ever draw ONE item's neighbourhood, and which one is an accident of the item list's order. Nothing in the design of record fixes this: the Relations section has no picker, no `<select>` and no control of any kind. The header's focus popup is a DIFFERENT THING - `focus.live` is `state/focus.json`, which narrows injection by tags, categories and scope and names no item at all. The plan's Step 3 sketch adds two pickers on `graph.focus` and `graph.radius`, and NEITHER KEY IS DECLARED IN EITHER STRING TABLE, so a picker cannot be worded here without a mockup change first - the same class of blocker as `plan:screens seq:10s`.

THE OWNER RULES ONE OF THREE AND THIS TASK IS NOT LICENSED TO PICK:
  1. The mockup gains a focus picker (and a radius control, if radius is to be offerable at all), both keys are declared in the design of record and regenerated into `en.js` and `he.js`, and this screen reads them.
  2. The focus arrives from ELSEWHERE - a click on an id anywhere in the app routes to Relations with that id. This needs no new string, but it does need a route parameter the router does not have today: screens route as `#/name` and nothing carries an argument.
  3. First-item-by-id is ruled sufficient and written down, at which point `gr.sub`'s "One focused item, radius 1" is the whole specification and this closes.

RADIUS IS ALREADY SETTLED AND IS NOT PART OF THIS. It stays the endpoint's own default of 1, which is what `gr.sub` promises, and it is now SENT rather than relied on, so the readout names the horizon it actually asked for instead of quoting a default from memory. Everything the legend names is served - `focus`, `missing`, `status`, load-bearing, and "+N more" from `omitted` - so nothing on this screen is refused for want of data. The focus is the only question.

AND IT CANNOT BE JUDGED TODAY, WHICH IS WHY THIS WAITS. `KNOWN-the-demo-corpus-has-no-relations-at-all-so-the-graph-screen`: not one item in `.demo-corpus` carries a relation, so the app draws ONE node and a legend against the mockup's seven nodes and five labelled edges. Eleven of graph's twelve tree-parity findings are that, and every one is AMBIGUOUS rather than structural - the code can build `path.bearing.edge`, `rect.node.superseded`, `text.rel`; it has nothing to build them from. Until the fixture carries relations, neither the layered layout's determinism, nor the 60-node cap's "+N more", nor a dangling edge to a missing target has ever been SEEN. So this needs `port/94` and `walk/44`, and a browser spec that drives it is only writable after them.

Filed under plan:walk seq:27 - the screen has defect tasks (repaint/13a's hue assignments, walk/47's oversized chart, ui1/18's build record) and no task that says what it IS or what it owes.
