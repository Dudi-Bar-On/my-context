# SDD ledger — plan: docs/superpowers/plans/2026-08-17-my-context-test-campaign.md

Branch: campaign/my-context-test
Base: dbcf6ab (docs: implementation plan for the my-context test campaign)

Isolation note: a git worktree was NOT used. The harness resolves the plugin
under test as <repo-root>/my-context, a gitignored clone that exists only in
this checkout; a worktree would not contain it and every task would fail at
workspace creation. A branch on the same checkout is the correct isolation here.

Pre-flight scan:
- Case-count "Expected" lines in Tasks 7-13 are informational, not acceptance
  criteria. Acceptance is the per-task verification step (every case produced a
  record). Controller resolution, carried in each dispatch.
- Tasks 17-19 produce Markdown deliverables and have no test cycle by nature.
  Acceptance is evidence-citation, not test coverage. Controller resolution,
  carried in the reviewer constraints block.
- Task 14 ran `git checkout -- commands` in the plugin clone with no guard
  against pre-existing uncommitted work. Fixed in the plan before execution:
  the script now refuses to run if my-context/commands is dirty.

- Claim scope ruling (human): Task 16 verifies ALL ~180 extracted claims; ones the harness cannot settle are UNVERIFIED with a reason, never upgraded to PASS.

Task 1: review 1 — spec ✅; quality: 1 Critical, 1 Important, 1 Minor.
  Critical: destroyWorkspace guard `dir.startsWith(SCRATCH)` is a bare string
  prefix with no separator boundary and no path resolution — a sibling like
  `<SCRATCH>-backup` passes, and unresolved `..` segments pass the text check
  while fs.rm resolves them at the OS level.
  Controller ruling: NOT a plan contradiction. The plan's own error string
  reads "refusing to remove a path outside SCRATCH" — the finding says the
  code fails to deliver what the plan declares, so fixing it fulfils the plan
  rather than overriding it. No human ruling sought; fix dispatched.
  The plan's Task 1 snippet is superseded by this fix.
Task 1: fix round 1/5 (2 addressed, 0 open — guard hardened + negative test; commits 3872faf..0972da9)
Task 1: complete (commits 6f3bd2f..0972da9, review clean)

Task 2: review 1 — spec ✅; quality approved with 1 Important, 3 Minor.
  Important: runCli leaves the child's stdin an open pipe and has no timeout,
  so a command that blocks on stdin never resolves and hangs the whole sweep.
  Concrete risk: Task 10's `ingest-apply --stdin` and `lesson-stage --stdin`
  cases pass --stdin but the harness never writes or closes it. Those cases
  would hang, not fail. Fix dispatched.
Task 2: minor (deferred): chunked Buffer->string via += can split a multi-byte
  character across a chunk boundary; low risk while MYCONTEXT_ASCII=1 is pinned.
Task 2: minor (deferred): no cap on captured output size.
Task 2: minor (deferred): implementer reported "Concerns: None" while the
  stdin/hang risk was present — self-assessment completeness, not correctness.
Task 2: fix round 1/5 (1 addressed, 0 open — stdin closed + timedOut field + covering test; commits f14d53c..9a4eaa6)
Task 2: complete (commits 0972da9..9a4eaa6, review clean)

Task 3: review 1 — spec ✅ (Windows EBUSY deviation judged sound and correctly
  scoped); quality: 2 Important, 2 Minor.
  Important A: request() has no timeout — a never-answered id hangs listTools/
  callTool/initialize forever. Same hang class Task 2 had to fix.
  Important B: no 'error' listener on child or child.stdin — a dead child makes
  the next stdin.write() emit an unhandled 'error', crashing the whole process
  and aborting all 54 MCP cases rather than failing one.
  Fix dispatched (both, plus the untested JSON-RPC error path).
Task 3: minor (deferred): close()'s wait for 'exit' has no bounded fallback.
Task 3: minor (deferred): close() exit-wait not stress-tested across 54
  sequential cases.

FOR TASK 17 (FINDINGS.md) — coexistence analysis, prompted by a user question.
  Measured hook latency on this machine (Node cold-spawn each time, n=5 median):
    session-start 139ms | pre-tool-use 126ms | post-tool-use 91ms | pre-compact 109ms
    bare `node -e 0` floor = 42ms, so my-context's own work is ~50-100ms.
  Conclusion: my-context COEXISTS with other hook-using plugins — injections are
  additive, denies are independent. We disabled the others for ATTRIBUTION, not
  compatibility: gsd-read-guard.js injects on the same PreToolUse/Write|Edit event,
  making "what did my-context inject" unmeasurable.
  Real coexistence costs worth documenting for the author:
   1. Latency stacking — with GSD active, every Write/Edit fired ~4 PreToolUse
      spawns plus ~3 PostToolUse spawns.
   2. Budget is local, not global — my-context budgets its own injection
      (6000/6000/8000/1200) but cannot see what other plugins inject. Two
      well-behaved plugins can still blow the window together.
   3. Deny precedence — if another plugin denies a write into .my_context/ first,
      my-context's specific deny message never reaches the user.
  Candidate to TEST in Task 15 (live pass): whether the hook schema's `if:` field
  (permission-rule syntax) can narrow PostToolUse to watchedDocs globs and avoid
  the spawn entirely on non-matching writes. Unverified — do not assert until tested.
Task 3: fix round 1/5 (3 addressed, 0 open — request timeout, child/stdin error
  listeners, pending drained on exit, 2 new tests; commits 24e291b..b1dd2fa)
Task 3: complete (commits 9a4eaa6..b1dd2fa, review clean)

CONTROLLER NOTE carried into Task 4+: three consecutive modules needed the same
class of fix — the harness assumed the plugin under test behaves well (no
timeout, no error listener, unclosed stdin). That assumption is backwards for a
campaign whose purpose is finding misbehaviour. Task 4's dispatch now REQUIRES
the guards up front rather than waiting for its reviewer to find them.

Task 4: review 1 — spec ✅ (empty-corpus deviation independently verified correct
  by tracing inject.ts/render.ts: zero items => renderSelection returns ''), 
  quality: 3 Important, 2 Minor.
  Important 1: empty-corpus behaviour recorded in prose only, not pinned by a test.
  Important 2: timedOut/childError structurally present but no test exercises either.
  Important 3: CONTROLLER-INTRODUCED. My requirement said record 'error' rather
  than throw (mirroring mcp.mjs), but mcp.mjs settles via per-request timeouts
  while run.mjs settles by rejecting on 'error'. hooks.mjs resolves only on
  'close', so an OS-level spawn failure records the error and then hangs forever
  — the 30s timer flips timedOut and calls kill() on a process that never
  started, and nothing resolves. I recombined two safe patterns into an unsafe
  one. Fix dispatched.
Task 4: minor (deferred): stale comment about relative path resolution; script is
  always absolute.
Task 4: minor (deferred): runHook without {cwd} would set CLAUDE_PROJECT_DIR
  undefined; unreachable from current call sites.
Task 4: fix round 1/5 (4 addressed, 0 open — finish() as sole resolver reachable
  from close/child-error/stdin-error/timeout, double-settle guard, 3 new tests,
  stale comment removed; commits aaee979..f49c6e8)
Task 4: complete (commits b1dd2fa..f49c6e8, review clean)
  Behavioural fact now pinned by test: session-start emits stdout === '' on a
  corpus with zero items. Feeds Task 12's session-start-empty-corpus case and
  Task 16's claim audit.

Task 5: review 1 — spec ✅; quality: 1 Critical, 2 Important, 3 Minor.
  Critical: load() throws on the first malformed line, rejecting the whole call.
  record() calls load() internally, so ONE truncated final line (run killed
  mid-appendFile) permanently blocks every future record() AND load() for that
  surface — destroying access to all prior evidence, not just the bad record.
  Important A: `{id, surface, caseId, ...data}` spreads data LAST, so a payload
  key named id/surface/caseId silently overwrites the lookup key — the stored id
  would stop matching the id findings cite.
  Important B: read-then-append duplicate check has no serialization.
  Fix dispatched (all three + a realistic-payload test).
Task 5: minor (deferred): lone UTF-16 surrogates from raw CLI output become
  U+FFFD on the UTF-8 write path — fidelity loss, not corruption.
Task 5: minor (deferred): existsSync + async readFile TOCTOU gap, harmless here.
Task 5: fix round 1/5 (4 addressed, 0 open — tolerant load with stderr report,
  key order reversed, per-surface serialization verified empirically by the
  re-reviewer with a concurrent duplicate script; commits 07e5f7c..8f91009)
Task 5: complete (commits f49c6e8..8f91009, review clean)
  Accepted limitation for TASK 18 (COVERAGE.md): load()'s return value cannot
  distinguish "3 good, 0 bad" from "3 good, 40 bad" — only stderr does. The
  per-sweep verification steps (record count == case count) are what catch a
  silent evidence loss; keep them.

Task 6: review 1 — spec ✅ (baseline pin verified 11/11, KNOWN_RED NOT widened);
  quality: 1 Critical, 1 Important, 2 Minor.
  Critical: runOne returns from inside try while destroyWorkspace runs in
  finally. Per JS semantics a throw in finally REPLACES the pending return, so a
  Windows EBUSY cleanup failure discards the case's real result and runTable
  records a misleading harnessError instead. Symptom already observed: 3 leaked
  workspaces + reproduced EBUSY. Contradicts the code's own comment ("A harness
  crash is itself evidence — never swallow it").
  Important: setup argv results are discarded and runCli resolves regardless of
  exit code, so a failed precondition leaves no trace and the case silently runs
  against the wrong state.
  Both verbatim from my brief. Fix dispatched.
Task 6: minor (deferred): kase.env used in the cli branch but absent from the
  declared Case shape.
Task 6: minor (deferred): DEP0190 shell-deprecation noise on Windows, cosmetic.

PLUGIN BEHAVIOUR RECORDED (for Task 16): `mycontext list <category>` at default
  detail prints a table of id/type/status with NO title column; only --full
  renders the title. Verified against my-context/src/cli/index.ts:596-623.
Task 6: fix round 1/5 (3 addressed, 0 open — cleanup isolated in nested try/catch
  so a cleanup throw can never reach runTable's catch; body error correctly wins
  when both fail; setupFailures recorded; all three runOne branches now tested;
  commits 5503fdc..e79473c)
Task 6: complete (commits 8f91009..e79473c, review clean)

=== HARNESS COMPLETE (Tasks 1-6). 22/22 self-tests. Baseline pin verified. ===
Every one of the six modules needed exactly one fix round, and every defect was
in code my plan specified verbatim. Recurring root cause: the harness assumed the
plugin under test would behave well. Worst was Task 6's finally-replaces-return,
which would have silently swapped real case results for fake harness crashes.

Task 7: review 1 — spec ✅ (case table byte-identical to brief; the "56" was MY
  miscount in the brief's prose — its own array has 57 entries). 1 Critical,
  1 Important, 1 Minor + 8 evidence discrepancies.
  Critical: cli-capture/init-bare is an ARTIFACT. createWorkspace() runs
  `mycontext init` before every case, so this case re-inits an initialised dir
  and records "already exists" (exit 1) against a note claiming "exit 0, creates
  .my_context". Fix dispatched.
  CONTROLLER CHECK: I verified the artifact does NOT contaminate init-global-
  refused or init-unknown-arg — both record argument-refusal text, not the
  already-exists path. Headline finding stands.

FINDINGS FOR TASK 17 (each with evidence id, from Task 7 evidence):
  D1 cli-capture/init-unknown-arg — `init` REFUSES an unknown flag, saying
     "an argument this command cannot act on is refused rather than ignored",
     while README:2841 lists init among commands where "a flag those do not
     know is ignored without a word." Plugin's own wording contradicts the doc.
  D2 cli-capture/add-yes-false — `--yes=false` and omitting --yes entirely
     produce byte-identical refusals telling the user to "Rerun with --yes",
     which is misleading when --yes=false was explicitly supplied.
  D3 cli-capture/{add-unknown-category,list-unknown-category,examples-unknown}
     — same invalid-category rule, three presentations: field named "type" vs
     "category", tier-grouped vs alphabetical ordering, and only two of the
     three end with the mycontext_help suggestion.
  D4 cli-capture/rebuild-with-args-dropped — `rebuild` silently accepts an
     unknown flag (exit 0) like `show`, but unlike init/add/status. Undocumented
     membership of the "does not check" class.
  D5 cli-capture/{help-query-refused,help-config-refused} — both refusals end
     with the identical hardcoded trailer 'See mycontext_help("workflow")',
     unrelated to the topic actually rejected.
  D6 Several CLI-surface errors suggest the MCP form mycontext_help("categories")
     rather than the CLI form `mycontext help categories` a terminal user typed.
  D7 cli-capture/list-short is byte-identical to cli-capture/list-bare — consistent
     with default detail being "short", but means only 2 of 3 advertised detail
     levels are visibly distinct here. Confirm against README in Task 16.
Task 7: fix round 1/5 (3 addressed, 0 open — pristine workspace option, init split
  into pristine/initialised with accurate notes, 3 readback cases, evidence
  regenerated 61 records; doctor-quiet gap honestly declared; commits 0331e94..2d6e8cf)
Task 7: complete (commits e79473c..2d6e8cf, review clean) — 61 records
  VERIFIED-CORRECT CLAIMS (for COVERAGE.md, these count as much as failures):
   - README:1926 comma vs repeated --scope produce byte-identical stored state
     (same checksum 70715f966872a352). evidence: cli-capture/add-scope-*-readback
   - one observation stored per --note occurrence. evidence:
     cli-capture/add-note-repeated-readback
   - init on a pristine dir exits 0 and creates the workspace. evidence:
     cli-capture/init-on-pristine-dir
  ACKNOWLEDGED COVERAGE GAP: doctor-quiet-and-full cannot distinguish --quiet
   from --full on a zero-finding workspace. Declared, not silently dropped.

Task 8: controller check BEFORE review — two problems, fix dispatched.
  1. FALSE FINDING CAUGHT. Implementer reported the two `add reference --file
     README.md` setup failures as "a real defect in my-context's reference
     creation with file snapshots". They are not. Workspaces are mkdtemp dirs
     containing only .my_context/, so README.md does not exist there — the
     plugin correctly refused a missing file. Test-design bug, not a plugin
     defect. Must NOT reach FINDINGS.md.
  2. ZERO readback cases despite the dispatch explicitly requiring them for ~13
     mutation cases. The report's central claim ("all mutation commands verified
     working as claimed") is therefore unsupported — the evidence shows only that
     the commands were ACCEPTED, not that any field changed. Task 7's lesson
     repeated verbatim.
  3. HARNESS GAP exposed by (1): setupFailures records stderr but NOT stdout,
     and this plugin writes its error messages to STDOUT. The captured stderr
     held only the ExperimentalWarning, making the failure undiagnosable from
     evidence alone. Fixing in sweep.mjs.
Task 8: fix round 1/5 (4 addressed, 0 open; commits 0dc3300..88e142a) — 61 records
Task 8: re-review evidence hunt produced 13 items. New PLUGIN findings:
  D8 cli-mutate/supersede-missing-by — prints only the bare `usage:` line with NO
     `my_context:` prefix explaining what is wrong, unlike edit-unknown-flag and
     supersede-unknown-flag which both lead with `my_context: unknown option ...`.
     A user who omits a required flag gets LESS help than one who mistypes a flag.
  D9 cli-mutate/{edit,supersede,review-list}-unknown-flag say `unknown option`;
     cli-mutate/repair-unknown-flag says `unknown flag ... for \`repair\``.
     Same error class, different vocabulary across siblings.
  VERIFIED CORRECT: supersede records the relation in BOTH directions
     (supersede-ok-readback-retiring / -replacement); pin->always:true and
     harden->severity:hard genuinely transition state; `review list --type` has
     its own empty-state message rather than silently ignoring the filter;
     "no such id" guidance differs appropriately by surface (edit vs review).
  COVERAGE GAPS to close in fix round 2: unpin/soften read-backs are no-ops (seed
     already at target value, so the write path is unexercised); review promote/
     promote-revision flag cases short-circuit on the missing-id guard before
     flags matter; repair never exercises the re-stamp branch; --yes non-TTY
     gating proven only for `edit`, not the four wrappers.
  REPORT ACCURACY: record-number citations wrong in ~2/3 of the report (caseIds
     are correct; positional numbers are not), and YAML/relation formatting is
     paraphrased rather than quoted. Must cite stable caseIds, not positions.
Task 8: fix round 2/5 (all addressed; commits 88e142a..987c40a) — 69 records
  CLOSED: unpin/soften real write paths (unpin-from-pinned-readback -> always:
    false; soften-from-hard-readback -> severity: soft); repair reaches the
    re-stamp branch; review promote flags verified to land (severity: hard,
    always: true on the promoted draft).
  CONTROLLER CHECK — NOT A FINDING: unpin/soften/refresh -no-yes cases exit 0,
    which looked like a --yes gating hole. Verified it is the NO-OP path:
    "nothing to change ... Nothing was written". The plugin short-circuits
    before the confirmation gate when no write will occur. Correct behaviour.
    Third short-circuit-before-the-feature case in this task; gap remains for
    the yes-gating of these three WITH real work pending. Round 3 dispatched.
Task 8: fix round 3/5 (all addressed; commits 987c40a..458ba94) — 73 records
Task 8: complete (commits 2d6e8cf..458ba94) — 73 records, 0 harness/cleanup/setup errors
  VERIFIED CORRECT (evidence ids): --yes gating IS uniform across every mutation
    command once real work is pending — unpin-from-pinned-no-yes,
    soften-from-hard-no-yes, refresh-drifted-no-yes all exit 1 with "refusing
    without confirmation", matching pin/harden/supersede. doctor raises
    "source_drift (1) [warn]" (refresh-drifted-readback). repair reaches the
    re-stamp branch. review promote flags land (severity: hard, always: true).
    supersede records both directions.
  CONFIRMED STILL PRESENT: D8 (supersede-missing-by, no my_context: prefix) and
    D9 (repair says "unknown flag", siblings say "unknown option").
  ⚠️ task-8-report.md's summary claims "No discrepancies found" — FALSE, D8/D9
    are in the evidence it regenerated. TASK 17 MUST NOT TRUST THE IMPLEMENTER
    REPORT SUMMARIES. Build FINDINGS.md from the evidence files + this ledger.
  Acknowledged gaps: supersede --reason storage unverified; --unlink mutation
    path needs a pre-existing link; link_items has no CLI surface.

CONTROLLER PROCESS CHANGE for Tasks 9-14: three sweeps running, three overclaimed
  summaries, zero bad datasets. Implementers are reliable DATA COLLECTORS and
  unreliable ANALYSTS. From Task 9 on, dispatches instruct implementers to
  collect and report mechanics ONLY (counts, errors, anomalies) and explicitly
  NOT to characterise findings. The reviewer does the evidence hunt — that has
  worked every time. Should cut a fix round per task.

Task 9: review 1 — CONTROLLER CORRECTION: reviewer marked spec ❌ for the
  seed->CORPUS setup substitution in 43/67 cases. That deviation was EXPLICITLY
  AUTHORISED in my dispatch (a 1-item corpus makes audit/focus filters
  indistinguishable). Spec compliance is ✅. Reviewer could not know this.
  Also: report's exit tally 48/19 is WRONG; actual is 51 exit-0 / 16 exit-1
  (reviewer counted twice by two methods). I repeated the wrong figure upstream.

NEW PLUGIN FINDINGS from Task 9 (all source-grounded, evidence in cli-retrieve):
  D10 `audit --role` is a NO-OP outside `--items`. buildFilter() (audit.ts:33-82)
      reads since/until/item/session/kind/op/origin/limit but never `role`.
      `role` is only consulted in the --items branch, where valid values are
      subject|injected|spilled — NOT human/agent. evidence: audit-role is
      byte-identical to audit-bare.
  D11 `--role` has NO validation, unlike its siblings. kind/op/origin are
      enum-checked with "must be one of" errors (audit-kind-invalid,
      audit-op-invalid); role silently accepts any string at every call site.
  D12 audit's OWN built-in usage text lists --until but omits --role entirely
      (evidence: audit-unknown-flag). So --until is undocumented in the README
      but present in built-in help; --role is absent from BOTH.
  D13 `decay` silently covers only normative-tier items — decision and lesson are
      excluded (core/decay.ts:103). Deliberate, but the caveat text shown to
      users never states the scope limit. evidence: decay-bare shows 4 of 6.
  D14 Inconsistent "closest match" hints: audit --kind nope suggests "hook";
      audit --op nope, with 19 valid values and more need of a hint, suggests
      nothing.
  D15 `search --relation` accepts 8 relation types; `focus --relations` prints 16.
      Intentional (user-creatable vs system/back-reference edges, relations.ts)
      but invisible to a user comparing the two commands.
  D16 Default --limit differs across siblings: search 50, query 1000. Plausibly
      intentional, undocumented as a cross-command difference.

VERIFIED CORRECT in Task 9 (for COVERAGE.md):
  query --json returns exactly {rows,rowCount,truncated,limit,loadErrors};
  SELECT * FROM ledger after bare rebuild fails with exactly "no such table:
  ledger"; query refuses INSERT/DROP/PRAGMA naming the offending keyword and
  allows WITH...SELECT; decay prints its caveat at default, --summary and in
  --json; focus never hides a severity:hard item; focus --tag is real and
  equals the positional form; audit --item and --limit genuinely discriminate;
  focus --category and --tag are independently wired, not aliases; search
  positional == --text, and refuses both-at-once and zero-filters.

Task 14: 11 assertions (commits 8d53218, then parity/refs/inventory).
  VERIFIED CORRECT: all 21 categories in categories.ts have BOTH add-<slug> and
    list-<slug> command files; zero missing, zero orphans. So the README's "a
    category you declare gets no slash command" applies to CUSTOM categories
    declared in config, not to the 21 built-ins. evidence: slash/category-command-parity
  D17 STRONG: slash/command-references-real-surface records 36 distinct real
    flags (37 minus the "---" frontmatter artifact) referenced across the 66
    command files alone, against README:2771 "These twenty-five are all of
    them." Independent corroboration of the incomplete-flag-table finding.
  D18 CONFIRMED: slash/file-count = 66, against README:1780 telling a user
    verifying their install that `claude plugin details` prints "the 38
    commands". Stale number inside the installation-verification instructions.
  HARNESS BUGS in slash-audit.mjs (not plugin findings): subcommandsReferenced
    captured only 5 (add, doctor, edit, lesson, review) — 66 files certainly
    reference more; and non-per-category-inventory has name: null for all 24
    entries. Both needed for Task 16. Fix dispatched.

Task 10: complete (commits 38fbcce, 98b3b41) — 25 records
  VERIFIED CORRECT — quote-anchored extraction, the plugin's flagship feature:
    verbatim candidate accepted (created 1); PARAPHRASE REJECTED with an
    actionable message naming the session and anchor; empty candidate array
    marks the section done and advances to the next chunk; ingest-created items
    land as DRAFT with origin=ingest. Both protocol envelopes captured.
    evidence: cli-pipelines/ingest-apply-{real-session,paraphrase-rejected,
    empty-candidates,real-session-readback}

Task 12: review 1 — spec ✅, 1 Critical, 4 Important, 2 Minor, 14 discrepancies.
  CONTROLLER CORRECTION: reviewer flagged the report's "did not commit" as
  contradicted by commit e97ae45. The implementer was right — I committed it
  centrally. Not a discrepancy.
  CRITICAL: the corpus never actually pins anything. `mycontext add` has NO
    --always flag, and the seed never calls `pin`, so ALL 8 SessionStart cases
    show only the index — the pinned-tier full-text delivery path, the most
    important behaviour of that hook, is completely unexercised.
  VERIFIED CORRECT: `add` genuinely has no --always flag, matching README §8's
    own concession that "pin is the only route, and it is a second step".
    Deny reasons are per-category and distinct (items/focus/index all differ);
    Read is correctly never denied (deny gate is /Edit|Write/); dotdot,
    backslash and mixed-case all canonicalize to the same reason; resume and
    clear correctly behave identically to startup; watched-docs nudge fires
    only for the documented globs and never for writes inside .my_context;
    fail-open is genuinely SILENT — no parse-failure text leaks on garbage stdin.
  D19 pre-tool-use-scoped-miss's note "nothing injected" is FALSE. 177 chars are
    emitted because the UNSCOPED corpus item is delivered via JIT — README:1313
    says JIT delivers an item with no scope to any file at all. Case note wrong,
    plugin correct.
  D20 PostToolUse never touches SQLite — all 5 records have EMPTY stderr, unlike
    the other three hooks, because post-tool-use.ts never imports Store.
  COVERAGE GAPS: 5 of ~7 documented deny spellings untested (.my-context hyphen,
    8.3 names, symlinks/junctions, \?\ prefixes, subst drives) plus the generic
    4th deny branch; dedupe-per-session and compaction-restore cannot be tested
    while a hook case is a single call in a fresh workspace; PreCompact's
    snapshot WRITE is unverifiable because the workspace is destroyed before
    anything can inspect it.
Task 11: fix round 2 (commits 5f2c6a8, then multi-call) — 62 records
  VERIFIED CORRECT: agent-created NORMATIVE lands draft and appears in
    list_drafts but not in an active query; agent-created RATIONALE lands active
    and is absent from drafts — the tier contrast, the plugin's trust boundary.
    create_item IS idempotent: second identical call returns "already captured
    ... Nothing changed" and query_items shows exactly 1 item (the earlier "-2"
    was a different CLI-created human/active item, not a duplicate — SUSPECT
    CLEARED). update_item STAGES rather than applies: get_item shows the old
    title plus "1 pending revision(s)". supersede_item records BOTH directions.
  D21 ASYMMETRY FOR THE AUTHOR TO JUDGE: link_items records the relation on the
    SOURCE only — the target item has no ## Relations section at all — whereas
    supersede_item writes both sides. For a symmetric relation like relates_to
    this means querying the target never surfaces the link. May be intended;
    the README documents supersede as bidirectional but says only "record a
    typed relation" for link_items. evidence: mcp/link_items-effect calls[3],[4]
Task 14: complete (commits 8d53218, 52b6fe7, c941dc8) — 11 assertions
  ⚠️ FALSE POSITIVE, DO NOT REPORT: slash/command-references-real-surface lists
  unknownSubcommands ["harden","pin","soften","unpin"]. All four ARE real CLI
  commands — Task 8 exercised every one successfully (cli-mutate/pin-readback ->
  "always: true", harden-readback -> "severity: hard", etc). They are registered
  via NAMED_ENTRY_POINTS in cli/commands/edit.ts rather than the main registry,
  so the audit's reference list missed them. Harness artifact, not a plugin defect.
  CONFIRMED: 26 subcommands and 36 distinct flags referenced across the 66
  command files; 24/24 non-per-category names captured; category-slug mapping
  recorded for all 21 categories.
Task 12: fix round 1 complete (commit above) — 37 records, all exit 0
  VERIFIED CORRECT — six documented injection-format claims, all from
  hooks/session-start-startup in one record:
    "## my_context — these govern this project" (README:144)
    "### <id> · <type> · <title>" (README:146)
    "## my_context index" (README:1275)
    "- <id> · <type> · <title>" index lines (README:1277)
    rationale count line "1 decision · 1 lesson" (README:1281)
    "→ use mycontext list or mycontext show <id> to browse these" (README:1282)
  VERIFIED CORRECT — deny surface: 10/10 variants denied (items, focus, index,
    .my-context hyphen spelling, config.json generic branch, dotdot, backslash,
    mixed case, NotebookEdit, MultiEdit); Read of a managed path correctly NOT
    denied. evidence: hooks/pre-tool-use-deny-*
  VERIFIED CORRECT — scope discrimination: a db-scoped item does not arrive for
    src/api/**, a billing-scoped item does arrive for src/billing/**.
  ACKNOWLEDGED GAPS (documented, not silently dropped): per-session dedupe and
    compaction restore both need multi-call hook support; PreCompact's snapshot
    WRITE is unverifiable because the workspace is destroyed before inspection.

Task 9: fix round 1 complete (commit 46436a8) — 78 records. ALL FOUR GAPS CLOSED.
  VERIFIED CORRECT: `--until 2020-01-01` and `--since 2099-01-01` both return
    "no audit records match" against audit-bare's 6 — the flags genuinely
    discriminate. `--op create` returns 6, `--op update` returns 1 — also
    discriminates. `focus --show` with an active focus reports "focus set
    <iso> by human. focus: tags: db. 1 item(s) in focus, 5 hidden by focus".
    `audit --items --role subject` works — so --role DOES function inside --items.
  D10/D11 NOW PROVEN BY DIRECT CASE, not just source reading:
    cli-retrieve/audit-role-garbage — `--role nonsense` exits 0 and returns ALL
    6 records. Silently accepted and ignored, while --kind and --op reject an
    invalid value with a "must be one of" error. Confirms both the no-op-outside
    ---items behaviour and the total absence of validation.

Task 13: complete (commit 6942331) — 70 records, 21/21 categories accept a capture.
  VERIFIED CORRECT: profile "full" refused BY NAME with the removal note
    (README:2864); a disabled category refuses new items; `extraFields` refused
    by name (README:3640); negative budget refused; unknown top-level key
    refused by name (README:3905); scopePolicy "required" refuses at CAPTURE
    (README:3866); prefix override mints POLICY-write-the-failing-test-first
    (README:3625); a custom category derives SECURI- from security_control
    (README:3616).
  COVERAGE GAP — budgets-spill-note did NOT capture a spill note. NOT a finding:
    the case set budgets.pinned=50 but never PINNED the item, so it landed in
    the index tier and the pinned budget was never consulted. Same
    short-circuit-before-the-feature trap. INV-nothing-is-dropped-silently
    remains unverified; needs a pinned item plus a tiny pinned budget.

Task 15 (live pass) — INSTALL PHASE DONE, pre-restart.
  Installed exactly as README:1756-1760 documents:
    claude plugin marketplace add ./     -> "Successfully added marketplace: mycontext"
    claude plugin install mycontext@mycontext -> "Successfully installed (scope: user)"
  Clone verified clean after install.
  D22 STRONG, user-visible, at the install-VERIFICATION step. README:1777-1782
    tells a new user to run `claude plugin details mycontext@mycontext` and says
    it prints "the 38 commands and the mycontext skill, the four hooks ... and
    the one MCP server". Actual output:
      Skills (67) | Agents (0) | Hooks (4) | MCP servers (1) | LSP servers (0)
    Wrong twice over: the count is 67 (66 commands + 1 skill), not 38; AND there
    is no "commands" line at all — Claude Code reports them as SKILLS, so a user
    following the instructions is hunting for a word that never appears.
    Hooks (4) and MCP servers (1) DO match the README.
  DATUM for the coexistence analysis: projected always-on cost is ~1,643 tokens
    added to EVERY session (plugin details, "Projected token cost").
Task 13: fix round 1 complete (commit 25f494f) — 72 records
  VERIFIED CORRECT — INV-nothing-is-dropped-silently, the plugin's headline
    invariant: two pinned items against a 40-token pinned budget produce
    "_2 item(s) omitted from full text for budget: CONST-first-long-constraint,
    CONST-second-long-constraint. Fetch with mycontext show <id>._" — the
    excluded items are NAMED, matching README:1686's documented format.
    Index overflow produces "… +1 more (fetch with mycontext show <id>)"
    matching README:1696. evidence: config/budgets-spill-pinned,
    config/budgets-index-overflow

=== ALL EIGHT SWEEPS COMPLETE: 419 evidence records ===
  cli-capture 61 | cli-mutate 73 | cli-retrieve 78 | cli-pipelines 25
  mcp 62 | hooks 37 | config 72 | slash 11
  Zero harnessError, zero cleanupError, zero setupFailures across all 419.
  Next: Task 15 live pass (needs a user restart), then 16-20 deliverables.
