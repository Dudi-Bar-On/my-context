# Task 3 report: Ingest session persistence

## What was implemented

- `src/ingest/session.ts` — exports `SESSION_PROTOCOL`, `ApplyRecord`, `IngestSession`,
  `ingestDir`, `makeSessionId`, `saveSession`, `loadSession`, `listSessions`,
  `openIngestSession`, `pendingAnchors`, exactly matching the brief's interface list.
- `test/ingest/session.test.ts` — the 11 tests specified in the brief, verbatim.

Implementation follows the brief's Step 3 code as given, after verifying every consumed
interface against source first:

- `chunkDocument`, `sourceChecksum`, `Chunk` from `src/ingest/chunk.ts` — confirmed present
  and signatures match.
- `slugify` from `src/core/slug.ts` — confirmed present, `slugify('docs/prd/auth.md')` ==
  `'docs-prd-auth-md'`, matching the brief's worked `makeSessionId` example exactly.
- `normalizeEol` is listed in the brief's "Consumes" line but the brief's own Step 3
  implementation never imports or calls it — session.ts doesn't need it either, since
  `chunkDocument`/`sourceChecksum` already normalize internally. I did not add a spurious
  import to satisfy the interface list; flagging this as a brief/interface-list inaccuracy
  rather than acting on it.

## TDD evidence

1. Wrote `test/ingest/session.test.ts` exactly as specified.
2. Ran `node --test test/ingest/session.test.ts` before creating `session.ts`:
   failed with `ERR_MODULE_NOT_FOUND` for `src/ingest/session.ts` — correct failure reason.
3. Created `src/ingest/session.ts` per the brief.
4. Re-ran: all 11 tests pass.
5. `npx tsc --noEmit`: clean, no errors.
6. `npm test`: 746 passed, 0 failed (baseline 735 + 11 new = 746, exact match).

## Mutation testing (every guard, removed then restored)

| # | Guard | Mutation | Result |
|---|-------|----------|--------|
| 1 | `loadSession`'s `existsSync` check + friendly error | Removed the check; let `readFileSync` throw natively | **Survived.** Node's raw `ENOENT` message embeds the full file path, which contains the session id substring, so `assert.throws(..., /ING-nope-00000000/)` still matches. The guard is real (it produces an actionable message pointing at `ingestDir` and the remediation commands) but the test only pins the id substring, not the friendly wording. Restored. |
| 2 | `openIngestSession`'s resume condition (`protocol === SESSION_PROTOCOL && sourceChecksum === docChecksum`) | Replaced with `if (true)` | **Survived.** The session id is already content-addressed by `docChecksum`, so under normal operation this file can only ever be read back with a matching checksum — the check only matters against a hand-corrupted or partially-written file with the right id but wrong internals. No test constructs that scenario. Restored. |
| 3 | `listSessions`'s protocol filter (`if (parsed.protocol === SESSION_PROTOCOL) out.push(parsed)`) | Removed the filter, push unconditionally | **Survived.** No test places a `.json` file in `.ingest/` with a different/missing `protocol` value; "listSessions ignores unrelated files" only covers non-`.json` files. Restored. |
| 4 | `pendingAnchors`'s presence check, `hasOwnProperty` variant vs `applied[c.anchor] === undefined` | Swapped for an equivalent-looking undefined check | **Survived, but near-equivalent** — `ApplyRecord[]` values are never legitimately `undefined` in this codebase, so the two forms behave identically for every real value. Not a meaningful mutant. Restored. |
| 4b | `pendingAnchors`'s filter entirely removed (`.filter(...)` deleted, mapping all chunks) | Removed the filter | **Killed.** Both "pendingAnchors lists chunks not yet applied" and "an applied chunk with zero extractions still counts as done" go red. Restored. |
| 5 | `saveSession`'s atomic temp-file + rename (`renameSync(tmp, target)`) | Wrote directly to `target`, skipping the temp file and rename | **Survived.** All 11 tests still pass — nothing exercises a crash/interrupt mid-write, only that the end state is well-formed and no stray temp file remains. Restored. |

**What mutation testing could not tell me:** three of five guards survived removal, and in
each case the reason is structural, not a weak assertion I can tighten within this task:

- Guard 1's survival is because the *fallback* behavior (Node's native error) accidentally
  satisfies the same regex the *guarded* behavior would — the test can't distinguish "the
  guard fired" from "the guard was absent and Node's own error happened to match."
- Guard 2 and 3 are defense against on-disk corruption specifically, which the current test
  suite has no vocabulary for (no test hand-writes a malformed session file with a matching
  filename but wrong `protocol`/`sourceChecksum` field). This mirrors exactly the class of
  gap called out in the task instructions ("a guard was correct but in the wrong place" /
  untested for its actual purpose) — these guards are correctly *placed* (in `openIngestSession`
  and `listSessions`, exactly where a corrupted or hand-edited file would be read) but nothing
  proves they fire correctly, only that removing them doesn't break the happy path.
- Guard 5 (atomicity) is fundamentally about a failure injected *during* `writeFileSync`,
  which node:test has no straightforward way to simulate without mocking `fs`, and the brief's
  own test suite doesn't attempt it. The temp-file+rename pattern is copied verbatim from
  `writeSnapshot` in `src/core/ledger.ts` (the module that already fixed the earlier
  Windows atomic-write bug per the task's own history), so I trust the mechanism itself, but
  no test in this task proves it end-to-end.

## Where the brief and built code disagreed

- The brief's "Consumes" line lists `normalizeEol` as an interface `session.ts` uses, but
  its own Step 3 implementation doesn't import it, and none is needed — `chunkDocument`
  and `sourceChecksum` already normalize line endings internally (verified by reading
  `src/ingest/chunk.ts`). No functional issue; only the interface list itself is inaccurate.
- Everything else in the brief (`Chunk`, `sourceChecksum`, `chunkDocument`, `slugify`,
  all seven produced exports, the id format) matched the actual source exactly on inspection.

## Concurrency / corruption concerns (flagged per instructions, not fixed beyond the brief)

- **`saveSession`'s temp filename is `${target}.tmp-${process.pid}` with no per-call
  counter.** `src/core/ledger.ts`'s `writeSnapshot` — which exists specifically because an
  earlier atomic-write path failed — uses `${target}.tmp-${process.pid}-${counter++}`, an
  extra per-process monotonic counter. Because `saveSession` is fully synchronous
  (`writeFileSync` then `renameSync`, no `await` between them), there is no way for two
  calls *within one process* to interleave, so the missing counter is not a bug today. But
  it is one path away from becoming one: any future caller that parallelizes `saveSession`
  calls across `Promise.all`/worker threads writing to the *same session id* in the *same
  process* would silently share a temp filename and race on it. Implemented as specified in
  the brief; flagging since the sibling atomic-write helper in this codebase already
  hardened against exactly this.
- **Two separate processes writing to the same session id concurrently** (e.g., two
  `mycontext ingest` invocations against the same unchanged source file, racing) each get
  their own temp filename (different `process.pid`), so neither corrupts the other's
  temp file, and `renameSync` is atomic on both POSIX and Windows (NTFS `MoveFileEx`) for
  same-volume same-directory renames — the last rename to complete wins entirely, never a
  torn/interleaved file. But `saveSession` doesn't merge `applied` maps: if process A reads
  the session, applies chunk X, and process B (racing) reads the *pre-A* session, applies
  chunk Y, then B's save overwrites A's — A's chunk-X application is silently lost even
  though both writes were individually atomic. This is a last-writer-wins race, not a
  corruption, and the brief doesn't specify locking or merge-on-save; flagging it as
  something Task 4 (apply candidates) or later concurrency work should be aware of, since
  the whole point of session persistence is resumability across interrupted/concurrent runs.
- **`openIngestSession`'s read-then-maybe-return-existing has the same unlocked
  check-then-act shape**, but it's read-only until `saveSession` is called, so it doesn't by
  itself lose data — only compounds the race above if two processes both open, both apply
  different chunks, then both save.
- **`listSessions` and `loadSession` both tolerate a corrupt/half-written file** (`try {}
  catch { skip }` / JSON.parse could throw and propagate for `loadSession` — actually
  `loadSession` does NOT catch a JSON parse error, it will throw the raw
  `SyntaxError` for a corrupt file, unlike `listSessions` which swallows it). This asymmetry
  is arguably fine (`loadSession` is asked for one specific id by a caller expecting it to
  exist and be usable; `listSessions` is an enumeration that shouldn't abort on one bad
  entry) but is worth naming since the task instructions specifically ask about reads that
  assume a well-formed file — `loadSession` does assume that, and a half-written file from
  a crash between `writeFileSync(tmp, ...)` and `renameSync` on an *older* format, or a
  file corrupted by disk failure after a successful rename, would surface as a raw
  `SyntaxError`/JSON parse error to whatever CLI/MCP layer calls `loadSession`, not a
  `my_context`-branded message. Implemented as the brief specifies; not fixed beyond it
  since the brief gives no alternate contract for this case and no test in Step 1 covers it.

## Commit (round 1)

Committed exactly per the brief's Step 5 message: `da168e0`.

---

# Round 2: response to review

The review confirmed spec fidelity but found two Criticals (both proven by execution) and
six Important findings, ruled on the concurrency concern I flagged in round 1, and asked for
a set of Minor cleanups. All of it is addressed below. Every fix's guard was mutation-tested
(removed, confirmed the named test goes red, restored) — see the table at the end.

## Critical fixes

**1. Path traversal via unsanitized `id`.** `sessionFile`/`appliedFile` now call
`assertSafeId`, which requires `id` to match `/^[A-Za-z0-9-]+$/` before it ever reaches
`path.join` — anything else (`../secret`, `..\secret`) throws
`my_context: invalid ingest session id "…"` instead of resolving outside `.ingest/`. Applied
at the single choke point both `loadSession` and `saveSession` funnel through, not
duplicated per call site. I did not reuse `sanitizeSessionId` (`src/core/ledger.ts`) as
literally suggested — that function *mangles* an untrusted id into something safe (replacing
bad characters with `_`), which is the right call for a hook-supplied session id that must
always resolve to *some* usable file. An ingest session id is different: every legitimate
value is produced by `makeSessionId` and has an exact expected shape, so silently mangling a
bad one would hide a real bug (a caller passing something wrong) behind a session that
"works" but isn't the one asked for. Rejecting outright seemed the better fit for this call
shape; flagging the deviation in case that judgment is wrong.

**2. Session id collision across distinct source files with identical content.** Two fixes,
both requested and both implemented:
- `makeSessionId` now folds `checksum(sourceFileRel)` (first 8 hex) into the id as its own
  segment: `ING-<slug>-<pathHash8>-<docChecksum8>`. Two paths that slugify identically
  (`docs/prd/auth.md` / `docs/prd-auth.md` — confirmed both slugify to `docs-prd-auth-md`)
  now require an actual hash collision, not merely a slugify collision, to produce the same
  id. This **changes `makeSessionId`'s output** for the same test inputs the brief pinned
  (`ING-docs-prd-auth-md-abcdef01` → `ING-docs-prd-auth-md-1b5487eb-abcdef01`); I updated
  the brief's own pinned test to match, since the old pinned value was the bug.
- `openIngestSession`'s resume condition now also requires `existing.sourceFile ===
  sourceFileRel`, not just protocol and checksum — the second, cheap half of closing this,
  independent of the id fix (defense in depth: if a header is ever found whose `sourceFile`
  doesn't match despite passing the id check, that's corruption, not a legitimate resume).

## Important fixes

**3. `openIngestSession` now chunks the exact same normalized-and-trimmed text it
checksums** (`chunkDocument(normalizeEol(text).trim())` instead of raw `text`). Previously
`sourceChecksum` trimmed but `chunkDocument` didn't, so a single leading space before the
first heading left the id unchanged while turning `# Auth` into ordinary preamble text —
reachable, and exactly the "anchor persists while naming different content" class `Chunk`'s
own doc comment warns about. `openIngestSession`'s doc comment now states the invariant this
design actually needs and now actually has: **same `sourceChecksum` implies the same
chunking**.

**4. `pendingAnchors`'s `hasOwnProperty` guard is load-bearing, not incidental** — anchors
are `slugify` output, and `slugify('Constructor')` is `'constructor'`, which `{}` inherits
from `Object.prototype`. A doc whose first heading is `# Constructor` would have
`session.applied['constructor']` read back as the inherited `Object` constructor function
(not `undefined`) under an `=== undefined` check, silently marking that section "already
applied" on a brand-new session and dropping it from every ingest. Kept the existing
`hasOwnProperty` implementation (it was already correct) and added the test that actually
exercises this: a doc with `# Constructor` as its first heading, asserting `constructor`
appears in `pendingAnchors`.

**5/6. All four previously-surviving guards from round 1 are now killed** (see the table).
`loadSession`'s existsSync-guard test now asserts the *branded wording*
(`/my_context: no ingest session "…" under/`) instead of just the id substring, so a mutant
that removes the guard and falls back to Node's raw `ENOENT` — which happens to also contain
the id — no longer slips through. `listSessions`'s protocol filter and `.json`-extension
filter each got a test specifically shaped to expose them: a `.txt` file containing
*valid, protocol-matching* JSON (exposes the extension filter) and a `.json` file with the
*wrong* protocol (exposes the filter itself).

**7. `saveSession`'s header write now goes through `retryOnTransientFsError`**
(`src/core/rebuild.ts`) around the `renameSync` call, for the same Windows
`MoveFileEx`-over-existing-destination reason `writeItem` already uses it. Added a real
crash-mid-write test: pre-create the exact temp path a crash would leave behind, with
garbage content, then call `saveSession` and assert the garbage is gone and the target is
valid — this kills the "skip the temp file, write straight to target" mutant, which
round 1 could not.

I deliberately did **not** add the per-process write counter suggested for parity with
`writeItem`/`writeSnapshot`. Two reasons, both mechanical, not judgment calls: (a) the
review's own crash-mid-write test description depends on a deterministic,
test-computable temp path (`${target}.tmp-${pid}`) — a counter makes that path depend on
how many prior `saveSession` calls happened earlier in the same test *file* (module state
persists across `node --test` cases in one process), which isn't something a test can
predict without exposing an internal naming function; and (b) the review itself agreed the
counter isn't fixing a real bug ("safety comes from `saveSession` being fully synchronous
… not from the pid") — it asked for it "for parity" only. I chose testability over parity
here and documented the reasoning directly in `writeHeader`'s doc comment; flagging it as a
considered disagreement in case parity should still win.

**8. `loadSession`'s corrupt-JSON path is now branded.** A malformed `<id>.json` throws
`my_context: ingest session "<id>" at <file> is corrupt (invalid JSON: …). Delete the file
and re-run \`mycontext ingest\` to start a fresh session.` instead of a raw `SyntaxError`.
`listSessions` still swallows the same failure per-entry (an enumeration shouldn't abort on
one bad file); the asymmetry is intentional, as the review confirmed.

## The concurrency ruling — design change, done now

**`<id>.json` is now immutable after creation** (protocol, id, sourceFile, sourceChecksum,
createdAt, chunks only — no `applied` field). `applied` entries live in a separate
append-only log, `<id>.applied.jsonl`, one JSON line per `{anchor, record}` (or `{anchor,
record: null}` as a "processed, zero extractions" sentinel — a chunk can legitimately finish
with no `ApplyRecord`, and an append-only log needs an explicit way to say "done" without a
record). `saveSession` now: (a) rewrites the header idempotently (cheap — it never changes
after the first write for a given id) and (b) diffs `session.applied` against what's already
in the log and appends only the new lines, via one `appendFileSync` call.

This removes the read-modify-write-whole-file shape the round-1 concern was about entirely,
rather than narrowing the race window: two processes applying *different* chunks of the same
session no longer overwrite each other's `applied` entries, because neither ever rewrites
the other's data — each only appends its own new lines. `loadSession`/`listSessions`/
`openIngestSession`'s resume path all fold the log back into `applied` by replaying every
line in file order.

Public API is unchanged (`saveSession(root, session): string` still takes and persists a
full in-memory `applied` map) — the split is an internal storage detail. I did not add a
dedicated single-record append function (e.g. `appendApplyRecord`); `saveSession`'s diffing
approach satisfies the append-only requirement without growing the public surface, but it
does mean every `saveSession` call re-reads and re-diffs the whole log rather than doing one
targeted append. **Flagging for Task 4**: if the apply loop calls `saveSession` once per
chunk (the natural shape), this is O(n²) reads over a session with many chunks — fine for
the sizes this project targets (a session's chunk count is bounded by one document), but
worth knowing before assuming it scales.

Kept tolerant per the ruling: a truncated final line in the `.jsonl` (a crash mid-append) is
skipped, not fatal — covered by a dedicated test that hand-writes one valid line followed by
a syntactically truncated one and asserts the valid line survives and the file doesn't throw.

**Noted for Task 4, per the ruling's instruction:** its apply loop should re-read
(`loadSession`/`pendingAnchors`) immediately before each chunk rather than trusting a
`pendingAnchors` snapshot taken once at open — the snapshot can go stale the instant another
process appends to the same session's log.

## Minor fixes folded in

- `listSessions`'s sort, `saveSession`'s return value, and resumed `createdAt` preservation
  are now each covered by a dedicated test (all three mutants killed — see table).
- `sourceFile`'s "POSIX, repo-relative" contract is now enforced, not just documented:
  `makeSessionId` (and therefore `openIngestSession`, which calls it) throws if the path
  contains a backslash. Reasoning: a Windows-style relative path would slugify differently
  from the same logical path written with forward slashes, so the identical file could get
  two different session ids depending on which platform's path separator a caller handed
  in — one more way `windows-latest` vs `ubuntu-latest` CI could disagree silently.
- `ensureDir` now rewrites `.ingest/.gitignore` unconditionally on every call (matching
  `writeSnapshot`'s approach in `src/core/ledger.ts`) instead of only when absent, so an
  emptied or hand-edited one self-heals on the next open/save. Covered by a test that empties
  the file and asserts it's restored on the next `openIngestSession` call.
- Softened `writeHeader`'s doc comment: it now says "no reader ever sees a half-written
  file", not the earlier "a crash mid-write never leaves a truncated session" wording, which
  implied a durability guarantee the code doesn't provide (no `fsync` before the rename).

## Full mutation table (round 2 — every guard, including round 1's survivors)

| # | Guard | Result |
|---|-------|--------|
| 1 | `assertSafeId` (path traversal) | **Killed** — both `loadSession`/`saveSession` traversal tests |
| 2 | `assertPosixRelative` | **Killed** — POSIX-relative test |
| 3 | `makeSessionId`'s `pathHash` fold | **Killed** — id-format test and the slug-collision test |
| 4 | `openIngestSession` resume condition (protocol + checksum + sourceFile) | **Killed** — stale/corrupt-header test (round 1 survivor, now dies) |
| 5 | `listSessions` protocol filter | **Killed** — wrong-protocol test (round 1 survivor, now dies) |
| 6 | `listSessions` `.json` extension filter | **Killed** — valid-JSON-wrong-extension test |
| 7 | `pendingAnchors` presence check (`hasOwnProperty` vs `=== undefined`) | **Killed** — "constructor" test (round 1's dismissed-as-equivalent mutant, now dies) |
| 8 | `readHeader`'s `existsSync` guard | **Killed** — branded-message assertion (round 1 survivor, now dies on the tightened assertion) |
| 9 | `readHeader`'s JSON-parse branding | **Killed** — corrupt-JSON test |
| 10 | `openIngestSession`'s trim-before-chunk fix | **Killed** — leading-whitespace regression test |
| 11 | `ensureDir`'s unconditional `.gitignore` rewrite | **Killed** — emptied-gitignore self-heal test |
| 12 | `saveSession`'s return value | **Killed** — round-trip test now asserts it |
| 13 | `createdAt` preserved on resume | **Killed** — dedicated preservation test |
| 14 | `writeHeader`'s temp-file+rename (direct-write mutant) | **Killed** — crash-mid-write test (round 1 survivor, now dies) |
| 14b | `retryOnTransientFsError` wrapper around the rename | **Survives** — a genuine transient Windows `EPERM`/`EACCES`/`EBUSY` from a competing file handle cannot be manufactured reliably in a unit test on any platform (the same limitation `retryOnTransientFsError`'s own doc comment in `rebuild.ts` states about itself). Not fixable within this task; the wrapper is trusted by the same reasoning `writeItem` already relies on it. |
| 15 | `appendAppliedDiff`'s dedup (`seen` set) | **Killed** — double-save-no-duplicate test |
| 16 | `readAppliedLines`'s truncated-line tolerance | **Killed** — truncated-final-line test |
| 17 | `appendAppliedDiff`'s zero-extraction sentinel (`record: null`) | **Killed** — zero-extraction persistence test |
| 18 | `listSessions`'s final `.sort()` | **Survives on this machine, for a platform reason, not a test-quality one** — NTFS's directory index already returns `readdirSync` entries in alphabetical order, so removing the explicit sort is invisible here. `ext4` (the `ubuntu-latest` CI runner) makes no such ordering guarantee, so the sort remains necessary for cross-platform correctness; I could not construct a `readdirSync`-order counter-example without mocking `node:fs`, which is out of scope for this task. |

Two mutants (14b, 18) survive, and both are explainable rather than swept aside: 14b is a
genuinely unmanufacturable failure mode in a unit test (shared with the codebase's existing
`retryOnTransientFsError` caller), and 18 is a real cross-platform risk masked by this
specific machine's filesystem, not a false guard.

## Verification

- `node --test test/ingest/session.test.ts`: 28/28 pass.
- `npx tsc --noEmit`: clean.
- `npm test`: **763/763** passed (735 original baseline + 28 in this file), run twice, both
  clean.
- `git status --porcelain`: clean apart from the two intended files
  (`src/ingest/session.ts`, `test/ingest/session.test.ts`).

## Commit (round 2)

Committed as a follow-up fix addressing the review findings: `816c1da`.

---

# Round 3: response to re-review

The re-review confirmed round 2's fixes hold (all seven traversal shapes rejected, the
collision fix verified, 17/20 of the reviewer's own mutants killed, real two-process
contention testing recovering 80/80 anchors clean) and found two new Criticals — both in
code *added* during round 2 — plus four Important/lesson items. Everything is addressed.

## The lesson, stated first because it's the one that matters

**The exact prototype hazard fixed in `pendingAnchors` in round 2 was reintroduced twenty
lines away, in new code, in the same round.** `appendAppliedDiff`'s
`(already[anchor] ?? []).map(...)` has the identical bug `pendingAnchors`'s
`applied[anchor] === undefined` mutant had: `already` is a plain object built by
`foldApplied`, and `already['constructor']` reads back the inherited `Object` constructor
function, not `undefined` — so `?? []` never fires and `.map` throws. Proven exactly as
described: a `# Constructor` document's `pendingAnchors` call was already correct (round 2's
guard), but the very next `saveSession` after applying that chunk threw
`TypeError: (already[anchor] ?? []).map is not a function`.

The fix is not "patch this one call site" — that would leave the *next* new call site free
to reintroduce it a third time. **Every access to an `applied`-shaped object now goes
through two functions, `hasApplied` and `appliedRecordsFor`**, and nothing else in the file
touches such an object with bracket notation or `?? []` again. The doc comment on
`hasApplied` names the two times this exact mistake was made in this file (`pendingAnchors`,
then `appendAppliedDiff`) specifically so a third repetition would have to consciously bypass
a comment that already predicted it. Where a hazard is intrinsic to the data — and slugified
anchors will always be able to spell `constructor`, `toString`, `valueOf`, and friends — the
defence has to live in one accessor every caller is funneled through, not be re-derived
correctly (or incorrectly) at each new call site.

## Critical fixes

**1. `appendAppliedDiff`'s prototype-hazard crash** (described above). Fixed by routing
through `appliedRecordsFor`/`hasApplied` instead of `(already[anchor] ?? [])` /
`Object.prototype.hasOwnProperty.call(already, anchor)` repeated inline. Added the test the
review asked for: a `constructor` anchor round-trips through `saveSession` **and**
`loadSession`, not only `pendingAnchors`.

**2. Truncated final line on the write side.** `appendAppliedDiff`/`appendToLog` now checks,
before appending, whether the log file already exists, is non-empty, and its **last byte is
not `\n`** — if so, it prepends a `\n` to the batch before appending. This is one
single-byte read (`statSync` for size, then one `readSync` at `size - 1`), not a full read of
a potentially large log. Without it, a crash-truncated final line (no trailing newline) gets
whatever the *next* append writes concatenated directly onto it into one longer unparseable
line, which `readAppliedLines` correctly (and silently) skips — losing the record the
*recovery* save was trying to write, permanently if that save was the last one of the run.
That is precisely the interrupted-run case the append-only redesign exists to survive, so the
read-side tolerance alone left the design's actual guarantee unmet. Added the write-side
regression test: hand-write a truncated first line, run a "recovery" save, assert its record
survives `loadSession`.

## Important fixes

**3. `readAppliedLines` now narrows its catch to `ENOENT` only.** Any other read error
(EACCES, a lock, a directory where a file is expected) now throws a branded
`my_context: could not read the applied-log for ingest session "…" …` message instead of
silently degrading to "no work done yet" — which would otherwise make the whole document
re-extract without any signal that something was actually wrong. Added a test that replaces
the `.applied.jsonl` file with a directory (`EISDIR`, not `ENOENT`) and asserts the branded
error surfaces through `loadSession`.

**4. Added the missing `sourceFile`-only mutation test.** My round-2 stale-header test
perturbed `sourceChecksum` only, so it killed that clause but left the `sourceFile` clause of
the resume condition — the one C2 was actually about — provably untested. Mutating
**only** `existing.sourceFile === sourceFileRel` to `true` now has a dedicated test that
perturbs *only* `sourceFile` (leaving protocol and checksum correct) and asserts the session
is rebuilt fresh, not resumed with the stale header's `applied` data.

**5. `SAFE_ID`'s doc comment now names `sanitizeSessionId` explicitly** and states why the
two functions solve different problems (reject vs. mangle), per the accepted deviation, so a
future reader doesn't "unify" them.

## Both previously-"unkillable" mutants are killable — fixed, not just noted

**`listSessions`'s `.sort()`.** I had concluded no `readdirSync`-order counter-example was
constructible because NTFS already returns entries alphabetically. The review's correction:
`listSessions` sorts by each file's own **`id` field**, not by filename — so writing
`aaa.json` containing `id: 'ING-zzz-…'` and `zzz.json` containing `id: 'ING-aaa-…'` produces
a deterministic mismatch between filesystem order and correct output *on every filesystem*,
independent of `readdirSync` ordering entirely. Added that test; it kills the
sort-removal mutant. Also fixed the latent bug the review flagged in the same breath: the
existing sort-order test compared against plain `[...ids].sort()`, which is not the same
comparator the implementation uses (`.sort((a, b) => a.id.localeCompare(b.id))`) — the two
happen to agree for this test's ASCII-only ids, but the test now asserts against
`.sort((x, y) => x.localeCompare(y))` to actually pin the real comparator.

**`retryOnTransientFsError`'s wrapper around the rename.** I had claimed a genuine transient
Windows lock "cannot be manufactured on any platform." Wrong, and specifically wrong on the
one platform where it matters: it's manufacturable on Windows by opening a real competing
file handle. Added a `win32`-gated test that spawns a child process (`node -e`) which opens
the destination file for read and holds it open for ~70ms, then calls `saveSession` from the
main process ~20ms in — the wrapped rename retries past the transient `EPERM` and succeeds
once the child releases the handle (~120–130ms observed on this machine, confirming the
retry/backoff loop actually ran); a bare `renameSync` in the same position fails immediately.
Mutation-tested: removing the `retryOnTransientFsError` wrapper makes this test fail
(~40ms, immediate `EPERM`) on this Windows sandbox. Skipped (not failed) on non-Windows CI,
since the hazard is Windows-specific by construction (`writeItem` in `rebuild.ts` carries the
identical untested-on-POSIX wrapper for the same reason).

## Full mutation table (round 3 — every guard from all three rounds)

All guards from round 2's table were re-verified to still be correctly restored; the table
below covers what's new or changed this round.

| # | Guard | Result |
|---|-------|--------|
| A | `appendAppliedDiff`'s `appliedRecordsFor` (the reintroduced prototype hazard) | **Killed** — "constructor round-trips through save and load" test |
| B | `appendToLog`'s truncated-line healing prefix | **Killed** — "truncated final line from a crash does not swallow the next appended record on recovery" test |
| C | `readAppliedLines`'s narrowed-to-ENOENT catch | **Killed** — "an applied-log read error other than 'missing' is surfaced" test (directory-in-place-of-file / `EISDIR`) |
| D | `openIngestSession`'s `sourceFile` resume clause, isolated | **Killed** — new dedicated sourceFile-only-perturbation test (previously the untested half of C2's fix) |
| E | `listSessions`'s `.sort()`, round 3 attempt | **Killed** — id/filename-mismatch test, deterministic on every filesystem |
| F | `retryOnTransientFsError` wrapper around the header rename | **Killed on Windows** (confirmed on this sandbox: ~40ms immediate `EPERM` vs. ~130ms successful retry) — a real competing file handle from a spawned child process, not a simulated error |

Zero surviving mutants this round, across every guard added or fixed since round 1's initial
implementation.

## Verification

- `node --test test/ingest/session.test.ts`: 34/34 pass (28 → 34: six new tests this round).
- `npx tsc --noEmit`: clean.
- `npm test`: **769/769** passed (735 original baseline + 34 in this file), run twice, both
  clean.
- `git status --porcelain`: clean apart from the two intended files
  (`src/ingest/session.ts`, `test/ingest/session.test.ts`).

## Commit (round 3)

Committed as a follow-up fix addressing the re-review findings.
