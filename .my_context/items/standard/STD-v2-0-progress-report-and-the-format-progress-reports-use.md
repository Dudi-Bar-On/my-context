---
id: STD-v2-0-progress-report-and-the-format-progress-reports-use
type: standard
title: v2.0 progress report, and the format progress reports use
status: active
severity: soft
always: true
summary: The rules that keep a progress report honest, and a headline of where version 2.0 actually stands, pointing at the dated report that carries the detail.
summary_of: 5dacce588d7e6d81
summary_was:
  - "2026-09-11 Where each promised capability stands, and the rules that keep such a report honest: a short fixed vocabulary, and every row saying where it lives."
scope: []
tags:
  - v2
  - progress
  - reporting
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 45fe202ee462cc8b
---

# v2.0 progress report, and the format progress reports use

**HOW TO READ AND REGENERATE THIS**

This is the v2.0 progress report and, at the same time, the standard for how
progress is reported in this project. Regenerate it whenever a plan task lands or
a decision changes; keep the columns and the rules below.

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

---

**THE CURRENT INSTANCE IS `reports/2026-09-11-v2-progress.md`, AND IT IS THE
AUTHORITY.** What follows is the headline only. The full report — every R row
with its evidence, the D table, the per-plan rollup, the open defects and the
distance-to-production section — is in that file, and it is the thing to render
when somebody asks where v2.0 stands.

**REGENERATED 2026-09-11, AND WHAT THE PREVIOUS INSTANCE COST.** The table that
stood here was dated 2026-08-20 and was delivered at every session start,
because this item is `always: true`. It said *"96 tasks, 0 executed"* against a
corpus holding 716 tracked tasks of which 626 were done, and it listed R1, R2 and
R3 as PLANNED when all three had shipped. Three weeks of work were invisible to
every session that read it, and a stale table that is pinned is worse than one
nobody opens: it arrives with the authority of the rules above it.

---

**1. REQUIREMENTS — R1 to R13.** Computed 2026-09-11. Evidence for each row is in
the dated report; the `Where` column here names the shortest citation only.

| Req | What it asked | Status | Where |
|---|---|---|---|
| R1 | Markdown viewer for referenced files | SHIPPED | `DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer`; 24/24 green |
| R2 | README + docs viewer, EN/HE | SHIPPED | `DEC-the-documentation-and-tutorials-screens-become-one-list-and`; the `library` screen |
| R3 | Tutorials viewable EN/HE | SHIPPED | same ruling; `docsys/12`, `plan:tuts` 7 of 9 |
| R4 | Integrated help where the user must act | PLANNED | `screens/23`, and `TASK-no-screen-has-hover-or-click-help-and-most-buttons-carry` |
| R5 | Transparent gloss on shaded cards | SHIPPED | `styles.css`; **surface shrank** — the repaint moved cards to `.card.pane` |
| R6 | Export/import the whole registry | SHIPPED on the CLI, OPEN in the UI | `plan:export` 27 of 27; `OPENQ-does-export-import-ever-import-or-is-a-third-of-that-screen`, D39 deferred |
| R7 | Multi-session | SHIPPED | `plan:hooks` 44 of 46; `src/core/continuity.ts`; `mycontext carry` |
| R8 | A hook on `/clear` | SHIPPED | **no longer BLOCKED** — `hooks/1` done, measured 2026-08-22 |
| R9 | Other hooks worth taking | SHIPPED | `hooks/21` done; 18 events registered — **§6e's PostCompact drop is reversed** |
| R10 | Make the agent use the plugin, always | SHIPPED | `INSTR-use-my-context-…`, pinned; `loop/1` measures 0 of 158 never delivered |
| R11 | More categories | SHIPPED | `plan:categories` 25 of 25 |
| R12 | Deep research into integrations | SHIPPED | §6f stands for items; FTS5 adopted for the ARCHIVE; `markdown-it` vendored |
| R13 | Shareable ruleset templates | SHIPPED | `mycontext pack import`, `init --pack` |

**R4 is the only requirement not delivered.**

---

**2. THE PLANS — 716 tracked tasks, 626 done (87%)** *(queried from the `task`
category, 2026-09-11)*

90 open, 0 blocked, 20 open at priority 1. The per-plan rollup is in the dated
report, drawn to `STD-the-progress-table-has-one-format-and-this-is-it`.

**33 of the 90 close only when the owner looks at a screen** — 31 `plan:walk`
plus `port/98` and `port/99`. The lane-able remainder is 57.

---

**3. THE D TABLE — 25 D numbers carry items; 19 are closed, 6 are open.**

Open: D27 (`library/6`), D28 (`docsys/11`), D30 (`port/99`+`/100`), D32
(`walk/141`), D41 (`store/3`,`/4` — 3 of 5 done), D42 (`recall/2` — 2 of 3 done).
D40 is assigned, has no items, and its precondition is met: D37 closed
2026-09-11 at 54 of 54. D39 stays deferred by owner ruling.

Eighteen further D numbers carry no item and are excluded from that count;
`REF-the-d-numbers-what-each-one-means-and-which-are-only` says not to invent one
to make the table look even, and this report obeys that.

---

**4. DISTANCE TO PRODUCTION — the denominator, and the caveat that matters more
than the number.**

The denominator is an owner ruling:
`DEC-v2-0-is-everything-still-open-and-the-in-out-cut-s-forty-six` — *"put all of
them in v2.0, so nothing remains out."* So v2.0 is every open task, and the
figure is **626 of 716 — 87%**.

**AND THE NUMBER THAT SHOULD BE READ BESIDE IT.** That same ruling recorded 89
open tasks on 2026-09-05. There are 90 today. Six days of closing — D33, D37,
D38, D36, D43 and most of D41 — did not reduce the open count, because filing
kept pace with closing. A percentage over a denominator that grows as fast as its
numerator measures throughput, not distance.

**NO SINGLE "% TO PRODUCTION" FIGURE IS ASSERTED HERE, AND THAT IS DELIBERATE.**
The two instruments this replaces each asserted one — 93%, and before it 96% —
and neither named a denominator anywhere, nor is reproducible from anything. That
is what rule 3 forbids, and it is why this section gives the ratio and the set it
is over rather than a headline.

---

**5. BLOCKED ON A HUMAN — the 2026-08-20 section is discharged in full.** All
three of its rows are closed: `hooks/1` (does `/clear` fire `SessionStart`, and
does `session_id` survive) was measured 2026-08-22; `hooks/2` (which hook a slash
command reaches) and `hooks/16` (the slash commands that depended on it) are
`done`. Nothing in this project is blocked on an interactive terminal today.
What waits on the owner is judgement, not measurement, and the dated report lists
it.

---

**6. DECISION HISTORY — kept verbatim from the 2026-08-20 instance, because it
is history and cannot go stale.**

| Round | Where | What happened |
|---|---|---|
| Initial | §§1-6h | R6-R13 decided from documents |
| Surveys + conflict scan | §§6i-6l | 15 conflicts; 24 surface pairs clean |
| Re-decided | §6m | 12 ruled; **4 reversed** |
| Plans raised 8 more | §6n | 8 ruled; **2 reversed §6m** |
| Owner correction | §6o | `procedure` restored beside `runbook` |
| Mockup reconciliation | 2026-08-20 | spec + 3 UI plans; **33 open questions raised** |
| Owner correction | 2026-08-20 | **2 features restored** that a pass removed instead of asking |
| Owner ruling | 2026-08-22 | **§6e reversed** — `PostCompact` is taken after all, on measured payload evidence |
| Owner ruling | 2026-09-05 | **the docs and tutorials screens become one page**; R2 and R3 are met by it |
| Owner ruling | 2026-09-05 | **the in/out cut's 46 exclusions overturned** — v2.0 is every open task |

**Six reversals in the first round, every one from a claim being checked rather
than believed**, and three more since. The first round's last was the owner
catching a reconciliation pass that had decided four things it had no standing to
decide — two of which it got right, which is what made it dangerous. See
`LESSON-standing-to-decide-is-separate-from-being-right-and-being` and
`LESSON-silence-is-not-disagreement-an-unmentioned-feature-is-a`.

---

**A QUESTION THIS ITEM OWES ITS OWN OWNER, put on 2026-09-11 and unanswered:
should this standard hold an instance at all?** `CLAUDE.md` opens by saying a
copy cannot be superseded — only the original can. An instance embedded in a
pinned item goes stale invisibly, and this is the second time it has been
corrected by hand. `STD-the-progress-table-has-one-format-and-this-is-it` holds
only its format, names no numbers, and has never gone stale. The recommendation
is to keep the rules here and let this item NAME the newest dated report rather
than quote one. That edit is the owner's to make or refuse.
