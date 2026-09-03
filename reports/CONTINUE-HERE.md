# CONTINUE HERE — everything left, in the order to do it

## ⏭ CURRENT STATE — 2026-09-03 15:23Z, written after a session restart

**Everything is committed and pushed. Tree clean at `c050dd5`.** Two commits landed
this session: `a3555c4` (doctor findings 95 → 0, plus the badge that disagreed with the
list) and `c050dd5` (one hook registration, because two made every event fire twice).

**Section 0 below is now STALE:** it says `mycontext status` should report 763 items.
It reports **817**. The `cli_path_mismatch` check in it is still worth running.

### The three things waiting on the owner

1. **8 e2e specs are red, and correctly so.** `doctor-settle` (6) and `doctor-outcome`
   (2) carry an explicit anti-vacuity guard — *"a corpus with nothing to settle would
   pass every assertion below by having nothing to check, which is the shape this
   project has caught itself shipping four times."* Doctor is now at 0 findings, so
   their subject is gone and they fail loudly rather than pass on an empty set. That is
   the guard working. Reproduced at `--workers=1`, so not contention.
   **The fix needs a workspace with one deliberate finding, which is the fixture
   `INSTR-testing-happens-against-the-current-corpus-and-an-exception` says to ask about
   first.** Re-scoping them to assert the clean state is NOT an option: it reintroduces
   exactly the vacuity the guard exists to prevent.
2. **The nonce TTL is a usability defect.** `mycontext ui --nonce` mints a nonce with a
   **30-second** TTL; the URL printed at server start lasts **10 minutes**. The
   no-credential error page tells the reader to run the command that gives them 30
   seconds. This is the whole reason the server repeatedly *looked* dead — measured
   three times on 2026-09-03, twice failing before the next tool call landed. The 30s
   figure was an owner ruling on 2026-08-28; whether a loopback-only server needs it is
   the owner's call.
3. **`state` is stored TWICE on all 518 tasks** — once as a `state:` field, once as a
   `state:` tag. A live duplication at 100% incidence, unrelated to any design work, and
   the same defect shape as the two found and fixed on 2026-09-03.

### A — 9 rows, ALL NINE DONE. Verified against source, not memory

| # | what | state |
|---|---|---|
| A1–A4, A6 | landed before 2026-09-03 | ✅ |
| **A5** | `parity.ts` — `ready` in `CLI_WITHOUT_SLASH` | ✅ removed; both its clauses were false |
| **A7** | `audit_log.actor` — four hardcoded copies of `['human','agent','ingest']` | ✅ derived from `ORIGINS` |
| **A8** | `query_items.type` / `focus_context.categories` carried no description | ✅ both carry one |
| **A9** | `--idle-ms` said 15 minutes, README said 8 hours | ✅ **no discrepancy exists now.** README says "eight idle hours"; the server prints "480 idle minutes". Closed as NO DEFECT FOUND, not as built |

### B — 6 rows, ZERO DONE. All six still owed, each verified absent

| # | what | verified state |
|---|---|---|
| **B10** | Backlink query, `direction: in\|out\|both` | ❌ `direction` appears in `mcp/tools.ts` only in prose, never as a parameter. **Highest value and cheapest** — one `Map` over `store.all()`; `query_items` and `mycontext search` inherit together. START HERE |
| **B11** | `ready` as an MCP tool | ❌ no such tool. Its recorded excuse died when `task` shipped, and A5 is now settled, so it is unblocked |
| **B12** | `doctor` as an MCP tool | ❌ no such tool. No excuse was ever recorded for its absence |
| **B13** | Reverse parity declaration | ❌ no `CLI_WITHOUT_TOOL` or equivalent exists anywhere. Parity is ONE-DIRECTIONAL: `TOOL_PARITY` asserts every tool has a user counterpart, nothing asserts a CLI command has a tool. `doctor`, `ready`, `status`, `decay`, `pack`, `export`, `session` all sit in that unexamined space. **This is the structural finding under all of A and B** |
| **B14** | `create_item` gains `extra` for PROJECT-DEFINED fields | ❌ only `extraFieldSchema(DEFAULT_CONFIG)` exists, which is the pre-existing built-in flattening. ~10 lines |
| **B15** | `{{FLAG_REFERENCE}}` in `cli.md` from `FLAG_DECLARATIONS` | ❌ absent from `src/help/topics/cli.md`. ~40 lines, mirrors `toolReference` |

### C — the merge. DONE

**817 items, zero missing.** 26 of 27 relations written; the 27th was the same edge
twice, caught by the new inverse gate. It needed `add --original-id` and `add --always`,
both built and shipped.

### Gates — 6 of 7, one standing red, one owner-gated

| gate | state |
|---|---|
| `typecheck` · `check:text-files` · `check:retired` · `check:test-glob` · `check:needs-cycles` | green |
| `npm test` | **6051 pass, 0 fail** |
| `verify:citations` | exit 1 — **measured IDENTICALLY red at `HEAD`** in an isolated worktree (21 broken, 36 marker faults, same exit). A standing condition that predates this work; it moved one citation from `moved` to `ok` |
| `test:e2e` | 472 pass, 21 fail. **8 are real** (item 1 above); 13 are one-each across 13 different specs, the contention signature — **unverified, do not attribute without isolating** |

### Progress — 510 active tasks, 406 done (80%)

```
plan           done todo blkd doing  tot    %
walk             86   44    1     0  131   66%   <- 44 of the 100 open tasks
rulings          48   10    0     0   58   83%
hooks            31    3    1     0   35   89%
ui1              25    3    0     0   28   89%
export           25    2    0     0   27   93%
port             21    6    0     0   27   78%
ui3              21    5    0     0   26   81%
repaint          22    3    0     0   25   88%
categories       23    1    0     0   24   96%
ui2              14    5    0     0   19   74%
screens          13    3    0     0   16   81%
execute          12    0    0     0   12  100%
builder           5    5    0     1   11   45%   <- weakest; holds the only `doing`
live              9    2    0     0   11   82%
handover          9    2    0     0   11   82%
budget            7    1    0     0    8   88%
upkeep            8    0    0     0    8  100%
review            4    2    1     0    7   57%
fixes             6    0    0     0    6  100%
api               6    0    0     0    6  100%
pane              4    1    0     0    5   80%
config            4    0    0     0    4  100%
(none)            1    2    0     0    3   33%
probe             2    0    0     0    2  100%
TOTAL           406  100    3     1  510   80%
```

Seven plans are at 100%. The 3 blocked sit in `walk`, `hooks` and `review`.

### The structuring idea — PARKED by the owner, with the research banked

The owner stopped this deliberately: he asked to leave the idea for now, start later by
testing the ingest from files to see what is identified, and only then maybe return to
structuring specs, plans and tasks. Both research answers are already paid for — do not
re-run them.

- **STORAGE IS SETTLED: no graph engine, no JSONB, no schema change.** 817 items and
  **91 relation edges** (0.11 per item), max out-degree 7, longest single-type chain
  **2 hops**. All graph traversal today happens in JavaScript (`apiGraph` builds an
  adjacency `Map`, BFS, radius ≤2, 60-node cap); there is **no edges table**, and
  relations live inside the `data` JSON blob. Every SQLite capability was verified by
  RUNNING it (3.51.2): `jsonb()`, `jsonb_extract`, `json_each`, `json_tree`,
  `WITH RECURSIVE`, generated columns, partial and expression indexes, `WITHOUT ROWID`,
  FTS5 — all present. **JSONB is nevertheless the wrong answer:** at 20,000 items /
  60,000 edges the query "everything that transitively implements spec S" runs in
  0.1 ms on a normalised `edges(source,type,target)` table and 0.016 ms in pure JS, but
  **28–38 ms** on a JSON column, because SQLite can scan for a value inside an array
  but cannot INDEX it. At 91 edges, building anything is YAGNI.
- **NO `spec` CATEGORY IS NEEDED, and the 2026-08-12 ruling already covers this.** That
  ruling rejects `prd`/`brief`/`epic`/`story` as *"Documents, not items — these are the
  ingestion sources"*, and it means: do not make the DOCUMENT an item; DO import its
  content as items of the right categories. The owner's request is therefore CONTINUOUS
  with the record, not a reversal. A spec's assertions become `requirement` /
  `constraint` / `invariant` / `decision` / `standard` / `open_question` / `task`, each
  carrying `source_file` + `source_anchor` back to the document. Traceability runs
  `requirement <- task -> plan`.
- **Adding a category costs 22 hand-typed places.** The last time it was done
  (`e5b12ca`, adding `todo`/`note`/`procedure`) touched **19 files, +594/−64**, and it
  **cannot be staged** — "enumeration sites are mutually pinned by set-equality tests".
- Measured obstacles if the idea is resumed: **98 of 518 `seq` values are not integers**
  (`16b`, `8q`, `18s`, `33c`, `11l`, `8w` — insertion suffixes, so `seq` must stay a
  string with a documented sort); **35% of tasks carry no `source:` anchor**; there are
  **23 `plan` values against ~26 plan files**, so the mapping is not 1:1; and the `plan`
  category exists with **0 items**.

### NEXT: test ingest from a real file — the honest starting state

The owner's chosen next step. Before starting, know this:

- `ingest_document` / `mycontext ingest` **does** stamp real provenance and **can** emit
  several categories from one document.
- **It has never been used.** All **27** `requirement` items are hand-authored; **zero**
  came from ingest.
- **It never links an item back to its source document by a relation** — only by
  `source_file` / `source_anchor`.
- It needs a human or agent to do the extraction; it does not classify by itself.
- One of the owner's own decisions on it is unimplemented:
  `DEC-the-document-extraction-schema-gains-a-summary-field-so`.

### Two traps confirmed on 2026-09-03

- **The audit log doubled every hook event** because `.claude/settings.json`
  self-registered the same 18 events the plugin manifest already registers — the plugin
  is installed as a DIRECTORY source naming this working tree, so both applied. Fixed in
  `c050dd5` and **verified after restart**: `session-start` and `instructions-loaded`
  now write ONE row each where every earlier hook event wrote two. **A `nonce-minted`
  PAIR is not this bug** — `ui-server-upkeep` also POSTs `/api/nonce`, floored to one
  per five minutes. Pairs on EVERY mint would be a bug; an occasional pair is upkeep.
- **`.mcp.json` registers a second, permanently broken MCP server.** Its command
  interpolates `${CLAUDE_PLUGIN_ROOT}`, which is substituted only for entries from a
  plugin registry, so the project-scoped copy dies at startup with `CONNECTION_CLOSED`
  while the plugin's own copy works. **DO NOT DELETE IT** — `plugin.json` declares no
  MCP server, so the plugin discovers this same file. It is cosmetic noise that has
  already caused one false report that the server was down.

---

Written 2026-09-03 at the relocation. **Open this first in the new workspace.**

Companions, holding the evidence behind it:

- `reports/merge/2026-09-03-A-and-B-reconstructed.md` — A, B and C reproduced VERBATIM
  from the session transcript, every block citing its transcript line, seven gaps marked
  rather than smoothed. Go there for original wording or the owner's own words on a ruling.
- `reports/merge/2026-09-03-42-summaries.md` — the 42 hand-written summaries the merge
  needs, plus five evidenced stale lines.
- `reports/V2-HANDOVER.md` — the long-form record: why the relocation happened, the traps,
  the measurements.

**513 active task items live in the corpus and travel with it.** Run `mycontext ready`.
Nothing below duplicates them; this file carries only what lived in conversation, which is
the only kind of work a move can lose.

---

## 0. FIRST, IN THE NEW WORKSPACE

Confirm you are where you think you are. Both must be true:

    mycontext status   ->  763 item(s)        (NOT 44, NOT 761)
    mycontext doctor   ->  no cli_path_mismatch

A `cli_path_mismatch` error means the global `npm link` still points at the old checkout,
and every documented `mycontext …` command is driving a different tree. `npm link` from the
workspace root fixes it.

---

## 1. A — "broken right now", 9 rows. FIVE LANDED, FOUR REMAIN.

Rows 1–4 and 6 landed during the session (the `link_items` enum, 8 regenerated slash
commands, the Hebrew completion, the README counts, `commands/link.md`). What is left:

| # | what | state |
|---|---|---|
| **A5** | `src/plugin/parity.ts:147` — *"a task is not a category this plugin ships"* | **LIVE, and it fell out of the compaction entirely.** `task` shipped as a built-in on 2026-09-02, so the opening clause is FALSE. The rest of its argument may still hold: `gen-commands` builds from a DEFAULT config in which no category declares the `plan`, `seq` and `state` fields, so a generated `/mycontext:ready` would honestly say "this project has no planned work" in any project that has not declared such a category. **Decide, do not blind-fix** — B11's excuse rests on this same sentence. |
| **A7** | `audit_log.actor` — FOUR hardcoded copies of `['human','agent','ingest']`, while `ORIGINS` exists | Derive from `ORIGINS`. This is the project's signature defect: a hand-kept list that must agree with something derived. |
| **A8** | `query_items.type` and `focus_context.categories` carry NO description | Every other filter points at help. A caller cannot learn what to pass without reading source. |
| **A9** | `--idle-ms` says 15 minutes, the README says 8 hours | One is wrong. Measure before choosing which. |

## 2. B — "the capabilities you approved", 6 rows. ALL SIX OWED.

Approved in your words: *"take them all, also ask me and recommend what's on me and also
handle everything you said that needs treatment, show me them before doing"*.

| # | what | why it was ranked where it was |
|---|---|---|
| **B10** | **Backlink query** — `direction: in\|out\|both` | **Highest value, and the cheapest.** "What points AT this item" is unanswerable anywhere an agent or the CLI can reach, yet `relationDegrees` and `apiGraph` both already compute it internally. One `Map` over `store.all()`; `query_items` and `mycontext search` inherit it together. |
| **B11** | `ready` as an MCP tool | Its recorded excuse evaporated when `task` shipped — settle A5 first. |
| **B12** | `doctor` as an MCP tool | No excuse was ever recorded for its absence. |
| **B13** | **Reverse parity declaration** | The structural finding underneath all of A and B: parity is ONE-DIRECTIONAL. `TOOL_PARITY` asserts every tool has a user counterpart; NOTHING asserts a CLI command has a tool. `doctor`, `ready`, `status`, `decay`, `pack`, `export` and `session` all sit in that unexamined space. |
| **B14** | `create_item` gains `extra` for PROJECT-DEFINED fields | ~10 lines, no cache impact. Built-in fields are already flattened by `extraFieldSchema(DEFAULT_CONFIG)`; only project-defined ones are missing. |
| **B15** | `{{FLAG_REFERENCE}}` in `cli.md`, from `FLAG_DECLARATIONS` | ~40 lines, mirroring `toolReference`. Makes CLI syntax findable without a refusal sending the reader to source. |

**Do B13 before or alongside B11/B12** — otherwise you close two gaps by hand and leave the
mechanism that let them open.

## 3. C — still queued from earlier

- **Research parts 3 and 4**, never delivered: the category-by-relation MAPPING, and help
  for every category with worked examples. Parts 1 and 2 shipped as the 29 categories and
  the relation vocabulary.
- **`walk/102`, `walk/105`, `walk/121`, `walk/106`**, plus `pane/5` which needs the owner's
  eyes. All five ARE corpus task items — `mycontext show <id>`.
- **Two decided-but-unbuilt gates**: two-phase e2e, and workflow fields out of the summary
  basis. NAMED ONCE IN THE TRANSCRIPT AND NEVER DESCRIBED — reconstruct the intent before
  building, or ask.

## 4. The four rulings you made, still unbuilt

Recovered verbatim; full text and the rejected options are in the reconstruction file.

1. **`task.verified_on` WITH its doctor check**, and retire `task.progress` and
   `task.last_change`. Your reason: *"Shipping a field without its consumer repeats that."*
   The check is not optional — it is the whole point.
2. **`--yes` on `mycontext focus`**, so the focus dialog renders Execute instead of Copy.
   Fixes the general case: the approval boundary stays DERIVED rather than listed, and
   packs/port/proc get the same route.
3. **Consumers for ALL THREE dead fields** — `open_question.blocks`,
   `assumption.validate_by`/`validated_on`, `reference.source_file`. **You chose WIDER than
   the recommendation**, which was two; the overdue-assumption doctor check is included.
4. **`rulings/20` widened**: a config writer with DELETE (custom categories only — shipped
   ones are never deletable), DISABLE for shipped ones, `--yes` for Execute,
   backup-before-write, and an item-count warning before a change touching many items.
   *(Settled by conduct rather than a literal "yes" — confirm before building.)*

## 5. Also ruled, also owed

- **The focus tag-picker with counts** — a generated checkbox list showing how many items
  each tag would include, so nobody has to remember tag names.
- **The hover-help pass** — `TASK-no-screen-has-hover-or-click-help-and-most-buttons-carry`.
  Measured: ~35 buttons, ~6 with any hover text.
- **All 19 relation types.** The six orphans (`produced`, `discovered_by`, `unblocks`,
  `enforces`, `enforced_by`, `answers`) are live on the nested items and are NOT rot.
  **The framing has not yet been put to you and it matters:** `enforces`/`enforced_by` and
  `produced`/`discovered_by` are INVERSE PAIRS, and this project already ruled that
  inverses are DERIVED, not stored. The question is about pairs, not one name at a time.
  `superseded_by` is separate: excluding it from `RELATION_TYPES` IS the write gate that
  stops it being forged.

## 6. The merge — 42 of 44 remain, and the blocker is gone

**Ready to run.** What stood in the way has been fixed and proved:

- `add` now takes `--observation kind=text` (repeatable, interleaving correctly with
  `--note`, because `## Observations` is an ORDERED list) and `--valid-from`.
- The `#tag` refusal was **half right and is now narrowed correctly.** A *trailing* tag
  cancels out on disk, but the write boundary hashed the raw string, giving a file whose
  recorded checksum could never match itself — which `doctor` reports as a hand edit. That
  was the real defect, and the message never said it. A mid-text `#word` really is moved
  and stays refused. Deleting the guard would have corrupted files.

**The order:**

1. Migrate the 42 from `.my_context.nested-44/` through `mycontext add` — never by copying
   files. Summaries are already written. Carry id, type, title, severity, `always`, scope,
   tags, `valid_from`, body and observations verbatim.
2. Create relations only when BOTH ends exist. All 27 edges point within the 44, so nothing
   dangles once the set is in. 12 are writable today; 7 are the retirement pair that only
   `mycontext supersede` writes; 8 use the six orphan names and depend on §5.
3. **Then** supersede `DEC-focus-discloses-and-allows` by
   `DEC-a-focus-may-not-hide-a-pinned-item`. It could not be done earlier: `supersedeItem`
   calls `requireWritableItem` on the target, so both must be in ONE corpus first.
4. Rule on the five evidenced stale lines in the summaries report. The items migrate
   verbatim regardless; the rulings come after.
5. `INV-hooks-fail-open` is already migrated and carries a stale `[exception]` line — it
   says the `.my_context/` write-deny is "the single deliberate exception" when
   `denyReason` now has four arms and a documented Bash hole. Same shape of ruling.

## 7. Housekeeping the relocation created

- **`scripts/check-needs-cycles.ts` can NOW be wired** as `npm run check:*`. It was unwired
  only because npm sets cwd to the package directory, which under the old layout was the
  WRONG corpus. Package directory and corpus root are now the same path.
- **Two standards are cited from source but no longer exist in the corpus** —
  `STD-guarantee-claims-carry-their-condition-in-the-same-sentence` and
  `STD-error-message-conventions`, cited at `src/mcp/provenance.ts:38`,
  `src/core/context-occupancy.ts:202` and `src/cli/commands/ack.ts:29`. Their content
  survives in `docs/ROADMAP.md:200`. **Re-capture them**, or the citations point at nothing.
- **`test_mycontext_plugin/` still holds a stale 761-item corpus copy.** Any session started
  there silently gets it. Delete that directory once this workspace has been worked in —
  deliberately, not by accident. Restore points are tagged on both remotes as
  `pre-merge-nested-corpus-20260902`.
- **An `npm install` of this package cannot run.** Node refuses type-stripping under
  `node_modules`, and no flag lifts it, so shipping `.ts` as the artifact breaks that path
  entirely. The Claude Code plugin install is a clone, not a dependency, which is why it
  works and why this went unnoticed. Either publish a build, or say plainly that this
  installs as a plugin and not as a package.

---

## What was lost, and why, so it does not happen again

The A and B tables were compressed by a **mid-session context compaction** — not by any file
operation, and not by the move. The summary kept A's remainder and all of B, and that
remnant is what reached the handover. **A5 fell out entirely and was live the whole time.**

The transcript held everything, and it is filed under the OLD project path:

    ~/.claude/projects/D--Users-UserC-source-repos-test-mycontext-plugin/
        9e5b6b17-c186-4c93-a0a5-775b4eccd9e7.jsonl

That path does not follow the workspace. **This is why work gets written to files.**
