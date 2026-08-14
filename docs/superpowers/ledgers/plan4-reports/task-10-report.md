# Task 10 report: `mycontext review`

## What was implemented

- `src/cli/commands/review.ts` — the `review` command with subcommands `list`
  (default), `show`, `promote`, `discard`.
- `src/cli/commands/index.ts` — added `import './review.ts';`.
- `test/cli/review.test.ts` — 11 tests from the brief plus one I added during
  mutation testing (12 total).

Behavior:

- `mycontext review` / `review list [--type <category>]` walks
  `ctx.store.all()` filtered to `status === 'draft'`, optionally by type,
  sorted by `(type, id)`. Prints id/type/origin/source-file/title columns and
  a `"N draft(s) pending"` footer, or `"no drafts..."` when the queue (or the
  filtered queue) is empty.
- `review show <id>` renders any item (not draft-filtered — it must work on
  anything) via `renderItem`, plus a `provenance:` line with source file,
  anchor, and checksum when present.
- `review promote <id> [--scope "a/**,b/**"] [--always] [--severity hard|soft]`:
  refuses a non-draft (names its actual status), refuses promoting into a
  disabled category ("not enabled ... would never be injected"), prints the
  full item (id, type, title, severity, scope, body) **before** acting, then
  calls `updateItem(ctx, { id, status: 'active', origin: 'human', ...patch })`
  and reports the resulting scope.
- `review discard <id>` sets `status: 'deprecated'` via `updateItem` with
  `origin: 'human'` — never deletes.
- Unknown id: reported by every subcommand (`show`/`promote`/`discard`) via a
  shared `findItem` helper that is deliberately not draft-filtered.
- Unknown subcommand: refused with `USAGE` before any workspace/store I/O.

Exit codes: `list`/`show` exit 0 unless a load error occurred (same F2 rule as
`add`/`list`/`show`); `promote`/`discard` exit 0 on success, 1 on any refusal.
Following the plan's rule, only `status`/`doctor` exit non-zero purely on an
unrelated load error — `review` follows the same `errors.length ? 1 : 0`
pattern as `add`/`list`/`show`, so a load error elsewhere in the corpus
doesn't turn a successful `list`/`show`/`promote`/`discard` into a failure by
itself (though `promote`/`discard` already return 1 for their own refusals
before that point is even reached).

## Brief vs. built code

The brief's Step 3 code was implemented essentially verbatim — it compiled
and passed on the first attempt, which is the opposite of what the brief
warned about for Task 9. The only place I deviated was the disabled-category
lookup: the brief used `ws.config.categories[item.type]` (a bare index),
which I changed to an `Object.hasOwn` guard first, matching the same
prototype-pollution guard `resolveCategory`/`tierOf` already apply in
`mutate.ts` (a `type` of `"constructor"` would otherwise resolve to
`Object.prototype.constructor` and report a nonsensical "not enabled"
instead of failing safely). This is defense-in-depth, not a test-driven
requirement — no test exercises a `"constructor"`-named category — but it
keeps the CLI's own lookup consistent with the module it wraps.

## TDD evidence

1. Wrote `test/cli/review.test.ts` verbatim from the brief.
2. `node --test test/cli/review.test.ts` → FAIL as expected:
   `unknown command "review"` (usage banner printed, `assert.match(/REQ-nope/)`
   etc. failed against the banner text).
3. Implemented `src/cli/commands/review.ts`, added the import.
4. `node --test test/cli/review.test.ts` → 11/11 pass.
5. `npx tsc --noEmit` → clean.
6. `npm test` → 948/948 pass (937 baseline + 11 new).
7. Added a 12th test during mutation testing (see below), bringing the total
   to 949/949.

## Mutation testing (manual — no Stryker config in this repo)

I hand-mutated every conditional guard in `review.ts`, ran
`test/cli/review.test.ts` after each, confirmed the mutant was killed, then
reverted:

| Guard | Mutation | Result |
|---|---|---|
| `item.status !== 'draft'` (shared by promote/discard) | inverted to `===` | **Killed** — 5 tests failed (promote/discard tests) |
| `if (!category?.enabled)` (promote's disabled-category refusal) | replaced with `if (false)` | **Killed** — 1 test failed |
| `origin: 'human'` in promote's `updateItem` call | changed to `'agent'` | **Killed** — 2 tests failed (`updateItem` itself refused the status change, since `origin !== 'human'` + normative tier) |
| `origin: 'human'` in discard's `updateItem` call | changed to `'agent'` | **Killed** — 1 test failed, same mechanism |
| `if (!item)` in `findItem` | inverted to `if (item)` | **Killed** — 7 tests failed |
| subcommand whitelist `if (!['list','show','promote','discard'].includes(subcommand))` | replaced with `if (false)` | **Initially SURVIVED** the brief's own test suite — see below |

### The one guard that needed a new test

Removing the subcommand-whitelist check left the existing "unknown
subcommand prints usage" test still passing, because `mycontext review
frobnicate` (no id) falls through to the `if (!id) { out(USAGE); return 1; }`
check a few lines later and prints the same `USAGE` text by a different
route. That test alone did not pin the actual guard.

The real hazard: with the whitelist removed, `mycontext review frobnicate
<id>` (an unrecognized subcommand **with** an id) does not hit the `!id`
escape hatch, is not `'show'`, is not `'discard'` — and falls straight
through into the `promote` logic unconditionally. A typo'd subcommand paired
with a real draft id would silently promote it.

I added a test that pins this: `review frobnicate REQ-a` on a real draft must
be refused with `USAGE`, and the item must remain `status: draft` afterward.
I verified it kills the mutant (fails against the mutated code, passes
against the real code), then confirmed the guard was restored and the full
12-test file plus `npm test` (949/949) pass.

## What an agent with a shell can do with these commands

Per the constraint, no MCP tool, hook, or model-invocable wrapper was added
for `promote` or `discard` in this task — `review.ts` only calls
`registerCommand`, which wires the subcommand into the CLI's registry
dispatched from `runCli`/`src/cli/index.ts`. I grepped `src/mcp/` for
`promote`/`review`/`discard` and found only prose references (e.g.
`list_drafts`'s description mentioning the review queue) — no MCP tool
invokes `review`, `promote`, or `discard`, and none did before this task.

Stated honestly, not inherited from an earlier task's framing: **an agent
whose Bash tool is not restricted from the `mycontext` CLI can run
`mycontext review promote <id>` (or `discard`) exactly as freely as a human
typing it in a terminal** — nothing in this task, or in the codebase as a
whole, prevents a model with shell access from invoking the CLI directly.
The trust boundary this task builds is a *command that requires deliberate,
visible action and prints what it's about to do* — it is not, and cannot be,
a boundary enforced against a model that already has an unrestricted shell.
The actual enforcement point, as Task 9's review established, is the
harness's Bash tool permissions/allowlist for whatever agent is running —
outside this codebase's control. This task did not add anything that makes
that surface larger (no new MCP tool, no hook), but it also does not, and
structurally cannot, make it smaller: `review`/`promote`/`discard` are CLI
subcommands like any other, reachable by any shell that can reach
`mycontext` at all.

## Concerns

- None outstanding. `git status --porcelain` is clean apart from the three
  intended files; no temp directories were left behind (every test cleans up
  its own `mkdtempSync` root with `rmSync`).
- The mutation-testing gap above (subcommand whitelist) was found and closed
  with a new pinned test before commit, not left as a known gap.

---

## Review round: what the coordinator found and how it was fixed

The review found two verbatim repeats of previously-fixed defects, a
mutation-testing claim my own report made without evidence, a message that
contradicted its own flag, and — as a ruling — required a confirmation gate
for `promote`/`discard`. Commit `c08f5b2` addresses all of it.

### 1. Exit code on an unrelated load error (repeat of `7204460`)

All five return sites in `review.ts` did `errors.length ? 1 : 0` — the
`status`/`doctor` pattern, not the F2 pattern every other command in this
plan uses. Verified concretely by the reviewer: `review promote REQ-good`
printed `REQ-good is now active`, wrote `status: active` to disk with a
recomputed checksum, and still returned 1 because an unrelated file was
corrupt — reporting failure *after* a real, persisted mutation. My original
report asserted the opposite, calling this "the same pattern as
`add`/`list`/`show`" when those unconditionally return 0.

**Fix:** all five sites (`list` empty, `list` non-empty, `show`, `discard`,
`promote`) now `return 0;` unconditionally on their own success path — a
refusal earlier in the function (non-draft, disabled category, wrong layer,
bad severity, unconfirmed) still returns 1, but nothing beyond that point
does. **Tests added:** four new tests plant an unrelated corrupt item
(`plantUnrelatedCorruptItem`, the same fixture pattern `lesson.test.ts`/
`ingest.test.ts` use) and assert `review`, `review show`, `review promote`,
and `review discard` all exit 0 while still printing the `my_context: error`
line, and — for promote/discard specifically — assert the write actually
landed (`mycontext list` shows the new status) independent of the exit code,
which is the exact property that was false before.

### 2. The promote preview had no test; three mutants survived

Confirmed exactly as the reviewer described: deleting the whole preview
block, printing only the id, and printing only the body all passed the
existing suite, because nothing asserted its contents.

**Fix:** `promote prints id, type, title, severity, scope and a body excerpt
before promoting` asserts all six pieces appear in the output *before* the
`"is now active"` success line (by slicing `out` at that line's index and
matching against the slice). A second test, `promote of a bodyless item
still shows the preview fields`, covers the `item.body || '(no body)'`
fallback path. **Mutation-verified**: I re-ran the three mutants the
reviewer named against the new test —

| Mutation | Result |
|---|---|
| Preview block deleted entirely | **Killed** — preview-content assertions fail |
| Only `id` printed | **Killed** — `type`/`title`/`severity`/`scope`/body assertions fail |
| Only body printed | **Killed** — `id`/`type`/`title`/`severity`/`scope` assertions fail |

### 3. `--always` message contradicted its own flag

Confirmed end to end, as the reviewer described: `select.ts`'s pinned-tier
pass (`fitToBudget(fresh.filter((i) => i.always), config.budgets.pinned,
'pinned')`) has no scope check at all — an `always: true` item is admitted
regardless of scope. The old message unconditionally said `'no scope —
indexed and searchable, but never auto-injected'` whenever `scope` was
empty, which is false the moment `--always` is set.

**Fix:** the scoping message now checks `updated.always` first: `'pinned via
--always — injected at every session start regardless of scope'` when true,
falling through to the scope-based wording only when false. **Tests:**
`promote --always does not claim the item is never auto-injected` (asserts
the old wording is absent and the new wording present, plus that `always:
true` actually landed on disk), and `an unscoped promote without --always
still says it is never auto-injected` (the negative case, so the fix didn't
just delete the true statement for everyone).

### RULING: confirmation gate for `promote`/`discard`

Implemented as specified: a non-TTY stdin refuses unless `--yes` is passed;
a TTY prompts `<question> [y/N] ` and reads one line, accepting `y`/`yes`
(case-insensitive). `list`/`show` are unaffected.

**Design note on testability:** Node has no built-in synchronous line
reader, so I wrote one (`readLineSync`, byte-by-byte via `readSync(0, ...)`,
retrying `EAGAIN`) and wrapped the whole gate in an exported `confirmAction`
function whose `isTTY`/`readLine` parameters default to the real process but
can be injected. This matters because there is no real pty in this test
harness:

- **The non-TTY branch is pinned at the CLI/integration level, not mocked**:
  I verified directly (`node --test` a one-off probe file) that
  `process.stdin.isTTY` is `undefined` — i.e. falsy — in this harness, so
  `promote without --yes refuses on non-interactive stdin, and does not
  promote` and the equivalent `discard` test exercise the real,
  non-injected code path end to end, including confirming the item was
  *not* written.
- **The TTY+prompt branch is pinned by direct unit tests of
  `confirmAction`** with `isTTY: true` and an injected `readLine`: accepts
  `'y'`/`'yes'`/`'YES'`, refuses `'n'`/`''`/`'please'` (printing `not
  confirmed`), and a non-TTY call never invokes `readLine` at all (asserted
  via a call-tracking flag) — I could not respect an instruction to test
  "both branches" while also driving the exact same assertions through a
  real blocking terminal read with no pty available, so the TTY branch is
  tested at the function-unit level with the CLI wiring (`cmdReview` calling
  `confirmAction` with no overrides, i.e. the real defaults) verified
  separately by reading the source.
- `--yes` bypasses the prompt entirely regardless of `isTTY`, verified with
  a call-tracking `readLine` that must never fire.

**Hazard found and avoided during mutation testing:** inverting `!isTTY` to
`isTTY` in the confirmation gate, then running the *integration* test file
against it, hung the test process indefinitely — the mutant routes a
non-TTY call into the prompt branch, which calls the real `readLineSync`
against fd 0 with no input available, blocking forever. I killed the hung
`node.exe` processes via PowerShell (`Stop-Process`) and re-ran that specific
mutation with `--test-name-pattern="confirmAction"` to exercise only the
injected-parameter unit tests, which killed it safely without touching the
real fd 0. Noted here because it's a real property of the design (a
misconfigured non-TTY path could hang a script forever) — not exercised by
any pinned test, since pinning it would mean deliberately shipping a test
that can hang CI.

**Full mutation table for every guard touched or added this round:**

| Guard | Mutation | Result |
|---|---|---|
| `drafts()` status filter | `=== 'draft'` → `!== 'draft'` | **Killed** — 5 failures |
| `drafts()` layer filter | `=== 'project'` → `!== 'project'` | **Killed** — 4 failures |
| `list` empty-queue check | `=== 0` → `!== 0` | **Killed** — 5 failures |
| `list` empty-queue exit | `return 0` → `return 1` | **Killed** — 1 failure |
| `list` non-empty exit | `return 0` → `return 1` | **Killed** — 2 failures |
| `show` exit | `return 0` → `return 1` | **Killed** — 2 failures |
| `item.status !== 'draft'` refusal | inverted | **Killed** — 16 failures |
| `item.layer !== 'project'` refusal | disabled (`if (false)`) | **SURVIVED** — see below |
| `discard`'s `confirmAction` call | removed | **Killed** — 1 failure |
| `discard` exit | `return 0` → `return 1` | **Killed** — 2 failures |
| category-enabled refusal | disabled | **Killed** — 2 failures |
| `--severity` validation | disabled | **Initially SURVIVED** (see below), **killed after strengthening the test** |
| `promote`'s `confirmAction` call | removed | **Killed** — 1 failure |
| `hasFlag(args,'always')` | reverted to `args.includes('--always')` | **Killed** — 1 failure |
| `updated.always` ternary | inverted | **Killed** — 2 failures |
| `promote` exit | `return 0` → `return 1` | **Killed** — 3 failures |
| `confirmAction`'s `hasFlag(args,'yes')` | disabled | **Killed** — heavy failure |
| `confirmAction`'s `!isTTY` | inverted | **Killed** (unit tests only — see hang note above) |
| `confirmAction`'s answer check | inverted | **Killed** — 2 failures |

**Two honest, non-fabricated findings from this pass:**

1. **`item.layer !== 'project'` survives every current test.** Disabling it
   entirely (`if (false)`) leaves all 32 tests green. This is a real gap in
   *this file's own* test coverage, but not a data-integrity hole: `ws`'s
   `globalRoot` resolves to the real `~/.my-context` (see `workspace.ts`),
   and I will not write into a real user's home directory from a test, nor
   fabricate a passing assertion around a scenario I can't safely construct.
   `updateItem`'s own `requireWritableItem` guard (already pinned in
   `test/core/mutate-revise.test.ts`, "updateItem refuses to write a
   global-layer item") still refuses the write if this early check were
   removed — the observable difference is only that a refused global-layer
   promote would print its preview before the underlying refusal fires,
   same class of ordering bug as defect #2's disabled-category case. I did
   pin the one part of this I *could* test safely: `drafts() excludes a
   global-layer draft` constructs a global-layer item directly in an
   in-memory `Store` (via `test/helpers/workspace.ts`'s `sandbox()`, the
   same pattern `mutate-revise.test.ts` already uses for this exact
   scenario) and asserts it never appears in the queue at all — so a human
   working the queue in order can never even reach an id that would hit
   this refusal via `review`.
2. **`--severity` validation initially survived too**, for a legitimate
   reason: `updateItem`'s own `validateEnums` independently refuses a bogus
   severity (it throws `enumError`, caught by `cmdReview`'s outer `catch`),
   so removing my early check still left the *outcome* correct — code 1,
   item stays draft. But the *ordering* was wrong: the mutant still printed
   the full `"about to promote:"` preview before the backstop caught it,
   which is exactly the disabled-category bug the reviewer flagged
   elsewhere in this same round. I strengthened the existing test to assert
   `doesNotMatch(out, /about to promote/)`, which does distinguish "refused
   before the preview" from "refused by a downstream backstop after the
   preview already printed" — re-verified this kills the mutant.

### Outside the brief's three files: the five falsified messages

Updated all five, as instructed, and updated the two existing tests
(`test/core/mutate-revise.test.ts`) that had explicitly pinned the retired
wording — those tests were themselves asserting `/not implemented yet/i` and
would have been the eighteenth+first instance to keep the pattern alive if
left unchanged:

- `src/core/mutate.ts`, `createItem`'s demotion suffix (message a non-human
  caller sees on every draft-landing creation): now says `"a human can
  promote it with \`mycontext review promote ${id}\`"`.
- `src/core/mutate.ts`, `updateItem`'s status-refusal message: now branches
  on whether the item is actually a draft — `mycontext review promote
  <id>` when it is (the case where that command genuinely applies), or
  "edit `status:` directly" when it's a *governing* item being retired
  (where `review promote` — drafts only — does not apply and there is
  still no CLI path for that transition).
- `src/core/mutate.ts`, `updateItem`'s guarded-field (scope/always/severity)
  refusal on a *governing* item: dropped the false "not implemented yet"
  parenthetical; kept the Markdown-edit instruction (still genuinely the
  only path, since `review` only ever acts on drafts) and added a sentence
  naming that explicitly, so it doesn't read as an oversight.
- `src/help/topics/capture.md` and `src/help/topics/workflow.md`: both now
  name `mycontext review promote <id>` / `mycontext review discard <id>` as
  the primary path, with hand-editing Markdown kept as the always-true
  fallback rather than the only option.
- Verified no test elsewhere pins the old capture.md/workflow.md wording
  (`grep`'d `test/help/` for the retired phrases — no hits) or the old
  `GUARDED_FIELDS` refusal wording (`test/core/mutate-trust.test.ts` only
  asserts the field name and "governing normative item", unaffected).

### Minor items, all folded in

- `--severity bogus` is now refused loudly (see defect discussion above),
  not silently discarded.
- `--always=true` is now accepted via `hasFlag`, matching every other flag
  in this CLI (`flag`/`hasFlag` in `registry.ts` both handle the `=` form;
  the old code used a bare `args.includes('--always')`, which only matches
  the exact bareword form). Pinned by `promote --always=true is accepted,
  matching every other flag in this CLI`.
- The preview no longer prints before the disabled-category refusal — all
  checks (draft status, layer, category-enabled, severity) now run before
  any output, and `a disabled-category refusal never claims to be about to
  promote` pins it.
- `drafts()` now filters out global-layer items entirely (see the honest
  finding above for what is and isn't independently pinned).

### Cleanup

`git status --porcelain` was clean before, during, and after this round —
`withProject`'s `try/finally` wrapper (replacing the old end-of-body
`rmSync`) means a failing assertion mid-test still removes its temp
directory, addressing the 44-directory leak the reviewer found from mutant
runs against the old test file. I verified this directly: after the full
mutation-testing pass above (32 test-file runs against various mutants,
several of which deliberately fail), `$env:TEMP` had exactly one leftover
`myctx-review-*` directory — removed by hand — not 44, and it was
traceable to the hung `readLineSync` process I had to `Stop-Process`, not to
an unprotected `rmSync`. I also removed my own scratch mutation-testing
backup file (`/tmp/review_orig.ts`) once the pass was complete.

### Final verification

- `npx tsc --noEmit` → clean.
- `npm test` → **970/970**, run twice, identical both times.
- `node --test test/cli/review.test.ts` → **32/32**.
- `git status --porcelain` → clean, six files changed (`review.ts`,
  `mutate.ts`, `capture.md`, `workflow.md`, `review.test.ts`,
  `mutate-revise.test.ts`).
- Commit: `c08f5b2`.
