# 13 · The testing discipline

This project treats the shape of its own test suite as a governed thing, not
an afterthought a reviewer eyeballs. The suite's own rules — what a test must
declare, how a guard is proven to matter, how fixtures avoid touching real
state — are enforced by the same corpus/gate/checker machinery documented in
[03 · Creation and the gates](./03-creation-and-gates.md) and cited by item
id the same way everything else in this codebase is, per
`RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number`. Every
claim below is grounded in a file this pass actually read, or a command it
actually ran (output pasted verbatim and dated — 2026-09-12 originally, with
the counted ones re-run 2026-09-13 and re-dated in place). This chapter did
**not** run `npm test`, `npm run test:e2e`, or `npm run mutate` — those are
excluded by the constraints this whole documentation effort works under. What
follows comes from reading `test/`, `scripts/`, and `docs/mutation-testing.md`,
plus running the handful of `check:*` scripts that are pure read-only
checkers by their own design.

## Why this is documented as a capability

Three real incidents recur in the source comments read for this chapter, and
each produced one of the mechanisms below:

- A green suite that had silently run 2 of 4 test files, because an unquoted
  glob was reinterpreted by the OS shell (`RULE-quote-the-test-glob`) → the
  `check:test-glob` gate.
- 26 fixtures across ten files that went red when an admission rule was
  reversed, and **zero** named the rule they rested on — encoded as golden
  strings and bare numbers instead (commit `cdc9fd8`, `budget/16`) →
  `RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none` and the
  `@basis` declaration + `check:basis` gate.
- The same suite rendering box-drawing borders locally and ASCII on CI,
  because a rendering function read ambient terminal variables a developer's
  shell exports and CI's runner does not (run `31964855211`) → the rendering
  pin in `test/helpers/pin-rendering.ts`.

The common thread, stated in `scripts/check-test-glob.ts`'s own header: a
failure of this shape is invisible by construction — nothing in the output
says what was skipped or silently assumed, because from the runner's point of
view it was never asked. Each mechanism below exists to make one of these
failure modes visible instead of silent, which is the same "nothing is
dropped silently" instinct that governs the corpus itself (`INV-nothing-is-dropped-silently`).

## The rendering pin, and why `node --test` alone can lie

`test/helpers/pin-rendering.ts` is loaded via `--import` in the `test` script
(`package.json`: `"test": "node --import ./test/helpers/pin-rendering.ts --test \"test/**/*.test.ts\""`).
Node's `--test` runner spawns every test file with the same command-line
options, so this import runs before any test code does, in every process.

What it pins, read from the file itself:

```ts
process.env.MYCONTEXT_ASCII = '1';
delete process.env.MYCONTEXT_UNICODE;
delete process.env.MYCONTEXT_WIDTH;
installRealHomeGuard();
```

- **ASCII rendering, forced.** `supportsUnicode()` (`src/cli/commands/format.ts`)
  reads `WT_SESSION`, `TERM_PROGRAM`, `TERM` — a developer's interactive shell
  exports these, CI's bare runner does not — so the *same* table rendered
  box-drawing borders on a laptop and `|` characters on CI. A test asserting
  an exact phrase against those bytes was green everywhere a person could run
  it interactively and red on the one machine nobody watches. ASCII was
  chosen (not Unicode) because it is what CI already answered, so the pin
  changes nothing where the suite has to stay green, and it is the fallback
  rendering — the one a wrong assumption should be tested against.
- **`MYCONTEXT_WIDTH` deleted** for the same reason: a layout width a
  maintainer exported for their own terminal must not reshape the suite's
  expected output.
- **A pinned UI session store**, via `import './pin-sessions-dir.ts'` at the
  top of the file (ESM evaluates imports before any statement in the
  importing file runs, so the store is redirected before the home guard below
  snapshots the real home). Three UI test files were reaching the developer's
  real `~/.my-context` before this existed.
- **`installRealHomeGuard()`** turns "don't write outside the sandbox" from a
  convention a test author has to remember into a check: it snapshots the
  real global home directory *before* any test file's top-level code can
  redirect `HOME`, and fails the run if that directory changed — comparing
  the directory itself, not intercepting `fs`, so a write from a spawned
  child process is caught too. It exists because the convention alone failed
  twice: 134 tests went red on 2026-08-22 from two stray fixture files, and
  the session-store leak (above) nearly repeated it the next day.

**Why bare `node --test test/foo.test.ts` can report a false green** (or a
false red): it never loads this `--import`, so ASCII pinning, the sessions
redirect, and the real-home guard are all absent. A test whose expectations
implicitly depend on any of the three can pass locally under the harness and
fail — or worse, silently pass with wrong assumptions unguarded — run bare.
This is the standing project memory this documentation task itself was
briefed with: run single tests with the suite's own preload, not a bare
`node --test`.

**Use case.** Debugging one failing test: reach for
`node --import ./test/helpers/pin-rendering.ts --test test/cli/status.test.ts`,
not `node --test test/cli/status.test.ts` — the latter is not the same
environment the CI-gating run uses.

## Removal proofs, via mutation testing (`scripts/mutate.ts`)

`docs/mutation-testing.md` states the rule this project holds itself to in
its opening line: **"Every change here needs a test that fails without it."**
The way that is checked is mutation testing — break the guard on purpose, run
the test that is supposed to notice, put the file back — and the doc is
explicit that this must be done through the tool, never by hand:
`git checkout -- <file>` restores a path from the index and cannot tell a
mutant from an uncommitted fix living in the same file, which cost this
project real work: **"Seven escapes by this project's own count: three
agents lost work that way — one of them a full pass of README edits, costing
a whole task — and twice a probe was run against this repository's own
dogfooded corpus under `.my_context/`."**

**How to use it** (not run in this pass — it mutates a source file, even
though it restores it):

```
npm run mutate -- --file src/core/select.ts --from "seen.has(id)" --to "false" \
  -- node --test test/core/select.test.ts
```

The exit code *is* the verdict, so it composes with CI:

| Exit | Meaning |
|---|---|
| `0` | **KILLED** — the command failed with the guard broken. What you want. |
| `1` | **SURVIVED** — the command passed anyway. Nothing tests this line. |
| `2` | Refused before mutating; arguments were wrong. |
| `3` | Mutated, and the tree could not be restored — `--restore` retries. |
| `4` | **INCONCLUSIVE** — no verdict produced (crashed to start, or killed by signal); re-run, don't trust it. |

**What it refuses, precisely**, per the doc: a tree with any tracked change
(commit first — untracked files are fine, since nothing here writes to a path
it wasn't given, but an untracked *target* is refused because there'd be no
committed bytes behind it); anything under `.my_context/` or `.git/` (mutate
a temp workspace instead — `runCli(['init'], mkdtempSync(...))` is how the
whole suite does this); a `--from` that's missing or appears more than once
without `--all`; a mutation with no command or vice versa; and a run started
while an earlier mutation is still journalled as in-flight.

**How it restores**: the original bytes are held in memory *and* journalled
to `<git-dir>/mycontext-mutation.json` before a single file is written; the
restore rewrites those bytes and then verifies with `git status` that the
named paths came back clean, falling back to `git checkout <HEAD> -- <path>`
only after that verification has already failed, and only against paths the
run itself touched. `SIGINT`/`SIGTERM`/`SIGHUP` restore before exiting; a
harder kill leaves the journal behind, recoverable with
`npm run mutate -- --status` / `--restore`.

**What it does not do**: it does not sandbox the command you pass — "a
command that writes to your tree still writes to your tree."

**Use case**: proving a new guard actually guards something, as part of code
review — the doc's own multi-file example asserts one English and one Hebrew
string must break together (`README.md` / `docs/README.he.md`), because a
claim made in two places needs both copies broken in the same run or the
surviving copy keeps the suite green.

## `@basis` declarations, and the `check:basis` gate

**What a declaration is.** A one-line comment at the top of a test file's
header:

```ts
// @basis TASK-lesson-accept-creates-a-rule-with-no-summary-so-the-accept, STD-a-summary-is-one-plain-sentence-for-someone-who-does-not, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
```

(real line, `test/cli/lesson-accept-summary.test.ts:1`) — or, when a test
rests on nothing in the corpus:

```ts
// @basis none - pure parser mechanics
```

**Why it exists**, per `scripts/check-basis.ts`'s own header, which names the
exact measured cost: `budget/16` reversed one admission rule and reddened 26
fixtures across ten files. **Not one was a logic failure** — every one
asserted an absence the reversed rule had made true — and **zero named the
rule they rested on**. They encoded it instead: a golden string, a bare
`pinned: 1500`, an item titled "Only an index line", a helper comment with no
id in it. Nothing could search for what wasn't written down, and reading took
an hour to establish that none of the 26 was a real failure. Worse: of those
26, exactly *one* cited an item, and it cited the **wrong** one — a rule
still in force, while the assertion actually rested on the rule being
reversed. That was the most dangerous fixture in the set, because it *looked*
covered.

**Why `none` is a legal answer, deliberately**: the gate requires the
thought, never a link. If naming an item were mandatory, a writer under
deadline pressure would name the nearest plausible one — measurably worse
than admitting there's no ruling behind this test. A bare `none` still fails,
though: the reason must clear a floor of 3 words / 12 characters, set exactly
so the rule's own worked example (`none - pure parser mechanics`, 21
characters) passes and nothing shorter does (`n/a`, `none`, `todo`, `-` are
all refused). The gate does not judge whether the reason is *good* — only
that one was written.

**What gates vs. what only reports** — four tiers, read from `check-basis.ts`:
`MISSING` (no `@basis` line, outside the exemption baseline) and `MALFORMED`
(a declaration present but broken — two markers, an empty payload, an id-shaped
token that resolves to nothing) both set the exit code. `DANGLING` (an id
that answers to no corpus item) gates too. `RETIRED` (an id that resolves,
but to a superseded item) **only reports** — the file's own comment explains
why: "a test resting on a superseded ruling is often exactly right as
history," the same reasoning `check-cited-items.ts` uses for the identical
shape one layer over, after an owner ruling that a gate forcing 31 edits
would delete history just to go green.

**The exemption baseline** (`scripts/basis-undeclared.txt`): 490 test files
existed when the rule landed and six already declared a basis. Gating the
other 484 would produce exactly the fabricated declarations the rule exists
to prevent — an author asked today what a fixture written months ago rested
on will guess. So the baseline lists them as exempt, and the exemption is
*only* for silence: nine of those 484 were retrofitted anyway (the ones
commit `cdc9fd8` itself had to repair, so declaring them was reading, not
guessing) and the baseline may only shrink — enforced two ways:
`test/scripts/basis-gate.test.ts` pins its length as a ceiling, so a new file
smuggled onto the exemption list fails `npm test`, and removing a line
happens automatically the moment someone declares an old file's basis.

**What it cannot see, stated in its own header so the number isn't read
wider than it is**: a declaration says what a test *verifies*, never what it
*assumes* — and it was the assumed half that caused the original 26-fixture
failure. Two of those fixtures live in `README.md` and `docs/README.he.md`,
which carry no comment syntax and can never declare anything.

**Real output, re-run 2026-09-13** (`node scripts/check-basis.ts`, tail). The
2026-09-12 reading was `150 of 611 … 138 distinct … 461 predate`; these numbers
move with every test file added, so read them as dated:

```
162 of 622 test file(s) declare a basis: 162 name item(s), 0 say `none` with a reason · 157 distinct item(s) are named
460 predate the rule and are exempt via scripts/basis-undeclared.txt; 0 do not and are gated.
no test file outside the baseline is missing a basis or malformed.
10 declaration(s) name a RETIRED item. Reported, never gated — the successors are printed above.
scripts/basis-undeclared.txt: 0 entr(ies) name a file that no longer exists and 1 name a file that now declares a basis. Both are spent lines and deleting them is the whole repair.
11 helper module(s) under test/ and e2e/ declare a basis although nothing gates them: e2e/app.ts, e2e/composer-run.ts, ...
```

One of the ten `RETIRED` findings from that same run, real text:

```
RETIRED test/ui/read-model.test.ts:1
        `OPENQ-does-the-pinned-tier-spend-its-spare-room-on-governing-items` is superseded — ...
        wrote: @basis TASK-the-pinned-tier-sits-half-empty-while-sixty-nine-governing, OPENQ-does-the-pinned-tier-spend-its-spare-room-on-governing-items
        superseded by TASK-the-pinned-tier-sits-half-empty-while-sixty-nine-governing
        REPORTED, NEVER GATED. A test resting on a superseded ruling is often
        correct as history. The repair is to say so where the reader is.
```

**Use case**: reviewing a PR that reverses a ruling — `check-basis.ts --items`
runs the *inverse* query (which tests declare a given item) so the reviewer
can see, before merging, exactly which fixtures are about to need a second
look, instead of discovering it an hour later the way `budget/16` did.

## Seeded throwaway twins

The pattern, confirmed by grepping `test/` for "throwaway"/"twin" (dozens of
hits): a test that needs a corpus, a home directory, or a workspace builds a
**disposable** one under the OS temp directory rather than touching the real
`.my_context/` or the developer's real `~`, then discards it. Representative
real comments:

```ts
// test/cli/inbox-promote.test.ts:45
/** A throwaway project, disposed by the caller. */

// test/cli/ready.test.ts:49
/** A throwaway project that declares a work-planning category. Disposed by the caller. */

// test/core/anchor-durability.test.ts:88
/** A throwaway `~/.claude`, so nothing here reads the developer's own. */

// test/core/config-field-write.test.ts:5
* fs functions against a throwaway `corpusDir` holding nothing but ...
```

"Twin" specifically names a *paired* test that differs from its sibling in
exactly one input, to isolate what the difference proves — real comment,
`test/cli/inbox-promote.test.ts:153`: *"The twin of the test above, differing
in exactly one input. Without it, ..."* — a removal-proof discipline applied
by hand at the level of a single input rather than by running the mutation
tool.

**Why it exists**: it's the same real-home-guard failure mode the rendering
pin section above describes, applied to *corpus* fixtures rather than HOME —
a test that mutates state must mutate a copy nobody else depends on.
`mutate.ts` enforces the same rule mechanically for source-file mutation
(`runCli(['init'], mkdtempSync(...))` is literally how that suite disposes of
its own throwaway workspace, per `docs/mutation-testing.md`).

**Use case**: `test/cli/lesson-accept-summary.test.ts`'s own header states
this explicitly as a design choice: *"Throwaway workspaces, not this
repository's corpus"* — a lesson-accept test that ran against the real
`.my_context/` here would create real, permanent rule items in the very
corpus this documentation is being generated from.

## The `check:*` gates

Nine scripts, run from `package.json`'s `check:*` family. Each targets one
invisible-by-construction failure mode; five are pure read-only checkers this
pass ran for real (output pasted below), four were read from source only
because running them either mutates state or duplicates work another chapter
already verified live.

### Where each one runs — which is a different question from whether it works

This chapter previously described nine gates and never said **where any of them
ran**, which is precisely the vacuous-gate failure the rest of it is about. As
of `deb3d809` (2026-09-13):

| Gate | `ci.yml` | `release.yml` | `.githooks/pre-commit` |
|---|---|---|---|
| `check:test-glob` | yes | yes | — |
| `check:basis` | yes | yes | — |
| `check:retired` | yes | yes | — |
| `check:text-files` | yes | yes | — |
| `check:vendor` | yes | yes | — |
| `check:dependencies` | yes | yes | **yes** |
| `check:needs-cycles` | yes | yes | — |
| `check:handover` | yes | yes | — |
| `check:cited-items` | **no, deliberately** | no | — |

Plus `verify:citations`, then `typecheck`, `npm test` and `test:perf` in both
workflows, and `test:e2e` in `ci.yml` only.

**Before that commit, four of them ran nowhere.** `check:needs-cycles`,
`check:handover`, `check:dependencies` and `check:cited-items` were in neither
workflow, and `verify:citations` was in `release.yml` alone **and was red** — so
the one gate that was failing was the one only a tag cut would have run. Four of
the twelve blockers found by six reviews that week would have been caught by
gates that already existed.

**`check:cited-items`' absence is a ruling, not an omission.** `7d10c14d`, in
its own words: *"a never-gating check there prints 224 lines into a green log
and manufactures the appearance of coverage."* Its only three non-zero exits are
anti-vacuity guards, so no finding it reports can fail a run — and a step that
cannot go red is the vacuous gate this repository keeps catching. It stays a
thing a person runs and reads.

**The gap the whole table closes is named in a test file this chapter did not
previously mention.** `test/scripts/workflow-gates.test.ts` asserts that gates
are *reached*, not that they are correct: *"a green `dependency-budget.test.ts`
says the dependency budget can be computed, never that anything computes it
before a merge."* It reads the workflows with a line scan (this project has no
YAML parser and none of its four devDependencies is one), so its anti-vacuity
tests come first: the reader must find the steps that already existed **and
their exact count**, so a scan that matched everything is refused too. It also
**pins `check:cited-items`' absence with its reason**, because "an exclusion
nobody wrote down is indistinguishable from the omission this whole item was
filed about". That is the sharpest instance of this chapter's own thesis.

### The pre-commit hook

`.githooks/pre-commit` (new 2026-09-13) is installed by `npm run hooks:install`,
which is `git config core.hooksPath .githooks`. **It runs exactly one gate**,
`check:dependencies`, on a staged `package.json` or a staged
`CONST-zero-runtime-dependencies`, and the restraint is the design:

> "a hook that costs two seconds and can redden on another lane's uncommitted
> work gets `--no-verify`'d once, then aliased away, and then it is a gate
> wired to nothing wearing the clothes of a gate that runs."

Why that one: `npm i --save` is a **working-tree act**, and the commit is the
last moment the write is still cheap to undo — CI means a push, a red run and a
revert; here it means deleting a line. And it is **never the only line of
defence** — the same check runs in both workflows, deliberately, "so that
disabling this hook costs you speed and never safety."

Two limits the hook states rather than leaves to be discovered: a pre-commit
hook reads the **working tree**, not the index, so a manifest edited but not
staged is judged anyway (the safe direction, but not the question `git commit`
is asking); and `git commit --no-verify` skips it, as it skips every hook.

| Script | What it enforces |
|---|---|
| `check-test-glob.ts` | That `package.json`'s test glob is double-quoted (unquoted, `sh` on Linux CI expands `**` as plain `*` and silently ran **2 of 4** test files at exit code 0 — a green matrix over half a suite), and that the quoted pattern still resolves to every real `*.test.ts` under `test/` (catches a pattern that stays correctly quoted but stops matching the tree). |
| `check-retired.ts` | That a "§0" correction block recorded in a planning document is actually *applied* in the document's body — not just recorded. A 2026-08-18 pass wrote corrections into four plan §0 sections and left stale instructions four passages later citing the old fact; a document can declare `<!-- retired-phrases … -->` and this checker confirms every retired phrase is gone from the body. |
| `check-text-files.ts` | Refuses a source or test file containing a raw NUL byte, which makes git classify the whole file as binary (no diff, no review, unresolvable merge conflicts) — happened twice already from fixtures like `'CONST-x\0'`. Scans the *whole* file, not just git's first-8000-byte heuristic, and scans `skills/` too. |
| `check-vendor.ts` | Two questions about `src/ui/public/lib/vendor/`: (1) is each vendored file byte-identical to the SHA-256 pinned in `VENDOR.md` (parsed, not duplicated), so a "just this once" patch can't silently drift from its stated provenance; (2) does a static scan for `fetch`/`XMLHttpRequest`/`Worker`/`importScripts`/`eval`/`new Function`/`WebAssembly` stay at zero, since an offline plugin that vendors code which can reach the network breaks its own pitch. |
| `check-needs-cycles.ts` | Walks the `needs:` graph on `task` items for cycles. The three existing checks (readiness, doctor's blocked-task/unresolved-reference findings) cannot see a cycle at all: `a/1 needs a/2` and `a/2 needs a/1` are each individually well-formed and individually "pending," so both sit on the held list forever with a reason that reads as ordinary and never as the actual problem. Reports, never resolves — the ruling is explicit that breaking a cycle silently would be worse. |
| `check-dependency-budget.ts` | Enforces `CONST-zero-runtime-dependencies` mechanically. Before 2026-09-07 the constraint said, in the item's own words, *"NOTHING CHECKS THIS AUTOMATICALLY"* — and review missed exactly the case that matters: `mermaid` landed as an undeclared fourth devDependency in one commit and was found weeks later by accident. This script reads `package.json` and compares against the enumeration the constraint item itself carries. |
| `check-cited-items.ts` | The inverse of `scripts/verify-citations.ts`. That script proves a citation like `` `file` · `fragment` · ~line `` still lands on real code; this one proves the *item* a comment cites still governs. A comment in `e2e/app.ts` cited a decision as "the owner's standing ruling" for weeks after it had been superseded — the item was correctly never injected (zero mentions in `SessionStart` output), but a live source comment kept citing it as current, and a session reasoned from it for hours. Reported, never gated — deleting the superseded item would leave the comment pointing at nothing, which is worse. |
| `check-basis.ts` | Covered in its own section above. |
| `check-handover.ts` | Covered in [07 · Restore and handover](./07-restore-and-handover.md). |

**Real output** — `check-vendor`, `check-needs-cycles` and
`check-dependency-budget` run 2026-09-12 and reproducing unchanged;
`check-text-files` re-run 2026-09-13:

```
$ node scripts/check-vendor.ts
28 vendored file(s) match src/ui/public/lib/vendor/VENDOR.md.

$ node scripts/check-text-files.ts        # re-run 2026-09-13 — the finding is gone
1330 text file(s) scanned: none contains a NUL byte.
every one of them still diffs.
# exit 0. On 2026-09-12 this run reported:
#   NUL  src\ui\retrieval-write.ts  at byte 8280
#   1309 text file(s) scanned: 1 contain(s) a NUL byte…

$ node scripts/check-needs-cycles.ts
724 work item(s), 63 open · 702 plan/seq node(s) · 108 carrying "needs" · 141 edge(s) walked · 0 reference(s) nothing answers to, not walked · 15 item(s) carry no plan/seq and can be needed by nothing
no cycle: every "needs" chain in this corpus terminates.

$ node scripts/check-dependency-budget.ts
package.json declares no runtime dependency, and 4 devDependencies (typescript, @types/node, @playwright/test, mermaid) — exactly what CONST-zero-runtime-dependencies enumerates.
```

**That finding was real and it has since been fixed.** On 2026-09-12
`check-text-files.ts` genuinely found one NUL byte in
`src/ui/retrieval-write.ts` at byte 8280, in this repository's own working tree,
at the moment this chapter was written — not a constructed example. Re-run
2026-09-13: `1330 text file(s) scanned: none contains a NUL byte`, exit 0. It is
kept here as history, dated, rather than deleted, because a checker catching a
real defect in the tree it guards is the evidence that it is not vacuous —
which is the whole subject of this chapter.

`check-cited-items.ts` and `check-test-glob.ts` were read from source only
(the former's read half is already exercised safely by `check-basis.ts`
importing it; the latter needs no live run to state its rule precisely).

## No-writes

"No-writes" is **one guarantee**, asserted on two different surfaces, not two
separate concepts. The web UI's own no-writes guarantee (its enforcement
mechanism, and its narrow ruled exceptions) is documented in full in
[08 · The web UI](./08-web-ui.md); this section covers how the *test* side
proves it, which is a stricter, structural check.

`test/ui/no-writes.test.ts` is the static half of the enforcement (its own
header cites "spec §2, §6; plan Task 14"). **What it proves**: the set of
write-capable symbols *bound* by any module under `src/ui/` is exactly one —
the refusal record in `src/ui/security.ts` (owner ruling B4) — checked as an
**equality**, not an emptiness check, so both adding a second write binding
and deleting the one ruled-in binding fail the test. The unit of the ban is
the individual imported *symbol*, not the file: `revision-log.ts` imports
only `readJsonlFile` from `jsonl-log.ts`, a module that also exports three
writer functions, and banning at the file level would need a hand-kept
allow-list that "grows into a row of holes nobody re-examines" (the file's
own words). The scope is `src/ui/` plus every re-export chain its bindings
resolve through — applied to the *whole* reachable graph it was red on day
one, catching `focus.ts` binding `recordAudit` and `seen-file.ts` binding
`appendJsonlLine` even though the actual functions the read-model calls
(`readFocus`, `readSeen`) write nothing.

Membership of the banned-symbol set is itself **derived**, not hand-kept: an
earlier version had two hand-kept halves and only one was checked, so a
module that wrote and was never *named* in the list was judged a non-writer
and could bind it with the test green — measured twice for real
(`core/ui-server-record.ts` on 2026-08-27, `ui/execute-effect.ts` four days
later).

[06 · Retrieval](./06-retrieval.md) documents the *dynamic* companion check:
`approvedRestore` returning `null` for anything but a deliberate, nonce-gated,
disk-verified human approval, proven by a byte-identical staging-file
snapshot and a planted-importer positive control. Both halves — static
symbol-binding and dynamic behavioral proof — answer the same underlying
promise: the web UI can be read from, never written to, except through the
one ruled escape hatch.

## The parity ledgers

**"Ledger" here means a declared table**, committed as ordinary TypeScript,
that records — for every pair of surfaces meant to agree — either the
correspondence between them or a *reasoned* absence, and is checked against
the live, running program by a dedicated test so the declaration cannot
silently drift from the product. `src/plugin/parity.ts` is the central one;
several narrower parity tests apply the identical idea to a single function
implemented twice.

**`src/plugin/parity.ts`** exists to make one requirement checkable, quoted
from its own header — the owner's words: *"anything the model can do through
a tool, the user should be able to do through a command."* Before this file,
that was aspiration: eleven MCP tools and slash commands covered roughly four
of them, and the gap was found one missing command at a time. Three ledgers
live here, each enforced by `test/plugin/parity.test.ts` against the running
program in both directions:

- **`TOOL_PARITY`** — every MCP tool, and its CLI and/or slash counterpart.
  Where one is absent, a required `note` states *why*, not just *that*. Real
  example: `mycontext_help` has `cli: 'help'` but `slash: null`, because a
  `/mycontext:help` whose entire content is "run `mycontext help`" carries
  nothing of its own.
- **`CLI_WITHOUT_SLASH`** — CLI commands with no slash counterpart, and why.
  Every entry is either something that runs before a session exists to
  invoke a slash command in (`init`), or a deliberate human-only act — e.g.
  `ack` is refused to every non-`human` origin in `core/mutate.ts`, so a
  slash command (a model typing the command) would be excluded by the same
  logic the CLI's own runtime check already enforces.
- **`CLI_WITHOUT_TOOL`** — the third leg nobody had checked until this row
  existed: every CLI command with no MCP tool, tagged `'intended'` (a
  structural reason — most cite a fact the test *re-checks in code*, like a
  hardcoded `origin: 'human'` literal, rather than trusting a sentence to
  stay true) or `'owed'` (nothing refuses it, the gap is just not built yet,
  and it is self-checking: the day a tool ships, the row becomes a
  contradiction and the test fails until someone deletes it).

The file states plainly why `'intended'` is the harder promise: a reason like
"`ready`'s absence was because X" can go stale exactly the way the corpus
itself goes stale — the code fact changes and the sentence keeps asserting
the old one — which is why the self-checking rows point at real source
(`origin: 'human'` literals, `workspace: 'none'` registrations, raw-SQL usage
strings) instead of only prose.

**Narrower parity ledgers**, one function implemented twice and pinned equal:
`test/ui/duration-parity.test.ts` and `test/ui/zoned-stamp-parity.test.ts`
sweep `formatDuration`/`zonedStamp` (a server-side TypeScript copy vs. the
browser's `viewmodel.js`) for identical output across a swept input range;
`test/ui/strip-parity.test.ts` does the same for the statusline
powerline-segment stripping logic; `test/doctor/shared-tail-parity.test.ts`
pins the doctor module's "one message does two jobs" shared-tail rendering
(`src/doctor/shared-tail.ts`) the same way. `src/doctor/shared-tail.ts`'s own
header states the principle these all share: *"a copy proven equal by a
parity sweep... the deal is the test, not the intention."*

**Use case**: a contributor adding a new MCP tool without a CLI command (or
vice versa) — `test/plugin/parity.test.ts` fails immediately, naming the
missing row, rather than the gap being found months later by someone hunting
for a command that isn't there, which is exactly how the *first* version of
this gap was found.

## What's NOT built / built but off

- **`check:basis` is scoped, not universal.** **460 of 622 test files (74%)**
  are exempt via the baseline and carry no `@basis` line at all (re-run
  2026-09-13; it read 461 of 611 on 2026-09-12 — `8aa489fc` removed one
  baseline line and the suite grew). This is a deliberate design (retrofitting
  a guess is worse than silence), not a gap nobody noticed, but it means the
  majority of the suite currently has no basis declaration. **0 files are
  gated and undeclared**, which is the number that would be a defect.
- **`@basis` cannot see what a test *assumes***, only what it *verifies* —
  stated as a known limitation in the checker's own summary output, not
  something this documentation is inferring.
- **The NUL-byte finding this chapter reported on 2026-09-12 is fixed.**
  `check-text-files.ts` exits 0 as of 2026-09-13 over 1,330 files. The account
  above is kept, dated, as evidence the checker catches real defects.
- **Mutation testing is a tool a person runs deliberately, not a CI gate** —
  re-checked at HEAD on 2026-09-13 against every `package.json` script and both
  workflows: `npm run mutate` is wired into no `check:*` or `test:*` script and
  appears in neither `ci.yml` nor `release.yml`. It is invoked by hand or
  referenced from a code-review workflow.
- **Fourteen npm scripts are named nowhere in this reference**, several of them
  gates: `test:perf` (which runs in **both** workflows), `test:e2e:single-phase`,
  `test:e2e:install`, `typecheck`, `gen:commands`, `gen:docs`,
  `verify:citations`, `check:retired`, `check:text-files`, `check:vendor`,
  `check:needs-cycles`, `check:dependencies`, `check:cited-items`,
  `hooks:install`. The table above fixes the "where does it run" half; naming
  them as scripts is still thin.
- **Nineteen files in `scripts/` have no coverage anywhere**, including
  `e2e-gate.ts` (what `npm run test:e2e` actually runs), `gen-commands.ts`,
  `gen-doc-examples.ts`, `check-faint-usage.ts`, `check-ask-numbering.ts`,
  `check-cssom-restatement.ts`, `gen-cli-ui-coverage.ts`, `gen-diagrams.ts`,
  `migrate-rules.ts`, `seed-dogfood.ts`, `backfill-requests.ts`,
  `vendor-webawesome.ts`, `convert-hebrew-bidi-marks.ts`, `set-version.ts`,
  `changelog-section.ts`, the three `restamp-summary-basis*.ts`, and
  `doc-clock.ts` / `doc-fixture.ts` / `repair-openq-filters.ts`.
- **`test/rules/*` (16 files) is not described here**, though
  `test/rules/isolation.test.ts` is what makes chapter 10's isolation claim
  checkable rather than argued.
- **The UTF-8 chunk-seam fixture guard is a `@basis`-shaped proof this chapter
  does not carry.** `test/core/chunk-seam-utf8.test.ts` is written in Hebrew
  precisely because on ASCII the defect it catches *cannot* fail a test, and it
  asserts that byte 1,048,576 of its own fixture is a UTF-8 continuation byte —
  so a fixture that drifted by one byte cannot go green by no longer testing
  anything. That is `a-fixture-must-not-be-what-makes-a-proof-pass` (the product
  rule store, [chapter 10](./10-rule-store.md)) in one file. See
  [chapter 4](./04-conversation-archive.md).
- **`check-retired.ts`'s retired-phrase contract only covers documents that
  opt in** with an explicit `<!-- retired-phrases -->` HTML comment block —
  it does not scan every document for staleness generally.

## See also

- [00 · Index](./00-index.md)
- [03 · Creation and the gates](./03-creation-and-gates.md) — the summary
  and contradiction gates that govern corpus items; this chapter's gates
  govern the test suite that verifies them.
- [06 · Retrieval](./06-retrieval.md) — the dynamic no-writes proof
  (`approvedRestore`, the nonce, the planted-importer controls) that pairs
  with this chapter's static `no-writes.test.ts` coverage.
- [08 · The web UI](./08-web-ui.md) — the no-writes guarantee itself, and its
  named exceptions, as a product property rather than a test.
- [07 · Restore and handover](./07-restore-and-handover.md) — `check:handover`.
