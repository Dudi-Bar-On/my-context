# Data visualisation for the mycontext v2.0 web UI

**Panel role:** data-visualisation designer
**Sketch:** `scratchpad/uiux/sketches/05-dataviz.html` — seven graphics, self-contained, no
dependency, dark/light, with a working RTL toggle and a 50-file ⇄ 57,195-file corpus toggle.
Verified rendering in Chrome in both directions and at both scales; no console errors.

---

## 0. Two corrections to the brief, before any design

Both are facts about shipped code, and both change what should be built.

**(a) The 960 ms measurement is stale, and the fix it named has already shipped.** The figure comes
from `docs/superpowers/specs/2026-08-18-v2-expert-review-addendum.md` §2.6, whose premise was *"There
is **zero caching** in `paths.ts`."* That is no longer true. `src/core/paths.ts:47` now holds
`const COMPILED = new Map<string, RegExp>()`, added in commit **e96bd05** *"perf(paths): compile each
glob once, not once per path examined"*, with a perf test at `test/perf/glob-cache.perf.ts` recording
**28.0 ms → ~2.7 ms** on 4,000 paths × 12 patterns. The addendum's own cached row put the realistic
monorepo shape at **371 ms**. So the flagship's starting point is 371 ms, not 960 ms — still far too
slow to render on a keystroke, but a different problem: the remaining cost is the **loop shape and the
payload**, not `new RegExp`. The degradation strategy below attacks those, and would have attacked the
wrong thing if taken from the brief's number.

**(b) The single worst dataviz defect in the current design is a colour, not a performance number.**
The addendum §3 records that `/api/coverage` computes `pinned`, a test asserts
`assert.deepEqual(body.pinned, [pinnedRule.id])` — *"and the screen colours that directory a gap."*
A pinned (`always: true`) item is injected in full at every session start regardless of any path
(`select.ts`: the pinned tier never consults `matchesScope`). Colouring a pinned-governed directory as
uncovered is a false statement rendered in the product's flagship graphic. **The fix is an encoding
decision, not a bug fix:** pinned coverage is not a property of a path and must leave the tree
entirely. See §1.

---

## 1. The scope coverage map

### What the colour actually encodes

The one rule, composed and never re-derived: an item colours a file **iff**
`injection(item, config).injected` **and** `matchesScope(item, file, config)`. `injection()`
(`cli/commands/injection.ts:42`) already encapsulates `isEligible`, the private `isNormative` and
`emptyScopeInjection(scopePolicyFor(...))` in `select`'s own order. Never `matchesAnyGlob` — the defect
`select.ts` documents by name.

**Two facts are orthogonal and must not share a channel:**

| Fact | Source | Encoding |
|---|---|---|
| **Session coverage** — pinned items, path-independent | `item.always`, `/api/coverage` `pinned[]` | A **persistent band above the tree**: *"4 items govern every file in this repository."* Never a tree colour. |
| **Path coverage** — a JIT rule fires on this file | `matchesScope` ∧ `injection().injected` | The tree colour. |

With pinned hoisted out, "gap" acquires a true and useful meaning: *no rule fires when you open this
file*. That is the sentence §1 of the spec builds the whole screen on, and it is only true once the
pinned band exists.

### The rendering

**A directory rollup with a per-row micro-bar, not a file list and not a treemap.**

- One row per **directory**. Each row carries a three-part 7 px bar: governed / ungoverned /
  not-examined, as a share of the files beneath it. A directory is therefore a *density*, not a state —
  which is honest, because a directory is not a thing `matchesScope` has an opinion about.
- Files appear only as leaves of an opened directory. At 50 files everything is a leaf and the screen
  looks like a file tree; at 57,000 it stops at directories and the detail pane fetches the opened one.
  Same component, different default expansion.
- Rows are **CSS boxes, not SVG**. Two reasons: 50,000 SVG nodes is not a rendering strategy, and the
  row chrome must mirror while the path inside it must not (§RTL).
- **Third expansion mode: "where coverage changes."** Depth-1 is arbitrary and "all" is unusable.
  Auto-expanding every directory whose coverage ratio differs from its parent's opens exactly the
  informative subset — the boundaries where governance starts or stops.

### The density rail

A 13 px column docked to the reading-end edge: every directory in document order, one merged run per
colour. It answers *where are the gaps* without scrolling, at any size. Consecutive same-state
directories collapse into one `<rect>`, so 2,822 directories rendered as **48 rects** in the sketch.
It contains no text, which is what makes its RTL story free (§RTL).

### Interaction

Click a row → the detail pane (the merged *File browser*), showing `injection().phrase` **verbatim**
for each governing item plus the `/api/select?event=tool&path=…&session=…&focus=…` preview for that
path. Hover → governing ids. Arrow keys navigate; expand/collapse is Right/Left in LTR and swaps in
RTL. The empty state is required, not polish: a fresh workspace renders *"nothing governs this project
yet"* and one next step, never a tree of warnings.

### A data gap this screen exposes

`injection()` returns `{ phrase: string; injected: boolean }`. `injected: false` has **five distinct
causes** — non-active status, disabled category, unknown category, rationale tier, and an unscoped item
under `scopePolicy: 'inert'` — and the only thing distinguishing them is English prose. The addendum
already caught the consequence downstream (`preview.nothing` renders one string for five causes). A UI
that colours by string-matching `phrase` is the "thirteen renderings of an empty scope" defect in a new
medium.

> **Recommendation:** `injection()` additionally returns a stable `code`
> (`'pinned' | 'scoped' | 'unrestricted' | 'inert' | 'rationale' | 'disabled' | 'unknown-category' |
> 'not-active'`). One field, no new computation — the function already branches on exactly these. Every
> screen then keys colour on the code and prints the phrase, and the two can never disagree.

---

## 2. The injection preview — the budget ribbon

"This fit, that did not, and here is why" in one glance:

- **Above the baseline:** a stacked track per tier, each admitted item a segment whose width is its real
  `itemCost`. Unspent headroom is the empty tail.
- **Below the baseline:** a ghost lane. Every spilled item at the width it *would* have taken, in the
  position in the candidate sequence where the selector considered it.

### Why the ghost lane is positional and not a tail

`fitToBudget` (`select.ts`) is **first-fit, and its own comment insists on it**:

> First-fit, not strict priority truncation: an over-budget item is skipped (`continue`, not `break`) so
> a later, smaller, LOWER-priority item can still be admitted after a higher-priority one has spilled.
> Deliberate … `spilled` is therefore **NOT a strict priority prefix** of the sorted candidates.

Drawing spills as a list under the bar would render the algorithm as priority truncation — a picture of
a selector this product deliberately does not have. Interleaving the ghosts makes the real behaviour
self-evident: *a wide ghost followed by a narrow fill* **is** first-fit. This is the single most
important honesty property on the screen.

Candidate order is `byPriority`: severity `hard` first, then project layer over global, then ordinal id
compare. The ribbon renders in that order, so the picture reads left-to-right (or right-to-left) as the
selector's own pass.

### The four tiers, and the tier that did not run

Budgets are `{ pinned: 6000, jit: 6000, restored: 8000, index: 1200 }`. Which tiers run depends on the
event: `session-start` → pinned + index; `tool` → jit only (and `select` returns `emptyIndex()`);
`compact` → pinned + restored + index; `manual` → pinned + index.

**A tier the event never reaches is drawn as *absent* (hatched), never as *empty*.** "Ran and delivered
nothing" and "never ran" are different facts, and an empty bar claims the first.

### Three more things the ribbon must say

1. **Headroom is not opportunity.** "4,260 / 6,000" invites *"there's room for more"*. Beside the
   headroom, name the smallest spilled cost: *"the smallest thing that did not fit costs 3,900 — the
   headroom is not usable by anything currently selected."*
2. **Focus, if active.** `Selection.focus` is a `FocusReport` with `universe: 'corpus' | 'path'`, and
   the type's own comment says a bare *"7 hidden"* means different things under the two. Render the
   universe in the sentence. `exemptHard` (hard items focus refused to hide) gets its own line — a user
   who asked for narrow and got three extra items is owed the reason.
3. **`trueSpills`.** `select` drops a spill record once a later tier admits the same item. So a
   `compact` ribbon can show an item ghosted in `pinned` and filled in `restored` — but only if the UI
   renders per-tier candidate sets rather than the flattened `Selection.spilled`. Use `/api/simulate`'s
   `costs` (one entry per id in `full ∪ spilled`) and group by the tier already on each entry.

### Where the widths come from

**Not `/api/select`.** That endpoint returns `select()`'s serialization *and nothing else* — the §6
parity test depends on it. Per-item cost comes from **`/api/simulate`** → `{ selection, budgets, costs:
{ id, tokens }[] }`, each `costs` entry the exported `itemCost` (plan 1 Task 5 exports the private
function rather than copying its body). The screen composes two endpoints; it never parses a number out
of a spill's `reason` string.

### The data gap for the *historical* case

`SpilledRef` (`audit.ts`) is `{ id, tier, at?, reason }`. There is no cost. So the audit stream and the
"why didn't Claude see this item" answer **cannot draw a proportional ghost for a past injection**, and
cannot re-derive one — the corpus moved, which is the exact argument that justified recording
`tokens` rather than recomputing it.

> **Recommendation:** add `cost: number` to `SpilledRef`, for the same reason and with the same doc
> comment as `AuditRecord.tokens`. `fitToBudget` already holds the number at the moment it writes the
> spill; it is currently thrown away and re-encoded as prose inside `reason`.

---

## 3. The budget simulator

Dragging a slider and watching a table redraw is a search. The screen should hand the user the answer.

### The admission staircase

x = tier budget, y = items admitted, drawn as a step function. Three marks on it: the configured
default (ghost dashed), the current value (gold rule), and every breakpoint as a step.

**Breakpoints are exact and finite, not sampled.** Membership can only change at a cumulative candidate
cost, so the endpoint answers a **sweep** — `/api/simulate?tier=jit&sweep=1` returning the selector's
own result at every breakpoint — in one request. The client then scrubs with zero further round trips,
which is what makes dragging feel like dragging under a zero-dependency HTTP design.

### The downward steps are the feature

Because admission is first-fit over a fixed priority order, **raising a budget can evict an item.**
Concretely: with `jit = 4,000`, a 3,900-token item spills and three ~1,000-token items are admitted;
with `jit = 4,000 → 4,300`, the 3,900 item is admitted and two of the three are evicted. Item count
goes *down* when the budget goes *up*.

A simulator that drew a monotone curve would draw a lie about this selector. The staircase renders those
transitions as downward steps with an explicit *eviction* marker, and the readout names both sides:
*"admits `STD-api-errors-problem-json`, evicts `RULE-posix-normalized-paths` and `STD-money-never-float`."*
Nothing else in the product surfaces this, and it is a property a person tuning budgets will otherwise
discover by being wrong.

### The threshold ladder, and snapping

Beside the chart, the rungs as a list: `4,320 → 5 items`, `6,320 → ▼ 3 items`, `8,150 → 6 items`. The
slider **snaps to rungs**, so dragging lands on meaning rather than on 6,050. Every value between two
rungs behaves identically, and saying so converts a continuous control into a discrete choice — which is
what it actually is.

The Configure screen's `budgets` section reuses this component wholesale; the spec already says it runs
"the same simulation".

---

## 4. Decay over time

### What the ledger can and cannot say

`ledger(session_id, item_id, tier, injected_at)` with `injected_at` a **value, not part of the key**, so
a repeat injection collides and once-per-session dedupe fires. `allUsage()` gives
`(itemId, useCount, lastUsed)` where `lastUsed = MAX(injected_at)`. `computeDecay` partitions eligible
normative items into `cold` / `warm` against a window **counted in sessions**, with `sessionsRecorded`
beside it.

So there are **two different measurements** and they must not share an encoding:

- **Time** — real, continuous, from `injected_at`. This is where "six weeks" lives.
- **Cold/warm** — a session count, and under `sessionsRecorded < window` it "mostly means new".

### The recency comb

One row per item; x = days since last injection on a log axis (today · 1d · 1w · 1mo · 2mo). A single
glance separates a cluster near "today" from a tail. Six weeks is a position, and it is instant.

**`lastUsed: null` gets its own terminal bucket, visually separated.** Never injected is not a large
number — it is a different kind, exactly as `AuditRecord.tokens` absent is not zero. `byColdest` already
sorts `null` first for the same reason.

Cold/warm is a **badge**, not the axis, and the caveat rides with the chart in the CLI's own words:
*"cold means not auto-injected in the last N session(s); the ledger holds M session(s)"* — plus the
`M < N` hedge, unconditionally, as `decay.ts` prints it.

### Two traps the source documents by name

1. **`unrestricted` is not a third bucket.** Its own doc comment: *"NOT a fourth bucket … It is a
   breadth view over the same set … a consumer that sums `cold + warm + unrestricted` double-counts."*
   A stacked bar of the three is therefore forbidden. It is drawn as a **`∀` marker on the rows it
   applies to** — the item applies to every file and competes for the jit budget on every file
   operation, which is a cost to be aware of and carries no recommendation to fix.
2. **A cold pinned item is a defect signal, not decay.** `DecayRow` carries `always` precisely because
   `decay --full` once printed `(none)` for pinned load-bearing items and it read as *"delete this"*. An
   `always: true` item is injected at every session start — so if it is cold, it **spilled**. Those rows
   get a distinct ring and the sentence *"pinned, yet cold — it spilled."* That is a budget bug found by
   a decay chart, which is the kind of thing a chart is for.

### The 90-day heatstrip — delivered vs spilled

Per item, one cell per day for 90 days. Solid = delivered, **hatched = spilled**. A six-week gap is six
weeks of empty cells and needs no reading at all.

The data is real but **not in the ledger** — the ledger records deliveries only. It comes from the audit
projection: `audit_item` (role ∈ `subject | injected | spilled`, indexed by
`idx_audit_item_id ON audit_item(item_id, role)`) joined to `audit.at`. One indexed query. Drawn as a
CSS grid, so it mirrors for free.

---

## 5. The relation ego-graph

`/api/graph?focus=&radius=` returns `nodes { id, title, type, status, missing }`,
`edges { from, to, type, dangling }`, `omitted: number`, and **ships no coordinates** — layout is the
client's. Constraints: radius 1–2, deterministic layered layout, hard cap 60 with explicit `+N more`,
no force simulation, no dependency.

### Layout: five columns, because the vocabulary is directional

`RELATION_TYPES` is `derived_from, constrains, supersedes, blocks, mitigates, refines, relates_to,
links_to`. Six of the eight are directional. So **direction is the layout** and no simulation is needed:

```
r2 · in   |   r1 · in   |   FOCUS   |   r1 · out   |   r2 · out
```

Within a column, nodes group by relation type in `RELATION_TYPES` order, then by id — deterministic and
stable across reloads. **Edges join adjacent columns only**, because a radius-2 node attaches to its
radius-1 parent and to nothing else, so the crossing count is bounded by construction rather than
minimised by search. O(n), one pass, ~40 lines.

Concentric rings were the obvious alternative and are worse: label placement on a circle is unsolved at
60 nodes, and the trig turns the RTL mirror into per-node work.

### Encoding

| Channel | Meaning | Source |
|---|---|---|
| Dashed red outline | target not in the corpus | `nodes[].missing` |
| Grey fill, faint stroke | superseded / deprecated / validated | `nodes[].status` |
| **Solid** stroke | load-bearing relation | `isLoadBearing(type)` (`focus.ts:165`) |
| **Hairline** stroke | referential (`relates_to`, `links_to`) | same |
| Dashed red edge | dangling | `edges[].dangling` |

`isLoadBearing` already classifies the vocabulary, and using it is what separates *a dangling
`relates_to` is noise* from *a dangling `constrains` is an alarm*. Without that channel, a supersede
produces a wall of equally-red edges and the reader learns nothing.

`omitted` renders as a `+N more` chip **in the column it was cut from**, so a 60-node truncation
discloses *where* it bit. A footnote would not.

`superseded_by` is deliberately absent from `RELATION_TYPES` (that omission is the whole gate on
`linkItems`), so the graph must render it from stored relations without offering it as a filter value.

### The bidi decision that removes the hardest RTL problem

**Nodes carry ids, never titles.** An id is grammar-guaranteed by `vocabulary.ts` — uppercase prefix,
hyphen, lowercase body — so it is ASCII and LTR-safe by construction. A **title** is free text and may be
Hebrew, and Hebrew inside an SVG `<text>` needs per-element bidi control that CSS cannot supply from
outside the SVG. Putting titles in the HTML detail pane, which mirrors for free, removes SVG bidi from
the problem **entirely**. That is a layout decision made for a mirroring reason, and it is the cheapest
one available.

### Where this pairs with focus

`FocusReport.dangling` is `DanglingEdge[]` with `hiddenEnd: 'from' | 'to'` — and the type's comment says
`'from'` is *"the mirror and the more dangerous of the two"* (a hidden `open_question` that `blocks` a
requirement still on screen). The graph should render focus-hidden nodes as **ghosts still in place**
rather than removing them, with `hiddenEnd: 'from'` edges emphasised. A focus that removes a blocker
from the picture without saying so is the exact false impression focus must never create.

---

## 6. The live audit stream

Four record kinds. Three are events. **The fourth is not, and that is the design.**

### The pulse

A 34 px strip above the feed: one column per 10-second bucket, height = record count, colour = dominant
kind, ~120 buckets ≈ 20 minutes. It answers *is anything happening* pre-attentively, without reading a
single row. Newest at the reading-end edge, like a terminal.

### The feed, and the four glyphs

| Kind | Glyph | Why |
|---|---|---|
| `injection` | filled square + a **token bar** | the only kind with a magnitude |
| `mutation` | diamond, **filled = human / hollow = agent** | `origin` is the audit-relevant axis, and it is the field that makes an agent narrowing its own context visible afterwards |
| `hook` | hollow ring | injected nothing — the hollow says so |
| `focus` | **a rule across the whole feed** | see below |

### A focus record is a regime boundary, not a row

A focus change touches no item and injects no text, but it changes what every later selection delivers —
which is precisely why `audit.ts` made it a fourth `kind` rather than filing it under `mutation` or
`injection`. Drawn as a row it is trivia. Drawn as a **full-width rule across the feed** it says
*everything below this line was selected from a different corpus*, which is the disappearance the focus
records exist to explain (§5 of the spec: *"an audit view that streamed injections without focus changes
would show items disappearing from a session with no visible cause"*). No other kind gets that
treatment. This is the highest-value single decision on the screen.

### Four honesty rules, each pinned to a source

1. **`tokens` absent renders "not recorded", never zero, and never a zero-height bar.** A zero-height bar
   *is* the claim the field's own doc comment forbids: *"a reader that defaults a missing value to 0
   turns 'unknown' into a claim."* An unrecorded count draws a hatched void of fixed width.
2. **`note` renders for every kind.** The addendum caught Plan 3 rendering it for `kind === 'focus'`
   only, with no `hook` branch — a regression of a fix made hours earlier, after four degraded runs
   printed identically.
3. **Projection freshness is a persistent banner, not a toast.** `projectionState` is
   `fresh | behind | diverged`. `behind` → the banner says so and the query catches up first; `diverged`
   → the stream is disabled pending a rebuild. Never a silent partial answer.
4. **The spill summary carries its window in the same sentence.** The addendum found
   `watch.spills.none` claiming *"no spills recorded — everything selected has fit the budget"* while
   the qualifier *"drawn from the last N injection records"* rendered only in the `else` branch — the
   unconditional claim made in exactly the branch that withholds its condition.

### One collision worth designing around

Per §2 of the spec, **an open stream is explicitly not activity** and never resets the 15-minute idle
timer. So the Watch screen is the one screen where the server exiting is most surprising. Show the idle
countdown on this screen, derived from the heartbeat, so the exit is expected rather than read as a
crash.

---

## 7. Two graphics the data supports that nobody has proposed

### 7a. Selected-but-not-delivered — a diverging bar per item

`audit_item.role` distinguishes `injected` from `spilled` per item and is indexed. The schema's own
comment says it outright:

> a `'spilled'` row is an item that was eligible and did not fit, and **counting those by item is how a
> user finds a budget that is too small.**

No screen in the spec renders it. One indexed query; one diverging bar per item — delivered growing from
the reading-start edge, spilled from the centre outward, sorted by spill ratio. *"`STD-api-errors-problem-json`:
selected 44 times, delivered 3"* is a complete argument for a budget change, and it gives the budget
simulator the **entry point it currently lacks** — today the simulator is a toy you have to already
suspect something to open.

### 7b. The session ribbon — the shape of one session's context

Every injection record for one `session_id`, laid out along time, each segment a tier colour sized by
`tokens`, with spills as ghosts beneath. It answers *why did Claude forget X* in a way nothing else can:
you see X delivered at minute 2, and — because `seen` filters before budgeting and *"must not be
reverted"* — never again. Where the §4b status-line bridge is installed, the same band carries the real
context total on the same axis, and the join sentence (*"of 47k in use, 6.2k came from your project
knowledge"*) becomes a picture rather than a claim. Every field it needs already exists; the record
already carries `tokens`, `injected`, `spilled` and `sessionId`, and the ledger already keys on the same
id.

*(A third, cheaper idea: `doctor` already emits `dead_scope` for a glob matching no file. The coverage
map holds the file list. Marking dead globs in the detail pane costs nothing and answers "why does this
rule never fire".)*

---

## Scale and degradation

The map must work at 50 files and at 50,000. Four layers, each **disclosed** rather than silent, because
`INV-nothing-is-dropped-silently` is a project invariant and a chart that quietly omits rows is that
invariant broken in a new medium.

### 1 · The payload: directories on the wire, not files

`/api/coverage` currently returns `files: { path, governs: string[] }[]` — one row per file, each
carrying an id array. At 50,000 files × ~3 ids that is tens of MB of JSON to serialize, transfer, parse
and hold. **Change the endpoint to a directory rollup:**

```ts
{ dirs: { path, files, governed, unexamined, governingIds: string[] /* deduped, capped */ }[],
  pinned: string[], items: [...], truncated: boolean, budgetExhausted: boolean }
```

Per-file detail is fetched for the opened directory only (`?dir=src/billing&depth=1`). Directories are
roughly a tenth of files: the sketch's 57,195-file corpus is **2,822 directories**.

### 2 · The loop: invert it, then prune

The naive composition is `files × items` calls into `matchesScope`. Three changes, none of which
re-implements a rule:

- **`injection(item, config)` is path-independent — call it once per item, never per file.** 200 calls
  instead of 10,000,000. The plan's composition is correct; only the loop order was wrong.
- **Unscoped-injectable items match every path with zero `matchesScope` calls.** `matchesScope` returns
  `scopePolicyFor(config, item.type) !== 'inert'` for an empty scope — a per-category constant.
  Partition once; add the constant set to every directory. On this repo's corpus that removes ~70% of
  the items from the per-path loop entirely.
- **Prefix-prune the walk.** A glob's leading literal segments bound the subtree it can match
  (`src/billing/**` → `src/billing/`), so a directory that cannot prefix-match any glob is decided for
  its **whole subtree** in one test.

  > This is a **scheduling** optimisation, not a second matcher. Every reported answer still comes from a
  > real `matchesScope` call on a real path; pruning only skips calls whose answer is provably `false`.
  > To keep that honest: `globPrefix(pattern)` belongs **in `paths.ts` beside `globToRegExp`**, so glob
  > grammar stays in one module, and it must be pinned by a property test — *the pruned result equals the
  > unpruned result over a random corpus* — not by reading. This project's whole failure history is
  > second implementations of one rule, and a pruner is exactly the shape that becomes one.

### 3 · Two truncations, never merged into one word

- `listRepoFiles` has its own **`FILE_LIMIT = 20_000`** bound (`doctor/checks.ts`), and it stops
  *mid-walk*. Files exist that were never examined.
- The coverage computation gets its own **time budget** (~150 ms). On exhaustion it stops descending.

These are different facts and get different rows: *"the walk hit its 20,000-file bound"* vs *"coverage
stopped after 150 ms; N directories not examined."* Both render as a hatched **not examined** state,
which is a third state distinct from *governed* and from *gap* — because "we did not look" and "nothing
governs it" are not the same answer, and merging them would let the flagship screen assert a gap it
never measured.

### 4 · The client: virtualise, and default to the informative subset

Only the visible ~28 rows are in the DOM (verified in the sketch at 2,822 directories). The density rail
merges runs, so it stays a few dozen `<rect>`s at any size. Default expansion is depth 1 plus
"where coverage changes".

### The other five graphics

They are all **O(items)** or **O(records in the window)**, not O(files), and none needs a strategy:

| Graphic | Bound | At scale |
|---|---|---|
| Budget ribbon | one tier's candidate set, tens | trivial |
| Staircase | breakpoints ≤ candidates | one sweep request, then no I/O |
| Recency comb | eligible normative items; virtualise past ~200 rows, or bin into a histogram with the tail listed | fine |
| Heatstrip | top N items × 90 cells | capped by N |
| Ego graph | **capped at 60 by the endpoint** | fine by construction |
| Audit stream | a window of records; the log rotates at `AUDIT_MAX_BYTES` = 8 MiB and the projection is indexed | fine |

The one to watch is the comb past a few hundred items: switch to a histogram of the time axis with the
cold tail listed by name, rather than 5,000 rows nobody scrolls.

---

## RTL mirroring

The constraint that drives everything: **CSS cannot mirror an SVG's interior.** `direction: rtl` on an
`<svg>` changes text anchoring and nothing about `x`. Wrapping the drawing in `transform="scale(-1,1)"`
mirrors the *glyphs* too, so every label needs a counter-transform and the whole thing becomes unmaintainable.

### The rule, per graphic

| Graphic | Medium | How it mirrors |
|---|---|---|
| Coverage tree rows, budget ribbon, heatstrip, diverging bars, audit feed | **CSS box model** | **For free.** Logical properties throughout — `padding-inline-start` for indent, `flex` for fills, `border-inline-start` for the selection marker. Zero JavaScript. |
| Density rail | CSS + a text-free SVG | Docks to `inset-inline-end`. **No coordinate work at all** — an SVG with no interior text mirrors by moving. |
| Staircase, recency comb, pulse, ego graph | **SVG interiors** | One projection function, applied where coordinates are emitted: `X(u, W) = rtl ? W - u : u`, plus `ANC(a)` swapping `text-anchor` `start`⇄`end`. Direction is a **render parameter**, and toggling it re-emits the SVGs. |

The sketch implements exactly this and the toggle is live: flipping to Hebrew mirrors the staircase (12,000
moves to the left, the axis labels stay readable), the comb (the *never* bucket moves to the reading-end),
the pulse, and the ego graph (`r1·in` moves to the right of the focus) — with no glyph reversed anywhere.

### What must *not* mirror

Per spec §3, **the file tree and every path, id, glob and command stay LTR inside the RTL page** — a path
is not prose. That is achieved with one CSS rule, `direction: ltr; unicode-bidi: isolate` on `.m`. The
`isolate` is load-bearing, not tidiness: without it a trailing comma after `RULE-x` at the end of a Hebrew
sentence lands on the wrong side.

### Three cases CSS will not cover, written down rather than discovered

1. **Corner radii on the diverging bars.** `border-radius` has no logical form, so the RTL rule restates
   the two halves explicitly. This is the only physical-value exception in the sketch, and it is commented
   as such.
2. **`box-shadow` offsets** (the selected-row marker). Same absence of a logical form; the mockup already
   mirrors this one by hand and the pattern carries over.
3. **Keyboard direction.** Tree expand/collapse is ArrowRight/ArrowLeft in LTR and **swaps** in RTL. CSS
   cannot mirror a key code, so this is a render-layer mirror of the handler.

### Semantic direction

One rule, applied everywhere: **quantity and sequence grow from the inline-start edge.** Budget fills, time
axes, delivered/spilled bars and the feed all obey it, so a Hebrew reader reads *earlier → later* and
*less → more* in their own direction. Numbers and dates inside those graphics stay LTR-isolated, because a
number is not prose either.

### Why the ego graph carries ids and not titles — again, because it is the payoff

An id is ASCII by grammar; a title may be Hebrew. Keeping titles out of the SVG means **no SVG element in
the product contains bidi-sensitive text**, which reduces the entire SVG mirroring problem to arithmetic.

---

## Headline

The flagship's real defect is not the 960 ms — that measurement predates the glob cache that shipped in
`e96bd05`, and the remaining cost is payload shape and loop order, both fixable by sending directories
instead of files and by hoisting the path-independent half of the rule out of the per-file loop. The
defect that matters is an encoding one: pinned items govern every file and the current design colours a
pinned-governed directory as an uncovered gap, so pinned coverage must leave the tree and become a band
above it, at which point "gap" finally means the true and useful thing. Everywhere else the winning move
is to draw the mechanism rather than the summary — spills interleaved at their real width because the
selector is first-fit, downward steps on the budget staircase because raising a budget can evict an item,
and a focus change drawn as a rule across the audit feed rather than a row in it, because it is not an
event but a change of regime for everything after it.
