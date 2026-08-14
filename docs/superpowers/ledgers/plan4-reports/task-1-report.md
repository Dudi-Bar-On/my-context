# Task 1 report: Source chunking with stable anchors

## What was implemented

- `src/ingest/chunk.ts` — new module, no existing callers wired in (per instruction).
  - `Chunk` interface: `{ index, anchor, heading, text, checksum }`.
  - `DEFAULT_MAX_CHARS = 6000`.
  - `normalizeEol(text)` — collapses `\r\n` and lone `\r` to `\n`.
  - `sourceChecksum(text)` — `checksum(normalizeEol(text).trim())`, using `checksum` from `src/core/slug.ts`.
  - `chunkDocument(text, opts?)` — splits on ATX headings (`#`..`######`) into sections, keeps a
    leading `_preamble` chunk when there's prose before the first heading, drops blank sections,
    and further splits any section body exceeding `maxChars` into numbered sub-chunks (`--1`,
    `--2`, ...), falling back to a hard character-offset cut for a single paragraph that alone
    exceeds `maxChars`.
  - Anchor derivation: `slugify(heading)` (from `src/core/slug.ts`), or `_preamble` for the
    pre-heading section, or the literal fallback `section` when a heading slugifies to the empty
    string (e.g. `# !!!`). Collisions (identical anchor produced by two different sections, e.g.
    two headings with the same text) are disambiguated with a `Map<anchor, count>` walked in
    document order, appending `-2`, `-3`, ... to the second and later occurrences.
- `test/ingest/chunk.test.ts` — the 12 tests specified in the brief, verbatim.

Both files match the brief's Step 1 and Step 3 code exactly; I did not need to deviate from the
brief's proposed implementation.

## TDD evidence

**Step 2 — run before implementing** (`node --test test/ingest/chunk.test.ts`):

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...\src\ingest\chunk.ts' imported from
'...\test\ingest\chunk.test.ts'
...
✖ test\ingest\chunk.test.ts (58.9811ms)
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

Failed for the expected reason (module not found), matching the brief's Step 2 expectation.

**Step 4 — after implementing** (`node --test test/ingest/chunk.test.ts`):

```
✔ an empty document yields no chunks
✔ preamble before the first heading becomes its own chunk
✔ each heading starts a chunk anchored on its slug
✔ the heading line is retained in the chunk text
✔ indexes are sequential and match array position
✔ an oversize section is split into numbered sub-chunks
✔ a single paragraph longer than the limit is hard-split rather than dropped
✔ CRLF input produces identical chunks and checksums to LF input
✔ chunk checksums are stable and differ when the text changes
✔ normalizeEol removes every carriage return
✔ sourceChecksum ignores line-ending and trailing-whitespace differences
✔ a heading of only punctuation still yields a usable anchor
ℹ tests 12
ℹ pass 12
ℹ fail 0
```

`npx tsc --noEmit` — clean, no output.

**Full suite** (`npm test`):

```
ℹ tests 617
ℹ pass 617
ℹ fail 0
```

605 baseline + 12 new = 617. No regressions.

## Anchor-stability assessment

The brief's requirement: anchors must be deterministic and stable across reasonable edits
elsewhere in the document — never derived from a line number or running offset.

The implementation derives each anchor from `slugify(heading text)` alone, then disambiguates
collisions using a `Map<string, number>` that is populated by walking sections **in document
order** and counting how many times each candidate anchor string has already been produced. This
is a count keyed by matching anchor text, not by line number, character offset, or array index —
so it only changes for a given section if the multiset of identical-heading-text sections *before*
it in the document changes.

I convinced myself of this concretely, not just by inspection:

- Ran the full test suite, including the CRLF-equivalence test (`DOC` vs `DOC` with `\n` → `\r\n`
  throughout) which passed with a `deepEqual` on the entire `Chunk[]` array — this exercises
  platform newline stability end-to-end (chunk boundaries, headings, and checksums all identical).
- Wrote an ad hoc script (not committed) that took the brief's `DOC` fixture, produced a second
  version with unrelated prose inserted into the preamble and into the "Auth requirements" body
  (paragraphs that appear *before* the colliding "Password policy" sections in the document), and
  compared the resulting anchor lists. Anchors for `_preamble`, `auth-requirements`,
  `password-policy`, and `password-policy-2` were byte-identical across both versions — editing
  unrelated text elsewhere in the document did not perturb any anchor, including the disambiguated
  suffix on the second colliding heading.
- The one case where an anchor's numeric suffix *can* shift is inserting or deleting a section
  whose heading text collides with the section in question, positioned before it in document
  order. That is a directly related edit (same heading), not an unrelated one, and some
  case-by-case renumbering is an unavoidable cost of keeping colliding anchors deterministic and
  collision-free at all. I judge this an acceptable, well-scoped exception to the stability
  requirement rather than a violation of it — it is exactly the "genuine duplicate" case, not the
  "line number moved because someone edited paragraph one" case the brief warns against.
- Chunk `checksum` is computed only from the chunk's own text (`checksum(part)`), so editing a
  chunk's body changes its checksum without touching its anchor — verified directly by the
  "chunk checksums are stable and differ when the text changes" test, which asserts the anchor is
  unchanged after editing "12 characters" → "16 characters" in one section's body.

Conclusion: the anchor scheme as specified and implemented genuinely satisfies the stability
requirement for unrelated edits. I did not find a case where editing paragraph one silently
re-anchors an item captured from paragraph nine.

## Where the brief and the code agreed / disagreed

No disagreement found. I independently re-read `src/core/slug.ts` before relying on it (per the
task instructions, since the brief warned the plan's original interface descriptions had been
wrong in five places) and confirmed `slugify(title)`, `makeId(prefix, title)`, and
`checksum(content)` (16 hex chars) all match the brief's description exactly, with no surprises
that affected the chunk module's implementation.

## Concerns

- None blocking. One minor observation for later tasks (not an issue in this task): the
  oversize-split fallback increments `partIndex` even for the case where the whole section fits in
  one part (`parts.length === 1`), but the code branches so a single-part section gets the bare
  `base` anchor with no `--1` suffix — consistent with the brief's examples (`big--1`, `big--2`
  only appear when there are 2+ parts). This matches the test expectations exactly.
- `src/ingest/` is a new directory with only this one file; no `index.ts`/barrel was requested or
  added, consistent with "this module is new and has no callers yet."

---

## Fix report (post-review)

Commit `209620c8128cb930b9f3d2cdf69f8c87d06194a1`. All six review findings addressed below, each
with its covering test, the command run, and the output.

### 1. Anchors are not unique within a document

**Fix**: `allocateAnchor(candidate, used)` now registers the *disambiguated result* in the `used`
set (not the pre-disambiguation candidate), and loops `-2`, `-3`, ... until it finds a truly free
slot, so a third colliding heading can never reclaim an anchor a second one already took.

**Covering test**: `anchors are unique even with three colliding headings` (`test/ingest/chunk.test.ts`)
— three headings that slugify to `password-policy`, `password-policy`, `password-policy-2`
respectively must produce three distinct anchors: `['password-policy', 'password-policy-2', 'password-policy-2-2']`.

**Command**: `node --test test/ingest/chunk.test.ts`
**Result (fixed code)**: pass.
**Mutation**: reverted the fix to register `candidate` instead of `next` (the original bug).
**Result (mutant)**: `anchors are unique even with three colliding headings` fails —
`AssertionError: every anchor in the document must be unique / 2 !== 3`. Mutant killed.

### 2. Misleading anchor doc comment

**Fix**: rewrote the `Chunk.anchor` doc comment to state precisely what each half of the anchor is
derived from (heading slug; document-order collision count keyed on matching anchor text, not a
line number; content-hash suffix for oversize sub-chunks) and exactly which edits move it,
including the one documented exception (see finding 4). No test covers prose; verified by re-reading
the comment against the implementation line by line.

### 3. No fenced-code-block awareness

**Fix**: `splitIntoSections` and `splitParagraphs` both track fence state (``` `\`\`\`` `` or `~~~`,
respecting the opening fence's character and length per CommonMark) and suppress heading/paragraph-boundary
detection while inside a fence.

**Covering tests**:
- `a heading-shaped line inside a fenced code block does not start a new chunk`
- `editing content inside a fenced code block does not re-anchor a sibling section`

**Command**: `node --test test/ingest/chunk.test.ts`
**Result (fixed code)**: both pass; `chunks.map(c => c.anchor)` is exactly `['install', 'usage']`
for the review's own README example, and renaming `# install deps` inside the fence to
`# install dependencies now` leaves both anchors unchanged.
**Mutation**: removed the `opening`-fence branch from `splitIntoSections` (fence-open detection
disabled, so a `#`-shaped line inside a fence is again treated as a heading).
**Result (mutant)**: two failures — the anchor list gains a spurious third entry
(`install-deps`) instead of staying `['install', 'usage']`, and the sibling-stability test fails
because the "sibling" anchor itself now changes when the fenced comment is edited (it stops being a
sibling — it becomes its own chunk). Mutant killed.

### 4. Oversize sections re-attribute silently on unrelated edits

**Fix and reasoning**: sub-chunk splitting was rewritten so each **paragraph** is its own
sub-chunk — paragraphs are never combined into a shared sub-chunk the way the original greedy
packer did. A sub-chunk's `text` is therefore a pure function of exactly one paragraph (plus, for
the very first sub-chunk of a section, the heading line). Its anchor is a `--<hash>` suffix of that
text. Consequence: inserting, deleting, or editing a *different* paragraph in the same section
cannot change this sub-chunk's text or hash, because nothing about its own paragraph changed and
nothing else is folded in with it. This is the property finding 4 asked for, and it is genuinely
achievable for the paragraph-boundary case, not just apparently so — I did not rely on inspection
alone; see the covering test below, which directly asserts a sibling sub-chunk's `text` and
`anchor` are byte-identical before and after inserting a whole new paragraph next to it.

**The one case I concluded is *not* achievable, and did not paper over**: a single paragraph that
by itself exceeds `maxChars` still has to be hard-split by fixed-width character windows
(`hardSplit`), because a paragraph has no smaller natural (blank-line) boundary to key sub-chunk
identity on. Editing text near the start of such an oversize paragraph shifts every later window's
character content, and therefore every later window's content-hash anchor. Making that case
genuinely stable would require a fundamentally different algorithm — content-defined chunking with
rolling-hash-selected boundaries (à la rsync/restic), so that boundaries are chosen by local content
rather than a fixed offset from the start — which is materially more complex and outside what this
task's brief asks for. I documented this explicitly in `splitSection`'s doc comment and in the
`Chunk.anchor` doc comment rather than implying full stability. This limitation is strictly no
worse than the module's baseline (which had no addressed content-hash story at all), and does not
regress anything the review flagged — the review's own repro for this finding was about the
*paragraph-boundary* combine/split identity, which is fixed.

**Covering tests**:
- `inserting a paragraph in an oversize section does not change a sibling sub-chunk anchor` — a
  three-paragraph oversize section, one paragraph inserted between two existing ones; the
  "gamma" sub-chunk's `text` and `anchor` are asserted identical before/after.
- `an oversize section is split into content-addressed sub-chunks` — asserts anchor uniqueness,
  per-chunk length bound, that the first sub-chunk carries real content beyond the bare heading, and
  that the anchor list is deterministic across repeated calls on the same input.

**Command**: `node --test test/ingest/chunk.test.ts`
**Result (fixed code)**: both pass.
**Mutation**: reverted `splitSection` to the original greedy paragraph-combining behavior (pack
consecutive paragraphs together up to `maxChars` before cutting, as in the original brief code).
**Result (mutant)**: `inserting a paragraph in an oversize section does not change a sibling
sub-chunk anchor` fails — the "gamma" sub-chunk's `text` changes because the greedy packer now
groups it with different neighbors depending on what precedes it. Mutant killed.

### 5. Hard split emits a heading-only chunk and orphans the heading

**Fix**: the section body is now split into paragraphs (never including the heading line as a
"paragraph" of its own), and the heading line is prepended only to the very first sub-chunk, with
that sub-chunk's budget reduced by the heading-prefix length so the combined `heading + first
paragraph-or-slice` still respects `maxChars`. `# G` + a giant paragraph therefore no longer
produces a bare `"# G"` chunk — the first sub-chunk is `"# G\n\n" + <as much of the paragraph as
fits>`.

**Covering test**: `an oversize section is split into content-addressed sub-chunks` asserts
`chunks[0].text` matches `/^# Big/` **and** `chunks[0].text.trim().length > '# Big'.length` (i.e.
strictly more than the bare heading). The pre-existing brief test `a single paragraph longer than
the limit is hard-split rather than dropped` continues to pass unmodified — its `joined.includes('x'.repeat(200))`
assertion is satisfied because the heading-prefix budget reduction only shrinks the *first* window
(by 7 chars, for `"# G\n\n"`), leaving a full 500-character run of `x` reconstructed across the
sub-chunks' concatenation.

**Command**: `node --test test/ingest/chunk.test.ts`
**Result**: pass. (This fix is inherently entangled with finding 4's rewrite; I did not write a
separate kill-mutation for it beyond the assertion above, since undoing it requires undoing the
same `splitSection`/`hardSplit` restructuring already mutation-tested in finding 4.)

### 6. Missing tests for the headline property

Added, beyond the findings-specific tests already listed above:
- `a document with no headings is a single preamble chunk`
- `anchors are stable when unrelated text elsewhere in the document changes` — edits both the
  preamble and the first heading's body, then asserts the full anchor list for the whole document is
  unchanged.

**Command**: `node --test test/ingest/chunk.test.ts`
**Result**: both pass (part of the 19/19 run below).

### Minor findings

- **Setext headings**: not implemented. Documented directly on `splitIntoSections`'s doc comment,
  with the reasoning (needs lookahead interleaved with fence tracking; `---` is ambiguous with a
  thematic break). No test added since the behavior is an explicit non-goal, not a fixed bug.
- **Closing ATX hashes kept in `heading`**: fixed via `stripAtxClose`, applied to the captured
  heading text before it is stored or slugified.
  **Covering test**: `a closing ATX hash sequence is stripped from the stored heading` —
  `# Closed ##` now stores `heading: 'Closed'`.
  **Command**: `node --test test/ingest/chunk.test.ts` — pass.
  **Mutation**: made `stripAtxClose` a no-op (`return heading`).
  **Result (mutant)**: the new test fails — `actual: 'Closed ##', expected: 'Closed'`. Mutant
  killed. Reverted.

### Two guards found not to be real guards, by mutation

Mutation-testing surfaced two places where my first-pass "defensive" code was not actually doing
anything, and I removed/adjusted rather than leave misleading code:

- **`hardSplit`'s remaining-length cap** (`Math.min(budget, text.length - offset)`): mutating it
  away to `budget` alone left all 18 tests passing. Reason: `String.slice`'s end index silently
  clamps past `text.length`, and the loop only ever overshoots on its last iteration (the loop
  condition `offset < text.length` stops it afterward regardless of the pushed slice's true length).
  The cap was inert. Simplified `hardSplit` to drop it and added a one-line comment explaining why
  it's safe, instead of carrying dead code that looks load-bearing.
- **`if (whole === '') continue;`** in `chunkDocument`: mutating it away (deleting the line) left
  all 19 tests passing. Reason: `isBlank()` already filters out every section that could produce an
  empty `whole` before it reaches this loop — a heading section's `whole` always contains at least
  the non-empty heading line, and a preamble section that survives `isBlank` already has non-empty
  trimmed content. The guard was unreachable. Removed it rather than keep code implying a case that
  cannot occur.

### One guard I verified manually rather than by an automated mutation-killed test

`Math.max(1, maxChars - prefix.length)` in `splitSection` (the floor clamp on the first sub-chunk's
character budget) protects against a caller passing a `maxChars` smaller than the section's heading
line — a real, externally-triggerable (if pathological) input, unlike the two dead guards above. I
did not write an automated test that removes this clamp and asserts on the result, because doing so
risks a **synchronous infinite loop**: without the clamp, `budget` can go negative, `hardSplit`'s
`offset += budget` would then *decrease* `offset` forever, and `node --test`'s timeout cannot
interrupt a synchronous hang — it would wedge the whole test run (and CI) rather than fail cleanly.
Instead I verified behavior manually, bounded by the shell's own `timeout`:

**Command**:
```
timeout 5 node --input-type=module -e "
import { chunkDocument } from './src/ingest/chunk.ts';
const doc = '# Big\n\n' + 'x'.repeat(50) + '\n';
const chunks = chunkDocument(doc, { maxChars: 5 });
console.log('chunk count', chunks.length);
console.log(chunks.map(c => c.text.length));
console.log('ok, did not hang');
"
```
**Output**: `chunk count 11`, per-chunk lengths `[8,5,5,5,5,5,5,5,5,5,4]`, `ok, did not hang`. The
clamp keeps the algorithm terminating (first chunk is 8 chars — 1 char of body plus the full 7-char
heading prefix — slightly over the requested `maxChars: 5`, which is the expected, honestly-reported
cost of a `maxChars` configured smaller than a section's own heading; it does not hang or drop
data).

### Full-suite verification (both runs)

`node --test test/ingest/chunk.test.ts`: 19/19 pass.
`npx tsc --noEmit`: clean, no output.

`npm test` (run 1): `tests 624 / pass 624 / fail 0`.
`npm test` (run 2): `tests 624 / pass 624 / fail 0`.

624 = 605 baseline + 19 chunk tests (12 original + 7 added in this fix pass). No regressions across
either run.

### Remaining concerns

- The `Math.max(1, ...)` floor-clamp guard (see above) is defensively correct and manually verified,
  but not covered by an automated mutation-killed test, for the stated hang-risk reason. If a future
  reviewer wants this covered mechanically, the safest route is an async/worker-isolated harness with
  a hard kill, not a plain `node --test` timeout.
- The single-oversize-paragraph hard-split case (finding 4's documented exception) remains genuinely
  not anchor-stable under edits near its start. I judged implementing content-defined chunking
  out of scope for this task and documented the gap rather than hide it; flagging again here in case
  a later task (the Task 9 drift check in particular) needs to know this edge case exists.

---

## Fix report, round 2 (post re-review)

Commit `a9e7e6bcb62973849a7d4db5e444c82e6c12cb3b`. All four required findings addressed, plus the
optional collision-proofing (done — see below), plus the "no action needed" note relayed to Task 9.

### Correction to my own earlier claim

The reviewer is right and I was wrong: removing `Math.max(1, maxChars - prefix.length)` in
`splitSection` does **not** hang — I mis-attributed the hang risk to that guard instead of to the
real one. I re-tested it directly this round (see "maxChars smaller than the heading prefix" below)
with an ordinary `node --test` run, no bounded subprocess needed, and it fails cleanly with a wrong
`chunks.length` / `chunks[0].text`, exactly as the reviewer described (their exact numbers — 11
chunks, `[8,5,5,…]` — reproduced exactly). I'm flagging the correction explicitly rather than
quietly folding it in, since getting this diagnosis wrong once already cost a review round.

### 1. `maxChars <= 0` is a genuine, reproducible hang/OOM

**Fix**: `chunkDocument` now clamps `maxChars = Math.max(1, opts.maxChars ?? DEFAULT_MAX_CHARS)` at
its single entry point. Every downstream function (`splitSection`, `hardSplit`) receives the
already-clamped value, so `hardSplit`'s steady-state `budget = maxChars` is always >= 1 and `offset`
always advances.

**Covering tests**: `maxChars of zero is clamped rather than looping forever`,
`a negative maxChars is clamped the same way as zero`.

**Command**: `node --test test/ingest/chunk.test.ts` (fixed code) — pass; both assert the exact
clamped-to-1 output (`chunks.length === 20`, `chunks[0].text === '# Big\n\nx'`, `chunks[19].text === 'x'`
for a 20-`x` paragraph).

**Mutation**: reverted the clamp to `opts.maxChars ?? DEFAULT_MAX_CHARS`. Ran *only* the two clamp
tests, wrapped in a shell `timeout 10` as a safety net (the reviewer's own report showed this
terminates on its own — I verified that directly rather than assume it):
```
timeout 10 node --test --test-name-pattern="clamped" test/ingest/chunk.test.ts
```
**Result**: both tests fail after ~2–2.6 seconds with `RangeError: Invalid array length` thrown
from `hardSplit`'s `Array.push` (the output array grows past V8's length limit before the process
would ever truly wedge forever) — confirming the reviewer's diagnosis and giving a clean, non-hanging
mutation kill. Reverted.

### 2. `closesFence` accepted a closer carrying an info string

**Fix**: split the fence-marker regex in two — `FENCE_OPEN` (permissive, allows an info string, used
only to detect an *opening* fence) and `FENCE_CLOSE` (`/^(`{3,}|~{3,})[ \t]*$/`, requires the fence
run followed by nothing but whitespace, used only by `closesFence`). A line like `` ```js `` inside an
open fence is now correctly treated as content, never as a closer.

**Covering test**: `a closing fence carrying an info string does not close the fence (CommonMark)` —
reproduces the reviewer's exact repro (`# A` / ``` ` ``` ` / `x` / `` ```js `` / `y` / ``` ` ``` ` /
blank / `# B` / `tail`) and asserts two chunks, `['a', 'b']`.

**Command**: `node --test test/ingest/chunk.test.ts` — pass.
**Mutation**: reverted `closesFence` to call the permissive `FENCE_OPEN` regex instead of
`FENCE_CLOSE` (the original bug).
**Result**: the test fails — `['a']` instead of `['a', 'b']` (`# B` swallowed into the fence, exactly
the reviewer's repro). Mutant killed. Reverted.

Also added two more fence-closer edge cases the reviewer's finding 4 asked for by name (see below,
same fix, different assertions).

### 3. The `Chunk.anchor` doc comment was factually wrong

**Fix**: rewrote it to enumerate exactly the movers that can change or reassign an anchor, and for
each, state whether the old anchor **vanishes** (safe) or gets **reassigned to different content**
(unsafe):

1. A sub-chunk hash collision under the same base heading — unsafe in principle (two different
   texts producing the identical 8-hex-char prefix), negligible in practice; not otherwise mitigated.
2. Heading-prefix coupling on an oversize section's first sub-chunk — safe (vanishes): inserting a
   paragraph above the current first one changes the first sub-chunk's anchor even though that
   paragraph's own prose didn't change, but the old anchor disappears rather than being claimed by
   different content.
3. The single-oversize-paragraph hard-split case — safe (vanishes), as already documented.
4. Editing the heading text itself — safe (the whole family, base and all sub-chunk anchors under
   it, vanishes together and is replaced by a new family).

The formerly-claimed "cross-family aliasing" mover (the reviewer's `# P` example) is **no longer a
mover at all** after the optional fix below — it doesn't appear in the list because it can't happen.
I did not leave a stale "used to be a problem" note in the doc comment itself (that belongs here, in
the report, not in code that describes current behavior); it's addressed under the optional item.

No test covers prose directly; the doc comment's claims are indirectly exercised by the "double-hyphen
disambiguation suffix cannot alias" test below, which is the concrete, executable version of what the
comment now asserts.

### 4. Four untested behaviours

All four added, one test each, all mutation-killed:

- **`closesFence` length matching** (`match[1].length >= fence.len`): test
  `a closing fence shorter than the opening fence does not close it` (4-backtick opener, 3-backtick
  would-be closer). Mutation: dropped the length comparison from `closesFence` — test fails,
  `['a']` instead of `['a', 'b']`. Killed. Reverted.
- **`closesFence` char matching** (`match[1][0] === fence.char`): test
  `a closing marker using a different fence character does not close it` (backtick opener, tilde
  would-be closer). Mutation: dropped the char comparison — test fails the same way. Killed.
  Reverted.
- **`splitParagraphs`' fence tracking**: test
  `a blank line inside a fenced code block in an oversize section does not split the fence apart` —
  an oversize section (`maxChars: 200`) whose body contains a fenced Python block with a blank line
  between `def f():` and `    return 1`; asserts both lines land in the same sub-chunk. Mutation:
  removed the `if (fence) {...}` branch from `splitParagraphs` entirely (paragraphs split on every
  blank line, fence or not) — test fails: `def f():` and `return 1` end up in different sub-chunks.
  Killed. Reverted.
- **`hardSplit` of a heading-only oversize section**: test
  `an oversize heading with no body is still emitted via hard-split, not silently dropped` — a
  30-character heading with `maxChars: 10` and no body at all. Mutation: collapsed the
  `rest !== '' ? splitSection(...) : hardSplit(...)` branch to always call `splitSection`, which
  returns `[]` for an empty `rest` — test fails: `0` chunks instead of `4`, i.e. the heading silently
  vanishes. Killed. Reverted.

### Optional: collision-proof disambiguation — done

**Judgement**: cheap and self-contained, implemented. Changed `allocateAnchor`'s disambiguation
suffix from `-N` (single hyphen) to `--N` (double hyphen). This is provably collision-proof against
any natural heading slug: `slugify`'s `.replace(/[^a-z0-9]+/g, '-')` collapses *any* run of one or
more non-alphanumeric characters — regardless of length or what produced them (spaces, punctuation,
characters that vanish entirely after NFKD + combining-mark stripping) — into exactly **one** hyphen
in a single global pass. There is no way for `slugify`'s output to ever contain two consecutive
hyphens. The oversize sub-chunk hash suffix already used `--` for the same reason (a hash is always
exactly 8 lowercase hex characters, format-distinct from any short decimal counter or single-hyphen
slug fragment); this change makes the whole-section disambiguation counter use the same
unreachable-by-slugify separator, so a base anchor's own `--N` count can never be confused with, or
reassigned relative to, another section's completely unrelated natural slug.

Why I judged it self-contained: the brief states explicitly that this module has no callers yet
("this module is new and has no callers yet. Do not wire it into anything"), so the only blast
radius is this file and its test file — no downstream production code depends on the previous
`-N` format. The change is one line in `allocateAnchor` (plus the doc-comment rewrite already
required by finding 3, and updating this file's own test expectations from `-2`-style to
`--2`-style anchors).

**Covering tests**:
- `the double-hyphen disambiguation suffix cannot alias a differently-named section` — reproduces
  the reviewer's own counter-example (`# P` / `# P` / `# P 2`, then delete the first `# P`) and
  asserts `p-2` names the `# P 2` section, with byte-identical `text`, in both the original and
  edited document.
- `anchors are unique even with three colliding headings` — updated to assert the new, non-aliased
  output `['password-policy', 'password-policy--2', 'password-policy-2']` (previously
  `['password-policy', 'password-policy-2', 'password-policy-2-2']`, which was the aliasing-prone
  shape).
- `each heading starts a chunk anchored on its slug` — updated `password-policy-2` ->
  `password-policy--2` to match.

**Command**: `node --test test/ingest/chunk.test.ts` — pass.
**Mutation**: reverted `allocateAnchor`'s separator from `--${n}` back to `-${n}`.
**Result**: both the three-collision test and the new alias-proof test fail —
`['password-policy', 'password-policy-2', 'password-policy-2-2']` instead of
`['password-policy', 'password-policy--2', 'password-policy-2']`, and `['p', 'p-2', 'p-2-2']`
instead of `['p', 'p--2', 'p-2']` — reproducing exactly the aliasing shape the fix eliminates.
Killed. Reverted.

### Noted for Task 9 (no action taken, as instructed)

Oversize-section sub-chunks no longer byte-reconstruct their source region: `splitParagraphs`
discards the blank-line separators between paragraphs (they become the paragraph boundary, not part
of any paragraph's text), while a non-split section's `text` (the `whole` value) still does contain
its source verbatim, blank lines and all. I added an explicit note to `splitParagraphs`'s doc
comment so this isn't discoverable only by reading the diff: *"a chunk's `text` is therefore not
always a verbatim substring of the source region it came from... Do not assume `chunk.text`
byte-reconstructs the source; only non-split (`whole`-sized) chunks currently do."* Flagging again
here per the reviewer's request so Task 9 inherits it explicitly.

### Full-suite verification (both runs)

`node --test test/ingest/chunk.test.ts`: 28/28 pass (12 original + 7 from round 1 + 9 from round 2).
`npx tsc --noEmit`: clean, no output.

`npm test` (run 1): `tests 633 / pass 633 / fail 0`.
`npm test` (run 2): `tests 633 / pass 633 / fail 0`.

633 = 605 baseline + 28 chunk tests. No regressions across either run. Every mutation applied this
round was reverted before the final commit; `diff` against a pre-mutation backup of `chunk.ts`
confirmed the working file was byte-identical to the intended fixed version before staging.

### Remaining concerns

- The residual, negligible-probability risk in mover 1 of the rewritten anchor comment (a genuine
  8-hex-char SHA-256-truncated hash collision between two different sub-chunk texts under the same
  heading) is acknowledged but not mitigated — mitigating it would mean widening the hash (more
  bytes of `checksum()`) or switching to a collision-resistant scheme, which felt like solving a
  problem that doesn't currently have a realistic trigger; flagging in case Task 9 wants a stronger
  guarantee.
- I did not go looking for further undiscovered fence/fence-adjacent edge cases beyond what the
  review named (e.g. tilde fences with an info string as the *opener*, fences at the very start or
  end of a document with no trailing newline). The four behaviours named in finding 4 are now
  covered; I did not attempt an exhaustive CommonMark fence conformance pass, since that risks the
  same "gold-plating beyond the brief" the earlier report was cautious about.

---

## Fix report, round 3 (post second re-review)

Commit `5c019f06bc7762dcab630173e5dc6b6dfabf8b71`. Round 2 was approved as a foundation — 10/10
mutants, 28 tests, 633/633 suite, fence handling verified across 18 adversarial shapes, the `--`
separator verified sound including the 60-char truncation path. One thing blocked: the
`Chunk.anchor` doc comment, wrong for a third time, in exactly the dimension Task 9 depends on.

### The lesson (stated plainly, as requested)

This comment was wrong three times — round 1's version implied full stability with vague hedging,
round 2's rewrite added a precise but incomplete "four things" list that omitted the single most
common and most dangerous mover, and both times I mutation-tested every *code* guard exhaustively
while treating the comment's own claims as something correctness-by-careful-writing could settle.
It couldn't. Every other behavioral claim in this module is now backed by a test that a mutant can
kill; the anchor-stability claims were backed by prose that sounded authoritative and was checked by
re-reading, not by execution. Re-reading catches typos, not missing cases. The fix this round is not
"write the comment more carefully a third time" — it's "add a test for the specific claim a
downstream task will rely on, the same way every other claim in this file already has one." I did
that (see the new pinning test below), and reframed the comment to explicitly disclaim completeness
rather than imply it, so the next reader doesn't inherit false confidence from prose alone.

### 1–3. The `Chunk.anchor` comment: missing mover, wrong mover 4, wrong mover 1 trigger

**Fix**: rewrote the comment. Concretely:

- **Added the missing mover**: within-family `--N` renumbering. `--N` is a document-order count
  over sections sharing one *base* (not a fixed identity assigned to a specific section), so
  deleting, renaming, or inserting a same-slug section earlier in the document shifts every later
  survivor's ordinal — reassigning `notes--2`'s old identity to plain `notes`, or vice versa. This
  is the **unsafe** class: the anchor string persists, but now names different content. Documented
  all three triggers (delete the first, rename the first, insert a new same-slug section above) with
  the reviewer's own worked example.
- **Corrected mover 4** (heading-text edits): no longer claims unconditional safety. Now states
  explicitly that editing a heading is safe *only when no other section shares its slug* — when one
  does, the edit degenerates into the within-family renumbering case above (a rename is
  observationally identical to a delete, from the survivors' point of view).
- **Corrected mover 1's trigger** (sub-chunk ordinal fallback): no longer claims a "genuine hash
  collision" is required. Identical sub-chunk text (repeated boilerplate, or two genuinely identical
  hard-split windows) hits the same disambiguation path with zero collision involved, since identical
  input always hashes identically. Kept the useful nuance the reviewer asked for: in the
  identical-text case the reassigned content is byte-identical, so the harm is ordinal (which
  physical occurrence "--2" now points at) rather than semantic; a genuine collision between
  *different* texts is the more serious case, gated by an 8-hex-char coincidence.

**4. Dropped the exhaustive framing.** The comment no longer says "four things can move an anchor."
It opens by stating this describes *known* movers, is not a completeness proof, and has already been
wrong about that boundary twice — and points at the test file as the actual source of truth for the
one claim that's now pinned.

### 5. The pinning test — converting the load-bearing claim into something a mutant can kill

**Test added**: `the anchor of a duplicate-heading family can be reassigned to different content
(unsafe, within-family renumbering)` (`test/ingest/chunk.test.ts`). Two `# Notes` sections; asserts
`['notes', 'notes--2']` before, with `before[0].text === '# Notes\n\nfirst'` and
`before[1].text === '# Notes\n\nsecond'`; deletes the first section; asserts `['notes']` after, with
`after[0].text === '# Notes\n\nsecond'` — i.e. the string `notes` names different content than it
did in the first document. This is the exact shape the reviewer asked for, in the style of the
existing alias-proof test.

**Command**: `node --test test/ingest/chunk.test.ts` — pass.

**Mutation**: disabled disambiguation entirely in `allocateAnchor` (`return candidate;` as the first
line, short-circuiting the collision-check/loop).
**Result**: the pinning test fails — `['notes', 'notes']` instead of `['notes', 'notes--2']`
(the second `# Notes` section silently collides with the first instead of being disambiguated).
Mutant killed. Reverted, and confirmed the file was byte-identical to the pre-mutation backup via
`diff` before re-staging.

### Minor 1: `maxChars: NaN` silently discarded the whole body

**Fix**: `chunkDocument` now computes `Number.isFinite(requested) ? Math.max(1, requested as number)
: DEFAULT_MAX_CHARS` instead of `Math.max(1, opts.maxChars ?? DEFAULT_MAX_CHARS)`. `NaN` fails every
numeric comparison including inside `Math.max`, so the old clamp silently produced `NaN` as
`maxChars`, which made `whole.length <= maxChars` false for every non-empty section and (worse) the
oversize path effectively never terminated correctly either — the net effect the reviewer reported
was a single chunk that dropped the body. `Number.isFinite` treats `NaN` (and `Infinity`) as "not a
usable number" and falls back to the default, same as an omitted `maxChars`.

**Covering test**: `a NaN maxChars falls back to the default rather than silently discarding the
body` — asserts `chunks.length === 1` and that the one chunk's text still contains the 30-`x` body.

**Command**: `node --test test/ingest/chunk.test.ts` — pass.
**Mutation**: reverted to the plain `Math.max(1, requested ?? DEFAULT_MAX_CHARS)`.
**Result**: the test fails — `actual: false` on `chunks[0].text.includes(body)`, reproducing the
reviewer's exact "silently discards the entire body" report. Killed. Reverted.

### Minor 2: `hardSplit`'s doc comment overstated "loop forever"

**Fix**: reworded to say what round 2's own mutation testing actually observed — the output array
grows without bound and throws `RangeError: Invalid array length` after roughly two seconds, rather
than looping truly forever. No behavior change; comment-only.

### Full-suite verification (both runs)

`node --test test/ingest/chunk.test.ts`: 30/30 pass (28 from round 2 + 2 new this round).
`npx tsc --noEmit`: clean, no output.

`npm test` (run 1): `tests 635 / pass 635 / fail 0`.
`npm test` (run 2): `tests 635 / pass 635 / fail 0`.

635 = 605 baseline + 30 chunk tests. No regressions across either run. Both mutations applied this
round were reverted before the final commit and verified byte-identical to the pre-mutation file via
`diff`.

### Concerns

- None held back. The one thing I'd flag forward to whoever builds Task 9: the anchor comment now
  says plainly it is not a completeness proof. If Task 9's drift-check design ends up depending on
  an anchor property not documented here (e.g. "anchors within a single ingest run are stable even
  though anchors across arbitrary edits are not"), that property should get its own test in this
  file rather than being assumed from the comment, given the comment's now-documented track record.
