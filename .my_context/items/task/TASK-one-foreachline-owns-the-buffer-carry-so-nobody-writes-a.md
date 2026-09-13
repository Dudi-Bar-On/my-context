---
id: TASK-one-foreachline-owns-the-buffer-carry-so-nobody-writes-a
type: task
title: one forEachLine owns the Buffer carry, so nobody writes a chunk seam again
status: active
severity: soft
always: false
summary: Four places read a file in chunks and each had to decide the same thing about where a line can be cut; now one place decides it.
summary_of: d9f8292f845cf110
scope:
  - src/core/line-walk.ts
  - src/core/conversation-index.ts
  - src/core/conversation-redaction.ts
  - src/core/session-summary.ts
  - src/ui/read-model-conversations.ts
tags:
  - v2
  - archive
  - "plan:rulings"
  - "seq:74"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/foreachline.md"
source_anchor: null
source_checksum: e9c59b2911bb4661
valid_from: 2026-09-13
valid_until: null
checksum: b4443df20930b771
plan: rulings
seq: "74"
state: done
priority: "2"
---

# one forEachLine owns the Buffer carry, so nobody writes a chunk seam again

> > COMES FROM `rulings/70`'s OWN RECOMMENDATION — `TASK-a-byte-offset-and-a-character-offset-are-the-same-number-and`. That item fixed two broken chunk seams and then said, in the lane's own costing, that the repair which stops the NEXT one is to extract the walk, and that it should be preferred OVER branding the offset type: branding `number` would not have caught the bug, because the wrong value was a `string` standing where a `Buffer` was meant.
> >
> > FOUR CHUNKED LINE-WALKS WERE THE SAME TWENTY LINES WRITTEN FOUR TIMES, and each author re-derived the seam decision independently. Two of them got it wrong.
> >
> >   - `src/core/conversation-index.ts` · `iterateTranscript` (carry + carryAt) — was RIGHT
> >   - `src/core/conversation-redaction.ts` · `project` — was RIGHT, and had no seam test at all
> >   - `src/core/session-summary.ts` · `summariseTranscript` — was WRONG, fixed by rulings/70
> >   - `src/ui/read-model-conversations.ts` · `readWindow` — was WRONG, fixed by rulings/70
> >
> > WHAT WAS BUILT. `src/core/line-walk.ts` — one module, `node:fs` and nothing else, exporting `forEachLine(fd, { cap, from }, cb)` and the generator `eachLine` it is built on, plus `LINE_WALK_CHUNK_BYTES`. It OWNS the `Buffer` carry and the byte-versus-character decision, and hands every line to the caller as BYTES with the offset it starts at. Four call sites, no API change to any of them, and four private 1 MiB constants collapsed into one.
> >
> > WHY TWO SHAPES AND NOT ONE. `iterateTranscript` is itself a lazy generator and `anchors.ts` and `anchor-pass.ts` both RETURN out of the `for…of` after the first record — the comment there records why: "the generator's finally closes the descriptor when the loop breaks, so this reads one chunk however large the transcript is." A callback cannot stop a walk, so driving that call site with `forEachLine` would read a 52 MB transcript to answer a question the first line settles. `eachLine` is the primitive; `forEachLine` is the three-line wrapper the other three use.
> >
> > WHAT THE SHARED WALK DELIBERATELY DOES NOT DECIDE, because the four callers disagree and each keeps its own answer: it does not open or close the descriptor, it does not swallow a read error (the redaction copier must NOT keep going — half a JSON record in the copy is the one outcome that feature exists to prevent), it does not emit the trailing fragment, and it does not skip an empty line (the copier counts one as a record; the other three skip it). The tail is handed back in `LineWalk.trailing`.
> >
> > THE PROOF. `test/core/chunk-seam-utf8.test.ts` is unchanged in substance and is the main proof: it drove three readers through a Hebrew fixture straddling the 1 MiB boundary before this module existed and drives them after. `test/core/line-walk.test.ts` is new and proves the module directly plus the FOURTH reader, which had no seam assertion. Its fixture guards itself — the boundary byte is asserted to be a UTF-8 continuation byte, because a fixture shifted one byte left leaves every assertion green on broken code, which is rulings/70's own lesson one layer up.
> >
> > THE OFFSET TYPE IS NOT BRANDED, and that stays deferred by rulings/70's explicit instruction.
> >
> > TWO GAPS FOUND BY THE REMOVAL PROOFS AND NOT CLOSED HERE:
> >   - Corrupting every reported byte offset by one leaves `test/core/conversation-index.test.ts`, `test/core/anchors.test.ts`, `test/core/anchor-durability.test.ts` and `test/core/session-summary.test.ts` ALL GREEN. Only `conversation-search`, `anchor-per-turn`, `conversation-redaction` and the new file go red. Four suites about byte-addressed features do not check the byte.
> >   - Dropping the trailing fragment — a transcript whose last line has no newline, which is every live session — is caught by NOTHING except the new file.
