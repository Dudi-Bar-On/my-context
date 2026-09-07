# The contradiction gate

**Design AGREED — owner, 2026-09-07.**

An item that contradicts a standing one must not be written silently. Every
create and every edit of a governing item is checked against the items that
currently govern, and a contradiction is settled before anything is written.

---

## 1. Why this exists

In one working day this project found **five** superseded instructions being
acted on as though they were current:

1. A comment in `e2e/app.ts` cited
   `DEC-the-ui-is-developed-against-a-simulated-corpus-until-the` as a live
   ruling. It had been superseded by the owner's own
   `INSTR-testing-happens-against-the-current-corpus-and-an-exception`. It cost
   a morning of misdiagnosis.
2. That same file carries **two comment blocks asserting opposite things** about
   which corpus it uses, both live, forty lines apart.
3. `plan:builder seq:5` and `plan:walk seq:20` both instruct "draw it in the
   mockup first". `DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written`
   names both items **by id** and kills that clause. A lane found it; the brief
   that dispatched it had repeated the dead instruction.
4. `src/doctor/checks.ts` cited two report line numbers for a sentence at
   neither line.
5. `plan:builder seq:11` says "test BOTH PATHS — RUN and EXECUTE". `D22` deleted
   the Run button.

None of these was carelessness. **Every one was a document faithfully repeating
something that had stopped being true**, with nothing anywhere positioned to
notice. The corpus behaved correctly throughout: injection already filters
retired items through `RETIRED_STATUSES`. What is missing is a check at the
moment a *new* claim enters, against the claims already in force.

`scripts/check-cited-items.ts` (2026-09-07) closes the half of this that is
mechanical: source that **cites** a retired item by id. This spec closes the
half that is not: an item that **contradicts** a live one without citing it.

---

## 2. Where the gate sits

**`createItem` and `updateItem` in `src/core/mutate.ts`.** These two functions
are the only write paths for item content. Everything routes through them:

| surface | route |
|---|---|
| `mycontext add` / `edit` | `src/cli/index.ts` |
| MCP `create_item` / `update_item` | `src/mcp/tools.ts` |
| `mycontext inbox-promote` | `src/cli/commands/inbox-promote.ts` |
| `mycontext lesson` | `src/cli/commands/lesson.ts` |
| `mycontext lesson-accept` | staged rule → `createItem` |
| `mycontext ingest-apply` | drafts → `createItem` |
| pack import | `src/pack/` |

The check runs **before any bytes are written**, beside the existing refusals,
so the promise every refusal in this product already makes — *"nothing was
written"* — holds unchanged.

**A call-graph test enforces the chokepoint**, the way
`test/ui/staging-endpoint.test.ts` already walks the runtime import graph: a new
write path that does not pass through the gate fails the suite.

---

## 3. What triggers it

**Normative categories, plus any item with `always: true`.**

Normative means the categories that state what MUST be true: `rule`,
`constraint`, `requirement`, `decision`, `instruction`, `standard`. Only these
can contradict in the sense that matters — two laws cannot both hold, while a
task saying "build X" and a note saying "X was slow" merely differ.

`always: true` is admitted whatever the category, because pinning an item is an
explicit declaration that it is load-bearing.

On today's corpus that is roughly **104 of 996 items**, so the gate fires on
about one write in ten. That ratio is the design constraint, not an accident:
**a gate that fires on every write is a gate people learn to click through**,
and this project has measured that failure mode elsewhere (a doctor screen where
74 of 74 findings offered no remedy, so the control was ignored).

Out of scope, deliberately: `task`, `note`, `lesson`, `reference`, `invariant`,
`open_question` — unless pinned.

---

## 4. Retrieval — the product's half

`overlapScore(draft, item)` already exists in `src/ui/read-model-work.ts`:
jaccard and containment over tokens of title and body, with a 0.2 threshold and
a cap of 5. It is used today to show related items beside a draft.

**It moves to `src/core/overlap.ts`.** A mutation path must not import from
`src/ui/`, and the existing caller keeps working through the new module. This is
a boundary improvement the change forces, not scope creep.

The candidate set is every **active** item in scope (§3). Active means status not
in `RETIRED_STATUSES` — `superseded`, `deprecated`, `validated` — **imported from
`src/core/select.ts`, never restated.** That constant is the same one injection
filters on, and duplicating it is precisely how the two halves of a rule drift
apart. `scripts/check-dependency-budget.ts` sets the precedent: derive from the
source of truth rather than repeat it.

Retrieval is deterministic, needs no model, no network and no index, and costs
one pass over ~104 items.

---

## 5. The refusal — the product's other half

**The product cannot judge contradiction, and does not try.** It says so
already, in the summary gate's own words: *"nothing in this product can write
the replacement, because a summary is one plain sentence and this CLI has no
model."*

So the gate retrieves, and then refuses:

```
my_context: this item may contradict 2 items that currently govern, and
nothing was written.

  RULE-tests-run-against-the-current-corpus-and-an-exception  (rule · hard)
    "Tests and verification run against this project's real corpus rather
     than a fixture, and any exception is approved by the owner in advance."

  DEC-the-ui-is-developed-against-a-simulated-corpus-until-the  (decision)
    "The UI is developed against a simulated corpus until the screens are
     finished."

Settle each one and send the write again:

  --distinct <id>     both can be true; they are about different things
  --supersedes <id>   this replaces it, and it is retired

Or abandon this write, which is what to do when the existing item is right.
```

The shape is the summary gate's, deliberately: a refusal that names the exact
re-send, promises nothing was written, and explains why the product cannot
decide for you. That gate is known to work — it stopped four edits in one
session and each was corrected rather than forced.

**Every candidate must be dispositioned.** A write carrying a disposition for
one of two candidates is refused again, naming the one still open.

---

## 6. The two outcomes

Both are the owner's, stated in his words on 2026-09-07.

**Path 1 — the existing item is correct, so the new one is discarded.** The
writer abandons the write. Nothing was written; that is already the state, and
the gate needs no mechanism for it.

**Path 2 — the new item is correct, so the existing one must go.**
`--supersedes <id>` routes into `supersedeItem` (`src/core/mutate.ts`), which is
already a single guarded write path: it validates both ids, refuses a second
successor, writes both edges, prints a preview, and requires a human confirm.

The new item is created **and** the old retired **in one act, with the link
recorded**. Nothing can retire without a successor — which also closes a gap
this project already knows about: five retired items in today's corpus record no
successor at all, although `retirementEdgeRefusal` says in as many words that
retirement without a successor is "a thing this system does not offer".

---

## 7. The memory — what stops this becoming a wall

**This is the section the design lives or dies on.**

`overlapScore` is lexical. Two items about the same subject that **agree** score
as high as two that conflict. A gate with no memory would raise the same
agreeing pair on every edit forever, and would be clicked through within a week.

**So every disposition is recorded against the PAIR, keyed to both items'
summary bases.**

The `summary_of` field already exists on every item: a checksum of the text the
summary was written against. The product already uses it to detect that an edit
changed what an item *says* — that is exactly what the summary gate fires on.

A recorded verdict is therefore:

```
{ a: <id>, b: <id>, verdict: 'distinct',
  aBasis: <summary_of at ruling>, bBasis: <summary_of at ruling>,
  ruledAt: <date>, ruledBy: 'human' | 'agent' }
```

The gate skips a candidate when a verdict exists **and both bases still match**.
When either item's meaning changes, its basis changes, the verdict lapses, and
the pair is raised again — which is correct, not noise.

**The gate therefore gets quieter every time it is used, and re-opens exactly
when it should.** Without this section the mechanism is net harmful.

Storage: `.my_context/.verdicts/contradiction.jsonl`, append-only, the same
shape and reasoning as the audit log (`appendJsonlLine`, no read-modify-write —
measured on this project to survive concurrent writers where a
read-modify-write destroyed 1–21 rows per run).

---

## 8. The tests that rest on a retired item

Owner ruling, 2026-09-07: when an item is retired under Path 2, *"all the tests
that rely on the superseded item must be updated or deleted — every test,
including TDD, regression, unit, e2e."*

**The reason this cannot be a scanner, measured the same day.** `budget/16`
reversed an admission rule. It reddened **26 test fixtures across 10 files, and
not one was a logic failure** — every one asserted an absence the reversed rule
had made true. **Zero of the 26 named the rule they rested on.** They encoded it:
as a golden string, as a bare `pinned: 1500`, as an item titled "Only an index
line", as a helper comment reading "one pinned item and one index-only item"
with no id in it. One is worse than silent — it cites an item that IS still in
force, while the assertion above it rested on the rule being reversed, so a
reader checking that citation would conclude the test was covered.

**There is no token to match on. A scanner cannot find these.**

But there is exactly one moment when a person knows: **the moment of
superseding**, which is already a guarded write path that already stops a human
and already accepts a free-text `reason`. So `supersedeItem` asks one more
question:

> Which tests assert what this reverses?

**The answer is validated, not merely stored.** `checkDeadScopes` already proves
a `scope` glob matches real files; the same walk proves each named test file or
test name exists. A named test that has since been renamed or deleted becomes a
doctor finding — and that is precisely the finding that matters six months
later. The cheapest possible version needs no new field: the successor's
existing `scope` can carry the test paths, and `checkDeadScopes` validates them
today.

**What can never be mechanized is completeness.** "No tests named" is
indistinguishable from "no tests affected". **So this field can never be an error
and can never gate** — the same shape as the owner's ruling that
`check-cited-items` reports rather than gates, one layer up. *This sentence must
be written into the implementation, or the field will grow a gate within a
month.*

Two decisions deliberately left open, because they belong to the owner and not
to this spec: whether the answer is a new frontmatter field or an observation by
convention (a frontmatter change alters every recorded checksum's shape — the
`continuity`/`summary` conditional-key problem), and whether an agent may write
it at all, given that `relations.ts` already refuses an agent the ability to
supersede a governing normative item in either direction.

---

## 9. The drain — what is already in the corpus

The gate guards **new** writes only. Turning it on does nothing about the
contradictions already present, and there are known ones.

So, separately and explicitly **not** part of the gate: a **doctor check** that
scores active normative items pairwise and reports the closest pairs for a human
to settle. It never gates and never blocks. It is how the existing debt drains.

It is listed here so that nobody mistakes the gate for a cure, and so that the
drain is not smuggled into the gate's implementation where it would slow a write
path down for no benefit.

---

## 10. Failure modes

**Wrong candidates.** Costs one `--distinct` and, by §7, is never raised again.
This is the failure the design is most tolerant of.

**Automated write paths.** `lesson-accept`, `ingest-apply` and pack import write
through the same chokepoints and have no human at the keyboard at that instant.
Each must either carry dispositions decided earlier or fail cleanly with a
message naming what to settle. **This is the least certain part of the design.**
It is called out here so that implementation reports what it finds rather than
inventing a bypass — a bypass would defeat §2 entirely.

**Cost.** ~104 comparisons of two token sets. Negligible, and no hot path is
involved: item creation is not the PreToolUse hook.

**Concurrency.** Append-only verdicts, per §7. A verdict written twice is
idempotent; a verdict written by two processes appends two lines and the later
wins on read.

---

## 11. Testing

- The gate is a **pure function** of `(draft, activeItems, verdicts)` →
  `allow | refuse(candidates)`. Tested with no filesystem and no store.
- **A call-graph test** proving no write path bypasses it (§2).
- **An anti-vacuity test** proving the gate actually fires — this project has
  been bitten by checks that silently stopped checking, and `test/docs/
  injection.test.ts` carries the same guard for the same reason.
- **A lapse test**: a recorded verdict, then an edit that changes one item's
  meaning, then the pair is raised again.
- **A no-lapse test**: a recorded verdict, then an edit that does not change
  meaning (`--summary-unchanged`), then the pair stays settled.

---

## 12. Not building

No negation or semantic heuristics. No embedding model. No new dependency —
`CONST-zero-runtime-dependencies` is untouched. No gate on the test-list field
(§8). **No automatic resolution of any kind**: every contradiction is settled by
a person or by an agent acting for one, never by the product.
