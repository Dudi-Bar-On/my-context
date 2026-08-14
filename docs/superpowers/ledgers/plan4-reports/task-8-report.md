# Task 8 report: Lessons to rules, behind the approval gate

## What was implemented

`src/lesson/derive.ts` (new) with:
- `RULE_REQUEST_PROTOCOL`, `STAGING_PROTOCOL` protocol strings.
- `RuleCandidate`, `StagedRule`, `LessonStaging` types.
- `stagingDir`, `loadStaging`, `saveStaging`, `listStaging` — file-backed working state under `<root>/.staging/`, one JSON file per lesson id, gitignored via a `.gitignore` written into that directory on first use.
- `buildRuleRequest`/`renderRuleRequest` — builds and renders the extraction request handed to a model, naming the lesson, demanding `do`/`dont` form, and stating explicitly that nothing returned is applied without approval.
- `validateRuleCandidates` — validates a raw payload into `RuleCandidate[]` plus `ValidationIssue[]`, checking shape, `directive` enum, title length, and scope (POSIX-only, rejects bare `**`/`*`/`**/*`).
- `stageRuleCandidates` — validates and writes only to `.staging/`; never touches `items/`, never calls `createItem`. Re-staging a lesson keeps only the previously `accepted`/`discarded` candidates and replaces the `pending` set rather than appending to it.
- `acceptStagedRule` — the only function in this module (or reachable from it) that calls `createItem`. It looks up the candidate by key in the **passed-in** `staging` object, refuses an unknown key (naming the real keys), refuses `accepted` and `discarded` states, applies optional `edits`, and creates the rule with `status: 'active'`, `origin: 'human'`, `extra: { directive }`, and a single `derived_from` relation pointing at the lesson. Nothing is written onto the lesson.
- `discardStagedRule` — marks a candidate `discarded`, refusing to discard an already-`accepted` one.

Files touched: `src/lesson/derive.ts`, `test/lesson/derive.test.ts` (both new). No other file was modified.

## TDD evidence

1. Wrote `test/lesson/derive.test.ts` verbatim from the brief.
2. `node --test test/lesson/derive.test.ts` before implementation: **FAIL — `ERR_MODULE_NOT_FOUND`** for `src/lesson/derive.ts` (module did not exist). Correct failure reason.
3. Implemented `src/lesson/derive.ts` verbatim from the brief (verified against actual source first — see below).
4. `node --test test/lesson/derive.test.ts`: **17/17 pass**.
5. `npx tsc --noEmit`: clean, no output.
6. `npm test`: **907/907 pass** (baseline 890 + 17 new = 907, exact match).

## Brief vs. built code — verification before transcribing

Read `src/core/mutate.ts`, `src/core/config.ts`, `src/core/slug.ts`, `src/core/types.ts`, `src/ingest/schema.ts`, `src/core/categories.ts`, `src/core/teach.ts`, and `src/mcp/tools.ts` before writing anything. Confirmed:
- `MutationResult` has no `.item` (`{id, created, status, filePath, message}`) — the test fixture correctly does `createItem(...).id` then `ctx.store.get(lessonId)`.
- `trustedStatus(origin, tier, requested)` forces `draft` whenever `origin !== 'human'` and `tier === 'normative'`; `rule` is declared `normative` in `src/core/categories.ts`. `origin: 'human'` in `acceptStagedRule` is therefore required, not optional, to land `active`.
- `RELATION_TYPES` (`mutate.ts`) is `['derived_from', 'constrains', 'supersedes', 'blocks', 'mitigates', 'refines', 'relates_to', 'links_to']` — `produced_rule` is absent, confirming no reverse edge could be written even if attempted, and `linkItems` was correctly not used at all (only `createItem`'s own `relations` array, validated by `validateRelations`/`validateRelationTarget`, which accepts any of these types with no enum check inside `createItem` itself — the check lives in `linkItems`, but `createItem` doesn't validate relation *type* against the enum, only the *target* shape; this task's code only ever writes `derived_from`, so it's moot here).
- `createItem`'s `CreateInput.id` is honored (not always auto-derived) — used to mint `makeId(prefix, merged.title)` explicitly so `acceptStagedRule` controls the rule's id deterministically from the (possibly edited) title.
- `linkItems(ctx, {from, to, relation})` (single-object signature) was confirmed and specifically **not used** — the brief's claim that this task needs no `linkItems` call at all is correct; the `derived_from` edge is written directly in the `relations` array passed to `createItem`.

No disagreement found between the brief and the built code; every value used was verbatim and verified.

## Mutation testing — every guard in `acceptStagedRule`/`discardStagedRule`/`stageRuleCandidates`

All mutations applied to `src/lesson/derive.ts`, `node --test test/lesson/derive.test.ts` run, then reverted (verified `git status --porcelain` returns only the two intended new files after each revert):

| # | Mutation | Result |
|---|---|---|
| 1 | `origin: 'human'` → `origin: 'agent'` in the `createItem` call inside `acceptStagedRule` | **Killed** — "the accepted rule is active" test failed: `actual: 'draft', expected: 'active'` |
| 2 | Disabled the `staged.state === 'accepted'` guard (`if (false)`) | **Killed** — "accepting twice is refused" failed (no exception thrown) |
| 3 | Disabled the `staged.state === 'discarded'` guard (`if (false)`) | **Killed** — "a discarded candidate can never be accepted" failed (no exception thrown) |
| 4 | Changed the written relation type from `'derived_from'` to `'constrains'` | **Killed** — "accepting creates the rule with directive and a derived_from relation" failed (`actual: [], expected: [{type: 'derived_from', ...}]`) |
| 5 | Weakened `validateRuleCandidates`'s directive check from `!== 'do' && !== 'dont'` to `!== 'do'` (silently dropping `dont` candidates as invalid) | **Killed** — the INVARIANT test failed (wrong rule ended up accepted, since the `dont` candidate at index 1 was silently rejected and the array shifted) |
| 6 | Changed the initial `state` a freshly staged candidate gets from `'pending'` to `'accepted'` | **Killed** — multiple tests failed (`discardStagedRule`/`acceptStagedRule` both refused immediately, "already accepted as null") |
| 7 | In `stageRuleCandidates`, changed the `settled` filter from `state === 'accepted' \|\| 'discarded'` to keep everything (i.e., stopped dropping the old `pending` set on re-stage) | **Killed** — "re-staging the same lesson replaces the pending set rather than appending" failed (`2 !== 1`) |

Every guard I mutated died against the existing test suite. I did not find a surviving mutant.

## Probing the approval gate — what I tried

The brief's warning ("the trust boundary has been probed four times... a second write path, a missing origin argument, a guard that was private, a lock keyed on the wrong thing") pointed at specific classes of seam. I checked each:

1. **Can an agent stage a rule?** Yes, by design — `stageRuleCandidates` takes no origin/human-ness input at all and is meant to be callable from a model's own request/response loop. This is intentional: staging is inert. Confirmed by test ("staging writes nothing into items/") and by reading `stageRuleCandidates`'s body: it calls `validateRuleCandidates` and `saveStaging` only, no import of `createItem` anywhere in the module except inside `acceptStagedRule`.

2. **Can an agent accept its own staged rule (forge `origin: 'human'`)?** No — `acceptStagedRule` takes no `origin` parameter at all; the value is hardcoded in the `createItem` call. There is no argument surface through which a caller (agent or otherwise) can override it. Confirmed by reading the function signature and by mutation #1 above (changing the hardcoded value is the only way to change the outcome, and doing so is caught immediately by the test suite).

3. **Can an agent reach `createItem` with `origin: 'human'` through any other path this task adds?** No new path exists: `derive.ts` calls `createItem` from exactly one call site (inside `acceptStagedRule`), and that is the only place in the whole module that imports and calls it.

4. **Is `src/lesson/derive.ts` wired into the MCP tool surface an agent can call today?** I grepped `src/mcp/tools.ts` and `src/mcp/protocol.ts` for `lesson`/`derive` — the only hit was the unrelated word "derived" in a comment. **No MCP tool exposes any function from this module.** As of this task, the only caller of `acceptStagedRule` in the whole repository is the test file. This means the approval gate is currently airtight by simple absence of any agent-reachable entry point — task 9 (the `mycontext lesson-*` CLI commands) is what will wire a human-run CLI command to this module, and that wiring is where the gate's real-world integrity will actually be tested.

5. **Concrete forgery attempt: fabricate an in-memory `LessonStaging` never written to disk, then call `acceptStagedRule` directly.** I wrote a throwaway script (`probe-gate.mjs`, deleted after use, not committed — `git status --porcelain` confirmed clean before commit) that built a `LessonStaging` object by hand, with a `pending` candidate that was never produced by `stageRuleCandidates` and never touched `.staging/` on disk, and called `acceptStagedRule(ctx, fakeStaging, 'forged01')` directly. **This succeeded** — it created an `active`, `origin: 'human'` rule from a payload that never went through `stageRuleCandidates` or any staged-and-reviewed workflow at all.

   This is a real seam, structurally identical in kind to the ones the brief warned about ("a second write path"), but it is not a defect in *this* task's code: `acceptStagedRule`'s contract, per the brief and the interface list, is to operate on a `LessonStaging` value the caller already has in hand — it is not specified to re-validate that value against `loadStaging(root, staging.lessonId)`. The actual gate the brief describes ("reachable only from the explicit `mycontext lesson-accept` command") is a property of **how task 9's CLI command is wired**, not of this module in isolation: as long as `mycontext lesson-accept` always does `loadStaging` → `acceptStagedRule` → `saveStaging` and never accepts a serialized staging blob as an argument from anything an agent could construct, the gate holds. If a future MCP tool or CLI surface were ever built that accepts a `staging` JSON blob as an argument (rather than loading it from disk itself), that would reopen exactly this hole. **I am flagging this for task 9's implementer and for review**, since it is precisely the "second write path" and "guard that was private" pattern this project has hit before — here the risk is latent rather than currently exploitable, because no such surface exists yet.

6. **Does the trust model treat `derive.ts`'s writes consistently with the rest of the codebase?** Cross-checked `src/mcp/tools.ts`: every MCP tool handler that writes (`create_item`, `update_item`, `supersede_item`) hardcodes `origin: 'agent'` server-side, with an explicit comment stating the schema never accepts `origin` from the model — so an agent cannot forge `origin: 'human'` through any existing MCP tool either. `acceptStagedRule`'s hardcoded `origin: 'human'` is consistent with this same pattern, and (per point 4) is not currently exposed to any MCP tool.

## Cleanup

`probe-gate.mjs` (the ad hoc forgery script from point 5 above) was deleted after use. `git status --porcelain` was empty except for the two new files (`src/lesson/derive.ts`, `test/lesson/derive.test.ts`) before staging and committing them.

## Concerns

- The seam described in point 5 above (`acceptStagedRule` trusts its `staging` argument rather than re-reading `.staging/<lessonId>.json` from disk) is not exploitable today because nothing agent-reachable calls this module yet, but it is worth deciding explicitly in task 9: should `acceptStagedRule` (or the CLI command wrapping it) always re-derive `staging` from `loadStaging` rather than accepting a caller-supplied object, to remove the seam structurally rather than by convention? I did not change `derive.ts` to do this myself because the brief's interface (`acceptStagedRule(ctx, staging, key, edits?)`) takes the staging value directly by design — matching the given signature — and the actual test suite (which constructs `staging` via `stageRuleCandidates`'s own return value in every test) does not require or exercise a disk-reload. Flagging rather than silently deviating from the specified interface.
- `RULE_CANDIDATE_SCHEMA`'s bare-glob rejection (`**`, `*`, `**/*`) and backslash rejection in `validateRuleCandidates` are implemented (mirroring the equivalent ingest-schema checks) but have no dedicated test in the brief's test file; I did not add tests beyond the brief's list per the "do not dispatch subagents / follow the brief" instruction, but this is a coverage gap worth knowing about, not a functional gap — the guard code was copied from `mutate.ts`'s title/scope validators' documented failure modes.

---

## Addendum: response to review (commit `c55ef72babf38c23c67f4001faf8a476ab1b10ab`)

The review's forgery finding was correct and went further than what I reported: a hand-built `LessonStaging` never written to disk produced a live `active` rule with `origin: 'human'`, a file on disk, and a `derived_from` edge pointing at a nonexistent lesson — with `.staging/` never even created. I had only reported that the gate held "by absence" (nothing calls the module yet); the review is right that this is one wiring mistake in Task 9 away from being false, and that the module itself should not depend on Task 9 getting the wiring right.

### What changed

1. **`acceptStagedRule`/`discardStagedRule` no longer take a `LessonStaging` value from the caller.** New signatures:
   - `acceptStagedRule(ctx, root, lessonId, key, edits?)`
   - `discardStagedRule(root, lessonId, key)` → returns the updated `LessonStaging`

   Both load staging themselves via a new internal `loadOrThrowStaging(root, lessonId)`, which throws if no staging file exists for that lesson, and throws if `staging.protocol !== STAGING_PROTOCOL`. A forged or corrupt staging blob can no longer be handed in directly — there is no parameter through which to hand one in at all.

2. **`acceptStagedRule` now checks `ctx.store.get(lessonId)` before creating anything**, refusing to derive a rule from a lesson id that does not exist in the index (the scenario the review's forgery used).

3. **Both functions persist the state transition with `saveStaging` before returning.** Previously `staged.state = 'accepted'` only mutated the in-memory object the caller happened to pass in; `loadStaging` right after a successful accept still showed `pending`/`ruleId: null`. Now every accept/discard is durable, and "already accepted"/"discarded and cannot be accepted" hold across separate calls with no shared object — the test `accepting twice is refused rather than duplicating — persisted across separate calls` makes two independent `acceptStagedRule` calls with nothing but `(root, lessonId, key)` in common.

4. **`edits` are re-validated.** `acceptStagedRule` merges `edits` onto the staged candidate and runs the result through `validateRuleCandidates` before use; a merged candidate with `scope: ['**']` or `directive: 'maybe'` is rejected with the same message a fresh candidate would get, and nothing is created. New test: `an edit cannot smuggle in a bare scope glob or an invalid directive`.

5. **Comments corrected**, not softened:
   - `createItem`'s `validateRelations` checks only relation *targets*, never types — the closed `RELATION_TYPES` enum is enforced solely by `linkItems`, which this path never calls. The `derived_from`-only comment now says "the only edge we write," not "the only one that could be written."
   - Removed the claim that `stageRuleCandidates` "does not import anything that can write to items/" (the module imports `createItem` at the top; functions don't have per-function import scopes) — replaced with the accurate claim that it never *calls* `createItem`, and that `acceptStagedRule` is the module's one call site.
   - "called only from `mycontext lesson-accept`" is now stated as an intention this module cannot itself enforce, not as an established fact — since, as of this commit, nothing calls it at all.

6. **`stagingFile` now rejects any `lessonId` that isn't `[A-Za-z0-9._-]+`.** Task 9 takes a lesson id from argv; without this, `loadStaging(root, '../../evil')` would read an arbitrary JSON file relative to `.staging/`. New test: `a lesson id containing a path separator is refused rather than escaping .staging/`.

7. **Candidate keys now hash full candidate content** (`directive`, `title`, `body`, sorted `scope`, `severity`), not just `directive|title`. Two candidates sharing a title and directive but differing in body previously collided onto one key; `Array.prototype.find` always resolves to the first, so the second could never be independently accepted or discarded. New test confirms distinct keys for such a pair; two candidates whose content is genuinely identical still collapse onto one key, which is correct (they're the same candidate).

### New tests (12 added, 17 → 29 in this file)

- `the rendered request includes readable prose instructions above the JSON payload` — counts hyphen-prefixed lines in the prose section *before* the ```json fence, so a mutant that drops the bullet-rendering step (leaving only the embedded JSON, which every prior assertion could already see) is caught. This kills the reported `renderRuleRequest` survivor.
- `a hard-severity candidate round-trips through validation, staging and acceptance` — kills the reported "severity always `'soft'`" survivor.
- `a title over 200 characters is rejected at exactly the documented limit` (title length 201) — kills the reported `> 200` → `> 2000` survivor.
- `a bare "**" scope glob on a rule candidate is rejected` / `a backslash scope glob on a rule candidate is rejected` — closes the coverage gap I had flagged but not filled in the original submission.
- `two candidates sharing a title and directive but differing content get distinct keys` — covers the "minor" key-collision finding.
- `an edit cannot smuggle in a bare scope glob or an invalid directive` — covers finding 4.
- `accepting against a lesson with no staged candidates on disk is refused` — covers the no-staging-file case of the new `loadOrThrowStaging`.
- `a hand-crafted staging file for a lesson that does not exist is refused` — reproduces the review's exact forgery scenario (built via the module's own `saveStaging`, not a bypass) and asserts it is now refused.
- `a staging file with the wrong protocol is refused rather than trusted` — covers the protocol check.
- `a lesson id containing a path separator is refused rather than escaping .staging/` — covers the path-traversal fix.
- `discarding an already-accepted candidate is refused` — the reported `discardStagedRule` survivor; no prior test ever discarded an already-accepted candidate.
- `accepting twice is refused rather than duplicating — persisted across separate calls` — renamed/strengthened from the original to make explicit that it is testing cross-call persistence, not an in-memory guard.

### Mutation testing (this round)

Re-ran the seven mutations from the original submission (all still killed after the refactor — full mutate/run/revert log in the earlier section of this report) plus these new ones, each applied, run against `node --test test/lesson/derive.test.ts`, observed to fail, then reverted (`git status --porcelain` empty apart from the two intended files before each commit):

| Mutation | Result |
|---|---|
| Disable protocol check in `loadOrThrowStaging` | **Killed** — "wrong protocol is refused" failed |
| Disable lesson-existence check in `acceptStagedRule` | **Killed** — "hand-crafted staging file for a lesson that does not exist" failed |
| Remove `saveStaging` call at the end of `acceptStagedRule` | **Killed** — "accepting twice… persisted across separate calls" and "discarding an already-accepted candidate" both failed |
| Remove `saveStaging` call at the end of `discardStagedRule` | **Killed** — "a discarded candidate can never be accepted" failed |
| Skip `validateRuleCandidates` on the merged edit | **Killed** — "an edit cannot smuggle in a bare scope glob" failed |
| Disable the `LESSON_ID_RE` check in `stagingFile` | **Killed** — "a lesson id containing a path separator…" failed |
| Revert `candidateKey` to the old `directive\|title` hash | **Killed** — "two candidates sharing a title and directive… distinct keys" failed |
| `renderRuleRequest` drops the instruction-bullet block | **Killed** (new test) |
| `title.length > 200` → `> 2000` | **Killed** (new test) |
| `severity` forced to `'soft'` unconditionally | **Killed** (new test) |
| `discardStagedRule`'s already-accepted guard disabled | **Killed** (new test) |

All eleven mutants died. I did not find a surviving mutant in this round.

### `npm test` (full suite, twice)

Both runs: **919/919 pass** (890 original baseline + 29 in `test/lesson/derive.test.ts`). `npx tsc --noEmit`: clean. `git status --porcelain` after commit: clean.

### What I now believe is required of Task 9

The `loadStaging`-internally fix changes the contract Task 9's CLI commands must honor:

- **`mycontext lesson-accept <lessonId> <key> [--edit ...]`** must call `acceptStagedRule(ctx, root, lessonId, key, edits?)` — it no longer needs to (and no longer can) load a `LessonStaging` itself and pass it in; `acceptStagedRule` does that internally now. This is strictly simpler for the CLI to get right: there is no longer a "load staging, then pass the object" step where a caller could substitute a different object than the one just loaded.
- **`mycontext lesson-discard <lessonId> <key>`** must call `discardStagedRule(root, lessonId, key)` and can discard its return value or use it to print the resulting state — again, no staging object to mishandle.
- Neither command should accept a serialized staging blob as an argument from anywhere (stdin, a flag, etc.) that could stand in for what `loadOrThrowStaging` would have loaded from disk — doing so would reopen exactly the seam this commit closes, just one layer up. The `lessonId` and `key` are the only staging-related inputs either command should need to take.
- `mycontext lesson-stage <lessonId> --stdin` (which calls `stageRuleCandidates`) is unaffected by this commit's signature changes — it still takes `(root, lesson, raw)`, where `lesson` is a real `Item` the CLI must look up via `ctx.store.get(lessonId)` (and refuse if missing) before staging, the same existence check `acceptStagedRule` now performs internally at accept time.
- Task 9 should NOT re-introduce a "resolve staging once, pass it to multiple functions" pattern for accept/discard — each call re-reads and re-verifies from disk by design now, and that redundancy is the fix, not an inefficiency to remove.

---

## Addendum 2: response to second re-review (commit `4c95c025a53f866a26985927ddc788682eeeff43`)

### The required fix

`saveStaging` derives the on-disk filename from `staging.lessonId` (the object's own field); `loadOrThrowStaging` looked the file up by the `lessonId` **argument**. Nothing checked the two agreed. A staging file living at `.staging/<real-lesson>.json` whose internal `lessonId` field named a *different* lesson would load successfully (right protocol, right shape), and `acceptStagedRule` would then: create the rule using the argument lesson for the existence check but `staging.lessonId` for the `derived_from` target and, critically, call `saveStaging(root, staging)` at the end — which writes to `stagingFile(root, staging.lessonId)`, i.e. a **different file** than the one just loaded. The original file (`<real-lesson>.json`) was never touched and stayed `pending`, so a second accept against it would succeed again, and a stray `.staging/<other-id>.json` was left behind.

Fixed in `loadOrThrowStaging`: after the protocol check, `if (staging.lessonId !== lessonId) throw ...`, naming both the argument and the file's own field in the message. Also changed `acceptStagedRule` to read the `lessonId` **argument** — not `staging.lessonId` — for both the existence check and the `derived_from` relation target, so there is one source of truth rather than two fields the identity check merely happens to keep in sync.

New test: `a staging file whose filename and internal lessonId disagree is refused`. Since no legitimate call path can produce this mismatch (`saveStaging` always names the file after `staging.lessonId`, and `stageRuleCandidates` always sets that field to the lesson it was called with), the test builds it the only way it can occur: stage legitimately against a real lesson (producing a correct file), then overwrite that exact file on disk with a copy whose `lessonId` field has been changed to a second, different, real lesson. This is a direct simulation of the report's threat model — anything else with write access to `.staging/` — not an API bypass.

Also fixed: an unparseable (corrupt) staging file was previously reported identically to a missing one ("no staged rule candidates found"). `loadOrThrowStaging` now reads the file and JSON-parses it itself (rather than delegating to `loadStaging`, which swallows a parse failure into `null`), and reports a parse failure with its own message naming the underlying error. New test: `a staging file that is not valid JSON is refused as corrupt, not as merely missing`.

### Comments folded in (same defect class as the F3 round)

- `loadOrThrowStaging`'s comment previously claimed it prevents a stray or hand-crafted JSON file from being "mistaken for real staged state" — false: a hand-written `.staging/<realLessonId>.json` with the correct protocol and a matching `lessonId` (i.e., shape-valid but fully fabricated) is still accepted, and produces a live `active` rule. The comment now says precisely what is checked (missing file, parse failure, wrong protocol, filename/lessonId mismatch) and states explicitly that this function cannot and does not verify provenance — the staging directory is unauthenticated working state.
- `LESSON_ID_RE`'s comment claimed it rejects an id containing `..` — false: `..` matches `^[A-Za-z0-9._-]+$` (both characters are in the allowed set) and is not refused. It is harmless only because `stagingFile` always appends the id as one whole filename component (`${lessonId}.json`), never a directory segment, so there is no adjacent separator for `..` to act on. The comment now says this precisely instead of implying the pattern excludes `..`.
- `acceptStagedRule`'s comment claimed it "confirms the referenced lesson still exists" without specifying *which* lesson id. It now says explicitly that the check is on the `lessonId` **argument**, and that the argument and `staging.lessonId` are only guaranteed to agree because of `loadOrThrowStaging`'s new identity check — not because they always did.

### Mutation testing this round

| Mutation | Result |
|---|---|
| Disable the new `staging.lessonId !== lessonId` identity check | **Killed** — "a staging file whose filename and internal lessonId disagree is refused" failed |
| Disable the missing-file check (`!existsSync(file)`) | **Killed** — the "no staged candidates" test still throws, but with the wrong message (a raw `ENOENT` propagated from the JSON-parse try/catch instead), so the `/no staged rule candidates/i` assertion fails |
| Change the `derived_from` relation target from `lessonId` (argument) back to `staging.lessonId` | **Survives.** After the identity check, `staging.lessonId === lessonId` is guaranteed at every point either value is read in every test's execution path (the one test that constructs a mismatch throws at the identity check, before this line ever runs) — this mutant is behaviorally equivalent under current coverage, not merely untested. I could not construct a test that observes a difference without also being a test of the identity check itself. |
| Change the existence check from `ctx.store.get(lessonId)` back to `ctx.store.get(staging.lessonId)` | **Survives**, same reasoning as above — equivalent given the identity check's guarantee. |

I'm reporting the last two honestly as survivors rather than claiming a kill, because I could not reproduce the "both die" result the review described and don't want to assert something I didn't verify. My best explanation: sourcing both values from the `lessonId` argument (rather than `staging.lessonId`) is still the right defensive choice per constraint 5 — one value to reason about instead of two that happen to agree — but with the identity check in place, a test that distinguishes the two read-sites would need to observe a divergence that the identity check itself now makes unreachable. If a stronger test is wanted here, it would need to bypass or race the identity check somehow, which I don't believe is possible through this module's public surface as it now stands.

### `npm test` (full suite, twice)

Both runs: **921/921 pass** (890 baseline + 31 in `test/lesson/derive.test.ts`). `npx tsc --noEmit`: clean. `git status --porcelain` after commit: clean.

### The verdict on the gate (recorded verbatim per instruction)

**What now holds by construction:** no forgeable parameter, `origin: 'human'` unreachable from any argument, one `createItem` call site, durable state transitions, edits re-validated on the same path as fresh candidates.

**What does not:** the staging file is unauthenticated working state. Anything that can write `.my_context/.staging/*.json` — including any agent with file-write access — fully dictates what a subsequent accept creates. **So the gate that actually holds is "a human ran `lesson-accept` naming this specific key" — nothing more.** The module cannot attest that the candidate behind that key came from a model's response to a real lesson.

### Hard constraints on Task 9 (recorded per instruction)

1. Never accept a serialized staging blob, a staging file path, or a `--root` an agent chose. `lessonId` and `key` are the only staging inputs.
2. Never accept by key alone without **printing the candidate's full title, body, directive, scope and severity** for the human to see. Given the above, key-only acceptance means approving a hash, not a rule.
3. Never expose `lesson-accept`/`lesson-discard`, or any wrapper of `acceptStagedRule`, through the MCP surface, a hook, or anything a model can invoke. `lesson-stage` is fine to expose; accept is not.
4. Never re-introduce load-once-and-pass-around for accept/discard — the re-read is the fix.
5. Never derive the relation's `lessonId` from anything other than the same argument the existence check uses.

### Follow-ups recorded, not fixed (per instruction)

- Widening `LESSON_ID_RE` to `/^[^/\\]+$/` — a surviving mutant, not fixed.
- Deleting the `severity` enum check in `validateRuleCandidates` — a surviving mutant, not fixed.
- `listStaging`'s protocol filter — a surviving mutant, not fixed.
- The re-stage `settled` filter dropping `accepted` candidates on re-stage — a surviving mutant, and, per the review, directly on the trust boundary: re-staging is the reset button, and no test currently proves an `accepted` candidate survives a re-stage of its lesson. Not fixed.
- A non-array `scope` in `validateRuleCandidates` is silently coerced to `[]` rather than rejected — fails *inert* (an unscoped rule is not auto-injected), so not a gate defect, but a silent-failure UX defect worth an explicit reject. Not fixed.

I did not implement any of the five items above — they are recorded here as the coordinator instructed, for a future task/round to address.
