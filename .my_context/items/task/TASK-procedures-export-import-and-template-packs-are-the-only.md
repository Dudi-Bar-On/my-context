---
id: TASK-procedures-export-import-and-template-packs-are-the-only
type: task
title: Procedures, Export / import and Template packs are the only three screens that state no verdict, because the retired PROPOSED badge is what their design of record put in that slot
status: active
severity: soft
always: false
summary: Three screens say nothing about what they are good for, because retiring an old design label left that slot empty rather than filled.
summary_of: 1c8230543b90b949
scope: []
tags:
  - v2
  - ui
  - walk
  - "screen:proc"
  - "screen:port"
  - "screen:packs"
  - proposed
  - i18n
  - "plan:walk"
  - "seq:108"
  - "state:todo"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: d1da13705cc2259e
plan: walk
seq: "108"
state: todo
priority: "2"
progress: "0"
needs: walk/92
source: "plan:walk seq:5, measured against src/ui/public/screens/parts.js, proc.js, port.js, packs.js and strings/en.js on 2026-08-29"
---

# Procedures, Export / import and Template packs are the only three screens that state no verdict, because the retired PROPOSED badge is what their design of record put in that slot

FOUND 2026-08-29 under plan:walk seq:5. One gap with one cause, and it lands on exactly the three screens that audit is about — which is why it had never been seen as a class.

**THE MEASUREMENT.** `screenHead()` takes a verdict key and prepends a glyph (`src/ui/public/screens/parts.js` · `export function screenHead(ctx, root, titleKey, verdictKey, subKey, glyph = '✅') {` · ~88). Eighteen of the twenty-one screens call it. Three cannot, and each hand-draws the `.phd` / `h2` / `.psub` shape instead while saying so in its own header: `screens/proc.js` (*"`screenHead` is not called and cannot be"*), `screens/port.js` (*"the only screen so far that cannot use it"*) and `screens/packs.js` (*"`screenHead` is not called because it REQUIRES a verdict key and this screen has none to give it"*). Counted over `src/ui/public/strings/en.js` on 2026-08-29: `pr.` declares 26 keys, `port.` 18, `pk.` 20, and not one of the sixty-four is a verdict.

**THE CAUSE IS THE BADGE, AND RETIRING IT LEFT A HOLE RATHER THAN A DECISION.** In the design of record the `.verdict` element on these three sections holds one thing — the PROPOSED chip, with no glyph and no `data-t`. They are three of the twelve `span.prop` the mockup declares, and they match the three the mockup's own rail badges. `DEC-the-proposed-chip-is-the-design-annotating-itself-not-ui` retired that chip as UI and was right to: a shipped app has no reason to tell a person one of its screens is a proposal. But on the other eighteen screens that same slot carries a sentence saying what the screen is GOOD AT, and on these three it now carries nothing at all. `screens/port.js` names the consequence exactly — *"a screen that is built with no sentence saying what it is good at is this screen's own open question rather than a licence to invent one"* — and `screens/packs.js` calls drawing the container empty *"parity theatre"*. Both are right to refuse the hollow element. Neither may write the sentence.

**WHAT THE WORK IS.** Draft one verdict sentence per screen — `pr.v`, `port.v`, `pk.v` — into `en.js` and `he.js`, take the three to the owner, and once approved switch all three modules to `screenHead` and delete their hand-drawn heads. Drafting is the agent's under `DEC-claude-drafts-the-mockup-and-the-owner-approves`; approving is not. A sentence claiming what a screen is good at must not ship unapproved, and three of them arriving together is the cheapest sitting the owner will get on this.

**WHY IT WAITS ON plan:walk seq:92, AND WHAT IT ADDS TO IT.** All three modules refuse on the premise that a key the design of record does not declare fails `strings-parity` in the direction that names it. That direction was dropped on 2026-08-26. seq:92 enumerates thirteen sites of that premise AND ITS GREP MISSED TWO: `screens/port.js` and `screens/packs.js` refuse on the same retired rule in a different wording — *a key that does not exist* rather than *a key that may not be invented* — so neither matched. Add both when seq:92 re-measures; the count is fifteen, not thirteen. `screens/proc.js` is already on that list, for two other sentences.

**WHAT THIS IS NOT.** It is not the em-dash key plan:walk seq:89 asks for, which words why a CELL holds no value. This words what a SCREEN is for. One is the body, the other is the head, and closing either does nothing for the other.
