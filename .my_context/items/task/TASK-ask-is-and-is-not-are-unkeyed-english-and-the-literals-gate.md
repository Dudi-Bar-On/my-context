---
id: TASK-ask-is-and-is-not-are-unkeyed-english-and-the-literals-gate
type: task
title: "Ask: `is` and `is not` are unkeyed English, and the literals gate cannot see them because they reach the DOM through a variable"
status: active
severity: soft
always: false
summary: Two words on the query screen stay in English while everything around them is translated, and the check built to catch that cannot see them.
summary_of: 02096867d56155c8
scope: []
tags:
  - v2
  - ui
  - i18n
  - walk
  - "screen:ask"
  - gates
  - "plan:walk"
  - "seq:99"
  - "state:done"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: c2ba21a85f0d6da2
plan: walk
seq: "99"
state: done
priority: "1"
progress: "0"
needs: walk/92
source: "plan:walk seq:27, measured against src/ui/public/screens/ask.js and test/ui/screen-literals.test.ts on 2026-08-29"
---

# Ask: `is` and `is not` are unkeyed English, and the literals gate cannot see them because they reach the DOM through a variable

WHAT THE SCREEN IS, so it can be built without opening the mockup. `nav.ev` -- **Ask**, `<section data-p="ask">`. One card: a tab strip (corpus / audit), ONE filter row of (field, operator, value), four canned queries, the SQL the SERVER composed, a three-column result table (At / Kind / What) and a disclosure above and below it. `ask.sub` -- "bound as parameters, composed on the server. No query text crosses the wire" -- is a property of the ENDPOINTS, not of this module: it picks a field, an operator and a value, sends them as query parameters, and fills the SQL pane from `body.sql` and nothing else. Two ways past a cap, answering different questions: `boundedList` pages what is already in hand, and `ask.limit`'s ladder goes and fetches more.

WHAT IT OWES, and it is two things on one card.

**1. `is` AND `is not` ARE THE ONLY PROSE ON THIS SCREEN THAT NO STRING TABLE DECLARES.** `screens/ask.js` holds them as `const IS = 'is'` and `const IS_NOT = 'is not'`, the mockup's own literals, carrying no `data-t`. The א/A toggle cannot reach them, so the operator select reads English in the middle of an otherwise Hebrew filter row -- and it is the control that decides whether the reader is asking for a thing or its negation.

The file's stated reason -- that a key the design of record does not declare "fails `strings-parity` in the direction that names it" -- expired on 2026-08-26. See plan:walk seq:92, which this task waits on.

**2. AND THE ONE GATE BUILT TO CATCH EXACTLY THIS CANNOT SEE THEM.** `test/ui/screen-literals.test.ts` enumerates every user-facing string literal under `screens/` at the five places text enters the DOM, and holds a ledger so the list can only shrink. `is not` is two words and is prose by its own rule, and it is NOT in the ledger -- because `option()` assigns `node.textContent = label` where `label` is a PARAMETER, and the collector reads `.textContent = TEXT` only when the right-hand side is a literal.

That is the check's own stated floor -- "It cannot see a sentence composed somewhere else and passed in as a variable" -- meeting a real string on a real screen the same week it was written. So the ledger's count of unkeyed prose is a FLOOR and not a measurement, and this is the first known thing under it. Fix the string, and then decide what to do about the hole: either the collector follows a literal through a call argument into a factory, or the floor is restated with this instance named in it so the next reader does not read a green run as a clean UI. Do not leave the floor asserted in prose only -- that is the failure mode plan:walk seq:92 is about.

ONE SMALLER DIVERGENCE ON THE SAME CARD, recorded so it is not rediscovered: the mockup writes `style="background:var(--sunk)"` on this screen's SQL card and `--sunk` is defined NOWHERE -- not in the mockup and not in `styles.css` -- so the declaration is dropped and `.card`'s own background shows. The app does not reproduce it. Either the token is defined or the declaration goes; a dead custom property in the design of record is a rule that looks deliberate and does nothing.
