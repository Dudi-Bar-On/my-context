# A2 — Honesty adversary

**Panel seat:** honesty adversary. My job is not to like the feature set. It is to find where it
would make the product assert a property the code does not have — the defect class this repository
has recorded 30+ times, and once recorded *in the disclaimer itself*, when
`docs/design/web-ui-mockup.md` listed the 0.55 ms p95 among its fabricated numbers and had to
correct itself with *"a disclaimer is checked as carefully as a claim."*

**The standard.** Spec §1: *"The test every screen must pass: does this do something a terminal
genuinely **cannot**? Not 'is this nicer' — nicer is real but does not justify a new surface. A
prettier `list` is a trap."* And the sentence that makes it a test rather than a slogan:
*"§4 now grades every screen against that test, **including the ones that fail it**. … A test the
document exempts its own proposals from is not a test."*

**Marks.** `[V]` verified against a file, with the fragment quoted. `[M]` measured or executed.
`[R]` reasoned.

**Verdict vocabulary**, and it is §4's, not mine:

- **PASSES** — does something a terminal genuinely cannot.
- **CONDITIONAL** — passes *only* in a named form; built without it, cut. (§4's own device, applied
  to Learn: *"Built without it, this screen is a documentation viewer and should be cut."*)
- **EXCEPTION** — fails the test, is kept anyway, and the exception is written down with what would
  retire it. (§4's own device, applied to `status` and to the git strip.)
- **FAILS** — a terminal does this. Cut it, or fold it into something that passes.
- **n/a** — not a screen or a feature: a mechanism, a test, or the repair of a defect. §1 grades
  screens; it does not grade a bug fix.

---

## The §1 test, applied

### A. `01-coverage.md` — the exposure proposals

| Feature | Source | Verdict | Reason |
|---|---|---|---|
| `#/item/:id` as a **route** | 01 gap 1 | **FAILS** | `mycontext show <id>` in a browser. The report's own justification is *"15 of 27 item fields are unrenderable"*, which is a completeness argument, not a §1 argument. `[R]` |
| The same content as the **shared detail pane** | 02-ia | **PASSES** | The pane carries `injection()`'s terms × `matchesScope`'s path set × the delivery series × pending revisions × the ego graph at radius 1. Five subsystems on one object is not a terminal shape. The route fails and the pane passes, and the difference is the join. `[R]` |
| `#/agent` — 14 MCP tools, 62 params | 01 gap 2 | **CONDITIONAL** | Schemas alone are `tools.ts` in a browser. It passes **only** in the form 01 itself names: each tool joined to *which of your 21 categories will stage vs apply its result*, and its firing count from the projection. Built as a schema dump, cut it. `[V]` `mcp/protocol.ts:193` · `capabilities: { tools: { listChanged: false } },` |
| Inverse palette-coverage test | 01 gap 3 | **n/a — adopt** | A test, not a screen. It closes a genuinely invisible gap: the def contract is one-directional. `[V]` plan 2 Task 10 · *"a def must never advertise a flag its command refuses."* |
| Focus composer (`--tag/--category/--scope/--clear`) | 01 gap 4 | **CONDITIONAL** | `mycontext focus --preview` already exists `[V]` `focus.ts:148`. What passes is the axis pickers over the real tag/category sets **plus** the dangling-relation rendering; the preview text alone does not. |
| Slash-command second composed form | 01 gap 6 | **EXCEPTION** | A string. Kept because 66 `commands/*.md` are the surface most plugin users touch first and the UI never names them, and because it is generated from the same category set as the shell form — near-zero cost. Retire it if the palette ever fails to generate both from one source. `[V]` `ls commands/*.md` → 66 |
| Closed-vocabulary pickers for `relation` / `status` | 01 gap 7 | **n/a — adopt** | Repair of a defect, not a feature. Free text over an 8-member closed vocabulary is the exact thing `commands/link.md` was written to prevent. `[V]` `vocabulary.ts:42-45` |
| `#/hooks` — four rows, matcher, timeout, last firing | 01 gap 8 | **CONDITIONAL** | Matcher and timeout are `cat hooks/hooks.json`. **Last firing time from the projection** and *"is this installed"* are the half that passes. |
| `audit --files` segment rollup in the UI | 01 gap 10 | **FAILS** | It is `mycontext audit --files`. Put it on a diagnostics line, not a screen. |
| Ingest + lesson queues on `#/work` | 01 gap 11 | **PASSES** | Not as queues — as the **rejection grouping** (below, cap 13). `.rejected.jsonl` is read by nothing today. |
| Global-layer browser | 01 gap 12 | **FAILS** | `mycontext list` against `~/.my-context`. A layer facet on existing lists, not a surface. |

### B. `02-ia.md`

| Feature | Source | Verdict | Reason |
|---|---|---|---|
| Three-group rail (Injection / Evidence / Change) | 02 | **n/a — adopt** | IA, not a screen. The argument that Core/Work/Watch/Report *names the build* is correct and the W1/W2/W3 badges are the proof. |
| Universal detail pane | 02 | **PASSES** | See above. It is the single structural fix in the whole panel. |
| **The why-not panel** | 02 journey (a) | **PASSES — strongest in the panel** | `select()` applies its gates in a fixed order, so exactly one gate fails first. No command prints which. `mycontext show` prints the item; `doctor` prints findings; neither answers *"which gate stopped this item on this path."* It composes `injection()` rather than re-deriving it, which is what keeps it honest. `[V]` `injection.ts:42` |
| Provenance bar | 02 | **n/a — adopt** | Not a §1 pass and should not be defended as one. It is an honesty mechanism: seven staleness axes given one renderer instead of seventeen chances to forget one. Adopt it *because* it is the mechanism, not because a terminal cannot do it. |
| Global composer (replacing `#/palette`) | 02 | **CONDITIONAL** | Composing a command string is typing. The **effect preview**, the two-answer glob tester and the overlap check pass. A composer without the preview is a form that builds a string you could have typed. |
| Facet-first item list | 02 | **FAILS** | `mycontext search` with filters, plus counts `status --json` already emits. Keep as substrate; it is not a reason to open the app. |
| *"3 items declare a scope one segment away"* | 02 journey (b) 4 | **PASSES, with a label** | Needs the tree and the corpus together. But it is a **string ranking**, not a match — 02 already says *"never a second matcher"* and *"if it cannot be built that way, cut it."* Keep that sentence as binding, and render it as a guess. |
| Cut `status`, cut `Learn` as a destination, cut the wave badges | 02 | **n/a — agree** | The spec already licensed the `status` cut in Decision 5's consequence. `Learn` collides with R4; see below. |

### C. `03-interaction.md`

| Feature | Source | Verdict | Reason |
|---|---|---|---|
| Composed-command lifecycle (`ready/armed/landed/diverged/stale/not-seen`) | 03 | **PASSES** | A terminal cannot tell you the string in your clipboard went stale before you pasted it. `stale` and `diverged` are the states that matter and nothing today has a rendering for them. |
| `POST /api/preview` — one counterfactual endpoint, closed change-kind set | 03 | **PASSES** | *"`select()` is pure — run it twice and diff"* is the cleanest §1 argument available. The closed-set-of-change-kinds discipline is the right mirror of the no-SQL decision. |
| Corpus fingerprint on `/api/ping` + landing predicate | 03 | **PASSES** | The receipt. And the discipline — the user agrees in advance to what counts as proof — is the honest form. |
| argv as chips; copy **blocked** on a value that survives quoting | 03 | **PASSES** | `[V]` Decision 6.1 demonstrated `DEC-$(echo SUBSTITUTED)` reaching a copy-paste-ready command on `1.0.1`. The UI is the last surface before the user's shell. |
| Two-answer glob tester | 03 | **PASSES** | `matchesAnyGlob` and `matchesScope` are different questions and `select.ts` documents the defect of merging them by name. One number teaches the defect. |
| Bulk fan-out with per-row precondition exclusions | 03 | **PASSES** | *"5 selected · 3 composable · 2 excluded"* is better than a shell `for` loop, which finds out one at a time. The exclusions are the value and the report says so. |
| Newline-separated clipboard payload, never `&&`/`;` | 03 | **n/a — adopt** | And the reason given is the load-bearing one: chaining would stop each line matching the fourteen `Bash(mycontext … *)` deny rules. `[V]` spec §2 · `README.md:3967-3980` |
| `--yes` as a visible toggle | 03 | **EXCEPTION** | A checkbox. Kept because §2's own value for `--yes` is *legibility* — *"an explicit, greppable token in the transcript"* — and a toggle makes that legible one moment earlier. Retire it if it ever becomes a default nobody reads. |
| Keyboard model, 9 bindings, `?` sheet | 03 / 06 | **n/a — adopt** | Chrome. 06's constraints govern: off by default, `event.code` not `event.key`, one table generating both handlers and sheet. |
| **Budget simulator: "render the ranked list once, animate a cut line"** | 03 preview rule 4 | **FAILS — and it would draw a false picture** | See *Claims the data cannot back* #3. The prefix property 03 marks `[?]` is answerable and the answer is **no**. |

### D. `04-visual.md`

| Feature | Source | Verdict | Reason |
|---|---|---|---|
| Real type / spacing / radius / elevation scales | 04 | **n/a — adopt** | System discipline, correctly diagnosed as the actual weakness. |
| `--panel-2` + dark-mode inset highlight | 04 | **n/a — adopt** | And it is the mechanism R5 needs; see below. |
| Motion only where it reports a real change | 04 | **n/a — adopt** | |
| Gold stays rare | 04 | **n/a — adopt, and it governs R5** | *"the moment gold appears on something that doesn't mean 'pinned/governs', it stops being a signal and starts being wallpaper."* |
| Reject `backdrop-filter` glassmorphism | 04 | **n/a — in direct conflict with R5** | Resolved below. |
| Word-level `<ins>`/`<del>` in the review diff | 04 | **PASSES** | 04's own claim is right: a terminal shows a two-column diff; word-level colouring inside a table cell is not something `diff` does pleasantly. |
| **30px treatment for "the measured number" (0.55 ms p95)** | 04 | **FAILS as stated** | The number is real `[V]`. The *pattern* does not transfer to a live product. See *Claims the data cannot back* #8. |

### E. `05-dataviz.md`

| Feature | Source | Verdict | Reason |
|---|---|---|---|
| **Pinned coverage hoisted out of the tree into a band** | 05 §0(b), §1 | **n/a — adopt as a correctness fix, first** | Not a feature. `/api/coverage` computes `pinned` and the screen colours that directory a gap; a pinned item is injected at every session start regardless of path. This is a **false statement rendered in the flagship graphic**, and it is the single highest-priority item in the whole panel. |
| Directory rollup + density rail + "where coverage changes" expansion | 05 §1 | **PASSES** | A directory as a *density* rather than a state is honest, and no table has the second axis. |
| Budget ribbon with **positional** ghost lane | 05 §2 | **PASSES** | *"Drawing spills as a list under the bar would render the algorithm as priority truncation — a picture of a selector this product deliberately does not have."* Correct, and it is drawing the mechanism rather than the summary. |
| Tier that never ran drawn **absent (hatched)**, never empty | 05 §2 | **n/a — adopt** | *"'Ran and delivered nothing' and 'never ran' are different facts."* |
| "Headroom is not opportunity" | 05 §2 | **n/a — adopt** | |
| Admission staircase, exact breakpoint sweep, **downward eviction steps** | 05 §3 | **PASSES** | And it is the correct rendering of first-fit. This is the version of the simulator that ships. |
| Snap the slider to rungs | 05 §3 | **n/a — adopt** | Converts a continuous control into the discrete choice it actually is. |
| Recency comb (days since last injection) | 05 §4 | **PASSES, with one required exclusion** | See *Claims the data cannot back* #2 — `restored` rows must be excluded or marked. |
| 90-day delivered/spilled heatstrip from `audit_item` | 05 §4 | **PASSES** | Correctly sourced from the projection, not the ledger, and 05 says why. |
| `unrestricted` as a `∀` marker, never a third stacked bucket | 05 §4 | **n/a — adopt** | `decay.ts`'s own comment: *"a consumer that sums `cold + warm + unrestricted` double-counts."* `[V]` |
| Cold **pinned** item gets a distinct ring: *"pinned, yet cold — it spilled"* | 05 §4 | **PASSES** | A budget bug found by a decay chart. |
| Ego graph: five directional columns, ids not titles | 05 §5 | **PASSES** | And the ids-not-titles decision removes SVG bidi from the product entirely. |
| Audit pulse strip | 05 §6 | **PASSES** | Pre-attentive density over 20 minutes has no terminal form. |
| **Focus record as a full-width rule across the feed** | 05 §6 | **PASSES** | *"everything below this line was selected from a different corpus."* This is the best single encoding decision in the panel. |
| `tokens` absent → hatched void, never a zero-height bar | 05 §6 | **n/a — adopt** | The field's own doc comment forbids the alternative. `[V]` `audit.ts:194-199` |
| Selected-but-not-delivered diverging bar (7a) | 05 §7a | **PASSES** | `audit_item.role='spilled'` is indexed and the schema comment says *"counting those by item is how a user finds a budget that is too small."* Nothing renders it. |
| Session ribbon (7b) | 05 §7b | **CONDITIONAL** | The ribbon passes on audit data alone. The *join sentence* (*"of 47k in use, 6.2k came from your project knowledge"*) requires the status-line bridge, which does not exist in shipped code `[V]` Decision 6. 05's *"Every field it needs already exists"* is false for the total; the preceding clause hedges it and the hedge must be the sentence that ships. |
| `injection()` returns a stable `code` alongside `phrase` | 05 §1 | **n/a — adopt** | Colouring by string-matching English prose is the *"thirteen renderings of an empty scope"* defect in a new medium. |
| `SpilledRef.cost` | 05 §2 | **n/a — adopt** | `fitToBudget` holds the number and throws it away into a prose `reason`. |
| `globPrefix()` in `paths.ts` + property test | 05 scale §2 | **n/a — adopt, with the guard as written** | *"a pruner is exactly the shape that becomes"* a second implementation. The property test is the whole price of admission. |

### F. `06-a11y.md`

Findings 1–31 are **n/a — defect repairs**, and I am not grading a WCAG failure against §1. Three
carry design weight:

| Feature | Source | Verdict | Reason |
|---|---|---|---|
| String table: named placeholders, **node** substitution, no markup in values | 06 finding 1 | **n/a — adopt, first** | It closes bidi isolation, CSP compliance, the `innerHTML` trust boundary and the plural contract in one change. It is also the mechanism R1, R2 and R3 all need. |
| Coalesced live region for the audit stream | 06 | **n/a — adopt** | A burst of forty records must be one utterance. |
| Shortcut layer off by default; `event.code` not `event.key` | 06 | **n/a — adopt** | `[M]` on the Hebrew layout the `G` key emits `ע`, so a `key`-based binding works in exactly one of the two shipped languages. |

### G. `07-arch.md`

All ten changes are **n/a — mechanisms**, and every one should be taken. Three carry a caveat:

| Feature | Source | Verdict | Reason |
|---|---|---|---|
| §0-rows-landed checker | 07 change 1 | **n/a — adopt, highest leverage in the panel** | `[V]` Plan 1's §0 records the `focus` and `readSeen` corrections and Task 8 still specifies `seen: ledger.seen(session)`. *"A corrections table is a log, not a patch."* Two greps. |
| Path routing; fragment reserved for the nonce | 07 change 4 | **n/a — adopt, but re-argue it against §2** | It is a change to how the credential is handed off. It looks right (`Referrer-Policy: no-referrer`, fragment-only nonce) and it must be argued in §2's terms rather than adopted as a routing convenience, because §2 is the section this project has already got inverted once. |
| Trusted Types | 07 | **n/a — adopt as stated** | Correctly hedged: *"the guarantee is Chromium-shaped today."* Keep the hedge. |

### H. `08-onboarding.md`

| Feature | Source | Verdict | Reason |
|---|---|---|---|
| The **five zeroes** taxonomy | 08 | **n/a — adopt, and generalise it** | *"An unlabelled empty region is an unsourced claim."* This is the best honesty idea in the panel and it is not a screen. |
| Suppress a per-row marker when the value is uniform and its cause is global | 08 | **n/a — adopt** | *"1,284 dashed dots are 1,284 correct renderings of one sentence."* |
| Start-here strip as **predicates over observed state** | 08 | **PASSES** | And the reason it passes is structural: the UI cannot write, so the checklist has no state of its own and cannot be falsely completed. |
| *"the file in your repo that will make your item fire"* | 08 step 4 | **PASSES** | Needs the tree and the scope together. Genuine, and offered at the moment it is worth something. |
| Bootstrap document scan (*"these read like they contain rules"*) | 08 | **PASSES, with its three constraints binding** | Label it a guess; show the evidence sentence; **count nothing**. Those three sentences are the whole difference between this and a fabrication. |
| `mycontext ui` refusing in an uninitialised repo | 08 | **n/a — adopt** | *"A server that opens a store in a directory that does not exist is doing something mutation-shaped to answer a read."* |
| Day-one `watchedDocs` mismatch | 08 | **PASSES** | `[V]` `config.ts:74-78` — the three defaults are `docs/superpowers/specs/**`, `docs/superpowers/plans/**`, `docs/prd/**`: the plugin author's own paths. On a typical repository the nudge never fires and nothing says so. |

### I. `09-workflows.md` — the eighteen capabilities

| Feature | Source | Verdict | Reason |
|---|---|---|---|
| 1 · Retrospective miss autopsy | 09 | **PASSES — build first** | The past tense of the why-not panel, from records that are *never re-derivable from the present corpus*. And it carries the five `note` strings the live chain structurally cannot see. |
| 2 · Spill onset | 09 | **PASSES** | *"nothing anywhere tells you the first time an item spilled."* Correct. |
| 3 · The rent roll | 09 | **CONDITIONAL** | Passes as *cost attribution*. **Fails as a ranking that invites deletion** — see *Claims* #4. And every number in it is `chars/4`. |
| 4 · Compaction survival report | 09 | **PASSES** | And it is a self-join the projection already indexes: `op:'pre-compact'` writes ids at pseudo-tier `snapshot`, `op:'compact-restore'` writes what returned, both keyed by `sessionId`. It makes the product's founding promise measurable for the first time. |
| 5 · Nudge **conversion** | 09 | **FAILS on the data** | See *Claims* #5. The two counts side by side pass; the funnel does not. |
| 6 · The deny wall | 09 | **FAILS** | `mycontext audit --op deny --items` is the same answer. `[V]` `audit.ts:26` declares `op` as a value flag and `HOOK_OPS` includes `deny`. Keep it as a link from Doctor, not a screen. |
| 7 · Agent authority | 09 | **CONDITIONAL** | `audit --origin agent` covers the mutation half. What passes is **interleaving focus records with the injections after them**, so the narrowing is visible taking effect. Built as a filtered list, it is `audit` in chrome. |
| 8 · Degradation counter | 09 | **CONDITIONAL** | The four strings are free text on individual records and `audit --json` plus a filter reaches them. The **rate over time** passes; the count does not. |
| 9 · Reverse glob tester (globs ranked by precision) | 09 | **PASSES** | Precision is counted, not scored: files covered vs extra pulled in. Real numbers. |
| 10A · Governing-set diff from the mutation log | 09 | **PASSES** | Free, local, certain. |
| 10B · Reading git objects with `node:zlib` | 09 | **CUT** | See *Cut these*. |
| 11 · Standing overlap report | 09 | **CONDITIONAL** | Shared scope globs ∧ shared tags are real signals. **"Body similarity" is a new ranking function this codebase does not have** — see *Claims* #6. Ship the exact half. |
| 12 · Lifecycle debt (open questions by age) | 09 | **FAILS** | `mycontext search --type open_question` plus a date subtraction. Fold the `blocks`/`unblocks` edges into the detail pane. |
| 13 · Ingest yield, rejections grouped by message | 09 | **PASSES** | ~30 distinct rejection messages in `validateCandidates`, appended to `.rejected.jsonl`, **never pruned by a later success**, and read by nothing. Grouped, it is a prompt-quality instrument. |
| 14 · Corpus health trajectory (3 series) | 09 | **PASSES** | The instantaneous values are `status --json`; the **series** requires the mutation log and exists nowhere. |
| 15 · Subagent coverage | 09 | **PASSES** | `[V]` `ledgerKey` = `session_id::agent_id`; this repo holds 32 seen files under one session id and no surface reads them. README documents the gap as unclosable — *"a gap nothing can close is a gap that must at least be visible."* |
| 16 · Revision watchdog | 09 | **FAILS** | Pending revisions sorted by age. `review revisions` prints them. Fold into 17. |
| 17 · One unfinished-work queue (four queues) | 09 | **EXCEPTION** | 09 undercuts itself: *"all four are already assembled by one command"* — `mycontext status --json`. So it is a rendering of an existing answer. Kept anyway; see the exception record below. |
| 18 · Lesson yield | 09 | **PASSES** | `StagedRule.ruleId` is written on accept and the created rule carries `derived_from`; **the reverse `produced` edge is deliberately not written**, so lesson → rule exists nowhere else, not even in the graph. |
| Team 1 · Corpus diff in a PR, as governance effect | 09 | **PASSES — highest-value team capability** | Pure functions over items and config on a checkout. No history, no git parsing, nothing that does not exist. |
| Team 2 · Two workspaces side by side | 09 | **PASSES — needs an owner decision** | `select()` is pure and the server takes a root. Small server change, large payoff. |
| Team 4 · Compose the global-layer bootstrap route | 09 | **EXCEPTION** | It is composing a documented `mv`. Kept because it is the product's only team-scale mechanism and it is currently undiscoverable. |

### J. The five owner requirements

| Feature | Source | Verdict | Reason |
|---|---|---|---|
| **R1** · Markdown viewer, general | addendum | **FAILS** | `cat`, `bat`, `glow`, any editor. A markdown viewer is the definition of *nicer*. |
| **R1** · An item's own `.md` **beside its injection terms and its rendered injected block** | derived | **PASSES** | The authored file against what `render.ts` actually emits from it is a comparison no terminal makes. |
| **R1** · A `source_file` with `sourceAnchor` located and `sourceChecksum` drift shown | derived | **PASSES** | It is the only rendering of the three source fields, which today have `doctor` codes (`source_drift`, `source_missing`, `source_anchor_missing`) and no surface. |
| **R1** · `watchedDocs` matches rendered | derived | **PASSES** | Only if it shows *which glob matched* — which is the day-one mismatch made visible. |
| **R2** · README + docs viewer, EN/HE | addendum | **EXCEPTION** | It is `less README.md`. Kept; see the exception record. |
| **R2** · Mintlify | addendum | **REFUSE** | Two named constraints and a hosted dependency. Argued below. |
| **R3** · Tutorial viewer, EN/HE | addendum | **EXCEPTION** | Same class as R2, same record. The *value* of R3 is entirely in the refactor and the checker, not the viewer. |
| **R4** · Integrated help at the point of action | addendum | **CONDITIONAL** | Passes in exactly Learn's shape and no other: help joined to *your* corpus at the moment you must act. Anything else is a fifth spelling. |
| **R5** · Transparent 3D gloss | addendum | **n/a — visual** | §1 does not grade a surface treatment. It is graded against 04 and 06 instead, below. |

### Tally

| Verdict | Count |
|---|---|
| **PASSES** | 34 |
| **CONDITIONAL** (passes only in a named form) | 11 |
| **EXCEPTION** (fails, kept, recorded) | 6 |
| **FAILS** (cut or fold) | 11 |
| **n/a** (mechanism, test or defect repair) | 32 |
| **REFUSE** | 1 |

**95 rulings.** The panel is in better shape than the count of proposals suggests: a third of what
it proposed is not a feature at all but the repair of something already broken, and those are the
items to take first.

### The exceptions, written in §4's idiom

§4's form is: name what fails, refuse to dress it up, state the narrower basis, and state what
retires it. Six.

> **`#/work`'s unified queue (cap 17).** ⚠️ **Exception.** All four queues are already assembled by
> `mycontext status --json` — `reviewQueue`, `pendingRevisions`, `stagedRules`, `unfinishedIngest`
> — so this is a rendering of an answer the terminal already gives. It is **not** claimed to beat
> `mycontext status`. It is kept on a narrower basis: the tutorial names unread drafts as *"the
> failure mode this design invites"*, queues 3 and 4 rot for a *designed* reason (a slash command
> that ran `lesson-accept` would be the model settling a rule on your behalf), and the review
> queue's badge is the only amber badge in the rail. It is kept for the badge, not for the list. If
> a `mycontext status` change ever surfaces the four queues with their ages, cut this screen.

> **The README and documentation viewer (R2).** ⚠️ **Exception.** It is `less README.md` in a
> browser, and no join to the corpus makes 4,704 lines of prose into something a terminal cannot
> show. It is kept because the owner asked for it and because the Hebrew mirror has no other
> reader on a machine without the repo checked out. Constraint that keeps it from becoming a docs
> site: **it renders the committed files and nothing else** — no navigation the files do not
> already have, no search, no generated index. If a generated index appears, this has become a
> documentation product and should be cut.

> **The tutorial viewer (R3).** ⚠️ **Exception**, on the same basis and with the same constraint.
> Its justification is *delivery of the Hebrew translation*, not the rendering. If the Hebrew
> tutorial is never written, this screen is `docs/TUTORIAL.md` in a browser and should be cut.

> **The slash-command composed form (01 gap 6).** ⚠️ **Exception.** A second string beside the
> first. Kept because 66 slash commands are the primary surface for a plugin user and the UI names
> none of them, and because both forms generate from one category set. Retire it the moment they
> stop generating from one source, because then it is a second spelling.

> **`--yes` as a visible toggle (03).** ⚠️ **Exception.** A checkbox. Kept because §2's value for
> `--yes` is legibility in the transcript, and the toggle buys that legibility one moment earlier,
> before the paste rather than after. Not a security control, and the UI must not imply it is.

> **The global-layer bootstrap composition (09 team 4).** ⚠️ **Exception.** It composes a
> documented `mv`. Kept because `mycontext init --global` is refused, no command writes the global
> layer, and the documented route is effectively undiscoverable. Retire it if a global-layer
> command ever ships.

---

## Claims the data cannot back

Ten. Each is checked against `src/core/{audit,ledger,decay,select}.ts`. The first four would ship
a number that looks measured and is not.

### 1. The spec's own decay bullet overstates the ledger — `[V]`

Spec §4 · *Report* · `decay`:

> *"The ledger stores `injected_at` per `(session_id, item_id, tier)` … — and note the comment
> above it: **`injected_at` is a value, not part of the key** — so injections per item over time is
> a real series."*

The full comment it quotes half of `[V]` `ledger.ts:24-28`:

> *"`injected_at` is a value, not part of the key: **a repeat injection a millisecond later must
> collide, or once-per-session dedupe never fires.**"*

And the write `[V]` `ledger.ts:119-124`:

```
INSERT INTO ledger (session_id, item_id, tier, injected_at)
VALUES (?, ?, ?, ?)
ON CONFLICT(session_id, item_id, tier) DO NOTHING
```

**The clause the spec quotes is the reason the series does not exist.** One row per
`(session, item, tier)`, first write wins. An item JIT-injected forty times across one long
session contributes **one** row. `Ledger.usage()` is `COUNT(*)` over those rows `[V]`
`ledger.ts:200-209`, so `useCount` is *sessions-that-delivered-it*, not injections.

**What is true:** *sessions in which this item was delivered, over time* — which is a real series
and is the useful one. **What is false:** *injections per item over time*. **What is unaffected:**
*"this rule has not been injected in six weeks"*, which reads `MAX(injected_at)` and is real.

This is a §0-class row and it is in §4, uncorrected, in the sentence that grades `decay` ✅. The
grade survives; the sentence does not. The same correction lands on §4's Watch strip, which says
injection volume *"is derived from the ledger over time"* — volume must come from the **audit
log**, where every event is a record, not from the ledger, where they collide.

`[V]` A second consequence worth stating on the same screen: the ledger is now a **replayed
projection** of the audit JSONL that only catches up when a CLI report runs `topUpLedger`
(`ledger-replay.ts:38-41`, called from `decay.ts`, `status.ts`, `audit.ts` only). A UI reading it
directly reads a projection that is behind by default — the same freshness disclosure §5 already
requires of the audit projection, owed here too.

### 2. The recency comb will plot dedupe tokens as timestamps — `[V]`

05-dataviz §4 builds the comb on *"x = days since last injection"* from `allUsage()`'s
`lastUsed = MAX(injected_at)`, and its own framing is *"**Time** — real, continuous, from
`injected_at`. This is where 'six weeks' lives."*

But `[V]` `ledger.ts:141-150`, on `recordRestored`:

> *"a restored row's timestamp isn't that — it's an **identity marker**: the caller stamps it with
> the triggering snapshot's own `capturedAt` and later compares for EQUALITY against a snapshot's
> `capturedAt`"*

confirmed at the write site `[V]` `inject.ts:294-296`. `MAX(injected_at)` is taken **across all
tiers**, so an item whose most recent row is `restored` has a `lastUsed` that is a snapshot's
capture time, not an injection instant. And unlike every other tier, that row is **overwritten** on
each call (`DO UPDATE SET injected_at = excluded.injected_at`), not frozen.

`09-workflows.md` caught this and wrote it down as a warning for its capabilities 2 and 3 —
*"a real trap … written down here so no implementer finds it the expensive way."* **05-dataviz is
the report that actually draws the chart and it does not carry the exclusion.** Two panellists,
one fact, and the warning landed on the paper that does not need it. Required: exclude
`tier: 'restored'` from any day-axis, or mark those rows distinctly.

### 3. "Render the ranked list once and animate a cut line" is a picture of a selector this product does not have — `[V]`

03-interaction, preview rule 4, marks it `[?]`: *"If `select()` admits greedily in a fixed order
per tier, then … only the cut line does [change]. Verify the prefix property against `select()`
before relying on it."*

The answer is **no**, and `select.ts` says so in the imperative `[V]` `select.ts:284-300`:

> *"First-fit, not strict priority truncation: an over-budget item is skipped (`continue`, not
> `break`) so a later, smaller, LOWER-priority item can still be admitted after a higher-priority
> one has spilled. Deliberate … `spilled` is therefore **NOT a strict priority prefix** of the
> sorted candidates."*

A cut line through a fixed ranking **is** priority truncation drawn. It would be a beautiful,
frame-perfect, false animation of the flagship screen — and 05-dataviz independently derived the
correct rendering (the staircase with **downward eviction steps**, because *"raising a budget can
evict an item"*). Take 05's version. Delete 03's rule 4.

I note the shape, because it is what made the wrong idea plausible: the ordering *is* stable
(`byPriority` is a pure ordinal tiebreak, severity → layer → id `[V]` `select.ts:268-275`). Stable
order, non-prefix admission. `[V]` And a smaller correction found while checking it: that
function's own docblock says *"then most-recently-relevant"* while the code compares
`LAYER_RANK`. There is no recency term in the selector. The comment is stale, and a UI that
renders "priority" from that sentence would invent a fourth sort key.

### 4. The rent roll ranks a corpus for deletion on data whose own report refuses to — `[V]`

09 capability 3 renders *"this pinned item costs ~430 tokens × 34 session starts this month =
~14.6k tokens, and has never appeared in a spill or a decay report — i.e. it is **pure rent**"*,
and *"Rank the corpus by rent."*

Three problems, in increasing severity:

- **Every number is `chars/4`.** `[V]` `select.ts:97-108`: *"a chars/4 approximation with symmetric
  error in either direction — **not a guaranteed bound**."* A total built by multiplying an
  approximation by a count reads as measured. It needs the estimator's own hedge on the same
  screen, once.
- **"Never appeared in a decay report" is backwards for a pinned item.** `decay.ts` carries
  `always` on `DecayRow` precisely because *"`mycontext decay --full` once printed `(none)` for
  7 of this repo's 25 cold rows … which read as 'this can never be injected, give it a scope or
  delete it' about pinned, load-bearing items."* `[V]` A pinned item that *is* cold is a **spill
  defect**, which 05-dataviz gets right and 09 does not.
- **The ranking contradicts the report it is built on.** `mycontext decay` prints, unconditionally:
  *"Do not supersede or deprecate anything on this report alone — verify real usage first."*
  `[V]` `cli/commands/decay.ts:209`. And the caveat it refuses to gate: *"the ledger records
  injection, **not reading or reliance**, so a new item, and any item consulted via `show`, MCP
  `get_item`, or the Markdown file directly, look exactly like an abandoned one here."* `[V]`
  `cli/commands/decay.ts:28-32` — and the reason it is ungated is stated: *"a mature ledger is
  exactly when a reader is most likely to trust 'cold' at face value, and gating the hedge on
  ledger immaturity hid it at the one moment it mattered most."*

**Ship the cost attribution; delete the word "rent" and the ranking.** *"These 7 pinned items cost
an estimated 1,542 tokens at every session start"* is true, useful, and makes the corpus shrink
without the UI recommending a deletion its own data cannot justify.

**And a related one, in the same family:** `decay`'s window is **counted in sessions**, not days
`[V]` (`DEFAULT_WINDOW = 20`, `ledger.recentSessions(window)`). Twenty sessions may be one
afternoon or two years. Any UI sentence of the form *"not injected in 30 days"* built on
`computeDecay` is inventing a unit the report does not have. A day-windowed answer is buildable —
`parseWhen` already accepts `7d`/`12h` and `AuditFilter.since/until` is indexed — but it must come
off the audit log and be labelled as *injection events*, not as decay.

### 5. "Nudge conversion" is causation inferred from time proximity — `[V]`

09 capability 5: *"whether a `create` followed within N minutes … `docs/**/*.md` fired 47 nudges
this month and **produced** 2 items."*

`[V]` `post-tool-use.ts:59-75` writes the record **only when the nudge fires**, carrying
`note: "<tool> on a watched document — capture nudge emitted"`. There is no acknowledgement, no
dismissal, no follow-through field. Nothing anywhere links a `create` to a nudge.

A funnel with the word *produced* asserts a causal edge that does not exist. Two counts on one
time axis — nudges fired, items created — are true and answer the same question. The word is the
whole defect, and it is exactly the shape of
`STD-guarantee-claims-carry-their-condition-in-the-same-sentence`.

Contrast capability 18, which looks similar and is **real**: `StagedRule.ruleId` is written on
accept, the created rule carries `relations: [{type:'derived_from', target: lessonId}]`, and the
audit op is `accept` rather than `create`. That is a recorded link. Ship 18, fix 5.

### 6. "Body similarity" is a ranking function this codebase does not have — `[V]`

09 capability 11: *"items sharing scope globs and tags, with **body similarity**, ranked."*

`content-hash.ts` is an **exact** hash — the dedupe key, and 09 itself concedes *"two items saying
the same thing in different words hash differently and dedupe never fires."* There is no
similarity metric, no index, and no tokeniser anywhere in `src/`, and the spec commits to no
corpus-wide search or ranking (it is why ⌘K was cut). A similarity score would be a **new
inference engine** introduced through a report.

Ship the exact half: **shared scope globs ∧ shared tags**, both real fields, counted not scored.
If a similarity signal is wanted, it must be specified with its metric named on screen, or it is a
plausible-looking number.

### 7. `origin: 'human'` does not prove a human — and the spec already says so — `[V]`

03-interaction: *"An audit record with `origin: 'human'` proves the corpus recorded it, and
**proves it was your shell rather than an agent** — which is precisely the distinction §2 built the
whole no-writes rule around."*

`origin` is a **call-site constant**, not an observation. `[V]` `mutate.ts:271` ·
`const origin: Origin = input.origin ?? 'human';`, and every CLI command hardcodes it —
`edit.ts:471` · `const patch: UpdateInput = { id, origin: 'human' };`, with the comment at
`lesson.ts:62` · *"`origin: 'human'` — the CLI is the user."*

And spec §2 uses this very fact to argue the **opposite** of 03's claim `[V]`:

> *"**`promoteRevision` launders origin.** `src/core/revision.ts:1125` applies a promoted revision
> through `updateItem` with **`origin: 'human'` hardcoded** … **The agent approves its own
> proposal.**"*

What the record actually proves is that the mutation came through the **CLI** rather than the MCP
server — and that only excludes the agent if the user installed the README's fourteen
`Bash(mycontext … *)` deny rules, which §2 is explicit are *"your Bash permissions, and nothing
else"*.  That is a conditional, and 03 states it unconditionally.

**The receipt survives; the sentence does not.** Correct form: *"the CLI recorded this — your
shell, or an agent's, depending on your Bash permissions."*

### 8. The 0.55 ms treatment does not transfer from the mockup to the product — `[V]`

The number is real. `[V]` `docs/design/web-ui-mockup.md:43-46` · *"**The 0.55 ms p95 is real,
measured and shipped.**"* · `test/perf/audit-latency.perf.ts` · `*   empty log  p95 0.579 / 0.552 ms`.
04-visual is right about the fact and I am not disputing it.

The **pattern** is what does not transfer. 04 proposes *"give the measured, shipped numbers real
size … and keep every fabricated demo number at normal body size with a small 'illustrative' tag."*
That is a rule for a **mockup**, where fabricated numbers exist. **In the shipped product there
are no fabricated numbers**, so the contrast has nothing to contrast with, and the forcing function
04 correctly identifies — *"a design pattern that literally cannot be applied to a claim that isn't
backed by a measurement"* — evaporates.

Worse, applied literally it sizes a **backend append latency** as the loudest thing on a governance
screen. That is not the user's question on any screen in the product.

**The pattern is worth keeping, on the right axis.** The live product's epistemic classes are not
measured-vs-fabricated; they are:

| Class | Example | Register |
|---|---|---|
| **Recorded** | `AuditRecord.tokens`, `injected_at`, spill `reason` | full weight, plain |
| **Computed exactly** | `matchesScope` result, `injection().injected`, the governing-set diff | full weight, plain |
| **Estimated** | every token number — `chars/4` | the estimator's mark, once per screen |
| **Proposed / counterfactual** | `6000 → 8000`, a simulated selection | 03's `.was`/`.will` registers |
| **Inferred** | the nearest-prefix hint, the bootstrap document scan | explicitly marked a guess |
| **Not recorded** | absent `tokens`, `lastUsed: null` | a hatched void, never a zero |

That is 04's idea, made true of a product that has no demo data. And it gives 03's *"pick any
number on any screen at random — can you tell whether it is real?"* an answer with six values
instead of two.

### 9. "Exact rather than estimated" is true of four Configure bullets and false of the fifth — `[V]`

Spec §4 · Configure: *"Every input to that answer is a pure function of items and config —
`matchesScope`, `scopePolicyFor`, `agentEditsFor`, `injection`, `select` — **so the preview is
exact rather than estimated**."*

True for `scopePolicy`, `agentEdits`, `enabled` and `tier`: those previews are set membership and
are exact. **False for `budgets`**, whose entire arithmetic runs through `itemCost` →
`estimateTokens` → `Math.ceil(text.length / 4)`, which the source calls *"not a guaranteed bound."*
`[V]` `select.ts:97-108`

The budget preview is **exactly what `select()` will do**, and `select()` is working from an
estimate of what the model will count. Both halves are true and only one of them is currently
said. One sentence under every budget number: *"token counts are `chars/4` estimates — the same
ones the selector budgets with."* That sentence also protects the staircase, the ribbon, the
simulator and the rent roll in one place.

### 10. Two rankings that are real, recorded here so they are not swept up with the others

`[V]` 09 capability 9's *"candidate globs ranked by precision"* is a **count** — files covered,
files pulled in extra — not a score. And 05-dataviz §7a's spill-ratio sort is `audit_item` rows
divided by `audit_item` rows. Both are arithmetic over recorded data. They stay.

**One boundary that must be stated once, in the design, in these words:** nothing in this system
records an **outcome**. There is no session-result record, no acceptance signal, no
what-the-user-did-next, and no co-occurrence table; `origin` is on mutations only and the
`focus` records carry their axes as a prose `note`. Every capability in this panel measures
**delivery**. 09 says this and it is the sentence that must survive into the plan: *"a 'rule
effectiveness' score would be the exact class of false claim
`STD-guarantee-claims-carry-their-condition-in-the-same-sentence` exists to refuse."*

---

## Implied capability

The defect: a control that promises something with nothing behind it. The mockup's own list names
three instances — the search box with no handler, the session picker that raises a toast, the
advertised ⌘K bound to nothing. Here is the same defect in the new proposals, worst first.

### 1. The mockup ships a copy button for a flag that does not exist — `[V]` `[M]`

`[V]` `docs/design/web-ui-mockup.html:477`:

```html
<div class="cmd"><code>mycontext edit --budget jit=8000</code><button data-copy …>Copy</button></div>
```

`[V]` `edit.ts:61-63`:

```
const ALLOWED = [
  'title', 'body', 'scope', 'tags', 'severity', 'always', 'status', 'extra', 'unlink', 'yes',
];
```

**There is no `--budget` flag on `mycontext edit`.** `[M]` `grep -rn "'budget'" src/cli/` returns
nothing. There is no `mycontext config` command either — spec §4 says so in its first line.
Pasting that command produces a `refuseUnknownFlag` error.

This is not a hypothetical. It has already propagated:

- `01-coverage.md:70` records the Configure screen as composing `mycontext edit --budget …` and
  grades the four budget keys **Exposed: Yes**.
- `06-a11y.md:427` makes it the **worked example** of a correct accessible name:
  `"Copy command: mycontext edit --budget jit=8000"`.
- `06-a11y.md:608` and `sketches/06-a11y.html:468` reason about how to format `8,000` inside it.

Three panellists inherited a fabricated command from the artifact the mockup's own companion calls
*"what implementers copy"*, and the mockup's divergence list — which runs to forty bullets in both
directions, and whose stated purpose is that *"a mockup that implies capability the product does
not have is this project's characteristic defect"* — does not name it. It is exactly the
search-box defect promoted one level: not a control with no handler, but a **handler that hands
the user a command with no flag**, behind a button whose whole purpose is to be trusted.

**Fix:** the spec is already right — Configure *"produces the resulting `config.json` — or the
minimal diff — for the user to paste."* Replace the command block with the diff block. Then extend
the palette's one-directional contract in both directions and make it cover **every composed string
anywhere in the UI**, not just `PALETTE` defs: *no composed command may name a flag its command's
`refuseUnknownFlag` allow-list does not contain, and no `mycontext <verb>` may be composed that
`index.ts` does not register.* That test is a source scan over arrays that already exist, and it is
the same checker R3 needs (below) — one scan, two problems.

### 2. Three of the panel's own sketches carry the defect they diagnose — `[M]`

`[M]` `03-interaction.html` contains **two NUL bytes**, at line 516, used as a sentinel inside a
hand-rolled glob-to-regex:

```js
.replace(/\*\*/g, '\0').replace(/\*/g, '[^/]*').replace(/\0/g, '.*')
```

Two consequences, and the second is worse than the first:

- `[M]` `grep` treats the file as binary and truncates its own output — which is precisely the
  defect `2026-08-18-v2-decisions.md` §8 step 3 requires removing from plan 1: *"plan 1's two NUL
  bytes at line 2338 are removed in the same pass — **[new] [V]** they make `grep` treat the file
  as binary and truncate its own output."* The correction was recorded and then reproduced in a
  new artifact by the panel reviewing the document that records it.
- The function is a **second implementation of `globToRegExp`**, and it does not agree with the
  first. `[V]` `paths.ts:49-68` splits the pattern on `/` and compiles `**` to `(?:[^/]+/)*` when
  non-terminal and `.+` when terminal; the sketch's version compiles `**` to `.*` unconditionally
  and never splits on segments. So the sketch's glob tester — the screen whose entire argument is
  *"two answers, rendered as two answers, because collapsing them is the exact defect `select.ts`
  documents by name"* — gives a **third** answer, from a matcher the product does not use. A
  demonstration of glob honesty, running on a dishonest glob.

The fix is the fix 05-dataviz already proposed for the pruner: glob grammar lives in one module,
and anything that needs it calls `/api/glob`. A sketch that cannot call the server should render a
fixed answer and say it is fixed, not compute a wrong one.

### 3. `#/agent` would show a surface the UI cannot exercise

01's gap 2 is the strongest untaken §1 claim in the panel and it is one sentence away from the
defect. Fourteen tools rendered with full schemas, in a product where every other screen either
runs a read or composes a command, reads as *"click to call."* They execute over stdio inside a
Claude session; there is no HTTP route and there never will be one.

**Required:** the screen states its own inertness in its own words, in the register 01 already
found for `link` — *"this runs through Claude, not your shell"* — and offers the `link_items` JSON
for a user who wants to ask the agent, never a Run button, never a form that looks like one.

### 4. The composer implies a batch form the CLI does not have

03 got here first and got it right — *"It cannot be one command, and the design must say so rather
than invent a flag"* — and I am recording it because bulk selection is where an invented flag is
most tempting and the palette's contract is one-directional today. Five items is five commands.

### 5. `unlink`, and the flag grammar that cannot express it

`[V]` The only route to removing a relation is `mycontext edit <id> --unlink <relation> <target>`,
a **two-word** flag, and `commandFor` emits only `--name value` or bare `--name` — so it is
unrepresentable in the current def grammar. 01 proposes `words: 2`, which is right. Recorded here
because the alternative failure is silent: a UI that offers "remove relation" and composes
`--unlink relates_to` (one word) hands over a command that does the wrong thing rather than
erroring, which is worse than the `--budget` case.

### 6. The status-strip context number, and the session ribbon's clause

Already handled by §4b and §7 with the condition attached. It is listed here because it is the one
place in the shipped design where a number appears whose source may not be installed, and because
05-dataviz's session ribbon (7b) says *"Every field it needs already exists"* — which is true of
every field except the one the sentence is about. Keep the conditional; delete that clause.

### 7. `mycontext ui --at <path>` (07-arch)

Proposed as the fix for deep links needing a nonce. Reasonable — and it is a **new CLI flag** on a
command that does not exist yet (`ui` is plan 1 Task 15, and `[V]` Decision 6 records that
`statusline` likewise *"does not exist in shipped code"*). It must land in the plan as a flag, not
appear in the UI as an instruction the user's binary refuses. Same failure mode as `--budget`,
caught before it ships.

---

## On exposing everything

The owner's sentence: *"let the user be able to view and control every single feature / capability."*
The measurement: **95 of 392 exposed, 273 missing** `[V]` `01-coverage.md`.

I am going to disagree with the goal, and I have to earn it.

### First, what is right about it

Three of 01's findings are not "under-exposure", they are **defects**, and the owner's sentence is
what surfaced them:

1. **15 of 27 item fields have no rendering anywhere**, while `/api/item/:id` already returns the
   whole record `[V]`. `observations`, `filePath`, `sourceFile`/`sourceAnchor`/`sourceChecksum`,
   `validFrom`/`validUntil`, `checksum`, `extra` — and `doctor` emits findings that *name* three of
   the fields it cannot show you. Data crossing the wire and dying in the client is not a scoping
   decision.
2. **Two closed vocabularies offered as free text** `[V]`. That is a correctness bug.
3. **`focus` cannot be set from the UI**, while being *"the single largest lever over what Claude
   sees"* and the one input whose effect is live `[V]` `pre-tool-use.ts:100`.

Those three are not "expose more". They are "finish what is half-built", and the owner is right.

### Second, why total exposure is the wrong target *for this product*

**Because §1 is not a resource constraint, it is the product's identity.** §1 does not say "expose
what we have budget for." It says a UI that becomes the primary surface *"turns mycontext into a
wiki with a Claude integration, and wikis are where knowledge goes to be not-read."* Exposing 392
capabilities **is** making the UI the primary surface. The two goals do not merely compete for
effort; the second one, taken literally, defeats the first one's stated purpose.

**Because the denominator is not a feature list.** Of the 273 missing:

- **66 slash commands** `[V]` are *generated from the same resolved config* as the categories the
  UI already renders `[V]` `src/plugin/commands.ts`. They are not 66 capabilities. They are one
  capability with 66 spellings, and re-spelling them in a fourth medium is the `HELP_TOPICS`
  problem in advance.
- **62 MCP tool parameters** are the schema of tools the UI cannot call. Rendering a parameter you
  cannot supply is documentation, and 01 says so itself when it prescribes the treatment.
- **118 CLI flags** include four `DETAIL_FLAGS` per read command — `--full`, `--short`, `--summary`,
  `--json`. `[R]` Those are **terminal output shapes**. A UI does not have a `--short`. Reproducing
  them is the prettier-`list` trap with a flag name attached.
- **6 env vars** include `MYCONTEXT_WIDTH`, `MYCONTEXT_ASCII` and `MYCONTEXT_UNICODE` `[V]` — three
  terminal rendering controls. A web UI that exposed `MYCONTEXT_ASCII` would be exposing a
  capability that does nothing to it.

`[R]` A conservative recount on those four groups alone moves somewhere near 150 of the 273 out of
"missing" and into "not a thing this surface has." The 392 is an honest count of *knobs*; it is not
a count of *user goals*, and the owner's sentence is about the second.

**Because exposure without a join is anti-value here.** §4's Learn grading is the precedent and it
is the product's own: *"Rendering `mycontext help <topic>` in a browser is `mycontext help <topic>`
in a browser … Built without [the corpus cross-link], this screen is a documentation viewer and
should be cut."* Every unexposed capability inherits that test. `examples <category>` rendered in
the UI is `mycontext examples` in a browser. `examples <category>` **joined to which of your 21
categories are empty** is not.

**Because 02-ia already dissolved the tension and it should be credited rather than re-argued.**
*"They conflict only while capability is expressed as destinations."* Sixteen capabilities from
eight destinations, one detail pane, one composer. That is not a compromise between the two goals;
it is the observation that they were never opposed — 273 *destinations* is unusable, 273
*capabilities* reached from a pane and a composer is not.

### Third: where the line falls

Four tiers. The test for each is stated so a future proposal can be placed without taste.

> **Tier 1 — Expose, because it is already half-exposed and the absence is a defect.**
> *Test: does data already cross the wire, or does a screen already name the thing it cannot show?*
> The item record's 15 fields; the two closed vocabularies; `focus` composition; the four missing
> palette flags (`supersede --reason --yes`, `refresh --yes`, `lesson-accept`'s four overrides,
> `edit --unlink`); the four mockup-missing screens (`doctor`, `decay`, `graph`, `palette`).
> **This is where the owner's sentence buys the most, and it is roughly one wave.**

> **Tier 2 — Expose *with a join*, or not at all.**
> *Test: does it answer a question the terminal cannot, once joined to this corpus?*
> The MCP surface joined to `agentEdits` per category and firing counts. `examples` joined to your
> empty categories. The hooks joined to their last firing. Ingest and lesson joined to their
> rejection records. **Built without the join, cut it** — §4's own sentence, applied.

> **Tier 3 — Name it, do not build it.**
> *Test: is it real, reachable elsewhere, and would a user reasonably think it absent?*
> One screen — call it *What this UI does not do* — listing: the 66 slash commands and where they
> live; `query`'s SQL, removed by decision, with the decision quoted; `audit replay-ledger`, which
> is undocumented `[V]` `audit.ts:297`; `init --global`, refused; `extraFields`, refused in config
> `[V]` `config.ts:205-212`; the absent `delete_item` and the empty `RESERVED_TOOLS`. **Naming an
> absence is exposure.** It is the cheapest documentation `replay-ledger` will ever get, and it is
> the honest form of "every capability", because a capability the UI refuses is a fact about the
> product. It is also the one screen that cannot rot into a wiki, because it holds no knowledge.

> **Tier 4 — Refuse, and say why once.**
> Terminal output shapes (`--full/--short/--summary/--json`), terminal rendering env vars, MCP
> parameters for tools the UI cannot call, and any capability whose UI form would be a second
> spelling of a generated surface.

### The counter-proposal, in one sentence

**Do not aim at 392. Aim at "every capability is either reachable, or named as not reachable, with
its reason."** That is a claim the product can actually make true, a checker can enforce it
(01's inverse palette test extended to cover Tier 3's list), and it is the version of the owner's
sentence that does not turn the product into the wiki §1 exists to prevent.

---

## R3 and R4 — staying true

The addendum states the risk correctly for both. *"A tutorial that teaches a flag that no longer
exists is the same defect class"* and *"help cannot be a fifth spelling."* Neither needs a new
mechanism. This project already built both, and neither has been pointed at the target.

### R3 — the tutorials

**The gap is recorded and it is exact.** `[V]` `CHANGELOG.md`:

> *"**Neither is generated, so neither is pinned by the four documentation drift tests.** Every
> example block in the READMEs is regenerated by `npm run gen:docs` and diffed, which is why those
> documents survived thirty-three corrected contradictions in `1.0.1`. These two files have no such
> net and can go stale silently. That is a known gap, recorded here rather than discovered later."*

**The discipline: a tutorial teaches commands, so a tutorial is a generated document.** The
mechanism exists `[V]` `scripts/gen-doc-examples.ts`:

> *"A marked block in the Markdown names a command; this script runs that command against the
> committed documentation fixture and writes the real stdout into the block. … **a documented
> command that does not exist fails loudly rather than being pasted as prose nobody ran.**"*

That last clause is R3's answer verbatim. Marking up `docs/TUTORIAL.md` and
`docs/TUTORIAL-ADVANCED.md` with `<!-- example: … -->` blocks closes the recorded gap with
machinery that already ships, already has a test (`test/docs/examples.test.ts`), and already
survived thirty-three contradictions.

**The refactor R3 asks about is therefore not stylistic — it is whatever it takes to make every
command in both files generated.** A tutorial sentence that paraphrases output ("you'll see
something like…") is a sentence that cannot be pinned; rewriting those into real blocks *is* the
refactor. `[V]` The drift is already there and a panellist found one instance rather than a test
doing it: TUTORIAL-ADVANCED §4 says the pinned budget is 8,000 while `DEFAULT_BUDGETS` is
`{pinned: 6000, jit: 6000, restored: 8000, index: 1200}` `[V]` `config.ts:51`. A tutorial teaching
a false number, in the product whose defect class is exactly that. That is the whole argument.

**The checkers, three, all cheap:**

1. **`gen:docs` covers `docs/TUTORIAL*.md`.** Extend `collectExamples`' file list. Then a removed
   flag fails the suite the day it is removed. *This is the one that matters.*
2. **Parity, extended.** `test/docs/parity.test.ts` asserts structure between `README.md` and
   `docs/README.he.md`. Point the same test at `TUTORIAL{,-ADVANCED}.{md,he.md}` when the Hebrew
   lands. **And carry its docstring's own confession forward unchanged** — *"It compares structure,
   never meaning. A paragraph whose Hebrew was left behind by an English edit … passes every
   assertion in this file, and no test in this repository can catch it"* — because the test that
   *demonstrates* its own blindness by garbling the real Hebrew and showing the checks still pass
   is this repository's best honesty artefact, and a second copy must not quietly drop it.
3. **A flag scan.** Every `mycontext <verb> --<flag>` appearing in *any* `docs/**/*.md`, in a
   generated block or in prose, resolves to that command's `refuseUnknownFlag` allow-list. ~30
   lines, and it is the same test that catches `--budget` in the UI. **One checker, both problems.**

**Which tutorials should exist.** Grounded in 09's job ranking, and each is a *job*, not a feature
tour: (a) *the first twenty minutes* — exists, keep; (b) **"the model broke a rule — find out
whether it arrived"**, job #1 by a distance and currently taught nowhere; (c) *scope, and why
nobody adds one* — the tutorial concedes the failure (*"nobody goes back to add scopes"*) and does
not fix it; (d) *budgets, spill, and what pinning costs forever*; (e) *the four queues*, because
the tutorial names unread drafts as the failure mode this design invites and only teaches one of
the four. **Five, not fourteen.** Each one is generated end to end or it is not written.

**And the honest note on Hebrew.** A Hebrew tutorial is new writing with no net under it, and the
parity test cannot check freshness. Say so where the Hebrew tutorial is offered, in the words the
existing test already uses: *translation freshness is a review obligation, not a tested one.*

### R4 — integrated help

**The rule that keeps it from being a fifth spelling: help is never authored in the UI.** Every
help string the UI renders resolves to a source that already exists, and there are exactly three:

| Kind of help | Its single source | How the UI gets it |
|---|---|---|
| **Conceptual** (what is scope, what is a draft) | `src/help/topics/<topic>.md` and `<topic>.he.md` | `/api/help/:topic` — the same files `mycontext help` reads `[V]` `help/index.ts` · `readTopicFile` |
| **Command** (what does this flag do) | the command's own `USAGE` string and `ALLOWED` array | rendered from the same arrays the composer builds from |
| **Vocabulary** (what does `derived_from` mean) | `vocabulary.ts`, `categories.ts`, `config.ts` enums | already in `/api/config`'s `meta` |

**There is no fourth kind, and no help string is written in `src/ui/`.** That single rule is what
makes the fifth spelling structurally impossible rather than merely discouraged.

**The mechanism, and it satisfies "wherever the user must act" without a destination.** §4 grants
Learn a conditional pass on the corpus join; 02 argues the *destination* should be cut and the join
reached from the term. Both are right, and they are the same design:

> **Help is an affordance on a term, not a place.** The word *scope* on Coverage, *draft* on the
> review queue, *spill* under a preview, *inert* in Configure — each is a `<button>` opening the
> **detail pane** on that topic, showing the topic file **and this corpus's answer to it**: which
> of your items declare a scope, which of your categories are empty, what your `scopePolicy` makes
> of an unscoped item. Reached from the term, at the moment of confusion. Same pane, same routing
> parameter (`?topic=scope`), no new surface, and 02's cut of `Learn` as a rail entry stands.

**The mutator-free half, which R4 names and no report answers.** Help must explain a thing the user
runs *elsewhere* and say how they will know it worked. 03 already built that: the **landing
predicate**, written in English before the copy. So the composed-command help is not prose at all —
it is *"I will know this worked when `REV-8c21` leaves the pending list **and** the item body
matches the proposal — both, because either alone can be true for the wrong reason."* Help that is
a predicate cannot drift from behaviour, because the app evaluates it. That is the one form of help
in this product that is **self-verifying**, and it should carry the composed-command case entirely.

**The checker.** Two scans, both in the shape of 07's Tier 1:

1. **No help prose under `src/ui/public/`.** Every help string resolves to a `HELP_TOPICS` id, a
   command name, or a vocabulary key. A literal sentence longer than N words outside the string
   table fails. This is the one that prevents the fifth spelling.
2. **Every term marked with a help affordance resolves to a topic that exists**, in **both**
   languages — the extension of 07's scan 5 (*"every `t('…')` literal exists in both tables"*) to
   the topic set. `[V]` `readTopicFile` already throws with the path to create rather than falling
   back to English, *"because a silent fallback is how the Hebrew README's categories section came
   to be English in the first place."* The UI must inherit that throw, not soften it.

**One thing R4 will want and must not have.** `HELP_TOPICS` is four topics `[V]` `help/index.ts:11`
against 392 capabilities, and the UI will feel the gap immediately. **Adding a topic is a change to
`src/help/topics/`, never a string in the UI.** The moment the UI can hold a help sentence of its
own, the fifth spelling exists — and it will be the copy that is edited, because it is the one the
designer can see.

---

## R5 — an honest gloss

The owner asked for *"a transparent gloss effect to shaded cards that looks 3D and are above the
surface."* 04-visual rejects `backdrop-filter` glassmorphism by name and argues for shine that earns
its place. These are in direct tension and my job is to find the honest version, not to refuse it.

**Read the two closely and the conflict is narrower than it looks.** 04 rejects three specific
things: gradient-mesh backgrounds (*"the 'AI product' glow-blob cliché — implies ambient
intelligence this tool explicitly is not"*), `backdrop-filter` (*"expensive, inconsistent across
engines, and implies a translucent-layering metaphor that doesn't match a flat, single-pane data
reader"*), and gold as a general brand accent. It does **not** reject elevation, and it in fact
**asks for more of it** — `--panel-2`, three elevation tiers each paired with a surface step, and a
dark-mode inset highlight. 04's own words: *"'raised' means a lightness change **and** a shadow
change, not shadow alone."*

**So the owner is asking for elevation, and 04 is already building an elevation system.** The
disagreement is about *transparency*, and transparency is the part that fails five ways.

### What transparency actually costs here, measured

| Cost | Evidence |
|---|---|
| Contrast | `[M]` 06 measured **five failures** already: `--faint` at 3.14/2.91 light and 3.07/3.29 dark; three chips at 4.17–4.39; and `--gold` vs `--ok` at **1.04:1**. Translucency composites a foreground against an unknown backdrop, so it can only move these down — and it removes the fixed pair a contrast script needs. |
| Print | The spec **requires** a real print stylesheet for the coverage map. Translucency and shadow print as nothing or as grey mud. `[M]` And `Ctrl+P` is already broken from every screen but Coverage (06 finding 12). |
| Performance | `backdrop-filter` forces a backdrop-root composite per element, and `[M]` 07 measured `/api/coverage` at ~5.6 s on a 20,000-file × 5,000-item corpus with a 40,000-element eager tree behind it. |
| User preference | `prefers-reduced-transparency` and `forced-colors` are **not honoured** — `[M]` `grep -c "forced-colors"` → 0. Under Windows High Contrast every chip background is replaced. This is a Windows-first project. |
| Meaning | Every card in this product is a *verdict*. A verdict rendered as partly see-through is a verdict rendered as provisional. |

### The resolution — gloss as a *material*, not as a *filter*

**Three surfaces, three materials, and the gloss belongs to exactly one of them.**

| Material | Where | Treatment |
|---|---|---|
| **Paper** (the record) | cards, tables, trees, the coverage map, every delivered/spilled row | flat. `--panel`, `--e1`, no gloss. This is the ledger and it does not shine. |
| **Glass** (a thing floating above the record) | popovers, the composer overlay, the exit banner, the detail pane's header, the shortcut sheet | **the gloss** — and only here |
| **Ink** (the verdict) | gold `pinned`, the four accent chips, the status dots | unchanged, and gold stays rare |

The gloss, built from what 04 already asked for and nothing else:

```css
/* Glass = an opaque elevated surface + a specular edge. No backdrop-filter. */
.floating {
  background: var(--panel-2);                 /* opaque: contrast stays computable */
  box-shadow:
    inset 0 1px 0 var(--specular),            /* the top-lit highlight — this is the 3D */
    inset 0 -1px 0 var(--under),              /* the shadowed lower lip */
    var(--e3);                                /* the cast shadow — this is "above the surface" */
  border: 1px solid var(--edge);
}
```

Three properties make that honest:

1. **`--panel-2` is opaque**, so every contrast ratio on it is a fixed pair the script 06 already
   ran can measure. A translucent surface has no measurable ratio, which is the real reason it
   cannot ship in a product with five recorded contrast failures.
2. **The 3D reads from the specular edge, not from see-through.** A lit top edge, a darkened lower
   lip and a cast shadow is how a raised physical surface actually looks; transparency is how
   *glass over a busy background* looks, and there is no busy background here. 04's dark-mode inset
   highlight is already this idea — R5 asks for it on both themes and at more strength, which is a
   change of degree, not of kind. That is the reconciliation: **the owner's request and 04's
   proposal are the same mechanism at different amplitudes.**
3. **The one place real translucency earns its keep is the scrim behind an overlay** — the
   composer, the shortcut sheet — where the whole point is *"the record is still there; you are
   just not editing it."* That is transparency **encoding a fact**, which is 04's own test passed.
   Nothing on it needs to meet a contrast ratio, because nothing is read through it.

### The four conditions that go in the plan

1. **`prefers-reduced-transparency: reduce`** → the scrim goes opaque. Two lines.
2. **`forced-colors: active`** → every gloss shadow to `none`, borders to `ButtonBorder`,
   `--panel-2` to `Canvas`. This is the block 06 found missing entirely; R5 is the reason to write
   it now rather than retrofit it after wave 2.
3. **`@media print`** → all elevation off, all glass to paper, one hairline rule. The print
   stylesheet is a spec requirement and gloss is precisely what it must strip.
4. **No `backdrop-filter`, anywhere.** Not as taste — as the performance and contrast argument
   above, and because the coverage map already has a measured problem.

### And the sentence that keeps it honest

> **Elevation encodes one fact and only one: this floats above the record and can be dismissed.**
> A card that cannot be dismissed does not float. Nothing gains gloss for being important.

That gives the owner a real, tactile, above-the-surface 3D treatment on every popover, overlay and
banner in the product — measurably contrast-safe, printable, high-contrast-safe, free of
`backdrop-filter`, and consistent with 04's *"visual weight maps to epistemic status, not to
flair"*, because it maps elevation to **dismissibility**. The owner gets the gloss. The ledger
underneath stays paper.

---

## Cut these

Named plainly. Nobody would notice their absence, and several would cost more than they return.

**1. `#/status` as a screen.** Its justification is spent by Decision 5 and the spec already
licensed the cut — *"If wave 3 arrives and the counts have found a better destination, this screen
should be cut rather than built."* 02 found the destination: the header counts link to the item
list, the draft filter and the review queue. Take the cut. **Nobody would notice.**

**2. The deny wall (09 cap 6).** It is `mycontext audit --op deny --items`. 09 calls it *"the
cheapest screen in this paper"*, which is an argument about cost, not about §1. Keep the insight —
*a repeated deny is a route that does not exist* — as a **doctor finding**, not a rail entry.

**3. Lifecycle debt (09 cap 12) and the revision watchdog (09 cap 16).** A type filter plus a date
subtraction, and a sort by age. Both are rows in the unified queue and neither is a surface. Two
screens, zero new answers.

**4. `10B` — reading git objects with `node:zlib`.** The one to refuse hardest. Loose objects only
means the feature answers correctly on a freshly-fetched repository and renders *"packed; cannot
read"* on every repository that has been `gc`'d — which is most of them, most of the time, and
increasingly so as the repo ages. **A capability whose correctness degrades silently with
repository age is worse than no capability.** And the spec set the precedent in the adjacent case:
it refused to shell out for ahead/behind counts *"to keep `git` off the dependency-in-spirit list
for a decoration."* A packfile reader is that decision an order of magnitude larger. **Cut it, and
take 09's own team capability #2 instead** — a second worktree pointed at a second tab gives the
same answer with zero git parsing and zero new code paths.

**5. The `#/palette` screen, the standing overlap report's similarity ranking, and the facet-first
item list.** Three cuts with one reason: each is a *destination* for something that belongs
somewhere else. The palette is the composer (02 is right — a command is worth composing where you
found the reason for it). The similarity ranking is a scoring function this codebase does not have;
ship the exact half. The item list is `mycontext search`, and it is substrate, not a reason to open
the app.

**Also cut, smaller:**

- **The W1/W2/W3 badges.** Build schedule leaking into the product.
- **03's preview rule 4** (the cut-line animation). Wrong picture; 05's staircase replaces it.
- **The word "conversion"** in cap 5 and **the word "rent"** in cap 3. Keep both screens, delete
  both words — they are the only fabricated things in them.
- **04's 30px 0.55 ms treatment.** Keep the principle, on the six-class axis; the number belongs on
  a diagnostics line, not as the loudest object on a governance screen.
- **`audit --files` as a screen.** A diagnostics line.
- **The global-layer browser.** A layer facet, not a surface.

**And one thing I will not let be cut, because it will look cuttable:** the **empty states**. They
are spec-required, not polish, and 08's five-zeroes taxonomy is the single highest-leverage honesty
idea in the panel. The first user of the product sees a screen with nothing on it, and an
unlabelled blank is an unsourced claim the reader completes with the least flattering cause
available.

---

## Headline

Applied to all ninety-five proposals, §1's test passes thirty-four outright, conditions eleven on a
named join without which they should be cut, and fails eleven — but a third of the panel's output
is not a feature at all, it is the repair of something already broken, and those go first: the
coverage map colours a pinned-governed directory as a gap, which is a false statement rendered in
the flagship graphic, and the mockup ships a Copy button for `mycontext edit --budget jit=8000`, a
flag `edit` does not have, which two panellists then inherited as fact. The claims the data cannot
back cluster in one place — the ledger collides repeat injections by design, so §4's own
*"injections per item over time is a real series"* misreads the comment it quotes; `origin: 'human'`
is a call-site constant the spec elsewhere calls *laundered*; "nudge conversion", "body similarity"
and the rent ranking are inferences wearing measured numbers; and every token figure in the product
is `chars/4`, which the source calls *not a guaranteed bound*. Give the owner what he asked for in
the form that stays true — total exposure recast as **"every capability is either reachable, or
named as not reachable, with its reason"**; tutorials and help made *generated* rather than written,
so a removed flag fails a test the day it is removed; and a gloss built from an opaque elevated
surface with a specular edge, which is 3D and above the surface and printable and measurable,
because the ledger underneath it has to stay paper.
