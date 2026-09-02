# CONTINUE HERE — everything left, in the order to do it

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
