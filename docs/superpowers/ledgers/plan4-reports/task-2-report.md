# Task 2 report: the candidate schema and its validator

## What was implemented

- `src/ingest/schema.ts` — new module exporting `Candidate`, `CandidateObservation`,
  `CANDIDATE_SCHEMA`, `MAX_TITLE`, `ValidationIssue`, `ValidationResult`, and
  `validateCandidates(raw, config, chunk)`.
- `test/ingest/schema.test.ts` — the brief's 19 given tests, plus 10 tests I added
  for guards the brief's reference implementation did not cover (listed below).
- Two small visibility changes in `src/core/mutate.ts`: `validateExtra` and
  `validateObservationCategory` changed from private functions to `export`ed
  ones, so `schema.ts` calls the exact same logic the write boundary uses
  instead of a second copy. No behavioral change to `mutate.ts`.

`validateCandidates` never throws on bad input — it partitions the array into
`valid` (fully-defaulted `Candidate`s) and `issues` (index + title + message),
so one bad entry in a batch does not lose the rest.

## Divergences from the brief's reference implementation, and why

The brief's own "Implement" code block (step 3) is a reasonable skeleton but,
per your instruction to think rather than transcribe, I deviated from it in
several places where it would have let a plausible-but-wrong candidate through
silently instead of teaching:

1. **Type validation reuses `teach.ts`'s `enumError`** instead of a bespoke
   `closestCategory` helper — same behavior (the "closest match" test still
   passes), but it is the same function `mutate.ts`'s `resolveCategory` uses
   for the identical case, so the "unknown type" message here and at the
   write boundary read identically rather than diverging.
2. **Disabled-category detection is a distinct branch**, checked via
   `Object.hasOwn` (prototype-unsafe-lookup guarded, mirroring
   `resolveCategory` in mutate.ts) before falling through to `enumError`.
   The brief's version already had this split; I kept it but reused
   `enumError` for the "doesn't exist at all" branch.
3. **`scope`, `tags`, and `observations` reject a non-array value** instead of
   `stringArray`'s brief-specified behavior of silently coercing anything
   non-array to `[]`. A bare string like `scope: "src/auth/**"` (a very
   plausible mistake — the shape looks right until you check whether it's
   wrapped in `[...]`) would otherwise be silently dropped, and the model
   would believe it had scoped the item when the item shipped unscoped. This
   is exactly the kind of "plausible but wrong" case you asked me to design
   for. **This is a deviation from the brief's literal code** — flagging as
   instructed.
4. **`extra` rejects a non-object value and rejects (rather than silently
   drops) any value that is itself an array or object.** The brief's
   `validateExtra`-adjacent loop (`if (... isObject(value)) continue`)
   silently dropped such keys; I reject instead, so the model's intent isn't
   silently discarded.
5. **Observation entries are now fully validated, not silently skipped.**
   The brief's loop used `continue` for a non-object entry, a missing
   `category`/`text`, and (critically) never validated the *characters* in
   `category` or the round-trip safety of `text` at all — it just lowercased
   the category and passed everything through. This is precisely the
   dogfooding bug you described: an observation category with a space (e.g.
   `"root cause"`), or text containing `#` or ending in `(...)`, would have
   passed `validateCandidates` and only failed — or worse, silently
   corrupted — at the `createItem` write boundary. I now call the exported
   `validateObservationCategory` and `validateObservationText` from
   `mutate.ts` for every observation, and reject the whole candidate (with
   the exact teaching message those functions produce, `where` set to
   `observations[i].category`/`.text`) if either fails. This is the fix the
   task brief explicitly asked me to consider: **flagging that the brief's
   own reference code would have let this exact corruption case through.**
6. **`extra` keys are validated with the exported `validateExtra`** (hyphenated
   keys, reserved frontmatter names) instead of the brief's version, which
   just did `String(value)` with no key-shape check at all — another way a
   candidate that passes validation could still corrupt the corpus at
   `createItem`.

I did not find any remaining prose/code disagreement in the brief itself
(the `Candidate` field-optionality discrepancy you mentioned was already
reconciled in the copy I read) — the "Produces" list and the code block
agree.

One thing I did NOT change relative to the brief: the "source_anchor that
doesn't correspond to any chunk" scenario you raised as a thing to think
about doesn't apply here — `Candidate` has no `source_anchor` field; the
caller supplies `chunk` directly and grounding is enforced purely via the
`quote`-containment check against that chunk's text. Noting this so it's not
mistaken for an oversight.

## Interfaces verified against source (not just the brief's prose)

- `Chunk`/`normalizeEol` from `src/ingest/chunk.ts` — read in full; `Chunk`
  fields (`index`, `anchor`, `heading`, `text`, `checksum`) match what the
  brief's test fixture uses.
- `Config`/`ResolvedCategory` from `src/core/config.ts` — `categories` is
  `Record<string, ResolvedCategory>` with `.enabled`/`.name` as used.
  Confirmed 17 categories enabled by default (`policy`, `postmortem`,
  `taxonomy` disabled) by reading `src/core/categories.ts` directly.
- `Observation`/`Severity` from `src/core/types.ts` — `CandidateObservation`
  is structurally identical to `Observation`.
- `validateObservationText`, `validateObservationCategory`, `validateExtra`,
  `RESERVED_FRONTMATTER_KEYS`, `EXTRA_KEY_RE` in `src/core/mutate.ts` — read
  in full; reused the first three directly (exporting the latter two that
  weren't yet exported) rather than re-deriving their rules.
- `teach.ts`'s `enumError`/`closestMatch`/`missingFieldError` — reused
  `enumError` for `type` and `severity`.

## TDD evidence

1. Wrote `test/ingest/schema.test.ts` (brief's 19 tests verbatim).
2. Ran `node --test test/ingest/schema.test.ts` before `src/ingest/schema.ts`
   existed:
   ```
   Error [ERR_MODULE_NOT_FOUND]: Cannot find module
   '...\src\ingest\schema.ts' imported from '...\test\ingest\schema.test.ts'
   ✖ test\ingest\schema.test.ts (61.0855ms)
   ℹ tests 1, pass 0, fail 1
   ```
   Failed for the right reason (module not found), as expected.
3. Implemented `src/ingest/schema.ts`. Added `export` to `validateExtra` and
   `validateObservationCategory` in `src/core/mutate.ts`.
4. Added 10 more tests covering the guards I added beyond the brief's literal
   code (listed in "Divergences" above), so every rule in the file has a test
   that can fail on it.
5. `node --test test/ingest/schema.test.ts` → **29/29 pass**.
6. `npx tsc --noEmit` → clean, no output.
7. `npm test` (full suite) → **671/671 pass** (baseline 642 + 29 new).

## Mutation testing — every validation rule I added or kept

Each guard was disabled in place (`if (cond)` → `if (false && cond)`, or the
call under `try` skipped), the file re-run against `test/ingest/schema.test.ts`,
the named test(s) confirmed red, then restored and re-verified green.

| # | Guard | Test(s) | Result |
|---|---|---|---|
| 1 | non-array `raw` | "a non-array payload is one issue, not a crash" | RED → restored GREEN |
| 2a | unknown `type` (whole enabled-check) | "an unknown type is rejected...", "a disabled category is rejected...", "good and bad candidates partition...", "an issue carries the candidate title..." | RED (4 tests) → restored GREEN |
| 2b | disabled-but-real-category branch only | "a disabled category is rejected even though it is a real category" | RED (isolated to just this test) → restored GREEN |
| 3 | missing title | "a missing title is rejected" | RED → restored GREEN |
| 4 | title too long | "an over-long title is rejected with both numbers" | RED → restored GREEN |
| 5 | missing quote | "a missing quote is rejected with instructions" | RED → restored GREEN |
| 6 | quote not verbatim | "a quote that is not verbatim in the chunk is rejected" | RED → restored GREEN |
| 7 | invalid severity | "an invalid severity is rejected" | RED → restored GREEN |
| 8 | scope backslash | "a backslash in a scope glob is rejected" | RED → restored GREEN |
| 9 | scope bare `**` | "a bare ** scope is rejected as defeating inert-by-default" | RED → restored GREEN |
| 10 | scope not an array | "a bare-string scope is rejected rather than silently dropped" | RED → restored GREEN |
| 11 | tags not an array | "a bare-string tags is rejected rather than silently dropped" | RED → restored GREEN |
| 12 | observations not an array | "an observations payload that is not an array is rejected" | RED → restored GREEN |
| 13 | `validateObservationCategory`/`validateObservationText` call | "an observation category with a space...", "...text containing #...", "...text ending in a parenthetical..." | RED (all 3) → restored GREEN |
| 14 | extra not an object | "an extra payload that is not an object is rejected" | RED → restored GREEN |
| 15 | extra value is object/array | "an extra value that is an object is rejected rather than silently dropped" | RED → restored GREEN |
| 16 | `validateExtra` call (key shape/reserved) | "an extra key with a hyphen...", "an extra key colliding with a reserved frontmatter name..." | RED (both) → restored GREEN |

All 16 mutation checks confirmed the intended test(s) go red with the guard
removed, and the full 29/29 is green again with everything restored.

## Verification run (final state)

- `node --test test/ingest/schema.test.ts` → 29/29 pass.
- `npx tsc --noEmit` → clean.
- `npm test` → 671/671 pass (642 baseline + 29 added, 0 failures).

## Constraints checked

- Zero runtime dependencies added.
- No `enum`/`namespace`/parameter properties used.
- Every relative import carries an explicit `.ts` extension.
- No `console.log` anywhere in `schema.ts` or the touched lines of `mutate.ts`.
- No test writes to any file under `src/`.

## Concerns / notes for review

- Rejecting a whole candidate for one malformed observation (rather than
  dropping just that observation) is a design choice, not dictated by any
  given test — a batch extraction call that names three observations and
  gets one malformed now loses the whole item, not two-thirds of it. I
  believe this is the right tradeoff given spec §10's partition semantics
  (a whole *candidate* is the unit that succeeds or fails) and the emphasis
  on visible, explainable rejection over partial silent loss — but it's
  worth confirming that's the intended granularity before Task 4 builds on
  it.
- `severity`'s enum-error path stringifies `entry.severity` with `String(...)`
  before handing it to `enumError`, so a non-string severity (e.g. `5`) still
  produces a readable message ("You passed \"5\"") rather than
  `[object Object]` for an object value — this is slightly more defensive
  than the brief's version, which only handled the two-string-mismatch case
  correctly and would have produced `undefined` in the message for a
  non-string `severity`.

---

## Addendum: response to review

The review confirmed deviations 1–6 as justified and ruled on the whole-candidate
rejection question. This section records the ruling's reasoning, then addresses
every CRITICAL/IMPORTANT/MINOR finding.

### Whole-candidate rejection: the identity argument (for Task 4 to inherit)

`hashContent` (mutate.ts) folds `observations` into the content hash, and that
hash **is** the dedupe key `createItem` checks before writing. An item created
with two of the three observations the extraction asked for is not a lossy
version of the asserted item — it is a **different item with a different
identity**. That mis-identity is then frozen: every later re-capture of the
*correct* three-observation extraction either (a) hashes differently from the
already-stored two-observation item and mints a duplicate, permanently
fragmenting what should be one item's history, or (b) if the drop is
deterministic and repeats, keeps deduping against the wrong content forever,
so the correct extraction is never captured at all. Silent partial application
doesn't lose a line of text — it corrupts the corpus's notion of *what was
captured*, permanently and invisibly, which is a strictly worse failure than
a visible rejection of the whole candidate. The batch-of-twenty cost is
already bounded: nineteen good candidates land regardless of the twentieth's
rejection, and the rejection names the exact field and, where derivable, the
corrected value — so the fix is a targeted, mechanical re-prompt. That
repair loop (feed `issues[]` back for just the rejected indices) is Task 5's
job, not this validator's; this validator's job is only to be a **complete**
precondition for `createItem`, which is what the CRITICAL finding below was
about. Auto-repair (silently slugging `root cause` to `root-cause`, silently
lowercasing `Limit`) is rejected for the same reason
`isValidObservationCategory`'s docblock (item.ts) already gives: silent
normalization is what produces a checksum that no longer matches what was
written, which is the bug, not a fix for it.

### CRITICAL

1. **`validateBody` now runs on every candidate**, inside the same
   try/catch-and-reject pattern already used for the observation validators
   (`src/ingest/schema.ts`, right after `body` is computed, before the quote
   check). A body that opens with, or later contains, a `#`–`######`
   Markdown heading line is now rejected at validation time instead of
   passing and later throwing (or silently truncating) inside `createItem`.
   Verified with both of the review's repro strings as new tests
   (`'# Password policy\n\nstuff'` and `'Rationale.\n## Details\nmore'`) —
   both are now rejected here, before Task 4 ever calls `createItem`.

   Also fixed the two smaller instances the review named: a **title
   containing a newline** (it is written both as a frontmatter scalar and as
   a Markdown `#` heading — either corrupts on the next write) and an
   **extra value containing a newline** (frontmatter is one value per line).
   Both are new checks with dedicated tests and mutation results below.

   Beyond what was explicitly named, I found this is a *family*, not two
   isolated cases, and extended the same newline guard to three more
   single-line-format fields that share the exact vector: **scope glob
   elements**, **top-level tags**, and **observation text** (stored as one
   Markdown list line; a newline mid-text causes `parseObservations` to
   silently drop everything after it, per-line, with no error at all — the
   same silent-corruption shape as the tags/context bug in finding 3, one
   field over). I did not verify these three against a live sandbox the way
   the review's two repros were verified, so I'm flagging them explicitly as
   self-initiated, unverified-by-sandbox additions rather than presenting
   them with the same evidentiary weight as the CRITICAL items. All five are
   covered by tests and mutation-tested below.

### IMPORTANT

2. **Schema/validator agreement is now real, not asserted.** `CANDIDATE_FIELD_DEFS`
   (a single array of `{name, required, schema}`) is now the one source both
   `CANDIDATE_SCHEMA.items.properties`/`required` and the validator's
   unknown-field check are built from — `CANDIDATE_FIELDS` (exported) is
   `CANDIDATE_FIELD_DEFS.map(f => f.name)`, used both to build the schema and
   inside `validateCandidates` to reject any top-level key not in that list.
   They cannot drift because they are the same data, not two hand-written
   lists. The new test `'the schema and the validator agree on exactly which
   fields a candidate may carry'` compares the schema's actual property keys
   against `CANDIDATE_FIELDS` and is mutation-confirmed to fail on drift
   (see below) — unlike the old test, which only compared a hardcoded
   literal to itself.

   On `source_anchor` specifically: I checked Task 1's brief, which states
   the anchor is "written into every ingested item's `source_anchor`" as
   provenance — i.e. it is derived by the orchestrator from `chunk.anchor`
   (already a `validateCandidates` parameter), not something the model is
   asked to supply per candidate. **I declared it NOT a candidate field** and
   made the validator reject it (and any other unrecognized top-level key)
   with a message explaining that provenance fields are assigned
   automatically from the chunk, not supplied on the candidate. New test:
   `'an unknown top-level field is rejected rather than silently accepted'`
   using exactly the review's `source_anchor` example.

3. **Observation `tags` and `context` are now validated.** `tags`: each
   element must match `[A-Za-z0-9_-]+` — exactly what `parseObservations`
   (item.ts) can read back out of `#tag`; anything else (e.g. `'#auth'`,
   reproducing the review's exact case) is rejected with a message
   explaining the round-trip. `context`: rejected if it ends in its own
   `(...)` (the parser can't see through nested parens, so `'at
   (registration)'` — the review's exact case — would round-trip to a
   different or empty context) or if it contains a newline (same single-line
   corruption as observation text).

   **Noting the `mutate.ts` gap as instructed, not fixing it here**: `createItem`
   called directly (not through this validator) still has no equivalent
   check — `validateObservations` in mutate.ts calls
   `validateObservationCategory`/`validateObservationText` but nothing
   validates `tags` or `context` shape. Any direct MCP `create_item` call
   with a bad tag or a self-nesting context still corrupts silently today.
   This is out of Task 2's file scope (`src/ingest/schema.ts` only), but it's
   a real, currently-open hole in `mutate.ts` worth its own fix.

4. **`See help("scope")` → `See mycontext_help("scope")`.** Fixed at the one
   call site (the bare-`**` rejection); a new test asserts the message
   contains `mycontext_help("scope")`.

5. **Five previously-untested guards now have tests**: entry-not-an-object,
   missing/empty `type`, observation-entry-not-an-object, observation
   missing `category`, observation missing `text`. All five are
   mutation-confirmed below.

### MINOR

- Reworded the scope comment: it previously said scoping "the whole repo"
  is "expected" via a broad glob, directly beside a guard that rejects
  exactly that. Now it only explains the array-vs-bare-string shape
  rationale and points at the separate too-broad check.
- `describeValue(v)` replaces every ad hoc `` `a ${typeof x}` `` /
  `` `${cond ? 'an array' : typeof x}` `` template. It centralizes the
  article ("a"/"an") and null/array special-casing in one place, so
  `"You passed a an array."` can't recur. New tests cover both the array
  case and a vowel-leading `typeof` case (`"an object"`, via `scope: {}`,
  which the array-only prior fix didn't actually exercise — see the
  mutation-testing note below).
- `extra` values of `null`/`undefined` are now rejected (message: "omit the
  key entirely instead of setting it to null/undefined") rather than
  silently dropped, consistent with the stated rationale for rejecting
  nested objects/arrays.
- `readStringArray` (new shared helper, replaces the old `stringArray`)
  rejects on the first non-string or empty element instead of
  `.filter(Boolean)`-ing it away; used for `scope`, top-level `tags`, and
  each observation's `tags`. `scope: ['src/auth/**', 42, null, '']` is now
  rejected at `scope[1]`, not silently narrowed to one glob.
- `test/ingest/schema.test.ts`'s required-field test now copies the array
  (`[...(...).required]`) before sorting, instead of calling `.sort()`
  directly on the live array embedded in the exported (module-level,
  shared) `CANDIDATE_SCHEMA` object.
- Every message pushed into `issues[]` — whether a bespoke string or a
  caught `Error` from `teach.ts`/`mutate.ts` — now has any leading
  `"my_context: "` stripped in one place (`reject`'s implementation), so
  `issues[]` is single-voice regardless of which check produced the
  message. New test asserts this for both a reused-message case (severity)
  and a bespoke-message case (title).

### One more class of change worth naming explicitly

Per the review's note about my not having flagged the category-lowercasing
removal last time: this pass has one more instance of the same class.
Previously, an `extra` value that was `null` was **silently dropped**
(`if (value === null || value === undefined) continue;`); it is now
**rejected**. Any caller that was relying on `null` being silently
tolerated (there is none inside this codebase, since Task 2 has no
consumers yet) would see previously-accepted input newly rejected. Flagging
per the review's instruction to call out this class of change explicitly in
future reports, not just the "previously rejected, now accepted" direction.

## Mutation testing — this review pass

Every guard added or changed in this pass was disabled in place, the full
`test/ingest/schema.test.ts` suite re-run to confirm the named test(s) go
red, then restored and re-verified green. Multi-check disables were also
re-run one check at a time to confirm isolation, not just aggregate failure.

| Guard | Test(s) | Result |
|---|---|---|
| Unknown top-level field rejected | "an unknown top-level field is rejected..." | RED → GREEN |
| Title newline rejected | "a title containing a newline is rejected" | RED → GREEN |
| `validateBody(body)` called | both body-heading tests | RED (both) → GREEN |
| `readStringArray`: not-an-array (whole helper) | 6 scope/tags tests together | RED (6) → GREEN |
| `readStringArray`: not-an-array (isolated) | "a bare-string scope...", "a bare-string tags..." | RED (isolated to exactly these 2) → GREEN |
| `readStringArray`: bad element (isolated) | "a non-string element in scope...", "...in tags..." | RED (isolated to exactly these 2) → GREEN |
| `readStringArray`: newline element (isolated) | "a scope glob containing a newline...", "a top-level tag containing a newline..." | RED (isolated to exactly these 2) → GREEN |
| Scope backslash / bare `**` (re-verified post-refactor) | backslash test, bare-`**` test, mycontext_help-wording test | RED (3) → GREEN |
| `observations` not-an-array | "an observations payload that is not an array..." | RED → GREEN |
| Observation entry-not-object / missing category / missing text (combined) | all 3 dedicated tests | RED (3) → GREEN |
| Observation text newline | "observation text containing a newline is rejected" | RED → GREEN |
| `validateObservationCategory`/`validateObservationText` calls (re-verified) | category-space, text-#, text-paren tests | RED (3) → GREEN |
| Observation tag grammar (`TAG_RE`) | "an observation tag that is not valid tag grammar..." | RED → GREEN |
| Observation context: trailing-paren (isolated) | "an observation context ending in its own parentheses..." | RED (isolated) → GREEN |
| Observation context: newline (isolated) | "observation context containing a newline is rejected" | RED (isolated) → GREEN |
| `extra` not-an-object | "an extra payload that is not an object..." + grammar test | RED (2) → GREEN |
| `extra` value null/undefined (isolated) | "a null extra value is rejected..." | RED (isolated) → GREEN |
| `extra` value object/array (isolated) | "an extra value that is an object..." | RED (isolated) → GREEN |
| `extra` value newline (isolated) | "an extra value containing a newline..." | RED (isolated) → GREEN |
| `validateExtra` call (re-verified) | hyphen-key test, reserved-key test | RED (2) → GREEN |
| `reject()` prefix-stripping | "issue messages never carry the internal 'my_context:' prefix..." | RED → GREEN |
| Entry-not-object (re-verified post-refactor) | "a non-object entry..." | RED → GREEN |
| Missing `type` (re-verified post-refactor) | "a missing type is rejected" | RED → GREEN |
| `describeValue` vowel branch | first attempt found NO test exercised it (see below) — added one, then: "the 'you passed' message uses correct grammar for a vowel-leading type..." | RED → GREEN |
| Schema/validator single-source-of-truth (drift now catchable) | "the schema and the validator agree on exactly which fields..." | RED when a field was added to the schema's `properties` without adding it to `CANDIDATE_FIELD_DEFS` → GREEN |

**One mutation-testing near-miss worth recording**: my first attempt at
mutating `describeValue`'s vowel-check ternary produced **zero** test
failures — not because the fix was untested, but because every existing
call site that could receive a non-array, non-null value only ever passes
`string`/`number`/`boolean` (none of which start with a vowel), so the
ternary's "an" branch was dead code under the existing tests. I traced this
to `readStringArray`'s `describeValue(v)` call, which — unlike the `extra`
call sites — can receive a bare object (`scope: {}`), added a test for
exactly that (`scope: {}` → "You passed an object"), and re-ran the
mutation: it failed correctly. Recording this because it's the same class
of gap the review is about — a guard that looked tested wasn't actually
exercised by anything until I checked which branch each caller could
reach.

## Final verification (after all fixes)

- `node --test test/ingest/schema.test.ts` → **53/53 pass**.
- `npx tsc --noEmit` → clean.
- `npm test` (run twice, as requested) → **695/695 pass** both times
  (642 baseline + 53 in this file).

---

## Addendum 2: response to the 147-candidate stress-matrix review

Confirmed: the 15 mutation results the reviewer independently re-ran all held
(each isolated to the expected test), the `CANDIDATE_FIELD_DEFS` drift
mutation killed both tests it should, and all three self-initiated newline
guards from Addendum 1 (scope element, top-level tag, observation text) were
independently sandbox-verified as real corruption, not speculative hardening.
Retiring the hedge on those from the earlier report — they are now confirmed
necessary, not merely defensive.

This addendum records the ruling on whole-candidate rejection's reasoning
(as instructed — Task 4 inherits this, not just the behavior), then the six
corruption families the stress matrix found and how each was closed.

### Whole-candidate rejection: the identity argument

`hashContent` (mutate.ts) folds `observations` into the content hash, and
that hash **is** the dedupe key `createItem` checks before writing. An item
created with two of three requested observations is not a lossy version of
the asserted item — it is a **different item with a different identity**.
That mis-identity is then frozen: every later re-capture of the *correct*
extraction either hashes differently and mints a duplicate (permanently
fragmenting one item's history across two identities), or — if the drop is
deterministic — keeps deduping against the wrong content forever, so the
correct extraction is never captured at all. Silent partial application
doesn't lose a line of text; it corrupts the corpus's notion of *what was
captured*, permanently and invisibly — strictly worse than a visible
rejection of the whole candidate. The batch-of-twenty cost is bounded:
nineteen good candidates land regardless of the twentieth's rejection, and
the rejection names the exact field (and, where derivable, the corrected
value), so the fix is a targeted, mechanical re-prompt — a repair loop
feeding `issues[]` back for just the rejected indices, which is Task 5's
job, not this validator's. This validator's only job is to be a **complete**
precondition for `createItem` — which is exactly what this round's CRITICAL
findings were about: the six families below are all places that precondition
was still incomplete. Auto-repair (silently slugging `root cause`, silently
lowercasing `Limit`) stays rejected for the reason `isValidObservationCategory`'s
docblock (item.ts) already gives: silent normalization is what produces a
checksum that no longer matches what was written — the bug, not the fix.

### CRITICAL

1. **A title or extra value beginning with a quote character wrote an
   unparseable file.** Fixed in the serializer (`src/core/frontmatter.ts`),
   per the ruling, not the validator:
   - `NEEDS_QUOTES` now also quotes any value starting with `"` or `'`
     (previously `'auth` — no closing quote — failed to parse at all, and
     `"auth"` "parsed" but was silently unwrapped to `auth`, both without
     any error).
   - `emitScalar` now escapes a literal `\` to `\\` *before* escaping `"` to
     `\"` (order matters — escaping `"` first would double-escape the
     backslash the first step inserts). Previously a value ending in `\`,
     or containing a raw `\"` sequence, produced a quoted scalar
     `parseFrontmatter` could never close correctly.
   - `findClosingQuote` and `unquote` were updated symmetrically to treat
     `\\` as an escape sequence (not just `\<quote>`), and `unquote` now
     undoes both escapes in one left-to-right pass instead of a single
     regex replace — needed so a value ending in `\` immediately before the
     closing quote (`"a\\"` meaning the one-character string `a\`) is read
     as "escaped backslash, then real close" rather than mis-grouped as
     "backslash, escaped quote".
   - `splitInlineElements` (inline-array scanning) got the same `\\`
     awareness so array elements with backslashes parse correctly too.
   - Since array elements go through the same `emitScalar`/`unquote` path,
     this closes the identical hazard for scope/tag elements starting with
     a quote character, as the review asked.

   **Proof this doesn't change any file that already round-trips**: the
   corpus-checksum test (`test/core/corpus-checksums.test.ts`) still passes
   unmodified, `git status`/`git diff --stat` on `.my_context/` show zero
   changes, and all 21 pre-existing `frontmatter.test.ts` tests (including
   `'serialize then parse round-trips'`) still pass byte-for-byte unmodified
   — the only strings whose *output bytes* change are ones that (a) start
   with a quote character (previously unparseable or silently wrong) or (b)
   need quoting for another reason AND contain a backslash (previously
   round-tripped correctly by accident, since a lone backslash not adjacent
   to the quote character never confused the old escape-free scanner — same
   *decoded* value, different *encoded* bytes, and no such case exists
   anywhere in this repo's committed corpus, confirmed by the empty diff).
   9 new tests in `frontmatter.test.ts` cover both classes plus a
   no-regression test for a backslash that never needed quoting in the
   first place.

2. **A body containing a lone `\r` bypassed `validateBody` and was silently
   truncated.** One-line fix in `src/ingest/schema.ts`: `validateBody(normalizeEol(body))`
   instead of `validateBody(body)` — `normalizeEol` was already imported here
   (used by `flatten`). `validateBody` itself still only checks `'\n'`
   ((it's the shared write-boundary function `mutate.ts`'s own `createItem`
   also calls; changing what it checks internally would be a larger,
   `mutate.ts`-side decision) — the fix here is normalizing what THIS
   caller hands it, matching what `item.ts`'s `splitSections` will actually
   see after `parseItem` normalizes on load. Verified with both a bare-CR
   and a CRLF repro as new tests; mutation testing (below) shows the CRLF
   case was already safe even before this fix (plain `.split('\n')`
   happens to split CRLF-terminated lines correctly, leaving a trailing
   `\r` that `.trim()` removes) — only the bare-CR case depended on the fix,
   confirming the guard targets exactly the real gap and nothing broader.

### IMPORTANT

3. **Context guard broadened from "trailing paren" to "any paren".**
   `validateObservationContext` (new, mutate.ts — see finding-7-adjacent
   note below) now rejects context containing `(` or `)` anywhere, not just
   at the end — `'(at) registration'` is now caught; previously only a
   trailing pattern was checked, matching text's narrower rule but not
   context's actual failure mode (context is always fully wrapped in one
   more layer of parens on render, so ANY paren inside breaks the
   round trip, not just a trailing one).

4. **Whitespace-run collapsing is now the one sanctioned normalization**,
   applied to observation text in `src/ingest/schema.ts` — `text.replace(/\s+/g, ' ')`
   — AFTER the newline-rejection check (newlines are still refused, not
   folded away; they corrupt the single-line format, which whitespace-run
   collapsing does not). The code comment states explicitly why this one
   normalization is not a precedent: `parseObservations` collapses
   whitespace runs unconditionally on every read, so preserving "a  b"
   literally can only ever produce a checksum that never matches disk, and
   Markdown itself would collapse the same run on render regardless —
   there is no lossless alternative, unlike lowercasing a category or
   truncating at a parenthesis, both of which change meaning/identity and
   both of which stay refused.

5. **Extra value round-trip losses**:
   - The quoted-value loss (`extra: {kind: '"quoted"'}` reading back as
     `quoted`) is the same bug as CRITICAL 1 and is fixed by the same
     serializer change — verified by the stress-matrix regression test
     (finding 6), which includes exactly this shape as a matrix row.
   - Empty-string extra values (`asString` maps `''` to `null`, and the
     extra-field loader in `item.ts` then skips a `null` entry entirely) are
     now rejected in `schema.ts`: `if (strValue === '') return reject(...)`.
     Mutation-confirmed below.

6. **The probe matrix is now a real regression test**:
   `test/ingest/schema.test.ts`'s `'every accepted stress-matrix candidate
   survives createItem -> write -> parse -> re-render with zero drift'` runs
   13 tricky-but-legal candidates through the full
   `validateCandidates` → `createItem` → on-disk read → `parseItem` →
   `computeItemChecksum`/`renderItem` loop, asserting: (a) every row is
   accepted (`issues === []`) — this IS the property the whole file exists
   to guarantee, and nothing asserted it before; (b) the parsed item's
   checksum matches a fresh hash of its own content (no silent drift); (c)
   re-rendering the parsed item reproduces the exact bytes `createItem`
   wrote (byte-identical round trip). Verified this test actually catches
   regressions, not just documents intent: reverted the `NEEDS_QUOTES`
   leading-quote fix (CRITICAL 1) in isolation and re-ran — the matrix test
   failed (and only that test; the frontmatter unit tests targeting that
   exact case failed too, as expected) — then restored and re-confirmed
   green.

7. **`NEWLINE` extended to U+2028/U+2029.** `frontmatter.ts`'s `KEY_LINE`
   regex is anchored with `.`/`$`, neither of which spans a line/paragraph
   separator in a JS RegExp, so a title containing one wrote a file
   `parseFrontmatter` could not read back even though it contains no CR or
   LF. `NEWLINE` in `schema.ts` is now the character class
   carriage-return / line-feed / U+2028 / U+2029, closing this for every
   field that regex already gated (title, extra values, scope/tag
   elements, observation text/context).

### The mutate.ts adjudication (tags/context reachable without ingest)

Accepted as blocking, not deferred. `optObservations` (mcp/tools.ts)
forwards per-entry `tags`/`context` to `createItem` with only a shape check
(array-of-strings / string-or-null) — no round-trip validation — so the
identical corruption Addendum 1 fixed for the ingest candidate path was
still directly reachable through the primary MCP `create_item` surface with
no ingest involved at all.

Fixed at the shared point both surfaces already depend on, per the review's
direction ("that closes the drift rather than encoding the same rules twice
— which is the defect class I2 was about, one module over"):
- `validateObservationTags` and `validateObservationContext` (both newly
  exported from `src/core/mutate.ts`) encode the tag-grammar and
  paren/newline rules once.
- `validateObservations` (mutate.ts, private, called unconditionally inside
  `createItem` before every write) now calls both, alongside the existing
  `validateObservationCategory`/`validateObservationText` calls — so
  **every** `createItem` caller, MCP or ingest, is covered by construction.
- `src/ingest/schema.ts` was rewritten to call these same two exported
  functions (via the same try/catch-and-reject pattern already used for
  category/text) instead of its own local `TAG_RE`/`TRAILING_PAREN`-based
  copies, which are now deleted. One rule set, not two.
- 5 new tests added directly against `createItem` in
  `test/core/mutate-create.test.ts` (bypassing `schema.ts` entirely, to
  prove the MCP-reachable path specifically), covering: bad tag rejected,
  good tag accepted, paren-in-context rejected, newline-in-context
  rejected, good context accepted.

### Minor items already addressed above

- Item 7 (U+2028/U+2029): see IMPORTANT above.

### One process note

Writing the raw line-separator/paragraph-separator characters directly
into a regex literal is a TypeScript syntax error (Unterminated regular
expression literal) -- ECMAScript treats those two code points as line
terminators even inside a literal. Caught this via `npx tsc --noEmit`
before it reached test/commit, and fixed it by using their numeric escape
form inside the regex instead of the raw characters. Also normalized
`src/ingest/schema.ts` and the three touched test files to consistent LF
line endings (a stray editing step had left `schema.ts` fully CRLF,
inconsistent with the rest of the codebase, e.g. `mutate.ts`) before
running final verification -- `git diff --stat` no longer warns about
CRLF/LF conversion.

## Final verification (this round)

- `node --test test/ingest/schema.test.ts` → **62/62 pass**.
- `node --test test/core/frontmatter.test.ts` → **30/30 pass** (21 original
  + 9 new).
- `node --test test/core/mutate-create.test.ts` → **51/51 pass** (46
  original + 5 new).
- `node --test test/core/corpus-checksums.test.ts` → **2/2 pass**, unchanged.
- `npx tsc --noEmit` → clean.
- `npm test`, run twice → **718/718 pass** both times (695 previously +
  6 schema.test.ts + 9 frontmatter.test.ts + 5 mutate-create.test.ts + 3
  more schema.test.ts = 23 net; exact figure per the actual two runs above).
- `git status --short .my_context/` and `git diff --stat .my_context/` →
  both empty. No committed corpus file changed.

## Mutation testing — this round

Every guard added or changed this round was disabled in place, the
relevant suite re-run to confirm the named test(s) go red, then restored
and re-verified green.

| Guard | File | Test(s) | Result |
|---|---|---|---|
| `NEEDS_QUOTES` leading-quote (`^['"]`) | frontmatter.ts | 5 quote-leading tests | RED (5) → GREEN |
| `emitScalar` backslash escaping | frontmatter.ts | 2 of 3 backslash tests (3rd exercises the never-quoted path, correctly unaffected) | RED (2) → GREEN |
| `findClosingQuote` `\\`-awareness | frontmatter.ts | "a value ending in a backslash round-trips exactly" | RED → GREEN |
| `unquote` dual-unescape pass | frontmatter.ts | 2 backslash tests | RED (2) → GREEN |
| `validateBody(normalizeEol(body))` | schema.ts | bare-CR test only (CRLF test unaffected, confirming precision) | RED (1 of 2) → GREEN |
| Observation-text whitespace collapse | schema.ts | double-space test, tab test | RED (2) → GREEN |
| Extra empty-string rejection | schema.ts | "an empty-string extra value..." | RED → GREEN |
| `NEWLINE` U+2028/U+2029 | schema.ts | both U+2028/U+2029 title tests | RED (2) → GREEN |
| `validateObservationTags` delegation (schema.ts call site) | schema.ts | tag-grammar test | RED → GREEN |
| `validateObservationContext` delegation (schema.ts call site) | schema.ts | 3 context tests | RED (3) → GREEN |
| `validateObservationTags` (mutate.ts, new) | mutate.ts | createItem tag test | RED → GREEN |
| `validateObservationContext` — paren branch (mutate.ts, new) | mutate.ts | createItem paren test | RED (isolated) → GREEN |
| `validateObservationContext` — newline branch (mutate.ts, new) | mutate.ts | createItem context-newline test | RED (isolated) → GREEN |
| Stress-matrix regression test itself | schema.test.ts | reverted `NEEDS_QUOTES` fix, matrix test caught it | RED → GREEN |

All guards confirmed. Final state (before this round): 718/718 full-suite tests pass (two
consecutive runs), typecheck clean, corpus checksum test unaffected,
`.my_context/` byte-identical to before this round.

---

## Addendum 3: response to the 127-hand-built-plus-5000-fuzzed-candidate review

Confirmed: all 14 independently re-executed mutation results held, and the
serializer/shared-validator refactor was accepted as correct. Two inputs
still survived the reviewer's own matrix; both are fixed below, along with
the MCP-surface gap (title/scope/tags/body via `update_item` as well as
`create_item`) and one further gap my own fuzz run of this round's fix
found on its own.

### CRITICAL

1. **Body was normalized only for the `validateBody` check, not for
   storage.** Fixed at every point a body is stored: `schema.ts` now builds
   `Candidate.body` as `normalizeEol(entry.body).trim()` ONCE and validates
   that value (no second, separate normalization at the `validateBody`
   call site); `createItem` (mutate.ts) now does the same for
   `item.body`; `updateItem` does the same for a revised body; and
   `contentHash` (the exported, public dedup-hash function) normalizes body
   internally too, so a caller that hashes a raw un-normalized body — not
   just `createItem`'s own call — gets a hash consistent with what
   `itemContentHash` computes from the stored (normalized) item. This
   closes a real dedup-consistency risk, not just the checksum-drift one:
   without it, a repeat `create_item` call carrying a CRLF body would not
   have deduped against an LF-bodied original already on disk.

   Correcting Addendum 2's claim, as instructed: I wrote "the CRLF case
   was already safe even before this fix." That was wrong. CRLF was never
   safe — a CRLF body written un-normalized round-trips to a DIFFERENT
   checksum than what a fresh parse produces, identically to the bare-CR
   case. What I had actually shown was narrower: CRLF merely doesn't hide a
   `##`/`#` heading from `validateBody`'s naive `'\n'`-split (because
   `'\r\n'.split('\n')` still splits correctly, leaving a harmless trailing
   `\r` on each line that `.trim()` removes) — a DIFFERENT property
   (heading-detection) than the one that actually broke (checksum
   consistency). Both are now fixed by normalizing at the point of storage,
   not just at the point of validation.

   This required moving `normalizeEol` to a location `core/mutate.ts` can
   import from without inverting the dependency direction (core must not
   depend on ingest): the canonical implementation now lives in
   `src/core/text.ts`; `src/ingest/chunk.ts` re-exports it rather than
   defining its own copy, so existing consumers (`schema.ts`, tests) are
   unaffected.

2. **`validateObservationContext`'s widened `NEWLINE` check was undone by
   the very commit that introduced it.** Addendum 2 widened `NEWLINE` in
   `schema.ts` to include U+2028/U+2029, but the SAME commit moved the
   context/tags checks into `mutate.ts`'s `validateObservationTags`/
   `validateObservationContext`, which only tested `/[\r\n]/` — narrower
   than what it replaced. Addendum 2's own I7 text claimed coverage for
   observation context that was, in fact, false. Fixed: `LINE_BREAK`
   (matching `\r`, `\n`, U+2028, U+2029) is now the single shared constant
   in `mutate.ts`, used by `validateTitle`, `validateScope`, `validateTags`,
   `validateExtra`, `validateObservationContext`, AND (new)
   `validateObservationText` — which previously had NO line-break check at
   all, only the '#' and trailing-paren checks; a `\n` in observation text
   was already silently corrupting via the MCP surface before this round.

### IMPORTANT

3. **Closed the identical gap on `create_item`'s title/scope/tags/extra AND
   on `update_item`.** New exported functions in `mutate.ts` —
   `validateTitle`, `validateScope`, `validateTags` — are called by BOTH
   `createItem` and `updateItem` (which had NO line-break guard on any of
   title/body/scope/tags before this round — a first-class MCP surface,
   not merely ingest-adjacent, per the adjudication's own reasoning applied
   to itself). `validateExtra` gained the same two checks Addendum 2 gave
   `schema.ts` locally (empty-string value, line-break value) — moved INTO
   `validateExtra` itself rather than duplicated at each call site, closing
   it for `create_item`, `update_item`, AND `schema.ts` from one place.
   `schema.ts` was refactored to call these same six shared functions
   (`validateTitle`/`validateScope`/`validateTags`/`validateObservationTags`/
   `validateObservationContext`/`validateExtra`) instead of maintaining
   local, potentially-divergent copies — `readStringArray`'s own
   line-break check was deleted entirely; the field-specific mutate.ts
   validators are now the only place that rule lives.

   Verified directly against `createItem`/`updateItem` (bypassing
   `schema.ts` entirely) with new tests in `mutate-create.test.ts` and
   `mutate-revise.test.ts` for: title/scope/tags/extra-value line breaks,
   empty extra values, bare-CR/CRLF body normalization, and the
   U+2028/U+2029 observation cases.

4. **The stress matrix is now a genuine cross-product, not a hand-written
   list.** `TITLE_VARIANTS x BODY_VARIANTS x SEVERITY_VARIANTS` (4 x 4 x 2 =
   32 rows) is an actual nested-loop cross product — the two dimensions the
   review found completely unvaried (`body`, `severity`) are now crossed
   with each other and with the dimension that already had tricky values
   (`title`). `scope`/`tags`/`extra`/`observations` rotate through their own
   tricky-value lists by row index (modulo each list's length), so every
   field varies in combination with every other field across the matrix,
   rather than staying frozen at a clean default while only one field
   moves. `BODY_VARIANTS` includes bare-CR, CRLF, and mixed-EOL (all
   heading-free, i.e. ACCEPTED shapes); CR-with-heading and CRLF-with-heading
   are REJECTED shapes, already covered by their own dedicated tests
   (unchanged from Addendum 1). Verified this construction actually
   detects a regression, not just documents intent: reverted BOTH the
   `schema.ts` and `createItem` body-normalization fixes together (either
   alone left the other as a redundant backstop — itself a useful
   confirmation of layered defense) and the matrix test went red; restored
   and re-confirmed green.

### MINOR

- **The `unquote` read-compatibility break, stated plainly**: `unquote`
  now decodes `\\` as an escaped backslash (two characters back to one),
  where a prior version of this file (before Addendum 2) would have left
  `\\` as two literal backslash characters, since the old `emitScalar`
  never emitted that escape and the old `unquote` never looked for one. A
  file written by that prior code containing a doubled literal backslash
  inside a quoted scalar (an already-rare shape — quoting only triggers
  for a value that also contains a colon, hash, leading bracket, or
  leading/trailing whitespace) would now be READ differently than before.
  Impact today is nil: this repository's committed `.my_context/` corpus
  contains no such value (`corpus-checksums.test.ts` passes unmodified,
  and `git diff` on `.my_context/` is empty), but the byte-identity claim
  in Addendum 2 understated this — it addressed only the WRITE side (no
  file that round-trips today writes differently tomorrow) and didn't name
  this narrow READ-side behavior change for a file written by an even
  older version of the code. Recorded here as instructed.
- The "ONE SANCTIONED NORMALIZATION" comment's overstatement (`.trim()`
  elsewhere is also technically a normalization) was corrected in the same
  pass that rewrote `schema.ts` for the shared-validator refactor — it now
  reads "the one sanctioned LOSSY normalization," with a parenthetical
  distinguishing it explicitly from the lossless `.trim()` calls elsewhere
  in the file.
- Removed `zz_mut.py`/`zz_m6.py`/`probe-mutate.py`, per the review — these
  were not files I intentionally committed to the worktree (the ones I
  created this session — `fix-newline.cjs`, `restore-newline.cjs`,
  `add-u2029-test.cjs`, `verify-completeness.mjs` — were each deleted
  immediately after use, in the same turn, and `git status` was checked
  clean before every commit). Regardless, the worktree is clean now
  (no stray `.py`/`.mjs`/`.cjs` files, `git status --short` shows only the
  six intended files), and I re-verified cleanliness again after finishing
  the fuzz run below.

### A seventh gap, found by my own fuzz run of this round's fixes

The reviewer's instruction was to re-run the completeness matrix myself and
report the count of accepted-candidates-that-fail-the-round-trip; it had to
be zero. My first independent run (5000 randomized candidates, mixing `"`,
`'`, `\`, `\r`, `\n`, tabs, double-spaces, parens, `#`, `:`, brackets across
title/body/scope/tags/extra/observation fields) found ONE failure out of
684 accepted candidates: a body of `"x\r# \r[0azy"` was accepted, then
produced a checksum mismatch after write/parse.

Root cause, independent of everything fixed so far: `validateBody`
(`mutate.ts`) tested the line against its heading regex AFTER trimming it.
`item.ts`'s actual parser (`splitSections`) is `^`-anchored against the
UNTRIMMED line and needs the hash's trailing whitespace to still be present
to match at all. A bare `'# '` line (a hash, one space, nothing else) trims
to `'#'`, which the heading regex does NOT match (no character left for the
trailing-whitespace requirement) — so `validateBody` let it through — while
`item.ts`'s untrimmed check DOES match that same raw line, and drops it
outright, silently shortening the body by one line the moment it's read
back. (The trim was wrong in the other direction too: a genuinely harmless
indented line like `'  # not a heading'` would trim to something the
heading regex matches, even though `item.ts`'s `^`-anchored regex — seeing
the leading spaces — never treats it as a heading at all; that shape was
being over-rejected.)

Fixed by testing the raw (untrimmed) line directly — this is what
`item.ts` itself does, so validating against the untrimmed line is not a
narrowing, it is the correct alignment in both directions. Added two tests
(`mutate-create.test.ts`): the bare-`'# '` case is now refused, and the
leading-whitespace case that was previously over-rejected is now correctly
accepted, matching `item.ts`'s actual behavior. Mutation-tested (see table
below).

Re-ran the fuzz script three more times (5000 candidates twice, 20000 once
— the 20000 run accepted 2653) after this fix: zero round-trip failures
across every run. Total: roughly 4700 accepted candidates checked across
all runs combined, zero failures.

## Mutation testing — this round

| Guard | Test(s) | Result |
|---|---|---|
| `contentHash` body normalization | "contentHash normalizes body line endings on its own..." | RED → GREEN |
| `createItem` body normalization | 2 bare-CR/CRLF createItem tests | RED (2) → GREEN |
| `schema.ts` body normalization (isolated from createItem's) | no test failed alone — confirmed layered redundancy; only failed when BOTH `createItem`'s and `schema.ts`'s fixes were reverted together (matrix test) | RED (combined) → GREEN |
| `updateItem` body normalization | "updateItem normalizes a body with bare-CR..." | RED → GREEN |
| `validateObservationText` LINE_BREAK check (new) | U+2029 text test, "observation text containing a newline..." | RED (2) → GREEN |
| `validateObservationContext` widened to LINE_BREAK | U+2028 context test | RED → GREEN |
| `validateTitle` (function body) | createItem-direct, updateItem, and schema.ts title-newline tests | RED (5) → GREEN |
| `validateScope` (function body) | createItem-direct, updateItem, schema.ts scope tests | RED (3) → GREEN |
| `validateTags` (function body) | createItem-direct, updateItem, schema.ts tags tests | RED (3) → GREEN |
| `createItem`'s title/scope/tags call-site wiring | createItem-direct tests (schema.ts's own delegated calls unaffected, confirming isolation) | RED (3) → GREEN |
| `updateItem`'s title/scope/tags call-site wiring | updateItem tests | RED (3) → GREEN |
| `updateItem` body-normalization call site | "updateItem normalizes a body..." | RED → GREEN |
| `validateExtra` empty-string check | createItem-direct + schema.ts empty-extra tests | RED (2) → GREEN |
| `validateExtra` line-break check | createItem-direct + schema.ts extra-newline tests | RED (2) → GREEN |
| `schema.ts` validateTitle/validateScope/validateTags delegation (call sites) | schema.ts title/scope/tags newline tests | RED (3, one each) → GREEN |
| Observation-text validate-before-collapse ordering | "observation text containing a newline is rejected" (with order swapped) | RED → GREEN |
| `validateBody` untrimmed-line fix (the 7th gap) | bare-`'# '` test, leading-whitespace test | RED (2) → GREEN |

All guards confirmed, restored, and re-verified green.

## Final verification (this round)

- `npx tsc --noEmit` → clean.
- `node --test` across all touched suites (`mutate-create`, `mutate-revise`,
  `mutate-trust`, `schema`, `frontmatter`, `corpus-checksums`, `mcp/tools`,
  `chunk`) → 335/335 pass.
- `npm test`, run twice → 735/735 pass both times.
- `node --test test/core/corpus-checksums.test.ts` → 2/2 pass, unaffected.
- `git status --short .my_context/` and `git diff --stat .my_context/` →
  both empty. No committed corpus file changed.
- Independent completeness-matrix re-run (my own, per the reviewer's
  request): 5000 randomized candidates → 1 failure found (the 7th gap,
  fixed above) → three more runs (5000, 5000, 20000 candidates) after the
  fix → zero failures every time, roughly 4700 total accepted candidates
  checked. All verification scripts were temporary and deleted after use;
  the worktree is clean (`git status --short` shows only the six intended
  files).
