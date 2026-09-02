---
id: NOTE-packs-is-the-app-ahead-of-its-design-and-well-defended
type: note
title: packs is the app ahead of its design, and well-defended
status: active
severity: soft
always: false
summary: One screen already does more than its design asked for, and every extra part is deliberate, including the way it handles hostile text.
summary_of: d30cee374092f132
scope: []
tags:
  - v2
  - ui
  - "screen:packs"
  - tree-parity
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 1a2ae1503f9ac716
---

# packs is the app ahead of its design, and well-defended

Walked 2026-08-25. 73 mockup nodes to 124 app nodes, and every extra one is deliberate.

THE MOCKUP LISTS NO PACKS AT ALL -- nothing served them when it was drawn. The app appends the packs actually in the workspace, joined to the corpus as it is now. `packs-model.ts` says why that half exists: served without it, "this screen is an explainer with a copy button".

FIVE CONFIG KEYS, NOT THE TWO THE MOCKUP DREW, and the reason is a rule rather than a preference: "a table filtered to the rows somebody had already thought of is the silent drop this project bans".

AND IT IS THE SCREEN THAT HAS TO SURVIVE AN ATTACKER. `packs[].name` is untrusted text: `screenPackMeta` screens the manifest s name, but `pack import --name <text>` overrides it after `planImport` has run, and a name carrying U+202E RIGHT-TO-LEFT OVERRIDE exits 0 and is written verbatim. The screen anchors isolation TWICE -- the `<bdi>` element and the `.m` class -- so containment survives a class rename or an element swap rather than depending on either. And it strips NOTHING: "a name they cannot see is a name they cannot pass to `review promote --all --pack`".

Nine tree-parity findings, and they are the fixture and the pairing shift that more rows cause. Nothing on this screen needs building.
