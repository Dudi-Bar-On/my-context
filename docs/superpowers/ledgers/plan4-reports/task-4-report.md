# Task 4 report: applyCandidates — dedupe, supersede, provenance

## What was implemented

- `src/ingest/apply.ts`: `candidateHash`, `ingestKey`, `ApplyResult`, `applyCandidates(ctx, session, anchor, raw)`.
  Implementation matches the brief's Step 3 code verbatim (verified against
  every consumed interface in `src/ingest/schema.ts`, `src/ingest/session.ts`,
  `src/core/mutate.ts`, `src/core/slug.ts`, `src/core/types.ts` before trusting
  it — the brief's five out-of-date interface claims mentioned in the task
  prompt were not present in this brief; everything it names matched source).
  Added one doc comment on `applyCandidates` spelling out the concurrency
  contract for future callers (see Prerequisite 2 below).
- `test/ingest/apply.test.ts`: the brief's 12 tests plus 3 I added after
  mutation testing surfaced real gaps (see below): a same-content-different-source-file
  non-dedupe test, an r11-revision test that forces `Store.all()`'s lexical
  id ordering to diverge from chronological revision order, and a
  reload-before-next-chunk concurrency test.
- `src/core/mutate.ts`: `validateRelationTarget` (exported) and
  `validateRelations` (private), guarding every `Relation.target` written
  through `createItem` or `linkItems` — Prerequisite 1.
- `test/core/mutate-revise.test.ts`: 4 new tests for the relation-target guard.
- `test/ingest/session.test.ts`: 2 new tests for Prerequisite 3's two named
  mutants (no source changes to `session.ts` — both catches already existed
  and were correct; the gap was in test coverage, not code).

## TDD evidence

1. Wrote `test/ingest/apply.test.ts` verbatim from the brief. Ran
   `node --test test/ingest/apply.test.ts` before `src/ingest/apply.ts`
   existed: failed with `ERR_MODULE_NOT_FOUND` for `src/ingest/apply.ts` — the
   right reason (module not found, not an assertion failure).
2. Wrote `src/ingest/apply.ts`. Re-ran: all 12 (later 15) tests green.
3. `npx tsc --noEmit`: clean.
4. Full suite: 790 passing (baseline 769 + 21 new: 15 in apply.test.ts, 4 in
   mutate-revise.test.ts, 2 in session.test.ts).

## Every mutation result

All mutations were applied by hand-editing the built source, run against the
relevant test file, observed to fail, then reverted (`diff` confirmed byte-
identical restoration before moving to the next mutant).

| # | Mutant | File | Result | Notes |
|---|---|---|---|---|
| 1 | `target.includes(']')` → `false && ...` | mutate.ts `validateRelationTarget` | **Killed** | `linkItems refuses a "to" target containing "]"` |
| 2 | `LINE_BREAK.test(target)` → `false && ...` | mutate.ts `validateRelationTarget` | **Killed** | `linkItems refuses a "to" target containing a line break` |
| 3 | `assertDraft`'s `if (result.status !== 'draft')` → `false && ...` | apply.ts | **Survives** | Unreachable under every current invariant — see "Concerns" |
| 4 | Drop `item.status !== 'superseded'` filter on `byKey` | apply.ts | **Killed** (after adding a test) | Initially survived — see below |
| 5 | `for (let revision = 2; ...)` → `revision = 1` | apply.ts `nextRevisionId` | **Killed** | `the eleventh revision chains correctly...` (r10 would collide with base id sequencing) |
| 6 | `fromSource` filter dropped (`= everything`) | apply.ts | **Killed** (after adding a test) | Initially survived — see below |
| 7 | `if (previous)` → `false && previous` | apply.ts | **Killed** | `a materially changed item supersedes its predecessor...` |
| 8 | `listSessions`'s `try { readdirSync... } catch { return [] }` removed | session.ts (Prerequisite 3a) | **Killed** (after adding a test) | Test didn't exist before this task |
| 9 | `openIngestSession`'s `try { JSON.parse... } catch { fall through }` removed | session.ts (Prerequisite 3b) | **Killed** (after adding a test) | Test didn't exist before this task |

Mutants #4 and #6 initially **survived** the brief's own test suite — both are
real coverage gaps, not just theoretical ones:

- **#4** (`byKey` head-selection filter): `Store.all()` orders by id
  ascending. For revisions `r2`..`r9`, lexical order and chronological
  (creation) order coincide, so a buggy "last item wins" fallback happens to
  compute the right answer by luck. The divergence only appears once `r10`
  exists (`"...-r10" < "...-r2"` lexically), so a test that only reaches `r3`
  (the brief's own test) can't catch this. I added a test that loops to `r11`
  — the call that creates it is the first one whose iteration order actually
  disagrees with chronological order — which fails clearly under the mutant
  (`actual: '...-r9'`, `expected: '...-r10'`) and passes with the real guard.
- **#6** (`fromSource` per-source-file scoping): no existing test used two
  different source files with identical content. I added
  `'identical content from a DIFFERENT source file does not dedupe'`, which
  fails under the mutant (`1 !== 0` — a spurious dedupe) and passes with the
  real filter.

Mutant #3 (`assertDraft`) is a documented, deliberate exception: the
function's own doc comment says it "states \[the draft invariant\] as an
invariant... rather than trusting the two literals to stay put" — it exists
as a regression trip-wire for a *future* code change (e.g. someone dropping
`status: 'draft'` from the `CreateInput`), not as something today's code path
can trigger. No test can force `createItem` to return a non-`'draft'` status
for an `origin: 'ingest'` call without either (a) calling `createItem`
directly with a corrupted invariant, which duplicates `createItem`'s own
already-tested behavior, or (b) reaching into `apply.ts`'s private function,
which isn't exported. I left it as-is rather than manufacture an artificial
test; this mirrors the "guard that can't be triggered today, only regression-
tested by inspection" pattern the brief itself used for `assertDraft`.

## Prerequisite 1 — `link_items` / `createItem` relation-target validation

Added `validateRelationTarget(target, where)` in `src/core/mutate.ts`,
following the same style as `validateObservationCategory` /
`validateObservationTags` immediately above it: checks the target against
`RELATION`'s actual read-back grammar (`item.ts`:
`/^-\s+(?:([a-z0-9_]+)\s+)?\[\[([^\]]+)\]\]\s*$/i`) — refuses a `]` (the
parser's target group is `[^\]]+`, so a `]` mid-target truncates the match)
and a line break (the regex is per-line-anchored). Wired into both surfaces
that write a `Relation`:

- `linkItems`: `validateRelationTarget(input.to, '"to"')`, right after the
  self-link check and before `requireWritableItem`.
- `createItem`: `validateRelations(input.relations ?? [])` added to the same
  validation block as `validateObservations`, before any lookup/dedupe logic
  runs — so a bad relation target is refused before anything is written,
  matching the existing "validate everything up front" ordering in that
  function.

Confirmed both `to: 'a]b'` and `to: 'x\ny'` now throw instead of silently
writing an unparseable relation (4 new tests, all mutation-killed above).

## Prerequisite 2 — do not trust a stale `pendingAnchors` snapshot

`applyCandidates` itself only ever processes one anchor per call, and never
caches anything across calls: `ctx.store.all()` is read fresh at the top of
every invocation, so dedupe/supersede decisions are always based on the
current index state, not a snapshot from session-open time. `session.chunks`
(the only part of `session` this function reads besides `session.applied`,
which it only ever *writes*) is immutable after `openIngestSession` — chunks
are fixed forever at session-open, so there is no staleness hazard there.

The actual hazard the brief names — a caller looping over
`pendingAnchors(session)` computed once before the loop — belongs to a caller
this task does not implement (the CLI ingest command, task 4.6). I couldn't
"fix" code that doesn't exist yet, so I:

1. Added an explicit doc comment on `applyCandidates` stating the contract:
   a multi-chunk loop **must** call `pendingAnchors(loadSession(root, id))`
   freshly before each iteration, not once before the loop.
2. Added a test (`'a caller that reloads the session before each chunk sees
   the other chunk already applied'`) that exercises exactly this shape:
   `saveSession` after the first `applyCandidates` call, a fresh `loadSession`
   before the second, and asserts `pendingAnchors` on the reloaded session
   correctly excludes the already-applied anchor.

## Prerequisite 3 — two surviving mutants in Task 3's code

Neither needed a source change — both catches already exist and are
correct in `session.ts`. The gap was purely in test coverage:

- `listSessions` on a workspace where `.ingest/` was never created: added
  `'listSessions on a workspace where .ingest/ was never created returns []
  rather than throwing'` in `test/ingest/session.test.ts`. Confirmed it kills
  the mutant (removing the `try`/`catch` around `readdirSync` throws `ENOENT`
  instead of returning `[]`).
- `openIngestSession`'s corrupt-existing-header JSON-parse branch: added
  `'a resumed session with an unparseable existing header (not merely a wrong
  checksum) is rebuilt fresh'`, which hand-corrupts the header file's *bytes*
  (`'{not valid json'`) rather than writing valid JSON with a wrong checksum
  (which the existing test does, and which never reaches `JSON.parse`).
  Confirmed it kills the mutant (removing the `try`/`catch` throws
  `SyntaxError` instead of falling through to rebuild).

## Where the brief disagreed with the built code

Nowhere. Every interface I verified against source (`Candidate`,
`ValidationIssue`, `ValidationResult`, `IngestSession`, `ApplyRecord`,
`MutationContext`, `CreateInput`, `MutationResult`, `createItem`,
`supersedeItem`, `checksum`, `makeId`, `Chunk`) matched what the brief's
Step 3 code assumed. The task prompt's warning about "five \[pre-flight
rulings\] the original was wrong about" and "one task written against a
module that never existed" did not apply to this brief as written.

## Concerns

- **Mutant #3 (`assertDraft`) cannot be exercised by any test that goes
  through the public `applyCandidates` surface.** It is a correct, deliberate
  trip-wire for a future regression, not a live guard against anything today's
  code path can do — flagging this explicitly rather than silently leaving a
  "surviving mutant" unexplained.
- **`applyCandidates` does not itself persist `session.applied` to disk** —
  it only mutates the in-memory `session` object handed to it. This matches
  the brief's produced interface exactly (no `saveSession` call is listed),
  but it means a caller that calls `applyCandidates` and crashes before its
  own `saveSession(root, session)` loses that anchor's apply record entirely,
  even though the *items themselves* were already durably written via
  `createItem`/`supersedeItem`. On resume, `pendingAnchors` would then list
  that anchor as still pending, and a naive re-run would attempt to
  re-extract it — landing on the dedupe path (same candidate → same hash →
  `deduped`, not a duplicate) for an unchanged re-run, but doing real
  (wasted, and non-free — an LLM extraction call) work again. This is a gap
  in the *caller's* durability, not in `applyCandidates`, but it's worth
  flagging now since task 4.6 (the CLI ingest command) is the piece that must
  close it — most simply by calling `saveSession` immediately after every
  `applyCandidates` call, not batched at the end of a multi-chunk run.
- **Concurrent processes applying the *same* anchor of the *same* session
  simultaneously** are not protected against by anything in `apply.ts`. Two
  processes could both compute the same `nextRevisionId` for a new revision
  (since both read `ctx.store.all()` before either writes), then both call
  `createItem` with the same explicit `-rN` id — `createItem`'s own explicit-
  id handling makes the second call either a no-op duplicate (same content
  hash) or a thrown "already exists with different content" error, so this
  fails loudly rather than corrupting data, but a caller driving concurrent
  `applyCandidates` calls against the same anchor should serialize them (e.g.
  one process per session, or a lock per anchor) rather than relying on this
  as a race-free design.
- All temp/probe artifacts were created only in `mkdtempSync(tmpdir())`
  paths via the test fixture; nothing was written under `src/`.

## Commands run (final)

```
node --test test/ingest/apply.test.ts && npx tsc --noEmit
```
→ 15/15 passing, typecheck clean.

```
npm test
```
→ 790/790 passing (baseline 769 + 21 new).

`git status --porcelain` before commit: only the 5 intended files touched
(`src/core/mutate.ts`, `src/ingest/apply.ts` new, `test/ingest/apply.test.ts`
new, `test/core/mutate-revise.test.ts`, `test/ingest/session.test.ts`).

---

# Review round 2 — fixes and evidence

All seven numbered findings plus the six named surviving mutants were
addressed. Full detail follows; the short version: one CRITICAL (bare-bracket
`session.applied` access reintroduced a third time), one real correctness bug
in `ingestKey` (slug-truncation collision), one hazard fixed at the wrong
place (`localeCompare` in a persisted hash), one silent-drop bug (an
all-rejected chunk marked permanently applied), and one guard gap
(`supersedeItem`/`createItem`'s `id` unvalidated as a future relation
target). Two concerns (concurrent same-anchor apply; reworded re-extraction
minting a spurious revision) are accepted as real and out of scope for this
task — documented for Task 6, not "fixed" here since there's nothing in
Task 4's code that was wrong per se.

## CRITICAL — bare-bracket `session.applied[anchor]` access (finding 1)

Fixed by exporting `hasApplied`/`appliedRecordsFor` from `src/ingest/session.ts`
(previously private) and importing them into `src/ingest/apply.ts`, replacing
`session.applied[anchor] ?? []` with `appliedRecordsFor(session.applied, anchor)`.
Added a doc comment on the exported functions in `session.ts` explaining why
they're exported now (a second private copy in `apply.ts` would have been the
same mistake a third time, in a third file — the reviewer's own framing).

Regression test: `'a candidate whose extraction anchor slugifies to
"constructor" does not crash the batch...'` in `test/ingest/apply.test.ts`.
Verified failing before the fix (mutation-confirmed — see below) and passing
after.

## Finding 2 — concurrent apply on the same anchor (accepted, documented, not "fixed")

No source bug to fix — `applyCandidates` never claimed to serialize
concurrent writers, and the reviewer's own finding says "no code comment is
wrong here, so nothing to fix in this task." Changes made:
- Softened `nextRevisionId`'s doc comment: "Never reuses a live id" is now
  qualified ("...only actually true when `taken` reflects every process's
  writes, i.e. a single writer with a current index").
- Added an explicit "Concurrency note this function does NOT protect
  against" paragraph on `applyCandidates` itself, describing the exact
  same-anchor race the reviewer verified (two processes both computing the
  same `nextRevisionId`, second write silently overwriting the first), and
  stating plainly that this function has no lock and a caller must serialize
  same-anchor concurrent ingestion itself.
- Recorded as a **requires a lock** item for Task 6 in this report (not
  "self-limiting," per the reviewer's correction).

## Finding 3 — reworded re-extraction of an unchanged document (accepted, documented)

Also not a Task 4 code bug: `applyCandidates` correctly implements the two
identity rules it was asked to implement; the failure mode here is a property
of *when* a caller calls `saveSession`, which is a Task 6 (CLI) concern.
Expanded the concurrency-note doc comment on `applyCandidates` to state the
stronger reason `saveSession` must be called immediately after every
`applyCandidates` call: not just crash durability (my original reasoning),
but that a non-deterministic LLM re-run of an unchanged document routinely
reproduces reworded (not byte-identical) output, which fails `byHash` and
mints a spurious `-r2` retiring a live, unchanged draft.

## Finding 4 — `localeCompare` in `candidateHash` (fixed)

Replaced `Object.entries(c.extra).sort(([a], [b]) => a.localeCompare(b))`
with a local `compareOrdinal` helper (`a < b ? -1 : a > b ? 1 : 0`), matching
`select.ts`'s `compareStrings` and `canonicalExtra`'s plain `.sort()`.

Test: `'candidateHash sorts extra keys ordinally, not via localeCompare...'`
— uses `Zebra`/`apple` (ordinal: Zebra before apple; typical locale-aware
compare: apple before Zebra) and pins the exact expected JSON via a
hand-computed `checksum(...)` call, so the test fails if the sort order
regresses to anything other than strict ordinal, not just to
`localeCompare` specifically.

## Finding 5 — an all-rejected chunk was permanently marked applied (fixed)

`applyCandidates` now tracks `before = appliedRecordsFor(session.applied, anchor)`
and, after the loop, only marks the anchor applied when either new records
were actually added this call (`records.length > before.length`) or there
were no issues (the legitimate "nothing normative here" case, unchanged from
before). When nothing new was written AND the anchor had never been applied
before AND there are issues, the anchor is left untouched — `pendingAnchors`
resurfaces it on the next check.

An anchor that was ALREADY legitimately applied (has real prior records) and
later gets a re-run yielding only rejects is NOT un-applied — the guard only
suppresses the *first* mark-applied, not a real one already on record.

Two tests: `'a chunk whose candidates are ALL rejected by validation stays
pending...'` and `'an anchor already legitimately applied stays applied even
if a later re-run yields only rejects'`.

## Finding 6 — `supersedeItem` unguarded; `createItem`'s explicit `id`
unguarded; empty relation target accepted (fixed)

- `validateRelationTarget` (`mutate.ts`) now also rejects an empty (or
  whitespace-only) target, with its own message.
- Corrected the function's doc comment: it previously claimed `createItem`'s
  `relations` input was one of the two surfaces that write a `supersedes`
  relation — false; `supersedeItem` is the only place that ever writes
  `supersedes`. Rewrote the comment to name all four real call sites
  accurately: `linkItems`'s `to`, `createItem`'s `relations` input
  (defensive — `applyCandidates` always passes `[]`), `createItem`'s own
  explicit `id` (becomes a future relation target the moment anything
  supersedes this item), and `supersedeItem`'s `id` (the actual write site).
- `createItem` now calls `validateRelationTarget(input.id, '"id"')` when an
  explicit id is given, before it's used for anything.
- `supersedeItem` now calls `validateRelationTarget(input.id, '"id"')` as its
  first real check, before `requireWritableItem` even looks the item up —
  guarding the actual write site the reviewer traced
  (`replacement.relations.push({ type: 'supersedes', target: retired.id })`).

Four new tests in `test/core/mutate-revise.test.ts`: explicit id containing
`]`, empty explicit id, `supersedeItem` with a malformed retiree id (throws
before lookup), `linkItems` with an empty `to`.

## Finding 7 — two distinct candidates collapsing via truncated-slug collision (fixed)

`ingestKey`'s signature grew a third parameter (`title: string`) and now
folds `checksum(title.trim().replace(/\s+/g, ' '))` into the key alongside
`anchor` and `baseId`, so two titles that share a long common prefix (and
therefore the same 60-char-truncated `slugify` output) no longer produce the
same ingest key — they'd need an actual SHA-256 collision on top of the
truncation collision. `applyCandidates`'s one call site was updated to pass
`candidate.title`. `takenIds.add(input.id)` was also moved to fire
immediately after `nextRevisionId` computes the id (not batched to after
`createItem` returns), so a second candidate in the same batch whose
`baseId` collides with the first's still gets a distinct `-r2`-suffixed id
instead of crashing the whole batch on "already exists with different
content."

Tests: the truncation-collision scenario itself (two distinct requirements,
same batch, asserting `created.length === 2` and `superseded.length === 0`),
a direct `ingestKey` unit test pinning that the anchor is part of the key,
and a same-title-different-anchor scenario confirming rule 2 stays anchor-scoped.

## Six named surviving mutants — all killed, evidence below

Every one of the following was independently reproduced by hand-patching the
built source, run, observed to fail, then restored (`diff` confirmed
byte-identical restoration before moving to the next):

1. **`candidateHash` drops `severity`** — killed by
   `'candidateHash is sensitive to severity...'`.
2. **Dedupe record labelled `'created'`** — killed by `'the applied log
   records "deduped", not "created"...'` (and the comprehensive log test).
3. **Every `records.push` removed** — killed (2 tests failed: `records.length`
   assertions dropped from 2/3 to 0).
4. **`ingestKey` ignores `anchor`** — killed by the truncation-collision test
   (a direct `ingestKey('a','x','t') !== ingestKey('b','x','t')` unit test
   also exists but doesn't independently distinguish an anchor-ignoring
   mutant from a correct one on its own reduced form, so the
   `applyCandidates`-level test is the one that actually kills it).
5. **`takenIds.add(outcome.id)` removed** — killed by the truncation-collision
   test: without the (now-earlier) `takenIds.add`, the second candidate's
   `createItem` call throws "already exists with different content" and the
   whole batch dies.
6. **`byHash` first-wins → last-wins** — killed by `'two items sharing a
   (hash-collided) content_hash dedupe deterministically to the first by id
   order'`, which forces two items to share an `extra.content_hash` value
   directly (since exactly one item per hash exists under normal operation)
   and pins that the earlier-id one wins.

## Minor comment corrections

- `apply.ts`'s `candidateHash` doc comment now states that `tags` is also
  excluded from the hash, and what that implies (a tags-only re-extraction
  dedupes and the new tags are silently discarded).
- `assertDraft`'s doc comment no longer claims `createItem` "returns the
  status it actually wrote" unconditionally — it now explains the two no-op
  return paths where that's false, and why neither is reachable from this
  call site specifically (not a property of `createItem`'s return value).
- The concurrency-note paragraph was rewritten so its claim ("does NOT trust
  any snapshot...") sits directly above the `ctx.store.all()` read it
  describes, not four lines above code that reads `session.applied` instead.
- `session.test.ts`'s new corrupt-JSON test comment corrected: the sibling
  "stale/corrupt header" test never reaches the `catch` (not "never reaches
  `JSON.parse`" — `JSON.parse` runs first; it's the checksum comparison
  after it that fails).

## Re-verification

- `npx tsc --noEmit`: clean.
- `npm test`, run twice in full: **805/805 passing both times** (baseline
  769 + 21 from round 1 + 15 new in round 2 — 6 in `mutate-revise.test.ts`,
  9 in `apply.test.ts`).
- `git status --porcelain`: only the 6 touched files (`src/core/mutate.ts`,
  `src/ingest/apply.ts`, `src/ingest/session.ts`, `test/core/mutate-revise.test.ts`,
  `test/ingest/apply.test.ts`, `test/ingest/session.test.ts`). No stray files.
- Every mutation claimed above was independently re-run in this session
  (patch → run → observe failure → restore → diff-confirm) — not merely
  asserted from an earlier table.

## Outstanding, by design (not fixed in this task)

- **Same-anchor concurrent `applyCandidates` calls are unprotected** — no
  lock. Flagged for Task 6.
- **`saveSession` cadence is a Task 6 responsibility** — `applyCandidates`
  cannot enforce it from inside itself; the doc comment states the
  requirement and the reason as strongly as I could without implementing
  code that doesn't belong in this file.

---

# Review round 3 — N1/N2/N3

## N1 — `ingestKey` narrowed rule-2 identity too far (fixed)

Round 2's fix hashed the RAW title, which meant only a byte-identical
re-extraction still superseded — a re-extraction with a trailing period
added, or a different case, minted a competing second draft instead
(exactly the I3 scenario, made worse by the I7 fix meant to help it).

Fix: added `normalizeForSlug` to `src/core/slug.ts` — the same normalization
`slugify` applies (NFKD, strip combining marks, lowercase, collapse
non-alphanumeric runs to one hyphen, trim edge hyphens) but WITHOUT the
60-character truncation. `slugify` is now defined in terms of it
(`slugify` = `normalizeForSlug` + truncate), so there is exactly one
normalization implementation, not two that could drift. `ingestKey` now
hashes `normalizeForSlug(title)` instead of the raw title: this keeps
title-truncation collisions apart (the truncation, not the normalization, is
what caused the collision) while restoring case/punctuation tolerance.

Tests: `normalizeForSlug applies the same normalization as slugify, but
without the 60-char truncation` (`slug.test.ts`, pins both that it matches
`slugify` on short titles and that it does NOT collide on the exact
truncation-collision pair that `slugify` does collide on); `ingestKey
tolerates case and trailing punctuation` (direct unit test); two
`applyCandidates`-level tests for both directions — a trailing-period reword
and a case-only reword each supersede rather than duplicate, landing exactly
one live draft.

## N2 — a truncation-collision id should not read as a revision (fixed; decision recorded)

**Decision: yes** — a distinct-item id collision now takes a different
suffix scheme than a genuine revision. `nextRevisionId` (now `-rN`, called
ONLY when `byKey` already matched a `previous` item — i.e. a genuine
revision) and a new `nextCollisionId` (`-2`, `-3`, ..., the same suffix
style `locateInFamily` in mutate.ts already uses for its own family
disambiguation) are now two separate functions. The `previous` lookup was
moved earlier in the loop (it already existed, just after id-minting) so the
choice between the two schemes can be made before minting the id:
`input.id = previous ? nextRevisionId(...) : nextCollisionId(...)`.

An id that lost the naming coin-flip against an unrelated item now reads as
`REQ-...-internal-2`, not `REQ-...-internal-r2`, and carries no `supersedes`
relation — both are asserted directly in the truncation-collision test.

Mutation-verified in both directions: forcing `nextCollisionId` for a
genuine revision breaks the existing r11-chain test (wrong suffix, `-11`
instead of `-r11`); forcing `nextRevisionId` for the collision case breaks
the truncation-collision test just as hard (mints `-r2`/`-r3` for two
unrelated items with no `previous` link at all, since `nextRevisionId` no
longer has an untaken-baseId fallback — it's now revision-only by contract).

## N3 — the write side of `session.applied` was still bare-bracket (fixed)

Added `setApplied(applied, anchor, records)` to `session.ts`, the write-side
sibling of `hasApplied`/`appliedRecordsFor`. It uses `Object.defineProperty`
rather than assignment, specifically because `applied['__proto__'] = records`
does NOT create an own `'__proto__'` property on a plain object — it invokes
the inherited setter and reassigns the object's actual prototype, corrupting
every future lookup (including `hasApplied`'s own `hasOwnProperty.call`,
which lives on the prototype that write would have just replaced).
`session.applied[anchor] = records` in `apply.ts` was replaced with
`setApplied(session.applied, anchor, records)`.

Per the review's framing (documented reasoning is not a structural
guarantee), I did not settle for a comment explaining why today's anchors
can never literally be `"__proto__"` — I added the accessor and reasoned
about why it's needed anyway, in its own doc comment.

Three new tests: two exercising `setApplied` directly (`session.test.ts`
— an own-property round-trip for `"__proto__"` specifically, verifying
`Object.getPrototypeOf` is untouched, plus an overwrite-not-merge check),
and one exercising it through the real `applyCandidates` call path
(`apply.test.ts` — a hand-built `IngestSession` with a chunk anchored
literally `"__proto__"`, since no real document can produce that anchor
through `slugify`, but the write path should be safe regardless). All three
mutation-verified: reverting either `setApplied`'s own body or its call site
in `apply.ts` back to bracket assignment breaks the corresponding test with
the exact prototype-corruption symptom predicted (`Object.getPrototypeOf`
returns the pushed array instead of `Object.prototype`).

Not touched: `session.ts`'s own two remaining bracket-writes to an
`applied`-shaped object (`foldApplied`'s `applied[anchor] = []` and
`appendAppliedDiff`'s `session.applied[anchor]`, both pre-existing Task 3
code, not flagged by this review round). Same theoretical class of hazard,
currently unreachable for the same reason (no anchor is ever literally
`__proto__`) — left out of scope since the ask was specifically about
`apply.ts`'s write.

## Stray temp directories

Found and removed 6 leftover `myctx-apply-*` directories in `%TEMP%` from
this round's own mutation testing (intentionally-failing assertions in test
fixtures that call `cleanup()` at the end of the test body, which a thrown
`AssertionError` skips). Verified `%TEMP%` clean of any `myctx-`/`mcprobe-`
prefixed directory before finishing.

## Re-verification

- `npx tsc --noEmit`: clean.
- `npm test`, run twice in full: **812/812 passing both times** (round 2's
  805 + 7 new: 2 in `slug.test.ts`, 5 in `apply.test.ts`/`session.test.ts`
  combined — 4 reworded/truncation/collision tests in `apply.test.ts`, 1
  `ingestKey` case/punctuation unit test, 2 `setApplied` tests in
  `session.test.ts`, minus double-counting the `__proto__`-anchor
  `apply.test.ts` test already included above).
- `git status --porcelain`: only `src/core/slug.ts`, `src/ingest/apply.ts`,
  `src/ingest/session.ts`, `test/core/slug.test.ts`,
  `test/ingest/apply.test.ts`, `test/ingest/session.test.ts`.
- `.my_context/items` and `.my_context/config.json`: no changes (confirmed
  via `git status --porcelain --ignored=matching .my_context` — only
  `.my_context/.index.db` shows, and it's gitignored working state, not
  tracked content).
- Every mutation claimed above was independently re-run in this session
  (patch → run → observe failure → restore → diff-confirm byte-identical)
  for N1, N2 (both directions), and N3 (both the call site in `apply.ts` and
  `setApplied`'s own body in `session.ts`).
