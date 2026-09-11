# The two trimmed bodies, as drafts — measured, not applied

Companion to `reports/2026-09-11-the-pinned-set-reviewed.md`. These are the
exact bodies the figures in that report were measured against. **Neither has
been applied to any item.** Applying one is `mycontext edit <id> --body ...`
and it is the owner's act.

---

## 1. `REF-the-d-numbers-what-each-one-means-and-which-are-only`

Measured `itemCost`: **1,286**, down from 5,548. The record this removes —
the D37 widening history, D40's measurement, the reasons behind the order,
the README §12 note, the D41/D42/D43 prose, and the two superseded
"what is done under D37" paragraphs — goes to
`reports/2026-09-11-the-d-numbers-record.md`, which the trimmed item names.
That report has NOT been written; writing it is part of the same act.

```markdown
# the D numbers: what each one means, and which are only proposed

RULE-progress-is-reported-as-two-tables-with-stable-d-numbers says a D number is STABLE FOREVER -
never renumbered, never reused, appended at the end. THIS ITEM IS THE MAP. When a D number is
assigned, add it here in the same act: assigning a number and recording it here are ONE ACT. A
number announced in a message and not written here is not a D number yet, whatever the message said.

PINNED 2026-09-07 BY OWNER RULING: "save D persistent". It is the only place a D number survives a
compaction. The value of a stable number is that he can say "do D11" across sessions and mean
exactly one thing; reusing one would silently redirect an instruction of his.

THE NARRATIVE BEHIND THESE ROWS - every widening, every retired instruction, the measurements that
produced D40, and the reasoning for the order - is in `reports/2026-09-11-the-d-numbers-record.md`.
This item carries the MAP. That report carries the RECORD.

RATIFIED - the owner has used these numbers himself.
  D1-D5   doctor perf | a cancelled dependency is discharged | builder re-cut | the 24 Hebrew tutorials
  D6      the citation gate           plan:rulings seq:64
  D7      the audit projection index
  D8      the Hebrew RTL convention   plan:docsys seq:12
  D9      the ins/del markers         ruled: the grammar stays at five markers
  D10     four Composer pickers
  D11     long pickers                plan:builder seq:16 + seq:10
  D12     the Composer tested as a user   plan:builder seq:11
  D13a/b  the CLI help browser        plan:library seq:1
  D14     the handover re-asks at every percent
  D15     the ASK display
  D16     the dependency budget       plan:governance seq:5
  D17     the handover lag            plan:handover seq:17
  D18     on-demand handover update (CLI, slash command, MCP tool)
  D19     the handover checked for truth
  D20     an id in a result opens the item pane   plan:builder seq:13
  D21     the result card names the command       plan:builder seq:14
  D22     Run removed from the Composer           plan:builder seq:15
  D23     pointers not claims - convention adopted, check declined
  D24-D26 the help skeleton, the worked lines, the cross-references
  D27     the help tested for truth   plan:library seq:6                       OPEN
  D28     both READMEs               plan:docsys seq:11                        OPEN (needs D27)
  D29     code citing a retired item is named     plan:governance seq:6
  D30     the browser suite off the demo corpus   plan:port seq:99 + seq:100    OPEN
  D31     the 42 walk items measured and ruled    plan:walk seq:140
  D32     Ask and Capture reviewed, not merged    plan:walk seq:141             OPEN
  D33     the contradiction gate                  plan:contra seq:2, seq:3
  D34     restoring a session from its transcript plan:restore seq:1-2
  D35     a test declares what it rests on        plan:basis seq:1-2
  D36     the agent self-improvement loop         loop/1-5, loop/1 FIRST
          D36a instrumentation and the baseline   D36b the trigger and the pass
          D36c proposals and the artifact         D36d review, decline, the indicator
          D36e retirement and the bounded cap     (plans under docs/superpowers/plans/)
          loop/1 IS FIRST AND IT IS NOT A PREFERENCE: drift is detectable only as a CHANGE, so
          instrumentation added after the first promotions has no baseline and no control.
  D37     the conversation archive rebuilt        plan:archive seq:1-54   CLOSED 2026-09-11, 54 of 54
  D38     the corpus lifecycle is enforced        governance/8 + contra/4
  D39     Export / import: make the screen true   DEFERRED by owner ruling, below every open D
  D40     a contrast ratio is computed against a colour that is not painted   STARTS NOW (D37 closed)
          The ground under a card is a radial gradient, not `--panel`/`--panel-2`/`--paper`; every
          ratio computed from those tokens is a claim about a colour that is not there, and it MOVES
          with position. Read the ground FROM THE RENDER; `e2e/frame-paint.spec.ts` is the example.
  D41     the product rule store      docs/superpowers/specs/2026-09-10-product-rule-store-design.md
  D42     conversation retrieval      docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md
  D43     a lifecycle note stops making a summary stale

THE ORDER AFTER D37, RULED BY THE OWNER 2026-09-09: D38, then D33, then D36 (loop/1 first).
The reasons are in the dated report; they were: D38 is small and half of it IS contra/4; D33 makes
the corpus trustworthy and everything rests on that; D36 is largest and has nothing built.

WHAT IS MISSING HERE, said rather than guessed: several ratified rows have no item reference,
because the D number was used in conversation and the work was never filed against a plan/seq - D1
to D5, D7, D13b, D14, D15, D18, D19, D23, D24-D26. Do not invent one to make the table look even.
Fill a row only from evidence.
```

---

## 2. `STD-v2-0-progress-report-and-the-format-progress-reports-use`

Measured `itemCost`: **792**, down from 2,296. This is the answer the item
already recommends to the question it already asks: keep the six rules, name
the newest dated report, quote no numbers. Sections 1-6 of the current body
move to `reports/2026-09-11-v2-progress.md`, which already holds the detail
and is already named as the authority.

```markdown
# v2.0 progress report, and the format progress reports use

**HOW TO READ AND REGENERATE THIS**

This is the standard for how progress is reported in this project. The CURRENT INSTANCE is the
newest dated report under `reports/` named `*-v2-progress.md` — today
`reports/2026-09-11-v2-progress.md` — and THAT FILE IS THE AUTHORITY. It carries every R row with
its evidence, the D table, the per-plan rollup, the open defects and the distance-to-production
section, and it is the thing to render when somebody asks where v2.0 stands. Regenerate it whenever
a plan task lands or a decision changes; keep the columns and the rules below.

**The rules that make it honest, and they are the point:**

1. **Status is one of five words only** — `SHIPPED`, `PLANNED`, `DECIDED`,
   `BLOCKED`, `OPEN`. `SHIPPED` means merged and its test is green. `PLANNED`
   means a numbered task exists in a plan document. `DECIDED` means a ruling
   exists but no task does. `BLOCKED` names what blocks it. `OPEN` means nobody
   has ruled.
2. **Every row cites where it lives** — a plan task number, a spec section, or a
   commit. A row with no citation is a claim, and claims do not go in this table.
3. **Counts are computed, never remembered.** Task totals come from the `task`
   category and from `grep -c "^## Task"`. Test results come from a run, quoted.
4. **A row that regressed says so** rather than being deleted.
5. **It is displayed, not merely filed.** Whoever regenerates this renders it in
   full to the person who asked — every section, as tables. Filing a progress
   report without showing it is how a project comes to believe a status nobody
   has read. If it is too long to show, that is a signal the report has stopped
   being a summary, not permission to summarise it away.
6. **Section 2 is QUERIED, not written.** Per
   `RULE-track-development-work-in-the-task-category-and-keep-it`, task counts
   come from the `task` category. A hand-written task table is a second copy of
   the truth. This was learned by getting it wrong: for a day this report said
   49 tasks because 47 lived only in plan files.

**AND THIS ITEM NAMES THE INSTANCE RATHER THAN QUOTING ONE, WHICH IS THE POINT.** The table that
stood here was dated 2026-08-20 and was delivered at every session start, because this item is
`always: true`. It said *"96 tasks, 0 executed"* against a corpus holding 716 tracked tasks of which
626 were done, and it listed R1, R2 and R3 as PLANNED when all three had shipped. Three weeks of
work were invisible to every session that read it. A stale table that is pinned is worse than one
nobody opens: it arrives with the authority of the rules above it. `CLAUDE.md` opens by saying a
copy cannot be superseded — only the original can. So the rules live here and the numbers live in
the dated report, which is the only place they can go stale visibly.

**DECISION HISTORY is history and cannot go stale, so it moved to the dated report with everything
else rather than being kept here as the one exception.**
```
