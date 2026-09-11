# The retirement thresholds, derived from this corpus — 2026-09-11

**The answer is that no defensible threshold exists yet, and this file is the
evidence rather than the excuse.** `plan:loop seq:5` (D36e), design §9, plan
`docs/superpowers/plans/2026-09-08-self-improvement-retirement.md` Task 1.

Task 1 writes no code on purpose: *"a threshold copied from a paper is the
failure mode this phase exists to prevent."* Upstream's working rule was ≥100
trials and contribution ≤ −0.10, and a badly tuned retirement rule measured
**worse than no retirement at all** — −0.019 against a 0.258 baseline
(arXiv:2605.19576). So the numbers had to come from this corpus's own
distribution. They do not exist in it. Five separate measurements say so, and
each one is re-run on every `mycontext contribution --retire`.

---

## How it was taken

```
node src/cli/index.ts contribution --json      # the distribution
node src/cli/index.ts contribution --retire    # the gate, re-derived on every run
```

Snapshot **2026-09-11T00:04:53Z** (`measuredAt` in the JSON). The log is live
and grew while this was being written; every figure is one reading of a moving
log, which is what a dated reading is for.

| | |
|---|---|
| Corpus size | **1,085 items** |
| Injectable today (`isEligible` ∧ `isNormative`) | **157** |
| Not injectable — never a candidate, by construction | **928** |
| Audit records, all kinds | **38,723** |
| Of those, `kind: 'injection'` | **2,421** |
| Distinct ids the log names | **180** |
| Delivered, and no longer injectable | **23** |
| Earliest injection record | 2026-08-17T13:42:09Z |
| Latest | 2026-09-11T00:00:43Z |
| **Window the log covers** | **24 days** |
| Total deliveries recorded | 104,807 |
| Total spills recorded | 26,843, across 152 items |
| Injection records by door | 1,220 `jit` · 1,122 `subagent-start` · 54 `session-start` · 23 `compact-restore` · 2 `manual` |

### The cohort table

```
  ┌────────┬───────┬────────────┬─────────────────┬────────────────┬──────────────────┬───────────────────────────┐
  │ origin │ items │ injectable │ never delivered │ always spilled │ median delivered │ delivered, now ineligible │
  ├────────┼───────┼────────────┼─────────────────┼────────────────┼──────────────────┼───────────────────────────┤
  │ agent  │ 38    │ 6          │ 0               │ 0              │ 744              │ 0                         │
  │ human  │ 1047  │ 151        │ 0               │ 0              │ 644              │ 23                        │
  │ ingest │ 0     │ 0          │ 0               │ 0              │ 0                │ 0                         │
  │ review │ 0     │ 0          │ 0               │ 0              │ 0                │ 0                         │
  └────────┴───────┴────────────┴─────────────────┴────────────────┴──────────────────┴───────────────────────────┘
```

---

## Step 2, question 1: what does "never useful" look like here?

**It looks like nothing, and that is the finding.** Every rule the design names
selects the empty set on this corpus:

| candidate rule | what it selects today |
|---|---|
| never delivered | **0 of 157** — every injectable item has landed at least once |
| only ever spilled | **0 of 157** — 26,843 spills across 152 items, and not one item was ever spilled without also being delivered |
| raw delivery count below a cut | age, not worth — see below |
| exposure-corrected rate below a cut | **the pinned tier** — see below, and this is the one that ends the discussion |

### The raw count is not a measure of worth

Raw deliveries run 44 → 934 across the injectable set (median 680, ×21.2
spread). D36a already recorded that the ranking is largely age. On this
reading it is worse than that: the raw count is not monotone in age either,
because it is dominated by **which door an item comes through**.

### The exposure correction has the wrong sign

`per chance` — deliveries over the injection records written since the item's
`valid_from` — was D36a's hand-off as *"the only distribution with any shape
left"*. It has shape. The shape is tier membership.

| | min | p10 | p25 | median | p75 | max | spread |
|---|---|---|---|---|---|---|---|
| raw deliveries | 44 | 345 | 400 | 680 | 857 | 934 | **×21.2** |
| per chance | 0.143 | 0.156 | 0.242 | 0.347 | 0.371 | 0.400 | **×2.8** |

Grouped by how much exposure an item actually had, the correction runs
**backwards**:

| exposure quartile | chances | median raw | median per chance |
|---|---|---|---|
| Q1 (youngest) | 192–2,261 | 369 | 0.317 |
| Q2 | 2,261–2,334 | 855 | 0.371 |
| Q3 | 2,334–2,347 | 821 | 0.352 |
| **Q4 (oldest)** | 2,347–2,421 | 402 | **0.166** |

The oldest quartile has **less than half** the per-chance rate of the second.
An exposure correction that penalises exposure is not a correction.

### And the low tail is the corpus's own constitution

**All 39 `always: true` items rank in the least-delivered 69 of 157.** The
highest-rate pinned item is 0.281; the unpinned median is 0.357. Of the twenty
lowest-rate items, **seven are pinned**; of the twenty highest, **none is**.

The fifteen lowest per-chance items on 2026-09-11, in order:

```
0.143  RULE-never-weaken-byte-identity                    0.145  RULE-never-bind-a-boolean-to-sqlite
0.144  NOGOAL-not-a-claude-mem-replacement                0.145  CONST-node-24-no-build-step
0.144  RULE-erasable-syntax-only                          0.145  RULE-quote-the-test-glob
0.145  INV-markdown-is-the-source-of-truth                0.146  INV-a-validator-that-gates-writes-must-be-a-complete
0.145  INV-nothing-is-dropped-silently                    0.147  NOGOAL-no-agent-hard-delete
0.145  INV-posix-normalized-paths                         0.147  RULE-filter-seen-before-budgeting
0.150  CONST-zero-runtime-dependencies                    0.150  STD-documentation-is-regenerated-not-edited-to-match
                                                          0.150  STD-guarantee-claims-carry-their-condition-in-the-same-sentence
```

**Those are the standing constraints of this project** — the ones quoted in the
dispatch of every lane. `CONST-zero-runtime-dependencies` and
`CONST-node-24-no-build-step` are named in this phase's own instructions. A
threshold drawn anywhere at the bottom of this distribution retires them.

**The mechanism, so this is not mistaken for a quirk of one week.** A pinned
item is delivered at the pinned doors only; an unpinned, unscoped item can also
ride JIT, and JIT is half of this log. Per-door, for
`CONST-zero-runtime-dependencies`: 328/1,122 subagent-starts (29%), 9/54
session-starts (17%), 19/1,220 JIT fires (2%), 8/23 compact-restores (35%). So
the denominator counts 1,220 records at a door that item can almost never win.
**A delivery rate ranks items by which door they come through.**

### Two corrections were tried and neither rescues it

1. **Slots instead of records.** Payload grew 3.7× over the window, so an early
   record was a much smaller chance than a recent one. Normalising by delivered
   slots rather than record count gives 3.26‰–8.98‰, ×2.7 — *the same
   ordering*, with the same fourteen pinned items at the bottom.
2. **Rank within an exposure cohort** (compare an item only with items of its
   own age; 18 distinct exposure values, largest block n=28). Relative delivery
   runs **0.47 – 2.40, median 1.00, p10 0.72**. A cut at 0.25 selects **0 of
   157**; a cut at 0.5 selects **one item** —
   `RULE-a-task-that-changes-a-surface-repairs-the-citations-that`, delivered
   150 times in 15 days. There is no low tail to cut off.

**No cut, no tail, wrong sign, and the bottom of the ranking is the pinned
tier. The honest answer to question 1 is that this corpus has not yet produced
an item that has demonstrably failed to earn its place.**

---

## Step 2, question 2: what should the active cap be?

**It applies only to `origin: 'review'` items, and that population is empty, so
the number cannot be derived — but it also cannot yet do any harm.**

- `origin: review` items in the corpus: **0**.
- `review.maxProposalsPerPass`: **0** (`DEFAULT_REVIEW`, `core/config.ts`) — the
  loop ships inert, so the population cannot grow at all.
- `review.queueCeiling`: **15**, derived by D36d as one session at §11's full
  ration (5 × `maxFiresPerSession` 3).

**So the bound already in force is the ration, and it is the only bound
measurement supports today.** A cap over a population that cannot grow is a
number with nothing to measure it against. `overCap` is built and tested
(`src/core/retire.ts`, `test/core/retire-cap.test.ts`); this build passes it no
cap.

### But the corpus IS growing, and here is what that costs

"Bound the corpus" is the other half of §9, and it is not about retirement. A
corpus that only grows does not announce itself as spill. It announces itself as
payload:

| door | first measured day | items then | last measured day | items now | spilled now |
|---|---|---|---|---|---|
| `compact-restore` | 2026-08-17 | 3.0 | 2026-09-09 | **158.0** | 19.0 |
| `session-start` | 2026-08-17 | 3.0 | 2026-09-04 | **142.8** | 25.1 |
| `manual` | 2026-08-17 | 2.0 | 2026-09-03 | 118.0 | 0.0 |
| `subagent-start` | 2026-08-26 | 21.5 | 2026-09-11 | **78.5** | **0.0** |
| `jit` | 2026-08-17 | 1.1 | 2026-09-11 | 31.0 | 11.7 |

**The subagent door is the one to read.** It grew 21.5 → 78.5 items per
dispatch in sixteen days — 3.7× — while spilling essentially nothing, because
its budget is not binding. Every delegated worker pays that growth in context,
and nothing falls out. Meanwhile the JIT door spilled 55–65% of everything it
selected through early September (peak 64.8% on 2026-08-28, 27% by 2026-09-10),
and `session-start` began spilling on 2026-09-04 at 15%.

**A bound derived from spill alone would therefore have declared the corpus
bounded at exactly the door where it is growing fastest.** That is why
`payloadTrend` is shipped as a measurement rather than a paragraph here: the day
a cap becomes derivable is the day this table changes shape, and nobody will be
watching a report.

---

## Step 2, question 3: how long is long enough to judge?

**Longer than this.** The log covers **24 days**; the item says *"DO NOT START
until the baseline has at least a month of records behind it. A threshold
derived from a week is a threshold derived from noise."* That is the owner's
number and it is the one the gate enforces (`MIN_WINDOW_DAYS = 30`).

And the window is the smaller problem. The larger one is that **the treatment
has never been applied**: no `origin: 'review'` item has ever existed, so there
is no cohort whose retirement behaviour could be compared against anything. The
clock that matters starts when `maxProposalsPerPass` is raised, not when the log
started.

---

## Step 3: what would make these numbers wrong

- **The observation window is 24 days** and the corpus was 1,085 items on the
  day. Both move; the conclusions above are about the shape of a distribution,
  not about a particular item.
- **The log records INJECTION, never reading or reliance.** An item opened as
  Markdown, fetched with `show` or read through MCP `get_item` leaves no record
  and looks exactly like one nobody ever used. **Every delivery figure is a
  floor on use, and no "never delivered" figure is evidence of disuse.**
- **Eligibility is present-tense, applied to a historical log.** 23 items have
  already left the injectable set while their deliveries stayed on disk.
- **The rate's ceiling is 0.40, not 1.00** — a JIT delivery carries only
  path-scoped items and JIT is half the log. Compare rates with each other;
  never against 1.
- **The research these thresholds answer is contested.** Effects flip by model
  (+2.72pp on one, −3.70pp on another); results depend on task order to the
  point where prior work's orderings *"impose an implicit curriculum"*; and
  repository context files showed **no general improvement at +20% inference
  cost** in the strongest-provenance study found (arXiv:2602.11988). **Nobody
  has measured a durable-lesson loop in a real long-running coding workflow.**
- **A quiet run is not a clean corpus.** "All 157 injectable items have been
  delivered" and "the log recorded nothing" produce the same shape of output,
  which is why the record count is printed in the same sentence as the zero.

---

## What was built instead of a number

`src/core/retire.ts` — a pure reader that opens nothing and writes nothing:

- **`RETIREMENT_RULE` is `null`.** A `RetirementRule` carries `derivedOn` and
  `derivedIn` beside its two thresholds, so a threshold cannot be written down
  without naming the day it was measured and the report that measured it.
  `candidates` is unreachable without one.
- **`derivability(evidence)`** — the gate, re-derived on every run, refusing on
  five measured clauses: an empty population, a signal that fires on nothing
  (twice), a window under the item's own month, a low tail that is the pinned
  tier, and a "widest gap" that separates none or all. Every clause is a zero, a
  whole population, or the owner's number. **When the corpus changes, the gate
  changes its mind on its own.**
- **`separation`** and **`tierSkew`** — the two statistics that produced the
  finding above, so the objection survives the corpus moving.
- **`payloadTrend`** — the growth measurement, per door, per day.
- **`candidates` / `overCap`** — built, tested, and passed no rule and no cap by
  this build. Restricted to `origin: 'review'`, action always `deprecate`, never
  `delete`; a human-authored item is not a candidate and is not even counted
  against the cap.

`mycontext contribution --retire` prints all of it. **It has no verb**: there is
no `--apply`, `core/retire.ts` imports nothing outside `core/` and nothing that
writes, and both facts are pinned by `test/core/retire.test.ts`. §13 — *the
owner promotes, always* — and a retirement is a stand-down that reaches every
future session.

---

## The recommendation

1. **Derive nothing today.** Re-run `mycontext contribution --retire` when the
   log passes 30 days AND `origin: 'review'` items exist. The gate will say.
2. **Do not use a delivery rate as the retirement statistic when it is time**,
   unless the pinned-tier skew has gone. It is measured on every run for exactly
   that reason. A statistic that ranks `CONST-zero-runtime-dependencies` below
   the median is not measuring worth.
3. **The bound worth watching now is the payload table, not a cap.**
   `subagent-start` at 78.5 items a dispatch and rising, with no spill, is the
   cost of an unbounded corpus arriving somewhere nobody is looking.
4. **`review.enabled` is still `false` and `maxProposalsPerPass` is still `0`.**
   Nothing in this reading is a reason to change either.

**Nothing in this file is a reason to retire, supersede or edit any item.** It
is a reading to be compared against a later one.
