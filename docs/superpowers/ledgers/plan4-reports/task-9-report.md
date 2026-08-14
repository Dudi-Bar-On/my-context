# Task 9 report: the `lesson` CLI commands

## What was implemented

Added `src/cli/commands/lesson.ts`, registering four commands: `lesson`, `lesson-stage`, `lesson-accept`, `lesson-discard`. Wired via `import './lesson.ts';` added to `src/cli/commands/index.ts`. Test file `test/cli/lesson.test.ts` written verbatim from the brief (all 11 cases).

- `lesson "<text>"` — creates a `lesson` item (`active`, `origin: 'human'`, rationale tier) via `createItem`, deduping on the id `makeId(config.categories.lesson.prefix, subject)` would allocate so re-running with identical wording re-derives rather than duplicating. `lesson <existing-id>` looks the id up directly via `ctx.store.get(subject)` first. Both paths end by printing `buildRuleRequest`/`renderRuleRequest`'s `RULE DERIVATION REQUEST`.
- `lesson-stage <id> (--file|--stdin)` — reads the candidates payload via `readPayload`, calls `stageRuleCandidates(root, lesson, payload)`, prints each pending candidate's key/directive/title plus any validation rejections, and the accept/discard hints. Creates no items.
- `lesson-accept <id> <key> [--title/--scope/--severity/--directive]` — peeks staging with `loadStaging(root, lessonId)` **only to display and to fail fast with a good message**, then calls `acceptStagedRule(ctx, root, lessonId, key, edits)`, which reloads staging from disk itself and does the real work.
- `lesson-discard <id> <key>` — calls `discardStagedRule(root, lessonId, key)` directly; no `MutationContext` needed since discard never touches the item store.

## Brief vs. built code — where they disagreed

The brief's Step 3 code block was **stale against Task 8's actual, twice-revised signatures**. I read `src/lesson/derive.ts` from source before writing anything and built against what's actually there, not the brief's pseudocode:

- Brief: `acceptStagedRule(ctx, staging, key, edits)` and `discardStagedRule(staging, key)`, called through a shared `withStaging` helper that itself loaded `staging` via `loadStaging` and passed the loaded object in, then called `saveStaging` afterward.
- Actual/built: `acceptStagedRule(ctx, root, lessonId, key, edits)` and `discardStagedRule(root, lessonId, key)` — both take `root`/`lessonId` and load+save staging **internally** via the private `loadOrThrowStaging`; there is no `staging` parameter to pass at all, and no `saveStaging` call for the CLI to make.

Following the brief's shape literally would have handed a caller-loaded `LessonStaging` object into `acceptStagedRule`/`discardStagedRule` (constraint 1) and would not even compile against the actual exports (`saveStaging` isn't imported/needed; `LessonStaging` type is used only where I peek). I discarded the brief's Step 3 code entirely and wrote against the real API.

One test-visible consequence: the brief's `withStaging` would have produced "no staging" and "unknown key" messages straight from `loadOrThrowStaging`'s exception text, which does **not** contain the string `lesson-stage` (it says "Run `mycontext lesson ${lessonId}` to derive candidates first"). The brief's own test (`lesson-accept on a lesson with no staging explains the next step`) asserts `/lesson-stage/`, so the brief's own Step 3 code would have failed its own Step 1 test. My implementation peeks `loadStaging` first and writes its own message mentioning `lesson-stage` explicitly for that reason.

## TDD evidence

1. Wrote `test/cli/lesson.test.ts` verbatim from the brief.
2. `node --test test/cli/lesson.test.ts` before implementation: 11/11 failing, first failure `1 !== 0` / `unknown command "lesson"` path (confirmed via the top-level catch converting to exit 1) — the expected "unknown command" failure mode.
3. Implemented `src/cli/commands/lesson.ts` against the real `derive.ts` API; added the `index.ts` import.
4. `node --test test/cli/lesson.test.ts` → 11/11 passing.
5. `npx tsc --noEmit` → clean.
6. `npm test` → **932 passing** (921 baseline + 11 new), 0 failing.
7. `git status --porcelain` → only `M src/cli/commands/index.ts`, `?? src/cli/commands/lesson.ts`, `?? test/cli/lesson.test.ts` (plus this report file, added before commit).

## Mutation testing

Manually mutated the CLI-level guards (not `derive.ts`, which Task 8 already mutation-tested) and re-ran `test/cli/lesson.test.ts`:

| Mutant | Result | Note |
|---|---|---|
| Disable the CLI's own `staged.state === 'discarded'` early-return in `cmdLessonAccept` (`if (false && ...)`) | **Survived** — all 11 still pass | Not a hole: `acceptStagedRule` itself has the identical guard and throws its own "was discarded and cannot be accepted" message, which the `catch` block prints. The CLI-level check is a redundant fast-path (it also skips opening a `MutationContext` for a request that's going to fail anyway); the actual enforcement lives in `derive.ts` and Task 8 already mutation-tested that. Recorded here per the brief's instruction to report what mutation testing *can't* tell you — this is a case where an "equivalent mutant" is genuinely equivalent, but only because Task 8's independent guard covers it. |
| `if (!staging)` → `if (false)` in `cmdLessonAccept` | **Killed** — `lesson-accept on a lesson with no staging explains the next step` failed (crashed on `staging.candidates` of `null`, wrong message) | Confirms the "no staging" guard and its `lesson-stage`-mentioning message are load-bearing and actually exercised. |

Also checked by hand (no mutation harness needed — it's a straight read of the file) that every place I write or pass `lessonId`, I use the **argument** from `positionals()`, never `staging.lessonId` — satisfying constraint 5 directly rather than relying on a test to catch a regression. `acceptStagedRule`'s own `target: lessonId` (the argument, confirmed by reading `derive.ts` line 437) is where the `derived_from` relation is actually written, so this was mostly about not accidentally reading `staging.lessonId` for the pre-accept `loadStaging` peek — I don't.

Not mutation-tested (would need a live human to notice, which is the whole point): the printing block in `cmdLessonAccept` that prints title/directive/severity/scope/body before creating. No automated test asserts these lines appear — removing that whole `out(...)` block would not fail `test/cli/lesson.test.ts`. I verified it manually instead (see "Attacking the gate" below, attempt 2's captured output shows all five fields printed). This is the class of gap the brief's note about "a comment claiming a guard existed was shipped after the implementer's own report identified it as false" is warning about, so I'm flagging it explicitly rather than letting a green test suite imply it's covered.

## The five constraints

1. **No serialized staging blob / staging path / agent-chosen `--root`.** `cmdLessonAccept`/`cmdLessonDiscard` take only `lessonId` and `key` from `positionals()`. `root` comes from `ws.projectRoot` (resolved by walking up from `cwd`, never from an argv flag) exactly the way every other command in this plan resolves it. `acceptStagedRule(ctx, root, lessonId, key, edits)` and `discardStagedRule(root, lessonId, key)` are called with that resolved root and the id/key from argv — never with a caller-supplied `LessonStaging` object. The one `loadStaging` call in `cmdLessonAccept` is read-only, used solely to print and to produce better error messages; its result is never passed to `acceptStagedRule`.
2. **Print full candidate before accepting.** `cmdLessonAccept` prints `title`, `directive`, `severity`, `scope`, and `body` of the **merged** (staged + `--title`/`--scope`/etc. edits applied) candidate before calling `acceptStagedRule`. Verified live in the "attacking the gate" section below — all five fields appear in the output preceding the `created ...` line.
3. **No MCP/hook exposure of accept/discard.** `grep -rn "lesson-accept\|lesson-discard\|acceptStagedRule\|discardStagedRule"` across `src/mcp` returns nothing. Only `src/cli/commands/lesson.ts` and `src/lesson/derive.ts` (plus their tests) reference these names anywhere in the repo. `lesson-stage` is exposed only as a CLI command (also fine per the brief — no MCP tool was added for it either, since the brief didn't ask for one this task).
4. **No load-once-and-pass-around.** `cmdLessonAccept` calls `loadStaging` once purely for display/early-exit; `acceptStagedRule` does its own independent load via `loadOrThrowStaging(root, lessonId)` and its own `saveStaging` at the end — two separate reads of the file, not one shared object. `cmdLessonDiscard` doesn't load staging in the CLI at all; `discardStagedRule` owns the whole read-modify-write itself.
5. **`derived_from`'s `lessonId` comes from the existence-check argument.** `acceptStagedRule`'s existence check is `ctx.store.get(lessonId)` and its relation target is `target: lessonId` — both read the same `lessonId` **parameter**, confirmed by reading `derive.ts` directly (constraint 5 is enforced inside `derive.ts`, not something the CLI could violate even if it tried, but I also confirmed the CLI never reads or forwards `staging.lessonId` instead of the argument anywhere).

## Attacking the gate

With the commands wired, I tried to make a normative `active` rule exist without a human running `lesson-accept` by name:

1. **`lesson-accept` on a lesson with no staging at all** (skip `lesson-stage` entirely): `mycontext lesson-accept LESSON-x deadbeef` → exit 1, "nothing staged... Run `mycontext lesson ...` then `mycontext lesson-stage ...`". No rule created. Expected — matches the brief's test and constraint 1/4.
2. **Hand-forge a staging file** (skip `lesson-stage`, write `.my_context/.staging/<id>.json` directly with protocol `my_context/lesson-staging@1`, the real `lessonId`, and a fabricated candidate/key that never came from a model): `mycontext lesson-accept <id> <key>` **succeeded** — printed the fabricated candidate's title/directive/severity/scope/body, then created `RULE-fabricated-rule-not-from-any-model` as `active` with `derived_from`.

   This is **not a hole this task introduced** — it is the exact, documented boundary `derive.ts`'s own comments describe: "The staging directory is unauthenticated working state; this function only checks the SHAPE the rest of this module depends on, not the provenance of what is inside it." The gate's guarantee, as the task brief states it, is "a human ran `lesson-accept` naming this specific key" — nothing about where the staged candidate's *content* came from. Task 9's printing requirement (constraint 2) is the intended mitigation: a human who actually reads the five printed fields before running the command would see a rule they never asked to derive. It does not, and cannot, stop a human (or a human-invoked script) that runs `lesson-accept` against a forged file without reading the print — that would require an interactive confirmation gate, which the brief did not ask for and no other command in this plan has (`ingest-apply` doesn't prompt either).
3. **Look for an MCP tool or hook that reaches `acceptStagedRule`/`discardStagedRule`**: none exists (`src/mcp` has zero matches for either name). An agent restricted to MCP tool calls cannot reach accept/discard at all — only a party with shell/bash access to run the CLI directly can, and that party is, by the plan's own model, "the human."

Net: the gate holds exactly to the extent the brief describes it holding. `lesson-accept`/`lesson-discard` are unreachable from the MCP surface, unreachable without naming `lessonId`+`key` explicitly, and always show the candidate before creating anything — but staging's lack of provenance authentication (a known, documented, Task-8-level property) means a human who runs `lesson-accept` against a file they didn't inspect can still be fooled. That's the same boundary Task 8's own review already identified, not a new one from this wiring.

## Concerns (round 1)

- The brief's Step 3 code was stale enough (wrong signatures for `acceptStagedRule`/`discardStagedRule`, an unused `saveStaging` import, a `withStaging` helper shape that no longer matches the module) that literally following it would not have compiled. Flagging in case other not-yet-executed tasks in this plan also carry brief text written against pre-review Task 8 signatures.
- The pre-accept printing block (constraint 2) has no automated test asserting its presence — see the mutation-testing table. Anyone touching `cmdLessonAccept` later could silently drop it without any test noticing.

---

## Review round 2: fixes

The reviewer confirmed four of the five hard constraints closed by execution, confirmed the brief-was-stale finding exactly (including that the brief's own Step 1 test would have failed its own Step 3 code), and required three fixes plus one corrected framing.

### 1. Exit code contradicted `openMutateContext`'s own doc comment (fixed)

All three commands that call `openMutateContext` (`cmdLesson`, `cmdLessonStage`, `cmdLessonAccept`) did `return errors.length ? 1 : 0`, contradicting `context.ts`'s documented F2 rule ("a command that did what it was asked... exits 0... only `status` and `doctor` exit non-zero"). Worst case was `lesson-accept`: it created and persisted the rule, printed `created RULE-... (active)`, and still returned 1 on an unrelated corrupt item elsewhere in the corpus — a script doing `lesson-accept ... && next-step` would see failure *after* a committed mutation.

Fixed: all three now `return 0` unconditionally after `emitLoadErrors(errors, out)` (matching `cmdIngestApply`'s identical pattern in `ingest.ts`). Added three new tests in `test/cli/lesson.test.ts`, reusing the same `plantUnrelatedCorruptItem`/`CONST-broken.md` fixture `ingest.test.ts` already uses for the identical assertion on `ingest-apply`:
- `lesson reports an unrelated corrupt item as a warning but still exits 0`
- `lesson-stage reports an unrelated corrupt item as a warning but still exits 0`
- `lesson-accept persists the rule and reports an unrelated corrupt item as a warning, exiting 0` — also asserts the rule really was created (`list rule` shows exactly one `RULE-` line), so this isn't just "exit code changed" but "exit code changed and the persisted-mutation claim is still checked."

Mutation-tested by reverting each `return 0;` back to `return errors.length ? 1 : 0;` one at a time: all three mutants killed (the corresponding new test failed each time), confirmed by re-running `test/cli/lesson.test.ts` after each single-line revert, then restoring.

### 2. Constraint 2's printing block was unpinned (fixed)

Added one test, `lesson-accept prints the edited candidate — not the pre-edit one — before the created line`, that: stages the two-candidate fixture, accepts `keys[0]` with `--title`/`--scope` edits, locates the `created RULE-` line, and asserts against the substring *before* it that all five fields (title, directive, severity, scope, body) appear with their **edited** values, and explicitly `assert.doesNotMatch`es the pre-edit title and pre-edit (unedited) scope string. Directive/severity/body are unedited in this fixture, so matching them alone wouldn't distinguish pre- from post-edit — the title/scope assertions (which the edit does change) are what make this specifically a "prints the *edited* candidate" test, not just a "prints *a* candidate" test.

Mutation-tested against the three mutants the reviewer named, one at a time (each applied, tested, reverted before the next):
- **Delete the whole print block** → killed (new test failed).
- **Keep the header, drop all five field lines** → killed (new test failed).
- **Swap the merged spread for the pre-edit one** (`out(... ${staged.candidate.title} ...)` instead of `${merged.title}`, etc. — the sharpest mutant, since it's the one that silently defeats the constraint) → killed (new test failed, specifically on the `doesNotMatch` assertions catching the pre-edit values leaking through).

All three mutations were applied to `src/cli/commands/lesson.ts`, verified to fail `test/cli/lesson.test.ts`, then reverted from a saved-clean copy before the next mutation — confirmed clean afterward by a final full run (16/16 passing).

### 3. Corrected the misleading comment at the old `lesson.ts:154-157` (fixed)

The old comment said the printing requirement "turns 'a human named this key' into 'a human read this rule and approved it.'" That's an equivalence the code cannot support — nothing verifies a human read anything, and the design deliberately has two separate reads of the staging file (the peek for display, `acceptStagedRule`'s independent re-read for the actual create), not one shared value. Replaced with a comment that states what the peek actually guarantees mechanically (the shown candidate is real and found by key, not fabricated by this command; the edited values shown are the same values `acceptStagedRule` will independently recompute, because both apply the identical `edits` patch to the identical staged candidate) and says plainly that nothing here checks a human read it.

### Minor (folded in — cheap)

`cmdLessonDiscard` used `positionals(args, [])` while `cmdLessonAccept` used `positionals(args, ['title', 'scope', 'severity', 'directive'])`, so `lesson-discard <id> --title X <key>` would silently resolve `X` (the flag's own value) as the key instead of consuming it as an unrecognized flag's argument, asymmetric with accept and untested. Fixed by giving `cmdLessonDiscard` the same `valueFlags` list. Added a test, `lesson-discard treats --title's own value as a flag argument, not the key, like lesson-accept does`, asserting `lesson-discard <id> --title X <key>` discards the real key rather than failing on a fabricated `X`.

The other five surviving mutants the reviewer listed as minor (the "is a `<type>`, not a lesson" guard, the title-text dedupe, `lesson-stage`'s unknown-id message, the lesson item's `origin`, and the accept fast-path guards emitting slightly different strings than `derive.ts` for the same condition) were **not** fixed in this pass — each would need its own dedicated assertion (and in the "slightly different strings" case, a judgment call about whether the CLI-level and `derive.ts`-level messages should even be made to match, since they're deliberately two independent layers). Left for a follow-up if the coordinator wants them closed; not done here to keep this round's diff scoped to what was explicitly required plus the one cheap fix.

### The framing correction the reviewer required (not a code fix — a correction to my own account)

My round-1 report described the hand-forged-staging-file attack as "a documented, pre-existing Task 8 boundary." **That framing was wrong, and I'm replacing it, not just appending a caveat:**

In Task 8, that was true — nothing imported `acceptStagedRule`, so the hole belonged to a module nobody could call from outside its own tests. **Task 9 changes what the hole means**, because it wires up the exact three-command sequence that makes forging *unnecessary in the first place*. `buildRuleRequest`/`renderRuleRequest` (`src/lesson/derive.ts`) print, as part of the derivation request `mycontext lesson` hands to whatever model reads it: `Call back with: mycontext lesson-stage ${lesson.id} --stdin`. That's an instruction telling the model to shell out to this CLI. Any agent capable of following that instruction has a shell, and the same shell reaches `mycontext lesson-accept` — no forged file, no filesystem write outside the documented flow, required. `lesson` → `lesson-stage --stdin` → `lesson-accept <id> <key>` is the **documented happy path**, and every leg of it is Bash-reachable with no human in the loop.

So the accurate statement, replacing my round-1 one, is: **the gate now holds only if the agent's Bash surface excludes `mycontext lesson-accept` specifically — and nothing in this repo enforces or documents that exclusion.** `lesson-accept` is not reachable through the MCP tool surface (constraint 3, verified), but it is trivially reachable through the same Bash channel the derivation request itself instructs the model to use for `lesson-stage`. Nothing in this task's scope closes that (it isn't Task 9's job to sandbox Bash), and it wasn't closed by Task 8 either. The coordinator is carrying this to Task 16 as an explicit requirement, which is the right place for it — it needs a decision at the level of "what commands may an agent's shell access invoke at all," not a fix inside `lesson.ts`.

## Re-verification

- `node --test test/cli/lesson.test.ts` → **16/16 passing** (11 original + 5 new: 3 for the exit-code fix, 1 for the printing pin, 1 for the discard symmetry fix).
- `npx tsc --noEmit` → clean.
- `npm test`, run twice in full → **937/937 passing** both times (921 baseline + 16 in this file).
- Mutation testing: all 3 exit-code mutants killed, all 3 printing-block mutants killed (delete-block, drop-fields, swap-to-pre-edit), confirmed by reverting the source to a saved-clean copy between each and re-running the full `lesson.test.ts` file to confirm 16/16 after each restore.
- `git status --porcelain` → clean apart from `M src/cli/commands/lesson.ts`, `M test/cli/lesson.test.ts` (this report is untracked/gitignored under `.superpowers`, as in round 1).

## Concerns (round 2)

- The five "minor" mutants the reviewer listed beyond the discard-symmetry one were deliberately left unfixed this round (see "Minor" above) — flagging again here so they don't get lost.
- The corrected framing above is the one substantive thing I got wrong in round 1: I inherited Task 8's "this is that module's known boundary" language without checking whether Task 9 changed what was reachable. It did. The coordinator has this for Task 16; nothing further for me to do here except record it accurately, which this section now does.
