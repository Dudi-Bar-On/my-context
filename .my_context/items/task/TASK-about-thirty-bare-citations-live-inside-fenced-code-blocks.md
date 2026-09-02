---
id: TASK-about-thirty-bare-citations-live-inside-fenced-code-blocks
type: task
title: about thirty bare citations live inside fenced code blocks, and nearly all are stale
status: active
severity: soft
always: false
summary: Plans carry file references inside code samples that people paste into real code, and most had gone stale because no check ever read them.
summary_of: 3eea6156ebf29329
scope: []
tags:
  - "plan:rulings"
  - "seq:33c"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: ca95017f14fe547f
plan: rulings
seq: 33c
state: done
priority: "2"
---

# about thirty bare citations live inside fenced code blocks, and nearly all are stale

Out of scope for ruling 33 and reported rather than swept, because these are source comments an implementer copies into src/. Converting them changes the code that gets written.

Roughly 30 across four plans, individually verified: 7 of 8 stale in web-ui-1, 10 of 11 in web-ui-2, 9 of 9 in never-miss. The citation gate does not read source comments, so nothing catches them.

One encouraging fact: the implementers who shipped the never-miss comments STRIPPED the line numbers before writing them, so those never reached the codebase. The defect may be confined to the plans.

Whoever owns src/ should sweep the comments that did land.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and it is the one of the six with a real hazard rather than a stale fact: these are SOURCE COMMENTS AN IMPLEMENTER COPIES INTO src/. Converting them changes the code that gets written, which is why it was correctly reported rather than swept. Sequence it AFTER the scope ruling, not before -- a rule about what the gate checks decides how these thirty should read.

IT IS ONE OF SIX TASKS ABOUT ONE GATE, and they have never been read together: plan:rulings seq:33c (thirty bare citations inside fenced code blocks, nearly all stale), seq:33d (two plan sentences), seq:38 (a plan that changes a command breaks the citations in its own survey table), seq:47 (no answer for .html, and six stale source citations), seq:48 (verify:citations does not scan either README), and plan:walk seq:30 (it does not scan the corpus either -- 104 of 109 plan pointers were wrong, corrected 2026-08-25). SIX OPEN TASKS, ONE GATE, THREE KNOWN BLIND SPOTS. That is a scope problem rather than three bugs: settle what the gate scans BY RULE -- every checked text file in the repository, exclusions named and justified -- instead of adding one directory at a time. DISPATCH THE SIX AS ONE PIECE OF WORK.

--- DONE 2026-08-31 ---

RE-COUNTED AT THE MOMENT OF ACTING. "About thirty" was 2026-08-21. Today the walked document trees hold 55 bare `file:line` pointers, 36 of them inside a fenced block. The 36 split cleanly by the fence's INFO STRING, and the split is the answer:
  29 inside a fence tagged as source (```ts): never-miss 9, web-ui-1 8, web-ui-2 11, web-ui-3 1. This is the original "about thirty" -- it counted 28 of these across three plans and missed web-ui-3's one.
  7 inside an UNTAGGED fence, all of them in a section 4.4 dataflow DIAGRAM in docs/superpowers/specs/2026-08-16-never-miss-an-injection-design.md. The original count never included these; they are not source in transit and are deliberately left.
The other 19 bare pointers are in ordinary prose and are out of scope for this task.

THE RULE, and it lives in scripts/verify-citations.ts under the heading "THE FENCE QUESTION", enforced by a new BARE fault and seven paired tests in test/scripts/verify-citations.test.ts:

A FENCE IS NOT A QUOTATION MARK. The gate has never tracked fences and still does not for the checked form -- two checked-form citations already sat inside ```ts fences in web-ui-1, both were read like any other line, and both resolve. What decides whether a pointer inside a fence is a citation is not the fence but whether the block is SOURCE IN TRANSIT, and the block says so itself in its info string:
  A fence tagged with a language this repo writes (ts, tsx, js, jsx, mjs, cjs) exists to be pasted into src/, where this gate walks comments. A `file:line` pointer inside one is unreadable in the plan AND unreadable on arrival, so the plan manufactures the exact silence the gate exists to end. That is now the BARE fault.
  An untagged fence, or one tagged for prose, is a display -- a diagram, a transcript, a rendered example. Nobody pastes it into a .ts file.

AND THAT IS ALSO THE SPECIMEN ESCAPE, which is why it is an info string and not a suppression list. A document whose subject is this notation has to be able to print `file.ts:123` to show the form that was refused. A specimen is not source in transit, so it carries no language tag -- the discriminator that makes the check work is the same one that lets it be escaped honestly, and no file can opt itself out. SOURCE_EXEMPT stays three exact paths, for the three files that must write MALFORMED citations in the checked form, which no info string can express.

THE SCOPE IS NARROW ON PURPOSE and the narrowness IS the ruling: the fault does not fire on the 19 prose pointers here nor on the 165 in .my_context/items/. A gate red on 184 findings nobody was asked to repair is a wall. It lands at ZERO because the 29 were converted in the same change.

CONVERTED: all 29, each fragment resolved against today's source. 9 of the 29 were pointing at code that had moved or gone. Zero broken and zero faults on the documentation side after the conversion; the doc tally went 1167 -> 1196 citations, all resolving.

NOTHING WAS SWEPT BLIND. No specimen was converted. Named, deliberately left byte-identical: the seven pointers in the section 4.4 diagram in 2026-08-16-never-miss-an-injection-design.md (lines 469, 569-574) -- an untagged fence, a display, and in specs/ rather than plans/; and the three files in SOURCE_EXEMPT (scripts/verify-citations.ts, test/scripts/verify-citations.test.ts, test/scripts/citations-in-source.test.ts), whose subject IS the grammar and which write malformed citations on purpose.
