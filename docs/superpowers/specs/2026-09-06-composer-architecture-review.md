# Composer architecture review

Reviewer: Component Architect. Scope: `#/palette` (Composer) — `src/ui/public/screens/palette.js` (814 lines), `src/ui/public/lib/palette-defs.js` (495 lines), `src/ui/public/lib/command-actions.js` (824 lines) — plus every other command site, read for comparison rather than for its own defects. No product code was written for this review; every claim below cites a `file:line`.

This is not a rewrite proposal. Most of what follows says: the abstraction is already in the code, in three unequal pieces, and the next step is to name it and finish carrying it to the sites that still hand-roll it — not to invent a fourth shape.

## 1. What the screen is architecturally today

Three layers, cleanly separated, and the separation is the thing worth preserving:

- **`palette-defs.js` — the schema.** `PALETTE` (`lib/palette-defs.js:67`) is data: 27 entries, each an argv template (`base`), a positional list (`args`) and a flag list (`flags`), plus `boundary`, `ungated`, and the `notWith`/`onlyWith`/`flagsNotOffered` escape hatches `commandFor` (`lib/palette-defs.js:460`) reads. This file is also, unusually for a "config" file, the *contract*: `test/ui/palette-lib.test.ts` runs the real CLI parser against every entry, so a `<select>` built from it can never offer a flag the command refuses. That test is doing the job a type system would do in a codebase allowed a build step.
- **`palette.js` — the one place that renders the schema into controls.** `controlSpecs` (`palette.js:236`), `pickerOptions` (`palette.js:270`), and `controlFor` (`palette.js:410`) already form a complete, generic renderer: given a `FieldSpec`, produce a `<select>`, a checkbox, a `<textarea>`, a glob input, or a plain `<input>`, wire its `change`/`input` listener, and mark it `required`. This is, in substance, **builder/5 already built** — just scoped to one screen and never factored out.
- **`command-actions.js` — the one shared action control.** `commandActions()` (`command-actions.js:284`) is the second half of the same idea, and it is *already* shared: it is called from seven screens (`capture.js:333` [confirmed via grep below], `config.js:1115`, `doctor.js:909`, `packs.js:333`, `palette.js:678`, `proc.js:543`, `work.js:408`). Copy and Execute, the confirm dialog, the diff table, the nonce round-trip, stdout/stderr rendering — one implementation, adopted everywhere, per the header's own account of the nine hand-rolled copy buttons it replaced.

So the picture is not "one screen, no components." It is: **the action half of the builder shipped as a real shared component two weeks ago (per the file's own header, plan Task 6); the input half never made the same trip.** `controlSpecs`/`pickerOptions`/`controlFor` live in `palette.js` and are imported by nobody. `capture.js` re-derives the same four decisions (select for a closed vocabulary, input with placeholder, required-marking, textarea for a body) by hand, and the two implementations already disagree in ways nobody decided: Capture's `--severity` picker and the Composer's are two DOM-building code paths for the same `FieldSpec` shape.

## 2. Where the seams are wrong, and what each costs

### 2a. The form-renderer exists once, is used once, and is not importable

`controlSpecs`, `pickerOptions`, `controlFor`, `missingRequired`, `valueOf` (`palette.js:236-448`) take a `FieldSpec` and a picker-source map and return a wired control. Nothing about this logic is Composer-specific — it never reads `PALETTE`, only `def.args`/`def.flags`. But it is a module-private function in a *screen* file, so:

- `capture.js` hand-builds its four controls independently (per `TASK-one-builder-component-rendered-from-a-catalogue-entry`'s own citation: "Capture screen is the model and already does most of this — read `screens/capture.js` before designing anything"). Two independent renderers for the same `FieldSpec` vocabulary is the drift `palette-defs.js`'s own header names as the thing this repository has already paid for four times (`lib/palette-defs.js:9-15`).
- `config.js`'s own composer (json-patch preview, per `NOTE-reconciliation-batch-6-plan-config-and-plan-builder-fourteen` and `DEC-the-mockup-draws-the-builder-once-and-screens-instantiate-it`'s "plan:walk seq:13, the config composer, now instantiates this pattern rather than inventing a third builder") is a *different* composer — it builds a JSON patch, not a CLI argv — and the owner ruling already forbids it from becoming a third vocabulary. That ruling is correct and this review does not touch it; it is mentioned only to say the count of "things called a builder" in this codebase is already at the edge of confusing, and a fourth ad hoc one (a bespoke renderer per screen) is the wrong direction to add to it.
- Every future command site pays the choice again. Doctor's remedy row, Procedures' `done` button and the Template-packs `init --pack` block all avoided this cost only because they need *no form at all* — their argv is fixed or server-supplied — which is a different reason than "the renderer wasn't available," and it is worth not congratulating the architecture for.

**Cost, concretely:** one `FieldSpec` vocabulary, two renderers (Composer's and Capture's), zero tests holding them to the same behavior. `test/ui/palette-screen.test.ts` pins Composer's control order to `[...def.args, ...def.flags]`; nothing pins Capture's four hand-built controls to the same rule, because Capture doesn't consume `FieldSpec` objects at all — it re-derives the four fields from `add`'s definition by reading the source, not by importing it as data (`capture.js:47-59`, `66`, quoting `palette-defs.js:159` in prose rather than importing the entry).

### 2b. The catalogue conflates "what to render" with "what may run" — this is the review's sharpest finding

`src/ui/execute-catalogue.ts:60-75` rebuilds an argv from `PALETTE` by name, server-side, and that rebuild *is* the security boundary: an id the server can resolve in `PALETTE` is an id `POST /api/execute` will run behind a confirm; an id it cannot resolve gets `commandActions({ id: null, ... })`, Copy only, no matter what argv the browser built (`command-actions.js:385-388`, "Nothing composed outside the catalogue may run. Asserted, not assumed.").

There is no third state. Membership in `PALETTE` is simultaneously:

1. "the Composer may draw a form for this," and
2. "the server will treat this id as licensed to execute."

`OPENQ-the-three-proposed-screens-hold-the-only-command-blocks-in` already found the consequence and it is the correct diagnosis: *"Bringing a command into the catalogue is what makes it runnable — the `id` is the whole gate — so the builder work and this ruling are one change and not two."* That open question rules the three bypassing commands one at a time — `procedure done` should probably gain Execute (the owner already presses the button; `pr.w3` reserves the *decision*, not the click, for the owner), `export --out` needs a prior ruling on whether a catalogue entry may write outside the workspace root at all, and `init --pack` should very likely stay Copy-only, permanently, because its effect is not on this corpus.

**This means builder/5 and builder/7, read literally, ask for something that cannot be done safely as a pure refactor.** "Every command site uses the builder" cannot mean "every command site's argv goes into `PALETTE`," because for `init --pack` that silently grants Execute to a command whose whole hazard is that it reads an untrusted artefact from a path the reader supplies and writes a *new* corpus wherever that path names — a decision no task in this plan makes and OPENQ explicitly says must not happen "as a side effect nobody weighed."

**The fix is a schema addition, not a new component:** split the two concerns already conflated in one boolean-shaped fact (`is this id in PALETTE at all`) into two fields on the entry:

- `renderable: true` (or simply: give every entry `args`/`flags`, which all already have) — licenses the shared form-builder to draw controls for it.
- an explicit `runnable` gate, read only by `execute-catalogue.ts`, defaulting to the current behavior (present ⇒ runnable) for the 27 entries already there, but settable to `false` for an entry that should render through the shared builder and still return Copy-only from `commandActions`.

This lets `audit --files`, `init --pack`, and `procedure done` become ordinary `PALETTE` entries — ending the drift of three hand-maintained argv arrays that have never been checked against the real CLI parser the way every other entry has — **without** pre-deciding OPENQ's still-open Execute question for any of them. `export`, once a path-escape ruling exists, becomes `runnable: true` by flipping one field, not by restructuring anything.

### 2c. The three bypass sites, and what each costs specifically

Measured (matches `TASK-every-command-site-uses-the-builder-including-the-three-that`'s own measurement, re-verified against current source):

| site | file:line | argv built how | catalogue-checked? | Execute reachable? |
|---|---|---|---|---|
| Doctor's `audit --files` remedy | `lib/viewmodel.js:1419-1421` (`repairArgvFor`, `route: 'copy'`) | literal array inside a remedy resolver | no | no — `commandActions({ id: null })` |
| Template packs' `init --pack` | `screens/packs.js:296` (`IMPORT_ARGV`) | module-level literal constant | no | no — `commandActions({ id: null })`, `packs.js:333` |
| Procedures' `procedure done <id>` | `screens/proc.js:332-336` (`doneArgv`) | literal array, built per-render | no | no — `commandActions({ id: null })`, `proc.js:543` |

The cost is **not** duplicated Copy buttons — that was already fixed (all three already call the shared `commandActions`, correctly, with `id: null`). The cost is:

1. **Three argv shapes that have never been run through `palette-lib.test.ts`'s parser probe.** If `mycontext audit`'s flags ever change, or `procedure done` grows a new required flag, nothing in this codebase's test suite will notice until a reader pastes a broken line. Every one of the 27 catalogued commands is protected from exactly this; these three are not, and the omission is invisible because the screens *look* like every other command block.
2. **These three commands are structurally incapable of ever getting Execute**, not because anyone ruled they shouldn't (only `init --pack` has actually been ruled on, and the ruling was "not yet," not "never" — `OPENQ-the-three-proposed-screens-hold-the-only-command-blocks-in`), but because the mechanism that grants Execute is catalogue membership and they have none.
3. **`procedure done` in particular is the one place this matters operationally.** `pr.w3` names it "the one act the product reserves for the owner in its own printed words," and today the owner cannot press a button to do it from this app at all — only copy a line and paste it into a shell — for a reason that turns out to be an accident of which file the argv literal lives in, not a considered security posture.

### 2d. The catalogue's "coverage" claim cannot be checked against the file it claims to derive from

`palette-defs.js`'s own header says the catalogue's every claim "is derived somewhere else and compared against it" (`lib/palette-defs.js:17-35`), and names `palette-lib.test.ts` as the thing that does the comparing — but that test's own docstring (quoted verbatim in `builder/3`) says it fails in only ONE direction: an advertised flag the CLI refuses. It does not fail when the CLI grows a flag, or a whole command, the catalogue never learns about. That is exactly the gap builder/3 exists to close, and it is real: see §3.

## 3. The three-numbers discrepancy, resolved

Three numbers were floated: 38 (builder/3's own text), 43 (`docs/cli-ui-coverage.md`, generated), 27 (the catalogue). All three are individually correct answers to different questions, which is worse than one of them being wrong, because it lets "the catalogue covers everything" go unchallenged.

- **43 is the current, generated truth for "how many CLI commands exist."** Verified independently: `node src/cli/index.ts --help` lists 43 top-level verbs, and it matches `docs/cli-ui-coverage.md`'s "my_context has 43 CLI commands" line exactly, command for command. This document is generated by `scripts/gen-cli-ui-coverage.ts` and regenerated by a test (`test/docs/doc-system.test.ts`), so 43 is not stale by construction — it moves when the CLI does.
- **38 was correct on 2026-08-24** (the owner ruling's own date) and has since drifted, by five commands, exactly the failure mode builder/3 itself warns about ("a hand-kept list of commands is a defect waiting to happen"). Nobody kept 38 up to date because nothing re-derives it; it is a number typed into a task body, not a query. The task is not wrong to have said 38 in August; it is wrong to still say 38 in September, and that is the whole argument for making the seq:3 test bidirectional rather than for re-editing the number.
- **27 is the catalogue's entry count**, and it is *not* directly comparable to 43, because `PALETTE` expresses one CLI command (`review`) as five entries (`review promote`, `review discard`, `review promote-revision`, `review discard-revision`, `review revisions`) — each subcommand has its own argument shape and needs its own form, so this is the right granularity for a *renderer*, but it means "27 entries" understates "how many distinct commands are covered" and a naive "27 of 43" would be the wrong fraction in *both* directions at once.

**The real gap, counted correctly (distinct CLI command strings, not catalogue entries):**

- Catalogue-covered: 23 distinct commands (`ack, add, config, edit, focus, pin, unpin, harden, soften, supersede, refresh, repair, lesson-accept, lesson-discard, rebuild, status, doctor, decay, help, list, show, search, review`).
- Hand-built, bypassing the catalogue, per §2c: 3 (`audit`, `init`, `procedure`).
- **Neither catalogued nor hand-built — zero UI presence of any kind:** 17 commands, read off `docs/cli-ui-coverage.md`'s own "CLI only" rows minus the ones the catalogue composes: `carry, examples, ingest, ingest-apply, ingest-status, inbox-promote, lesson, lesson-stage, link, pack, query, ready, session, statusline, todo, ui`, plus `export` (composed, but from server-supplied argv via `/api/port`, never through `PALETTE` — see §2c's table note; it is neither a bypass nor covered, it is a third pattern).

So "the catalogue covers all commands" is false today in the strongest sense: 17 of 43 commands (40%) have no command-builder presence anywhere in the UI, catalogued or not. Some of these are legitimately CLI-only forever (`ui`, `statusline` — they start or configure a process, not compose one), and that is a fine ruling to make explicitly; several others (`pack`, `session`, `link`, `ready`) look like plausible future Composer entries that nobody has scoped. **Builder/3's real job is not "add the missing 15," it is "make the both-directions test exist so this document stops being able to say something false,"** and that job is unaffected by whether the missing count is 5, 15, or 17 on any given day.

## 4. The one builder component

This is a naming and extraction exercise, not new design — the renderer in §1 already has the right shape. Concretely:

**Interface**, exported from a new `lib/command-builder.js` (or promoted in place from `palette.js`, see migration order below):

```
buildCommandForm(def, sources, onChange) → {
  root: HTMLElement,          // form controls in def.args-then-def.flags order
  controls: Map<name, {control, spec}>,
  currentValues(): Record<string, string|boolean>,
  missingRequired(): string[],
}
```

This is `controlSpecs` + `controlFor` + `valueOf` + `missingRequired` (`palette.js:236-262`, `410-448`), given a name and a home outside a screen file. Nothing about their logic needs to change to move.

**What a catalogue entry must carry to render through it** — already fully specified by the existing `FieldSpec` shape (`lib/palette-defs.js`, every entry's `args`/`flags`), with no new fields needed for rendering:

- `name`, `required?`, `boolean?`, `options?` (closed vocabulary → `<select>`), `source?` (corpus-fed vocabulary → `<select>`, resolved through the same `sources` map `sourceLists()` already builds), `input?: 'text'|'textarea'|'glob'`, `joined?` (composition detail, not a rendering one).
- The one addition this review recommends (§2b): a `runnable?: boolean` on the **entry**, not the field — read only by `execute-catalogue.ts`, defaulting to `true` for compatibility with the 27 entries that exist today.

**What does not change:** the picker-source plumbing (`sourceLists`, `pickerOptions`, `revisionFor` — `palette.js:270-316`), because it is already generic over "which four corpus reads feed which sources," and every site's `sources` argument is just a narrower slice of the same map. The chip row, the glob tester, and the read-execution table (`palette.js:494-760`) are Composer-specific rendering *on top of* the builder, not part of it — Capture doesn't need chips, Doctor doesn't need a glob tester, and nothing in builder/5's own text asks for those to generalize.

**How the three bypassing sites move onto it**, in the order their risk resolves:

1. **`procedure done`** — lowest risk. Its argv is `['mycontext', 'procedure', 'done', id]`, no flags, one positional already resolved by the screen (`proc.js:332-336`). Becomes a `PALETTE` entry with `args: [{name: 'id', ...}]`, `runnable` decided by the owner per OPENQ (this review's read: yes, `pr.w3` gates the *click*, not the *button's existence*). Immediate win: it can be checked by `palette-lib.test.ts` for the first time.
2. **`audit --files`** (Doctor's remedy) — becomes a `PALETTE` entry with no args, `runnable: false` pending a decision, or `true` — the confirm/effect-diff machinery already handles a zero-argument command (`rebuild`, `repair` do this today). No form to render at all beyond nothing, so this is nearly a pure "add the entry" change.
3. **`init --pack`** — stays `runnable: false` (Copy-only, matching OPENQ's own recommendation) but *still* moves its argv into `PALETTE` as data, ending the "un-tested literal array" problem in §2c(1) independent of the Execute question. This is the one case where "use the builder" and "grant Execute" visibly and deliberately diverge, which is exactly the point of separating the two fields.

`export` is a fourth, structurally different case (server-supplied argv, no catalogue entry, no form — `port.js:297-304`) and this review does **not** recommend forcing it into `PALETTE`: its argv is a `--out <path>` the *server* fills in from a real export dry run, not something a picker composes from corpus data, and OPENQ's own path-escape question has to be settled first regardless of which file holds the argv.

## 5. Migration order that keeps the screen working at every step

1. **Extract, don't rewrite.** Move `controlSpecs`/`pickerOptions`/`controlFor`/`valueOf`/`missingRequired` out of `palette.js` into `lib/command-builder.js` verbatim, update `palette.js` to import them. Zero behavior change; `test/ui/palette-screen.test.ts` should pass unmodified, which is the proof this step changed nothing observable.
2. **Add the `runnable` field to the `CommandDef` shape**, in both `palette-defs.js` (as a comment-documented optional field) and `execute-catalogue.ts`'s `CommandDef` interface, defaulting to `true`. Zero behavior change for the 27 existing entries.
3. **Land builder/3's bidirectional test first**, per its own dependency ordering (it is already sequenced before 5 in `plan:builder`) — this is what makes "coverage" a checked claim rather than a typed number, and it should drive the count in §3, not the reverse.
4. **Move `procedure done` into `PALETTE`** (lowest-risk bypass), get an owner ruling on `runnable` for it, land it, delete `proc.js`'s hand-built `doneArgv`. Confirms the extracted builder works for a second screen before Capture — a smaller, reversible test of the extraction.
5. **Generalize Capture onto `lib/command-builder.js`**, per builder/5's own instruction to read `capture.js` and generalize what's there rather than replace it — this is the step that actually proves "one builder, two screens," and it should happen before touching Doctor or Template packs, because Capture's `add` entry already exists in `PALETTE` and needs no new ruling.
6. **Move `audit --files` and `init --pack` into `PALETTE`** with `runnable` set per the owner's per-command rulings (§2b), closing builder/7's coverage half.
7. **Builder/6 and builder/8** (refusal readability, inline help) apply to whichever screens have been converted so far, incrementally — neither depends on every site being converted first, so they can run alongside steps 4-6 rather than after them.

At every step the screen renders from the same data it did before the step; nothing is down for a commit.

## 6. What this review would NOT change

- **The three-layer split (schema / renderer / actions) itself.** It is correct today and should stay: a hand-kept, test-derived data file; a generic renderer over it; a single shared action control. The problem is incompleteness of adoption, not shape.
- **`command-actions.js`'s design**, including the classless-buttons decision, the `dataset.cmdkey` redraw-survival mechanism, and the stdout/stderr display rules. This file is already exactly what builder/5 and builder/7 want for the action half; it needs zero changes for this migration.
- **The glob tester and the chip row.** Composer-specific, correctly not generalized, and the header's own reasoning for keeping glob matching server-side (`palette.js:87-106`) is sound and orthogonal to this review.
- **The config screen's JSON-patch composer.** A deliberately different vocabulary for a deliberately different problem (patches, not argv), already ruled on (`DEC-the-mockup-draws-the-builder-once-and-screens-instantiate-it`), and this review does not reopen that ruling.
- **`export`'s server-supplied-argv pattern.** It is not a defect that it doesn't go through `PALETTE` — a path chosen by the reader and validated server-side is a different kind of input than a corpus-sourced picker value, and forcing it into the same shape would hide that difference rather than express it.
- **The mockup-first ordering.** `builder/5`'s "the mockup is the design of record and must move first" stands, and the measured gap it's reacting to is real and larger than the task text implies: `DEC-the-mockup-draws-the-builder-once-and-screens-instantiate-it` measured the mockup at **zero** labels/inputs/selects for the builder pattern while Capture has drawn 4/2/2 and the Composer 12/8/3 in the running app. The mockup does not yet draw the pattern this review is describing at all — it has to gain it before `styles-parity`/`screen-parity`/`tree-parity` have anything to compare the extraction against. `plan:port seq:95` (tree-parity), which builder/5 and builder/7 both cite as a blocker, is recorded `state: done` — its inventory was delivered and reviewed 2026-08-24/25 — so that blocker should be re-checked with the owner rather than assumed still open.

## 7. Compatibility with the pending performance fix

Per instructions, the 13-second render was not investigated. Two structural observations, offered because they bear on whether this migration makes the eventual fix easier or harder:

- **The builder extraction is orthogonal to the fix, whatever it turns out to be.** `buildCommandForm` renders one def's controls from data already fetched (`sourceLists`); it does not itself fetch anything, and moving it to a shared module changes nothing about when or how often `/api/items` is called.
- **The id-picker is the one place this review would flag as *structurally* worth revisiting regardless of the current fix**, because it will keep costing more as the corpus grows even after whatever is slow today is fixed: `sourceLists()` (`palette.js:290-310`) maps every corpus item into a `{value, label}` pair, and `controlFor` (`palette.js:410-421`) builds one `<option>` per entry for any `source`d picker. At ~935 items (measured live during this review, up from the ~923 estimated) that is 935 DOM nodes built and thrown away on every def switch that has an `id`-sourced arg or flag — `add` (via `category`... no, via nothing id-sourced), but `pin`, `unpin`, `harden`, `soften`, `refresh`, `edit`, `supersede`, `ack`, `show` all take an `id`-from-`items` argument, which is most of the write side of the catalogue. A `<select>` with ~900 options is not itself the reported 13 seconds (a single `<select>` populate is not that slow), but it is a cost that scales with corpus size while the rest of the screen does not, and it is worth the owner knowing that **the builder's interface should accept a filtered or virtualized source list without changing its contract** — `pickerOptions` already returns a plain array, so a future combobox-with-search implementation is a drop-in replacement for the `<select>` branch in `controlFor`, not a redesign. If the separate performance investigation finds the id picker is part of the 13 seconds, this component boundary is exactly where the fix would land.

## 8. Do the six open items survive contact with this review?

- **builder/3** (catalogue covers all 38/43 commands, bidirectional test) — **stands, with its number corrected.** Re-cut to say 43 (generated, moves with the CLI) rather than 38, and to note the count is only meaningfully compared per-command, not per-catalogue-entry (§3). No change to its actual work (the bidirectional test).
- **builder/4** (`POST /api/command/check`) — out of this review's scope (server-side, not component architecture) and this review found nothing that touches it. No change recommended.
- **builder/5** (ONE builder component) — **stands, and is smaller than written.** The component substantially exists (§1); the task is extraction and generalization to Capture, not new design. Its text already says this ("generalise what is there, not replace it") — this review's contribution is confirming that reading against the actual code and naming the interface (§4).
- **builder/6** (refusal readability) — stands unchanged; genuinely independent of the builder-component question and can proceed on the Composer alone before other sites convert.
- **builder/7** (every site uses the builder) — **needs re-cutting.** As written, it bundles a pure refactor (move three hand-built argvs into data) with an unstated Execute-licensing decision for each (§2b), which is exactly what `OPENQ-the-three-proposed-screens-hold-the-only-command-blocks-in` says must not happen as a side effect. Recommend splitting it: (a) add `runnable` to the schema and move the three argvs into `PALETTE` with `runnable: false` for all three initially — a safe, reversible, fully-tested-by-`palette-lib.test.ts` change that costs nothing security-wise; (b) a separate, owner-decided task (already drafted as the OPENQ) to flip `runnable: true` per command. Doing (a) without (b) already closes most of builder/7's stated cost (§2c(1)-(2)); (b) should not be scheduled as "finishing builder/7," it should be scheduled as answering the open question, because that is what it actually is.
- **builder/8** (inline help via `/api/help`/`details.help`) — stands unchanged; independent of the component question, reuses `lib/disclosure.js`'s `helpDisclosure()` (already generic, already imported nowhere near the Composer today) rather than the card-role color system, and its own text already found the right existing component to reuse.

## Files referenced

- `D:/Users/UserC/source/repos/my-context/src/ui/public/screens/palette.js`
- `D:/Users/UserC/source/repos/my-context/src/ui/public/lib/palette-defs.js`
- `D:/Users/UserC/source/repos/my-context/src/ui/public/lib/command-actions.js`
- `D:/Users/UserC/source/repos/my-context/src/ui/public/screens/capture.js`
- `D:/Users/UserC/source/repos/my-context/src/ui/public/screens/proc.js`
- `D:/Users/UserC/source/repos/my-context/src/ui/public/screens/packs.js`
- `D:/Users/UserC/source/repos/my-context/src/ui/public/screens/port.js`
- `D:/Users/UserC/source/repos/my-context/src/ui/public/lib/viewmodel.js`
- `D:/Users/UserC/source/repos/my-context/src/ui/public/lib/disclosure.js`
- `D:/Users/UserC/source/repos/my-context/src/ui/execute-catalogue.ts`
- `D:/Users/UserC/source/repos/my-context/docs/cli-ui-coverage.md`
- `D:/Users/UserC/source/repos/my-context/docs/design/web-ui-mockup.html` (read only, per constraint)
