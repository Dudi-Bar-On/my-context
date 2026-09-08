# Self-improvement loop — Phase 4 (D36d): review, decline and the indicator

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the queue **workable** — two buttons, the brief in front of you,
the item in the pane — and make it **impossible to rot unseen**: a decline that
is remembered, a count you cannot avoid, and a ration so the count never becomes
a wall.

**Architecture:** The review queue already exists; this splits it, gives it the
two-button surface, and adds two things that have no home yet — a decline ledger
keyed on the *claim*, and a pending indicator in both the statusline and the web
status bar.

**Tech Stack:** TypeScript on Node 24, zero runtime dependencies, `node:test`,
and the repository's own Playwright harness for anything drawn.

**Spec:** `docs/superpowers/specs/2026-09-08-self-improvement-loop-design.md`
— §7 (review surface), §8 (decline ledger), §10 (indicator and ration).

**Depends on:** D36c. There is nothing to review until something proposes.

## Global Constraints

- **Node >= 24.0.0**, erasable TypeScript only, explicit `.ts` extensions.
- **Zero runtime dependencies.** A vendored UI component is permitted only
  through `src/ui/public/lib/vendor/` with a SHA pin in `VENDOR.md` and
  `check:vendor` green.
- **No model call on the review surface.** The brief was written at capture
  time. A live call would break the read surface's no-writes guarantee (asserted
  by a byte-snapshot test) or add a network dependency to an offline plugin.
- **Every new string needs a key in BOTH string tables.** A missing key makes
  `t()` throw at runtime — it has broken HEAD here before.
- **Before claiming anything visual is done, look at it** — both languages, via
  the repository's own Playwright harness. Assertions have repeatedly been
  insufficient here.
- **Port 58888 is the owner's.** Use `startUiChild` on an ephemeral port.
- **Every test file carries `// @basis`.**

---

### Task 1: The decline ledger, keyed on the claim

**Files:**
- Create: `src/review/declined.ts`
- Test: `test/review/declined.test.ts`

**Interfaces:**
- Produces:
  - `export interface Decline { claim: string; target: string | null; at: string; why: string | null }`
  - `export function recordDecline(stateRoot: string, d: Decline): void`
  - `export function alreadyDeclined(stateRoot: string, claim: string, target: string | null): Decline | null`
  - `export function claimKey(title: string, body: string, target: string | null): string`

**Why keyed on the claim:** a content hash blocks one sentence — the pass
rephrases and re-proposes. Every prior-art system that does this keys on a
**canonical value or label**. It is the difference between blocking a phone
number and blocking a caller.

- [ ] **Step 1: Write the failing test**

```ts
// @basis none - implements §8; the prior art it rests on is cited in the spec
test('a reworded proposal of the same claim about the same target is already declined', () => {
  const dir = tmp();
  recordDecline(dir, { claim: claimKey('inputs need styling', 'Bare inputs render as UA chrome.', 'styles.css'),
    target: 'styles.css', at: '2026-09-08T00:00:00.000Z', why: 'cosmetic' });
  const again = claimKey('unstyled inputs', 'A plain input shows browser chrome.', 'styles.css');
  assert.ok(alreadyDeclined(dir, again, 'styles.css'),
    'a rewording must not get a second hearing');
});

test('the same words about a different target are not already declined', () => {
  const dir = tmp();
  recordDecline(dir, { claim: claimKey('t', 'b', 'styles.css'), target: 'styles.css',
    at: '2026-09-08T00:00:00.000Z', why: null });
  assert.equal(alreadyDeclined(dir, claimKey('t', 'b', 'app.js'), 'app.js'), null);
});

test('the ledger is bounded and drops the oldest first', () => {
  const dir = tmp();
  for (let i = 0; i < DECLINE_CAP + 10; i++) {
    recordDecline(dir, { claim: `c${i}`, target: null, at: new Date(i).toISOString(), why: null });
  }
  assert.ok(readDeclines(dir).length <= DECLINE_CAP,
    'an unbounded ledger is a growing untrusted input the pass reads every time');
});
```

- [ ] **Step 2: Run it, watch it fail**

- [ ] **Step 3: Implement**

Append-only JSONL, the audit log's shape and for its measured reason:
append-only survived concurrent writers here where a read-modify-write destroyed
1–21 rows per run. Bounded, oldest dropped first.

**Write into the file, as a comment, that this ledger is UNTRUSTED INPUT** — the
pass reads it, so it is a poisoning surface (arXiv:2608.21230). It is data the
pass consults, never instructions it follows.

- [ ] **Step 4: Run and watch pass**

- [ ] **Step 5: Commit**

```bash
git add src/review/declined.ts test/review/declined.test.ts
git commit -m "review: a decline is remembered by its claim, not by its wording"
```

---

### Task 2: Split the queue and add the two buttons

**Files:**
- Modify: the review screen under `src/ui/public/screens/`, both string tables
- Create: `e2e/review-queue.spec.ts`
- Test: the screen's existing unit test file, plus the new spec

- [ ] **Step 1: Read the screen and the pending-revision path first**

Run: `grep -rn "review" src/ui/public/screens/*.js | head -20`
Run: `grep -n "stageRevision" src/core/*.ts | head`

**The queue exists. This splits and dresses it; it does not rebuild it.**

- [ ] **Step 2: Write the failing browser spec**

Assert, over the **real corpus** with `MYCONTEXT_E2E_CORPUS` at the repo root:
two lists render with distinct headings; a row shows the review brief inline
without a fetch; **Approve** and **Decline** are present and keyboard-reachable;
and clicking a row opens the item in the right pane.

**Why split:** agent proposals will be frequent and would bury the rare
human-authored pending revision — the important, infrequent thing drowned by the
routine one.

- [ ] **Step 3: Run it, watch it fail**

Run: `MYCONTEXT_E2E_CORPUS=<repo> npx playwright test e2e/review-queue.spec.ts`

- [ ] **Step 4: Implement**

New keys in **both** tables. Decline calls Task 1's `recordDecline` and deletes
the draft; Approve promotes and **offers to stage the patch it implies** through
the existing `stageRevision` path — the `relations.ts` restrictions survive:
the pass may propose a revision, never land one.

- [ ] **Step 5: Look at it, in both languages**

Screenshot English and Hebrew. **Check the Hebrew.** This project has found a
tag name 897px from its own checkbox, a leading dot at the wrong end, and 552
detached full stops — every one after assertions passed.

- [ ] **Step 6: Run the parity gates**

Run: `node --test "test/ui/*.test.ts"`
Expected: `strings-parity` and `screen-parity` green.

- [ ] **Step 7: Commit**

```bash
git add src/ui/public/screens src/ui/public/strings e2e/review-queue.spec.ts
git commit -m "review: the queue splits, and a row can be settled in one click"
```

---

### Task 3: The ration

**Files:**
- Modify: `src/review/propose.ts`, `src/core/config.ts`
- Test: `test/review/ration.test.ts`

**Interfaces:**
- Consumes: `maxProposalsPerPass` and a new `queueCeiling` from config.

**Why, and it modifies an owner ruling:** he chose an age-coloured count.
Oversight has a capacity, and past it reviewer reliability decays so that *more*
escalation makes the system **less** safe — "escalating everything is strictly
worse than the optimum" (arXiv:2606.08919, a model rather than a user study). An
age colour is a **pressure** mechanism. **The colour tells him the queue is
ageing; the ration stops it becoming unworkable.**

- [ ] **Step 1: Write the failing test**

Assert: a pass yielding more than `maxProposalsPerPass` creates only that many
and reports the remainder as held, not dropped; and that with the queue at
`queueCeiling`, a pass creates **nothing** and says so — capture continues,
proposals wait.

- [ ] **Step 2: Run it, watch it fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run and watch pass**

- [ ] **Step 5: Commit**

```bash
git add src/review/propose.ts src/core/config.ts test/review/ration.test.ts
git commit -m "review: the queue is rationed, because past a capacity more review is less safe"
```

---

### Task 4: The indicator, coloured by age

**Files:**
- Modify: `src/cli/commands/statusline.ts`, the web status bar in
  `src/ui/public/app.js`, both string tables
- Test: `test/cli/statusline-review.test.ts`, `e2e/review-chip.spec.ts`

**Interfaces:**
- Consumes: a count and an oldest-pending timestamp.

- [ ] **Step 1: Read how the existing chips are built**

Run: `grep -n "dataset.f = " src/ui/public/app.js | head`
Run: `grep -n "WINDOW\|percent" src/cli/commands/statusline.ts | head`

**Follow the existing chip mechanism.** Do not mint a second one.

- [ ] **Step 2: Write the failing tests**

Assert: **zero pending draws nothing at all** — quiet when there is nothing to
say; a count draws with the number; and the colour is keyed on the **age of the
oldest** item, not the count. Twelve drafts from today is a productive session;
three from six weeks ago is the landfill, **and a count alone cannot tell them
apart.**

- [ ] **Step 3: Run them, watch them fail**

- [ ] **Step 4: Implement**

**Colour is the alarm; motion is spent only on a transition** — the chip
appearing or crossing a threshold — never on a steady state. A thing that always
flashes is a thing you stop seeing, and this project has measured that failure:
a doctor screen where 74 of 74 findings offered no remedy and the control
stopped being read.

- [ ] **Step 5: Look at it in both languages, and at zero**

The zero case matters most: **an indicator that draws something when there is
nothing pending trains you to ignore it.**

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/statusline.ts src/ui/public/app.js src/ui/public/strings test/cli/statusline-review.test.ts e2e/review-chip.spec.ts
git commit -m "review: a pending count you cannot avoid seeing, coloured by how old the oldest is"
```

---

## Self-review

**Spec coverage.** §7 (Task 2), §8 (Task 1), §10 (Tasks 3 and 4). §6's review
brief is *displayed* here and *written* in D36c — the split is deliberate, and
Task 2 asserts it renders without a fetch.

**Placeholders.** Tasks 2 and 4 both begin by naming the file to read and
forbidding a second mechanism, which is instruction rather than vagueness.

**Type consistency.** `Decline` and `claimKey` are defined in Task 1 and used by
Task 2's Decline button. `DECLINE_CAP` and `readDeclines` are referenced in Task
1's third test and must be exported from the same module — **if they are not,
that test does not compile, which is the intended pressure.**

**The risk named rather than hidden:** Task 3 modifies a ruling the owner made.
It is flagged in the spec as his to confirm, and this plan implements the
version the research supports. **If he declines the ration, Task 3 is dropped
and Task 4 stands alone** — the plan is written so that removal is clean.
