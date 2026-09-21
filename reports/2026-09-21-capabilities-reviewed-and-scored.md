# The capabilities, reviewed and scored — 2026-09-21

**A read of the whole codebase at `ba8b21cc`, by feature, capability and mechanism: what each
one is for, how good the design is, how good the implementation is, and a score for both.**
Companion to `reports/2026-09-21-external-status-review.md` (the repository's state) and
`reports/2026-09-21-installed-as-a-new-user.md` (the product as a stranger meets it). Those two
measured; this one reads.

Nothing in the repository was changed. Two subjects the owner asked for by name — the
self-improvement loop, and the product rule store with its maintenance tools — were read and
exercised at greater depth than the rest and have their own section (§3).

---

## 0. Method, and how far to trust it

Seven reading lanes, each an agent with a fresh context, each given one slice of the tree, told
to read its files in full, cite every defect as `file:line` with a quoted fragment it had
actually read, and to treat a code comment that explains an oddity as a ruling rather than a
defect. Six lanes read; the seventh also ran what it read, on a throwaway corpus in a scratch
directory. Their reports total about 17,000 words; I then re-verified every claim that carries
weight below by opening the cited line myself. Where a lane and I disagreed, I say so.

| Lane | Slice | Files read in full | Ran anything? |
|---|---|---|---|
| 1 | corpus core and injection (`src/core/` selection, store, config, trust, lock) | 32 + tests | one parser check |
| 2 | hooks, MCP server, CLI, slash commands, skill | 24 hooks + `src/mcp/` + `src/cli/` | no |
| 3 | capture, gates, doctor, review loop, lesson, ingest | ~50 modules + tests | one `path.win32` check |
| 4 | archive, search, anchors, retrieval, restore, handover, audit | ~40 modules + tests | no |
| 5 | packs, export/import, rule store, gate scripts, CI | `src/pack/`, `src/rules/`, `scripts/`, workflows | no |
| 6 | web UI server and front-end (93,006 lines) | server, security, read models, `app.js`, 10 screens, libs | ran one static test |
| 7 | self-improvement loop and rule store, deep | `src/review/`, `src/rules/`, `src/ui/maintenance/`, specs, chapters | **yes**: loop pass end to end, tamper-and-verify, maintenance server |

**Scores** are 1–10 on two axes. *Design*: is the approach sound for what it is for; 9–10 means
"I would not change it", 5–6 "works but I would rewrite parts", 1–3 "broken or dangerous".
*Implementation*: correctness, error handling, portability, performance shape, and whether the
tests pin the behaviour or only the fixture. Each row carries a confidence: **high** means read
and traced, **medium** read but not traced, **low** inferred.

**What this review is not.** It is not a line-by-line audit of 213k lines; each lane read its
slice in full but judged mechanisms, not every branch. It did not run the perf suite. Lane 6
read the structure of the 12,728-line conversations screen and its paint loop, not every line.

---

## 1. The headline

**This is a well-designed system implemented by someone who documents decisions better than
almost anyone, with a small number of sharp defects that the documentation has not caught.**

The averages across 108 scored mechanisms are **design 7.8, implementation 7.4**. Nothing
scored below 4 on either axis. Fourteen mechanisms scored 9 on design; the lowest design score
is 5 (the UI read model and the accessibility posture). The distribution is tight, and it is
tight because the same disciplines recur everywhere: pure functions over parsed data, every
budget derived from the thing it budgets, every "could not measure" disclosed rather than
zeroed, expected sets derived from the design of record rather than remembered.

What pulls implementation below design is not sloppiness in the large; it is nine specific
defects, each small, each cheap, each in a place the project's own gates do not look:

| # | Defect | Where | Consequence |
|---|---|---|---|
| D1 | The outside-repository guard passes an absolute path on another Windows drive | `src/core/reference.ts:236` | 84 corpus items carry `C:/…/Temp/…` provenance, 55 with checksums; `doctor` exits 1 on every other machine forever. **This is the root cause of the status review's G2.** |
| D2 | The review pass's read offset is one number per workspace, not per transcript | `src/review/pass.ts:400`, `trigger.ts:232` | A second session's transcript has its first N bytes skipped and reported as read WHOLE; cross-session recurrence, the loop's only guard against plausible falsehood, cannot occur. |
| D3 | `--ceiling 0` becomes "no ceiling" in the detached child | `src/review/pass.ts:674` | The test pins the in-process path; production runs the child. |
| D4 | Audit log rotates before it heals a torn tail | `src/core/audit.ts:1646` vs `:1659` | A torn ≥8 MiB segment keeps the projection `behind` and every read-only audit surface refusing until a hand truncation. |
| D5 | A locked or corrupt archive index becomes "nothing matched" | `src/ui/read-model-retrieval.ts:768-774` | The retrieval mission tells the subagent the passage named nothing. Open as `swallow/13`; still live. |
| D6 | Snapshot ids absent from the corpus vanish at restore with no spill or note | `src/core/select.ts:1698-1709` | Open as `swallow/14`; still live. |
| D7 | Full export is unimportable, by two modules written to opposite premises | `src/pack/config-io.ts:257-262` vs `import.ts:318` | The changelog and the `pack` command say the importer reads a full export; the export projector's own comment says it must never reach the merge. |
| D8 | The dispatch gate's id matcher has no boundary and no lowercase-slug requirement | `src/hooks/pre-tool-use.ts:555` | `READ-ONLY`, `SHA-256`, `UTF-8` in a prompt are refused as missing items; `makeId` never mints an uppercase slug. |
| D9 | The manifest seals an entry that fails to parse; verify then reports intact | `src/rules/manifest.ts:75, :206` | A publish from the maintenance tool with a broken file present ships it. |

Three of the nine (D5, D6, D1's symptom) are already on the board. The other six are not.

---

## 2. Findings by area

Each area: what is excellent, what is wrong, and the area's score band. Every citation was
opened by me after the lane reported it.

### 2.1 Corpus core and injection — design 7.3 · implementation 7.6

**Excellent.** `itemCost` *is* the renderer (`select.ts:517-519`), so budgeting cannot drift
from output, and a cross-module test proves it. `UPDATE_FIELD_POLICY` with `satisfies` plus
four `Assert<>` types (`trust.ts:616-749`) makes a writable field with no policy a compile
error in both directions: the best compile-time guard in the tree. `reclaimStaleLock`
(`lock.ts:329-357`) turns a reproduced race into a structural guarantee and names its residual.
Selection is genuinely pure and the tier algorithm's gate ladder (`GATE_RUNG`) lets a later
tier falsify an earlier spill.

**Wrong.** A UTF-8 BOM defeats the frontmatter delimiter (`item.ts:59`, `:532`) and the item
refuses to load with the message "no --- frontmatter block found", verified by execution;
Windows editors emit BOMs. Index lines under budget pressure are dropped **alphabetically**
(`select.ts:1142-1144`), so which governing item goes untitled is decided by its id's first
letter. Two lexical tokenisers disagree about what a word is: `overlap.ts:116` is ASCII-only, so
the contradiction gate is silent for a non-Latin draft, while `rank.ts:84` is Unicode-aware.
Two sort sites use `localeCompare` (`decay.ts:110`, `rank.ts:433`) against the project's own
rule at `select.ts:714`. The delivered block omits `severity` and `always` (`render-item.ts:231-248`),
so the model is never told which rule is hard, although severity decides admission order.

**The spare band, settled.** `select.ts:1638-1640`: `candidates.length > 0 && pinnedCost <=
config.budgets.pinned ? … : []`. With zero pinned items the band is empty by ruling
(`OPENQ-does-the-pinned-tier-spend-its-spare-room-on-governing-items`, 2026-09-07, "THE NARROW
FORM"). Deliberate, disclosed by the governing-spill sentence, and pinned by no test that names
it; the walk-through's F1 stands as a design consequence rather than a bug.

### 2.2 Hooks, MCP and CLI — design 8.3 · implementation 7.7

**Excellent.** `io.ts`'s `payloadOf` narrowing and closed `hookContext` union turn the
platform's silent envelope mismatch into a compile error at zero runtime cost. The PreCompact
and PostCompact pair names every miss vector, discloses a failure to disclose, and reversed a
spec on a measured platform fact. The PreToolUse deny checks the raw spelling **and** the
canonical spelling (`pre-tool-use.ts:93`), with the Bash exclusion ruled and its failure
taxonomy written down. The hand-written MCP protocol layer is spec-correct on notifications,
version negotiation and framing, with 27 wire tests. The CLI's flag tables are derived and
identity-checked rather than copied, and the JSON failure envelope and exit-code contract are
tested as a contract.

**Wrong.** The dispatch gate's `AGENT_ID_TOKEN` (D8). `add` runs the summary gate
(`index.ts:956-959`) before `createItem` resolves the category (`:1317`), so an unknown category
gets the summary essay first. `lesson` (`command-flags.ts:409`) accepts no summary and calls
`createItem` with neither `summary` nor `summaryOmitted`, bypassing the gate `add` enforces.
`post-tool-use.ts:458-461` bypasses `parseHookInput` and swallows a malformed payload silently,
the one hook of eighteen out of step with the disclosure discipline. The 500 ms SessionStart
budget exists only in a perf test whose own header records a minimum sample of 504.4 ms on a
loaded machine; `hooks.json` gives the platform 10 s. `stop.ts` is 1,634 lines and has become a
scheduler (UI upkeep, archive refresh, anchor pass, review trigger) under a 3 s timeout. The
parent-session label is `sessionId.slice(0, 8)` (`continuity.ts:203`), correct for UUIDs and
wrong for anything else; **this corrects F10 in the walk-through, which called it a hyphen cut.**
`commands/add-rule.md` tells the model to fall back to `add … --yes` in the shell, which
`SKILL.md` forbids, and the generator's test exempts inline prose from that check.

### 2.3 Capture, gates, doctor — design 7.8 · implementation 7.2

**Excellent.** The mutation core's gate ladder is argued in order, the duplicate probe hoisted
above the contradiction gate so "nothing was written" is true. Doctor's disclosure discipline is
the best thing in the area: every check that cannot measure emits an `about:`-linked coverage
finding, `check_failed` names the check and its registry position, and the contradiction drain
prints its own miss rate ("two items that AGREE score exactly as high as two that conflict").
`retire.ts` measured its own corpus and refused to derive a retirement threshold from noise,
leaving `RETIREMENT_RULE = null` with the argument attached. The revision and draft trust split
is strong: hash-keyed re-stage refusal, path-asserting promotion test, and `reviewNeverEditsError`
as a core refusal rather than a prompt request. Ingest's verbatim-quote check is a real forgery
brake and `assertDraft` makes "ingest never governs" a runtime invariant. `needs`/`ready` is
pure, config-derived, and cannot go stale.

**Wrong.** D1, the worst single defect in the tree: `readSnapshot`'s guard is `rel === '' ||
rel === '..' || rel.startsWith('../')` over `path.relative`, which on Windows across drives
returns an absolute path; I verified `path.win32.relative('D:\\src\\my-context',
'C:\\Users\\U\\Temp\\zero.md')` is `"C:\\Users\\U\\Temp\\zero.md"` and counted 84 items in this
corpus with a `C:/` source, 55 with checksums. One line (`path.isAbsolute(rel)`) plus a repair
of the 55 closes it. Summary enforcement is surface-only by design (`mutate.ts:161-169`), and
three human-facing surfaces walk around it: `lesson`, `inbox-promote` (`:242-260`) and
`promoteRevision` (`revision.ts:849-857`), none recording an opt-out. `supersedeItem` is two
persist calls (`mutate.ts:2546`, `:2573`) with no rollback and no disclosure of the half-written
state. `tests-resting-on.ts:392-409` contains the "COULD NOT BE READ" block twice, a merge
artefact that prints twice. Doctor re-reads every item file in two checks
(`body-integrity.ts:469`, `:559`) and lists the tree three times per run. The ingest quote check
has no minimum length (`schema.ts:358-362`): `"quote": "the"` passes. An acknowledged `error`
still moves the exit code (`acknowledge.ts:25-27`), so on this corpus `doctor` cannot exit 0
until D1 is fixed.

### 2.4 Memory across sessions — design 7.9 · implementation 7.4

**Excellent.** The anchors file written *inside* the SQLite transaction (`anchor-file.ts:326-373`)
is the best-argued piece in the area: file-first inside `BEGIN IMMEDIATE`, so a crash leaves the
file ahead and the table catching up, with a `WeakSet` guard that turns a category error into a
thrown error. Restore staging verifies every write by reading it back and rolls back an approval
whose verification fails, disclosing when the rollback itself fails (`restore-stage.ts:355-369`,
`:462-484`). Retrieval's pointer-only mission and cite-or-drop result contract enforce "nothing
enters context unchosen" by shape rather than instruction. The search grammar discloses every
limit of its tokenizer: the three-character floor, the short list, hits in kinds not asked for.

**Wrong.** D4 (rotate before heal) and D5, D6 (the two open swallows, both still live; the
pattern that distinguishes the empty classes exists eleven hundred lines away at
`read-model-conversations.ts:2191-2206`). The transcript directory encoding replaces only
`[\\/:]` (`conversation-index.ts:1073`) while the harness replaces every non-alphanumeric, so a
project path containing a dot or underscore is looked up under the wrong directory and reported
as an empty archive, disclosed as a harness-owned encoding but wrong. A full archive rebuild runs
inside one `BEGIN IMMEDIATE` with a 300 ms busy timeout on the Stop hook (`stop.ts:775`), so the
hook starves for the rebuild's duration. `carryFrom` (`continuity.ts:220-247`) blanket-catches
and discards the error strings its own reader produced. `CHARS_PER_TOKEN = 4` in the handover is
two to three times off for Hebrew, argued as consistency with the selector; a Hebrew handover
over-delivers and nothing surfaces it. Two session-id sanitisers exist for one input
(`statusline-tee.ts:41`, `ledger.ts:711`).

### 2.5 Packs, export, gates and CI — design 8.2 · implementation 8.0

**Excellent.** This is the strongest area in the tree. `layout.ts` is one path grammar shared by
both writers, both readers and the manifest, with set-level case and prefix collision detection
and every Windows semantic reasoned per row. `zip.ts` is a hand-written, byte-deterministic
container with a defensive reader and honestly recorded equivalent mutants. The reader parses
nothing before every digest agrees. The dependency budget is parsed out of the constraint's own
sentence, and every checker refuses the vacuous pass. The CI order fails cheap gates first and
the release workflow is a pinned superset.

**Wrong.** D7, and it is a contradiction rather than a bug: `bundle.ts:469-474` writes the
export config with every category key; `import.ts:318` calls `refusePackConfig` unconditionally
with no branch on `manifest.kind`; `config-io.ts:257-262` says "Nothing may feed this projection
through `mergePackConfig`", while `import.ts:121`, `:426-433`, `pack.ts:555` and the changelog all
assume a full export reaches `applyImport`. The refusal at `import.ts:523-529` is dead code, and
the test at `pack-import.test.ts:820-833` pins a pack-shaped fixture under an export label. Note
that `kind` lives in an unsigned manifest, so relaxing on `kind === 'export'` would be a trust
hole; the safe resolutions are to declare a full export a non-importable archive and fix the
prose, or to ignore `config.json` on `kind === 'export'` and require every category to resolve
locally. `applyImport` (`import.ts:501-505`) writes the merged config with a bare
`writeFileSync` and then loops item creation with no pre-flight of `extra` fields
(`unknownExtraFieldError` at `mutate.ts:811` is never called from `src/pack/`), confirming
`store/7`. `e2e-gate.ts:208-277` calls `process.exit` inside `try/finally`, so the scratch
directory is never removed. `check-board`'s drift tier is vacuous in CI because
`actions/checkout@v4` runs at depth 1 and `readCommits` sees one commit; it never gates, so
nothing is falsely green, but the "inside a run whose greenness means something" argument is
hollow there. `set-version.ts` claims post-write verification it does not do (`:95-97` vs
`:228-232`). `deliver.ts:408-410` decides the developer tier by path equality without `realpath`,
so an `npm link` install or a lowercase drive letter could silently drop it.

### 2.6 The web UI — design 7.6 · implementation 7.3

**Excellent.** The execute pipeline is the best-designed mechanism in the UI: the client never
sends argv, the server rebuilds it from the same `palette-defs.js` catalogue the browser uses,
the nonce is bound to `sha256([id, argv])` and is one-shot even on mismatch, the child runs via
`execFile` with an array so there is no shell and no escaping, and the audit row is written
before the run. Static serving is textbook (realpath containment, extension allow-list, symlink
refusal). The string tables (1,559 keys each) are parity-gated both ways and every `data-t` key
in the mockup must exist. Bidi is done with logical properties and computed-style isolation
counts. Every browser gate derives its expected set from the mockup's bytes rather than a
remembered number.

**Wrong.** The read model opens and closes SQLite per request with no cache on a single thread
(`read-model-base.ts:30-44`), and a screen that fires five reads opens ten handles serially; the
open performance tasks follow directly, and `GET /api/execute/confirm` adds a corpus copy and a
child process (`execute-effect.ts:608`, 15 s budget) to the same thread on every confirm. The
Content-Security-Policy is switched off, deliberately and with the fix named in the comment
("`script-src 'self'` … costs a developer nothing"), and `server-e2e.test.ts:89` asserts the
header is absent; the compensating control, no `innerHTML` in first-party code, holds. The
credential machinery is elaborate against other origins and, by an accepted ruling
(`security.ts:508-519`), hollow against any local process, which can mint a nonce at will. The
disclosure component is adopted by 5 of 22 screens; `doctor.js` draws every finding in three
sequential loops with no table of contents, which is the 20,180 px Doctor screen. There is no
`h1`, no skip link, and one breakpoint at 1000 px. `commandFor` (`palette-defs.js:838`) pushes
positional values raw, so a value beginning with `--` reaches the CLI as a flag. The load-time
404 is the missing favicon. **The thirteen `strip.spec` failures are a stale scenario, not a
broken strip:** the identity fields are nulled when the session is cold (`viewmodel.js:1107`,
`app.js:6583`), the spec routes `/api/sessions` in only one scenario (`strip.spec.ts:355`), and
the suite runs on the live corpus by ruling (`e2e/app.ts:60`), so on a machine with no recorded
session the strip is cold by design. This corrects §8 of the status review, which said the
thirteen share one message; they share one cause.

### 2.7 Cross-cutting patterns

- **Two spellings of one rule** is the defect the codebase names most often about itself, and
  it is the one it still has most: two tokenisers, two session-id sanitisers, three copies of the
  cross-drive guard, two `localeCompare` sites against a stated rule, a skill and a generated
  command that contradict each other.
- **The gate that exists elsewhere.** D5 has its fix pattern eleven hundred lines away; D8's
  correct prefix list is already resolved in the same function; D1's `path.isAbsolute` is a
  standard call. The project's habit of solving a problem once and well does not always reach
  the second site.
- **Fixture-shaped tests at the seams.** The spare band, `--ceiling 0`, the export/import
  round trip, the strip scenarios and the torn rotated segment are each pinned by a test that
  asserts the fixture rather than the behaviour, or by no test at all. The project's own basis
  and anti-vacuity gates catch a test that cannot fail; they do not catch a test that fails to
  ask.
- **Comments as the second source of truth.** Several stale claims live in high-quality prose:
  `screen.ts:14-16` says screening runs before parsing (it does not); `set-version.ts:95-97`
  claims verification it does not do; `sse.js:2-6` gives a rationale the cookie made obsolete;
  chapter 10 line 453 denies that a maintenance tool exists. With 58–68 % of the largest files
  being comment, the prose is where drift hides.

---

## 3. The two subjects asked for by name

### 3.1 The self-improvement loop — design 7.6 · implementation 6.3

**What it is.** Three dials in `ReviewConfig`: `enabled` (the kill switch, default `false`),
`maxProposalsPerPass` (a ration on writes, default `0`), `model` (whether a model is called,
default `null`). The 2026-09-16 subject map's "three dials at the value that does nothing" was
true of the shipped defaults and has been false of **this repository** since 2026-09-13:
`.my_context/config.json` sets `enabled: true, maxProposalsPerPass: 5, model: "claude-opus-5"`,
and `state/review-counter.json` shows the loop fired a pass during the session that wrote this
report. Chapter 11 says so; the subject map is the stale document.

A pass reads the **transcript**, not the audit log: it summarises the session and lane JSONL
into five cue-scored categories, applies a rubric (a decision or a correction fires alone; a
failure only if something resolves it), and runs two proposers. The deterministic one selects
one transcript sentence about a target and can author only `check` items as `task` drafts. The
model one shells out to `claude --print --model <name>` on stdin, no network call from Node and
no dependency, and can compose `check`, `rule` and `lesson`. Every candidate passes an
anti-learning regex screen, a target-relevance gate, the decline ledger, near-duplicate
suppression, the ration and the queue ceiling. Drafts land in gitignored `.my_context/.drafts/`
as `origin: review`, which `trust.ts:288` forces to `draft`; `mutate.ts` refuses a review-origin
update or retire, so the pass is create-only. A human reaches proposals through `mycontext
review`, the `list_drafts` tool, the Review-queue screen and the status chip. What reaches no
human: the trigger verdict (an audit-row note only) and `review-last-pass.json`, which nothing in
`src/ui`, `src/cli` or `src/mcp` reads.

**Exercised live**, on a throwaway corpus with a synthetic eight-record transcript: session-start,
three PostToolUse fires, Stop. The audit row said "pass 1 of the session started — 3 tool call(s)
since the last pass, 2017 new byte(s) to read"; six seconds later two `task` drafts existed in
`.drafts/task/`, two sightings in `review-claims.json`, and the rubric said "1 correction in this
stretch, the first from the person". `review discard` deleted one and wrote the ledger row;
`review promote` moved the other out of `.drafts/` into `items/`. With a shim standing in for
`claude`: absent binary produced `why: "spawn claude ENOENT"` and the deterministic path
continued; a JSON reply produced a good rule that was then **suppressed as a near-duplicate** of
the deterministic task on the same target; a prose reply was named unparseable and kept; a model
name of `--` was refused before spawn. **The loop is a real, working capability end to end,
without a model.**

**Quality, observed.** The person's correction ("must never hardcode a rate other than 0.17")
classified as `rule`, which the deterministic proposer cannot author. The person's decision
("We decided to go with banker rounding") was screened as narrative because
`NARRATIVE_OPENING` (`propose.ts:459`) rejects a sentence opening with "We". What was proposed
was the assistant's own echo of the correction. The design anticipated a weak deterministic tier
and rationed it; the consequence is that the deterministic path alone is not worth a person's
queue, and the model path is pre-empted by it (D3's neighbour: the model loop runs second and
`suppress` checks against the deterministic list already pending, `propose.ts:1076`).

**Defects, verified.** D2: `lastReadTo(options.workspace)` (`pass.ts:400`) and `lastReadTo(root)`
(`trigger.ts:232`) read one workspace-wide byte offset; a second session's different transcript
of 3,210 bytes was reported `sinceByte: 2017, readTo: 3210, read WHOLE`, skipping the three real
turns at its head including a person's correction. Cross-session recurrence, the design's only
guard against plausible falsehood (§3c), cannot happen through this path; no test drives two
sessions through one workspace. D3: `Number(flag(argv,'--ceiling') ?? 0) || NO_QUEUE_CEILING`
(`pass.ts:674`) turns a present `--ceiling 0` into "no ceiling" in the child that production
runs, while `ration.test.ts:141` pins "a ceiling of 0 is the ceiling set to nothing" in-process.
Smaller: a model summary without a terminal period is recommended `decline` with a reason about
transcript truncation that cannot be true of a composed sentence (`recommend.ts:217`);
`firstArray` takes the first `[` rather than the first array (`model.ts:450`); a reply over 1 MB
is dropped with no record of the cut (`model.ts:284`); decline keys are computed from the
composed body, diluting the claim, which the id-family gate compensates for and a test names.

**Verdict.** Design 8: thorough, evidence-cited, honestly bounded, over-built in prose and
under-built in the one place recurrence is computed. Implementation 6: everything reachable
works and the failure disclosure is the strongest of any hook subsystem in the tree, but two
genuine bugs sit exactly where the design says its safety lives. Both are cheap: key `readTo` by
transcript path, and parse `--ceiling` with an explicit presence check.

### 3.2 The product rule store and its maintenance tools — design 7.2 · implementation 7.2

**What it is.** A product rule is a Markdown entry under `src/rules/entries/`, one of five
kinds with a fixed template per kind (`schema.ts` `TEMPLATE`), mandatory `example` and `check`,
no lifecycle fields, tier `product` or `developer` (the latter delivered only when the workspace
*is* this package). It never meets the corpus: `isolation.test.ts` walks the import graph and
proves `list`, `ready`, `doctor` and the selector return nothing from the store. The store is
delivered whole at every door with a preamble and the precedence sentence; conflicts are a slug
match between an entry and a *delivered* item, reported and never enforced. "A product constant
outranks every other source" is therefore a sentence handed to the model plus a report, not a
mechanism that suppresses anything.

**The seal.** `manifest.json` carries a CRLF-normalised SHA-256 per entry; `verifyManifest` names
`missing`, `altered` and `unexpected`, all of them. Verification on every surface a person or a
door sees passes no sanctioned list, while writes use `manifest.working`. So the seal is a
checksum that anyone with `writeManifest`, which is anyone with the repository, can recompute:
tamper-evidence against accidents, not integrity against write access. The spec (§7 "Not
encrypted", §13) never claimed more; the defect is that `rules verify` speaks as if it proved
provenance ("the rule store is intact — every entry matches the checksum that shipped with it").

**Exercised live.** `rules verify` on the shipped store: intact, version 5, exit 0. A copy with
one entry appended, one added and one deleted: exit 1 naming all three, and a session start
against that copy delivered the substitution line, the integrity block naming the three, **and
the planted entry as "an entry nobody shipped"**, disclosed rather than blocked, as documented.
Re-sealed with the product's own `writeManifest`: verify says intact. `verify --restore` against
that "intact" copy restored the two shipped entries and left the planted one in place; restore
compares against the package and is the only provenance check that exists. A sealed entry that
does not parse: `verify --json` says `ok: true` while `rules list` says "could not be read (1)".

The maintenance server (`src/ui/maintenance/`): loopback only, refuses `0.0.0.0` and port 58888
before binding, **no authentication** by quoted ruling, **no audit** beyond the publish
changelog's free-text note, excluded from `npm pack` by `"!src/ui/maintenance/"` and asserted by
`maintenance-absent.test.ts`, launched by nothing in the CLI or MCP. On port 47101 against a
scratch copy: `GET /` served with no credential; `POST /save` editing an entry answered 303,
marked it `working`, and `verify` on that copy then said "Somebody changed it, or something did"
about the owner's own sanctioned edit until publish; an out-of-band edit to a second file made
the next save refuse with the store-damaged error, as the router promises; `../../pwned` as an id
was refused by the slug regex; `POST /publish` produced version 6 with the changelog row, cleared
`working`, and verify said intact. **The tool works as documented.** But the boundary "the only
legitimate way to edit the store" is documentary plus packaging: inside the repository nothing
prevents an editor plus `writeManifest`, and the test suite itself does exactly that
(`test/cli/rules.test.ts:59` appends into `entriesDir()` and `:292` re-seals it), which is the
active known issue about the suite editing the shipped store. Note also that
`claude plugin install` from this marketplace uses `source: "./"` and ships the repository, so
the maintenance surface is on disk for every plugin user; nothing launches it, so exposure is
nil, but the spec's "they do not have it" is false for the primary install path.

**Defects, verified.** D9: `writeManifest` seals an unparseable entry (`manifest.ts:75`,
`:206`, `id: 'error' in parsed ? (parsed.id ?? file) : parsed.id`) and `planPublish` refuses only
on budget, so a publish with a hand-broken file present ships it. The live test that mutates the
shipped store (`rules.test.ts:59`). Chapter 10 line 453 says no maintenance screen exists and
recommends editing a `.md` file and updating the manifest by hand, the exact bypass the boundary
exists to prevent; the Hebrew store document and the code disagree with it. `renderCorrection`,
the mid-session correction, is built, tested and called by nothing, documented as the deliberate
end state, and not counted.

**Verdict.** Design 8 for the store itself (isolation proven by an import walk; disclose-not-block
at the doors is exactly right), 6 for the seal and the precedence claim (both honest in prose,
both overstated at the surface). Implementation 7: everything documented works, two real gaps.
What would make the seal mean something: sign the manifest with a key the package carries and
the repository does not, or stop calling it integrity and have `rules verify` say "matches the
checksum it was last sealed with", which is what it proves.

---

## 4. Summary table with scores

Area rows are the arithmetic mean of the mechanism rows in Appendix A. The "worst mechanism"
column is where to look first in each area.

| Area | Mechanisms | Design | Implementation | Best mechanism (D/I) | Worst mechanism (D/I) |
|---|---|---|---|---|---|
| Corpus core and injection | 16 | **7.3** | **7.6** | selection and tiers (8/8), checksums (8/8), locking (8/8) | spare band (6/7), search and overlap (7/6) |
| Hooks, MCP, CLI | 15 | **8.3** | **7.7** | hook envelopes (9/9), deny (9/9), MCP protocol (9/9), compact pair (9/9) | dispatch gate (7/4), help and parity (8/6) |
| Capture, gates, doctor | 13 | **7.8** | **7.2** | drafts and trust split (9/8), needs and ready (8/9) | content hash and drift (7/4), summary gate (8/6), lesson (6/7) |
| Memory across sessions | 15 | **7.9** | **7.4** | anchors file (9/9), session names (8/9) | retrieval missions (9/6), restore (7/6), audit writer (8/6), continuity (7/6) |
| Packs, export, gates, CI | 19 | **8.2** | **8.0** | zip (9/9), paths and Unicode (9/9), dependency and vendor gates (9/9) | e2e gate (8/6), config merge vs export (7/9), verify and maintenance (7/7) |
| Web UI | 16 | **7.6** | **7.3** | execute route (9/8), static serving (9/9), bidi (9/8), parity gates (9/7) | read model (5/7), accessibility (5/5), disclosure adoption (8/4) |
| Self-improvement loop (deep) | 8 | **7.6** | **6.3** | trigger (8/7), decline and promotion (8/7) | pass and report (8/5), ration and ceiling (8/5) |
| Rule store and maintenance (deep) | 6 | **7.2** | **7.2** | schema and isolation (9/9), delivery (8/8) | seal and verify (6/6), precedence (6/7), maintenance server (6/7) |
| **All** | **108** | **7.8** | **7.4** | | |

**How to read the two numbers.** A design 8 with an implementation 5 (the review pass, the
ration) is a good idea with a bug in it: fix the bug. A design 5 with an implementation 7 (the
read model) is the wrong shape done carefully: no bug to fix, a decision to revisit. A 6/6 (the
seal) is a mechanism whose claim outruns what it can prove: fix the claim or strengthen the
mechanism, not both.

---

## 5. What to fix first, by leverage

1. **D1**, `reference.ts:236`: `path.isAbsolute(rel)`, plus a repair pass over the 55 items.
   Closes the fresh-clone `doctor` failure and G2 of the status review in one line.
2. **D2 and D3** in the review loop: key `readTo` by transcript path; parse `--ceiling` with a
   presence check. Two lines each, and they are where the loop's safety argument lives.
3. **D7**: decide what a full export is. Either a non-importable archive (fix the changelog,
   `pack.ts:555`, and delete the dead branch) or importable with `config.json` ignored and every
   category required to resolve locally. Never relax on `kind`, which is unsigned.
4. **D8**: require `-[a-z0-9]` after the prefix and a left boundary in `AGENT_ID_TOKEN`, or
   derive the prefix alternation from the config already resolved at `pre-tool-use.ts:627`.
5. **D4, D5, D6**: heal before rotating; distinguish the two empty classes in
   `composeMaterial` the way `apiConversationSearch` already does; disclose dropped restore ids
   as a spill.
6. **D9 plus the honest sentence**: refuse to seal an unparseable entry in `planPublish`, and
   make `rules verify` say what it proves. Move the shipped-store mutation in
   `test/cli/rules.test.ts` onto a copy like every other rules test.
7. **CSP on**: `script-src 'self'`, as the suspending comment itself recommends.
8. **The summary gate's three back doors**: give `lesson` a `--summary`, ask for one in
   `inbox-promote`, record `SUMMARY_OMITTED_NOTE` in `promoteRevision`; and check the category
   before the summary in `add`.
9. **The read model**: one mtime-keyed cache per store file, or a shared handle per request
   burst. This is the only item on the list that is a design change rather than a fix, and it is
   the root of every open UI performance task.
10. **The stale prose**: chapter 10 line 453, `screen.ts:14-16`, `set-version.ts:95-97`,
    `sse.js:2-6`, the subject map's loop sentence. Each is one paragraph; each is currently the
    most authoritative-sounding wrong claim in its file.

---

## 6. Corrections to the two earlier reports

- **Status review G2** attributed the 56 `doctor` errors to corpus hygiene. The root cause is
  D1, a product bug on Windows; acknowledging them cannot clear the exit code.
- **Status review §8** said the thirteen `strip.spec` failures share one message. They share one
  cause (a cold session on a machine with no recorded session); at least three messages appear.
- **Walk-through F10** said the subagent label cut the session id at its second hyphen. It is
  an eight-character prefix (`continuity.ts:203`), correct for UUIDs and wrong for anything else.
- **The subject map of 2026-09-16** says the self-improvement loop is switched off. Its
  shipped defaults are; this repository's config has had all three dials on since 2026-09-13,
  and the loop fired during this review.

---

## Appendix A — every mechanism scored

108 rows, as the lanes scored them and I verified. D = design, I = implementation, C = confidence.

### Corpus core and injection

| Mechanism | D | I | C | Verdict |
|---|---|---|---|---|
| Item model and frontmatter | 7 | 7 | high | Exact round-trip discipline; BOM files refuse with the wrong message |
| Checksums and content identity | 8 | 8 | high | Conditional keys plus basis version; `extra` key order is identity |
| Store, index, migration | 7 | 7 | medium | Self-heal correctly narrowed; busy detected by message text |
| Selection and the tier algorithm | 8 | 8 | high | Pure, single dispatch, gate ladder; would not change |
| Budget fitting and spill disclosure | 8 | 8 | high | First-fit documented; index order alphabetical |
| Spare band | 6 | 7 | high | Deliberate narrow form at `select.ts:1638`; bimodal, untested by name |
| Seen-file dedupe | 8 | 8 | high | Verifies what it can, refuses to guess presence |
| Scope globs and paths | 7 | 8 | high | Portable, cached; no negation |
| Focus | 8 | 8 | medium | Disclose-and-allow with three named exemptions |
| Decay, contribution, context share | 6 | 7 | medium | Honest about the unmeasured; `localeCompare` |
| Categories, profiles, tag projection | 7 | 8 | high | Attested vocabularies only; total mismatch classifier |
| Config parsing and refusals | 8 | 8 | high | Refuse inside, skip-and-disclose outside; thoroughly pinned |
| Trust boundary | 7 | 8 | high | Compile-time field policy; file-level gap disclosed |
| Search ranking and overlap | 7 | 6 | medium | Floor cannot move; ASCII-only overlap tokeniser |
| Locking and atomic writes | 8 | 8 | medium | Structural reclaim; module-global witness slot |
| Injection orchestration | 7 | 8 | high | Every failure discloses; block omits severity |

### Hooks, MCP and CLI

| Mechanism | D | I | C | Verdict |
|---|---|---|---|---|
| Hook envelopes and payload typing | 9 | 9 | high | Right abstraction, zero runtime cost, tested at compile time |
| Fail-open policy | 8 | 7 | high | Disciplined everywhere except PostToolUse's silent parse swallow |
| SessionStart selection and latency | 8 | 7 | medium | Correct order; 500 ms is a perf-test wish, not a runtime bound |
| SubagentStart | 8 | 8 | high | Attempt-before-work is right; 8-char label reads as a wrong id |
| PreToolUse deny | 9 | 9 | high | Raw-or-canonical union, residuals pinned, Bash exclusion ruled |
| Just-in-time path resolution | 9 | 8 | high | File-anchored workspace is correct; cross-drive guard copied thrice |
| PreCompact and PostCompact | 9 | 9 | high | Over-capture safe, every skip disclosed, platform facts measured |
| Audit rows and observation runtime | 8 | 7 | medium | One runtime for ten hooks; Stop has grown into a scheduler |
| Agent dispatch gate | 7 | 4 | high | Good idea, wrong token grammar |
| MCP protocol layer | 9 | 9 | high | Spec-correct notifications, versions and framing, no dependencies |
| Tool schema and arguments | 8 | 8 | high | Unknown args refused, origin unreachable, per-call rebuild accepted |
| Provenance stamping | 8 | 8 | high | Rides on results; splitter is a prose heuristic |
| CLI parsing and flag vocabulary | 9 | 7 | high | Derived tables excellent; `add` ordering and `lesson` gap |
| Failure envelope and exit codes | 8 | 9 | high | JSON on failure, 141/74/70 codes, contract tested |
| Help, parity, slash files and skill | 8 | 6 | high | Parity tables strong; `help <command>` missing; `add-rule.md` contradicts the skill |

### Capture, gates and doctor

| Mechanism | D | I | C | Verdict |
|---|---|---|---|---|
| Mutation core and gate ladder | 8 | 7 | high | Right order, argued; supersede's two writes not atomic |
| Content hash and checksum drift | 7 | 4 | high | Cross-drive Windows paths bypass the repo guard (D1) |
| Summary gate | 8 | 6 | high | Good gate at two doors; three surfaces walk around it |
| Contradiction gate and cutoff | 8 | 8 | high | Lexical, capped, honest about what it cannot see |
| Supersession and relations | 9 | 7 | high | Closed vocabulary, unwind by second act; one duplicated block |
| Drafts, revisions, promotion, trust split | 9 | 8 | high | Hash-keyed staging, path-asserted promotion; promote/append not atomic |
| Acknowledgements and lapse | 7 | 8 | high | Whole-content anchor is coarse on purpose; ack cannot quiet an error exit |
| Doctor engine and codes | 9 | 7 | high | Total and self-disclosing; re-reads the corpus twice, walks the tree thrice |
| Review loop (lane 3's reading) | 7 | 7 | medium | See §3.1 for the deep reading, which supersedes this row |
| Lesson derivation and staging | 6 | 7 | high | Works end to end; every lesson born a `summary_absent` warning |
| Ingest chunking, anchors, quotes | 8 | 8 | high | Strong idempotency; quote check has no minimum length |
| Inbox promotion | 7 | 7 | high | Correct trust carry; asks no summary |
| Needs and ready | 8 | 9 | high | Pure, config-derived, direct deps only; cannot go stale |

### Memory across sessions

| Mechanism | D | I | C | Verdict |
|---|---|---|---|---|
| Transcript discovery and reading | 8 | 7 | high | Byte walk is right; directory encoding partly matched, I/O error mislabelled |
| FTS5 build, shape as version | 8 | 8 | high | Disciplined; two ad-hoc column migrations contradict the "no ladder" rule |
| Search grammar | 9 | 8 | high | Three readings, floor and exclusions disclosed; `-ab` mislabelled |
| Secrets and redaction | 8 | 7 | high | Ordered shapes, byte-identical default; two edge cases |
| Anchors file and table | 9 | 9 | high | The model for the area |
| Anchor pass | 8 | 8 | high | Scoped, budgeted, failure reaches the audit row |
| Retrieval missions | 9 | 6 | high | Invariant enforced by shape; broken index answers "no material" (D5) |
| PreCompact snapshot | 8 | 8 | high | Failure recorded twice; defects distinguished |
| Restore selection and budget | 7 | 6 | high | Staging half exemplary; the tier drops ids silently (D6) |
| Handover threshold and ask | 7 | 7 | medium | Thoughtful bands; 4 chars/token wrong for Hebrew; mtime as "acted on" |
| Continuity carry | 7 | 6 | high | Blanket catch discards its own error strings; 8-char label |
| Session names | 8 | 9 | high | Small and right |
| Audit writer and rotation | 8 | 6 | medium | Refuse-not-skip is right; rotate-before-heal can wedge the projection (D4) |
| SQLite projection and replay | 8 | 8 | high | Coherent log-is-truth; two doors answer skew differently, both explained |
| Statusline tee | 7 | 8 | high | Correct; two sanitisers for one input |

### Packs, export, rule store delivery, gates and CI

| Mechanism | D | I | C | Verdict |
|---|---|---|---|---|
| Export selection and not-travelling list | 8 | 8 | high | Allow-list with no walk to widen |
| History redaction | 8 | 8 | high | Four redactions, total note table; re-import duplicates history |
| ZIP determinism | 9 | 9 | high | Byte-deterministic, hostile-reader hardened |
| Manifest and digest order | 9 | 8 | high | Nothing parsed before digests; `screen.ts` over-claims |
| Path and Unicode screening | 9 | 9 | high | Thorough cross-platform grammar; no total-path bound |
| Config merge and refusals | 7 | 9 | high | Pack rule sound; never designed against the export projection (D7) |
| Draft landing and promote --all --pack | 8 | 8 | high | Draft always; two-part import key |
| init --pack | 8 | 8 | high | Plan before mkdir; discards on failure and says so |
| Rule store format and delivery | 8 | 8 | medium | Template as schema; tier switch by path equality |
| verify_rules and maintenance boundary | 7 | 7 | high | Restore a no-op by default; "not on disk" false for plugin installs |
| Corpus identity and drift | 8 | 9 | high | Discloses, never overrides |
| Code identity and version skew | 8 | 8 | high | Derived scope, content-decided, never flaps |
| Version single-source and set-version | 7 | 7 | high | Pre-checked sites; two stale comments |
| Dependency budget and vendor gates | 9 | 9 | high | Enumeration parsed from the constraint; closed vendor graph |
| Citation verifier | 8 | 8 | medium | Fragment identity, markers that must earn themselves |
| Basis gate | 9 | 8 | high | `none` legal, shrink-only baseline |
| Board and needs-cycle gates | 8 | 7 | high | Correct; drift tier vacuous under CI's depth-1 clone |
| Two-phase e2e gate | 8 | 6 | high | Right policy; cleanup never runs past `process.exit` |
| CI and release ordering | 9 | 8 | high | Cheap-fails-first, pinned superset; no fetch-depth |

### Web UI

| Mechanism | D | I | C | Verdict |
|---|---|---|---|---|
| Server and routing | 7 | 8 | high | Small and correct; single-threaded sync handlers are the bottleneck |
| Credential and CSRF | 6 | 8 | high | Sound against other origins, hollow against local processes; CSP off |
| Execute route and nonce | 9 | 8 | high | Best-designed mechanism in the UI; confirm GET is heavy |
| Idle shutdown and upkeep | 8 | 8 | high | Visible-tab heartbeat; streams correctly not activity |
| Read-model layer | 5 | 7 | medium | Open/close per request, no cache; the perf tasks follow directly |
| SSE and watch stream | 7 | 8 | high | Correct and disclosed; `EventSource` rationale stale since the cookie |
| Static serving | 9 | 9 | high | Textbook containment; the 404 is the favicon |
| Front-end architecture | 7 | 7 | medium | Disciplined no-framework contract; `app.js` and untested glue are the risk |
| Strings and language switch | 8 | 8 | high | 1,559 keys parity-gated both ways; reload is the honest choice |
| Bidi and Hebrew | 9 | 8 | high | Logical properties and computed-style isolation counts |
| Palette and hue budget | 8 | 7 | medium | Five-hue budget gated at stylesheet and painted pixel |
| Disclosure component | 8 | 4 | high | Good primitive, adopted by 5 of 22 screens |
| Conversations viewer | 8 | 7 | medium | Real virtualisation and find; too large a file, poor per-row naming |
| Doc and lane viewers | 8 | 8 | medium | Cookie-only credential, hand-built sanitiser |
| Accessibility posture | 5 | 5 | high | Landmarks present; no h1, no skip link, one breakpoint |
| Parity gates | 9 | 7 | high | Derived expectations excellent; strip scenarios depend on a warm ledger |

### Self-improvement loop (deep lane)

| Mechanism | D | I | C | Verdict |
|---|---|---|---|---|
| Trigger: counter, rubric, ration | 8 | 7 | high | Correct, fail-open, disclosed; shares the un-keyed `readTo` |
| Pass and report | 8 | 5 | high | Works; cross-session offset bug makes "read WHOLE" false (D2) |
| Deterministic proposer and gates | 7 | 6 | high | Selects the assistant's echo over the person's correction |
| Model transport and parser | 8 | 7 | high | Shells to `claude`, zero deps kept; `firstArray` and the 1 MB drop |
| Recommendation | 7 | 6 | high | Spread is measurable; wrong reason for period-less summaries |
| Decline ledger and promotion | 8 | 7 | high | Both worked live; claim key diluted, compensated |
| Ration and queue ceiling | 8 | 5 | high | Ceiling 0 holds in-process and writes in the child (D3) |
| Human surface: CLI, MCP, UI queue | 7 | 7 | medium | Queue workable; the pass report and verdict reach nobody |

### Rule store and maintenance (deep lane)

| Mechanism | D | I | C | Verdict |
|---|---|---|---|---|
| Store schema and isolation | 9 | 9 | high | Template is the schema; isolation proven by import walk |
| Seal and verify | 6 | 6 | high | Honest checksum, dishonest sentence; seals unparseable entries (D9) |
| Delivery and assertion | 8 | 8 | high | Every door recorded; no dedupe by design; missed-door line works |
| Precedence and conflicts | 6 | 7 | medium | A delivered sentence and a slug match, not an enforcement |
| Maintenance server | 6 | 7 | high | Loopback, no auth, no audit, unshipped; edits round-trip and re-seal |
| Store documentation (ch. 10, ch. 11, Hebrew) | 8 | 6 | high | Chapter 11 corrected itself; chapter 10 denies a tool that exists |
