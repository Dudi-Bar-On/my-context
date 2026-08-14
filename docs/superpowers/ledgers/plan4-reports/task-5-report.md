# Task 5 report — the extraction request

## What was implemented

`src/ingest/request.ts` per the brief, verbatim except where verification against
source required nothing to change (the interfaces the brief assumed —
`CANDIDATE_SCHEMA`, `MAX_TITLE`, `Chunk`, `IngestSession`, `pendingAnchors`,
`Config`, `ResolvedCategory.{name,description,extraFields}` — all matched
current source exactly; no interface drift found for this task).

Exports: `EXTRACTION_PROTOCOL`, `ExtractionRequest`, `RequestCategory`,
`buildExtractionRequest`, `renderExtractionRequest`, `nextRequest`.

`test/ingest/request.test.ts`: the brief's 9 tests, plus one I added myself
(see mutation testing below) — 10 tests total, all passing.

## Prerequisite: `foldApplied`'s `__proto__` hazard

Fixed in `src/ingest/session.ts`. `foldApplied` had two bare-bracket write
sites:

```ts
if (!Object.prototype.hasOwnProperty.call(applied, anchor)) applied[anchor] = [];
if (record !== null) applied[anchor].push(record);
```

Changed to route through the existing accessors:

```ts
if (!hasApplied(applied, anchor)) setApplied(applied, anchor, []);
if (record !== null) appliedRecordsFor(applied, anchor).push(record);
```

`apply.ts`'s two `session.applied` write/read sites were already using
`setApplied`/`appliedRecordsFor` — `foldApplied` was the only remaining
offender the brief refers to ("two remaining internal write sites" = the two
lines above, both inside this one function).

Added a test in `test/ingest/session.test.ts`: hand-appends
`{"anchor":"__proto__","record":null}` to a session's `.applied.jsonl`,
calls `loadSession`, and asserts `Object.getPrototypeOf(reloaded.applied)`
is still plain `Object.prototype`, `hasApplied`/`appliedRecordsFor` behave
correctly for the `__proto__` key, and normal anchors (`pendingAnchors`)
are unaffected. I verified the test is not vacuous by reverting the fix
and confirming the test fails with `actual: [] / expected: {}` (an
`AssertionError` on `strictEqual` of prototypes) — i.e. it drove the
production-side object's prototype to a bare array, exactly the
documented corruption.

## TDD evidence

- `node --test test/ingest/request.test.ts` before creating `request.ts`:
  `ERR_MODULE_NOT_FOUND` for `src/ingest/request.ts` — fails for the right
  reason.
- After implementation: 9/9 (brief's tests) pass; `npx tsc --noEmit` clean.
- Baseline was 812. Final full suite: **823 passing** (812 + 10 request
  tests + 1 new session `__proto__` test), 0 failing. `npx tsc --noEmit`
  clean.

## Mutation testing

Performed by hand (no mutation-testing tool is wired into this repo).
Each mutant was introduced, the affected test file run, observed
red/green, then reverted:

1. `remaining` calc forced to `pending.length + 1` unconditionally →
   killed (`remaining counts chunks still pending` test goes from
   expected 2 to actual 3).
2. Dropped `.filter((c) => c.enabled)` from the category list → killed
   (`policy is off in the standard profile` assertion fails).
3. `nextRequest`'s `pendingAnchors(session)[0]` mutated to `[1]` → killed
   (`nextRequest walks pending chunks in order` fails).
4. `renderExtractionRequest`'s `.replace(/\r/g, '')` removed → **initially
   survived**. Every current producer of the fields it touches
   (`chunkDocument`/`normalizeEol` for `chunk`/`heading`, hardcoded LF-only
   instruction strings) already yields `\r`-free text by the time it
   reaches this function, so the brief's own LF-only test never exercises
   the strip — it's real defense-in-depth (a caller-constructed
   `ExtractionRequest`, or a `sourceFile` string that only has its
   backslashes checked by `assertPosixRelative`, not its `\r`s) but was
   untested. I added a 10th test that constructs an `ExtractionRequest`
   with `\r` injected into `sourceFile` and `heading` directly and asserts
   `renderExtractionRequest` still strips it. Re-ran the same mutation
   afterward — now killed. This is exactly the class of gap called out in
   the task instructions ("mutation testing cannot tell you... a guard was
   correct but in the wrong place" — here, a guard correct but with no
   test input that ever reaches it).
5. `foldApplied`'s `__proto__` guard — see prerequisite section above;
   confirmed the added session test kills the un-fixed version.

`session.ts`'s `setApplied`/`hasApplied`/`appliedRecordsFor` guards were
already covered by pre-existing tests (`test/ingest/session.test.ts` lines
358–385), not re-mutated by me since they predate this task and are
unchanged.

## What I verified mechanically about the request text vs. what I could only judge

Mechanically verified (via a throwaway script run against the real
`resolveConfig({})`/`validateCandidates`, then removed):

- **Categories named match exactly the enabled set.** `req.categories`
  sorted names === `Object.values(config.categories).filter(enabled)`
  sorted names, for the default (`standard`) profile — 17 categories,
  `policy` correctly excluded.
- **A realistic example candidate (`requirement`, with an observation and
  an `extra.kind`) passes `validateCandidates` with zero issues** and
  round-trips into one valid `Candidate`.
- **The documented `[]` answer for "nothing normative" also passes
  validation** (0 issues) — the request's own instruction to return `[]`
  is not itself invalid input.
- **Rendered output is LF-only** and the embedded ` ```json ` block
  parses back to the same `protocol` — both are the brief's own tests
  (9 and 10 in the final file), and I additionally forced a `\r` through
  `sourceFile`/`heading` directly to confirm the strip isn't a no-op (see
  mutation #4).
- **Size for the test fixture**: rendered request text for the tiny
  two-heading fixture (`# Auth` / `# Storage`, one short paragraph each)
  is ~9,031 bytes. Most of that is the embedded `CANDIDATE_SCHEMA` (fixed
  cost, does not scale with chunk size) and the 17 category
  name+description lines (also fixed). For a chunk at the real ceiling
  (`DEFAULT_MAX_CHARS = 6000` from `chunk.ts`), the request would grow by
  roughly the chunk-size delta on top of that same ~9KB fixed overhead —
  I did not construct a 6000-char worst case chunk to measure the exact
  total, so I cannot give an exact number for the largest possible
  request; call it "fixed overhead ~9KB plus up to ~6KB of chunk text",
  which is a very ordinary context cost, not a red flag.

What I could **not** test mechanically, and only judged by reading:

- **Whether the instruction wording actually gets a real LLM to produce
  well-formed output on realistic, messy documents** — that requires
  running this against an actual model on real PRD/spec prose, which is
  out of scope for this session (no model call is made anywhere in this
  codebase, by design — "my_context has no model of its own"). I can only
  say the instructions are consistent with what `validateCandidates`
  actually enforces (verbatim quote, title length cap via `MAX_TITLE`,
  scope-globs-not-bare-string, draft-only status, empty-array-is-valid),
  because I read `schema.ts` line by line before writing the report and
  cross-checked every claim the instructions make against the validator's
  actual behavior.
- **Whether the instructions are "self-contained" in the sense that an
  agent given *only* this block (no other project context) can act on it
  correctly** — I judge this favorably (it names the callback command and
  MCP tool with concrete argument shapes, states the empty-array case
  explicitly, states the draft/promote workflow, and embeds the schema
  literally rather than describing it in prose) but this is a qualitative
  read, not something I could assert to be true by running a test.
- **Whether omitting a repair loop is the right call for this task.** See
  next section.

## Repair loop — not implemented

The brief's Step 3 code (which I followed) does not build a repair loop:
`buildExtractionRequest`/`nextRequest` always hand back the *next pending
chunk's* full request, never a re-prompt scoped to specific rejected
indices from a prior `ValidationResult.issues`. There is no function in
`request.ts` that consumes a `ValidationResult` at all — `ExtractionRequest`
has no field for "these N indices were rejected, resubmit only those."

Per the task instructions ("if the brief covers that, implement it; if it
does not, say so in your report rather than inventing it") I did not add
one. This means: today, if `applyCandidates` (Task 4) rejects some
candidates in a batch (`ApplyResult.issues`), the caller has no
brief-specified way to ask this module for a request scoped to just the
rejected items — it would have to re-run the same full-chunk
`nextRequest`/`buildExtractionRequest`, which re-asks for everything in
that chunk, not just the failed items. This may be intentional (a future
task in the remaining 10 could own the repair loop, e.g. the CLI/MCP task
that actually drives the apply-then-reprompt cycle), but I want it flagged
explicitly rather than silently absent.

## Concerns

- The repair-loop gap above — worth confirming with the reviewer/plan
  owner whether Task 6/7 (CLI, MCP tool) is expected to own it, since
  `request.ts` as specified has no hook for it.
- The `\r`-strip guard in `renderExtractionRequest` was untested by the
  brief's own test suite before I added a targeted test for it (see
  mutation #4) — worth double-checking nothing else in this file has a
  similar "correct guard, no input path" gap that I didn't think to probe.
- Full request size for a maximum-size (6000-char) chunk was not measured
  exactly; only the fixed ~9KB overhead plus the small fixture's actual
  bytes were measured directly.

---

## Addendum: response to review (commit `58ed397`)

The coordinator's review confirmed the spec, the `foldApplied` prerequisite
(verified in both directions: reverting the bare-bracket writes dies, and
replacing `setApplied`'s `defineProperty` with `Object.assign` also dies —
so the test pins the mechanism, not the call site), and the decision to
defer the repair loop to Task 7. It found four defects and a set of minor
issues in the request text itself, all fixed:

### 1. Four missing validator rules

Added to both `instructionsFor()` (`src/ingest/request.ts`) and the
`CANDIDATE_FIELD_DEFS` descriptions (`src/ingest/schema.ts`), each checked
against the real validator function in `src/core/mutate.ts` before writing:

- `body` must not contain a line starting with a Markdown heading
  (`validateBody`'s `HEADING_LINE = /^#{1,6}\s/`) — the schema literally
  says "why this holds, and what breaks if it does not," which invites
  headings, so this was the highest-probability violation.
- `observations[].category` must be lowercase `[a-z0-9_-]+`
  (`validateObservationCategory` / `isValidObservationCategory`) — the
  schema's `category` field had **no description at all** before this fix.
- `observations[].text` must not contain `#` and must not end in a
  trailing parenthetical (`validateObservationText`).
- `extra` keys must match `^[A-Za-z_][A-Za-z0-9_]*$` and must not collide
  with `RESERVED_FRONTMATTER_KEYS` (`validateExtra`) — named `source_file`,
  `status`, `id` as concrete examples matching the reserved set in
  `mutate.ts`.

### 2. Callback contradiction

`callback.mcp.arguments` no longer carries a `candidates` key at all — not
a fixed placeholder string, not a template array. The instruction line
tells the model, in prose, to add a `candidates` key holding the real JSON
array to the shown arguments object. A model that copies the JSON object
literally and appends a genuine array can no longer produce
`expected a JSON array of candidate items, got string`. A new test
(`'the callback JSON, plus a "candidates" array, is exactly what
validateCandidates accepts'`) asserts `'candidates' in
req.callback.mcp.arguments` is `false`, and that appending `[]` and
validating it produces zero issues.

### 3. Chunk legibility

`renderExtractionRequest` now emits a dedicated `CHUNK — the source text to
read and extract from:` section with the chunk's real prose (real `\n`
line breaks, not JSON-escaped), delimited by a 4-backtick fence — long
enough that an ordinary 3-backtick fenced code block already present in
the source chunk can't prematurely close it, mirroring `chunk.ts`'s own
"longer fence wins" rule. This block sits directly after the instructions,
before the JSON metadata block. The embedded JSON no longer duplicates
`chunk` (nor `instructions`, which is already rendered as bullets) — both
are destructured out of the object before `JSON.stringify` — so the fix
does not simply add a second copy of a multi-thousand-character string on
top of the existing one.

### 4. Mutation coverage

Added 10 new tests to `test/ingest/request.test.ts` that pin request
**content**, not just that it renders/parses. Verified by hand (introduce
the mutation, run `test/ingest/request.test.ts`, observe red, revert) for
all eight named/implied mutants:

| Mutant | Killed by |
|---|---|
| `schema: CANDIDATE_SCHEMA` → `schema: {}` | `'the schema field is the real CANDIDATE_SCHEMA...'` |
| instruction bullets dropped from `renderExtractionRequest` | `'every instruction line is present verbatim in the rendered text...'` |
| callback instruction line removed from `instructionsFor` | `'an instruction names the callback command and tool by name...'` |
| `remaining` forced to always equal `pending.length` (never `+1`) | `'remaining still counts an already-applied chunk when asked for it directly (the +1 branch)'` |
| `.sort(...)` dropped from the category list | `'categories are sorted alphabetically by name'` |
| `heading: chunk.heading` forced to `heading: null` | `'heading carries the chunk's actual section heading'` |
| `chunkIndex + 1` → `chunkIndex` in the header line | `'the header line states the exact chunk position and total...'` |

All were confirmed to survive on the pre-fix test file before the new
tests were added (consistent with the reviewer's report of 9/10
reviewer-written mutants surviving), and confirmed killed after.

### Re-verification: every example still validates

Re-ran the same style of check as the original report, against the amended
`request.ts`/`schema.ts`:
- The small two-heading fixture's realistic example candidate (a
  `requirement` with one observation, an `extra.kind`, hard severity, and
  a verbatim quote) validates with zero issues; `[]` also validates.
- A worst-case ~5,631-char single-paragraph chunk (`# Encryption
  requirements` + repeated sentence padding) renders to 15,800 chars /
  15,843 bytes (~3,950 estimated tokens) — consistent with the reviewer's
  own 5,941-char / 15,681-char measurement. Its own realistic example
  candidate also validates with zero issues.
- Both checks were run via a throwaway script under a temp root, removed
  after use; no file was left under `src/`.

### Minor items folded in

- `"**"`/`"*"`/`"**/*"` are all now named as rejected (schema description
  and instruction bullet), not just `"**"`.
- Title single-line requirement stated explicitly.
- `scope`/`tags`/`observations` must be arrays, not bare strings — stated
  explicitly (a model sending a bare-string `scope` was previously never
  warned this fails).
- `severity` field (`"hard"`/`"soft"`, default `"soft"`) is now mentioned;
  it was absent from the instructions before.
- "chunks remain" reworded to "Including this one, N chunks... still need
  extraction" so it no longer reads as N *additional* chunks.
- The `instructions` array is no longer duplicated into the embedded JSON
  (see §3 above) — folds in the ~1,900-char double-encoding the review
  flagged, since it's now rendered exactly once, as bullets.

### Not changed, flagged instead (per review's own instruction)

- `mycontext ingest-apply`, `ingest_document`, and `mycontext review
  promote <id>` are referenced in the request text and none exist yet in
  this codebase (Tasks 6/7 are expected to add them). The text is accurate
  for the system this artifact is designed for, not for `main` today —
  noting this explicitly for whoever picks up Tasks 6/7, since a host
  agent following today's request literally would fail at the callback
  step until those land.
- The planned repair loop (Task 7, per the review) will need to decide,
  and state to the model, (a) whether to emit the resubmit list or the
  next chunk's full request first, and (b) that rejected items must be
  resubmitted against the *previous* anchor, not the session's next
  pending one — `request.ts` as built doesn't foreclose either design, but
  doesn't decide it either. Given finding 1 (four previously-unstated
  validator rules), rejections are not the rare case this system was
  implicitly designed around, which makes this more urgent for Task 7
  than it might otherwise look.

## Final verification (post-review)

- `node --test test/ingest/request.test.ts` — 20/20 passing (10 original +
  10 new content-pinning tests), including confirming each of the 8
  hand-introduced mutants above goes red before being fixed.
- `node --test test/ingest/schema.test.ts` — 62/62 passing (description
  text changes did not touch any field pinned by an existing assertion).
- `npx tsc --noEmit` — clean, run twice.
- `npm test` (full suite) — **833/833 passing, run twice**, 0 failing
  both times (baseline 812 + 21 new tests total across both rounds).
- `git status --porcelain` — clean apart from the three amended files
  before commit; temp verification roots created under one root per run
  and removed after use, nothing left under `src/`.
- Commit: `58ed397` — "fix: address Task 5 review — teach every validator
  rule, fix callback contradiction, make chunk legible, pin content with
  tests".

## Commands run

- `node --test test/ingest/request.test.ts` (fail-then-pass per TDD)
- `node --test test/ingest/session.test.ts` (39/39, including the new
  `__proto__` test, verified red-then-green)
- `npx tsc --noEmit` — clean
- `npm test` — 823 passed, 0 failed (baseline 812 + 11 new tests)
- `git status --porcelain` — clean apart from the intended 4 files, before
  commit
