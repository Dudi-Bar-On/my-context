# The self-improvement loop

**Design AGREED — owner, 2026-09-08. REVISED the same day after research; §§3–5, 7, 9 and 15 changed materially and the reasons are recorded inline.**

Capture becomes automatic. **Approval stays his.** A background pass reads what
actually happened, proposes what it learned — **as a check where it can be
checked** — and never promotes anything.

---

## 0. Provenance, and what is NOT ported

This began from a study of Hermes Agent (`github.com/NousResearch/hermes-agent`).
**That study was verified against the source on 2026-09-08 and several claims did
not survive.**

- **Never ship the nudge sentence from that description.** It was removed
  upstream because it provokes an Anthropic content-filter rejection on
  subscription OAuth credentials, surfaced as a **billing-shaped HTTP 400**
  sending users to buy quota they do not need. Bisected against the live API by
  its maintainers.
- **Their foreground agent does not autonomously save** — it *offers* to.
- **The "10–25% of tokens" figure does not exist** in that repo or its docs. The
  sourced numbers are **~30K tokens per event** and **~26% saved** by cache
  parity.
- **The fork does not inherit a narrowed toolbox** (see §3a).

**A second body of evidence arrived after the first draft**, from a literature
review of self-improving agents. It contradicts several choices made here, and
every place it did is marked. **Where the evidence and the port disagreed, the
evidence won.**

---

## 1. What it is, and the one thing it must not become

**The failure it must not become is a queue nobody works** — the same failure as
a stale rule, one step removed.

**And a second failure the research names, which is worse because it is
silent:** *library drift* — accumulated artifacts pushing performance **below
the no-skill baseline**. Measured at −0.019 against a 0.258 baseline under badly
tuned governance (arXiv:2605.19576). It is invisible without instrumentation,
which is why §15 exists and is not optional.

---

## 2. The trigger

**A counter, plus compaction, plus a rubric. Not session end.**

The counter increments in `post-tool-use.ts`, where the workspace is already
resolved and an audit row already written.

**Why not `SessionEnd`:** it fires on exit or `/clear`, **not on compaction**.
The session that produced this design ran for hours, survived **five
compactions**, and never fired one. The owner caught this; the evidence was the
session we were sitting in.

**`PreCompact` fires it too** — the moment context is about to be lost is when
capture is worth most.

**REVISED — the counter alone is measured inferior.** Rubric-gated,
model-decided triggers beat fixed-interval ones by **+6.3 points on BrowseComp
at 30–70% lower token cost** (arXiv:2606.23525); fixed thresholds "pay no heed
to trajectory structure" and fire mid-derivation. So the counter says *consider
firing*; a **rubric** decides — did a sub-task just resolve, was a failure just
diagnosed and fixed, was I just corrected. Cheap, and it removes the
mid-derivation firing.

**The flooding failure, measured upstream, which a bare counter reproduces
exactly:** one 200-tool-call session produced **thirteen firings** and a
**74-item queue with 29 patches to one skill** (their issue #99661). Causes: no
batching, no dedupe on stage. Hence §3b and `maxFiresPerSession`.

---

## 3. The input — NEW SECTION, owner's ruling 2026-09-08

**The pass reads what actually happened, not a recent window.** This is the
owner's contribution and it repairs the design where the research hit hardest.

### 3a. The whole transcript, not a window

The most damaging research finding was that distilled skills scored **−2.44pp**
while **raw trajectory retrieval beat them on every metric** (SkillEvolBench,
arXiv:2605.24117) — a "lossy abstraction bottleneck". Reading the trajectory
keeps the input on the winning side of that comparison.

**It also bypasses the compaction cliff.** Safety-rule recall measured **53%
after one compaction and 10% after five** (arXiv:2608.22752). This session has
had five. **The file lost nothing.**

**The reader already exists.** `plan:restore seq:1` landed 2026-09-08:
structural filter, cue scoring, **26,673 records in 533 ms**, byte-offset
snapshot for repeatability. This is a second consumer, not new machinery.

**Read whole, send incrementally.** The read costs half a second; what costs
money is what is handed to a model. So: always read the whole file, send only
what is new since the last pass. Range is configurable; the default does not
need a whole-file model call to have whole-file awareness.

### 3b. Subagent transcripts — where the evidence actually is

**Measured 2026-09-08 in this workspace: 478 task transcripts totalling 91 MB,
against 61 MB for the session itself. The archive indexes 2 files and sees none
of them.**

**And the asymmetry matters more than the size.** The session file holds each
lane's *report*. The subagent transcripts hold their *reasoning* — which is
where the corrections happened. In one day lanes corrected the assistant at
least eight times (a threshold that would have refused 207 of 207 writes;
`RETIRED_STATUSES` wrong in both directions; 54 dependent specs rather than 24;
a token cost that does not exist). **The conclusions are in the session; the
working is in the 91 MB.**

**They are in `Temp` and will be deleted**, so: the archive's scanner extends to
the task directory, and `plan:archive seq:4`'s persistence extends to cover
them — same mechanism, second kind of file.

**THE HAZARD, and it is the mirror of the same fact:** a subagent transcript
also holds false starts and abandoned hypotheses. Capturing *"a lane believed
X"* as a lesson records a mistake as knowledge. The anti-learning rule on
unresolved failures (§12) applies **doubly** here, because the transcript
contains both the failure and the recovery and only the recovery is true.

### 3c. Across sessions, within this workspace

**Constrained to the current CWD**, which the conversation index already stores
(the archive review found `cwd` stored but never served — now it has a reason).

**This supplies the one thing the research called structurally missing.**
Steps within a session are causally correlated and cannot count as independent
confirmation (arXiv:2607.02579): a single session's evidence is insufficient to
promote. **Cross-session recurrence in the same workspace is that independence
check.**

**So recurrence gates promotion, not proposal.** A one-session observation may
still be proposed — marked **unconfirmed**, so it can be weighed differently.
Seen again in an independent session, it becomes **confirmed**. The owner may
promote either; the label is information, not a gate on his judgement.

---

## 4. What it proposes — REVISED: checks first, lessons last

**The research's sharpest finding is that prose is the weakest artifact and an
enforced check is the strongest.**

**TRACE** (arXiv:2606.13174) mined user corrections, rewrote them as atomic
rules, and **compiled them into runtime checks that must pass before the agent
completes a task**: preference violations fell **100% → 37.6%** in-distribution
and **2.0%** out-of-distribution, where memory-style capture alone left 57.5%
violated. **The difference is not capture or approval — it is that the artifact
is executable and enforced rather than prose the model may or may not attend
to.**

**And this repository is local evidence for the same thing.** What measurably
improved it on 2026-09-07/08 was not lessons. It was **checks born from
corrections**: `check-cited-items` from a comment citing a retired decision,
`check-basis` from 26 fixtures that named nothing, the contradiction gate from
the owner's own question. Every one came from a correction; every one is
enforced rather than advisory.

**So the pass asks two questions, in order:**

1. *What did we learn?*
2. **Can it be checked?**

| answer | it proposes |
|---|---|
| yes, mechanically | a **check** — a script, a doctor finding, a test |
| no, but it is a rule | a **rule** or **constraint** item |
| neither | a **lesson** |

**LESSON is unchanged as a category. It becomes the fallback rather than the
default.**

**And approving a check means something different from approving a lesson**, which
is the safety in it: approving a lesson creates knowledge that governs;
**approving a check creates WORK TO BE BUILT** — a task, not a law. A proposed
check that is wrong is found the moment someone writes it, because it passes or
fails against real data. A wrong prose lesson simply sits there being read.

**Drafts only, always.** `origin: 'review'` — when set, `status` is always
`draft`, no exceptions, and `update_item` is **refused outright**. The pass
proposes; it never edits. *(Well supported: continuous LLM updating causes
progressive fidelity loss that accelerates as it compounds —
arXiv:2605.12978.)*

**Drafts are not committed.** `.my_context/` is committed and shared; without
this, an agent-invented draft becomes a **team** artefact the moment anyone
clones. Drafts live in the **gitignored** region beside `.staging/`, which
already holds candidates awaiting approval. Same corpus, same id grammar, same
index — promotion moves the file and flips status; it does not migrate between
stores.

---

## 5. The fork

`spawn(..., { detached: true, stdio: 'ignore' }).unref()` — the pattern in
`src/ui/open.ts`. **Never awaited.** `Stop` is where a person is staring at a
prompt.

### 5a. The tool boundary — the port had this backwards

Upstream measures **~26% end-to-end cost reduction** from a cache-parity fork:
same session id, inherited system prompt, **byte-identical `tools[]`**.
Narrowing the advertised schema breaks the prefix cache.

**So denial is at DISPATCH, not by a narrowed schema** — and narrowing also
**starved the loop** upstream: *"~142 denials + ~204 read-before-write refusals
over 2 days… the model never loaded SKILL.md, so almost no patch landed."*

**The pass keeps read access** and is denied only on write paths outside its
remit. The real boundary is that **`create_item` already refuses what an agent
may not do**; the whitelist is belt-and-braces.

**Note the tension §3 creates and does not hide:** a pass that reads a 61 MB
file is not a cache-parity fork. Whole-file awareness costs the ~26%. That is
accepted deliberately, because the evidence for richer input is stronger than
the saving.

### 5b. Dedupe — REVISED: semantic, not just exact

**Content-hash dedupe catches the case that barely matters.** The problem is
*near*-duplicates; exact and fuzzy dedupe are complementary, not substitutes
(arXiv:2602.02007, arXiv:2605.09611). Two proposals saying the same thing in
different words both pass a hash gate — and that is the growth path into library
drift.

So: dedupe by target **and** near-duplicate similarity, **before the pass is
invoked**, and give it only the titles of what is already pending for the same
target. Bounded, and it does not depend on the model noticing.

### 5c. A relevance gate

Upstream issue #66350: the fork wrote content from an **unrelated** research
task into an existing skill. Root cause named by the reporter: *"be ACTIVE"*
framing plus "add support files under existing umbrellas", **with no topical
relevance check**.

**A proposal must name what in the transcript it came from**, and one whose
evidence does not touch its target is refused. **Do not copy any "a pass that
does nothing is a missed learning opportunity" framing** — that framing is the
cause of the bug.

---

## 6. The two summaries

**Item summary: 250 characters** (raised from 160, landed `02575e5`). Average
128, median 131, **maximum exactly 160**, 105 of 1,011 at 150 or above.

**The argument against raising it was false and is recorded so it is not
re-made:** a longer summary costs **zero** tokens per session — `IndexLine`
carries id, type, title and carried, never the summary, and
`test/core/summary.test.ts` has pinned `itemCost(withOne) === itemCost(bare)`
since before the change.

**Review brief: drafts only**, several sentences, never injected, **deleted at
promotion**. A conditional field — the pattern `computeItemChecksum` has used
four times without bumping `CHECKSUM_BASIS_VERSION`.

Both written with maximum care by the pass, per the owner's instruction — a
prompt-level requirement, stated and tested.

---

## 7. The review surface

**The queue is split**: agent proposals in one list, pending revisions in
another. Volume is the reason.

Per row: **Approve** and **Decline**, the review brief inline, the item openable
in the right pane. **No model call on this surface** — the brief was written at
capture time by the thing that had the transcript.

**Approving may offer to stage the patch it implies**, through the existing
`stageRevision` path. The `relations.ts` restrictions survive unchanged: the
pass may **propose** a revision; it may never **land** one.

---

## 8. Decline deletes the draft and keeps the decline — REVISED: key on the claim

A declined draft never governed, so nothing is stranded and no successor is
owed. It is deleted.

**The decline is appended to a ledger and the pass consults it before
proposing.** Without it, the same transcript yields the same proposal forever.

**REVISED — key it on the CLAIM, not the text.** A content hash blocks one
sentence; the pass rephrases and re-proposes. Every prior-art system that does
this keys on a **canonical value or label**. It is the difference between
blocking a phone number and blocking a caller.

**Bound its size, and treat it as untrusted input** — it is text the pass reads,
and therefore a poisoning surface (arXiv:2608.21230).

**This is not a port.** Verified in source: upstream `discard_pending()` unlinks
the record; nothing persists a rejection and nothing consults one. Their dedupe
PR is open and unmerged.

---

## 9. Retirement — REVISED: outcome-linked, not calendar

**The first draft said "auto-deprecate after N days". The research says that is
a badly tuned retirement rule, and badly tuned retirement measured WORSE THAN
NONE** — −0.019 against a 0.258 baseline (arXiv:2605.19576). Calendar age is
uncorrelated with whether an item helps.

**So retirement is outcome-linked**: an item retires on measured contribution,
not on age. Their working rule was ≥100 trials and contribution ≤ −0.10; the
numbers here must be derived from this corpus rather than copied.

**A bounded active cap is the second mechanism their ablations found
load-bearing** (~50 active skills in their setting). **The number for this
corpus is an OPEN QUESTION and must not be invented** — but the principle is
adopted: the corpus is bounded, and something must fall out when something new
comes in.

**Ignoring is still not declining.** An unjudged draft is *deprecated*, never
deleted — but on evidence, not on the calendar.

---

## 10. The indicator — REVISED, and it partly contradicts an earlier ruling

The owner ruled a pending count coloured by the **age of the oldest** item, with
motion spent on transitions rather than steady state.

**The research complicates this.** Oversight has a capacity; past it, reviewer
reliability decays and *more* escalation makes the system **less** safe —
"escalating everything is strictly worse than the optimum" (arXiv:2606.08919, a
model rather than a user study). **An age-coloured count is a pressure
mechanism**: it pushes toward the fatigue regime rather than rationing.

**So the indicator stays and gains a companion: the queue is rationed.** The
pass proposes at most N per pass and the queue has a ceiling; past it, capture
continues but proposals wait rather than escalating. **The colour tells him the
queue is ageing; the ration stops it becoming un-workable.**

**This is flagged rather than silently changed — the ration is a modification of
his ruling and is his to confirm.**

---

## 11. Config, off by default

```json
"review": { "enabled": false, "everyNToolCalls": 15, "onPreCompact": true,
            "maxFiresPerSession": 3, "maxProposalsPerPass": 5,
            "readWholeTranscript": true, "includeSubagents": true,
            "crossSessionSameCwd": true, "model": "haiku" }
```

Opt-in. Run it on this repository for two weeks. Then decide.

**A kill switch must actually kill.** Upstream issue #82708: zeroing the skill
interval does not stop skill creation, because the memory fork still carries the
tool and its prompt never forbids it. **One switch, one subsystem, and a test
that proves the switch is obeyed.**

---

## 12. Anti-learning rules — all five, and they are a scar record

Do not capture: missing binaries · unset credentials · transient failures that
resolved · one-off task narratives · **unresolved failures written up as if they
worked**.

The fifth was added upstream *later*, as a separate fix, and its text is the
sharpest in that file: *"if the session ended WITHOUT actually finding a working
method… do NOT write those attempts up as a 'reliable workflow'. That presents
an untested sequence of failures as validated guidance a future session will
trust and repeat."* **Start with all five.**

Plus a **shape contract**: procedure first; pitfalls as a generalisable rule and
one clause of why; **no ticket ids, dates or quoted user text as content**; the
same lesson twice is one rule; fix in place rather than appending "UPDATE:".

**AND STATE THE LIMIT HONESTLY.** A four-stage write-time screen with 83.2%
recall on indirect prompt injection **rejected 0 of 360 poisoned memories**
(arXiv:2608.21230), because separating a false assertion from a true one needs
external grounding a content screen does not have. **These rules catch
carelessness, not falsehood.** The guard against falsehood is §3c's recurrence
requirement, §4's preference for checkable artifacts, and the human.

---

## 13. What stays manual, permanently

**Promotion.** The pass writes drafts; the owner promotes.

Fully autonomous means the model promotes its own rules — and then a wrong rule
injects itself into every future session, and the promise that injected
knowledge is true is gone.

**And the port diverges from its source here for a structural reason.** A Hermes
skill is **pulled**: the model reads a description and decides whether to load
it, so a bad skill is mostly inert. A my_context item is **pushed** — injected
on path match, before the tool runs, with no model judgment in between. Their
autonomy is safe partly because their learning is lazy. Ours is not lazy; that
is the feature, and it is exactly why approval cannot be automated.

**The research adds a second reason.** Without ground truth at deployment,
self-assessed rewards inflate on incorrect episodes — the **"Echo Gap"**
(arXiv:2608.00017) — so an agent preferentially reuses its most confident
mistakes. The pass self-assesses. **Human approval is the only break in that
loop**, and it is weakened by the fact that humans approve what reads well.

---

## 14. Failure modes

| Failure | Guard |
|---|---|
| **Flooding** — 13 firings, 74 pending, 29 patches to one skill | §2 rubric + cap, §5b dedupe |
| **Library drift** — silent decay below baseline | §9 outcome-linked retirement, §15 instrumentation |
| **Irrelevant capture** — unrelated work written into an item | §5c relevance gate |
| **The kill switch does not kill** | §11, one switch per subsystem, tested |
| **Fear accumulation** | §12, all five rules |
| **Untested failure presented as procedure** | §12's fifth rule — doubly, for subagent transcripts (§3b) |
| **False-but-plausible capture** | Not caught by §12; §3c recurrence and §4 checkability |
| **The queue rots** | §8, §9, §10 |
| **Reviewer fatigue** | §10 rationing |
| **The pass slows `Stop`** | Never awaited — asserted, not assumed |
| **Credentials in the repo** | §4 uncommitted drafts, §12 |

---

## 15. Instrumentation — NEW, and not optional

**Library drift is silent by construction.** Without per-item contribution
measurement there is no way to tell whether this loop is helping or has pushed
the corpus below the no-skill baseline.

**So measure from day one**, before the first promotion: per-item delivery
counts, and whether items promoted through this path are later superseded,
declined-on-reflection or retired more often than human-authored ones.

**And the honest caveat, recorded so nobody overstates it:** the research is
contested. Effects flip by model (+2.72pp on one, −3.70pp on another), depend on
task order to the point where prior work's orderings "impose an implicit
curriculum", and repository context files showed **no general improvement at
+20% inference cost** in the strongest-provenance study found
(arXiv:2602.11988). **Nobody has measured a durable-lesson loop in a real
long-running coding workflow.** This build is therefore also an experiment, and
§15 is what makes it one rather than an act of faith.

---

## 16. Testing

**The review prompt is the most important file in the change and the one most
likely to ship untested.** Failing cases first, for the anti-learning rules and
the relevance gate.

Plus: `Stop` returns without waiting · `origin: 'review'` cannot produce a
non-draft · `update_item` refused on that path · a declined claim is not
re-proposed **after rewording** · the kill switch is obeyed · dedupe collapses
two near-duplicate proposals for one target · an unconfirmed proposal is labelled
as such.

---

## 17. Not building

No auto-promotion. No fork writing to normative categories until it has earned
it over a month of real output. No second corpus. No model call in the review
screen. No narrowed tool schema (§5a). **No "be active" framing** (§5c). **No
calendar-based retirement** (§9).
