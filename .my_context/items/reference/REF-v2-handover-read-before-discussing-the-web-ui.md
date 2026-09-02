---
id: REF-v2-handover-read-before-discussing-the-web-ui
type: reference
title: v2.0 handover — we are mid-decision, keep deciding
status: active
severity: soft
always: false
continuity: true
summary: What the last session learned, so this one does not start over.
summary_of: 0f14bbf4a04f7f9c
scope:
  - reports/**
  - my-context/docs/superpowers/specs/**
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-18
valid_until: null
checksum: 578d44519e395b0a
---

# v2.0 handover — we are mid-decision, keep deciding

**The full handover is `reports/V2-HANDOVER.md`. Read it before changing or discussing the web UI.** This item is the pointer and the state; the document is the argument, and it is too large to inject — 37,831 tokens against a 2,000 continuity budget. Not optional reading: on-demand reading.

**Why this item is a pointer and not the document**

Until 2026-08-28 this item WAS the document, and it was delivered on no event at all. Measured: `session-start`, `compact` and `manual` each returned it as a single index line, never as text. The guarantee was believed to be in force for weeks and was not, and nothing said so.

`DEC-continuity-gets-its-own-budget-and-the-item-it-holds-must-be` rules the fix: a dedicated `continuity` budget, and the item it holds is a bounded pointer. A dedicated budget for a document that grows only relocates the spill — this one grew ~4,000 tokens in a single day.

**Do not restore the full text into this item.** Its `source_file` link was deliberately cleared so `mycontext refresh` cannot silently do it.

**Where things are**

- **The design of record is `docs/design/web-ui-mockup.html`.** The app follows it. When the design must change, the mockup is edited FIRST and the app follows; parity gates enforce this in both directions.
- **Two nested repos.** `test_mycontext_plugin` holds the corpus; `my-context` holds the code and its own git history. A session started inside `my-context` gets a DIFFERENT corpus — start at the repository root.
- **Seven gates**: typecheck, `npm test`, `check:text-files`, `check:retired`, `check:test-glob`, `verify:citations`, `test:e2e`. The browser suite is the only one that catches a page that renders but does not run.

**What the defects keep having in common**

Nine in one day — five found by the owner clicking, four by review — and they share one shape: **a check correct about what it measured and silent about what it missed.** A guard comparing a value to itself. A confirm saying "this changes nothing" over an irreversible settlement. A slider silently clamping the budget in force. A path filter wired correctly end to end and unable to filter, because 619 of 621 items are unscoped and an unscoped item matches every path.

When something looks broken here, measure before believing either the code or the report. Most of these were correct code meeting an unstated condition.

**Standing rules that bite**

- **The owner runs git.** Subagents never commit, merge or push.
- **`.my_context/config.json` is the owner's.** A deny hook refuses edits to it, including via Bash. Ask; do not route around it.
- **`.my_context/items/` may not be written directly.** A hook refuses it and names the tools that may.
- **A task is not done until its `state` says done** — this rule has caught its own author repeatedly.
- **Tags with a `plan:` prefix are projected from the `plan` FIELD.** Set the field, never the tag.
- **Read `mycontext help <surface>` before writing any command.** Guessing syntax has cost repeated round trips.
- **The UI is the instrument, not the roof.** Three of the owner's five reports on 2026-08-28 bottomed out in `core/select.ts` or server lifetime, not in screens, and none had a failing test. Do not defer UI work to last; it is how foundation defects become visible.

**Open, and worth knowing before starting**

- **`walk/7b`** — the budget simulator's slider is pinned at max and can only travel LEFT, so the screen cannot simulate RAISING a budget on a screen whose subtitle is "Raising a budget can evict an item". Measured, not inferred. The step is also too coarse to use.
- **`walk/47`** — every chart is stretched from a fixed viewBox by a DIFFERENT factor per screen (staircase 1.6x, graph and decay 1.267x), so nominally identical text renders at different sizes. Bound the scale, not the type.
- **`live/11`** — `live-stream.spec.ts` · `test('the shell opens the stream ONCE` · ~99 fails 2/6 alone and passes beside another spec. Order-dependent; the stream path is provably untouched. Do not "fix" it by making the shell open a second connection.
- **`walk/65`** — an almost-empty staircase is CORRECT (the seen gate excludes what this session already received) and says nothing, so it reads as a regression.
- **`walk/66`** — the ledger projection is behind by construction; the audit one was fixed, this one lives in the database users are invited to delete.

**Rulings made on 2026-08-28 that change how work is briefed**

- **The mockup governs PRESENTATION only** (`DEC-the-mockup-governs-presentation-never-behaviour-and-a`). Not interaction, not degradation, not what an endpoint returns. Consult it when a presentation question is at hand, not routinely. A contradiction goes to the owner, unresolved.
- **The wave is the order**, priority a tiebreak (`REF-the-wave-map-...`). 42 of 125 ready tasks were p1 and 37 had no priority; the field could not order anything.
- **`reports/uiux/sketches/`** is the design source the mockup renders, and it specifies degradation the implementation dropped. Read it before designing a chart.

**How to orient in one command**

`mycontext ready` lists the open tasks whose dependencies are satisfied, by priority. `mycontext doctor` says whether the corpus is sound. Between them they answer "what can I start" without re-deriving it — which is the derivation that has gone wrong here before.
