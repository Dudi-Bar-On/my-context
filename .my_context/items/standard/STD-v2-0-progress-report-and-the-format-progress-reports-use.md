---
id: STD-v2-0-progress-report-and-the-format-progress-reports-use
type: standard
title: v2.0 progress report, and the format progress reports use
status: active
severity: soft
always: true
summary: "Where each promised capability stands, and the rules that keep such a report honest: a short fixed vocabulary, and every row saying where it lives."
summary_of: c6ca7ef76b3c3dd6
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
checksum: de8962574c313ac9
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

**1. REQUIREMENTS — R1 to R13**

| Req | What it asked | Status | Where |
|---|---|---|---|
| R1 | Markdown viewer for referenced files | PLANNED | mockup `docs`; ui1 |
| R2 | README + docs viewer, EN/HE | PLANNED | mockup `docs` — **in no plan** |
| R3 | Tutorials viewable EN/HE | PLANNED | mockup `tut` — **in no plan** |
| R4 | Integrated help where the user must act | PLANNED | mockup `details.help` blocks |
| R5 | Transparent gloss on shaded cards | SHIPPED | mockup `.gloss` |
| R6 | Export/import the whole registry | PLANNED | export plan, 17 tasks |
| R7 | Multi-session | DECIDED + PLANNED | §3, §6c; hooks 13-19 |
| R8 | A hook on `/clear` | BLOCKED | hooks T1 — needs an interactive `/clear` |
| R9 | Other hooks worth taking | DECIDED | `PostToolUseFailure` taken; `PostCompact` dropped (§6e) |
| R10 | Make the agent use the plugin, always | SHIPPED | `INSTR-use-my-context-…`, pinned |
| R11 | More categories | DECIDED | §6o — `todo`, `note`, `procedure`; `runbook` unchanged |
| R12 | Deep research into integrations | SHIPPED | §6f — 23 rejections, 1 adoption, later withdrawn |
| R13 | Shareable ruleset templates | PLANNED | export T14-T16 |

---

**2. THE SIX PLANS — 96 tasks, 0 executed** *(queried from the `task` category)*

| Plan | Tasks | State | Covers |
|---|---|---|---|
| ui1 — server and reads | 20 | 20 todo | the read surface, 10 of 21 screens |
| ui2 — palette and work | 14 | 14 todo | composer, review queue, capture, configure |
| ui3 — watch and ask | 13 | 13 todo | audit stream, Ask, statusline bridge |
| categories and procedures | 12 | 12 todo | R11 |
| export, import, packs | 17 | 17 todo | R6, R13 |
| hooks, sessions, continuity | 20 | 17 todo, **3 blocked** | R7, R8, R9 |
| **Total** | **96** | **93 todo, 3 blocked, 0 done** | |

**Priority is dependency depth, not importance.** 1 is done first because things
wait on it.

| P | Band | Count |
|---|---|---|
| 1 | foundation | 10 |
| 2 | builds on 1 | 35 |
| 3 | builds on 2 | 48 |
| 4 | blocked | 3 |

All six plans are reconciled: the three v2 plans against §6n and §6o, the three
UI plans and the web-UI spec against the rebuilt mockup.

---

**3. UNOWNED — the mockup specifies it and no plan builds it**

**This is the real gap and it has no priority band, because these are not tasks
yet.** Inventing task items would make the roadmap look complete.

| Surface | Kind |
|---|---|
| `proc` — Procedures | screen |
| `port` — Export / import | screen |
| `packs` — Template packs | screen |
| `docs` — Documentation | screen (R2) |
| `tut` — Tutorials | screen (R3) |
| item detail pane | cross-cutting, opens on every screen |
| provenance bar | cross-cutting |
| `∅` zero-data view | cross-cutting |

The capability plans build `procedure` and packs in the CLI and hand the screens
back to "the web-UI plan"; the UI plans predate those screens and their scope
split is exhaustive. **Nobody takes them.**

---

**4. VIEWS WITH NO PRODUCER — surveyed, not assumed**

Of the 18 restored graphical views: 2 served, 4 need one added field, 4 cannot
be served at all.

| View | Gap |
|---|---|
| Spill-ratio bar | needs an audit-projection read |
| 90-day heatstrip | same read, per-item per-day |
| Item-pane sparkline | same read, weekly |
| Activity pulse | counts by kind in 10s buckets |
| Word-level revision diff | `lineDiff` is line-level; nothing does words |
| Gate ladder | **largest, on the flagship screen** — `injection()` returns prose |

**Three of these want the same missing endpoint.** One piece of work unblocks
three views.

---

**5. SHIPPED IN v2.0 — 40 commits since `v1.0.2`**

| What | Why it mattered |
|---|---|
| Search covers observations and `extra` | the defect FTS5 was wrongly adopted to solve |
| Unparseable hook payload discloses | it injected plausibly while dropping `source`/`session_id` |
| ExperimentalWarning silenced | every hook call polluted stderr; 11 tests were red |
| `add --extra` | fields at creation, one command, one parser shared with `edit` |
| Per-category field ownership | `directive` on a `risk` is refused; custom categories declare their own |
| Text-file checker | a NUL byte made whole test files unreviewable — three times |
| 18 graphical views restored | a rebuild kept the screens and lost the charts |
| Mockup JS actually runs | a literal `</script>` in a string had killed it entirely |

**Suite: 2,375 tests, 2,374 pass, 0 fail, 1 skipped.** It was red on 11 when
this work began.

---

**6. CORPUS — 98 items**

| Category | Count |
|---|---|
| task | 98 (96 tracked + 2 retired probes) |
| rule | 7 |
| known_issue | 5 |
| constraint | 5 |
| decision | 4 |
| lesson | 3 |
| instruction | 2 |
| reference | 2 |
| standard | 1 |
| requirement | 1 |

Pinned tier ~7,400 of 16,000 estimated tokens. **No task item is ever injected**
— verified at 96 items, which is what the rationale tier is for.

---

**7. OPEN DEFECTS — filed**

| Issue | State |
|---|---|
| Windows drive-letter containment bypass | open |
| `edit --body` re-stamps `source_checksum` | open |
| Unparseable hook payload | **fixed**, item pending a status update |
| ExperimentalWarning on every hook | **fixed**, item pending a status update |

---

**8. BLOCKED ON A HUMAN**

| What | Task |
|---|---|
| Does `/clear` fire `SessionStart`, and does `session_id` survive? | hooks T1 |
| Which hook does a slash command reach? | hooks T2 |
| The slash commands that depend on T2 | hooks T16 |

---

**9. DECISION HISTORY**

| Round | Where | What happened |
|---|---|---|
| Initial | §§1-6h | R6-R13 decided from documents |
| Surveys + conflict scan | §§6i-6l | 15 conflicts; 24 surface pairs clean |
| Re-decided | §6m | 12 ruled; **4 reversed** |
| Plans raised 8 more | §6n | 8 ruled; **2 reversed §6m** |
| Owner correction | §6o | `procedure` restored beside `runbook` |
| Mockup reconciliation | 2026-08-20 | spec + 3 UI plans; **33 open questions raised** |
| Owner correction | 2026-08-20 | **2 features restored** that a pass removed instead of asking |

**Six reversals, every one from a claim being checked rather than believed.** The
last was the owner catching a reconciliation pass that had decided four things it
had no standing to decide — two of which it got right, which is what made it
dangerous. See `LESSON-standing-to-decide-is-separate-from-being-right-and-being`
and `LESSON-silence-is-not-disagreement-an-unmentioned-feature-is-a`.
