# Nightly report — 2026-08-19 into 2026-08-20

**Standing instruction:** work through the night without stopping; **defer every
decision to the morning**. This file accumulates what was done and what needs a
ruling. On "good morning", present it and ask.

---

## DECISIONS WAITING FOR YOU

### 1. `check:retired` cannot protect the v2 spec — **this is the important one**

**The evidence.** Three separate passes tonight each found decisions recorded in
§6m and never applied to the section bodies. §6f still read as adopting FTS5.
§6g as flipping a checkbox inside the item file. §6h as importing active at
`init`. §6d and §6c carried a withdrawn session-naming design. §2.3 was still
headed *"needs design before it is built"* while listing three answered
questions. **`check:retired` was green the entire time.**

That checker exists precisely to catch "a correction recorded but never applied
to the body". It could not, because the document declares no
`<!-- retired-phrases -->` block — and one cannot simply be added: the withdrawn
phrases are quoted **verbatim** inside §6j, §6l and §6m, which are the frozen
evidence and authority sections. Declaring them would fail the checker
immediately, against text that is *correctly* still there.

**Three ways out:**

1. **Widen the checker's exemption** from §0 alone to `CORRECTED` blockquotes and
   the frozen §6i–§6m range, then declare the retired phrases. The checker starts
   protecting the largest specification in the project.
2. **Rephrase the frozen sections** so the withdrawn wording appears nowhere
   quotable. Cheapest to implement, and it damages the evidence — §6l's findings
   are worth reading *because* they quote what was wrong.
3. **Accept that this document is unprotected** and rely on review. Honest, and
   tonight is three data points against it.

**My recommendation: (1).** The exemption is already a concept the checker has;
this widens it rather than inventing anything. And the failure mode is not
hypothetical — it is the single most repeated defect in this repository's
history, and the one tool built to catch it is currently blind to the document
where it happens most.

I did not do this overnight because it changes a checker's contract, which is
yours.

### 2. Where a carried index line sits in the queue — **and my §6m.11 recommendation may be a no-op**

I recommended, and you accepted, that carried lines *"deduplicate against the new
session's own index first, then queue inside the same `budgets.index`"*. The
hooks plan measured what that actually does, and the answer is uncomfortable.

**`buildIndex`'s candidate set is already every eligible normative item not
delivered in full.** So a carried id that still governs **is always already a
candidate**. Measured on this repository's own corpus: 44 items, 7 pinned, 18
index lines, **0 truncated**. A literal implementation of the decision adds
nothing and reports success — the failure mode this project names most often.

The decision only bites when the index is **exhausted**, and then the position
in the queue is the whole feature:

- **Front of queue** — the carried line displaces a line the new session would
  have shown. That is the only position that does anything, and the displaced
  line spills *visibly*.
- **Back of queue** — a guaranteed no-op exactly when the feature was supposed
  to matter.

**My recommendation: front of queue**, which is what the plan implements, with
the displacement disclosed like any other spill. But this is a ruling I should
not make silently, because it changes what you agreed to: you approved "share
the budget", and the honest version is "displace something, and say so".

### 3. `SubagentStart`'s timeout, and the hole underneath it — **worth 60 seconds**

The plan fixes the hook timeout at 5 seconds. The only measured datum is that
**3,018 ms was tolerated**, so 5 is reasoned, not measured.

The part that matters more: **a killed hook writes nothing, so nothing records
that a subagent started with no context.** That is a silent-failure hole in a
product whose central invariant is that nothing is dropped silently — and the
plan opens it and says so rather than papering over it.

No option is obviously right. Worth your judgement, not mine.

### 4. Adding `steps` to the item checksum invalidates every corpus — **migration hazard**

Nobody noticed this in any decision section, and the categories plan caught it.

`## Steps` becomes a first-class `Item` field. **Any key added to
`computeItemChecksum` changes the recorded checksum of every item that already
exists** — in this corpus, in the plugin's dogfood corpus, and in every user's.
`test/core/corpus-checksums.test.ts` goes red immediately, and shipped, it would
**destroy the tamper signal `repair.ts` exists to preserve**: every item would
report drift at once, so real drift becomes unfindable in the noise.

Three ways out:

1. **Include `steps` conditionally** — only items that have steps hash
   differently, so nothing that exists today moves. The plan's choice. It makes
   the hash definition depend on the item's shape, which is a wart.
2. **Include it unconditionally and re-stamp every corpus.** Clean definition;
   throws away the tamper evidence once, deliberately, for everyone.
3. **Leave `steps` out of the checksum.** Cleanest hash; steps are then the one
   part of an item with no tamper detection.

**My recommendation: (1)** — and I checked how cheap it actually is, because
"conditional" sounded like a wart and it turns out not to be.

`JSON.stringify` **omits properties whose value is `undefined`**, verified by
execution:

    JSON.stringify({id:"X", body:"b", steps: undefined})  ->  {"id":"X","body":"b"}
    JSON.stringify({id:"X", body:"b", steps: []})         ->  {"id":"X","body":"b","steps":[]}

So the entire hazard is the difference between defaulting `steps` to `[]` and
leaving it absent. One line in `computeItemChecksum` —
`...(item.steps.length ? { steps: item.steps } : {})` — keeps `Item.steps` a
normal always-array field, consistent with `observations` and `relations`, while
**every item that exists today hashes exactly as it does now**. No re-stamp, no
lost tamper signal, no migration.

That makes it the cheapest of the three by a wide margin rather than a
compromise. It still wants your nod, because it leaves the hash definition in a
shape someone will later want to "clean up" — and doing so would silently
invalidate every corpus in existence.

### 5. The new audit kind makes a v2 log unreadable by v1.0.2 — **the F11 problem, pointed inward**

Runbook progress needs a fifth `AuditKind`. `parseAudit` **refuses a whole
segment** on an unknown kind — deliberately, because a log that silently omits
entries is worse than one that refuses to answer.

F11 covered this for *imported* logs and I ruled on that: quarantine. **Nobody
considered the local case.** A v2.0 log containing a `progress` record cannot be
read by a v1.0.2 `mycontext audit` at all — a user who downgrades, or runs two
versions across machines, loses their whole audit history rather than the new
records.

Options: accept it and state it in the CHANGELOG as one-way (the plan's choice);
version the log format so an older reader fails precisely instead of blaming an
op; or avoid the new kind by overloading an existing one, which lies.

**My recommendation: version the log**, and do it here rather than later — it is
cheap now and expensive once logs exist in the wild. But the plan's CHANGELOG
route is defensible if v2.0 is a clean break.

### 6. A pack cannot define a NEW category — **my F2 fix and the code are jointly unsatisfiable**

The security fix I recommended for F2 said a pack may not carry `tier` or
`agentEdits`, full stop. The export plan found that this makes §6h and §6m.12's
premise — that pack-defined categories work — **impossible**.

`resolveConfig` **requires** `tier` and `description` for a category name the
build does not know. Verified verbatim at `src/core/config.ts:488-493`:

    if (!existing) {
      if (!override.tier || !override.description) {
        throw new Error(`my_context: unknown category "${name}". …`);

So a pack that ships a new category must declare `tier`; my rule refuses it. The
two cannot both hold.

**The narrowing that saves both:** a pack may declare `tier` for a name that
**does not exist locally** — where it is mandatory and can override nothing —
and never for a name that does.

**This preserves the entire security property.** The attack was a pack shipping
`"rule": {"tier": "rationale"}` to retier an *existing* governing category and
disarm the trust boundary. Declaring a tier for a name nobody has cannot do
that: there is nothing to un-inject and nothing to un-gate.

**My recommendation: grant the narrowing.** §6m.4's worked example is entirely
about overriding a shipped category, so this is arguably what it meant. The plan
currently **refuses** such packs by name rather than assuming; granting it
narrows one refusal by five lines and moves nothing else.

### 7. Build the `git bundle` rung, or not — **the plan says not, and I agree**

`src/**` contains **no `child_process` import at all**, so this would be the
first subprocess in shipped code. Worse, `git subtree split` **writes a commit
and a ref into the exporter's own repository** — a side effect nobody asked a
read-shaped command for, with no decided policy for an untracked corpus or a
dirty tree.

The directory rung is already canonical, so a receiver who has git can bundle it
in one line. And because the ladder is a `--format` flag over a shared bundle,
adding the rung later costs **one writer** and changes nothing else.

**Recommendation: drop it from v2.0.** Reversible at any time, and it removes
the only part of the export design that reaches outside the process.

### 8. Re-import has no route for a changed item — **a gap, not a bug**

§6d says *"updating means importing again"*, and the three-bucket report shows
what changed. But the only non-destructive thing the plan can do with a
**changed** item is name it: overwriting a governing item is a gated write, and
the diff surface that would make that safe is specified nowhere.

So today a re-import can add new items and confirm identical ones, and a changed
item is reported and skipped. That may be the right answer — it is certainly the
safe one — but it means "updating means importing again" is only two-thirds
true, and the spec should say which third is missing.

**No recommendation.** This one is genuinely open, and it is the kind of gap
that wants your judgement about what packs are *for*.

### 9. Where the export note belongs in the README — **minor, cosmetic**

The English README §8 sets its own rule: *"This is the only section of this
document where unbuilt behaviour appears… Where a present-tense sentence
appears, it states what is missing or broken today, never what is planned."*

The audit-travel correction has to live **where the false claim is**, which is
not §8. I put the planned part beside the claim with one clause saying why it is
recorded there.

**The alternative** is a §8 entry instead, which means a new `###` heading in
both READMEs. That is parity-safe — §8 subsections are not linked from the
contents — but it is a structural change to two documents, so I left it undone
rather than widen scope overnight.

**My recommendation: leave it as is.** A correction that lives away from the
sentence it corrects is how the claim survived in five places to begin with.

*Nothing else is waiting. Everything else tonight was a correction or a
measurement, not a choice.*

---

## Done overnight

*(Appended as work completes. Newest last.)*

### 1. Pushed the backlog — `41c05fa..94a2ca4`, 13 commits

The plugin repo had 13 unpushed commits, including every v2.0 decision recorded
today. The outer repository has **no remote**, so nothing to push there; all the
substance lives in the plugin repo.

### 2. `procedure` -> `runbook` applied to the spec body — pushed, `616fcc1`

**This was a real defect, not tidying.** §6m decided that no `procedure`
category is created and `runbook` gains the lifecycle instead. The decision was
recorded and never applied, so §2, §6a, §6d, §6g and §6i still *described
creating it*. A planner reading in order would have built the withdrawn design.

- §2's naming argument was **cut, not renamed**: it argued `procedure` against
  SRE usage of "runbook", when the real reason is that `runbook` already ships
  (`categories.ts:40`) and R11b's *"runbook (or to call it with different name)"*
  was naming that category.
- §1.3 also proposed promoting into a `procedure` and was **not** in §6m.1's
  list of affected sections — found by scanning rather than trusting the list.
- §1's "`todo` appears in the review queue" corrected per §6m.9; §0's count
  restated as two *on purpose*.
- `check:retired` and `verify:citations` both green — 14 retired phrases, 0 still
  present; 190 citations, all resolving.

**And it found more of the same class**, which is now in flight: §6f still reads
as adopting FTS5, §6g as flipping a checkbox inside the item file, and §6h as
importing active at `init` — all three withdrawn by §6m and never applied to
their bodies. Supersession-by-header is not enough when a planner reads §6f and
builds FTS5.

### 3. The search fix — pushed, `d37ccc0`. The defect FTS5 was wrongly adopted to solve.

`search "silently drop"` returned nothing while the corpus recorded that exact
phrase. That miss was read as evidence that substring matching was too literal,
and it nearly bought a full-text index.

**The cause was field coverage.** The predicate was
`` `${item.title}\n${item.body}` `` and the phrase sat inside an
`## Observations` section — so an FTS5 index over title and body would have
reproduced the miss exactly. `extra` was outside the predicate too, which is
where a custom category's distinguishing field lives.

One function, no index, no dependency. **Verified against the dogfood corpus:**
the query now returns `REQ-session-focus-controls-what-loads`, the item the
conflict scan named, and returned nothing before.

No ranking — the recorded decision is about relevance scoring and is untouched.
Widening *what* is matched is not ordering what matched.

### 4. Found: every hook invocation pollutes stderr, and it has kept 11 tests red

Filed as `KNOWN-every-hook-invocation-prints-an-experimentalwarning-to`.

`node "${CLAUDE_PLUGIN_ROOT}/src/hooks/<name>.ts"` in `hooks/hooks.json` carries
no warning-suppression flag, so **every hook call in every real session** writes
`ExperimentalWarning: SQLite is an experimental feature` to stderr — which Claude
Code surfaces.

**Measured, not assumed:** a detached git worktree at HEAD with no uncommitted
work gives `test/hooks/*.test.ts` = 145 tests, 135 pass, **9 fail**, every one
asserting stderr is empty. Two MCP tests fail identically. Eleven in total, all
pre-existing — that baseline is why I can say tonight's changes broke nothing.

**Why it matters more than the noise:** a suite red on eleven tests trains
everyone to read "11 failing" as normal, and the next real regression lands
inside that number. It also blocks the disclosure work in flight — a stderr
disclosure cannot be asserted on a channel that is already non-empty.

The fix is one flag (`--disable-warning=ExperimentalWarning`) in two places. I
have **not** applied it: it touches `hooks/hooks.json`, which the disclosure
agent is working in, and two agents editing one file is the thing this project
does not do. Queued for after that lands.

**What must not happen:** widening the tests to tolerate a dirty stderr. The
assertion is right — a hook printing to stderr on a normal run is telling the
user something is wrong when nothing is.

### 5. Spec bodies brought into line with §6m — pushed, `0723228`

§6f still read as adopting FTS5, §6g as flipping a checkbox inside the item
file, §6h as importing active at `init`. All three had been withdrawn by §6m and
never applied. **Supersession by a header is not enough** — a planner reads §6f
and builds FTS5.

Verified the agent respected the boundary: §6i through §7 are **byte-identical
to HEAD**, so the authority text was not quietly edited to fit the body.

**It found nine more of the same class**, now in flight. The strongest is §6g
still saying `mycontext session name <name>` renames the *current* session — a
form §6j proved is not implementable, because no CLI surface has a trustworthy
session id and `focus.ts:21-31` records the codebase already conceding that.

### 6. The audit-travel claim, corrected in all five places — pushed, `037ccda`, `02716da`

Both READMEs said flatly that the audit log never leaves the machine; §5
reverses that. Corrected in English and Hebrew, scoped to "in this release", and
deliberately **not** overclaimed — the export command does not exist, and the
note says so.

The agent then found the same claim asserted in **three more places, two of
which instruct the READMEs to state it** — so the source of the claim had
outlived its correction. `src/core/audit.ts`, `commands/audit.md`, and a pointer
in `src/core/jsonl-log.ts`.

Two things worth noting from fixing those:

- **`commands/audit.md` is generated.** Editing it turned the plugin parity test
  red, which is precisely what that test exists for. The generator was the fix;
  36 tests, 36 pass.
- **`src/core/jsonl-log.ts` pointed at `docs/README.md`, which does not exist** —
  the English README is at the repository root. A pointer naming a missing file
  is worse than no pointer, because it reads as verified.

Docs suite green throughout: 91 tests, 91 pass, including EN/HE structural
parity.

### 7. The hook payload disclosure — pushed, `028f0e6`

An unparseable payload injected *plausibly*: workspace resolved, corpus loaded,
pinned tier delivered, and only `source` and `session_id` silently lost. One
fault, three symptoms — no compaction restore, no JIT delivery, no snapshot.

Now discloses on stderr and in the injected block, and **still fails open**: a
garbage payload injects normally, it just says so. Empty stdin stays silent,
which I verified directly rather than trusting the tests. 15 new tests.

Two things from the implementer worth keeping: a **live binary run caught what
unit tests missed** — `JSON.parse` quotes the offending input, so a newline in a
piped payload split the "one line" note in two. And it **reverted** an attempt to
filter the warning out of the assertions, citing the known issue I had filed —
the corpus reaching an agent and changing its behaviour, which is the product
working.

### 8. The suite is green — pushed, `0afd876`. It was red on 11 when the night began.

`--disable-warning=ExperimentalWarning` on the four `hooks.json` commands, the
`.mcp.json` args, and every test spawn — so the harness reproduces how Claude
Code actually launches these rather than a quieter variant.

**A valid hook run now writes 0 bytes to stderr.** This had to land with the
disclosure fix, not after it: a disclosure written to an already-noisy channel is
invisible.

Deliberately narrow — the specific warning class, on the entry points that emit
it. Suppressing warnings globally would swallow a deprecation worth seeing.

### 9. Nine more §6m decisions applied, plus three found doing it — pushed, `0a777f2`

Session naming, the lifecycle mapping onto shipped statuses, the exporter header
and doctor check, audit-op quarantine, carried-line budgets, `/mycontext:add`,
`origin: import` removed, the struck parser claim, and §5's allow-list rule —
`.revisions/` holds the text of *discarded proposals*, so a deny-list export
would ship a stranger our rejected drafts.

Verified §6i–§6m byte-identical to HEAD, 87 headings both sides, no renumbering.

### 10. Two defects found by reading, and one honest correction

A **literal NUL byte** in a test fixture made git classify the whole test file as
binary — no diff, nothing reviewable. Visible only in the diff *stat*. Writing
the commit message about it hit the same hazard.

**`jsonl-log.ts` pointed at `docs/README.md`, which does not exist.** A pointer
naming a missing file reads as verified.

And one of mine: commit `7bc3a29`'s message claimed a §3 fix that had **failed**
on CRLF line endings. I wrote the message before checking the result. Corrected
in `1990b69`, which says so — that is the same defect this document has been
corrected for a dozen times tonight, committed by me.

Citations re-pinned with the checker's own `--fix`: **190 ok, 0 moved, 0 broken.**

### 11. All 18 graphical views restored — pushed, `79b7e6f`

The mockup had kept the screens and lost the charts inside them — the same
regression as the earlier one that dropped six screens, one level down.

All 18 restored, none skipped, and the four budget views share **one candidate
cost table**, so the ribbon, staircase, gate ladder and tier chips cannot
disagree: the ladder's diagnosis is the ribbon's arithmetic.

**Two judgement calls the implementer got right and flagged rather than hid:**

- The recency comb is drawn in **sessions, not days**. The brief said "days"; the
  standing constraint says decay's unit is sessions. It obeyed the constraint
  over the brief, which is the right order.
- The decay caption asserted *"there is no series of injection events to plot"*,
  and the restored heatstrip contradicts it. **I checked this against the code
  rather than taking it on trust**, because that sentence was itself a
  correction made earlier in this campaign. It holds up: the LEDGER writes
  `ON CONFLICT(session_id,item_id,tier) DO NOTHING`, so it has no series and
  decay stays per-session — but the AUDIT projection writes one `audit_item` row
  per record against `audit.at`, so delivery over time is a real series there.
  The old wording was true of one store and false of the other.

Also fixed while building: a `.strip` class collision with the footer status bar
that silently destroyed both layouts, and a light-mode accessibility problem
where warm and cold were separated by colour alone.

Verified: eight checker gates green, **326 EN/HE keys with parity in both
directions**, 21 screens. Loaded in Chrome — every screen clicked through with
zero console errors, 69 monospace runs in each language, lossless round trip.

### 12. The three v2.0 implementation plans — in flight

The last queue item. One agent per domain, each writing its own file so none
collide: categories and runbooks, export/import/packs, hooks/sessions/continuity.

Each gets the decisions (§6m as authority), its code survey as the file-level
source, and the house plan format to match. Each was told to **list what an
implementer would have to guess rather than guessing for them** — an
under-specified plan that admits it is worth more than a confident one that
invents.

### 13. The hooks / sessions / continuity plan — written, 20 tasks

`docs/superpowers/plans/2026-08-20-v2-hooks-sessions-and-continuity.md`.
Two tasks are **blocked on an interactive session** and marked as such: whether
`/clear` fires `SessionStart` at all and whether `session_id` survives it, and
which hook a slash command actually reaches. It measures both first rather than
assuming — §6m.8 asserts a slash command can supply the session id, and **no
probe in the record names the event**.

Three findings beyond the plan itself:

- **`hooks.json` now carries `--disable-warning=ExperimentalWarning`** and the
  survey's quotation predates that. A block copied from the survey would write a
  warning to stderr on every subagent dispatch — caught before it shipped.
- **The seen files are accumulating, and I verified the number rather than
  relaying it.** 47 in the plugin's own dogfood corpus (`my-context/.my_context`),
  where the survey had measured 15 — roughly tripled in a day. And 22 in this
  campaign corpus, belonging to just **two** distinct session ids. Different
  corpora, both real; a count without its corpus is the kind of claim this
  project keeps catching.
- Several survey line numbers had drifted under tonight's edits; every citation
  was re-resolved by fragment rather than trusted.

It also disclosed, unprompted, that running `verify:citations --fix` refreshed
one stale hint in a **sibling plan another agent was still writing** — and chose
not to revert, because a second write into a live file risked clobbering real
work. That is the right call and the right disclosure.

### 14. The categories and runbooks plan — written, 12 tasks, 2,612 lines

`docs/superpowers/plans/2026-08-20-v2-categories-and-runbooks.md`. Both checkers
green.

**Task 1 is the one I would have forgotten**: a catalogue-completeness test that
pins the four enumeration sites nothing holds today — both tutorials' tier lists
and both READMEs' specimen markers. It was **proved red by adding a throwaway
category and watching it fail**, then reverted. That is the house rule about
making a checker red before trusting it, applied without being asked.

Task 2 closes all 22 enumeration sites **in one atomic commit**, because
set-equality tests pin them to each other and they cannot be staged.

**14 under-specified points listed rather than guessed**, each decided in the
plan and flagged as decided-by-the-plan rather than settled-by-the-spec. Two are
promoted to decisions above. The rest are small but real — what status a promoted
`todo` leaves behind, whether `ready` ships as a disclosed gap, whether a
hand-ticked `- [x]` counts toward progress, and whether an agent may run
`runbook step` at all given the CLI stamps `origin: 'human'` on every write.

### 15. The export / import / packs plan — written, 17 tasks. All three plans committed and pushed, `15c848d`.

`docs/superpowers/plans/2026-08-20-v2-export-import-and-packs.md`, 2,138 lines.

Three decisions it fixed rather than left open, each flagged as **its own and not
the spec's** — which is the right way to hand them over:

- imported items carry **`origin: 'ingest'`**, because the spec is silent and
  `Origin` is closed;
- pack membership lives in the **import record, never as a tag** — a tag changes
  `itemContentHash`, which includes `tags`, and would break the *identical*
  bucket on every re-import;
- a pack **drops `source_file`/`source_anchor`/`source_checksum`**, because kept,
  they make `doctor` emit `source_missing` at **error** level for every imported
  item, permanently.

That third one is the defect I hit myself last night with the scratchpad path,
generalised — and caught before it could ship to every pack user.

**Repo-wide after all three plans: 594 citations, 594 ok, 0 broken; 27 retired
phrases across 6 documents, 0 still present in a body.**

---

## The night's total

**13 commits to the plugin repo, all pushed; 16 more in this repo** (the reports
and the corpus, which has no remote). Both working trees clean. The suite went
from 11 pre-existing failures to **0**. Six product defects were found and filed, four of them fixed.
The specification stopped contradicting its own decisions in fourteen places. And
the three implementation plans that did not exist now do — 6,491 lines, 49 tasks.

**Nine decisions are waiting**, each with the evidence and a recommendation.
Five of them exist because a plan was told to list what it would otherwise have
guessed.

---

## Work queue for the night

Ordered by what unblocks what. Anything needing a ruling stops and goes to the
list above rather than being guessed at.

1. **Disclosure fix** — review the implementer's diff against the six required
   test cases, then commit. *(in flight when the night began)*
2. **Spec rewrite: `procedure` → `runbook`** across §2, §6a, §6d, §6g, §6i, per
   decision §6m.1. Mechanical but wide, and the spec is the authority, so it
   must not be left half-renamed.
3. **§1's "appears in the review queue"** — corrected per §6m.9, and §0's "two
   new categories" restated per the controller ruling.
4. **README audit-travel prose** — both READMEs and two source comments state
   the audit log never travels; §5 reverses that. Documentation contradicting a
   shipped feature.
5. **The F5 one-line search fix** — extend `filterItems`' text predicate to
   observations and `extra`. Decided, small, and it fixes the defect that FTS5
   was wrongly adopted to solve.
6. **Restore the 18 graphical views** into the mockup, per the pinned
   requirement `REQ-restore-the-graphical-views-the-design-sketches-already`.
7. **The v2.0 implementation plans**, which do not exist. The three code
   surveys are their input.

---

## Rules I am holding to overnight

- **No decisions.** Anything that is genuinely the owner's goes to the list
  above with a recommendation, and the work routes around it.
- **Nothing is claimed working that was not run.** Today produced four
  measurements that looked like product defects and were a harness fault; every
  claim below names how it was verified.
- **The plugin clone is read-only** unless a fix was mandated. Mandated so far:
  the unparseable-payload disclosure.
- **`config.json` is never edited without an explicit instruction** — the deny
  hook says it is the owner's file.
- **Delegate to subagents**, per the pinned rule; the main context stays for
  judgement and review.
