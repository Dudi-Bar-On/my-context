---
id: TASK-a-status-cast-out-of-frontmatter-makes-five-gates-answer-no
type: task
title: a status cast out of frontmatter makes five gates answer no
status: active
severity: soft
always: false
summary: A corrupt value in an item's file quietly makes the item stop governing, and five separate checks then let through what they exist to stop.
summary_of: 1e7e57a35b34fbd5
scope:
  - src/core/item.ts
  - src/core/pack/reader.ts
  - src/core/mutate.ts
  - src/core/overlap.ts
tags:
  - v2
  - corpus
  - gates
  - "plan:rulings"
  - "seq:69"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-12
valid_until: null
checksum: c2e9d7c4c029f259
plan: rulings
seq: "69"
state: done
priority: "1"
---

# a status cast out of frontmatter makes five gates answer no

> FOUND 2026-09-13 by the type-design review, and it is the one finding in that review that is both critical and reachable from outside this repository.
>
> `parseItem` CASTS `Status`, `Severity` AND `Origin` STRAIGHT OUT OF FRONTMATTER WITH NO CHECK - `src/core/item.ts` around lines 545, 546 and 584.
>
> WHY A CAST HERE IS NOT A HARMLESS ONE. `GOVERNING_STATUS` is a `Record<Status, boolean>` - a TOTAL, COMPILER-ENFORCED table, and its own docblock argues for exactly that shape because every status must have an answer. Index it with a laundered value such as `'activ'` and it returns `undefined`. `undefined` is falsy. So `governsNormatively` answers FALSE for an item whose file says `status: activ`, and the item quietly stops governing.
>
> FIVE GATES THEN FAIL OPEN TOGETHER, which is why this is filed as one item and not five: the supersede preflight, the guarded-field refusal, the status-change gate (`mutate.ts`), the contradiction gate (`overlap.ts`), and the pack-collision judgement. Every one of them asks `governsNormatively` and every one of them takes silence for permission.
>
> AND THE DEFENCE ALREADY EXISTS AND IS WIRED TO THE WRONG SIDE. `validateEnums` is written, it DOCUMENTS THIS EXACT FAILURE, and it is called THREE TIMES ON THE WRITE PATH AND ZERO TIMES ON THE READ PATH. The read path is reachable from untrusted input through `pack/reader.ts` - an artefact somebody else wrote. The codebase made this argument ten lines earlier in the same function and applied it only to the id.
>
> WHAT THIS ASKS FOR:
>
> 1. THE READ PATH VALIDATES. A value that is not a member of its union does not become one by being cast.
>
> 2. AND THE ANSWER DIFFERS BY WHERE THE FILE CAME FROM, which is the part that needs care rather than a single branch. The review's recommendation, and the one to build unless it can be argued down: REFUSE AT THE PACK BOUNDARY - an artefact someone else wrote does not get to define a status, and a refusal there is cheap and loud. On LOCAL DISK, fall back to `draft` AND RAISE A DOCTOR FINDING, because a corrupt file in the owner's own corpus should not vanish silently and should not be trusted either. WHAT IT MUST NOT DO IS TODAY'S BEHAVIOUR: read as `active` and govern.
>
> 3. THE SAME QUESTION FOR `Severity` AND `Origin`, answered rather than assumed. They are cast on the same two lines and neither has been thought about.
>
> 4. A REMOVAL PROOF PER GATE. Five gates rest on this. A test that proves one and leaves four is the shape this project has been catching all week.
>
> WHAT THIS IS AN INSTANCE OF, said so the next reader sees the class and not the case: the silent-failure review of 2026-09-12 named "the unlisted input takes the benign branch" as a pattern with at least six members, including a supersede gate that fails open and `isWriter`, which has now missed four real writers. THIS ONE IS DIFFERENT FROM `isWriter` IN A WAY THAT MATTERS: `isWriter`'s key is `string`, so the compiler could never have formed the proposition. HERE THE UNION EXISTS AND THE TABLE IS TOTAL - the type system was ready and the cast walked past it.
