---
id: STD-v2-0-progress-report-and-the-format-progress-reports-use
type: standard
title: v2.0 progress report, and the format progress reports use
status: active
severity: soft
always: true
summary: The rules that keep a progress report honest, holding no figures of its own so that nothing in it can quietly go out of date; the current numbers live in a dated report it names.
summary_of: 21e8c119ec015f9b
summary_was:
  - 2026-09-11 The rules that keep a progress report honest, and a headline of where version 2.0 actually stands, pointing at the dated report that carries the detail.
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
checksum: d31187657b963cf6
---

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

**DECISION HISTORY is the one thing kept here rather than moved, because it is history and cannot
go stale — there is no number in it that a later day can falsify.** Kept verbatim from the
2026-08-20 instance.

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

**Six reversals in the first round, every one from a claim being checked rather than believed**, and
three more since. The first round's last was the owner catching a reconciliation pass that had
decided four things it had no standing to decide — two of which it got right, which is what made it
dangerous. See `LESSON-standing-to-decide-is-separate-from-being-right-and-being` and
`LESSON-silence-is-not-disagreement-an-unmentioned-feature-is-a`.
