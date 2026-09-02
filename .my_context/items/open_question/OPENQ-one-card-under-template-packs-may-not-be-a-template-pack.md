---
id: OPENQ-one-card-under-template-packs-may-not-be-a-template-pack
type: open_question
title: "one card under Template packs may not be a template pack: what does the app call an imported export?"
status: active
severity: soft
always: false
summary: "One heading covers a list that can hold two different kinds of thing: should it stay as it is, split in two, or be renamed to something true of both?"
summary_of: 5ce52cbc9d98efe6
scope: []
tags:
  - v2
  - ui
  - "screen:packs"
  - proposed
  - walk
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 99a62c67b1fe4222
blocks: "the heading over the pack list on Template packs, and plan:port seq:14's third ruling"
---

# one card under Template packs may not be a template pack: what does the app call an imported export?

Raised 2026-08-29 under plan:walk seq:5, from `src/ui/public/screens/packs.js`'s header, which names it *"a wording question for the owner"* and correctly declines to answer it in code.

**THE MEASUREMENT.** `/api/packs` lists every record `readImportRecords` returns and `kind` is the first row of every card, because a record may be `pack` or `export`: an export somebody imported under `pack import --name` is a member of that list. The read model carries it deliberately — *"hiding it would be a filter with no disclosure"* — and the screen draws every row it is sent, under `pk.h`, "Template packs".

**SO THE HEADING CAN BE WRONG ABOUT ONE OF ITS OWN CARDS**, and the screen is right not to have fixed it in the obvious way: a filter would have deleted a pack from the reader's own workspace, silently, which is the failure `INV-nothing-is-dropped-silently` exists to stop. Drawing `kind` as the first row of every card is the mitigation — an export is labelled rather than assumed — and it is not the answer.

**THREE ANSWERS:**

1. **LEAVE IT.** `kind` on every card is enough and the heading names the common case. Costs nothing, and reads wrong once per imported export.
2. **A SECOND HEADING.** The stack splits by `kind` under two sub-headings. Two new `pk.` keys, and a decision about what an empty half draws — which is a second question, and a worse one.
3. **RENAME THE STACK.** One heading true of both kinds: the list is of ARTEFACTS this workspace has imported, and a pack and an export are both that. One new `pk.` key, `pk.h` — the screen's own title — untouched.

**RECOMMENDATION: 3.** It is one key, it changes nothing about what is drawn, and it is the only one of the three that stays true when a fourth artefact kind appears.

**ANSWER IT WITH plan:port seq:14's THIRD RULING**, which asks whether `/api/packs` and `/api/port` should merge into one `/api/artefacts`. That is the same word — *artefact* — arriving from the endpoint side, and the two should be settled in one sitting: naming the stack "artefacts" while the routes stay split, or splitting the naming while the routes merge, is how one product ends up with two vocabularies for one thing.
