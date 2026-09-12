---
id: TASK-the-store-loads-refuses-what-it-cannot-parse-and-proves-it
type: task
title: the store loads, refuses what it cannot parse, and proves it has not been tampered with
status: active
severity: soft
always: false
summary: The product ships its own set of rules, and refuses to run against a set that has been changed or is missing pieces.
summary_of: 949ad2f0abf98901
acknowledged:
  - task_unverified@9d78ee8b7fcab41c
scope:
  - src/rules/**
  - src/cli/commands/rules.ts
  - test/rules/**
tags:
  - v2
  - store
  - "plan:store"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: d332922bdde4877e
plan: store
seq: "1"
state: done
priority: "1"
---

# the store loads, refuses what it cannot parse, and proves it has not been tampered with

D41 PHASE 1, BUILT AND MEASURED 2026-09-10/11. Tasks 1-5 of docs/superpowers/plans/2026-09-10-d41-product-rule-store.md. New module `src/rules/` (schema.ts, store.ts, manifest.ts), `src/cli/commands/rules.ts`, `test/rules/{schema,store,isolation,manifest}.test.ts` and `test/cli/rules.test.ts` - 83 assertions, all green. Nothing is delivered or injected; that is Phase 2.

THE TEMPLATE IS ONE TABLE, AND IT IS EXECUTABLE. `TEMPLATE` in schema.ts is the only place a part is named: fact = truth + breaks; prohibition = prohibition + why; procedure = steps (a LIST) + proof; standard = trigger + shape; definition = term + means + confusedWith. Every kind additionally carries `example` and `check`, and `check` parses into preventive:<name>, detective:<name>, or `none - <reason>` with a bare `none` refused. Each part carries a `shape` (text or list) and an `asks` (its label) rather than only a name, so the Phase 3 form derives its fields from the same row the validator reads - a second table with the labels in it would be the drift this store exists to end, arriving in the store itself. The test file derives its assertions from the table too, so a part added tomorrow is required tomorrow with no edit there. The template is a CEILING as well as a floor: a `fact` carrying a `why` is refused by name, and so are the corpus lifecycle fields spec section 7 rules out - status, supersedes, always, valid_until.

THE ISOLATION GUARD WAS PROVED CAPABLE OF FAILING, TWICE, AND THE SECOND PROOF IS THE FINDING. Pointing `cmdList` at the store reddened the behavioural assertion and NOT the import-graph walk, because `list` is implemented in `src/cli/index.ts`, which the walk deliberately excludes (it reaches `src/rules/` legitimately through the command registry). So the structural half was proved separately, by adding an import of `../rules/store.ts` to `src/core/select.ts`. Both reverted, both green again. The first proof looked like a proof of the whole file and was a proof of one assertion in it.

THE INTEGRITY REFUSAL IS NOT THE BUDGET REFUSAL, and the comment saying so is held in place by a test. A planted mismatch refuses writes naming the entry, and STILL READS - `loadRules` never consults the manifest, and the inverse proof (gating reads on integrity) reddens exactly the read-half assertion. `writeManifest` is deliberately NOT gated, or damage would be a dead end. A third damage kind was added beyond the plan's two: an entry the manifest never listed is `unexpected`, because a file nobody shipped loads exactly like one that did.

MEASUREMENT CONTRADICTED THE PLAN IN THREE PLACES. (1) The plan says to reuse the corpus checksum helper AND that `src/rules/` imports nothing from `src/core/` but the frontmatter parser; those cannot both hold, and isolation won - node:crypto directly, with line endings normalised so a Windows checkout does not report every entry as altered. (2) `mycontext rules verify --restore` has no source to restore FROM while the store is package-only: the mechanism is built and tested against two real directories, and the CLI says plainly that there is no second copy here rather than reporting a restore it did not perform. A workspace-side copy (spec section 12.3) is what would make it act. (3) Registering the command cost eleven derived surfaces, every one of them a working gate: the flag-spec census, the eleven-with-no-flat-spec partition, the approval-boundary subcommand probe, the palette catalogue partition, both READMEs' counts and command tables, the no-slash-command list, plugin parity's two records, F2 registry coverage, the tutorial claim map, and the WRITERS table.

OWED, AND IT NEEDS THE BROWSER THIS LANE WAS TOLD NOT TO TOUCH: `npm run gen:docs` (specifically `node scripts/gen-diagrams.ts`, which launches chromium through Playwright) must regenerate `src/ui/public/lib/diagrams.js` and two SVGs, because the CLI command count moved 46 to 47 inside the surface diagram in both READMEs. `test/ui/diagram-gate.test.ts` is red until then, and those two are the only failures in the full unit suite that belong to this work.
