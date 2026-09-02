---
id: TASK-template-packs-what-the-screen-is-and-what-implemented-means
type: task
title: "Template packs: what the screen is, and what implemented means for it"
status: active
severity: soft
always: false
summary: The screen for starter collections someone else published, showing what each one brings, what it may never bring, and which are installed here.
summary_of: 9d263056b5ca9c51
scope: []
tags:
  - v2
  - ui
  - mockup
  - "plan:walk"
  - "seq:130"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-02
valid_until: null
checksum: b40ea116b24ee2ec
plan: walk
seq: "130"
state: todo
priority: "2"
source: "plan:walk seq:27, from the module header of screens/packs.js on 2026-09-02"
---

# Template packs: what the screen is, and what implemented means for it

WHAT THE SCREEN IS, so it can be built without opening the mockup. nav.ch -- Template packs, section data-p="packs". A pack is a pre-authored corpus someone published -- "the regulated-industry flavour" -- imported to start from an opinion instead of an empty directory. Four cards of prose: where an import lands and why BOTH routes land as draft with no trust flag, because a boundary a flag can override is not a boundary; what a pack may carry and what it never carries, with the line drawn once -- a pack carries what its author knows about the domain, never a setting that describes you; how integrity is described, and explicitly what a digest does not prove. Three of those four are drawn from the endpoint rather than as static text. Then the half the design could not draw because nothing served it when it was written: the packs actually in this workspace, joined to the corpus as it is now. Without that half the screen is an explainer with a copy button. AND IT IS THE SCREEN THAT HAS TO SURVIVE AN ATTACKER: a pack's name is author-supplied text that the import command can write past the manifest screening, so every string read off disk is drawn inside an isolated element that is anchored twice, and NOTHING is stripped, replaced or refused -- a name a person cannot see is a name they cannot act on.

WHAT IMPLEMENTED MEANS: the four cards served, one card per imported pack carrying the wire's own field names in the wire's order with a bounded list and a show-all, isolation that survives a class rename or an element swap, and the three counts the engine computes and no key can say -- quarantined, dropped and missing -- given words, held open at plan:screens seq:10s.

Filed under plan:walk seq:27, condition 3. NOTE-packs-is-the-app-ahead-of-its-design-and-well-defended measured the parity and concluded nothing here needs building; it did not say what the screen IS, which is what this task carries.
