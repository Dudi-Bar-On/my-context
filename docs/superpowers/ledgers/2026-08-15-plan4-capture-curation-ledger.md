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

Task 9: complete (commits 10617f7..7204460, review clean after 1 fix round). 937 tests.
Four of the five hard constraints verified closed by execution: no staging blob, staging path or
agent-chosen root is reachable through any flag or positional; no MCP tool, hook, skill or command file
mentions accept or discard anywhere; no load-once-and-pass-around survives; and `--edits` cannot smuggle
anything past validation, with `origin: 'human'` hardcoded and unoverridable.

**🔴🔴 SECURITY ESCALATION — CORRECTS WHAT THIS LEDGER SAID AT TASK 8, AND IS A HARD REQUIREMENT ON TASK 16.**
Task 8's entry recorded the forged-staging-file hole as an accepted property of unauthenticated working
state. **That framing is no longer accurate, and the real problem is larger.** Forging is not even
necessary. The derivation request this plugin *prints* instructs the model to shell out to the CLI —
`Call back with: mycontext lesson-stage ${lesson.id} --stdin`. Any agent that can follow that instruction
has a shell, and the same shell reaches `mycontext lesson-accept`. So the full sequence
`lesson` → `lesson-stage --stdin` → `lesson-accept <id> <key>` is the **documented happy path**, every leg
is Bash-reachable, and none of it involves a human. Demonstrated end to end: a rule landed `active`,
`origin: 'human'`, `derived_from` wired.
In Task 8 this was theoretical — nothing imported `acceptStagedRule`, so accept was unreachable and the
hole belonged to a module nobody called. **Task 9 turned it into a working sequence.**
**The honest statement: the approval gate holds if and only if the agent's Bash surface excludes
`mycontext lesson-accept`. Nothing in this repo enforces that, documents it, or ships a deny rule, and
`SKILL.md` does not mention the CLI at all.** Task 16 ships the user command surface and is the natural
place for a permission deny rule or an interactive confirmation; it must be given this explicitly rather
than inheriting Task 8's phrasing. Surfaced to the user.

**Other defects:** all three lesson commands exited 1 after successfully creating and persisting a rule
whenever an unrelated corrupt item existed — contradicting the doc comment on the very function they call,
and untested in both directions. And the guard whose entire purpose is human review — printing the
candidate before accepting — had **no test**: deleting the whole block survived, dropping all five field
lines survived, and swapping the spread so it printed the **pre-edit** candidate while creating the
**edited** one also survived. A comment also claimed the printing "turns 'a human named this key' into 'a
human read this rule and approved it'", which the code cannot support on two counts.

**Note for the remaining tasks:** the brief for Task 9 was **stale and internally broken** — it called
Task 8's pre-review signatures (would not typecheck) and its own Step 1 test asserted a string its own
Step 3 could not produce. Later unexecuted tasks in this plan may carry the same pre-review assumptions.

Task 10: complete (commits 5b2b626..c08f5b2, review clean after 1 fix round). 970 tests.
**`mycontext review` now exists** — the promotion path that four plans' worth of messages referred to and
that meant "hand-edit `status:`" until this commit. Verified: non-draft promotion refused for all four
statuses, ids exact-match with no prefix surface, `discard` writes `deprecated` and deletes nothing,
`promote` goes through `updateItem` as one object with `origin: 'human'` and lands `active` on disk with a
recomputed checksum, and nothing is reachable from MCP, hooks, skills or commands.

- **Ruling: `promote` and `discard` require confirmation.** They refuse without `--yes` when stdin is not a
  TTY, and prompt when it is. **This is explicitly not a security boundary** — the reviewer's verdict is
  that it changes nothing about what an agent with a shell can do, since `--yes` is one token on a command
  line the agent composes itself. What it buys is **legibility**: a promotion cannot happen without an
  explicit, greppable token in the transcript, so "did an agent promote this, and did it mean to?" becomes
  answerable after the fact. `confirmAction`'s own doc comment says this. **It must never be described in
  user-facing docs as protection against an agent.** Verified the gate runs after the preview and *before*
  any mutation — moving it after the write is killed by a test.

**Two defects were verbatim repeats of fixes landed one and two commits earlier**, and that is the finding
worth keeping:
1. All five return sites exited 1 on an unrelated load error, so `review promote` returned failure **after
   a successful, persisted promotion** — exactly what Task 9 fixed two commits before, whose own comment
   explains why it is worse after a mutation than in a read-only command.
2. The human-review preview shipped with **no test and three surviving mutants** — the same defect and the
   same survivor count as Task 9's equivalent guard, which that task's dispatch had flagged.
In both cases **the report claimed the property and the mutation table did not cover it.** The sharper
statement of this project's recurring pattern is therefore not "a comment asserts what the code lacks" but
**"a report asserts what the tests do not check"** — and a fix landing in one file does not propagate to
the next file that needs it, because nothing carries it but attention.

Also fixed: `promote --always` printed "never auto-injected" while `select.ts` admits `always` items into
the pinned tier with no scope check — the command manufactured its own counterexample in one step. And
five shipped messages still said "`mycontext review` is not implemented yet", two of them the exact text a
refused non-human caller receives; eighteenth instance, shipped in the commit that falsified it.

**Task 10 follow-ups (approved to merge with these open):**
- **`--yes=false` and `--yes=no` CONFIRM the action** — `hasFlag` matches any `--yes=` prefix, so the one
  spelling an operator would reach for to *decline* is the one that proceeds. Consistent with the CLI's
  flag semantics everywhere, which is why it is not a Task 10 patch — **carried to Task 16**, which owns
  the command surface and will touch flag handling. Same applies to `--always=false`.
- Four surviving mutants on behaviours the CLI **advertises in its own usage string**: `--severity hard`
  being applied at all, `--scope "a/**,b/**"` comma-splitting, the `=` form of `--yes`, and `drafts()`'s
  `(type, id)` ordering.
- The global-layer guard is untested. The implementer **refused to write into a real `~/.my-context`** to
  test it, which was the right instinct — but "therefore untestable" did not follow: `CommandDef.run`
  takes a `Workspace` directly, so a test can pass `globalRoot: <tempdir>` and never touch `homedir()`.
  The reviewer wrote that probe; with the guard disabled, the **full "about to promote" preview prints
  before the refusal** — the same ordering bug this round fixed for the disabled-category case. ~20 lines.
- `test/cli/lesson.test.ts` and the ingest tests use bare end-of-body `rmSync` with no `try/finally`, so
  they leak temp directories on failure (~100 stale ones cleared). `review.test.ts`'s `withProject` is the
  pattern to adopt.

Task 11: complete (commits f6a3238..c137a22, review clean after 1 fix round). 1003 tests.
Verified independently against this repo's own corpus: **39 items, 0 load errors, 0 findings.**

**The most useful finding of this plan, and it is about the design rather than the code: the doctor does
not check for the things that actually broke.** Asked whether the five specified checks would have caught
the four real defects this plan found by *running* the product, the implementer traced each to its fixing
commit and reported: none. The reviewer then constructed all four in a real workspace and confirmed it.
Most are legitimately out of scope — item checksums are `loadLayer`'s job and a user does see those.
**But one is a genuine hole nobody flagged**: a session file whose internal id disagrees with its filename
is undetected *anywhere*. `listSessions` keys applied-log lines off the parsed id, so a mismatched header
silently loses its applied records, and the code that skips it comments "a corrupt session file is working
state, not knowledge." Doctor never opens `.my_context/ingest/`. **Carried to Tasks 12/15 as a candidate
sixth check.**

**The flagship check fired wrongly on the maintainers' own corpus.** `runChecks` against `.my_context/`
returned exactly one finding — `scope glob ".my_context/**" matches no file in the repository` — on an
item the maintainers authored. False: the directory is full of files and the glob activates normally. The
walker's `SKIP_DIRS` excluded `.my_context`, and the check read absence-from-that-list as nonexistence.
The same would hit any scope into `dist/`, `coverage/`, `venv/`. Fixed with a separate `SCOPE_SKIP_DIRS`.

**Seven mutants survived, and four were the same shape:** `level` was unasserted on four of the eight
finding codes — while **Task 12 gates its exit code on `level`** and Task 15 folds it into `status`, so an
unpinned level here is an unpinned exit code two tasks downstream. And **a whole check could be deleted
from `runChecks` with the suite green**, which in a diagnostic module is the worst available defect: a
doctor that always says healthy.

**Two of the implementer's four explanations were wrong**, and the correction is instructive: duplicate ids
*are* caught by `loadLayer`, and the sixth check it proposed **could never fire**, because `loadLayer`
removes the duplicate before the `Item[]` the check would scan exists. Not expanding scope was still the
right call — for a different reason than given.

Also fixed: `index_not_ignored` did literal line equality while its message claimed a gitignore-semantics
fact, so `.index.db*` — **the spelling `pre-tool-use.ts` itself uses** — false-positived; the per-document
chunk cache was untested, and keying it by a constant passed the whole suite, silently checking every
item's provenance against the first document; and `not_writable` turned out testable via an injected
`access` seam, where "not portably forceable on Windows" was true but "therefore untestable" was not.

**Open:** `checkIndexFreshness` cannot see global-layer edits, since its signature carries no global root,
though the finding's absence reads as "the index is fresh". And a risk handed to Task 12: if the command
passes only project-layer items, `checkOrphanRelations` will false-fire on every cross-layer relation while
asserting the target does not exist.

Task 12: complete (commits 5301344..364ac8e, review clean after 1 fix round). 1036 tests.
`mycontext doctor` verified clean against this repo's own corpus at exit 0. Exit-code mapping is sound and
genuinely pinned per level, which is what makes Task 11's `level` field matter.

**The scope expansion was accepted**: the implementer added the sixth check (`checkSessionIdMismatch`) that
Task 11 deferred by name, closing the one real gap of the four defects — and it fires exactly on the fault
and stays silent on matching ids, corrupt JSON, JSON with no `id`, an empty `.ingest/`, and stray `.tmp-`
files.

**🔴 But the check it added told the user to do something that destroys their data — the sharpest instance
of this project's recurring defect, and the first where following the text causes harm rather than merely
misleading.** Measured: the message claimed the file's applied records "are being silently skipped on every
resume" — **false**, resume reads them correctly because the log is keyed off the *filename*. What actually
breaks is the **save**, which writes a duplicate session under the bogus id and makes `listSessions`
double-count. And the remediation said *"rename the file to match its id"*, which the reviewer followed
literally: `applied keys = []` afterwards and the next ingest **re-extracted the whole document**. The check
correctly detected a real problem and then walked the user into the exact loss it warned about.
Fixed, and the fix was verified the same way — following the new advice end to end leaves the applied
records intact with no re-extraction.

**A refusal was disproven for the second time in this plan.** The implementer declined to test cross-layer
behaviour because it would not write into a real home directory — right instinct — and concluded it was
therefore untestable. **Task 10's implementer made the identical claim and a reviewer disproved it then**:
`CommandDef.run(ws, …)` takes a `Workspace` directly, so a test can inject `globalRoot: <tempdir>` and never
touch `homedir()`. The lesson did not propagate, and the untested path had a well-typed mutant that survived.
**Same failure mode as the exit-code and preview-guard repeats: a lesson learned in one task does not reach
the next, because nothing carries it but attention.** That is what this ledger is for.

Also fixed: an **error-level** false positive on any stray `.json` in `.ingest/` with a string `id`, because
the check did not gate on `protocol` while claiming to be "the same shape as `listSessions` itself" — the
same class as Task 11's `dead_scope` false positive, on a command whose exit code gates CI.

Task 13: complete (commits afea5d6..c03afe1, review clean after 1 fix round). 1073 tests.

**The most concrete demonstration in this plan: the decay report, run against this repo's own knowledge
base, recommended deleting 25 items — including `CONST-zero-runtime-dependencies` and
`RULE-erasable-syntax-only`, which CI enforces on that very branch.**
The mechanism was subtle. The report *did* carry a caveat saying "cold mostly means new" — but it was gated
on `sessionsRecorded < window`, so the honesty was **switched off exactly when the ledger looked mature and
the user was most likely to trust the list**. A correct, scoped item created yesterday, against a
30-session ledger, ranked *first* under "candidates for supersession", indistinguishable from something
nobody had needed in a year.
Underneath is a real epistemic gap the implementer identified correctly and completely: **the ledger records
injection, not use.** It cannot see an item read via `show`, via MCP `get_item`, or by opening the Markdown
— all of which look identical to abandoned. It was right to flag that and **wrong to conclude the fix was
out of scope**: it was three lines of report copy in the file this task owns. The hedge is now
unconditional and the heading says "check before acting" rather than "candidates for supersession".

**Also fixed:** `cold: none — every scoped item activated inside the window.` was printed on a corpus with
zero scoped items and an empty ledger, where nothing activated at all — occurrence #20, and untested (the
mutant replacing that string with "bananas" survived). The `--sessions` flag had **no behavioural test**:
ignoring the window entirely by calling `recentSessions(9999)` left the suite green, on the report's
central parameter. And `useCount`/`lastUsed` rendering was unasserted — the two numbers a human weighs
before deleting knowledge.

**🟢 A DEFECT CLASS WAS RETIRED STRUCTURALLY.** The F2 exit-code rule — only `status` and `doctor` exit
non-zero on unrelated corpus load errors — had now been violated in **five separate tasks**, because it
lived only in a prose doc comment plus four hand-written per-command copies, and each new brief re-derived
it wrongly. `test/cli/f2-registry.test.ts` now iterates the **real `COMMANDS` registry**, plants one corrupt
item, and asserts exit 0 for every registered command except an explicit `status`/`doctor` allowlist. That
retires the class for Tasks 14, 15, 16 and everything after — **the structural fix I should have asked for
three tasks earlier.** The guard initially had its own blind spot (its `decay` fixture only exercised the
already-correct empty-report branch), which the implementer found and closed by mutation testing.

Task 14: complete (commits 0284629..78f6453, review clean after 1 fix round). 1096 tests.

**The security result holds: no write reached the index.** 18 engine-level and 14 full-stack attacks with
row counts verified before and after each — `DELETE`/`INSERT`/`UPDATE`/`DROP`/`CREATE`/`ALTER`/`REPLACE`,
`RETURNING`, `CREATE TRIGGER`, `sqlite_master` edits after `PRAGMA writable_schema=1`, `ATTACH` to a new
file, `sqlite_dbpage`, CTE-embedded DML — all stopped, nothing changed. Parser evasion via backtick and
`[bracket]` identifiers, nested comments, leading comments, U+00A0, and semicolons hidden in literals all
failed safely. Removing `readOnly: true` is killed by its own test.

**🔴 But the code's comments had the guarantee backwards, and it was demonstrable.**
`VACUUM INTO '<any path>'` **succeeds** on `new DatabaseSync(file, { readOnly: true })` and writes a full
copy of the database to an attacker-chosen path. So `readOnly` prevents modification **of the opened
database**, not all writes — and the only thing stopping that statement through the CLI is
`assertSelectOnly`'s prefix check. **For that one statement the "UX guard" is the security boundary and the
engine is not**, the exact opposite of what both comments asserted, in the one place the claim is
security-relevant. Fixed, with a test pinning `VACUUM INTO` specifically — the pre-existing `VACUUM` case
was caught by the prefix check and never reached the denylist.

**The most obvious query on this surface returned an answer the Markdown contradicts.** `updated_at` was
advertised as queryable, but `cmdQuery` rebuilds on every invocation and `rebuild` does `deleteByLayer` +
fresh `upsert`, so the column is stamped with **the time you ran the query**. Two items created 1.5 s apart
showed identical values; re-running the same query 1.5 s later advanced every row. `ORDER BY updated_at
DESC` is meaningless. Annotated, and `has_scope` — a real column the hint omitted — added.

**The WAL comment asserted engine behaviour that does not hold**, and the implementer reported the
non-reproduction honestly rather than restating the brief. The reviewer confirmed and went further: a
read-only open against a **live** `-wal` returned correct non-stale data, and against an **orphaned** `-wal`
it **recovered the WAL and returned rows that existed only there**. The rebuild → close → read-only-open
ordering stays — it is the only reason results are current — but the comment justifying it was false, which
is exactly how a load-bearing "do not reorder" instruction gets discarded by the next reader who tests it.

Also fixed: `query` **swallowed** corpus load errors — it discarded `rebuild`'s `{ errors }` and never
called `emitLoadErrors`, so the F2 rule ("reports **and** exits 0") was half-satisfied, and the new registry
guard passed vacuously because it only asserted the exit code. **The guard now asserts the error is
emitted**, closing a hole that would otherwise have let this class through undetected. And 17 of 19 denylist
entries could be deleted with the suite green, because every test case *started with* its forbidden keyword
so the prefix check fired first and the keyword scan was never reached.

**Task 14 follow-ups (recorded, not fixed):** an unbounded result is worse than flagged — a 300-item corpus
with a plausible missing-join typo ran ~50 s and then **aborted the process with `FATAL ERROR: Reached heap
limit`** and a full V8 native stack trace, in a suite containing a test that SQL errors are reported
*without* a stack trace. `writer.close()`'s ordering is pinned only incidentally and only on Windows, where
`rmSync` fails `EPERM` on the leaked handle — the same trap `store.ts`'s own comment documents. Deleting
`cmdQuery`'s `rebuild()` call entirely **survives**, because the fixture creates items through
`runCli(['add'])` which populates the index itself. SQL beginning with `--` is eaten by the flag parser.

Task 15: complete (commits d9b23bd..1aab563, review clean after 1 fix round). 1120 tests.
**All fifteen of the plan's tasks are done.** `status` and `doctor` now agree on this repo's corpus.

**A dashboard is where an unsupported claim does the most damage, and three numbers here contradicted the
commands they named:**
- `review queue: 1 draft(s) pending — walk it with mycontext review` → running `review` said **"no drafts
  pending review"**. `status` counted the merged project+global corpus; `review` deliberately excludes
  global-layer drafts, with a comment in that very file calling listing them "its own silent-wrongness
  trap". `review.ts` already **exported** the correct helper; the brief's Interfaces list omitted it and the
  filter was re-derived wrongly.
- `health: 0 error(s), 1 warning(s) — details from mycontext doctor` → `doctor`, run immediately after,
  reported **zero findings**. `runChecks` ran before `store.close()`, so the WAL had not checkpointed and
  the index mtime was still older than the item files — warning about a staleness `status`'s own rebuild
  had just eliminated. A number that appears, tells you to go look, and is gone when you get there.
- `not injected in the last 20 session(s)` — asserted over a ledger holding **one**. `decay.ts` prints an
  unconditional hedge for exactly this; `status` dropped the hedge and kept the 20, though `DecayReport`
  separates `window` from `sessionsRecorded` precisely so a renderer can tell them apart.
- And a fourth by omission: `status` printed `health: 1 error(s)` and **exited 0** while `doctor` exited 1
  on the same corpus — on one of only two commands permitted to fail CI.

**Five mutants survived, including the always-zero one** — hardcoding the cold-item count to `0` left the
suite green. Two structural gaps explained it: **nothing drove `status` with a populated ledger**, so the
branch a real user sees had zero coverage, and nothing drove a *partially*-applied ingest session, so the
progress number was pinned at a value equal to its own mutant.

**🔴 ROUTED TO TASK 16 — the user's standing output requirement is unmet.** No `--full`/`--short`/
`--summary`, no `--json`, no column headers, and hierarchical data (ingest sessions with per-anchor
progress, staged candidates grouped by lesson) flattened into ad-hoc `padEnd` columns that collide on ids
this repo already has (63 characters). The brief specified none of it and the implementer flagged the gap
honestly rather than silently under-delivering. `query --json` shows the pattern already exists.

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


---

## Final whole-branch review (BASE `b05690e`, fix round `66124ba..5ebef08`)

**1176 tests → 1359, all green; `tsc --noEmit` clean.** Six Criticals, fourteen Importants and
the cheap Minors fixed across eight commits. Six subagents on disjoint file sets, with the
cross-cutting documentation held by the lead.

### The six Criticals, and what they have in common

**Four of the six were this project's characteristic defect — a claim the code does not have —
and every one of them sat at a seam no single task owned.** That is the new information. The
ledger already records ~20 instances *inside* a task's own file; these were different:

- **C3** (draft count disagreeing 6-vs-5 across four surfaces) is the defect Task 15 fixed **in
  `status` only**. The other three surfaces — the always-loaded SessionStart banner, the
  `load_context` tool, and `list_drafts` — were not in Task 15's brief, so they kept the wrong
  filter. `list_drafts` then offered global-layer drafts that `review promote` refused with exit 1.
- **C4** (approval boundary) was written correctly for the three commands Task 9's escalation
  named, and `mycontext add` — which creates an active governing item outright — was never in
  scope for any task, so no document mentioned it. **A test pinned the incomplete statement as
  honest**, which is the sharpest form of this defect: the guard against the claim drifting was
  itself asserting the incomplete claim.
- **C5** (`SKILL.md` "everything you write lands as a draft") is false for 7 of the 17 enabled
  categories. `capture.md`, `README.md` and `plugin/commands.ts` all branch on tier correctly —
  three files got it right and the always-loaded one did not, because each was written by the
  task that owned it and nothing compared them.
- **C6** (four places instructing hand-editing frontmatter) is the same shape: each site was
  locally reasonable when written, and the write path that recomputes the checksum was built
  later, by a different task, which made all four false at once and told nobody.

C1 and C2 are ordinary defects, both at the write boundary, both silent.

**The generalisation worth carrying: a lesson landing in one file does not propagate to the next
file that needs it, and this ledger's own Task 12 entry says so — but the corollary was missed.
When a task fixes a fact that is stated in N places, the fix must be to make there be ONE place,
not to fix the instance the brief named.** Every C3/C5 fix in this round is an extraction to a
single definition plus a test that fails if a call site stops using it.

### Rulings

- **C1 — fix by exclusive create, not by a lock.** `writeItem` has one caller (`persist`) reached
  by ten paths, eight of which never take the ingest apply lock; and that lock is already held
  around `applyCandidates`, which calls `createItem`, so reusing it deadlocks ingest. The
  exclusive create reuses `lock.ts`'s proven `linkSync`-a-written-temp-file construction *with*
  its hard-links fallback. On `EEXIST`, `createItem` re-reads from **disk**, never `ctx.store` —
  the store's staleness is the entire bug. *Measured: 0/8 with the fix reverted, 8/8 with it.*
- **C2 — normalize in `validateObservations`, keeping validate-before-collapse.** The ordering is
  load-bearing: a line break must stay a rejection, and a collapse running first erases it into a
  space. `context` is trimmed but not interior-collapsed, because `parseObservations` does not
  collapse it — checked rather than assumed.
- **C2 — refuse `__proto__`; do NOT refuse `constructor`/`prototype`.** All three were tested by
  execution; only `__proto__` fails to round-trip, and a test now pins that the other two stay
  accepted.
- **C3 — the one helper lives in `core/select.ts`.** It is pure, and `core` is the only layer both
  `src/mcp` and `src/cli` already depend on. The layer filter is documented as part of the
  *definition* of the queue.
- **C6 — ship `mycontext repair`, and do NOT name it in `updateItem`'s refusals.** `repair`
  re-stamps a checksum after a deliberate hand edit; it does not change `scope`/`always`/
  `severity`/`status`, so naming it there would imply hand-editing is the sanctioned route for a
  change it cannot make. **Verified: there is genuinely no CLI or MCP route today for a human to
  change those fields on an already-*governing* item** — `review promote` acts only on drafts and
  every MCP write hardcodes a non-human origin — so the messages now say that plainly instead of
  inventing a route. Recorded as a follow-up below.
- **`repair` re-stamps; it does not repair.** It states so, because commit `d7f75a1` shows an item
  that was internally self-consistent with only a stale checksum as evidence of truncation — i.e.
  `repair` would have blessed the lost text.
- **I1 — support `--body`/`--scope`/`--tags` on `add` rather than refuse them.** Plumbing into a
  `createItem` that already takes all three, and it is what lets C6 remove the hand-edit
  instruction without leaving a hole. The ledger records the gap as a dogfooding finding twice.
- **I7 — refuse corrupt staging and name the file; deliberately no `--force`.** The staging file
  is the only record of which candidates a human already accepted or discarded, and Task 9's
  escalation records the whole sequence as Bash-reachable. A flag meaning "discard the record of
  prior human rulings" is exactly the affordance that must not exist there.
- **I8 — recover the applied log independently of the header; refuse when it cannot be
  reconciled.** The log is keyed off the *filename* by Task 3's deliberate design, so the header
  is not its authority. Sound only because the session id embeds a checksum of the exact document,
  which is now checked. Doubles as the protocol-migration path.
- **I10 — the anchor stays applied in the mixed case; rejections go in `<id>.rejected.jsonl`.**
  Un-applying would push the chunk back through extraction, where a reworded re-extraction retires
  the drafts that same call created. They could not go in the applied log: `foldApplied` treats the
  presence of a line as "applied", so recording a failure there would mark the chunk done *because*
  it failed. The all-failed case is unchanged (still pending, per Task 4) and now records why.
- **I12 — the code was right about detail levels, the README right about `--json`.** A SQL result
  set has no less-detailed rendering; its columns come from the caller's own `SELECT`. But the
  trailing bare error line broke `JSON.parse` exactly when a consumer most needs it.
- **I14 — pid-authoritative staleness plus a per-acquisition nonce.** A heartbeat is not
  implementable: the critical section is synchronous and `sleepMs` blocks the thread, so no timer
  can fire to refresh the mtime.

### Measurements worth keeping

- **The pre-existing lock suite was a 0/8 detector for both defects I14 fixes.** Not a weak
  detector — a zero one. Task 6's rule (report a pass rate, never a single red/green) is what
  caught it, and it should now be read as applying to *existing* suites, not only new ones.
- **The C1 concurrency test was a 5-of-8 detector in its first form.** A wall-clock rendezvous
  barrier and four rounds were needed; deterministic stale-store tests were then added so the
  guarantee does not rest on timing at all.
- **A mutation result read against a red suite is worthless.** The lead's first documentation
  mutation run reported 10/10 killed while the suite was already failing for an unrelated reason.
  Re-run against green, 2 of those 10 survived and both guards were genuinely weak. **Confirm the
  suite is green before believing a "killed".**
- **One of the lead's own assertions was vacuous on delivery** — it matched an alternation of
  literal field names against a site that interpolates `${field}`, so it matched neither of the
  two sites it guarded. Mutation testing is the only reason it is not instance twenty-one.
- Final lead mutation run: **22/22 killed**, including one that re-introduces the C6 defect.

### Corrections to the review's own findings

- **"Test temp dirs leak on success" is wrong.** Measured: a green run of `test/cli/lesson.test.ts`
  leaked **0**. One *red* run leaked **15**, which is where the number came from — every cleanup
  was a bare end-of-body `rmSync` with no `try/finally`. Fixed, and the fixed file leaks 0 on a
  deliberately-red run.
- **`OPENQ-how-do-filters-respect-dependencies` is not currently truncated.** Commit `d7f75a1`
  already repaired it; all 39 project items verify clean. The underlying point stands and is now
  verified rather than assumed.
- **`doctor`'s checksum message does not accuse the user.** It says an edit outside my_context is
  *one* cause and that content may already have been lost. The lead's first draft of the corrected
  docs restated the review's harsher framing and was itself corrected by execution.

### Follow-ups — left unfixed, with file and line

1. **CORRECTED — the seal was on the code paths, not on the system.** What this entry said, and
   what the round's own ruling said, was "there is genuinely no route today for a human to change
   `scope`/`always`/`severity`/`status` on an already-governing item". **The premise is true and
   the conclusion is false, and the difference matters because three shipped documents were
   written from the conclusion.** The premise: no CLI or MCP *command* makes that change —
   `review promote` acts only on drafts (`src/cli/commands/review.ts`), every MCP write hardcodes
   a non-human origin (`src/mcp/tools.ts`), and `updateItem`'s two guards refuse it. That seal
   held then and holds now. The conclusion assumed the only alternative — a hand edit — was
   self-defeating, because it left the item failing its own recorded checksum: `doctor` exit 1
   forever, `rebuild` never re-stamping it.
   **`mycontext repair`, shipped in the same round, removes that consequence.** Verified by
   execution and now pinned by `test/cli/repair.test.ts`: hand-edit `always:`/`severity:` on a
   *governing* item, run `repair --yes`, and you get `always: false→true`, `severity: soft→hard`,
   `doctor` exit 0, and the item moves from a one-line index entry to injected in full at every
   session start — **with no evidence left that it happened**. So the honest statement is:
   *no command performs this change, and hand edit + `repair` is a working human route with no
   audit trail.* `repair` is now on `SKILL.md`'s gate list and in the README's deny list, and
   both `updateItem` refusals name the pairing while forbidding the non-human caller reading them
   from taking it.
   **The generalisable error, and it is a new shape for this ledger:** the four Criticals of the
   previous round were claims a *file* did not have. This one was a claim the *system* did not
   have, inferred correctly from a real, verified property of the code paths — and invalidated by
   a command the same round added, at a seam neither half was looking at. Verifying "no code path
   does X" does not establish "X cannot be reached"; it establishes exactly what it says.
2. **The reused-pid lock wedge.** `src/ingest/lock.ts` — a crashed holder whose pid the OS reuses
   wedges the lock with no automatic recovery. No portable dependency-free discriminator was found
   (process start time would work but needs a platform-specific call). Mitigated only by the
   timeout message, which now names path, pid and age.
3. **The MCP path rebuilds OUTSIDE the apply lock while the CLI rebuilds inside it.**
   `src/mcp/tools.ts:187-213` (`withWorkspace`) vs `src/cli/commands/ingest.ts:141`. Carried from
   Task 7. Fixing it means touching `withWorkspace`, shared by all eleven tools.
   **Non-blocking, and the reason was left unstated — recorded now, because "non-blocking" with
   no reason is indistinguishable from "not thought about".** The MCP path *does* take the apply
   lock; it is not unprotected. What differs is the ORDER: it rebuilds before acquiring, so the
   store it hands `applyCandidates` can be stale by the width of the wait for the lock. What
   makes that survivable is C1's exclusive create — `createItem` writes with `linkSync`/`wx` and
   re-reads from **disk** on `EEXIST`, never from `ctx.store`, so a stale store can no longer turn
   into a silent overwrite. It costs a retry, not data. Both facts together are the reason this is
   a follow-up rather than a blocker; either alone is not.
4. **No concurrency test touches the MCP entry point.** `test/mcp/ingest-tool.test.ts` has no
   `spawn` and no race. Carried from Task 7, still true. Non-blocking for the same reason as #3
   and only for that reason: the guarantee that survives the untested ordering is C1's, which
   *is* tested (`test/core/write-exclusive.test.ts`, `test/core/create-concurrency.test.ts`).
5. **The `openSync('wx')` fallback shared by `writeItem` and `acquireApplyLock` is exercised only
   via a monkeypatched `fs.linkSync`/`fs.writeSync`**, never on a real filesystem lacking hard
   links (`src/core/rebuild.ts`, `src/ingest/lock.ts`). **Widened this round.** What that entry
   described — a brief window in which the target exists and is empty, reasoned from the
   two-syscall structure — was only half of it. The other half was PERSISTENT: a `writeSync` that
   fails leaves the zero-byte file on disk for good. For an item that burns the id (every later
   create gets `EEXIST`, re-reads an unparseable empty file, and blames a concurrent process for a
   local failure); for the lock it wedges every acquirer for the full five-minute `LOCK_STALE_MS`
   backstop. `lock.ts` additionally leaked the descriptor on both its write paths, inside a
   function that loops until `LOCK_TIMEOUT_MS`. Both are fixed and both are now tested through the
   monkeypatch seam; what remains unobserved is the same thing as before — the behaviour on a real
   hard-link-less filesystem — plus the case where the best-effort cleanup itself fails, which the
   doc comments now state rather than imply away.
6. **`LESSON_ID_RE` character-class widening survives** beyond path separators (`src/lesson/derive.ts`).
   Four entry points kill separator widening; widening to e.g. `+` does not. Judged non-load-bearing.
7. **Two identical candidates in one `lesson-stage` payload share a key** (`src/lesson/derive.ts:322-337`).
   Fails closed — the second accept reports "already accepted" — so left as-is.
8. **The rejection dedupe collapses two identical rejections sharing an `at` timestamp**
   (`src/ingest/session.ts`). The count is short by one; the fact is not lost. Documented in code.
9. **`lesson-stage`'s output format is coupled to three test files' regexes**
   (`test/cli/e2e.test.ts:98`, `test/cli/f2-registry.test.ts:68`, `test/cli/status.test.ts:187`)
   via `/^\s{2}([0-9a-f]{8})\s/`. The two-space indent is also the `decay`/`status` convention, so
   it is not a compromise, but it is a coupling.
10. **`query`'s row cap changes one observable behaviour**: with duplicate output column names the
    wrapped form returns `id` and `id:1` where the bare form silently collapsed them to one key
    (`src/cli/commands/query.ts`). The wrap surfaces a column the old form dropped.
11. **A subagent overwrote a peer's untracked scratch file** (`probe-tmp-p1.ts`) in the shared
    worktree; contents unrecoverable. Parallel agents in one worktree need namespaced scratch paths.

### Dogfooding pass (S1)

Run against this repo's own `.my_context/`: **39 items, 0 drafts, `doctor` 0/0/0 exit 0**,
`repair` correctly reports nothing to re-stamp, `add` without `--yes` refuses at exit 1 and writes
nothing, `list --ful` is refused instead of silently listing everything, and `query` capped a real
59,319-row cartesian in 0 ms with a loud truncation notice. No new friction found; the friction the
ledger recorded twice — `add` unable to express body/scope/tags — is closed by I1.
