# Coverage gaps screen — intent, and whether the missing row is real

Research only, per `INSTR-read-the-design-record-before-acting-on-a-subject-and-learn`, answering
`TASK-the-coverage-gaps-screen-is-missing-its-table`.

## 1. What is this screen for

The **Scope coverage** screen (`data-p="coverage"`) walks the whole repository and colours every
file and directory by which of the project's governing rules/constraints/standards ("items")
apply to it. **Coverage gaps** (`data-p="gaps"`) is its negative-space companion: instead of
showing what *is* governed, it names what is **not** — directories no item's scope covers, and
categories (e.g. `open_question`) that currently hold zero items. Its own subtitle: *"Directories
no item scopes, and categories with nothing in them."* A person opens it to answer: *"Where is my
knowledge base silent, and where should I write the next rule?"*

## 2. What is an "ungoverned directory row" — the crux

An item's `scope` is a list of path globs. `DEFAULT_SCOPE_POLICY = 'global'` (`src/core/config.ts:185`,
unoverridden anywhere in this project's `config.json`) means: **an item with an empty scope is not
restricted — it governs every path.** A directory is a "gap" (`governedCount === 0`,
`src/ui/public/lib/viewmodel.js:1143`) only if, for every file under it, **no active, eligible,
non‑pinned, normative‑tier item governs it at all** — neither by an unscoped catch‑all nor by a
matching glob.

So under the shipped default, one single active, unscoped, normative, non‑pinned item is enough to
make **every directory in the repository governed**. Gaps require either (a) a corpus with zero
such items, or (b) a `scopePolicy` override to `'inert'` (empty scope governs nothing) on the
relevant categories — a config knob that exists in the schema but is not set anywhere in this
project.

## 3. Can it happen on a real corpus — measured, settled

Measured directly against this workspace's own corpus (`.my_context/items`, 865 items, SQLite
index, 2026-09-04):

- 800 items carry no scope (`has_scope = 0`).
- Of those, 729 are active and not pinned; **85 are also on a normative-tier category**
  (`known_issue` 23, `requirement` 20, `rule` 20, `open_question` 9, `standard` 5, `constraint` 3,
  `reference` 3 — overridden to normative in `config.json` — `instruction` 2).

Any one of those 85 is sufficient, under `global` policy, to govern 100% of paths. **Result: zero
directories can be ungoverned on this corpus today.** This is not a guess — it is the same
conclusion the shipped code's own docblock in `src/ui/public/screens/gaps.js` already states after
measuring both corpora on 2026-08-23: *"enough of its \[items\] are unscoped under a
global/required policy that every path is governed."* The demo corpus (`.demo-corpus`) copies this
project's own items wholesale as its base, so it inherits the same 85+ unscoped normative items and
is equally unable to produce the row. **Neither corpus reachable today can draw it, and none can
under the default policy regardless of size** — this is a structural property of `global` scope
policy, not a data-volume problem that more items would fix.

**Verdict: unreachable on any corpus that ships with the default config, and reachable only under a
`scopePolicy: 'inert'` override that no category in this project uses.**

## 4. Design intent vs. what is built vs. what the task asks

- **Design intent (superseded):** `NOTE-what-the-fixture-must-hold-screen-by-screen-for-the`
  (2026-08-25) said the *simulated demo fixture* must manufacture "three ungoverned rows" so the
  screen could be demonstrated. That whole approach — developing/testing against a manufactured
  fixture — was **superseded 2026-09-03** by
  `INSTR-testing-happens-against-the-current-corpus-and-an-exception`: verification now runs against
  the real corpus, full stop, exception only by the owner's advance approval. The old fixture
  requirement that guaranteed a gap row no longer governs.
- **What is built now:** the directory-row rendering path (`td.m` "Where" cell, `span.v` file
  count, `button.icon` Compose control) is fully implemented in `gaps.js` and `viewmodel.js`,
  matching the mockup's markup exactly. It has simply never been exercised, because no corpus in
  hand has ever contained the condition it renders.
- **What the task asks:** `TASK-the-coverage-gaps-screen-is-missing-its-table`'s own body, after two
  reconciliation passes (2026-08-25, 2026-09-03), already states this conclusion: *"Neither corpus
  holds an ungoverned directory... still DATA rather than code."* This report independently confirms
  that with a fresh measurement — the three-reader disagreement is not a disagreement the evidence
  supports.

Per `STD-the-precedence-order-when-four-sources-of-truth-disagree`, **the corpus and the running
app screens are the highest authority**, above plans, specs and the frozen mockup (which is history
under `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`). Here the app's own code
comments, the item's own reconciled body, and this measurement all agree. There is no coarse
contradiction left to resolve — the disagreement was three readers not tracing the same chain to
the same place, not three sources actually disagreeing.

## Options

1. **Close the task as a documented non-defect.** Cost: near zero. Buys: removes a permanently
   open item that no corpus can ever close by "building more," and stops the row being rediscovered
   as a bug. Downside: the row's rendering path stays permanently untested by any real assertion
   beyond the synthetic-body unit test that already exists (`test/ui/gaps-screen.test.ts`).
2. **Add a `scopePolicy: 'inert'` override to one low-stakes category (e.g. `known_issue`) in this
   project's own `config.json`**, so a real ungoverned directory can appear and be demonstrated live.
   Cost: a real config/behaviour change to a live project, needs the owner's sign-off, and changes
   what "governs" means for that category everywhere else it is read (injection previews, `/api/status`,
   etc.) — not a cosmetic toggle. Buys: an honest, non-synthetic proof the row renders correctly.
3. **Leave the task open, note it explicitly as "verified unreachable under current policy, revisit
   only if scope policy changes."** Cost: the entry stays in the ledger. Buys: nothing new; not
   recommended — it is the state that produced the confusion this report was asked to resolve.

## Recommendation

**Option 1.** The evidence is settled, not close: 85 independent unscoped-normative items on the
real corpus, a policy default of `global`, and the shipped code's own contemporaneous measurement
all point the same way. Manufacturing a config change (option 2) to exercise three cells of markup
that are already correct by inspection is disproportionate — and it would be the tail (a test
fixture) wagging the dog (the project's actual scope policy). I would be wrong only if some category
in this project is *intended* to run under `inert` scope policy for a real reason unrelated to this
screen — nothing found in the design record suggests that; `global` is the shipped, undisputed
default everywhere it is discussed.
