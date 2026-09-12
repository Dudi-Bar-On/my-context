---
id: TASK-a-byte-offset-and-a-character-offset-are-the-same-number-and
type: task
title: a byte offset and a character offset are the same number, and two seams take the wrong one
status: active
severity: soft
always: false
summary: Two places cut text at a boundary counted in bytes while holding characters, which quietly corrupts Hebrew at the seam.
summary_of: 9ab324bddffca9fe
scope:
  - src/ui/read-model-conversations.ts
  - src/core/session-summary.ts
  - src/core/conversation-index.ts
tags:
  - v2
  - archive
  - "plan:rulings"
  - "seq:70"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/offsetbody.md"
source_anchor: null
source_checksum: 05d64ee9036026d7
valid_from: 2026-09-12
valid_until: null
checksum: 6471d882620efda2
plan: rulings
seq: "70"
state: todo
priority: "1"
---

# a byte offset and a character offset are the same number, and two seams take the wrong one

> FOUND 2026-09-13 by the type-design review. A byte offset and a character offset are both `number`, so nothing stops one being used where the other is meant - AND TWO FILES ALREADY GET IT WRONG.
>
> THE CORPUS IS HEBREW FROM RECORD 5, so this is not a latent risk. A Hebrew character is two bytes in UTF-8. Slicing a 1 MiB boundary in CHARACTERS when the boundary is counted in BYTES lands mid-sequence, and the decoder emits U+FFFD - the replacement character - at the seam. The text is not lost; it is silently corrupted at a point nobody looks at, and a search that should match no longer does.
>
> WHERE IT IS RIGHT AND WHERE IT IS WRONG, because one of the three shows the fix:
>   - `src/core/conversation-index.ts` around line 1526 carries a `Buffer` and is CORRECT. The type of that one local variable is the entire difference.
>   - `src/ui/read-model-conversations.ts` around line 1207 carries a `string` across the boundary.
>   - `src/core/session-summary.ts` around line 910 carries a `string` across the boundary.
>
> WHY THIS PROJECT ALREADY KNOWS THIS AND STILL DID IT. "Byte offsets, never character offsets" is settled doctrine here - the conversation archive is built on it, every anchor is stored at a byte, and the retrieval work of 2026-09-12 turns on it. THE DOCTRINE IS IN THE COMMENTS AND NOT IN THE TYPES, so a correct decision has to be re-made by every author at every seam, and two authors did not make it.
>
> WHAT THIS ASKS FOR, and the first part is the bug rather than the design:
>
> 1. FIX THE TWO SEAMS. Carry bytes where the boundary is counted in bytes. This is small and it is the part that stops corrupting text today.
>
> 2. A REMOVAL PROOF THAT USES HEBREW. An assertion over ASCII cannot fail on this defect - the two offsets agree on ASCII, which is exactly why it survived. The test must put a multi-byte character ACROSS the boundary and assert no U+FFFD appears, and deleting the fix must turn it red.
>
> 3. THEN THE DESIGN QUESTION, WHICH IS THE OWNER'S AND IS NOT THE BUG: should a byte offset be a distinct type rather than `number`? A branded type would make the next seam impossible instead of merely correct. The review costed branding across the codebase and deferred the large cases; SCOPE ANY PROPOSAL HERE TO THE CONVERSATION AND SUMMARY PATHS, which is where the doctrine actually bites, and cost it before recommending it. A 900-site refactor is not what this item is for.
>
> DO NOT WIDEN THIS INTO THE GENERAL BRANDING QUESTION. The two seams are a defect with a measurable wrong output. The type question is a proposal, and it is recorded here so that fixing the defect does not quietly close the subject.
