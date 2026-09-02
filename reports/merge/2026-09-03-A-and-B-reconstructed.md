# A and B, reconstructed verbatim from the transcript

Reconstructed on 2026-09-03 from the session transcript
`C:/Users/UserC/.claude/projects/D--Users-UserC-source-repos-test_mycontext_plugin/9e5b6b17-c186-4c93-a0a5-775b4eccd9e7.jsonl`
(245,046,855 bytes, 71,186 lines of JSONL at the time of reading), because the A and B
tables were lost to a mid-session context compaction, not to any file operation — the
compaction summary at **line 70241** kept only the *remainder* of A (3 of its 9 rows) and
all of B, and that remnant is what was written into `reports/V2-HANDOVER.md`. The tables
themselves are at **line 69240**; the audit that produced them arrived at **line 69214**
and the assistant's first reading of it is at **line 69224**; the owner's approval is at
**line 69228**; the four decisions put to the owner are the `AskUserQuestion` at **line
69241** and their answers at **line 69242**. Post-A/B work comes from lines **69261,
69354, 69361, 69385, 69644, 69685, 69719, 69873, 69895, 69943, 69968, 70206, 70348,
70466, 71117**. Every block below carries the transcript line it came from. Rows are
reproduced with the original column structure and wording, including the original
back-tick and bold markup; nothing has been reworded, merged, renumbered or filled in.

**Row counts: A had 9 rows. B had 6 rows (numbered 10–15, continuing A's numbering).
This file reproduces 9 A rows and 6 B rows.**

---

## 1. The A table — verbatim (transcript line 69240)

The message opened: *"Here's everything outstanding, before I touch any of it."*
Its heading and columns, exactly as written:

### A — Broken right now (I'd fix without asking)

| # | what | why |
|---|---|---|
| 1 | `link_items.relation` gets `enum: RELATION_TYPES`; delete the hand-typed `workflow.md` table | the 4 new relations are readable nowhere |
| 2 | Regenerate 8 missing slash commands (`add-`/`list-` × 4) | `gen:commands` never ran |
| 3 | Hebrew: 4 categories missing from `he.ts` + `categories.he.md` | `categories-he.test.ts` failing by design |
| 4 | 6 README counts + 3 Hebrew mirrors (24/25 → 29) | `counts.test.ts` tripwire says "add it" |
| 5 | `parity.ts:147` — *"a task is not a category this plugin ships"* | false since this morning |
| 6 | `commands/link.md` stale 8-item picker | generated artefact, not regenerated |
| 7 | `audit_log.actor` — 4 hardcoded copies of `['human','agent','ingest']` | `ORIGINS` exists |
| 8 | `query_items.type` / `focus_context.categories` have no description | every other filter points at help |
| 9 | `--idle-ms` says 15 minutes, README says 8 hours | one is wrong |

The table carried **three columns only — `#`, `what`, `why`**. There was no effort
column, no status column and no id column. **Nothing has been added.**

### What later became of the A rows (status is *not* from the table; sources cited)

The table itself carried no status. These are the only status statements the transcript
makes about individual A rows:

| # | later status in the transcript | line |
|---|---|---|
| 1 | reported *not* landed by the vocabulary lane ("The enum did not land… That's exactly item **A1** in the plan you approved"), then done: "**A1 committed** (`5c3f293`)" | 69361, 69644 |
| 2 | "**All 8 slash commands generated** — `add-`/`list-` for measurement, plan, exception, contract" | 69261 |
| 3 | "**Hebrew is complete** — 29 keys in `he.ts`, 29 sections in both topic files. That one passed." | 69361 |
| 4 | lane reported count sites updated: "README.md, docs/README.he.md, TUTORIAL.md, TUTORIAL-ADVANCED.md, SKILL.md, both topic sources, plus `CATEGORY_WORDS` in counts.test.ts" | 69354 |
| 5 | **GAP — no transcript line states that row 5 was fixed or that it was still open.** `parity.ts` appears in only three lines in the whole file (69214, 69224, 69240), all before any work started. Treat A5 as **unverified**. | — |
| 6 | "`commands/link.md` regenerated" / "`link.md` now numbers 12" | 69261, 69354 |
| 7, 8, 9 | still open at the compaction and after it: "**Rest of A:** `audit_log.actor`'s 4 hardcoded copies vs `ORIGINS`; `query_items.type` and `focus_context.categories` missing descriptions; `--idle-ms` 15-min vs 8-hour contradiction" | 70241, 70206, 71117 |

This is the discrepancy the owner noticed: rows 1–4 and 6 had landed, so the handover
list only ever carried rows 7, 8 and 9 of A.

---

## 2. The B table — verbatim (transcript line 69240)

### B — The capabilities you approved

| # | what | note |
|---|---|---|
| 10 | **Backlink query** — `direction: in\|out\|both`, one `Map`, inherited by `query_items` + `search` | the highest-value one |
| 11 | `ready` MCP tool | its recorded excuse evaporated when `task` shipped |
| 12 | `doctor` MCP tool | no excuse was ever recorded |
| 13 | **Reverse parity declaration** — assert every CLI command has a tool, or is excused by name | stops the next gap appearing unnoticed |
| 14 | `create_item` gains `extra` for project-defined fields | ~10 lines, no cache impact |
| 15 | `{{FLAG_REFERENCE}}` in `cli.md` from `FLAG_DECLARATIONS` | makes CLI syntax findable without triggering a refusal |

Three columns — **`#`, `what`, `note`**. Row 14 is the only row that carries anything
resembling an effort estimate ("~10 lines, no cache impact"); row 15's cost appears
separately at line 69224 ("a `{{FLAG_REFERENCE}}` expansion mirroring `toolReference`
would close it in ~40 lines"). No other row carried effort. **No effort column has been
invented for the rest.**

**Approval status of B: approved by the owner** — the heading itself says "The
capabilities you approved", and the owner's message at line 69228 was *"take them all,
also ask me and recommend what's on me and also handle everything you said that needs
treatment, show me them before doing"*. At line 70241 the compaction records: **"B (all
approved)"**.

### The supporting argument for B, in the assistant's own words (line 69224)

Reproduced because it is the only place the *why* for rows 10–13 is stated at length:

> **A backlink query is the most valuable**, and it's the cheapest: *"what points at this
> item"* is unanswerable anywhere an agent or the CLI can reach, yet `relationDegrees` and
> `apiGraph` both compute it internally. One `Map` over `store.all()`, exposed as
> `direction: in|out|both`, and `query_items` plus `mycontext search` inherit it together.
>
> **`ready` and `doctor` as tools** — and `ready`'s recorded excuse has *evaporated*:
> `parity.ts` says *"a task is not a category this plugin ships"*, which was true this morning.
>
> **The structural finding underneath:** parity is **one-directional**. `TOOL_PARITY`
> asserts every tool has a user counterpart; nothing asserts a CLI command has a tool.
> `doctor`, `ready`, `status`, `decay`, `pack`, `export` and `session` all sit in that
> unexamined space.

---

## 3. Section C, printed in the same message (line 69240)

The A/B message did not end at B. It continued, verbatim:

> ## C — Still queued from earlier
>
> Parts 3 and 4 of your research request (the category × relation **mapping**, and the
> **help with examples**) · `walk/102`, `105`, `121`, `106` · the two decided-but-unbuilt
> gates (two-phase e2e, workflow fields out of the summary basis).
>
> Four things are genuinely yours:

**C is prose, not a table** — it carries no per-item why, effort or status. The message
then ended, and the "four things" were put as an `AskUserQuestion` (section 4 below).

*Note: `walk/102`, `walk/105`, `walk/121`, `walk/106` and `pane/5` were later confirmed
to exist as corpus task items (line 71096), so they travel with the corpus and are not
conversation-only work.*

---

## 4. The four decisions put to the owner, and the owner's answers

Asked at **line 69241**; answered at **line 69242**. Each question offered three options
with a Recommended one. Verbatim question text, the option the owner chose, and the
option's own description.

### 4.1 Task fields — **APPROVED as recommended**

> **Question:** "Extra fields on task: add verified_on, and retire progress and last_change?"

**Owner selected: "All three, with the doctor check (Recommended)"** —
*"Add verified_on AND its doctor check together, retire progress and last_change. The
check matters: assumption, open_question.blocks and reference all have fields nothing
reads, and they sit unused. Shipping a field without its consumer repeats that."*

Preview shown with the selection:

```
+ task.verified_on   (YYYY-MM-DD)
+ doctor: done/todo with no verified_on,
  or older than the last body edit

- task.progress      65 of 139 done
                     tasks say "0"
- task.last_change   "all 133 disagree
                     with the audit log"
```

*Rejected options, recorded for completeness: "Retirements only"; "Add verified_on only".*

### 4.2 Focus execute — **APPROVED as recommended**

> **Question:** "The focus dialog composes a command but renders Copy, not Execute —
> because approvalBoundary() derives the boundary from which commands accept --yes, and
> `mycontext focus` accepts none. Three other screens (packs, port, proc) are in the same
> state."

**Owner selected: "Add --yes to mycontext focus (Recommended)"** —
*"Give the CLI command a --yes flag, which puts focus on the approval boundary and lets
the shared control render Execute. Fixes the general case: any screen composing a focus
command gets Execute, and the boundary stays derived rather than listed."*

```
mycontext focus --tag v2 --yes

=> focus joins denyRequired
=> commandActions renders Execute
=> packs/port/proc unaffected,
   but the same route opens to them
```

*Rejected: "Leave Copy-only"; "An OFF_BOUNDARY exemption".*

### 4.3 Dead fields — **APPROVED, but NOT the recommended option**

> **Question:** "The audit found three fields that authors fill but nothing reads. Build
> consumers, or retire them?"

The Recommended option was *"Consumers for blocks, retire assumption's"*. **The owner
chose the wider option instead: "Consumers for all three"** —
*"Build an overdue-assumption doctor check too, on the argument that the field is unused
because nothing ever surfaced it. Optimistic: it assumes the category is unused for want
of machinery rather than want of need."*

```
blocks     -> consumer
assumption -> overdue check
reference  -> doctor finding

Bets that assumption is unused
because nothing surfaced it.
```

The three fields, named at line 69241 and again at 71117: `open_question.blocks`
(9/14 filled, 64%), `assumption.validate_by` / `assumption.validated_on` (0 readers, 0
items), `reference.source_file` (3 of 4 with none).

### 4.4 Sequencing — **NOT ANSWERED as a choice; the owner gave an instruction instead**

> **Question:** "Sequencing: A (9 broken things) and B (6 capabilities) are a lot of
> change at once, on top of the vocabulary lane still running."

The tool result records: **"(no option selected) notes: 1 but let me first restart for
the MCP server."** — i.e. the owner indicated option 1, *"A first, gate, then B
(Recommended)"*, but with a restart first. The assistant read it back at line 69245 as
*"Understood — restart first, then A, gate, then B"* and at line 69261 as *"**Then
restart, and we do A → gate → B in that order.**"*

> Option 1's own text: *"Land the correctness fixes and the regenerations first, get all
> seven gates green, commit. Then the capabilities as a second change. Two clean commits,
> and a failure in one is not tangled with the other — which matters because two tripwire
> tests are already failing."*

**This question is also the transcript's own confirmation of the row counts: "A (9 broken
things) and B (6 capabilities)."**

---

## 5. Work presented AFTER A and B

### 5.1 The standing queue, as the assistant re-stated it (line 69943, restated 69968)

Reproduced verbatim from line 69943 — a **numbered list, not a table**, prefaced
*"Nothing there needs a decision from you — it's all ruled."*

> ## Standing queue
>
> **Running:** the `.` readability fix — I'll show you both states on both surfaces when it lands.
>
> **Then, in your order:**
> 1. The rest of **A** — `audit_log.actor`'s four hardcoded copies, `query_items.type` and `focus_context.categories` missing descriptions, the `--idle-ms` 15-minutes-vs-8-hours contradiction
> 2. Gates
> 3. **B** — backlink query, `ready` and `doctor` as tools, reverse parity, `create_item` extra, `FLAG_REFERENCE`
> 4. Your four rulings — `verified_on` with its doctor check, the two retirements, `--yes` on focus, consumers for the three dead fields
> 5. `rulings/20` expanded with delete/disable/`--yes`/backup
> 6. The focus tag-picker with counts, and now this hover-help pass

The same queue appears at line 69873 in prose and at line 69968 as a four-item list.
All three agree; item 6 gains the hover-help pass only after it was filed (line 69943).

### 5.2 `rulings/20` — the config writer. **PROPOSED at 69685, expanded and APPROVED at 69702/69719**

Existing filed item: **`plan:rulings seq:20`** — *"the ui slash command and the CLI
command behind it, which write config.json"* — `state: todo` (line 69685).

The gap it must close, as measured at line 69685:

| operation | how |
|---|---|
| add a category | hand-edit `config.json` |
| edit its properties or extra fields | hand-edit `config.json` |
| **delete a category** | hand-edit `config.json` — no capability anywhere |
| **undo** | git. Nothing in the product |

The delete semantics, measured at line 69719:

| category | "delete" means | today |
|---|---|---|
| **custom** (config-only) | remove the block — the category ceases to exist | hand-edit |
| **shipped** (in the catalogue) | impossible — the right operation is **disable** | not offered |

**Owner's own words (line 69702), a ruling:** *"yes, would it include also execute ?
would delete an internal category be protected ? because only custom categories are
allowed to be deleted not the product internal categories"*

The assistant's closing proposal at line 69719, which the queue at 69873/69943/69968
thereafter treats as settled: *"Shall I expand `rulings/20` with all of this — delete for
custom only, disable for shipped, `--yes` so Execute works, the backup-before-write, and
the item-count warning — and queue it behind the three running lanes?"*

Its five parts, as later written into the handover at line 71117:

> a config writer with DELETE (custom categories only — shipped ones are never deletable),
> DISABLE for shipped ones, `--yes` for Execute, backup-before-write, and an item-count
> warning before a change that touches many items.

Two arguments the transcript records and that the item must answer:

- Against a bespoke undo (line 69685): *"Config is a single JSON file in git… A 'config
  undo' would be a second history competing with the one you already have. The honest
  version is: **write a backup beside the file before each change and name it in the
  confirm**."*
- The `enabled` toggle is deliberately absent, with a stated reason at `config.js:171`
  (line 69719): *"a per-category `enabled` toggle beside a profile picker gives two
  controls for one outcome with no rule on screen for which wins."* — *"the delete work
  has to answer it rather than ignore it."*

### 5.3 The focus tag-picker with counts. **REQUESTED by the owner (line 69316)**

Owner's own words: *"nice now because you did it very nice and showed me what are my
options and how many items it will include, i would like to have such a generated check
box list with the item counts in the dialog so user could select there and not have to
remember them, only question is are these tags final or there may be more ?"*

Assistant's measurement (line 69333): *"Nothing serves tag counts today — `ItemSummary`
doesn't even carry `tags`. So this is a real feature."* At line 69341: `select.ts:456`
uses `.some()`, so **multiple tags are OR**.

### 5.4 The hover-help pass. **REQUESTED by the owner (line 69877), filed as a task**

Owner's own words: *"i want you to add a task for adding simple short help upon hovering,
imediate candidates are buttons but not limmited too, find all the places and controls
that deserves adding it, maybe also on every screen some help when clicking or hovering
over some quesion mark icon ?"*

The measurement table (line 69895), verbatim:

| screen | buttons | with hover help |
|---|---|---|
| config | 9 | **0** |
| simulate | 6 | **0** |
| graph | 4 | **0** |
| ask | 2 | **0** |
| preview | 6 | 4 |
| *(19 more)* | ~8 | ~6 |

*"**No question-mark or help affordance exists anywhere.**"*

Filed and pushed as `2d662a0`, tagged `plan:walk`, as
`TASK-no-screen-has-hover-or-click-help-and-most-buttons-carry` (line 69943, id from
line 71117). The lane corrected the assistant's own figure: *"found that my 10/35
overstated coverage because most of those titles aren't on buttons at all"*; the handover
records the final measurement as *"~35 buttons, ~6 with any hover text."*

### 5.5 The six orphan relation types. **OWNER RULED "all 19"; the framing is still open**

Owner's own words (line 70108): *"i want all of them in the app all the 19, they are
correct and important"*.

The six, named at line 70241 and 70206: `produced`, `discovered_by`, `unblocks`,
`enforces`, `enforced_by`, `answers` → 18 writable + `superseded_by` system-written = 19
visible.

**Explicitly marked UNRESOLVED in the transcript** (line 70241, restated 70206 and 71117):
*"whether writable inverse pairs are wanted — `enforces`/`enforced_by` and
`produced`/`discovered_by` raise the same one-sided-edge concern as `superseded_by`, and
the project already ruled inverses should be derived not stored."* Line 70206 adds: *"The
better framing, not yet put to the owner… Ask about pairs, not about one name."*
**This one has an owner ruling on the goal and an open question on the shape.**

### 5.6 The nested 44-item corpus, the merge, and the relocation

Owner's own words (line 70149): *"i do not want to loos the 44 items… we already push to
git repo of mycontext and not to the test repo so it makes it reasonable to maybe move to
the mycontext workspace itself from test_mycontext_plugin… about merging the 44, we
should check if some are not always in our corpus and if they not contradict so we'll
need to settle them and also not a file copy but create new files in our corpus and get
the contents from the nested corpus because we have changed and added many fields and
other changes in our item file structure"*

Then (line 70214): *"rerun the analysis of the 44 items, and we'll continue from there,
accepting your recommendation to copy and need you to conduct the whole process safe"*

**Order corrected by the analysis (line 70348) — relocate first, then merge:** *"24 of
the 44 carry scope globs, and every one points at `src/`, `test/`, `package.json`,
`.github/`, `README.md`… Merge before relocating and those 24 items land in the corpus,
match nothing, govern nothing, and never surface."*

Three contradictions were put to the owner (line 70348) and three replacement texts
drafted (line 70466, committed to `reports/merge/2026-09-03-three-amendments.md`):

| id | item | the clash |
|---|---|---|
| C1 | what a focus may not hide | nested requirement says focus never hides `severity: hard` and discloses the count; the root decision of 2026-08-27 rejects that remedy by name: "Not chosen: disclosing what a focus hides instead of exempting" |
| C2 | `NOGOAL-not-a-claude-mem-replacement` (hard, `always: true`) | "Do not build session history, activity capture, or semantic search over past work; that is claude-mem's job" — but a continuity tier and an injection audit log have since been built |
| C3 | `CONST-zero-runtime-dependencies` (hard, `always: true`) | "Only `typescript` and `@types/node` are permitted" — `package.json` has three devDependencies, Playwright being the third |

*(This is a table the transcript states in prose at line 70348, not as markdown. The
three-column shape above is this file's rendering of that prose and is marked as such —
the original had no table here.)*

**Owner's approval, verbatim (line 70470):** *"approved, amend the three and supersede the
one, then relocate"*

The fourth item and its follow-ups (line 70466), all now owner-approved by that message:

- `DEC-focus-discloses-and-allows` is **superseded**, not amended, by
  `DEC-a-focus-may-not-hide-a-pinned-item` — *"which keeps body and edges intact while
  stamping `superseded_by`. That's your own `STD-answered-questions-are-superseded`
  pattern."*
- **`scripts/seed-dogfood.ts:53` re-emits the stale C3 sentence verbatim** — *"Amend the
  item without fixing the seed and the old text comes back into any freshly seeded
  corpus — the hand-kept-list defect again, in a new place."*
- C1's exemption set is **three, not two**: `focusHides` in `select.ts` has three early
  returns — `hard`, `always`, and `continuity`.

Later owner instructions in the same lane, each verbatim and each an approval:

| line | owner's words |
|---|---|
| 70361 | "write the three replacement texts" |
| 70642 | "fix the 5 broken citations" |
| 70803 | "1, add the files field and commit everything" |
| 70873 | "fix add first then migrate the remaining 42" |
| 70895 | "migrate them verbatim and collect the stale lines" |
| 70916 | "show me the summaries when they land" |
| 71024 | "redo the four retired ones in present tense" |

### 5.7 The state of the merge as last recorded (line 71117)

Verbatim from the handover block the assistant wrote:

> 17. **42 of the 44 remain.** Summaries for all 42 are WRITTEN and owner-reviewed in
>     `reports/merge/2026-09-03-42-summaries.md`; the four retired items were redone in
>     the present tense on the owner's ruling, so `status` carries the retirement rather
>     than the prose.
> 18. **`add` now carries observation kinds and `valid_from`**, which was the blocker —
>     the migration can proceed through the real write path.
> 19. **Five evidenced stale lines** in that same report, migrating verbatim, awaiting the
>     owner's ruling afterwards.
> 20. **`DEC-focus-discloses-and-allows` must be SUPERSEDED** by
>     `DEC-a-focus-may-not-hide-a-pinned-item` once both are in one corpus.
> 21. **The six orphan relation types remain undecided** […]

### 5.8 Two housekeeping items the relocation created (line 71117)

> 22. `scripts/check-needs-cycles.ts` can NOW be wired as `npm run check:*`.
> 23. `test_mycontext_plugin/` still holds a STALE 761-item corpus copy. Any session
>     started there silently gets it. Delete it once the new home has been worked in —
>     deliberately, not by accident.

Background for 22, from line 70206: *"`scripts/check-needs-cycles.ts` is deliberately NOT
wired as an `npm run check:*` because npm sets cwd to the package directory — the wrong
corpus. A real gate is unwired because of this."*

### 5.9 Research parts 3 and 4 — still owed (C, restated at 71117)

> 16. **Research parts 3 and 4**, never delivered: the category-by-relation mapping, and
>     help for every category with worked examples. Parts 1 and 2 (find the missing
>     categories and relations) shipped as the 29 categories and the relation vocabulary.

The owner's original request (line 70241's record of it): *"i want that you would map the
categories (current and the new you will find) to possible relations cases, the last thing
would be to add help about every category with it's relations and explanation how and when
to use and simple examples that demonstrate each."*

### 5.10 The two decided-but-unbuilt gates (C, line 69240)

Named once, in C, and not elaborated anywhere afterwards: **two-phase e2e**, and
**workflow fields out of the summary basis**. **GAP — the transcript carries no further
detail on either after line 69240.**

---

## 6. Approved vs. proposed — the ledger

| item | status in the transcript |
|---|---|
| A rows 1–9 | **APPROVED.** The heading says "I'd fix without asking"; the owner said "take them all… and also handle everything you said that needs treatment" (69228) |
| B rows 10–15 | **APPROVED.** Heading: "The capabilities you approved"; compaction records "B (all approved)" (70241) |
| C — research parts 3 & 4, `walk/102·105·121·106`, two gates | **Carried over from earlier approvals**, restated as queued; not re-approved in this exchange |
| `task.verified_on` **with its doctor check**; retire `task.progress` and `task.last_change` | **APPROVED**, recommended option (69242) |
| `--yes` on `mycontext focus` | **APPROVED**, recommended option (69242) |
| Consumers for all three dead fields | **APPROVED**, and the owner chose the *wider* non-recommended option (69242) |
| Sequencing A → gate → B | **INSTRUCTED, not selected** — "1 but let me first restart for the MCP server" (69242) |
| `rulings/20` widened (delete custom-only / disable shipped / `--yes` / backup / item-count warning) | **RULED by the owner** at 69702 in his own words; the assistant's closing question at 69719 was never answered with a literal "yes", but every subsequent queue (69873, 69943, 69968, 70206, 71117) treats it as settled. **Marked: settled by conduct, not by an explicit word.** |
| Focus tag-picker with counts | **REQUESTED by the owner** (69316) |
| Hover-help pass | **REQUESTED by the owner** (69877); filed as a corpus task |
| All 19 relation types | **RULED** — "i want all of them in the app all the 19" (70108) |
| Inverse-pair framing for the six orphans | **PROPOSED only, explicitly never put to the owner** (70206) |
| Relocate first, then merge | **APPROVED** — "accepting your recommendation to copy and need you to conduct the whole process safe" (70214); "approved… then relocate" (70470) |
| C1/C2/C3 amendments + the `DEC-focus-discloses-and-allows` supersede | **APPROVED** — "approved, amend the three and supersede the one, then relocate" (70470) |
| Five evidenced stale lines | **PROPOSED** — migrating verbatim, "awaiting the owner's ruling afterwards" (71117) |
| Deleting the stale `test_mycontext_plugin/` copy | **PROPOSED**, conditioned: "once the new home has been worked in — deliberately, not by accident" (71117) |
| Wiring `check-needs-cycles.ts` as a `check:*` script | **PROPOSED** (71117) |

---

## 7. Anchor coverage

Every anchor named in the recovery brief, and where it lands in this file:

| anchor | where |
|---|---|
| `audit_log.actor` | A row 7 |
| `FLAG_REFERENCE` | B row 15 |
| `backlink` | B row 10 |
| `reverse parity` | B row 13 |
| `idle-ms` | A row 9 |
| `query_items.type` | A row 8 |
| `focus_context.categories` | A row 8 |
| `verified_on` | §4.1, the first ruling |
| `rulings/20` | §5.2 |
| the owner's message | line 69228, quoted in the note above and in §6 |

---

## 8. Gaps, ambiguities and things not found — stated, not smoothed

1. **A5 (`parity.ts:147`) has no recorded outcome.** `parity.ts` occurs in only three
   transcript lines, all before any A work began. Whether the stale comment *"a task is
   not a category this plugin ships"* was fixed is **unknown**. It is absent from every
   later remainder list, which could mean fixed or could mean dropped — the transcript
   does not say.
2. **No revised A or B table exists.** A scan of every assistant message from line 69200
   to the end of the file for markdown table markup found tables at 69208, 69240, 69312,
   69385, 69685, 69719, 69769, 69873, 69895, 70061, 70406 and 70799 — none of them is a
   second version of A or B. **Line 69240 is the only, and therefore the latest, version.**
   The lists at 70206, 70241 and 71117 are *remainder* lists derived from it, not
   revisions of it.
3. **The tables carried no effort and no status columns.** Only B14 ("~10 lines, no cache
   impact") carried a cost, and B15's ~40 lines comes from a different message (69224).
   No effort figure has been supplied for any other row.
4. **C's "two decided-but-unbuilt gates"** — *two-phase e2e* and *workflow fields out of
   the summary basis* — are named once (69240) and never described again. Their content is
   **not recoverable from this transcript.**
5. **The `rulings/20` expansion has no literal owner "yes".** The owner ruled on the
   substance at 69702; the assistant's "Shall I expand…?" at 69719 draws no direct answer
   in the transcript (the next owner message, at 69845, is about the status-line alarm).
   It is treated as approved by every later list. Flagged rather than asserted.
6. **§5.6's three-column C1/C2/C3 table is this file's rendering**, not the original's —
   the transcript states those three in prose at line 70348. The wording inside the cells
   is verbatim; the table shape is not.
7. **The four "retired" items of the 42** are referred to at 71024 and 71117 but are not
   named individually anywhere reachable from these anchors. Their ids are in
   `reports/merge/2026-09-03-42-summaries.md`, not here.
8. **This file covers the conversation-only work.** As line 71117 states, *"513 active
   task items are in the corpus and travel with it — they are not listed here and do not
   need to be."* `walk/102`, `walk/105`, `walk/121`, `walk/106` and `pane/5` were each
   confirmed present as corpus tasks (71096).
