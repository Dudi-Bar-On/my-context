# SDD ledger — plan: docs/superpowers/plans/2026-08-15-my-context-capture-curation.md

Spec: `docs/superpowers/specs/2026-08-12-my-context-design.md` (binding authority).
Baseline: `98f64d1`, **605 tests** green, tsc clean.

The plan was amended before execution (`5208d7c`) against eleven pre-flight rulings; the prerequisite
code changes those rulings required are merged (`3a17af8`, `521bf95`, `811ea4d`, `3f2c7a5`). The
pre-flight scan itself, with all eleven rulings and their reasoning, is in the merge commit history
and in the amended plan's own prose. Highlights worth carrying: ingestion was structurally impossible
against the shipped `createItem`; `trustedStatus` had no `ingest` row and would have let ingested
constraints govern immediately; Task 7 was written against an MCP module that never existed.

## Standing instructions from the user for this plan

**S1 — Dogfood intensively, after every task.** Once a task's review is clean, capture that task's
real normative knowledge into this repo's own `.my_context/` **through the plugin's own surfaces**
(the MCP tools or the CLI), never by hand-writing Markdown. Rationale, in the user's words: at
completion we should have a tested, reliable plugin that is genuinely used rather than merely tested.
This project has twice found defects by *running* the product that 250+ tests missed — the missing
edit path and the unreachable migration — so this is a defect-finding technique, not ceremony.
Each task's dogfooding pass must report: what was captured, through which surface, and **anything
that was awkward, impossible, or wrong** — the friction is the finding.

**S2 — Ship a user-facing command surface alongside the agent-facing tools.** The plugin must serve
the user by command and the model by tool at the same time. The user's examples:
`/add-requirement <text>`, `/list-decisions [filter]`.

- **Ruling: generate `add-<type>` and `list-<type>` per *enabled* category from one template**,
  driven by the same resolved config `mycontext_help("categories")` reads, with a test asserting the
  generated set equals the enabled set. *Why:* it gives exactly the names the user asked for, it
  cannot drift from the category table (the defect class this project keeps re-finding), and disabled
  categories get no command. Plus a small generic set — `/mycontext-search`, `/mycontext-review`,
  `/mycontext-status` — for the actions that are not per-category. `/LoadMyContext` already exists.
  *Cost if wrong:* ~34 command entries in the user's picker; flagged to the user, who can collapse it
  to a generic `/mycontext-add <type> <text>` with a one-line change to the generator.
- This is **additional scope beyond the plan's fifteen tasks** and is tracked as Task 16.
- **Namespacing (user, follow-up): commands must read `/mycontext:add…`, not bare `/add-requirement`.**
  Claude Code namespaces plugin commands by plugin name, so this is probably automatic — but
  `.claude-plugin/plugin.json` names the plugin **`my-context`** (hyphenated) while the CLI binary and
  the `.mcp.json` server key are both **`mycontext`**. Left as-is, commands land at
  `/my-context:add-requirement`. Getting the requested prefix means renaming the plugin to
  `mycontext`, which is cheap now and disruptive once installed anywhere. **Do not guess the
  namespacing rule** — this project has already been burned assuming Claude Code plugin behaviour;
  confirm it from the documentation before Task 16, and settle the plugin-name inconsistency at the
  same time.

**S3 — a production-readiness audit, AFTER everything is committed and pushed and I would declare
the plugin production grade.** The user's terms, recorded verbatim in substance so they are not
softened later:
- It runs **from `master`**, not from a feature branch.
- It uses the superpowers tooling.
- It covers **every aspect**: code review, tests, architecture, UI/UX, the help system, usability,
  refactoring — and anything else that should be checked.
- It is measured **against all requirements accumulated from the beginning of this work to the end**,
  including everything the user added along the way, and against the written codebase. That means the
  original brainstorm, the spec, all four plans, and every requirement raised mid-flight — the
  tabular output with detail levels, domain grouping, session focus controls, granular filters that
  respect dependency structure, run-time audit logging that does not rely on git, the answered-question
  lifecycle, the dogfooding requirement, and the user command surface.
- Subagents must be configured **`model: fable`, `effort: xhigh`**. Note: the Agent tool exposes
  `model` but not `effort`; only the Workflow tool's `agent()` takes both. So honouring this as
  written means orchestrating the audit through Workflow — which the user has now explicitly
  requested in their own words, satisfying the opt-in requirement.
- Output: **a very detailed report plus an executive plan** for how to fix and improve, grounded in
  each area's foundations.

This is a standing instruction for after Plan 4 and Task 16 land. It is not optional and it is not
to be quietly folded into an ordinary final review.

## Rulings

- **Ruling (scope): the command surface is Task 16, executed after Task 15, not woven through.**
  *Why:* it depends on the command registry Task 6 builds and on `review`/`status` from Tasks 10 and
  15, so building it earlier means building it twice. — *Cost if wrong:* the user waits for the
  command surface until the plan's end; the MCP surface already works today.

## Progress

Task 1: complete (commits 98f64d1..5c019f0, review clean after **3 fix rounds**). 635 tests.
The implementation was approved after round 2 — 10/10 mutants killed, fence handling correct across 18
adversarial shapes, no termination hole for any finite `maxChars`. Round 3 was entirely about one doc
comment that had been **wrong three times in a row**, each version being the fix for the previous one.
Root cause, and the lesson: every other claim in that module is defended by a mutation-killed test; the
anchor-stability claims were defended by prose alone. The fix was not better wording but an executable
test — two `# Notes` sections, delete the first, assert what `notes` now names — which a mutant kills.
The comment is now explicitly non-exhaustive and points at the test file as ground truth.

Also corrected in round 2: the implementer had reported a guard was untestable because removing it hung
uninterruptibly. That did not reproduce; it self-corrected, and the real hang it had masked
(`maxChars <= 0` looping unbounded then throwing `RangeError`) was found and fixed.

Task 2: complete (commits 66c7074..211e4c5, review clean after **3 fix rounds**). 735 tests.
The task's charter was made measurable: `validateCandidates` must be a **complete precondition** for
`createItem` — every candidate it accepts must write and round-trip byte-identically, because Task 4
builds `applyCandidates` on that and a violation strands a half-applied ingest. Final verification, by a
reviewer-designed sweep independent of the implementer's: **34,746 generated candidates, 11,488 accepted,
zero round-trip failures**, with every establishing guard mutation-proven.

The implementer deviated from the brief in **six** places to make the validator stricter and to reuse
`mutate.ts`'s validators rather than write a second divergent set; it flagged all six and **all six were
upheld**. It also stopped lowercasing observation categories — the right call, matching `mutate.ts` — but
did not flag that it converted a previously-accepted input into a rejected one; that class of change
belongs in a deviation list.

- **Task 2: Ruling: whole-candidate rejection when one observation is malformed — KEEP.** *Why, and this
  reasoning is stronger than the implementer's:* `hashContent` folds `observations` into the content hash,
  and that hash **is** the dedupe key. An item created with two of three observations is not a lossy
  version of the asserted item — it is a **different item with a different identity**, and that rewrite is
  frozen: every later re-capture of the correct extraction either dedupes against the wrong one or mints a
  duplicate. Silent observation-dropping does not lose a line; it corrupts the corpus's notion of what was
  captured, permanently and invisibly. The "harsh in a batch of twenty" objection is answered by the
  design — nineteen land, and the failure names the exact field and the corrected value. A **repair loop**
  (feeding `issues[]` back as a targeted re-prompt for only the rejected indices) is the right third
  option and belongs in Task 5. **Auto-repair is explicitly rejected**; `isValidObservationCategory`'s
  docblock already argues why silent normalization is the bug rather than the fix.
- **Task 2: Ruling: a title beginning with a quote character — FIX THE SERIALIZER, not the validator.**
  *Why:* `"Least privilege" applies to every service` is ordinary content, and a knowledge base that cannot
  store it is worse than one with a stricter emitter. Provably safe: the only strings whose output changes
  are ones that previously produced *unparseable* files. — *Cost if wrong:* a read-side compatibility
  change for pre-existing files containing double backslashes in quoted frontmatter; none exist in the
  corpus, verified.
- **Task 2: Ruling: collapsing whitespace runs in observation text is the one sanctioned LOSSY
  normalization.** *Why:* unlike category-lowercasing or text truncation, it changes neither meaning nor
  identity, and `parseObservations` collapses it regardless — so the alternative is a checksum that can
  never match. Documented in code with its reasoning and explicitly not a precedent.
- **Task 2: Ruling (against the implementer): the `mutate.ts` tags/context gap is NOT out of scope.** It
  reported the gap as pre-existing and deferred it. It is reachable **today** with no ingest involved:
  `optObservations` in `src/mcp/tools.ts` forwards per-entry `tags` and `context` even though the
  advertised schema lists only `{category, text}`, and tool schemas are advisory. Reproduced through the
  real registry — `tags:['#auth']` read back from disk as `text: "ok #"`. Fixed in `validateObservations`
  where both surfaces share it, rather than encoding the same rules twice.

**Two failures worth remembering, both of which passed every mutation test:**
1. A CRLF fix normalized the value passed *to* `validateBody` but not the value **stored**, so validation
   saw clean text and the write saw dirty text. CRLF is the routine case — every Windows-authored source
   document produces it.
2. Widening the newline character class in `schema.ts` while, *in the same commit*, delegating the check
   to a shared function in `mutate.ts` that tested a narrower class — the delegation was structurally
   right and routed around the widening. The report then claimed coverage for the field it had just lost.
Both are locally correct and globally wrong. **Mutation testing proves a guard works; it cannot tell you
the guard is in the wrong place.** Only the completeness sweep found them — and the sweep itself was blind
until it was made a cross-product, because 13 single-field-perturbation rows never varied `body` once.

**Carried into Task 4 as a prerequisite:** `link_items` does not validate its relation **target**.
`to: 'a]b'` and `to: 'x\ny'` both report success and write an entry `parseItem`'s `RELATION` regex cannot
match — the relation is **silently dropped on the next read**. `createItem`'s `relations` input is
likewise unvalidated. Slug-shaped ids are safe today, but Task 4 writes `supersedes` relations through
this path, so guard it before that task rather than inheriting the gap.

Task 3: complete (commits b2cedf3..a6e4ae0, review clean after **3 fix rounds**). 769 tests.

- **Task 3: Ruling: stop mutating `applied` in the session file — append-only log.** *Why:* the implementer
  honestly flagged that two processes racing on one session lose one side's `applied` records,
  last-writer-wins. That is worse than forgetfulness: the item A created still exists on disk, so the
  chunk becomes pending again, is re-extracted and re-applied, and **produces a duplicate** — the same
  shape as the schema-init race that duplicated rows in 18 of 20 fresh workspaces. Merge-on-save does not
  fix the worse case where both processes open before either saves. Keeping `<id>.json` immutable after
  open and appending each record to `<id>.applied.jsonl` makes `O_APPEND` semantics eliminate the class
  rather than narrow the window. Done in Task 3 because Tasks 4/6/7 would otherwise have consumed the old
  shape. Verified under real contention: two OS processes × 40 saves recovered **80/80 anchors, zero
  unparseable lines, zero duplicates**. — *Cost if wrong:* a second file per session.
- **Task 3: Ruling: strict reject for an invalid session id, not `sanitizeSessionId`'s mangle-and-continue
  — UPHELD** (the implementer's deviation). Every legitimate ingest id is machine-produced with an exact
  shape, so mangling would resolve a caller's bug to a *different valid session* and lose data quietly,
  whereas the hook path that helper serves must always resolve to some snapshot. `SAFE_ID` is strictly
  stricter, so the divergence is one-directional and its failure mode is a branded throw, never a silent
  wrong file.

**Two Criticals were traversal-and-collision defects in the original:**
- Session ids were used directly as path components: `loadSession(root, '../secret')` **read outside**
  `.ingest/` and `saveSession({id:'../pwned'})` **wrote outside** it. Tasks 6 and 7 wire that id to a CLI
  argument and an **MCP tool parameter**.
- The id collided across distinct source files — `docs/prd/auth.md` and `docs/prd-auth.md` slugify
  identically — so with matching content, opening the second returned the first's session, reported its
  chunks applied, and **the second document was never extracted**. The content checksum cannot catch it
  because content matching is the collision condition.

**And the round that fixed those introduced two more, both in its own new code:**
1. `appendAppliedDiff` did `(already[anchor] ?? []).map(...)`, so an anchor of `constructor` resolved to
   the inherited `Object` and the **first save after applying that chunk threw**. That is the identical
   hazard the same round had just fixed in `pendingAnchors`, twenty lines away. **The lesson: a guard at a
   call site is not a property of the module.** Slugified anchors can always spell `constructor`, so the
   defence now lives in one accessor (`hasApplied`/`appliedRecordsFor`) that every caller uses.
2. A crash-truncated final line poisoned the next append — the new record concatenated onto the partial
   line, both became unparseable, and the record lost was the one written by the **recovery** save, i.e.
   exactly the case the append-only redesign was ordered to survive. Reads tolerated it; writes did not.

**Both mutants the implementer called unkillable were killable**, and the reasoning generalises:
`listSessions` sorts by the **`id` field**, not the filename, so a file named `aaa.json` carrying an id
starting `zzz` makes the two orders disagree on every filesystem; and `retryOnTransientFsError` *is*
manufacturable on Windows — a competing child-process handle makes plain `renameSync` fail in 0 ms while
the wrapped call succeeds after ~71 ms. **`writeItem` carries the identical wrapper, equally untested,
shipped since Plan 3** — worth closing when convenient.

**Carried into Task 4 as prerequisites:**
1. `link_items` does not validate its relation **target**: `to: 'a]b'` and `to: 'x\ny'` report success and
   write an entry `parseItem`'s `RELATION` regex cannot match, so the relation is **silently dropped on
   the next read**. `createItem`'s `relations` input is likewise unvalidated. Task 4 writes `supersedes`
   relations through this path.
2. The apply loop must **re-read the session immediately before each chunk** rather than trusting a
   `pendingAnchors` snapshot taken at open — concurrent appends make that snapshot stale.
3. Two surviving mutants found by the final reviewer's own novel probes, both narrow untested failure
   paths adjacent to this round's code: `listSessions` on a workspace where `.ingest/` was never created
   (a realistic `ingest-status`-before-any-ingest entry point), and `openIngestSession`'s
   corrupt-existing-header JSON-parse branch (existing tests write *valid* JSON with a wrong checksum, so
   they never reach the parse failure). Two `test()` blocks.

Task 4: complete (commits 61e3230..2bada64, review clean after 3 fix rounds).
Task 5: complete (commits 2d95921..58ed397, review clean after 1 fix round). 833 tests.

**Task 5 is the only artifact in this codebase with no compiler** — a prompt whose sole failure mode is
semantic — so it was reviewed by executing every example in it against `validateCandidates`. All passed,
both before and after. The defects were in what it **omitted**: four validator rules it never mentioned,
the highest-probability being that a body containing a heading line is rejected *while the schema itself
asks for rationale prose*. It also contradicted itself on the output format (prose said `candidates` is an
array, the machine-readable JSON block said it is a string), and rendered the chunk the model must read as
a single 5,956-char JSON-escaped line at line 211 of 237 — with the instruction "read the chunk below".
Nine of ten mutants survived: the schema could be replaced with `{}`, the prose instructions deleted, and
the callback instruction removed, all green.
Worst case after the fix: **16,152 chars, ~4,038 tokens** for a 6,000-char chunk with 17 categories. Sane.

**Task 5 follow-ups (non-blocking, verified by the reviewer's own mutants):** three claims are untested —
that the embedded JSON no longer duplicates `chunk`/`instructions`; that `CHUNK_FENCE`'s four backticks
beat an embedded triple-backtick block in a chunk; and that `schema.ts`'s rule-teaching descriptions say
what they claim, since `assert.deepEqual(req.schema, CANDIDATE_SCHEMA)` pins the two files to each other
but neither to correctness. A handful of assertions.

**Confirmed for Task 7:** the repair loop is owned downstream and Task 5's design does not foreclose it —
issues travel as text alongside the request. But the planned Task 7 code emits the resubmit list **and**
the next chunk's full request in one message, with nothing saying which to do first or that rejected items
resubmit against the **previous** anchor. Given the omitted-rules finding, rejections will not be rare.

Task 6: complete (commits e3620ee..2b0a3f2, review clean after **3 fix rounds**). 872 tests.

- **Ruling (mine, and I got the scope wrong first time): the apply lock is PER-WORKSPACE, not per-anchor.**
  I specified "per anchor" in Task 6's requirement because that is where Task 4's symptom was observed.
  The invariant is workspace-wide, because `takenIds` — the set that mints revision ids — is built from
  the whole corpus. The implementer followed my instruction faithfully, and the reviewer then reproduced
  the loss **with two real processes and zero instrumentation** by racing two different anchors of the
  same session whose candidates shared a title: one body overwritten, both racers exiting 0. Cross-session
  collisions behave identically. Verified after widening: 8/8 clean with the fix, 7/8 red with only the
  key reverted.
- **Ruling: `ingest-apply` exits 0 after doing what it was asked.** It exited 1 whenever an unrelated
  corrupt item existed, contradicting the standing rule that only `status` and `doctor` fail on corpus
  load errors. The **brief encoded the wrong behaviour and pinned it in its own test**, so code, brief and
  assertion changed together.

**Three lock defects across three rounds, each introduced by the fix for the previous one:**
1. Wrong key (per-anchor vs per-workspace) — silent content loss.
2. **The stale-lock recovery added for crash-wedging opened a steal window.** `openSync(file,'wx')`
   creates the file *empty*; the pid payload lands on the next write. A concurrent acquirer inside that
   window read an unparseable payload, called it stale, and **deleted the live holder's lock** — a real
   double-hold in 300 attempts, cascading, because the loser's steal made the winner's `release()` delete
   the *new* holder's lock. Crash recovery and mutual exclusion pull in opposite directions and the seam
   is the create-write gap.
3. On Windows, `open(..., 'wx')` against a delete-pending file returns **`EPERM`**, and anything not
   `EEXIST` was rethrown — a legitimate concurrent apply hard-failing on the primary platform.

**A measurement that changes how mutation results should be read.** Both flagship concurrency tests were
**~50% detectors** — 4/8 and 5/8 red under their own mutants — and a mutant that broke exclusion entirely
survived a full run. A coin-flip detector reports "killed" often enough to look like a pin. From Task 6
on, concurrency guards must report a **pass rate over repeated runs**, not a single red/green. Final state:
1200 acquisitions across 12 processes, **0 double-holds**; removing the grace produced 3.

**🔴 CARRIED INTO TASK 7 — it needs this same lock from the MCP entry point:**
- **Adopt the `linkSync` construction.** Exclusion currently rests on a *timing assumption*, not an
  invariant: `LOCK_WRITE_GRACE_MS` (500 ms) presumes no holder stalls between `openSync` and `writeSync`.
  Forcing a 700 ms stall collapsed exclusion completely — **12/12 acquisitions double-held**. Writing the
  payload to a temp file and `linkSync`-ing it into place makes creation atomic *with* its payload, fails
  `EEXIST` cleanly, never exposes an empty lock file, and lets the grace period and the entire
  unparseable-payload branch be deleted. Do it before a second entry point inherits the assumption.
- Two guards are **fixed but unproven** — the PID-reuse mtime backstop and `cmdIngest`'s ENOENT split both
  survive the whole suite when mutated.
- The `EPERM` retry is killed only by a unit test that restates the implementation; the behavioural hammer
  is a 0/6 detector at its configured width (EPERM only appeared at 12 processes, not 8).

Task 7: complete (commits d760eea..a2b5f14, review clean after 1 fix round). 890 tests. Tool surface is
now **eleven registered**, `RESERVED_TOOLS` empty, every description ≤200 chars with `Not for:`, no schema
exposing `origin`, and the MCP server's 29-file transitive closure contains no `console.log` — only a
stderr write in `server.ts`'s startup-failure catch.

- **Ruling (mine, and it introduced a regression): rebuild the lock on `linkSync`.** The goal was right and
  achieved — construction is now atomic with its payload, so "the file exists" and "the file has a valid
  payload" became the same event. Verified by direct attack: a 700 ms stall between the syscalls gave
  **0 double-holds in 48 acquisitions**, where the previous shape gave **11 of 12**. Then 938 acquisitions
  across 12–16 processes with zero double-holds, and the exclusion-removal mutant that *survived a full
  run* in Task 6 is now killed by 7 of 15 tests.
  **But `linkSync` requires hard-link support**, absent on exFAT/FAT32, some SMB/NFS mounts and some
  container volume drivers. Node reports that as `EPERM`, which the retry logic read as contention — so
  the lock spun the full 15 s and then reported "Another process may be applying candidates": false,
  unactionable, and permanent on those filesystems. CI covers only NTFS and ext4 and structurally cannot
  catch it. Fixed with a latched fallback to `openSync('wx')` + payload; forced-`EPERM` now completes in
  ~95 ms instead of 15 s, while genuine `EEXIST` contention still waits and retries.
  **The lesson: my instruction named a mechanism without naming its precondition.** That is the same shape
  as the fixes that kept opening new holes — locally correct, wrong in a dimension nobody was looking at.
- **Ruling: the two entry points must teach the same next action.** The implementer fixed the repair-loop
  ordering in the MCP tool and honestly flagged the CLI as out of scope. Side by side on identical input,
  MCP said "do not request the next chunk yet" while the CLI printed terminal-sounding wording followed by
  forty lines of the **next** chunk's request — they did not differ in emphasis, they taught **opposite**
  next actions and the CLI steered away from the rejects. Both now emit the same instruction and neither
  emits an extraction request when candidates were rejected. Verified by driving both surfaces.

**Also worth keeping:** the implementer found the brief's baseline stale — `load_context` was already
registered, so the surface went ten→eleven, not nine→ten — and fixed two assertions in a file the brief
never listed. And it discovered that **named ESM imports of `node:fs` are not live-bound to reassignment**,
so its first mock silently did nothing; it verified that with a minimal repro before trusting the test.

**Task 7 follow-ups (recorded, not fixed):**
- `release()`'s ownership check narrows but does not close the cascade — a real cross-process double-hold
  was demonstrated. Root cause is not the check: the lock's mtime is set once at creation and **never
  refreshed**, so any holder whose critical section exceeds `LOCK_STALE_MS` is judged stale despite a live
  pid. The check is also pid-granular, so it cannot distinguish two acquisitions by the *same* process —
  the exact shape `tempCounter`'s own comment says the code is designed for. A per-acquisition nonce plus
  an mtime heartbeat (or pid-only staleness) fixes both.
- Dropping only the `!existsSync(file)` half of the new structural-failure guard **survives the whole
  suite**, so a genuine Windows delete-pending `EPERM` would permanently downgrade the process to the
  non-atomic construction with nothing noticing. Degrades gracefully rather than reintroducing the lie.
- No concurrency test touches the MCP entry point — and note the reviewer's own attempt produced correct
  results *even with the lock removed*, because `store.all()` is a live SQLite read, so a useful test needs
  a sharper trigger.
- The MCP path rebuilds **outside** the lock while the CLI rebuilds **inside** it, and `lock.ts`'s comment
  describes the critical section as starting at context open. Touching it means touching `withWorkspace`,
  shared by all eleven tools.
- Three surviving mutants in the lock's new code: deleting the temp-file cleanup passes because
  `lockFiles()` filters on `.endsWith('.lock')`; `tempCounter`'s uniqueness is untested; and the
  `LOCK_STALE_MS` backstop for a *parseable, live-pid* payload — the whole pid-reuse rationale — is
  untested. A process killed between temp creation and the `finally` leaks a file nothing reclaims, and
  `.my_context/.ingest/` is not in `.gitignore`.
- Recoverability for a genuinely corrupt lock went from 500 ms to 5 minutes — deliberate, but user-visible.

Task 8: complete (commits 2204ce7..4c95c02, review clean after 2 fix rounds). 921 tests.

**🔴 THE GATE'S ACTUAL GUARANTEE — Task 9 depends on this, so it is recorded verbatim.**
What holds **by construction** after the fixes: there is no `LessonStaging` parameter left to forge;
`origin: 'human'` is unreachable from any argument; `createItem` has exactly one call site; state
transitions are durable across processes; and `edits` are re-validated on the same path as fresh
candidates. Path traversal is closed across six shapes.
What does **not** hold: **the staging file is unauthenticated working state.** Anything that can write
`.my_context/.staging/*.json` — including any agent with file-write access — fully dictates what a later
accept creates. A hand-written staging file with a correct protocol and a wholly fabricated candidate
produced a live `active` rule with `origin: 'human'`.
**So the gate that actually holds is: "a human ran `lesson-accept` naming this specific key." Nothing
more.** The module cannot attest that the candidate behind that key came from a model reasoning about a
real lesson.

**🔴 HARD CONSTRAINTS ON TASK 9, from the same review:**
1. Never accept a serialized staging blob, a staging file path, or a `--root` an agent chose. `lessonId`
   and `key` are the only staging inputs.
2. Never accept by key alone without **printing the candidate's full title, body, directive, scope and
   severity** for the human to read. Given the above, key-only acceptance means approving a **hash**, not
   a rule.
3. Never expose `lesson-accept`/`lesson-discard`, or any wrapper of `acceptStagedRule`, through the MCP
   surface, a hook, or anything a model can invoke. `lesson-stage` is fine to expose; accept is not.
4. Never re-introduce load-once-and-pass-around for accept/discard — the re-read *is* the fix.
5. Never derive the relation's `lessonId` from anything other than the argument the existence check uses.

**Defects worth remembering:**
- The first round's gate "held by absence, not by construction" — nothing imported the module, so an agent
  could not reach accept at all. Task 9 wires it, which is why construction had to carry it.
- A forged staging object with a `lessonId` naming a **nonexistent** lesson produced a live `active` rule.
- The guards the doc comments called structural refusals **did not persist**: accept set `state` in memory
  and never saved, so a second accept succeeded silently; `discardStagedRule` took no `root` and therefore
  *could not* persist.
- A comment claimed `produced_rule` "would throw because it is not in `RELATION_TYPES`". False on this
  path — `createItem` validates relation *targets* only; the enum lives in `linkItems`, never called here.
  Proven by writing `- produced_rule [[LESSON-…]]` to disk. **The implementer's own report identified this
  and shipped the comment anyway** — recording a defect is not the same as not shipping it. Sixteenth
  instance, this time on the security claim itself.
- `edits` bypassed every validator: `{scope: ['**'], directive: 'maybe'}` produced a rule with the exact
  bare glob spec §9 names as defeating inert-by-default.
- The round that fixed persistence **introduced** a new hole: `saveStaging` wrote to the file named by the
  staging object's own `lessonId` field while the load path read the file named by the *argument*, with
  nothing checking they agree — reopening double-accept. One line.

**Task 8 follow-ups (recorded, not fixed):** four surviving mutants — widening `LESSON_ID_RE`, deleting the
`severity` enum check, `listStaging`'s protocol filter, and a re-stage `settled` filter that drops
`accepted` candidates (**directly on the trust boundary** — re-staging is the reset button and no test
proves an accepted candidate survives it). A non-array `scope` is silently coerced to `[]` rather than
rejected; it fails *inert*, so a UX defect rather than a gate hole.

### Dogfooding pass — Tasks 3 and 4 (S1). One finding.

Re-running the Task 2 capture script reported **"created"** for all three items, which already existed on
disk unchanged. Cause: the script opens `Store.open(':memory:')` and never calls `rebuild`, so
`createItem`'s dedupe has no view of the corpus and the anchored/family checks find nothing. It then
rewrote all three files with byte-identical content, so `git status` is clean and no damage occurred —
but the message was wrong, and a caller whose content *had* drifted would have silently overwritten a
real item while being told it created one.
**The finding: the mutation layer trusts `ctx.store` as the view of the corpus.** `withWorkspace` in
`src/mcp/tools.ts` rebuilds before every call precisely for this reason, and the CLI's `openStore` does
too — but nothing in `createItem` requires it, and a hand-rolled caller (a script, a future command, an
ingest driver) can pass a stale or empty store and get a confidently wrong answer. This is the same
family as Task 4's concurrency finding: correctness depends on the store reflecting disk, and that
precondition is enforced by convention at each call site rather than by the write path. Worth a plan-level
decision — either `MutationContext` should carry a freshness guarantee, or `createItem` should refuse a
store that has never been rebuilt.

Task 4: in progress (round 3). Revision scheme **verified correct end to end** by execution — create, 12
revisions, exactly one draft head and 11 superseded, each carrying one `supersedes` relation to its
immediate predecessor, all intact after a full rebuild from Markdown, then correctly minting `-r13`.

**🔴 REQUIREMENTS FOR TASK 6 — these live here because Task 6 will read this ledger, not Task 4's report:**
1. **`applyCandidates` requires a lock per anchor.** Proven with two real processes on one workspace:
   with *different* bodies both computed the same `-r2`, both created it (each `projectItem` lookup
   preceded the other's write), **both reported success**, and one body was silently overwritten and lost.
   The applied log ends with two conflicting records for the same id, only one matching the stored
   `content_hash`. This is *not* self-limiting — an earlier claim that `createItem` would make it fail
   loudly was disproven by execution.
2. **Task 6 must `saveSession` immediately after every `applyCandidates` call.** Not merely for crash
   durability: a **reworded** re-extraction of an *unchanged* document — the normal case for a
   non-deterministic LLM — takes the supersede branch and mints a spurious revision that retires the
   previous draft. An identical or whitespace-only-different re-run dedupes cleanly.

**The prototype hazard reached its third occurrence, in a third file** — `apply.ts` used bare-bracket
`session.applied[anchor]`, so an anchor of `constructor` threw **after** the item was durably written,
leaving an item on disk, no apply record, and a chunk that throws identically on every retry. The cause
was structural: Task 3's `hasApplied`/`appliedRecordsFor` accessors were **private**, so the new file
could not use them. They are now exported. A defence unreachable from the call sites that need it is not
a defence. (The *write* side is still bare-bracket and safe only because `slugify` collapses `_` to `-`,
making `__proto__` unreachable — reasoning that lives nowhere near the write. Being closed in round 3.)

**Other defects worth carrying:**
- `localeCompare` was used to canonicalize `candidateHash`, which is written into every item's frontmatter
  and is *the* cross-machine dedupe key — against the project's own documented rule in `select.ts:113`.
- A chunk whose candidates **all** failed validation was permanently marked applied, so `pendingAnchors`
  never resurfaced it and no record showed the rejection. Ruled: leave it pending.
- The relation-target guard added as a prerequisite named the wrong two surfaces in its own doc comment
  and missed `supersedeItem` — **the only relation-writing path `applyCandidates` uses**. `createItem`'s
  `input.id` was also unvalidated, so `CONST-a]b` produced a dropped relation *and* a checksum-failing file.
- `ingestKey`'s 60-char truncation collapsed two distinct requirements into a supersession **within one
  batch**. The fix over-corrected by hashing the *raw* title, which narrowed identity to case- and
  punctuation-exact and turned a reworded re-extraction into **duplicate competing drafts** — worse than
  the supersession it replaced. Round 3 hashes the untruncated slug normalization instead.

### Dogfooding pass — Task 2 (S1). Captured through the mutation layer, full fidelity.

Three items, written via `createItem` with bodies, scope, tags and observations — not `mycontext add`,
which still accepts only a category and a title: `INV-a-validator-that-gates-writes-must-be-a-complete`,
`LESSON-mutation-testing-proves-a-guard-works-not-that-it-sits-in`,
`DEC-reject-the-whole-candidate-when-one-observation-is-malformed`. Corpus now 39 items; `status` exits 0;
the corpus-checksum test passes, which independently proves the new items round-trip.
Friction: none new. The Task 1 finding stands — the human CLI surface cannot express a body, scope, tags
or observations, so a human capturing real knowledge must either hand-edit (which the write-deny hook
exists to prevent) or drop to a script. Task 16 must close this.

### Dogfooding pass — Task 1 (S1). Three defects found by the first three CLI commands.

Surface used: the CLI (`node src/cli/index.ts add`), which now routes through `createItem`.

1. **🔴 There is corrupted knowledge in the shipped corpus, on `master`.**
   `OPENQ-how-do-filters-respect-dependencies` carries an observation ending in a parenthetical:
   *"…load-bearing (blocks, depends_on, constrains, enforces) versus merely referential (derived_from,
   links_to, discovered_by, supersedes)"*. The trailing `(...)` re-parses as the observation's `context`
   field, truncating the sentence at "merely referential". Verified: recorded checksum `787a19d3…`,
   content now hashes to `999af126…`, and `renderItem(parseItem(file)) === file` — the file is
   self-consistent, so the **checksum is the only witness that text was altered at write time**.
   This is exactly the defect Plan 3's final review escalated to Critical and guarded at the write
   boundary. **The guard prevents new instances; nothing detects or repairs existing ones.** The seed
   script created this item before the guard existed. Task 11/12 (`doctor`) must include a check that
   finds this class, and the corpus needs a one-off repair.
2. **A successful `add` exits 1.** The item was created; an unrelated item's load error then set a
   non-zero exit. That is my own ruling R5 applied too broadly.
   **Ruling (refines R5): a command that did what was asked exits 0 and *reports* corpus load errors as
   a warning. Only commands whose job is to report health — `status`, `doctor` — exit non-zero on them.**
   The shipped `cli.test.ts` assertion that motivated R5 is specifically about `status`, so this is
   consistent with it. *Cost if wrong:* a script that wanted to detect corpus rot from any command must
   call `doctor` instead.
3. **Slug truncation cuts mid-word.** `add lesson "A behavioural guarantee in a comment needs a test,
   not better wording"` produced `LESSON-a-behavioural-guarantee-in-a-comment-needs-a-test-not` — a
   dangling "not". Truncate at a word boundary.

Friction worth recording separately: `mycontext add <category> <title>` accepts **only** a category and a
title. There is no way to supply a body, scope, tags or observations from the CLI, so every item captured
this way is a stub that must then be hand-edited — which is the very thing the write-deny hook exists to
prevent. The MCP surface has full fidelity; the human surface does not. This is what Task 16's command
surface must fix, and it argues for those commands calling the mutation layer directly rather than
shelling out to `add`.

