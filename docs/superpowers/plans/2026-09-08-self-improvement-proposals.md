# Self-improvement loop — Phase 3 (D36c): proposals and the artifact

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn what the pass read into **drafts nobody has to trust** — a check
where the thing can be checked, a rule where it cannot, a lesson only when
neither fits — written to a gitignored directory, never promoted, never edited.

**Architecture:** The prompt is the product. Everything else is plumbing around
it: a write path that cannot produce a non-draft, a structural dedupe that runs
*before* the model sees anything, and a relevance gate that refuses a proposal
whose evidence does not touch its target.

**Tech Stack:** TypeScript on Node 24 native type stripping, zero runtime
dependencies, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-08-self-improvement-loop-design.md`
— §4 (the artifact), §5b (dedupe), §5c (relevance), §6 (the two summaries),
§12 (anti-learning), §13 (what stays manual).

**Depends on:** D36b. Do not start until the dry-run pass has run on real
sessions and its output has been read.

## Global Constraints

- **Node >= 24.0.0**, erasable TypeScript only, explicit `.ts` extensions.
- **Zero runtime dependencies.**
- **A proposal is ALWAYS a draft.** `origin: 'review'` forces `status: 'draft'`
  with no exception, including for the rationale tier.
- **`update_item` is refused outright on this path.** The pass proposes; it
  never edits. *(Continuous LLM updating causes progressive fidelity loss that
  accelerates as it compounds — arXiv:2605.12978.)*
- **Drafts are not committed.** They live in the gitignored region beside
  `.staging/`.
- **Every test file carries `// @basis`**; `npm run check:basis` gates it.
- **Port 58888 is the owner's.**

---

### Task 1: A fourth origin that cannot produce a non-draft

**Files:**
- Modify: `src/core/types.ts` (`Origin`), `src/core/mutate.ts`, `src/core/trust.ts`
- Test: `test/core/review-origin.test.ts`

**Interfaces:**
- Produces: `Origin` gains `'review'`; `createItem` refuses any status but
  `draft` when origin is `'review'`; `updateItem` refuses the origin entirely.

- [ ] **Step 1: Read `trust.ts` first**

Run: `grep -n "trustedStatus\|UPDATE_FIELD_POLICY\|GOVERNING_STATUS" src/core/trust.ts | head -20`

`trustedStatus` already forces agent captures to `draft`, and
`UPDATE_FIELD_POLICY` is a compile-enforced table — adding a field without
updating it **breaks the build on purpose**. That table is the mechanism; use
it rather than adding a runtime check beside it.

- [ ] **Step 2: Write the failing test**

```ts
// @basis none - implements the spec's §4 safety boundary; no corpus item yet
test('origin review cannot produce anything but a draft, on any tier', () => {
  for (const category of ['lesson', 'rule', 'decision', 'constraint']) {
    const made = createItem(reviewCtx(dir), {
      type: category, title: `A ${category} from the pass`,
      summary: 'A one sentence summary.', body: 'Body.',
    });
    const item = show(dir, made.id);
    assert.equal(item.status, 'draft', `${category} must land as draft`);
    assert.equal(item.origin, 'review');
  }
});

test('update_item is refused outright for origin review', () => {
  assert.throws(() => updateItem(reviewCtx(dir), { id: existing, title: 'edited' }),
    /propose|never edits|refused/i,
    'the pass proposes; it never edits — and the refusal must say so');
});
```

- [ ] **Step 3: Run it, watch it fail**

- [ ] **Step 4: Implement**

Add `'review'` to `Origin`. In `createItem`, when the origin is `'review'`,
force `status: 'draft'` **before** any other status logic, so no later branch
can undo it. In `updateItem`, refuse early with a message that says *why* —
naming the ruling, not just the rule.

- [ ] **Step 5: Run and watch pass, then run the whole mutate suite**

Run: `node --test "test/core/*.test.ts"`
Expected: no new failures. `UPDATE_FIELD_POLICY` may refuse to compile until it
is told about the new origin — **that is the table working; update it, do not
cast around it.**

- [ ] **Step 6: Commit**

```bash
git add src/core/types.ts src/core/mutate.ts src/core/trust.ts test/core/review-origin.test.ts
git commit -m "review: a fourth origin that cannot produce a non-draft and cannot edit"
```

---

### Task 2: Drafts land in the gitignored region

**Files:**
- Modify: `src/core/persist.ts` (or wherever `createItem` chooses a path — find
  it, do not guess), `.gitignore`
- Test: `test/core/review-draft-location.test.ts`

- [ ] **Step 1: Read how `.staging/` is written and ignored**

Run: `grep -rn "\.staging" src/ .gitignore | head -12`

`.staging/` already holds candidates awaiting a human, and is already ignored.
**Follow it.** Whether drafts reuse its format or get a sibling directory is
yours to decide from what you read — record the choice in the code.

- [ ] **Step 2: Write the failing test**

Assert: an `origin: 'review'` create lands under the gitignored path, is
**listed by `mycontext list`**, and `git status --porcelain` in that workspace
shows nothing.

**That third assertion is the point of the task** — the spec's reason is that
`.my_context/` is committed and shared, so without this an agent-invented draft
becomes a *team* artefact the moment anyone clones.

- [ ] **Step 3: Run it, watch it fail**

- [ ] **Step 4: Implement**

- [ ] **Step 5: Run and watch pass**

- [ ] **Step 6: Commit**

```bash
git add src/core/persist.ts .gitignore test/core/review-draft-location.test.ts
git commit -m "review: drafts are visible to the tool and invisible to git"
```

---

### Task 3: Dedupe before the model sees anything

**Files:**
- Create: `src/review/dedupe.ts`
- Test: `test/review/dedupe.test.ts`

**Interfaces:**
- Consumes: `overlapScore` from `src/core/overlap.ts` (D33 moved it into core).
- Produces:
  - `export interface Pending { id: string; target: string | null; title: string; body: string }`
  - `export function suppress(candidate: Pending, pending: Pending[]): { drop: boolean; because: string | null }`

**Why:** exact-hash dedupe catches the case that barely matters — the problem is
*near*-duplicates, and exact and fuzzy dedupe are complementary rather than
substitutes (arXiv:2602.02007, arXiv:2605.09611). And upstream's measured
failure without it: **13 firings, a 74-item queue, 29 patches to one skill.**

- [ ] **Step 1: Write the failing test**

```ts
// @basis none - implements §5b; the research it rests on is cited in the spec
test('a reworded duplicate for the same target is suppressed', () => {
  const pending = [{ id: 'a', target: 'styles.css', title: 'inputs need styling',
    body: 'Bare inputs render as UA chrome in a dark console.' }];
  const got = suppress({ id: 'b', target: 'styles.css', title: 'unstyled inputs',
    body: 'A plain input shows browser chrome against the dark console.' }, pending);
  assert.equal(got.drop, true);
  assert.match(got.because ?? '', /a/, 'the reason names WHICH pending item it duplicates');
});

test('the same words about a different target are NOT suppressed', () => {
  const pending = [{ id: 'a', target: 'styles.css', title: 'inputs need styling', body: 'x y z' }];
  const got = suppress({ id: 'b', target: 'app.js', title: 'inputs need styling', body: 'x y z' }, pending);
  assert.equal(got.drop, false, 'target is part of identity — same claim, different subject');
});
```

- [ ] **Step 2: Run it, watch it fail**

- [ ] **Step 3: Implement**

Key on **target first**, similarity second, using `overlapScore`. **Do not reuse
`CONTRADICTION_THRESHOLD`** — that number was calibrated for a different
question (does this contradict) on a different population. Calibrate this one on
real pass output and put the table in the constant's comment, the way D33 did.

- [ ] **Step 4: Run and watch pass**

- [ ] **Step 5: Commit**

```bash
git add src/review/dedupe.ts test/review/dedupe.test.ts
git commit -m "review: near-duplicate suppression, keyed on target, before the model reads anything"
```

---

### Task 4: The prompt — the most important file in the change

**Files:**
- Create: `src/review/prompt.ts`
- Test: `test/review/prompt.test.ts`

**Interfaces:**
- Produces: `export function reviewPrompt(input: PassInput): string`, and the
  exported constants the tests assert on: `ANTI_LEARNING`, `SHAPE_CONTRACT`,
  `ARTIFACT_ORDER`.

**This is the file most likely to ship untested. Write the tests first.**

- [ ] **Step 1: Write the failing tests — the rules, not the prose**

```ts
// @basis none - implements §4, §12; the anti-learning list is a scar record, cited in the spec
test('all five anti-learning rules are present', () => {
  for (const rule of ['missing binaries', 'credentials', 'transient',
                      'one-off', 'unresolved failures']) {
    assert.match(ANTI_LEARNING.toLowerCase(), new RegExp(rule.split(' ')[0]!),
      `the ${rule} rule is missing — the fifth was added upstream LATER, as a scar`);
  }
});

test('the artifact order prefers a check over a rule over a lesson', () => {
  const check = ARTIFACT_ORDER.indexOf('check');
  const rule = ARTIFACT_ORDER.indexOf('rule');
  const lesson = ARTIFACT_ORDER.indexOf('lesson');
  assert.ok(check < rule && rule < lesson,
    'prose is the weakest artifact measured; a check is the strongest');
});

test('the prompt never contains the sentence that trips the provider filter', () => {
  assert.doesNotMatch(reviewPrompt(empty), /save the approach as a skill so you can reuse it/i,
    'that phrasing provokes a content-filter rejection surfaced as a BILLING error');
});

test('a proposal must name its evidence', () => {
  assert.match(reviewPrompt(empty), /name what in the transcript/i);
});

test('the prompt does not tell the pass to be active', () => {
  assert.doesNotMatch(reviewPrompt(empty), /missed learning opportunity|be active/i,
    'that framing is the named cause of upstream issue #66350 — unrelated content written into a skill');
});
```

- [ ] **Step 2: Run them, watch them fail**

- [ ] **Step 3: Write the prompt**

It must carry, and each is pinned above: the **two questions in order** (what
did we learn; **can it be checked**); the artifact preference check → rule →
lesson; **all five** anti-learning rules; the shape contract (procedure first,
pitfalls as a generalisable rule plus one clause of why, **no ticket ids, dates
or quoted user text as content**, the same lesson twice is one rule); the
relevance requirement (name the evidence); and the instruction that the summary
and review brief are written **with maximum care**, per the owner.

**And state the limit inside the file**: these rules catch carelessness, not
falsehood. A four-stage write-time screen with 83.2% injection recall rejected
**0 of 360** poisoned memories (arXiv:2608.21230). The guard against falsehood
is recurrence, checkability and the human — not this prompt.

- [ ] **Step 4: Run and watch pass**

- [ ] **Step 5: Commit**

```bash
git add src/review/prompt.ts test/review/prompt.test.ts
git commit -m "review: the prompt, with all five anti-learning rules and the limit stated in the file"
```

---

### Task 5: Wire the pass to propose, and mark unconfirmed

**Files:**
- Modify: `src/review/pass.ts` (drop `dryRun: true` as the only mode)
- Create: `src/review/propose.ts`
- Test: `test/review/propose.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4, and the archive's cross-session index for recurrence.
- Produces: `export async function propose(input: PassInput, opts: { workspace: string }): Promise<{ created: string[]; suppressed: number }>`

- [ ] **Step 1: Write the failing test**

Assert: a proposal seen in **one** session is created with an `unconfirmed`
marker; the same claim seen in a **second, independent** session is marked
confirmed; and a suppressed near-duplicate creates nothing and is counted.

**Recurrence gates the LABEL, not the proposal** — §3c. A one-session
observation may still be proposed; the owner may promote either. The label is
information, because steps within one session are causally correlated and cannot
count as independent confirmation (arXiv:2607.02579).

- [ ] **Step 2: Run it, watch it fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run and watch pass**

- [ ] **Step 5: Turn it on here for a week and read what it proposes**

**Do not proceed to Phase 4 on green tests alone.** Read the drafts. If they are
narratives rather than rules, or if they capture the pass's own false starts
from a subagent transcript, the prompt is wrong and Phase 4 would build a queue
around bad content.

- [ ] **Step 6: Commit**

```bash
git add src/review/pass.ts src/review/propose.ts test/review/propose.test.ts
git commit -m "review: the pass proposes drafts, labelled by whether anything confirms them"
```

---

## Self-review

**Spec coverage.** §4 (Tasks 1, 2, 4), §5b (Task 3), §5c (Task 4), §6 brief
(Task 4), §12 (Task 4), §3c recurrence (Task 5). §13's "promotion stays manual"
is enforced by Task 1 and needs no separate task — the pass cannot promote
because it cannot write a non-draft.

**Placeholders.** Tasks 2 and 3 leave one decision each to the implementer
(draft directory shape; the dedupe threshold), and both say what to read and
require the choice be recorded. That is delegation with a named basis, not a gap.

**Type consistency.** `Pending` (Task 3) and `PassInput` (D36b Task 4) are used
unchanged. `Origin` gains exactly one member.

**The risk named rather than hidden:** Task 4 is prompt engineering with
assertions on structure, not on quality. **No test can tell you the prompt
produces good proposals** — Task 5 Step 5 is the only real check, and it is a
week of reading rather than a green suite.
