---
id: TASK-a-relabel-writes-a-second-anchor-instead-of-renaming
type: task
title: a relabel writes a second anchor instead of renaming, whenever the row carries an id the product could not have written
status: active
severity: soft
always: false
summary: Renaming a bookmark whose id did not come from this product adds a second one instead of renaming it, and the screen says "Renamed."
summary_of: c68be14a0f7b3d4f
scope:
  - src/core/anchor-file.ts
  - src/ui/anchor-write.ts
tags:
  - v2
  - ui
  - recall
  - silent-failure
  - "plan:confirm"
  - "seq:6"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-14
valid_until: null
checksum: 484dfa15603fff53
plan: confirm
seq: "6"
state: todo
priority: "2"
---

# a relabel writes a second anchor instead of renaming, whenever the row carries an id the product could not have written

MEASURED 2026-09-14 by the lane that closed `confirm/5`, on a COPY of a real anchor file,
and it could not fix it because the durable half lives in files it did not own.

WHAT HAPPENS. `writeAnchorFile` accepts a row whose id is not `anchorIdFor(sessionId,
agentId, byteOffset)`. Rename such a row and the write does not rename it: it WRITES A
SECOND ROW at the derived id and leaves the original standing. Measured: 26 marked points
became 27, with two different labels — `a point I kept 15` and `a name that DID land` — at
ONE byte, both in the list at the same time.

THE SCREEN SAYS "Renamed." AND IT IS NOT A RENAME. That is D69’s subject exactly, and it is
the reason this is filed here rather than under the anchor-capability row: the confirmation
is true about a write that happened and false about the act the reader performed.

AND IT FALSIFIES A COMMENT THAT THE NEXT READER WILL TRUST. `anchorRow` states that the id is
derived from the position, SO IT SURVIVES A RENAME. That is exactly the property being
violated — and it is violated precisely when the id was never derived in the first place.

WHY NOTHING CAUGHT IT, WHICH IS THE PART WORTH KEEPING. The e2e fixture had been seeding
hand-written ids (`owned0015`) for as long as it has existed, and EVERY ASSERTION IN THAT
FILE FINDS ROWS BY LABEL. A duplicate row at a second id is invisible to a lookup by label:
the assertion finds its row, the row says what it should, and the second row is never asked
about. The fixture was repaired in the same commit that closed `confirm/5`, so the suite no
longer REPRODUCES this — which means the defect is now completely untested rather than
silently exercised. That is a better place to be and a worse one to forget.

WHERE IT LIVES: `src/core/anchor-file.ts` (the durable write) and `src/ui/anchor-write.ts`
(the route). Both were held by other lanes on the night this was found.

THE DECISION THIS CARRIES, rather than presumes:
  1. REFUSE a row whose id is not the derived one, at `writeAnchorFile`. Truthful and
     narrow, but it turns a bad row in an existing file into a hard failure on read.
  2. RELABEL BY BYTE rather than by id — find the row at that offset whatever its id, and
     replace it. Repairs bad rows in place and makes the rename a rename again.
  3. DISCLOSE: write the second row as today, and tell the reader the file carried a row the
     product could not have written. Consistent with `INV-nothing-is-dropped-silently`, but
     it leaves a duplicate on disk.

RECOMMENDATION: 2, with 3’s disclosure attached — relabel by byte so the act the reader
performed is the act that happens, and say once that a foreign id was healed. 1 alone
punishes the reader for a file the product accepted.

DO NOT CLOSE THIS BY REPAIRING ANOTHER FIXTURE. The fixture is already right; the durable
write is what is wrong.
