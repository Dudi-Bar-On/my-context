# The self-improvement loop

**Design AGREED — owner, 2026-09-08.**

Capture becomes automatic. **Approval stays his.** A background fork reads the
session transcript, proposes what it learned as drafts, and never promotes
anything.

---

## 0. Provenance of this design, and what is NOT ported

This began from a study of Hermes Agent's self-improvement loop
(`github.com/NousResearch/hermes-agent`). **That study was verified against the
source on 2026-09-08 and several of its claims did not survive.** Where this
document differs from the popular description of Hermes, the difference is
deliberate and the reason is stated. In particular:

- **The nudge sentence in that description must never be shipped.** It was
  removed upstream because it provokes an Anthropic content-filter rejection on
  subscription OAuth credentials, surfaced as a **billing-shaped HTTP 400**
  telling users to buy quota they do not need. Bisected against the live API by
  its maintainers.
- **Hermes's foreground agent does not autonomously save.** The current wording
  is *"offer to save"* — a proposal to the user.
- **The "10–25% of tokens" cost figure does not exist** in that repository or
  its docs. The only sourced numbers are **~30K tokens per fork event** and
  **~26% saved** by cache parity. Do not carry the unsourced figure.
- **The fork does not inherit a narrowed toolbox.** It inherits the full schema
  for cache parity and is denied at dispatch.

---

## 1. What it is, and the one thing it must not become

**The failure it must not become is a queue nobody works.** That is the same
failure as a stale rule, one step removed. §7, §8 and §9 exist to prevent it;
they are not polish.

---

## 2. The trigger — REWRITTEN 2026-09-08

**A counter, plus compaction. Not session end.**

The counter increments in `post-tool-use.ts`, where the workspace is already
resolved and an audit row is already written, so it costs nothing extra.
`stop.ts` reads it; over threshold, reset and fire.

**Why not `SessionEnd`, which was the first proposal:** `SessionEnd` fires on
exit or `/clear` — **not on compaction**. The session that produced this design
ran for many hours, survived **five compactions**, and never fired one.
Everything learned would have sat uncaptured the whole time. The owner caught
this; the evidence was the session we were sitting in.

**And fire on `PreCompact` as well.** A compaction is the moment a session is
about to lose its recent context, which is exactly when capture is most
valuable and most likely to be lost. The hook already exists. That same session
would have had five natural capture points instead of none.

**THE FLOODING FAILURE, MEASURED UPSTREAM, WHICH THIS DESIGN WOULD OTHERWISE
REPRODUCE EXACTLY.** One real Hermes session with 200+ tool calls produced
**thirteen separate firings**, yielding a **74-item pending queue containing 29
separate patches to a single skill** (their issue #99661). Two named root
causes: no session-end batching, and no dedupe on stage. A counter of 15 here
does the same thing.

So the counter is admissible **only with §3's dedupe**, and with a per-session
cap. The owner's ruling was explicit: keep the cadence, and let each firing see
what earlier ones staged — **which is the mechanism upstream still does not
have.** Their dedupe PR is open and unmerged.

---

## 3. The fork — REWRITTEN 2026-09-08

`spawn(..., { detached: true, stdio: 'ignore' }).unref()`, the pattern already
in `src/ui/open.ts`. **Never awaited.** `Stop` is the hook where a person is
staring at a prompt.

It receives `transcript_path`, already on `HookInput`.

### 3a. Cache parity is the cost lever, and it dictates the tool boundary

Upstream measures **~26% end-to-end cost reduction** from running the fork as a
*cache-parity fork*: same session id, inherited system prompt, **byte-identical
`tools[]`**. Narrowing the advertised tool schema breaks the prefix cache and
costs more than the fork saves.

**So the fork is denied at DISPATCH, not by a narrowed schema.** This inverts
the description this design started from, and it matters twice over — because
narrowing also **starved the loop** upstream: removing read tools produced
*"~142 denials + ~204 read-before-write refusals over 2 days on one
deployment… the model never loaded SKILL.md, so almost no patch landed."*

**The fork therefore keeps read access** (`read_file`, `search_files`
equivalents) and is denied only on write paths outside its remit. The real
boundary is not the whitelist: **`create_item` already refuses what an agent may
not do.** The whitelist is belt-and-braces.

### 3b. Dedupe is structural and happens BEFORE the fork reads anything

The owner ruled that each firing must see what earlier ones staged. The naive
form — hand the fork the pending queue — grows its context with the queue and
degrades at exactly the scale where it matters (74 items).

**So: dedupe by target plus content hash before the fork is invoked, and give
it only the titles of what is already pending for the same target.** Bounded,
cheap, and it does not depend on the model noticing a duplicate.

### 3c. A relevance gate, which upstream lacks and has been bitten by

Their open issue #66350: the fork wrote content from an **unrelated** research
task into an existing skill — created a reference file, patched the skill to
point at it, added a section. Root cause named by the reporter: an instruction
to *"be ACTIVE"* plus *"add support files under existing umbrellas"*, **with no
topical relevance check between the conversation and the target.**

**A proposal must name what in the transcript it came from**, and a proposal
whose evidence does not touch the target is refused. **Do not copy any
"a pass that does nothing is a missed learning opportunity" framing** — that
framing is the cause of the bug.

---

## 4. What it may write

**Lessons only. Drafts only.**

Rationale tier, never injected, so a wrong one cannot reach a session.
`origin: 'review'` — a fourth origin, or a flag on `MutationContext`. When set:
`status` is always `draft`, no exceptions, and `update_item` is **refused
outright**. The fork proposes; it never edits.

**Drafts are not committed.** A committed tree cannot hold uncommitted items, so
this forces a location: drafts live in the **gitignored** region beside
`.staging/`, which already holds candidates awaiting approval for exactly this
reason. **Same corpus, same id grammar, same index** — promotion moves the file
and flips the status; it does not migrate between stores. Whether it reuses
`.staging/`'s format is for implementation to measure, with `.staging/` as the
precedent.

**Why it matters that they are uncommitted:** `.my_context/` is committed and
shared. Without this, an agent-invented draft becomes a **team** artefact the
moment anyone clones.

---

## 5. The two summaries

**Item summary: 250 characters** (raised from 160 on 2026-09-08, landed in
`02575e5`). Measured basis: average 128, median 131, **maximum exactly 160**,
105 of 1,011 at 150 or above.

**The argument against raising it was false and is recorded so it is not
re-made:** a longer summary was said to cost tokens in every session. It costs
**zero** — `IndexLine` carries id, type, title and carried, never the summary,
and `test/core/summary.test.ts` has pinned `itemCost(withOne) === itemCost(bare)`
since before this change.

**Review brief: drafts only.** Several sentences, never injected, **deleted at
promotion**. What was observed, what is proposed, why it generalises.

A **conditional field** — the pattern `computeItemChecksum` has used four times
without ever bumping `CHECKSUM_BASIS_VERSION`, so all existing checksums stay
byte-identical.

**Both are written with maximum care by the fork**, per the owner's
instruction — a prompt-level requirement, stated in the prompt and tested.

**Note the tension the raise created**, because it lands on the fork too: at
160 the number nearly enforced "one sentence". At 250 it does not, so the
wording is the only thing holding that line.

---

## 6. The review surface

**The queue is split**: agent lessons in one list, pending revisions in
another. Volume is the reason — agent lessons will be frequent and would bury
the rare human-authored revision.

Per row: **Approve** and **Decline**, the fork's review brief inline, and the
item openable in the right pane like any other item.

**No model call anywhere on this surface.** The brief was written at capture
time by the thing that had the transcript. A summary generated at review time
would need either a live model call from a **read-only surface** — breaking a
guarantee asserted by a byte-snapshot test — or a network dependency in an
offline-by-design plugin.

**Approving a lesson may offer to stage the patch it implies**, as a pending
revision through the existing `stageRevision` path. Two decisions, both the
owner's, no new plumbing. The agent-restrictions in `relations.ts` survive
unchanged: the fork may **propose** a revision; it may never **land** one.

---

## 7. Decline deletes the draft and keeps the decline

A declined draft never governed. Nothing cites it, nobody followed it, no
successor is owed — `retirementEdgeRefusal` does not apply, because that exists
for things that *were* in force. It is deleted.

**The decline is appended to a ledger** — what was proposed, when, why — and the
fork consults it before proposing. Without this the fork reads the same
transcript next week and proposes the same thing forever.

**The value of a declined draft is the decline, not the draft.** Same shape as
the contradiction gate's pair memory.

**This is not a port — upstream does not have it.** Verified in source:
`discard_pending()` unlinks the record; nothing persists a rejection and nothing
consults past rejections before staging. Their dedupe PR is open and unmerged,
and a separate open issue reports a user with **152 skills, 22 zero-use
near-duplicates, 17 removed by hand.**

---

## 8. Ignored is not declined

`decay --apply` deprecates drafts left untouched past N days — **deprecates,
never deletes.** Ignoring is the absence of judgement; declining is judgement.
Only judgement earns deletion. Snapshot first; `origin: 'review'` and `draft`
only; never anything human-authored.

**Upstream's curator never auto-deletes either** — worst case is recoverable
archival, with an append-only ledger and content-addressed manifests. One
correction to the popular description: their snapshots are **config-gated**, not
unconditional. Ours must not be.

---

## 9. The indicator

A statusline field and a web status-bar chip: **count for magnitude, age of the
oldest pending item for colour.** Twelve drafts from today is a good session;
three from six weeks ago is the landfill, and a count alone cannot tell them
apart.

**Colour is the alarm, not motion.** Movement is spent on a transition — the
chip appearing, or crossing a threshold — never on a steady state. A thing that
always flashes is a thing you stop seeing; this project has measured that
failure elsewhere, on a doctor screen where 74 of 74 findings offered no remedy
and the control stopped being read.

---

## 10. Config, off by default

```json
"review": { "enabled": false, "everyNToolCalls": 15, "onPreCompact": true,
            "maxFiresPerSession": 3, "model": "haiku",
            "autoDeprecateAfterDays": 60 }
```

Ship it opt-in. Run it on this repository for two weeks. Then decide.

**A kill switch must actually kill.** Upstream's open issue #82708: zeroing the
skill nudge interval does not stop skill creation, because the *memory* fork
still carries the skill tool and its prompt never forbids it. **One switch, one
subsystem, and a test that proves the switch is obeyed.**

---

## 11. What stays manual, permanently

**Promotion.** The fork writes drafts; the owner promotes. `lesson-accept` stays
off the model's hands.

Fully autonomous means the model promotes its own rules — and then a wrong rule
injects itself into every future session, and the product's core promise, that
injected knowledge is true, is gone.

**This is where the port diverges most from its source, and the reason is
structural.** A Hermes skill is **pulled**: the model reads a one-line
description and decides whether to load it, so a bad skill is mostly inert. A
my_context item is **pushed** — injected on path match, before the tool runs,
with no model judgment in between. Their autonomy is safe partly because their
learning is lazy. Ours is not lazy; that is the feature, and it is exactly why
approval cannot be automated.

---

## 12. Failure modes — REWRITTEN 2026-09-08

Each of these was **observed in production upstream**, not theorised.

| Failure | Guard |
|---|---|
| **Flooding** — 13 firings, 74 pending, 29 patches to one skill | §2 per-session cap, §3b structural dedupe |
| **Irrelevant capture** — unrelated research written into a skill | §3c relevance gate; a proposal names its evidence |
| **The kill switch does not kill** | §10, one switch per subsystem, tested |
| **Fear accumulation** — capturing missing binaries, unset credentials, transient failures | The anti-learning rules, **all five** |
| **Untested failure presented as procedure** | The fifth rule, added upstream *later* as a scar: a session that ended without a working method must not be written up as a reliable workflow |
| **Incident logs instead of rules** | A shape contract: procedure first, pitfalls as a generalisable rule plus one clause of why, **no ticket ids, dates or quoted user text as content**, same lesson twice is one rule |
| **The queue rots** | §7, §8, §9 |
| **The fork slows `Stop`** | Never awaited — asserted, not assumed |
| **Credentials persisted into the repo** | §4: drafts are uncommitted, and the prompt forbids capturing credentials |

**The anti-learning list is a scar record.** Every bullet was added upstream
after something went wrong, and the fifth was a separate later fix. **Start with
all five.**

---

## 13. Testing

**The review prompt is the most important file in the change and the one most
likely to ship untested.** Failing cases first, especially for the anti-learning
rules and the relevance gate.

Plus: `Stop` returns without waiting · `origin: 'review'` cannot produce a
non-draft · `update_item` is refused on that path · a declined proposal is not
re-proposed · the kill switch is obeyed · dedupe collapses two proposals for the
same target.

---

## 14. Not building

No auto-promotion. No fork writing to normative categories until it has earned
it over a month of real output. No second corpus. No model call in the review
screen. No narrowed tool schema (§3a). **No "be active" framing** (§3c).
