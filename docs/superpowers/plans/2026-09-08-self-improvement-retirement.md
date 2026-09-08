# Self-improvement loop — Phase 5 (D36e): retirement and the bounded cap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the corpus growing without limit, and retire on **evidence rather
than on the calendar** — so that the loop cannot quietly push the corpus below
the no-skill baseline.

**Architecture:** Everything here consumes D36a's contribution reader. Nothing
here invents a number: the thresholds are **derived from this corpus's own
measured distribution** and written down with the date they were derived.

**Tech Stack:** TypeScript on Node 24, zero runtime dependencies, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-08-self-improvement-loop-design.md`
— §9 (retirement, bounded cap), §15 (instrumentation, which this consumes).

**Depends on:** D36a for the reader and the baseline, D36c for `origin:
'review'` items to exist. **Do not start until the baseline report has at least
one month of injection records behind it** — a threshold derived from a week is
a threshold derived from noise.

## Global Constraints

- **Node >= 24.0.0**, erasable TypeScript only, explicit `.ts` extensions.
- **Zero runtime dependencies.**
- **Never delete on evidence of neglect.** Ignoring is the absence of judgement;
  declining is judgement. Only judgement earns deletion — an unjudged draft is
  *deprecated*, never removed.
- **Never touch `origin: 'human'`.** Every mechanism here is restricted to
  `origin: 'review'`, and a test asserts that a human-authored item is untouched
  under every path.
- **Snapshot before any bulk transition**, and unconditionally — upstream's
  snapshots are config-gated and that is a correction the spec records, not a
  precedent to copy.
- **Every test file carries `// @basis`.**

---

### Task 1: Derive the thresholds from this corpus, and write them down

**Files:**
- Create: `reports/2026-XX-XX-retirement-thresholds.md` (dated the day it is run)
- Test: none — the deliverable is a measurement, and a test asserting its
  contents would fail whenever the corpus moves.

**This task produces no code. It is first because every later task consumes its
output, and because a threshold copied from a paper is the failure mode the
whole phase exists to avoid.**

- [ ] **Step 1: Read the distribution**

Run: `node src/cli/index.ts contribution --json > /tmp/contrib.json`

Then compute and record, for **each cohort** (`human`, `agent`, `review`,
`ingest`): the number of items, how many were **never** delivered, how many were
**only ever spilled**, and the median and 90th-percentile delivery counts.

- [ ] **Step 2: Answer three questions in the report, with numbers**

1. **What does "never useful" look like here?** Upstream's working rule was ≥100
   trials and contribution ≤ −0.10. That is *their* distribution. What is the
   delivery count below which an item in this corpus has demonstrably never
   earned its place — and over what observation window?
2. **What should the active cap be?** Their ablations found ~50 skills
   load-bearing in their setting. **This corpus has 1,011 items and a different
   shape.** Derive a number, or state plainly that the cap should apply *only to
   `origin: 'review'` items* — which is defensible, since the human-authored
   corpus is not what the loop can inflate.
3. **How long is long enough to judge?** An item filed last week that has not
   been delivered has not failed; it has not been tested.

- [ ] **Step 3: Record what would make these numbers wrong**

State the observation window, the corpus size on the day, and **the fact that
the research these thresholds answer is contested** — effects flip by model,
depend on task order, and no one has measured a loop like this in a real
long-running coding workflow.

- [ ] **Step 4: Commit**

```bash
git add reports/2026-XX-XX-retirement-thresholds.md
git commit -m "the retirement thresholds, derived from this corpus rather than copied"
```

---

### Task 2: Outcome-linked deprecation

**Files:**
- Create: `src/core/retire.ts`
- Modify: `src/cli/commands/decay.ts` (add `--apply`)
- Test: `test/core/retire.test.ts`

**Interfaces:**
- Consumes: `contributions`, `Contribution` from `src/core/contribution.ts`.
- Produces:
  - `export interface RetirementCandidate { id: string; delivered: number; ageDays: number; why: string }`
  - `export function candidates(items: Item[], got: Map<string, Contribution>, opts: { minAgeDays: number; maxDelivered: number }): RetirementCandidate[]`

**Why not the calendar:** the first draft of this design said "auto-deprecate
after N days". Calendar age is uncorrelated with whether an item helps, and
**badly tuned retirement measured WORSE THAN NONE** — −0.019 against a 0.258
baseline (arXiv:2605.19576). A time-based rule *is* a badly tuned retirement
rule.

- [ ] **Step 1: Write the failing test**

```ts
// @basis none - implements §9; the research it rests on is cited in the spec
test('a human-authored item is never a candidate, however cold', () => {
  const items = [item({ id: 'RULE-h', origin: 'human', validFrom: longAgo })];
  const got = new Map();                       // never delivered
  assert.deepEqual(candidates(items, got, { minAgeDays: 30, maxDelivered: 0 }), [],
    'the loop may never retire what a person wrote');
});

test('a review draft delivered zero times and older than the window is a candidate', () => {
  const items = [item({ id: 'LESSON-a', origin: 'review', status: 'draft', validFrom: longAgo })];
  const out = candidates(items, new Map(), { minAgeDays: 30, maxDelivered: 0 });
  assert.equal(out.length, 1);
  assert.match(out[0]!.why, /never delivered/i, 'the reason travels with the candidate');
});

test('a young review draft is NOT a candidate — it has not been tested, not failed', () => {
  const items = [item({ id: 'LESSON-b', origin: 'review', status: 'draft', validFrom: yesterday })];
  assert.deepEqual(candidates(items, new Map(), { minAgeDays: 30, maxDelivered: 0 }), []);
});
```

- [ ] **Step 2: Run them, watch them fail**

- [ ] **Step 3: Implement**

`candidates` is pure. `decay --apply` snapshots first, then deprecates —
**never deletes**, and never touches `origin: 'human'` or anything active.

- [ ] **Step 4: Run and watch pass**

- [ ] **Step 5: Run `--apply` in a temp copy of the real corpus and read the list**

**Do not run it on the real corpus first.** Read what it would retire. If it
names anything a person wrote, stop — the origin guard has failed and that is
the one failure this phase cannot ship with.

- [ ] **Step 6: Commit**

```bash
git add src/core/retire.ts src/cli/commands/decay.ts test/core/retire.test.ts
git commit -m "retire on evidence: never delivered, old enough to have been tested, and never human-authored"
```

---

### Task 3: The bounded cap

**Files:**
- Modify: `src/core/retire.ts`, `src/core/config.ts`
- Test: `test/core/retire-cap.test.ts`

**Interfaces:**
- Produces: `export function overCap(items: Item[], got: Map<string, Contribution>, cap: number): RetirementCandidate[]`

**Why:** a bounded active set was the second mechanism whose ablation showed it
load-bearing. **Something must fall out when something new comes in** — a
corpus that only grows is the growth path into library drift, which is silent by
construction.

- [ ] **Step 1: Write the failing test**

Assert: with the cap set below the number of `origin: 'review'` items, the
**least-delivered** are returned as candidates, oldest first among ties; that
human-authored items are **not counted against the cap at all**; and that at or
under the cap, nothing is returned.

- [ ] **Step 2: Run it, watch it fail**

- [ ] **Step 3: Implement, with the cap from Task 1's report**

Put the derived number in the config default **with the report's path in the
comment**, so the next person to change it reads the measurement rather than
guessing.

- [ ] **Step 4: Run and watch pass**

- [ ] **Step 5: Commit**

```bash
git add src/core/retire.ts src/core/config.ts test/core/retire-cap.test.ts
git commit -m "retire: a bounded active set, so something falls out when something comes in"
```

---

### Task 4: Re-measure, and say whether it worked

**Files:**
- Create: `reports/2026-XX-XX-loop-outcome.md`
- Test: none — the deliverable is a comparison.

**This is the task the whole design exists to make possible, and the one most
likely to be skipped once everything is green.**

- [ ] **Step 1: Re-run the baseline**

Run: `node src/cli/index.ts contribution`

- [ ] **Step 2: Compare, cohort by cohort, against D36a's baseline**

Are `origin: 'review'` items delivered at a rate comparable to human-authored
ones? Are they superseded or retired **more** often? Has the never-delivered
fraction of the whole corpus grown since the loop was switched on?

- [ ] **Step 3: Write the honest answer, including "we cannot tell"**

If the numbers are ambiguous — and they may well be, because single-run gains in
this literature do not replicate across seeds and depend on task order — **say
so.** A report that concludes "no measurable effect" is a successful outcome for
this task. **A report that concludes "it is working" without a comparison is a
failure of it.**

- [ ] **Step 4: Recommend, and be willing to recommend switching it off**

`review.enabled: false` is a one-line change, and the design was shipped opt-in
precisely so that this recommendation is cheap to act on.

- [ ] **Step 5: Commit**

```bash
git add reports/2026-XX-XX-loop-outcome.md
git commit -m "the loop, measured against its own baseline"
```

---

## Self-review

**Spec coverage.** §9 (Tasks 1–3), §15's comparison half (Task 4). §8's
"ignoring is not declining" is enforced by Task 2 deprecating rather than
deleting, and pinned by the origin-guard test.

**Placeholders.** Task 1 has no code because it has no code to write — it is a
measurement whose *output* is the input to Tasks 2 and 3. The dated filenames
are literal placeholders on purpose: the date is the day it is run, and a fixed
date would be a lie about when it was measured.

**Type consistency.** `RetirementCandidate` is defined in Task 2 and reused
unchanged in Task 3. `Contribution` and `contributions` come from D36a and are
not redefined.

**The risk named rather than hidden:** this phase can only be honest if Task 1
runs on **enough** history. A threshold derived from a week of records is a
threshold derived from noise, and it would produce exactly the badly-tuned
retirement the research measures as worse than none. **If the observation window
is too short, the correct action is to wait, not to pick a number.**
