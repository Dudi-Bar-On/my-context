# mycontext — Executive Plan to Production Grade

**Date:** 2026-08-14
**Companion to:** `docs/audit/2026-08-14-production-readiness-report.md` (all finding references, e.g. §3.6-F1, point there; all claims below were verified by execution as recorded in that report)

This plan is sequenced by dependency and by risk-retired-per-unit-effort, not by severity alone. It distinguishes three kinds of work: bugs to fix (most of it), truth to reconcile (the project's characteristic defect class), and **product decisions only the user can make** (Section 3 — do not hand these to an implementer).

---

## 1. What must be true before this is production grade

Outcomes, not tasks, in order:

1. **No agent can put anything past the review gate without a human.** Today a no-Bash agent can forge an active governing constraint through a case-variant path on Windows (§3.6-F1). This must be closed (case fix) and its residual (8.3 aliases) either closed or documented exactly the way the Bash residual already is.
2. **Every machine-readable surface stays machine-readable exactly when something is wrong.** `decay --json` must parse under load errors like its five siblings (§3.4-F1); `list` must never return a silent empty answer for a misspelled category (§3.4-F2).
3. **No shipped sentence asserts a property the code does not have.** The five-surface compaction claim, the lesson-accept scope line, the two tests pinning false text, and the eight minor message-truth defects are all closed — and the mechanism that prevented drift elsewhere (generation + equality tests, or behavior tests of the claim) is extended to the surfaces that escaped it.
4. **Every claimed security mechanism has a test that reddens when the mechanism — not just the behavior — is removed.** The query read-only connection (§3.3-F1), the deny's case handling (§3.6-F1), and the hook process wiring (§3.3-F2) are pinned.
5. **The corpus the plugin injects about itself is true.** Stale OPENQ superseded, the STD item's false claim corrected, the negotiated MCP revision recorded — which requires the R122 write path to exist first.
6. **The five absent user requirements have explicit dispositions.** Each of R118–R122 is either implemented per the user's decision, or formally deferred with its corpus item annotated so the production gate is honest about what it excludes. "Unimplemented and injected as if binding" is the only unacceptable state.

Items 1–4 are the production gate. Items 5–6 are the credibility gate for a product whose entire premise is that injected knowledge is true.

---

## 2. The work, in waves

### Wave 1 — Close the boundary and the machine contract (hours to ~1 day; retires the most risk per line changed)

**Goal:** no known bypass, no known contract corruption. Every item here is small, independent, and test-pinnable.

| Work | Closes | Size | Risk |
|---|---|---|---|
| Add `i` flag to MANAGED_SEGMENT (`src/core/paths.ts:54`); add deny tests for `.MY_CONTEXT`, `.My_Context`, `.MY-CONTEXT`, and an 8.3 spelling; document the 8.3 residual beside the Bash residual (README/SKILL/workflow) OR implement realpath canonicalization before the check | §3.6-F1 | XS code + S tests/docs | Low. Both literals already lowercase; Linux over-block is fail-closed on the one deliberately fail-closed path. The 8.3 residual **cannot** be closed by regex — decide: canonicalize or document. |
| `decay --json`: put `loadErrors` inside the emitJson document; drop the trailing emitLoadErrors in the JSON branch; add a tamper-then-JSON.parse test | §3.4-F1, R117/R152/R140 | XS | None found — no existing test parses decay --json on a tampered corpus. Makes README:56-60 true. |
| `list`: validate the category positional against resolved config; refuse **unknown** names with add's closest-match teaching; print "0 item(s)" for valid-but-empty at default detail | §3.4-F2, R63/R140 | S | Do NOT refuse valid-but-disabled categories (legacy items; disable is non-destructive — first check whether such items load, R18 edge). Output-shape change for scrapers is intended. |
| createItem: reject explicit ids containing `/`, `\`, or `..` segments (or enforce the full slug grammar); add a traversal test | §3.6-F2, R13 | XS | None. Latent-only today; cheap insurance before any future surface forwards an id. |
| `rebuild.ts:129`: `Object.hasOwn(config.categories, item.type)`; add the `constructor`-typed fixture | §3.2-F3, R144/R140 | XS | None. |

**Unblocks:** an honest "no known bypass" statement; Wave 5's corpus work is not gated on this but the forged-constraint scenario stops being reproducible.

### Wave 2 — Truth reconciliation (1–2 days; retires the reputational risk)

**Goal:** every shipped sentence is true. This is one themed change-set because half the items share test constraints.

| Work | Closes | Size | Risk |
|---|---|---|---|
| Rewrite the compaction claim on **all five surfaces in one change**: `commands/LoadMyContext.md:16-18`, `skills/mycontext/SKILL.md:44-45`, load_context's MCP description, `src/help/topics/capture.md:95`, `src/core/inject.ts:74-77` comment — AND both pinning tests (`test/plugin-assets.test.ts:30`, `test/mcp/tools.test.ts:960-963`). New wording: manual loads are usually restored (transcript scan); pinned+index return at every SessionStart including compact; re-run /LoadMyContext only if items are missing (ids beyond the 8MB tail; rationale items never restore). Keep the hedge. | §3.1-F5/§3.5-F1, R132/R139 | S | Partial fixes fail the suite or leave lying surfaces — all seven files move together. An unhedged "is restored" would be a new false claim. |
| lesson-accept preview: `scope: (none — never auto-injected; add one during review if it should activate on files)`; update the stale comments quoting the old wording (`src/lesson/derive.ts:281`, `test/cli/lesson.test.ts:144-147`) | §3.5-F2, R107/R14 | XS | None — verifier confirmed no test asserts the string. |
| Normative add-command fallback template (`src/plugin/commands.ts:112-117`): report-unavailable + print the command **for the user** + stop, mirroring review.md; regenerate all 10 files | §3.4-F3, R130/R115 | S | `test/plugin/commands.test.ts:166-172, 241-244` extracts and RUNS the one-line invocation asserting --yes — keep the invocation shape or update that test in the same change. Byte-identity drift test forces regeneration. |
| lesson-accept gate decision: either require --yes/interactive like the other four gates (preview already prints first, satisfying R107) or reword to "creating this rule:"; update README's gate table to match | §3.4-F5, R155/R116 | XS–S | Choose one; the message-asserting-a-pause-that-doesn't-exist state is the only wrong option. |
| Message truth minors: checksum error names `mycontext repair` (§3.4-F6); lesson re-run says "already recorded" (§3.4-F7); explicit `--yes=false` gets an honest refusal reason (§3.4-F8); examples annotates disabled categories (§3.4-F9); workflow.md gate list adds repair (§3.6-F3); README deny block adds `Bash(mycontext lesson-discard *)` (§3.5-F7); list --full shows "always · <globs>" (§3.5-F8) | seven minors | S total | None individually; batch them. |

**Unblocks:** Wave 3's doc-pinning work has stable, true text to pin.

### Wave 3 — Pin the mechanisms (1–2 days; makes Waves 1–2 permanent)

**Goal:** the mechanisms that deliver security and hook behavior redden when swapped out — closing systemic finding S3.

| Work | Closes | Size | Risk |
|---|---|---|---|
| Structural pin of the query boundary: expose `Store.isReadOnly` (or spy on Store.openReadOnly in-process) and assert it through cmdQuery | §3.3-F1, R111/R139 | XS | The behavioral route is a dead end — verifier proved a passing-assertSelectOnly statement cannot write on this engine, which is why the mutant survives. Only the structural pin works. |
| Spawn-based contract test per hook binary, mirroring server-e2e.test.ts: exit 0 + empty output on garbage stdin; correct envelope on a real payload; for PostToolUse only, under-3s exit with stdin held open | §3.3-F2, R56/R33 | M | **stdin-held-open must stay PostToolUse-only** — the other three hooks read via synchronous `readFileSync(0)` with no timer and would hang the suite. Generous bounds so cold-start cannot flake. |
| e2e harness: await a ping/pong before starting the 15s response clock (or scale when zero responses and child alive) | §3.3-F3, R146 | XS | None. Kills the 1-in-6 cold-cache red that history shows corrupts mutation-testing conclusions. |
| Items-branch deny message assertion (unique phrase); delete the two dead rmSyncRetrying wrappers; harden no-bare-rmsync scan (comment-strip, multi-line pattern, add `rm(`) | §3.3-F4/F5/F6 | S | None. |

**Unblocks:** trustworthy mutation testing (green suite is now reliably green); Wave 4 refactors land on a suite that catches wiring regressions.

### Wave 4 — Mechanics the spec promised (1–2 days; needs two small user confirmations, flagged in §3)

**Goal:** shipped categories and lifecycles do what the spec and corpus say they do.

| Work | Closes | Size | Risk |
|---|---|---|---|
| R122 write path: supersedeItem writes the `superseded_by` back-reference onto the retired item (it already rewrites that file); add a gated human CLI route (`mycontext supersede <id> --by <id> --yes`, origin human — registry command, F2-conformant); fix the supersede_item refusal whose suggestion mechanically inverts into retiring the *answer* | §3.1-F8, R122/R85 | M | **Do not** add `superseded_by` to RELATION_TYPES without a mirrored link_items guard — it would let an agent assert retirement-direction relations on active items. Round-trip tests must cover the new relation on retired items. |
| R6 instruction pinning: default `always: true` at creation for the instruction category (resolved-config-aware), or refuse `add instruction` without an explicit pin decision — per the user's call (§3, D6) | §3.1-F7, R6 | S | Agent path widens (drafts carry always:true through promote); `test/mcp/tools.test.ts:371` pins `always: false` in create output — deliberate test updates, and review's confirm text already handles the carried-pin case. |
| Corpus hygiene (now unblocked by the R122 path): supersede OPENQ-which-mcp-revision with a recorded DEC of the negotiated revision (needs one live session check); correct STD-answered-questions-are-superseded's false supersedeItem claim; re-stamp via supported surfaces only | §3.1-F9, R142/R57 | S | Requires a live Claude Code session for the revision check — cheap, but schedule it. |
| watchedDocs: broaden defaults deliberately (add docs/specs/**, docs/plans/**; decide on bare specs/**); reconcile with the spec's example; update the pinning tests | §3.4-F4 (corrected form), R92/R39 | S | Do NOT write the key into init's config.json as the fix — config replaces rather than merges (config.ts:170-172), freezing defaults at init time. Broader globs raise nudge frequency; acceptable (self-hedging ~30-token nudge), but choose deliberately. |
| Documentation of config + global layer: a README reference section (profile, categories.<name>.enabled/tier, custom categories, budgets, watchedDocs + nudge; ~/.my-context location/both spellings/project-wins/review-queue exclusion-as-deliberate) | §3.5-F3/F4, R17/R22 | S | README section is risk-free. A fifth help *topic* is NOT — topic enum pinned in MCP schema, CLI usage, spec §9's four-channel table, help tests. If the user wants it as a topic (§3, D7), it is a coordinated change. |
| NotebookEdit: implement (matcher + notebook_path payload) or formally amend the requirement — per the user's call (§3, D8) | §3.1-F10, R92 | XS either way | None. The wrong state is the current one: code deliberately deviating from a requirement nobody amended. |

**Unblocks:** Wave 5's product features land on a truthful corpus and complete lifecycle; the R136 gap gets a partial route (the supersede command) pending D5.

### Wave 5 — Structural consolidation (2–4 days; do when next touching these files, not as standalone churn)

**Goal:** one spelling per fact — closing systemic finding S4 before it produces the next drift.

| Work | Closes | Size | Risk |
|---|---|---|---|
| One `openRebuiltStore(ws)` owner for the six open-rebuild copies, with **caller-class retry policy**: MCP keeps 8 attempts; hooks get a small bound so SessionStart cannot stall ~24s+ under contention before failing open; helper returns the open store (query closes and reopens read-only) | §3.2-F2, R88/R152 | M | The verified live race (CLI dies at 3.3s where MCP survives at 6.1s) becomes the regression test. Blind centralization on MCP's policy is the named hazard. |
| Migrate the seven builtins into the command registry; generate the whole usage table; delete SHADOWED_BY_SWITCH and the second usage list; unknown-flag refusal + F2 apply uniformly | §3.2-F1, R103/R104 | M | `init` must keep pre-resolveWorkspace dispatch (verified: it currently recovers from a corrupt ancestor config where other commands die) or resolveWorkspace must become init-tolerant. The deepEqual command-set pin self-announces each migration. help/examples exit codes change for stray flags — intended. |
| Single-source STATUSES/SEVERITIES (`as const` in types.ts); {{RELATION_TABLE}} token or equality test for workflow.md's relation list; move the relation-vocabulary check into validateRelations | §3.2-F5, R43/R46/R86 | S | None; mechanical. |
| Extract `createExclusiveWith(latch, …)` shared by rebuild.ts and ingest/lock.ts, preserving per-caller latch independence; red-green pass on both concurrency suites | §3.2-F6, R134/R101 | S–M | Subtle code; the suites pin behavior, but this one earns its own careful pass. |
| Rename MutationResult.created → `changed` (or add a `kind` discriminant) | §3.2-F7 | XS | Compiler-driven. **Must precede R121's audit-log writer.** |
| Split mutate.ts: core/roundtrip.ts (validators + normalizeObservations), core/identity.ts (hashing); mutate keeps trust + persist + mutations with re-export shims | §3.2-F4, R82 | M | Pure moves; do it when D1–D3 force edits here anyway; move history comments verbatim. |

**Unblocks:** R121's implementation (needs `changed`/`kind` and the mutation-layer single owner); every future CLI command inherits conventions for free.

### Wave 6 — The absent requirements (sized only after Section 3 decisions; ~1–3 weeks depending on scope chosen)

**Goal:** R118–R121 per the user's decisions. Ordering within the wave is forced by dependencies:

1. **R120 design first** (a decision + a recorded corpus item, not code): classify relations load-bearing (blocks, constrains, mitigates) vs referential (derived_from, relates_to, links_to); choose disclose-don't-override; supersede the OPENQ via the Wave-4 path.
2. **R121 audit log** next if approved (it should observe everything later features do): append-only JSONL under `.my_context/`, written by the mutation layer and the hooks' ledger writes; created_at/updated_at nullable, stamped only at the mutation boundary, **excluded from computeItemChecksum, never defaulted during rebuild or repair** (the verified byte-identity trap); query/report surfaces on CLI + MCP.
3. **R118 domains**: closed set in config, one indexed column, default domain absorbs existing items, filters on commands/reports, no per-domain budgets; a config `domains` key present without code support must warn (today it is silently ignored).
4. **R119 focus last**, on top of R120's design and R118's domains: focus subcommands + mirrored MCP tools, session state file, spill-style disclosure ("N items hidden by focus"), severity:hard exemption, preview command.

**Risk:** highest of any wave — new schema column, new state file, new log — which is why it sits atop a consolidated Wave-5 base and behind explicit decisions.

---

## 3. Product decisions the user must make

These are **not bugs**. Each is a recorded requirement or open tension whose resolution shapes the product; an implementer choosing unilaterally would be guessing on your behalf. The audit's only demand is that each gets an explicit disposition — implemented, deferred-and-annotated, or rejected-and-superseded.

**D1 — Domain grouping (R118).** Do you still want it, and what is the closed set? Your corpus item fixed the core design (one domain per item, indexed column, default domain, no per-domain budgets). Remaining calls: the actual domain names, whether `init` seeds a default set, and whether a disabled domain's items stay listed (index-only) or vanish from listings too. *If deferred:* annotate REQ-items-carry-a-domain so an active hard requirement stops being silently unmet.

**D2 — Session focus (R119) + the R120 design question.** R120 blocks R119 by your own recorded OPENQ. The tractable answer the OPENQ's observations already lean toward: classify relations, never silently orphan a load-bearing one, disclose ("N items hidden by focus, M dangling load-bearing relations"). You must ratify the classification and decide whether focus can hide an item that a visible item `blocks`/`constrains` — disclose-and-allow vs refuse-to-hide. Focus does not ship until you answer.

**D3 — Audit logging scope (R121).** The requirement as recorded is broad (creates, updates, supersessions, injections per session/tier, focus changes, ingests, rebuilds). Decide the retention scope now: full operation log, or mutations-only first with injection logging later? The verifier proved the current ledger dies with the disposable index, so *any* retention beyond zero requires the new log. Also decide: is the log queryable via MCP (agents can read their own history) or CLI-only?

**D4 — Answered-question lifecycle surface (R122).** The back-reference fix is a bug fix (Wave 4). The *surface* is your call: a dedicated `mycontext supersede <id> --by <id> --yes`, or folding retirement of active open_questions into `mycontext review`? The dedicated command is more general (it also gives humans a supersede route for any governing item — partially closing the R136 gap); review-folding keeps the surface smaller. Pick one.

**D5 — The R123/R128/R136 tension: how does a human change scope/always/severity/status on a governing item?** Today the only route is hand-edit + repair, and the update_item refusal *instructs* it — while R128 says docs must never instruct hand-editing. Three options: (a) accept and document hand-edit+repair as the blessed route (delete R128's prohibition), (b) ship a gated `mycontext edit <id> --scope/--always/--severity --yes` command (closes R136 properly; the decay advice in §3.5-F6 becomes honest), (c) keep the status quo and fix only the decay advice wording. (b) is the coherent product; it is also new gate surface for the R129 deny list. Your call.

**D6 — Instruction category default (R6).** The spec says instruction items are inherently pinned. Confirm you still want that given the verified consequence: agent-created instruction drafts would carry always:true and auto-pin on promote without anyone typing --always. Alternative: `add instruction` refuses without an explicit `--always`/pin acknowledgment, keeping pinning a visible human act. Either satisfies the spec's intent; they distribute the friction differently.

**D7 — Config documentation form.** README section (free) or a fifth help topic (coordinated change across MCP schema, CLI usage, spec §9's four-channel table, help tests)? The README section can ship in Wave 4 regardless; the topic is a product-surface decision.

**D8 — NotebookEdit nudge (R92).** Implement or formally amend the requirement. Two-line decision; the only wrong state is the current undocumented deviation.

**D9 — The 8.3 residual (§3.6-F1).** After the case fix, `MY_CON~1` still bypasses the deny on volumes with short-name generation enabled. Options: realpath-canonicalize every checked path in the hook (small perf cost on the hottest path — measure against the 50ms ceiling), or document the residual beside the Bash residual as an accepted limitation. Security posture call.

---

## 4. Do not do this

Tempting changes the audit's evidence says would make things worse:

1. **Do not add `superseded_by` to RELATION_TYPES without a mirrored link_items guard.** The verifier showed this would let an agent assert a retirement-direction relation on a still-active item — exactly what the existing supersedes guard prevents. Write the back-reference in supersedeItem instead (§3.1-F8).
2. **Do not wrap every rebuild in the MCP's withRetry policy when centralizing the six copies.** Eight attempts × 3s busy_timeout turns SessionStart's ~3s fail-open into a potential ~24s+ stall under contention, stacked on Store.open's own 15–23s worst case. Hooks need a smaller bound (§3.2-F2).
3. **Do not fix the compaction claim on fewer than all five surfaces plus both pinning tests, and do not over-correct it.** A partial fix leaves lying surfaces or a red suite; an unhedged "is restored" is a new false claim (rationale items never restore; >8MB tails truncate; restore budget spills) (§3.1-F5).
4. **Do not try to kill the query mutant with a behavioral SQL test.** The verifier proved a statement passing assertSelectOnly cannot write on this engine — the denylist is why the mutant is behaviorally invisible. Only the structural pin works (§3.3-F1).
5. **Do not spawn-test stdin-held-open against session-start, pre-tool-use, or pre-compact.** They read stdin synchronously with no timer; the suite hangs. PostToolUse only (§3.3-F2).
6. **Do not make `list` refuse valid-but-disabled categories.** Disabling is non-destructive; a corpus can hold items of a since-disabled type, and hiding them behind a refusal is a new silent-drop. Refuse unknown names only (§3.4-F2).
7. **Do not "fix" watchedDocs by writing the key into init's generated config.** Config replacement semantics freeze the array at init time, and every future default improvement silently skips existing workspaces. Broaden the defaults and document the key (§3.4-F4).
8. **Do not stamp created_at/updated_at in writeItem, and do not include them in the checksum.** repair and rebuild rewrite files in canonical layout; a naive timestamp breaks the R48 byte-identity guarantee that is the product's ultimate recovery path (§3.1-F4). Never weaken a byte-identity assertion to make it pass (R48's own rule).
9. **Do not hand-edit the corpus to fix the stale OPENQ and STD items.** That is the exact unsupported route the product forbids; build the R122 path first, then retire them through it. The corpus must be maintained through the product's own surfaces or the dogfooding signal dies (R57).
10. **Do not add `review promote --all`** — not even as a "migration convenience" for Wave 6's default-domain backfill. R109 exists because bulk promotion defeats the gate the queue provides.
11. **Do not raise perf ceilings to absorb new work** (canonicalization in the deny, audit-log writes in hooks). Fix the cause or move the cost off the hot path; the ceilings are the requirement (R34/R79).
12. **Do not rename ~/.my-context** while documenting it (Wave 4). It is a data path, not identity; a rename requires a migration (R151).
13. **Do not migrate `init` into the registry naively.** It dispatches before resolveWorkspace on purpose — that is what lets it recover a workspace with a corrupt ancestor config, verified live (§3.2-F1).
14. **Do not add presence-pins on new prose claims.** Two tests currently assert false text is present (S2). Pin behavior, or generate the prose; a presence-pin on a hand-written behavioral sentence protects the drift, not the truth.
15. **Do not ship focus, domains, or the audit log ahead of their Section-3 decisions** — especially focus before R120. The corpus's own active hard OPENQ says "DESIGN THIS BEFORE IMPLEMENTING"; shipping past it would have the product violate the very kind of recorded constraint it exists to enforce.

---

## 5. Summary sequencing

```
Wave 1 (hours–1d)   boundary + machine contract      ── no decisions needed
Wave 2 (1–2d)       truth reconciliation             ── no decisions needed
Wave 3 (1–2d)       pin the mechanisms               ── no decisions needed
Wave 4 (1–2d)       spec-promised mechanics + docs   ── needs D4–D9 (small calls)
Wave 5 (2–4d)       structural consolidation         ── no decisions; schedule with adjacent work
Wave 6 (1–3wk)      R118–R121 product features       ── blocked on D1–D3; ordered R120 → R121 → R118 → R119
```

Waves 1–3 contain zero product decisions and close every confirmed important finding except the two that need a user call (instruction pinning, R122 surface). A release cut after Wave 3 is defensible as "production grade for the shipped feature set, with recorded deferrals"; a release cut before Wave 1 is not.
