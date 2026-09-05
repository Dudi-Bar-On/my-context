---
id: DEC-v2-0-is-everything-still-open-and-the-in-out-cut-s-forty-six
type: decision
title: v2.0 is everything still open, and the in-out cut's forty-six exclusions are overturned
status: active
severity: soft
always: false
summary: The owner ruled that no open task is out of scope for v2.0, so the release is defined by the whole open backlog.
summary_of: b0edfcf1acbe3ee3
scope:
  - reports/**
tags:
  - v2
  - scope
  - release
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: e739ef0fef9da328
---

# v2.0 is everything still open, and the in-out cut's forty-six exclusions are overturned

Owner ruling 2026-09-05, given after reading the progress table: put all of them in v2.0, so nothing remains out.

What the cut of 2026-09-04 did, and did not do. It placed all 120 open tasks - 63 in, 46 out, 11 asked - and it was written as a PROPOSAL. Nothing was applied. No task carries a v2 field, no tag marks anything out, and the three non_goal items in this corpus all predate it. So the exclusions existed only in that document's prose, and the corpus never knew about them.

That is why this ruling costs nothing mechanically and matters anyway: until now the report and the corpus disagreed about what the project is committed to, and a reader consulting either one would have got a different answer.

What v2.0 means now: every open task. The report's OUT column is history and should be read as the reasoning behind a proposal that was declined, not as a live classification. Its IN and ASK findings stand, and its measurements - the already-done, the duplicates, the state-versus-status drift - are still true and still worth acting on.

What this costs, stated rather than discovered. The 46 were classified out because they are enhancements, second surfaces for things that already work, or rest on taste nobody had ruled. Six of them are the builder consolidation, which replaces working hand-built forms with one shared component. Taking them in means v2.0 ships when they ship, and the release definition written the day before - v2.0 ships when the lane-able tasks are done, the owner-gated screens are confirmed and the asked items are ruled - now covers a far larger set than it did when it was written.

The honest number after this ruling: 89 open tasks, of which 46 are the screen-by-screen walkthrough and can only be closed by the owner.
