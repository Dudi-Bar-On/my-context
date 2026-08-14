# Blocker fix report — scoped re-review of Plan 4's final fix wave

BASE `c349eb6` · branch `worktree-my-context-plan4` · **1359 → 1401 tests, all green**,
`tsc --noEmit` clean, `git status --porcelain` empty.

## Commits

| SHA | What |
|---|---|
| `bb8a650` | B4 `extra.__proto__`, B5 `status`'s clean-reading failure |
| `8558c4a` | B6 exclusive-create write-failure window + fd leak, B7 orphan recovery route |
| `3b677f2` | B2 unknown-flag refusal on all six reporting commands |
| `0bc5cc3` | B1 `repair` on the gate lists, B3 pinning route, B10 tier test, B11 unpinned claims |
| `d3faaa0` | B8, B9 — the two assertions that could not fail |
| `f65d964` | the three flakes |
| `7af924c`, `d56b1a8` | ledger |
| `af41644` | cleanup leaks and reports rather than reddening an innocent test |

---

## Blocking items

### B1 — `repair` completes a route three documents said did not exist

Verified by execution and now pinned by `test/cli/repair.test.ts`: hand-edit `always:`/
`severity:` on a **governing** item, `repair --yes`, and you get `always: false→true`,
`severity: soft→hard`, `doctor` exit 0, and the item moves from a one-line index entry to
**injected in full in a real session-start selection**.

- `repair` added to `skills/mycontext/SKILL.md`'s gate list and to the README deny list; the
  README table now says five commands, not four, with a row stating what `repair` completes.
- Both `updateItem` refusals no longer deter with *"leaves the item failing its own recorded
  checksum"* — a consequence `repair` removes. They now **name the pairing and forbid the
  caller reading them from taking it**. Both halves are pinned at runtime
  (`test/core/mutate-guard-messages.test.ts`), because the route without the prohibition is an
  instruction to exactly the reader the write-deny hook exists to stop, and the prohibition
  without the route is back to inventing a reason.
- SKILL.md stayed under its 4,000-char budget (3,981); the disclosure was paid for by trimming
  padding, not by raising the cap.

**Ledger follow-up #1 rewritten.** The seal on the *code paths* is real and still holds. The
*system* property inferred from it was false the moment `repair` shipped — in the same round.
Recorded as a new corollary: **verifying "no code path does X" establishes exactly that, not
"X cannot be reached."**

### B2 — extended the check to all six (justified)

`unknownFlag` had two call sites; the README claimed six. **Extended rather than scoped down**:
a mistyped `--ful` silently producing the wrong report is the same class as everything else in
this round, the machinery existed, and narrowing the sentence would have left the defect behind
wording that reads like a decision.

- `unknownFlag`/`refuseUnknownFlag` moved to `format.ts` beside `DETAIL_USAGE` — one
  implementation, six call sites.
- `review` gets **per-subcommand** flag sets, not a union: `--json` on `promote` and `--yes` on
  `list` are meaningless, and a union would leave the same swallow on the subcommands that write.
- The guard is **registry-driven** (`test/cli/unknown-flag-refusal.test.ts`): any registered
  command advertising the detail levels must refuse an unknown option, the discovered set is
  itself pinned so the guard cannot silently cover nothing, and both directions are checked —
  the real flags must still be accepted.
- **Measured: 5 red with the refusals removed, `list` green** (it already had it).

### B3 — the pinning route

`update_item` is refused on a governing item and, on a rationale item, **inert**: `select`
filters `isNormative` before `always` (verified — empty session-start selection). README now
names the one route that exists.

**Warned, not refused.** `tierOf` reads the *resolved* per-project config, so the value is
legal, round-trips, and starts working if the tier changes; refusing would reject a storable
value on today's config and newly break an agent echoing back a field it read. The defect was
the silence. Applied in `createItem` too, not just the surface named.

---

## Code defects

- **B4** — `optExtra` used `out[key] = v`, so `__proto__` set the prototype and
  `validateExtra`'s refusal was unreachable from the only surface taking free-form `extra` from
  a model. `Object.defineProperty`, plus a test driving the tool with a `JSON.parse`d argument
  object (the shape the transport delivers).
- **B5** — `status` printed `health: 0 error(s)` and exited 1. It cannot fold load errors into
  `health:` the way doctor's summary does (that line is the findings tally; status's exit code
  comes from load errors alone), so both numbers are named and `--json` carries
  `loadErrorCount`/`exitCode` beside `health`.
- **B6** — the `openSync('wx')` fallback in `createExclusive` and `acquireApplyLock` left a
  **zero-byte file permanently** on a failed write (burning an item id forever; wedging the lock
  for the full five-minute `LOCK_STALE_MS`), and `lock.ts` leaked the descriptor on both write
  paths inside a function that loops until `LOCK_TIMEOUT_MS`. Fixed; both doc comments now name
  **both** windows and say plainly that the cleanup is best-effort rather than claiming the
  window is gone. Both halves independently mutation-killed.
- **B7** — the orphan refusal offered only "move it aside", which re-extracts the whole document.
  Both routes named, surgical one first, cost of the other stated; the test **follows each route
  literally** rather than matching prose.

## Tests that could not fail

- **B8** — vacuous by construction: `withWorkspace` rebuilds *before* the handler, so a file the
  call is about to write can never appear in that call's own output. *Flipped to `match` on a
  corrupted tree, it still failed.* The witness is the next call, which the test already made.
- **B9** — at 40 items the cap mutant left output **byte-identical** at 46ms against a 20s bound
  and **survived a full suite run**. Raised to 300 items, bound tightened to 10s. Capped: ~330ms.
  Mutant now: `FATAL ERROR: Reached heap limit`.
- **B10** — one-directional; a **disabled** category added to the normative bullet survived. Set
  equality both ways, which also catches a name on the wrong side.
- **B11** — orphan message's applied-log path, both copies of `CANDIDATE_FIELDS` against a
  `JSON.parse`d `__proto__`, and README's "rebuild does not recompute the checksum" (asserted by
  doing exactly what the README describes).

---

## The three flakes

Neither reproduces in isolation (15/15 green per file). Both need the concurrency a full run
produces. **Neither was a defect in the code under test.**

**1. `ingest-apply locks in two different workspaces`** bounded `gotAt` minus the moment the
*parent* called `spawn` — which counts the child's Node startup and type-stripping of the whole
module graph. **Measured at 82–146ms with zero contention, against a 300ms budget**, rising with
load. Now bounds `acquireMs`, the time inside `acquireApplyLock` (0–1ms uncontended, load or
no load); the fixture reports it. The old bound was also **silently vacuous in the other
direction** — a child whose startup outran A's 1500ms hold would acquire a free lock and pass —
so `b.gotAt < a.releasedAt` is asserted too.

**2 and 3 are the same defect, and it belongs to neither test.** `force: true` on `rmSync`
suppresses "does not exist" and nothing else; `maxRetries` defaults to **0**. On Windows any
handle still open in the tree (SQLite's `-wal`/`-shm`, released asynchronously *after*
`close()`; a spawned child's cwd; a scanner) throws `EPERM` from the cleanup line, so **the test
that fails is whichever one was unlucky**. `--yes=false` loops four sandboxes with a store open
in each, so it draws four tickets per run. **Reproduced 1 run in 5**, on a hook test touching
neither SQLite nor child processes.

All 403 call sites now route through `test/helpers/tmp.ts`'s `removeTree`. Made structural per
this ledger's own rule: `test/no-bare-rmsync.test.ts` fails on a 404th bare call site *and* on a
helper reduced to forwarding the same bare options.

**The retry budget alone was not enough**, which is the part worth carrying. With ~4.75s of
retries one failure still got through, on `session-start-restore.test.ts` — whose only handles
are a `Store` and a `Ledger` that `buildInjection` closes in a `finally` (checked, not assumed),
and whose four `Ledger.open` calls are balanced 4/4. Past that the cause is outside this
repository. **Ruling: cleanup leaks rather than throws, and reports what it leaked** — a leaked
temp directory costs disk and one stderr line naming path and errno; a throw costs a red suite
attributed to an innocent test, and this ledger records two mutation readings taken against red
suites and believed. The report is what keeps it from being a silent swallow: **a real handle
leak appears every run, a scanner appears occasionally.**

---

### Confirmation

**22 consecutive full-suite runs after the fixes: 22 green, 0 red.** Before them, the same
machine produced a red run roughly 1 in 5.

Three temp directories were leaked across those 22 runs and reported by the exit handler, all
`EPERM`.

The leak report distinguishes the two hypotheses, and it came out on the side of contention:
the surviving paths are **different files on different runs** (`myctx-restore-*`, `myctx-hook-*` and
`myctx-decay-*`, once each), never a fixed path. A real handle leak would name the same test every
time. All three write a fresh `.index.db`, which is what a scanner opens.

## Concerns

1. **The leak report is now the instrument, and it should be read.** If a single path starts
   appearing on *every* run, the contention diagnosis is wrong and that test has a real handle
   leak. `session-start-restore.test.ts`'s four `Ledger.open`/`close` pairs are also not in
   `try/finally`, so a future assertion failure between them would leak for real.
2. **B9's mutant kill is a process abort**, not an assertion failure. That is honest — it is
   exactly what the cap prevents — but a future reader who removes the cap will see
   `FATAL ERROR: Reached heap limit` with no test name attached.
3. **B1's refusal messages now name a route an agent could follow via Bash.** Judged correct:
   withholding it does not stop a caller that wants it (`Bash` is unmatched by the write-deny
   hook, as the README states), and it would leave an honest reader unable to tell the user what
   their options are. The prohibition is pinned alongside the route so the pair cannot drift
   apart — but this is a deliberate widening of what the model is told, and it should be
   re-examined if the hook's matcher ever gains `Bash`.
4. **`repair` is not gated by anything but `--yes`.** Adding it to the deny list is a
   recommendation a plugin cannot enforce, same as the other four. Nothing changed about that.
5. **The `removeTree` codemod touched 57 files mechanically.** Its first pass mangled four sites
   (a `[\s\S]*?` capture spanning two adjacent statements); all four were found by `tsc` plus a
   targeted grep and repaired, and no code was lost — the captured text was reinserted verbatim.
   The diff is large and uniform, and worth a skim rather than a read.
6. **B2 widened `review promote`/`discard`/`show`'s accepted flags into an explicit list.** One
   shipped test passed `--yes` to `review show`, which is read-only; that call was corrected
   rather than the flag being admitted. If any script passes a flag to a subcommand that never
   used it, it now exits 1 instead of ignoring it — which is the intent, but it is a
   behaviour change beyond the six reporting commands.
