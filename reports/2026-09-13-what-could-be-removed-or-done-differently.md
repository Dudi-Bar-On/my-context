# What could be removed, simplified, or done differently — a review of HEAD

Scope: the whole `my_context` tree as it stands at HEAD (2026-09-13), answering one question —
what could be removed, simplified, or implemented differently. Not a PR review. Three sibling
lanes cover silent failures, type design, and the CLI/MCP/gates surface; this one stays off all
three.

**Method.** Five parallel reviews split the tree by directory (`src/core/` in two halves —
acknowledge.ts→rebuild.ts and reference.ts→conversation-secrets.ts, ~53k lines; `src/cli/`,
~25k lines; `src/ui/`, ~23k lines of TypeScript plus the frontend under `src/ui/public/`;
everything else — `mcp/`, `hooks/`, `doctor/`, `review/`, `rules/`, `ingest/`, `pack/`, `plugin/`,
`lesson/`, `help/`), each instructed to read docblocks and `git log` before recommending anything,
because this codebase argues its decisions in long comments and a duplicate-looking pair often has
a recorded reason. I then re-verified the load-bearing claims myself (grep for importers, `git log
-S` for when a comment was last touched versus when the feature it describes shipped, reading the
cited tests) before folding everything into this document, and chased three leads of my own:
whether the one known-stale comment named in the brief (`app.js`'s `post()` docstring) was the only
one of its kind, whether `D51`'s "fact kept by hand in a second place" pattern had any open
instance in source rather than only in the corpus's own open tasks, and what `src/core/retrieval/`
(not in any lane's assigned scope) looked like at a skim. A sixth pass then ran a single mechanical
sweep over all 1,002 files under `src/`, `test/`, `e2e/`, `scripts/`, and `hooks/`: every top-level
exported name in `src/`, checked by substring for a reference anywhere outside its own file. That
pass (and a hand re-check of everything it flagged) is folded into **Remove**, **Simplify**, and
**Could not assess** below rather than kept as a separate pass — its two corrections to the first
five lanes' reading are noted where they land.

**The single biggest finding of the whole pass is how often the recorded argument holds.** Of the
hypotheses formed by file size or name-pattern alone — "this triple split must be accretion," "this
big file must be doing too much," "this looks like the same list kept twice" — a minority survived
reading the actual code. The majority are in **What should stay exactly as it is**, which is as
long as the findings sections and just as load-bearing: a reader who re-forms one of these
hypotheses later and doesn't check this report would re-open a closed decision.

---

## The five things I would do first

### 1. Fix three stale claims that the UI's write surface is narrower than it now is

**What's wrong.** Three separate prose descriptions of "how many things under `src/ui/` write to
disk" have each drifted behind the one place that actually enforces the answer
(`test/ui/no-writes.test.ts`'s `RULED_WRITES`, currently **12 bindings across 5 files**:
`anchor-write.ts` ×3, `execute.ts` ×3, `retrieval-write.ts` ×2, `security.ts` ×1, `server.ts` ×3):

- **`src/ui/public/app.js:2424-2435`**, the docblock on `post()`: *"A POST here is not a write, and
  this shell does not gain one. All three routes read, validate or preview; `src/ui/` binds no
  writer at all and `test/ui/no-writes.test.ts` asserts that structurally."* False on both counts.
  `src/ui/anchor-write.ts` (shipped 2026-09-12, owner ruling
  `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`) binds `markAnchor`/
  `unmarkAnchor`/`markAutomaticAnchors` as a deliberate, narrow, tested exception, and the screens
  reach it through this exact function — `src/ui/public/screens/conversations.js` calls
  `ctx.post('/api/conversations/anchors/mark'|'relabel'|'drop'|'sweep', …)` at seven call sites
  (lines 1171, 1513, 1549, 1708, 5166, 5186, 5228). Counting `ctx.post()` targets across every
  screen file (`grep -rhn "ctx\.post("`) finds **10** distinct routes today, not three:
  `/api/config/check`, the four anchor routes, `/api/execute`, and three `/api/retrieval/*` routes.
  `git log -S"A POST here is not a write"` dates this paragraph to 2026-08-23, three weeks before
  the exception it contradicts shipped — it was never touched afterward.
- **`src/ui/security.ts:10-27`**, the module's own header: *"there are now two of them
  [`recordRefusal`, `recordNonceMint`] rather than one... the owner-ruled set — both of these plus
  `execute.ts`'s."* That's three bindings total; the real count is 12, and `src/ui/retrieval-write.ts`
  (added 2026-09-12, the same day, at 22:45) isn't mentioned at all. `security.ts` itself hasn't
  been touched since 2026-08-29.
- **`docs/capabilities/08-web-ui.md:19-37`**, "The no-writes guarantee, and its three named
  exceptions" — enumerates `recordRefusal`, `recordNonceMint`, and `execute.ts`, and stops there.
  This chapter was *itself* last edited 2026-09-12 at 22:37 — after `anchor-write.ts` and
  after `retrieval-write.ts` — and elsewhere in the very same file links out to the anchors chapter
  (`./05-anchors.md`), so the omission isn't a timing accident, it's a miss.

**Why this matters more than its size suggests.** This is exactly the defect class this project's
own `CLAUDE.md` opens with — *"a copy cannot be superseded; only the original can"* — except the
copies here are prose restating a fact a test already enforces mechanically. Three independent
authors, at three different times, each wrote down "the set of writers is N" instead of pointing at
`RULED_WRITES`, and two of the three are now wrong. A fourth place (`src/ui/execute.ts`'s own
header, "the shape... wears three times") is still *correct* — its own three bindings haven't
changed — which is useful contrast: the pattern isn't "don't describe write bindings in prose," it's
"a count that describes more than your own file will drift the next time someone else's file
grows."

**Fix.** Rewrite all three to point at `RULED_WRITES` as the count (or simply stop stating a
number), and have `post()`'s docblock describe what's actually true: most traffic through it is a
read/validate/preview, and anchors are a real, narrow, ruled write — pointing at `anchor-write.ts`'s
own docblock rather than re-deriving the argument.

**Size:** three paragraphs. **Risk:** none — comment-only, nothing calls a comment. **Evidence
it's safe:** `RULED_WRITES` itself is current (it lists all 12 and the equality assertion against
the live import graph is what would fail first if it weren't) — the fix is bringing prose into
agreement with a test that's already right, not changing behavior.

---

### 2. Split `src/ui/read-model.ts` (4,203 lines) along its own seams

**What it is.** The single largest file in the repository. Structurally flat: roughly twenty
independent `apiX` handlers (`apiSelect`, `apiRender`, `apiSimulate`, `apiSimulateSweep`,
`apiSessions`, `apiInjected`, `apiStatus`, `apiDoctor`, `apiDecay`, `apiCoverage`, `apiGraph`,
`apiItems`, `apiTags`, `apiItem`, `apiHelp`, `apiTutorials`, `apiTutorialDoc`, `apiDocList`,
`apiDoc`, `apiCorpusList`, `apiCorpusFile`), each with its own request/response types and almost no
shared state beyond a handful of top-of-file helpers (`badRequest`, `unknownParams`,
`repeatedParams`, `withStores`, `parseSelectQuery`). Its own docblock (lines 1-28) states
*composition* rules — "an endpoint here MAY NOT reimplement a rule that already exists" — but gives
no argument for why these twenty-odd handlers must share one file; contrast the files in
**What should stay** below, which argue their shape explicitly.

**It is the leftover, not a design.** `git log --follow` on this file reads as a sequence of
bolt-ons: *"feat(ui): status, doctor and decay read model," "feat(ui): coverage, ego-graph, items
and corpus-joined help read model," "feat(ui): sessions read model..."* — each new endpoint landed
in the same file. Meanwhile this exact directory already split eight siblings out by domain:
`read-model-config.ts`, `read-model-work.ts`, `read-model-cli-help.ts`, `read-model-flags.ts`,
`read-model-retrieval.ts`, `read-model-staging.ts`, `read-model-command.ts`, and two for the
conversation archive alone (`read-model-conversations.ts` at 2,356 lines,
`read-model-conversation-document.ts` at 2,658 lines). `read-model.ts` is what was never carried
over when that pattern started.

**Evidence it's safe.** 27 files import from it today (`grep -rln "read-model\.ts'" src test`) —
both UI modules (`ask-model.ts`, `capture-model.ts`, `packs-model.ts`, `port-model.ts`,
`preview-history.ts`, `proc-model.ts`, sibling `read-model-*.ts` files, `server.ts`, `watch-model.ts`)
and ~16 test files, every one via named imports. The test suite is *already* partitioned by domain
even though the source isn't (`corpus-files.test.ts`, `decay-screen.test.ts`, `doc-endpoint.test.ts`,
`github-render.test.ts`, `injected-endpoints.test.ts`, `palette-screen.test.ts`,
`preview-seen-history.test.ts`, `review-queue-api.test.ts`, `tutorial-doc.test.ts`,
`tutorials-endpoint.test.ts`, plus the 3,105-line `read-model.test.ts` itself), so a split into
files grouped the way the siblings already are (docs/corpus: `apiDocList`/`apiDoc`/
`apiCorpusList`/`apiCorpusFile`/`docHeadings`/`buildDocManifest`; tutorials: `apiTutorials`/
`apiTutorialDoc`; decay/coverage/graph: `apiDecay`/`apiCoverage`/`apiGraph`; sessions/status/
doctor/injected: `apiSessions`/`apiStatus`/`apiDoctor`/`apiInjected`) changes only import paths, not
behavior. `test/ui/server-e2e.test.ts`'s byte-identical-corpus sweep and the static import-graph
test both keep meaning what they say through a pure file move.

**Size:** medium — a day, mostly mechanical; regrouping the 3,105-line test file is the long tail.
**Risk:** low.

---

### 3. Split `src/doctor/checks.ts` (4,631 lines) by the domains its own tests already use

**What it is.** The second-largest file in the repo: ~30-40 independent `checkX` exports (one fork
counted 41, another 49 counting re-exported constants — the discrepancy is itself evidence nobody
has had to count them before), several individually large (`checkCliOnPath` ~378 lines,
`checkStateUnaudited` ~305 lines, `checkBodyTruncation` ~227 lines). It opens with a real, shared
discipline stated once at the top — *"a check reports a finding only when a person could DO
something about it... FIXABLE / RULABLE / NOT REPORTED"* — which argues for one **rule**, not for
one **file**; every check obeys it regardless of which file it lives in.

**The split boundary already exists, in the test suite.** `test/cli/doctor-checksum-migration.test.ts`,
`doctor-cli-on-path.test.ts`, `doctor-disclosures.test.ts`, `doctor-shared-tail.test.ts`,
`doctor-summary-and-freshness.test.ts`, plus `test/doctor/checks.test.ts` and
`test/core/tag-projection-doctor.test.ts` have already done the conceptual grouping (citation/body
integrity, scope/tag-projection, contradictions/overlap, size/budget, environment). The source file
is the one piece that never followed.

**Evidence it's safe.** Only two modules import from it — `src/mcp/tools.ts` and
`src/ui/read-model.ts` — and both go through the `runChecks` aggregator, not the individual
exports directly, plus `src/cli/commands/doctor.ts`, which deliberately keeps two checks
(`checkCliOnPath`, a slow PATH lookup, and `checksumMigrationFindings`) *outside* `runChecks` with a
recorded reason — a split that preserves that special-casing is a drop-in change for every caller.

**Do this after adding one guard, not before.** `runChecks` (`:4578-4609`) lists its thirty
constituent checks by hand in one array — a `checkX` written and not added to it is silently never
run, and the project has already paid for exactly that once: `test/doctor/checks.test.ts:469-473`
records that deleting `checkPermissions` from the array "leaves the whole suite green otherwise —
nothing else asserts a permissions code comes out of `runChecks` specifically," closed at the time
by adding one assertion for that one check. The registry is correct today (32 functions match
`^export function check`, 30 are in the array, and the other two are exactly the deliberately-
excluded pair above) — but it is unguarded as a *set*, and a file split is exactly the kind of
mechanical operation during which an entry gets dropped from a hand-kept array. A ~15-line test that
scans for `^export function check`, subtracts the two recorded exclusions, and asserts the
remainder all appear in `runChecks` closes that risk before the split, not after.

**Size:** medium, similar to finding 2, plus the small guard test above. **Risk:** low, for the same
reason: the real boundary that has to stay stable (the `runChecks` aggregator plus the two
deliberately-excluded checks) is small.

---

### 4. Drop six `export` keywords that expose nothing outside their own file, and delete three dead functions

**Six unnecessary exports**, verified one by one (each used only inside its own defining file,
confirmed against `src/`, `test/`, `e2e/`, and `scripts/`):

| Symbol | Location |
|---|---|
| `PASS_SCAN_BUDGET_BYTES` | `src/review/input.ts:131` |
| `SIGHTING_CAP` | `src/review/propose.ts:243` |
| `TIERS_THAT_DISCLOSE_PROVENANCE` | `src/rules/deliver.ts:179` |
| `substitutedStoreLine` | `src/rules/deliver.ts:341` |
| `DEFAULT_MAX_CHARS` | `src/ingest/chunk.ts:110` |
| `ITEM_EXTENSION` | `src/pack/layout.ts:103` |

None is dead — all are load-bearing within their own file (`ITEM_EXTENSION` appears in three
user-facing refusal messages) — the `export` is simply unnecessary public surface. Two adjacent
candidates are deliberately **not** on this list: `RULE_REQUEST_PROTOCOL` and
`RULE_CANDIDATE_SCHEMA` in `src/lesson/derive.ts` are a wire-protocol id and its JSON schema, the
exact shape a future consumer of the (currently gated-off) self-improvement loop would import by
name — cheap to leave exported, expensive to guess wrong about.

A seventh candidate originally grouped with these, `anchorSubject` (`src/review/drift.ts:166`),
isn't merely over-exported — it's the only one of the group with **no use anywhere at all**, not
even inside its own file (its sole other appearance is a mention in the module docblock at `:16`).
It belongs with the three dead functions below, not this table: see **Remove**.

**Size:** six one-word edits. **Risk:** none — removing `export` from a symbol nothing outside the
file uses cannot change behavior; `tsc --noEmit` would catch the one case where that's not quite
true before it shipped. Not worth a PR of its own; fold into the first unrelated touch of any of
these files.

---

### 5. File the question: should `supersede` have an inverse?

**What's missing.** Every lifecycle move in this corpus has a human route except undoing a
supersession. `src/cli/commands/supersede.ts` exists at all because, in its own words, *"retiring
an item is the one lifecycle move that had no human route at all... `update_item` refuses a status
change on a governing item, and the remaining route (hand-edit the file, then `repair --yes`) is
the one the README calls out as leaving no evidence it happened."* That argument applies unchanged
to reversing a supersession today: there is no `unsupersede`/`reopen` CLI command, MCP tool, or
`core/mutate.ts` primitive (`supersedeItem`, `updateItem`, and `standDownSaid` are the whole
surface) — grepping for any spelling of "unsupersede" across `src/` returns nothing.

**Why this is a question and not a contradicted decision.** `retire.ts` is also one-way by
deliberate, documented design (see **What should stay**, #8), so "one-way lifecycle moves" is a
pattern this project uses on purpose elsewhere. I found no recorded ruling either way for
supersession specifically — this genuinely looks like an open gap rather than a settled absence,
which is the one shape of finding this report should name rather than quietly resolve. Filing it
as a corpus item for an owner ruling is the right next step, not building the command — if the
decision is "no, it's one-way like retire," the cost of having asked is one ruling; if the decision
is "yes," `supersedeItem`'s own shape (symmetric to `standDownSaid`'s re-stand-up logic) is most of
the design work already done.

**Size:** filing the question is small; building the command, if ruled for, is small-medium (mirrors
`supersede.ts`). **Risk:** low either way — this is a decision to surface, not code to write
unasked.

---

## Remove

No fully orphaned module exists. A whole-file sweep (every `src/**/*.ts` basename checked for at
least one importer anywhere under `src/`, `test/`, `hooks/`, `commands/`) found zero files with no
importer at all, including the deliberately-unwired ones (`src/ui/maintenance/**`,
`src/review/prompt.ts`) — which are unwired *and tested*, a different category from dead code.

A whole-repo symbol-level sweep (every top-level `export function|const|class` in `src/`, checked
by substring for a reference anywhere outside its own file — conservative in the safe direction,
since a substring match can call something "used" that is only a comment mention, but can never
call something unused that is genuinely imported somewhere) found **102 runtime exports with zero
outside references**. 99 of those are used inside their own file and are the unnecessary-`export`
finding above (top five, #4) — six kept on that list, one moved here because it has no in-file use
either. Three functions have **no reference anywhere**, not even their own file, not a test, not a
comment beyond a docblock mention:

1. **`validateUpdatableValue` — `src/core/validate.ts:162`.** Eight lines, wrapping
   `updatableValueError` into a throw. Its own docblock names two callers that don't call it:
   *"for the write paths that already refuse by exception (`updateItem`, `projectFieldUpdate`)
   rather than by return."* `projectFieldUpdate` (`src/core/tag-projection.ts:252-258`) does refuse
   by exception, but via its own `throw` over a whole patch, not this function; `updateItem` doesn't
   call it either. The live caller in this family, `src/cli/commands/edit.ts:895`, calls the
   *returning* `updatableValueError` directly. The comment asserting a wiring that doesn't exist is
   the more expensive half of this finding — a reader adding a third write path would reasonably
   believe the guard is already load-bearing. **Size:** 8 lines plus the comment. **Risk:** none.
2. **`summaryIsStale` — `src/core/content-hash.ts:588`.** Five lines folding `summaryState`'s
   `'stale'` and `'unanchored'` into one predicate "so no caller has to remember that `unanchored`
   exists." There are no callers — the four live consumers of summary state
   (`cli/commands/edit.ts:352`, `doctor/checks.ts:1566`, `ui/read-model.ts:2104` and `:3129`) all
   need the fine-grained state; `checks.ts` in particular deliberately keeps `summary_unanchored`
   and `summary_stale` as distinct finding codes with distinct remedies. A convenience that turned
   out not to be needed. **Size:** 5 lines. **Risk:** none.
3. **`anchorSubject` — `src/review/drift.ts:166`.** The only declared adapter from the conversation
   archive's `ResolvedAnchor` to this module's `DriftAnchor` projection, with no caller and no test
   — where its two named siblings in the same docblock sentence, `noticeDrift` and
   `anchorForStretch`, both have tests in `test/review/drift.test.ts`. The tests that need a
   `DriftAnchor` today hand-build one as a literal instead (`test/review/drift.test.ts:57`). The seam
   is documented and unused, which means whoever wires this module's real caller will hand-build the
   projection a second time unless they notice this function first. Either delete it, or keep it and
   give it the test its siblings have. **Size:** 8 lines. **Risk:** none.

None of the three is the deliberately-unwired-by-ruling category (`src/ui/maintenance/**`,
`renderCorrection`, `src/review/prompt.ts`) — that category carries a recorded ruling, a revisit
condition, and passing tests over the unwired code. These three have none of those; they're
ordinary dead code that a whole-file sweep can't see because the file around them is very much
alive. See **Could not assess** for the sweep's one real limitation (substring matching, not import
resolution — a floor on dead code, not a ceiling).

## Simplify

1. **`src/ui/read-model.ts`** — split by domain. See top five, #2.
2. **`src/doctor/checks.ts`** — split by domain. See top five, #3.
3. **`src/mcp/tools.ts` (2,728 lines)** — a flat array of ~26 tool specs with handlers defined
   inline. One tool, `ingest_document`, already had its substantial logic (`runIngestDocument`,
   `phaseOne`, session handling) pulled out to `src/mcp/tools/ingest.ts` and imported back in; the
   other 25 did not get the same treatment, even though several are comparably sized
   (`create_item`/`update_item` together span ~360 lines, `stage_rule_candidates`,
   `preview_pack_import`). Extracting the 3-4 largest into `src/mcp/tools/*.ts` beside `ingest.ts`
   follows a precedent that already exists one directory entry away. **Size:** medium. **Risk:**
   low — `test/plugin/parity.test.ts` checks the tool registry against the running program in both
   directions, so a handler moved without its name, schema, or behavior changing is invisible to
   that test, which is the point.
4. **`src/core/handover-ask.ts` (2,050 lines)** bundles several distinguishable sub-arcs under one
   "ask lifecycle" story: threshold/band math, composer prompt text/constants, latch persistence,
   verification, on-demand triggering, and lane detection. No docblock argues these must be one
   file the way the restore-family split (see **What should stay**, #2) argues its own shape.
   Candidate: extract the composer-text constants/functions into their own module. **Size:** medium
   (~400 lines to move, 12 src importers / 9 test files to repoint). **Risk:** low-medium — import
   paths only, no logic change.
5. **`src/core/conversation-index.ts` (3,449 lines) — lower confidence, and worth real care before
   acting.** Its own opening line names two things: "the conversation index and the scanner that
   rebuilds it from disk." Structurally visible: pure transcript-parsing (~1,100 lines), the
   `ConversationIndex` SQLite-backed class (~1,000 lines), then rebuild/forget orchestration. Unlike
   findings 1-3, there is no sibling precedent in `src/core/` for splitting a class this size out of
   its scanner — and there is a specific, measured reason to be careful here: the
   `restore-stage.ts`/`restore-staging.ts`/`restore-store.ts` split one directory over exists
   *specifically* to keep `node:sqlite` off an injection-critical import path
   (`test/core/restore-delivery.test.ts` walks the runtime import graph and fails if
   `conversation-index.ts` or `node:sqlite` becomes reachable from it). `core/statusline-tee.ts` and
   `cli/commands/statusline.ts` already import only the cheap, non-SQLite pieces of this file by
   name (`subagentDir`, `countSubagentFiles`) for exactly that reason. A split has to preserve that
   boundary at least as carefully as the restore family does. I'd want whoever touches this file
   next to confirm there's no unwritten version of the same argument before moving code — "consider
   carefully," not "do."
6. **Two new, genuine `D51` instances** ("a fact kept by hand in a second place, derived instead" —
   this project's own recurring subject; see **What should stay**, #4, for the six already-filed
   instances this is *not* adding to, because both of these are new):
   - **`FIELD_NAME` — `src/cli/commands/statusline-powerline.ts:96`.** A hand-kept
     `Record<string, string>` mapping each status-line field id to its display label, read at
     `:1125` as `FIELD_NAME[f.field] ?? f.field` — a silent fallback to the raw id. A field added to
     the bar without an entry here renders as `session-lanes` instead of `LANES`, and nothing fails;
     `FIELD_NAME` appears in zero test files. The table's own docblock names the hazard ("a field
     added to the bar without a name here is a field the reader has to recognise") without closing
     it, and the file right next door already has the machinery: `test/ui/strip-parity.test.ts`
     derives the live set of field ids from source by regex and says outright, "a hand-kept list of
     field names inside a parity test IS the defect the test exists about." Cheapest fix: declare
     the field ids as a union type once, type `Segment.field` and the table with it, and let
     `tsc --noEmit` (already run via `npm run typecheck`) enforce coverage at zero runtime cost.
     **Size:** small. **Risk:** none.
   - **The `runChecks` registry itself — `src/doctor/checks.ts:4578-4609`.** See top five, #3, for
     the full argument: correct today, unguarded as a set, and the project has already paid for this
     exact failure mode once (`test/doctor/checks.test.ts:469-473`). Fix it with the split, not after.
7. **`filterAudit` (`src/core/audit.ts:1797`) and `filterSelect`/`queryProjection`
   (`src/core/audit-db.ts:1217-1240`) are two implementations of one filter, and the file says so
   itself** ("two implementations of one filter is exactly the drift this project keeps finding").
   Looking at every caller individually, each choice is actually justified rather than accidental:
   `cli/commands/audit.ts`'s `load()` (`:272-297`) tries the indexed SQL path first and falls back
   to the raw-log path only when the projection is broken — a documented, tested fallback, not a
   second primary path. `mcp/tools.ts` (`~1612`) and `pack/history.ts` (`~458-463`) both
   deliberately skip the index — the MCP tool's own comment explains a handful of records never
   needs one and must never answer from something stale, and `pack/history.ts` needs every rotated
   segment, not just the live one. A cross-check test (`test/core/audit-projection.test.ts`, 355
   lines) pins agreement over a corpus that exercises every filter. **So this is not unresolved
   drift** — it's a deliberately-chosen set of independent call sites with a safety net — but the
   residual cost the file names is real: adding a new filter field means touching two
   implementations, and the cross-check test verifies *behavioral* agreement on sample data, not
   that a structural change to one was mirrored in the other. Worth a small, low-priority follow-up
   (a shared list of filter field names, asserted identical at both ends) rather than a removal.

## Implement differently

Nothing rose to this bar with confidence. The strongest candidate chased — generalizing the anchor
ruling's "every capability reachable from the screen" to pack import and config writes — turns out
to already be a **decided, deliberate absence**, not a silent gap (see **What should stay**, #7).
Checking the other direction (a CLI/MCP write-shaped capability with no UI read/describe view at
all, the read-only half of that same asymmetry) also came up empty: `packs-model.ts`,
`port-model.ts`, `proc-model.ts`, and the rest already serve a describe-only view for every
write-shaped CLI capability checked. MCP tool handlers were checked against their CLI counterparts
for parallel reimplementation and found to be thin wrappers calling the same `core/*` functions, not
two codebases answering the same question.

## Missing

1. **An inverse for `supersede`.** See top five, #5.
2. **`test/ui/read-model.test.ts` has not been split the way its sibling read-models' tests have**
   (`read-model-config.test.ts`, `read-model-flags.test.ts`, `read-model-work.test.ts`,
   `read-model-work-search.test.ts` all exist separately). Low-confidence as a standalone finding —
   it isn't missing today because the source it tests isn't split either — but it is sized here so
   that carrying out top-five #2 doesn't arrive as a surprise about scope.

Most of the other shapes this kind of review usually turns up — capability parity between
MCP/CLI/slash, a filename collision silently breaking a citation, a read vs. write asymmetry —
already have a purpose-built, *mechanically gated* answer in this repository
(`test/plugin/parity.test.ts`, `scripts/verify-citations.ts`'s ambiguous-citation gate,
`packs-model.ts`'s named absence below). Reporting that absence of gaps honestly seemed more useful
than manufacturing one.

## What should stay exactly as it is, even though it looks wrong

Every one of these looked, by name or size alone, like the duplication or accretion `CLAUDE.md`
warns about. Each has a specific, checkable argument against changing it — recorded here so a later
pass doesn't re-open a closed decision.

1. **`src/cli/commands/statusline.ts` (914) / `statusline-powerline.ts` (3,358) /
   `statusline-install.ts` (1,072)** — 5,344 lines across three files, explicitly called out by the
   owner as large. Checked for duplicated color/segment logic across all three and found none: each
   file owns one concern with no overlap — `statusline.ts` is the stdin-reading bridge entrypoint,
   `statusline-powerline.ts` is the ANSI/segment renderer (`buildSegments`, `renderPowerline`,
   `inkForLevel` — none of it duplicated elsewhere), `statusline-install.ts` is the opt-in
   settings.json installer with its own consent/never-clobber rules. A real three-way split, not
   accretion.
2. **`src/core/restore-stage.ts` / `restore-staging.ts` / `restore-store.ts`** — a three-way split
   with a *measured* reason: `restore-stage.ts` needs `session-summary.ts`, which value-imports
   `classifyTurn` from `conversation-index.ts`, which loads `node:sqlite`. Without the third file,
   every session start would load the whole conversation archive's index just to check whether a
   restore summary was waiting. `test/core/restore-delivery.test.ts` walks the runtime import graph
   and fails if `node:sqlite` becomes reachable from the restore-delivery path. This is the
   precedent behind treating a `conversation-index.ts` split (Simplify, #5) with real caution.
3. **`src/core/audit.ts` / `audit-db.ts` / `audit-tail.ts`, and the `filterAudit`/`filterSelect`
   pair specifically** — see Simplify, #6, for the full argument: a documented cycle between
   `audit.ts` and `audit-db.ts` that the module explains is safe (neither calls the other at
   module-evaluation time), and three independently-justified callers of the "duplicate" filter,
   guarded by a cross-check test. Looks like drift; is a reasoned design with a safety net and one
   small, named residual cost.
4. **`src/core/config.ts`'s hand-kept key lists** (`TOP_LEVEL_KEYS`, `UI_KEYS`, and siblings) — this
   is exactly the `D51` shape this project's own `REF-the-d-numbers-...` item names as a recurring
   subject ("a fact kept by hand in a second place, derived instead," with six known instances
   already filed and closed: `tuts/9`, `repaint/12`, four ruling items, `hooks/12q`). Checked for a
   new, unfiled instance here specifically and didn't find one: `UI_KEYS`'s own docblock argues
   explicitly against deriving it from `DEFAULT_UI` ("deriving the accepted set from the defaults
   would accept `{"ui":{"port":"abc"}}` the moment a default appeared while the value-check still
   only knew about `enabled`"), citing a dated 2026-08-27 incident where exactly that nearly
   happened. Hand-kept on purpose, with the derivation risk it avoids written down beside it. (Two
   *other*, genuinely new `D51` instances did turn up elsewhere in the tree — see Simplify, #6.)
5. **`src/ui/maintenance/**` and Task 13's `renderCorrection`/`correctionAtDoor` in
   `src/rules/deliver.ts`** — confirmed via `TASK-the-maintenance-tool-crud-where-the-form-is-the-
   template-and`. The maintenance tool is excluded from the shipped package
   (`package.json`'s `files`, `"!src/ui/maintenance/**"`) as its entire security model, asserted by
   `test/rules/maintenance-absent.test.ts` two ways (what `npm pack` would upload, and the exclusion
   rule itself). Task 13 is built, carries twelve passing assertions, and has zero callers in
   `src/` by explicit owner ruling (2026-09-11): the only actor who could change the store mid-
   session is the owner on his own machine, who would already know he'd done it. The revisit
   condition is recorded — if the maintenance tool ever ships, this is the first thing to rewire.
6. **`src/review/prompt.ts`**, the self-improvement loop's LLM prompt template — unused today
   because `review.enabled` defaults off and the model-call phase that would invoke it hasn't
   shipped (`src/review/trigger.ts`'s own six-gate chain: gate 3 is `review.enabled`; "the rubric
   still runs before any model call, since this build makes none"). Tested structurally
   (`test/review/prompt.test.ts`) and correctly unreachable until that phase lands.
7. **The absence of a UI write path for pack import and config changes** — checked for a second
   instance of the anchor asymmetry (a capability real elsewhere but only "describe a command" in
   the UI) and found one, then found it's a *named, deliberate* absence, not a silent gap.
   `src/ui/packs-model.ts`'s own docblock: "the one thing this screen cannot have, named rather than
   quietly missing." `planImport`'s module value-imports `createItem`/`updateItem` from
   `core/mutate.ts`, which would put a corpus mutator into the UI server's import graph — exactly
   what `test/ui/no-writes.test.ts` holds to one narrow, non-corpus-touching exception (anchors).
   Pack import and config writes do touch the corpus, so they stay CLI-only by design; the anchor
   ruling is narrow on purpose, not a first step toward "everything writes through the UI."
8. **`src/core/retire.ts`'s `RETIREMENT_RULE = null`** — literally "a state with no transition out,"
   which is exactly the shape this campaign was asked to look for. It's deliberate and
   self-checking: `WHY_NO_RULE` records three measured reasons (dated 2026-09-11) for why no rule
   currently fires, and an exported `derivability()` recomputes the same three numbers from the live
   corpus rather than asking a reader to trust a comment. If the premises change, the function that
   would catch it already exists.
9. **`src/plugin/parity.ts`** — the project's own answer to "does every MCP tool have a CLI/slash
   counterpart," test-enforced (`test/plugin/parity.test.ts`) in both directions with a required
   `note` field on every gap. Don't re-derive this by hand; point at it.
10. **`conversation-secrets.ts` vs. `conversation-redaction.ts`** — looks like a detect/act pair that
    should be one file. It's explicitly argued apart: `secrets.ts` quotes the owner's own
    requirement ("detection proposes, it never acts"), and `redaction.ts` explains that redacting the
    mirror in place would break integrity properties the mirror depends on. A real, justified split.
11. **`src/core/search.ts` vs. `src/core/conversation-search.ts`** — similar names, disjoint jobs:
    the former filters corpus *items* by relation/scope vocabulary, the latter is FTS5 search over
    transcript *prose*. No overlap despite the naming.
12. **Hooks boilerplate is not duplicated.** `src/hooks/observe.ts`'s shared
    `runObservationHook`/`ObservationSpec` shim already backs the small hook files, and
    `task-created.ts`'s own docblock argues against a single dispatcher binary: `hooks.json`
    registers one command per event, and routing on the payload's `hook_event_name` would trust
    attacker-controlled input for control flow — a class of bug this project has already paid for.
13. **`src/plugin/commands.ts`'s slash-command files are generated, not hand-kept**, and
    `src/mcp/tools.ts`'s `TOOL_NAMES` is derived from the registered tool specs rather than
    hand-listed — both checked directly, neither is a `D51` instance.
14. **`src/pack/` (12 files, ~8,655 lines) is already well-factored by concern** (bundle, collide,
    config-io, dir-writer, history, import, imported-audit, layout, manifest, reader, screen, zip) —
    no large-module complaint warranted there.
15. **Large-but-cohesive core modules with no accretion evidence**: `mutate.ts` (2,562 lines —
    already split once, by a prior "wave-5 consolidation" commit, out of `overlap.ts`,
    `verdict-store.ts`, `tests-resting-on.ts`, `persist.ts`; what remains is the single writer for
    all corpus mutations, by design), `config.ts` (2,705), `command-flags.ts` (2,049, argued at
    length as two tables for two different shapes — a parser's argument shape vs. the UI's
    declarative shape), `select.ts` (1,833, one gate-ladder/budget-fit/spill pipeline), `audit.ts`
    (1,913). Each is the sole writer or sole definer for one concern; none showed the "several
    unrelated things stapled together" signature that `read-model.ts` and `checks.ts` show.

## Could not assess

- **The symbol-level dead-export sweep has one real limitation: substring matching, not import
  resolution.** A scripted pass over all 1,002 files under `src/`, `test/`, `e2e/`, `scripts/`, and
  `hooks/` extracted every top-level export in `src/` and checked each by substring for a reference
  anywhere else. That's conservative in the safe direction — it can call a symbol "used" when it's
  only a comment mention (which is exactly how the three dead functions in **Remove** slipped past
  each lane's own by-hand checking, which read those comments as in-file use) but it cannot call a
  symbol unused that something genuinely imports. So the sweep's result — 102 runtime exports and
  222 type-only exports with zero outside references, of which 99 runtime ones are cosmetic
  (covered by top five #4) and 3 are genuinely dead (covered by Remove) — is a floor on dead code,
  not a ceiling. A second pass built on actual import resolution (a type-checker API, not grep)
  would be the way to get a ceiling, and wasn't attempted here.
- **`src/core/retrieval/` (7 files, 2,344 lines) was not assigned to any lane and got only a
  docblock skim from me directly**, not a full read. Each file opens with a strong, specific,
  measured argument for its own existence (FTS5 match-rate numbers, an explicit safety-boundary
  rationale, a named rejection of clustering in favor of a vocabulary match) — nothing read as an
  obvious problem, but "nothing obvious on a skim" is weaker evidence than what the rest of this
  report rests on, and should be stated as such.
- **The frontend (`src/ui/public/screens/*.js`, `src/ui/public/lib/*.js`) got only targeted
  pattern checks** — the `post()`/anchor-route count, a couple of helper-name greps (no shared
  `escapeHtml`-style helper found by name, but this wasn't chased further) — not a full read for
  duplicated formatting or fetch boilerplate across screens. `conversations.js` alone is 7,277
  lines, larger than `read-model.ts`, and was not reviewed in depth by any lane.
- **`e2e/` (88 spec files) and `scripts/` (30+ files) were not reviewed.** Arguably outside a
  strict "review `src/`" reading of the brief, but not explicitly excluded by it either.
- **`README.md` (456KB) and `CHANGELOG.md` (115KB) were not read for internal staleness** beyond
  the one cross-check that surfaced the `docs/capabilities/08-web-ui.md` finding above; both are
  large enough that a similar drift could exist elsewhere in them undetected. (Their *examples* are
  mechanically verified by `scripts/gen-doc-examples.ts` and `test/docs/examples.test.ts` — it's
  prose claims like "there are three exceptions," not code examples, that this class of check
  doesn't catch.)
- **The test suite was not run** (hard constraint — several other lanes were using it). Every
  "evidence it's safe" claim above rests on import-graph tracing and reading the cited tests' intent,
  not a green run after the change. `npm test` and `npm run typecheck` should gate any of the
  mechanical splits above before they're considered done.
