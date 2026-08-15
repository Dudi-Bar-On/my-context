# mycontext — Production-Readiness Audit Report

**Date:** 2026-08-14
**Tree audited:** `.claude/worktrees/my-context-plan4` (identical in tree to merged master, four plans merged)
**Method:** Six dimension audits (requirements conformance, architecture, test quality, UX/usability, help & docs, security & integrity), each followed by an independent adversarial verification pass that re-executed the top findings. Every finding in this report either survived that verification (marked **CONFIRMED**) or is a minor finding reported by a dimension auditor with an observed reproduction that was not adversarially re-verified (marked **audit-observed**). Findings the verifiers refuted were dropped; findings the verifiers called overstated appear here only in their corrected form. Nothing in this report is asserted from reading alone: the governing rule of this audit was *run things* — the codebase's recorded characteristic defect is a comment, message, doc, or report asserting a property the code does not have, and reviews that executed the code found what reviews that read it did not, every time.

**A note on requirement numbering.** The R-numbers below (R1–R155) come from the requirement census assembled for this audit from the binding spec (`docs/superpowers/specs/2026-08-12-my-context-design.md`), the four plans, the ledgers and 18 task reports, and the plugin's own dogfooded corpus (`.my_context/`). The numbers do not appear anywhere in the repo — several verifiers confirmed this by grep. Each census entry cites its origin; the numbers are this audit's index into those origins, nothing more.

---

## 1. Verdict

**mycontext is not yet production grade. It is close — the distance is measured in days of focused work, not months — and the gap is almost entirely at the edges, not in the core.**

Three facts decide it:

1. **The write-deny trust boundary is bypassable on the first-target platform.** The PreToolUse deny — the *only* enforcement keeping a no-Bash agent out of the managed corpus — is case-sensitive (`src/core/paths.ts:54`), while NTFS is not. The verification pass did not merely allow a write through `.MY_CONTEXT\` and the 8.3 alias `MY_CON~1\`: it **forged an `active`, `always: true`, `origin: human` constraint through the bypass, ran `mycontext rebuild`, and the forged item was indexed as a governing constraint** — the §7.1 draft/review gate defeated by changing one letter's case. The fix is nearly a one-liner, which is exactly why shipping without it would be indefensible.

2. **The project's characteristic defect is live on its most model-facing surfaces.** "Items loaded via /LoadMyContext are not restored after a compaction" is false in the normal case — verified by executing the PreCompact → SessionStart(compact) pipeline, which restored a manually-loaded item in full — and the false claim ships on **five** surfaces (`commands/LoadMyContext.md:16`, `skills/mycontext/SKILL.md:44-45`, the `load_context` MCP tool description, `src/help/topics/capture.md:95`, and a comment in `src/core/inject.ts:74-77`), **two of which are pinned by tests that assert the false text is present** (`test/plugin-assets.test.ts:30`, `test/mcp/tools.test.ts:960-963`). Separately, the mandatory human preview at the lesson→rule approval gate tells the reviewer an unscoped rule "matches every scope check" (`src/cli/commands/lesson.ts:242`) when execution shows the exact opposite. A knowledge-injection product whose own injected knowledge is wrong has not yet met its own bar.

3. **The machine interface breaks exactly when something is wrong, and four user-recorded hard requirements are absent.** `decay --json` emits plain-text error lines after the JSON document on stdout when a corpus load error exists — exit 0, empty stderr, unparseable output — the sole deviant among six reporting commands, against an explicit README contract. And four requirements the user recorded as `severity: hard` in the corpus itself are unimplemented: domain grouping (R118), session focus (R119/R120), run-time audit logging (R121), and the answered-question lifecycle (R122). Three of the four are roadmap-tagged product decisions, not regressions; R122 is a bug-shaped gap — the corpus's own standard cannot be performed through any supported surface.

Against that: the core engine is genuinely production grade, and this must be said just as plainly. All four injection tiers work end-to-end on Windows, verified by executing the real hook binaries over stdin. The trust model held under every adversarial probe and is *mutation-hardened* — 20 of 21 hand-built mutants of the security guards were killed by dedicated tests. Concurrency is safe under real OS processes (zero lost writers across all races; 40 SIGKILLed writers left no corruption). The Markdown↔DB round trip is byte-identical on the real corpus. The suite is 1401 tests, green, fast, with all six performance ceilings passing. The failures above are peripheral — a missing regex flag, one JSON branch, doc sentences — sitting on top of a sound machine.

---

## 2. Requirements Conformance

Status legend:

- **Met** — verified by execution during this audit.
- **Met (struct)** — verified structurally (grep/import-graph/suite evidence), not exercised live in this audit.
- **Met (hist)** — process/historical requirement satisfied per ledgers/reports; not re-derivable now.
- **Partial** — core of the requirement holds; a named part does not.
- **Absent** — not implemented.
- **Unverified** — could not be checked from a headless audit.

| Req | Status | Evidence |
|---|---|---|
| R1 capture→index→inject | **Met** | All four tiers executed end-to-end via real hook binaries; capture via CLI/MCP/ingest all executed. |
| R2 non-goals held | **Met (struct)** | No session-history/semantic-search/doc-site features exist; nothing contradicts. |
| R3 twenty categories, split | **Met** | Category set and normative/rationale split confirmed; standard profile = 17 (add's refusal lists 17 enabled, examples lists 20). |
| R4 categories by mechanics | **Met (struct)** | requirement.kind, rule.directive etc. exist as fields; no near-synonym categories shipped. |
| R5 category lists + profiles | **Met** | Observed in refusal messages and help table (generated from resolved config). |
| R6 instruction inherently pinned | **Partial → broken half** | **CONFIRMED finding §3.1-F7:** `add instruction` creates `always: false`, directive text never injected; only the id/title reach the index. The never-writes-to-CLAUDE.md half holds. |
| R7 open_question normative | **Met (struct)** | Normative tier in `src/core/categories.ts`; JIT-injectable (stale-OPENQ finding §3.1-F9 shows it injecting). |
| R8 non_goal exists | **Met (struct)** | Category present, dogfooded (NOGOAL-* items in corpus). |
| R9 no trigger category | **Met (struct)** | No such category; scope is the only activation mechanism. |
| R10 adr-vs-decision in help | **Met** | Verified in generated help('categories') output. |
| R11 one file per item, BM format | **Met** | 39/39 corpus items parse→render byte-identically. |
| R12 relations live in file | **Met** | supersedes relation observed written into the replacement's file. |
| R13 slug IDs, deterministic case | **Partial** | Slug paths met; **audit-observed §3.6-F2:** explicit-id path in `createItem` accepts `/` and `..` (latent traversal; unreachable externally today). |
| ~~R14 scope defaults inert~~ | ~~**Met**~~ | ~~Executed: unscoped item never JIT-injects; `matchesAnyGlob(path, [])` = false.~~ **OBSOLETE 2026-08-15.** R14 as worded here was itself a misstatement of the requirement, and the finding below (§3.5-F2) inverted with it. Spec §3.2 was amended: scope restricts rather than enables, an unscoped item applies to every path, and `matchesScope` returns true for an empty scope. What this row verified was the defect. |
| R15 category extra fields | **Met (struct)** | extraFields present in schema and in ingest extraction requests. |
| R16 rejected candidates recorded | **Met (struct)** | Recorded in spec §3.3/§13. |
| R17 per-project config | **Partial** | Config consumed (profile/tiers/budgets/watchedDocs verified working); **CONFIRMED §3.5-F3:** entire surface undocumented in every shipped help channel; unknown keys silently ignored. |
| R18 disable is non-destructive | **Met (struct)** | No deletion path exists; add refuses with teaching. Whether legacy items of a disabled category still load was *not* executed — verifier caution noted. |
| R19 tier overridable, honoured | **Met** | trustedStatus reads resolved config; the mutant removing the ingest-widening was killed by tests. |
| R20 custom categories | **Met** | "a custom category documents itself" test executed and passing (23/23 help tests). |
| R21 profiles 8/17/20 | **Met (struct)** | Profile validation in `src/core/config.ts:78-84`; standard default observed in `status`. |
| R22 two layers, project wins | **Met** | Executed: global item indexed with `layer: global`; conflicting id → "the project copy wins…" from rebuild. Undocumented (see §3.5-F4). |
| R23 select is pure | **Met (struct)** | Imports only config/paths/render-item/types; no clock, no I/O — verified over the executed import graph. |
| R24 index disposable | **Met** | Deleted `.index.db`; rebuild recovered fully. (Consequence for audit retention noted under R121.) |
| R25 Node≥24, zero deps, no build | **Met** | All audits ran `.ts` sources directly; zero runtime dependencies. |
| R26 Windows-first, POSIX paths | **Partial** | POSIX normalization held everywhere probed; **CONFIRMED §3.6-F1:** the deny's path match is case-sensitive on the case-insensitive first-target filesystem. |
| R27 CI both platforms | **Met (struct)** | ci.yml runs npm test + test:perf on windows-latest and ubuntu-latest (read). Merge-gating and cross-platform identity not verifiable from this machine. |
| R28 four tiers | **Met** | All four executed end-to-end (pinned, JIT, restored, index). |
| R29 eligibility gates | **Met** | Draft not injected until promoted; superseded/rationale never restored — executed. |
| R30 hook wiring | **Met** | All hooks fired from real entry points with real stdin; /LoadMyContext works; no PostCompact assumed. |
| R31 index bounded | **Met** | Bounded index with "+N more" observed; perf green at 5,000 items. |
| R32 budgets + spill disclosure | **Met** | Spill disclosed with ids + fetch command; spilled items provably stayed eligible (drained over three reads). Persisted spill-log table remains deferred per R58. |
| R33 hooks fail open | **Met** | Corrupt DB / garbage stdin / malformed YAML → exit 0 every time. Process-level wiring untested (§3.3-F2); rebuild contention on SessionStart fails open silently (§3.2-F2). |
| R34 hook perf ceilings | **Met** | 6/6 perf tests green locally; CI runs them on both platforms. |
| R35 session ledger | **Met** | Dedupe, snapshot, tier-in-PK (pinned-then-restored as two events) observed. |
| R36 non-human normative → draft | **Met** | Executed repeatedly incl. explicit `status:'active'` request and smuggled `origin:'human'`; mutation-hardened. |
| R37 trust asymmetry on revision | **Met** | scope/always/severity/status changes and supersession of governing items refused; prose edits allowed — executed. |
| R38 batch ingestion | **Met** | Full ingest→apply→dedupe→-r2-revision+supersede cycle executed. |
| R39 live capture 3 mechanisms | **Partial** | Idempotency and drift detection executed and working; **CONFIRMED (corrected) §3.4-F4:** nudge defaults are ⅔ repo-specific and the knob is undiscoverable. |
| R40 lessons→rules gate | **Met** | Staging→accept executed; derived_from wired; lesson stays index-only. (Preview message defect §3.5-F2; no confirmation token §3.4-F5.) |
| R41 tool surface (11 tools) | **Met** | tools/list over real stdio returned exactly the 11 registered tools. |
| R42 no delete_item | **Met** | Not registered; no deletion surface for agents. |
| R43 help from one source | **Partial** | Category table/tool list generated + test-enforced (executed); **audit-observed §3.2-F5:** workflow.md hand-lists the relation vocabulary with no drift test; config surface undocumented (R17). |
| R44 terse tool descriptions | **Met** | All 11 descriptions 93–200 chars with "Not for:" — measured live. |
| R45 teaching errors | **Met** | ~15 distinct refusals executed; every one named field/allowed set/value/closest match/help topic, one `my_context:` prefix. Minor gaps: §3.4-F6 (repair unnamed), §3.4-F8 (--yes=false misattribution). |
| R46 docs ≡ registry | **Met** | Registry-equality and ≤200-char tests executed (71/71). |
| R47 help('scope') worked examples | **Met** | All 12 table rows probed against the real matcher — all agree. |
| R48 rebuild lossless | **Met** | Byte-identity verified on the real 39-item corpus; property tests in suite. |
| R49 supersede keeps content | **Met** | Executed: retired item keeps file/body; only status + valid_until change. |
| R50 partial ingest failure | **Met** | Rejections durably logged, chunk stays pending, resubmit teaching — executed. |
| R51 atomic writes | **Met** | 40-process SIGKILL-mid-write stress: no truncation, no stray temps, doctor clean. |
| R52 real concurrency | **Met** | Real OS processes: 8/8 distinct-body races → zero lost writers; identical racers → exactly one item, every run. |
| R53 drift never auto-resolves | **Met** | source_drift flagged on every run after rewording; repair gated; doctor never rewrites. |
| R54 schema migrations | **Unverified** | Suite covers; not exercised by any audit dimension. |
| R55 doctor checks + verified advice | **Partial** | Doctor accurate (0 false positives on own corpus; detects dead_scope/drift/mismatch on demand); **audit-observed §3.5-F6:** decay/status "add a scope glob or set always:true" advice dead-ends on governing items through every advertised surface. |
| R56 testing weighted to risk | **Partial** | 97.7% lines, pure core ≈100%, chaos tests real; **CONFIRMED §3.3-F1/F2:** query's security boundary unpinned at its call site; no hook is tested as an OS process. |
| R57 dogfooding | **Partial** | Corpus real and driving; **audit-observed §3.1-F9:** corpus contains an active OPENQ contradicting shipped code, and a standard whose central claim about supersedeItem is false by execution. |
| R58 deferred items not foreclosed | **Met (struct)** | No schema decision observed that forecloses them. |
| R59 SDD approach | **Met (hist)** | Ledgers + 18 task reports present. |
| R60 quoted test glob | **Met** | package.json glob double-quoted; 1401 tests across 82 files confirmed. |
| R61 TDD per task | **Met (hist)** | Per ledgers; not re-derivable. |
| R62 YAML parser never guesses | **Met** | Malformed frontmatter surfaced with the exact offending line number — executed. |
| R63 CLI command set + refusals | **Partial** | Commands exist; unknown command → usage + exit 1 (executed); **CONFIRMED §3.4-F2:** `list <typo/disabled>` is a silent empty exit-0 instead of a closest-match refusal. |
| R64 init creates structure | **Met** | init executed in sandboxes throughout; index gitignored (disposability verified). |
| R65 SessionStart behavior | **Met** | Pinned-in-full + bounded index; corrupt config → empty output; executed. |
| R66 renderSelection | **Met** | Spill disclosed with "fetch with mycontext show <id>"; LF output. |
| R67 chars/4 over-estimate | **Met (struct)** | In select; suite-pinned. |
| R68 hook timeouts in seconds | **Met** | hooks.json PostToolUse timeout 5 (seconds) observed. |
| R69 filter seen before budgeting | **Met** | Mutant killed by three dedicated ordering tests. |
| R70 no boolean binds | **Met (struct)** | `always=1` observed in DB rows; no violations found. |
| R71 snapshot hygiene | **Met** | Traversal-shaped session ids sanitized; atomic snapshot with sorted ids — executed. |
| R72 transcript scan | **Met** | Only index-existing ids accepted; 8MB-tail proof (id at the START is NOT found) verified in suite. |
| R73 index only on session events | **Met (struct)** | JIT path builds no index; perf tests corroborate. |
| R74 JIT no rebuild / activeScoped | **Met (struct)** | Structure verified; JIT p95 < 50ms on 5,000 items green. |
| R75 write-deny | **Partial** | Deny fires with teaching reason, Read never denied (executed); **CONFIRMED §3.6-F1:** case/8.3-alias spellings bypass it on NTFS. |
| R76 JIT activation semantics | **Met** | Once-per-session, per-session isolation, spilled-stays-eligible, no-session-id → nothing — all executed. |
| R77 PreCompact snapshot | **Met** | Ledger ∪ transcript, filtered to live index; empty session writes empty snapshot — executed. |
| R78 compact restore semantics | **Met** | No re-restore on second compact; startup ignores snapshots; rationale never restored — executed. |
| R79 perf pins | **Met** | 6/6 green on this machine; ceilings unchanged. |
| R80 MCP stdout purity | **Met** | Live stdio session: only JSON-RPC on stdout, stderr empty; sole console.log is the CLI entry, outside the server closure. |
| R81 dual-era protocol | **Met** | Legacy + 2026-07-28 handshakes, -32022 with {supported, requested}, -32602, -32700 without loop death, isError:true — all executed live. |
| R82 single mutation layer | **Met (struct)** | writeItem has exactly one call site (mutate.persist); persist's only external consumer is human-gated repair. |
| R83 createItem dedupe/identity | **Met** | "already captured", -r2 revisions, collision suffixes — executed. (Explicit-id validation gap tracked at R13.) |
| R84 updateItem | **Met** | Field-scoped revision, slug kept, non-human governing-field changes refused — executed. |
| R85 supersedeItem | **Met** | Self-supersession/unknown-side/idempotency/reason-observation/governing-refusal all executed. (Its refusal chain can mislead — see §3.1-F8 corrected detail.) |
| R86 linkItems vocabulary | **Met** | Unknown relation → closest match; supersedes refused via link_items — executed. Latent: createItem doesn't enforce the vocabulary (§3.2-F5). |
| R87 origin hardcoded | **Met** | All three MCP origin hardcodings mutation-tested; schema exposes no origin; smuggled origin ignored — executed. |
| R88 reopen store per call | **Met** | Per-call rebuild confirmed (and documented as by-design at `src/mcp/tools.ts:196-199`). |
| R89 query_items | **Met** | Filters + bounded output + teaching on no match — executed. |
| R90 validate, never coerce | **Met** | Bare-string scope refused with example array — executed on both surfaces. |
| R91 help/examples without workspace | **Met** | Executed with cwd in os.tmpdir(). |
| R92 capture nudge | **Partial** | Fires ~30 tokens with repo-relative file, never on .my_context, fails open — executed. **Audit-observed §3.1-F10:** NotebookEdit structurally unreachable (hooks.json matcher); defaults gap under R39. |
| R93 messages name runnable callbacks | **Met** | Every named callback executed successfully end-to-end. |
| R94 plugin never calls an LLM | **Met (struct)** | No API client; two-phase request/callback protocol executed. |
| R95 nothing generated → active | **Met** | Belt and braces both mutation-tested; ingest lands draft — executed. |
| R96 verbatim-quote grounding | **Met** | Paraphrase rejected with resubmit-first teaching; no next-chunk emitted — executed. |
| R97 deterministic anchors | **Met (struct)** | Suite + task-report evidence; chunker internals read, not re-executed. |
| R98 validator = precondition | **Met (struct)** | Shared normalizeObservations verified structurally; 34,746-candidate sweep is historical suite evidence. |
| R99 ingest sessions | **Met** | Edited source → new session id, old survives; session-id validation — executed. |
| R100 applyCandidates identity | **Met** | Hash-dedupe / ingest-key -rN+supersede / create, with full provenance — executed. |
| R101 per-workspace apply lock | **Met** | Three real processes serialized with zero timeline overlap — executed. |
| R102 self-contained extraction request | **Met** | Fenced chunk, enabled categories only, exact callbacks; rejection teaching on both surfaces — executed. |
| R103 CLI command registry | **Partial** | Registry exists and generates usage; **CONFIRMED §3.2-F1:** seven builtins live outside it in a hardcoded switch with a hand-kept mirror set and a second usage table. |
| R104 exit-code rule F2 | **Partial** | Verified live (only status/doctor exit non-zero on load errors; others warn + exit 0); the structural test iterates only registered commands, so the builtins sit outside the guarantee (§3.2-F1). |
| R105 one ingest tool, two phases | **Met** | Both phases exercised via arguments through the single registered tool. |
| R106 lesson gate structural | **Met** | Staging creates nothing; accept creates exactly one rule with derived_from; double-accept and accept-origin mutants killed. |
| R107 lesson CLI hard constraints | **Partial** | No blob/path/root inputs; preview before mutation — held. **CONFIRMED §3.5-F2:** the preview's scope line asserts the opposite of real behavior, undermining the informed-review purpose. |
| R108 review command | **Met** | list/show/promote/discard, --yes semantics, exact-match ids, global drafts excluded — executed. |
| R109 no promote --all | **Met** | Refused — executed. |
| R110 decay reporting | **Partial** | Buckets, unconditional hedge, "always" for pinned, window behavior — executed and consistent. ~~**Audit-observed §3.5-F6:** unscoped-advice line names routes that don't work on governing items.~~ **OBSOLETE 2026-08-15:** the `unscoped` bucket was replaced by `unrestricted` when spec §3.2 was amended — unscoped items are now measured as cold/warm like any other, and the section carries no advice to act on. |
| R111 query read-only | **Met** (behavior) | Write attempts refused; VACUUM INTO denylisted (mutation-killed test); cap disclosed — executed. **CONFIRMED §3.3-F1:** the boundary is unpinned at its call site — a writable-connection mutant survives all 1401 tests. |
| R112 status agrees with named commands | **Met** | Numbers agreed across nine corpus states (review queue, doctor, decay, ingest) — executed. |
| R113 e2e + human checklist | **Partial** | Scripted e2e suite present and green; live-MCP-session and cross-platform-CI checklist items unverifiable headless. |
| R114 S2 slash-command surface | **Met** | 48/48 generation/byte-identity tests; drift test drives the generator with a different config. |
| R115 add-/list- routing | **Partial** | Routing via MCP + ${CLAUDE_PLUGIN_ROOT} correct; **CONFIRMED §3.4-F3:** the normative fallback text licenses the model to run `add --yes` itself, contradicting SKILL.md and review.md. |
| R116 --yes=false refuses | **Met** | Refuses with nothing written; --yes=maybe refused loudly; mutant killed (5 failures). Message misattributes the cause (§3.4-F8). |
| R117 tabular output + detail levels | **Partial** | Levels/widths/ids/json verified across surfaces; **CONFIRMED §3.4-F1:** `decay --json` violates the parseability contract exactly when load errors exist. |
| R118 domain grouping | **Absent** | **CONFIRMED §3.1-F1.** No field, no config consumption (key silently ignored), no column, no flag. Roadmap-tagged corpus requirement — a product decision, not a regression. |
| R119 session focus | **Absent** | **CONFIRMED §3.1-F2.** Zero hits for focus in src/; 11 tools, none focus; no state file; deliberately blocked by R120's open design question. Product decision. |
| R120 filters vs dependencies design | **Absent** | **Audit-observed §3.1-F3.** The corpus OPENQ ("DESIGN THIS BEFORE IMPLEMENTING") is active and unanswered; vacuously satisfied only because no filters shipped. Product decision. |
| R121 run-time audit log | **Absent** | **CONFIRMED §3.1-F4.** No operation log; no created_at/updated_at; index `updated_at` is rewritten every rebuild; verifier proved the ledger dies with the disposable index (`DELETE .index.db` → "no such table: ledger"). Product decision on scope. |
| R122 answered-question lifecycle | **Absent (bug-shaped)** | **CONFIRMED §3.1-F8.** `superseded_by` outside the vocabulary; supersedeItem writes no back-reference; agents refused; humans have no command; the corpus's own conforming item could only have been hand-edited. |
| R123 items must be editable | **Met** | update_item + add flags + repair all executed; the hand-edit+repair route works. The R136-recorded gap (no route for governing-field changes) remains open by design and must not be papered over. |
| R124 survive compaction + scope activation | **Met** | The original motivating problem, verified end-to-end. |
| R125 index excludes injected-in-full | **Met** | Executed at SessionStart. |
| R126 add flags + --yes gate | **Met** | Round-trip guards, unrecognized-option refusal, normative gate — executed. |
| R127 repair exists, gated, named | **Partial** | Exists, gated, honest, verified end-to-end; **audit-observed §3.6-F3:** workflow.md's gate-list enumeration omits it (README and SKILL.md have it). |
| R128 don't instruct hand-edits | **Partial** | README narrative verified true by execution; but the update_item refusal message itself instructs "edit `status:` in the Markdown file and then run `mycontext repair`" — the shipped resolution of the R123/R128 tension, which needs a deliberate decision (see executive plan). |
| R129 honest boundary statement ×3 | **Partial** | Present, blunt, and consistent in README/SKILL/workflow — verified; **audit-observed §3.5-F7:** the recommended deny list omits `lesson-discard`, a whole destructive command rather than a spelling. |
| R130 model never promotes/adds/repairs | **Partial** | SKILL.md instruction present and pinned; **CONFIRMED §3.4-F3:** generated normative add-command fallback contradicts it at the exact failure moment. |
| R131 SKILL.md truthful per tier | **Partial** | Tier truthfulness held; **CONFIRMED §3.5-F1:** SKILL.md:44-45 carries the false compaction claim (and is *more* wrong than first reported — compact re-runs pinned+index unconditionally). |
| R132 SKILL behavioral guidance | **Partial** | query-before-asserting, never-guess-ids present; **CONFIRMED §3.1-F5/§3.5-F1:** the /LoadMyContext restoration claim is false in the normal case. |
| R133 load_context registered | **Met** | Registered and executed; its *description* carries the false restore claim (same finding). |
| R134 createItem concurrency-safe | **Met** | Real-process races + EEXIST re-read-from-disk; deterministic stale-store tests in suite. |
| R135 shared normalizeObservations, __proto__ safety | **Met** | `__proto__` extra refused on both surfaces (built via JSON.parse — a real own property); round-trip guards held. |
| R136 pinning routes | **Met (as recorded)** | promote --always is the only route (executed); the no-route-for-governing-items gap is recorded, and this audit confirms the record is accurate. The decay advice papering over it is §3.5-F6. |
| R137 this audit (S3) | **Met** | This report and its companion plan are the deliverable. |
| R138 never delete SDD ledgers | **Met (struct)** | Ledgers + 18 task reports present under docs/superpowers/ledgers/. |
| R139 no unchecked claims in reports/tests | **Partial** | Trust model genuinely mutation-hardened (20/21 killed); but §3.3-F1/F2, §3.5-F1/F2 are precisely this defect class, and two tests pin *false* doc text. |
| R140 nothing dropped silently | **Partial** | Spill/index/LoadErrors verified extensively; **CONFIRMED §3.4-F2** (`list` silent empty), **CONFIRMED §3.4-F1** (decay --json corrupts), **audit-observed §3.2-F3** (`constructor`-typed item gets no LoadError). |
| R141 checksum LoadErrors | **Met** | Executed on every command; mutant killed; reaches MCP results too. |
| R142 live-session duties | **Partial** | Headless-verifiable parts hold; **audit-observed §3.1-F9:** the negotiated-MCP-revision decision item was never recorded and the OPENQ contradicting the shipped dual-era server is still active. |
| R143 restore correctness details | **Met** | Superseded-since excluded, dead ids dropped, missing snapshot degrades — executed. |
| R144 prototype-safe slug keys | **Partial** | Accessors used in ingest paths; **audit-observed §3.2-F3:** loadLayer's unknown-category check regressed to bare bracket access (`type: constructor` → no LoadError). |
| R145 codepoint-ordered canonicalization | **Met (struct)** | Suite/ledger evidence; not independently re-derived. |
| R146 test hygiene | **Partial** | removeTree fix demonstrably holds (0 recurrences in 6 runs); **audit-observed §3.3-F3/F4/F6:** one e2e cold-start flake (1/6 runs), dead rmSyncRetrying wrappers, line-based guard evadable. |
| R147 every config key consumed | **Met (struct)** | No declared-but-unconsumed key found; the *converse* gap (unknown keys silently accepted) is noted under R118's fix risk. |
| R148 pinned set small / tie-break visible | **Met (struct)** | Spill disclosure (the visibility mechanism) verified. |
| R149 query flags/caps | **Met** | --limit cap disclosed; `--` separator; cap mutant killable — executed. |
| R150 status --json health fields | **Met** | Parseable under tamper with loadErrors inside; exit 1 — executed. |
| R151 ~/.my-context not renamed | **Met** | Both spellings recognized (MANAGED_SEGMENT covers both; global layer functioned under the verifier's probe). |
| R152 one load-error owner | **Partial** | Owner exists and eight commands route correctly; **CONFIRMED §3.4-F1:** decay's JSON branch misuses it (emits errors after the document). |
| R153 isMainEntry guard | **Met (struct)** | Verified across hook entry points via the import/stdout survey. |
| R154 no false findings on own corpus | **Met** | doctor/status/decay: zero findings, no false positives on the real 39-item corpus. |
| R155 screens are the requirement | **Partial** | Cross-command number agreement verified through nine corpus states; **CONFIRMED §3.4-F1** plus minor message-truthfulness gaps (§3.4-F5/F7/F8/F9). |

**Tally:** 103 Met (all grades), 26 Partial, 5 Absent (R118, R119, R120, R121, R122), 1 Unverified (R54). The five absents are all user-recorded corpus requirements postdating the binding spec; four are explicitly roadmap-tagged.

---

## 3. Findings by Dimension

Severity within each dimension is ordered worst-first. **CONFIRMED** = survived independent adversarial re-verification by execution. **audit-observed** = reproduced by the dimension auditor (reproduction quoted) but not independently re-verified; treat as reliable but one witness, not two.

### 3.1 Requirements Conformance

**F1. R118 domain grouping is absent — CONFIRMED** (important)
`src/core/types.ts:19-44` (no domain field); `src/core/store.ts:19-30` (no column).
*Reproduction:* grep for `domain` in src/ hits only the taxonomy category description. A `domains` key added to config.json is silently ignored (status exits 0, doctor reports 0 findings, no warning). `mycontext add constraint X --domain dev --yes` → `unknown option "--domain"`. `SELECT * FROM items LIMIT 1` shows no domain column.
*Impact:* The user's hard corpus requirement (REQ-items-carry-a-domain, roadmap-tagged, valid_from 2026-08-13) is unmet: no grouping by area of concern, no domain disable, no domain filters. The binding spec contains no domain requirement — this is a recorded known-unmet corpus requirement, not a regression.
*Fix:* Product decision first (see executive plan). If implemented: closed set in config.json, one indexed column, default domain absorbing existing items, filters on commands/reports, no per-domain budgets — per the corpus item's own design decisions. Note the verifier's trap: config silently accepts unknown keys today, so a `domains` key added before code support gives no signal.

**F2. R119 session focus controls are absent on every surface — CONFIRMED** (important)
`src/core/select.ts:8-16` (SelectContext has no focus notion).
*Reproduction:* Zero grep hits for focus in src/; no focus CLI command; MCP tools/list over stdio shows exactly 11 tools, none focus; after a full session lifecycle, `.my_context/state/` holds only `.gitignore` and `<session>.restore.json` — no `.focus.json`; `commands/LoadMyContext.md:5` says call load_context "with no arguments".
*Impact:* REQ-session-focus-controls-what-loads (hard, roadmap-tagged) unmet. The absence is corpus-mandated: the blocking OPENQ says "DESIGN THIS BEFORE IMPLEMENTING".
*Fix:* Do not ship focus until R120 is designed. Then: focus subcommands + mirrored MCP tools, session state file, spill-style disclosure ("N items hidden by focus"), severity:hard exemption, preview command.

**F3. R120 filter/dependency design not done — audit-observed** (minor)
`.my_context/items/open_question/OPENQ-how-do-filters-respect-dependencies.md:5` — active, severity hard, blocks R119's REQ. No relation classification (load-bearing vs referential) exists anywhere in src/. Vacuously satisfied today because no filters shipped. *Fix:* answer the OPENQ, record the decision, supersede the question per R122 — which first requires fixing F8 below.

**F4. R121 run-time audit logging is absent — CONFIRMED** (important)
`src/core/store.ts:28`; `src/cli/commands/query.ts:48-52`.
*Reproduction:* After ~25 mutations across every write surface, `.my_context/` contains no operation log of any kind (the only JSONL is the per-ingest applied/rejected log). Frontmatter has valid_from/valid_until only — no created_at/updated_at. Every index row's `updated_at` is index-write time (identical across rows; moves on every rebuild — the code documents this honestly). **Verifier added the decisive proof:** the session ledger lives inside the disposable index — deleting `.index.db` (a supported, by-design action) yields "no such table: ledger". Injection history cannot serve audit retention.
*Impact:* REQ-changes-are-timestamped-and-audited (hard, roadmap-tagged) unmet; git is the only history and the requirement disallows relying on it.
*Fix:* Product decision on scope first. Implementation trap (verifier-flagged): timestamps must be nullable, stamped only at the mutation boundary, excluded from computeItemChecksum, and never defaulted during rebuild — `repair` rewrites files in canonical layout, so a naive stamp breaks R48 byte-identity.

**F5. R132 doc claim false: /LoadMyContext items ARE restored after compaction — CONFIRMED, and strengthened by verification** (important)
`commands/LoadMyContext.md:16-18`; `skills/mycontext/SKILL.md:44-45`; load_context MCP description; `src/help/topics/capture.md:95`; `src/core/inject.ts:74-77`.
*Reproduction:* A fabricated transcript whose ONLY citation of three ids was a simulated load_context result; fresh session id (empty ledger); PreCompact → snapshot contained all three ids; SessionStart(compact) → all three injected IN FULL, the pinned item re-injected, the index rebuilt. Repeated with a single unpinned rule: restored under tier `restored` in the ledger.
*Corrected/strengthened by verification:* the false claim ships on **five** surfaces, not two, and is **pinned by two tests** (`test/plugin-assets.test.ts:30`, `test/mcp/tools.test.ts:960-963`) that assert the false text is present. SKILL.md:44-45 is *more* wrong than first reported: SessionStart(compact) re-runs the pinned tier and rebuilds the index unconditionally. `pre-compact.ts:7-11`'s own comment says the transcript scan exists to catch "what was cited by id after being fetched some other way" — directly contradicting the docs.
*Impact:* The project's characteristic defect class, live in the files that instruct the model every session. Fail direction is benign (over-restoration), but the "run /LoadMyContext again" advice doubles context spend and trains a wrong mental model.
*Fix:* Correct all five surfaces and both pinning tests in one change. Keep the true residual hedge ("usually restored"): rationale items never restore, oversized restore sets spill, >8MB transcript tails truncate. An unhedged "is restored" would be a new false claim of the same kind.

**F6. (folded into F5 — the help-and-docs dimension reported the same defect independently; both verifications concur.)**

**F7. R6 instruction items are not inherently pinned — a CLI-created instruction is inert — CONFIRMED (corrected)** (important)
`src/core/categories.ts:34`; `src/core/select.ts:285`.
*Reproduction:* `mycontext add instruction "Probe instruction pinning" --body x --yes` → `always: false, scope: []`. SessionStart against that workspace: the instruction appeared **only as an index line**; its directive body was never injected; the pinned tier omitted it. `add` has no --always flag; promote --always applies only to drafts, which human-origin adds never are; agents are refused always-changes; the only route is hand-edit + repair.
*Corrected by verification:* "never reaches any agent" was too strong — the id and title do reach every session via the bounded index, and get_item can fetch it. The corrected claim: **the directive text is never injected unprompted, defeating the category's entire mechanic** (spec §3: instruction items are "inherently `always: true` and live in the pinned tier").
*Fix:* Default `always: true` at creation for instruction (honouring resolved config), or refuse `add instruction` without an explicit pin decision. Verifier-flagged risks: the agent path widens (an agent-created instruction draft would carry always:true and auto-pin on promote via the carried-by-the-draft branch, `review.ts:340-380`), and `test/mcp/tools.test.ts:371` pins `always: false` in a create output — a deliberate decision, not a silent default flip.

**F8. R122 answered-question lifecycle has no supported write path — CONFIRMED (one reproduction detail corrected)** (important)
`src/core/mutate.ts:1025-1028` (RELATION_TYPES); `src/core/mutate.ts:1505-1513`.
*Reproduction:* (1) link_items with `superseded_by` → refused, "closest match is supersedes". (2) supersedeItem writes `supersedes [[old]]` onto the replacement and stamps the retired item's status/valid_until, but writes **no** `superseded_by` back-reference — while the corpus standard STD-answered-questions-are-superseded.md:24-25 mandates exactly that relation, and its line-36 claim ("supersedeItem handles this with no special case") is **false by execution**. (3) MCP supersede_item on an ACTIVE open_question → correctly refused (non-human caller). (4) No CLI supersede command; review acts only on drafts. The one conforming corpus item carries superseded_by with `valid_until: null` — consistent only with hand-editing.
*Corrected by verification:* following the "closest match is supersedes" suggestion does NOT write a backwards relation — link_items refuses `supersedes` outright too. The genuinely dangerous step is that **second refusal's own suggestion**, which mechanically maps from/to into `supersede_item(id: <answer>, by: <question>)` — inverted: it would retire the ANSWERING item and install the question as its replacement, and since the answer is often a rationale item, an agent IS permitted to do it.
*Impact:* The lifecycle the corpus standardizes for itself cannot be performed through any supported surface; answered questions either stay active (keep steering agents wrongly — the exact harm the standard names) or accumulate through hand edits.
*Fix:* Have supersedeItem write the back-reference onto the retired item (it already rewrites that file), plus a gated human CLI route (`mycontext supersede <id> --by <id> --yes`, origin human). **Do not** simply add `superseded_by` to RELATION_TYPES — without a mirrored link_items guard that lets an agent assert a retirement-direction relation on a still-active item, precisely what the existing supersedes guard exists to prevent. Also fix the misleading second-refusal suggestion.

**F9. R142/R57 corpus self-conformance: OPENQ-which-mcp-revision still active, contradicting the shipped dual-era server — audit-observed** (minor)
`.my_context/items/open_question/OPENQ-which-mcp-revision-does-claude-code-speak.md:5` — active, scoped to `src/mcp/**`, instructing "do not build a dual-era server on an unverified spec claim". The shipped server IS dual-era (verified live). No DEC item records the negotiated revision (R142 requires one). Because JIT works, any agent editing `src/mcp/**` gets stale guidance injected against the code it governs — the exact failure mode the plugin exists to prevent. *Fix:* verify the revision in a live session, record the decision, supersede the OPENQ — blocked on F8's write path.

**F10. R92 nudge can never fire for NotebookEdit — audit-observed (structural)** (minor)
`hooks/hooks.json:40` matcher is `Write|Edit|MultiEdit`; `src/hooks/post-tool-use.ts:11-16` documents the exclusion as deliberate and WRITING_TOOLS excludes it, so even direct invocation returns ''. Deviation is documented in code but never reconciled with the plan-3 requirement text. *Fix:* either add NotebookEdit (extractFilePath already reads notebook_path) or amend the requirement — a decision, either way recorded.

### 3.2 Architecture

**F1. Dual CLI dispatch: hardcoded switch + registry, hand-kept mirror set, second usage table; builtins silently absorb unknown flags — CONFIRMED** (important)
`src/cli/index.ts:436-459`; `src/cli/commands/registry.ts:30-44`; `src/cli/index.ts:48-60`.
*Reproduction (verifier re-ran):* `rebuild --bogus-flag` → exit 0, flag silently absorbed; same for `show … --yes --whatever`, `help scope --bogus`, `examples decision --garbage`. Every registered command refuses (`status --ful`, `decay --bogus` → exit 1 "unknown option"), as do the two hand-retrofitted builtins (`list`, `add`). `init` dispatches even earlier — before resolveWorkspace. `test/cli/unknown-flag-refusal.test.ts:49-64` hand-special-cases `list` because it is still a switch case; `test/cli/f2-registry.test.ts` iterates only COMMANDS, so builtins sit outside both registry-driven structural guards. The mirror set holds seven names (finding originally said six remained to migrate).
*Impact:* Every CLI-wide convention must be implemented twice; unknown-flag refusal never reached show/rebuild/help/examples; the F2 exit-code guarantee is structural only for registered commands; two usage lists can drift. This is the project's own top defect class — two hand-maintained spellings of one fact.
*Fix:* Migrate the builtins into the registry; generate the whole usage table; delete SHADOWED_BY_SWITCH. **Verifier-identified risks:** (1) `init` currently dispatches BEFORE resolveWorkspace, and resolveWorkspace throws on a corrupt ancestor config — reproduced: today `init` recovers (exit 0 with shadowing warning) where `status` dies; a naive migration breaks init in exactly that recovery scenario — init must keep pre-workspace dispatch or resolveWorkspace must become init-tolerant. (2) The unknown-flag test pins the discovered command set with deepEqual — migrations self-announce rather than silently pass. (3) Applying refusal to help/examples changes exit codes for stray flags — intended, but a behavior change.

**F2. Open-store-then-rebuild ceremony duplicated — six copies (corrected from five), already drifted: only the MCP copy retries a busy rebuild — CONFIRMED** (important)
Bare: `src/cli/index.ts:93`, `src/cli/index.ts:381` (cmdRebuild — the sixth copy the original finding missed), `src/cli/commands/context.ts:73`, `src/core/inject.ts:51`, `src/cli/commands/query.ts:306`. Retried: `src/mcp/tools.ts:223` (withRetry).
*Reproduction (verifier, live):* a helper process held BEGIN IMMEDIATE on `.index.db` for 6s. The bare ceremony **threw "database is locked" after 3333ms** (busy_timeout exhausted); the MCP ceremony under the identical race **succeeded after 6097ms**. `inject.ts:185-186` fails open, so the same race at SessionStart is a silent empty injection.
*Corrections from verification:* six copies, not five; the CLI does not die with a raw error — toCliMessage normalizes to one `my_context: database is locked` line, exit 1; the kill window is specifically a lock landing after Store.open (which has its own 5-attempt retry shared by all surfaces) and before rebuild's write transaction.
*Impact:* The highest-traffic ceremony in the product (every tool call, hook, and command) exists in six hand-copies that already disagree about contention behavior; the next policy change (e.g. R151 roots handling) must land six times or silently diverge.
*Fix:* One `openRebuiltStore(ws)` owner in core holding roots derivation + open + retried rebuild + close-on-throw. **Verifier-identified risk:** withRetry is 8 attempts × up to 3000ms busy_timeout each — blindly centralizing on MCP's policy would take the SessionStart hook from failing open after ~3s to stalling up to ~24s more under contention (stacked on Store.open's own documented 15–23s worst case). Hook-facing callers need a smaller attempts bound. query.ts closes the writer and reopens read-only, so the helper must return the open store rather than encapsulating close.

**F3. loadLayer's unknown-category check is prototype-unsafe: `type: constructor` gets no LoadError — audit-observed** (minor)
`src/core/rebuild.ts:129` — `!config.categories['constructor']` resolves Object.prototype.constructor (truthy).
*Reproduction:* hand-authored items with `type: bogus_type` and `type: constructor`; rebuild reported the unknown-type LoadError for the first only. The item still lands in the index's `ineligible` bucket (select.ts:248 uses `?.enabled`), so it is not fully invisible — but the LoadError channel misses it. R144 is the project's own thrice-recorded rule; mutate/review/ingest all guard this lookup with Object.hasOwn — loadLayer is the one reader that regressed. Reachable only via hand-authored files, which is exactly what loadLayer's error reporting exists for.
*Fix:* `Object.hasOwn(config.categories, item.type)` — one line — plus a `constructor`-typed fixture.

**F4. mutate.ts (1,553 lines) mixes three change-reasons; extract the round-trip validator library and content-identity hashing — audit-observed** (minor, refactoring)
`src/core/mutate.ts:256-721` (~465 lines of validators consumed by non-writing callers like ingest/schema.ts), `:61-154` (identity hashing). R82 argues for keeping trust + persist + the four mutations together — not for keeping pure format/identity functions in the same file. *Fix:* split to core/roundtrip.ts and core/identity.ts with re-export shims; do it when R118/R121 next force edits here, not as standalone churn; move the load-bearing history comments verbatim.

**F5. Enum lists and the relation vocabulary each have a second hand-maintained spelling with no drift test — audit-observed** (minor)
STATUSES/SEVERITIES duplicated at `src/core/mutate.ts:230-231` and `src/mcp/tools.ts:20-21` beside the types.ts unions (three spellings of one fact). `src/help/topics/workflow.md:22-29` hand-lists the eight relations; zero test references RELATION_TYPES. Latent: createItem's validateRelations checks targets, never types — the closed vocabulary is enforced only in linkItems (unreachable today; every current caller passes vetted relations). *Fix:* `as const` arrays in types.ts deriving the unions; a {{RELATION_TABLE}} token or equality test for workflow.md; move the vocabulary check into validateRelations.

**F6. The exclusive-create construction is duplicated wholesale between rebuild.ts and ingest/lock.ts — audit-observed** (minor)
`src/core/rebuild.ts:299-353` and `src/ingest/lock.ts:439-529` each implement temp+linkSync+latched-wx-fallback (~60 lines). The latch duplication is documented as deliberate; the construction duplication is not. This is the codebase's proven-hazard area — the next EPERM nuance must land twice. *Fix:* one `createExclusiveWith(latch, target, content)` with per-caller latch objects; deserves its own red-green pass on both concurrency suites.

**F7. MutationResult.created means "mutated", not "created" — audit-observed** (minor)
`src/core/mutate.ts:52-55` doc-defines it as changed-vs-noop; updateItem (:1372-1374) and supersedeItem (:1490-1491) return `created: true` for non-creating writes. Harmless today (callers use only message/id/status) but guarantees a misleading read for R121's future audit-log writer. *Fix:* rename to `changed` or add a `kind` discriminant **before** R121 consumes it.

### 3.3 Test Quality

**F1. The documented security boundary of `mycontext query` — the read-only connection — is unpinned at its call site: a writable-connection mutant survives all 1401 tests — CONFIRMED** (important)
`src/cli/commands/query.ts:314`.
*Reproduction (verifier re-ran end-to-end):* baseline green (1401/1401); mutant `Store.openReadOnly(ws.dbPath)` → `Store.open(ws.dbPath)`; full suite against the mutant: **1401 pass, 0 fail**. Reverted; diff empty. query.ts:95-98's own comment says "Do not remove the read-only connection on the strength of these checks" — and nothing enforces that instruction. `store-readonly.test.ts` pins engine semantics in isolation; no test observes which open cmdQuery uses.
*Impact:* The inner wall of the defense-in-depth can be silently removed, leaving the explicitly-incomplete denylist as the only barrier, with zero red tests. (Counterweight, also verified: the denylist itself is strong — every write keyword including bracket-identifier forms is refused, which is *why* the mutant is behaviorally invisible through the SQL surface.)
*Fix — must be structural, per the verifier:* the originally sketched behavioral test **cannot** kill this mutant (a passing-assertSelectOnly statement apparently cannot write on this engine). Expose the connection's read-only-ness (e.g. `Store.isReadOnly` asserted through cmdQuery) or spy on Store.openReadOnly in-process. Safe; nothing depends on Store lacking such an accessor.

**F2. No test executes any hook as a real OS process; the PostToolUse 2s stdin-timeout and process-level fail-open are asserted only in a source comment — CONFIRMED** (important)
`src/hooks/post-tool-use.ts:86-99` ("Verified by direct execution").
*Reproduction (verifier re-ran):* grep across test/: the MCP server is the only shipped binary spawn-tested; hook tests import the inner functions in-process. Coverage: post-tool-use.ts 66.38% lines / 28.57% funcs (entry block + readStdin uncovered), session-start.ts 60.42% (entire entry block uncovered), pre-compact.ts 78.95%, pre-tool-use.ts 91.67%, io.ts 87.23%. Fresh spawn probes confirmed every commented claim is TRUE today: garbage stdin → exit 0/empty/84ms; watched-doc payload → correct one-line JSON envelope; stdin held open → exit 0 at ~2078ms via the unref'd timer. True — and pinned by nothing.
*Precision (verifier):* the envelope JSON *shape* is pinned in-process (`buildOutput` test); what has no executable pin is the process wiring — async readStdin accumulation, the 2s timer preemption, the actual stdout write, the exit codes.
*Impact:* The product's highest-traffic surface; spec §11 explicitly demands hook contract tests. A regression in the wiring (timer cleared, readStdin swallowing payload, stray stdout write) ships green — the characteristic defect class, in the place the spec cares most about.
*Fix:* One spawn-based contract test per hook binary, mirroring server-e2e.test.ts. **Verifier constraint:** the stdin-held-open case must remain PostToolUse-only — session-start/pre-tool-use/pre-compact read stdin via synchronous `readFileSync(0)` with no timer (`src/hooks/io.ts:15-21`); holding their stdin open would hang the suite.

**F3. One flake in six full-suite runs: MCP e2e harness's fixed 15s deadline loses to cold-start spawn latency — audit-observed** (minor)
`test/mcp/server-e2e.test.ts:66-67, 137`. Observed once ("expected 2 responses, got 0" at 39.7s wall, cold cache); runs 2–6 green. The historical rmSync flake did NOT recur — the removeTree fix demonstrably holds. *Fix:* await a ping/pong before starting the response clock, or scale the deadline when zero responses have arrived and the child is alive.

**F4. Dead defensive code: rmSyncRetrying retries exceptions removeTree can no longer throw — audit-observed** (minor)
`test/core/ledger.test.ts:16-25`, `test/core/store.test.ts:17-26`. removeTree leak-reports instead of throwing, so the EPERM branch is unreachable — the characteristic defect inside the suite itself. *Fix:* replace both wrappers with direct removeTree calls.

**F5. The items/-specific deny teaching message is unpinned (decision-equivalent mutant; message-only degradation) — audit-observed** (minor)
`src/hooks/pre-tool-use.ts:41`. Disabling the items/** branch survives the 17-test deny suite because the generic fall-through denies anyway and also mentions create_item. The deny *decision* is well pinned (killing denyReason reddens 9/17). *Fix:* assert a phrase unique to the items branch in the item-write test.

**F6. The no-bare-rmsync structural guard is line-based and evadable — audit-observed** (minor)
`test/no-bare-rmsync.test.ts:52`. A multi-line rmSync call or `fs/promises` `rm()` escapes the scan (verified against the regex by construction). *Fix:* comment-strip then scan whole-file with a multi-line-tolerant pattern; add `rm(`.

### 3.4 UX and Usability

**F1. `decay --json` is unparseable when a corpus load error exists — CONFIRMED** (critical within this dimension)
`src/cli/commands/decay.ts:127-136`; contract at README.md:56-60.
*Reproduction (verifier re-ran):* tampered item → `decay --json 1>out.json 2>err.txt` → exit 0, stderr empty, stdout = JSON document (keys window, sessionsRecorded, caveat, counts, cold, unscoped, warm — **no loadErrors**) followed by the plain-text `my_context: error … checksum mismatch …` line. JSON.parse fails. Under identical tamper, status/list/doctor/review/query --json all stay parseable with loadErrors inside the document. decay is the sole deviant of six; README asserts the opposite.
*Impact:* The machine surface silently corrupts (exit 0, empty stderr) exactly on the corpora that need attention — the characteristic defect on a shipped interface contract.
*Fix:* add `loadErrors` to the emitJson document and drop the trailing emitLoadErrors in the JSON branch; pin with a tamper-then-parse test. Verifier: no existing test parses decay --json on a tampered corpus, so nothing breaks.

**F2. `list` with a misspelled or disabled category prints nothing and exits 0 — CONFIRMED** (important)
`src/cli/index.ts:307-308`.
*Reproduction (verifier re-ran):* `list constriant` → zero bytes, exit 0, on a corpus where `list invariant` prints a row. Same for `list policy` (disabled) and `list bogus`; `list bogus --json` returns `{"items":[],"count":0,...}` with no signal. Contrast: `add constriant` refuses with closest-match teaching. Valid-but-empty `list rule` is also zero bytes at default detail — indistinguishable from the typo case.
*Impact:* a user concludes the project has no constraints — the exact silent-empty-answer failure the adjacent comment says was fixed for the --json positional.
*Fix:* validate the positional against resolved categories; refuse unknown names with add's teaching; print "0 item(s)" for valid-but-empty. **Verifier cautions:** do NOT refuse valid-but-disabled categories outright — disabling is non-destructive and a corpus can hold items of a since-disabled type (unverified whether they load; check first); and adding a zero-row line changes output shape scripts may scrape.

**F3. Generated /mycontext:add-<normative-type> commands license the model to run `add … --yes` itself when MCP is down, contradicting SKILL.md — CONFIRMED** (important)
`src/plugin/commands.ts:112-117` (template) → all 10 normative `commands/add-*.md` (e.g. add-constraint.md:23-27).
*Reproduction (verifier):* the fallback text — "If the MCP server is not available, `node …/index.ts add constraint … --yes` captures the same fields from a shell… Prefer the tool" — contains no "print it for the user; do not run it" instruction, inside a document whose other steps are imperatives to the model. SKILL.md:76-78 and help('capture') say the opposite; generated review.md proves the correct pattern exists.
*Nuance (verifier):* permissive-by-omission rather than a literal "run it" — but at the exact failure moment (MCP down, user asked to capture) it reads as licence to compose --yes and create an active governing item with origin human and no review — the precise bypass R129/R130 document.
*Fix:* rewrite the normative fallback to report-unavailable + print-for-the-user + stop; regenerate. **Verifier constraint:** `test/plugin/commands.test.ts:166-172, 241-244` extracts the invocation from a single backtick-closed line and runs it asserting --yes for normative categories — keep the one-line invocation shape or update that test in the same change.

**F4. Capture-nudge defaults: two of three watchedDocs globs are this repo's own SDD layout, and the knob is undiscoverable — CONFIRMED IN CORRECTED FORM (original was overstated)** (important)
`src/core/config.ts:13-17`.
*Corrected claim (per verification):* NOT "inert on any repo not shaped like this one" — `docs/prd/**` is generic and fired in a scratch repo (verified). What is true: `docs/superpowers/specs/**` and `docs/superpowers/plans/**` are the maintainers' own layout, so the nudge never fires for specs/plans kept anywhere else (docs/specs/, specs/, docs/design/, docs/rfcs/ — all verified silent); init writes config.json without the key; `watchedDocs` is mentioned nowhere user-facing (README, skills/, src/help/, commands/); and the spec's own example config disagrees with the shipped default (docs/plans/** vs docs/superpowers/plans/**). Severity stands for adopters whose normative docs are not PRDs.
*Fix:* broaden defaults deliberately (docs/specs/**, docs/plans/**, specs/**); document the key (see §3.5-F3). **Verifier cautions:** writing watchedDocs into init's config freezes it — config.ts:170-172 *replaces*, never merges, so later default improvements never reach existing workspaces; broadened defaults must update the tests pinning current behavior; very broad globs raise nudge frequency (low harm — the nudge self-hedges).

**F5. lesson-accept prints "about to create this rule — review before it becomes active:" then creates unconditionally in the same invocation — audit-observed** (minor)
`src/cli/commands/lesson.ts:238-250`. Non-interactive, no --yes: preview prints, then "created RULE-… (active)". Exit 0, no prompt. The only gate command with no confirmation token, and its message asserts a pause the code does not have. *Fix:* require --yes/interactive confirm like the other four gates, or reword to "creating this rule:"; update the README gate table accordingly.

**F6. The checksum-mismatch error never names `mycontext repair` — audit-observed** (minor)
`src/core/rebuild.ts:147-151`. The message says "Compare it against git history before rewriting it" and stops one step short of the command shipped specifically for this state. *Fix:* append "If this was your own deliberate edit, `mycontext repair` re-stamps the checksum (read its warning first)."

**F7. Re-running `mycontext lesson <existing-id>` reports "recorded" for an item it did not create — audit-observed** (minor)
`src/cli/commands/lesson.ts` (success message). The documented re-derivation path prints the identical "recorded" line on a no-op, against the mutation layer's own "already captured as …" convention. *Fix:* "already recorded — requesting rule candidates:".

**F8. `--yes=false` refusal blames a non-interactive stdin instead of the explicit "no" — audit-observed** (minor)
Shared confirmation path in `src/cli/index.ts`. Behavior is correct (refuses, nothing written — R116 met); the printed reason is wrong and the advice ("Rerun with --yes") invites reversing an explicit refusal. *Fix:* branch the message on explicit-false.

**F9. `examples` and `add` disagree on the allowed category set in their teaching errors — audit-observed** (minor)
examples lists all 20 (including disabled); add lists the 17 enabled. Recoverable one-step contradiction. *Fix:* annotate disabled entries in examples' list.

### 3.5 Help and Documentation

**F1. The /LoadMyContext compaction claim — same defect as §3.1-F5, independently found and independently verified in this dimension.** Both verifications concur on the five-surface footprint and the two pinning tests. See §3.1-F5 for the full record. **CONFIRMED** (important)

**F2. lesson-accept preview asserts an unscoped rule "matches every scope check" — execution shows the exact opposite — CONFIRMED (corrected)** (important)
`src/cli/commands/lesson.ts:242`.
*Reproduction (verifier re-ran end-to-end):* staged an unscoped candidate; lesson-accept printed `scope: (none — matches every scope check)`; `matchesAnyGlob('src/x.ts', [])` returns false (`src/core/paths.ts:44-47`); with the unscoped rule AND a scoped control rule both active, a JIT run injected ONLY the scoped rule — the ledger held one jit row, nothing for the unscoped rule. The derivation request printed minutes earlier states the truth; help('scope') states the truth; even `src/lesson/derive.ts:285`'s comment admits an empty scope "happens to fail inert".
*Corrected by verification:* the wrong message is **NOT pinned by a test** — test/cli/lesson.test.ts:146 quotes it only in a comment; the actual assertions cover string-scope rejection. So the fix needs no test-expectation change.
*Impact:* the false claim sits in the mandatory human preview at the approval gate (R107): a reviewer told the rule fires everywhere may accept/narrow/reject on inverted information.
*Fix:* ~~reword to "(none — never auto-injected; add one during review if it should activate on files)"~~ **RETRACTED 2026-08-15 — DO NOT EXECUTE.** This finding was correct about the code as it stood and wrong about which side was the defect. Spec §3.2 was amended: scope restricts rather than enables, so an unscoped rule does apply to every file and the preview's original wording was true while the implementation was not. The implementation was inverted instead; the preview now reads `(none — applies to every file)`, matching `review promote`, and the two comments were rewritten to the new rule. Executing the fix as written would introduce a false claim.

**F3. The entire configuration surface is undocumented in every shipped help channel — CONFIRMED (scoped)** (important)
*Reproduction (verifier re-ran):* case-insensitive grep for profile/budget/config.json/custom-category/watchedDocs/nudge over README.md, src/help/topics/*, skills/, commands/ → zero instructional hits; the only config.json mentions in any shipped surface are runtime refusal messages. All the features exist and work (verified: profile validation, per-category enabled/tier/description, custom categories, four budgets, watchedDocs).
*Scoping (verifier):* the design spec §4 does document the config schema and README:168 points at the spec — so "undocumented" is true of the help/README/skills/commands surfaces the finding names, not the repo as a whole. The spec is not a substitute reference anyway: its watchedDocs example disagrees with the shipped default.
*Impact:* R17/R19/R20/R21 features are unreachable through shipped help; several user journeys dead-end at a config file with no reference.
*Fix:* a README config-reference section (risk-free) covering profile, categories.<name>.enabled/tier, custom categories, budgets, watchedDocs + the nudge. **Verifier warning:** a fifth help *topic* is NOT risk-free — the topic enum is pinned in the MCP schema (`src/mcp/tools.ts:517-520`), the CLI usage line, spec §9's four-channel table, and help tests; that path needs a coordinated change.

**F4. The global layer (~/.my-context) is completely undocumented while its artefacts leak into user-visible output — CONFIRMED** (important)
*Reproduction (verifier executed the leak):* created a temporary `~/.my-context` with one draft rule → rebuild indexed it; `list --full` showed it with an unexplained `layer: global` column; `status` counted it (draft 1); **`mycontext review` printed "no drafts pending review."** — the documented-nowhere incoherence (reviewQueue filters layer==='project', `src/core/select.ts:193-196`). Project-wins precedence also executed: duplicate id → "the project copy wins and the global one is not indexed. Rename one of them." Zero doc hits for the layer outside the spec pointer.
*Fix:* document location (both spellings per R151), shape, project-wins, and the review-queue exclusion — describing the exclusion as deliberate (global drafts are unwritable from a project; listing them would offer unactionable entries), not as a bug.

**F5. (folded into §3.4-F4 — the watchedDocs finding; the UX-dimension verification's corrected form governs.)**

**F6. decay/status advice "add a scope glob or set always: true" names no route that works on the items it is about — audit-observed** (minor)
`src/cli/commands/decay.ts:50`. Followed for a listed active normative item: update_item scope → refused; update_item always → refused; review promote → refuses non-drafts; no CLI command edits scope/always post-creation. The only working route (hand-edit + repair) is unnamed. R55 requires remediation advice verified by following it; this one dead-ends — and papers over the recorded R136 gap. *Fix:* name the real route or drop the prescription until the follow-up ships.

**F7. README's recommended deny list omits `mycontext lesson-discard`, the destructive twin of the denied `review discard` — audit-observed** (minor)
README.md:119. An agent with Bash can permanently destroy staged rule candidates awaiting review — silently emptying the approval queue — while every neighbouring command is listed. A missing command, not a missing spelling. *Fix:* add `Bash(mycontext lesson-discard *)` and mention it beside lesson-accept.

**F8. `list --full`'s scope column shows the literal "always" for pinned items, hiding their globs — audit-observed** (minor)
`src/cli/index.ts:342`. The one bulk view of scopes conceals them precisely for pinned items; a user auditing scopes after doctor's dead_scope warning must `show` each pinned item. *Fix:* render "always · src/db/**" when both facts hold.

### 3.6 Security and Integrity

**F1. The PreToolUse write-deny is case-sensitive — bypassable on Windows, the first-target platform, via the very Edit/Write tools it covers — CONFIRMED** (important; the audit's most serious security finding)
`src/core/paths.ts:54` — `MANAGED_SEGMENT = /(^|\/)(\.my_context|\.my-context)(\/|$)/`, no `i` flag.
*Reproduction (verifier re-ran end-to-end through the real hook entry):* lowercase native and POSIX spellings → DENY; but `.MY_CONTEXT\…` → ALLOWED, `.My_Context\…` → ALLOWED, 8.3 alias `MY_CON~1\…` → ALLOWED, uppercase global `.MY-CONTEXT\…` → ALLOWED. `dir /x` confirmed the live 8.3 alias. Writes through both spellings verifiably landed inside the REAL `.my_context/`. **The verifier then proved boundary defeat, not just deny bypass: forged `CONST-forged-via-case-bypass.md` (status: active, always: true, origin: human) via `.MY_CONTEXT\items\constraint\`, ran rebuild ("indexed 1 item(s)"), and the index row shows status=active, always=1, origin=human — an agent-authored governing constraint smuggled straight past the §7.1 draft/review gate.** None of the 17 deny tests exercises an uppercase or 8.3 spelling.
*Corrections from verification:* the deny test at line 127 is *incomplete* (no case coverage), not a test whose name asserts a property the code lacks. Counterweight stands: README/SKILL/workflow are emphatic that Bash is the real boundary and the deny is defense-in-depth — an agent with Bash bypasses it regardless. But for the no-Bash agent class, this deny is the entire enforcement.
*Fix:* add the `i` flag (both literals are already lowercase — safe), plus deny tests for uppercase and 8.3 spellings. **Verifier-critical residual: the `i` flag does NOT close the 8.3 vector** — `MY_CON~1` contains no `my_context` substring at all; case-folding cannot match it. Closing it fully requires realpath-style canonicalization before the check, or documenting the 8.3 residual exactly the way R129 documents the Bash residual. On case-sensitive Linux, `i` newly over-blocks a genuinely-different `.MY_CONTEXT` directory — a fail-closed over-block on the one deliberate fail-closed path; negligible. `managedSplit`'s other caller (post-tool-use.ts:53 self-nudge guard) only widens in the desired direction.

**F2. createItem does not guard an explicit `id` against `/` or `..` — a latent arbitrary-file-write primitive, currently unreachable externally — audit-observed** (minor)
`src/core/mutate.ts:910` (filePath), `:855` (the only mint-time guard rejects '', line breaks, ']' — not '/' or '..').
*Reproduction:* through the library, `id:'RULE-x/../../../../MC-ESCAPE2'` wrote **outside the workspace entirely**; `RULE-../../../evil` landed at `.my_context/items/evil.md`. Then confirmed unreachable from every external surface: the MCP schema exposes no id; `add` has no id flag; every internal caller derives ids via slugify-family functions emitting `[A-Z]+-[a-z0-9-]+`.
*Impact:* zero practical risk today; becomes an arbitrary-file-write the instant any future caller forwards a model- or user-supplied id. Also violates R13's slug contract on the explicit-id path.
*Fix:* validate explicit ids against `^[A-Z][A-Z0-9]*-[a-z0-9-]+(-r?\d+)?$` (or at minimum refuse '/', '\\', '..' segments); add a traversal test.

**F3. workflow.md's gate-command enumeration omits `mycontext repair` — audit-observed** (minor)
`src/help/topics/workflow.md:52-54` lists four gate commands; README's table (README.md:85-91) lists all five including repair; SKILL.md names repair. repair IS a route past the draft gate (verified end-to-end: hand-edit + repair --yes launders a governing change past doctor). The honest Bash-boundary sentence is present and covers repair implicitly. *Fix:* add repair to the workflow.md list so the three mandated surfaces agree.

---

## 4. What Is Genuinely Production-Grade

A report that only lists defects would misinform the reader about where the risk is. The following held under deliberate, adversarial, *executed* attack — this is the majority of the product, and it is the hard part:

1. **The trust model.** Every probe on every surface: agent-requested `status:'active'` on the normative tier forced to draft; a smuggled `origin:'human'` argument ignored; non-human status/scope/always/severity changes and supersession of governing items refused with teaching messages; `review promote --all` rejected; `--yes=false` refuses; `--yes=maybe` refused loudly with nothing written. And it is not merely asserted: **20 of 21 hand-built mutants of the security guards were killed by dedicated tests** — trustedStatus (both widening and removal), the guarded-field refusals, all three MCP origin hardcodings, the ingest draft→active belt-and-braces, lesson double-accept, the VACUUM INTO barrier, session-id traversal sanitization, spill disclosure, checksum verification, the query row cap, boolFlag semantics. The one survivor is §3.3-F1, a test gap, not a behavior gap.

2. **The injection engine.** All four tiers verified end-to-end on Windows through the real hook binaries: pinned-in-full at SessionStart; JIT on scope match with once-per-session dedupe and per-session isolation; PreCompact snapshot (ledger ∪ transcript, dead ids and prose-shaped tokens excluded, traversal-shaped session ids sanitized); compact restore without re-restore; rationale never restored; the index listing only what was not injected in full. Spilled items provably stayed eligible and drained over subsequent reads.

3. **Concurrency and atomicity.** Real OS processes, not promises: distinct-body racers → three files, zero lost writers, 8/8 runs; identical racers → exactly one item, every run; the apply lock serialized three processes with zero timeline overlap; **40 writers SIGKILLed mid-write left the target parseable, zero stray temps, doctor clean**. The linkSync-of-a-fully-written-temp construction has no partial-write window on NTFS.

4. **Fail-open, nothing-dropped-silently, teaching errors.** Corrupt index → exit 0, empty JIT output, self-healed SessionStart; garbage stdin → exit 0; malformed YAML → the exact offending line number as a LoadError on every command, with only status/doctor exiting non-zero (R104 verified live) and the error reaching MCP results. Budget overflow disclosed with ids and a fetch command. ~15 distinct refusals across CLI and MCP all met the full R45 contract.

5. **The self-verifying documentation machinery** — where it is wired. Tool descriptions single-sourced and registry-equality-tested; category table generated from resolved config; 38 slash commands byte-identical to their generator, with the generator additionally driven under a different config to kill a hardcoded-list implementation; a custom category documents itself. The failures in §3.5 are precisely the surfaces that *escaped* this machinery — which is the strongest possible argument for extending it, not evidence against it.

6. **Honest engineering culture, unusually so.** The README approval-boundary section reproduces exactly under execution, including its own adversarial narrative (hand-edit → doctor red → repair --yes → doctor green). Comments state what was measured, not hoped (store.ts's WAL-transition retry; query.ts's corrected false WAL claim). `repair` is a model of destructive-command UX. Deliberate duplications carry the reason they must stay separate. doctor/status/decay produce zero false positives on the maintainers' own corpus.

7. **The quality gates.** 1401 tests, 82 files, green in 17–18s, 97.7% line coverage with the pure core at ~100%; chaos tests that assert real behavior (the 8MB-tail test proves the head is NOT read); all six perf ceilings green (JIT hit+miss p95 < 50ms on 5,000 items, selector < 10ms, ledger < 25ms, SessionStart < 500ms); CI configured for both platforms including the perf suite; the test glob quoted as R60 demands.

---

## 5. Systemic Findings

**S1. The characteristic defect is confirmed, quantified, and has a precise address: prose surfaces outside the generation machinery.** Every confirmed truth-defect in this audit — the five-surface compaction claim, the lesson-accept scope line, the STD item's false supersedeItem claim, lesson-accept's "review before it becomes active", the "recorded" no-op message, the --yes=false misattribution, the "Verified by direct execution" comment with no test — lives in hand-written prose: doc sentences, preview strings, comments. **Zero** truth-defects were found in generated surfaces (category table, tool list, slash commands, usage). The corollary is exact: the next false claim will appear in whatever prose surface is written by hand next. The systemic fix is not "be more careful"; it is to keep shrinking the hand-written surface (extend the {{TOKEN}}/equality-test pattern to the relation table, the enum lists, the gate-command lists) and to require an executable pin for any behavioral sentence that cannot be generated (R139, applied to docs).

**S2. Tests can pin falsehoods, and did — twice.** `test/plugin-assets.test.ts:30` and `test/mcp/tools.test.ts:960-963` assert the *presence of false text*. A presence-assertion on a prose claim is drift protection, not truth protection; it actively raises the cost of correcting the falsehood. Presence-pins on behavioral claims should be paired with (or replaced by) behavior tests of the claim itself — the transcript-scan experiment that falsified the compaction claim is ~30 lines and could have been a test from day one.

**S3. Enforcement lives at single points whose selection is untested.** The query boundary (openReadOnly at one call site — mutant survives), the deny regex (one flag short on the target platform — 17 tests, none adversarial on case), the hook process wiring (correct, unpinned). The codebase is excellent at testing *decisions* (the deny fires, the trust refusals fire) and weaker at testing *which mechanism* delivers them. Where a comment says "X, not Y, is the security boundary", there must be a test that reddens when X is swapped out — that is the general form of §3.3-F1, §3.3-F2 and §3.6-F1, and it is where the next security defect will come from.

**S4. Duplication is the leading indicator of the next drift.** Six copies of the open-rebuild ceremony (one already diverged on retry policy), dual CLI dispatch with a hand-kept mirror set and two usage tables, twin enum arrays, twin exclusive-create constructions, a hand-listed relation table. In every historical instance recorded in the ledgers, two spellings of one fact eventually disagreed; this audit caught the rebuild-retry drift live. The consolidation work in the plan's later waves is not tidiness — it is defect prevention with a documented base rate.

**S5. The dogfooded corpus is a governing surface and must be held to the product's own bar.** An active OPENQ contradicting the shipped MCP server is *injected* at whoever edits `src/mcp/**`; a corpus standard makes a false claim about supersedeItem; the one lifecycle-conforming item was hand-edited because no supported path exists (R122). The corpus is not documentation — it is runtime input to every future session. Corpus hygiene (answer/supersede the stale OPENQ, correct the STD item's claim, record the negotiated MCP revision) belongs in the fix plan with the same priority as code.

**S6. The absent requirements are concentrated where the user extended the product beyond the spec — and that is a healthy signal read correctly.** All five absents (R118–R122) are corpus-recorded user requirements postdating the binding spec; four are roadmap-tagged. The system correctly captured, preserved, and injected them — the audit found them *because* the corpus worked. They need the user's decisions, not an implementer's initiative; shipping any of them without those decisions (especially focus before the R120 design) would violate the corpus's own recorded constraints.

---

## 6. Audit Coverage and Limits

Executed across the six dimensions: the full suite 10+ times (1401/1401 green on every clean run; one cold-start e2e flake observed once); the perf suite (6/6); 21 security-guard mutants; every registered CLI command against both the real 39-item corpus and scratch workspaces; all four hooks as real child processes over stdin including chaos inputs; the MCP server over real stdio in both protocol eras; full ingest/lesson/review/repair cycles; real-OS-process concurrency races and a 40-process SIGKILL stress; byte-identity over the real corpus; the Windows deny bypass through to a forged governing constraint; the global-layer leak; the compaction-restore falsification experiment.

Not verified and stated as such: schema migrations (R54), Linux-side CI identity and merge-gating (R27), live-Claude-session duties (R142's canary, /mcp listing, negotiated revision), whether items of a since-disabled category still load (R18 edge), and the historical process requirements (R59/R61) beyond ledger evidence. Nothing in this report depends on any of these.

All audit probes were deleted; the real corpus and its disposable index were left in their pre-audit state.
